// Voice-command grammar for Author mode. Pure: no DOM, no state.

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const NUM = `(\\d+|${WORDS.join('|')})`;
const PARA = '(?:paragraph|para)';
const END = '[.!?]?$';

const toNum = (s) => (/^\d+$/.test(s) ? Number(s) : WORDS.indexOf(s.toLowerCase()));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const trimEnd = (s) => s.replace(/[.!?,]+$/, '').trim();

const RULES = [
  [new RegExp(`^new ${PARA}${END}`, 'i'), () => ({ type: 'newPara' })],
  [new RegExp(`^go to chapter ${NUM}${END}`, 'i'), (m) => ({ type: 'gotoChapter', n: toNum(m[1]) })],
  [new RegExp(`^new chapter[,:]?\\s+(.+)$`, 'i'), (m) => ({ type: 'newChapter', title: cap(trimEnd(m[1])) })],
  [new RegExp(`^replace ${PARA} ${NUM} with[,:]?\\s+(.+)$`, 'i'), (m) => ({ type: 'replace', n: toNum(m[1]), text: cap(m[2].trim()) })],
  [new RegExp(`^delete ${PARA} ${NUM}${END}`, 'i'), (m) => ({ type: 'delete', n: toNum(m[1]) })],
  [new RegExp(`^insert after ${PARA} ${NUM}[,:]?\\s+(.+)$`, 'i'), (m) => ({ type: 'insertAfter', n: toNum(m[1]), text: cap(m[2].trim()) })],
  [new RegExp(`^in ${PARA} ${NUM},? change (.+?) to (.+?)${END}`, 'i'), (m) => ({ type: 'change', n: toNum(m[1]), from: m[2], to: m[3] })],
  [new RegExp(`^undo${END}`, 'i'), () => ({ type: 'undo' })],
  [new RegExp(`^(?:build|turn|make) (?:it|this) into a book${END}`, 'i'), () => ({ type: 'buildBook' })],
  [new RegExp(`^new section${END}`, 'i'), () => ({ type: 'newSection' })],
  [new RegExp(`^go to section ${NUM}${END}`, 'i'), (m) => ({ type: 'gotoSection', n: toNum(m[1]) })],
  [new RegExp(`^(?:open|show) (?:the )?(notes|draft|preview)${END}`, 'i'), (m) => ({ type: 'tab', tab: m[1].toLowerCase() })],
];

export function parseCommand(text) {
  const t = text.trim();
  for (const [re, build] of RULES) {
    const m = t.match(re);
    if (m) return build(m);
  }
  return null;
}

// Returns { chapter } with a new chapter object, or { chapter: <unchanged>, error }.
export function applyCommand(chapter, cmd) {
  const ps = chapter.paragraphs;
  const fail = (error) => ({ chapter, error });
  const ok = (paragraphs) => ({ chapter: { ...chapter, paragraphs } });
  if (cmd.type === 'newPara') return ok([...ps, '']);
  const i = cmd.n - 1;
  if (!(i >= 0 && i < ps.length)) return fail(`There is no paragraph ${cmd.n} in this chapter`);
  switch (cmd.type) {
    case 'replace': return ok(ps.map((p, j) => (j === i ? cmd.text : p)));
    case 'delete': return ok(ps.filter((_, j) => j !== i));
    case 'insertAfter': return ok([...ps.slice(0, i + 1), cmd.text, ...ps.slice(i + 1)]);
    case 'change': {
      const at = ps[i].toLowerCase().indexOf(cmd.from.toLowerCase());
      if (at < 0) return fail(`Couldn't find “${cmd.from}” in paragraph ${cmd.n}`);
      const p = ps[i].slice(0, at) + cmd.to + ps[i].slice(at + cmd.from.length);
      return ok(ps.map((q, j) => (j === i ? p : q)));
    }
    default: return fail(`Unknown command ${cmd.type}`);
  }
}
