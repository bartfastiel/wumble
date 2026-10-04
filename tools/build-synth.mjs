#!/usr/bin/env node
// Builds the Rust synth (synth/) to WebAssembly and puts it where the app imports it: synth/pkg/synth.wasm.
// Needs the Rust toolchain with the WebAssembly target: rustup target add wasm32-unknown-unknown
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';

const target = 'wasm32-unknown-unknown';
// eslint-disable-next-line sonarjs/no-os-command-from-path -- cargo is the developer's own toolchain, found on PATH
const result = spawnSync('cargo', ['build', '--release', '--target', target, '--manifest-path', 'synth/Cargo.toml'], {
  stdio: 'inherit',
});
if (result.error) {
  console.error(`cargo not found – install Rust (https://rustup.rs) and run: rustup target add ${target}`);
  process.exit(2);
}
if (result.status !== 0) process.exit(result.status ?? 1);
mkdirSync('synth/pkg', { recursive: true });
copyFileSync(`synth/target/${target}/release/wumble_synth.wasm`, 'synth/pkg/synth.wasm');
console.log('synth/pkg/synth.wasm');
