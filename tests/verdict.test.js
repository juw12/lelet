import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  buildSummary,
  CONFIG,
  countsFromAssets,
  evaluate,
  formatWib,
  main,
  renderStatus,
  renderVerdict,
} from '../scripts/launch-verdict.mjs';

const snap = (at, testers, regulars, letters) => ({ at, counts: { testers, regulars, letters } });

// 00:35 WIB on launch day, before the 10:00 invitations.
const BASELINE = '2026-11-27T17:35:00Z';
// 00:35 WIB on Sunday 13 Dec, the first run after the window closes.
const FINAL = '2026-12-12T17:35:00Z';

test('the window is 28 Nov to 12 Dec inclusive, Jakarta time', () => {
  assert.equal(formatWib(CONFIG.start), 'Sat 28 Nov 2026, 00:00 WIB');
  assert.equal(formatWib(CONFIG.baselineUntil), 'Sat 28 Nov 2026, 09:00 WIB');
  assert.equal(formatWib(CONFIG.end), 'Sun 13 Dec 2026, 00:00 WIB');
  const days = (Date.parse(CONFIG.end) - Date.parse(CONFIG.start)) / 86400000;
  assert.equal(days, 15);
});

test('counts come from the three counter files and ignore the control file', () => {
  const counts = countsFromAssets([
    { name: 'control.txt', download_count: 99 },
    { name: 'first-test.txt', download_count: 4 },
    { name: 'ten-tests.txt', download_count: 2 },
    { name: 'letter-sent.txt', download_count: 1 },
  ]);
  assert.deepEqual(counts, { testers: 4, regulars: 2, letters: 1 });
});

test('a missing counter file is an error, not a silent zero', () => {
  assert.throws(() => countsFromAssets([{ name: 'first-test.txt', download_count: 4 }]), /missing/);
});

test('before the start nothing is counted', () => {
  const result = evaluate([snap('2026-11-14T05:00:00Z', 2, 0, 0)], CONFIG, '2026-11-14T05:00:00Z');
  assert.equal(result.phase, 'before');
  assert.equal(result.outcome, 'waiting');
  assert.deepEqual(result.totals, { testers: 0, regulars: 0, letters: 0 });
});

test('while running, traffic from before launch is subtracted', () => {
  const snapshots = [snap('2026-11-20T17:35:00Z', 2, 0, 0), snap(BASELINE, 3, 1, 0), snap('2026-12-01T17:35:00Z', 15, 4, 2)];
  const result = evaluate(snapshots, CONFIG, '2026-12-01T17:35:00Z');
  assert.equal(result.phase, 'running');
  assert.equal(result.baseline.at, BASELINE);
  assert.deepEqual(result.totals, { testers: 12, regulars: 3, letters: 2 });
  assert.equal(result.outcome, 'short');
  assert.equal(result.lateBaseline, false);
});

test('all three targets met is a go', () => {
  const result = evaluate([snap(BASELINE, 3, 0, 0), snap(FINAL, 33, 10, 5)], CONFIG, FINAL);
  assert.equal(result.phase, 'final');
  assert.equal(result.outcome, 'met');
});

test('one target short of the bar is not a go', () => {
  const result = evaluate([snap(BASELINE, 0, 0, 0), snap(FINAL, 30, 9, 5)], CONFIG, FINAL);
  assert.equal(result.outcome, 'short');
});

test('fewer than 10 testers is a stop', () => {
  const result = evaluate([snap(BASELINE, 0, 0, 0), snap(FINAL, 9, 3, 2)], CONFIG, FINAL);
  assert.equal(result.outcome, 'stop');
});

test('no letter sent is a stop even with many testers', () => {
  const result = evaluate([snap(BASELINE, 0, 0, 0), snap(FINAL, 50, 20, 0)], CONFIG, FINAL);
  assert.equal(result.outcome, 'stop');
});

test('a count that goes down never becomes a negative total', () => {
  const result = evaluate([snap(BASELINE, 5, 5, 5), snap(FINAL, 3, 6, 5)], CONFIG, FINAL);
  assert.deepEqual(result.totals, { testers: 0, regulars: 1, letters: 0 });
});

test('a first count taken after the invitations is flagged', () => {
  const result = evaluate([snap('2026-11-29T17:35:00Z', 8, 0, 0), snap(FINAL, 20, 2, 1)], CONFIG, FINAL);
  assert.equal(result.lateBaseline, true);
  assert.deepEqual(result.totals, { testers: 12, regulars: 2, letters: 1 });
  assert.match(renderStatus(result, CONFIG, FINAL), /after the invitations went out/);
});

test('the verdict uses the first count after the window and ignores later ones', () => {
  const snapshots = [snap(BASELINE, 0, 0, 0), snap(FINAL, 12, 3, 1), snap('2026-12-20T17:35:00Z', 90, 40, 20)];
  const result = evaluate(snapshots, CONFIG, '2026-12-20T17:35:00Z');
  assert.equal(result.final.at, FINAL);
  assert.deepEqual(result.totals, { testers: 12, regulars: 3, letters: 1 });
  assert.equal(result.outcome, 'short');
});

test('the status and verdict pages show the numbers and the agreed next step', () => {
  const result = evaluate([snap(BASELINE, 2, 0, 0), snap(FINAL, 34, 11, 6)], CONFIG, FINAL);
  const status = renderStatus(result, CONFIG, FINAL);
  assert.match(status, /\| Devices that ran a first test \| 32 \| 30 \| fewer than 10 \|/);
  assert.match(status, /The launch test is over/);
  const verdict = renderVerdict(result, CONFIG);
  assert.match(verdict, /# Launch test verdict: go on/);
  assert.match(verdict, /Rp 15,000/);
  assert.match(verdict, /Sat 28 Nov 2026, 00:35 WIB to Sun 13 Dec 2026, 00:35 WIB/);
});

test('the command line run saves snapshots, then freezes the result once final', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'lelet-verdict-'));
  const fixture = path.join(dir, 'counts.json');
  const assets = (first, ten, letters) =>
    JSON.stringify([
      { name: 'first-test.txt', download_count: first },
      { name: 'ten-tests.txt', download_count: ten },
      { name: 'letter-sent.txt', download_count: letters },
    ]);
  const run = (now) => main(['--dir', dir, '--now', now, '--counts', fixture]);

  await writeFile(fixture, assets(2, 0, 0));
  await run(BASELINE);
  await writeFile(fixture, assets(8, 1, 0));
  await run(FINAL);
  await writeFile(fixture, assets(80, 30, 9));
  const late = await run('2026-12-13T17:35:00Z');

  assert.equal(late.outcome, 'stop');
  const status = JSON.parse(await readFile(path.join(dir, 'status.json'), 'utf8'));
  assert.equal(status.snapshots.length, 2);
  assert.deepEqual(status.final.totals, { testers: 6, regulars: 1, letters: 0 });
  assert.match(await readFile(path.join(dir, 'VERDICT.md'), 'utf8'), /# Launch test verdict: stop/);

  await main(['--dir', dir, '--now', '2026-12-13T17:40:00Z', '--issue', '7']);
  const recorded = JSON.parse(await readFile(path.join(dir, 'status.json'), 'utf8'));
  assert.equal(recorded.issue, 7);
  assert.equal(recorded.snapshots.length, 2);

  // The dashboard file is written next to it, with the frozen result and the to-do list from docs/.
  const summary = JSON.parse(await readFile(path.join(dir, 'summary.json'), 'utf8'));
  assert.equal(summary.phase, 'final');
  assert.equal(summary.outcome, 'stop');
  assert.deepEqual(summary.totals, { testers: 6, regulars: 1, letters: 0 });
  assert.equal(summary.links.verdictIssue, 'https://github.com/juw12/lelet/issues/7');
  assert.ok(summary.needsMe.some((item) => item.id === 'count-off'));
});

test('the summary before the start counts down to launch day and carries the to-do list', () => {
  const now = '2026-11-14T05:00:00Z';
  const result = evaluate([snap(now, 2, 0, 0)], CONFIG, now);
  const todo = [{ id: 'invite', title: 'Send the invitations', status: 'last-tap', due: '2026-11-28', links: [] }];
  const summary = buildSummary(result, {}, todo, CONFIG, now);
  assert.equal(summary.schema, 1);
  assert.equal(summary.phase, 'before');
  assert.equal(summary.outcome, 'waiting');
  // 14 Nov 12:00 WIB to 28 Nov 00:00 WIB is 13.5 days.
  assert.equal(summary.daysToStart, 14);
  assert.equal(summary.updatedText, 'Sat 14 Nov 2026, 12:00 WIB');
  assert.deepEqual(summary.need, { testers: 30, regulars: 10, letters: 5 });
  assert.deepEqual(summary.stop, { testers: 10, letters: 1 });
  assert.deepEqual(summary.raw.latest, { at: now, testers: 2, regulars: 0, letters: 0 });
  assert.deepEqual(summary.needsMe, todo);
  assert.equal(summary.links.launchIssue, null);
  assert.equal(summary.links.status, 'https://github.com/juw12/lelet/blob/launch-status/STATUS.md');
});

test('the summary while running says where things stand, and names the next step only at the end', () => {
  const running = evaluate([snap(BASELINE, 3, 1, 0), snap('2026-12-01T17:35:00Z', 15, 4, 2)], CONFIG, '2026-12-01T17:35:00Z');
  const midway = buildSummary(running, { launchIssue: 3 }, [], CONFIG, '2026-12-01T17:35:00Z');
  assert.equal(midway.daysToStart, 0);
  assert.equal(midway.daysLeft, 11);
  assert.deepEqual(midway.totals, { testers: 12, regulars: 3, letters: 2 });
  assert.match(midway.headline, /running\. Past the stop line/);
  assert.equal(midway.nextStep, null);
  assert.equal(midway.links.launchIssue, 'https://github.com/juw12/lelet/issues/3');

  const done = evaluate([snap(BASELINE, 3, 0, 0), snap(FINAL, 33, 10, 5)], CONFIG, FINAL);
  const closed = buildSummary(done, {}, [], CONFIG, FINAL);
  assert.equal(closed.outcome, 'met');
  assert.match(closed.headline, /over\. All three targets were met/);
  assert.match(closed.nextStep, /Rp 15,000/);
});
