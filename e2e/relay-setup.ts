// The audience tests need a relay: the built one (dist/relay/relay.mjs, `npm run build:relay`) starts on a free
// port before the tests and stops after them (relay-teardown.ts); the tests reach it through
// process.env.KF_RELAY_PORT.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const RELAY = 'dist/relay/relay.mjs';
const START_TIMEOUT_MS = 15_000;

// "Wumble relay on port 51234" – the port the relay chose
const portFromLog = (line: string): number | null => {
  const match = /relay on port (\d+)/.exec(line);
  return match === null ? null : Number(match[1]);
};

const startRelay = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [RELAY], {
      env: { ...process.env, PORT: '0' },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    process.env.KF_RELAY_PID = String(child.pid ?? '');
    const timer = setTimeout(() => {
      reject(new Error('the relay did not report its port'));
    }, START_TIMEOUT_MS);
    child.stdout.on('data', (chunk: Buffer) => {
      const port = portFromLog(chunk.toString());
      if (port === null) return;
      clearTimeout(timer);
      resolve(port);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`the relay exited with ${String(code)}`));
    });
  });

export default async function globalSetup(): Promise<void> {
  if (!existsSync(RELAY)) throw new Error(`${RELAY} missing – npm run build:relay (npm run e2e does it)`);
  const port = await startRelay();
  process.env.KF_RELAY_PORT = String(port);
}
