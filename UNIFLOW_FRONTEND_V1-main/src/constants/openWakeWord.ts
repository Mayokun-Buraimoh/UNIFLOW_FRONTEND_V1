/** Custom Hey Ruby classifier (livekit-wakeword / openWakeWord export). */
export const HEY_RUBY_MODELS_BASE = '/models';
export const HEY_RUBY_MODEL_FILE = 'hey_ruby.onnx';
export const HEY_RUBY_KEYWORD = 'hey_ruby';

/** Legacy bundled models (fallback until hey_ruby.onnx is trained). */
export const OPENWAKEWORD_MODELS_BASE = '/openwakeword/models';
export const OPENWAKEWORD_ORT_BASE = '/openwakeword/ort';

/** onnxruntime-web concatenates filenames onto wasmPaths — must end with `/`. */
export function normalizeOrtWasmPath(base: string): string {
  const trimmed = base.replace(/\/+$/, '');
  return `${trimmed}/`;
}

/**
 * Absolute URL for files in `public/`. Required so onnxruntime-web dynamic `import()`
 * of `.mjs` wasm loaders is not intercepted by Vite as a source module.
 */
export function resolvePublicAssetUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (typeof window === 'undefined' || !window.location?.origin) {
    return normalized;
  }
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  const prefix = base && base !== '/' ? base : '';
  return `${window.location.origin}${prefix}${normalized}`;
}

export function resolveOrtWasmBase(ortPath: string = OPENWAKEWORD_ORT_BASE): string {
  return resolvePublicAssetUrl(normalizeOrtWasmPath(ortPath));
}

export const OPENWAKEWORD_DEFAULT_KEYWORD = 'hey_jarvis';
export const OPENWAKEWORD_FALLBACK_MODEL_FILE = 'hey_jarvis_v0.1.onnx';

export const OPENWAKEWORD_DEFAULT_THRESHOLD = 0.5;
export const OPENWAKEWORD_DEFAULT_COOLDOWN_MS = 2000;

export function parseDetectionThreshold(): number {
  const raw = import.meta.env.VITE_OPENWAKEWORD_THRESHOLD;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return OPENWAKEWORD_DEFAULT_THRESHOLD;
}
