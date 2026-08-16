/**
 * The compaction claim, pinned on every surface that carries it.
 *
 * "Items loaded via /LoadMyContext are not restored after a compaction" was
 * false — verified by executing PreCompact → SessionStart(compact), which
 * restored a manually-loaded item in full — and it shipped on eight surfaces
 * at once: `commands/LoadMyContext.md`, `skills/mycontext/SKILL.md`, the
 * `load_context` tool description in `src/help/topics/capture.md`, a comment
 * in `src/core/inject.ts`, two paragraphs of `README.md`, one of
 * `docs/README.he.md`, and two tests that asserted the false text was
 * present. It survived that long because each copy looked like a
 * cross-reference to a copy someone else had checked.
 *
 * So the ban is enforced tree-wide rather than file by file. A per-file
 * assertion is exactly what was in place before, on two of the eight files,
 * and it is what pinned the lie.
 *
 * The behaviour these sentences describe is proven separately, in
 * `test/hooks/manual-load-restore.test.ts`. This file checks that the
 * documents agree with it; that file checks it is still true.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');

/** LF-normalized: a working tree checked out before `.gitattributes` is CRLF. */
function read(relative: string): string {
  return readFileSync(path.join(REPO, relative), 'utf8').replaceAll('\r\n', '\n');
}

/** Collapsed whitespace: these claims wrap, and a reflow is not a regression. */
function flat(relative: string): string {
  return read(relative).replace(/\s+/g, ' ');
}

const EN = 'README.md';
const HE = path.join('docs', 'README.he.md');

/**
 * Every surface whose text is READ BY someone — a user, or the model — as a
 * statement about how the product behaves: the two READMEs, the slash
 * command, the always-loaded skill, and the help topics, one of which is
 * where the `load_context` tool description comes from.
 *
 * Deliberately NOT the whole tree. `src/core/inject.ts` and two test files
 * now quote the false sentence in order to explain why it is false and to
 * ban it, and a check that fired on its own enforcement — or that forced the
 * correction to be recorded without naming what was corrected — would be
 * worse than no check. The audit, the roadmap and the plans quote it for the
 * same reason and are historical records besides.
 */
const CLAIM_SURFACES = [EN, HE, path.join('commands', 'LoadMyContext.md')];
const CLAIM_DIRS = [path.join('skills', 'mycontext'), path.join('src', 'help', 'topics')];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.md$/.test(entry.name) && statSync(full).size < 2_000_000) out.push(full);
  }
  return out;
}

test('the false compaction claim appears on none of the surfaces that assert it', () => {
  const files = [
    ...CLAIM_SURFACES.map((f) => path.join(REPO, f)),
    ...CLAIM_DIRS.flatMap((d) => walk(path.join(REPO, d))),
  ];
  assert.ok(files.length >= 6, `only ${files.length} surfaces were searched — the walk broke`);

  const offenders = files.filter((f) => {
    const text = readFileSync(f, 'utf8').replace(/\s+/g, ' ');
    return /(?:are|is) not restored after a compaction/i.test(text)
      || /not snapshotted and are not restored/i.test(text)
      || /(?:אינם|אינו) משוחזרים אוטומטית/.test(text);
  });
  assert.deepEqual(
    offenders.map((f) => path.relative(REPO, f)), [],
    'the corrected claim is conditional; these files reverted to the unconditional lie',
  );
});

/**
 * The correction is not "items ARE restored" — that would be a new false
 * claim of the same family, since rationale items never restore, ids beyond
 * the transcript tail are missed and the restore budget can spill. Both
 * documents must therefore carry the condition, not just the reassurance.
 */
test('both READMEs state the corrected claim WITH its condition', () => {
  assert.match(
    flat(EN), /restored after a compaction only\*{0,2} ?\*{0,2}if/i,
    `${EN}: the condition must be in the same sentence as the claim`,
  );
  assert.match(
    flat(HE), /משוחזרים אחרי כיווץ רק אם/,
    `${HE}: the condition must be in the same sentence as the claim`,
  );
});

/**
 * The three conditions, in the section that explains the restored tier. They
 * are asserted individually because a correction that keeps "usually
 * restored" and quietly drops the conditions reads as honest and is not —
 * and each is executed against the real pipeline in
 * test/hooks/manual-load-restore.test.ts.
 */
test('the English restored section names all three conditions', () => {
  const text = flat(EN);
  assert.match(text, /scans the transcript for item ids/i, 'the mechanism');
  assert.match(text, /Rationale items[^.]*are never restored in full/i, 'condition 1');
  assert.match(text, /last 8MB of the transcript/i, 'condition 2');
  assert.match(text, /bounded by its own budget/i, 'condition 3');
});

test('the Hebrew restored section names all three conditions', () => {
  const text = flat(HE);
  assert.match(text, /סורקת את התמליל אחר מזהי פריטים/, 'the mechanism');
  assert.match(text, /פריטי רציונל[^.]*לעולם אינם משוחזרים במלואם/, 'condition 1');
  assert.match(text, /8MB<\/span> האחרונים\s*של התמליל/, 'condition 2');
  assert.match(text, /מוגבל בתקציב משלו/, 'condition 3');
});
