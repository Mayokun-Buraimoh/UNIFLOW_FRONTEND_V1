/**
 * Siri-style two-tone "I'm listening" acknowledgement (Web Audio).
 *
 * Plays two soft sine pops in quick succession — a higher note followed by
 * a lower one — to give a recognisable "tink-tink" / "hmm" cue that the
 * assistant is ready, without saying anything. Matches how iOS Siri / Google
 * Assistant briefly chime on return visits instead of re-introducing.
 *
 * Safe no-op when Web Audio is unavailable (older browsers, locked autoplay
 * contexts pre user-gesture, etc.).
 */
export function playListeningCue(): void {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const master = ctx.createGain();
    // Master gain ducks the whole cue so it never feels jarring even on max OS volume.
    master.gain.value = 0.85;
    master.connect(ctx.destination);

    const playTone = (freq: number, startOffset: number, durationSec: number, peakGain: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const t0 = ctx.currentTime + startOffset;
      const tPeak = t0 + 0.018;
      const tEnd = t0 + durationSec;

      // Quick fade-in → exponential decay. Using a tiny non-zero floor
      // because exponentialRampToValueAtTime requires positive values.
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peakGain, tPeak);
      gain.gain.exponentialRampToValueAtTime(0.0001, tEnd);

      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(tEnd + 0.02);
    };

    // First note: bright, short — the "tink".
    playTone(880, 0.0, 0.22, 0.07);
    // Second note: a fifth lower, slightly louder and overlapping the tail
    // of the first — the descending half of the "two-note chime".
    playTone(587.33, 0.09, 0.28, 0.08);

    ctx.resume().catch(() => {});
  } catch {
    /* noop */
  }
}

export async function triggerActivationHaptic(): Promise<void> {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    /* web / unavailable */
  }
}
