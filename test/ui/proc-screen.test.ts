/**
 * The Procedures screen's DECIDABLE half, tested in Node — and the line where
 * that half stops.
 *
 * Spec §6 names the DOM glue in `app.js` and `screens/*.js` as the untested
 * surface, and `test/ui/viewmodel.test.ts`'s own header says why: testing it
 * would need a browser dependency this project does not have. Nothing below
 * builds an element or stands in a `document`. What it does test is everything
 * `screens/proc.js` DECIDES before it touches one:
 *
 *   - the five-row state table, held row for row against the mockup's own four
 *     `<tr>`s — stage, meaning key, chip class, glyph and verdict key — so a
 *     table transcribed by hand is checked to have been transcribed, and its
 *     two DECLARED divergences from the design of record are pinned as
 *     divergences rather than left to a diff;
 *   - that every disclosure code the model serves has a `pr.` key, and that
 *     the model's two frozen sentences are keyed verbatim rather than reworded;
 *   - which chip a REAL injection verdict earns (`injectionChip`), with the
 *     verdicts built by `injection()` itself rather than hand-written, and
 *     including the case where the answer disagrees with the table two inches
 *     above it on the same screen;
 *   - the progress bar's width (`barWidth`), pinned to the mockup's own
 *     `3 / 5` and `inline-size:60%` rather than to this file's arithmetic;
 *   - the one composed settlement (`doneCommand`), pinned to the design of
 *     record's own `<code>` line, refusing on every stage but `active`;
 *   - that no disclosure is dropped (`disclosureMessages`), over the five
 *     codes read out of `src/ui/proc-model.ts` rather than remembered here;
 *   - that every string key the screen names is declared in BOTH tables with
 *     its slots supplied, and that every `pr.` key the English table declares
 *     is placed by the screen — except the five that are sample steps;
 *   - that no translated string is assigned rather than appended (owner ruling
 *     A1), and that no class is invented that the mockup's own section does
 *     not use.
 *
 * ── HOW A BROWSER MODULE IS LOADED HERE, AND WHY NOT DIRECTLY ─────────────
 *
 * `test/ui/viewmodel.test.ts` imports `lib/*.js` through a `file://` URL
 * specifier — the form that both type-checks (these modules are outside
 * `tsconfig.json`'s `include`, so a relative specifier is TS7016) and survives
 * a Windows path. That works there because nothing under `lib/` imports
 * anything.
 *
 * A SCREEN cannot be loaded that way. Every screen names its dependencies by
 * the specifiers the BROWSER resolves — root-absolute URL paths — and Node
 * resolves a leading `/` as a filesystem path from the drive root. So the
 * module's own bytes are read, its two root-absolute specifiers are rewritten
 * to `file://` URLs, and the result is imported as a `data:` module. The
 * rewrite is COUNTED and the result re-checked for a survivor, because a
 * rewrite that silently missed one would import a different module graph than
 * the browser runs — the only way this file could pass while testing the wrong
 * thing. The pattern, and the reasoning, are `work-screen.test.ts`'s.
 *
 * Neither dependency touches a DOM at module scope, so no stand-in `document`
 * is needed to import the screen. One is deliberately NOT supplied: supplying
 * one would let this file drift into testing the glue.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { injection } from '../../src/cli/commands/injection.ts';
import { resolveConfig, type Config } from '../../src/core/config.ts';
import type { Item } from '../../src/core/types.ts';
import { allowedClasses } from '../helpers/shipped-classes.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');
const PROC_JS = path.join(PUBLIC, 'screens', 'proc.js');
const PROC_MODEL = path.join(REPO, 'src', 'ui', 'proc-model.ts');
const MOCKUP = path.join(REPO, 'docs', 'design', 'web-ui-mockup.html');

const procSource = readFileSync(PROC_JS, 'utf8');

interface Chip { cls: string; glyph: string; key: string }
interface StateRow {
  stage: string; meaning: string; chip: string; glyph: string; verdict: string;
}
interface Disclosure { code: string; message: string }

/**
 * The screen's published interface. Hand-declared rather than inferred, so it
 * is an assertion in its own right: a module that drifts from it fails here
 * rather than in a browser nobody is watching.
 */
interface ProcModule {
  STATE_ROWS: StateRow[];
  INJECTION_CHIP: { full: Chip; index: Chip; none: Chip };
  injectionChip: (verdict: unknown) => Chip;
  barWidth: (progress: unknown) => string;
  doneArgv: (procedure: unknown) => string[] | null;
  doneCommand: (procedure: unknown) => string | null;
  disclosureMessages: (groups: unknown[]) => Disclosure[];
  DISCLOSURE_KEY: Record<string, string>;
  DISCLOSURE_COMPOSED: Set<string>;
  render: (root: unknown, ctx: unknown) => Promise<void>;
}

/** The browser's own specifier form: a root-absolute URL path in a `from`. */
const ROOT_SPECIFIER = /(\bfrom\s+')\/([^']+)'/g;

async function procModule(): Promise<ProcModule> {
  let rewritten = 0;
  const text = procSource.replace(ROOT_SPECIFIER, (_all, head: string, spec: string) => {
    rewritten += 1;
    return `${head}${pathToFileURL(path.join(PUBLIC, spec)).href}'`;
  });
  assert.equal(rewritten, 3,
    `expected proc.js to import three browser modules (the command composer and the shared DOM `
    + `parts); the rewrite matched ${rewritten}. A specifier this pattern cannot see is a module `
    + 'Node would resolve from the drive root, and the import below would fail for a reason that '
    + 'reads like a missing file.');
  assert.ok(!/\bfrom\s+'\//.test(text),
    'a root-absolute specifier survived the rewrite — the module graph imported below would not '
    + 'be the one the browser runs');
  const encoded = Buffer.from(text, 'utf8').toString('base64');
  return (await import(`data:text/javascript;charset=utf-8;base64,${encoded}`)) as ProcModule;
}

/** `<section data-p="proc">…</section>`, the design of record for this screen. */
function mockupSection(): string {
  const html = readFileSync(MOCKUP, 'utf8');
  const start = html.indexOf('<section data-p="proc"');
  assert.notEqual(start, -1, 'the mockup has no [data-p="proc"] section');
  const end = html.indexOf('</section>', start);
  assert.notEqual(end, -1, 'the proc section is never closed');
  return html.slice(start, end);
}

/** `&#9650;` → `▲`. The mockup writes its chip glyphs as numeric entities. */
function decodeEntities(text: string): string {
  return text.replace(/&#(\d+);/g, (_all, code: string) => String.fromCodePoint(Number(code)));
}

/* -------------------------------------------------------------------------- *
 * The static table, against the mockup that owns it.
 * -------------------------------------------------------------------------- */

/**
 * The mockup's four state rows, read out of the file rather than remembered.
 *
 * The pattern is deliberately whole-row: a scan that matched the stage name
 * alone would pass a table whose chips had all drifted to one class.
 */
const MOCKUP_ROW =
  /<tr><td class="m">([a-z]+)<\/td><td class="small" data-t="([^"]+)">[^<]*<\/td>\s*<td>\s*<span class="([^"]+)" data-g="([^"]+)" data-t="([^"]+)">/g;

function mockupStateRows(): StateRow[] {
  const rows: StateRow[] = [];
  for (const m of mockupSection().matchAll(MOCKUP_ROW)) {
    rows.push({
      stage: m[1]!, meaning: m[2]!, chip: m[3]!, glyph: decodeEntities(m[4]!), verdict: m[5]!,
    });
  }
  return rows;
}

/**
 * **The state table diverges from the design of record in exactly two places,
 * and both are pinned here rather than left to a diff.**
 *
 * Until 2026-08-31 this asserted byte equality with the mockup's four rows. It
 * cannot any more, and the reason is a ruling and not a convenience: `pr.states`
 * counted four states while `STAGES` has five, and `pr.idx` put *"index line
 * only"* against `ready` while `isEligible` admits `active` only. A screen
 * cannot resolve either alone — a fifth row under a sentence saying "four" is a
 * screen disagreeing with itself — so the sentence, the row and the cell moved
 * together. The mockup is HISTORY
 * (`DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap`) and is not
 * edited.
 *
 * So the assertion is now: the app's table is the mockup's table PLUS the two
 * named divergences, and nothing else. Anything that drifts a third time fails.
 * `DIVERGENCES` is the whole ledger, it is checked to be non-empty and exact,
 * and it may only shrink — the day the owner corrects the mockup, an entry here
 * stops being a divergence and this test says so rather than passing quietly.
 */
const DIVERGENCES = [
  {
    stage: 'ready',
    why: 'the mockup puts pr.idx ("index line only") on the ready row; isEligible admits '
      + 'active only, so a ready procedure reaches neither the injected block nor an index line',
  },
  {
    stage: 'abandoned',
    why: 'the mockup draws no row for the fifth stage, which STAGES has always carried and '
      + 'pr.aband names in prose on this very screen',
  },
];

test('the five-row state table is the mockup\'s, row for row, but for two named divergences', async () => {
  const { STATE_ROWS } = await procModule();
  const drawn = mockupStateRows();

  // A scanner that finds nothing reads exactly like a clean transcription.
  assert.equal(drawn.length, 4,
    `the mockup scan found ${drawn.length} state row(s) in <section data-p="proc">; the design `
    + 'of record has drawn four since it was written and is not edited by this project. A '
    + 'different number means the extraction broke or the owner has moved the mockup — in '
    + 'which case DIVERGENCES below is what changes with it.');

  assert.equal(STATE_ROWS.length, 5,
    'the app draws five rows: STAGES is proposed, ready, active, done, abandoned, and pr.states '
    + 'now counts five to match');

  // Every row the mockup draws that the app draws IDENTICALLY — the
  // transcription, which is still most of the table and is still checked.
  const diverging = new Set(DIVERGENCES.map((d) => d.stage));
  assert.deepEqual(
    STATE_ROWS.filter((row) => !diverging.has(row.stage)),
    drawn.filter((row) => !diverging.has(row.stage)),
    'screens/proc.js draws a state row that is neither the design of record\'s nor a declared '
    + 'divergence. The mockup is the specification for every row not named in DIVERGENCES.',
  );

  // And the two divergences are exactly the rows that differ — no more.
  const differs = STATE_ROWS.filter((row) => {
    const original = drawn.find((d) => d.stage === row.stage);
    return original === undefined || JSON.stringify(original) !== JSON.stringify(row);
  }).map((row) => row.stage);
  assert.deepEqual(differs.sort(), DIVERGENCES.map((d) => d.stage).sort(),
    'the app\'s table differs from the design of record somewhere DIVERGENCES does not name. '
    + 'Either the drift is a defect, or it is a decision that belongs in that ledger with its '
    + 'reason.');

  // The corrected cells, asserted by value so "diverges" cannot mean anything.
  const ready = STATE_ROWS.find((row) => row.stage === 'ready');
  assert.equal(ready?.verdict, 'pr.none',
    'a ready procedure is not injected and is not named in the index — pr.idx would be the '
    + 'mockup\'s claim transcribed rather than the shipped selector\'s behaviour');
  assert.equal(ready?.chip, 'chip warn', 'the chip follows the verdict it wears');
  const abandoned = STATE_ROWS.find((row) => row.stage === 'abandoned');
  assert.equal(abandoned?.meaning, 'pr.s5', 'the fifth row needs a meaning string of its own');
  assert.equal(abandoned?.verdict, 'pr.none', 'an abandoned procedure is not injected');
});

test('the state count in pr.states matches the number of rows drawn, in both languages', async () => {
  // **The contradiction this whole change exists to end.** A row was never
  // added while the heading counted four, and the heading may not drift back
  // now that the row is there. Both tables, because a reader in either language
  // is looking at the same five rows.
  const { STATE_ROWS } = await procModule();
  const en = await table('en');
  const he = await table('he');
  assert.equal(STATE_ROWS.length, 5);
  assert.match(en['pr.states']!, /^Five states,/,
    'pr.states counts the rows of the table it heads; five rows under "Four states" is the '
    + 'screen disagreeing with itself in the space of two elements');
  assert.ok(he['pr.states']!.startsWith('\u05d7\u05de\u05d9\u05e9\u05d4 '),
    'the Hebrew heading counts five too — a translation left at "four" is the same '
    + 'contradiction, shown to half the readers');
});

/**
 * **The OTHER half of the `ready` divergence: the design of record still says
 * the wrong thing, and this is what notices when it stops.**
 *
 * `pr.idx` puts "index line only" against `ready` in the mockup; `isEligible`
 * admits `active` only, so a ready procedure reaches neither the injected block
 * nor an index line. `src/ui/proc-model.ts` says as much in its own words and
 * serves the CLI's sentence as the `ready-is-not-injected` disclosure.
 *
 * The app stopped transcribing that cell on 2026-08-31 and the mockup was not
 * edited, because it is history rather than behaviour. This test is what makes
 * the divergence self-clearing: the day the owner corrects the mockup, it fails
 * and the entry in `DIVERGENCES` comes out with it, rather than the ledger
 * carrying a divergence that no longer exists.
 */
test('the mockup still claims "index line only" on ready — the divergence is still live', () => {
  const ready = mockupStateRows().find((row) => row.stage === 'ready');
  assert.ok(ready !== undefined, 'the mockup no longer draws a `ready` row');
  assert.equal(ready.verdict, 'pr.idx',
    'the mockup\'s ready row no longer says "index line only" — if the owner has ruled, this '
    + 'test and the KNOWN divergence it pins are what change with it');
  assert.equal(ready.chip, 'chip ok',
    'the mockup\'s ready row no longer wears the ok chip');
});

/* -------------------------------------------------------------------------- *
 * injectionChip — the real verdict, not the stage.
 * -------------------------------------------------------------------------- */

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'PROC-a', type: 'procedure', title: 'A procedure', status: 'active',
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null, summaryWas: [], acknowledged: {}, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'body', steps: [], observations: [], relations: [],
    layer: 'project', filePath: 'items/procedure/PROC-a.md',
    ...over,
  };
}

const BASE: Config = resolveConfig({});
const RATIONALE: Config = resolveConfig({ categories: { procedure: { tier: 'rationale' } } });
const DISABLED: Config = resolveConfig({ categories: { procedure: { enabled: false } } });

test('injectionChip reads a REAL verdict: in full, index line only, or not injected', async () => {
  const { injectionChip, INJECTION_CHIP } = await procModule();

  // Every verdict below is built by `injection()` itself, not written out
  // here. A hand-written `{ injected: true }` would test this file's idea of
  // the endpoint's answer rather than the answer.
  const active = injection(item({ status: 'active', always: true }), BASE);
  assert.equal(active.injected, true, 'an active, pinned procedure is injected in full');
  assert.deepEqual(injectionChip(active), INJECTION_CHIP.full);
  assert.equal(INJECTION_CHIP.full.key, 'pr.full',
    'the "in full, every session" chip must carry the key the mockup gives that column');

  // A category retiered to `rationale` — eligible, never injected in full,
  // counted in the session index. That IS "index line only".
  const rationale = injection(item({ status: 'active' }), RATIONALE);
  assert.equal(rationale.gate, 'tier', 'a rationale-tier procedure fails rung 2 and no other');
  assert.deepEqual(injectionChip(rationale), INJECTION_CHIP.index);
  assert.equal(INJECTION_CHIP.index.key, 'pr.idx');

  const off = injection(item({ status: 'active' }), DISABLED);
  assert.equal(off.injected, false, 'a disabled category injects nothing');
  assert.deepEqual(injectionChip(off), INJECTION_CHIP.none);
  assert.equal(INJECTION_CHIP.none.key, 'pr.none');
});

test('a malformed or absent verdict falls to "not injected", never to "in full"', async () => {
  const { injectionChip, INJECTION_CHIP } = await procModule();
  for (const bad of [null, undefined, 'passed', 7, {}, { gate: 'nonesuch' }]) {
    assert.deepEqual(injectionChip(bad), INJECTION_CHIP.none,
      `injectionChip(${JSON.stringify(bad)}) must not claim an item is injected: "in full, every `
      + 'session" is the most expensive assertion on this screen and it needs evidence');
  }
});

/**
 * The disagreement this screen is built to show rather than hide: the table
 * says one thing about `ready` and the card says another, because one is a
 * design and the other is a measurement.
 */
test('a ready procedure wears the chip its real verdict earns, not the table\'s', async () => {
  const { injectionChip, INJECTION_CHIP } = await procModule();

  // `stageOf` reads `ready` off a non-active status plus the `ready` tag
  // (`src/ui/proc-model.ts`), so this is what a ready procedure IS.
  const verdict = injection(item({ status: 'draft', tags: ['ready'] }), BASE);
  assert.equal(verdict.injected, false,
    'a ready procedure is not injected — isEligible admits `active` only');
  assert.deepEqual(injectionChip(verdict), INJECTION_CHIP.none);

  const row = mockupStateRows().find((r) => r.stage === 'ready');
  assert.notEqual(row!.chip, INJECTION_CHIP.none.cls,
    'the table and the card now agree about `ready`. That is either a mockup change the owner '
    + 'made — in which case this test and the transcription move together — or this screen has '
    + 'quietly corrected the design of record, which is the thing it must not do.');
});

/* -------------------------------------------------------------------------- *
 * barWidth — pinned to the mockup's own sample.
 * -------------------------------------------------------------------------- */

test('barWidth computes the width the mockup hard-codes beside its own 3 / 5', async () => {
  const { barWidth } = await procModule();
  const section = mockupSection();

  const counts = /<span class="m">(\d+) \/ (\d+)<\/span>/.exec(section);
  assert.ok(counts !== null, 'the mockup no longer draws a "<done> / <total>" run on this card');
  const width = /<i class="f" style="inline-size:(\d+%)"><\/i>/.exec(section);
  assert.ok(width !== null, 'the mockup no longer draws a filled bar on this card');

  assert.equal(barWidth({ done: Number(counts[1]), total: Number(counts[2]) }), width[1],
    'the bar drawn for the mockup\'s own sample is not the width the mockup draws for it');
});

test('barWidth refuses to report a run that never had a step as finished', async () => {
  const { barWidth } = await procModule();
  assert.equal(barWidth({ done: 0, total: 0 }), '0%',
    '0 of 0 is a procedure whose steps were never written, not a completed one — a full gold '
    + 'bar over it would report a run that never had a step to complete');
  assert.equal(barWidth({ done: 5, total: 5 }), '100%');
  assert.equal(barWidth({ done: 9, total: 5 }), '100%', 'the fill is clamped, not overflowed');
  for (const bad of [null, undefined, {}, { done: 'x', total: 'y' }, { total: -1, done: 1 }]) {
    assert.equal(barWidth(bad), '0%',
      `barWidth(${JSON.stringify(bad)}) must be a width and never NaN% — a malformed style value `
      + 'is dropped by CSSOM and leaves the previous width standing');
  }
});

/* -------------------------------------------------------------------------- *
 * doneCommand — the one composed line.
 * -------------------------------------------------------------------------- */

test('doneCommand composes the design of record\'s own line, for the id the card names', async () => {
  const { doneCommand } = await procModule();
  const section = mockupSection();

  const drawn = /<code>([^<]+)<\/code>/.exec(section);
  assert.ok(drawn !== null, 'the mockup no longer composes a command on this screen');
  const sample = /data-v="item">([^<]+)</.exec(section);
  assert.ok(sample !== null, 'the mockup no longer names a sample procedure id on this screen');

  assert.equal(doneCommand({ stage: 'active', id: sample[1] }), drawn[1],
    'the composed settlement is not the one the design of record draws. The command a copy '
    + 'button offers is the whole capability of this screen — it changes with the mockup, and '
    + 'never on its own.');
});

test('doneCommand offers nothing on any stage but active — pr.w3 is the reason', async () => {
  const { doneCommand } = await procModule();
  for (const stage of ['proposed', 'ready', 'done', 'abandoned']) {
    assert.equal(doneCommand({ stage, id: 'PROC-a' }), null,
      `a ${stage} procedure was offered "procedure done". pr.w3 is "active → done stays yours": `
      + 'a settlement for a run that has not started, or for one already closed, is a line the '
      + 'user would paste and the CLI would answer for.');
  }
  assert.equal(doneCommand(null), null);
  assert.equal(doneCommand('PROC-a'), null);
});

test('doneCommand quotes through the one composer, and refuses an id it cannot quote', async () => {
  const { doneCommand } = await procModule();
  assert.equal(doneCommand({ stage: 'active', id: 'PROC with spaces' }),
    'mycontext procedure done "PROC with spaces"',
    'an id carrying a space must be quoted before it reaches a clipboard — the composer is the '
    + 'one place that quoting lives');
  assert.throws(() => doneCommand({ stage: 'active', id: '' }),
    'a procedure with no id composes no settlement; an invented id inside a <code> a copy '
    + 'button offers is the one thing this UI must never produce');
});

/* -------------------------------------------------------------------------- *
 * The one control, and why this screen's half of it is Copy alone.
 * -------------------------------------------------------------------------- */

/**
 * **`doneArgv` is the argv and `doneCommand` is what it composes to.** The
 * Copy-and-Execute control takes an argv; a string cannot be executed, and a
 * screen holding both as independent values is the drift the confirm exists to
 * prevent — a `<code>` showing one command while the confirm named another.
 */
test('doneCommand is exactly what doneArgv composes to, at every stage', async () => {
  const { doneArgv, doneCommand } = await procModule();
  const command = await import(pathToFileURL(path.join(PUBLIC, 'lib', 'command.js')).href) as {
    composeCommand: (argv: string[]) => string;
  };
  assert.deepEqual(doneArgv({ stage: 'active', id: 'PROC-a' }),
    ['mycontext', 'procedure', 'done', 'PROC-a']);
  assert.equal(command.composeCommand(doneArgv({ stage: 'active', id: 'PROC-a' })!),
    doneCommand({ stage: 'active', id: 'PROC-a' }));
  for (const stage of ['proposed', 'ready', 'done', 'abandoned']) {
    assert.equal(doneArgv({ stage, id: 'PROC-a' }), null, stage);
  }
  assert.equal(doneArgv(null), null);
});

/**
 * **`mycontext procedure` is not in the command catalogue at all, so the
 * settlement line gets Copy and no Execute — and that is the correct outcome.**
 *
 * The screen already recorded the fact and its consequence: *"the command
 * catalogue declares no `procedure` entry at all … the argv is written here,
 * once, and reported: the catalogue is where a flag set gets verified against
 * the real parser, and a command composed outside it has had no such check."*
 * An unverified argv is exactly what must not be handed an Execute button — the
 * client sends an id and the server rebuilds from the catalogue, so an id the
 * catalogue does not have has nothing to rebuild.
 *
 * There is a second reason, and it is this screen's own: `pr.w3` — *"active →
 * done stays yours"* — is why the composed line carries no `--yes`. The
 * confirmation prompt IS the human's decision, and it lives in their shell.
 */
test('the settlement line names no catalogue id, because the catalogue has no procedure', async () => {
  const defs = await import(pathToFileURL(path.join(PUBLIC, 'lib', 'palette-defs.js')).href) as {
    PALETTE: { name: string }[];
  };
  assert.equal(defs.PALETTE.find((def) => def.name.startsWith('procedure')), undefined,
    'the catalogue gained a `procedure` entry — this screen must now decide whether pr.w3 '
    + 'survives an Execute button beside a line that deliberately carries no --yes');
  assert.ok(/commandActions\(\{[\s\S]{0,200}?id: null/.test(procSource),
    'the screen no longer passes a null id; a command outside the catalogue must not offer '
    + 'Execute');
});

/**
 * **One control, not a tenth copy button.** The confirm is the security
 * boundary and nine hand-rolled spellings of it would be nine chances to get it
 * wrong. A source scan, because the adoption is exactly the ABSENCE of the old
 * code.
 */
test('the screen adopts the shared control and keeps no copy button of its own', () => {
  assert.ok(procSource.includes("from '/lib/command-actions.js'"),
    'the screen does not import the shared Copy-and-Execute control');
  assert.ok(!/navigator\.clipboard/.test(procSource),
    'the screen still talks to the clipboard itself — Copy lives in lib/command-actions.js now');
});

/* -------------------------------------------------------------------------- *
 * disclosureMessages — nothing is dropped silently.
 * -------------------------------------------------------------------------- */

/** The five codes, read out of the model rather than remembered here. */
function disclosureCodes(): string[] {
  const source = readFileSync(PROC_MODEL, 'utf8');
  const block = /const DISCLOSURE_CODES = \[([\s\S]*?)\] as const;/.exec(source);
  assert.ok(block !== null, 'src/ui/proc-model.ts no longer declares DISCLOSURE_CODES');
  return [...block[1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
}

test('every disclosure code the model can serve survives the screen\'s deduplication', async () => {
  const { disclosureMessages } = await procModule();
  const codes = disclosureCodes();
  assert.equal(codes.length, 5,
    `the model declares ${codes.length} disclosure code(s); it has declared five since the routes `
    + 'were written. A sixth is a sixth fact this screen has to keep, not a number to update.');

  const out = disclosureMessages([codes.map((code) => ({ code, message: `about ${code}` }))]);
  assert.deepEqual(out.map((d) => d.code), codes,
    'a disclosure was dropped or reordered. Every one of them is unconditionally true of the '
    + 'row it arrived with, and a screen that renders the rows and drops these has re-created '
    + 'the silent drop they exist to end.');
});

test('every disclosure code has a pr. key, and the constant two are keyed VERBATIM', async () => {
  const { DISCLOSURE_KEY, DISCLOSURE_COMPOSED } = await procModule();
  const codes = disclosureCodes();
  const en = await table('en');
  const he = await table('he');

  // **Both directions.** A code with no key would reach a Hebrew reader in
  // English — the defect this closes — and a key for a code the model cannot
  // serve is a sentence that never renders.
  assert.deepEqual(Object.keys(DISCLOSURE_KEY).sort(), [...codes].sort(),
    'screens/proc.js keys a set of disclosure codes that is not the set src/ui/proc-model.ts '
    + 'serves. A sixth code upstream needs a sixth key here, in both tables.');

  for (const key of Object.values(DISCLOSURE_KEY)) {
    assert.ok(key in en, `${key} is named by proc.js and missing from the English table`);
    assert.ok(key in he, `${key} is named by proc.js and missing from the Hebrew table`);
  }

  // **The three composed codes are a SUBSET of the five**, and the two left
  // over are the model's frozen constants. Getting this wrong in the
  // conservative direction only repeats a sentence; there is no direction in
  // which it drops one, because an unknown code renders the served message.
  for (const code of DISCLOSURE_COMPOSED) {
    assert.ok(codes.includes(code), `${code} is not a code the model serves`);
  }
  assert.deepEqual([...DISCLOSURE_COMPOSED].sort(), [
    'category-disabled', 'file-ticks-are-not-progress', 'unreadable-progress-records',
  ], 'these are the three sentences the model builds out of ids, counts and a category name — '
    + 'the parts no string table can carry, which is why the served sentence is drawn under '
    + 'the keyed one for exactly these');

  // **The two constants are keyed VERBATIM**, so an English reader sees the
  // byte the endpoint sent and the keyed rendering is a translation rather than
  // a rewrite. Read out of the model's own source, not remembered.
  const model = readFileSync(PROC_MODEL, 'utf8');
  const literal = (name: string): string => {
    const block = new RegExp(`const ${name}: Disclosure = \\{([\\s\\S]*?)\\n\\};`).exec(model);
    assert.ok(block !== null, `src/ui/proc-model.ts no longer declares ${name}`);
    return [...block[1]!.matchAll(/'((?:[^'\\]|\\.)*)'/g)]
      .map((m) => m[1]!)
      .filter((part) => part.includes(' '))
      .join('');
  };
  // A scanner that finds nothing reads exactly like a clean match. Both
  // sentences are long; an extractor that returned '' would pass every
  // comparison below against a key that had also been emptied.
  for (const name of ['WORKSPACE_SCOPE', 'READY_DISCLOSURE']) {
    assert.ok(literal(name).length > 60,
      `the extractor read ${literal(name).length} character(s) out of ${name} — it has been a `
      + 'multi-sentence constant since the routes were written, so this is the pattern breaking '
      + 'rather than the model changing');
  }

  // `{m:…}` is how this UI writes what the CLI writes with backticks: the
  // markers are stripped, and what is left must be the model's sentence.
  const unmarked = (value: string): string => value.replace(/\{m:([^}]*)\}/g, '$1');
  assert.equal(unmarked(en[DISCLOSURE_KEY['progress-is-workspace-scoped']!]!),
    literal('WORKSPACE_SCOPE'),
    'pr.d1 is no longer the endpoint\'s own sentence. It is a frozen constant on every '
    + 'response, so the key may translate it and may not reword it.');
  assert.equal(unmarked(en[DISCLOSURE_KEY['ready-is-not-injected']!]!).replace(/`/g, ''),
    literal('READY_DISCLOSURE').replace(/`/g, ''),
    'pr.d2 is no longer the endpoint\'s own sentence — and it is the one that explains this '
    + 'screen\'s own state table to the reader looking at it');
});

test('one sentence said twice renders once; two sentences under one code both render', async () => {
  const { disclosureMessages } = await procModule();
  const scope = { code: 'progress-is-workspace-scoped', message: 'progress is per workspace.' };

  // The list route and every detail route carry this one unconditionally, so a
  // screen reading a list plus N details is handed it N+1 times.
  const deduped = disclosureMessages([[scope], [scope], [scope]]);
  assert.equal(deduped.length, 1, 'the same sentence is not worth saying three times');

  // ...but `file-ticks-are-not-progress` names ITS OWN item and steps, so two
  // procedures produce two different sentences under one code. Collapsing by
  // code would drop the second, which is the exact silent drop this array
  // exists to prevent.
  const ticks = disclosureMessages([[
    { code: 'file-ticks-are-not-progress', message: 'the Markdown for PROC-a ticks step 4' },
    { code: 'file-ticks-are-not-progress', message: 'the Markdown for PROC-b ticks step 1' },
  ]]);
  assert.equal(ticks.length, 2,
    'two procedures with hand-edited ticks were collapsed into one sentence — deduplication is '
    + 'by MESSAGE, never by code');

  assert.deepEqual(disclosureMessages([null, undefined, [null, { message: '' }, 'x']]), [],
    'a malformed disclosures array must render nothing rather than a blank paragraph');
});

/* -------------------------------------------------------------------------- *
 * The screen against the two string tables and against the mockup.
 * -------------------------------------------------------------------------- */

async function table(language: string): Promise<Record<string, string>> {
  const file = path.join(PUBLIC, 'strings', `${language}.js`);
  const mod = await import(pathToFileURL(file).href) as { strings: Record<string, string> };
  return mod.strings;
}

/**
 * Every key `proc.js` names, by the two shapes a screen can name one in: a
 * `ctx.t(…)` call, and a bare key literal sitting in one of the screen's own
 * tables (`STATE_ROWS`, `INJECTION_CHIP`, the `for (const key of […])` loops).
 *
 * The second pattern is the loose one on purpose. `viewmodel.test.ts` scans
 * every screen for `ctx.t('…')` and cannot see a key held in a table, and this
 * screen holds ten of them there — more than it passes literally.
 */
const KEY_LITERAL = /'([a-z]+\.[a-z0-9]+)'/g;

function keysNamed(): { key: string; args: string | null }[] {
  const out: { key: string; args: string | null }[] = [];
  const seen = new Set<string>();
  for (const m of procSource.matchAll(/ctx\.t(?:Flat)?\('([^']+)'/g)) {
    const after = procSource.slice(m.index + m[0].length);
    const open = after.indexOf('{');
    const close = after.indexOf(')');
    out.push({ key: m[1]!, args: open !== -1 && (close === -1 || open < close) ? after : null });
    seen.add(m[1]!);
  }
  for (const m of procSource.matchAll(KEY_LITERAL)) {
    if (seen.has(m[1]!)) continue;
    seen.add(m[1]!);
    out.push({ key: m[1]!, args: null });
  }
  return out;
}

test('every string key the Procedures screen names is declared in both tables, with its slots supplied', async () => {
  const en = await table('en');
  const he = await table('he');
  const used = keysNamed();

  // A scanner that finds nothing reads exactly like a clean file.
  assert.ok(used.length >= 21,
    `the scan found ${used.length} key(s) in proc.js; the screen names twenty-one. A collapse `
    + 'means the patterns stopped matching, not that the screen stopped naming keys.');
  assert.ok(!used.some((u) => u.key === 'btn.copy'),
    'the screen words its own Copy button again; Copy is lib/command-actions.js\' word now, and '
    + 'two screens wording one button is how they come to disagree about it');

  // The grammar has ONE parser and this is it. Eight files used to carry a
  // private scanner instead, all of them predating emphasis, and every one
  // read `{b:` as a substitution named `b:...` the day emphasis landed.
  const { slots: slotsOf } = await import(
    new URL('../../src/ui/public/lib/i18n.js', import.meta.url).href
  ) as { slots: (template: string) => string[] };

  for (const { key, args } of used) {
    assert.ok(key in en, `proc.js names ${key}, missing from the English table`);
    assert.ok(key in he, `proc.js names ${key}, missing from the Hebrew table`);
    // Both tables, not only English: `t()` throws on a substitution the caller
    // did not pass, and it throws in whichever language the reader chose.
    for (const template of [en[key]!, he[key]!]) {
      for (const slot of slotsOf(template)) {
        assert.ok(args !== null && new RegExp(`\\b${slot}\\s*:`).test(args),
          `${key} declares a {${slot}} slot that the call site does not supply — t() throws and `
          + 'the screen blanks');
      }
    }
  }
});

/**
 * The five keys this screen cannot place, named rather than quietly missing.
 *
 * `pr.k1`–`pr.k5` are the mockup's five SAMPLE steps — "Add the integer column
 * beside the decimal one" and its four siblings. A real procedure's steps come
 * from the item, so there is nothing on a live screen for them to key. They
 * are the only `pr.` keys with that property: `pr.item` is `{mv:item}`, a slot,
 * and is placed with a real id.
 *
 * Listed here so the count can only shrink, and so a SIXTH unplaced key fails
 * rather than joining them.
 */
const SAMPLE_STEP_KEYS = ['pr.k1', 'pr.k2', 'pr.k3', 'pr.k4', 'pr.k5'];

test('every pr. key the English table declares is placed by the screen, bar the five sample steps', async () => {
  const en = await table('en');
  const declared = Object.keys(en).filter((key) => key.startsWith('pr.')).sort();
  const named = new Set(keysNamed().map((u) => u.key));

  // 26 from the day this screen was drawn, 27 since 2026-08-30 (`pr.disc`), 34
  // since 2026-08-31. The seven are the whole of this round's copy: `pr.s5`,
  // the fifth state's meaning string; `pr.empty`, the measured zero; and
  // `pr.d1`-`pr.d5`, one per code in the closed set `src/ui/proc-model.ts`
  // serves, which is what stopped five English sentences reaching a Hebrew
  // reader untranslated.
  assert.equal(declared.length, 34,
    `the English table declares ${declared.length} pr. key(s); it has been 34 since the `
    + 'disclosure keys landed. A new one is a new sentence on this screen and needs placing.');
  assert.deepEqual(declared.filter((key) => !named.has(key)), SAMPLE_STEP_KEYS,
    'these pr. keys are declared and drawn nowhere. Only the mockup\'s five sample steps may be '
    + 'in this list — every other key is a sentence of the design of record that silently does '
    + 'not render.');
  for (const key of SAMPLE_STEP_KEYS) {
    assert.ok(key in en, `${key} is listed as an unplaced sample step and no longer exists`);
  }
});

test('no translated string is assigned — t() returns nodes and they are appended (ruling A1)', async () => {
  // `t()` returns Node[]. Assigning one to `textContent` renders `[object
  // Object]`; assigning `tFlat()` to `innerHTML` would destroy the `.m` spans
  // that carry the direction isolation, which is the mockup's own standing
  // rule. Neither is reachable by any other test: this module's DOM half is
  // never evaluated.
  assert.ok(!/textContent\s*=\s*ctx\.t/.test(procSource),
    'a translated value is assigned to textContent');
  assert.ok(!/innerHTML/.test(procSource), 'innerHTML has no legitimate use in a screen module');
  assert.ok(!/ctx\.tFlat\(/.test(procSource),
    'tFlat is for attribute sinks only, and this screen has no attribute sink — reaching for it '
    + 'to fill an element is the bug that ruling A1 names');
  assert.ok(/\.append\(\.\.\.ctx\.t\(/.test(procSource),
    'the screen appends no translated nodes at all — the scan above is checking nothing');
});

test('the screen reads only the two routes, only through ctx.api', async () => {
  assert.ok(procSource.includes("ctx.api('/api/procedures')"),
    'the screen no longer reads the list route');
  assert.ok(procSource.includes('/api/procedure/${encodeURIComponent('),
    'the screen no longer reads the detail route with an encoded id');
  // `ctx.api` is GET-only and token-headered. A screen reaching past it for a
  // raw request would be an untokened read at best and an unruled write at
  // worst — the property `test/ui/no-writes.test.ts` holds over the server
  // half and `lib/command.js` over the browser half.
  for (const forbidden of ['fetch(', 'XMLHttpRequest', 'navigator.sendBeacon', 'WebSocket']) {
    assert.ok(!procSource.includes(forbidden),
      `proc.js names ${forbidden}. Every read on this screen goes through ctx.api, which is GET `
      + 'and carries the token; there is no POST in the contract at all.');
  }
});

test('the screen invents no class the mockup\'s own proc section does not use', async () => {
  const section = mockupSection();
  const drawn = new Set<string>();
  for (const m of section.matchAll(/class="([^"]+)"/g)) {
    for (const token of m[1]!.trim().split(/\s+/)) drawn.add(token);
  }
  assert.ok(drawn.size >= 10, `the mockup scan found ${drawn.size} class token(s) — too few to be `
    + 'the proc section, so the extraction is broken rather than the screen clean');

  // Two shapes: a class passed to `el(tag, cls, …)`, and a class held in one of
  // the screen's own chip tables. A scan that saw only the first would miss
  // every chip on the screen, which is where a wrong class does the most harm.
  const written: string[] = [];
  for (const m of procSource.matchAll(/\bel\('[a-z0-9]+',\s*'([^']*)'/g)) written.push(m[1]!);
  for (const m of procSource.matchAll(/(?:chip|cls):\s*'([^']+)'/g)) written.push(m[1]!);
  assert.ok(written.length >= 14,
    `the proc.js scan found ${written.length} class string(s); the screen writes at least `
    + 'fourteen. A collapse means the pattern stopped matching.');

  for (const value of written) {
  const allowed = allowedClasses(drawn);
    for (const token of value.trim().split(/\s+/)) {
      // `allowed`, not `drawn`: the mockup's classes UNION what styles.css
      // actually styles. See test/helpers/shipped-classes.ts — the app is what
      // gets built now, so a NEW class with a real rule is ordinary development;
      // a typo still has no rule anywhere and still fails here.
      assert.ok(allowed.has(token),
        `proc.js writes class "${token}", which <section data-p="proc"> never uses. A class the `
        + 'design of record does not draw is either a typo or a decision the owner has not taken.');
    }
  }

  // The composites the screen turns on, pinned as whole attribute values
  // rather than as loose tokens: a chip that took `chip` without `gov`, or a
  // card that took `card` without `pane`, would satisfy the token check above
  // and draw the wrong thing.
  for (const composite of ['card pane', 'chip gov', 'chip ok', 'chip warn']) {
    assert.ok(section.includes(`class="${composite}"`),
      `the mockup no longer draws class="${composite}" — the design of record moved`);
    assert.ok(written.includes(composite),
      `proc.js no longer writes the "${composite}" pair the mockup draws`);
  }
});

/**
 * **The two kinds this screen deliberately does not draw**, pinned so the
 * KNOWN_GAPS ledger and this file cannot disagree about why.
 *
 * The mockup's `.verdict` on this screen holds one thing — the PROPOSED badge
 * — and that badge is retired: the task record retires it as a scope marker,
 * the shell computes the rail's copy from `SCREENS` membership so it vanishes
 * the moment this module is registered, and the owner has already ruled on the
 * identical case on the preview screen. An empty `.verdict` is not a verdict,
 * so neither is drawn.
 */
test('the retired PROPOSED badge and its empty box are not drawn, and the mockup still has both', () => {
  const section = mockupSection();
  assert.ok(section.includes('<span class="verdict"><span class="prop">PROPOSED</span></span>'),
    'the mockup no longer badges this screen PROPOSED — if it was removed there, this deliberate '
    + 'omission is no longer a divergence and both the ledger entry and this test come out');
  assert.ok(!procSource.includes("'prop'"),
    'proc.js draws the retired PROPOSED badge. A built screen that badges itself a proposal '
    + 'contradicts the rail, which drops the badge the moment the screen is registered.');
  assert.ok(!procSource.includes("'verdict'"),
    'proc.js draws a .verdict box with nothing in it — pr. declares no verdict key, and an '
    + 'empty container claims this screen states a verdict it does not have');
});
