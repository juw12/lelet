// Lelet core: pure logic, no DOM, no network. Tested with `node --test`.

export const PEAK_FROM = 18; // jam sibuk: 18.00 - 22.59
export const PEAK_TO = 23;

export const BANDS = [
  { id: 'pagi', from: 6, to: 12 },
  { id: 'siang', from: 12, to: 18 },
  { id: 'malam', from: 18, to: 23 },
  { id: 'larut', from: 23, to: 6 },
];

// The yardstick is Lelet's own, stated in the app and in the letter. It is not a legal threshold.
export const OK_PCT = 80;
export const FAR_PCT = 50;

export const STRONG = { tests: 10, days: 3, peak: 3, offPeak: 3 };
export const FAIR = { tests: 5, days: 2 };

export function median(values) {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const pad = (n) => String(n).padStart(2, '0');

export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function bandOf(ts) {
  const hour = new Date(ts).getHours();
  for (const band of BANDS) {
    const inside = band.from < band.to ? hour >= band.from && hour < band.to : hour >= band.from || hour < band.to;
    if (inside) return band.id;
  }
  return 'larut';
}

export function isPeak(ts) {
  const hour = new Date(ts).getHours();
  return hour >= PEAK_FROM && hour < PEAK_TO;
}

export function verdictOf(pct) {
  if (!Number.isFinite(pct)) return null;
  if (pct >= OK_PCT) return 'ok';
  if (pct >= FAR_PCT) return 'below';
  return 'far';
}

export function strengthOf(tests) {
  const n = tests.length;
  const days = new Set(tests.map((t) => dayKey(t.ts))).size;
  const peak = tests.filter((t) => isPeak(t.ts)).length;
  const offPeak = n - peak;
  const have = { tests: n, days, peak, offPeak };
  const strong = n >= STRONG.tests && days >= STRONG.days && peak >= STRONG.peak && offPeak >= STRONG.offPeak;
  const fair = n >= FAIR.tests && days >= FAIR.days;
  const level = strong ? 'kuat' : fair ? 'cukup' : 'lemah';
  const checklist = Object.keys(STRONG).map((key) => ({
    key,
    have: have[key],
    need: STRONG[key],
    done: have[key] >= STRONG[key],
  }));
  return { level, ...have, checklist };
}

// Money for speed that was paid for but not delivered, per month. An estimate, labelled as one.
export function estimateRp(price, medianDown, promised) {
  if (!(price > 0) || !(promised > 0) || !Number.isFinite(medianDown)) return null;
  const delivered = Math.min(1, Math.max(0, medianDown / promised));
  return Math.round(price * (1 - delivered));
}

export function summarize(tests, plan) {
  const list = [...tests].sort((a, b) => a.ts - b.ts);
  const promised = Number(plan?.mbps) > 0 ? Number(plan.mbps) : null;
  const price = Number(plan?.price) > 0 ? Number(plan.price) : null;
  const down = median(list.map((t) => t.down));
  const pct = promised && down !== null ? (down / promised) * 100 : null;
  const below = (limit) => (promised ? list.filter((t) => (t.down / promised) * 100 < limit).length : null);

  let worstBand = null;
  for (const band of BANDS) {
    const inBand = list.filter((t) => bandOf(t.ts) === band.id);
    if (inBand.length < 2) continue;
    const bandDown = median(inBand.map((t) => t.down));
    if (!worstBand || bandDown < worstBand.down) worstBand = { id: band.id, down: bandDown, n: inBand.length };
  }
  const bandsWithData = BANDS.filter((band) => list.filter((t) => bandOf(t.ts) === band.id).length >= 2).length;
  if (bandsWithData < 2) worstBand = null; // nothing to compare against

  return {
    n: list.length,
    days: new Set(list.map((t) => dayKey(t.ts))).size,
    first: list.length ? list[0].ts : null,
    last: list.length ? list[list.length - 1].ts : null,
    down,
    up: median(list.map((t) => t.up)),
    ping: median(list.map((t) => t.ping)),
    promised,
    price,
    pct,
    below50: below(FAR_PCT),
    below80: below(OK_PCT),
    worstBand,
    wired: list.filter((t) => t.via === 'lan').length,
    lowConf: list.filter((t) => t.conf === 'low').length,
    rpLost: estimateRp(price, down, promised),
    verdict: verdictOf(pct),
    strength: strengthOf(list),
  };
}

// ---------- formatting ----------

const LOCALE = { id: 'id-ID', en: 'en-GB' };

export function fmtNum(value, lang = 'id', digits = 1) {
  if (!Number.isFinite(value)) return '-';
  return value.toLocaleString(LOCALE[lang] || LOCALE.id, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtRp(value, lang = 'id') {
  if (!Number.isFinite(value)) return '-';
  return 'Rp ' + Math.round(value).toLocaleString(LOCALE[lang] || LOCALE.id);
}

export function fmtDate(ts, lang = 'id') {
  return new Date(ts).toLocaleDateString(LOCALE[lang] || LOCALE.id, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function fmtStamp(ts) {
  const d = new Date(ts);
  return `${dayKey(ts)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------- complaint letter ----------

const BAND_TEXT = {
  id: { pagi: 'pagi (06.00-12.00)', siang: 'siang (12.00-18.00)', malam: 'malam (18.00-23.00)', larut: 'larut malam (23.00-06.00)' },
  en: { pagi: 'morning (06:00-12:00)', siang: 'afternoon (12:00-18:00)', malam: 'evening (18:00-23:00)', larut: 'late night (23:00-06:00)' },
};

function testLines(tests, lang) {
  const via = { id: { lan: 'kabel', wifi: 'Wi-Fi' }, en: { lan: 'cable', wifi: 'Wi-Fi' } }[lang];
  return [...tests]
    .sort((a, b) => a.ts - b.ts)
    .map((t, i) => {
      const cells = [
        `${pad(i + 1)}.`,
        fmtStamp(t.ts),
        `${lang === 'id' ? 'unduh' : 'down'} ${fmtNum(t.down, lang)} Mbps`,
        `${lang === 'id' ? 'unggah' : 'up'} ${fmtNum(t.up, lang)} Mbps`,
        `${Math.round(t.ping)} ms`,
        via[t.via] || via.wifi,
      ];
      return cells.join('  ');
    })
    .join('\n');
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function buildLetter({ plan, tests, lang = 'id', kind = 'formal', today = Date.now() }) {
  const s = summarize(tests, plan);
  if (!s.n || !s.promised) return '';
  const provider = (plan.provider || '').trim() || (lang === 'id' ? '[nama provider]' : '[provider name]');
  const person = (plan.person || '').trim() || (lang === 'id' ? '[nama Anda]' : '[your name]');
  const custId = (plan.custId || '').trim();
  const planName = (plan.name || '').trim();
  const city = (plan.city || '').trim();
  const num = (v, digits = 1) => fmtNum(v, lang, digits);
  const pct = num(s.pct, 0);
  const period = s.first && dayKey(s.first) !== dayKey(s.last) ? `${fmtDate(s.first, lang)} - ${fmtDate(s.last, lang)}` : fmtDate(s.first, lang);

  if (kind === 'wa') {
    if (lang === 'en') {
      return [
        `Hello ${provider}, I am your customer${custId ? ` (ID ${custId})` : ''}.`,
        `My plan is ${num(s.promised, 0)} Mbps${s.price ? ` (${fmtRp(s.price, lang)}/month)` : ''}, but across ${plural(s.n, 'test', 'tests')} on ${plural(s.days, 'day', 'days')} (${period}) my median download was only ${num(s.down)} Mbps, ${pct}% of the plan.`,
        `Please check and repair the line, or adjust my bill (Law 8/1999 on Consumer Protection, Articles 4 and 19). I can send the full test list.`,
        `Thank you. ${person}`,
      ].join('\n');
    }
    return [
      `Halo ${provider}, saya pelanggan Anda${custId ? ` (ID ${custId})` : ''}.`,
      `Paket saya ${num(s.promised, 0)} Mbps${s.price ? ` (${fmtRp(s.price, lang)}/bulan)` : ''}, tetapi dari ${s.n} tes pada ${s.days} hari (${period}) median unduh saya hanya ${num(s.down)} Mbps, ${pct}% dari paket.`,
      `Mohon dicek dan diperbaiki, atau tagihan saya disesuaikan (UU 8/1999 Perlindungan Konsumen, Pasal 4 dan 19). Rincian semua tes bisa saya kirim.`,
      `Terima kasih. ${person}`,
    ].join('\n');
  }

  const bullets = [];
  if (lang === 'en') {
    bullets.push(`- Median download: ${num(s.down)} Mbps = ${pct}% of the plan speed (${num(s.promised, 0)} Mbps)`);
    bullets.push(`- Median upload: ${num(s.up)} Mbps; median latency: ${Math.round(s.ping)} ms`);
    bullets.push(`- ${s.below50} of ${plural(s.n, 'test was', 'tests were')} below 50% of the plan speed; ${s.below80} of ${s.n} were below 80%`);
    if (s.worstBand) bullets.push(`- Worst time of day: ${BAND_TEXT.en[s.worstBand.id]}, median ${num(s.worstBand.down)} Mbps`);
    bullets.push(`- ${s.wired} of ${plural(s.n, 'test was', 'tests were')} run over a LAN cable, the rest over Wi-Fi`);
  } else {
    bullets.push(`- Median unduh: ${num(s.down)} Mbps = ${pct}% dari kecepatan paket (${num(s.promised, 0)} Mbps)`);
    bullets.push(`- Median unggah: ${num(s.up)} Mbps; median latensi: ${Math.round(s.ping)} ms`);
    bullets.push(`- ${s.below50} dari ${s.n} tes berada di bawah 50% kecepatan paket; ${s.below80} dari ${s.n} di bawah 80%`);
    if (s.worstBand) bullets.push(`- Waktu terburuk: ${BAND_TEXT.id[s.worstBand.id]}, median ${num(s.worstBand.down)} Mbps`);
    bullets.push(`- ${s.wired} dari ${s.n} tes dilakukan lewat kabel LAN, sisanya lewat Wi-Fi`);
  }

  if (lang === 'en') {
    return [
      `${city ? city + ', ' : ''}${fmtDate(today, lang)}`,
      '',
      `To: Customer Service, ${provider}`,
      '',
      `Subject: Complaint - internet speed below the plan I pay for${custId ? ` (customer ID ${custId})` : ''}`,
      '',
      'Dear Sir or Madam,',
      '',
      `My name is ${person}. I subscribe to ${provider}${planName ? `, plan "${planName}"` : ''}, sold as ${num(s.promised, 0)} Mbps${s.price ? ` for ${fmtRp(s.price, lang)} per month` : ''}.`,
      '',
      `I measured my connection ${plural(s.n, 'time', 'times')} on ${plural(s.days, 'day', 'different days')} (${period}) with Lelet, a browser test against Cloudflare servers. The results:`,
      ...bullets,
      '',
      'Under Law No. 8 of 1999 on Consumer Protection (Article 4 letters c, d and h, Article 7 letter g and Article 19 paragraph (1)), I ask for:',
      '1. A written explanation and a technical check of the network at my address.',
      '2. A repair so that the speed matches the plan.',
      `3. If it cannot be repaired, compensation or a bill adjustment for the period the service did not match the plan${s.rpLost ? ` (my own estimate: about ${fmtRp(s.rpLost, lang)} per month)` : ''}.`,
      '',
      'I look forward to your reply within 7 working days. If there is no solution, I will take this complaint to the Ministry of Communication and Digital Affairs (Komdigi), YLKI or the consumer dispute body (BPSK).',
      '',
      'Note: these are my own measurements, offered as initial evidence. Please compare them with the readings from your own equipment.',
      '',
      'Yours faithfully,',
      person,
      '',
      'Attachment - all tests:',
      testLines(tests, lang),
    ].join('\n');
  }

  return [
    `${city ? city + ', ' : ''}${fmtDate(today, lang)}`,
    '',
    'Kepada Yth.',
    `Layanan Pelanggan ${provider}`,
    '',
    `Perihal: Keluhan kecepatan internet tidak sesuai paket${custId ? ` (ID pelanggan ${custId})` : ''}`,
    '',
    'Dengan hormat,',
    '',
    `Saya, ${person}, pelanggan ${provider}${planName ? ` dengan paket "${planName}"` : ''} yang dijual dengan kecepatan ${num(s.promised, 0)} Mbps${s.price ? ` seharga ${fmtRp(s.price, lang)} per bulan` : ''}.`,
    '',
    `Saya mengukur koneksi saya ${s.n} kali pada ${s.days} hari berbeda (${period}) dengan Lelet, tes lewat peramban ke server Cloudflare. Hasilnya:`,
    ...bullets,
    '',
    'Berdasarkan Undang-Undang Nomor 8 Tahun 1999 tentang Perlindungan Konsumen (Pasal 4 huruf c, d, dan h, Pasal 7 huruf g, serta Pasal 19 ayat (1)), saya meminta:',
    '1. Penjelasan tertulis dan pemeriksaan teknis jaringan di alamat saya.',
    '2. Perbaikan sehingga kecepatan sesuai dengan paket.',
    `3. Jika tidak dapat diperbaiki, kompensasi atau penyesuaian tagihan untuk masa layanan yang tidak sesuai paket${s.rpLost ? ` (perkiraan saya sendiri: sekitar ${fmtRp(s.rpLost, lang)} per bulan)` : ''}.`,
    '',
    'Saya menunggu tanggapan dalam 7 hari kerja. Jika tidak ada penyelesaian, saya akan meneruskan keluhan ini ke Kementerian Komunikasi dan Digital (Komdigi), YLKI, atau Badan Penyelesaian Sengketa Konsumen (BPSK).',
    '',
    'Catatan: ini hasil pengukuran saya sendiri sebagai bukti awal. Mohon dibandingkan dengan pembacaan dari perangkat Anda.',
    '',
    'Hormat saya,',
    person,
    '',
    'Lampiran - semua tes:',
    testLines(tests, lang),
  ].join('\n');
}

// ---------- import / export ----------

export function sanitizeTest(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const ts = Number(raw.ts);
  const down = Number(raw.down);
  const up = Number(raw.up);
  const ping = Number(raw.ping);
  if (!(ts > 0) || !(down >= 0) || !(up >= 0) || !(ping >= 0)) return null;
  if (![ts, down, up, ping].every(Number.isFinite)) return null;
  return {
    ts,
    down,
    up,
    ping,
    jitter: Number.isFinite(Number(raw.jitter)) ? Number(raw.jitter) : 0,
    bytes: Number.isFinite(Number(raw.bytes)) ? Number(raw.bytes) : 0,
    mode: ['hemat', 'normal', 'penuh'].includes(raw.mode) ? raw.mode : 'hemat',
    via: raw.via === 'lan' ? 'lan' : 'wifi',
    conf: raw.conf === 'low' ? 'low' : 'ok',
    colo: typeof raw.colo === 'string' ? raw.colo.slice(0, 8) : '',
    sample: raw.sample === true,
  };
}

export function mergeTests(current, incoming) {
  const byTime = new Map();
  for (const t of [...current, ...incoming]) {
    const clean = sanitizeTest(t);
    if (clean) byTime.set(clean.ts, clean);
  }
  return [...byTime.values()].sort((a, b) => a.ts - b.ts);
}

export function toCSV(tests) {
  const head = 'waktu,unduh_mbps,unggah_mbps,latensi_ms,jitter_ms,data_mb,mode,lewat,keyakinan,server';
  const rows = [...tests]
    .sort((a, b) => a.ts - b.ts)
    .map((t) =>
      [
        fmtStamp(t.ts),
        t.down.toFixed(2),
        t.up.toFixed(2),
        Math.round(t.ping),
        (t.jitter || 0).toFixed(1),
        ((t.bytes || 0) / 1e6).toFixed(1),
        t.mode || '',
        t.via || '',
        t.conf || '',
        t.colo || '',
      ].join(','),
    );
  return [head, ...rows].join('\n') + '\n';
}

// Demo data so a first-time visitor can see the receipt and the letter. Always marked sample: true.
export function sampleData(now = Date.now()) {
  const plan = { provider: 'Contoh Net', name: 'Rumah 50', mbps: 50, price: 350000, custId: '', person: '', city: '' };
  const hours = [8, 13, 19, 21];
  const downs = [31.2, 27.5, 14.8, 11.9, 33.0, 25.1, 13.2, 12.4, 29.7, 26.3, 15.6, 10.8];
  const tests = [];
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  for (let day = 0; day < 3; day += 1) {
    for (let slot = 0; slot < hours.length; slot += 1) {
      const index = day * hours.length + slot;
      const at = new Date(startOfToday.getTime() - (3 - day) * 86400000);
      at.setHours(hours[slot], 7 + index, 0, 0);
      tests.push({
        ts: at.getTime(),
        down: downs[index],
        up: 9 + (index % 4),
        ping: 18 + (index % 5) * 3,
        jitter: 2 + (index % 3),
        bytes: 11e6,
        mode: 'hemat',
        via: index % 3 === 0 ? 'lan' : 'wifi',
        conf: 'ok',
        colo: 'CGK',
        sample: true,
      });
    }
  }
  return { plan, tests };
}
