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
import { allowedClasses } from '../helpers/shipped-classes.ts';

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
interface Repair { id: string | null; values: Record<string, unknown>; argv: string[] }

interface DoctorModule {
  messageRuns: (message: unknown) => Run[];
  cardRows: (groups: Map<string, Finding[]>, level: string) => Row[];
  repairFor: (code: string, item: string | null) => Repair | null;
  cardCommands: (rows: Row[]) => Repair[];
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
interface ViewModelModule { repairCommandFor: (code: string, item: string | null) => string | null }
interface TallyModule {
  repairTally: (findings: Finding[]) => { findings: number; repairs: number };
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
    (await lines(cardCommands([
      { code: 'source_drift', item: 'RULE-never-log-customer-email', message: '' },
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
    await lines(cardCommands([{ code: 'source_drift', item: 'RULE with spaces', message: '' }])),
    ['mycontext refresh "RULE with spaces" --yes'],
  );
});

test('cardCommands offers one row per DISTINCT command, in first-ask order', async () => {
  const { cardCommands } = await doctorModule();
  assert.deepEqual(await lines(cardCommands([
    { code: 'source_drift', item: 'RULE-a', message: '' },
    { code: 'index_stale', item: null, message: '' },
    { code: 'source_drift', item: 'RULE-a', message: '' },
    { code: 'corpus_size_fallback_ceiling', item: null, message: '' },
  ])), ['mycontext refresh RULE-a --yes', 'mycontext rebuild', 'mycontext decay']);
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
 * The repair as a CATALOGUE ENTRY — what Execute is handed.
 * -------------------------------------------------------------------------- */

/**
 * **The screen's own repair table is held to `viewmodel.js`' one, code by code.**
 *
 * `repairCommandFor` decided which findings earn a line and composed it as a
 * STRING. A string cannot be executed: the client sends an id and a value bag,
 * never a command, so the screen now carries the same decision in the shape the
 * control takes. Two tables would drift, and the drift would be silent in the
 * direction that matters — a `<code>` showing one command while the confirm ran
 * another. So this holds the new one to the old one by its own bytes, and
 * `viewmodel.js` remains where the decision was established and argued.
 */
test("every repair the screen composes is byte-identical to viewmodel's own line", async () => {
  const { repairFor } = await doctorModule();
  const { repairCommandFor } = await browserModule<ViewModelModule>('lib', 'viewmodel.js');
  const { composeCommand } = await browserModule<CommandModule>('lib', 'command.js');

  const codes = [
    'index_stale', 'audit_log_size', 'corpus_size_fallback_ceiling', 'source_drift',
    'dead_scope', 'orphan_relation', 'source_missing', 'index_missing',
    'some_check_added_next_year',
  ];
  let composed = 0;
  for (const code of codes) {
    for (const item of ['RULE-never-log-customer-email', 'RULE with spaces', null]) {
      const repair = repairFor(code, item);
      const expected = repairCommandFor(code, item);
      if (expected === null) {
        assert.equal(repair, null,
          `${code}/${String(item)}: the screen offers a line viewmodel.js composes none for`);
        continue;
      }
      assert.notEqual(repair, null,
        `${code}/${String(item)}: viewmodel.js composes a line and the screen offers none`);
      assert.equal(composeCommand(repair!.argv), expected, `${code}/${String(item)}`);
      composed += 1;
    }
  }
  assert.ok(composed >= 5,
    `only ${composed} repair(s) were compared; the loop stopped seeing the ones that exist`);
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

  // Two unrepairable (the owner's own corpus), one repairable, one repairable
  // code whose MISSING item makes it unrepairable — the case where the two
  // functions could most easily disagree, since only one of them takes an item.
  const findings: Finding[] = [
    { level: 'warn', code: 'blocked_without_needs', message: 'm', item: 'TASK-a' },
    { level: 'info', code: 'nested_corpus', message: 'm' },
    { level: 'error', code: 'index_stale', message: 'm' },
    { level: 'error', code: 'source_drift', message: 'm' },
  ];
  const chips = findings.filter((f) => repairFor(f.code, f.item ?? null) === null).length;
  const tally = repairTally(findings);
  assert.deepEqual(tally, { findings: 4, repairs: 1 });
  assert.equal(chips + tally.repairs, tally.findings,
    'a finding is either drawn with a repair or drawn with the chip that says it has none; a '
    + 'row counted by both or by neither is the screen disagreeing with its own summary');
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
  assert.ok(/repairFor\(row\.code,\s*row\.item\)\s*===\s*null/.test(doctorSource),
    'the screen no longer asks whether the row has a repair before disclosing that it has none');
  assert.ok(/noRepairChip\(ctx\)/.test(doctorSource), 'nothing draws the disclosure');
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
    repairFor('index_stale', null),
    repairFor('corpus_size_fallback_ceiling', null),
    repairFor('source_drift', 'RULE-a'),
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

  assert.equal(repairFor('index_stale', null)?.id, 'rebuild');
  assert.equal(repairFor('corpus_size_fallback_ceiling', null)?.id, 'decay');
  assert.equal(repairFor('source_drift', 'RULE-a')?.id, 'refresh');
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
  assert.deepEqual(repairFor('source_drift', 'RULE-a')?.values, { id: 'RULE-a', yes: true });
  assert.equal(repairFor('audit_log_size', null)?.id, null,
    'mycontext audit is not in the catalogue; naming an id it does not have would make the '
    + 'confirm render a DIFFERENT command from the one the code above it shows');

  for (const code of ['index_stale', 'corpus_size_fallback_ceiling', 'source_drift']) {
    const id = repairFor(code, 'RULE-a')!.id;
    assert.ok(known.has(id!), `${code} names "${String(id)}", which the catalogue does not have`);
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
    for (const [code, item] of [
      ['index_stale', null], ['corpus_size_fallback_ceiling', null], ['source_drift', 'RULE-a'],
    ] as [string, string | null][]) {
      const repair = repairFor(code, item)!;
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
