// Logic tests. Run with: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';

import * as core from '../core.js';
import { steadyMbps, MODES } from '../engine.js';
import { STRINGS, makeT } from '../i18n.js';

const at = (day, hour, minute = 0) => new Date(2026, 10, day, hour, minute).getTime(); // local time, November 2026
const reading = (ts, down, extra = {}) => ({ ts, down, up: 5, ping: 20, jitter: 2, bytes: 1e7, mode: 'hemat', via: 'wifi', conf: 'ok', ...extra });

test('median handles odd, even, empty and non-numbers', () => {
  assert.equal(core.median([3, 1, 2]), 2);
  assert.equal(core.median([1, 2, 3, 4]), 2.5);
  assert.equal(core.median([]), null);
  assert.equal(core.median([5, NaN, 7]), 6);
});

test('verdict thresholds sit at 80% and 50%', () => {
  assert.equal(core.verdictOf(80), 'ok');
  assert.equal(core.verdictOf(79.9), 'below');
  assert.equal(core.verdictOf(50), 'below');
  assert.equal(core.verdictOf(49.9), 'far');
  assert.equal(core.verdictOf(NaN), null);
});

test('time bands and peak hours use local time', () => {
  assert.equal(core.bandOf(at(2, 8)), 'pagi');
  assert.equal(core.bandOf(at(2, 13)), 'siang');
  assert.equal(core.bandOf(at(2, 19)), 'malam');
  assert.equal(core.bandOf(at(2, 23)), 'larut');
  assert.equal(core.bandOf(at(2, 3)), 'larut');
  assert.equal(core.isPeak(at(2, 18)), true);
  assert.equal(core.isPeak(at(2, 22, 59)), true);
  assert.equal(core.isPeak(at(2, 23)), false);
  assert.equal(core.isPeak(at(2, 17, 59)), false);
});

test('evidence strength: weak, fair, strong', () => {
  assert.equal(core.strengthOf([reading(at(2, 8), 10)]).level, 'lemah');

  const five = [at(2, 8), at(2, 9), at(2, 10), at(3, 8), at(3, 9)].map((ts) => reading(ts, 10));
  const fair = core.strengthOf(five);
  assert.equal(fair.level, 'cukup');
  assert.equal(fair.days, 2);
  assert.equal(fair.peak, 0);
  assert.deepEqual(
    fair.checklist.map((item) => [item.key, item.have, item.need, item.done]),
    [
      ['tests', 5, 10, false],
      ['days', 2, 3, false],
      ['peak', 0, 3, false],
      ['offPeak', 5, 3, true],
    ],
  );

  // ten tests on three days are still not "strong" without peak-hour tests
  const noPeak = [];
  for (let day = 2; day <= 4; day += 1) for (let hour = 8; hour <= 11; hour += 1) noPeak.push(reading(at(day, hour), 10));
  assert.equal(core.strengthOf(noPeak).level, 'cukup');

  assert.equal(core.strengthOf(core.sampleData(at(10, 12)).tests).level, 'kuat');
});

test('rupiah estimate = price x share of speed not delivered', () => {
  assert.equal(core.estimateRp(300000, 8, 20), 180000);
  assert.equal(core.estimateRp(300000, 25, 20), 0);
  assert.equal(core.estimateRp(0, 8, 20), null);
  assert.equal(core.estimateRp(300000, 8, 0), null);
});

test('summary of the sample data', () => {
  const { plan, tests } = core.sampleData(at(10, 12));
  const s = core.summarize(tests, plan);
  assert.equal(s.n, 12);
  assert.equal(s.days, 3);
  assert.equal(s.promised, 50);
  assert.ok(Math.abs(s.down - 20.35) < 1e-9);
  assert.ok(Math.abs(s.pct - 40.7) < 1e-9);
  assert.equal(s.verdict, 'far');
  assert.equal(s.below50, 6);
  assert.equal(s.below80, 12);
  assert.equal(s.worstBand.id, 'malam');
  assert.ok(Math.abs(s.worstBand.down - 12.8) < 1e-9);
  assert.equal(s.wired, 4);
  assert.equal(s.rpLost, 207550);
  assert.equal(s.strength.level, 'kuat');
  assert.ok(tests.every((item) => item.sample === true));
});

test('summary without a plan has no verdict and no money figure', () => {
  const s = core.summarize([reading(at(2, 8), 10)], {});
  assert.equal(s.verdict, null);
  assert.equal(s.pct, null);
  assert.equal(s.rpLost, null);
  assert.equal(s.below50, null);
  assert.equal(s.worstBand, null);
});

test('formal letter carries the law, the plan and the numbers', () => {
  const { plan, tests } = core.sampleData(at(10, 12));
  const filled = { ...plan, person: 'Budi Santoso', custId: 'A-123', city: 'Batam' };
  const id = core.buildLetter({ plan: filled, tests, lang: 'id', kind: 'formal', today: at(10, 12) });
  for (const part of ['Pasal 19', 'Contoh Net', '50 Mbps', '41%', 'Rp 207.550', 'Budi Santoso', 'A-123', 'Batam, 10 November 2026', 'Lampiran']) {
    assert.ok(id.includes(part), `Indonesian letter should contain "${part}"`);
  }
  assert.equal(id.split('\n').filter((row) => /^\d\d\. /.test(row)).length, 12, 'one attachment row per test');

  const en = core.buildLetter({ plan: filled, tests, lang: 'en', kind: 'formal', today: at(10, 12) });
  for (const part of ['Article 19', 'Contoh Net', '50 Mbps', '41%', 'Rp 207,550', 'Budi Santoso']) {
    assert.ok(en.includes(part), `English letter should contain "${part}"`);
  }
});

test('letter leaves out the money line when the price is unknown, and uses placeholders for missing names', () => {
  const tests = [reading(at(2, 8), 8), reading(at(2, 20), 6)];
  const text = core.buildLetter({ plan: { mbps: '20' }, tests, lang: 'id' });
  assert.ok(text.includes('[nama provider]'));
  assert.ok(text.includes('[nama Anda]'));
  assert.ok(!text.includes('perkiraan saya sendiri'));
});

test('WhatsApp letter is short and still names the law', () => {
  const { plan, tests } = core.sampleData(at(10, 12));
  const wa = core.buildLetter({ plan, tests, lang: 'id', kind: 'wa' });
  assert.ok(wa.length < 700, `too long for a chat message: ${wa.length}`);
  assert.ok(wa.includes('Pasal 4 dan 19'));
  assert.ok(wa.includes('12 tes'));
});

test('no letter without tests or without a plan speed', () => {
  const { plan, tests } = core.sampleData(at(10, 12));
  assert.equal(core.buildLetter({ plan, tests: [] }), '');
  assert.equal(core.buildLetter({ plan: { ...plan, mbps: '' }, tests }), '');
});

test('imported tests are cleaned, de-duplicated and sorted', () => {
  assert.equal(core.sanitizeTest(null), null);
  assert.equal(core.sanitizeTest({ ts: 'x', down: 1, up: 1, ping: 1 }), null);
  assert.equal(core.sanitizeTest({ ts: 5, down: -1, up: 1, ping: 1 }), null);
  const clean = core.sanitizeTest({ ts: 5, down: '9.5', up: 1, ping: 20, mode: 'turbo', via: 'satellite', colo: 'ABCDEFGHIJKL', extra: '<b>' });
  assert.deepEqual(clean, { ts: 5, down: 9.5, up: 1, ping: 20, jitter: 0, bytes: 0, mode: 'hemat', via: 'wifi', conf: 'ok', colo: 'ABCDEFGH', sample: false });

  const merged = core.mergeTests([reading(300, 3), reading(100, 1)], [reading(200, 2), reading(100, 9), { junk: true }]);
  assert.deepEqual(
    merged.map((item) => [item.ts, item.down]),
    [
      [100, 9],
      [200, 2],
      [300, 3],
    ],
  );
});

test('CSV has a header and one row per test', () => {
  const csv = core.toCSV([reading(at(2, 8, 5), 8.123, { via: 'lan', colo: 'CGK' }), reading(at(2, 20), 6)]);
  const rows = csv.trim().split('\n');
  assert.equal(rows.length, 3);
  assert.equal(rows[0].split(',').length, 10);
  assert.equal(rows[1], '2026-11-02 08:05,8.12,5.00,20,2.0,10.0,hemat,lan,ok,CGK');
});

test('Indonesian and English texts have the same keys and placeholders', () => {
  const idKeys = Object.keys(STRINGS.id).sort();
  const enKeys = Object.keys(STRINGS.en).sort();
  assert.deepEqual(enKeys, idKeys);
  const holes = (text) => (text.match(/\{\w+\}/g) || []).sort();
  for (const key of idKeys) {
    assert.deepEqual(holes(STRINGS.en[key]), holes(STRINGS.id[key]), `placeholders differ in "${key}"`);
    assert.ok(STRINGS.id[key].trim() && STRINGS.en[key].trim(), `empty text in "${key}"`);
  }
  assert.equal(makeT('en')('tes.auto.min', { n: 15 }), '15 min');
  assert.equal(makeT('xx')('nav.tes'), 'Tes');
  assert.equal(makeT('en')('bukti.r.testsval', { n: 1, d: 1 }), '1 test, 1 day');
  assert.equal(makeT('en')('bukti.r.testsval', { n: 4, d: 2 }), '4 tests, 2 days');
  assert.equal(makeT('id')('bukti.r.testsval', { n: 1, d: 1 }), STRINGS.id['bukti.r.testsval'].replace('{n}', '1').replace('{d}', '1'));
});

test('steady-state speed: constant line is read correctly, a stall is flagged', () => {
  // 1 MB every 100 ms = 80 Mbps
  const steady = [];
  for (let i = 0; i <= 50; i += 1) steady.push([i * 100, i * 1e6]);
  const result = steadyMbps(steady);
  assert.ok(Math.abs(result.mbps - 80) < 0.5, `read ${result.mbps}`);
  assert.equal(result.stalled, false);

  const stalled = steady.map(([time, total]) => (time > 2500 ? [time + 3000, total] : [time, total]));
  assert.equal(steadyMbps(stalled).stalled, true);
  assert.deepEqual(steadyMbps([[0, 0]]), { mbps: 0, steadyMs: 0, stalled: false });
});

test('Saver mode stays under 15 MB per test', () => {
  assert.ok((MODES.hemat.downBytes + MODES.hemat.upBytes) / 1e6 <= 15);
  assert.ok(MODES.hemat.downMs + MODES.hemat.upMs <= 12000);
});
