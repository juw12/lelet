// Meter accuracy check: start a line with a known speed, measure it with the real engine,
// fail if the reading is more than 10 % off. Run: node tests/accuracy.mjs
//
// The line and the meter share this computer. When the computer is busy (CPU at 100 %), the line itself
// cannot keep its speed, so a case gets up to three attempts and every attempt is printed.
import { runTest } from '../engine.js';
import { listen } from './fake_server.mjs';

const TOLERANCE = 0.1;
const ATTEMPTS = 3;
const cases = [
  { down: 8, up: 2, mode: 'hemat' },
  { down: 30, up: 10, mode: 'normal' },
];

async function attempt(line) {
  const server = await listen({ port: 0, down: line.down, up: line.up, latency: 20 });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const result = await runTest({ base, mode: line.mode });
    const downError = Math.abs(result.down - line.down) / line.down;
    const upError = Math.abs(result.up - line.up) / line.up;
    const ok = downError <= TOLERANCE && upError <= TOLERANCE;
    const text =
      `read ${result.down.toFixed(2)}/${result.up.toFixed(2)} Mbps, error ${(downError * 100).toFixed(1)}%/${(upError * 100).toFixed(1)}%, ` +
      `ping ${result.ping.toFixed(0)} ms, ${(result.bytes / 1e6).toFixed(1)} MB in ${(result.ms / 1000).toFixed(1)} s, ` +
      `confidence ${result.conf}/${result.confUp}`;
    return { ok, text };
  } catch (error) {
    return { ok: false, text: `error: ${error.message}` };
  } finally {
    server.closeAllConnections();
    server.close();
  }
}

let failed = false;
for (const line of cases) {
  let passed = false;
  for (let n = 1; n <= ATTEMPTS && !passed; n += 1) {
    const { ok, text } = await attempt(line);
    passed = ok;
    console.log(`${ok ? 'PASS' : 'miss'} line ${line.down}/${line.up} Mbps (${line.mode}) attempt ${n}: ${text}`);
  }
  if (!passed) {
    failed = true;
    console.log(`FAIL line ${line.down}/${line.up} Mbps: no attempt within ${TOLERANCE * 100}%`);
  }
}
process.exit(failed ? 1 : 0);
