import { Capacitor } from '@capacitor/core';
import { getApiBaseUrl } from '../constants/apiBaseUrl';
import { RUBY_NAVIGATE_EVENT, type RubyNavigateDetail, type RubyNavigateMode } from '../constants/rubyNavigate';
import { releaseSpeechSession } from './speechRecognitionCoordinator';
import { getBearerAuthToken } from '../utils/authToken';

export type RubyRealtimeState = 'listening' | 'processing' | 'responding' | 'idle';

export interface RubyRealtimeMutations {
  tasks: boolean;
  events: boolean;
  plans?: boolean;
  courses?: boolean;
  schedule?: boolean;
}

type RealtimeInbound =
  | { type: 'asr.partial'; text: string }
  | { type: 'asr.final'; text: string }
  | { type: 'assistant.partial'; text: string }
  | { type: 'assistant.final'; text: string; mutations?: RubyRealtimeMutations }
  | { type: 'assistant.mutations'; mutations: RubyRealtimeMutations }
  | { type: 'app.navigate'; path: string; mode?: RubyNavigateMode }
  | { type: 'assistant.audio'; audioBase64: string; audioMimeType: string }
  | { type: 'assistant.interrupted' }
  | { type: 'state'; state: RubyRealtimeState }
  | { type: 'error'; message: string };

export interface RubyVoiceRealtimeClientOptions {
  sessionId: string;
  timezone: string;
  weeklySchedule?: unknown;
  onTranscriptPartial?: (text: string) => void;
  onTranscriptFinal?: (text: string) => void;
  onAssistantPartial?: (text: string) => void;
  onAssistantFinal?: (text: string, mutations?: RubyRealtimeMutations) => void;
  onAssistantMutations?: (mutations: RubyRealtimeMutations) => void;
  onAssistantAudio?: (audioBase64: string, audioMimeType: string) => void;
  onAssistantInterrupted?: () => void;
  onState?: (state: RubyRealtimeState) => void;
  onError?: (message: string) => void;
}

function resolveRealtimeWsUrl(): string {
  const envUrl = import.meta.env.VITE_RUBY_REALTIME_WS_URL as string | undefined;
  if (envUrl && envUrl.trim()) return envUrl.trim();
  const apiBase = getApiBaseUrl().replace(/\/+$/, '');
  const wsBase = apiBase.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
  return `${wsBase}/voice/realtime`;
}

const TARGET_SAMPLE_RATE = 16_000;

function float32ToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0));
    out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
  }
  return out;
}

/** Downsample device-rate audio to 16 kHz linear16 for Deepgram. */
function resampleFloat32ToInt16(input: Float32Array, inputSampleRate: number): Int16Array {
  if (inputSampleRate <= 0 || input.length === 0) {
    return new Int16Array(0);
  }
  if (Math.abs(inputSampleRate - TARGET_SAMPLE_RATE) < 1) {
    return float32ToInt16(input);
  }
  const ratio = inputSampleRate / TARGET_SAMPLE_RATE;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcIdx = i * ratio;
    const i0 = Math.floor(srcIdx);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = srcIdx - i0;
    const sample = (input[i0] ?? 0) * (1 - frac) + (input[i1] ?? 0) * frac;
    const s = Math.max(-1, Math.min(1, sample));
    out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
  }
  return out;
}

export class RubyVoiceRealtimeClient {
  private readonly options: RubyVoiceRealtimeClientOptions;
  private readonly wsUrl: string;
  private ws: WebSocket | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private running = false;

  constructor(options: RubyVoiceRealtimeClientOptions) {
    this.options = options;
    this.wsUrl = resolveRealtimeWsUrl();
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      await this.connectWs();
      await this.startMicrophoneStream();
      this.options.onState?.('listening');
    } catch (err) {
      this.running = false;
      await this.stop();
      const msg = err instanceof Error ? err.message : 'Realtime voice start failed';
      this.options.onError?.(msg);
      throw err;
    }
  }

  async stop(): Promise<void> {
    this.running = false;

    if (this.processorNode) {
      this.processorNode.onaudioprocess = null;
      try {
        this.processorNode.disconnect();
      } catch {
        /* noop */
      }
      this.processorNode = null;
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

    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }

    if (this.ws) {
      try {
        this.ws.send(JSON.stringify({ type: 'session.end', session_id: this.options.sessionId }));
      } catch {
        /* noop */
      }
      try {
        this.ws.close(1000, 'client-stop');
      } catch {
        /* noop */
      }
      this.ws = null;
    }
  }

  submitText(text: string): void {
    const value = text.trim();
    if (!value || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'text.submit', text: value, session_id: this.options.sessionId }));
  }

  interruptAssistant(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'assistant.interrupt', session_id: this.options.sessionId }));
  }

  private async connectWs(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const token = getBearerAuthToken();
      const authUrl = new URL(this.wsUrl);
      if (token) {
        authUrl.searchParams.set('token', token);
      }
      const ws = new WebSocket(authUrl.toString());
      this.ws = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'session.start',
            session_id: this.options.sessionId,
            timezone: this.options.timezone,
            weekly_schedule: this.options.weeklySchedule ?? null,
            sample_rate_hz: 16000,
            encoding: 'linear16',
          })
        );
        resolve();
      };

      ws.onmessage = (event) => {
        if (typeof event.data !== 'string') return;
        let payload: RealtimeInbound;
        try {
          payload = JSON.parse(event.data) as RealtimeInbound;
        } catch {
          return;
        }
        this.handleInbound(payload);
      };

      ws.onerror = () => {
        reject(new Error('Realtime websocket connection failed'));
      };

      ws.onclose = () => {
        if (!this.running) return;
        this.options.onError?.('Realtime websocket disconnected');
      };
    });
  }

  private async startMicrophoneStream(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone API is not available');
    }

    if (Capacitor.isNativePlatform()) {
      await releaseSpeechSession();
      // Let iOS release the wake-word mic before opening a new capture session.
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false,
    });

    // Match wake pipeline: native WebViews often reject forced 16 kHz; resample in JS.
    this.audioContext = Capacitor.isNativePlatform()
      ? new AudioContext()
      : new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const captureRate = this.audioContext.sampleRate;

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processorNode = this.audioContext.createScriptProcessor(2048, 1, 1);
    this.processorNode.onaudioprocess = (event) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const input = event.inputBuffer.getChannelData(0);
      const pcm16 = resampleFloat32ToInt16(input, captureRate);
      if (pcm16.length === 0) return;
      this.ws.send(pcm16.buffer);
    };

    this.sourceNode.connect(this.processorNode);
    const sink = this.audioContext.createGain();
    sink.gain.value = 0;
    this.processorNode.connect(sink);
    sink.connect(this.audioContext.destination);
  }

  private handleInbound(payload: RealtimeInbound): void {
    switch (payload.type) {
      case 'asr.partial':
        this.options.onTranscriptPartial?.(payload.text);
        break;
      case 'asr.final':
        this.options.onTranscriptFinal?.(payload.text);
        break;
      case 'assistant.partial':
        this.options.onAssistantPartial?.(payload.text);
        break;
      case 'assistant.final':
        this.options.onAssistantFinal?.(payload.text, payload.mutations);
        break;
      case 'assistant.mutations':
        this.options.onAssistantMutations?.(payload.mutations);
        break;
      case 'app.navigate': {
        const detail: RubyNavigateDetail = {
          path: payload.path,
          mode: payload.mode === 'forward' ? 'forward' : 'root',
        };
        window.dispatchEvent(new CustomEvent<RubyNavigateDetail>(RUBY_NAVIGATE_EVENT, { detail }));
        break;
      }
      case 'assistant.audio':
        this.options.onAssistantAudio?.(payload.audioBase64, payload.audioMimeType);
        break;
      case 'assistant.interrupted':
        this.options.onAssistantInterrupted?.();
        break;
      case 'state':
        this.options.onState?.(payload.state);
        break;
      case 'error':
        this.options.onError?.(payload.message || 'Realtime voice error');
        break;
      default:
        break;
    }
  }
}
