// @basis TASK-a-glyph-makes-a-kind-recognisable-without-reading-in-every, DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn, TASK-a-chip-s-data-g-never-renders-on-six-of-the-eight-chip-kinds
/**
 * **THE APP'S GLYPH SET, CENSUSED — so that "one glyph per meaning" stops
 * being a sentence in an item and becomes a measurement.**
 *
 * `TASK-a-glyph-makes-a-kind-recognisable-without-reading-in-every` (owner
 * instruction 2026-09-13) names four constraints. Three of them are the kind a
 * gate can hold, and this file holds them:
 *
 *   1. **One glyph per meaning**, never two, and never a glyph meaning one
 *      thing on one screen and something else on another.
 *   2. **The glyph is never the only carrier** — every case keeps its word.
 *   3. **Both string tables, and bidi.**
 *
 * The fourth — *a glyph is not a substitute for a missing sentence* — is a
 * judgement about WHICH surfaces get one, and no assertion can make it. It is
 * discharged in the lane's report, which names the two cases the design of
 * record marked "fix the sentence first" and says they were not glyphed.
 *
 * ── WHY A CENSUS AND NOT A LIST OF EXPECTED GLYPHS ────────────────────────
 *
 * A test that checked "conversations.js contains U+1F4CC" would pass while the
 * app grew a second pin somewhere else meaning something different, which is
 * the failure the constraint is written against. So `census()` READS THE
 * SHIPPED SOURCE — every emoji-presentation mark that reaches a string literal
 * anywhere under `src/ui/public/**`, through TypeScript's own parser so that a
 * mark inside a comment is not counted and a mark written as a `\u{...}` escape
 * IS (`app.js`'s `LEVEL_ICON` writes all three of its icons that way, and a
 * grep would have missed every one).
 *
 * `GLYPHS` below is then the measured truth, one entry per mark, and the
 * assertion is EQUALITY IN BOTH DIRECTIONS. A new emoji anywhere in the UI
 * fails because it is not in the ledger. A glyph deleted from the file that
 * declared it fails because the ledger still names it. Neither direction can be
 * satisfied by editing this file alone without saying what the mark means.
 *
 * ── THE ONE COLLISION THIS FOUND, RECORDED RATHER THAN ASSERTED AWAY ──────
 *
 * The design of record (`reports/2026-09-13-the-ui-reviewed-round-two.md`, "The
 * glyph survey and proposed set") proposed U+26A0 for Doctor's `warning` level
 * and did not census `app.js`. `app.js`' `LEVEL_ICON` has drawn a context-usage
 * ladder for weeks — U+26A0 `caution`, U+1F536 `warning`, U+1F480 `critical` —
 * so **the English word "warning" is now answered by two different marks**:
 * U+1F536 in the strip and U+26A0 on Doctor. Both marks still mean exactly one
 * thing each (attention-short-of-critical; the strip's third band), so nothing
 * on screen is ambiguous — but the ledger records it as a `clash` and
 * `KNOWN_CLASHES` is a CEILING, so a second one cannot arrive quietly. Settling
 * it means repainting a shell band the owner reads daily, which is his call.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');

registerHooks({
  resolve: (specifier, context, nextResolve) => {
    if (specifier.startsWith('/')) {
      return { url: pathToFileURL(path.join(PUBLIC, specifier)).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

// ── The census ──────────────────────────────────────────────────────────────

/**
 * An EMOJI MARK: a codepoint in the pictographic planes, or any codepoint
 * followed by U+FE0F, which is the request for emoji presentation and is
 * therefore the author saying "this is a glyph" out loud.
 *
 * U+2705 is listed by hand because it is default-emoji-presentation and carries
 * no selector, so neither half of the rule above reaches it. U+25A6 is the
 * `table` anchor mark and is deliberately TEXT presentation — the survey chose
 * a geometric mark over the bar-chart emoji so that `table` could not be read
 * as `chart` — so it is named here too rather than silently falling outside a
 * census that is supposed to be total.
 *
 * A FUNCTION and not a shared `RegExp`, because `/g` carries `lastIndex` and a
 * shared global regex tested twice answers differently the second time. That is
 * the shape that makes a gate green on a bad build.
 */
const NAMED = ['✅', '▦'];
const mark = (): RegExp => new RegExp(`(?:[\\u{1F000}-\\u{1FAFF}]|${NAMED.join('|')}|.\\uFE0F)`, 'gu');
const hasMark = (text: string): boolean => mark().test(text);

/** Every `.js` the browser is served, `lib/vendor/**` excluded — it is not ours. */
function sources(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === 'vendor') continue;
        walk(full);
      } else if (entry.endsWith('.js')) out.push(full);
    }
  };
  walk(PUBLIC);
  return out;
}

/** `glyph` -> the set of files whose string literals carry it, relative to PUBLIC. */
function census(): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  for (const file of sources()) {
    const rel = path.relative(PUBLIC, file).split(path.sep).join('/');
    const tree = ts.createSourceFile(
      file, readFileSync(file, 'utf8'), ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS,
    );
    const add = (text: string): void => {
      for (const hit of text.matchAll(mark())) {
        const glyph = hit[0]!;
        if (!found.has(glyph)) found.set(glyph, new Set());
        found.get(glyph)!.add(rel);
      }
    };
    const walk = (node: ts.Node): void => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node.text);
      if (ts.isTemplateExpression(node)) {
        add(node.head.text + node.templateSpans.map((s) => s.literal.text).join(''));
      }
      ts.forEachChild(node, walk);
    };
    walk(tree);
  }
  return found;
}

// ── The ledger ──────────────────────────────────────────────────────────────

type Verdict = 'sole' | 'clash';

interface Entry {
  /** The mark itself, written as escapes so a diff cannot hide a variation selector. */
  readonly glyph: string;
  /** What it means, in this app, everywhere it appears. */
  readonly meaning: string;
  /** The string key of the WORD it sits beside. */
  readonly word: string;
  /** Files whose literals carry it, relative to `src/ui/public/`. */
  readonly files: readonly string[];
  readonly verdict: Verdict;
}

/**
 * **THE MEASURED TRUTH, 2026-09-13.** Equality in both directions against
 * `census()`; see this file's header for why that is the whole design.
 */
const GLYPHS: readonly Entry[] = [
  // ── The four anchor kinds — the case the owner asked about ──────────────
  {
    glyph: '\u{1F4CC}',
    meaning: 'anchor kind: a point a person marked by hand',
    word: 'conv.anchors.kind.note',
    files: ['screens/conversations.js'],
    verdict: 'sole',
  },
  {
    glyph: '▦',
    meaning: 'anchor kind: tabular data',
    word: 'conv.anchors.kind.table',
    files: ['screens/conversations.js'],
    verdict: 'sole',
  },
  {
    glyph: '\u{1F4C4}',
    meaning: 'anchor kind: a report',
    word: 'conv.anchors.kind.report',
    files: ['screens/conversations.js'],
    verdict: 'sole',
  },
  {
    glyph: '⚖️',
    meaning: 'anchor kind: a ruling',
    word: 'conv.anchors.kind.ruling',
    files: ['screens/conversations.js'],
    verdict: 'sole',
  },
  // ── Doctor's three severity card headings ───────────────────────────────
  {
    glyph: '\u{1F6D1}',
    meaning: 'severity: the highest, and it stops you',
    word: 'doc.error',
    files: ['screens/doctor.js'],
    verdict: 'sole',
  },
  {
    glyph: '⚠️',
    meaning: 'attention, short of critical',
    word: 'doc.warning',
    files: ['screens/doctor.js', 'app.js'],
    verdict: 'clash',
  },
  {
    glyph: 'ℹ️',
    meaning: 'severity: informational',
    word: 'doc.notice',
    files: ['screens/doctor.js'],
    verdict: 'sole',
  },
  // ── The shell strip's context-usage ladder, which predates all of this ──
  {
    glyph: '\u{1F536}',
    meaning: 'context band: the third of four',
    word: 'strip.level.warning',
    files: ['app.js'],
    verdict: 'clash',
  },
  {
    glyph: '\u{1F480}',
    meaning: 'context band: the fourth of four',
    word: 'strip.level.critical',
    files: ['app.js'],
    verdict: 'sole',
  },
  // ── Library ─────────────────────────────────────────────────────────────
  {
    glyph: '✅',
    meaning: 'the file exists and is written',
    word: 'tu.written',
    files: ['screens/library.js', 'strings/en.js', 'strings/he.js'],
    verdict: 'sole',
  },
];

/**
 * The English words answered by MORE THAN ONE mark. A ceiling, never a
 * shopping list: `screen-literals`' ledger rule applies here unchanged — a
 * defect is recorded so it can be found and fixed and so that it cannot grow.
 */
const KNOWN_CLASHES = ['warning'];

// ── A stand-in document, the shape `test/ui/status-screen.test.ts` uses ─────

interface FakeNode {
  tag: string;
  className: string;
  textContent: string;
  attributes: Record<string, string>;
  children: FakeNode[];
}
interface FakeElement extends FakeNode {
  append: (...nodes: (FakeNode | string)[]) => void;
  setAttribute: (name: string, value: string) => void;
}

function textNode(text: string): FakeNode {
  return { tag: '#text', className: '', textContent: text, attributes: {}, children: [] };
}
function element(tag: string): FakeElement {
  const node: FakeElement = {
    tag,
    className: '',
    textContent: '',
    attributes: {},
    children: [],
    append: (...nodes) => {
      for (const n of nodes) node.children.push(typeof n === 'string' ? textNode(n) : n);
    },
    setAttribute: (name, value) => { node.attributes[name] = value; },
  };
  return node;
}
const doc = { createElement: element, createTextNode: textNode };

function textOf(node: FakeNode): string {
  return node.textContent + node.children.map(textOf).join('');
}
function descendants(node: FakeNode): FakeNode[] {
  return node.children.flatMap((child) => [child, ...descendants(child)]);
}

const browserModule = async <T>(...segments: string[]): Promise<T> =>
  (await import(pathToFileURL(path.join(PUBLIC, ...segments)).href)) as T;

interface PartsModule {
  glyphed: (g: string, nodes: FakeNode[]) => FakeElement;
  screenHead: (
    ctx: unknown, root: FakeElement, titleKey: string, verdictKey: string, subKey: string,
    verdictChip?: string,
  ) => void;
}
interface I18nModule {
  t: (
    strings: Record<string, string>, key: string, subs: Record<string, string | number>,
    document: typeof doc,
  ) => FakeNode[];
}

const parts = (): Promise<PartsModule> => browserModule<PartsModule>('screens', 'parts.js');
const i18n = (): Promise<I18nModule> => browserModule<I18nModule>('lib', 'i18n.js');
const table = (lang: string): Promise<{ strings: Record<string, string> }> =>
  browserModule<{ strings: Record<string, string> }>('strings', `${lang}.js`);

/** Runs `body` with the stand-in `document` installed, exactly as `parts.js` expects. */
async function inDocument<T>(body: () => Promise<T> | T): Promise<T> {
  const globals = globalThis as unknown as { document?: unknown };
  const had = Object.hasOwn(globals, 'document');
  globals.document = doc;
  try {
    return await body();
  } finally {
    if (!had) delete globals.document;
  }
}

// ── 1. One glyph per meaning ───────────────────────────────────────────────

test('every emoji mark shipped by the UI is declared, and every declaration is shipped', () => {
  const measured = census();

  // DIRECTION ONE: nothing renders a mark the ledger has not ruled on.
  const declared = new Set(GLYPHS.map((entry) => entry.glyph));
  const undeclared = [...measured.keys()].filter((glyph) => !declared.has(glyph)).sort();
  assert.deepEqual(undeclared, [],
    'a glyph reached the UI with no entry in GLYPHS. Say what it means and where, or take it '
    + 'out — an undeclared mark is how a set stops being small enough to hold in the head');

  // DIRECTION TWO, and it is the one that catches a DELETION. A ledger entry
  // whose glyph no longer appears where it says it does is a stale claim, and a
  // stale claim is what makes the first direction feel safe while it is not.
  for (const entry of GLYPHS) {
    const where = measured.get(entry.glyph);
    assert.notEqual(where, undefined,
      `GLYPHS declares ${JSON.stringify(entry.glyph)} (${entry.meaning}) and nothing under `
      + 'src/ui/public/ draws it any more');
    assert.deepEqual([...where!].sort(), [...entry.files].sort(),
      `${JSON.stringify(entry.glyph)} (${entry.meaning}) is drawn by a different set of files `
      + 'than GLYPHS declares');
  }
});

test('no mark carries two meanings', () => {
  const byGlyph = new Map<string, string[]>();
  for (const entry of GLYPHS) {
    byGlyph.set(entry.glyph, [...(byGlyph.get(entry.glyph) ?? []), entry.meaning]);
  }
  for (const [glyph, meanings] of byGlyph) {
    assert.equal(meanings.length, 1,
      `${JSON.stringify(glyph)} means ${meanings.length} things: ${meanings.join(' / ')}`);
  }
});

test('two marks answer to the word "warning", and that is the only clash', async () => {
  const strings = (await table('en')).strings;
  const byWord = new Map<string, string[]>();
  for (const entry of GLYPHS) {
    const word = strings[entry.word];
    assert.notEqual(word, undefined, `${entry.word} is not in the English table`);
    byWord.set(word!, [...(byWord.get(word!) ?? []), entry.glyph]);
  }
  const clashing = [...byWord].filter(([, marks]) => marks.length > 1).map(([word]) => word).sort();
  assert.deepEqual(clashing, KNOWN_CLASHES,
    'the set of English words answered by more than one mark has changed. KNOWN_CLASHES is a '
    + 'CEILING: a new clash is a defect, and a clash that gets settled must come OFF the list');

  // And the entries that admit it must be the ones carrying the `clash`
  // verdict — a defect recorded in one place and denied in another is worse
  // than one recorded nowhere.
  const admitted = GLYPHS.filter((entry) => entry.verdict === 'clash')
    .map((entry) => strings[entry.word]!);
  assert.deepEqual([...new Set(admitted)].sort(), KNOWN_CLASHES,
    'a `clash` verdict and the measured clash disagree');
});

// ── 2. The glyph is never the only carrier ─────────────────────────────────

test('glyphed() draws the mark, hides it, and puts the word after it', async () => {
  const { glyphed } = await parts();
  const { t } = await i18n();
  const en = (await table('en')).strings;
  const run = await inDocument(
    () => glyphed('\u{1F4CC}', t(en, 'conv.anchors.kind.note', {}, doc)),
  );

  assert.equal(run.className, 'gw',
    'the pair is wrapped, and the wrapper is what styles.css isolates for bidi');
  const glyph = run.children[0]!;
  assert.equal(glyph.className, 'g');
  assert.equal(textOf(glyph), '\u{1F4CC}');
  assert.equal(glyph.attributes['aria-hidden'], 'true',
    'without this a screen reader announces "pushpin" before the word — which is exactly what '
    + 'the retired verdict tick did on nineteen screens');
  assert.equal(textOf(run), '\u{1F4CC}you marked this',
    'the word is the accessible name and it is still there');
});

test('glyphed() refuses a mark with no word', async () => {
  const { glyphed } = await parts();
  await inDocument(() => {
    assert.throws(() => glyphed('\u{1F4CC}', []),
      /was given no word to sit beside/,
      'a glyph alone fails a screen reader and a reader who does not know the convention; the '
      + 'tolerant version is a silent regression no census can see');
  });
});

// ── 3. Both string tables ──────────────────────────────────────────────────

test('every word a glyph sits beside is in BOTH tables, and the Hebrew is a translation', async () => {
  const en = (await table('en')).strings;
  const he = (await table('he')).strings;
  for (const entry of GLYPHS) {
    assert.ok(typeof en[entry.word] === 'string' && en[entry.word] !== '',
      `${entry.word} — the word beside ${entry.meaning} — is missing from en.js`);
    assert.ok(typeof he[entry.word] === 'string' && he[entry.word] !== '',
      `${entry.word} — the word beside ${entry.meaning} — is missing from he.js. A glyph whose `
      + 'word is untranslated ships English under the Hebrew mirror, which is the glyph becoming '
      + 'the only carrier for half the readers');
    assert.notEqual(he[entry.word], en[entry.word],
      `${entry.word} is byte-identical in both tables — an untranslated key wearing a `
      + 'translation\'s clothes');
  }
});

test('no glyph stands in for a word inside a string, in either table', async () => {
  const carrying = (strings: Record<string, string>): string[] =>
    Object.entries(strings).filter(([, value]) => hasMark(value)).map(([key]) => key).sort();
  // The one exception, named: `tu.donemeans` EXPLAINS what the Library tick
  // means and quotes it to do so. A sentence about a glyph is prose; a glyph
  // standing in for a word is the failure this looks for.
  assert.deepEqual(carrying((await table('en')).strings), ['tu.donemeans']);
  assert.deepEqual(carrying((await table('he')).strings), ['tu.donemeans']);
});

// ── The precondition: the screen-heading verdicts ──────────────────────────

test('screenHead draws a chip and no bare text node, in both languages', async () => {
  const { screenHead } = await parts();
  const { t } = await i18n();
  for (const lang of ['en', 'he']) {
    const strings = (await table(lang)).strings;
    const ctx = {
      t: (key: string, subs: Record<string, string | number> = {}) => t(strings, key, subs, doc),
    };
    const root = element('section');
    await inDocument(() => { screenHead(ctx, root, 'doc.h', 'doc.v', 'doc.sub'); });
    const verdict = descendants(root).find((node) => node.className === 'verdict');
    assert.notEqual(verdict, undefined, `${lang}: the heading lost its verdict`);
    assert.equal(verdict!.children.length, 1,
      `${lang}: the verdict holds the chip and nothing else — a second child is the emoji back`);
    assert.equal(verdict!.children[0]!.className, 'chip index',
      `${lang}: the neutral chip. A meaning hue here would be the health claim in colour, which `
      + 'DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn caps at five anyway');
    assert.equal(textOf(verdict!), strings['doc.v'],
      `${lang}: the chip carries the keyed sentence, not a paraphrase`);
    assert.ok(!hasMark(textOf(verdict!)), `${lang}: a mark is back in a screen heading`);
  }
});

test('not one screen passes a glyph to screenHead, and screenHead has no parameter for one', () => {
  const partsSource = readFileSync(path.join(PUBLIC, 'screens', 'parts.js'), 'utf8');
  const signature = /export function screenHead\(([^)]*)\)/.exec(partsSource);
  assert.notEqual(signature, null, 'screenHead is no longer declared here');
  assert.equal(signature![1]!.replace(/\s+/g, ' ').trim(),
    "ctx, root, titleKey, verdictKey, subKey, verdictChip = 'index'",
    'a `glyph` parameter is back — the tick was retired by REMOVING the door, not by asking '
    + 'every caller politely not to use it');

  // And every call site, read off the shipped screens rather than listed here.
  const calls: { file: string; args: string }[] = [];
  for (const file of sources()) {
    const rel = path.relative(PUBLIC, file).split(path.sep).join('/');
    for (const hit of readFileSync(file, 'utf8').matchAll(/\n\s*screenHead\(([^;]*)\);/g)) {
      calls.push({ file: rel, args: hit[1]!.replace(/\s+/g, ' ') });
    }
  }
  assert.equal(calls.length, 17, 'the screen count moved — 17 screens call screenHead');
  for (const call of calls) {
    assert.ok(!hasMark(call.args), `${call.file} passes a glyph to screenHead: ${call.args}`);
  }
  // Exactly one screen spends a meaning hue, and it is the one whose own
  // 2026-08-26 ruling gave it: Status.
  const hued = calls.filter((call) => /'(gov|ok|warn|crit|carry)'$/.test(call.args.trim()));
  assert.deepEqual(hued.map((call) => call.file), ['screens/status.js']);
});

test('no screen verdict string carries a mark, in either table', async () => {
  for (const lang of ['en', 'he']) {
    const strings = (await table(lang)).strings;
    const verdicts = Object.entries(strings).filter(([key]) => /^[a-z]+\.v$/.test(key));
    assert.ok(verdicts.length >= 15, `${lang}: the verdict keys vanished`);
    for (const [key, value] of verdicts) {
      assert.ok(!hasMark(value), `${lang}: ${key} carries a mark: ${value}`);
    }
  }
});

// ── Bidi ───────────────────────────────────────────────────────────────────

test('the glyph run is isolated, without which the Hebrew mirror misplaces every mark', () => {
  const css = readFileSync(path.join(PUBLIC, 'styles.css'), 'utf8');
  assert.match(css, /\n\.gw\{unicode-bidi:isolate\}/,
    'emoji are bidi-neutral (Unicode class ON), so an unisolated mark beside a Latin word inside '
    + 'a Hebrew paragraph resolves against the PARAGRAPH and lands on the wrong end of the pair '
    + '— on every row of a 684-row list');
  assert.match(css, /\n\.g\{margin-inline-end:/,
    'the space between mark and word belongs to the stylesheet, so no two call sites can '
    + 'disagree about whether there is one');
  assert.match(css, /\n\.verdict \.chip::before\{content:none\}/,
    '.chip.index honours attr(data-g); a verdict chip names none, and without this the bare '
    + '.chip::before draws a lone leading space inside the border');
});
