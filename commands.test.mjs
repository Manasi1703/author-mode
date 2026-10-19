import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand, applyCommand } from './commands.js';

const ch = { id: 'c', title: 'T', paragraphs: ['One.', 'Two dogs.', 'Three.'] };

test('parses every command', () => {
  assert.deepEqual(parseCommand('New paragraph.'), { type: 'newPara' });
  assert.deepEqual(parseCommand('go to chapter 4'), { type: 'gotoChapter', n: 4 });
  assert.deepEqual(parseCommand('Go to chapter four.'), { type: 'gotoChapter', n: 4 });
  assert.deepEqual(parseCommand('New chapter, The Storm.'), { type: 'newChapter', title: 'The Storm' });
  assert.deepEqual(parseCommand('Replace paragraph two with the sea was calm.'), { type: 'replace', n: 2, text: 'The sea was calm.' });
  assert.deepEqual(parseCommand('delete para 3'), { type: 'delete', n: 3 });
  assert.deepEqual(parseCommand('Insert after paragraph 1, she left.'), { type: 'insertAfter', n: 1, text: 'She left.' });
  assert.deepEqual(parseCommand('In paragraph 2 change dogs to cats.'), { type: 'change', n: 2, from: 'dogs', to: 'cats' });
  assert.deepEqual(parseCommand('Undo.'), { type: 'undo' });
});

test('parses book-building commands', () => {
  assert.deepEqual(parseCommand('Build it into a book.'), { type: 'buildBook' });
  assert.deepEqual(parseCommand('turn this into a book'), { type: 'buildBook' });
  assert.deepEqual(parseCommand('New section.'), { type: 'newSection' });
  assert.deepEqual(parseCommand('go to section 2'), { type: 'gotoSection', n: 2 });
  assert.deepEqual(parseCommand('Show preview.'), { type: 'tab', tab: 'preview' });
  assert.deepEqual(parseCommand('open notes'), { type: 'tab', tab: 'notes' });
});

test('prose is not a command', () => {
  assert.equal(parseCommand('I want to build it into a book someday.'), null);
  assert.equal(parseCommand('The paragraph was long.'), null);
  assert.equal(parseCommand('She wanted to undo it all.'), null);
});

test('applies edits without mutating', () => {
  const r = applyCommand(ch, { type: 'replace', n: 2, text: 'X.' });
  assert.deepEqual(r.chapter.paragraphs, ['One.', 'X.', 'Three.']);
  assert.deepEqual(ch.paragraphs, ['One.', 'Two dogs.', 'Three.']);
  assert.deepEqual(applyCommand(ch, { type: 'delete', n: 1 }).chapter.paragraphs, ['Two dogs.', 'Three.']);
  assert.deepEqual(applyCommand(ch, { type: 'insertAfter', n: 3, text: 'Four.' }).chapter.paragraphs.at(-1), 'Four.');
  assert.equal(applyCommand(ch, { type: 'change', n: 2, from: 'dogs', to: 'cats' }).chapter.paragraphs[1], 'Two cats.');
  assert.deepEqual(applyCommand(ch, { type: 'newPara' }).chapter.paragraphs.at(-1), '');
});

test('errors leave chapter unchanged', () => {
  const r = applyCommand(ch, { type: 'delete', n: 9 });
  assert.equal(r.error, 'There is no paragraph 9 in this chapter');
  assert.equal(r.chapter, ch);
  const c = applyCommand(ch, { type: 'change', n: 2, from: 'zzz', to: 'a' });
  assert.equal(c.error, "Couldn't find “zzz” in paragraph 2");
  assert.equal(c.chapter, ch);
});
