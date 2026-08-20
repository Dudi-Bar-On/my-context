/**
 * Parity between the English and Hebrew UI string tables, and between both of
 * them and the design of record, in the spirit of `test/docs/parity.test.ts`.
 *
 * BOTH DIRECTIONS, on both axes, because a one-directional check misses the
 * two failures the corpus instruction names by name — a string INVENTED (in a
 * table, absent from the mockup) and a string DROPPED (in the mockup, absent
 * from a table). "en is a subset of he" would pass while either happened.
 *
 * Every check that walks a set COLLECTS and asserts once at the end. The
 * catalogue-completeness test in this repository asserts inside its loop, so it
 * throws on the first offender and never reaches the rest of the run: a Hebrew
 * omission stays invisible until the English one is fixed, one file per run.
 * A parity failure is worth reporting whole.
 *
 * What this test cannot do, stated so a green suite is not mistaken for
 * verified Hebrew: it compares KEY COVERAGE and SLOT STRUCTURE only, never
 * translation freshness. A Hebrew value left stale by an English edit passes
 * every assertion here. Translation freshness is a review obligation, not a
 * tested one.
 *
 * When an assertion fails, the fix is bringing the tables and the mockup into
 * line — never deleting the assertion. If the mockup and the product are agreed
 * to diverge, the mockup changes first and this test goes green by that route.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');
const MOCKUP = path.join(REPO, 'docs', 'design', 'web-ui-mockup.html');
const STRINGS = path.join(REPO, 'src', 'ui', 'public', 'strings');

/**
 * The string tables are plain browser ES modules, deliberately untyped and
 * outside `tsconfig.json`'s `include`, so that the browser and `node --test`
 * load the same bytes with no build step. A URL specifier is what lets this
 * TypeScript file import them without `allowJs` — and it is also the only form
 * that survives a Windows path.
 */
type Table = { lang: string; dir: string; strings: Record<string, string> };
async function table(language: 'en' | 'he'): Promise<Table> {
  const url = new URL(`file://${path.join(STRINGS, `${language}.js`).replaceAll('\\', '/')}`);
  return (await import(url.href)) as Table;
}

/**
 * Every string key the design of record declares. It declares them through THREE
 * attributes, not one: `data-t` carries an element's text, `data-t-aria` carries
 * its `aria-label`, and `data-t-title` carries its `title`. Both of the latter are
 * ATTRIBUTES, so the text path can never reach them — which is exactly why every
 * one of them used to stay English in the Hebrew UI, and why the mockup now names
 * them as keys. Reading only `data-t` would leave fifteen outside this comparison
 * in BOTH directions: droppable from the tables, and droppable from the mockup,
 * with nothing here to notice either.
 *
 * `-title` was added on 2026-08-20 with the four titles it keys, and this pattern
 * did not match it: `data-t(?:-aria)?="` requires `="` immediately after `-aria`
 * or after `data-t`, so `data-t-title="…"` fell through and four keys were
 * invisible here in both directions — the very hole the `-aria` branch exists to
 * close, reopened one attribute along.
 *
 * The count is DERIVED, never pinned: it was 326 at the plan's third pass, 329 on
 * disk before the owner's six rulings, 351 after them and 370 after the second
 * mockup pass, and a test that remembers a number fails for the wrong reason the
 * next time a screen gains a label.
 */
function mockupKeys(): Set<string> {
  const html = readFileSync(MOCKUP, 'utf8');
  return new Set([...html.matchAll(/\sdata-t(?:-aria|-title)?="([^"]+)"/g)].map((m) => m[1]));
}

/** The `{m:…}` runs in a value, in order — the LTR-isolated identifiers. */
function slots(value: string): string[] {
  return [...value.matchAll(/\{m:([^}]*)\}/g)].map((m) => m[1]);
}

/**
 * The VALUE slots in a value, sorted — whole markers, not bare names.
 *
 * Whole markers because the two forms are not interchangeable. `{lines}` is
 * substituted as a text node; `{mv:session}` is substituted into a monospace,
 * bidi-isolated element, the same treatment `{m:…}` gets, and it is what an id,
 * a branch, a commit SHA, a path, a glob or a scope takes. A Hebrew value
 * carrying `{branch}` where the English carries `{mv:branch}` would substitute
 * the right characters and silently drop the isolation — the defect that put
 * `Already governing {scope}` on screen where `Already governing
 * {m:src/billing/**}` had shipped.
 *
 * SORTED, unlike `slots()` above, which compares positionally. A value slot
 * legitimately MOVES between the two languages: `strip.inSync` is
 * `origin/{mv:branch}` in English and `{mv:branch} ב‑origin` in Hebrew, on
 * purpose, because a bare `origin/` before an isolated run resolves to the
 * wrong visual order in an RTL paragraph. What must not vary is WHICH slots a
 * key has. Order is the mockup's business; membership is this test's.
 *
 * This never matches inside an `{m:…}` run: after `{m` comes `:`, so the name
 * character class fails at the colon and no `}` is ever reached. The converse
 * holds too — `/\{m:([^}]*)\}/` does not match `{mv:…}`, because after `{m`
 * comes `v` — so the assertion above keeps comparing exactly what it always did.
 */
function valueSlots(value: string): string[] {
  return [...value.matchAll(/\{(?:mv:)?[A-Za-z][A-Za-z0-9]*\}/g)].map((m) => m[0]).sort();
}

test('the mockup is readable and declares keys — the guard on every check below', () => {
  const design = mockupKeys();
  assert.ok(
    design.size > 0,
    `no data-t key found in ${MOCKUP}. Every parity assertion below compares against `
      + 'this set, so an empty one would make all of them pass while saying nothing.',
  );
});

test('en and he string tables declare identical key sets — in both directions', async () => {
  const en = await table('en');
  const he = await table('he');
  const enKeys = new Set(Object.keys(en.strings));
  const heKeys = new Set(Object.keys(he.strings));
  assert.deepEqual([...enKeys].filter((k) => !heKeys.has(k)).sort(), [], 'in en, missing from he');
  assert.deepEqual([...heKeys].filter((k) => !enKeys.has(k)).sort(), [], 'in he, missing from en');
});

test('the tables and the mockup declare the same keys — in both directions', async () => {
  const en = await table('en');
  const design = mockupKeys();
  const shipped = new Set(Object.keys(en.strings));
  // DROPPED: the mockup shows a string the product does not have. The
  // instruction calls this "quietly rendering a weaker version".
  assert.deepEqual(
    [...design].filter((k) => !shipped.has(k)).sort(),
    [],
    `declared by the mockup (${design.size} keys), missing from the string tables `
      + `(${shipped.size} keys)`,
  );
  // INVENTED: a string with no design entry. Every such string is also an
  // untranslated one, which is why this is a parity test and not a lint.
  assert.deepEqual(
    [...shipped].filter((k) => !design.has(k)).sort(),
    [],
    `in the string tables (${shipped.size} keys), not shown by the mockup `
      + `(${design.size} keys) — invent a screen, invent a string`,
  );
});

test('the {m:…} slots match key for key, so an identifier is isolated in both languages', async () => {
  const en = await table('en');
  const he = await table('he');
  // The literal text between the braces is the SAME in both languages: it is an
  // identifier, a path or a command, not prose. A Hebrew value that drops the
  // slot renders the identifier as RTL text; one that renames it names a symbol
  // that does not exist.
  const mismatched: { key: string; en: string[]; he: string[] }[] = [];
  for (const [key, value] of Object.entries(en.strings)) {
    const heValue = he.strings[key];
    // A key missing from he is the first test's failure, not this one's; it is
    // skipped here so both reports survive the same run.
    if (typeof heValue !== 'string') continue;
    const a = slots(value);
    const b = slots(heValue);
    if (a.length !== b.length || a.some((s, i) => s !== b[i])) mismatched.push({ key, en: a, he: b });
  }
  assert.deepEqual(mismatched, [], 'monospace slots differ between the two tables');
});

test('the value slots match key for key, so no substitution silently misses', async () => {
  const en = await table('en');
  const he = await table('he');
  // Until this existed, NOTHING here checked value slots: only `{m:…}` was
  // compared, and a Hebrew value that dropped or renamed a `{name}` passed the
  // whole suite. That failure is louder on screen than a dropped `{m:…}` —
  // t() substitutes by NAME, so a renamed slot leaves a literal `{lines}` in
  // the sentence, and a dropped one loses the number the sentence is about.
  //
  // Comparing the two SORTED lists is a both-directions check per key: a slot
  // only English has and a slot only Hebrew has each change one of the lists.
  // Key coverage itself is the first test's job, not this one's.
  const mismatched: { key: string; en: string[]; he: string[] }[] = [];
  for (const [key, value] of Object.entries(en.strings)) {
    const heValue = he.strings[key];
    if (typeof heValue !== 'string') continue;
    const a = valueSlots(value);
    const b = valueSlots(heValue);
    if (a.length !== b.length || a.some((s, i) => s !== b[i])) mismatched.push({ key, en: a, he: b });
  }
  assert.deepEqual(mismatched, [], 'value slots differ between the two tables');
});

test('each table declares its direction and language', async () => {
  const en = await table('en');
  const he = await table('he');
  assert.equal(en.dir, 'ltr');
  assert.equal(en.lang, 'en');
  assert.equal(he.dir, 'rtl');
  assert.equal(he.lang, 'he');
});

test('no string value is empty — an empty translation is a dropped string', async () => {
  const empty: string[] = [];
  for (const language of ['en', 'he'] as const) {
    const { strings } = await table(language);
    for (const [key, value] of Object.entries(strings)) {
      if (typeof value !== 'string' || value.trim() === '') empty.push(`${language}:${key}`);
    }
  }
  assert.deepEqual(empty, [], 'empty string values');
});
