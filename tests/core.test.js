// Logic tests. Run with: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';

import * as core from '../core.js';
import { steadyMbps, MODES } from '../engine.js';
import { STRINGS, makeT, LANGS, LANG_LABELS, nextLang } from '../i18n.js';

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

test('the wait after the first letter counts working days only', () => {
  // Sent Friday 6 November 2026: the 7 working days are 9-13 and 16-17 November.
  const sentAt = at(6, 9);
  const early = core.followUp(sentAt, at(10, 12));
  assert.equal(new Date(early.dueAt).getDate(), 17);
  assert.equal(early.workdaysLeft, 6);
  assert.equal(early.due, false);

  const lastDay = core.followUp(sentAt, at(17, 23));
  assert.equal(lastDay.workdaysLeft, 1);
  assert.equal(lastDay.due, false);

  const after = core.followUp(sentAt, at(18, 0, 1));
  assert.equal(after.workdaysLeft, 0);
  assert.equal(after.due, true);

  // A weekend in the middle of the wait is not counted.
  assert.equal(core.followUp(sentAt, at(14, 12)).workdaysLeft, 2);
  assert.equal(core.followUp(sentAt, at(15, 12)).workdaysLeft, 2);

  // On the day it is sent the count is the full 7, whatever the weekday.
  assert.equal(core.followUp(sentAt, at(6, 15)).workdaysLeft, 7);
  assert.equal(core.followUp(at(7, 9), at(7, 15)).workdaysLeft, 7);
  assert.equal(core.followUp(at(9, 9), at(9, 15)).workdaysLeft, 7);

  for (const bad of [null, undefined, 0, -5, 'x', NaN, Infinity]) {
    assert.equal(core.followUp(bad, at(10, 12)), null);
  }
});

test('national holidays are not counted as working days', () => {
  const day = (year, month, date, hour = 9) => new Date(year, month - 1, date, hour).getTime();

  // Sent Friday 18 December 2026. Friday 25 December is a national holiday, Thursday 24 is joint leave.
  // Counted: 21, 22, 23, 24, 28, 29, 30 December.
  const christmas = core.followUp(day(2026, 12, 18), day(2026, 12, 19));
  assert.equal(core.dayKey(christmas.dueAt), '2026-12-30');
  assert.deepEqual(christmas.holidays, ['2026-12-25']);
  assert.deepEqual(christmas.jointLeave, ['2026-12-24']);
  assert.equal(christmas.beyondData, false);
  assert.equal(christmas.workdaysLeft, 7);
  // On the holiday itself, the days left are 28, 29, 30 December.
  assert.equal(core.followUp(day(2026, 12, 18), day(2026, 12, 25)).workdaysLeft, 3);

  // Sent Friday 5 March 2027: Nyepi (8) and Idulfitri (10, 11) are skipped; 9, 12 and 15 are joint leave.
  const lebaran = core.followUp(day(2027, 3, 5), day(2027, 3, 5));
  assert.equal(core.dayKey(lebaran.dueAt), '2027-03-19'); // counted: 9, 12, 15, 16, 17, 18, 19 March
  assert.deepEqual(lebaran.holidays, ['2027-03-08', '2027-03-10', '2027-03-11']);
  assert.deepEqual(lebaran.jointLeave, ['2027-03-09', '2027-03-12', '2027-03-15']);

  // A holiday on a weekend changes nothing and is not listed.
  const weekendHoliday = core.followUp(day(2027, 12, 20), day(2027, 12, 20));
  assert.equal(core.dayKey(weekendHoliday.dueAt), '2027-12-29');
  assert.deepEqual(weekendHoliday.holidays, []);

  // Past the end of the holiday list the count still works, and says it is on its own.
  const later = core.followUp(day(2027, 12, 28), day(2027, 12, 28));
  assert.equal(core.dayKey(later.dueAt), '2028-01-06');
  assert.equal(later.beyondData, true);
});

test('holiday list is well formed and matches the decree counts', () => {
  const isDay = (key) => /^\d{4}-\d{2}-\d{2}$/.test(key) && core.dayKey(new Date(`${key}T12:00:00`).getTime()) === key;
  for (const key of [...core.HOLIDAYS, ...core.JOINT_LEAVE]) assert.ok(isDay(key), `bad day key ${key}`);
  assert.deepEqual([...core.HOLIDAYS].sort(), core.HOLIDAYS, 'holidays are in date order');
  assert.equal(new Set(core.HOLIDAYS).size, core.HOLIDAYS.length);
  const inYear = (list, year) => list.filter((key) => key.startsWith(String(year))).length;
  assert.equal(inYear(core.HOLIDAYS, 2026), 17);
  assert.equal(inYear(core.HOLIDAYS, 2027), 18);
  assert.equal(inYear(core.JOINT_LEAVE, 2026), 8);
  assert.equal(inYear(core.JOINT_LEAVE, 2027), 8);
  assert.ok(core.HOLIDAYS.every((key) => key <= core.HOLIDAYS_UNTIL));
  assert.ok(!core.HOLIDAYS.some((key) => core.JOINT_LEAVE.includes(key)), 'a day is a holiday or joint leave, not both');
});

test('calendar reminder is a valid all-day event on the day after the deadline', () => {
  const sentAt = at(6, 9); // due 17 November 2026
  const ics = core.buildICS({ sentAt, provider: 'Contoh Net; Batam, ID', lang: 'id', url: 'https://example.test/', now: at(6, 10) });
  const rows = ics.split('\r\n');
  assert.equal(rows[0], 'BEGIN:VCALENDAR');
  assert.equal(rows[rows.length - 2], 'END:VCALENDAR');
  assert.ok(ics.endsWith('\r\n'));
  assert.ok(rows.includes('DTSTART;VALUE=DATE:20261118'));
  assert.ok(rows.includes('DTEND;VALUE=DATE:20261119'));
  assert.ok(rows.includes('TRIGGER:PT9H'));
  assert.ok(rows.every((row) => row.length <= 75), 'lines are folded');
  const unfolded = ics.replace(/\r\n /g, '');
  assert.ok(unfolded.includes('SUMMARY:Lelet: cek balasan Contoh Net\\; Batam\\, ID'), 'text is escaped');
  assert.ok(unfolded.includes('17 November 2026'));
  assert.ok(unfolded.includes('https://example.test/'));
  assert.ok(/DTSTAMP:\d{8}T\d{6}Z/.test(unfolded));
  assert.ok(core.buildICS({ sentAt, lang: 'en', now: at(6, 10) }).replace(/\r\n /g, '').includes('check for a reply from the provider'));
  assert.equal(core.buildICS({ sentAt: null }), '');
});

test('second letter goes to the regulator and carries the first complaint and the numbers', () => {
  const { plan, tests } = core.sampleData(at(10, 12));
  const filled = { ...plan, person: 'Budi Santoso', custId: 'A-123', city: 'Batam' };
  const base = { plan: filled, tests, sentAt: at(6, 9), ticket: 'TKT-778' };

  const id = core.buildEscalation({ ...base, lang: 'id', today: at(18, 10) });
  const wantedId = [
    'Komdigi',
    'Tembusan: Layanan Pelanggan Contoh Net',
    'Pengaduan lanjutan',
    '6 November 2026',
    'nomor tiket TKT-778',
    'berakhir pada 17 November 2026',
    'Pasal 19',
    '50 Mbps',
    '41%',
    'Rp 207.550',
    'Budi Santoso',
    'A-123',
    'Batam, 18 November 2026',
    'bukan pengukuran resmi',
    'Lampiran',
  ];
  for (const part of wantedId) {
    assert.ok(id.includes(part), `Indonesian second letter should contain "${part}"`);
  }
  assert.ok(!id.includes('baru berakhir'), 'after the deadline the letter says the wait ended');
  assert.equal(id.split('\n').filter((row) => /^\d\d\. /.test(row)).length, 12, 'one attachment row per test');

  const idEarly = core.buildEscalation({ ...base, lang: 'id', today: at(10, 12) });
  assert.ok(idEarly.includes('baru berakhir pada 17 November 2026'), 'before the deadline the letter says so');

  const en = core.buildEscalation({ ...base, lang: 'en', today: at(18, 10) });
  for (const part of ['Komdigi', 'Follow-up complaint', 'ticket number TKT-778', 'That period ended on', 'Article 19', '50 Mbps', '41%', 'not an official measurement']) {
    assert.ok(en.includes(part), `English second letter should contain "${part}"`);
  }
  assert.ok(core.buildEscalation({ ...base, lang: 'en', today: at(10, 12) }).includes('That period ends on'));

  const noTicket = core.buildEscalation({ ...base, ticket: '', lang: 'id', today: at(18, 10) });
  assert.ok(!noTicket.includes('nomor tiket'));
});

test('no second letter without tests, a plan speed or a sent date', () => {
  const { plan, tests } = core.sampleData(at(10, 12));
  assert.equal(core.buildEscalation({ plan, tests: [], sentAt: at(6, 9) }), '');
  assert.equal(core.buildEscalation({ plan: { ...plan, mbps: '' }, tests, sentAt: at(6, 9) }), '');
  assert.equal(core.buildEscalation({ plan, tests, sentAt: null }), '');
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

test('every language has the same keys and placeholders as Indonesian', () => {
  const idKeys = Object.keys(STRINGS.id).sort();
  const holes = (text) => (text.match(/\{\w+\}/g) || []).sort();
  assert.deepEqual(Object.keys(STRINGS).sort(), [...LANGS].sort());
  for (const lang of LANGS) {
    assert.deepEqual(Object.keys(STRINGS[lang]).sort(), idKeys, `keys differ in "${lang}"`);
    assert.ok(LANG_LABELS[lang], `no button label for "${lang}"`);
    for (const key of idKeys) {
      assert.deepEqual(holes(STRINGS[lang][key]), holes(STRINGS.id[key]), `placeholders differ in "${lang}" "${key}"`);
      assert.ok(STRINGS[lang][key].trim(), `empty text in "${lang}" "${key}"`);
    }
  }
  assert.equal(makeT('en')('tes.auto.min', { n: 15 }), '15 min');
  assert.equal(makeT('xx')('nav.tes'), 'Tes');
  assert.equal(makeT('en')('bukti.r.testsval', { n: 1, d: 1 }), '1 test, 1 day');
  assert.equal(makeT('en')('bukti.r.testsval', { n: 4, d: 2 }), '4 tests, 2 days');
  assert.equal(makeT('id')('bukti.r.testsval', { n: 1, d: 1 }), STRINGS.id['bukti.r.testsval'].replace('{n}', '1').replace('{d}', '1'));
  assert.equal(makeT('zh')('bukti.r.testsval', { n: 4, d: 2 }), '4 次，2 天');
});

test('the language button walks through every language and comes back', () => {
  assert.equal(nextLang('id'), 'en');
  assert.equal(nextLang('en'), 'zh');
  assert.equal(nextLang('zh'), 'id');
  assert.equal(nextLang('xx'), 'id');
});

test('a Chinese screen still gets the Indonesian letter, reminder and second letter', () => {
  assert.equal(core.letterLang('zh'), 'id');
  assert.equal(core.letterLang('en'), 'en');
  assert.equal(core.letterLang(undefined), 'id');
  const plan = { provider: 'Contoh Net', name: 'Rumah 50', mbps: 50, price: 350000 };
  const tests = [reading(at(2, 8), 10), reading(at(3, 20), 12, { via: 'lan' })];
  const today = at(18, 10);
  for (const kind of ['formal', 'wa']) {
    assert.equal(core.buildLetter({ plan, tests, lang: 'zh', kind, today }), core.buildLetter({ plan, tests, lang: 'id', kind, today }));
  }
  assert.ok(core.buildLetter({ plan, tests, lang: 'zh', today }).includes('Dengan hormat'));
  assert.equal(
    core.buildEscalation({ plan, tests, lang: 'zh', sentAt: at(4, 9), today }),
    core.buildEscalation({ plan, tests, lang: 'id', sentAt: at(4, 9), today }),
  );
  assert.equal(
    core.buildICS({ sentAt: at(4, 9), provider: 'Contoh Net', lang: 'zh', now: today }),
    core.buildICS({ sentAt: at(4, 9), provider: 'Contoh Net', lang: 'id', now: today }),
  );
  // Numbers and dates on the screen do follow the screen language.
  assert.ok(core.fmtDate(at(2, 8), 'zh').includes('2026年11月2日'));
  assert.equal(core.fmtRp(350000, 'zh'), 'Rp 350,000');
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
