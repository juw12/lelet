import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import * as core from '../core.js';
import { buildReviewPack, CITED_ARTICLES, LAW_SOURCES, PACK_PATH, sampleCase } from '../scripts/review-pack.mjs';

test('the review page on disk is exactly what the app builds today', async () => {
  const onDisk = await readFile(PACK_PATH, 'utf8');
  assert.equal(onDisk, buildReviewPack(), 'run: node scripts/review-pack.mjs');
});

test('the review page carries all three letters, whole', () => {
  const pack = buildReviewPack();
  const sample = sampleCase();
  for (const letter of [sample.first, sample.short, sample.second]) {
    assert.ok(letter.length > 100);
    assert.ok(pack.includes(letter));
    assert.doesNotMatch(letter, /undefined|NaN|null/);
  }
});

test('every article the formal letter cites is quoted on the review page', () => {
  const { first } = sampleCase();
  const pack = buildReviewPack();
  assert.match(first, /Pasal 4 huruf c, d, dan h, Pasal 7 huruf g, serta Pasal 19 ayat \(1\)/);
  assert.equal(CITED_ARTICLES.length, 5);
  for (const [article, text] of CITED_ARTICLES) {
    assert.ok(pack.includes(`| ${article} | "${text}" |`), article);
  }
});

test('the sample case is consistent: tests, then the first letter, then the deadline, then the second letter', () => {
  const { tests, first, second } = sampleCase();
  const firstLetterDay = new Date(2026, 10, 14, 10, 0).getTime();
  assert.ok(tests.every((entry) => entry.ts < firstLetterDay));
  assert.ok(first.startsWith('14 November 2026'));
  assert.ok(second.startsWith('26 November 2026'));
  // Sent on Saturday 14 Nov: seven working days end on Tuesday 24 Nov, before the second letter.
  assert.equal(core.fmtDate(core.followUp(firstLetterDay).dueAt, 'id'), '24 November 2026');
  assert.ok(second.includes('Pada 14 November 2026 saya mengirim keluhan tertulis'));
  assert.ok(second.includes('Batas waktu itu berakhir pada 24 November 2026'));
});

test('the law links point at UU 8/1999, not at the page that was linked by mistake', () => {
  const pack = buildReviewPack();
  assert.ok(LAW_SOURCES.status.endsWith('/Details/45288/uu-no-8-tahun-1999'));
  assert.ok(pack.includes(LAW_SOURCES.status));
  assert.ok(pack.includes(LAW_SOURCES.fullText));
  assert.ok(!pack.includes('Details/33784'));
});

test('the review page says plainly that no qualified person has read the letters', () => {
  const pack = buildReviewPack();
  assert.ok(pack.includes('Belum ada orang yang berwenang memberi nasihat hukum yang membaca surat-surat ini.'));
  assert.ok(pack.includes('bukan tinjauan hukum'));
});
