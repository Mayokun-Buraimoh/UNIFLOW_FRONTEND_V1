/**
 * Live captions for Ruby (display only). Backend still transcribes with Whisper.
 * Wake phrase listening shares the same STT coordinator to avoid native conflicts.
 */

import { Capacitor } from '@capacitor/core';

import { acquireSpeechSession, releaseSpeechSession } from './speechRecognitionCoordinator';

export async function startLiveCaptionRecognition(
  onText: (text: string) => void
): Promise<{ stop: () => void }> {
  const session = await acquireSpeechSession('caption', onText);
  return session ?? { stop: () => undefined };
}

export { releaseSpeechSession };
