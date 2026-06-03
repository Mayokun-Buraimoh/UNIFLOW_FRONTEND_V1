#!/usr/bin/env node
/**
 * Stage openWakeWord core ONNX assets into public/models/ for the unified WebView wake pipeline.
 * Place your trained classifier at public/models/hey_ruby.onnx (or pass --classifier /path/to/file).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const destDir = path.join(root, 'public', 'models');
const srcDir = path.join(root, 'public', 'openwakeword', 'models');

const CORE_FILES = ['melspectrogram.onnx', 'embedding_model.onnx', 'silero_vad.onnx'];

function parseArgs() {
  const args = process.argv.slice(2);
  let classifierPath = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--classifier' && args[i + 1]) {
      classifierPath = args[i + 1];
      i++;
    }
  }
  return { classifierPath };
}

function main() {
  fs.mkdirSync(destDir, { recursive: true });

  for (const name of CORE_FILES) {
    const src = path.join(srcDir, name);
    const dest = path.join(destDir, name);
    if (!fs.existsSync(src)) {
      console.warn(`[setup:hey-ruby-models] missing ${src} — run npm run setup:openwakeword first`);
      continue;
    }
    fs.copyFileSync(src, dest);
    console.log(`[setup:hey-ruby-models] copied ${name}`);
  }

  const { classifierPath } = parseArgs();
  const heyRubyDest = path.join(destDir, 'hey_ruby.onnx');

  if (classifierPath) {
    if (!fs.existsSync(classifierPath)) {
      console.error(`[setup:hey-ruby-models] classifier not found: ${classifierPath}`);
      process.exit(1);
    }
    fs.copyFileSync(classifierPath, heyRubyDest);
    console.log('[setup:hey-ruby-models] installed hey_ruby.onnx');
  } else if (fs.existsSync(heyRubyDest)) {
    console.log('[setup:hey-ruby-models] hey_ruby.onnx already present');
  } else {
    console.log(
      '[setup:hey-ruby-models] hey_ruby.onnx not installed yet — copy after training:\n' +
        '  npm run setup:hey-ruby-models -- --classifier ./output/hey_ruby/hey_ruby.onnx'
    );
  }

  console.log(`[setup:hey-ruby-models] assets ready in public/models/`);
}

main();
