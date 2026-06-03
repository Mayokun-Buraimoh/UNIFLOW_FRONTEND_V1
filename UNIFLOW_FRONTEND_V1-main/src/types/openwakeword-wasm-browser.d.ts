declare module 'openwakeword-wasm-browser' {
  export const MODEL_FILE_MAP: Record<string, string>;

  export interface WakeWordDetectEvent {
    keyword: string;
    score: number;
    at: number;
  }

  export interface WakeWordEngineOptions {
    keywords?: string[];
    modelFiles?: Record<string, string>;
    baseAssetUrl?: string;
    ortWasmPath?: string;
    frameSize?: number;
    sampleRate?: number;
    vadHangoverFrames?: number;
    detectionThreshold?: number;
    cooldownMs?: number;
    executionProviders?: string[];
    embeddingWindowSize?: number;
    debug?: boolean;
  }

  export class WakeWordEngine {
    constructor(options?: WakeWordEngineOptions);
    on(event: 'ready' | 'detect' | 'speech-start' | 'speech-end' | 'error', handler: (payload?: unknown) => void): () => void;
    off(event: string, handler: (payload?: unknown) => void): void;
    load(): Promise<void>;
    start(options?: { deviceId?: string; gain?: number }): Promise<void>;
    stop(): Promise<void>;
    setGain(value: number): void;
    setActiveKeywords(keywords: string[]): void;
    runWav(buffer: ArrayBuffer): Promise<number>;
  }

  export default WakeWordEngine;
}
