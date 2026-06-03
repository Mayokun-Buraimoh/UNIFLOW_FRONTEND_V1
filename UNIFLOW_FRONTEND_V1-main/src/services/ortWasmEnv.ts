import * as ort from 'onnxruntime-web';

import {
  OPENWAKEWORD_ORT_BASE,
  resolveOrtWasmBase,
} from '../constants/openWakeWord';

/** Threaded ORT WASM needs crossOriginIsolated; Capacitor WebView usually does not have it. */
export function configureOrtWasmEnv(ortPath: string = OPENWAKEWORD_ORT_BASE): void {
  ort.env.wasm.wasmPaths = resolveOrtWasmBase(ortPath);
  const canThread =
    typeof crossOriginIsolated !== 'undefined' &&
    crossOriginIsolated &&
    typeof SharedArrayBuffer !== 'undefined';
  ort.env.wasm.numThreads = canThread ? Math.min(navigator.hardwareConcurrency || 4, 4) : 1;
}
