/**
 * Foreground "Hey Ruby" wake word — unified WebView pipeline.
 *
 * Mic (getUserMedia) → AudioWorklet @ 16 kHz → mel → embedding → hey_ruby.onnx
 * via onnxruntime-web. Releases mic + AudioContext on stop for Whisper/STT handoff.
 */

import { Capacitor } from '@capacitor/core';

import {
  HEY_RUBY_MODELS_BASE,
  HEY_RUBY_MODEL_FILE,
  OPENWAKEWORD_DEFAULT_COOLDOWN_MS,
  OPENWAKEWORD_ORT_BASE,
  parseDetectionThreshold,
  resolvePublicAssetUrl,
} from '../constants/openWakeWord';
import { HeyRubyWakePipeline } from './heyRubyWakePipeline';
import {
  acquireMicrophoneStream,
  formatMicrophoneErrorForUser,
  getHeldMicrophoneStream,
  isMicrophoneNotFoundError,
  isMicrophonePermissionError,
  microphoneErrorMessage,
  releaseHeldMicrophoneStream,
} from './microphoneAccess';
import {
  ensureRecordAudioPermission,
  releaseSpeechSession,
} from './speechRecognitionCoordinator';

export interface WakePhraseListenerOptions {
  onWakeDetected: () => void;
  onPermissionDenied?: () => void;
  /** Shown when wake fails for a non-permission reason (missing models, ORT, audio, etc.). */
  onStartFailed?: (message: string, micNotFound?: boolean) => void;
  onDebugEvent?: (message: string) => void;
}

const HEY_RUBY_MODEL_CANDIDATES = [
  HEY_RUBY_MODEL_FILE,
  'Hey_Ruby.onnx',
  'hey_ruby_v0.1.onnx',
] as const;

let pipeline: HeyRubyWakePipeline | null = null;
let wakeRunning = false;
let lastWakeAt = 0;
const DUPLICATE_GUARD_MS = 1500;

function debug(options: WakePhraseListenerOptions, message: string): void {
  options.onDebugEvent?.(message);
}

function logError(context: string, err: unknown): void {
  console.error(`[rubyWakeListening] ${context}`, err);
}

async function assetExists(publicPath: string): Promise<boolean> {
  const url = resolvePublicAssetUrl(publicPath);
  try {
    let res = await fetch(url, { method: 'HEAD' });
    if (res.ok) return true;
    res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
    return res.ok;
  } catch {
    try {
      const res = await fetch(url);
      return res.ok;
    } catch {
      return false;
    }
  }
}

async function resolveClassifierFile(): Promise<string | null> {
  for (const file of HEY_RUBY_MODEL_CANDIDATES) {
    if (await assetExists(`${HEY_RUBY_MODELS_BASE}/${file}`)) {
      return file;
    }
  }
  return null;
}

function handleDetection(options: WakePhraseListenerOptions, score: number): void {
  const now = Date.now();
  if (now - lastWakeAt < DUPLICATE_GUARD_MS) {
    debug(options, 'wake ignored: duplicate guard');
    return;
  }
  lastWakeAt = now;
  debug(options, `wake detected: hey_ruby (${score.toFixed(2)})`);
  void stopWakePhraseListening();
  options.onWakeDetected();
}

function notifyStartFailure(options: WakePhraseListenerOptions, err: unknown): void {
  const raw = microphoneErrorMessage(err);
  debug(options, `wake start failed: ${raw}`);
  if (isMicrophonePermissionError(err)) {
    options.onPermissionDenied?.();
    return;
  }
  options.onStartFailed?.(formatMicrophoneErrorForUser(err), isMicrophoneNotFoundError(err));
}

async function resolveMicrophoneStream(): Promise<MediaStream> {
  const held = getHeldMicrophoneStream();
  if (held) return held;
  return acquireMicrophoneStream();
}

/**
 * On native: request RECORD_AUDIO and open the mic once on a user gesture.
 * The stream is held until wake stops (avoids a second getUserMedia after slow ONNX load).
 */
export async function primeMicrophoneForWake(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;

  await releaseSpeechSession();
  await ensureRecordAudioPermission();

  try {
    await acquireMicrophoneStream();
    console.log('[ruby-wake] microphone primed (stream held for wake pipeline)');
    return true;
  } catch (err) {
    console.warn('[rubyWakeListening] mic prime failed:', microphoneErrorMessage(err));
    releaseHeldMicrophoneStream();
    return false;
  }
}

export async function startWakePhraseListening(options: WakePhraseListenerOptions): Promise<boolean> {
  if (wakeRunning) {
    debug(options, 'wake already running');
    return true;
  }

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    logError('start', new Error('getUserMedia is not available'));
    options.onStartFailed?.('Microphone API is not available in this WebView.');
    return false;
  }

  const classifierFile = await resolveClassifierFile();
  if (!classifierFile) {
    const msg = `Missing ${HEY_RUBY_MODELS_BASE}/hey_ruby.onnx — run npm run setup:hey-ruby-models && npm run build`;
    logError('start', new Error(msg));
    debug(options, msg);
    options.onStartFailed?.(msg);
    return false;
  }

  const threshold = parseDetectionThreshold();
  debug(options, `starting Hey Ruby ONNX pipeline (${classifierFile}, threshold=${threshold})`);

  if (Capacitor.isNativePlatform()) {
    await releaseSpeechSession();
    await ensureRecordAudioPermission();
  }

  try {
    const wakePipeline = new HeyRubyWakePipeline({
      classifierFile,
      modelsBase: HEY_RUBY_MODELS_BASE,
      ortWasmPath: OPENWAKEWORD_ORT_BASE,
      detectionThreshold: threshold,
      cooldownMs: OPENWAKEWORD_DEFAULT_COOLDOWN_MS,
      onDetect: (score) => handleDetection(options, score),
      onError: (err) => {
        logError('pipeline', err);
        debug(options, `pipeline error: ${microphoneErrorMessage(err)}`);
      },
      onDebug: (msg) => debug(options, msg),
    });

    // Load ONNX first (no mic) so Android only needs one getUserMedia on the user gesture.
    await wakePipeline.load();
    debug(options, 'ONNX models loaded, attaching microphone');

    const mediaStream = await resolveMicrophoneStream();
    await wakePipeline.start({ mediaStream });

    pipeline = wakePipeline;
    wakeRunning = true;
    debug(options, 'wake_listener_started (onnxruntime-web @ 16kHz)');
    return true;
  } catch (err) {
    logError('start failed', err);
    notifyStartFailure(options, err);
    await stopWakePhraseListening();
    return false;
  }
}

export async function stopWakePhraseListening(): Promise<void> {
  if (pipeline) {
    try {
      await pipeline.stop();
    } catch (err) {
      logError('stop', err);
    }
    try {
      await pipeline.dispose();
    } catch (err) {
      logError('dispose', err);
    }
    pipeline = null;
  }

  releaseHeldMicrophoneStream();
  wakeRunning = false;
}

export async function restartWakePhraseListening(options: WakePhraseListenerOptions): Promise<boolean> {
  await stopWakePhraseListening();
  return startWakePhraseListening(options);
}
