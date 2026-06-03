/**
 * Native wake-word backend selection.
 *
 * - sensory: Sensory TrulyNatural / TrulyHandsfree (.snsr model in app bundle)
 * - azure: Microsoft custom keyword (.table from Speech Studio)
 * - openwakeword: on-device ONNX in WebView (all platforms)
 * - auto: sensory → azure → openwakeword (native); openwakeword on web
 */
export type WakeEngine = 'sensory' | 'azure' | 'openwakeword' | 'auto';

export const SENSORY_WAKE_MODEL_BASENAME = 'hey_ruby';
export const SENSORY_WAKE_MODEL_FILE = `${SENSORY_WAKE_MODEL_BASENAME}.snsr`;

export function parseWakeEngine(): WakeEngine {
  const raw = (import.meta.env.VITE_WAKE_ENGINE as string | undefined)?.trim().toLowerCase();
  if (raw === 'sensory' || raw === 'azure' || raw === 'openwakeword' || raw === 'auto') {
    return raw;
  }
  return 'auto';
}

export function isAzureWakeConfigured(): boolean {
  const key = (import.meta.env.VITE_AZURE_SPEECH_KEY as string | undefined)?.trim();
  const region = (import.meta.env.VITE_AZURE_SPEECH_REGION as string | undefined)?.trim();
  return Boolean(key && region);
}
