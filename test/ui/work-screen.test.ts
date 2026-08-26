/**
 * The Work screen's DECIDABLE half, tested in Node — and the line where that
 * half stops.
 *
 * Spec §6 names the DOM glue in `app.js` and `screens/*.js` as the untested
 * surface, and `test/ui/viewmodel.test.ts`'s own header says why: testing it
 * would need a browser dependency this project does not have. Nothing below
 * builds an element or stands in a `document`. What it does test is everything
 * `screens/work.js` DECIDES before it touches one:
 *
 *   - how a served field-diff becomes the mockup's two value columns
 *     (`fieldView`), including the two cases the design of record has no
 *     wording for — a stale field and a field with nothing to diff against;
 *   - which fields are drawn as tokens rather than as prose (`MONO_FIELDS`),
 *     checked against `REVISION_FIELDS` so a field the log cannot carry cannot
 *     be classified here either;
 *   - the one composed settlement (`revisionCommand`), pinned to the design of
 *     record's OWN `<code>` line rather than to a copy of it, and refusing
 *     rather than composing a weaker command;
 *   - that every string key the screen names is declared in BOTH tables with
 *     its slots supplied, and that every `work.` key the English table declares
 *     is actually placed by the screen — the two directions of the same fact;
 *   - that no translated string is assigned rather than appended (owner ruling
 *     A1), and that no class name is invented that the mockup's own section
 *     does not use.
 *
 * ── HOW A BROWSER MODULE IS LOADED HERE, AND WHY NOT DIRECTLY ─────────────
 *
 * `test/ui/viewmodel.test.ts` imports `lib/*.js` through a `file://` URL
 * specifier — the form that both type-checks (these modules are outside
 * `tsconfig.json`'s `include`, so a relative specifier is TS7016) and survives
 * a Windows path. That works there because nothing under `lib/` imports
 * anything.
 *
 * A SCREEN cannot be loaded that way. Every screen imports its dependencies by
 * the specifiers the BROWSER resolves — `/lib/command.js`, `/screens/parts.js`
 * — which are root-absolute URL paths, and Node resolves a leading `/` as a
 * filesystem path from the drive root. So the module's own bytes are read, its
 * three root-absolute specifiers are rewritten to `file://` URLs, and the
 * result is imported as a `data:` module. The rewrite is COUNTED and the
 * result re-checked for a surviving `/` specifier, because a rewrite that
 * silently missed one would import a different module graph than the browser
 * runs, which is the only way this file could pass while testing the wrong
 * thing.
 *
 * The three dependencies touch no DOM at module scope — `parts.js` calls
 * `document.createElement` inside its factories and never at load — so no
 * stand-in `document` is needed to import the screen. One is deliberately NOT
 * supplied: supplying one would let this file drift into testing the glue.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { REVISION_FIELDS } from '../../src/core/revision-log.ts';
import { lineDiff, valueLines } from '../../src/core/revision-diff.ts';
import { allowedClasses } from '../helpers/shipped-classes.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');
const WORK_JS = path.join(PUBLIC, 'screens', 'work.js');
const MOCKUP = path.join(REPO, 'docs', 'design', 'web-ui-mockup.html');

const workSource = readFileSync(WORK_JS, 'utf8');

interface DiffLine { mark: '-' | '+' | ' '; text: string }

interface FieldView {
  field: string;
  stale: boolean;
  mono: boolean;
  noCurrent: boolean;
  current: string[];
  proposed: DiffLine[];
}

/**
 * The screen's published interface. Hand-declared rather than inferred, so it
 * is an assertion in its own right: a module that drifts from it fails here
 * rather than in a browser nobody is watching.
 */
interface WorkModule {
  MONO_FIELDS: Set<string>;
  fieldView: (field: {
    field: string; changed?: boolean; noCurrent?: boolean; diff?: DiffLine[];
  }) => FieldView;
  revisionCommand: (rev: { itemId?: string; revisionId?: string }) => string;
  render: (root: unknown, ctx: unknown) => Promise<void>;
}

/** `from '/lib/command.js'` — the browser's own specifier form. */
const ROOT_SPECIFIER = /(\bfrom\s+')\/([^']+)'/g;

async function workModule(): Promise<WorkModule> {
  let rewritten = 0;
  const text = workSource.replace(ROOT_SPECIFIER, (_all, head: string, spec: string) => {
    rewritten += 1;
    return `${head}${pathToFileURL(path.join(PUBLIC, spec)).href}'`;
  });
  assert.equal(rewritten, 3,
    `expected work.js to import three browser modules (/lib/command.js, /lib/palette-defs.js, `
    + `/screens/parts.js); the rewrite matched ${rewritten}. A specifier this pattern cannot see `
    + 'is a module Node would resolve from the drive root, and the import below would fail for a '
    + 'reason that reads like a missing file.');
  assert.ok(!/\bfrom\s+'\//.test(text),
    'a root-absolute specifier survived the rewrite — the module graph imported below would not '
    + 'be the one the browser runs');
  const encoded = Buffer.from(text, 'utf8').toString('base64');
  return (await import(`data:text/javascript;charset=utf-8;base64,${encoded}`)) as WorkModule;
}

/** `<section data-p="work">…</section>`, the design of record for this screen. */
function mockupSection(): string {
  const html = readFileSync(MOCKUP, 'utf8');
  const start = html.indexOf('<section data-p="work"');
  assert.notEqual(start, -1, 'the mockup has no [data-p="work"] section');
  const end = html.indexOf('</section>', start);
  assert.notEqual(end, -1, 'the work section is never closed');
  return html.slice(start, end);
}

/* -------------------------------------------------------------------------- *
 * fieldView — the two columns the mockup draws.
 * -------------------------------------------------------------------------- */

test('fieldView splits a real diff: In force drops the additions, Proposed keeps everything', async () => {
  const { fieldView } = await workModule();
  // The diff is built by the SAME pair the endpoint builds it with, not by a
  // hand-written array: `valueLines` then `lineDiff`, exactly as
  // `read-model-work.ts` composes them. A hand-written diff would test this
  // file's idea of the server's answer rather than the answer.
  const view = fieldView({
    field: 'title',
    changed: false,
    noCurrent: false,
    diff: lineDiff(
      valueLines('title', 'Never log customer email')!,
      valueLines('title', 'Never log customer email or phone')!,
    ) as DiffLine[],
  });

  assert.deepEqual(view.current, ['Never log customer email'],
    'the In force column is the diff without its + lines — a - line and a context line are both '
    + 'text in force today');
  assert.deepEqual(view.proposed, [
    { mark: '-', text: 'Never log customer email' },
    { mark: '+', text: 'Never log customer email or phone' },
  ], 'the Proposed column carries BOTH marks, which is how the mockup draws '
    + '<del>advisory</del><ins>hard</ins> inside one cell');
  assert.equal(view.mono, false, 'a title is prose: a bare <td> around a <bdi>');
  assert.equal(view.stale, false);
});

test('fieldView keeps context lines in both columns — an unchanged line is not a change', async () => {
  const { fieldView } = await workModule();
  const view = fieldView({
    field: 'body',
    diff: lineDiff(['one', 'two', 'three'], ['one', 'TWO', 'three']) as DiffLine[],
  });
  assert.deepEqual(view.current, ['one', 'two', 'three']);
  assert.deepEqual(view.proposed.map((line) => line.mark).join(''), ' -+ ');
});

test('fieldView marks a stale field and still computes its columns — the ROW decides, not the view', async () => {
  const { fieldView } = await workModule();
  const diff = lineDiff(['Use POSIX.'], ['Use POSIX paths everywhere.']) as DiffLine[];
  const stale = fieldView({ field: 'body', changed: true, diff });
  const fresh = fieldView({ field: 'body', changed: false, diff });

  assert.equal(stale.stale, true, '`changed` is the server\'s per-field staleness decoration');
  assert.equal(fresh.stale, false);
  // Deliberately identical: `fieldRow` swaps the two value cells for
  // `work.moved`/`work.blocked`, and a view that had thrown its columns away
  // would make that a decision this file could no longer see being taken.
  assert.deepEqual(stale.current, fresh.current);
  assert.deepEqual(stale.proposed, fresh.proposed);
});

test('fieldView on a field with no current value leaves the In force column empty', async () => {
  const { fieldView } = await workModule();
  // What the server sends when there is nothing to diff against: `noCurrent`
  // true and a diff of additions only (`valueLines` returned null, so `before`
  // was []). The screen draws the em dash this design uses for "no value here";
  // it must not draw an empty cell, which reads as a bug.
  const view = fieldView({
    field: 'extra',
    noCurrent: true,
    diff: lineDiff([], valueLines('extra', { directive: 'do' })!) as DiffLine[],
  });
  assert.equal(view.noCurrent, true);
  assert.deepEqual(view.current, []);
  assert.deepEqual(view.proposed, [{ mark: '+', text: 'directive: do' }]);
});

test('fieldView tolerates a field the endpoint sent without a diff', async () => {
  const { fieldView } = await workModule();
  const view = fieldView({ field: 'tags' });
  assert.deepEqual(view.current, []);
  assert.deepEqual(view.proposed, []);
  assert.equal(view.mono, true);
});

test('MONO_FIELDS names only fields a revision can actually carry', async () => {
  const { MONO_FIELDS } = await workModule();
  for (const field of MONO_FIELDS) {
    assert.ok((REVISION_FIELDS as readonly string[]).includes(field),
      `${field} is drawn as a token cell but is not a revision field — no /api/revisions answer `
      + 'can ever produce that row');
  }
  // The split the mockup draws, both ways round: `tags` is a token list in a
  // `.m` cell, `title` is prose in a <bdi>. A change to either is a change to
  // the design of record and needs the owner, not an edit here.
  assert.ok(MONO_FIELDS.has('tags'));
  assert.ok(!MONO_FIELDS.has('title'));
  assert.ok(!MONO_FIELDS.has('body'));
});

/* -------------------------------------------------------------------------- *
 * revisionCommand — the one composed settlement.
 * -------------------------------------------------------------------------- */

test('revisionCommand composes the design of record\'s own line, byte for byte', async () => {
  const { revisionCommand } = await workModule();
  // Read out of the mockup rather than copied into this file. A copy would go
  // stale the moment the design of record changed its command and nothing
  // would say so — which is the defect the citation form exists to end, one
  // layer down.
  const code = /<code>([^<]+)<\/code>/.exec(mockupSection());
  assert.ok(code, 'the work section draws no <code> command');
  assert.equal(
    revisionCommand({ itemId: 'RULE-never-log-customer-email', revisionId: 'REV-8c21' }),
    code![1],
  );
});

test('revisionCommand refuses a revision with no revisionId rather than composing a weaker line', async () => {
  const { revisionCommand } = await workModule();
  // `--revision` is an OPTIONAL flag in the catalogue, so the weaker line is a
  // valid command: it settles whichever revision the log offers first. On a
  // queue of two that is a coin toss the reader never sees, which is exactly
  // the failure a per-revision review screen must not ship.
  assert.throws(() => revisionCommand({ itemId: 'RULE-x' }), /revisionId/);
  assert.throws(() => revisionCommand({ itemId: 'RULE-x', revisionId: '' }), /revisionId/);
  // A missing id is refused one layer down, by `commandFor`'s required-arg rule.
  assert.throws(() => revisionCommand({ revisionId: 'REV-8c21' }), /required/);
});

test('revisionCommand quotes through the one quoting implementation', async () => {
  const { revisionCommand } = await workModule();
  assert.equal(
    revisionCommand({ itemId: 'RULE with spaces', revisionId: 'REV-8c21' }),
    'mycontext review promote-revision "RULE with spaces" --revision REV-8c21 --yes',
  );
});

/* -------------------------------------------------------------------------- *
 * The screen against the two string tables and against the mockup.
 * -------------------------------------------------------------------------- */

async function table(language: string): Promise<Record<string, string>> {
  const file = path.join(PUBLIC, 'strings', `${language}.js`);
  const mod = await import(pathToFileURL(file).href) as { strings: Record<string, string> };
  return mod.strings;
}

/** Every key `work.js` names, by the two shapes a screen can name one in. */
function keysNamed(): { key: string; args: string | null }[] {
  const out: { key: string; args: string | null }[] = [];
  for (const m of workSource.matchAll(/ctx\.t(?:Flat)?\('([^']+)'/g)) {
    const after = workSource.slice(m.index + m[0].length);
    const open = after.indexOf('{');
    const close = after.indexOf(')');
    out.push({ key: m[1]!, args: open !== -1 && (close === -1 || open < close) ? after : null });
  }
  for (const m of workSource.matchAll(/screenHead\(ctx, root, '([^']+)', '([^']+)', '([^']+)'\)/g)) {
    for (const key of [m[1]!, m[2]!, m[3]!]) out.push({ key, args: null });
  }
  // The three column heads and the three help lines are named through a `for`
  // over a literal array, which the `ctx.t('…')` pattern above cannot see.
  for (const m of workSource.matchAll(/for \(const key of \[([^\]]+)\]\)/g)) {
    for (const q of m[1]!.matchAll(/'([^']+)'/g)) out.push({ key: q[1]!, args: null });
  }
  return out;
}

test('every string key the Work screen names is declared in both tables, with its slots supplied', async () => {
  const en = await table('en');
  const he = await table('he');
  const used = keysNamed();

  // A scanner that finds nothing reads exactly like a clean file.
  assert.ok(used.length >= 16,
    `the scan found ${used.length} key(s) in work.js; the screen names sixteen. A collapse means `
    + 'the patterns stopped matching, not that the screen stopped naming keys.');

  // The grammar has ONE parser and this is it. Eight files used to carry a
  // private scanner instead, all of them predating emphasis, and every one
  // read `{b:` as a substitution named `b:...` the day emphasis landed.
  const { slots: slotsOf } = await import(
    new URL('../../src/ui/public/lib/i18n.js', import.meta.url).href
  ) as { slots: (template: string) => string[] };

  for (const { key, args } of used) {
    assert.ok(key in en, `work.js names ${key}, missing from the English table`);
    assert.ok(key in he, `work.js names ${key}, missing from the Hebrew table`);
    // Both tables, not only English: `t()` throws on a substitution the caller
    // did not pass, and it throws in whichever language the reader chose.
    for (const template of [en[key]!, he[key]!]) {
      for (const slot of slotsOf(template)) {
        assert.ok(args !== null && args.includes(`${slot}:`),
          `${key} declares a {${slot}} slot that the call site does not supply — t() throws and `
          + 'the screen blanks');
      }
    }
  }
});

test('every work. key the English table declares is placed by the screen', async () => {
  const en = await table('en');
  const declared = Object.keys(en).filter((key) => key.startsWith('work.')).sort();
  const named = new Set(keysNamed().map((u) => u.key));
  // The other direction of the same fact. `strings-parity` proves the two
  // tables agree with the mockup's `data-t` set; it cannot prove the screen
  // ever draws one. A key declared for this screen and placed nowhere is a
  // sentence of the design of record that silently does not render.
  assert.deepEqual(declared.filter((key) => !named.has(key)), [],
    'these work. keys are declared and drawn nowhere');
  assert.equal(declared.length, 13,
    `the English table declares ${declared.length} work. key(s); it has been 13 since this screen `
    + 'was written. A new one is a new sentence on this screen and needs placing.');
});

test('no translated string is assigned — t() returns nodes and they are appended (ruling A1)', async () => {
  // `t()` returns Node[]. Assigning one to `textContent` renders `[object
  // Object]`; assigning `tFlat()` to `innerHTML` would destroy the `.m` spans
  // that carry the direction isolation, which is the mockup's own standing
  // rule. Neither is reachable by any other test: this module's DOM half is
  // never evaluated.
  assert.ok(!/textContent\s*=\s*ctx\.t/.test(workSource),
    'a translated value is assigned to textContent');
  assert.ok(!/innerHTML/.test(workSource), 'innerHTML has no legitimate use in a screen module');
  assert.ok(/\.append\(\.\.\.ctx\.t\(/.test(workSource),
    'the screen appends no translated nodes at all — the scan above is checking nothing');
});

test('the screen invents no class the mockup\'s own work section does not use', async () => {
  const section = mockupSection();
  const drawn = new Set<string>();
  for (const m of section.matchAll(/class="([^"]+)"/g)) {
    for (const token of m[1]!.trim().split(/\s+/)) drawn.add(token);
  }
  assert.ok(drawn.size >= 10, `the mockup scan found ${drawn.size} class token(s) — too few to be `
    + 'the work section, so the extraction is broken rather than the screen clean');

  const written: string[] = [];
  for (const m of workSource.matchAll(/\bel\('[a-z0-9]+',\s*'([^']*)'/g)) written.push(m[1]!);
  assert.ok(written.length >= 8,
    `the work.js scan found ${written.length} class string(s); the screen writes at least eight`);

  for (const value of written) {
  const allowed = allowedClasses(drawn);
    for (const token of value.trim().split(/\s+/)) {
      // `allowed`, not `drawn`: the mockup's classes UNION what styles.css
      // actually styles. See test/helpers/shipped-classes.ts — the app is what
      // gets built now, so a NEW class with a real rule is ordinary development;
      // a typo still has no rule anywhere and still fails here.
      assert.ok(allowed.has(token),
        `work.js writes class "${token}", which <section data-p="work"> never uses. A class the `
        + 'design of record does not draw is either a typo or a decision the owner has not taken.');
    }
  }

  // The two composites the whole screen turns on, pinned as whole attribute
  // values rather than as loose tokens: a `td` that took `m` and `stale`
  // separately, or a chip that took `chip` without `warn`, would satisfy the
  // token check above and draw the wrong thing.
  for (const composite of ['m stale', 'chip warn']) {
    assert.ok(section.includes(`class="${composite}"`),
      `the mockup no longer draws class="${composite}" — the design of record moved`);
    assert.ok(written.includes(composite),
      `work.js no longer writes the "${composite}" pair the mockup draws`);
  }
});
