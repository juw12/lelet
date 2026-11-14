// Builds docs/permohonan-tinjauan.md: the page a lawyer or a consumer body reads before the letters
// are used widely. The letters in it come from core.js, so the page cannot drift from the app.
//   node scripts/review-pack.mjs           write the page
//   node scripts/review-pack.mjs --check   exit 1 when the page on disk is out of date
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as core from '../core.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PACK_PATH = path.join(HERE, '..', 'docs', 'permohonan-tinjauan.md');

// One fixed, made-up case so the page is the same on every run.
// The first letter is written on Saturday 14 Nov 2026 from tests on 11-13 Nov; the second letter is
// written on 26 Nov, after the 7 working days have passed without an answer.
const FIRST_LETTER_DAY = new Date(2026, 10, 14, 10, 0).getTime();
const SECOND_LETTER_DAY = new Date(2026, 10, 26, 10, 0).getTime();

export const LAW_SOURCES = {
  fullText: 'https://jdih.kemenkeu.go.id/api/download/FullText/1999/8TAHUN~1999UU.htm',
  status: 'https://peraturan.bpk.go.id/Details/45288/uu-no-8-tahun-1999',
};

// Quoted word for word from the law text at LAW_SOURCES.fullText, read on 14 Nov 2026.
export const CITED_ARTICLES = [
  ['Pasal 4 huruf c', 'hak atas informasi yang benar, jelas, dan jujur mengenai kondisi dan jaminan barang dan/atau jasa'],
  ['Pasal 4 huruf d', 'hak untuk didengar pendapat dan keluhannya atas barang dan/atau jasa yang digunakan'],
  [
    'Pasal 4 huruf h',
    'hak untuk mendapatkan kompensasi, ganti rugi dan/atau penggantian, apabila barang dan/atau jasa yang diterima tidak sesuai dengan perjanjian atau tidak sebagaimana mestinya',
  ],
  [
    'Pasal 7 huruf g',
    'memberi kompensasi, ganti rugi dan/atau penggantian apabila barang dan/atau jasa yang diterima atau dimanfaatkan tidak sesuai dengan perjanjian',
  ],
  [
    'Pasal 19 ayat (1)',
    'Pelaku usaha bertanggung jawab memberikan ganti rugi atas kerusakan, pencemaran, dan/atau kerugian konsumen akibat mengkonsumsi barang dan/atau jasa yang dihasilkan atau diperdagangkan.',
  ],
];

// Found on the audit board's legal database on 14 Nov 2026. Titles and status were read; the contents were not.
export const UNREAD_RULES = [
  [
    'Permenkominfo No. 13 Tahun 2019 tentang Penyelenggaraan Jasa Telekomunikasi',
    'Berlaku; diubah dengan Permenkominfo 1/2021 dan 14/2021',
    'https://peraturan.bpk.go.id/Details/203113/permenkominfo-no-13-tahun-2019',
  ],
  [
    'Permenkominfo No. 5 Tahun 2021 tentang Penyelenggaraan Telekomunikasi',
    'Berlaku; sebagian dicabut dengan Permenkomdigi 7/2026',
    'https://peraturan.bpk.go.id/Details/203070/permenkominfo-no-5-tahun-2021',
  ],
];

export function sampleCase() {
  const { plan, tests } = core.sampleData(FIRST_LETTER_DAY);
  const summary = core.summarize(tests, plan);
  return {
    plan,
    tests,
    summary,
    first: core.buildLetter({ plan, tests, lang: 'id', kind: 'formal', today: FIRST_LETTER_DAY }),
    short: core.buildLetter({ plan, tests, lang: 'id', kind: 'wa', today: FIRST_LETTER_DAY }),
    second: core.buildEscalation({ plan, tests, lang: 'id', sentAt: FIRST_LETTER_DAY, today: SECOND_LETTER_DAY }),
  };
}

const block = (text) => ['```text', text, '```'];

export function buildReviewPack() {
  const sample = sampleCase();
  const { summary } = sample;
  const number = (value, digits) => core.fmtNum(value, 'id', digits);
  const estimate = `${core.fmtRp(summary.price, 'id')} x (1 - ${number(summary.down, 2)} / ${number(summary.promised, 0)}) = ${core.fmtRp(summary.rpLost, 'id')}`;

  return [
    '# Permohonan tinjauan: surat keluhan yang disusun Lelet',
    '',
    'Versi 14 November 2026. Disusun oleh Juwen Lie, pembuat Lelet.',
    'Halaman ini dibuat oleh `scripts/review-pack.mjs` dari kode aplikasi, sehingga ketiga surat di bawah sama persis dengan yang dihasilkan aplikasi.',
    '',
    '## Ringkasan',
    '',
    'Lelet (https://juw12.github.io/lelet/) adalah alat gratis untuk pelanggan internet rumah. Pelanggan mengukur kecepatan beberapa kali, lalu Lelet menyusun surat keluhan kepada penyedia layanan. Bila tidak ada penyelesaian dalam 7 hari kerja, Lelet menyusun surat kedua kepada Komdigi. Pelanggan mengirim sendiri surat itu atas namanya sendiri. Lelet tidak mengirim apa pun.',
    '',
    'Belum ada orang yang berwenang memberi nasihat hukum yang membaca surat-surat ini. Yang sudah dilakukan hanya pemeriksaan bacaan: setiap pasal yang dikutip dibandingkan dengan naskah undang-undang, dengan bantuan asisten AI. Karena itu saya memohon masukan atas lima pertanyaan berikut. Jawaban singkat pun sangat membantu.',
    '',
    '## Lima pertanyaan',
    '',
    '1. Apakah rujukan pasal UU No. 8 Tahun 1999 (Pasal 4 huruf c, d, h; Pasal 7 huruf g; Pasal 19 ayat (1)) tepat untuk keluhan kecepatan internet di bawah paket?',
    '2. Apakah kecepatan di bawah paket dapat disebut "kerugian konsumen" menurut Pasal 19 ayat (1)? Atau sebaiknya surat hanya bersandar pada Pasal 4 huruf h dan Pasal 7 huruf g?',
    '3. Kebanyakan paket memakai kata "hingga" (up to). Surat membandingkan hasil ukur dengan kecepatan paket yang diketik pelanggan dan belum menanggapi kata itu. Apakah surat perlu menanggapinya, dan bagaimana rumusannya?',
    '4. Surat meminta tanggapan "dalam 7 hari kerja" sebagai permintaan pelanggan, bukan sebagai tenggat menurut undang-undang, lalu menyebut akan meneruskan keluhan ke Komdigi, YLKI, atau BPSK. Apakah rumusan itu wajar dan aman bagi pengirim?',
    '5. Adakah peraturan kualitas layanan telekomunikasi yang sebaiknya dirujuk (lihat dua peraturan yang belum saya baca di bawah)? Adakah kalimat lain yang berisiko bagi pengirim, termasuk angka "perkiraan saya sendiri" dalam rupiah?',
    '',
    '## Yang sudah diperiksa dan yang belum',
    '',
    '| Hal | Keadaan pada 14 November 2026 |',
    '|---|---|',
    '| Kelima pasal yang dikutip ada, dan isinya sesuai naskah undang-undang | Sudah dibandingkan kata demi kata. Ini pemeriksaan bacaan dengan bantuan AI, bukan tinjauan hukum. |',
    `| UU No. 8 Tahun 1999 masih berlaku | Basis data peraturan BPK mencantumkan status "Berlaku": ${LAW_SOURCES.status} |`,
    '| Putusan Mahkamah Konstitusi | Halaman BPK yang sama mencantumkan Putusan Nomor 235/PUU-XXIII/2025 terkait Pasal 31. Surat tidak mengutip Pasal 31. Putusan itu belum saya baca. |',
    '| Ketepatan pasal untuk kasus kecepatan internet | Belum. Lihat pertanyaan 1 dan 2. |',
    '| Kata "hingga" dalam paket | Belum. Lihat pertanyaan 3. |',
    '| Peraturan kualitas layanan telekomunikasi | Judul dan status sudah diperiksa, isinya belum dibaca. Lihat pertanyaan 5. |',
    '',
    '## Pasal yang dikutip surat',
    '',
    `Naskah undang-undang yang dibaca: ${LAW_SOURCES.fullText}`,
    '',
    '| Dikutip surat | Bunyi dalam UU No. 8 Tahun 1999 |',
    '|---|---|',
    ...CITED_ARTICLES.map(([article, text]) => `| ${article} | "${text}" |`),
    '',
    'Catatan tentang hal lain yang disebut surat:',
    '',
    '- Surat versi singkat hanya menulis "Pasal 4 dan 19".',
    '- BPSK disebut sebagai tujuan lanjutan. Menurut bacaan saya, Pasal 45 ayat (1) dan Pasal 52 huruf a dan e mengatur penyelesaian sengketa melalui BPSK. Ini ringkasan saya, bukan kutipan.',
    '- Pasal 19 ayat (3) berbunyi "Pemberian ganti rugi dilaksanakan dalam tenggang waktu 7 (tujuh) hari setelah tanggal transaksi". Itu hal yang berbeda dari "7 hari kerja" dalam surat, dan surat tidak menyandarkan tenggatnya pada ayat itu.',
    '',
    '## Peraturan yang ditemukan tetapi belum dibaca',
    '',
    'Surat tidak mengutip peraturan di bawah ini karena isinya belum saya baca.',
    '',
    '| Peraturan | Status menurut basis data BPK | Tautan |',
    '|---|---|---|',
    ...UNREAD_RULES.map(([title, status, link]) => `| ${title} | ${status} | ${link} |`),
    '',
    '## Cara surat dipakai',
    '',
    '- Pengukuran dilakukan lewat peramban ke server Cloudflare. Surat menyebut cara itu, jumlah tes, jumlah hari, dan berapa tes yang lewat kabel LAN.',
    '- Surat menyebut hasilnya "bukti awal" dan meminta penyedia membandingkannya dengan data mereka sendiri.',
    `- Angka rupiah adalah perkiraan: harga paket x (1 - median unduh / kecepatan paket). Untuk contoh di bawah: ${estimate} per bulan.`,
    '- Di layar surat, aplikasi menampilkan kalimat ini: "Lelet bukan nasihat hukum dan bukan alat ukur resmi. Angka di sini adalah pengukuran Anda sendiri sebagai bukti awal."',
    '- Tanpa akun. Hasil tes, data paket, dan isi surat tetap di perangkat pelanggan. Halaman hanya mencatat tiga hitungan anonim, tanpa identitas, untuk mengetahui apakah alat ini dipakai.',
    '',
    '## Surat 1: keluhan kepada penyedia layanan',
    '',
    'Data contoh, bukan pelanggan sungguhan. "Contoh Net" bukan nama penyedia yang nyata.',
    '',
    ...block(sample.first),
    '',
    '## Surat 1 versi singkat, untuk pesan WhatsApp',
    '',
    ...block(sample.short),
    '',
    '## Surat 2: pengaduan lanjutan kepada Komdigi',
    '',
    'Disusun bila 7 hari kerja sudah lewat sejak surat pertama dikirim. Dalam contoh ini surat pertama dikirim pada 14 November 2026.',
    '',
    ...block(sample.second),
    '',
    '## Cara memberi masukan',
    '',
    'Balas e-mail pengantar, atau tulis di https://github.com/juw12/lelet/issues. Setiap perubahan pada surat dicatat di repositori https://github.com/juw12/lelet.',
    '',
  ].join('\n');
}

async function main() {
  const pack = buildReviewPack();
  if (process.argv.includes('--check')) {
    const onDisk = await readFile(PACK_PATH, 'utf8').catch(() => '');
    if (onDisk !== pack) {
      console.error('docs/permohonan-tinjauan.md is out of date. Run: node scripts/review-pack.mjs');
      process.exit(1);
    }
    console.log('docs/permohonan-tinjauan.md matches the app.');
    return;
  }
  await writeFile(PACK_PATH, pack);
  console.log(`wrote ${PACK_PATH}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
