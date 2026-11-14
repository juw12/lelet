// Lelet measurement engine. Works in browsers and in Node 18+ (fetch, streams, performance).
// It talks to any server that implements Cloudflare's speed test endpoints:
//   GET  {base}/__down?bytes=N   -> N bytes
//   POST {base}/__up             -> reads the body, replies with a small response
// No telemetry is sent anywhere; the only traffic is the test itself.

export const DEFAULT_BASE = 'https://speed.cloudflare.com';

export const MODES = {
  hemat: { downBytes: 10e6, upBytes: 3e6, downMs: 6000, upMs: 4000 },
  normal: { downBytes: 45e6, upBytes: 15e6, downMs: 8000, upMs: 6000 },
  penuh: { downBytes: 180e6, upBytes: 60e6, downMs: 10000, upMs: 8000 },
};

const STREAMS = 3; // parallel downloads, so one slow TCP stream does not make the line look worse than it is
const PING_COUNT = 10;
const MIN_STEADY_MS = 1500; // shorter than this and the reading is flagged "low confidence"
const MIN_UPLOAD_MS = 700;
const STALL_MS = 1000; // a silence this long inside the measured window makes the reading unreliable

const now = () => performance.now();
const nonce = () => Math.random().toString(36).slice(2);

function medianOf(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function linkSignals(outer, ms) {
  const ctl = new AbortController();
  const stop = () => ctl.abort();
  if (outer) {
    if (outer.aborted) ctl.abort();
    else outer.addEventListener('abort', stop, { once: true });
  }
  const timer = ms ? setTimeout(stop, ms) : null;
  return { signal: ctl.signal, stop, done: () => clearTimeout(timer) };
}

export async function measureLatency(base, signal) {
  const times = [];
  let meta = { colo: '', asn: '' };
  for (let i = 0; i < PING_COUNT + 1; i += 1) {
    const started = now();
    const res = await fetch(`${base}/__down?bytes=0&r=${nonce()}`, { cache: 'no-store', signal });
    const elapsed = now() - started;
    if (!res.ok) throw new Error(`http-${res.status}`);
    await res.arrayBuffer();
    if (i === 0) {
      // the first request pays for DNS + TLS, so it is not a latency sample
      meta = { colo: res.headers.get('cf-meta-colo') || '', asn: res.headers.get('cf-meta-asn') || '' };
      continue;
    }
    times.push(elapsed);
  }
  let jitter = 0;
  for (let i = 1; i < times.length; i += 1) jitter += Math.abs(times[i] - times[i - 1]);
  jitter /= Math.max(1, times.length - 1);
  return { ping: medianOf(times), jitter, ...meta };
}

// Throughput over the steady part of the transfer: the first part (TCP ramp-up) is left out.
// `stalled` is true when nothing arrived for a long stretch, so the caller can flag the reading.
export function steadyMbps(samples) {
  if (samples.length < 2) return { mbps: 0, steadyMs: 0, stalled: false };
  const firstAt = samples[0][0];
  const lastAt = samples[samples.length - 1][0];
  const startAt = firstAt + Math.min(1000, 0.3 * (lastAt - firstAt));
  let bytesBefore = samples[0][1];
  let longestGap = 0;
  let previousAt = startAt;
  for (const [at, total] of samples) {
    if (at <= startAt) {
      bytesBefore = total;
      continue;
    }
    longestGap = Math.max(longestGap, at - previousAt);
    previousAt = at;
  }
  const steadyMs = lastAt - startAt;
  const bytes = samples[samples.length - 1][1] - bytesBefore;
  if (steadyMs <= 0) return { mbps: 0, steadyMs: 0, stalled: false };
  const stalled = longestGap > Math.max(STALL_MS, 0.25 * steadyMs);
  return { mbps: (bytes * 8) / (steadyMs / 1000) / 1e6, steadyMs, stalled };
}

export async function measureDown(base, cfg, signal, onProgress) {
  const link = linkSignals(signal, cfg.downMs);
  const perStream = Math.floor(cfg.downBytes / STREAMS);
  const startedAt = now();
  const samples = [];
  let total = 0;
  let lastError = null;

  const stream = async () => {
    const res = await fetch(`${base}/__down?bytes=${perStream}&r=${nonce()}`, { cache: 'no-store', signal: link.signal });
    if (!res.ok) throw new Error(`http-${res.status}`);
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      samples.push([now() - startedAt, total]);
      if (onProgress) onProgress({ phase: 'down', mbps: steadyMbps(samples).mbps, frac: total / cfg.downBytes });
    }
  };

  const results = await Promise.allSettled(Array.from({ length: STREAMS }, stream));
  link.done();
  for (const result of results) {
    if (result.status === 'rejected' && result.reason?.name !== 'AbortError') lastError = result.reason;
  }
  if (signal?.aborted) throw new DOMException('cancelled', 'AbortError');
  if (!total) throw lastError || new Error('no-data');
  const { mbps, steadyMs, stalled } = steadyMbps(samples);
  return { down: mbps, bytes: total, conf: steadyMs >= MIN_STEADY_MS && !stalled ? 'ok' : 'low' };
}

export async function measureUp(base, cfg, ping, signal, onProgress) {
  // One request may not hang the whole phase: the budget plus a margin is the hard limit.
  const link = linkSignals(signal, cfg.upMs * 2);
  const startedAt = now();
  const done = [];
  let colo = '';
  let size = 128 * 1024;
  let used = 0;
  const filler = new Uint8Array(1024 * 1024).fill(97);

  try {
    while (used + size <= cfg.upBytes) {
      const parts = [];
      for (let left = size; left > 0; left -= filler.length) parts.push(left >= filler.length ? filler : filler.subarray(0, left));
      const sentAt = now();
      const res = await fetch(`${base}/__up?r=${nonce()}`, { method: 'POST', body: new Blob(parts), cache: 'no-store', signal: link.signal });
      if (!res.ok) throw new Error(`http-${res.status}`);
      colo = colo || res.headers.get('cf-meta-colo') || '';
      await res.arrayBuffer();
      const raw = now() - sentAt;
      const ms = Math.max(raw - Math.min(ping, raw / 2), 1); // take off the round trip that is not upload time
      const mbps = (size * 8) / (ms / 1000) / 1e6;
      used += size;
      done.push({ size, ms, mbps });
      if (onProgress) onProgress({ phase: 'up', mbps, frac: (now() - startedAt) / cfg.upMs });

      const left = cfg.upMs - (now() - startedAt);
      if (left < 600) break;
      const bytesPerMs = size / ms;
      const target = bytesPerMs * Math.min(1500, left * 0.8);
      size = Math.round(Math.min(Math.max(target, size), size * 8, 25e6));
    }
  } catch (error) {
    if (signal?.aborted) throw new DOMException('cancelled', 'AbortError');
    if (!done.length) throw error.name === 'AbortError' ? new Error('timeout') : error;
    // otherwise keep what was measured before the failure
  } finally {
    link.done();
  }

  if (!done.length) throw new Error('no-data');
  // Median of the long requests: one stalled or lucky request cannot move the result on its own.
  const long = done.filter((d) => d.ms >= MIN_UPLOAD_MS);
  const speeds = (long.length ? long : [done[done.length - 1]]).map((d) => d.mbps);
  const spread = Math.max(...speeds) / Math.max(Math.min(...speeds), 1e-9);
  return { up: medianOf(speeds), bytes: used, conf: long.length && spread <= 3 ? 'ok' : 'low', colo };
}

export async function runTest({ base = DEFAULT_BASE, mode = 'hemat', signal, onProgress } = {}) {
  const cfg = MODES[mode] || MODES.hemat;
  const startedAt = now();
  if (onProgress) onProgress({ phase: 'ping', frac: 0 });
  const latency = await measureLatency(base, signal);
  const down = await measureDown(base, cfg, signal, onProgress);
  const up = await measureUp(base, cfg, latency.ping, signal, onProgress);
  return {
    ts: Date.now(),
    down: down.down,
    up: up.up,
    ping: latency.ping,
    jitter: latency.jitter,
    bytes: down.bytes + up.bytes,
    mode,
    conf: down.conf,
    confUp: up.conf,
    // The download reply stopped naming the test server, the upload reply still does.
    colo: latency.colo || up.colo,
    asn: latency.asn,
    ms: now() - startedAt,
  };
}
