#!/usr/bin/env node
/**
 * Copies onnxruntime-web WASM assets into public/openwakeword/ort.
 * Includes JSEP builds required by onnxruntime-web 1.26+.
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORT_FILES = [
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'node_modules', 'onnxruntime-web', 'dist');
const destDir = join(root, 'public', 'openwakeword', 'ort');

if (!existsSync(srcDir)) {
  console.warn('[setup:openwakeword] onnxruntime-web dist not found; run npm install first.');
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });

let copied = 0;
for (const name of ORT_FILES) {
  const src = join(srcDir, name);
  if (!existsSync(src)) {
    console.warn(`[setup:openwakeword] missing ${name} in onnxruntime-web dist`);
    continue;
  }
  cpSync(src, join(destDir, name), { force: true });
  copied++;
}

console.log(`[setup:openwakeword] copied ${copied} ORT assets to public/openwakeword/ort/`);
