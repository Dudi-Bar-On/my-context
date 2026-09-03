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
 *     unplaced, so a SIXTH cannot appear without somebody deciding about it;
 *   - the sentence every finding of one code repeats, and the promise that
 *     moving it changed nothing (`sharedTail`, `sharedNotes`) — the row's
 *     remaining text plus the shared note is the producer's message byte for
 *     byte, which is what makes "shortened words, never shortened facts"
 *     checkable rather than claimed.
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
  REMEDY, type Finding, type Remedy,
} from '../../src/doctor/checks.ts';

/**
 * The remedies these fixtures declare, in the spelling `src/doctor/checks.ts`
 * declares them — imported rather than hand-written, so a fixture cannot assert
 * about a shape the real checks stopped emitting.
 */
const REFRESH = (id: string): Remedy => (
  { route: 'run', command: 'refresh', values: { id, yes: true } }
);
import { resolveConfig } from '../../src/core/config.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';
import { allowedClasses } from '../helpers/shipped-classes.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');
const DOCTOR_JS = path.join(PUBLIC, 'screens', 'doctor.js');
const MOCKUP = path.join(REPO, 'docs', 'design', 'web-ui-mockup.html');

const doctorSource = readFileSync(DOCTOR_JS, 'utf8');

interface Run { mono: boolean; text: string }
interface Row { code: string; item: string | null; message: string; remedy: Remedy | null }

/**
 * The screen's published interface. Hand-declared rather than inferred, so it
 * is an assertion in its own right: a module that drifts from it fails here
 * rather than in a browser nobody is watching.
 */
interface Repair { id: string | null; values: Record<string, unknown>; argv: string[] }

interface SharedNote { count: number; text: string }

interface DoctorModule {
  messageRuns: (message: unknown) => Run[];
  sharedTail: (messages: string[]) => string;
  sharedNotes: (rows: Row[]) => Map<string, SharedNote>;
  cardRows: (groups: Map<string, Finding[]>, level: string) => Row[];
  // Takes the FINDING now, not a code and an item: the decision it used to
  // make lives on `Finding.remedy`, and a reader of a declaration needs the
  // thing that carries it (`reports/V2-HANDOVER.md:437`).
  repairFor: (finding: Partial<Finding>) => Repair | null;
  cardCommands: (rows: Row[]) => Repair[];
  settleGroups: (findings: Partial<Finding>[]) => SettleGroup[];
  disclosureAbout: (finding: Partial<Finding> | null) => string | null;
  isDisclosure: (finding: Partial<Finding>) => boolean;
  disclosureNotes: (
    findings: Partial<Finding>[], level: string,
  ) => Map<string, { code: string; messages: string[] }>;
  render: (root: unknown, ctx: unknown) => Promise<void>;
}

/** One bulk ruling the screen offers: a code, what it covers, and the argv. */
interface SettleGroup extends Repair {
  code: string; level: string; count: number; items: number;
}

/** `from '/lib/viewmodel.js'` — the browser's own specifier form. */
const ROOT_SPECIFIER = /(\bfrom\s+')\/([^']+)'/g;

async function doctorModule(): Promise<DoctorModule> {
  let rewritten = 0;
  const text = doctorSource.replace(ROOT_SPECIFIER, (_all, head: string, spec: string) => {
    rewritten += 1;
    return `${head}${pathToFileURL(path.join(PUBLIC, spec)).href}'`;
  });
  assert.equal(rewritten, 5,
    'expected doctor.js to import five browser modules (/lib/viewmodel.js, /lib/command.js, '
    + '/lib/palette-defs.js, /lib/command-actions.js, /screens/parts.js); '
    + `the rewrite matched ${rewritten}. A specifier this pattern cannot see is a module Node `
    + 'would resolve from the drive root, and the import below would fail for a reason that '
    + 'reads like a missing file.');
  assert.ok(!/\bfrom\s+'\//.test(text),
    'a root-absolute specifier survived the rewrite — the module graph imported below would not '
    + 'be the one the browser runs');
  const encoded = Buffer.from(text, 'utf8').toString('base64');
  return (await import(`data:text/javascript;charset=utf-8;base64,${encoded}`)) as DoctorModule;
}

interface CommandModule { composeCommand: (argv: string[]) => string }
interface ViewModelModule { repairCommandFor: (finding: Partial<Finding>) => string | null }
interface TallyModule {
  repairTally: (findings: Finding[]) => { findings: number; repairs: number; settle: number };
}
interface DefsModule {
  PALETTE: { name: string }[];
  commandFor: (def: unknown, values: Record<string, unknown>) => string[];
}

const browserModule = async <T>(...segments: string[]): Promise<T> =>
  (await import(pathToFileURL(path.join(PUBLIC, ...segments)).href)) as T;

/**
 * The repairs as the LINES a reader sees, composed through the one composer.
 *
 * `cardCommands` answers catalogue entries now rather than strings — the
 * Copy-and-Execute control takes an argv and an id, and a screen that kept a
 * second string beside the argv would be the exact drift the confirm exists to
 * prevent. The assertions below are unchanged: the same bytes, derived from the
 * thing that is actually offered.
 */
async function lines(repairs: Repair[]): Promise<string[]> {
  const { composeCommand } = await browserModule<CommandModule>('lib', 'command.js');
  return repairs.map((repair) => composeCommand(repair.argv));
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
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null, summaryWas: [], acknowledged: {}, scope: [], tags: [], origin: 'human',
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
      { level: 'error', code: 'source_drift', item: 'RULE-a', message: 'a', remedy: REFRESH('RULE-a') },
      { level: 'warn', code: 'source_drift', item: 'RULE-b', message: 'b', remedy: REFRESH('RULE-b') },
    ]],
    ['dead_scope', [
      { level: 'warn', code: 'dead_scope', item: 'CONST-c', message: 'c', remedy: REMEDY.ACK },
    ]],
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
    ['audit_log_size', [
      { level: 'info', code: 'audit_log_size', message: 'm', remedy: REMEDY.AUDIT_FILES },
    ]],
    ['check_failed', [
      { level: 'info', code: 'check_failed', item: '', message: 'm', remedy: REMEDY.PERSON },
    ]],
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
    (await lines(cardCommands([
      {
        code: 'source_drift', item: 'RULE-never-log-customer-email', message: '',
        remedy: REFRESH('RULE-never-log-customer-email'),
      },
    ]))),
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
    await lines(cardCommands([{
      code: 'source_drift', item: 'RULE with spaces', message: '', remedy: REFRESH('RULE with spaces'),
    }])),
    ['mycontext refresh "RULE with spaces" --yes'],
  );
});

test('cardCommands offers one row per DISTINCT command, in first-ask order', async () => {
  const { cardCommands } = await doctorModule();
  assert.deepEqual(await lines(cardCommands([
    { code: 'source_drift', item: 'RULE-a', message: '', remedy: REFRESH('RULE-a') },
    { code: 'index_stale', item: null, message: '', remedy: REMEDY.REBUILD },
    { code: 'source_drift', item: 'RULE-a', message: '', remedy: REFRESH('RULE-a') },
    { code: 'corpus_size_fallback_ceiling', item: null, message: '', remedy: REMEDY.DECAY },
  ])), ['mycontext refresh RULE-a --yes', 'mycontext rebuild', 'mycontext decay']);
});

/**
 * **A command that answers for ONE ROW is never drawn under the table.**
 *
 * `cardCommands` composes the shared block under a card: one line serving every
 * row of its code, deduped by the composed line. That is right for `mycontext
 * rebuild`, which settles every `index_stale` row at once, and wrong for
 * `mycontext ack <id> <code>`, which settles exactly one. Seventy-three ack
 * lines stacked under a table would be seventy-three controls a reader cannot
 * match to a row; they are drawn ON the row instead, which the `render` scan
 * below pins.
 *
 * `dead_scope` is the case the parity ledger records: it composes nothing
 * SHARED, because re-scoping is an edit to the item file and there is no line
 * to paste. The MOCKUP's own warning card carries a `dead_scope` row and
 * composes nothing for it either; the `.cmd` under that card belongs to
 * `watched_docs_no_match`, one of three PROPOSED checks this build does not
 * have. What `dead_scope` HAS now is the acknowledge route on its own row —
 * a different control in a different place, and neither of them this one.
 */
test('cardCommands composes nothing under the table for a row-scoped remedy', async () => {
  const { cardCommands } = await doctorModule();
  const rows: Row[] = [
    // Settled by a person, on the item: the control belongs to the row.
    { code: 'dead_scope', item: 'CONST-a', message: '', remedy: REMEDY.ACK },
    { code: 'orphan_relation', item: 'CONST-a', message: '', remedy: REMEDY.ACK },
    { code: 'source_missing', item: 'CONST-a', message: '', remedy: REMEDY.ACK },
    // Asks for no action at all, so there is nothing anywhere.
    { code: 'index_missing', item: null, message: '', remedy: REMEDY.NOTHING },
  ];
  for (const row of rows) {
    assert.deepEqual(cardCommands([row]), [],
      `${row.code} composed a SHARED command block; its remedy answers for one row, or for `
      + 'no row at all');
  }
  // The mockup agrees, and it is the specification: its warning card draws a
  // dead_scope row and no command under it.
  const section = mockupSection();
  assert.ok(section.includes('dead_scope'), 'the mockup no longer draws a dead_scope row');
  assert.ok(!/mycontext\s+\S*scope/.test(section),
    'the design of record now composes a scope command — the ruling above has moved and this '
    + 'screen must follow it');
});

/* -------------------------------------------------------------------------- *
 * The repair as a CATALOGUE ENTRY — what Execute is handed.
 * -------------------------------------------------------------------------- */

/**
 * **The two surfaces are held equal over FINDINGS, and neither of them decides
 * any more.**
 *
 * They used to hold two copies of one four-code table — `repairFor` in the shape
 * the control takes, `repairCommandFor` as a string — and this test existed so
 * they could not drift. The table is gone: `Finding.remedy` is the declaration
 * and both are readers of it (`reports/V2-HANDOVER.md:437`). The test stays,
 * because two readers can still disagree about how to read four route names, and
 * the disagreement would be silent in the direction that matters — a `<code>`
 * showing one command while the confirm ran another.
 *
 * The cases are the four routes plus the two ways a declaration can be
 * malformed: an `acknowledge` on a finding naming no item (which nothing can
 * anchor) and a body served by a build that had no `remedy` field at all.
 */
test("every repair the screen composes is byte-identical to viewmodel's own line", async () => {
  const { repairFor } = await doctorModule();
  const { repairCommandFor } = await browserModule<ViewModelModule>('lib', 'viewmodel.js');
  const { composeCommand } = await browserModule<CommandModule>('lib', 'command.js');

  const cases: Partial<Finding>[] = [
    { code: 'index_stale', remedy: REMEDY.REBUILD },
    { code: 'audit_log_size', remedy: REMEDY.AUDIT_FILES },
    { code: 'corpus_size_fallback_ceiling', remedy: REMEDY.DECAY },
    { code: 'source_drift', item: 'RULE-never-log-customer-email', remedy: REFRESH('RULE-never-log-customer-email') },
    { code: 'source_drift', item: 'RULE with spaces', remedy: REFRESH('RULE with spaces') },
    { code: 'checksum_basis_migration', remedy: REMEDY.REPAIR },
    { code: 'dead_scope', item: 'CONST-a', remedy: REMEDY.ACK },
    { code: 'body_disagrees_with_meta', item: 'RULE with spaces', remedy: REMEDY.ACK },
    { code: 'cli_not_on_path', remedy: REMEDY.PERSON },
    { code: 'nested_corpus', remedy: REMEDY.NOTHING },
    // Malformed, both ways. Neither may compose a line, and neither may throw.
    { code: 'dead_scope', remedy: REMEDY.ACK },
    { code: 'some_check_added_next_year', item: 'CONST-a' },
  ];
  let composed = 0;
  for (const finding of cases) {
    const where = `${finding.code}/${String(finding.item)}`;
    const repair = repairFor(finding);
    const expected = repairCommandFor(finding);
    if (expected === null) {
      assert.equal(repair, null, `${where}: the screen offers a line viewmodel.js composes none for`);
      continue;
    }
    assert.notEqual(repair, null, `${where}: viewmodel.js composes a line and the screen offers none`);
    assert.equal(composeCommand(repair!.argv), expected, where);
    composed += 1;
  }
  assert.ok(composed >= 7,
    `only ${composed} repair(s) were compared; the loop stopped seeing the ones that exist`);
});

/**
 * **The ACKNOWLEDGE route composes `mycontext ack <id> <code>` from the
 * finding's own two fields — the answer to the report this work exists for.**
 *
 * Owner, 2026-09-03: *"currently doctor contains many items i do not have any
 * way to handle, solve it"*. `mycontext ack` had existed since 2026-08-27 and
 * reached no surface in this UI. `test/ui/palette-lib.test.ts` carried the
 * reason — *"a control that composed a usable line would have to be driven by
 * the doctor read model rather than by a flag declaration"* — and this is that
 * line, driven by `Finding.remedy`.
 *
 * The id and the code come from the FINDING and never from a copy inside the
 * remedy, which is why a remedy of `{ route: 'acknowledge' }` is the whole
 * declaration: a second spelling of an id is how a control comes to name a
 * different item from the row it sits on.
 */
test('an acknowledge remedy composes ack against the finding\'s own id and code', async () => {
  const { repairFor } = await doctorModule();
  const repair = repairFor({ code: 'body_disagrees_with_meta', item: 'DEC-a', remedy: REMEDY.ACK });
  assert.deepEqual(repair, {
    id: 'ack',
    // The second positional is keyed `finding` since the bulk form arrived —
    // `--code` is a FLAG on the same catalogue entry and one values bag cannot
    // hold two fields of one name. The ARGV is what this test is really about
    // and it is unchanged: a positional is composed by position, so the line is
    // still `mycontext ack <id> <code>` byte for byte.
    values: { id: 'DEC-a', finding: 'body_disagrees_with_meta' },
    argv: ['mycontext', 'ack', 'DEC-a', 'body_disagrees_with_meta'],
  });

  // Quoted through the ONE quoting implementation, like every other line here.
  const { composeCommand } = await browserModule<CommandModule>('lib', 'command.js');
  const spaced = repairFor({ code: 'dead_scope', item: 'RULE with spaces', remedy: REMEDY.ACK });
  assert.equal(composeCommand(spaced!.argv), 'mycontext ack "RULE with spaces" dead_scope');

  // An acknowledgement is anchored to an ITEM. A finding naming none cannot
  // carry one, and the screen must draw its chip rather than compose
  // `mycontext ack undefined <code>`.
  assert.equal(repairFor({ code: 'body_review_limits', remedy: REMEDY.ACK }), null);
});

/* ---------------------------------------------------------------------------
 * The bulk settlement — `DEC-doctor-gets-a-bulk-settlement-overturning-the-no-bulk-ruling`
 * ------------------------------------------------------------------------- */

/**
 * **The control the owner asked for, and the four things it must refuse to
 * cover.**
 *
 * Owner ruling 2026-09-03, overturning his own no-bulk ruling of 2026-08-31:
 * *"for notices that could be many items, we need to have a capability to fix
 * all of them at once using doctor"*. The measurement behind it is 70 of this
 * corpus's 71 findings routing to `acknowledge`, which is 70 confirms and 70
 * single-use nonces to clear one screen.
 *
 * Every assertion here is a way the control could silently cover more or less
 * than it says. The count is the load-bearing one: it is the argument of
 * `--count`, which is how the CLI is CONSENTED to, and the CLI refuses a count
 * that does not match what it finds. A group that over-counted would compose a
 * command guaranteed to be refused; one that under-counted would put a number in
 * front of a person that is smaller than the act.
 */
test('a settlement covers one code, and only findings a ruling can actually settle', async () => {
  const { settleGroups } = await doctorModule();
  const groups = settleGroups([
    // Two of one code on two items — a class, and the whole point.
    { level: 'info', code: 'body_disagrees_with_meta', item: 'DEC-a', remedy: REMEDY.ACK },
    { level: 'info', code: 'body_disagrees_with_meta', item: 'DEC-b', remedy: REMEDY.ACK },
    // Already ruled on: it keeps its row and its own control, and is NOT counted
    // here — `--count` names what the run will write.
    { level: 'info', code: 'body_disagrees_with_meta', item: 'DEC-c', remedy: REMEDY.ACK, acknowledged: true },
    // Names no item, so nothing can carry the ruling (`core/acknowledge.ts`).
    { level: 'info', code: 'body_disagrees_with_meta', remedy: REMEDY.ACK },
    // A different route entirely: bulk-running `refresh` would rewrite bodies.
    { level: 'warn', code: 'source_drift', item: 'REF-a', remedy: REFRESH('REF-a') },
    { level: 'warn', code: 'source_drift', item: 'REF-b', remedy: REFRESH('REF-b') },
    // One finding is not a class — the row's own `ack <id> <code>` settles it.
    { level: 'error', code: 'source_missing', item: 'REF-c', remedy: REMEDY.ACK },
  ]);

  assert.deepEqual(groups, [{
    code: 'body_disagrees_with_meta',
    level: 'info',
    count: 2,
    items: 2,
    id: 'ack',
    values: { all: true, code: 'body_disagrees_with_meta', count: '2' },
    argv: ['mycontext', 'ack', '--all', '--code', 'body_disagrees_with_meta', '--count', '2'],
  }], 'a settlement must cover exactly the findings `mycontext ack --all` will write, or the '
    + 'count it composes is a consent token measuring something other than the act');
});

/**
 * **Two findings of one code on ONE item are one ruling, and the count still
 * counts findings.**
 *
 * `checkDeadScopes` emits a finding per dead glob, so an item with two dead
 * scopes carries two `dead_scope` findings. `mycontext ack` is keyed by (item,
 * code), so that is ONE acknowledgement and one audit record — and the CLI's
 * `--count` is the FINDING count, because that is what its preview names and
 * what the reader is agreeing to. The two numbers differ legitimately, and this
 * pins that they are both reported rather than conflated.
 */
test('a settlement counts findings and items separately, because they can differ', async () => {
  const { settleGroups } = await doctorModule();
  const [group] = await Promise.resolve(settleGroups([
    { level: 'warn', code: 'dead_scope', item: 'INV-a', message: 'one', remedy: REMEDY.ACK },
    { level: 'warn', code: 'dead_scope', item: 'INV-a', message: 'two', remedy: REMEDY.ACK },
    { level: 'warn', code: 'dead_scope', item: 'INV-b', message: 'three', remedy: REMEDY.ACK },
  ]));
  assert.equal(group.count, 3, 'the count is the FINDING count — what --count is agreed against');
  assert.equal(group.items, 2, 'and the item count is what the writes and audit records are');
  assert.deepEqual(group.argv,
    ['mycontext', 'ack', '--all', '--code', 'dead_scope', '--count', '3']);
});

/**
 * **No `--yes`, and this is the assertion that keeps it that way.**
 *
 * `mycontext ack` accepts no `--yes` and must not grow one: `approvalBoundary()`
 * derives the approval boundary — §7 of both READMEs and the skill the model
 * reads at every session start — by asking the real parser which commands take
 * it, and an acknowledgement changes nothing about what governs this project.
 * The consent is `--count`, which cannot be typed without reading the preview
 * that names it and is refused when the corpus has moved since. See
 * `src/cli/commands/ack.ts` for the whole argument.
 *
 * Asserted over the composed ARGV, which is the thing a person reads in the
 * confirm and the thing the nonce is bound to.
 */
test('a settlement is consented to by a count, never by a one-token flag', async () => {
  const { settleGroups } = await doctorModule();
  const [group] = settleGroups([
    { level: 'info', code: 'citation_form', item: 'A', remedy: REMEDY.ACK },
    { level: 'info', code: 'citation_form', item: 'B', remedy: REMEDY.ACK },
  ]);
  assert.equal(group.argv.includes('--yes'), false,
    'a one-token flag that could settle a corpus unread is refused — the guard is intrinsic to '
    + 'the act (DEC-a-stale-summary-that-is-still-correct-is-cleared-by-passing)');
  assert.equal(group.argv.at(-2), '--count');
  assert.equal(group.argv.at(-1), String(group.count));
});

/**
 * **The screen offers no checkbox, and that is a ruling rather than an
 * omission.** `test/ui/palette-lib.test.ts` states it about the bulk promote in
 * words this file is bound by: a checkbox *"moves an unreviewed promotion closer
 * to one click than the CLI puts it. That is a design decision about the
 * approval boundary, not a convenience."* A per-row selection control here would
 * be that decision taken by accident, so it is checked over the bytes.
 */
test('the settlement is a composed command per code, never a per-row checkbox', () => {
  assert.equal(/type\s*=\s*['"]checkbox['"]/.test(doctorSource), false,
    'a per-row checkbox is the one shape this control may not take');
  assert.equal(/createElement\(\s*['"]input['"]/.test(doctorSource), false,
    'the screen builds no input of any kind; the settlement is a command, read and confirmed');
});

/**
 * **`plan:walk seq:61` — the row that has no repair and the tally that counts
 * it must read the SAME decision, or the screen contradicts itself.**
 *
 * The chip is drawn from `repairFor` (the catalogue-entry shape the control
 * takes) and the tally is counted by `repairCommandFor` (the composed line).
 * The test above already holds those two byte-identical code by code, which is
 * what makes it safe for two callers to ask different functions the same
 * question — this pins the consequence: over one array of findings, the number
 * of rows that would draw a chip plus the number the tally calls repairable is
 * exactly the number of findings, with no row counted twice and none missed.
 *
 * Worth its own test rather than left as a corollary, because the failure it
 * catches is the one the owner actually saw wearing a new hat: a screen saying
 * "with an automated repair: 2" over three rows every one of which draws a chip
 * saying it has none is a worse silence than the blank toolbar it replaced.
 */
test('the tally and the per-row disclosure read one decision, never two', async () => {
  const { repairFor } = await doctorModule();
  const { repairTally } = await browserModule<TallyModule>('lib', 'viewmodel.js');

  // One of each ending, plus the case where the two functions could most easily
  // disagree: a repairable CODE whose declaration was built without the item its
  // command needs, which is unrepairable however the code reads.
  const findings: Finding[] = [
    { level: 'warn', code: 'blocked_without_needs', message: 'm', item: 'TASK-a', remedy: REMEDY.ACK },
    { level: 'info', code: 'nested_corpus', message: 'm', remedy: REMEDY.NOTHING },
    { level: 'warn', code: 'cli_not_on_path', message: 'm', remedy: REMEDY.PERSON },
    { level: 'error', code: 'index_stale', message: 'm', remedy: REMEDY.REBUILD },
    { level: 'error', code: 'source_drift', message: 'm', remedy: REMEDY.ACK },
  ];
  const chips = findings.filter((f) => repairFor(f) === null).length;
  const tally = repairTally(findings);
  assert.deepEqual(tally, { findings: 5, repairs: 1, settle: 1 });
  assert.equal(chips + tally.repairs + tally.settle, tally.findings,
    'a finding is drawn with a shared repair, with its own acknowledge control, or with the '
    + 'chip that says it has neither; a row counted twice or not at all is the screen '
    + 'disagreeing with its own summary');
  // **The third number is the one the owner was missing**, and it counts rows a
  // person settles rather than rows a command repairs. Collapsing the two would
  // put "with an automated repair: 73" over a corpus where nothing is automated.
  assert.equal(tally.settle, 1, 'the ack route is not counted, so the screen still cannot say '
    + 'how many findings a reader can actually act on');
});

/**
 * **The disclosure exists, it is the STRIP'S primitive, and it is neutral.**
 *
 * A source scan, because what is under test here is DOM glue and spec §6 keeps
 * that out of this file — but the alternative to scanning is not testing the
 * decision at all, and the decision is the whole task. Three properties, each
 * of which failing would reproduce a defect this project has already shipped:
 *
 *  - the chip is drawn only where `repairFor` answered `null` — a chip on every
 *    row says nothing;
 *  - it is `chip unmeas` with `data-g`, the same element `app.js`'s `stateChip`
 *    builds for `strip.unread`, `strip.unmeasured` and `screen.unread`. A fourth
 *    spelling of "nothing here, and here is why" would be worse than the silence
 *    it replaces (STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is);
 *  - it borrows no meaning hue. `.chip.warn` on a `notice` row would give it a
 *    warning's colour for being ordinary, and this screen's own header argues at
 *    length that severity is said by the card heading and nowhere else.
 */
test('a row with no repair draws the strip\'s own unmeasured chip, and only there', async () => {
  assert.ok(/const repair = repairFor\(row\);/.test(doctorSource),
    'the screen no longer asks whether the row has a repair before disclosing that it has none');
  assert.ok(/noRepairChip\(ctx, row\.remedy\)/.test(doctorSource),
    'nothing draws the disclosure, or it draws one sentence over two different reasons');
  // **The row draws its OWN control where the remedy answers for one row.**
  // Without this the two assertions above pass over a screen that went back to
  // drawing a chip for every ack finding — the silence the owner reported.
  //
  // **The gap between the branch and the append is allowed to hold prose, and
  // that is a loosening with a bound.** It used to require `{`, a newline and
  // the call — which is a claim about WHITESPACE, and on 2026-09-03 it went red
  // for a comment recording why the ack control stays drawn on a row that is
  // already acknowledged. Nothing about the property had changed. What keeps
  // this honest instead of merely permissive is the count below: the call
  // appears exactly ONCE in the file, and the branch opens exactly once, so a
  // lazy bounded gap between them cannot match across anything else.
  //
  // **The bound was 2,000 and is 6,000, for the second time and for the same
  // reason.** It went red again on 2026-09-03 over the prose recording why an
  // acknowledged row now says "already ruled on, running this again writes
  // nothing" above its command — measured gap 3,134 characters, none of it
  // code. A character budget on a comment is not a property of this screen, and
  // the two assertions that ARE properties (the call appears exactly once; it
  // appears inside this branch) do not weaken as the budget rises.
  assert.equal(doctorSource.split('message.append(commandRow(ctx, repair));').length - 1, 1,
    'the row-scoped acknowledge control is appended more than once, or not at all — the match '
    + 'below would then be saying nothing about where it is drawn');
  assert.ok(/row\.remedy\.route === 'acknowledge'\) \{[\s\S]{0,6000}?message\.append\(commandRow\(ctx, repair\)\);/
    .test(doctorSource),
    'a finding a person settles no longer draws its acknowledge control on its own row');
  assert.ok(/el\('span',\s*'chip unmeas'\)/.test(doctorSource),
    'the disclosure is no longer the strip\'s `.chip.unmeas` primitive');
  assert.ok(/dataset\.g\s*=\s*'◌'/.test(doctorSource),
    'the chip lost the glyph that keeps the state legible with no colour at all');
  for (const hue of ['chip warn', 'chip crit', 'chip ok', 'chip gov', 'chip carry']) {
    assert.ok(!doctorSource.includes(hue),
      `the disclosure now wears "${hue}" — an absent repair is not a severity, and this screen `
      + 'says severity with the card heading');
  }
});

/**
 * **The tally is drawn after the fetch and before the cards, and at every count
 * including zero.**
 *
 * Placement is the assertion. Drawn BEFORE the `await`, it would state "findings:
 * 0" over a doctor that never ran — the exact read-clean-next-to-a-failure trap
 * `errorNote` returns early to avoid. Drawn inside a card, it would be a
 * fraction of the wrong denominator: the repairs are spread across three levels.
 */
test('the tally is a fact about the whole run, drawn only once the run answered', async () => {
  const errorReturn = doctorSource.indexOf('root.append(errorNote(error.message));');
  const tally = doctorSource.indexOf("ctx.t('doc.tally'");
  const cards = doctorSource.indexOf('for (const card of CARDS)');
  assert.ok(errorReturn !== -1 && tally !== -1 && cards !== -1,
    'the scan lost one of its three anchors, so the ordering below is checking nothing');
  assert.ok(errorReturn < tally,
    'the tally is composed before the refusal branch returns — a doctor that could not run '
    + 'would be reported as a corpus with nothing wrong');
  assert.ok(tally < cards,
    'the tally moved inside the card loop; it is a fact about all three levels at once');
  assert.ok(!/tally\.findings\s*[=><]==?\s*0|if\s*\(\s*tally\./.test(doctorSource),
    'the tally is now conditional — a measured zero is drawn and named, never suppressed');
});

/**
 * **The id is the catalogue entry the command IS, and `null` where there is
 * none.** This is the assertion the task exists for: batching six screens is
 * how a WRONG id ships behind a confirm that looks right, because the confirm
 * renders the SERVER's rebuild of the id and a plausible-but-wrong id renders a
 * plausible-but-wrong command.
 *
 * `audit --files` is deliberately `null`: `PALETTE` has no `audit` entry, so
 * there is nothing for the server to rebuild and `commandActions` draws Copy
 * alone. That is the correct outcome and not a gap — nothing composed outside
 * the catalogue runs (spec §3.1).
 */
test('every BOUNDARY repair this screen composes carries --yes, or it cannot run', async () => {
  // The general property, not the one instance. A boundary command reaching a
  // child process without `--yes` refuses on stdin and produces the owner's
  // 2026-08-28 report; a future repair added here would do the same, silently,
  // and the failure would look like the server rather than like this line.
  const { repairFor } = await doctorModule();
  const { PALETTE } = await browserModule<DefsModule>('lib', 'palette-defs.js');
  const boundary = (name: string): boolean =>
    (PALETTE as { name: string; boundary?: boolean }[]).find((def) => def.name === name)?.boundary !== false;

  const composed = [
    repairFor({ code: 'index_stale', remedy: REMEDY.REBUILD }),
    repairFor({ code: 'corpus_size_fallback_ceiling', remedy: REMEDY.DECAY }),
    repairFor({ code: 'source_drift', item: 'RULE-a', remedy: REFRESH('RULE-a') }),
    repairFor({ code: 'checksum_basis_migration', remedy: REMEDY.REPAIR }),
    // `ack` is BELOW the boundary — it takes no `--yes` and the catalogue says
    // so — which is what makes this loop's `continue` load-bearing rather than
    // decorative: an entry off the boundary must NOT carry the flag.
    repairFor({ code: 'dead_scope', item: 'RULE-a', remedy: REMEDY.ACK }),
  ].filter((r) => r !== null && typeof r.id === 'string');

  assert.ok(composed.length > 0, 'no repair composed anything, so this checked nothing');

  for (const repair of composed) {
    if (!boundary(repair!.id as string)) continue;
    assert.equal((repair!.values as Record<string, unknown>)['yes'], true,
      `${String(repair!.id)} is on the approval boundary, so it gates on stdin — and the UI runs `
      + 'it as a child with no terminal. Without --yes it refuses, and the dry run refuses first, '
      + 'so no confirm renders either.');
  }
});

test('a repair names the catalogue entry it IS, and null where the catalogue has none', async () => {
  const { repairFor } = await doctorModule();
  const { PALETTE } = await browserModule<DefsModule>('lib', 'palette-defs.js');
  const known = new Set(PALETTE.map((def) => def.name));

  assert.equal(repairFor({ code: 'index_stale', remedy: REMEDY.REBUILD })?.id, 'rebuild');
  assert.equal(repairFor({ code: 'corpus_size_fallback_ceiling', remedy: REMEDY.DECAY })?.id, 'decay');
  assert.equal(repairFor({ code: 'source_drift', item: 'RULE-a', remedy: REFRESH('RULE-a') })?.id,
    'refresh');
  assert.equal(repairFor({ code: 'checksum_basis_migration', remedy: REMEDY.REPAIR })?.id, 'repair');
  assert.equal(repairFor({ code: 'dead_scope', item: 'RULE-a', remedy: REMEDY.ACK })?.id, 'ack');
  // **`yes: true`, and the command cannot run without it.** Owner-reported
  // 2026-08-28, twice: `refresh` replaces an item's whole body, so it gates on a
  // human by reading stdin — and a command run from this UI is a child process
  // with no terminal. It computed the change, printed it, and refused. The dry
  // run that derives the confirm hit the same wall first, so the button was dead
  // in both directions.
  //
  // This does not IMPLY the confirmation, it moves it: the flag is in the argv,
  // so it appears in the code the reader reads and in the confirm's own copy of
  // the resolved command, and the human decision is the confirm dialog. Omitting
  // it did not preserve a gate — it removed the command.
  assert.deepEqual(
    repairFor({ code: 'source_drift', item: 'RULE-a', remedy: REFRESH('RULE-a') })?.values,
    { id: 'RULE-a', yes: true },
  );
  assert.equal(repairFor({ code: 'audit_log_size', remedy: REMEDY.AUDIT_FILES })?.id, null,
    'mycontext audit is not in the catalogue; naming an id it does not have would make the '
    + 'confirm render a DIFFERENT command from the one the code above it shows');

  for (const finding of [
    { code: 'index_stale', item: 'RULE-a', remedy: REMEDY.REBUILD },
    { code: 'corpus_size_fallback_ceiling', item: 'RULE-a', remedy: REMEDY.DECAY },
    { code: 'source_drift', item: 'RULE-a', remedy: REFRESH('RULE-a') },
    { code: 'checksum_basis_migration', item: 'RULE-a', remedy: REMEDY.REPAIR },
    { code: 'dead_scope', item: 'RULE-a', remedy: REMEDY.ACK },
  ] as Partial<Finding>[]) {
    const id = repairFor(finding)!.id;
    assert.ok(known.has(id!),
      `${finding.code} names "${String(id)}", which the catalogue does not have`);
  }
});

/**
 * **Every catalogue id a CHECK names is an id the catalogue actually carries.**
 *
 * The decision moved out of the browser and into `src/doctor/checks.ts`, which
 * cannot see `palette-defs.js` — it is a browser asset, and there is no build
 * step joining them. So a check naming `rebiuld` would typecheck, ship, and
 * fail in `catalogued()` at render time on the one corpus that produced that
 * finding. This is the join, made over the real declarations rather than over a
 * list retyped here: `REMEDY` is what the checks use, so a row added there
 * without a catalogue entry fails on the next run of this file.
 */
test('every catalogue id the doctor checks name is one PALETTE declares', async () => {
  const { PALETTE } = await browserModule<DefsModule>('lib', 'palette-defs.js');
  const known = new Set(PALETTE.map((def) => def.name));
  const named = Object.values(REMEDY)
    .filter((remedy) => remedy.route === 'run')
    .map((remedy) => (remedy as { command: string }).command);
  // Plus the two remedies built per item, and the route with no `command` field
  // at all — `acknowledge` resolves to `ack`, which no `REMEDY` constant names.
  const all = [...named, 'refresh', 'edit', 'ack'];
  assert.ok(all.length >= 6, 'the derivation stopped seeing the run remedies');
  for (const command of all) {
    assert.ok(known.has(command),
      `src/doctor/checks.ts names the catalogue entry "${command}", which PALETTE does not `
      + 'declare. The screen would throw at render time, on whichever corpus produces that '
      + 'finding and no other.');
  }
});

/**
 * **The argv a reader is shown is the argv the SERVER will rebuild.**
 *
 * `src/ui/execute-catalogue.ts` resolves `(id, values)` through the same
 * `commandFor` this screen composes with, so composing here through the
 * catalogue entry rather than through a literal makes the two the same
 * computation rather than two that happen to agree today. The leading
 * `mycontext` is the human's and the server drops it — that asymmetry is
 * checked here so it cannot be discovered in a confirm.
 */
test('a catalogued repair composes through the catalogue, so the confirm cannot show another command',
  async () => {
    const { repairFor } = await doctorModule();
    const { PALETTE, commandFor } = await browserModule<DefsModule>('lib', 'palette-defs.js');
    for (const finding of [
      { code: 'index_stale', remedy: REMEDY.REBUILD },
      { code: 'corpus_size_fallback_ceiling', remedy: REMEDY.DECAY },
      { code: 'source_drift', item: 'RULE-a', remedy: REFRESH('RULE-a') },
      { code: 'dead_scope', item: 'RULE-a', remedy: REMEDY.ACK },
    ] as Partial<Finding>[]) {
      const code = finding.code;
      const repair = repairFor(finding)!;
      const def = PALETTE.find((entry) => entry.name === repair.id);
      assert.ok(def, `${code} names an id the catalogue does not carry`);
      assert.deepEqual(repair.argv, commandFor(def, repair.values), code);
      assert.equal(repair.argv[0], 'mycontext',
        'Copy hands a shell what a HUMAN types, and that includes the program name');
    }
  });

/**
 * **One control, not a tenth copy button.** The confirm is the security
 * boundary, and nine spellings of it would be nine chances to get it wrong.
 * A source scan, because the adoption is exactly the ABSENCE of the old code.
 */
test('the screen adopts the shared control and keeps no copy button of its own', () => {
  assert.ok(doctorSource.includes("from '/lib/command-actions.js'"),
    'the screen does not import the shared Copy-and-Execute control');
  assert.ok(!/clipboard/.test(doctorSource),
    'the screen still talks to the clipboard itself — Copy lives in lib/command-actions.js now');
  assert.ok(!/ctx\.t\('btn\.copy'/.test(doctorSource),
    'the screen still words its own Copy button');
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
  const allowed = allowedClasses(drawn);
    for (const token of value.trim().split(/\s+/)) {
      // `allowed`, not `drawn`: the mockup's classes UNION what styles.css
      // actually styles. See test/helpers/shipped-classes.ts — the app is what
      // gets built now, so a NEW class with a real rule is ordinary development;
      // a typo still has no rule anywhere and still fails here.
      assert.ok(allowed.has(token),
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

/* -------------------------------------------------------------------------- *
 * sharedTail / sharedNotes — the repeat, said once.
 *
 * Owner, three times in different clothes: the screens are too long to read,
 * and the doctor message "repeated a long explanation with every finding".
 * Measured on this repo's own corpus 2026-09-01: 42,353 characters of message,
 * 34,440 of them the same paragraph re-printed per row.
 *
 * The rule the whole change stands on is that NOTHING WAS DELETED. So the lead
 * assertion here is the same shape as `messageRuns`' — the halves join back to
 * the producer's bytes — and the rest are the three guards that stop this
 * shortening anything it should not.
 * -------------------------------------------------------------------------- */

/**
 * TWO real `dead_scope` messages, from the real check, over a repository that
 * genuinely has no files. Their first sentence names each item's own glob and
 * everything after it is identical — which is the shape this whole feature is
 * about, produced by the checker rather than typed here.
 */
function realDeadScopeMessages(): string[] {
  const repoRoot = mkdtempSync(path.join(tmpdir(), 'myctx-doctor-'));
  try {
    const findings = checkDeadScopes(
      repoRoot,
      [
        item({ id: 'CONST-migrations-run-forward-only', scope: ['src/db/**'] }),
        item({ id: 'CONST-prices-are-integer-cents', scope: ['src/api/**'] }),
      ],
      resolveConfig({}),
    );
    assert.equal(findings.length, 2, 'a repository with no files must make both globs dead');
    return findings.map((f) => f.message);
  } finally {
    removeTree(repoRoot);
  }
}

test("the row and the shared note join back to the producer's message, byte for byte", async () => {
  const { sharedTail } = await doctorModule();
  const messages = realDeadScopeMessages();
  const tail = sharedTail(messages);

  assert.ok(tail.length > 100,
    'two real dead_scope messages share a long explanation; a short answer means the suffix '
    + `search stopped working, not that the checker got terse (got ${tail.length} chars)`);
  for (const message of messages) {
    const shown = message.slice(0, message.length - tail.length);
    assert.equal(shown + tail, message,
      'the screen shortened the WORDS and lost some of the FACTS. Everything the row stops '
      + 'drawing must be exactly what the note draws once — nothing deleted, only moved.');
    assert.ok(shown.trim() !== '', 'a row was left with nothing of its own to say');
  }
  // The half that DIFFERS stays in the row: each item still names its own glob.
  const first = messages[0]!.slice(0, messages[0]!.length - tail.length);
  const second = messages[1]!.slice(0, messages[1]!.length - tail.length);
  assert.ok(first.includes('src/db/**'), 'the row lost the glob the finding is about');
  assert.ok(second.includes('src/api/**'), 'the row lost the glob the finding is about');
  // And the half that REPEATS leaves it.
  assert.ok(!first.includes('unrestricted'),
    'the repeated policy sentence is still in the row, so nothing was factored out at all');
});

test('the cut is a sentence boundary, so the row ends finished and the note starts clean',
  async () => {
    const { sharedTail } = await doctorModule();
    const messages = realDeadScopeMessages();
    const tail = sharedTail(messages);
    assert.ok(/^[A-Z]/.test(tail),
      `the shared note begins mid-sentence: ${JSON.stringify(tail.slice(0, 40))}. A cut at a `
      + 'character count is a different sentence, not a shorter one.');
    const shown = messages[0]!.slice(0, messages[0]!.length - tail.length);
    assert.ok(/[.!?]\s*$/.test(shown),
      `the row ends mid-sentence: ${JSON.stringify(shown.slice(-40))}`);
  });

test('sharedTail refuses every case where factoring would lose a distinction', async () => {
  const { sharedTail } = await doctorModule();
  const messages = realDeadScopeMessages();

  assert.equal(sharedTail([messages[0]!]), '',
    'one finding repeats nothing, so there is nothing to move — a disclosure over a single row '
    + 'hides a fact and shortens nothing');
  assert.equal(sharedTail([]), '', 'no findings, no note');
  // Two IDENTICAL messages are still safe, and the guard is not what makes them safe:
  // the cut is the FIRST sentence break, so each row keeps its opening sentence and only
  // the rest repeats. The guard is the backstop for a checker that one day emits a
  // message with nothing before that break.
  const twice = sharedTail([messages[0]!, messages[0]!]);
  assert.ok(messages[0]!.slice(0, messages[0]!.length - twice.length).trim() !== '',
    'two identical messages left a blank row — the shortening ate a whole finding');
  assert.equal(sharedTail(['. ' + 'x'.repeat(80), '. ' + 'x'.repeat(80)]), '',
    'a message with nothing before its first sentence break would be moved out whole, leaving a row that says nothing at all');
  assert.equal(sharedTail(['a is dead. Fix it.', 'b is dead. Fix it.']), '',
    'a shared "Fix it." is not worth a disclosure: below SHARED_MIN the screen draws exactly '
    + 'what it drew before');
});

test('sharedNotes groups by code, counts the rows, and keeps first-ask order', async () => {
  const { sharedNotes, sharedTail } = await doctorModule();
  const messages = realDeadScopeMessages();
  const rows: Row[] = [
    {
      code: 'dead_scope', item: 'CONST-migrations-run-forward-only', message: messages[0]!,
      remedy: REMEDY.ACK,
    },
    {
      code: 'index_stale', item: null, message: 'the index is older than the newest item file.',
      remedy: REMEDY.REBUILD,
    },
    {
      code: 'dead_scope', item: 'CONST-prices-are-integer-cents', message: messages[1]!,
      remedy: REMEDY.ACK,
    },
  ];
  const notes = sharedNotes(rows);

  assert.deepEqual([...notes.keys()], ['dead_scope'],
    'only a code whose rows actually repeat a sentence earns a note, and a code with one row '
    + 'must earn none');
  assert.equal(notes.get('dead_scope')!.count, 2,
    'the summary tells the reader how many rows the note is the rest of');
  assert.equal(notes.get('dead_scope')!.text, sharedTail(messages),
    'the note and the row trimming must read the same decision, or the halves stop joining');
});

test("the screen draws the shared note in the mockup's own disclosure, and keys its summary",
  () => {
    assert.ok(/el\('details', 'help'\)/.test(doctorSource),
      'the shared note invents a container instead of using `details.help`, the disclosure the '
      + 'design of record already draws on Decay');
    assert.ok(/el\('div', 'helpbox'\)/.test(doctorSource),
      "the note body is not the mockup's `.helpbox`");
    assert.ok(
      /ctx\.t\('doc\.shared', \{ code: code, count: String\(note\.count\) \}\)/.test(doctorSource),
      'the summary is unkeyed, or a slot is missing — an unsupplied {slot} throws at render '
      + 'time, and a shorthand `{ code }` is invisible to the scan that checks slots are passed');
  });

/**
 * ── A NOTE A CHECK MAKES ABOUT ITSELF IS NOT A ROW ─────────────────────────
 *
 * Owner, 2026-09-03: *"after you complete handling them, the test should be
 * that they will not be listed anymore at doctor list"*, about three findings
 * that name no item, carry `route: 'none'` and say in their own words that
 * nothing is owed. The rule above `interface Finding` already made a check
 * disclose what it cannot judge once rather than per item; what was left is
 * that the disclosure was still COUNTED and DRAWN as work.
 *
 * `Finding.about` names the CHECK the note is about, and this screen routes it
 * into the note mechanism it already had — `details.help` under that check's
 * table — instead of into `<tbody>`. The tests below hold both halves: the note
 * leaves the rows and the tally, and a real finding beside it does not.
 */
test('disclosureAbout reads the marker, and both spellings of absence agree', async () => {
  const { disclosureAbout, isDisclosure } = await doctorModule();
  assert.equal(disclosureAbout({ code: 'state_audit_coverage', about: 'state_unaudited' }),
    'state_unaudited');
  assert.equal(disclosureAbout({ code: 'dead_scope' }), null,
    'a body from a build that predates the field omits it — the same case `cardRows` already '
    + 'normalises `item` and `acknowledged` against');
  assert.equal(disclosureAbout({ code: 'x', about: '' }), null,
    'an empty `about` is a disclosure with no check to draw it under, which is worse than not '
    + 'being one: the note would be filed under an empty heading');
  assert.equal(isDisclosure({ code: 'x', about: 'y' }), true);
  assert.equal(isDisclosure({ code: 'x' }), false);
});

test('disclosureNotes keys by the CHECK, filters by level, and keeps every message', async () => {
  const { disclosureNotes } = await doctorModule();
  const findings: Partial<Finding>[] = [
    { level: 'info', code: 'state_audit_coverage', about: 'state_unaudited', message: 'unseen.' },
    {
      level: 'info', code: 'state_audit_coverage', about: 'state_unaudited',
      message: 'unwitnessed.',
    },
    {
      level: 'info', code: 'body_review_limits', about: 'body_disagrees_with_meta',
      message: 'a floor, not a count.',
    },
    { level: 'warn', code: 'other_coverage', about: 'other_check', message: 'elsewhere.' },
  ];

  const info = disclosureNotes(findings, 'info');
  assert.deepEqual([...info.keys()], ['state_unaudited', 'body_disagrees_with_meta'],
    'the note is keyed by the check it is about, so it opens under the table whose reach it '
    + 'limits — keyed by its own code it would sit under a heading with no rows and no context');
  // Two facts under one code stay two paragraphs. `state_audit_coverage` speaks
  // twice in a run that has both populations, and joining them would be the one
  // lossy step in this screen.
  assert.deepEqual(info.get('state_unaudited')!.messages, ['unseen.', 'unwitnessed.']);
  assert.equal(info.get('state_unaudited')!.code, 'state_audit_coverage',
    'the disclosure keeps its own code, because that is what a reader greps or pastes');

  assert.deepEqual([...disclosureNotes(findings, 'warn').keys()], ['other_check'],
    'a note is drawn in the card of the level its own finding declared');
  assert.deepEqual([...disclosureNotes(findings, 'error').keys()], []);
});

/**
 * **The partition survives, by subtraction from BOTH sides.**
 *
 * `the tally and the per-row disclosure read one decision, never two` above
 * pins `chips + repairs + settle === findings` and says why: *"a row counted
 * twice or not at all is the screen disagreeing with its own summary."* A
 * disclosure draws no row at all, so leaving it in `findings` would put it in
 * the denominator of a partition whose three terms all count rows — and
 * `repairFor` would claim it as a chip, drawing "no automated repair" about a
 * row nobody can see. It leaves the array before `repairTally` reads it, so
 * every term shrinks together and the identity holds untouched.
 */
test('a disclosure is in none of the four tally figures, and the partition still closes',
  async () => {
    const { repairFor, isDisclosure } = await doctorModule();
    const { repairTally } = await browserModule<TallyModule>('lib', 'viewmodel.js');
    const served: Finding[] = [
      {
        level: 'warn', code: 'blocked_without_needs', message: 'm', item: 'TASK-a',
        remedy: REMEDY.ACK,
      },
      { level: 'error', code: 'index_stale', message: 'm', remedy: REMEDY.REBUILD },
      { level: 'info', code: 'nested_corpus', message: 'm', remedy: REMEDY.NOTHING },
      {
        level: 'info', code: 'state_audit_coverage', about: 'state_unaudited',
        message: 'nothing is owed on this line.', remedy: REMEDY.NOTHING,
      },
    ];

    // What `render` does, in the same two lines and the same order.
    const disclosures = served.filter((f) => isDisclosure(f));
    const findings = served.filter((f) => !isDisclosure(f));
    assert.equal(disclosures.length, 1);

    const tally = repairTally(findings);
    assert.deepEqual(tally, { findings: 3, repairs: 1, settle: 1 },
      'the note is not a finding, not a repair and not a ruling — and the three real ones '
      + 'beside it are all still counted');
    const chips = findings.filter((f) => repairFor(f) === null).length;
    assert.equal(chips + tally.repairs + tally.settle, tally.findings,
      'the partition the screen depends on must close over the array it actually draws');
    assert.equal(repairFor(disclosures[0]!), null,
      'and the note would have been counted as a chip, drawing "no automated repair" about '
      + 'something that is not a row — which is why it must not reach this loop at all');
  });

test('the screen filters before it counts, groups and settles — not after', () => {
  assert.ok(
    /const disclosures = data\.findings\.filter\(\(f\) => isDisclosure\(f\)\);/.test(doctorSource)
    && /const findings = data\.findings\.filter\(\(f\) => !isDisclosure\(f\)\);/.test(doctorSource),
    'the split is not made off the served body, so the three consumers below can disagree');
  // Anchored on the WHOLE statement, never on the call alone: `settleGroups`
  // is DECLARED in this file as `export function settleGroups(findings)`, so a
  // bare `/settleGroups\(findings\)/` matches the declaration and passes over a
  // call site that was changed back to `data.findings`. Measured — that exact
  // mutant survived this assertion before it was tightened.
  assert.ok(/const tally = repairTally\(findings\);/.test(doctorSource),
    'the tally reads the whole served body again, so a note is back in "findings:"');
  assert.ok(/const groups = groupFindings\(findings\);/.test(doctorSource),
    'the cards read the whole served body, so a note is back in the tbody as a row');
  assert.ok(/const settlements = settleGroups\(findings\);/.test(doctorSource),
    'the settlements read the whole served body — the drift a reader would see is a bulk '
    + 'ruling offering to settle a note');
  assert.equal(/\(data\.findings\)/.test(doctorSource), false,
    'the served body is read once, by the two filters, and by nothing else');
});

test('the disclosure is drawn in the mockup own disclosure, keyed, with both codes', () => {
  // `pane.append(…)` and not the call alone: a note that is BUILT and never
  // appended draws nothing, and every character of the disclosure is lost with
  // the screen still naming the function that would have drawn it. Measured —
  // that mutant survived the looser assertion.
  assert.ok(/pane\.append\(aboutNoteBlock\(ctx, check, note\)\);/.test(doctorSource),
    'nothing draws the note, or it is built and dropped on the floor');
  assert.ok(/ctx\.t\('doc\.about', \{ check: check, code: note\.code \}\)/.test(doctorSource),
    'the summary is unkeyed, or a slot is missing — an unsupplied {slot} throws at render '
    + 'time, and a shorthand `{ check }` is invisible to the scan that checks slots are passed');
  assert.ok(/notes: disclosures\.length/.test(doctorSource),
    'the fifth tally figure is gone, so the notes vanish from the summary with no count — '
    + 'the silent drop INV-nothing-is-dropped-silently forbids and `acked` was added to avoid');
});
