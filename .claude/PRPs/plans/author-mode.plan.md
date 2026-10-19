# Plan: Author Mode (toggle on Flow Dictation)

## Summary
A working browser prototype of Wispr Flow's Dictation page with an **Author mode** toggle. When the toggle is on, the dictation feed becomes a manuscript: Library → Book → Chapters. The user can speak prose into the active chapter (Draft), speak edits that target numbered paragraphs (Revise), and print or export. It is for any author, not one book. Robert Greene's story (he dictated *The Law of the Sublime* one-handed after a stroke) is only the inspiration.

## User Story
As an author who writes by voice (by preference, or because typing hurts or isn't possible),
I want Flow to collect my dictation into chapters of a book and let me revise it by voice,
so that I end up with a manuscript, not a feed of timestamped fragments.

## Problem → Solution
Flow Dictation is a flat feed, grouped by date ("My boss wants to", 10:38am). → Turn on "Author mode": the same page shows a book's chapters, and dictation appends to the active chapter. Voice commands navigate and edit paragraphs by number.

## Metadata
- **Complexity**: Medium
- **Source PRD**: N/A
- **Estimated Files**: 5 + copied assets
- **Decisions made with user**: toggle on Dictation (not a new page); working prototype (real mic); generic authors (not Greene-only); match the real Flow UI using the logo kit plus the app's own tokens and fonts.

---

## UX Design

### Before (real Flow, dark)
```
┌ sidebar ─────┬ main ─────────────────────────────────────────┬ stats ──────┐
│ |||| Flow    │ Welcome back, Manasi                          │ 3,738 words │
│ ▣ Dictation  │ [banner: Transform works anywhere you write]  │ 108 wpm     │
│ ○ Notetaker  │ SEPTEMBER 30, 2026                        🔍  │ 0 day streak│
│ ...          │ ┌───────────────────────────────────────────┐ │             │
│ Scratchpad   │ │10:38am  to make it like the woman has...  │ │             │
│              │ │10:38am  My boss wants me to               │ │             │
└──────────────┴─┴───────────────────────────────────────────┴─┴─────────────┘
```

### After (Author mode ON)
```
┌ sidebar ─────┬ main ───────────────────────────────────────────┬ book stats ──┐
│ |||| Flow    │ Dictation              [ Author mode ●━ ]       │ 48,210 words │
│ ▣ Dictation  │ ┌ Library ▾ ─────────────────────────────────┐  │ Ch 3: 2,104  │
│ ○ Notetaker  │ │ The Salt Year (novel) ▾          + Book    │  │ today: 812   │
│ ...          │ ├ CHAPTERS ──┬───────────────────────────────┤  │──────────────│
│              │ │ 1 Arrival  │ Ch 3 · The Harbor     DRAFT ▾ │  │ Say:         │
│              │ │ 2 Ledger   │ ¶1 The boats came in late...  │  │ "new para"   │
│              │ │▶3 Harbor   │ ¶2 She counted the nets...    │  │ "go to ch 4" │
│              │ │ + Chapter  │ ¶3 ▍(live interim text, dim)  │  │ "replace ¶2  │
│              │ │            │ ● Dictating into Ch 3   ⌥Space│  │  with ..."   │
│              │ │            │ Print ¶ · Export .md  Saved ✓ │  │              │
│              │ └────────────┴───────────────────────────────┘  │              │
└──────────────┴─────────────────────────────────────────────────┴──────────────┘
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Dictation page header | "Welcome back" + banner | Toggle "Author mode" at top right of main | Toggle state persisted |
| Feed | Date-grouped rows | Book/chapter editor with numbered ¶ | Feed returns when the toggle is off |
| Mic | Global Fn hotkey (native app) | On-screen mic button plus `Alt+Space` **toggle** (press once to start, once to stop) | Toggle, not hold, so one hand or no hands work |
| Draft | n/a | Final speech results append to the active chapter. Interim results show dim and inline. | Sentence auto-capitalise and spacing |
| Revise | n/a | Mode switch Draft/Revise. In Revise, utterances are parsed as commands. | Targeted ¶ flashes, old text shown struck for 3s (undo) |
| Navigation | mouse | Also voice: "go to chapter 4", "new chapter The Storm" | Works in both modes |
| Output | copy row | Print (numbered ¶, serif, chapter headings) + Export .md | Print ¶ numbers map 1:1 to Revise commands |

---

## Mandatory Reading (all paths absolute)

| Priority | File | Why |
|---|---|---|
| P0 | `/private/tmp/claude-501/-Users-Manasi-Desktop-fun/d0bcc58e-5637-4e60-ba6b-dc13517bb045/images/1.png` | User's screenshot of real Flow Dictation (dark). Layout source of truth. |
| P0 | `/Users/Manasi/Downloads/Wispr Flow Logo Kit 2/wispr-flow-svg.svg` | Official logo. Symbol = 5 rounded bars (paths at x 0–126). Wordmark "Wispr Flow" fill `#1A1A1A`; recolor to `currentColor` for dark. The sidebar shows symbol + "Flow" only. |
| P1 | `/Users/Manasi/Downloads/Wispr Flow Logo Kit 2/logo-symbol-light.png`, `logo-full-*.png` | Fallback raster |
| P1 | `/Applications/Wispr Flow.app/Contents/Resources/app.asar` | Real app bundle. Already extracted to `scratchpad/flowapp/x/.webpack/renderer/` (may be wiped; re-extract with `npx -y @electron/asar extract`). |

No separate Wispr **brand kit** exists in `~/Downloads`; only the logo kit. Brand tokens below were taken from the shipped app instead.

## Brand Tokens (from the shipped Flow app bundle)

Fonts bundled in the app (`.webpack/renderer/*.ttf`):
| File | Family | Use |
|---|---|---|
| `cb14938e92ef0b1bf90d.ttf` / `e4243fbb192c313e12c7.ttf` | Figtree (variable, Regular/Italic) | All UI text |
| `815805779a78df014494.ttf` / `06d4c1811f89842c6550.ttf` | EB Garamond Regular/Italic | Display serif (banner "Transform works anywhere you write", stat numbers "3,738") and the manuscript body |
| `d1bf36ee37625e7af2c5.ttf` | Google Sans Code | Shortcut keycaps |
| `4afb283bba326df875f6.ttf` | Manrope | unused |

Palette (CSS custom properties in the bundle):
```
--vast-950:#1a1a1a  --vast-925:#202020  --vast-910:#2a2a29  --vast-900:#30302f
--vast-875:#343432  --vast-800:#464544  --vast-700:#5b5b59  --vast-600:#71716e
--vast-500:#878683  --vast-400:#9d9c98  --vast-300:#b3b2ad  --vast-200:#c8c8c2
--vast-100:#deddd7  --vast-50:#e9e8e1
--sand-50:#fcfcfb   --sand-600:#eeebe3  --sand-950:#4d4a42
--glow-300:#ffa946 (orange CTA "Create report")  --glow-400:#d7892a  --glow-500:#af6a06
--success-500:#4fbf78  --destructive-500:#ee6a6a  --dawn-700:#a26ec1 (audio meter)
dark: --background:var(--shade-black) --foreground:var(--sand-50) --muted-foreground:var(--vast-300)
light: --background:var(--sand-50) --card:#fff --primary:var(--vast-950) --border:var(--sand-600)
```
Screenshot mapping (dark): app chrome/sidebar `--vast-950`; main panel `#1e1e1e`≈`--vast-925` with a 1px `--vast-875` border and ~24px radius; cards `--vast-925` with a `--vast-875` border and 16px radius; active nav item `--vast-900`; body text `--sand-50`; timestamps `--vast-400`; date labels are uppercase and letter-spaced, `--vast-300`.

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `wispr-flow-experiment/index.html` | CREATE | App shell: sidebar, main, stats rail; feed view + author view |
| `wispr-flow-experiment/styles.css` | CREATE | Tokens above, `@font-face`, layout, `@media print` |
| `wispr-flow-experiment/app.js` | CREATE | State, rendering, Web Speech wiring, persistence |
| `wispr-flow-experiment/commands.js` | CREATE | Pure ES module: `parseCommand(text) → {type,...} \| null`, `applyCommand(book, cmd)`. No DOM, so it can be tested. |
| `wispr-flow-experiment/commands.test.mjs` | CREATE | `node --test` self-check for the parser |
| `wispr-flow-experiment/assets/` | COPY | 4 TTFs (Figtree ×2, EB Garamond ×2, Google Sans Code) + `wispr-flow-svg.svg` |

## NOT Building
- A real Flow integration (no native hotkey, no system-wide dictation, no Flow API).
- Cloud sync or accounts. Data lives in `localStorage` with a JSON export as a backup.
- AI rewrite/Transforms of prose. Revise uses deterministic commands only.
- Other sidebar pages (Notetaker, Insights…). They render as inert, faithful nav items.
- .docx export (.md only). Version history beyond one-step undo.
- Light theme (the screenshot is dark). Tokens stay in place so it's cheap to add later.

---

## Step-by-Step Tasks

### Task 1: Copy assets
- **ACTION**: `mkdir assets`; copy the 5 TTFs from the extracted bundle (re-extract if the scratchpad was wiped) and `wispr-flow-svg.svg`.
- **GOTCHA**: These are Wispr's licensed files. They are fine for a local prototype. **Do not publish them publicly** without swapping in Google Fonts (Figtree and EB Garamond are both on Google Fonts, so the swap is 1 line).
- **VALIDATE**: `ls assets` shows 6 files.

### Task 2: Shell (index.html + styles.css)
- **IMPLEMENT**: 3-column grid (sidebar 340px / main / rail 340px), matching the screenshot. Sidebar items: Dictation (active), Notetaker, Insights, Dictionary, Snippets, Style, Transforms, Scratchpad, the "Set up Notetaker" card, Invite/Free month/Settings/Help. Logo = inline SVG symbol + "Flow" in Figtree 600. Top-right icons: sun, bell, user.
- **IMPLEMENT**: Main header shows "Welcome back, {name}" (feed view) or "Author mode" (author view), with a switch `role="switch" aria-checked` at the right.
- **MIRROR**: Brand Tokens section. Serif numerals in the rail (EB Garamond, ~40px) + Figtree label.
- **VALIDATE**: Side-by-side screenshot vs 1.png at 2000×1254; spacing within about 8px.

### Task 3: Feed view (toggle off)
- **IMPLEMENT**: Static sample rows grouped by date (generic text, not the user's private dictations), so the toggle has a real "before".
- **VALIDATE**: Toggle off → the feed looks like the screenshot.

### Task 4: Data model + persistence (app.js)
- **IMPLEMENT**:
  ```
  state = { authorMode, activeBookId, books: [{ id, title, kind, chapters: [{ id, title, paragraphs: [string] }], activeChapterId }] }
  ```
  Seed 3 sample books (novel "The Salt Year", memoir "Kitchen Table Years", nonfiction "Slow Cities"), each with 2–3 short chapters. Save to `localStorage['flow-author-v1']`, debounced 300ms. "Saved ✓" indicator. Wrap every read and write in try/catch: storage that fails shows "Not saved — export to keep your work" and never loses in-memory text.
- **GOTCHA**: Rebuild state immutably (spread), as the user's rules require.
- **VALIDATE**: Dictate, reload → text persists.

### Task 5: Author view render
- **IMPLEMENT**: Book picker (select + "+ Book"), chapter list (click, "+ Chapter", double-click to rename), editor showing `¶n` gutter numbers in EB Garamond 20px/1.6. Paragraphs are `contenteditable` so one-hand typing fixes work. Sticky footer: "● Dictating into Ch 3 · The Harbor", mic button, `Alt+Space` keycap, Draft/Revise segmented control, Print, Export .md. The rail shows book words, chapter words, words today, and a voice-command cheat sheet.
- **VALIDATE**: Switching chapters swaps the editor, and the indicator always names the active chapter.

### Task 6: Speech (Web Speech API)
- **IMPLEMENT**: `const SR = window.SpeechRecognition || window.webkitSpeechRecognition`; `continuous=true`, `interimResults=true`, `lang='en-US'`. Auto-restart on `onend` while the toggle is on (Chrome stops after silence). Interim text renders dim at the end of the active chapter. On final results: run `parseCommand` (navigation commands work in both modes, edit commands only in Revise). If it's not a command and the mode is Draft, append it to the last paragraph with a space, or start a new ¶ after "new paragraph".
- **ERROR**: Unsupported browser → banner "Voice needs Chrome or Edge"; the editor still works. `not-allowed` → "Allow microphone access" with steps. `network` → "Speech service unreachable" + retry.
- **GOTCHA**: Needs `http://localhost` or https, not `file://`. Serve with `python3 -m http.server 5173`.
- **VALIDATE**: Speak in Chrome → text lands in the active chapter. Revoke mic → friendly message.

### Task 7: commands.js + test
- **IMPLEMENT** grammar (case-insensitive, accepts "paragraph"/"para", digits or number words one–twenty):
  | Utterance | Command |
  |---|---|
  | `new paragraph` | `{type:'newPara'}` |
  | `go to chapter 4` | `{type:'gotoChapter', n:4}` |
  | `new chapter <title>` | `{type:'newChapter', title}` |
  | `replace paragraph 2 with <text>` | `{type:'replace', n:2, text}` |
  | `delete paragraph 2` | `{type:'delete', n:2}` |
  | `insert after paragraph 2 <text>` | `{type:'insertAfter', n:2, text}` |
  | `in paragraph 2 change <a> to <b>` | `{type:'change', n:2, from, to}` |
  | `undo` | `{type:'undo'}` |
  | anything else | `null` |
  `applyCommand(chapter, cmd)` returns `{chapter, error?}`. An out-of-range ¶ returns `error:"There is no paragraph 9 in this chapter"` and nothing changes.
- **VALIDATE**: `node --test commands.test.mjs` passes (one case per row + out-of-range + "change" phrase not found).

### Task 8: Revise feedback + undo
- **IMPLEMENT**: After an edit, scroll to the ¶ and flash it with `--glow-300` at 20% opacity. Show the old text struck through inline for 3s. Keep a one-step undo stack per chapter (voice "undo" or ⌘Z).
- **VALIDATE**: "replace paragraph 2 with test" → ¶2 changes and flashes; "undo" restores it.

### Task 9: Print + export
- **IMPLEMENT**: `@media print`: hide the chrome, use EB Garamond 12pt, put each chapter on a new page, and print a `¶n` margin number on every paragraph using CSS counters. This is the same numbering Revise uses. Export .md: `# Book`, `## Chapter`, paragraphs separated by blank lines, downloaded via Blob.
- **VALIDATE**: Print preview shows numbers that match the screen. The exported .md opens cleanly.

---

## Testing Strategy
| Test | Input | Expected |
|---|---|---|
| parse replace | "Replace paragraph two with The sea was calm." | `{type:'replace',n:2,text:'The sea was calm.'}` |
| parse goto | "go to chapter 4" | `{type:'gotoChapter',n:4}` |
| non-command | "the paragraph was long" | `null` (must not hijack prose) |
| apply out of range | delete n:9 on 3 ¶ | error, chapter unchanged |
| change missing | change "zzz"→"a" | error "Couldn't find 'zzz' in paragraph 2" |

Edge cases: empty chapter (Draft creates ¶1); prose that starts with "new chapter" in Draft mode is treated as a command (documented on the cheat sheet); storage full or blocked; mic denied; Safari/Firefox (no SR).

## Validation Commands
```bash
cd /Users/Manasi/Desktop/fun/wispr-flow-experiment
node --test commands.test.mjs            # EXPECT: all pass
python3 -m http.server 5173              # then open http://localhost:5173 in Chrome
```
Browser: chrome-devtools MCP → screenshot at 2000×1254 vs 1.png; toggle; simulate final results through `window.__flowTest.final("...")` (a test hook in app.js that pushes into the same handler as speech); list console errors = 0.

## Acceptance Criteria
- [ ] Toggle off looks like the screenshot (layout, fonts, colors, logo).
- [ ] Toggle on: library with 3 sample books; chapters; active-chapter indicator is always visible.
- [ ] Real mic dictation appends to the active chapter in Chrome.
- [ ] All 8 voice commands work; non-commands are never swallowed in Draft mode.
- [ ] One-step undo works by voice.
- [ ] Mic toggles with `Alt+Space` (no holding needed).
- [ ] Print ¶ numbers match the on-screen ¶ numbers; .md export works.
- [ ] Reload keeps the work; a storage failure is surfaced, never silent.
- [ ] `node --test` is green; 0 console errors.

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Chrome SR stops after silence | High | Medium | Auto-restart in `onend` while active |
| Command grammar eats prose | Medium | High | Edit commands only run in Revise; Draft runs only nav plus "new paragraph" |
| Wispr fonts/logo published publicly | Low | Medium | Local only; swap to Google Fonts before any public share |
| SR accuracy ≠ Flow's | Certain | Low | Labelled "prototype — Chrome speech engine" in the footer |

## Notes
Confidence for a single-pass build: 8/10. The main unknown is how pixel-faithful the shell is to 1.png, which the screenshot comparison checks.
