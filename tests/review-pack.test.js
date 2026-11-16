import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import * as core from '../core.js';
import { buildReviewPack, CITED_ARTICLES, LAW_SOURCES, lettersDrift, NOTED_ARTICLES, PACK_PATH, sampleCase } from '../scripts/review-pack.mjs';

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

test('the three letters are still the ones sent for review on 14 Nov 2026', () => {
  assert.equal(lettersDrift(), '');
});

test('a letter that drifts from the 14 Nov 2026 version is caught, and the report says where', () => {
  const sample = sampleCase();
  const drift = lettersDrift({ ...sample, short: `${sample.short}\nMohon dibalas.` });
  assert.match(drift, /changed since 14 Nov 2026/);
  assert.match(drift, /Mohon dibalas\./);
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

test('related articles the letters do not cite are quoted next to their source, and stay out of the letters', () => {
  const pack = buildReviewPack();
  const { first, short, second } = sampleCase();
  assert.equal(NOTED_ARTICLES.length, 5);
  for (const [article, text, why] of NOTED_ARTICLES) {
    assert.ok(pack.includes(`| ${article} | "${text}" | ${why} |`), article);
  }
  for (const letter of [first, short, second]) {
    assert.doesNotMatch(letter, /Pasal (23|45|52)\b/);
    assert.doesNotMatch(letter, /Pasal 19 ayat \(3\)/);
  }
});

test('the reader keeps five numbered questions, each with lettered choices, and may decline', () => {
  const pack = buildReviewPack();
  const questions = pack.split('## Lima pertanyaan')[1].split('\n## ')[0];
  const numbered = questions.split('\n').filter((line) => /^\d\. /.test(line));
  assert.deepEqual(numbered.map((line) => line[0]), ['1', '2', '3', '4', '5']);
  for (const line of questions.split('\n').filter((entry) => entry.includes('Pertanyaan:'))) {
    assert.ok(line.includes('Sekarang:'), line.slice(0, 40));
    assert.ok(line.includes('(a)') && line.includes('(b)'), line.slice(0, 40));
  }
  assert.equal(questions.split('Pertanyaan:').length - 1, 6);
  assert.ok(pack.includes('Anda tidak berkewajiban menjawab.'));
  assert.ok(pack.includes('tunjukkan lembaga yang lebih tepat'));
});

test('the review page promises nothing is published or named without written permission', () => {
  const pack = buildReviewPack();
  assert.ok(pack.includes('Jawaban lewat e-mail tidak saya publikasikan.'));
  assert.ok(pack.includes('tanpa izin tertulis'));
  assert.ok(pack.includes('satu pesan susulan saja'));
});

test('the top of the review page says who wrote it and how to answer; the usage notes come before the letters', () => {
  const pack = buildReviewPack();
  const summary = pack.split('## Ringkasan')[1].split('\n## ')[0];
  assert.ok(summary.includes('Saya bukan pengacara.'));
  assert.ok(summary.includes('https://github.com/juw12/lelet/issues'));
  assert.doesNotMatch(summary, /@/, 'no e-mail address on a public page');
  assert.ok(pack.includes('Halaman keterangan undang-undang yang sama di basis data peraturan BPK: ' + LAW_SOURCES.status));
  assert.ok(pack.includes('alamat itu tidak sampai kepada saya dan tidak saya simpan'));
  assert.ok(pack.indexOf('## Cara surat dipakai') < pack.indexOf('## Surat 1: keluhan'));
  assert.ok(pack.indexOf('## Surat 1: keluhan') < pack.indexOf('## Surat 2: pengaduan'));
});
