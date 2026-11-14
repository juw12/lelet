// Launch test scorekeeper.
//
// The launch test asks one question: in 14 days, do enough people outside the project test their
// line, keep testing, and send the letter? This script answers it without anyone keeping a tally.
//
// Once a day it reads the public download counts of three empty files (see counter.js), saves them
// as a snapshot, and writes STATUS.md. On the first run after the test window closes it writes
// VERDICT.md and marks the result as final, so later traffic cannot change it.
//
// Each run also writes summary.json: the same result as plain data, plus the list of things that
// still need Juwen (docs/needs-me.json), so a dashboard can show both without parsing STATUS.md.
//
// The pass and stop numbers below were written down before launch. Do not change them afterwards.

import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const CONFIG = {
  repo: 'juw12/lelet',
  tag: 'counters',
  // Saturday 28 Nov 2026 to Saturday 12 Dec 2026, Jakarta time (WIB, UTC+7).
  start: '2026-11-28T00:00:00+07:00',
  // The invitations go out at 10:00. The last count taken up to 09:00 is the zero point.
  baselineUntil: '2026-11-28T09:00:00+07:00',
  end: '2026-12-13T00:00:00+07:00',
  decisionDay: 'Mon 14 Dec 2026',
  // Week 1 target from the launch plan. Shown on the status page, not part of the verdict.
  checkpoint: { at: '2026-12-05T23:59:00+07:00', testers: 20, regulars: 3 },
  assets: {
    'first-test.txt': 'testers',
    'ten-tests.txt': 'regulars',
    'letter-sent.txt': 'letters',
  },
  need: { testers: 30, regulars: 10, letters: 5 },
  // Stop when fewer than 10 devices test at all, or when no letter is sent.
  stop: { testers: 10, letters: 1 },
};

const KEYS = ['testers', 'regulars', 'letters'];

const LABELS = {
  testers: 'Devices that ran a first test',
  regulars: 'Devices that reached 10 tests',
  letters: 'Devices that marked a letter as sent',
};

// Turn the release asset list from the GitHub API into { testers, regulars, letters }.
export function countsFromAssets(assets, config = CONFIG) {
  const counts = { testers: 0, regulars: 0, letters: 0 };
  const seen = new Set();
  for (const asset of assets || []) {
    const key = config.assets[asset.name];
    if (!key) continue;
    counts[key] = Number(asset.download_count) || 0;
    seen.add(key);
  }
  const missing = KEYS.filter((key) => !seen.has(key));
  if (missing.length) {
    throw new Error(`Counter files missing from the release: ${missing.join(', ')}`);
  }
  return counts;
}

function difference(later, earlier) {
  const result = {};
  for (const key of KEYS) {
    result[key] = Math.max(0, (later[key] || 0) - (earlier[key] || 0));
  }
  return result;
}

function judge(totals, config) {
  const met = KEYS.every((key) => totals[key] >= config.need[key]);
  if (met) return 'met';
  if (totals.testers < config.stop.testers || totals.letters < config.stop.letters) return 'stop';
  return 'short';
}

// Pure scoring. snapshots: [{ at: ISO string, counts: { testers, regulars, letters } }].
export function evaluate(snapshots, config = CONFIG, now = new Date()) {
  const sorted = [...snapshots].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const startMs = Date.parse(config.start);
  const baselineMs = Date.parse(config.baselineUntil);
  const endMs = Date.parse(config.end);
  const nowMs = new Date(now).getTime();

  const before = sorted.filter((snap) => Date.parse(snap.at) <= baselineMs);
  const after = sorted.filter((snap) => Date.parse(snap.at) > baselineMs);
  const baseline = before.length ? before[before.length - 1] : after[0] || null;
  const lateBaseline = !before.length && Boolean(baseline);

  const final = sorted.find((snap) => Date.parse(snap.at) >= endMs) || null;
  const latest = final || sorted[sorted.length - 1] || null;

  let phase = 'running';
  if (final) phase = 'final';
  else if (nowMs < startMs) phase = 'before';

  const zero = { testers: 0, regulars: 0, letters: 0 };
  const counted = phase !== 'before' && baseline && latest;
  const totals = counted ? difference(latest.counts, baseline.counts) : zero;
  const verdict = judge(totals, config);

  return {
    phase,
    // "outcome" is only a decision once the phase is final. Before that it is where things stand.
    outcome: phase === 'before' ? 'waiting' : verdict,
    totals,
    baseline,
    latest,
    final,
    lateBaseline,
    daysLeft: Math.max(0, Math.ceil((endMs - nowMs) / 86400000)),
  };
}

// 2026-11-28T03:00:00Z -> "Sat 28 Nov 2026, 10:00 WIB"
export function formatWib(value) {
  const shifted = new Date(new Date(value).getTime() + 7 * 3600000);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const two = (number) => String(number).padStart(2, '0');
  const day = days[shifted.getUTCDay()];
  const month = months[shifted.getUTCMonth()];
  const clock = `${two(shifted.getUTCHours())}:${two(shifted.getUTCMinutes())}`;
  return `${day} ${shifted.getUTCDate()} ${month} ${shifted.getUTCFullYear()}, ${clock} WIB`;
}

const HEADLINES = {
  before: 'The launch test has not started yet.',
  running: 'The launch test is running.',
  final: 'The launch test is over.',
};

const OUTCOME_TEXT = {
  met: {
    title: 'Launch test verdict: go on',
    line: 'All three targets were met.',
    next: 'Next step agreed before launch: add the outcome counter, then test the Rp 15,000 ask. (Reminders, the other half of that step, are already in the app.)',
  },
  short: {
    title: 'Launch test verdict: targets missed',
    line: 'People did test and at least one letter was sent, but not all three targets were met.',
    next: 'Next step agreed before launch: write down why people stopped, and stop or change the idea.',
  },
  stop: {
    title: 'Launch test verdict: stop',
    line: 'The stop line was crossed: fewer than 10 devices tested, or no letter was sent.',
    next: 'Next step agreed before launch: write down why people stopped, and stop or change the idea.',
  },
};

const RUNNING_STATE = {
  met: 'All three targets are met so far.',
  short: 'Past the stop line, targets not met yet.',
  stop: 'Still below the stop line.',
};

function scoreTable(result, config) {
  const rows = [
    '| What is counted | Counted | Needed | Stop line |',
    '| --- | ---: | ---: | --- |',
  ];
  for (const key of KEYS) {
    const stop = config.stop[key] ? `fewer than ${config.stop[key]}` : 'none';
    rows.push(`| ${LABELS[key]} | ${result.totals[key]} | ${config.need[key]} | ${stop} |`);
  }
  return rows.join('\n');
}

function limits(result) {
  const lines = [
    '- A count is a device, not a person. One person with a phone and a laptop counts twice.',
    '- Each device sends each signal once. Clearing browser data lets it send again.',
    '- Browsers that ask not to be tracked, and visitors who turn counting off, are not counted. The real numbers can be higher, not lower.',
    '- GitHub updates its counts with a delay of about 15 minutes.',
    "- Juwen's own devices count too, unless he opens the app once with `?count=off`.",
    '- Bots that follow links can add a count. A sudden jump with no letters is a warning sign.',
  ];
  if (result.lateBaseline) {
    lines.push('- The first count was taken after the invitations went out, so early visitors may be missing.');
  }
  return lines.join('\n');
}

function rawCounts(result) {
  if (!result.latest) return 'No counts read yet.';
  const lines = [];
  if (result.baseline) {
    const base = result.baseline;
    lines.push(
      `- Zero point (${formatWib(base.at)}): ${base.counts.testers} / ${base.counts.regulars} / ${base.counts.letters}`,
    );
  }
  const last = result.latest;
  lines.push(
    `- Latest (${formatWib(last.at)}): ${last.counts.testers} / ${last.counts.regulars} / ${last.counts.letters}`,
  );
  lines.push('', 'Order: first test / ten tests / letter sent. Counted = latest minus zero point.');
  return lines.join('\n');
}

export function renderStatus(result, config = CONFIG, now = new Date()) {
  const parts = ['# Lelet launch test', '', `Updated ${formatWib(now)}. Written by a script, not by hand.`, ''];
  parts.push(`**${HEADLINES[result.phase]}**`, '');

  if (result.phase === 'before') {
    parts.push(
      `It starts on ${formatWib(config.start)} and counts until ${formatWib(config.end)}.`,
      'Counts read before the start are test traffic and are subtracted.',
      '',
    );
  } else if (result.phase === 'running') {
    const state = RUNNING_STATE[result.outcome];
    parts.push(`${state} ${result.daysLeft} day(s) left; counting ends ${formatWib(config.end)}.`, '');
  } else {
    parts.push(`${OUTCOME_TEXT[result.outcome].line} See VERDICT.md.`, '');
  }

  parts.push(scoreTable(result, config), '');
  parts.push('## Raw counts', '', rawCounts(result), '');
  parts.push('## What these numbers can and cannot tell', '', limits(result), '');
  parts.push(
    '## The rule, written before launch',
    '',
    `Go on if, in 14 days, ${config.need.testers} people outside the project each run at least one test, at least ${config.need.regulars} of them complete 10 or more tests, and at least ${config.need.letters} send the letter.`,
    `Stop if fewer than ${config.stop.testers} people test at all, or nobody sends a letter.`,
    `Half-way mark (${formatWib(config.checkpoint.at)}): ${config.checkpoint.testers} devices tested, ${config.checkpoint.regulars} reached 10 tests.`,
    `Decision day: ${config.decisionDay}.`,
    '',
  );
  return parts.join('\n');
}

export function renderVerdict(result, config = CONFIG) {
  const text = OUTCOME_TEXT[result.outcome];
  return [
    `# ${text.title}`,
    '',
    `Counted from ${formatWib(result.baseline.at)} to ${formatWib(result.final.at)}.`,
    '',
    text.line,
    '',
    scoreTable(result, config),
    '',
    text.next,
    '',
    '## Before acting on this',
    '',
    limits(result),
    '',
    'The counts say how many devices did something. They do not say why people stopped. Ask three of the people who were invited before deciding.',
    '',
  ].join('\n');
}

export function verdictTitle(result) {
  return OUTCOME_TEXT[result.outcome]?.title || '';
}

// The same result as plain data, for dashboards. needsMe is the "items" list of docs/needs-me.json.
export function buildSummary(result, status = {}, needsMe = [], config = CONFIG, now = new Date()) {
  const nowMs = new Date(now).getTime();
  const repoUrl = `https://github.com/${config.repo}`;
  const issueUrl = (number) => (number ? `${repoUrl}/issues/${number}` : null);
  const counts = (snapshot) => (snapshot ? { at: snapshot.at, ...snapshot.counts } : null);

  let headline = HEADLINES[result.phase];
  if (result.phase === 'running') headline = `${headline} ${RUNNING_STATE[result.outcome]}`;
  if (result.phase === 'final') headline = `${headline} ${OUTCOME_TEXT[result.outcome].line}`;

  return {
    schema: 1,
    name: 'Lelet',
    updated: new Date(now).toISOString(),
    updatedText: formatWib(now),
    phase: result.phase,
    outcome: result.outcome,
    headline,
    nextStep: result.phase === 'final' ? OUTCOME_TEXT[result.outcome].next : null,
    totals: result.totals,
    need: config.need,
    stop: config.stop,
    labels: LABELS,
    start: config.start,
    end: config.end,
    startText: formatWib(config.start),
    endText: formatWib(config.end),
    decisionDay: config.decisionDay,
    checkpoint: { ...config.checkpoint, atText: formatWib(config.checkpoint.at) },
    daysToStart: Math.max(0, Math.ceil((Date.parse(config.start) - nowMs) / 86400000)),
    daysLeft: result.daysLeft,
    lateBaseline: result.lateBaseline,
    raw: { baseline: counts(result.baseline), latest: counts(result.latest) },
    links: {
      app: 'https://juw12.github.io/lelet/',
      repo: repoUrl,
      status: `${repoUrl}/blob/launch-status/STATUS.md`,
      launchIssue: issueUrl(status.launchIssue),
      verdictIssue: issueUrl(status.issue),
    },
    needsMe,
  };
}

async function fetchCounts(config) {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'lelet-launch-verdict' };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const url = `https://api.github.com/repos/${config.repo}/releases/tags/${config.tag}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`GitHub API answered ${response.status} for ${url}`);
  const release = await response.json();
  return countsFromAssets(release.assets, config);
}

function parseArgs(argv) {
  const options = { dir: 'status' };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (!name.startsWith('--')) continue;
    options[name.slice(2)] = argv[index + 1];
    index += 1;
  }
  return options;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function setOutput(values) {
  if (!process.env.GITHUB_OUTPUT) return;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  await appendFile(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const now = options.now ? new Date(options.now) : new Date();
  const statusFile = path.join(options.dir, 'status.json');
  await mkdir(options.dir, { recursive: true });
  const status = await readJson(statusFile, { snapshots: [], final: null, issue: null, launchIssue: null });

  if (options.issue) status.issue = Number(options.issue);
  if (options['launch-issue']) status.launchIssue = Number(options['launch-issue']);
  const recordOnly = Boolean(options.issue || options['launch-issue']);

  // After the final count nothing is added, so the verdict cannot drift.
  if (!status.final && !recordOnly) {
    const counts = options.counts
      ? countsFromAssets(await readJson(options.counts, []), CONFIG)
      : await fetchCounts(CONFIG);
    status.snapshots.push({ at: now.toISOString(), counts });
  }

  const result = evaluate(status.snapshots, CONFIG, now);
  if (result.phase === 'final' && !status.final) {
    status.final = { at: result.final.at, outcome: result.outcome, totals: result.totals };
  }

  await writeFile(statusFile, `${JSON.stringify(status, null, 2)}\n`);
  await writeFile(path.join(options.dir, 'STATUS.md'), renderStatus(result, CONFIG, now));
  const needsMe = await readJson(new URL('../docs/needs-me.json', import.meta.url), { items: [] });
  const summary = buildSummary(result, status, needsMe.items || [], CONFIG, now);
  await writeFile(path.join(options.dir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  if (result.phase === 'final') {
    await writeFile(path.join(options.dir, 'VERDICT.md'), renderVerdict(result, CONFIG));
  }

  await setOutput({
    // True once, on the first run of launch day: time to send the invitations.
    launch_due: result.phase === 'running' && !status.launchIssue,
    final: result.phase === 'final',
    outcome: result.outcome,
    issue: status.issue || '',
    title: verdictTitle(result),
  });
  console.log(`${result.phase} ${result.outcome} ${JSON.stringify(result.totals)}`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
