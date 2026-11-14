// Anonymous launch counters.
//
// Lelet has no server, so it cannot see whether anyone uses it. To answer that one question it asks
// GitHub for an empty file at three moments: the first test on a device, the tenth test, and the
// moment a letter is marked as sent. GitHub keeps a public download count per file and nothing else
// reaches the author: no test results, no plan, no letter, no identifier.
//
// Each signal is sent at most once per device, never when the browser asks not to be tracked, and
// never after the visitor turns counting off.

export const COUNTER_BASE = 'https://github.com/juw12/lelet/releases/download/counters/';
export const EVENTS = ['first-test', 'ten-tests', 'letter-sent'];

// Which signals this device owes, given what it has done and what it has already reported.
export function dueEvents({ tests = 0, sent = false, done = [] } = {}) {
  const due = [];
  if (tests >= 1) due.push('first-test');
  if (tests >= 10) due.push('ten-tests');
  if (sent) due.push('letter-sent');
  return due.filter((name) => !done.includes(name));
}

export function countingAllowed({ base = '', optOut = false, dnt = false, gpc = false } = {}) {
  return Boolean(base) && !optOut && !dnt && !gpc;
}

export function counterUrl(base, name) {
  return base && EVENTS.includes(name) ? `${base}${name}.txt` : '';
}
