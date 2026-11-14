// Watches the things Lelet depends on but does not control.
//
// Lelet has no server. It leans on Cloudflare's public speed-test endpoint, on GitHub Pages for
// the app itself and on a GitHub release for the launch counters. If one of them changes, tests
// fail on every phone and nobody tells the author. This script asks each of them a small question
// and writes down what it found. The workflow turns a failure into an issue.
//
// It runs on GitHub's servers, not in Indonesia. It can tell that an endpoint is gone or has
// changed its rules; it cannot tell that the endpoint is slow or blocked for one Indonesian provider.
//
// It never downloads the counter files, because every download would add one to the launch count.

import { appendFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { EVENTS } from '../counter.js';
import { HOLIDAYS_UNTIL } from '../core.js';

export const TARGETS = {
  origin: 'https://juw12.github.io',
  app: 'https://juw12.github.io/lelet/',
  speed: 'https://speed.cloudflare.com',
  release: 'https://api.github.com/repos/juw12/lelet/releases/tags/counters',
};

const DOWN_BYTES = 100000;
const UP_BYTES = 20000;
const HOLIDAY_WARNING_DAYS = 60;

function corsAllows(response, origin) {
  const allowed = response.headers.get('access-control-allow-origin');
  return allowed === '*' || allowed === origin;
}

async function checkDown(fetcher, targets) {
  const response = await fetcher(`${targets.speed}/__down?bytes=${DOWN_BYTES}&r=${Date.now()}`, {
    headers: { origin: targets.origin },
  });
  if (!response.ok) return `answered ${response.status}`;
  if (!corsAllows(response, targets.origin)) return 'no longer allows requests from the Lelet page';
  const body = await response.arrayBuffer();
  if (body.byteLength !== DOWN_BYTES) return `sent ${body.byteLength} bytes, expected ${DOWN_BYTES}`;
  return '';
}

async function checkUp(fetcher, targets) {
  const response = await fetcher(`${targets.speed}/__up?r=${Date.now()}`, {
    method: 'POST',
    headers: { origin: targets.origin },
    body: new Uint8Array(UP_BYTES),
  });
  if (!response.ok) return `answered ${response.status}`;
  if (!corsAllows(response, targets.origin)) return 'no longer allows requests from the Lelet page';
  await response.arrayBuffer();
  return '';
}

async function checkApp(fetcher, targets) {
  const response = await fetcher(targets.app);
  if (!response.ok) return `answered ${response.status}`;
  const page = await response.text();
  if (!page.includes('Lelet') || !page.includes('app.js')) return 'the page loads but is not the Lelet app';
  return '';
}

async function checkCounters(fetcher, targets) {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'lelet-endpoint-watch' };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetcher(targets.release, { headers });
  if (!response.ok) return `GitHub answered ${response.status} for the counters release`;
  const release = await response.json();
  if (release.draft) return 'the counters release is a draft, so its files are not public';
  const names = new Set((release.assets || []).map((asset) => asset.name));
  const missing = EVENTS.filter((event) => !names.has(`${event}.txt`));
  return missing.length ? `counter files missing: ${missing.join(', ')}` : '';
}

export function checkHolidays(now = new Date(), until = HOLIDAYS_UNTIL) {
  const daysLeft = Math.floor((Date.parse(`${until}T23:59:59+07:00`) - new Date(now).getTime()) / 86400000);
  if (daysLeft >= HOLIDAY_WARNING_DAYS) return '';
  return `the holiday list ends on ${until} (${Math.max(daysLeft, 0)} days left); add next year's decree to core.js`;
}

export const CHECKS = [
  { name: 'Download test endpoint', run: checkDown },
  { name: 'Upload test endpoint', run: checkUp },
  { name: 'Live app', run: checkApp },
  { name: 'Launch counters', run: checkCounters },
  { name: 'Holiday list', run: (fetcher, targets, now) => checkHolidays(now) },
];

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// One slow answer is not an outage: a check fails only after every attempt has failed.
export async function runChecks({ fetcher = fetch, targets = TARGETS, now = new Date(), attempts = 3, waitMs = 5000 } = {}) {
  const results = [];
  for (const check of CHECKS) {
    let problem = '';
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        problem = await check.run(fetcher, targets, now);
      } catch (error) {
        problem = `could not be reached (${error.cause?.code || error.message})`;
      }
      if (!problem) break;
      if (attempt < attempts) await pause(waitMs);
    }
    results.push({ name: check.name, ok: !problem, problem });
  }
  return results;
}

export function renderReport(results, now = new Date()) {
  const failed = results.filter((result) => !result.ok);
  const lines = [
    failed.length ? `${failed.length} of ${results.length} checks failed.` : `All ${results.length} checks passed.`,
    '',
    `Checked ${new Date(now).toISOString()} from GitHub's servers (not from Indonesia).`,
    '',
  ];
  for (const result of results) {
    lines.push(result.ok ? `- OK: ${result.name}` : `- FAILED: ${result.name}: ${result.problem}`);
  }
  if (failed.length) {
    lines.push(
      '',
      'What it means: if a test endpoint failed, speed tests fail for every visitor until engine.js is pointed at a working endpoint. If the live app failed, check GitHub Pages. If the counters failed, the launch count is not being collected.',
    );
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const now = new Date();
  const results = await runChecks({ now });
  const report = renderReport(results, now);
  const ok = results.every((result) => result.ok);
  await writeFile('watch.md', report);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `ok=${ok}\n`);
  console.log(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
