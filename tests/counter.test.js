// Rules for the anonymous launch counters. Run with: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';

import { COUNTER_BASE, EVENTS, dueEvents, countingAllowed, counterUrl } from '../counter.js';

test('a device owes each signal once, in step with what it has done', () => {
  assert.deepEqual(dueEvents({ tests: 0, sent: false, done: [] }), []);
  assert.deepEqual(dueEvents({ tests: 1, sent: false, done: [] }), ['first-test']);
  assert.deepEqual(dueEvents({ tests: 9, sent: false, done: ['first-test'] }), []);
  assert.deepEqual(dueEvents({ tests: 10, sent: false, done: ['first-test'] }), ['ten-tests']);
  assert.deepEqual(dueEvents({ tests: 12, sent: true, done: [] }), ['first-test', 'ten-tests', 'letter-sent']);
  assert.deepEqual(dueEvents({ tests: 12, sent: true, done: [...EVENTS] }), []);
  assert.deepEqual(dueEvents(), []);
});

test('nothing is counted without a counter address, after opt-out, or when the browser says no', () => {
  assert.equal(countingAllowed({ base: COUNTER_BASE }), true);
  assert.equal(countingAllowed({ base: '' }), false);
  assert.equal(countingAllowed({ base: COUNTER_BASE, optOut: true }), false);
  assert.equal(countingAllowed({ base: COUNTER_BASE, dnt: true }), false);
  assert.equal(countingAllowed({ base: COUNTER_BASE, gpc: true }), false);
  assert.equal(countingAllowed(), false);
});

test('a counter address carries the event name and nothing about the visitor', () => {
  assert.equal(counterUrl(COUNTER_BASE, 'first-test'), 'https://github.com/juw12/lelet/releases/download/counters/first-test.txt');
  assert.equal(counterUrl(COUNTER_BASE, 'something-else'), '');
  assert.equal(counterUrl('', 'first-test'), '');
  for (const name of EVENTS) assert.ok(!counterUrl(COUNTER_BASE, name).includes('?'));
});
