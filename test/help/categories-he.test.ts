/**
 * Parity between the two sources of the categories topic:
 * `src/help/topics/categories.md` (English, what the CLI prints) and
 * `src/help/topics/categories.he.md` (Hebrew, what `docs/README.he.md`'s
 * generated block is filled from).
 *
 * Why this file exists. The Hebrew README's categories section is generated,
 * and `test/docs/parity.test.ts` is — by recorded design — blind to meaning:
 * it compares structure, so a Hebrew document whose largest section was
 * English passed every documentation test this repository had. The fix gave
 * the topic a Hebrew source, and a second source of one document is exactly
 * how drift starts: a category added to the English file and forgotten in the
 * Hebrew one would ship, confidently, in one language only.
 *
 * So everything machine-checkable is checked against ONE authority — the
 * catalogue in code (`src/core/categories.ts`) and the resolved config —
 * never against either Markdown file's own claims:
 *
 * - a category with an entry in one source and not the other fails;
 * - the two rendered tables must carry the same rows — same count, same
 *   name, same tier, same id prefix, row for row — and those rows must be
 *   exactly the enabled categories of the config they were rendered from;
 * - the heading structure must be the same, in the same order;
 * - every catalogue category must have a Hebrew description, so the table's
 *   one language column cannot silently fall back to English.
 *
 * What it cannot check, as ever, is whether the Hebrew PROSE says what the
 * English prose says. That stays a review obligation, exactly as it is for
 * the rest of the mirror (spec §8).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { docLocale, helpTopic } from '../../src/help/index.ts';
import { HE_CATEGORY_DESCRIPTIONS } from '../../src/help/he.ts';
import { CATEGORIES } from '../../src/core/categories.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { runCli } from '../../src/cli/index.ts';
import { headings } from '../helpers/markdown.ts';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { removeTree } from '../helpers/tmp.ts';

const CONFIG = resolveConfig({});
const TOPICS = path.join(import.meta.dirname, '..', '..', 'src', 'help', 'topics');

const HEBREW = /[֐-׿]/;

function source(file: string): string {
  return readFileSync(path.join(TOPICS, file), 'utf8').replaceAll('\r\n', '\n');
}

const en = source('categories.md');
const he = source('categories.he.md');

/** The `### \`name\`` entry headings of a source, in document order. */
function entryNames(markdown: string): string[] {
  return [...markdown.matchAll(/^### `([a-z_]+)`$/gm)].map((m) => m[1]);
}

/** The `(name, tier, prefix)` triples of a rendered category table, in order. */
function tableRows(rendered: string): { name: string; tier: string; prefix: string }[] {
  return [...rendered.matchAll(/^\| `([a-z_]+)` \| (\w+) \| `([A-Z]+-)` \|/gm)]
    .map((m) => ({ name: m[1], tier: m[2], prefix: m[3] }));
}

test('both sources carry the placeholder once, so neither table can be hand-written', () => {
  for (const [file, text] of [['categories.md', en], ['categories.he.md', he]] as const) {
    assert.equal(
      (text.match(/\{\{CATEGORY_TABLE\}\}/g) ?? []).length, 1,
      `${file} must carry {{CATEGORY_TABLE}} exactly once — the table is generated from the ` +
      `resolved config, and a pasted copy would stop tracking the catalogue`,
    );
  }
});

test('the two sources have the same section structure, in the same order', () => {
  const enHeadings = headings(en);
  const heHeadings = headings(he);
  assert.ok(enHeadings.length >= 20, `only ${enHeadings.length} headings in categories.md — ` +
    'the parser is broken, not the document');
  assert.deepEqual(
    heHeadings.map((h) => h.depth), enHeadings.map((h) => h.depth),
    `a section was added or removed in one source only: categories.md has ` +
    `${enHeadings.length} headings, categories.he.md has ${heHeadings.length}. Update both.`,
  );
});

test('every category entry exists in both sources, in the same order', () => {
  const enEntries = entryNames(en);
  const heEntries = entryNames(he);
  assert.ok(enEntries.length > 0, 'no `### `name`` entries found — the extraction is broken');
  assert.deepEqual(
    heEntries, enEntries,
    'the per-category entries diverged between the English and Hebrew sources — a category ' +
    'described in one language only. Add the missing entry, in the same position.',
  );
  // Against the catalogue, not against each other alone: two sources that both
  // forgot the same new category would otherwise agree perfectly.
  assert.deepEqual(
    [...enEntries].sort(), Object.keys(CATEGORIES).sort(),
    'the entry set no longer equals the catalogue — a category was added to ' +
    'src/core/categories.ts without an entry in both topic sources (or an entry outlived ' +
    'its category)',
  );
});

test('the rendered tables carry the same machine facts, derived from the config', () => {
  const enRows = tableRows(helpTopic('categories', CONFIG));
  const heRows = tableRows(helpTopic('categories', CONFIG, 'he'));

  const enabled = Object.values(CONFIG.categories).filter((c) => c.enabled);
  assert.equal(enRows.length, enabled.length,
    'the English table does not have one row per enabled category');
  assert.deepEqual(
    heRows, enRows,
    'the Hebrew table disagrees with the English one about a row — same count, same name, ' +
    'same tier, same id prefix, row for row, is the contract',
  );
  // And the rows really are the config's, with the config's own facts.
  for (const row of enRows) {
    const category = CONFIG.categories[row.name];
    assert.ok(category, `the table carries \`${row.name}\`, which the config does not`);
    assert.equal(row.tier, category.tier, row.name);
    assert.equal(row.prefix, `${category.prefix}-`, row.name);
  }
});

test('every catalogue category has a Hebrew description, and it is Hebrew', () => {
  assert.deepEqual(
    Object.keys(HE_CATEGORY_DESCRIPTIONS).sort(), Object.keys(CATEGORIES).sort(),
    'HE_CATEGORY_DESCRIPTIONS (src/help/he.ts) no longer covers the catalogue exactly — a ' +
    'category without a Hebrew description would ship its English row inside the Hebrew ' +
    'document, which is the defect this file exists to end',
  );
  for (const [name, description] of Object.entries(HE_CATEGORY_DESCRIPTIONS)) {
    assert.match(description, HEBREW, `${name}'s Hebrew description carries no Hebrew`);
  }
});

test('the Hebrew source is Hebrew and the English source is not', () => {
  assert.match(he, HEBREW, 'categories.he.md carries no Hebrew at all — it is not a translation');
  assert.doesNotMatch(en, HEBREW, 'categories.md now carries Hebrew — the sources are swapped ' +
    'or one was pasted over the other');
  // Identifiers stay Latin inside the Hebrew source: every catalogue name is
  // still written as `name` there, which is also what the entry check reads.
  for (const name of Object.keys(CATEGORIES)) {
    assert.ok(he.includes(`\`${name}\``), `categories.he.md never writes \`${name}\``);
  }
});

test('a custom category keeps its own description in the Hebrew table', () => {
  const cfg = resolveConfig({
    categories: { sla: { enabled: true, tier: 'normative', description: 'Latency target' } },
  });
  const rendered = helpTopic('categories', cfg, 'he');
  assert.match(rendered, /^\| `sla` \| normative \| `SLA-` \| Latency target \|$/m,
    'a custom category has no translation; the honest row is the description the project ' +
    'itself wrote');
});

test('a topic with no Hebrew source throws with the path to create, never English', () => {
  assert.throws(
    () => helpTopic('scope', CONFIG, 'he'),
    /the topic "scope" has no "he" source/,
    'a missing translation must fail loudly — a silent English fallback is how the Hebrew ' +
    'README came to carry an English section in the first place',
  );
});

/** `docLocale` is the harness's env pin; each of its three answers is load-bearing. */
test('docLocale reads the pin, refuses a typo, and defaults to English', () => {
  const saved = process.env.MYCONTEXT_DOC_LOCALE;
  try {
    delete process.env.MYCONTEXT_DOC_LOCALE;
    assert.equal(docLocale(), undefined);
    process.env.MYCONTEXT_DOC_LOCALE = 'he';
    assert.equal(docLocale(), 'he');
    process.env.MYCONTEXT_DOC_LOCALE = 'hebrew';
    assert.throws(() => docLocale(), /not a known locale/,
      'a typo silently meaning English would regenerate the Hebrew block in English and ' +
      'every drift test would agree it is fine');
  } finally {
    if (saved === undefined) delete process.env.MYCONTEXT_DOC_LOCALE;
    else process.env.MYCONTEXT_DOC_LOCALE = saved;
  }
});

/**
 * The CLI end of the pin: `mycontext help categories` under the env var is
 * what the generator actually runs for the Hebrew document, so the wiring
 * from environment to topic file is asserted through the real command path.
 * Without the pin the same command must stay English — the CLI is not
 * localized, and this is the assertion that says so.
 */
test('the CLI serves the Hebrew source under the pin and English without it', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-help-he-'));
  const saved = process.env.MYCONTEXT_DOC_LOCALE;
  try {
    delete process.env.MYCONTEXT_DOC_LOCALE;
    let english = '';
    assert.equal(runCli(['help', 'categories'], cwd, (s) => { english += s + '\n'; }), 0);
    assert.doesNotMatch(english, HEBREW, 'the CLI speaks English when nothing asks otherwise');

    process.env.MYCONTEXT_DOC_LOCALE = 'he';
    let hebrew = '';
    assert.equal(runCli(['help', 'categories'], cwd, (s) => { hebrew += s + '\n'; }), 0);
    assert.match(hebrew, HEBREW, 'MYCONTEXT_DOC_LOCALE=he did not reach the topic file');
    assert.match(hebrew, /^\| `constraint` \| normative \| `CONST-` \|/m,
      'the Hebrew rendering lost the machine facts of the table');
  } finally {
    if (saved === undefined) delete process.env.MYCONTEXT_DOC_LOCALE;
    else process.env.MYCONTEXT_DOC_LOCALE = saved;
    removeTree(cwd);
  }
});
