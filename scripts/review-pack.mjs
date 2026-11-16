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

// Quoted word for word from the law text at LAW_SOURCES.fullText, read on 14 Nov 2026 and again on 16 Nov 2026.
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

// Related articles the letters do NOT cite. Quoted word for word from the same law text, read on 16 Nov 2026.
// Third column: why the reader may want to see it next to the letters.
export const NOTED_ARTICLES = [
  [
    'Pasal 19 ayat (3)',
    'Pemberian ganti rugi dilaksanakan dalam tenggang waktu 7 (tujuh) hari setelah tanggal transaksi.',
    'Surat memakai "7 hari kerja" sebagai permintaan pelanggan, bukan sebagai tenggat ayat ini.',
  ],
  [
    'Pasal 23',
    'Pelaku usaha yang menolak dan/atau tidak memberi tanggapan dan/atau tidak memenuhi ganti rugi atas tuntutan konsumen sebagaimana dimaksud dalam Pasal 19 ayat (1), ayat (2), ayat (3), dan ayat (4), dapat digugat melalui badan penyelesaian sengketa konsumen atau mengajukan ke badan peradilan di tempat kedudukan konsumen.',
    'Surat menyebut BPSK sebagai tujuan lanjutan bila tidak ada penyelesaian.',
  ],
  [
    'Pasal 45 ayat (1)',
    'Setiap konsumen yang dirugikan dapat menggugat pelaku usaha melalui lembaga yang bertugas menyelesaikan sengketa antara konsumen dan pelaku usaha atau melalui peradilan yang berada di lingkungan peradilan umum.',
    'Sama: BPSK sebagai tujuan lanjutan.',
  ],
  [
    'Pasal 52 huruf a (tugas dan wewenang BPSK)',
    'melaksanakan penanganan dan penyelesaian sengketa konsumen, dengan cara melalui mediasi atau arbitrase atau konsiliasi',
    'Sama: BPSK sebagai tujuan lanjutan.',
  ],
  [
    'Pasal 52 huruf e (tugas dan wewenang BPSK)',
    'menerima pengaduan baik tertulis maupun tidak tertulis, dari konsumen tentang terjadinya pelanggaran terhadap perlindungan konsumen',
    'Sama: BPSK sebagai tujuan lanjutan.',
  ],
];

// Found on the audit board's legal database on 14 Nov 2026 and looked up again on 16 Nov 2026.
// Titles and status were read; the contents were not.
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
    'Versi 16 November 2026. Disusun oleh Juwen Lie, pembuat Lelet.',
    'Ketiga surat dan nomor kelima pertanyaan sama dengan versi 14 November 2026 yang dikirim sebagai PDF. Yang diperjelas hanya rumusan pertanyaan dan catatan sumber.',
    'Halaman ini dibuat oleh `scripts/review-pack.mjs` dari kode aplikasi, sehingga ketiga surat di bawah sama persis dengan yang dihasilkan aplikasi.',
    '',
    '## Ringkasan',
    '',
    'Lelet (https://juw12.github.io/lelet/) adalah alat gratis untuk pelanggan internet rumah. Pelanggan mengukur kecepatan beberapa kali, lalu Lelet menyusun surat keluhan kepada penyedia layanan. Bila tidak ada penyelesaian dalam 7 hari kerja, Lelet menyusun surat kedua kepada Komdigi. Pelanggan mengirim sendiri surat itu atas namanya sendiri. Lelet tidak mengirim apa pun.',
    '',
    'Belum ada orang yang berwenang memberi nasihat hukum yang membaca surat-surat ini. Yang sudah dilakukan hanya pemeriksaan bacaan: setiap pasal yang dikutip dibandingkan dengan naskah undang-undang, dengan bantuan asisten AI. Karena itu saya memohon masukan atas lima pertanyaan berikut.',
    '',
    'Anda tidak berkewajiban menjawab. Bila permohonan ini bukan untuk Anda, silakan abaikan, teruskan kepada rekan, atau tunjukkan lembaga yang lebih tepat. Setiap pertanyaan dapat dijawab dengan satu huruf, misalnya "1a, 2b, 3b". Jawaban atas satu pertanyaan saja sudah membantu.',
    '',
    '## Lima pertanyaan',
    '',
    'Setiap pertanyaan menyebut dahulu apa yang dilakukan surat sekarang, lalu pilihannya.',
    '',
    '1. **Ketepatan pasal.** Sekarang: surat merujuk Pasal 4 huruf c, d, h; Pasal 7 huruf g; dan Pasal 19 ayat (1) UU No. 8 Tahun 1999. Bunyinya ada di tabel "Pasal yang dikutip surat". Pertanyaan: untuk keluhan kecepatan internet di bawah paket, rujukan itu (a) sudah tepat; (b) ada pasal yang sebaiknya dihapus; atau (c) ada pasal yang sebaiknya ditambahkan?',
    '2. **Kata "kerugian".** Sekarang: surat menyebut Pasal 19 ayat (1) di antara dasar permintaannya, termasuk permintaan kompensasi atau penyesuaian tagihan. Ayat itu berbicara tentang "kerugian konsumen". Pertanyaan: kecepatan di bawah paket (a) dapat disebut kerugian konsumen menurut ayat itu, sehingga rujukan dipertahankan; atau (b) sebaiknya surat hanya bersandar pada Pasal 4 huruf h dan Pasal 7 huruf g?',
    '3. **Kata "hingga".** Sekarang: surat membandingkan hasil ukur dengan kecepatan paket yang diketik pelanggan, memakai perihal "tidak sesuai paket", dan tidak menanggapi kata "hingga" (up to) yang, sejauh yang saya lihat, dipakai banyak paket. Pertanyaan: (a) biarkan seperti sekarang; (b) tambahkan satu kalimat yang mengakui kata "hingga" dan menyatakan bahwa hasil ukur berulang kali jauh di bawah angka itu; atau (c) ganti "tidak sesuai paket" dengan penyebutan selisihnya saja?',
    '4. **Tenggat 7 hari kerja.** Sekarang: surat menulis "Saya menunggu tanggapan dalam 7 hari kerja" sebagai permintaan pelanggan, bukan sebagai tenggat menurut undang-undang, lalu menyebut akan meneruskan keluhan ke Komdigi, YLKI, atau BPSK. Pertanyaan: rumusan itu (a) wajar dan aman bagi pengirim; (b) perlu diubah supaya tidak terbaca sebagai tenggat hukum atau ancaman; atau (c) sebaiknya dihapus?',
    '5. **Peraturan lain dan kalimat berisiko.** Dua bagian; masing-masing dapat dijawab sendiri.',
    '   - **5a.** Sekarang: surat hanya merujuk UU No. 8 Tahun 1999 dan tidak merujuk peraturan kualitas layanan telekomunikasi apa pun. Dua peraturan yang saya temukan tetapi belum saya baca ada di bawah. Pertanyaan: (a) cukup UU No. 8 Tahun 1999; atau (b) ada peraturan yang sebaiknya dirujuk (mohon sebut nomornya)?',
    '   - **5b.** Sekarang: surat memuat angka "perkiraan saya sendiri" dalam rupiah. Angka itu dihitung dengan rumus buatan saya, tanpa dasar hukum (lihat "Cara surat dipakai"). Pertanyaan: (a) angka itu boleh tetap; (b) sebaiknya dihapus; atau (c) ada kalimat lain yang berisiko bagi pengirim (mohon sebut)?',
    '',
    '## Yang sudah diperiksa dan yang belum',
    '',
    '| Hal | Keadaan pada 16 November 2026 |',
    '|---|---|',
    '| Kelima pasal yang dikutip ada, dan isinya sesuai naskah undang-undang | Sudah dibandingkan kata demi kata pada 14 November 2026 dan sekali lagi pada 16 November 2026. Ini pemeriksaan bacaan dengan bantuan AI, bukan tinjauan hukum. |',
    '| Lima pasal terkait yang tidak dikutip surat (Pasal 19 ayat (3), 23, 45 ayat (1), 52 huruf a dan e) | Bunyinya sudah dibandingkan kata demi kata pada 16 November 2026, dengan bantuan AI. Apakah pasal-pasal itu berlaku untuk kasus ini: belum dinilai. |',
    `| UU No. 8 Tahun 1999 masih berlaku | Basis data peraturan BPK mencantumkan status "Berlaku" (dibaca 16 November 2026): ${LAW_SOURCES.status} |`,
    '| Putusan Mahkamah Konstitusi | Halaman BPK yang sama mencantumkan Putusan Nomor 235/PUU-XXIII/2025 terkait Pasal 31. Surat tidak mengutip Pasal 31. Putusan itu belum saya baca. |',
    '| Ketepatan pasal untuk kasus kecepatan internet | Belum. Lihat pertanyaan 1 dan 2. |',
    '| Kata "hingga" dalam paket | Belum. Lihat pertanyaan 3. |',
    '| Peraturan kualitas layanan telekomunikasi | Judul dan status sudah diperiksa, isinya belum dibaca. Lihat pertanyaan 5a. |',
    '',
    '## Bagian yang menurut saya paling mungkin keliru',
    '',
    'Saya menandainya di sini supaya Anda tidak perlu mencarinya sendiri.',
    '',
    '- Pasal 19 ayat (1) berbicara tentang "kerugian konsumen akibat mengkonsumsi barang dan/atau jasa". Surat memakainya untuk kecepatan di bawah paket. (Pertanyaan 2)',
    '- Perihal surat berbunyi "tidak sesuai paket", padahal surat tidak menanggapi kata "hingga". (Pertanyaan 3)',
    '- "7 hari kerja" dapat terbaca sebagai tenggat Pasal 19 ayat (3), padahal bukan. (Pertanyaan 4)',
    '- Angka rupiah dihitung dengan rumus buatan saya. Saya tidak menemukan dasar hukum untuk rumus itu. (Pertanyaan 5b)',
    '- Surat versi singkat hanya menulis "Pasal 4 dan 19", tanpa huruf dan ayat, sehingga lebih longgar daripada surat lengkap. (Pertanyaan 1)',
    '- Surat menyebut YLKI dan BPSK sebagai tujuan lanjutan. Saya belum meminta persetujuan YLKI untuk disebut. Bila YLKI berkeberatan, nama itu saya hapus dari surat. (Pertanyaan 4)',
    '',
    '## Pasal yang dikutip surat',
    '',
    `Disalin kata demi kata dari naskah undang-undang ini, dibaca 14 dan 16 November 2026: ${LAW_SOURCES.fullText}`,
    '',
    '| Dikutip surat | Bunyi dalam UU No. 8 Tahun 1999 |',
    '|---|---|',
    ...CITED_ARTICLES.map(([article, text]) => `| ${article} | "${text}" |`),
    '',
    '## Pasal terkait yang tidak dikutip surat',
    '',
    `Surat tidak mengutip pasal-pasal ini. Saya mencantumkannya karena berkaitan dengan tenggat dan dengan BPSK yang disebut surat. Bunyinya disalin kata demi kata dari naskah yang sama, dibaca 16 November 2026: ${LAW_SOURCES.fullText}`,
    '',
    '| Pasal | Bunyi dalam UU No. 8 Tahun 1999 | Kaitan dengan surat |',
    '|---|---|---|',
    ...NOTED_ARTICLES.map(([article, text, why]) => `| ${article} | "${text}" | ${why} |`),
    '',
    '## Peraturan yang ditemukan tetapi belum dibaca',
    '',
    'Surat tidak mengutip peraturan di bawah ini karena isinya belum saya baca. Judul dan statusnya dibaca di basis data peraturan BPK pada 16 November 2026.',
    '',
    '| Peraturan | Status menurut basis data BPK | Tautan |',
    '|---|---|---|',
    ...UNREAD_RULES.map(([title, status, link]) => `| ${title} | ${status} | ${link} |`),
    '',
    '## Cara surat dipakai',
    '',
    '- Pengukuran dilakukan lewat peramban ke server Cloudflare. Surat menyebut cara itu, jumlah tes, jumlah hari, dan berapa tes yang lewat kabel LAN.',
    '- Surat menyebut hasilnya "bukti awal" dan meminta penyedia membandingkannya dengan data mereka sendiri.',
    `- Angka rupiah adalah perkiraan dengan rumus buatan saya, bukan dari peraturan: harga paket x (1 - median unduh / kecepatan paket). Untuk contoh di bawah: ${estimate} per bulan.`,
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
    '## Cara memberi masukan dan apa yang terjadi sesudahnya',
    '',
    '- Balas e-mail pengantar, atau tulis di https://github.com/juw12/lelet/issues. Halaman itu terbuka untuk umum; e-mail tidak.',
    '- Yang saya lakukan dengan jawaban Anda: surat diperbaiki sesuai masukan, setiap perubahan dicatat di repositori https://github.com/juw12/lelet, dan saya membalas Anda dengan daftar perubahannya.',
    '- Jawaban lewat e-mail tidak saya publikasikan. Nama Anda atau lembaga Anda tidak saya sebut di aplikasi, di repositori, atau di tempat lain tanpa izin tertulis. Lelet tidak akan menyatakan "sudah ditinjau" tanpa izin itu.',
    '- Bila tidak ada jawaban, saya mengirim satu pesan susulan saja, lalu berhenti.',
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
