/**
 * The Doctor screen's DECIDABLE half, tested in Node — and the line where that
 * half stops.
 *
 * Spec §6 names the DOM glue in `app.js` and `screens/*.js` as the untested
 * surface. Nothing below builds an element or stands in a `document`. What it
 * tests is everything `screens/doctor.js` DECIDES before it touches one:
 *
 *   - how the checker's own sentence is split at the literals HE delimited
 *     (`messageRuns`), asserted against messages produced by the REAL checks
 *     rather than against hand-typed copies of them, and led by the invariant
 *     that makes "the producer's words, unedited" checkable — joining the runs
 *     reproduces the message byte for byte;
 *   - which findings a card claims and in what order, and the single place an
 *     absent item becomes `null` (`cardRows`), which is what the em dash and
 *     `repairCommandFor` both read;
 *   - the composed, never-run repair line (`cardCommands`) — pinned to the
 *     design of record's OWN `<code>` rather than to a copy of it, deduped in
 *     first-ask order, and quoted through the one implementation;
 *   - that `dead_scope` earns no command, because the MOCKUP composes none for
 *     it either — the fact behind three entries in the parity ledger;
 *   - that no translated string is assigned rather than appended (ruling A1),
 *     and that no class is invented that `<section data-p="doctor">` does not
 *     draw;
 *   - that the five `doc.d*` sample sentences are declared and deliberately
 *     unplaced, so a SIXTH cannot appear without somebody deciding about it.
 *
 * ── HOW A BROWSER MODULE IS LOADED HERE, AND WHY NOT DIRECTLY ─────────────
 *
 * The same way `test/ui/work-screen.test.ts` loads its screen, for the reason
 * its header gives: a screen imports by the specifiers the BROWSER resolves
 * (`/lib/viewmodel.js`, `/screens/parts.js`), and Node resolves a leading `/`
 * from the drive root. So the module's own bytes are read, its root-absolute
 * specifiers are rewritten to `file://` URLs, and the result is imported as a
 * `data:` module. The rewrite is COUNTED and the result re-checked for a
 * surviving `/` specifier: a rewrite that silently missed one would import a
 * different module graph than the browser runs, which is the only way this
 * file could pass while testing the wrong thing.
 *
 * Neither dependency touches the DOM at module scope, so no stand-in
 * `document` is needed. One is deliberately NOT supplied — supplying one would
 * let this file drift into testing the glue.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  checkCorpusSize, checkDeadScopes, checkOrphanRelations, FALLBACK_CEILING_WARN_ITEMS,
  type Finding,
} from '../../src/doctor/checks.ts';
import { resolveConfig } from '../../src/core/config.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');
const DOCTOR_JS = path.join(PUBLIC, 'screens', 'doctor.js');
const MOCKUP = path.join(REPO, 'docs', 'design', 'web-ui-mockup.html');

const doctorSource = readFileSync(DOCTOR_JS, 'utf8');

interface Run { mono: boolean; text: string }
interface Row { code: string; item: string | null; message: string }

/**
 * The screen's published interface. Hand-declared rather than inferred, so it
 * is an assertion in its own right: a module that drifts from it fails here
 * rather than in a browser nobody is watching.
 */
interface DoctorModule {
  messageRuns: (message: unknown) => Run[];
  cardRows: (groups: Map<string, Finding[]>, level: string) => Row[];
  cardCommands: (rows: Row[]) => string[];
  render: (root: unknown, ctx: unknown) => Promise<void>;
}

/** `from '/lib/viewmodel.js'` — the browser's own specifier form. */
const ROOT_SPECIFIER = /(\bfrom\s+')\/([^']+)'/g;

async function doctorModule(): Promise<DoctorModule> {
  let rewritten = 0;
  const text = doctorSource.replace(ROOT_SPECIFIER, (_all, head: string, spec: string) => {
    rewritten += 1;
    return `${head}${pathToFileURL(path.join(PUBLIC, spec)).href}'`;
  });
  assert.equal(rewritten, 2,
    'expected doctor.js to import two browser modules (/lib/viewmodel.js, /screens/parts.js); '
    + `the rewrite matched ${rewritten}. A specifier this pattern cannot see is a module Node `
    + 'would resolve from the drive root, and the import below would fail for a reason that '
    + 'reads like a missing file.');
  assert.ok(!/\bfrom\s+'\//.test(text),
    'a root-absolute specifier survived the rewrite — the module graph imported below would not '
    + 'be the one the browser runs');
  const encoded = Buffer.from(text, 'utf8').toString('base64');
  return (await import(`data:text/javascript;charset=utf-8;base64,${encoded}`)) as DoctorModule;
}

/** `<section data-p="doctor">…</section>`, the design of record for this screen. */
function mockupSection(): string {
  const html = readFileSync(MOCKUP, 'utf8');
  const start = html.indexOf('<section data-p="doctor"');
  assert.notEqual(start, -1, 'the mockup has no [data-p="doctor"] section');
  const end = html.indexOf('</section>', start);
  assert.notEqual(end, -1, 'the doctor section is never closed');
  return html.slice(start, end);
}

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'A', status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: '', steps: [], observations: [], relations: [],
    layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

/**
 * A REAL `dead_scope` message, from the real check, over a repository that
 * genuinely has no files — which is exactly the shape `.demo-corpus` produces
 * and therefore exactly what the parity gate looks at.
 *
 * Not a hand-typed copy. A copy goes stale the moment the checker rewords its
 * sentence, and this file would keep passing while the screen split a message
 * nobody sends any more.
 */
function realDeadScopeMessage(): string {
  const repoRoot = mkdtempSync(path.join(tmpdir(), 'myctx-doctor-'));
  try {
    const findings = checkDeadScopes(
      repoRoot, [item({ id: 'CONST-migrations-run-forward-only', scope: ['src/db/**'] })],
      resolveConfig({}),
    );
    assert.equal(findings.length, 1, 'a repository with no files must make every glob dead');
    return findings[0]!.message;
  } finally {
    removeTree(repoRoot);
  }
}

/* -------------------------------------------------------------------------- *
 * messageRuns — the producer's sentence, split at the literals he delimited.
 * -------------------------------------------------------------------------- */

test('messageRuns reproduces every real message byte for byte — "unedited" is checked, not claimed',
  async () => {
    const { messageRuns } = await doctorModule();
    const messages = [
      realDeadScopeMessage(),
      ...checkOrphanRelations([item({
        relations: [{ type: 'cites', target: 'RULE-gone' }],
      } as Partial<Item>)]).map((f) => f.message),
      ...checkCorpusSize(
        Array.from({ length: FALLBACK_CEILING_WARN_ITEMS }, (_v, i) => item({ id: `CONST-${i}` })),
      ).map((f) => f.message),
    ];
    assert.equal(messages.length, 3,
      'three real checks must have produced three real messages; a check that returned nothing '
      + 'leaves this test asserting over an empty list');

    for (const message of messages) {
      assert.equal(messageRuns(message).map((r) => r.text).join(''), message,
        'the split changed the producer\'s text. This screen shows his words unedited and adds '
        + 'only the isolation; a run that drops or rewrites a character breaks that promise '
        + 'silently, because the cell would still look like a sentence.');
    }
  });

test('messageRuns isolates the glob a real dead_scope finding quotes, and only that', async () => {
  const { messageRuns } = await doctorModule();
  const runs = messageRuns(realDeadScopeMessage());
  const isolated = runs.filter((r) => r.mono).map((r) => r.text);

  assert.deepEqual(isolated, ['src/db/**'],
    'the glob is the one literal this message delimits, and it is the run the design of record '
    + 'draws — `scope <span class="m v">src/billing/**</span> matches no file`');
  // The delimiters stay on the TEXT side: they are his characters.
  assert.ok(runs[0]!.text.endsWith('"'), 'the opening quote belongs to the text before the run');
  assert.ok(runs[2]!.text.startsWith('"'), 'the closing quote belongs to the text after it');
  assert.equal(runs[0]!.mono, false);
  assert.equal(runs[2]!.mono, false);
});

test('messageRuns isolates a backticked command — the other delimiter the checker uses', async () => {
  const { messageRuns } = await doctorModule();
  const findings = checkCorpusSize(
    Array.from({ length: FALLBACK_CEILING_WARN_ITEMS }, (_v, i) => item({ id: `CONST-${i}` })),
  );
  assert.equal(findings.length, 1, 'the corpus-size check must fire at its own threshold');
  const isolated = messageRuns(findings[0]!.message).filter((r) => r.mono).map((r) => r.text);
  assert.deepEqual(isolated, ['mycontext decay'],
    'a command the message names in backticks is a direction-known literal exactly as a glob is '
    + '— the stylesheet reserves `.m` for "identifiers, paths, globs, commands, flags"');
});

test('messageRuns leaves a message with no delimited literal exactly as it was', async () => {
  const { messageRuns } = await doctorModule();
  const plain = 'the item will never activate through it — the clearest rot signal';
  assert.deepEqual(messageRuns(plain), [{ mono: false, text: plain }]);
  // An UNBALANCED delimiter falls through to the same single run. The failure
  // mode is the behaviour this screen had before the split existed, never a
  // dropped clause.
  assert.deepEqual(messageRuns('a "half quoted glob'), [{ mono: false, text: 'a "half quoted glob' }]);
  assert.deepEqual(messageRuns(''), []);
  assert.deepEqual(messageRuns(undefined), []);
});

test('messageRuns isolates each literal separately when a message carries two', async () => {
  const { messageRuns } = await doctorModule();
  // `checkSourceAnchor`'s shape: two quoted values in one sentence. A single
  // greedy run would swallow the prose between them and isolate an English
  // clause, which is the defect the character class exists to prevent.
  const runs = messageRuns('"docs/policy.md" no longer has a section anchored "Retention".');
  assert.deepEqual(runs.filter((r) => r.mono).map((r) => r.text), ['docs/policy.md', 'Retention']);
  assert.equal(runs.map((r) => r.text).join(''),
    '"docs/policy.md" no longer has a section anchored "Retention".');
});

/* -------------------------------------------------------------------------- *
 * cardRows — which findings a card claims, and the one place absence is null.
 * -------------------------------------------------------------------------- */

test('cardRows claims only its own level and keeps groupFindings\' order', async () => {
  const { cardRows } = await doctorModule();
  const groups = new Map<string, Finding[]>([
    ['source_drift', [
      { level: 'error', code: 'source_drift', item: 'RULE-a', message: 'a' },
      { level: 'warn', code: 'source_drift', item: 'RULE-b', message: 'b' },
    ]],
    ['dead_scope', [{ level: 'warn', code: 'dead_scope', item: 'CONST-c', message: 'c' }]],
  ]);

  assert.deepEqual(cardRows(groups, 'error').map((r) => r.item), ['RULE-a']);
  // The card walks the CODES in the order `groupFindings` returned them, which
  // is worst-first with the code as the tie-break — not the order the checker
  // happened to register its checks in.
  assert.deepEqual(cardRows(groups, 'warn').map((r) => r.item), ['RULE-b', 'CONST-c']);
  assert.deepEqual(cardRows(groups, 'info'), []);
});

test('cardRows normalises every shape of "this finding names no item" to null', async () => {
  const { cardRows } = await doctorModule();
  const groups = new Map<string, Finding[]>([
    ['audit_log_size', [{ level: 'info', code: 'audit_log_size', message: 'm' }]],
    ['check_failed', [{ level: 'info', code: 'check_failed', item: '', message: 'm' }]],
  ]);
  // Absent and empty are the same fact, and one spelling of it is what the em
  // dash reads. An empty string reaching `linkId` would compose a button that
  // opens the item detail pane for no item at all.
  assert.deepEqual(cardRows(groups, 'info').map((r) => r.item), [null, null]);
});

/* -------------------------------------------------------------------------- *
 * cardCommands — composed, never run.
 * -------------------------------------------------------------------------- */

test('cardCommands composes the design of record\'s own line, byte for byte', async () => {
  const { cardCommands } = await doctorModule();
  // Read out of the mockup rather than copied into this file. A copy would go
  // stale the moment the design of record changed its command and nothing
  // would say so.
  const code = /<code>([^<]+)<\/code>/.exec(mockupSection());
  assert.ok(code, 'the doctor section draws no <code> command');
  assert.deepEqual(
    cardCommands([{ code: 'source_drift', item: 'RULE-never-log-customer-email', message: '' }]),
    [code![1]],
  );
});

test('cardCommands quotes through the one quoting implementation', async () => {
  const { cardCommands } = await doctorModule();
  // The single argument any repair line takes is the only place quoting can go
  // wrong on this screen, and it goes through `lib/command.js` rather than
  // through a spelling of it invented in the screen. A composer that
  // concatenated would produce `mycontext refresh RULE with spaces`, which the
  // CLI reads as three arguments.
  assert.deepEqual(
    cardCommands([{ code: 'source_drift', item: 'RULE with spaces', message: '' }]),
    ['mycontext refresh "RULE with spaces"'],
  );
});

test('cardCommands offers one row per DISTINCT command, in first-ask order', async () => {
  const { cardCommands } = await doctorModule();
  assert.deepEqual(cardCommands([
    { code: 'source_drift', item: 'RULE-a', message: '' },
    { code: 'index_stale', item: null, message: '' },
    { code: 'source_drift', item: 'RULE-a', message: '' },
    { code: 'corpus_size_fallback_ceiling', item: null, message: '' },
  ]), ['mycontext refresh RULE-a', 'mycontext rebuild', 'mycontext decay']);
});

/**
 * **The three parity-ledger entries this screen cannot close by writing code.**
 *
 * `div.cmd`, `code` and `button` are listed as missing on `doctor` in
 * `e2e/screen-parity.spec.ts`. `commandRow` builds all three. They are absent
 * because `.demo-corpus` — the corpus that gate runs over — answers
 * `/api/doctor` with three findings, all `dead_scope`, and `dead_scope` earns
 * no command: re-scoping is an edit to the item file, not a line anyone can
 * paste. That is not this screen shrugging. The MOCKUP's own warning card
 * carries a `dead_scope` row and composes nothing for it either; the `.cmd`
 * under that card belongs to `watched_docs_no_match`, one of three PROPOSED
 * checks this build does not have.
 *
 * So this test asserts the empty answer deliberately. Composing something for
 * `dead_scope` would draw the missing kinds and contradict the design of
 * record in the same edit.
 */
test('cardCommands composes nothing for the codes whose messages name no command', async () => {
  const { cardCommands } = await doctorModule();
  for (const code of ['dead_scope', 'orphan_relation', 'source_missing', 'index_missing']) {
    assert.deepEqual(cardCommands([{ code, item: 'CONST-a', message: '' }]), [],
      `${code} composed a command; its own message asks for a file edit, and a line that cannot `
      + 'be pasted without editing is a placeholder wearing a command\'s clothes');
  }
  // The mockup agrees, and it is the specification: its warning card draws a
  // dead_scope row and no command for it.
  const section = mockupSection();
  assert.ok(section.includes('dead_scope'), 'the mockup no longer draws a dead_scope row');
  assert.ok(!/mycontext\s+\S*scope/.test(section),
    'the design of record now composes a scope command — the ruling above has moved and this '
    + 'screen must follow it');
});

/* -------------------------------------------------------------------------- *
 * The screen against the two string tables and against the mockup.
 * -------------------------------------------------------------------------- */

async function table(language: string): Promise<Record<string, string>> {
  const file = path.join(PUBLIC, 'strings', `${language}.js`);
  const mod = await import(pathToFileURL(file).href) as { strings: Record<string, string> };
  return mod.strings;
}

test('every string key the Doctor screen names is declared in both tables', async () => {
  const en = await table('en');
  const he = await table('he');
  const named = new Set<string>();
  for (const m of doctorSource.matchAll(/ctx\.t(?:Flat)?\('([^']+)'/g)) named.add(m[1]!);
  for (const m of doctorSource.matchAll(/screenHead\(ctx, root, '([^']+)', '([^']+)', '([^']+)'\)/g)) {
    for (const key of [m[1]!, m[2]!, m[3]!]) named.add(key);
  }
  // `doc.notice` is named through the CARDS table, which neither pattern sees.
  for (const m of doctorSource.matchAll(/key: '([^']+)'/g)) named.add(m[1]!);

  assert.ok(named.size >= 5,
    `the scan found ${named.size} key(s) in doctor.js; the screen names five. A collapse means `
    + 'the patterns stopped matching, not that the screen stopped naming keys.');
  for (const key of named) {
    assert.ok(key in en, `doctor.js names ${key}, missing from the English table`);
    assert.ok(key in he, `doctor.js names ${key}, missing from the Hebrew table`);
  }
});

/**
 * **Five `doc.` keys are declared and deliberately drawn nowhere, and that is
 * pinned rather than left to be rediscovered.**
 *
 * `doc.d1`…`doc.d5` are the mockup's SAMPLE sentences for five specific
 * findings, three of them for checks that do not exist. A real
 * `Finding.message` is composed at run time from this corpus's own paths and
 * counts, so the screen shows the producer's words instead — the reasoning is
 * in `doctor.js`'s header. `test/ui/work-screen.test.ts` asserts the opposite
 * for its screen ("every declared key is placed"), and asserting it here would
 * be red on a decision that was taken on purpose.
 *
 * So the divergence is written down as an EQUALITY. A sixth sample sentence
 * cannot be added without this failing, and the day one of these is placed it
 * fails too — which is the only way a deliberate omission stays deliberate.
 */
test('exactly five doc. sample sentences are declared and unplaced, by decision', async () => {
  const en = await table('en');
  const named = new Set<string>();
  for (const m of doctorSource.matchAll(/ctx\.t(?:Flat)?\('([^']+)'/g)) named.add(m[1]!);
  for (const m of doctorSource.matchAll(/screenHead\(ctx, root, '([^']+)', '([^']+)', '([^']+)'\)/g)) {
    for (const key of [m[1]!, m[2]!, m[3]!]) named.add(key);
  }
  for (const m of doctorSource.matchAll(/key: '([^']+)'/g)) named.add(m[1]!);

  const declared = Object.keys(en).filter((key) => key.startsWith('doc.')).sort();
  assert.deepEqual(declared.filter((key) => !named.has(key)),
    ['doc.d1', 'doc.d2', 'doc.d3', 'doc.d4', 'doc.d5']);
});

test('no translated string is assigned — t() returns nodes and they are appended (ruling A1)', async () => {
  assert.ok(!/textContent\s*=\s*ctx\.t/.test(doctorSource),
    'a translated value is assigned to textContent');
  assert.ok(!/innerHTML/.test(doctorSource), 'innerHTML has no legitimate use in a screen module');
  assert.ok(/\.append\(\.\.\.ctx\.t\(/.test(doctorSource),
    'the screen appends no translated nodes at all — the scan above is checking nothing');
});

test('the screen invents no class the mockup\'s own doctor section does not use', async () => {
  const section = mockupSection();
  const drawn = new Set<string>();
  for (const m of section.matchAll(/class="([^"]+)"/g)) {
    for (const token of m[1]!.trim().split(/\s+/)) drawn.add(token);
  }
  assert.ok(drawn.size >= 8, `the mockup scan found ${drawn.size} class token(s) — too few to be `
    + 'the doctor section, so the extraction is broken rather than the screen clean');

  const written: string[] = [];
  for (const m of doctorSource.matchAll(/\bel\('[a-z0-9]+',\s*'([^']*)'/g)) written.push(m[1]!);
  assert.ok(written.length >= 4,
    `the doctor.js scan found ${written.length} class string(s); the screen writes at least four`);

  for (const value of written) {
    for (const token of value.trim().split(/\s+/)) {
      assert.ok(drawn.has(token),
        `doctor.js writes class "${token}", which <section data-p="doctor"> never uses. A class `
        + 'the design of record does not draw is either a typo or a decision the owner has not '
        + 'taken.');
    }
  }

  // The composite the whole screen is built out of, pinned as a whole
  // attribute value rather than as two loose tokens: a `div` that took `card`
  // and `pane` separately would satisfy the token check above and still be a
  // different element from the one the mockup draws.
  assert.ok(section.includes('class="card pane"'),
    'the mockup no longer draws class="card pane" — the design of record moved');
  assert.ok(written.includes('card pane'),
    'doctor.js no longer writes the "card pane" composite the mockup draws');
  // `.m` is the isolation the message cell adds, and it is the mockup's own
  // class on this screen — `<span class="m">lesson</span>` inside `doc.d5`.
  assert.ok(drawn.has('m'), 'the mockup no longer isolates anything on this screen');
  assert.ok(/\bmono\(/.test(doctorSource),
    'the screen isolates no literal at all — the message cell stopped using the `.m` run');
});
