/* i-Study – generic multi-subject study PWA. Vanilla JS, no dependencies, works offline.
   Built-in content: content/index.json → content/<subject>/<chapter>.json
   Personal content: imported in the app (localStorage). See docs/CONTENT-FORMAT.md */
(function () {
'use strict';

/* ---------------------------------------------------------------- state */
const KEY = 'istudy.v1', UKEY = 'istudy.user.v1';
const defaults = { ch: '', lang: 'dual', theme: 'auto', read: {}, cards: {}, q: {}, sa: {}, exams: [], day: {}, goal: 20 };
const S = Object.assign({}, defaults);
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); return true; } catch (e) { return false; } };
const today = () => new Date().toISOString().slice(0, 10);
const DAY = 86400000;
const bump = (n) => { const d = today(); S.day[d] = (S.day[d] || 0) + (n || 1); save(); };

/* -------------------------------------------------------------- content */
const LIB = { subjects: [] };
const CH = () => LIB.subjects.flatMap(s => s.chapters);
const curCh = () => CH().find(c => c.uid === S.ch) || CH()[0];
function scopeOf(c) { // whole-subject pseudo chapter (mixed practice / exam across chapters)
  const sj = c.subj, cs = sj.chapters;
  return { uid: sj.id + '.*', pseudo: true, subj: sj, title: sj.name, standard: sj.code, sections: cs.flatMap(x => x.sections), cards: cs.flatMap(x => x.cards), quiz: cs.flatMap(x => x.quiz), essay: cs.flatMap(x => x.essay), glossary: cs.flatMap(x => x.glossary), flows: [], tools: [] };
}
function fillLang(x) { // a field with only "en" or only "ms" is shown in both languages
  if (Array.isArray(x)) { x.forEach(fillLang); return; }
  if (x && typeof x === 'object') {
    if ('en' in x || 'ms' in x) { if (!('ms' in x)) x.ms = x.en; if (!('en' in x)) x.en = x.ms; }
    Object.values(x).forEach(fillLang);
  }
}
function normalize(ch, subj, builtin) {
  fillLang(ch);
  ch.uid = subj.id + '.' + ch.id; ch.subj = subj; ch.builtin = builtin;
  const pre = ch.uid + ':';
  ch.sections = (ch.sections || []).map(s => Object.assign({ icon: '📘', ref: '', blocks: [] }, s, { id: pre + s.id }));
  ['cards', 'quiz', 'essay'].forEach(k => { ch[k] = (ch[k] || []).map(x => Object.assign({}, x, { id: pre + x.id, t: pre + x.t })); });
  ch.glossary = ch.glossary || []; ch.flows = ch.flows || []; ch.standard = ch.standard || '';
  ch.num = typeof ch.num === 'number' ? ch.num : 999;
  if (!ch.tools) ch.tools = ch.flows.map(f => 'flow:' + f.id).concat(ch.glossary.length ? ['gloss'] : []);
  return ch;
}
function addChapter(subj, raw, builtin) {
  const ch = normalize(raw, subj, builtin);
  if (CH().some(x => x.uid === ch.uid)) return null;
  subj.chapters.push(ch); subj.chapters.sort((a, b) => a.num - b.num || String(a.title.en).localeCompare(b.title.en));
  return ch;
}
function getSubject(info, builtin) {
  let sj = LIB.subjects.find(s => s.id === info.id);
  if (!sj) { sj = { id: info.id, code: info.code, name: info.name, info: info.info || null, builtin: !!builtin, chapters: [] }; fillLang(sj.name); LIB.subjects.push(sj); }
  return sj;
}
const userStore = () => { try { const o = JSON.parse(localStorage.getItem(UKEY) || '{}'); return Array.isArray(o.chapters) ? o.chapters : []; } catch (e) { return []; } };
const setUserStore = (arr) => { try { localStorage.setItem(UKEY, JSON.stringify({ chapters: arr })); return true; } catch (e) { return false; } };
async function loadLib() {
  const j = async (p) => { const r = await fetch(p); if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); };
  const idx = await j('content/index.json');
  for (const sj of idx.subjects) {
    const subj = getSubject(sj, true);
    const raws = await Promise.all(sj.chapters.map(f => j('content/' + f)));
    raws.forEach(r => addChapter(subj, r, true));
  }
  userStore().forEach(raw => { try { addChapter(getSubject(raw.subject, false), JSON.parse(JSON.stringify(raw)), false); } catch (e) {} });
}

/* ----------------------------------------------------------- validation */
const KINDS = { p: 's', h: 's', tip: 's', note: 's', ex: 's', calc: 's', ul: 'a', flow: 'a', table: 't', je: 'j' };
const ID_RE = /^[a-z0-9][a-z0-9-]{0,23}$/;
function validate(o) {
  const E = [], err = (p, m) => E.push(p + ': ' + m);
  const isO = (x) => x && typeof x === 'object' && !Array.isArray(x);
  const str = (x) => typeof x === 'string' && x.trim() !== '';
  const arr = (x) => Array.isArray(x) && x.length > 0 && x.every(str);
  const bi = (x, p, kind) => {
    if (!isO(x)) return err(p, 'must be an object like {"en": "...", "ms": "..."}');
    const ok = kind === 'a' ? arr : str, what = kind === 'a' ? 'a non-empty array of strings' : 'a non-empty string';
    if (!ok(x.en)) err(p + '.en', 'must be ' + what);
    if ('ms' in x && !ok(x.ms)) err(p + '.ms', 'must be ' + what + ' (or omit "ms")');
    if (kind === 'a' && Array.isArray(x.en) && Array.isArray(x.ms) && x.en.length !== x.ms.length) err(p, '"en" and "ms" arrays must have the same length');
  };
  if (!isO(o)) return ['Top level must be a JSON object (one chapter).'];
  if (!isO(o.subject)) err('subject', 'required: {"id","code","name":{"en","ms"}}');
  else {
    if (!ID_RE.test(o.subject.id || '')) err('subject.id', 'lowercase letters, digits, hyphen; 1–24 chars (e.g. "far2")');
    if (!str(o.subject.code)) err('subject.code', 'required short code, e.g. "FAR2"');
    bi(o.subject.name, 'subject.name');
  }
  if (!ID_RE.test(o.id || '')) err('id', 'lowercase letters, digits, hyphen; 1–24 chars (e.g. "ch6")');
  bi(o.title, 'title');
  if (o.num !== undefined && typeof o.num !== 'number') err('num', 'must be a number');
  if (!Array.isArray(o.sections) || !o.sections.length) err('sections', 'required: non-empty array');
  const secIds = new Set();
  (o.sections || []).forEach((s, i) => {
    const p = 'sections[' + i + ']';
    if (!isO(s)) return err(p, 'must be an object');
    if (!ID_RE.test(s.id || '')) err(p + '.id', 'lowercase letters, digits, hyphen'); else if (secIds.has(s.id)) err(p + '.id', 'duplicate "' + s.id + '"'); else secIds.add(s.id);
    bi(s.title, p + '.title'); if (s.big !== undefined) bi(s.big, p + '.big');
    if (!Array.isArray(s.blocks) || !s.blocks.length) return err(p + '.blocks', 'required: non-empty array');
    s.blocks.forEach((b, j) => {
      const q = p + '.blocks[' + j + ']';
      if (!isO(b) || !(b.k in KINDS)) return err(q + '.k', 'must be one of: ' + Object.keys(KINDS).join(', '));
      const kind = KINDS[b.k];
      if (kind === 's' || kind === 'a') bi(b, q, kind);
      else if (kind === 'j') {
        if (!str(b.title)) err(q + '.title', 'required string');
        if (!Array.isArray(b.lines) || !b.lines.length || !b.lines.every(l => Array.isArray(l) && l.length === 3 && (l[0] === 'Dr' || l[0] === 'Cr') && str(l[1]) && str(String(l[2])))) err(q + '.lines', 'array of ["Dr"|"Cr", "Account", "Amount"]');
      } else {
        const cells = (x) => Array.isArray(x) && x.length > 0 && x.every(c => typeof c === 'string');
        if (!isO(b.head) || !cells(b.head.en)) return err(q + '.head', 'required: {"en":[...],"ms":[...]} (array of strings; a cell may be empty)');
        if (!Array.isArray(b.rows) || !b.rows.length) return err(q + '.rows', 'required: non-empty array of {"en":[...],"ms":[...]}');
        b.rows.forEach((r, k) => { if (!isO(r) || !cells(r.en) || r.en.length !== b.head.en.length) err(q + '.rows[' + k + ']', 'must have "en" array with ' + b.head.en.length + ' cells (same as head)'); else if (r.ms && r.ms.length !== b.head.en.length) err(q + '.rows[' + k + '].ms', 'must have ' + b.head.en.length + ' cells'); });
        if (b.head.ms && b.head.ms.length !== b.head.en.length) err(q + '.head.ms', 'must have the same length as head.en');
      }
    });
  });
  const uniq = (list, name, fn) => { const ids = new Set(); (list || []).forEach((x, i) => { const p = name + '[' + i + ']'; if (!isO(x)) return err(p, 'must be an object'); if (!str(x.id)) err(p + '.id', 'required string'); else if (ids.has(x.id)) err(p + '.id', 'duplicate "' + x.id + '"'); else ids.add(x.id); if (!secIds.has(x.t)) err(p + '.t', '"' + x.t + '" is not a section id'); fn(x, p); }); };
  if (o.cards !== undefined && !Array.isArray(o.cards)) err('cards', 'must be an array');
  if (o.quiz !== undefined && !Array.isArray(o.quiz)) err('quiz', 'must be an array');
  if (o.essay !== undefined && !Array.isArray(o.essay)) err('essay', 'must be an array');
  uniq(Array.isArray(o.cards) ? o.cards : [], 'cards', (x, p) => { bi(x.q, p + '.q'); bi(x.a, p + '.a'); });
  uniq(Array.isArray(o.quiz) ? o.quiz : [], 'quiz', (x, p) => {
    bi(x.q, p + '.q'); bi(x.e, p + '.e');
    if (!Array.isArray(x.o) || x.o.length < 2 || x.o.length > 6 || !x.o.every(str)) err(p + '.o', 'array of 2–6 non-empty strings');
    else if (!Number.isInteger(x.a) || x.a < 0 || x.a >= x.o.length) err(p + '.a', 'must be an integer index into "o" (0–' + (x.o.length - 1) + ')');
  });
  uniq(Array.isArray(o.essay) ? o.essay : [], 'essay', (x, p) => { bi(x.q, p + '.q'); bi(x.pts, p + '.pts', 'a'); if (typeof x.marks !== 'number' || x.marks <= 0) err(p + '.marks', 'must be a positive number'); });
  if (o.glossary !== undefined && !(Array.isArray(o.glossary) && o.glossary.every(g => Array.isArray(g) && g.length === 2 && str(g[0]) && str(g[1])))) err('glossary', 'array of ["English term", "Malay term"] pairs');
  if (o.flows !== undefined) {
    if (!Array.isArray(o.flows)) err('flows', 'must be an array');
    else o.flows.forEach((f, i) => {
      const p = 'flows[' + i + ']';
      if (!isO(f) || !ID_RE.test(f.id || '')) return err(p + '.id', 'lowercase id required');
      bi(f.title, p + '.title');
      if (!isO(f.nodes) || !isO(f.results) || !f.nodes[f.start]) return err(p, 'needs "start" (a node id), "nodes" and "results" objects');
      Object.entries(f.nodes).forEach(([k, n]) => { bi(n.q, p + '.nodes.' + k + '.q'); ['y', 'n'].forEach(w => { if (!(n[w] in f.nodes || n[w] in f.results)) err(p + '.nodes.' + k + '.' + w, '"' + n[w] + '" is not a node or result id'); }); });
      Object.entries(f.results).forEach(([k, r]) => { bi(r.t, p + '.results.' + k + '.t'); bi(r.d, p + '.results.' + k + '.d'); if (!['good', 'warn', 'info'].includes(r.c)) err(p + '.results.' + k + '.c', 'must be "good", "warn" or "info"'); });
    });
  }
  return E;
}

/* ----------------------------------------------------------------- i18n */
const UI = {
  home: { en: 'Home', ms: 'Utama' }, notes: { en: 'Notes', ms: 'Nota' }, cards: { en: 'Cards', ms: 'Kad' },
  quiz: { en: 'Quiz', ms: 'Kuiz' }, tools: { en: 'Tools', ms: 'Alat' }, exam: { en: 'Exam mode', ms: 'Mod exam' },
  start: { en: 'Start', ms: 'Mula' }, next: { en: 'Next', ms: 'Seterusnya' },
  show: { en: 'Show answer', ms: 'Tunjuk jawapan' }, again: { en: 'Forgot', ms: 'Lupa' }, hard: { en: 'Hard', ms: 'Susah' },
  good: { en: 'Got it', ms: 'Ingat' }, easy: { en: 'Easy', ms: 'Senang' }, due: { en: 'due today', ms: 'perlu ulang kaji hari ini' },
  correct: { en: 'Correct!', ms: 'Betul!' }, wrong: { en: 'Not quite', ms: 'Belum tepat' },
  marks: { en: 'marks', ms: 'markah' }, restart: { en: 'Try again', ms: 'Cuba lagi' },
  finish: { en: 'Finish', ms: 'Tamat' }, mark: { en: 'Mark as read', ms: 'Tanda sudah baca' }, read: { en: 'Read', ms: 'Sudah baca' },
  back: { en: 'Back', ms: 'Kembali' }, lib: { en: 'Library', ms: 'Pustaka' }
};
const u = (k) => { const x = UI[k]; return S.lang === 'en' ? x.en : S.lang === 'ms' ? x.ms : x.ms + ' · ' + x.en; };
const md = (s) => String(s == null ? '' : s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/* bilingual block: {en, ms} → html according to language mode */
function B(o, tag) {
  tag = tag || 'div';
  if (!o) return '';
  const en = `<${tag} class="en">${md(o.en)}</${tag}>`, ms = `<${tag} class="ms">${md(o.ms)}</${tag}>`;
  return S.lang === 'en' || (S.lang === 'dual' && same(o.en, o.ms)) ? en : S.lang === 'ms' ? ms : en + ms;
}
function BL(o) { // bilingual list
  if (!o) return '';
  const f = (l) => '<ul>' + l.map(i => '<li>' + md(i) + '</li>').join('') + '</ul>';
  const en = `<div class="en">${f(o.en)}</div>`, ms = `<div class="ms">${f(o.ms)}</div>`;
  return S.lang === 'en' || (S.lang === 'dual' && same(o.en, o.ms)) ? en : S.lang === 'ms' ? ms : en + ms;
}
const T = (en, ms) => S.lang === 'en' ? en : S.lang === 'ms' ? ms : ms + ' · ' + en; // short inline label
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = (s, r) => (r || document).querySelector(s);
const view = () => $('#view');
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fmt = (n) => Math.round(n).toLocaleString('en-MY');
const topicName = (c, id) => { const s = c.sections.find(x => x.id === id); return s ? s.title : { en: id, ms: id }; };

/* ------------------------------------------------------- tools registry */
const TOOLDEF = {
  calc: { icon: '🧮', href: 'calc', t: { en: 'Cost vs FV calculator', ms: 'Kalkulator Kos vs FV' }, sub: { en: 'Journals + carrying amounts', ms: 'Jurnal + amaun dibawa' } },
  calc5: { icon: '🧮', href: 'calc5', t: { en: 'FVLCTS calculator', ms: 'Kalkulator FVLCTS' }, sub: { en: 'Journals: buy → year-end → harvest', ms: 'Jurnal: beli → hujung tahun → tuai' } },
  transfer: { icon: '🔄', href: 'transfer', t: { en: 'Transfer helper', ms: 'Pembantu pemindahan' }, sub: { en: 'Any from → to', ms: 'Mana-mana dari → ke' } },
  gloss: { icon: '📖', href: 'gloss', t: { en: 'EN–BM glossary', ms: 'Glosari EN–BM' }, sub: { en: 'Self-test mode', ms: 'Mod uji diri' } }
};
const flowsOf = (c) => c.flows || [];
function toolList(c) {
  return (c.tools || []).map(id => {
    if (id.startsWith('flow:')) { const f = flowsOf(c).find(x => x.id === id.slice(5)); return f && { icon: f.icon || '🧭', href: 'flow/' + f.id, t: f.title, sub: f.sub || { en: '', ms: '' } }; }
    const d = TOOLDEF[id]; return d && (id === 'gloss' || (window.IS_TOOLS && window.IS_TOOLS[id])) ? d : null;
  }).filter(Boolean);
}
const toolTile = (t, sub) => `<a class="tile" href="#/tools/${t.href}">${t.icon}<b>${B(t.t, 'span')}</b>${sub && t.sub ? `<small>${S.lang === 'ms' ? t.sub.ms : t.sub.en}</small>` : ''}</a>`;

/* --------------------------------------------------------------- router */
const routes = {};
function go(path) { location.hash = '#' + path; }
function render() {
  const p = (location.hash.slice(1) || '/home').split('/').filter(Boolean);
  const r = routes[p[0]] || routes.home;
  document.body.dataset.route = p[0] || 'home';
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.dataset.r === (p[0] === 'exam' ? 'quiz' : p[0])));
  const v = view(); v.innerHTML = '';
  if (!CH().length && p[0] !== 'lib') { go('/lib'); return; }
  r(v, p.slice(1).map(decodeURIComponent));
  window.scrollTo(0, 0);
  document.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === S.lang));
  fillChapterSelect();
  const lbl = document.getElementById('navlabels');
  if (lbl) lbl.querySelectorAll('[data-k]').forEach(a => a.innerHTML = u(a.dataset.k));
}
function fillChapterSelect() {
  const cs = $('#chsel'); if (!cs) return;
  cs.innerHTML = LIB.subjects.map(s => `<optgroup label="${esc(s.code)} · ${esc(s.name.en)}">${s.chapters.map(c => `<option value="${esc(c.uid)}">${c.num < 999 ? 'Ch ' + c.num + ' · ' : ''}${esc(c.title.en)}</option>`).join('')}</optgroup>`).join('');
  const c = curCh(); if (c) cs.value = c.uid;
}

/* ----------------------------------------------------------- SRS helpers */
const INTERVALS = [0, 1, 2, 4, 8, 16, 32];
function cardState(id) { return S.cards[id] || { box: 0, due: 0 }; }
function dueCards(c) {
  const now = Date.now();
  const all = c.cards;
  const due = all.filter(k => { const s = S.cards[k.id]; return s && s.due <= now; });
  const fresh = all.filter(k => !S.cards[k.id]);
  return { due, fresh, all };
}
function grade(id, g) { // g: 0 forgot,1 hard,2 good,3 easy
  const s = cardState(id);
  if (g === 0) s.box = 0; else if (g === 1) s.box = Math.max(1, s.box); else if (g === 2) s.box = Math.min(6, s.box + 1); else s.box = Math.min(6, s.box + 2);
  s.due = g === 0 ? Date.now() + 60000 : Date.now() + INTERVALS[s.box] * DAY;
  S.cards[id] = s; bump(1);
}
function mastery(c) {
  const k = c.cards.length; if (!k) return 0;
  return Math.round(c.cards.reduce((a, x) => a + Math.min(cardState(x.id).box, 4) / 4, 0) / k * 100);
}
function quizAcc(c) {
  let ok = 0, tot = 0;
  c.quiz.forEach(q => { const s = S.q[q.id]; if (s) { ok += s.ok; tot += s.ok + s.bad; } });
  return tot ? Math.round(ok / tot * 100) : null;
}
function weakTopics(c) {
  const m = {};
  c.quiz.forEach(q => { const s = S.q[q.id]; if (s) { m[q.t] = m[q.t] || { ok: 0, bad: 0 }; m[q.t].ok += s.ok; m[q.t].bad += s.bad; } });
  return Object.entries(m).filter(([, v]) => v.bad > 0).map(([t, v]) => ({ t, r: v.ok / (v.ok + v.bad) })).sort((a, b) => a.r - b.r).slice(0, 3);
}
function streak() {
  let n = 0, d = new Date();
  if (!S.day[today()]) d = new Date(Date.now() - DAY);
  while (S.day[d.toISOString().slice(0, 10)]) { n++; d = new Date(d.getTime() - DAY); }
  return n;
}

/* ------------------------------------------------------------------ HOME */
routes.home = function (v) {
  const c = curCh();
  const { due, fresh } = dueCards(c);
  const readN = c.sections.filter(s => S.read[s.id]).length;
  const acc = quizAcc(c), weak = weakTopics(c);
  const todayN = S.day[today()] || 0;
  const others = c.subj.chapters;
  v.innerHTML = `
  <section class="hero">
    <div class="eyebrow">${esc(c.subj.code)}${c.standard ? ' · ' + esc(c.standard) : ''}</div>
    <h1>${B(c.title, 'span')}</h1>
    <p class="muted">${T('Study in two languages, answer in English.', 'Belajar dwibahasa, jawab dalam English.')}</p>
    <div class="stats">
      <div class="stat"><b>${streak()}</b><span>🔥 ${S.lang === 'en' ? 'day streak' : 'hari berturut'}</span></div>
      <div class="stat"><b>${todayN}<small>/${S.goal}</small></b><span>${S.lang === 'en' ? 'today' : 'hari ini'}</span></div>
      <div class="stat"><b>${acc === null ? '–' : acc + '%'}</b><span>${S.lang === 'en' ? 'quiz accuracy' : 'ketepatan kuiz'}</span></div>
    </div>
  </section>

  <section class="card">
    <h2>${S.lang === 'en' ? 'Today' : 'Hari ini'}</h2>
    <div class="row"><div><b>${due.length}</b> ${u('due')}<br><small class="muted">+ ${fresh.length} ${S.lang === 'en' ? 'new cards' : 'kad baru'}</small></div>
    <a class="btn" href="#/cards/all">${u('cards')} →</a></div>
    <div class="bar"><i style="width:${mastery(c)}%"></i></div><small class="muted">${S.lang === 'en' ? 'Card mastery' : 'Penguasaan kad'} ${mastery(c)}%</small>
    <hr>
    <div class="row"><div><b>${readN}/${c.sections.length}</b> ${S.lang === 'en' ? 'sections read' : 'seksyen sudah dibaca'}</div><a class="btn ghost" href="#/notes">${u('notes')} →</a></div>
    <div class="bar"><i style="width:${readN / Math.max(1, c.sections.length) * 100}%"></i></div>
    ${weak.length ? `<hr><div><b>${S.lang === 'en' ? 'Weak topics' : 'Topik lemah'}:</b> ${weak.map(w => `<a class="chip warn" href="#/quiz/run/${encodeURIComponent(w.t)}">${esc(topicName(c, w.t)[S.lang === 'ms' ? 'ms' : 'en'])}</a>`).join(' ')}</div>` : ''}
  </section>

  ${c.outcomes ? `<section class="card"><h2>${S.lang === 'en' ? 'Learning outcomes' : 'Hasil pembelajaran'}</h2>${BL(c.outcomes)}</section>` : ''}

  <section class="card">
    <h2>${S.lang === 'en' ? 'Suggested study plan' : 'Cadangan pelan belajar'}</h2>
    <ol class="plan">
      <li><b>${T('Read', 'Baca')}</b> – ${T('Notes in dual mode, 1–2 sections per sitting', 'Nota dalam mod dwibahasa, 1–2 seksyen setiap kali')}</li>
      <li><b>${T('Recall', 'Ingat')}</b> – ${T('Flashcards daily (spaced repetition)', 'Kad ingatan setiap hari (ulangan berjarak)')}</li>
      <li><b>${T('Practise', 'Latih')}</b> – ${T('Quiz by topic and use the Tools tab', 'Kuiz ikut topik dan guna tab Alat')}</li>
      <li><b>${T('Test', 'Uji')}</b> – ${T('Switch to English only, then Exam mode + essay questions', 'Tukar ke English sahaja, kemudian Mod exam + soalan esei')}</li>
    </ol>
  </section>

  ${toolList(c).length ? `<section class="card"><h2>${S.lang === 'en' ? 'Quick tools' : 'Alat pantas'}</h2><div class="grid2">${toolList(c).map(t => toolTile(t, false)).join('')}</div></section>` : ''}

  ${coursePlan(c)}
  <section class="card">
    <h2>${esc(c.subj.code)} · ${S.lang === 'ms' ? esc(c.subj.name.ms) : esc(c.subj.name.en)}</h2>
    <div class="chips">${others.map(x => `<a class="chip ${x.uid === c.uid ? 'sel' : ''}" href="#/home" data-ch="${esc(x.uid)}">${x.num < 999 ? 'Ch ' + x.num + ' · ' : ''}${esc(S.lang === 'ms' ? x.title.ms : x.title.en)}</a>`).join('')}<a class="chip" href="#/lib">＋ ${T('Add / manage', 'Tambah / urus')}</a></div>
  </section>`;
  v.querySelectorAll('[data-ch]').forEach(a => a.onclick = (e) => { e.preventDefault(); S.ch = a.dataset.ch; save(); render(); });
};

function coursePlan(c) {
  const I = c.subj.info; if (!I) return '';
  const have = (id) => c.subj.chapters.find(x => x.id === id);
  const as = (I.assessment || []).map(x => `<div class="row"><span>${B(x.t, 'span')}</span><b>${x.pct}%</b></div><div class="bar"><i style="width:${x.pct}%"></i></div>`).join('');
  const plan = (I.plan || []).map(w => {
    const ch = w.ch && have(w.ch);
    const st = w.brk ? '' : ch ? `<a class="chip ${ch.uid === c.uid ? 'sel' : ''}" href="#/home" data-ch="${esc(ch.uid)}">Ch ${ch.num}</a>` : `<span class="muted"><small>${T('not added yet', 'belum ditambah')}</small></span>`;
    return `<div class="plan-row ${w.brk ? 'brk' : ''}"><b class="wk">${T('Wk', 'Mgg')} ${esc(w.wk)}</b><span class="grow">${B(w.t, 'span')}</span>${st}</div>`;
  }).join('');
  return `<section class="card"><h2>📅 ${T('Course plan', 'Pelan kursus')}</h2>${as ? `<h3>${T('Assessment', 'Penilaian')}</h3>${as}` : ''}${plan ? `<h3>${T('Weekly topics', 'Topik mingguan')}</h3>${plan}` : ''}</section>`;
}

/* ----------------------------------------------------------------- NOTES */
function renderBlock(b) {
  switch (b.k) {
    case 'p': return `<div class="blk">${B(b)}</div>`;
    case 'h': return `<h3>${B(b, 'span')}</h3>`;
    case 'ul': return `<div class="blk">${BL(b)}</div>`;
    case 'tip': return `<div class="callout tip"><span class="ico">💡</span><div>${B(b)}</div></div>`;
    case 'note': return `<div class="callout note"><span class="ico">ℹ️</span><div>${B(b)}</div></div>`;
    case 'ex': return `<div class="callout ex"><span class="ico">📌</span><div>${B(b)}</div></div>`;
    case 'calc': return `<div class="callout calc"><span class="ico">🧮</span><div>${B(b)}</div></div>`;
    case 'flow': {
      const n = S.lang === 'en' ? b.en : S.lang === 'ms' ? b.ms : null;
      const mk = (l) => `<ol class="steps">${l.map(i => `<li>${md(i)}</li>`).join('')}</ol>`;
      return n ? `<div class="blk">${mk(n)}</div>` : `<div class="blk en">${mk(b.en)}</div><div class="blk ms">${mk(b.ms)}</div>`;
    }
    case 'je': return `<div class="je"><div class="jt">${esc(b.title)}</div>${b.lines.map(l => `<div class="jl ${l[0] === 'Cr' ? 'cr' : ''}"><span>${l[0]}</span><span>${esc(l[1])}</span><span>${l[2]}</span></div>`).join('')}</div>`;
    case 'table': {
      const mkT = (L) => `<div class="tw"><table><thead><tr>${b.head[L].map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r => `<tr>${r[L].map((c, i) => `<${i ? 'td' : 'th'}>${esc(c)}</${i ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      return S.lang === 'en' ? mkT('en') : S.lang === 'ms' ? mkT('ms') : `<div class="en">${mkT('en')}</div><div class="ms">${mkT('ms')}</div>`;
    }
  }
  return '';
}
routes.notes = function (v, a) {
  const c = curCh();
  if (!a[0]) {
    v.innerHTML = `<h1>${u('notes')}</h1><p class="muted">${esc(c.subj.code)}${c.standard ? ' · ' + esc(c.standard) : ''} · ${S.lang === 'en' ? 'tap a section' : 'pilih seksyen'}</p>
    <div class="list">${c.sections.map((s, i) => `<a class="item" href="#/notes/${encodeURIComponent(s.id)}"><span class="ico">${s.icon}</span><span class="grow"><b>${i + 1}. ${esc(S.lang === 'ms' ? s.title.ms : s.title.en)}</b>${S.lang === 'dual' ? `<small class="muted">${esc(s.title.ms)}</small>` : ''}${s.ref ? `<small class="muted">${esc(s.ref)}</small>` : ''}</span><span class="tick">${S.read[s.id] ? '✓' : ''}</span></a>`).join('')}</div>
    <input class="search" id="ns" type="search" placeholder="${S.lang === 'en' ? 'Search notes…' : 'Cari nota…'}"><div id="nres"></div>`;
    $('#ns').addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase(); const out = $('#nres'); if (q.length < 2) { out.innerHTML = ''; return; }
      const hits = c.sections.filter(s => JSON.stringify(s).toLowerCase().includes(q));
      out.innerHTML = hits.length ? `<div class="list">${hits.map(s => `<a class="item" href="#/notes/${encodeURIComponent(s.id)}"><span class="ico">${s.icon}</span><span class="grow"><b>${esc(s.title.en)}</b><small class="muted">${esc(s.title.ms)}</small></span></a>`).join('')}</div>` : `<p class="muted">–</p>`;
    });
    return;
  }
  const i = c.sections.findIndex(s => s.id === a[0]); const s = c.sections[i]; if (!s) return go('/notes');
  const prev = c.sections[i - 1], next = c.sections[i + 1];
  v.innerHTML = `<a class="back" href="#/notes">← ${u('notes')}</a>
  <div class="eyebrow">${i + 1} / ${c.sections.length}${s.ref ? ' · ' + esc(s.ref) : ''}</div>
  <h1>${s.icon} ${B(s.title, 'span')}</h1>
  ${s.big ? `<div class="big">${B(s.big)}</div>` : ''}
  ${s.blocks.map(renderBlock).join('')}
  <div class="actions">
    <button class="btn ${S.read[s.id] ? 'ghost' : ''}" id="rd">${S.read[s.id] ? '✓ ' + u('read') : u('mark')}</button>
    <a class="btn ghost" href="#/quiz/run/${encodeURIComponent(s.id)}">${u('quiz')} →</a>
  </div>
  <div class="pager">${prev ? `<a href="#/notes/${encodeURIComponent(prev.id)}">← ${esc(prev.title.en)}</a>` : '<span></span>'}${next ? `<a href="#/notes/${encodeURIComponent(next.id)}">${esc(next.title.en)} →</a>` : '<span></span>'}</div>`;
  $('#rd').onclick = () => { S.read[s.id] = !S.read[s.id]; if (S.read[s.id]) bump(1); save(); render(); };
};

/* ----------------------------------------------------------------- CARDS */
routes.cards = function (v, a) {
  const c0 = curCh(), whole = a[0] === 'sall', c = whole ? scopeOf(c0) : c0;
  if (a[0] !== 'all' && a[0] !== 'topic' && !whole) {
    const { due, fresh } = dueCards(c);
    const ds = c0.subj.chapters.length > 1 ? dueCards(scopeOf(c0)) : null;
    v.innerHTML = `<h1>${u('cards')}</h1>
    <div class="card"><div class="row"><div><b>${due.length}</b> ${u('due')}<br><small class="muted">${fresh.length} ${S.lang === 'en' ? 'new' : 'baru'} · ${c.cards.length} ${S.lang === 'en' ? 'total' : 'jumlah'}</small></div>
    <a class="btn" href="#/cards/all">${u('start')}</a></div></div>
    ${ds ? `<div class="card"><div class="row"><div><b>${T('Whole subject', 'Seluruh subjek')}</b><br><small class="muted">${ds.due.length} ${u('due')} · ${ds.all.length} ${S.lang === 'en' ? 'total' : 'jumlah'}</small></div><a class="btn ghost" href="#/cards/sall">${u('start')}</a></div></div>` : ''}
    <h3>${S.lang === 'en' ? 'By topic' : 'Ikut topik'}</h3><div class="chips">${c.sections.filter(s => c.cards.some(k => k.t === s.id)).map(s => `<a class="chip" href="#/cards/topic/${encodeURIComponent(s.id)}">${s.icon} ${esc(S.lang === 'ms' ? s.title.ms : s.title.en)} <small>${c.cards.filter(k => k.t === s.id).length}</small></a>`).join('')}</div>
    <p class="muted"><small>${S.lang === 'en' ? 'Spaced repetition: cards you know come back later; cards you forget come back soon.' : 'Ulangan berjarak: kad yang anda ingat datang semula lebih lambat; kad yang lupa datang cepat.'}</small></p>`;
    return;
  }
  let deck;
  if (a[0] === 'topic') deck = c.cards.filter(k => k.t === a[1]);
  else { const d = dueCards(c); deck = d.due.concat(d.fresh.slice(0, Math.max(5, 10))); }
  deck = shuffle(deck);
  let i = 0, flipped = false;
  const draw = () => {
    if (i >= deck.length) {
      v.innerHTML = `<div class="done"><div class="emoji">🎉</div><h1>${S.lang === 'en' ? 'Session complete' : 'Sesi selesai'}</h1><p class="muted">${deck.length} ${S.lang === 'en' ? 'cards reviewed' : 'kad diulang kaji'}</p><a class="btn" href="#/home">${u('home')}</a> <a class="btn ghost" href="#/quiz">${u('quiz')}</a></div>`; return;
    }
    const k = deck[i];
    v.innerHTML = `<a class="back" href="#/cards">← ${u('cards')}</a>
    <div class="bar"><i style="width:${i / deck.length * 100}%"></i></div><small class="muted">${i + 1} / ${deck.length} · ${esc(topicName(c, k.t).en)}</small>
    <div class="flash ${flipped ? 'flip' : ''}" id="fc">
      <div class="side front">${B(k.q)}<small class="hint">${flipped ? '' : (S.lang === 'en' ? 'tap to flip' : 'ketik untuk selselak')}</small></div>
      ${flipped ? `<div class="side backs">${B(k.a)}</div>` : ''}
    </div>
    ${flipped ? `<div class="grades"><button data-g="0" class="g0">${u('again')}</button><button data-g="1" class="g1">${u('hard')}</button><button data-g="2" class="g2">${u('good')}</button><button data-g="3" class="g3">${u('easy')}</button></div>` : `<button class="btn wide" id="sh">${u('show')}</button>`}`;
    if (!flipped) { $('#fc').onclick = $('#sh').onclick = () => { flipped = true; draw(); }; }
    v.querySelectorAll('.grades button').forEach(b => b.onclick = () => { grade(k.id, +b.dataset.g); i++; flipped = false; draw(); });
  };
  draw();
};

/* ------------------------------------------------------------------ QUIZ */
routes.quiz = function (v, a) {
  const c = curCh();
  if (a[0] === 'run') return runQuiz(v, c, a[1] || 'all', false);
  if (a[0] === 'srun') return runQuiz(v, scopeOf(c), a[1] || 'all', false);
  if (a[0] === 'essay') return essay(v, c, a[1]);
  const weakIds = c.quiz.filter(q => S.q[q.id] && S.q[q.id].bad > S.q[q.id].ok);
  v.innerHTML = `<h1>${u('quiz')}</h1>
  <div class="card"><div class="row"><div><b>${S.lang === 'en' ? 'Mixed practice' : 'Latihan campuran'}</b><br><small class="muted">${c.quiz.length} MCQ · ${S.lang === 'en' ? 'instant feedback + BM explanation' : 'maklum balas segera + penerangan BM'}</small></div><a class="btn" href="#/quiz/run/all">${u('start')}</a></div></div>
  ${c.subj.chapters.length > 1 ? `<div class="card"><div class="row"><div><b>${T('Whole subject practice', 'Latihan seluruh subjek')}</b><br><small class="muted">${scopeOf(c).quiz.length} MCQ · ${c.subj.chapters.length} ${T('chapters', 'chapter')}</small></div><a class="btn ghost" href="#/quiz/srun/all">${u('start')}</a></div></div>` : ''}
  <div class="card exam"><div class="row"><div><b>📝 ${u('exam')}</b><br><small class="muted">${S.lang === 'en' ? 'English only · timed · no hints · results at the end' : 'English sahaja · bermasa · tiada bantuan · keputusan di akhir'}</small></div><a class="btn" href="#/exam">${u('start')}</a></div></div>
  ${weakIds.length ? `<div class="card"><div class="row"><div><b>${S.lang === 'en' ? 'Review my mistakes' : 'Ulang kaji kesilapan'}</b><br><small class="muted">${weakIds.length} ${S.lang === 'en' ? 'questions' : 'soalan'}</small></div><a class="btn ghost" href="#/quiz/run/weak">${u('start')}</a></div></div>` : ''}
  <h3>${S.lang === 'en' ? 'By topic' : 'Ikut topik'}</h3><div class="chips">${c.sections.filter(s => c.quiz.some(q => q.t === s.id)).map(s => { const qs = c.quiz.filter(q => q.t === s.id); const st = qs.reduce((x, q) => { const z = S.q[q.id]; if (z) { x.ok += z.ok; x.t += z.ok + z.bad; } return x; }, { ok: 0, t: 0 }); return `<a class="chip" href="#/quiz/run/${encodeURIComponent(s.id)}">${s.icon} ${esc(S.lang === 'ms' ? s.title.ms : s.title.en)} <small>${qs.length}${st.t ? ' · ' + Math.round(st.ok / st.t * 100) + '%' : ''}</small></a>`; }).join('')}</div>
  <h3>${S.lang === 'en' ? 'Essay / structured questions' : 'Soalan esei / berstruktur'}</h3>
  <div class="list">${c.essay.map(e => `<a class="item" href="#/quiz/essay/${encodeURIComponent(e.id)}"><span class="ico">✍️</span><span class="grow"><b>${esc(e.q.en.slice(0, 80))}${e.q.en.length > 80 ? '…' : ''}</b><small class="muted">${e.marks} ${u('marks')}${S.sa[e.id] !== undefined ? ' · ' + S.sa[e.id] + '/' + e.marks : ''}</small></span></a>`).join('')}</div>`;
};
function essay(v, c, id) {
  const e = c.essay.find(x => x.id === id); if (!e) return go('/quiz');
  let shown = false, got = {};
  const draw = () => {
    v.innerHTML = `<a class="back" href="#/quiz">← ${u('quiz')}</a><div class="eyebrow">${e.marks} ${u('marks')} · ${esc(topicName(c, e.t).en)}</div>
    <div class="qtext">${B(e.q)}</div>
    <textarea id="ans" class="ans" placeholder="${S.lang === 'en' ? 'Write your answer in English first…' : 'Tulis jawapan anda dalam English dahulu…'}">${esc(sessionStorage.getItem('ans.' + id) || '')}</textarea>
    ${shown ? `<div class="card"><h3>${S.lang === 'en' ? 'Marking points — tick what you covered' : 'Poin markah — tanda yang anda dah tulis'}</h3>${e.pts.en.map((p, i) => `<label class="pt"><input type="checkbox" data-i="${i}" ${got[i] ? 'checked' : ''}><span>${S.lang === 'ms' ? esc(e.pts.ms[i]) : esc(p)}${S.lang === 'dual' ? `<small class="muted">${esc(e.pts.ms[i])}</small>` : ''}</span></label>`).join('')}<div class="row"><b id="tot"></b><button class="btn" id="sv">${S.lang === 'en' ? 'Save score' : 'Simpan skor'}</button></div></div>` : `<button class="btn wide" id="rv">${u('show')}</button>`}`;
    const ta = $('#ans'); ta.oninput = () => sessionStorage.setItem('ans.' + id, ta.value);
    if ($('#rv')) $('#rv').onclick = () => { shown = true; draw(); };
    if (shown) {
      const upd = () => { let m = 0; e.pts.en.forEach((p, i) => { if (got[i]) m += +(p.match(/\((\d)\)\s*$/) || [0, 1])[1]; }); $('#tot').textContent = m + ' / ' + e.marks; return m; };
      v.querySelectorAll('.pt input').forEach(cb => cb.onchange = () => { got[cb.dataset.i] = cb.checked; upd(); }); upd();
      $('#sv').onclick = () => { S.sa[id] = Math.min(e.marks, upd()); bump(2); save(); go('/quiz'); };
    }
  };
  draw();
}
function buildQueue(c, mode, n) {
  let qs = c.quiz;
  if (mode === 'weak') qs = qs.filter(q => S.q[q.id] && S.q[q.id].bad > S.q[q.id].ok);
  else if (mode !== 'all') qs = qs.filter(q => q.t === mode);
  qs = shuffle(qs); if (n) qs = qs.slice(0, n);
  return qs.map(q => { const idx = shuffle(q.o.map((_, i) => i)); return Object.assign({}, q, { o: idx.map(i => q.o[i]), a: idx.indexOf(q.a) }); });
}
function runQuiz(v, c, mode, exam, n) {
  const queue = buildQueue(c, mode, n);
  if (!queue.length) { v.innerHTML = `<p class="muted">–</p><a class="btn" href="#/quiz">${u('back')}</a>`; return; }
  let i = 0, picked = null, answers = [], t0 = Date.now(), tick = null, limit = exam ? Math.round(queue.length * 90) : 0;
  const L = ['A', 'B', 'C', 'D', 'E'];
  const q$ = (q) => exam ? `<div class="en">${md(q.q.en)}</div>` : B(q.q);
  const finish = () => {
    clearInterval(tick);
    const ok = answers.filter((x, k) => x === queue[k].a).length;
    const secs = Math.round((Date.now() - t0) / 1000);
    if (exam) { S.exams.push({ d: today(), ok, n: queue.length, s: secs, k: c.uid }); save(); }
    const byT = {}; queue.forEach((q, k) => { byT[q.t] = byT[q.t] || [0, 0]; byT[q.t][1]++; if (answers[k] === q.a) byT[q.t][0]++; });
    const pct = Math.round(ok / queue.length * 100);
    v.innerHTML = `<div class="done"><div class="emoji">${pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '💪'}</div><h1>${ok} / ${queue.length} <small>(${pct}%)</small></h1>
      <p class="muted">${Math.floor(secs / 60)}m ${secs % 60}s</p></div>
      <div class="card"><h3>${S.lang === 'en' ? 'By topic' : 'Ikut topik'}</h3>${Object.entries(byT).map(([t, [a, b]]) => `<div class="row"><span>${esc(topicName(c, t).en)}</span><b>${a}/${b}</b></div><div class="bar ${a / b < 0.6 ? 'bad' : ''}"><i style="width:${a / b * 100}%"></i></div>`).join('')}</div>
      <h3>${S.lang === 'en' ? 'Review' : 'Semak semula'}</h3>
      ${queue.map((q, k) => `<div class="card rev ${answers[k] === q.a ? 'ok' : 'no'}"><div class="qtext">${B(q.q)}</div>
        <div class="ansline">${answers[k] === q.a ? '✓' : '✗'} ${S.lang === 'en' ? 'Your answer' : 'Jawapan anda'}: ${answers[k] === undefined ? '–' : esc(q.o[answers[k]])}</div>
        ${answers[k] !== q.a ? `<div class="ansline good">✓ ${S.lang === 'en' ? 'Correct' : 'Betul'}: ${esc(q.o[q.a])}</div>` : ''}
        <div class="expl">${B(q.e)}</div></div>`).join('')}
      <div class="actions"><button class="btn" id="rst">${u('restart')}</button><a class="btn ghost" href="#/quiz">${u('quiz')}</a></div>`;
    $('#rst').onclick = () => runQuiz(v, c, mode, exam, n);
  };
  const draw = () => {
    const q = queue[i]; picked = null;
    const rem = limit ? Math.max(0, limit - Math.round((Date.now() - t0) / 1000)) : 0;
    v.innerHTML = `<a class="back" href="#/quiz">← ${u('quiz')}</a>
    <div class="row"><small class="muted">${i + 1} / ${queue.length} · ${esc(topicName(c, q.t).en)}</small>${exam ? `<span class="timer" id="tm">${Math.floor(rem / 60)}:${String(rem % 60).padStart(2, '0')}</span>` : ''}</div>
    <div class="bar"><i style="width:${i / queue.length * 100}%"></i></div>
    <div class="qtext">${q$(q)}</div>
    <div class="opts">${q.o.map((o, k) => `<button class="opt" data-k="${k}"><span class="L">${L[k]}</span><span>${esc(o)}</span></button>`).join('')}</div>
    <div id="fb"></div><div class="actions"><button class="btn" id="nx" disabled>${i === queue.length - 1 ? u('finish') : u('next')}</button></div>`;
    const nx = $('#nx');
    v.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      if (picked !== null && !exam) return;
      picked = +b.dataset.k;
      v.querySelectorAll('.opt').forEach(x => x.classList.toggle('sel', x === b));
      nx.disabled = false;
      if (!exam) {
        v.querySelectorAll('.opt').forEach((x, k) => { x.disabled = true; if (k === q.a) x.classList.add('right'); else if (k === picked) x.classList.add('bad'); });
        const ok = picked === q.a; const s = S.q[q.id] || { ok: 0, bad: 0 }; ok ? s.ok++ : s.bad++; S.q[q.id] = s; bump(1);
        $('#fb').innerHTML = `<div class="callout ${ok ? 'good' : 'bad'}"><span class="ico">${ok ? '✅' : '❌'}</span><div><b>${ok ? u('correct') : u('wrong')}</b>${B(q.e)}</div></div>`;
      }
    });
    nx.onclick = () => { answers[i] = picked; if (exam) { const s = S.q[q.id] || { ok: 0, bad: 0 }; picked === q.a ? s.ok++ : s.bad++; S.q[q.id] = s; bump(1); } i++; i < queue.length ? draw() : finish(); };
  };
  if (exam) tick = setInterval(() => { const el = $('#tm'); if (!el) { clearInterval(tick); return; } const rem = Math.max(0, limit - Math.round((Date.now() - t0) / 1000)); el.textContent = Math.floor(rem / 60) + ':' + String(rem % 60).padStart(2, '0'); el.classList.toggle('low', rem < 60); if (rem === 0) { answers[i] = picked === null ? undefined : picked; finish(); } }, 1000);
  draw();
}
routes.exam = function (v, a) {
  const c = curCh();
  if (a[0] === 's') return runQuiz(v, scopeOf(c), 'all', true, +a[1]);
  if (a[0]) return runQuiz(v, c, 'all', true, +a[0]);
  const sc = c.subj.chapters.length > 1 ? scopeOf(c) : null;
  const hist = S.exams.filter(h => !h.k || h.k === c.uid || (sc && h.k === sc.uid)).slice(-5).reverse();
  v.innerHTML = `<a class="back" href="#/quiz">← ${u('quiz')}</a><h1>📝 ${u('exam')}</h1>
  <div class="card"><p>${S.lang === 'en' ? 'Simulates the real exam: English only, 90 seconds per question, answers shown at the end.' : 'Simulasi exam sebenar: English sahaja, 90 saat setiap soalan, jawapan ditunjuk di akhir.'}</p>
  <div class="chips"><a class="chip" href="#/exam/10">10 Qs</a><a class="chip" href="#/exam/20">20 Qs</a><a class="chip" href="#/exam/${c.quiz.length}">${S.lang === 'en' ? 'All' : 'Semua'} ${c.quiz.length}</a></div>${sc ? `<p class="muted"><small>${T('Whole subject', 'Seluruh subjek')}:</small></p><div class="chips"><a class="chip" href="#/exam/s/10">10 Qs</a><a class="chip" href="#/exam/s/20">20 Qs</a><a class="chip" href="#/exam/s/${sc.quiz.length}">${S.lang === 'en' ? 'All' : 'Semua'} ${sc.quiz.length}</a></div>` : ''}</div>
  ${hist.length ? `<h3>${S.lang === 'en' ? 'Recent attempts' : 'Percubaan terkini'}</h3><div class="list">${hist.map(h => `<div class="item"><span class="grow"><b>${h.ok}/${h.n} (${Math.round(h.ok / h.n * 100)}%)</b><small class="muted">${h.d} · ${Math.floor(h.s / 60)}m ${h.s % 60}s</small></span></div>`).join('')}</div>` : ''}`;
};



/* ----------------------------------------------------------------- TOOLS */
routes.tools = function (v, a) {
  const c = curCh(), X = window.IS_TOOLS || {};
  if (a[0] === 'flow') return flow(v, c, a[1]);
  if (a[0] === 'gloss') return gloss(v, c);
  if (X[a[0]] && (c.tools || []).includes(a[0])) return X[a[0]](v);
  const tl = toolList(c);
  v.innerHTML = `<h1>${u('tools')}</h1>${tl.length ? `<div class="grid2">${tl.map(t => toolTile(t, true)).join('')}</div>` : `<p class="muted">${T('No tools for this chapter yet.', 'Belum ada alat untuk chapter ini.')}</p>`}`;
};
function flow(v, c, id) {
  const F = flowsOf(c).find(f => f.id === id) || flowsOf(c)[0]; if (!F) return go('/tools');
  let cur = F.start, trail = [];
  const draw = () => {
    const r = F.results[cur];
    if (r) {
      v.innerHTML = `<a class="back" href="#/tools">← ${u('tools')}</a><div class="result ${r.c}"><div class="eyebrow">${S.lang === 'en' ? 'Result' : 'Keputusan'}</div><h1>${B(r.t, 'span')}</h1>${B(r.d)}</div>
      <div class="actions"><button class="btn" id="rs">${u('restart')}</button></div>`;
      $('#rs').onclick = () => { cur = F.start; trail = []; draw(); }; return;
    }
    const n = F.nodes[cur];
    v.innerHTML = `<a class="back" href="#/tools">← ${u('tools')}</a><h1>${F.icon || '🧭'} ${B(F.title, 'span')}</h1>
    <div class="step">${trail.length + 1}</div><div class="qtext">${B(n.q)}</div>
    <div class="yn"><button class="btn yes" id="y">${S.lang === 'en' ? 'Yes' : 'Ya'}</button><button class="btn no" id="n">${S.lang === 'en' ? 'No' : 'Tidak'}</button></div>
    ${trail.length ? `<button class="btn ghost" id="bk">← ${u('back')}</button>` : ''}`;
    $('#y').onclick = () => { trail.push(cur); cur = n.y; draw(); };
    $('#n').onclick = () => { trail.push(cur); cur = n.n; draw(); };
    if ($('#bk')) $('#bk').onclick = () => { cur = trail.pop(); draw(); };
  };
  draw();
}


function gloss(v, c) {
  let hide = false, q = '';
  const draw = () => {
    const list = c.glossary.filter(g => (g[0] + g[1]).toLowerCase().includes(q));
    v.innerHTML = `<a class="back" href="#/tools">← ${u('tools')}</a><h1>📖 ${S.lang === 'en' ? 'Glossary' : 'Glosari'}</h1>
    <input class="search" id="gs" type="search" value="${esc(q)}" placeholder="${S.lang === 'en' ? 'Search…' : 'Cari…'}">
    <label class="sw"><input type="checkbox" id="hd" ${hide ? 'checked' : ''}> ${S.lang === 'en' ? 'Hide Malay (self-test: tap to reveal)' : 'Sembunyi BM (uji diri: ketik untuk tunjuk)'}</label>
    <div class="list">${list.map(g => `<div class="item gl"><b>${esc(g[0])}</b><span class="${hide ? 'blur' : ''}" onclick="this.classList.remove('blur')">${esc(g[1])}</span></div>`).join('')}</div>`;
    $('#gs').oninput = (e) => { q = e.target.value.toLowerCase(); const pos = e.target.selectionStart; draw(); const n = $('#gs'); n.focus(); n.setSelectionRange(pos, pos); };
    $('#hd').onchange = (e) => { hide = e.target.checked; draw(); };
  };
  draw();
}


/* --------------------------------------------------------------- LIBRARY */
function dl(name, text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1500); }
async function copyText(text, fallbackEl) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
  if (fallbackEl) { fallbackEl.value = text; fallbackEl.hidden = false; fallbackEl.select(); try { return document.execCommand('copy'); } catch (e) {} }
  return false;
}
function importText(text, src) {
  const res = { ok: [], errors: [] };
  let data; try { data = JSON.parse(text); } catch (e) { res.errors.push(src + ': not valid JSON – ' + e.message); return res; }
  const list = Array.isArray(data) ? data : data && Array.isArray(data.chapters) ? data.chapters : [data];
  list.forEach((raw, i) => {
    const label = src + (list.length > 1 ? ' #' + (i + 1) : '') + (raw && raw.id ? ' (' + raw.id + ')' : '');
    const errs = validate(raw);
    if (errs.length) { res.errors.push(label + ':\n  - ' + errs.slice(0, 25).join('\n  - ') + (errs.length > 25 ? '\n  … and ' + (errs.length - 25) + ' more' : '')); return; }
    const uid = raw.subject.id + '.' + raw.id, ex = CH().find(c => c.uid === uid);
    if (ex && ex.builtin) { res.errors.push(label + ': chapter id "' + raw.id + '" already exists as built-in content in subject "' + raw.subject.id + '". Change "id".'); return; }
    if (ex && !confirm(T('Replace existing chapter ', 'Ganti chapter sedia ada ') + uid + '?')) { res.errors.push(label + ': skipped (not replaced)'); return; }
    const store = userStore().filter(x => x.subject.id + '.' + x.id !== uid); store.push(raw);
    if (!setUserStore(store)) { res.errors.push(label + ': could not save – browser storage is full or blocked'); return; }
    if (ex) removeFromLib(uid);
    addChapter(getSubject(raw.subject, false), JSON.parse(JSON.stringify(raw)), false);
    res.ok.push(uid);
  });
  return res;
}
function removeFromLib(uid) {
  LIB.subjects.forEach(s => { s.chapters = s.chapters.filter(c => c.uid !== uid); });
  LIB.subjects = LIB.subjects.filter(s => s.builtin || s.chapters.length);
}
routes.lib = function (v) {
  const c = curCh(), sj = c ? c.subj : null;
  const subjHtml = LIB.subjects.map(s => `<div class="card"><h2>${esc(s.code)} · ${esc(S.lang === 'ms' ? s.name.ms : s.name.en)}</h2><div class="list">${s.chapters.map(x => `<div class="item"><span class="grow"><b>${x.num < 999 ? 'Ch ' + x.num + ' · ' : ''}${esc(S.lang === 'ms' ? x.title.ms : x.title.en)}</b><small class="muted">${x.sections.length} ${T('sections', 'seksyen')} · ${x.cards.length} ${T('cards', 'kad')} · ${x.quiz.length} MCQ · ${x.essay.length} ${T('essay', 'esei')} ${x.builtin ? '' : '· ' + T('imported', 'diimport')}</small></span><button class="btn ghost sm" data-open="${esc(x.uid)}">${T('Open', 'Buka')}</button>${x.builtin ? '' : `<button class="btn ghost sm danger" data-del="${esc(x.uid)}">${T('Delete', 'Padam')}</button>`}</div>`).join('') || `<p class="muted">–</p>`}</div></div>`).join('');
  v.innerHTML = `<h1>📚 ${u('lib')}</h1>
  ${subjHtml || `<div class="card"><p>${T('No content yet. Import a chapter file below.', 'Belum ada kandungan. Import fail chapter di bawah.')}</p></div>`}

  <div class="card">
    <h2>⬆️ ${T('Add a chapter', 'Tambah chapter')}</h2>
    <ol class="plan"><li>${T('Fill in the subject, then copy the AI prompt.', 'Isi maklumat subjek, kemudian salin prompt AI.')}</li><li>${T('Give the prompt + your slides/notes to Claude (or any AI). It returns a .json file.', 'Beri prompt + slide/nota anda kepada Claude (atau AI lain). Ia pulangkan fail .json.')}</li><li>${T('Import the file here.', 'Import fail itu di sini.')}</li></ol>
    <div class="form"><div class="two"><label>ID<input id="sid" value="${esc(sj ? sj.id : '')}" placeholder="far2"></label><label>${T('Code', 'Kod')}<input id="scode" value="${esc(sj ? sj.code : '')}" placeholder="FAR2"></label></div>
    <label>${T('Subject name (English)', 'Nama subjek (English)')}<input id="sen" value="${esc(sj ? sj.name.en : '')}" placeholder="Financial Reporting 2"></label>
    <label>${T('Subject name (Malay)', 'Nama subjek (BM)')}<input id="sms" value="${esc(sj ? sj.name.ms : '')}" placeholder="Pelaporan Kewangan 2"></label></div>
    <div class="actions"><button class="btn" id="cp">${T('Copy AI prompt', 'Salin prompt AI')}</button><a class="btn ghost" href="content/template.json" download="template.json">${T('Download template', 'Muat turun templat')}</a></div>
    <textarea id="fb" class="ans" hidden readonly></textarea>
    <hr>
    <label class="file"><input type="file" id="file" accept=".json,application/json" multiple><span class="btn ghost">${T('Choose .json file(s)', 'Pilih fail .json')}</span></label>
    <textarea id="paste" class="ans" style="min-height:110px" placeholder="${T('…or paste JSON here', '…atau tampal JSON di sini')}"></textarea>
    <div class="actions"><button class="btn" id="imp">${T('Import', 'Import')}</button></div>
    <div id="msg"></div>
  </div>

  <div class="card">
    <h2>💾 ${T('Backup & sync', 'Sandaran & selaras')}</h2>
    <p class="muted"><small>${T('Progress and imported chapters are stored only in this browser. Export to move them to another device.', 'Kemajuan dan chapter import disimpan dalam pelayar ini sahaja. Eksport untuk pindah ke peranti lain.')}</small></p>
    <div class="actions"><button class="btn ghost" id="xp">${T('Export progress', 'Eksport kemajuan')}</button><label class="file"><input type="file" id="ip" accept=".json,application/json"><span class="btn ghost">${T('Import progress', 'Import kemajuan')}</span></label>
    <button class="btn ghost" id="xc">${T('Export my chapters', 'Eksport chapter saya')}</button><button class="btn ghost danger" id="rs">${T('Reset progress', 'Set semula kemajuan')}</button></div>
  </div>`;
  v.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { S.ch = b.dataset.open; save(); go('/home'); });
  v.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    if (!confirm(T('Delete this imported chapter? (Progress is kept.)', 'Padam chapter import ini? (Kemajuan dikekalkan.)'))) return;
    setUserStore(userStore().filter(x => x.subject.id + '.' + x.id !== b.dataset.del)); removeFromLib(b.dataset.del);
    if (S.ch === b.dataset.del) S.ch = ''; save(); render();
  });
  const msg = $('#msg'), show = (res) => {
    msg.innerHTML = (res.ok.length ? `<div class="callout good"><span class="ico">✅</span><div>${T('Imported', 'Berjaya import')}: <b>${res.ok.map(esc).join(', ')}</b></div></div>` : '') +
      (res.errors.length ? `<div class="callout bad"><span class="ico">❌</span><div><b>${T('Could not import', 'Tidak dapat import')}</b><pre class="errs">${esc(res.errors.join('\n\n'))}</pre><button class="btn ghost sm" id="ce">${T('Copy errors (paste to the AI to fix)', 'Salin ralat (tampal kepada AI untuk betulkan)')}</button></div></div>` : '');
    if ($('#ce')) $('#ce').onclick = () => copyText(res.errors.join('\n\n'), $('#fb'));
    if (res.ok.length) { const last = res.ok[res.ok.length - 1]; if (!res.errors.length) { S.ch = last; save(); } fillChapterSelect(); setTimeout(() => { if (!res.errors.length) go('/home'); }, 900); }
  };
  $('#imp').onclick = () => { const t = $('#paste').value.trim(); if (!t) { msg.innerHTML = `<p class="muted">${T('Paste JSON first, or choose a file.', 'Tampal JSON dahulu, atau pilih fail.')}</p>`; return; } show(importText(t, 'pasted JSON')); };
  $('#file').onchange = async (e) => {
    const res = { ok: [], errors: [] };
    for (const f of e.target.files) { if (f.size > 3e6) { res.errors.push(f.name + ': file is too large (max 3 MB)'); continue; } const r = importText(await f.text(), f.name); res.ok.push(...r.ok); res.errors.push(...r.errors); }
    show(res); e.target.value = '';
  };
  $('#cp').onclick = async () => {
    const g = (id) => $('#' + id).value.trim();
    if (!/^[a-z0-9][a-z0-9-]{0,23}$/.test(g('sid')) || !g('scode') || !g('sen')) { msg.innerHTML = `<div class="callout bad"><span class="ico">❌</span><div>${T('Fill subject ID (lowercase, e.g. far2), code and English name first.', 'Isi ID subjek (huruf kecil, cth far2), kod dan nama English dahulu.')}</div></div>`; return; }
    let t = ''; try { t = await (await fetch('content/ai-prompt.txt')).text(); } catch (e) { msg.innerHTML = `<p class="muted">Prompt unavailable offline.</p>`; return; }
    t = t.replace(/\{\{SUBJECT_ID\}\}/g, g('sid')).replace(/\{\{SUBJECT_CODE\}\}/g, g('scode')).replace(/\{\{SUBJECT_NAME_EN\}\}/g, g('sen')).replace(/\{\{SUBJECT_NAME_MS\}\}/g, g('sms') || g('sen'));
    const ok = await copyText(t, $('#fb'));
    msg.innerHTML = `<div class="callout good"><span class="ico">${ok ? '✅' : 'ℹ️'}</span><div>${ok ? T('Prompt copied. Paste it into Claude together with your slides.', 'Prompt disalin. Tampal dalam Claude bersama slide anda.') : T('Copy manually from the box above.', 'Salin secara manual dari kotak di atas.')}</div></div>`;
  };
  $('#xp').onclick = () => dl('i-study-progress-' + today() + '.json', JSON.stringify({ istudy: 1, progress: S }));
  $('#xc').onclick = () => { const u2 = userStore(); if (!u2.length) { msg.innerHTML = `<p class="muted">${T('No imported chapters to export.', 'Tiada chapter import untuk dieksport.')}</p>`; return; } dl('i-study-my-chapters-' + today() + '.json', JSON.stringify({ chapters: u2 })); };
  $('#ip').onchange = async (e) => {
    try { const o = JSON.parse(await e.target.files[0].text()); if (o.istudy !== 1 || typeof o.progress !== 'object') throw new Error('not an i-Study progress file'); if (!confirm(T('Replace progress on this device with the file?', 'Ganti kemajuan pada peranti ini dengan fail itu?'))) return; Object.keys(S).forEach(k => delete S[k]); Object.assign(S, defaults, o.progress); save(); applyTheme(); render(); }
    catch (err) { msg.innerHTML = `<div class="callout bad"><span class="ico">❌</span><div>${esc(err.message)}</div></div>`; }
    e.target.value = '';
  };
  $('#rs').onclick = () => { if (!confirm(T('Reset ALL progress on this device?', 'Set semula SEMUA kemajuan pada peranti ini?'))) return; Object.assign(S, { read: {}, cards: {}, q: {}, sa: {}, exams: [], day: {} }); save(); render(); };
};

/* ------------------------------------------------------------- chrome */
function applyTheme() {
  const t = S.theme; document.documentElement.dataset.theme = t === 'auto' ? '' : t;
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = (t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)) ? '#0f1720' : '#0f766e';
  const b = $('#theme'); if (b) b.textContent = { dark: '🌙', light: '☀️', auto: '🌓' }[t];
}
window.IS = { S, u, T, fmt, $, B, esc, go, md };
async function init() {
  applyTheme();
  document.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { S.lang = b.dataset.lang; save(); render(); });
  $('#theme').onclick = () => { S.theme = S.theme === 'dark' ? 'light' : S.theme === 'light' ? 'auto' : 'dark'; save(); applyTheme(); };
  $('#chsel').onchange = (e) => { S.ch = e.target.value; save(); if (location.hash === '#/home' || !location.hash) render(); else go('/home'); };
  view().innerHTML = '<p class="muted">Loading…</p>';
  try { await loadLib(); }
  catch (e) { view().innerHTML = `<div class="card"><h2>⚠️ Could not load content</h2><p>${esc(e.message)}</p><p class="muted"><small>i-Study must be opened from a web address (e.g. GitHub Pages or a local server), not by double-clicking index.html. If you are offline, open the app once online first so it can save itself.</small></p></div>`; }
  window.addEventListener('hashchange', render);
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
document.addEventListener('DOMContentLoaded', init);
})();
