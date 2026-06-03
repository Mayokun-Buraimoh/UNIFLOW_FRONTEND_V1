/**
 * On-device Hey Ruby wake pipeline: mic → 16 kHz frames → mel → embedding → hey_ruby.onnx
 * Uses onnxruntime-web directly (openWakeWord-compatible graph).
 */

import * as ort from 'onnxruntime-web';
import { Capacitor } from '@capacitor/core';

import {
  HEY_RUBY_KEYWORD,
  HEY_RUBY_MODELS_BASE,
  OPENWAKEWORD_ORT_BASE,
  resolvePublicAssetUrl,
} from '../constants/openWakeWord';
import { configureOrtWasmEnv } from './ortWasmEnv';

const SAMPLE_RATE = 16_000;
const FRAME_SIZE = 1280;
const VAD_HANGOVER_FRAMES = 12;
const EMBEDDING_DIM = 96;
const DEFAULT_EMBEDDING_WINDOW = 16;

const AUDIO_WORKLET_CODE = `
class HeyRubyAudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = options.processorOptions || {};
    this.frameSize = opts.frameSize || 1280;
    this.inputRate = sampleRate;
    this.targetRate = opts.targetSampleRate || 16000;
    this._carry = new Float32Array(0);
    this._outBuf = new Float32Array(this.frameSize);
    this._outPos = 0;
  }

  _resampleAndAppend(input) {
    if (!input || input.length === 0) return;
    const ratio = this.inputRate / this.targetRate;
    const estOut = Math.max(1, Math.floor(input.length / ratio));
    const merged = new Float32Array(this._carry.length + estOut);
    merged.set(this._carry, 0);
    let w = this._carry.length;
    for (let i = 0; i < estOut; i++) {
      const srcIdx = i * ratio;
      const i0 = Math.floor(srcIdx);
      const i1 = Math.min(i0 + 1, input.length - 1);
      const frac = srcIdx - i0;
      merged[w++] = input[i0] * (1 - frac) + input[i1] * frac;
    }
    this._carry = merged;
    while (this._carry.length >= this.frameSize) {
      const frame = this._carry.slice(0, this.frameSize);
      this.port.postMessage(frame);
      this._carry = this._carry.slice(this.frameSize);
    }
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (input) this._resampleAndAppend(input);
    return true;
  }
}
registerProcessor('hey-ruby-audio-processor', HeyRubyAudioProcessor);
`;

type KeywordModelState = {
  session: ort.InferenceSession;
  scores: number[];
  windowSize: number;
  history: Float32Array[];
};

export type HeyRubyWakePipelineOptions = {
  classifierFile: string;
  modelsBase?: string;
  ortWasmPath?: string;
  detectionThreshold?: number;
  cooldownMs?: number;
  onDetect?: (score: number) => void;
  onError?: (err: unknown) => void;
  onDebug?: (message: string) => void;
};

export class HeyRubyWakePipeline {
  private readonly modelsBase: string;
  private readonly classifierFile: string;
  private readonly threshold: number;
  private readonly cooldownMs: number;
  private readonly onDetect?: (score: number) => void;
  private readonly onError?: (err: unknown) => void;
  private readonly onDebug?: (message: string) => void;
  private readonly ortWasmPath: string;

  private melspecModel: ort.InferenceSession | null = null;
  private embeddingModel: ort.InferenceSession | null = null;
  private vadModel: ort.InferenceSession | null = null;
  private keywordModel: KeywordModelState | null = null;

  private melBuffer: Float32Array[] = [];
  private vadState: { h: ort.Tensor; c: ort.Tensor } | null = null;
  private isSpeechActive = false;
  private vadHangover = 0;
  private detectionCoolingDown = false;
  private cooldownTimer: ReturnType<typeof setTimeout> | null = null;

  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private workletUrl: string | null = null;
  private processingQueue: Promise<void> = Promise.resolve();
  private loaded = false;
  private running = false;
  private ownsMediaStream = true;

  constructor(options: HeyRubyWakePipelineOptions) {
    this.classifierFile = options.classifierFile;
    this.modelsBase = (options.modelsBase ?? HEY_RUBY_MODELS_BASE).replace(/\/+$/, '');
    this.threshold = options.detectionThreshold ?? 0.5;
    this.cooldownMs = options.cooldownMs ?? 2000;
    this.onDetect = options.onDetect;
    this.onError = options.onError;
    this.onDebug = options.onDebug;
    this.ortWasmPath = options.ortWasmPath ?? OPENWAKEWORD_ORT_BASE;
  }

  private modelUrl(file: string): string {
    const base = this.modelsBase.startsWith('http')
      ? this.modelsBase
      : resolvePublicAssetUrl(this.modelsBase);
    return `${base.replace(/\/+$/, '')}/${file}`;
  }

  private debug(message: string): void {
    this.onDebug?.(message);
  }

  private inferKeywordWindowSize(session: ort.InferenceSession): number {
    const inputName = session.inputNames[0];
    if (!inputName) return DEFAULT_EMBEDDING_WINDOW;
    const metadataList = session.inputMetadata as unknown as Array<{ name?: string; dimensions?: readonly number[] }>;
    const meta =
      Array.isArray(metadataList)
        ? metadataList.find((m) => m?.name === inputName) ?? metadataList[0]
        : undefined;
    const dim = meta?.dimensions?.[1];
    return typeof dim === 'number' && Number.isFinite(dim) ? dim : DEFAULT_EMBEDDING_WINDOW;
  }

  async load(): Promise<void> {
    if (this.loaded) return;

    configureOrtWasmEnv(this.ortWasmPath);

    const sessionOptions: ort.InferenceSession.SessionOptions = {
      executionProviders: ['wasm'],
    };

    try {
      this.debug(`loading ONNX sessions (ort wasm: ${ort.env.wasm.wasmPaths})`);
      this.melspecModel = await ort.InferenceSession.create(
        this.modelUrl('melspectrogram.onnx'),
        sessionOptions
      );
      this.embeddingModel = await ort.InferenceSession.create(
        this.modelUrl('embedding_model.onnx'),
        sessionOptions
      );
      this.vadModel = await ort.InferenceSession.create(this.modelUrl('silero_vad.onnx'), sessionOptions);
      const classifierSession = await ort.InferenceSession.create(
        this.modelUrl(this.classifierFile),
        sessionOptions
      );

      const windowSize = this.inferKeywordWindowSize(classifierSession);
      const history: Float32Array[] = [];
      for (let i = 0; i < windowSize; i++) {
        history.push(new Float32Array(EMBEDDING_DIM));
      }

      this.keywordModel = {
        session: classifierSession,
        scores: new Array(50).fill(0),
        windowSize,
        history,
      };

      this.resetInferenceState();
      this.loaded = true;
      this.debug(`models ready (classifier=${this.classifierFile}, window=${windowSize})`);
    } catch (err) {
      this.onError?.(err);
      throw err;
    }
  }

  private resetInferenceState(): void {
    this.melBuffer = [];
    const vadShape = [2, 1, 64] as const;
    if (!this.vadState) {
      this.vadState = {
        h: new ort.Tensor('float32', new Float32Array(128), vadShape),
        c: new ort.Tensor('float32', new Float32Array(128), vadShape),
      };
    } else {
      (this.vadState.h.data as Float32Array).fill(0);
      (this.vadState.c.data as Float32Array).fill(0);
    }
    this.isSpeechActive = false;
    this.vadHangover = 0;
    this.detectionCoolingDown = false;
    if (this.keywordModel) {
      this.keywordModel.scores.fill(0);
      for (const row of this.keywordModel.history) {
        row.fill(0);
      }
    }
  }

  async start(options?: { mediaStream?: MediaStream }): Promise<void> {
    if (!this.loaded) {
      throw new Error('HeyRubyWakePipeline.load() must be called before start()');
    }
    if (this.running) return;

    this.resetInferenceState();

    try {
      if (options?.mediaStream) {
        this.mediaStream = options.mediaStream;
        this.ownsMediaStream = false;
      } else {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: false,
        });
        this.ownsMediaStream = true;
      }

      // Forcing 16 kHz can fail on some Android WebViews; worklet resamples to target rate.
      this.audioContext = Capacitor.isNativePlatform()
        ? new AudioContext()
        : new AudioContext({ sampleRate: SAMPLE_RATE });
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.debug(
        `AudioContext sampleRate=${this.audioContext.sampleRate} (target ${SAMPLE_RATE})`
      );

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1;

      const blob = new Blob([AUDIO_WORKLET_CODE], { type: 'application/javascript' });
      this.workletUrl = URL.createObjectURL(blob);
      await this.audioContext.audioWorklet.addModule(this.workletUrl);

      this.workletNode = new AudioWorkletNode(this.audioContext, 'hey-ruby-audio-processor', {
        processorOptions: {
          frameSize: FRAME_SIZE,
          targetSampleRate: SAMPLE_RATE,
        },
      });

      this.workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
        const chunk = event.data;
        if (!chunk || chunk.length !== FRAME_SIZE) return;
        this.processingQueue = this.processingQueue
          .then(() => this.processFrame(chunk))
          .catch((err) => this.onError?.(err));
      };

      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.workletNode);
      // Silent sink so the graph runs without audible loopback
      const mute = this.audioContext.createGain();
      mute.gain.value = 0;
      this.workletNode.connect(mute);
      mute.connect(this.audioContext.destination);

      this.running = true;
      this.debug('mic pipeline started');
    } catch (err) {
      await this.stop();
      this.onError?.(err);
      throw err;
    }
  }

  async stop(): Promise<void> {
    this.running = false;

    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }

    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      try {
        this.workletNode.disconnect();
      } catch {
        /* noop */
      }
      this.workletNode = null;
    }

    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch {
        /* noop */
      }
      this.gainNode = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        /* noop */
      }
      this.sourceNode = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.close();
      } catch {
        /* noop */
      }
    }
    this.audioContext = null;

    if (this.mediaStream && this.ownsMediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
    }
    this.mediaStream = null;
    this.ownsMediaStream = true;

    if (this.workletUrl) {
      URL.revokeObjectURL(this.workletUrl);
      this.workletUrl = null;
    }

    this.processingQueue = Promise.resolve();
    this.debug('mic pipeline stopped (tracks + AudioContext released)');
  }

  async dispose(): Promise<void> {
    await this.stop();
    this.melspecModel = null;
    this.embeddingModel = null;
    this.vadModel = null;
    this.keywordModel = null;
    this.vadState = null;
    this.loaded = false;
  }

  private async processFrame(chunk: Float32Array): Promise<void> {
    if (!this.melspecModel || !this.embeddingModel || !this.vadModel || !this.keywordModel || !this.vadState) {
      return;
    }

    const speech = await this.runVad(chunk);
    if (speech) {
      this.isSpeechActive = true;
      this.vadHangover = VAD_HANGOVER_FRAMES;
    } else if (this.isSpeechActive) {
      this.vadHangover -= 1;
      if (this.vadHangover <= 0) {
        this.isSpeechActive = false;
      }
    }

    await this.runInference(chunk);
  }

  private async runVad(chunk: Float32Array): Promise<boolean> {
    if (!this.vadModel || !this.vadState) return false;

    try {
      const input = new ort.Tensor('float32', chunk, [1, chunk.length]);
      const sr = new ort.Tensor('int64', [BigInt(SAMPLE_RATE)], []);
      const res = await this.vadModel.run({
        input,
        sr,
        h: this.vadState.h,
        c: this.vadState.c,
      });
      this.vadState.h = res.hn as ort.Tensor;
      this.vadState.c = res.cn as ort.Tensor;
      const confidence = (res.output as ort.Tensor).data[0] as number;
      return confidence > 0.5;
    } catch (err) {
      this.onError?.(err);
      return false;
    }
  }

  private async runInference(chunk: Float32Array): Promise<void> {
    const melspec = this.melspecModel!;
    const embedding = this.embeddingModel!;
    const keyword = this.keywordModel!;

    const melspecTensor = new ort.Tensor('float32', chunk, [1, FRAME_SIZE]);
    const melspecResults = await melspec.run({
      [melspec.inputNames[0]]: melspecTensor,
    });
    const melOut = melspecResults[melspec.outputNames[0]] as ort.Tensor;
    const newMelData = melOut.data as Float32Array;

    for (let j = 0; j < newMelData.length; j++) {
      newMelData[j] = newMelData[j] / 10.0 + 2.0;
    }
    for (let j = 0; j < 5; j++) {
      this.melBuffer.push(new Float32Array(newMelData.subarray(j * 32, (j + 1) * 32)));
    }

    while (this.melBuffer.length >= 76) {
      const windowFrames = this.melBuffer.slice(0, 76);
      const flattenedMel = new Float32Array(76 * 32);
      for (let j = 0; j < windowFrames.length; j++) {
        flattenedMel.set(windowFrames[j], j * 32);
      }

      const embeddingFeeds = {
        [embedding.inputNames[0]]: new ort.Tensor('float32', flattenedMel, [1, 76, 32, 1]),
      };
      const embeddingOut = await embedding.run(embeddingFeeds);
      const embeddingVector = new Float32Array(
        (embeddingOut[embedding.outputNames[0]] as ort.Tensor).data as ArrayLike<number>
      );

      keyword.history.shift();
      keyword.history.push(embeddingVector);

      const flattenedEmbeddings = new Float32Array(keyword.windowSize * EMBEDDING_DIM);
      for (let j = 0; j < keyword.history.length; j++) {
        flattenedEmbeddings.set(keyword.history[j], j * EMBEDDING_DIM);
      }

      const classifierInput = new ort.Tensor('float32', flattenedEmbeddings, [
        1,
        keyword.windowSize,
        EMBEDDING_DIM,
      ]);
      const results = await keyword.session.run({
        [keyword.session.inputNames[0]]: classifierInput,
      });
      const score = (results[keyword.session.outputNames[0]] as ort.Tensor).data[0] as number;

      keyword.scores.shift();
      keyword.scores.push(score);

      if (
        score > this.threshold &&
        this.isSpeechActive &&
        !this.detectionCoolingDown &&
        this.running
      ) {
        this.detectionCoolingDown = true;
        this.debug(`${HEY_RUBY_KEYWORD} score=${score.toFixed(3)}`);
        this.onDetect?.(score);
        this.cooldownTimer = setTimeout(() => {
          this.detectionCoolingDown = false;
          this.cooldownTimer = null;
        }, this.cooldownMs);
      }

      this.melBuffer.splice(0, 8);
    }
  }
}
