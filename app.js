import { parseCommand, applyCommand } from './commands.js';
import { paginate } from './preview.js';

const KEY = 'flow-author-v2';
const $ = (s) => document.querySelector(s);
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uid = () => Math.random().toString(36).slice(2, 9);
const words = (s) => (s.match(/\S+/g) || []).length;
const today = () => new Date().toISOString().slice(0, 10);
const capFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const clock = (t) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '').toLowerCase();

// A section is a stretch of draft. Giving it a title makes it a chapter; untitled sections are scenes.
const sec = (title, ...paragraphs) => ({ id: uid(), title, paragraphs });
const note = (text, at = Date.now()) => ({ id: uid(), text, at });
const book = (title, kind, notes, sections, tab = 'draft') => ({ id: uid(), title, kind, notes, sections, activeSectionId: sections[0].id, tab });

function seed() {
  const h = 3600e3;
  const books = [
    book('The Salt Year', 'Novel', [note('Ines arrives on the island the year the fishing fails. Her uncle is hiding something in the ledgers.')], [
      sec('Arrival', 'The ferry came in an hour late, and nobody on the dock seemed to mind.', 'Ines carried one bag and a letter she had read so often the folds had gone soft.'),
      sec('', 'Her uncle kept the accounts in pencil, as if every number might still change its mind.'),
      sec('The Harbor', 'The boats came in late that night, their lamps swinging low over the water.', 'She counted the nets twice and still came up one short.', 'Nobody said the name of the missing boat out loud.'),
    ]),
  ];
  const scratch = [
    note('What if a lighthouse keeper starts getting letters from someone who drowned years ago?', Date.now() - 2 * h),
    note('Grandma kept the kitchen radio on all day, only the news. Maybe a memoir about growing up around that table.', Date.now() - 26 * h),
    note('Cities built for cars versus cities built for strangers to meet. Benches as evidence.', Date.now() - 50 * h),
  ];
  return { page: 'dictation', mode: 'draft', activeBookId: books[0].id, books, scratch, today: { date: today(), words: 0 } };
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s?.books && s?.scratch) return s;
  } catch { /* corrupt or blocked storage: start from seed, save will surface the error */ }
  return seed();
}

let state = load();
let saveState = 'saved';
let saveTimer;
let interim = '';
let flash = null; // { idx, old }
let liveNoteId = null; // note that the current mic session is filling
const undo = new Map(); // sectionId -> previous paragraphs (one step)

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); saveState = 'saved'; }
    catch { saveState = 'error'; toast('Not saved — export to keep your work.', true); }
    const el = $('.saved');
    if (el) { el.textContent = saveState === 'saved' ? 'Saved ✓' : 'Not saved'; el.classList.toggle('err', saveState !== 'saved'); }
  }, 300);
}

function set(next, { render: r = true } = {}) {
  state = next;
  save();
  if (r) render();
}

// --- selectors / immutable updaters ---
const activeBook = () => state.books.find((b) => b.id === state.activeBookId) ?? state.books[0];
const activeSection = () => { const b = activeBook(); return b.sections.find((s) => s.id === b.activeSectionId) ?? b.sections[0]; };
const sectionIndex = () => activeBook().sections.indexOf(activeSection());
const withBook = (fn) => ({ ...state, books: state.books.map((b) => (b.id === activeBook().id ? fn(b) : b)) });
const withSection = (fn) => withBook((b) => ({ ...b, sections: b.sections.map((s) => (s.id === activeSection().id ? fn(s) : s)) }));
const chapterNo = (b, s) => b.sections.filter((x) => x.title).indexOf(s) + 1;
const sectionLabel = (b, s) => (s.title ? `Ch ${chapterNo(b, s)} · ${s.title}` : `§${b.sections.indexOf(s) + 1}`);
const where = () => (state.page === 'author' ? activeBook().tab : state.page === 'scratchpad' ? 'scratchpad' : 'feed');
const openBook = (id) => set({ ...state, page: 'author', activeBookId: id });

// --- book building ---
function titleFrom(text) {
  const named = text.match(/\b(?:called|titled)\s+[“"]?([^.,;“”"]+)/i);
  const first = (named ? named[1] : text.split(/[.?!]/)[0]).replace(/^(what if|maybe|(?:a |an )?(?:story|book|novel|memoir|essay) about)\s+/i, '').trim();
  const t = first.split(/\s+/).slice(0, 7).join(' ');
  return capFirst(t) || 'Untitled book';
}

function buildBook(noteId) {
  const n = state.scratch.find((x) => x.id === noteId) ?? state.scratch[0];
  if (!n) return toast('Jot an idea first, then say “build it into a book”.', true);
  const b = book(titleFrom(n.text), 'Idea', [note(n.text, n.at)], [sec('')], 'notes');
  liveNoteId = null;
  set({ ...state, books: [...state.books, b], scratch: state.scratch.map((x) => (x.id === n.id ? { ...x, bookId: b.id } : x)) });
  toast(`Started a book · ${b.title}`, false, ['Open', () => openBook(b.id)]);
}

function addToBook(noteId, bookId) {
  const n = state.scratch.find((x) => x.id === noteId);
  const b = state.books.find((x) => x.id === bookId);
  set({ ...state, books: state.books.map((x) => (x.id === bookId ? { ...x, notes: [...x.notes, note(n.text, n.at)] } : x)),
    scratch: state.scratch.map((x) => (x.id === noteId ? { ...x, bookId } : x)) });
  toast(`Added to ${b.title} · Notes`, false, ['Open', () => openBook(bookId)]);
}

// --- speech input ---
function appendNote(text) {
  const t = capFirst(text);
  const extend = (list) => (liveNoteId && list.some((x) => x.id === liveNoteId)
    ? list.map((x) => (x.id === liveNoteId ? { ...x, text: `${x.text} ${text}` } : x))
    : (() => { const n = note(t); liveNoteId = n.id; return [...list, n]; })());
  if (where() === 'scratchpad') set({ ...state, scratch: extend(state.scratch) });
  else set(withBook((b) => ({ ...b, notes: extend(b.notes) })));
}

function appendProse(text) {
  const s = activeSection();
  const ps = s.paragraphs;
  const last = ps.at(-1);
  const paragraphs = !ps.length ? [capFirst(text)]
    : last === '' ? [...ps.slice(0, -1), capFirst(text)]
    : [...ps.slice(0, -1), `${last} ${/[.!?]$/.test(last) ? capFirst(text) : text}`];
  const t = state.today.date === today() ? state.today : { date: today(), words: 0 };
  undo.set(s.id, ps);
  set({ ...withSection((x) => ({ ...x, paragraphs })), today: { ...t, words: t.words + words(text) } });
}

const ALWAYS = new Set(['gotoChapter', 'gotoSection', 'newChapter', 'newSection', 'newPara', 'undo', 'tab', 'buildBook']);

function handleFinal(raw) {
  const text = raw.trim();
  if (!text) return;
  const cmd = parseCommand(text);
  const w = where();
  if (cmd && (ALWAYS.has(cmd.type) || state.mode === 'revise')) return runCommand(cmd);
  if (w === 'scratchpad' || w === 'notes') return appendNote(text);
  if (w === 'preview') return toast('Say “open draft” to keep writing.', true);
  if (state.mode === 'revise') return toast(`Not a command: “${text}”. Switch to Draft to dictate prose.`, true);
  appendProse(text);
}

function runCommand(cmd) {
  const b = activeBook();
  if (cmd.type === 'buildBook') return buildBook(where() === 'scratchpad' ? liveNoteId ?? state.scratch.at(-1)?.id : null);
  if (where() === 'scratchpad') return toast('Say “build it into a book” to start one from your latest note.', true);
  if (cmd.type === 'tab') return set(withBook((x) => ({ ...x, tab: cmd.tab })));
  if (cmd.type === 'gotoChapter' || cmd.type === 'gotoSection') {
    const pool = cmd.type === 'gotoChapter' ? b.sections.filter((s) => s.title) : b.sections;
    const target = pool[cmd.n - 1];
    if (!target) return toast(`There is no ${cmd.type === 'gotoChapter' ? 'chapter' : 'section'} ${cmd.n} yet.`, true);
    toast(sectionLabel(b, target));
    return set(withBook((x) => ({ ...x, activeSectionId: target.id, tab: 'draft' })));
  }
  if (cmd.type === 'newChapter') return addSection(cmd.title);
  if (cmd.type === 'newSection') return addSection('');
  if (cmd.type === 'undo') {
    const prev = undo.get(activeSection().id);
    if (!prev) return toast('Nothing to undo.', true);
    undo.delete(activeSection().id);
    toast('Undone.');
    return set(withSection((s) => ({ ...s, paragraphs: prev })));
  }
  const old = activeSection().paragraphs[cmd.n - 1];
  const r = applyCommand(activeSection(), cmd);
  if (r.error) return toast(`${r.error}.`, true);
  undo.set(r.chapter.id, activeSection().paragraphs);
  set(withSection(() => r.chapter), { render: false });
  const idx = cmd.type === 'insertAfter' ? cmd.n : cmd.n - 1;
  flash = cmd.type === 'newPara' ? null : { idx: Math.min(idx, r.chapter.paragraphs.length - 1), old: cmd.type === 'insertAfter' ? null : old };
  render();
  if (flash) {
    document.querySelectorAll('.para')[flash.idx]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(() => { flash = null; render(); }, 3000);
  }
}

function addSection(title) {
  const s = sec(title);
  toast(title ? `New chapter · ${title}` : 'New section');
  set(withBook((b) => ({ ...b, tab: 'draft', sections: [...b.sections, s], activeSectionId: s.id })));
}

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
let listening = false;

function toggleMic() {
  if (listening) { listening = false; rec?.stop(); interim = ''; liveNoteId = null; return render(); }
  if (!SR) return toast('Voice needs Chrome or Edge. You can still type.', true);
  rec = new SR();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = 'en-US';
  rec.onresult = (e) => {
    let live = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) handleFinal(r[0].transcript); else live += r[0].transcript;
    }
    setInterim(live);
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      listening = false;
      toast('Allow microphone access: click the mic icon in the address bar, then try again.', true);
    } else if (e.error === 'network') {
      toast('Speech service unreachable. Check your connection.', true);
    }
  };
  // Chrome ends recognition after silence; keep going while the user has the mic on.
  rec.onend = () => { if (listening) { try { rec.start(); } catch { listening = false; render(); } } else render(); };
  listening = true;
  liveNoteId = null;
  rec.start();
  render();
}

function setInterim(live) {
  interim = live.trim();
  const el = $('.interim');
  if (el) el.textContent = interim ? ` ${interim}` : '';
}

// --- render ---
let toastTimer;
function toast(msg, err = false, action = null) {
  const t = $('#toast');
  t.textContent = msg;
  if (action) {
    const b = document.createElement('button');
    b.textContent = action[0];
    b.addEventListener('click', () => { action[1](); t.classList.remove('show'); });
    t.append(' ', b);
  }
  t.classList.toggle('err', err);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

const FEED = [
  ['OCTOBER 19, 2026', [['10:38am', 'Let’s move the design review to Thursday so the research readout lands first.'], ['10:36am', 'Can you send me the deck before the call?']]],
  ['OCTOBER 17, 2026', [['5:08pm', 'The onboarding flow drops people at the calendar step, so we should test skipping it.'], ['5:07pm', 'Thanks for the notes, I’ll fold them into the next draft.']]],
];

function feedView() {
  return `
    <div class="banner">
      <h2>Transform works anywhere you write</h2>
      <p>Apply a Transform to rewrite, clean up, or restructure text after you dictate.</p>
      <div class="btns"><button class="btn btn-dark">Try it out</button><button class="btn">How it works</button></div>
    </div>
    ${FEED.map(([d, rows]) => `
      <div class="date"><span>${d}</span>${d === FEED[0][0] ? '<i data-lucide="search"></i>' : ''}</div>
      <div class="card">${rows.map(([t, s]) => `<div class="row"><time>${t}</time><div>${esc(s)}</div></div>`).join('')}</div>`).join('')}`;
}

const micButton = () => `<button class="mic ${listening ? 'on' : ''}" id="mic" aria-label="${listening ? 'Stop dictating' : 'Start dictating'}" aria-pressed="${listening}"><i data-lucide="${listening ? 'mic' : 'mic-off'}"></i></button>`;
const savedBadge = () => `<span class="saved ${saveState === 'error' ? 'err' : ''}">${saveState === 'error' ? 'Not saved' : 'Saved ✓'}</span>`;

// Mirrors Flow's Scratchpad card: short title, body, date/time footer, hover toolbar (edit · pin · delete).
const day = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const tool = (data, icon, label, cls = '') => `<button class="${cls}" ${data} aria-label="${label}" title="${label}"><i data-lucide="${icon}"></i></button>`;

function noteCard(n, { inBook = false } = {}) {
  const linked = !inBook && n.bookId && state.books.find((b) => b.id === n.bookId);
  const title = n.text.split(/\s+/).slice(0, 3).join(' ') || 'New note';
  const others = state.books.filter((b) => b.id !== n.bookId);
  return `
    <article class="note-card">
      <div class="note-tools">
        ${inBook ? '' : `<details class="book-menu">
          <summary aria-label="Add to a book" title="Add to a book"><i data-lucide="book-plus"></i></summary>
          <div class="menu" role="menu">
            <div class="menu-label">Add to a book</div>
            ${others.map((b) => `<button role="menuitem" data-add="${n.id}" data-book="${b.id}"><i data-lucide="book"></i>${esc(b.title)}</button>`).join('')}
            <button role="menuitem" data-build="${n.id}" class="menu-new"><i data-lucide="plus"></i>New book from this note</button>
          </div>
        </details>`}
        ${tool(`data-edit="${n.id}"`, 'pencil', 'Edit')}
        ${inBook ? '' : tool(`data-pin="${n.id}"`, n.pinned ? 'pin-off' : 'pin', n.pinned ? 'Unpin' : 'Pin')}
        ${tool(`data-del="${n.id}"`, 'trash-2', 'Delete', 'danger')}
      </div>
      <h3>${n.pinned ? '<i data-lucide="pin" class="pinned"></i>' : ''}${esc(title)}</h3>
      <div class="note-body" contenteditable="plaintext-only" data-note="${n.id}">${esc(n.text)}${n.id === liveNoteId ? '<span class="interim" contenteditable="false"></span>' : ''}</div>
      <footer><span>${day(n.at)}${linked ? ` <button class="tag" data-open-book="${linked.id}"><i data-lucide="book-open"></i>${esc(linked.title)}</button>` : ''}</span><time>${clock(n.at)}</time></footer>
    </article>`;
}

let search = null; // null = search box closed
function scratchView() {
  const q = (search ?? '').toLowerCase();
  const notes = [...state.scratch].reverse()
    .filter((n) => n.text.toLowerCase().includes(q))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  return `
    <div class="recents-head">
      <h2>Recents</h2>
      <div class="recents-icons">
        ${micButton()}
        <button class="icon-btn" id="search-toggle" aria-label="Search"><i data-lucide="search"></i></button>
        <button class="icon-btn" id="new-note" aria-label="New note"><i data-lucide="plus"></i></button>
        <button class="icon-btn" aria-label="Refresh"><i data-lucide="refresh-cw"></i></button>
      </div>
    </div>
    ${search !== null ? `<input id="note-search" class="search" placeholder="Search notes" value="${esc(search)}">` : ''}
    <p class="recents-hint">${listening ? '<span class="dot"></span>Listening · everything you say goes into one note' : '<kbd>⌥ Space</kbd> to dictate a note · say “build it into a book” when an idea clicks'}${state.scratch.some((n) => n.id === liveNoteId) ? '' : '<span class="interim"></span>'}</p>
    <div class="note-list">${notes.map((n) => noteCard(n)).join('') || `<p class="empty">${q ? 'No notes match.' : 'Nothing yet. Vague is fine.'}</p>`}</div>`;
}

function sectionList(b, s) {
  return `
    <nav class="chapters" aria-label="Draft sections">
      <div class="label">DRAFT</div>
      ${b.sections.map((x) => `<button data-sec="${x.id}" aria-current="${x.id === s.id && b.tab === 'draft'}" class="${x.title ? '' : 'untitled'}">
        <span class="n">${x.title ? chapterNo(b, x) : '§'}</span><span class="t">${esc(x.title || x.paragraphs.find(Boolean)?.split(/\s+/).slice(0, 4).join(' ') || 'Empty section')}</span></button>`).join('')}
      <button class="add" id="add-sec">+ Section</button>
      <p class="hint">Name a section to make it a chapter. Leave it untitled while you’re still finding the shape.</p>
    </nav>`;
}

function notesTab(b) {
  return `
    <div class="ed-scroll"><div class="notes-tab">
      <p class="hint">Everything you know so far: premise, characters, scraps. Plotters outline here; discovery writers skip straight to Draft.</p>
      <div class="note-list">${b.notes.map((n) => noteCard(n, { inBook: true })).join('') || '<p class="empty">No notes yet. Dictate one.</p>'}</div>
      ${!b.notes.some((n) => n.id === liveNoteId) ? '<span class="interim"></span>' : ''}
    </div></div>
    <div class="foot">${micButton()}<span class="where">${listening ? '<span class="dot"></span>Adding to <b>Notes</b>' : '<kbd>⌥ Space</kbd> to dictate a note'}</span>${savedBadge()}</div>`;
}

function draftTab(b, s) {
  const ps = s.paragraphs;
  return `
    <div class="ed-head">
      <h2 class="ch-title" contenteditable="plaintext-only" spellcheck="false" aria-label="Section title" data-placeholder="Untitled section — name it to make a chapter">${esc(s.title)}</h2>
      <div class="seg" role="group" aria-label="Mode">
        <button data-mode="draft" aria-pressed="${state.mode === 'draft'}">Draft</button>
        <button data-mode="revise" aria-pressed="${state.mode === 'revise'}">Revise</button>
      </div>
    </div>
    <div class="paras">
      ${ps.length ? ps.map((p, i) => `
        <div class="para ${flash?.idx === i ? 'flash' : ''}">
          <span class="pn">¶${i + 1}</span>
          <div>${flash?.idx === i && flash.old ? `<del>${esc(flash.old)}</del>` : ''}<p contenteditable="plaintext-only" data-i="${i}">${esc(p)}${i === ps.length - 1 ? '<span class="interim" contenteditable="false"></span>' : ''}</p></div>
        </div>`).join('') : `<p class="empty">Blank page. Turn on the mic and talk it through — it doesn’t have to be good yet.<span class="interim"></span></p>`}
    </div>
    <div class="foot">
      ${micButton()}
      <span class="where">${listening ? `<span class="dot"></span>${state.mode === 'revise' ? 'Listening for edits in' : 'Dictating into'} <b>${esc(sectionLabel(b, s))}</b>` : `<kbd>⌥ Space</kbd> to dictate into <b>${esc(sectionLabel(b, s))}</b>`}</span>
      <button class="btn btn-ghost" id="print"><i data-lucide="printer"></i>Print</button>
      <button class="btn btn-ghost" id="export"><i data-lucide="download"></i>.md</button>
      ${savedBadge()}
    </div>`;
}

function previewTab() {
  return `<div class="ed-scroll preview" id="pages"></div>
    <div class="foot"><span class="where">Continuous preview · 6 × 9 in trim · chapters start on a new page</span>
      <button class="btn btn-ghost" id="print"><i data-lucide="printer"></i>Print</button><button class="btn btn-ghost" id="export"><i data-lucide="download"></i>.md</button></div>`;
}

function authorView() {
  const b = activeBook();
  const s = activeSection();
  const tabs = [['notes', 'Notes', b.notes.length], ['draft', 'Draft', b.sections.length], ['preview', 'Preview', '']];
  return `
    <div class="toolbar">
      <select class="select" id="book" aria-label="Book">
        ${state.books.map((x) => `<option value="${x.id}" ${x.id === b.id ? 'selected' : ''}>${esc(x.title)} · ${esc(x.kind)}</option>`).join('')}
      </select>
      <div class="tabs" role="tablist">${tabs.map(([k, l, c]) => `<button role="tab" data-tab="${k}" aria-selected="${b.tab === k}">${l}${c !== '' ? ` <span>${c}</span>` : ''}</button>`).join('')}</div>
    </div>
    <div class="card author">
      ${sectionList(b, s)}
      <div class="editor">${b.tab === 'notes' ? notesTab(b) : b.tab === 'preview' ? previewTab() : draftTab(b, s)}</div>
    </div>
    <p class="note">Prototype · speech by Chrome’s engine, not Flow’s · your books stay in this browser</p>`;
}

const cheat = ([q, s]) => `<li><q>${esc(q)}</q>${s ? `<small>${s}</small>` : ''}</li>`;

function rail() {
  if (state.page === 'scratchpad') {
    return `
      <div class="card"><h4>From idea to book</h4><ol class="steps">
        <li><b>Spark.</b> Jot or dictate anything here. Vague is fine.</li>
        <li><b>Build.</b> Say <q>build it into a book</q> or tap the button.</li>
        <li><b>Gather.</b> Keep notes on premise, people and scraps.</li>
        <li><b>Draft.</b> Talk it out in loose sections, no chapters needed.</li>
        <li><b>Shape.</b> Name sections to turn them into chapters.</li>
        <li><b>Preview.</b> Read it as pages.</li></ol></div>`;
  }
  if (state.page !== 'author') {
    return `
      <div class="card"><div class="stat"><b>3,738</b>total words</div><div class="stat"><b>108</b>wpm</div><div class="stat" style="margin:0"><b>0</b>day streak</div></div>
      <div class="card"><h4>Voice Profile Unlocked!</h4><p>Discover your unique insights</p><button class="btn btn-orange">Create report</button></div>`;
  }
  const b = activeBook();
  const total = b.sections.reduce((n, s) => n + s.paragraphs.reduce((t, p) => t + words(p), 0), 0);
  const chapters = b.sections.filter((s) => s.title).length;
  const td = state.today.date === today() ? state.today.words : 0;
  const nav = [['open notes / draft / preview', ''], ['new section', 'loose scene, no title'], ['new chapter The Storm', 'titled section'], ['go to chapter 2', ''], ['new paragraph', ''], ['undo', '']];
  const edit = [['replace paragraph 2 with …', ''], ['delete paragraph 3', ''], ['insert after paragraph 1 …', ''], ['in paragraph 2 change nets to lines', '']];
  return `
    <div class="card"><div class="stat"><b>${total.toLocaleString()}</b>words drafted</div><div class="stat"><b>${chapters}</b>${chapters === 1 ? 'chapter' : 'chapters'} · ${b.sections.length} sections</div><div class="stat" style="margin:0"><b>${td.toLocaleString()}</b>dictated today</div></div>
    <div class="card"><h4>Say it</h4><ul class="cheats">${nav.map(cheat).join('')}</ul>
      <h4 style="margin-top:18px">In Revise</h4><p>Paragraph numbers match your printout.</p><ul class="cheats">${edit.map(cheat).join('')}</ul></div>`;
}

function render() {
  const page = state.page;
  document.querySelectorAll('[data-page]').forEach((a) => a.classList.toggle('active', a.dataset.page === page));
  $('#title').textContent = page === 'scratchpad' ? 'Scratchpad' : page === 'author' ? activeBook().title : 'Welcome back, Manasi';
  $('#title').contentEditable = page === 'author' ? 'plaintext-only' : 'false';
  $('#view').innerHTML = page === 'scratchpad' ? scratchView() : page === 'author' ? authorView() : feedView();
  $('#rail').innerHTML = rail();
  setInterim(interim);
  if (where() === 'preview') paginate($('#pages'), activeBook());
  window.lucide?.createIcons();
}

// --- events ---
$('[aria-label="Toggle sidebar"]').addEventListener('click', () => document.body.classList.toggle('nav-open'));
document.querySelectorAll('[data-page]').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault();
  document.body.classList.remove('nav-open');
  liveNoteId = null;
  set({ ...state, page: a.dataset.page });
}));


$('#title').addEventListener('input', (e) => set(withBook((b) => ({ ...b, title: e.target.textContent.trim() || 'Untitled book' })), { render: false }));
$('#title').addEventListener('focusout', () => render());
$('#title').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });

$('#view').addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  const d = t.dataset;
  if (d.sec) set(withBook((b) => ({ ...b, activeSectionId: d.sec, tab: 'draft' })));
  else if (d.tab) set(withBook((b) => ({ ...b, tab: d.tab })));
  else if (d.mode) set({ ...state, mode: d.mode });
  else if (d.build) buildBook(d.build);
  else if (d.openBook) openBook(d.openBook);
  else if (d.add) addToBook(d.add, d.book);
  else if (t.id === 'mic') toggleMic();
  else if (t.id === 'add-sec') addSection('');
  else if (d.edit) document.querySelector(`[data-note="${d.edit}"]`)?.focus();
  else if (d.pin) set({ ...state, scratch: state.scratch.map((x) => (x.id === d.pin ? { ...x, pinned: !x.pinned } : x)) });
  else if (d.del) deleteNote(d.del);
  else if (t.id === 'search-toggle') { search = search === null ? '' : null; render(); $('#note-search')?.focus(); }
  else if (t.id === 'new-note') {
    const n = note('');
    set({ ...state, scratch: [...state.scratch, n] });
    document.querySelector(`[data-note="${n.id}"]`)?.focus();
  } else if (t.id === 'print') printBook();
  else if (t.id === 'export') exportMd();
});

$('#view').addEventListener('change', (e) => {
  if (e.target.id === 'book') set({ ...state, activeBookId: e.target.value });});

// Typing edits: update state without re-rendering, so the caret stays put.
const ownText = (el) => [...el.childNodes].filter((n) => !n.classList?.contains('interim')).map((n) => n.textContent).join('');
$('#view').addEventListener('input', (e) => {
  const p = e.target.closest('[data-i]');
  const n = e.target.closest('[data-note]');
  if (p) {
    const i = Number(p.dataset.i);
    set(withSection((s) => ({ ...s, paragraphs: s.paragraphs.map((x, j) => (j === i ? ownText(p) : x)) })), { render: false });
  } else if (n) {
    const upd = (list) => list.map((x) => (x.id === n.dataset.note ? { ...x, text: ownText(n) } : x));
    set(state.page === 'scratchpad' ? { ...state, scratch: upd(state.scratch) } : withBook((b) => ({ ...b, notes: upd(b.notes) })), { render: false });
  } else if (e.target.classList.contains('ch-title')) {
    set(withSection((s) => ({ ...s, title: e.target.textContent.trim() })), { render: false });
  } else if (e.target.id === 'note-search') {
    search = e.target.value;
    render();
    const box = $('#note-search');
    box.focus();
    box.setSelectionRange(search.length, search.length);
  }
});

// Delete is undoable from the toast for a few seconds.
function deleteNote(id) {
  const inScratch = state.page === 'scratchpad';
  const list = inScratch ? state.scratch : activeBook().notes;
  const i = list.findIndex((x) => x.id === id);
  const gone = list[i];
  const without = list.filter((x) => x.id !== id);
  const restore = () => {
    const back = (l) => [...l.slice(0, i), gone, ...l.slice(i)];
    set(inScratch ? { ...state, scratch: back(state.scratch) } : withBook((b) => ({ ...b, notes: back(b.notes) })));
  };
  set(inScratch ? { ...state, scratch: without } : withBook((b) => ({ ...b, notes: without })));
  toast('Note deleted.', false, ['Undo', restore]);
}
$('#view').addEventListener('focusout', (e) => {
  const n = e.target.closest?.('[data-note]');
  if (n && !ownText(n).trim() && state.page === 'scratchpad') return set({ ...state, scratch: state.scratch.filter((x) => x.id !== n.dataset.note) });
  if (n || e.target.classList?.contains('ch-title')) render();
});

$('#view').addEventListener('keydown', (e) => {
  const p = e.target.closest?.('[data-i]');
  if (e.key === 'Enter' && e.target.classList?.contains('ch-title')) { e.preventDefault(); e.target.blur(); }
  if (e.key === 'Enter' && p && !e.shiftKey) {
    e.preventDefault();
    const i = Number(p.dataset.i);
    set(withSection((s) => ({ ...s, paragraphs: [...s.paragraphs.slice(0, i + 1), '', ...s.paragraphs.slice(i + 1)] })));
    document.querySelector(`[data-i="${i + 1}"]`)?.focus();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.altKey && e.code === 'Space' && where() !== 'feed') { e.preventDefault(); toggleMic(); }
});

function printBook() {
  const b = activeBook();
  $('#print').innerHTML = `<h1>${esc(b.title)}</h1>${b.sections.map((s) => `<section class="${s.title ? 'chapter' : 'scene'}">${s.title ? `<h2>${chapterNo(b, s)}. ${esc(s.title)}</h2>` : '<div class="break">* * *</div>'}${s.paragraphs.map((p) => `<p>${esc(p) || '&nbsp;'}</p>`).join('')}</section>`).join('')}`;
  window.print();
}

function exportMd() {
  const b = activeBook();
  const md = `# ${b.title}\n\n${b.sections.map((s) => `${s.title ? `## ${s.title}` : '* * *'}\n\n${s.paragraphs.join('\n\n')}`).join('\n\n')}\n`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
  a.download = `${b.title.replace(/[^\w -]/g, '').trim() || 'book'}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Test hook: feeds the same path as a final speech result.
window.__flowTest = { final: handleFinal, state: () => state };

render();

// Close an open book menu when clicking anywhere else.
document.addEventListener('click', (e) => {
  document.querySelectorAll('.book-menu[open]').forEach((m) => { if (!m.contains(e.target)) m.open = false; });
});
