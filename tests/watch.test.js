import test from 'node:test';
import assert from 'node:assert/strict';

import { checkHolidays, renderReport, runChecks, TARGETS } from '../scripts/endpoint-watch.mjs';

const NOW = '2026-11-14T05:00:00Z';
const CORS = { 'access-control-allow-origin': '*' };

const RELEASE = {
  draft: false,
  assets: [{ name: 'control.txt' }, { name: 'first-test.txt' }, { name: 'ten-tests.txt' }, { name: 'letter-sent.txt' }],
};

// A stand-in for the internet. "overrides" replaces the answer for one address.
function fakeInternet(overrides = {}) {
  const calls = [];
  const fetcher = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET' });
    for (const [part, answer] of Object.entries(overrides)) {
      if (url.includes(part)) return answer();
    }
    if (url.includes('/__down')) return new Response(new Uint8Array(100000), { headers: CORS });
    if (url.includes('/__up')) return new Response('', { headers: CORS });
    if (url === TARGETS.app) return new Response('<title>Lelet</title><script src="app.js"></script>');
    if (url === TARGETS.release) return Response.json(RELEASE);
    throw new Error(`unexpected request to ${url}`);
  };
  return { fetcher, calls };
}

const run = (net) => runChecks({ fetcher: net.fetcher, now: NOW, attempts: 2, waitMs: 0 });

test('everything healthy passes, and the counter files are never downloaded', async () => {
  const net = fakeInternet();
  const results = await run(net);
  assert.deepEqual(results.map((result) => result.ok), [true, true, true, true, true]);
  assert.equal(net.calls.some((call) => call.url.includes('/releases/download/')), false);
  assert.match(renderReport(results, NOW), /All 5 checks passed/);
});

test('a test endpoint that stops allowing the Lelet page is a failure', async () => {
  const net = fakeInternet({ '/__down': () => new Response(new Uint8Array(100000)) });
  const results = await run(net);
  assert.equal(results[0].ok, false);
  assert.match(results[0].problem, /no longer allows/);
  assert.match(renderReport(results, NOW), /1 of 5 checks failed/);
});

test('a short download is a failure', async () => {
  const net = fakeInternet({ '/__down': () => new Response(new Uint8Array(10), { headers: CORS }) });
  const results = await run(net);
  assert.match(results[0].problem, /sent 10 bytes/);
});

test('an upload endpoint that answers with an error is a failure', async () => {
  const net = fakeInternet({ '/__up': () => new Response('', { status: 404, headers: CORS }) });
  const results = await run(net);
  assert.match(results[1].problem, /answered 404/);
});

test('one failed attempt followed by a good one is not a failure', async () => {
  let attempts = 0;
  const net = fakeInternet({
    'github.io/lelet/': () => {
      attempts += 1;
      if (attempts === 1) throw new Error('socket hang up');
      return new Response('<title>Lelet</title><script src="app.js"></script>');
    },
  });
  const results = await run(net);
  assert.equal(results[2].ok, true);
  assert.equal(attempts, 2);
});

test('a missing counter file is reported by name', async () => {
  const release = { draft: false, assets: [{ name: 'first-test.txt' }, { name: 'ten-tests.txt' }] };
  const net = fakeInternet({ '/releases/tags/counters': () => Response.json(release) });
  const results = await run(net);
  assert.match(results[3].problem, /letter-sent/);
});

test('the holiday list warns 60 days before it runs out', () => {
  assert.equal(checkHolidays('2027-10-01T00:00:00Z', '2027-12-31'), '');
  assert.match(checkHolidays('2027-11-15T00:00:00Z', '2027-12-31'), /ends on 2027-12-31/);
  assert.match(checkHolidays('2028-02-01T00:00:00Z', '2027-12-31'), /0 days left/);
});
