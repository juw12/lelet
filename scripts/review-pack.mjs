// Builds docs/permohonan-tinjauan.md: the page a lawyer or a consumer body reads before the letters
// are used widely. The letters in it come from core.js, so the page cannot drift from the app.
//   node scripts/review-pack.mjs           write the page
//   node scripts/review-pack.mjs --check   exit 1 when the page on disk is out of date
import { readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as core from '../core.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PACK_PATH = path.join(HERE, '..', 'docs', 'permohonan-tinjauan.md');

// The three letters as they were sent for review on 14 Nov 2026 (Lelet-permohonan-tinjauan.pdf),
// in the order the page prints them. The page may gain explanations; the letters may not drift from
// this copy without a new review. `node scripts/review-pack.mjs --check` fails when they do.
export const LETTERS_SENT_2026_11_14 = path.join(HERE, '..', 'tests', 'fixtures', 'letters-sent-2026-11-14.txt');

/** The three letters the app writes today, one after the other. */
export function lettersAsSent(sample = sampleCase()) {
  return [sample.first, sample.short, sample.second].join('\n\n');
}

/** '' when the letters still match the 14 Nov 2026 copy, otherwise the first line that differs. */
export function lettersDrift(sample = sampleCase(), frozenPath = LETTERS_SENT_2026_11_14) {
  let frozen;
  try {
    frozen = readFileSync(frozenPath, 'utf8');
  } catch {
    return 'the copy of the 14 Nov 2026 letters is missing: tests/fixtures/letters-sent-2026-11-14.txt';
  }
  const today = lettersAsSent(sample);
  if (today === frozen) return '';
  const was = frozen.split('\n');
  const now = today.split('\n');
  const first = was.findIndex((line, index) => line !== (now[index] ?? ''));
  const at = first < 0 ? Math.min(was.length, now.length) : first;
  const short = (line) => (line ?? '(nothing)').slice(0, 90);
  return `the three letters changed since 14 Nov 2026, first at line ${at + 1}: `
    + `sent "${short(was[at])}", now "${short(now[at])}"`;
}

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
    'Pasal 19 ayat (2)',
    'Ganti rugi sebagaimana dimaksud pada ayat (1) dapat berupa pengembalian uang atau penggantian barang dan/atau jasa yang sejenis atau setara nilainya, atau perawatan kesehatan dan/atau pemberian santunan yang sesuai dengan ketentuan peraturan perundang-undangan yang berlaku.',
    'Ayat ini menyebut bentuk ganti rugi yang dapat diminta, berkaitan dengan permintaan kompensasi di surat (Pertanyaan 2 dan 5b).',
  ],
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

// Found by title search on the audit board's legal database on 14 Nov 2026 and read in full on 17 Nov 2026.
// 13/2019: text read from the BPK document file. 5/2021: text read on the ministry's JDIH site
// (the BPK copy of it is a 49 MB scan that does not come down through the fetch we use).
export const SERVICE_RULES = [
  [
    'Permenkominfo No. 13 Tahun 2019 tentang Penyelenggaraan Jasa Telekomunikasi',
    '"Berlaku" menurut basis data BPK (17 November 2026); sudah diubah dengan Permenkominfo 2/2020, 1/2021, dan 14/2021, yang isinya belum saya baca',
    'https://peraturan.bpk.go.id/Details/203113/permenkominfo-no-13-tahun-2019',
  ],
  [
    'Permenkominfo No. 5 Tahun 2021 tentang Penyelenggaraan Telekomunikasi',
    'Catatan dua sumber tidak sama dan belum saya selesaikan: basis data BPK menulis "Berlaku, sebagian dicabut dengan Permenkomdigi 7/2026", sedangkan situs JDIH kementerian menandai "Tidak Berlaku"',
    'https://peraturan.bpk.go.id/Details/203070/permenkominfo-no-5-tahun-2021',
  ],
];
export const SERVICE_RULES_5_2021_JDIH =
  'https://jdih.komdigi.go.id/produk_hukum/view/id/768/t/peraturan-menteri-komunikasi-dan-informatika-nomor-5-tahun-2021';

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

  const lines = [
    '# Permohonan tinjauan: surat keluhan yang disusun Lelet',
    '',
    '**Cara cepat menjawab, sekitar 15 menit:** [Ringkasan](#ringkasan), lalu [Lima pertanyaan](#lima-pertanyaan), lalu tabel [Yang sudah diperiksa dan yang belum](#yang-sudah-diperiksa-dan-yang-belum). Tiga surat di bagian bawah adalah salinan lengkap dari aplikasi; untuk menjawab kelima pertanyaan, surat-surat itu boleh dilewati. {{SIZE}}',
    '',
    'Saya memohon masukan atas lima pertanyaan di halaman ini tentang tiga surat keluhan yang disusun Lelet (https://juw12.github.io/lelet/), alat gratis untuk pelanggan internet rumah.',
    '',
    'Versi 17 November 2026. Disusun oleh Juwen Lie, pembuat Lelet.',
    'Ketiga surat dan nomor kelima pertanyaan sama dengan versi 14 November 2026 yang dikirim sebagai PDF. Yang ditambah sesudahnya hanya penjelasan: rumusan pertanyaan, catatan sumber, keterangan tentang penyusun, dan cara menjawab.',
    'Halaman ini dibuat oleh `scripts/review-pack.mjs` dari kode aplikasi, sehingga ketiga surat di bawah sama persis dengan yang dihasilkan aplikasi. Kode hitungan anonim yang disebut di "Cara surat dipakai" ada di https://github.com/juw12/lelet/blob/main/counter.js',
    '',
    '## Ringkasan',
    '',
    'Lelet (https://juw12.github.io/lelet/) adalah alat gratis untuk pelanggan internet rumah. Pelanggan mengukur kecepatan beberapa kali, lalu Lelet menyusun surat keluhan kepada penyedia layanan. Bila tidak ada penyelesaian dalam 7 hari kerja, Lelet menyusun surat kedua kepada Komdigi. Pelanggan mengirim sendiri surat itu atas namanya sendiri. Lelet tidak mengirim apa pun (kodenya terbuka: https://github.com/juw12/lelet).',
    '',
    'Saya bukan pengacara. Belum ada orang yang berwenang memberi nasihat hukum yang membaca surat-surat ini. Yang sudah dilakukan hanya pemeriksaan bacaan: setiap pasal yang dikutip dibandingkan dengan naskah undang-undang, dengan bantuan asisten AI. Karena itu masukan Anda atas kelima pertanyaan itu sangat berarti bagi saya.',
    '',
    'Anda tidak berkewajiban menjawab. Bila permohonan ini bukan untuk Anda, silakan abaikan, teruskan kepada rekan, atau tunjukkan lembaga yang lebih tepat. Setiap pertanyaan dapat dijawab dengan satu huruf, misalnya "1a, 2b, 3b, 5a-b, 5b-c" — pertanyaan 5 punya dua bagian yang dijawab sendiri-sendiri. Jawaban atas satu pertanyaan saja sudah membantu. Bila ada waktu, satu kalimat alasan di samping huruf pilihan sangat membantu saya memperbaiki surat. Cara menjawab: balas e-mail pengantar, atau tulis di https://github.com/juw12/lelet/issues (terbuka untuk umum).',
    '',
    '## Lima pertanyaan',
    '',
    'Setiap pertanyaan menyebut dahulu apa yang dilakukan surat sekarang, lalu pilihannya.',
    '',
    '1. **Ketepatan pasal.** Sekarang: Surat 1, surat lengkap, merujuk Pasal 4 huruf c, d, h; Pasal 7 huruf g; dan Pasal 19 ayat (1) UU No. 8 Tahun 1999. Bunyinya ada di [tabel "Pasal yang dikutip surat"](#pasal-yang-dikutip-surat). Pertanyaan: untuk keluhan kecepatan internet di bawah paket, rujukan itu (a) sudah tepat; (b) ada pasal yang sebaiknya dihapus; atau (c) ada pasal yang sebaiknya ditambahkan? (Pertanyaan ini tentang Surat 1; surat versi singkat menulis "UU 8/1999 Perlindungan Konsumen, Pasal 4 dan 19", tanpa huruf dan ayat — sudah ditandai di bagian risiko.)',
    '2. **Kata "kerugian".** Sekarang: surat menyebut Pasal 19 ayat (1) di antara dasar permintaannya, termasuk permintaan kompensasi atau penyesuaian tagihan. Ayat itu berbicara tentang "kerugian konsumen". Pertanyaan: kecepatan di bawah paket (a) dapat disebut kerugian konsumen menurut ayat itu, sehingga rujukan dipertahankan; atau (b) sebaiknya surat hanya bersandar pada Pasal 4 huruf h dan Pasal 7 huruf g?',
    '3. **Kata "hingga".** Sekarang: surat membandingkan hasil ukur dengan kecepatan paket yang diketik pelanggan. Perihal Surat 1 persisnya berbunyi "Keluhan kecepatan internet tidak sesuai paket". Surat tidak menanggapi kata "hingga" (up to) yang, menurut kesan saya dari brosur paket (belum saya buktikan dengan data), dipakai banyak paket. Pertanyaan: (a) biarkan seperti sekarang; (b) tambahkan satu kalimat yang mengakui kata "hingga" dan menyatakan bahwa hasil ukur berulang kali jauh di bawah angka itu; atau (c) ganti "tidak sesuai paket" dengan penyebutan selisihnya saja?',
    '4. **Tenggat 7 hari kerja.** Sekarang: surat menulis "Saya menunggu tanggapan dalam 7 hari kerja" sebagai permintaan pelanggan, bukan sebagai tenggat menurut undang-undang, lalu menyebut akan meneruskan keluhan ke Komdigi, YLKI, atau BPSK. Pertanyaan: rumusan itu (a) wajar dan aman bagi pengirim; (b) perlu diubah supaya tidak terbaca sebagai tenggat hukum atau ancaman; atau (c) sebaiknya dihapus?',
    '5. **Peraturan lain dan kalimat berisiko.** Dua bagian; masing-masing dapat dijawab sendiri.',
    '   - **5a.** Sekarang: surat hanya merujuk UU No. 8 Tahun 1999 dan tidak merujuk peraturan kualitas layanan telekomunikasi apa pun. Dua peraturan yang saya temukan sudah saya baca pada 17 November 2026; bunyi pasalnya ada di [bagian "Peraturan kualitas layanan telekomunikasi yang saya temukan"](#peraturan-kualitas-layanan-telekomunikasi-yang-saya-temukan). Pertanyaan: (a) cukup UU No. 8 Tahun 1999; atau (b) ada peraturan yang sebaiknya dirujuk (mohon sebut nomornya)?',
    '   - **5b.** Sekarang: surat memuat angka "perkiraan saya sendiri" dalam rupiah. Angka itu dihitung dengan rumus buatan saya, tanpa dasar hukum (lihat "Cara surat dipakai"). Pertanyaan: (a) angka itu boleh tetap; (b) sebaiknya dihapus; atau (c) ada kalimat lain yang berisiko bagi pengirim (mohon sebut)?',
    '',
    '## Yang sudah diperiksa dan yang belum',
    '',
    '| Hal | Keadaan pada 17 November 2026 |',
    '|---|---|',
    `| Kelima pasal yang dikutip ada, dan isinya sesuai naskah undang-undang | Sudah dibandingkan kata demi kata pada 14 November 2026 dan sekali lagi pada 16 November 2026. Ini pemeriksaan bacaan dengan bantuan AI, bukan tinjauan hukum. Naskahnya: ${LAW_SOURCES.fullText} |`,
    `| Enam pasal terkait yang tidak dikutip surat (Pasal 19 ayat (2) dan (3), 23, 45 ayat (1), 52 huruf a dan e) | Bunyinya sudah dibandingkan kata demi kata pada 16 dan 17 November 2026, dengan bantuan AI. Apakah pasal-pasal itu berlaku untuk kasus ini: belum dinilai. Naskahnya: ${LAW_SOURCES.fullText} |`,
    `| UU No. 8 Tahun 1999 masih berlaku | Basis data peraturan BPK mencantumkan status "Berlaku" (dibaca 16 November 2026): ${LAW_SOURCES.status} |`,
    `| Putusan Mahkamah Konstitusi | Halaman BPK yang sama mencantumkan Putusan Nomor 235/PUU-XXIII/2025 terkait Pasal 31. Surat tidak mengutip Pasal 31. Putusan itu belum saya baca, jadi kemungkinan pengaruhnya pada pasal lain yang dikutip surat (Pasal 4, 7, dan 19) belum saya nilai; saya menandainya sebagai hal yang belum diperiksa, dan saya akan memeriksanya pada putaran pemeriksaan mingguan berikutnya, 24 November 2026. Halamannya: ${LAW_SOURCES.status} |`,
    '| Ketepatan pasal untuk kasus kecepatan internet | Belum. Lihat pertanyaan 1 dan 2. |',
    '| Kata "hingga" dalam paket | Belum. Lihat pertanyaan 3. |',
    `| Peraturan kualitas layanan telekomunikasi | Ditemukan lewat pencarian judul, tidak menyeluruh. Sudah dibaca 17 November 2026; bunyi pasal yang berkaitan ada di bagian "Peraturan kualitas layanan telekomunikasi yang saya temukan". Lihat pertanyaan 5a. Tautannya: ${SERVICE_RULES.map(([, , link]) => link).join(' dan ')} |`,
    '',
    '## Bagian yang menurut saya paling mungkin keliru',
    '',
    'Saya menandainya di sini supaya Anda tidak perlu mencarinya sendiri.',
    '',
    '- Pasal 19 ayat (1) berbicara tentang "kerugian konsumen akibat mengkonsumsi barang dan/atau jasa". Surat memakainya untuk kecepatan di bawah paket. (Pertanyaan 2) Risikonya: bila kecepatan di bawah paket tidak termasuk "kerugian" menurut ayat itu, permintaan kompensasi kehilangan dasarnya.',
    '- Perihal Surat 1 persisnya "Keluhan kecepatan internet tidak sesuai paket", padahal surat tidak menanggapi kata "hingga". (Pertanyaan 3) Risikonya: penyedia dapat menjawab bahwa kata "hingga" membuat angka paket menjadi batas atas, bukan janji.',
    '- "7 hari kerja" dapat terbaca sebagai tenggat Pasal 19 ayat (3), padahal bukan. (Pertanyaan 4) Risikonya: kalimat itu dapat terbaca sebagai ancaman atau sebagai tenggat yang tidak punya dasar hukum.',
    '- Angka rupiah dihitung dengan rumus buatan saya. Saya tidak menemukan dasar hukum untuk rumus itu. (Pertanyaan 5b) Risikonya: angka tanpa dasar hukum dapat dianggap tuntutan yang mengada-ada dan melemahkan bagian surat yang lain.',
    '- Surat versi singkat hanya menulis "Pasal 4 dan 19", tanpa huruf dan ayat, sehingga lebih longgar daripada surat lengkap. (Pertanyaan 1) Risikonya: rujukan yang lebih longgar lebih mudah dibantah.',
    '- Surat 2 memohon Komdigi \"bantuan penyelesaian, termasuk kompensasi atau penyesuaian tagihan bila layanan terbukti tidak sesuai paket\". Yang berwenang memutus ganti rugi adalah BPSK atau pengadilan, sedangkan Komdigi mengawasi penyelenggaraan. (Pertanyaan 4) Risikonya: permintaan itu dapat dibaca sebagai permintaan di luar kewenangan yang dituju, sehingga bagian surat yang lain ikut dilemahkan; kata \"bantuan\" dan syarat \"bila terbukti\" sedikit meringankannya.',
    '- Surat mengutip Pasal 4 huruf c (hak atas informasi yang benar) bersama huruf d dan h. Untuk keluhan kecepatan, huruf c paling longgar kaitannya, karena surat tidak menuduh penyedia memberi informasi yang salah. (Pertanyaan 1) Risikonya: rujukan yang tidak tepat sasaran mudah dibantah, dan bantahan itu dapat dipakai untuk seluruh surat.',
    '- Surat menyebut YLKI dan BPSK sebagai tujuan lanjutan. Saya belum meminta persetujuan YLKI untuk disebut. Bila YLKI berkeberatan, nama itu saya hapus dari surat. (Pertanyaan 4) Risikonya: menyebut lembaga tanpa izin dapat terbaca sebagai mengatasnamakan mereka.',
    '',
    '## Pasal yang dikutip surat',
    '',
    `Disalin kata demi kata dari naskah undang-undang ini, dibaca 14 dan 16 November 2026: ${LAW_SOURCES.fullText}`,
    '',
    `Tautan itu menuju berkas naskah di JDIH Kementerian Keuangan (jdih.kemenkeu.go.id). Halaman keterangan undang-undang yang sama di basis data peraturan BPK: ${LAW_SOURCES.status}`,
    '',
    '| Dikutip surat | Bunyi dalam UU No. 8 Tahun 1999 |',
    '|---|---|',
    ...CITED_ARTICLES.map(([article, text]) => `| ${article} | "${text}" |`),
    '',
    '## Pasal terkait yang tidak dikutip surat',
    '',
    `Surat tidak mengutip pasal-pasal ini. Saya mencantumkannya karena berkaitan dengan tenggat, dengan bentuk ganti rugi, dan dengan BPSK yang disebut surat. Bunyinya disalin kata demi kata dari naskah yang sama, dibaca 16 dan 17 November 2026: ${LAW_SOURCES.fullText}`,
    '',
    '| Pasal | Bunyi dalam UU No. 8 Tahun 1999 | Kaitan dengan surat |',
    '|---|---|---|',
    ...NOTED_ARTICLES.map(([article, text, why]) => `| ${article} | "${text}" | ${why} |`),
    '',
    '## Peraturan kualitas layanan telekomunikasi yang saya temukan',
    '',
    'Dua peraturan ini muncul dalam pencarian judul di basis data peraturan BPK (peraturan.bpk.go.id) pada 14 November 2026. Kata kunci persisnya tidak saya catat, dan pencariannya tidak sistematis, jadi daftar ini bukan daftar lengkap peraturan yang ada. Pada 17 November 2026 saya membaca teksnya: Permenkominfo 13/2019 dari berkas naskah di basis data BPK, dan Permenkominfo 5/2021 dari situs JDIH kementerian (' + SERVICE_RULES_5_2021_JDIH + '). Pembacaan dibantu asisten AI; kutipan di bawah disalin kata demi kata.',
    '',
    '| Peraturan | Status menurut sumber | Tautan |',
    '|---|---|---|',
    ...SERVICE_RULES.map(([title, status, link]) => `| ${title} | ${status} | ${link} |`),
    '',
    'Yang dikatakan peraturan ini tentang kualitas layanan:',
    '',
    'Permenkominfo 13/2019 (penyelenggaraan jasa telekomunikasi):',
    '- Pasal 1 angka 25: "Komitmen Layanan adalah kewajiban Penyelenggara Jasa Telekomunikasi untuk menyediakan layanan di wilayah tertentu dengan komitmen penyediaan layanan sesuai dengan ketentuan peraturan perundang-undangan."',
    '- Pasal 47 ayat (3) huruf b dan c: dalam evaluasi tahunan, penyelenggara wajib "menyampaikan laporan pencapaian kualitas layanan Jasa Telekomunikasi" dan "memenuhi Komitmen Layanan pada tahun penyelenggaraan yang dievaluasi".',
    '- Pasal 48 ayat (1): laporan penyelenggaraan tahunan disampaikan paling lambat 30 April tahun berikutnya.',
    '- Yang belum saya petakan: isi tiga perubahannya, dan ukuran standar kualitas yang terukur itu sendiri. Peraturan ini mencantumkan dalam bagian "Mengingat"-nya peraturan menteri sebelumnya yang mengatur standar kualitas pelayanan (misalnya 14/PER/M.KOMINFO/04/2011); standar yang terukur ada di lapisan itu.',
    '',
    'Permenkominfo 5/2021 (penyelenggaraan telekomunikasi):',
    '- Pasal 7 ayat (1): "Penyelenggara Jaringan Telekomunikasi dan/atau Penyelenggara Jasa Telekomunikasi wajib memenuhi standar kualitas Penyelenggaraan Telekomunikasi."',
    '- Pasal 7 ayat (2): standar kualitas ditetapkan Dirjen, dengan pertimbangan: a. menjamin persaingan usaha yang sehat; b. menjaga kinerja pelayanan; c. melindungi kepentingan konsumen.',
    '- Pasal 198 ayat (1): kewajiban penyelenggara antara lain "memenuhi standar kualitas Penyelenggaraan Telekomunikasi", "mempublikasikan pencapaian standar kualitas layanan untuk setiap periode pelaporan secara daring melalui situs web (website) layanan informasi milik Penyelenggara", dan bagi penyelenggara jasa, "memenuhi komitmen layanan dan/atau penyediaan Jasa Telekomunikasi secara menyeluruh"; rekaman data pengukuran kualitas layanan dipelihara selama 1 (satu) tahun buku dan disimpan sampai 1 (satu) tahun buku ke depan.',
    '- Pasal 198 ayat (2): pelaksana jual kembali wajib "memenuhi ketentuan standar kualitas pelayanan Jasa Telekomunikasi yang telah dikomitmenkan oleh Penyelenggara Jasa Telekomunikasi".',
    '',
    'Untuk pertanyaan 5a, yang bisa saya simpulkan dari membaca kedua peraturan ini: keduanya mewajibkan penyedia memenuhi komitmen/standar kualitas layanan dan melaporkan pencapaiannya secara periodik, tetapi ukuran standarnya ada di ketentuan Dirjen yang belum saya petakan. Apakah surat sebaiknya merujuk salah satunya atau ketentuan yang lebih tepat: itu di tangan Anda.',
    '',
    '## Cara surat dipakai',
    '',
    '- Pengukuran dilakukan lewat peramban ke server Cloudflare. Surat menyebut cara itu, jumlah tes, jumlah hari, dan berapa tes yang lewat kabel LAN.',
    '- Surat menyebut hasilnya "bukti awal" dan meminta penyedia membandingkannya dengan data mereka sendiri.',
    `- Angka rupiah adalah perkiraan dengan rumus buatan saya, bukan dari peraturan: harga paket x (1 - median unduh / kecepatan paket). Untuk contoh di bawah: ${estimate} per bulan.`,
    '- Di layar surat, aplikasi menampilkan kalimat ini: "Lelet bukan nasihat hukum dan bukan alat ukur resmi. Angka di sini adalah pengukuran Anda sendiri sebagai bukti awal."',
    '- Tanpa akun. Hasil tes, data paket, dan isi surat tetap di perangkat pelanggan. Halaman hanya mencatat tiga hitungan anonim, tanpa identitas, untuk mengetahui apakah alat ini dipakai: angkanya adalah jumlah unduhan tiga berkas kosong (first-test, ten-tests, letter-sent) yang disimpan di GitHub, dan tidak ada isi tes, paket, atau surat yang ikut terkirim. Seperti saat membuka situs lain, Cloudflare (tes kecepatan, https://www.cloudflare.com/) dan GitHub (halaman dan hitungan, https://docs.github.com/en/site-policy) melihat alamat IP pengunjung; alamat itu tidak sampai kepada saya dan tidak saya simpan.',
    '',
    '## Surat 1: keluhan kepada penyedia layanan',
    '',
    'Data contoh, bukan pelanggan sungguhan. "Contoh Net" bukan nama penyedia yang nyata.',
    '',
    '<details>',
    '<summary>Buka salinan lengkap Surat 1 (dari aplikasi)</summary>',
    '',
    ...block(sample.first),
    '',
    '</details>',
    '',
    '## Surat 1 versi singkat, untuk pesan WhatsApp',
    '',
    '<details>',
    '<summary>Buka salinan lengkap Surat 1 versi singkat</summary>',
    '',
    ...block(sample.short),
    '',
    '</details>',
    '',
    '## Surat 2: pengaduan lanjutan kepada Komdigi',
    '',
    'Disusun bila 7 hari kerja sudah lewat sejak surat pertama dikirim. Dalam contoh ini surat pertama dikirim pada 14 November 2026.',
    '',
    'Lampiran tes di Surat 2 sengaja sama dengan Surat 1: surat ini dikirim terpisah ke Komdigi, jadi pembacanya tidak melihat Surat 1. Untuk membaca halaman ini, lampiran itu boleh dilewati.',
    '',
    '<details>',
    '<summary>Buka salinan lengkap Surat 2 (dari aplikasi)</summary>',
    '',
    ...block(sample.second),
    '',
    '</details>',
    '',
    '## Cara memberi masukan dan apa yang terjadi sesudahnya',
    '',
    '- Balas e-mail pengantar, atau tulis di https://github.com/juw12/lelet/issues. Halaman itu terbuka untuk umum; e-mail tidak.',
    '- Yang saya lakukan dengan jawaban Anda: surat diperbaiki sesuai masukan, setiap perubahan dicatat di repositori https://github.com/juw12/lelet, dan saya membalas Anda dengan daftar perubahannya.',
    '- Jawaban lewat e-mail tidak saya publikasikan. Nama Anda atau lembaga Anda tidak saya sebut di aplikasi, di repositori, atau di tempat lain tanpa izin tertulis. Lelet tidak akan menyatakan "sudah ditinjau" tanpa izin itu.',
    '- Bila tidak ada jawaban, saya mengirim satu pesan susulan saja, lalu berhenti.',
    '',
  ];
  const page = lines.join('\n');

  // The quick-path line claims "about 15 minutes"; state the measured size so the claim can be checked.
  // Measured on the part before the letters — the part a reader actually has to read to answer.
  const head = page.slice(0, page.indexOf('## Surat 1: keluhan kepada penyedia layanan'));
  const words = head.split(/\s+/).filter(Boolean).length;
  const numbers = (value) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return page.replace(
    '{{SIZE}}',
    `Bagian itu, sebelum ketiga surat, ${numbers(words)} kata — kira-kira ${Math.round(words / 200)} menit membaca biasa, `
      + `sekitar ${Math.round(words / 170)} menit bila tabel dan tautan di dalamnya ikut diperiksa. Bila pasal-pasalnya ikut dinilai satu per satu, waktunya lebih lama; angka ini hanya perkiraan membaca.`,
  );
}

async function main() {
  const drift = lettersDrift();
  if (drift) {
    console.error(`${drift}.`);
    console.error('The three letters are frozen for the review. If the change is intended, replace '
      + 'tests/fixtures/letters-sent-2026-11-14.txt in the same commit, deliberately.');
    process.exit(1);
  }
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
