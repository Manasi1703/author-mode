// Lays a book out as 6×9 pages in one continuous scroll.
// ponytail: fills pages by measuring the DOM word by word; fine for a few hundred pages.
// Past that, move to CSS Paged Media (paged.js) or a worker-side line breaker.

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

export function paginate(root, book) {
  root.replaceChildren();
  let n = 0;
  let body;
  const newPage = () => {
    const page = el('div', 'page');
    body = el('div', 'page-body');
    page.append(body, el('div', 'folio', String(++n)));
    root.append(page);
  };
  const overflows = () => body.scrollHeight > body.clientHeight + 1;

  // Title page
  newPage();
  body.classList.add('title-page');
  body.append(el('h1', null, book.title));
  root.lastChild.querySelector('.folio').textContent = '';

  // Titled section = chapter on a new page. Untitled section = scene break, or the opening page.
  let chapter = 0;
  let started = false;
  for (const s of book.sections) {
    if (s.title || !started) {
      newPage();
      if (s.title) body.append(el('div', 'chapter-head', `Chapter ${++chapter}`), el('h2', null, s.title));
    } else {
      place(el('div', 'scene-break', '⁂'));
    }
    started = true;
    s.paragraphs.filter(Boolean).forEach((p, i) => placeText(p, i === 0 ? 'first' : null));
  }
  if (!book.sections.some((s) => s.paragraphs.some(Boolean))) body.append(el('p', 'empty', 'Nothing drafted yet.'));

  function place(node) {
    body.append(node);
    if (overflows() && body.childElementCount > 1) { node.remove(); newPage(); body.append(node); }
  }

  // Fills the current page word by word; the remainder continues unindented on the next page.
  function placeText(text, cls) {
    const p = el('p', cls);
    body.append(p);
    const ws = text.split(/\s+/);
    for (let i = 0; i < ws.length; i++) {
      const prev = p.textContent;
      p.textContent = prev ? `${prev} ${ws[i]}` : ws[i];
      if (overflows()) {
        p.textContent = prev;
        if (!prev) p.remove();
        newPage();
        return placeText(ws.slice(i).join(' '), prev ? 'cont' : cls);
      }
    }
  }
}
