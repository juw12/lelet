// Lelet app shell: state, routing and rendering.
// Every piece of text enters the page through textContent, never innerHTML, so nothing typed
// into the plan form or read from a backup file can run as markup.

import * as core from './core.js';
import { runTest, MODES, DEFAULT_BASE } from './engine.js';
import { makeT } from './i18n.js';

const STORE_KEY = 'lelet.v1';
const TABS = ['tes', 'paket', 'bukti', 'surat'];
const PLAN_FIELDS = ['provider', 'name', 'mbps', 'price', 'custId', 'person', 'city'];
const AUTO_CHOICES = [0, 15, 30, 60];
const REPO_URL = 'https://github.com/juw12/lelet';
const PROVIDERS = [
  'IndiHome',
  'First Media',
  'Biznet',
  'MyRepublic',
  'XL Home',
  'Iconnet',
  'CBN',
  'Oxygen',
  'Indosat HiFi',
  'Starlink',
  'Telkomsel Orbit',
];

// ---------- small DOM helpers ----------

const $ = (selector) => document.querySelector(selector);

function h(tag, props, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'value') node.value = value;
    else if (key === 'width') node.style.width = value; // CSSOM: allowed by the page's CSP, unlike style=""
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

// ---------- state ----------

const emptyPlan = () => ({ provider: '', name: '', mbps: '', price: '', custId: '', person: '', city: '' });

function loadState() {
  const fresh = {
    v: 1,
    lang: 'id',
    theme: null,
    plan: emptyPlan(),
    tests: [],
    settings: { mode: 'hemat', via: 'wifi', auto: 0 },
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return fresh;
    if (saved.lang === 'en') fresh.lang = 'en';
    if (saved.theme === 'light' || saved.theme === 'dark') fresh.theme = saved.theme;
    fresh.plan = cleanPlan(saved.plan);
    if (Array.isArray(saved.tests)) fresh.tests = core.mergeTests([], saved.tests);
    const settings = saved.settings || {};
    if (MODES[settings.mode]) fresh.settings.mode = settings.mode;
    if (settings.via === 'lan') fresh.settings.via = 'lan';
    if (AUTO_CHOICES.includes(settings.auto)) fresh.settings.auto = settings.auto;
  } catch (error) {
    // unreadable storage: start clean
  }
  return fresh;
}

function cleanPlan(raw) {
  const plan = emptyPlan();
  if (!raw || typeof raw !== 'object') return plan;
  for (const field of PLAN_FIELDS) {
    if (raw[field] !== undefined && raw[field] !== null) plan[field] = String(raw[field]).slice(0, 80);
  }
  plan.mbps = normalizeNumber(plan.mbps);
  plan.price = plan.price.replace(/\D/g, '');
  if (raw.sample === true) plan.sample = true;
  return plan;
}

// "50", "50,5", "1.000" (Indonesian thousands) -> a plain decimal string
function normalizeNumber(text) {
  let value = String(text).trim();
  if (/^\d{1,3}(\.\d{3})+$/.test(value)) value = value.replace(/\./g, '');
  value = value.replace(',', '.').replace(/[^\d.]/g, '');
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? String(number) : '';
}

const state = loadState();
let t = makeT(state.lang);

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (error) {
    // storage full or blocked (private mode): the app keeps working for this visit
  }
}

const run = { active: false, ctl: null, phase: '', down: null, up: null, frac: 0, error: '', note: '' };
const letter = { kind: 'formal', edits: {} };
let autoSince = Date.now();
let quickOpen = false; // keep the inline plan fields on screen while the visitor is still typing in them
let live = null; // references to the meter elements, for updates while a test runs
let toastTimer = null;

const hasSample = () => state.tests.some((test) => test.sample);
const planSpeed = () => (Number(state.plan.mbps) > 0 ? Number(state.plan.mbps) : null);
const lastTest = () => (state.tests.length ? state.tests[state.tests.length - 1] : null);
const route = () => {
  const name = location.hash.replace('#', '');
  return TABS.includes(name) ? name : 'tes';
};

function testBase() {
  // A different test server can be chosen only while developing on this machine.
  if (!['localhost', '127.0.0.1'].includes(location.hostname)) return DEFAULT_BASE;
  try {
    const wanted = new URL(new URLSearchParams(location.search).get('server') || '');
    if (['localhost', '127.0.0.1'].includes(wanted.hostname)) return wanted.origin;
  } catch (error) {
    // no override given
  }
  return DEFAULT_BASE;
}

const BASE = testBase();

function dropSample() {
  state.tests = state.tests.filter((test) => !test.sample);
  if (state.plan.sample) state.plan = emptyPlan();
}

function invalidateLetter() {
  letter.edits = {};
}

const num = (value, digits) => core.fmtNum(value, state.lang, digits ?? (value >= 100 ? 0 : 1));
const whole = (value) => core.fmtNum(value, state.lang, 0);

function toast(text) {
  const box = $('#toast');
  box.textContent = text;
  box.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('show'), 2600);
}

// ---------- page chrome: header, tabs, footer ----------

function effectiveTheme() {
  if (state.theme) return state.theme;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function renderChrome() {
  document.documentElement.lang = state.lang;
  document.title = t('app.title');
  $('#tagline').textContent = t('app.tagline');
  $('.skip').textContent = t('app.skip');

  const langButton = $('#lang-btn');
  langButton.textContent = state.lang === 'id' ? 'EN' : 'ID';
  langButton.setAttribute('aria-label', t('head.lang'));
  $('#theme-btn').setAttribute('aria-label', t('head.theme'));
  const themeColor = $('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute('content', effectiveTheme() === 'dark' ? '#161513' : '#F4EFE6');

  const current = route();
  const tabs = $('#tabs');
  tabs.setAttribute('aria-label', t('nav.label'));
  tabs.replaceChildren(
    ...TABS.map((name, index) =>
      h(
        'a',
        { href: `#${name}`, 'aria-current': name === current ? 'page' : null },
        h('span', { class: 'step', text: String(index + 1) }),
        t(`nav.${name}`),
      ),
    ),
  );

  $('#foot').replaceChildren(
    h('p', { text: t('foot.free') }),
    h('p', { text: t('foot.privacy') }),
    h('p', null, `${t('foot.legal')} `, h('a', { href: REPO_URL, rel: 'noopener', text: t('foot.source') })),
  );
}

// ---------- shared pieces ----------

function segmented(legend, act, current, options, hint) {
  return h(
    'fieldset',
    null,
    h('legend', { text: legend }),
    h(
      'div',
      { class: 'seg' },
      options.map((option) =>
        h(
          'button',
          { type: 'button', 'data-act': act, 'data-val': option.value, 'aria-pressed': String(option.value === current) },
          option.label,
          option.small ? h('small', { text: option.small }) : null,
        ),
      ),
    ),
    hint ? h('p', { class: 'hint', text: hint }) : null,
  );
}

function planField(field, label, options = {}) {
  return h(
    'label',
    { class: 'field' },
    h('span', null, label, options.optional ? h('em', { text: ` (${t('paket.optional')})` }) : null),
    h('input', {
      type: 'text',
      'data-plan': field,
      value: state.plan[field] || '',
      inputmode: options.inputmode,
      autocomplete: options.autocomplete || 'off',
      list: options.list,
      maxlength: 80,
      placeholder: options.placeholder,
    }),
  );
}

function strengthCard(strength) {
  const firstOpen = strength.checklist.find((item) => !item.done);
  const nextText = firstOpen
    ? t(`strength.next.${firstOpen.key}`, { k: firstOpen.need - firstOpen.have })
    : t('strength.done');
  return h(
    'section',
    { class: 'card' },
    h(
      'div',
      { class: 'strength-head' },
      h('h2', { text: t('strength.title') }),
      h('span', { class: `level ${strength.level}`, text: t(`strength.${strength.level}`) }),
    ),
    h(
      'ul',
      { class: 'checks' },
      strength.checklist.map((item) =>
        h(
          'li',
          { class: item.done ? 'done' : null },
          h('span', { text: t(`strength.${item.key}`) }),
          h('span', { class: 'count', text: `${Math.min(item.have, item.need)}/${item.need}` }),
          h('span', { class: 'bar' }, h('i', { width: `${Math.min(100, (item.have / item.need) * 100)}%` })),
        ),
      ),
    ),
    h('p', { class: 'next', text: nextText }),
  );
}

// "… {rp} …" with the amount in bold, built without innerHTML
function withBold(key, name, value) {
  const marker = '\u0000';
  const [before, after = ''] = t(key, { [name]: marker }).split(marker);
  return [before, h('b', { text: value }), after];
}

// ---------- Tes ----------

function fillPromise(box, down) {
  const promised = planSpeed();
  if (!promised) {
    box.replaceChildren(h('p', { class: 'hint', text: t('tes.noplan') }));
    return;
  }
  const pct = Number.isFinite(down) ? (down / promised) * 100 : null;
  const fillClass = `promise-fill${pct !== null && pct >= core.OK_PCT ? ' ok' : ''}`;
  const fillWidth = `${pct === null ? 0 : Math.min(100, pct)}%`;
  const ofPlan = pct === null ? '-' : t('tes.ofplan', { pct: whole(pct), mbps: num(promised, 0) });
  const promiseText = t('tes.promise', { mbps: num(promised, 0) });

  const fill = box.querySelector('.promise-fill');
  if (fill) {
    // already built: change it in place so the bar animates instead of jumping
    fill.className = fillClass;
    fill.style.width = fillWidth;
    box.querySelector('strong').textContent = ofPlan;
    box.querySelector('.promise-text span').textContent = promiseText;
    return;
  }
  box.replaceChildren(
    h(
      'div',
      { class: 'promise-track', role: 'img', 'aria-label': t('tes.bar') },
      h('div', { class: fillClass, width: fillWidth }),
      h('div', { class: 'promise-mark' }),
    ),
    h('div', { class: 'promise-text' }, h('strong', { text: ofPlan }), h('span', { text: promiseText })),
  );
}

function phaseText() {
  if (run.active) return t(`tes.phase.${run.phase || 'ping'}`);
  if (run.note) return t(run.note);
  const last = lastTest();
  if (last) return t('tes.last', { when: core.fmtStamp(last.ts) });
  return t('tes.idle', { mb: whole((MODES.hemat.downBytes + MODES.hemat.upBytes) / 1e6) });
}

function meterCard() {
  const last = lastTest();
  const down = run.active ? run.down : last ? last.down : null;
  const up = run.active ? run.up : last ? last.up : null;
  const shown = (value, digits) => (Number.isFinite(value) ? num(value, digits) : '-');

  live = {
    num: h('b', { text: shown(down) }),
    promise: h('div', { class: 'promise', id: 'sec-promise' }),
    up: h('dd', null, shown(up), h('small', { text: ' Mbps' })),
    phase: h('p', { class: 'phase', 'aria-live': 'polite', text: phaseText() }),
    bar: h('i', { width: `${run.active ? run.frac * 100 : 0}%` }),
  };
  fillPromise(live.promise, down);

  return h(
    'section',
    { class: 'card meter' },
    h('div', { class: 'meter-label', text: t('tes.down') }),
    h('div', { class: 'meter-num' }, live.num, h('span', { text: 'Mbps' })),
    live.promise,
    h(
      'dl',
      { class: 'stats' },
      h('div', null, h('dt', { text: t('tes.up') }), live.up),
      h(
        'div',
        null,
        h('dt', { text: t('tes.ping') }),
        h('dd', null, !run.active && last ? whole(last.ping) : '-', h('small', { text: ' ms' })),
      ),
      h(
        'div',
        null,
        h('dt', { text: t('tes.jitter') }),
        h('dd', null, !run.active && last ? num(last.jitter, 1) : '-', h('small', { text: ' ms' })),
      ),
    ),
    live.phase,
    h('div', { class: 'progress', hidden: !run.active }, live.bar),
  );
}

function paintLive() {
  if (!live || route() !== 'tes') return;
  if (Number.isFinite(run.down)) {
    live.num.textContent = num(run.down);
    fillPromise(live.promise, run.down);
  }
  if (Number.isFinite(run.up)) live.up.firstChild.textContent = num(run.up);
  live.phase.textContent = phaseText();
  live.bar.style.width = `${Math.round(run.frac * 100)}%`;
}

function quickPlanCard() {
  if (planSpeed() && !quickOpen) return null;
  quickOpen = true;
  return h(
    'section',
    { class: 'card' },
    h('h2', { text: t('tes.quick.title') }),
    h(
      'div',
      { class: 'two' },
      planField('mbps', t('tes.quick.mbps'), { inputmode: 'decimal', placeholder: '50' }),
      planField('price', t('tes.quick.price'), { inputmode: 'numeric', placeholder: '350000' }),
    ),
    h('p', { class: 'hint' }, h('a', { href: '#paket', text: t('tes.quick.more') })),
  );
}

function verdictBox() {
  const box = h('div', { id: 'sec-verdict' });
  fillVerdict(box);
  return box;
}

function fillVerdict(box) {
  const summary = core.summarize(state.tests, state.plan);
  if (!summary.n || !summary.verdict) {
    box.hidden = true;
    box.replaceChildren();
    return;
  }
  const isOk = summary.verdict === 'ok';
  const lineText = t('verdict.line', {
    down: num(summary.down),
    n: summary.n,
    pct: whole(summary.pct),
    mbps: num(summary.promised, 0),
  });
  box.hidden = false;
  box.replaceChildren(
    h(
      'section',
      { class: `verdict${isOk ? ' ok' : ''}` },
      h('h2', { text: t(`verdict.${summary.verdict}`) }),
      h('p', { text: lineText }),
      !isOk && summary.rpLost > 0
        ? [
            h('p', { class: 'rp' }, withBold('verdict.rp', 'rp', core.fmtRp(summary.rpLost, state.lang))),
            h('p', { class: 'small', text: t('verdict.rp.note') }),
          ]
        : null,
      isOk ? h('p', { class: 'small', text: t('verdict.ok.note') }) : null,
      isOk
        ? h('a', { class: 'btn', href: '#bukti', text: t('verdict.tobukti') })
        : h('a', { class: 'btn', href: '#surat', text: t('verdict.toletter') }),
    ),
  );
}

function settingsCard() {
  const { mode, via, auto } = state.settings;
  const modeOptions = Object.keys(MODES).map((name) => ({
    value: name,
    label: t(`tes.mode.${name}`),
    small: t('tes.mode.upto', { mb: whole((MODES[name].downBytes + MODES[name].upBytes) / 1e6) }),
  }));
  const autoOptions = AUTO_CHOICES.map((minutes) => ({
    value: String(minutes),
    label: minutes ? t('tes.auto.min', { n: minutes }) : t('tes.auto.off'),
  }));
  let autoHint = t('tes.auto.hint');
  if (auto > 0) {
    const time = new Date(nextAutoAt()).toLocaleTimeString(state.lang === 'id' ? 'id-ID' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
    autoHint = `${t('tes.auto.next', { time })} ${autoHint}`;
  }
  return h(
    'section',
    { class: 'card settings' },
    segmented(t('tes.mode'), 'mode', mode, modeOptions),
    segmented(
      t('tes.via'),
      'via',
      via,
      [
        { value: 'wifi', label: t('tes.via.wifi') },
        { value: 'lan', label: t('tes.via.lan') },
      ],
      t('tes.via.hint'),
    ),
    segmented(t('tes.auto'), 'auto', String(auto), autoOptions, autoHint),
  );
}

function howDetails() {
  return h(
    'details',
    null,
    h('summary', { text: t('how.title') }),
    h(
      'ul',
      null,
      ['how.1', 'how.2', 'how.3', 'how.4'].map((key) => h('li', { text: t(key) })),
    ),
  );
}

function viewTes() {
  const last = lastTest();
  const summary = core.summarize(state.tests, state.plan);
  const promised = planSpeed();
  const notes = [];
  if (run.error) notes.push(h('p', { class: 'notice', role: 'alert', text: t(run.error) }));
  if (hasSample()) notes.push(h('p', { class: 'notice plain', text: t('tes.sample') }));
  if (!run.active && last && last.conf === 'low') notes.push(h('p', { class: 'notice plain', text: t('tes.lowconf') }));
  if (promised >= 50 && state.settings.mode === 'hemat') {
    notes.push(h('p', { class: 'hint', text: t('tes.fasthint') }));
  }

  const mainButton = run.active
    ? h('button', { type: 'button', class: 'btn primary', 'data-act': 'cancel', 'data-focus': 'main', text: t('tes.cancel') })
    : h('button', {
        type: 'button',
        class: 'btn primary',
        'data-act': 'start',
        'data-focus': 'main',
        text: state.tests.some((test) => !test.sample) ? t('tes.again') : t('tes.start'),
      });

  return [
    h('div', null, h('h1', { text: t('tes.title') }), h('p', { class: 'lead', text: t('tes.lead') })),
    meterCard(),
    mainButton,
    ...notes,
    quickPlanCard(),
    verdictBox(),
    summary.n ? strengthCard(summary.strength) : null,
    settingsCard(),
    howDetails(),
  ];
}

// ---------- Paket ----------

function viewPaket() {
  return [
    h('div', null, h('h1', { text: t('paket.title') }), h('p', { class: 'lead', text: t('paket.lead') })),
    h(
      'section',
      { class: 'card' },
      planField('provider', t('paket.provider'), { list: 'provider-list', autocomplete: 'organization' }),
      planField('name', t('paket.name'), { optional: true }),
      h(
        'div',
        { class: 'two field' },
        planField('mbps', t('paket.mbps'), { inputmode: 'decimal', placeholder: '50' }),
        planField('price', t('paket.price'), { inputmode: 'numeric', placeholder: '350000' }),
      ),
      h('p', { class: 'hint', text: t('paket.upto') }),
      planField('custId', t('paket.custId'), { optional: true }),
      planField('person', t('paket.person'), { autocomplete: 'name' }),
      planField('city', t('paket.city'), { optional: true, autocomplete: 'address-level2' }),
      h(
        'datalist',
        { id: 'provider-list' },
        PROVIDERS.map((name) => h('option', { value: name })),
      ),
    ),
    h('p', { class: 'small', text: t('paket.local') }),
    h('a', { class: 'btn primary', href: '#tes', text: t('paket.next') }),
  ];
}

// ---------- Bukti ----------

function receipt(summary) {
  const plan = state.plan;
  const line = (label, value, extraClass) =>
    h('div', { class: `line${extraClass ? ` ${extraClass}` : ''}` }, h('dt', { text: label }), h('dd', { text: value }));
  const missing = t('bukti.r.noplan');
  const ofTests = (count) => t('bukti.r.ofn', { k: count, n: summary.n });

  const planParts = [];
  if ((plan.name || '').trim()) planParts.push(plan.name.trim());
  if (summary.promised) planParts.push(`${num(summary.promised, 0)} Mbps`);
  if (summary.price) planParts.push(core.fmtRp(summary.price, state.lang));

  const sameDay = core.dayKey(summary.first) === core.dayKey(summary.last);
  const period = sameDay
    ? core.fmtDate(summary.first, state.lang)
    : `${core.fmtDate(summary.first, state.lang)} - ${core.fmtDate(summary.last, state.lang)}`;

  let stamp = h('span', { class: 'stamp none', text: `${t('bukti.r.plan')}: ${missing}` });
  if (summary.verdict) {
    stamp = h('span', {
      class: `stamp${summary.verdict === 'ok' ? ' ok' : ''}`,
      text: t(`verdict.${summary.verdict}`),
    });
  }

  return h(
    'section',
    { class: 'receipt', 'aria-label': t('bukti.receipt') },
    hasSample() ? h('p', { class: 'sample-flag', text: t('bukti.sample.flag') }) : null,
    h('h2', { text: t('bukti.receipt') }),
    h('p', { class: 'sub', text: `Lelet · ${core.fmtStamp(Date.now())}` }),
    h('hr'),
    h(
      'dl',
      null,
      line(t('bukti.r.provider'), (plan.provider || '').trim() || missing),
      line(t('bukti.r.plan'), planParts.join(' · ') || missing),
      line(t('bukti.r.period'), period),
    ),
    h('hr'),
    h(
      'dl',
      null,
      line(t('bukti.r.down'), `${num(summary.down)} Mbps`, 'total'),
      summary.pct !== null ? line(t('bukti.r.pct'), `${whole(summary.pct)}%`) : null,
      line(t('bukti.r.up'), `${num(summary.up)} Mbps`),
      line(t('bukti.r.ping'), `${whole(summary.ping)} ms`),
      line(t('bukti.r.tests'), t('bukti.r.testsval', { n: summary.n, d: summary.days })),
      summary.below50 !== null ? line(t('bukti.r.below50'), ofTests(summary.below50)) : null,
      summary.below80 !== null ? line(t('bukti.r.below80'), ofTests(summary.below80)) : null,
      summary.worstBand
        ? line(t('bukti.r.worst'), `${t(`bukti.band.${summary.worstBand.id}`)} · ${num(summary.worstBand.down)} Mbps`)
        : null,
      line(t('bukti.r.wired'), ofTests(summary.wired)),
      summary.rpLost !== null && summary.verdict !== 'ok'
        ? line(t('bukti.r.rp'), core.fmtRp(summary.rpLost, state.lang))
        : null,
    ),
    h('div', { class: 'stamp-wrap' }, stamp),
    h('hr'),
    h('dl', null, line(t('strength.title'), t(`strength.${summary.strength.level}`).toUpperCase())),
    h('p', { class: 'sub', text: t('bukti.yardstick') }),
  );
}

function testsTable() {
  const rows = [...state.tests].sort((a, b) => b.ts - a.ts);
  const anyLow = rows.some((test) => test.conf === 'low');
  const table = h(
    'table',
    null,
    h(
      'thead',
      null,
      h(
        'tr',
        null,
        h('th', { scope: 'col', text: t('bukti.t.time') }),
        h('th', { scope: 'col', text: t('bukti.t.down') }),
        h('th', { scope: 'col', text: t('bukti.t.up') }),
        h('th', { scope: 'col', text: t('bukti.t.ping') }),
        h('th', { scope: 'col', text: t('bukti.t.via') }),
        h('th', { scope: 'col' }, h('span', { class: 'sr', text: t('bukti.t.del', { when: '' }).trim() })),
      ),
    ),
    h(
      'tbody',
      null,
      rows.map((test) => {
        const when = core.fmtStamp(test.ts);
        const low = test.conf === 'low';
        return h(
          'tr',
          null,
          h('td', { title: when, text: when.slice(5) }),
          h('td', { class: low ? 'low' : null, title: low ? t('bukti.t.low') : null, text: `${low ? '~' : ''}${num(test.down)}` }),
          h('td', { text: num(test.up) }),
          h('td', { text: whole(test.ping) }),
          h('td', { text: test.via === 'lan' ? 'LAN' : 'Wi-Fi' }),
          h(
            'td',
            null,
            h('button', {
              type: 'button',
              class: 'del',
              'data-act': 'del',
              'data-val': String(test.ts),
              'aria-label': t('bukti.t.del', { when }),
              text: '×',
            }),
          ),
        );
      }),
    ),
  );
  return [
    h('h2', { text: `${t('bukti.table')} (${rows.length})` }),
    h('div', { class: 'table-wrap' }, table),
    anyLow ? h('p', { class: 'hint', text: `~ ${t('bukti.t.low')}` }) : null,
  ];
}

function viewBukti() {
  const title = h('h1', { text: t('bukti.title') });
  if (!state.tests.length) {
    return [
      h('div', null, title, h('p', { class: 'lead', text: t('bukti.empty') })),
      h('a', { class: 'btn primary', href: '#tes', text: t('tes.start') }),
      h(
        'div',
        { class: 'row' },
        h('button', { type: 'button', class: 'btn', 'data-act': 'sample', text: t('bukti.sample') }),
        h('button', { type: 'button', class: 'btn quiet', 'data-act': 'import', text: t('bukti.import') }),
      ),
    ];
  }

  const summary = core.summarize(state.tests, state.plan);
  const sampleBanner = hasSample()
    ? h(
        'div',
        { class: 'notice' },
        h('p', { text: t('bukti.sample.banner') }),
        h('button', { type: 'button', class: 'btn quiet', 'data-act': 'sample-remove', text: t('bukti.sample.remove') }),
      )
    : null;
  const nextStep = summary.promised
    ? h('a', { class: 'btn primary', href: '#surat', text: t('verdict.toletter') })
    : h('a', { class: 'btn primary', href: '#paket', text: t('tes.quick.more') });

  return [
    title,
    sampleBanner,
    receipt(summary),
    nextStep,
    strengthCard(summary.strength),
    ...testsTable(),
    h(
      'div',
      { class: 'row' },
      h('button', { type: 'button', class: 'btn quiet', 'data-act': 'csv', text: t('bukti.csv') }),
      h('button', { type: 'button', class: 'btn quiet', 'data-act': 'json', text: t('bukti.json') }),
      h('button', { type: 'button', class: 'btn quiet', 'data-act': 'import', text: t('bukti.import') }),
      h('button', { type: 'button', class: 'btn danger', 'data-act': 'clear', text: t('bukti.clear') }),
    ),
  ];
}

// ---------- Surat ----------

const letterKey = () => `${letter.kind}.${state.lang}`;

function letterText() {
  const edited = letter.edits[letterKey()];
  if (edited !== undefined) return edited;
  const body = core.buildLetter({ plan: state.plan, tests: state.tests, lang: state.lang, kind: letter.kind });
  return body && hasSample() ? `${t('surat.sampletag')}\n\n${body}` : body;
}

const waLink = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;

function viewSurat() {
  const title = h('h1', { text: t('surat.title') });
  if (!state.tests.length) {
    return [
      title,
      h('p', { class: 'notice plain', text: t('surat.need.tests') }),
      h('a', { class: 'btn primary', href: '#tes', text: t('tes.start') }),
    ];
  }
  if (!planSpeed()) {
    return [
      title,
      h('p', { class: 'notice plain', text: t('surat.need.plan') }),
      h('a', { class: 'btn primary', href: '#paket', text: t('tes.quick.more') }),
    ];
  }

  const summary = core.summarize(state.tests, state.plan);
  const warnings = [];
  if (hasSample()) warnings.push(t('surat.warn.sample'));
  if (summary.verdict === 'ok') warnings.push(t('surat.warn.ok'));
  else if (summary.strength.level === 'lemah') warnings.push(t('surat.warn.weak', { n: summary.n, d: summary.days }));

  const text = letterText();
  const isWa = letter.kind === 'wa';
  const copyButton = (primary) =>
    h('button', { type: 'button', class: `btn${primary ? ' primary' : ''}`, 'data-act': 'copy', text: t('surat.copy') });
  const resetButton = h('button', { type: 'button', class: 'btn quiet', 'data-act': 'reset', text: t('surat.reset') });

  const actions = isWa
    ? [
        h('a', {
          class: 'btn primary',
          id: 'wa-link',
          href: waLink(text),
          target: '_blank',
          rel: 'noopener noreferrer',
          text: t('surat.wa'),
        }),
        h('div', { class: 'row' }, copyButton(false), resetButton),
      ]
    : [
        copyButton(true),
        h(
          'div',
          { class: 'row' },
          h('button', { type: 'button', class: 'btn', 'data-act': 'print', text: t('surat.print') }),
          resetButton,
        ),
      ];

  return [
    title,
    ...warnings.map((warning) => h('p', { class: 'notice', text: warning })),
    segmented(t('surat.kind'), 'kind', letter.kind, [
      { value: 'formal', label: t('surat.kind.formal') },
      { value: 'wa', label: t('surat.kind.wa') },
    ]),
    h(
      'label',
      { class: 'field' },
      h('span', { text: t('surat.text') }),
      h('textarea', { class: `letter${isWa ? ' short' : ''}`, id: 'letter-text', spellcheck: 'false', value: text }),
    ),
    ...actions,
    h(
      'section',
      { class: 'card' },
      h('h2', { text: t('surat.where') }),
      h(
        'ol',
        { class: 'where' },
        ['surat.where.1', 'surat.where.2', 'surat.where.3', 'surat.where.4'].map((key) => h('li', { text: t(key) })),
      ),
      h('p', { class: 'hint', text: t('surat.where.note') }),
    ),
    h('p', { class: 'small', text: t('surat.disclaimer') }),
  ];
}

// ---------- render ----------

const VIEWS = { tes: viewTes, paket: viewPaket, bukti: viewBukti, surat: viewSurat };

function focusKey(element) {
  if (!element || !element.dataset) return '';
  if (element.dataset.focus) return `focus:${element.dataset.focus}`;
  if (element.dataset.act) return `act:${element.dataset.act}:${element.dataset.val || ''}`;
  if (element.dataset.plan) return `plan:${element.dataset.plan}`;
  return element.id ? `id:${element.id}` : '';
}

function render() {
  const view = $('#view');
  const keep = view.contains(document.activeElement) ? focusKey(document.activeElement) : '';
  const name = route();
  if (name !== 'tes') {
    quickOpen = false;
    live = null;
  }
  renderChrome();
  view.className = 'stack';
  view.replaceChildren(...VIEWS[name]().filter(Boolean));
  if (keep) {
    const candidates = view.querySelectorAll('[data-focus], [data-act], [data-plan], [id]');
    for (const candidate of candidates) {
      if (focusKey(candidate) === keep) {
        candidate.focus({ preventScroll: true });
        break;
      }
    }
  }
}

// ---------- running a test ----------

function nextAutoAt() {
  const real = state.tests.filter((test) => !test.sample);
  const lastAt = real.length ? real[real.length - 1].ts : 0;
  return Math.max(lastAt, autoSince) + state.settings.auto * 60000;
}

async function startTest() {
  if (run.active) return;
  run.error = '';
  run.note = '';
  if (navigator.onLine === false) {
    run.error = 'tes.err.offline';
    if (route() === 'tes') render();
    return;
  }

  dropSample();
  save();
  const mode = state.settings.mode;
  const via = state.settings.via;
  Object.assign(run, { active: true, ctl: new AbortController(), phase: 'ping', down: null, up: null, frac: 0.02 });
  if (route() === 'tes') render();

  let painting = false;
  const schedulePaint = () => {
    if (painting) return;
    painting = true;
    requestAnimationFrame(() => {
      painting = false;
      if (run.active) paintLive();
    });
  };
  let phaseStartedAt = performance.now();
  const onProgress = (progress) => {
    if (progress.phase !== run.phase) phaseStartedAt = performance.now();
    run.phase = progress.phase;
    const elapsed = performance.now() - phaseStartedAt;
    if (progress.phase === 'down') {
      run.down = progress.mbps;
      const part = Math.max(progress.frac || 0, elapsed / MODES[mode].downMs);
      run.frac = 0.1 + 0.55 * Math.min(1, part);
    } else if (progress.phase === 'up') {
      run.up = progress.mbps;
      run.frac = 0.65 + 0.35 * Math.min(1, progress.frac || 0);
    }
    schedulePaint();
  };

  try {
    const result = await runTest({ base: BASE, mode, signal: run.ctl.signal, onProgress });
    const test = core.sanitizeTest({ ...result, via });
    if (!test) throw new Error('bad-result');
    state.tests = core.mergeTests(state.tests, [test]);
    invalidateLetter();
    save();
  } catch (error) {
    if (error && error.name === 'AbortError') run.note = 'tes.cancelled';
    else if (navigator.onLine === false) run.error = 'tes.err.offline';
    else if (/http-429/.test(String(error && error.message))) run.error = 'tes.err.busy';
    else run.error = 'tes.err.fail';
  } finally {
    run.active = false;
    run.ctl = null;
    if (planSpeed()) quickOpen = false; // the plan is known now; the inline fields have done their job
    if (['tes', 'bukti'].includes(route())) render();
  }
}

// ---------- actions ----------

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = h('a', { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    const area = $('#letter-text');
    if (!area) return false;
    area.focus();
    area.select();
    try {
      return document.execCommand('copy');
    } catch (failure) {
      return false;
    }
  }
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      if (!data || data.app !== 'lelet' || !Array.isArray(data.tests)) throw new Error('not-lelet');
      const incoming = core.mergeTests([], data.tests).filter((test) => !test.sample);
      if (!incoming.length) throw new Error('empty');
      dropSample();
      const before = state.tests.length;
      state.tests = core.mergeTests(state.tests, incoming);
      if (!planSpeed()) {
        state.plan = cleanPlan(data.plan);
        delete state.plan.sample;
      }
      invalidateLetter();
      save();
      render();
      toast(t('bukti.imported', { n: state.tests.length - before }));
    } catch (error) {
      toast(t('bukti.import.bad'));
    }
  };
  reader.onerror = () => toast(t('bukti.import.bad'));
  reader.readAsText(file);
}

const ACTIONS = {
  lang() {
    state.lang = state.lang === 'id' ? 'en' : 'id';
    t = makeT(state.lang);
    save();
    render();
  },
  theme() {
    state.theme = effectiveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = state.theme;
    save();
    renderChrome();
  },
  start() {
    startTest();
  },
  cancel() {
    if (run.ctl) run.ctl.abort();
  },
  mode(value) {
    if (!MODES[value]) return;
    state.settings.mode = value;
    save();
    render();
  },
  via(value) {
    state.settings.via = value === 'lan' ? 'lan' : 'wifi';
    save();
    render();
  },
  auto(value) {
    const minutes = Number(value);
    if (!AUTO_CHOICES.includes(minutes)) return;
    state.settings.auto = minutes;
    autoSince = Date.now();
    save();
    render();
  },
  sample() {
    const sample = core.sampleData();
    const planIsEmpty = !planSpeed() && !(state.plan.provider || '').trim();
    state.tests = core.mergeTests([], sample.tests);
    if (planIsEmpty) state.plan = { ...cleanPlan(sample.plan), sample: true };
    invalidateLetter();
    save();
    render();
  },
  'sample-remove'() {
    dropSample();
    invalidateLetter();
    save();
    render();
  },
  del(value) {
    state.tests = state.tests.filter((test) => String(test.ts) !== value);
    if (!state.tests.length && state.plan.sample) state.plan = emptyPlan();
    invalidateLetter();
    save();
    render();
    toast(t('bukti.deleted'));
  },
  csv() {
    download(`lelet-${core.dayKey(Date.now())}.csv`, core.toCSV(state.tests), 'text/csv;charset=utf-8');
  },
  json() {
    const plan = { ...state.plan };
    delete plan.sample;
    const backup = { app: 'lelet', v: 1, exported: new Date().toISOString(), plan, tests: state.tests };
    download(`lelet-${core.dayKey(Date.now())}.json`, JSON.stringify(backup, null, 2), 'application/json');
  },
  import() {
    const input = $('#import-file');
    input.value = '';
    input.click();
  },
  clear() {
    if (!window.confirm(t('bukti.clear.ask'))) return;
    state.tests = [];
    if (state.plan.sample) state.plan = emptyPlan();
    invalidateLetter();
    save();
    render();
  },
  kind(value) {
    letter.kind = value === 'wa' ? 'wa' : 'formal';
    render();
  },
  async copy() {
    const done = await copyText(letterText());
    if (done) toast(t('surat.copied'));
  },
  print() {
    $('#print-letter').textContent = letterText();
    window.print();
  },
  reset() {
    delete letter.edits[letterKey()];
    render();
  },
};

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-act]');
  if (!target) return;
  const action = ACTIONS[target.dataset.act];
  if (action) action(target.dataset.val);
});

document.addEventListener('input', (event) => {
  const target = event.target;
  if (target.dataset && target.dataset.plan) {
    const field = target.dataset.plan;
    let value = target.value.slice(0, 80);
    if (field === 'mbps') value = normalizeNumber(value);
    if (field === 'price') value = value.replace(/\D/g, '');
    state.plan[field] = value;
    delete state.plan.sample;
    invalidateLetter();
    save();
    if (route() === 'tes' && live) {
      // update what depends on the plan without rebuilding the fields being typed in
      const last = lastTest();
      fillPromise(live.promise, run.active ? run.down : last ? last.down : null);
      const verdict = $('#sec-verdict');
      if (verdict) fillVerdict(verdict);
    }
    return;
  }
  if (target.id === 'letter-text') {
    letter.edits[letterKey()] = target.value;
    const link = $('#wa-link');
    if (link) link.setAttribute('href', waLink(target.value));
  }
});

$('#import-file').addEventListener('change', (event) => {
  const file = event.target.files && event.target.files[0];
  if (file) importBackup(file);
});

window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0, 0);
  $('#view').focus({ preventScroll: true });
});

if (window.matchMedia) {
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  if (systemDark.addEventListener) systemDark.addEventListener('change', renderChrome);
}

// Repeat automatically: only while this page is open and visible.
setInterval(() => {
  if (!state.settings.auto || run.active) return;
  if (document.visibilityState !== 'visible') return;
  if (Date.now() >= nextAutoAt()) startTest();
}, 20000);

if (location.protocol === 'https:' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {
    // offline support is optional
  });
}

render();
