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

function resultBullets(s, lang) {
  const num = (v, digits = 1) => fmtNum(v, lang, digits);
  const pct = num(s.pct, 0);
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
  return bullets;
}

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

  const bullets = resultBullets(s, lang);

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

// ---------- follow-through: the wait after the first letter, and the second letter ----------

export const REPLY_WORKDAYS = 7; // the first letter asks for a reply "within 7 working days"

const startOfDay = (ts) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Indonesian national holidays, from the yearly joint ministerial decree (SKB 3 Menteri), as published by
// the State Secretariat: setneg.go.id "Inilah SKB 3 Menteri Libur Nasional dan Cuti Bersama" 2026 and 2027.
// Read 14 November 2026. Add the next year when its decree is published (usually September).
export const HOLIDAYS = [
  '2026-01-01', '2026-01-16', '2026-02-17', '2026-03-19', '2026-03-21', '2026-03-22', '2026-04-03', '2026-04-05',
  '2026-05-01', '2026-05-14', '2026-05-27', '2026-05-31', '2026-06-01', '2026-06-16', '2026-08-17', '2026-08-25',
  '2026-12-25',
  '2027-01-01', '2027-01-05', '2027-02-06', '2027-03-08', '2027-03-10', '2027-03-11', '2027-03-26', '2027-03-28',
  '2027-05-01', '2027-05-06', '2027-05-17', '2027-05-20', '2027-06-01', '2027-06-06', '2027-08-15', '2027-08-17',
  '2027-12-25', '2027-12-26',
];
// Joint leave (cuti bersama) binds civil servants; private companies decide for themselves. These days are
// still counted as working days, and the app only mentions them as a possible reason for a slower reply.
export const JOINT_LEAVE = [
  '2026-02-16', '2026-03-18', '2026-03-20', '2026-03-23', '2026-03-24', '2026-05-15', '2026-05-28', '2026-12-24',
  '2027-02-05', '2027-03-09', '2027-03-12', '2027-03-15', '2027-03-25', '2027-05-18', '2027-05-19', '2027-12-24',
];
export const HOLIDAYS_UNTIL = '2027-12-31'; // after this date the count falls back to Monday to Friday

const HOLIDAY_SET = new Set(HOLIDAYS);
const JOINT_LEAVE_SET = new Set(JOINT_LEAVE);
const isWeekday = (d) => d.getDay() !== 0 && d.getDay() !== 6;
const isWorkday = (d) => isWeekday(d) && !HOLIDAY_SET.has(dayKey(d.getTime()));

// Counts Monday to Friday and skips national holidays. Also reports which days it skipped or flagged,
// so the screen can show its working instead of asking to be trusted.
export function followUp(sentAt, now = Date.now(), workdays = REPLY_WORKDAYS) {
  if (!(Number(sentAt) > 0) || !Number.isFinite(Number(sentAt))) return null;
  const cursor = startOfDay(Number(sentAt));
  const holidays = []; // weekday holidays inside the wait, as day keys
  const jointLeave = []; // joint-leave days inside the wait: counted, but worth a mention
  let counted = 0;
  while (counted < workdays) {
    cursor.setDate(cursor.getDate() + 1);
    const key = dayKey(cursor.getTime());
    if (isWorkday(cursor)) {
      counted += 1;
      if (JOINT_LEAVE_SET.has(key)) jointLeave.push(key);
    } else if (isWeekday(cursor)) {
      holidays.push(key);
    }
  }
  const dueAt = cursor.getTime(); // last working day the provider still has to reply
  const today = startOfDay(now);
  const firstCounted = startOfDay(Number(sentAt));
  firstCounted.setDate(firstCounted.getDate() + 1); // the day the letter was sent is not counted
  let workdaysLeft = 0; // working days still to wait, today included
  for (const d = new Date(Math.max(today.getTime(), firstCounted.getTime())); d.getTime() <= dueAt; d.setDate(d.getDate() + 1)) {
    if (isWorkday(d)) workdaysLeft += 1;
  }
  return {
    sentAt: Number(sentAt),
    dueAt,
    workdaysLeft,
    due: today.getTime() > dueAt,
    holidays,
    jointLeave,
    beyondData: dayKey(dueAt) > HOLIDAYS_UNTIL,
  };
}

// A calendar file (.ics) for the reply deadline, so the visitor does not have to remember to come back.
// All-day event on the first day after the deadline, with an alarm at 09:00 that morning.
const icsEscape = (value) =>
  String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
const icsFold = (line) => {
  const parts = [];
  let rest = line;
  while (rest.length > 70) {
    parts.push(rest.slice(0, 70));
    rest = ` ${rest.slice(70)}`;
  }
  parts.push(rest);
  return parts.join('\r\n');
};
const icsDay = (date) => dayKey(date.getTime()).replace(/-/g, '');

export function buildICS({ sentAt, provider = '', lang = 'id', url = '', now = Date.now() }) {
  const wait = followUp(sentAt, now);
  if (!wait) return '';
  const name = String(provider || '').trim() || (lang === 'id' ? 'provider' : 'the provider');
  const start = startOfDay(wait.dueAt);
  start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const dueText = fmtDate(wait.dueAt, lang);
  const summary = lang === 'id' ? `Lelet: cek balasan ${name}` : `Lelet: check for a reply from ${name}`;
  const description =
    lang === 'id'
      ? `Batas ${REPLY_WORKDAYS} hari kerja untuk balasan ${name} berakhir ${dueText}. Belum ada penyelesaian? Buka Lelet dan kirim surat kedua ke Komdigi.${url ? ` ${url}` : ''}`
      : `The ${REPLY_WORKDAYS} working days for a reply from ${name} ended on ${dueText}. No solution yet? Open Lelet and send the second letter to Komdigi.${url ? ` ${url}` : ''}`;
  const stamp = new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  return (
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Lelet//Reply deadline//ID',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:lelet-${icsDay(startOfDay(wait.sentAt))}-${icsDay(start)}@lelet`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDay(start)}`,
      `DTEND;VALUE=DATE:${icsDay(end)}`,
      `SUMMARY:${icsEscape(summary)}`,
      `DESCRIPTION:${icsEscape(description)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsEscape(summary)}`,
      'TRIGGER:PT9H',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .map(icsFold)
      .join('\r\n') + '\r\n'
  );
}

export function buildEscalation({ plan, tests, lang = 'id', sentAt, ticket = '', today = Date.now() }) {
  const s = summarize(tests, plan);
  const wait = followUp(sentAt, today);
  if (!s.n || !s.promised || !wait) return '';
  const provider = (plan.provider || '').trim() || (lang === 'id' ? '[nama provider]' : '[provider name]');
  const person = (plan.person || '').trim() || (lang === 'id' ? '[nama Anda]' : '[your name]');
  const custId = (plan.custId || '').trim();
  const planName = (plan.name || '').trim();
  const city = (plan.city || '').trim();
  const ticketNo = String(ticket || '').trim();
  const num = (v, digits = 1) => fmtNum(v, lang, digits);
  const period = s.first && dayKey(s.first) !== dayKey(s.last) ? `${fmtDate(s.first, lang)} - ${fmtDate(s.last, lang)}` : fmtDate(s.first, lang);
  const bullets = resultBullets(s, lang);

  if (lang === 'en') {
    return [
      `${city ? city + ', ' : ''}${fmtDate(today, lang)}`,
      '',
      'To: Complaint Service, Ministry of Communication and Digital Affairs (Komdigi)',
      `Copy: Customer Service, ${provider}`,
      '',
      `Subject: Follow-up complaint - ${provider} internet speed below the plan, first complaint not resolved`,
      '',
      'Dear Sir or Madam,',
      '',
      `My name is ${person}. I subscribe to ${provider}${planName ? `, plan "${planName}"` : ''}${custId ? `, customer ID ${custId}` : ''}, sold as ${num(s.promised, 0)} Mbps${s.price ? ` for ${fmtRp(s.price, lang)} per month` : ''}.`,
      '',
      `On ${fmtDate(wait.sentAt, lang)} I sent a written complaint to ${provider} customer service${ticketNo ? ` (ticket number ${ticketNo})` : ''} and asked for a reply within ${REPLY_WORKDAYS} working days. That period ${wait.due ? 'ended' : 'ends'} on ${fmtDate(wait.dueAt, lang)}. As of the date of this letter I have not received a satisfactory solution.`,
      '',
      `My measurements (${plural(s.n, 'test', 'tests')} on ${plural(s.days, 'day', 'days')}, ${period}, with Lelet, a browser test against Cloudflare servers):`,
      ...bullets,
      '',
      'Under Law No. 8 of 1999 on Consumer Protection (Article 4 letters c, d and h, Article 7 letter g and Article 19 paragraph (1)), I ask for:',
      `1. This complaint to be recorded and passed to ${provider} for a written answer.`,
      '2. A check of whether the service at my address matches the speed that was sold.',
      `3. Help in reaching a settlement, including compensation or a bill adjustment if the service is found not to match the plan${s.rpLost ? ` (my own estimate: about ${fmtRp(s.rpLost, lang)} per month)` : ''}.`,
      '',
      'I attach a copy of my first complaint separately. The full list of tests is below.',
      '',
      'Note: these are my own measurements, offered as initial evidence. They are not an official measurement. Please compare them with the provider\'s data.',
      '',
      'Yours faithfully,',
      person,
      'Contact: [your phone number or email]',
      '',
      'Attachment - all tests:',
      testLines(tests, lang),
    ].join('\n');
  }

  return [
    `${city ? city + ', ' : ''}${fmtDate(today, lang)}`,
    '',
    'Kepada Yth.',
    'Layanan Pengaduan Kementerian Komunikasi dan Digital (Komdigi)',
    `Tembusan: Layanan Pelanggan ${provider}`,
    '',
    `Perihal: Pengaduan lanjutan - kecepatan internet ${provider} tidak sesuai paket, keluhan pertama belum diselesaikan`,
    '',
    'Dengan hormat,',
    '',
    `Saya, ${person}, pelanggan ${provider}${planName ? ` dengan paket "${planName}"` : ''}${custId ? `, ID pelanggan ${custId}` : ''}, yang dijual dengan kecepatan ${num(s.promised, 0)} Mbps${s.price ? ` seharga ${fmtRp(s.price, lang)} per bulan` : ''}.`,
    '',
    `Pada ${fmtDate(wait.sentAt, lang)} saya mengirim keluhan tertulis ke layanan pelanggan ${provider}${ticketNo ? ` (nomor tiket ${ticketNo})` : ''} dan meminta tanggapan dalam ${REPLY_WORKDAYS} hari kerja. Batas waktu itu ${wait.due ? 'berakhir' : 'baru berakhir'} pada ${fmtDate(wait.dueAt, lang)}. Sampai surat ini dibuat, saya belum menerima penyelesaian yang memadai.`,
    '',
    `Hasil pengukuran saya (${s.n} tes pada ${s.days} hari, ${period}, dengan Lelet, tes lewat peramban ke server Cloudflare):`,
    ...bullets,
    '',
    'Berdasarkan Undang-Undang Nomor 8 Tahun 1999 tentang Perlindungan Konsumen (Pasal 4 huruf c, d, dan h, Pasal 7 huruf g, serta Pasal 19 ayat (1)), saya memohon:',
    `1. Pengaduan ini dicatat dan diteruskan kepada ${provider} untuk dijawab secara tertulis.`,
    '2. Pemeriksaan apakah layanan di alamat saya sesuai dengan kecepatan yang dijual.',
    `3. Bantuan penyelesaian, termasuk kompensasi atau penyesuaian tagihan bila layanan terbukti tidak sesuai paket${s.rpLost ? ` (perkiraan saya sendiri: sekitar ${fmtRp(s.rpLost, lang)} per bulan)` : ''}.`,
    '',
    'Salinan keluhan pertama saya lampirkan terpisah. Daftar semua tes ada di bawah.',
    '',
    'Catatan: ini hasil pengukuran saya sendiri sebagai bukti awal, bukan pengukuran resmi. Mohon dibandingkan dengan data penyelenggara.',
    '',
    'Hormat saya,',
    person,
    'Kontak: [nomor telepon atau email Anda]',
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
