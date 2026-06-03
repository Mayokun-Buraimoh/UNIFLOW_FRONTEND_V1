/**
 * Microphone access helpers for wake word (getUserMedia is the source of truth on WebView).
 */

export type MicrophoneProbeResult =
  | { ok: true }
  | { ok: false; message: string; permissionDenied: boolean };

let heldMicStream: MediaStream | null = null;

function isStreamLive(stream: MediaStream): boolean {
  return stream.getAudioTracks().some((t) => t.readyState === 'live');
}

export function getHeldMicrophoneStream(): MediaStream | null {
  if (heldMicStream && isStreamLive(heldMicStream)) {
    return heldMicStream;
  }
  heldMicStream = null;
  return null;
}

export function releaseHeldMicrophoneStream(): void {
  if (!heldMicStream) return;
  for (const track of heldMicStream.getTracks()) {
    track.stop();
  }
  heldMicStream = null;
}

async function getUserMediaWithFallback(): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone API is not available');
  }

  const attempts: MediaStreamConstraints[] = [
    { audio: { echoCancellation: true, noiseSuppression: true }, video: false },
    { audio: true, video: false },
  ];

  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastError = err;
      if (isMicrophonePermissionError(err)) throw err;
    }
  }
  throw lastError ?? new Error('Could not open microphone');
}

/** Acquire mic on a user gesture and keep the stream for the wake pipeline (one getUserMedia). */
export async function acquireMicrophoneStream(): Promise<MediaStream> {
  const existing = getHeldMicrophoneStream();
  if (existing) return existing;

  const stream = await getUserMediaWithFallback();
  heldMicStream = stream;
  return stream;
}

export function isMicrophonePermissionError(err: unknown): boolean {
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    return err.name === 'NotAllowedError' || err.name === 'SecurityError';
  }
  if (typeof err === 'object' && err !== null && 'name' in err) {
    const name = String((err as { name?: string }).name);
    if (name === 'NotAllowedError' || name === 'SecurityError') return true;
  }
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('notallowederror') ||
    msg.includes('permission denied') ||
    msg.includes('missing_permission') ||
    /microphone.*(not allowed|denied|permission)/.test(msg) ||
    /(not allowed|denied|permission).*(microphone|record_audio)/.test(msg)
  );
}

export function microphoneErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return String(err);
}

export function isMicrophoneNotFoundError(err: unknown): boolean {
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    return err.name === 'NotFoundError';
  }
  if (typeof err === 'object' && err !== null && 'name' in err) {
    return String((err as { name?: string }).name) === 'NotFoundError';
  }
  return microphoneErrorMessage(err).toLowerCase().includes('not found');
}

/** User-facing copy for wake toasts (not raw DOMException text). */
export function formatMicrophoneErrorForUser(err: unknown): string {
  if (isMicrophonePermissionError(err)) {
    return 'Microphone access was denied. Allow the mic for this site in browser or app settings.';
  }
  if (isMicrophoneNotFoundError(err)) {
    return 'No microphone found. Use a real device with a mic, allow access in the browser, or disable Chrome device emulation (emulators often have no audio input).';
  }
  return microphoneErrorMessage(err);
}

/** @deprecated Prefer acquireMicrophoneStream — probe opens then closes the mic. */
export async function probeMicrophoneAccess(): Promise<MicrophoneProbeResult> {
  try {
    const stream = await acquireMicrophoneStream();
    for (const track of stream.getTracks()) {
      track.stop();
    }
    heldMicStream = null;
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: microphoneErrorMessage(err),
      permissionDenied: isMicrophonePermissionError(err),
    };
  }
}
