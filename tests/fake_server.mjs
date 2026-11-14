// A line with a known speed, for checking the meter.
//
// Serves the app's static files and Cloudflare-style endpoints:
//   GET  /__down?bytes=N   N bytes, at DOWN Mbps shared across all connections
//   POST /__up             body accepted, reply held until a line of UP Mbps would have delivered it
//   GET  /count/NAME.txt   stand-in for the anonymous counter files; every hit is recorded
//   GET  /count-log        the recorded hits as JSON, { NAME: hits }
//
// Usage: node tests/fake_server.mjs [port] [down_mbps] [up_mbps] [latency_ms]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.md': 'text/markdown; charset=utf-8',
};
const TICK_MS = 4;
const CHUNK = 16 * 1024;

export function createLine({ down = 8, up = 2, latency = 20 } = {}) {
  const downBytesPerMs = (down * 1e6) / 8 / 1000;
  const upBytesPerMs = (up * 1e6) / 8 / 1000;
  const active = new Set(); // downloads in flight: { res, left }
  let budget = 0;
  let lastTick = performance.now();
  let upFreeAt = 0;
  const block = Buffer.alloc(CHUNK, 48);
  const countHits = {};

  // One clock for every download: bytes are released by elapsed time, so timer jitter cannot change the rate.
  const timer = setInterval(() => {
    const now = performance.now();
    budget += (now - lastTick) * downBytesPerMs;
    lastTick = now;
    if (!active.size) {
      budget = 0;
      return;
    }
    let progressed = true;
    while (budget >= 1 && active.size && progressed) {
      progressed = false;
      const share = Math.max(1, Math.floor(budget / active.size));
      for (const job of [...active]) {
        const size = Math.min(share, job.left, CHUNK, Math.floor(budget));
        if (size <= 0) continue;
        job.res.write(size === CHUNK ? block : block.subarray(0, size));
        job.left -= size;
        budget -= size;
        progressed = true;
        if (job.left <= 0) {
          active.delete(job);
          job.res.end();
        }
      }
    }
  }, TICK_MS);

  const cors = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { ...cors, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' });
      res.end();
      return;
    }
    if (url.pathname === '/count-log') {
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(countHits));
      return;
    }
    const counted = /^\/count\/([a-z-]+)\.txt$/.exec(url.pathname);
    if (counted) {
      countHits[counted[1]] = (countHits[counted[1]] || 0) + 1;
      res.writeHead(200, { ...cors, 'Content-Type': 'text/plain' });
      res.end('');
      return;
    }
    if (url.pathname === '/__down') {
      const bytes = Math.max(0, Number(url.searchParams.get('bytes')) || 0);
      setTimeout(() => {
        res.writeHead(200, { ...cors, 'Content-Type': 'application/octet-stream', 'Content-Length': bytes, 'cf-meta-colo': 'TST' });
        if (!bytes) {
          res.end();
          return;
        }
        const job = { res, left: bytes };
        active.add(job);
        res.on('close', () => active.delete(job));
      }, latency);
      return;
    }
    if (url.pathname === '/__up' && req.method === 'POST') {
      const startedAt = performance.now();
      let received = 0;
      req.on('data', (chunk) => {
        received += chunk.length;
      });
      req.on('end', () => {
        const begin = Math.max(startedAt, upFreeAt);
        upFreeAt = begin + received / upBytesPerMs;
        const wait = Math.max(0, upFreeAt + latency - performance.now());
        setTimeout(() => {
          res.writeHead(200, { ...cors, 'Content-Type': 'text/plain' });
          res.end('ok');
        }, wait);
      });
      return;
    }
    // static files
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.join(ROOT, relative);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, cors);
      res.end('not found');
      return;
    }
    res.writeHead(200, { ...cors, 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.on('close', () => clearInterval(timer));
  return server;
}

export function listen(options) {
  const server = createLine(options);
  return new Promise((resolve) => server.listen(options.port || 0, '127.0.0.1', () => resolve(server)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [port = 8765, down = 8, up = 2, latency = 20] = process.argv.slice(2).map(Number);
  await listen({ port, down, up, latency });
  console.log(`line: ${down} Mbps down / ${up} Mbps up / ${latency} ms on http://127.0.0.1:${port}`);
}
