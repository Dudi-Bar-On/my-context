/**
 * **Builds the SIMULATED corpus the UI is developed against.**
 *
 * Owner ruling, 2026-08-23 (`DEC-the-ui-is-developed-against-a-simulated-corpus-until-the`):
 * until the screens are finished they are developed and demonstrated against a
 * corpus that contains at least one of everything the mockup draws. The real
 * corpus is never written to for a demonstration.
 *
 * ── WHY THIS EXISTS, WHICH IS NOT "FIXTURES ARE EASIER" ────────────────────
 *
 * A real corpus cannot demonstrate a feature it does not happen to exercise,
 * and this project lost a day to exactly that. The audit stream drew no token
 * bars, no hatched voids and no regime rule because the repository's recent
 * history was fifty consecutive mutations. The tier ribbon drew no ghosts
 * because the corpus does not spill at its real budgets. The activity pulse
 * drew nothing because nothing had happened in the last twenty minutes. Every
 * one of those absences looked exactly like missing code and cost a round of
 * investigation to prove it was not.
 *
 * **An absence that cannot be told from a defect is worse than either.**
 *
 * Dogfooding is NOT being abandoned — it found the 5,888px scene and the 957
 * unstyled coverage buttons, and neither would have appeared in any fixture
 * anyone would have thought to write. It returns as the final UI task
 * (`TASK-last-ui-task-return-the-ui-to-the-real-corpus`).
 *
 * ── HOW IT IS BUILT ────────────────────────────────────────────────────────
 *
 * Through the REAL CLI, command by command, never by writing `.my_context`
 * files directly. Two reasons. A corpus assembled by hand is a corpus whose
 * checksums the product would reject, and `mycontext doctor` would then report
 * a mismatch nobody caused. And building it through the CLI means this script
 * exercises the same write path a user does, so a corpus it cannot build is a
 * bug worth knowing about.
 *
 * The audit log is the one exception and is appended directly, because its
 * records are HISTORY: `recordAudit` stamps `at` with the current instant, and
 * the whole point here is records spread across the pulse's twenty-minute
 * window and across days. Writing them through the CLI would put all 200 in the
 * same second and the pulse would be one column again.
 *
 * ── BUDGETS ARE SMALL ON PURPOSE ───────────────────────────────────────────
 *
 * The real corpus budgets 16,000 pinned tokens and holds 3,581, so it never
 * spills and the ghost lane is always empty. Here they are small enough that
 * ordinary content overruns them, because the spill is a FEATURE the mockup
 * draws and a feature nobody can see is a feature nobody has checked.
 *
 * Usage:  node scripts/demo-corpus.ts [--out <dir>]
 * Default output: `<repo>/.demo-corpus` (gitignored — it is a build product).
 */
import { updateItem } from '../src/core/mutate.ts';
import { openRebuiltStore } from '../src/core/open-store.ts';
import { stageRevision } from '../src/core/revision.ts';
import { resolveWorkspace } from '../src/core/workspace.ts';
import { execFileSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(REPO, 'src', 'cli', 'index.ts');

const outFlag = process.argv.indexOf('--out');
const OUT = outFlag === -1
  ? path.join(REPO, '.demo-corpus')
  : path.resolve(process.argv[outFlag + 1] ?? '');

/** One CLI call, with its exit code checked. A fixture that half-built itself
 *  is worse than none: every screen after it demonstrates the wrong thing. */
function cli(args: string[]): void {
  try {
    execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', CLI, ...args], {
      cwd: OUT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    throw new Error(`demo-corpus: \`mycontext ${args.join(' ')}\` failed\n${e.stdout ?? ''}${e.stderr ?? ''}`);
  }
}

/** Prose long enough to cost real tokens, so budgets are reached and spills
 *  happen. Deterministic — no randomness anywhere in this script, so two runs
 *  produce the same corpus and a screenshot means the same thing twice. */
function body(topic: string, paragraphs: number): string {
  const out: string[] = [];
  for (let p = 0; p < paragraphs; p++) {
    out.push(
      `${topic} — paragraph ${p + 1}. This text exists to occupy a measurable number ` +
      'of tokens so that the tier ribbon reaches its budget, the headroom line has a ' +
      'number to report, and the ghost lane has something to draw. It is deliberately ' +
      'ordinary prose: the point is its LENGTH, not its content, and inventing ' +
      'plausible-looking project knowledge here would put sentences into a corpus that ' +
      'nobody decided and that a reader could mistake for a real decision.',
    );
  }
  return out.join('\n\n');
}

console.log(`demo-corpus: building at ${OUT}`);
// **The CONTENTS are removed, not the directory itself.** On Windows a
// directory cannot be removed while any process holds it — a shell whose `cd`
// landed there, a server that has not fully exited, an indexer — and `rmSync`
// surfaces that as `EPERM` on the fixture root, which reads as a permissions
// problem and is not one. Emptying it needs no handle on the directory, so a
// stray `cd` no longer costs a rebuild. The one thing this must not do is
// leave the previous corpus half-standing: every entry goes, and `mkdirSync`
// below still covers the first run.
if (existsSync(OUT)) {
  for (const entry of readdirSync(OUT)) rmSync(path.join(OUT, entry), { recursive: true, force: true });
}
mkdirSync(OUT, { recursive: true });

cli(['init']);

// ── Budgets small enough that ordinary content spills ──────────────────────
const configPath = path.join(OUT, '.my_context', 'config.json');
const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
//
// **`continuity` is the one budget NOT scaled down, and it is written out
// rather than left to the default so the divergence is a decision on the page
// instead of an omission.**
//
// The other four are a tenth of the product's, because the point is to make
// ordinary content overrun them — a spill is a feature the mockup draws, and a
// feature nobody can see is a feature nobody has checked. That argument does
// not carry to this tier. The other four budget a candidate set the corpus
// grows on its own; this one admits only items explicitly marked
// `continuity: true`, so scaling it down would not produce a demonstrative
// spill — it would spill the ENTIRE tier and leave the ribbon drawing exactly
// the empty track that the two removed guards were written to excuse.
//
// `plan:live seq:10` proposed "a proportionate `budgets.continuity`" on the
// reasoning that "the 2,000 default is wildly out of scale for that fixture
// and would make the tier admit everything". That reasoning assumed the tier
// would be demonstrated by MARKING one of the corpus's existing reference
// items, which measure ~4,100 and ~17,900 estimated tokens. It is not: the
// item authored below is a bounded pointer of a couple of hundred, which is
// the shape `DEC-continuity-gets-its-own-budget-and-the-item-it-holds-must-be`
// rules the tier must carry. Against that shape 2,000 is the product's own
// figure doing the product's own job, and the fixture demonstrates the ruling
// rather than a number invented for it.
config['budgets'] = { pinned: 240, jit: 180, restored: 240, continuity: 2000, index: 90 };
// **The same category configuration the real corpus runs**, so the demo
// exercises the shape the product is actually used in. `task` is not in any
// stock profile — it is a project-defined category — and a demo corpus without
// it cannot populate the Work or Status screens at all. Copied field for field
// rather than invented, so the two corpora agree about what a task IS.
config['categories'] = {
  reference: { tier: 'normative' },
  task: {
    tier: 'rationale',
    prefix: 'TASK',
    description: 'A unit of planned work, tracked to completion. Its plan, sequence, state and ' +
      'progress live in extra fields; the body is what the task actually requires.',
    extraFields: ['plan', 'seq', 'state', 'progress', 'source', 'last_change', 'priority'],
  },
};
writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log('demo-corpus: budgets set small so the ribbon spills; task category enabled');

// ── THE REAL CORPUS IS THE BASE, AND ONLY THE SCENE IS SYNTHETIC ───────────
//
// **Owner ruling, 2026-08-26.** This script used to build every item from
// nothing: six pinned candidates and three scoped ones, nine normative items in
// total. That was too small to be a demo of anything, and the arithmetic is
// what proved it — one session's delivery consumes about six of the nine, so
// `Injected now` and the injection preview were competing for the same items.
// The fixture papered over it by DELETING the newest session's seen file, which
// is why that screen landed on an empty table
// (`TASK-injected-now-lands-on-the-one-session-that-has-no-lines-and`), and why
// every bounded list read "Showing all 4" against a cap of 20.
//
// The obvious answer was to write forty more items by hand, and the owner
// rejected it for a better one: **copy the real corpus in as the base, and
// author only what the scene needs and the real corpus does not have.** It is
// better on three counts. The bodies are REAL — nobody invents plausible
// project knowledge, which this script's own `body()` helper refuses to do and
// which the owner has rejected by name once already. The depth is real: 51
// normative items rather than 9, so a session can carry a full seen file AND
// still have a full delivery ahead of it. And it costs nothing to maintain,
// because it tracks the real corpus instead of drifting from it.
//
// **What is copied is `items/` and NOTHING else.** Not `config.json` (the
// budgets above are deliberately small and the real ones are not), not
// `state/`, not `.audit/`, not the index — every one of those is either scene
// state this script builds itself or a projection `rebuild` derives. Copying a
// projection would be copying a conclusion rather than its evidence.
//
// **The copied items get no `mutation` records, and that is correct.** They are
// the corpus as it stood BEFORE this fixture's session history begins; the
// items added below are the ones this scene authors, and they get their records
// from the real code path like everything else here.
const REAL_ITEMS = path.join(REPO, '..', '.my_context', 'items');
if (existsSync(REAL_ITEMS)) {
  cpSync(REAL_ITEMS, path.join(OUT, '.my_context', 'items'), { recursive: true });
  cli(['rebuild']);
  const copied = readdirSync(path.join(OUT, '.my_context', 'items'))
    .map((dir) => readdirSync(path.join(OUT, '.my_context', 'items', dir)).length)
    .reduce((a, b) => a + b, 0);
  console.log(`demo-corpus: ${copied} real items copied in as the base, then rebuilt`);
} else {
  // Named rather than swallowed: a demo built without the base is a DIFFERENT
  // fixture, and a screenshot taken against it would mean something else.
  console.log(`demo-corpus: WARNING — no real corpus at ${REAL_ITEMS}; building the scene alone, `
    + 'which is nine normative items and too small to demonstrate a bound');
}

// ── A REPOSITORY FOR THE CORPUS TO BE ABOUT ────────────────────────────────
//
// Measured on 2026-08-23 by the agents closing the Coverage-gaps and Scope-
// coverage screens: this corpus contained NO repository files at all.
// `/api/coverage` answers `files: []`, so the gaps table renders three column
// heads over an empty body and the magnitude bar has nothing to size — on a
// build where both are written and correct. Two screens undemonstrable, for a
// reason that is the fixture's and not the code's, which is the exact confusion
// `DEC-the-ui-is-developed-against-a-simulated-corpus-until-the` was written to
// end. The hook records below already NAME `src/api/handler.ts` and
// `src/db/migrate.ts`; nothing ever created them.
//
// So: a small tree, deliberately shaped rather than uniform. Some directories
// fall inside a pinned item's scope and some do not, because a coverage screen
// whose every row is governed reports nothing and a screen whose every row is
// ungoverned reports noise. `src/billing/**` is the scope the Capture screen's
// own mockup sample uses, so the two screens agree about one path.
const REPO_FILES: string[] = [
  'src/api/handler.ts', 'src/api/router.ts', 'src/api/middleware.ts',
  'src/billing/invoice.ts', 'src/billing/ledger.ts', 'src/billing/tax.ts',
  'src/db/migrate.ts', 'src/db/pool.ts',
  'src/ui/render.ts', 'src/ui/theme.ts',
  'docs/architecture.md', 'docs/onboarding.md',
  'scripts/release.ts',
  'test/api/handler.test.ts', 'test/billing/invoice.test.ts',
];
for (const rel of REPO_FILES) {
  const file = path.join(OUT, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  // Deterministic, and long enough to be a real file rather than a stub — this
  // script has no randomness anywhere and must not gain any.
  writeFileSync(file, [
    `// ${rel} — demo repository file, written by scripts/demo-corpus.ts.`,
    '// It exists so the coverage walk has something to walk. Its CONTENT is',
    '// not read by anything: coverage is about paths and the scopes that match',
    '// them, never about what a file says.',
    '',
    'export const placeholder = true;',
    '',
  ].join('\n'));
}
console.log(`demo-corpus: ${REPO_FILES.length} repository files written, so /api/coverage has a tree`);

// ── Items: every tier, every category, and enough to overrun ───────────────
//
// PINNED (always:true) — these are the items the injection preview DELIVERS,
// so they are the ones a reader sees rendered in the right-hand pane, and they
// are the ones the mockup shows.
//
// **Their bodies are real, short sentences and not the `body()` filler.**
// They were three paragraphs of "This text exists to occupy a measurable
// number of tokens" until 2026-08-25 — about 1,400 characters each. That made
// the delivered pane a wall of prose 3,882px tall against the mockup's 541,
// and the owner's words for it were "a very long text and not formated as in
// the mockup". He was right, and it was the FIXTURE saying it rather than the
// screen: `.lit` scrolls correctly on both sides, and the only difference was
// how much there was to scroll.
//
// So each body is now what an item of this kind actually looks like — and
// deliberately exercises the shapes the mockup's own sample bodies exercise,
// because a fixture that never produces a bulleted list cannot demonstrate
// that the renderer draws one: **bold**, `code spans`, a bulleted list, and
// plain two-paragraph prose all appear at least once below.
//
// The budgets moved with them (see above): short bodies against the old
// 2,400-token budget would never spill, and the ghost lane is a feature this
// fixture exists to demonstrate. Length was doing the spilling; now the budget
// does, which is the honest arrangement — a spill should be a property of the
// budget, not of how much filler somebody pasted.
const pinned: [string, string, string][] = [
  ['constraint', 'The pool is capped at 20 connections',
    'The pool is capped at **20** connections.\n\n'
    + 'Above that, `pgbouncer` queues rather than the app.'],
  ['constraint', 'Zero runtime dependencies',
    '`package.json` has no `dependencies` key, and must not gain one.'],
  ['rule', 'Customer email is never logged',
    'Customer email is PII.\n\n'
    + '- never in logs\n- never in an error message\n- `redact()` before any sink'],
  ['rule', 'Money is an integer number of cents',
    'Money is an integer number of cents. Never a float.'],
  ['standard', 'Every endpoint answers within 200ms at p95',
    'p95 stays under **200ms**, measured at the edge rather than in the handler.\n\n'
    + 'A handler that is fast while the queue in front of it is not has answered nothing.'],
  ['requirement', 'The audit log is append-only',
    'Records are appended and never rewritten.\n\n'
    + 'A correction is a NEW record that supersedes an old one, so the history of a '
    + 'mistake survives the fix.'],
];
for (const [category, title, itemBody] of pinned) {
  cli(['add', category, title, '--body', itemBody, '--yes']);
}
console.log(`demo-corpus: ${pinned.length} pinned candidates, with real bodies`);

// A scoped set, so Scope coverage has governed AND ungoverned paths to colour.
const scoped: [string, string, string, string][] = [
  ['constraint', 'Migrations run forward only', 'src/db/**',
    'No `down` migrations. A mistake is corrected by a new forward migration.'],
  ['rule', 'Handlers validate at the boundary', 'src/api/**',
    'Every handler validates its input before anything else runs.'],
  ['standard', 'Components carry no business logic', 'src/ui/**',
    'A component renders and dispatches. Decisions live behind the boundary.'],
];
for (const [category, title, scope, itemBody] of scoped) {
  cli(['add', category, title, '--body', itemBody, '--scope', scope, '--yes']);
}

// Rationale tiers — these are never injected, and the Relations and Decay
// screens need them to have anything to draw.
const rationale: [string, string][] = [
  ['decision', 'Postgres over MySQL, for the JSONB operators'],
  ['decision', 'The read surface performs no writes'],
  ['lesson', 'A cached count outlived the thing it counted'],
  ['tradeoff', 'Denormalising the ledger cost correctness twice'],
  ['known_issue', 'The importer drops trailing whitespace in titles'],
];
for (const [category, title] of rationale) {
  cli(['add', category, title, '--body', body(title, 1), '--yes']);
}

// Tasks in several states, so the Work and Status screens are not empty.
for (const [seq, title, state] of [
  ['1', 'Wire the retry budget to the config', 'done'],
  ['2', 'Backfill the missing invoice ids', 'doing'],
  ['3', 'Split the settlement job in two', 'todo'],
  ['4', 'Retire the legacy webhook path', 'todo'],
  ['5', 'Document the reconciliation window', 'blocked'],
] as [string, string, string][]) {
  cli(['add', 'task', title, '--body', body(title, 1), '--tags', `plan:demo,seq:${seq},state:${state}`, '--yes']);
}

// Pin the ones that must be pinned. `--always=true` is what puts an item in the
// pinned tier; without it every one of the above is merely eligible.
//
// **The ids are READ BACK, never derived.** An earlier draft of this script
// reconstructed them from the title with a slug rule and a hard-coded `CONST-`
// prefix — which is wrong for every category that is not `constraint`, and
// would have silently left half the pinned set unpinned. The CLI owns its id
// scheme; asking it is the only way to be right about it, and it costs one
// call.
function idsOf(category: string): { id: string; title: string }[] {
  const out = execFileSync(
    process.execPath,
    ['--disable-warning=ExperimentalWarning', CLI, 'list', category, '--json'],
    { cwd: OUT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return (JSON.parse(out) as { items: { id: string; title: string }[] }).items;
}

const wantPinned = new Set(pinned.map(([, title]) => title));
let pinnedCount = 0;
for (const category of new Set(pinned.map(([c]) => c))) {
  for (const item of idsOf(category)) {
    if (!wantPinned.has(item.title)) continue;
    cli(['edit', item.id, '--always=true', '--yes']);
    pinnedCount++;
  }
}
if (pinnedCount !== pinned.length) {
  throw new Error(`demo-corpus: pinned ${pinnedCount} of ${pinned.length} — a partly pinned ` +
    'corpus demonstrates the wrong ribbon, which is the defect this script exists to avoid');
}

console.log(`demo-corpus: ${pinnedCount} items pinned`);

// ── ONE CONTINUITY ITEM, AUTHORED HERE AND NOT INHERITED ───────────────────
//
// The continuity tier ran over this corpus and admitted NOTHING for as long as
// the tier has existed, and two shipped test guards were written to describe
// that emptiness rather than to test the tier: `div.continuity.seg` in
// `e2e/screen-parity.spec.ts`'s `KNOWN_GAPS.preview`, and the
// `if (track.segs === 0) continue;` guard in `e2e/app-layout.spec.ts`'s
// five-tier ribbon test. Both said so in their own comments, and both named
// this script as the place the fix belonged.
//
// **It is authored here rather than left to the copy-in, and that is the whole
// point.** The real corpus gained a `continuity: true` item on 2026-08-28, and
// the block above copies `items/` in wholesale — so from that day the fixture
// exercised the tier BY ACCIDENT, and would stop the day the owner retired or
// renamed that item. A fixture whose coverage depends on what the live corpus
// happens to hold today is the exact failure this corpus exists to end: the
// suite would go quietly back to measuring nothing, with no test turning red
// to say so. Two continuity items — the inherited one and this one — is the
// correct outcome, not a duplicate: this one is the floor.
//
// **The SHAPE is the ruling's shape, not merely a flag set to true.**
// `DEC-continuity-gets-its-own-budget-and-the-item-it-holds-must-be` rules
// that what this tier carries is a POINTER PLUS A BOUNDED DIGEST — the item
// names the document, says to read it, and states where the work stands —
// never the document itself. `config.ts` records why, with the measurement: the
// handover this tier was created for was 37,831 estimated tokens against a
// 2,000 budget and had therefore never once been injected on any event. So a
// fixture item that was a wall of `body()` filler would demonstrate the tier's
// mechanics while modelling the very item shape the ruling forbids.
//
// `--continuity` is `edit`'s flag; `add` has no spelling for it, exactly as
// with `--always` above. The id is read back for the same reason.
const CONTINUITY_TITLE = 'Where the billing rework stands, and what to read first';
cli([
  'add', 'reference', CONTINUITY_TITLE,
  '--body',
  'The full account is `docs/architecture.md`. Read it before changing anything under '
  + '`src/billing/**`.\n\n'
  + 'This item is the POINTER and the state; the document is the argument, and it is too '
  + 'large to inject.\n\n'
  + '**Where the work stands**\n\n'
  + '- the ledger is split and both halves reconcile\n'
  + '- the tax table is still keyed by the old jurisdiction code\n'
  + '- nothing has been decided about refunds\n\n'
  + 'Next session starts at the tax table, not at the top.',
  '--yes',
]);
const continuityItem = idsOf('reference').find((item) => item.title === CONTINUITY_TITLE);
if (continuityItem === undefined) {
  throw new Error('demo-corpus: the continuity item was added and cannot be found again — the '
    + 'tier would run and admit nothing, which is the state this item exists to end');
}
cli(['edit', continuityItem.id, '--continuity=true', '--yes']);
console.log(`demo-corpus: continuity item ${continuityItem.id}, so the fifth tier delivers`);

console.log('demo-corpus: items built');

// ── The audit history ──────────────────────────────────────────────────────
//
// **EVERY RECORD IS WRITTEN BY THE REAL CODE. Nothing here is composed.**
//
// Owner constraint, 2026-08-23: "the data you generate should be synch'd all
// over the different views in the ui — an injected item should appear in
// injection preview and in the audit stream as the same record, and in all
// other relevant views including the graphics and calculations that should take
// it into account. In general as the real code should behave, not another
// mockup."
//
// An earlier draft of this section FABRICATED records — `injected: [{id:
// 'DEMO-0'}]`, invented token counts, a spill that referred to nothing. That is
// a second mockup wearing the product's clothes: the audit stream would show an
// injection of nine items while the injection preview showed six real ones, the
// ids would resolve to nothing when clicked, and every number computed from
// them would be a number about nothing. Exactly the confusion this corpus
// exists to end.
//
// So each kind is produced by running the thing that produces it: the hooks
// write the injection and hook records, `mycontext focus` writes the focus
// record, the CLI writes the mutation records as it builds the items above. The
// ids, tiers, token costs and spills are whatever the real selector computed
// over the items in this corpus — which is why the preview and the stream agree
// about them.
//
// **THE ONE THING THAT IS SYNTHETIC IS THE CLOCK.** `recordAudit` stamps `at`
// with the current instant, so running the hooks 180 times puts 180 records in
// the same few seconds — and the activity pulse buckets by ten seconds across
// twenty minutes, so it would draw one column. After the real runs, the `at`
// field alone is rewritten to spread them across the window. Content untouched.
const auditDir = path.join(OUT, '.my_context', '.audit');
const auditLog = path.join(auditDir, 'audit.jsonl');

/** Feed a hook its payload on stdin, exactly as Claude Code does. */
function hook(script: string, payload: Record<string, unknown>): boolean {
  try {
    execFileSync(
      process.execPath,
      ['--disable-warning=ExperimentalWarning', path.join(REPO, 'src', 'hooks', script)],
      { cwd: OUT, input: JSON.stringify(payload), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    return true;
  } catch {
    return false; // reported below; never silently skipped
  }
}

const session = 'demo-session-a3f9c1';
const produced: Record<string, number> = {};
const before = existsSync(auditLog) ? readFileSync(auditLog, 'utf8').split('\n').filter(Boolean).length : 0;

// Injections and hook actions, from the real hook entry points.
for (let i = 0; i < 24; i++) {
  hook('session-start.ts', {
    session_id: `${session}-${i}`, hook_event_name: 'SessionStart',
    source: ['startup', 'resume', 'clear', 'compact'][i % 4], cwd: OUT,
  });
  hook('pre-tool-use.ts', {
    session_id: session, hook_event_name: 'PreToolUse',
    tool_name: 'Edit', tool_input: { file_path: `${OUT}/src/api/handler.ts` }, cwd: OUT,
  });
  hook('post-tool-use.ts', {
    session_id: session, hook_event_name: 'PostToolUse',
    tool_name: 'Write', tool_input: { file_path: `${OUT}/src/db/migrate.ts` }, cwd: OUT,
  });
  if (i % 6 === 0) hook('pre-compact.ts', { session_id: session, hook_event_name: 'PreCompact', cwd: OUT });
  if (i % 6 === 3) hook('subagent-start.ts', { session_id: session, hook_event_name: 'SubagentStart', cwd: OUT });
}

// ── ONE SESSION WHOSE WINDOW WAS DESTROYED: LEDGER HISTORY, NO SEEN FILE ───
//
// **The shape this fixture asserted the product never produces, produced by
// the product.** The block at the foot of this file used to say, in its own
// words, that *"a session that has a history in the audit log and no seen file
// is a shape the product never produces, and a fixture that produces it is
// teaching every screen a lie"*. That sentence was written to justify keeping
// every seen file, and it is FALSE. Measured 2026-08-29 against the live
// corpus at `../.my_context` — 680 items, 19 ledger sessions — SEVEN of the
// nineteen have exactly that shape:
//
//     session            /api/sessions itemCount   /injected lines   seen file
//     dedupe-probe                            16                 0   ABSENT
//     diag-restore-1                          13                 0   ABSENT
//     probe-x                                  2                 0   ABSENT
//     probe-y                                  2                 0   ABSENT
//     handover-probe                           2                 0   ABSENT
//     handover-probe-2                         2                 0   ABSENT
//     compact-probe-002                        2                 0   ABSENT
//
// It is not a corruption and it is not an accident of age. `/clear` destroys a
// context window, and `hooks/session-end.ts` answers `reason: 'clear'` by
// calling `clearWindowState` → `clearSeen`, which REMOVES the seen file and
// leaves the ledger and the audit log untouched — deliberately, because the
// injection still happened and the dedupe state is about a window that is
// gone. `mycontext rebuild`'s 30-day mtime sweep is the second producer of it.
//
// **So the empty-seen-file case is a first-class state of this product, and a
// fixture with no instance of it cannot reproduce the owner's report**
// (`TASK-injected-now-lands-on-the-one-session-that-has-no-lines-and`). Every
// seen file was kept when the real corpus became the base, which cured the
// blank LANDING and, in the same stroke, removed the state entirely: there was
// then no session in `.demo-corpus` on which `Injected now` could be seen
// answering nothing, and no way to tell a screen that handles it from one that
// does not. That is the ninth time this fixture has flattered a test.
//
// **Session 20 and never the newest.** The session every screen shows is
// `/api/sessions`' `default` — `recentSessions(1)[0]`, session 23 — and it
// keeps its history, so the landing still opens on rows. Session 20 sits third
// in that list, three weeks back.
//
// It is worth saying plainly that NOTHING IN THE SHELL CAN SELECT IT: `app.js`
// records that `#sessbtn` opens no popup and that `loadSessions()` exposes the
// default "so a later task can wire the popup". Until that task lands, a
// session other than the default is reachable only through the endpoint, which
// is how `test/ui/injected-endpoints.test.ts` and `e2e/injected-empty.spec.ts`
// reach it. That is a reason to HAVE the shape in the corpus, not a reason to
// leave it out: the day the picker is wired, the state it will expose has been
// under test since today rather than being discovered by the owner again.
//
// **Nothing here is fabricated.** The real `SessionEnd` hook is fed the real
// payload on stdin, exactly as Claude Code feeds it, and whatever it does to
// `state/` is what the product does. It writes its own `hook`/`session-end`
// audit record saying what it removed, so the Watch feed carries the event
// too rather than the state changing behind the log's back.
const CLEARED_SESSION = 20;
const cleared = hook('session-end.ts', {
  session_id: `${session}-${CLEARED_SESSION}`, hook_event_name: 'SessionEnd',
  reason: 'clear', cwd: OUT,
});
console.log(cleared
  ? `demo-corpus: /clear replayed on ${session}-${CLEARED_SESSION} — its window was destroyed, so `
    + 'the ledger keeps its injection and no seen file remains for `Injected now` to read'
  : `demo-corpus: WARNING — the SessionEnd hook failed for ${session}-${CLEARED_SESSION}; the `
    + 'cleared-window shape is ABSENT and the empty-seen-file case cannot be demonstrated');

// A focus change — the feed draws this as a regime RULE across the table rather
// than as a row, and it is the only thing that draws one.
// ── ONE DOCTOR FINDING THAT EARNS A COMMAND ────────────────────────────────
//
// Measured 2026-08-23 by the agent closing the Doctor screen: `mycontext doctor`
// over this corpus answered THREE findings, all `dead_scope`, all `warn` — and
// `dead_scope` composes nothing, because re-scoping is an edit to an item file
// rather than a command. So the screen's `div.cmd`, `code` and `button` had
// nothing to draw, on a build where all three have been built since the screen
// was written. The decision behind this corpus names "doctor findings" among
// what it must exercise; a finding that earns no remedy only exercises half.
//
// `source_drift` WITH AN ITEM is the deterministic one: capture an item from a
// file, then change the file. `doctor` reports the drift, names the item, and
// its remedy is `mycontext refresh <id>` — a real command the screen composes
// through the one quoting implementation. Nothing here fakes a finding: the
// checker measures a genuine divergence between a snapshot and its source.
const driftDoc = path.join(OUT, 'docs', 'retention-policy.md');
writeFileSync(driftDoc, [
  'Records are retained for ninety days and then deleted.',
  '',
  'Deletion is irreversible and runs nightly.',
  '',
].join('\n'));
cli(['add', 'standard', 'Records are retained for ninety days', '--file', driftDoc, '--yes']);
// The source moves on, exactly as a document does between one capture and the
// next read. The item still holds the old text — which is the whole point of
// the finding, and what `mycontext refresh` exists to settle.
writeFileSync(driftDoc, [
  'Records are retained for one hundred and eighty days and then deleted.',
  '',
  'Deletion is irreversible and runs nightly.',
  '',
  'A legal hold suspends deletion until the hold is lifted.',
  '',
].join('\n'));
console.log('demo-corpus: one source_drift finding staged, so Doctor has a remedy to compose');

cli(['focus', 'billing']);
cli(['focus', '--clear']);

// ── ONE PENDING REVISION, because the Work screen has nothing to draw without
//    one ─────────────────────────────────────────────────────────────────────
//
// Measured on 2026-08-23, while six screens were being built in parallel:
// `/api/revisions` over this corpus answered
// `{"counts":{"revisions":0,"items":0},"revisions":[]}`, and the agent building
// `screens/work.js` reported SEVENTEEN element kinds it could not render as a
// result — `del`, `ins`, `td.m.stale`, `div.cmd`, `details.help` and the rest.
// Every one of them was CODE THAT EXISTS meeting DATA THAT DOES NOT, which is
// the precise confusion this whole demo corpus was built to end
// (`DEC-the-ui-is-developed-against-a-simulated-corpus-until-the`).
//
// **Written by the real mutation surface, not fabricated.** `stageRevision`
// with `origin: 'agent'` is exactly what an agent's `update_item` does when it
// proposes a change to an item a human owns — the trust boundary turns the
// write into a proposal rather than an edit. The human update that follows is
// an ordinary `updateItem`. Both append their own audit records, which the
// clock rewrite below then spreads like every other record here.
//
// **Three fields, chosen so the screen's three row shapes all appear**, per the
// mockup's own table (`docs/design/web-ui-mockup.html` · `<td class="m stale">`
// · ~1941): `title` is prose and stays fresh (a `<td>` with a `<bdi>` and the
// `<ins>`/`<del>` runs of the word diff), `tags` is a token field and stays
// fresh (`td.m`), and `body` is made STALE by a human editing the same field
// after the proposal was staged — the one case the mockup draws a `chip warn`
// and replaces both value cells with `work.moved`/`work.blocked`. Staleness is
// scoped to the fields a revision touches, so editing `body` leaves the other
// two rows alone; that is the property being exercised, not a side effect.
{
  const ws = resolveWorkspace(OUT);
  const { store } = openRebuiltStore(ws);
  try {
    const ctx = { root: ws.projectRoot!, store, config: ws.config };
    // The oldest human-authored item, so the choice is deterministic across
    // runs — this script has no randomness anywhere and must not gain any.
    const target = store.all()
      .filter((it) => it.origin === 'human' && it.status === 'active')
      .sort((a, b) => a.id.localeCompare(b.id))[0];
    if (target === undefined) throw new Error('demo-corpus: no human item to propose against');
    stageRevision(ctx, target.id, {
      title: `${target.title}, and the retry budget it implies`,
      body: `${target.body}\n\nProposed by an agent: name the budget explicitly, because a ` +
        `caller that cannot see the ceiling cannot honour it.`,
      tags: [...target.tags, 'reviewed'],
    }, 'agent');
    updateItem(ctx, {
      id: target.id,
      body: `${target.body}\n\nA human edited this line after the proposal was staged, which ` +
        `is what makes the body field stale and the whole revision refuse to promote.`,
      origin: 'human',
    });
    console.log(`demo-corpus: staged one revision against ${target.id} (body made stale)`);
  } finally {
    store.close();
  }
}

// ── THE THREE SCREENS THIS FIXTURE STILL STARVED ───────────────────────────
//
// Measured 2026-08-23 by asking every endpoint what it answers over this
// corpus, rather than by looking at screens — because a blank pane has two
// causes and only the endpoint tells them apart:
//
//     /api/review-queue   {"drafts":[]}                      -> learn draws nothing
//     /api/procedures     {"stages":[5],"procedures":[]}     -> proc draws nothing
//     /api/packs          {"packs":[],"dropped":[]}          -> packs draws nothing
//
// Everything below is produced by the REAL commands, exactly like the rest of
// this script. Nothing writes a row into a table to make a screen look full;
// the owner's standing rule is that a fixture which fakes data teaches the
// gate to accept a lie, and three agents refused to break it on 2026-08-23.

// ── DRAFTS, so the Learn screen's review queue has something to settle ─────
//
// `add` creates an ACTIVE item with no draft step — the workflow topic says so
// in its own words — so the draft state is reached the way a human reaches it,
// by editing the status afterwards. Two, because one draft cannot show that
// the queue is a list.
{
  const drafts: [string, string, string][] = [
    ['rule', 'Retries use full jitter, never a fixed backoff',
      'A fixed backoff synchronises every caller onto the same retry instant, which is how a '
      + 'recovering service is knocked over a second time by the clients waiting for it.'],
    ['constraint', 'The export bundle stays under fifty megabytes',
      'Above that the artefact stops fitting the transports people actually use to move it, and '
      + 'a bundle nobody can send is a backup nobody has.'],
  ];
  for (const [category, title, text] of drafts) {
    cli(['add', category, title, '--body', text, '--yes']);
    const made = idsOf(category).find((i) => i.title === title);
    if (made === undefined) throw new Error(`demo-corpus: ${category} "${title}" was not created`);
    cli(['edit', made.id, '--status', 'draft', '--yes']);
  }
  console.log(`demo-corpus: ${drafts.length} drafts, so the review queue is a queue`);
}

// ── PROCEDURES, so the Procedures screen has a lifecycle to draw ───────────
//
// `/api/procedures` already answered five STAGES and zero procedures: the
// vocabulary existed and nothing occupied it. Three, deliberately left in
// three different states — one untouched, one running, one finished — because
// the screen's whole subject is which stage a procedure is in, and three
// procedures all sitting in `ready` would draw one state three times.
{
  // **With STEPS.** `procedure activate` warns in its own words that a
  // procedure declaring none leaves "nothing to tick", and the Procedures
  // screen's whole middle column is the step list — three procedures with no
  // steps would fill the screen's index and leave its detail empty, which is
  // the same starvation one level down.
  const procedures: [string, string, string[]][] = [
    ['Rotate the signing key', 'Generate the new key, publish it alongside the old one, wait a '
      + 'full token lifetime, then retire the old key. Skipping the overlap invalidates every '
      + 'token issued in the last hour.', [
      'Generate the new key pair offline',
      'Publish the new public key alongside the old one',
      'Wait one full token lifetime',
      'Retire the old key and verify nothing still presents it',
    ]],
    ['Restore a corpus from an export', 'Verify the manifest checksum first. An export whose '
      + 'config.json bytes have changed does not verify against its own manifest, and importing '
      + 'it anyway is how a corpus acquires a category nothing declares.', [
      'Verify the manifest checksum before reading anything else',
      'Import into an empty workspace, never over a live one',
      'Run doctor and compare the item count against the manifest',
    ]],
    ['Cut a release', 'Run every gate the way the project runs it, tag, then publish. A '
      + 'hand-assembled gate invocation is not the gate.', [
      'Run every gate through its own npm script',
      'Tag the commit the gates actually ran against',
      'Publish, then confirm the published artefact matches the tag',
    ]],
  ];
  for (const [title, text, steps] of procedures) {
    cli(['add', 'procedure', title, '--body', text,
      ...steps.flatMap((s) => ['--step', s]), '--yes']);
  }
  const made = idsOf('procedure');
  // Deterministic by id, the same rule the staged revision above follows: this
  // script has no randomness and must not gain any.
  const ordered = made.filter((p) => procedures.some(([t]) => t === p.title))
    .sort((a, b) => a.id.localeCompare(b.id));
  // `--yes` on every one: `procedure activate` sets both `status` and
  // `always`, and refuses without confirmation when stdin is not interactive —
  // which a build script never is. The refusal is correct and is the same gate
  // `edit` applies; this script consents on the author's behalf exactly as it
  // does for every other `--yes` above.
  if (ordered.length >= 2) {
    cli(['procedure', 'activate', ordered[0]!.id, '--yes']);
    cli(['procedure', 'activate', ordered[1]!.id, '--yes']);
    // One step ticked on the running procedure, so the screen has a partially
    // complete list to draw rather than only empty and only full.
    cli(['procedure', 'step', ordered[0]!.id, '1']);
    cli(['procedure', 'done', ordered[1]!.id, '--yes']);
  }
  console.log(`demo-corpus: ${procedures.length} procedures across three lifecycle states`);
}

// ── ONE IMPORTED PACK, so the Template Packs screen has a pack ─────────────
//
// Built by EXPORTING this corpus as a pack and importing it back, which is the
// only way to get an artefact the importer will accept without hand-writing a
// manifest — and hand-writing one would be fabricating the very checksums the
// import path exists to verify. The round trip exercises both halves.
{
  // **From a SEPARATE corpus, not from this one.** Exporting this corpus and
  // importing it back was the obvious shape and it produces nothing: measured,
  // `0 new, 0 changed, 4 identical` — every item is already here by
  // construction, so the landing report is empty and the screen draws a pack
  // that carried nothing. A pack is knowledge somebody ELSE wrote; the fixture
  // has to model that or it models nothing.
  const author = path.join(OUT, '..', '.demo-pack-author');
  if (existsSync(author)) rmSync(author, { recursive: true, force: true });
  mkdirSync(author, { recursive: true });
  const authored = (args: string[]): void => {
    execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', CLI, ...args], {
      cwd: author, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
  };
  authored(['init']);
  const carried: [string, string, string][] = [
    ['constraint', 'Card numbers never reach application logs',
      'PCI scope is defined by where the data goes. A log line is a copy, and a copy in a log is '
      + 'ninety days of retained cardholder data nobody budgeted for.'],
    ['rule', 'Money is an integer of minor units, never a float',
      'A float cannot represent a tenth of a cent, and a rounding error that appears once per '
      + 'transaction appears a million times per month.'],
    ['invariant', 'A refund never exceeds the captured amount',
      'Enforced at the ledger, not at the form. A form is a suggestion; the ledger is the record.'],
    ['glossary', 'Capture',
      'Moving an authorised amount to settlement. Distinct from authorisation, which only '
      + 'reserves it, and the two are routinely confused in tickets.'],
  ];
  for (const [category, title, text] of carried) {
    authored(['add', category, title, '--body', text, '--yes']);
  }
  const packDir = path.join(OUT, '..', '.demo-pack');
  if (existsSync(packDir)) rmSync(packDir, { recursive: true, force: true });
  authored(['export', '--out', packDir, '--as-pack',
    '--pack-name', 'billing-starter', '--pack-version', '1.0.0']);
  cli(['pack', 'import', packDir, '--yes']);
  rmSync(author, { recursive: true, force: true });
  console.log(`demo-corpus: one pack of ${carried.length} items imported from another corpus`);
}

const lines = readFileSync(auditLog, 'utf8').split('\n').filter(Boolean);
for (const line of lines) {
  try { const k = (JSON.parse(line) as { kind: string }).kind; produced[k] = (produced[k] ?? 0) + 1; } catch { /* skip */ }
}
console.log(`demo-corpus: ${lines.length - before} records written by the real code ` +
  `(${Object.entries(produced).map(([k, n]) => `${k} ${n}`).join(', ')})`);

// ── Only the clock is rewritten ────────────────────────────────────────────
const NOW = Date.now();
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const WEEK = 7 * DAY;
/** The window the item pane's sparkline plots (`pane.hist`). */
const SPARK_WEEKS = 12;
/** The newest records, held inside the pulse's twenty-minute window. */
const PULSE_RECORDS = 180;

/**
 * The session index this script assigned, or `null` for a record that belongs
 * to no session. `demo-session-a3f9c1-7` → `7`.
 */
const sessionIndex = (rec: Record<string, unknown>): number | null => {
  const id = rec['sessionId'];
  if (typeof id !== 'string') return null;
  const m = /-(\d+)$/.exec(id);
  return m === null ? null : Number(m[1]);
};

const parsed = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
// Newest first for spreading, then written back oldest first as the log is.
parsed.sort((a, b) => String(b['at']).localeCompare(String(a['at'])));

// The highest session index present, so the newest session stays newest.
let newestSession = 0;
for (const rec of parsed) {
  const s = sessionIndex(rec);
  if (s !== null && s > newestSession) newestSession = s;
}

// ── Two populations, split by whether the record belongs to a NUMBERED session
//
// It used to be one linear walk: `i * 6.3s` for the first 180 records and
// `(i - 180) * 47 minutes` after that, reaching back about six days. That was
// enough for the pulse and for Status, and it silently starved two views that
// ask a longer question: the item pane's twelve-week delivery sparkline
// (`pane.hist`) had eleven empty buckets and one full one, and decay's NINETY
// -day heatstrip had six days of cells in a ninety-day field. Both drew
// correctly. Both looked broken.
//
// **A linear walk cannot fix it, however far back it reaches.** The injection
// records are CONTIGUOUS in the log — this script writes twenty-four sessions
// in a loop — so any spread that preserves log order puts every delivery the
// corpus has ever made inside one or two adjacent weeks. The stripe has to be
// by SESSION, which is also the truer model: a project accumulates sessions
// over months, not all in one afternoon.
//
// So: the twenty-four `session-start` records, one per numbered session and
// each carrying an `injected[]`, are spread evenly across the sparkline's own
// window — session 0 eleven weeks back, the newest just behind the pulse. Two
// per bucket, so every bucket has something. Everything else — the `access`
// and `mutation` records a used corpus accumulates, and the PreToolUse and
// PostToolUse records that share the bare unnumbered session id — keeps the
// old walk, so the pulse window is as full as it ever was.
//
// The split is on the NUMBERED id specifically. `demo-session-a3f9c1-7` is one
// session in the loop; the bare `demo-session-a3f9c1` is the tool-event id and
// belongs with the recent population, not striped across three months.
const striped = parsed.filter((rec) => sessionIndex(rec) !== null);
const recent = parsed.filter((rec) => sessionIndex(rec) === null);

// **THE NEWEST NUMBERED SESSION MUST REMAIN THE NEWEST RECORD IN THE LOG**, and
// getting this wrong is how the first draft of this stripe broke the fixture.
//
// The injection preview does not replay a recording — it RE-COMPUTES what the
// most recent session would be given. "Most recent" is decided by the log.
//
// This used to hold because the newest NUMBERED session's seen file was
// DELETED and every other session kept its own, so only the newest had
// anything left to be given. That deletion is gone — the real corpus is the
// base now and fifty-one normative items are deep enough that any session has
// a full delivery ahead of it — but the ordering requirement is not: the
// preview and `Injected now` both key off this default, and a stripe that let
// an older session end up newest would point both screens at a session this
// script never shaped. Measured on the first attempt at this stripe: the
// preview drew ONE item instead of six.
//
// It matters once more since `demo-session-a3f9c1-20` had its window cleared
// above: if THAT session ever became the newest, `/api/sessions` would default
// to the one session with no seen file and the blank landing this whole
// fixture exists to keep away would be back.
//
// The bare unnumbered `demo-session-a3f9c1` is the tool-event id and sits in
// the pulse window, minutes old. So the stripe puts session `newestSession` at
// `NOW` itself and the pulse walk starts thirty seconds behind it.
striped.forEach((rec) => {
  const s = sessionIndex(rec) ?? 0;
  // 0 for the newest session, growing going back.
  const back = newestSession === 0 ? 0 : (newestSession - s) / newestSession;
  const weeksAgo = back * (SPARK_WEEKS - 1);
  // Jitter inside the week, so two sessions landing in one bucket do not share
  // a timestamp — the audit stream orders by `at` and a column of identical
  // stamps is not a history. Keyed on the DISTANCE from the newest session so
  // that the newest gets exactly zero and stays the newest record.
  const jitter = ((newestSession - s) % 7) * 9 * 60 * MINUTE;
  rec['at'] = new Date(NOW - (weeksAgo * WEEK + jitter)).toISOString();
});

// The stripe keys `at` on the SESSION INDEX alone, so every record belonging
// to one session lands on one stamp. That was harmless while each numbered
// session had exactly one record; `demo-session-a3f9c1-20` now has two — its
// start, and the `/clear` that destroyed its window — and a clear stamped at
// the same instant as the injection it wiped is a history no reader can put in
// order. Eleven minutes later is inside the same session and after it, which
// is the only thing the ordering has to say.
for (const rec of striped) {
  if (sessionIndex(rec) === CLEARED_SESSION && rec['op'] === 'session-end') {
    rec['at'] = new Date(Date.parse(String(rec['at'])) + 11 * MINUTE).toISOString();
  }
}

recent.forEach((rec, i) => {
  // The first 180, 6.3s apart, walk the whole twenty-minute window and land
  // several records in some ten-second buckets and none in others — the varied
  // column heights the mockup's pulse shows. Offset thirty seconds so the
  // newest striped session-start above stays the newest record in the log.
  if (i < PULSE_RECORDS) {
    rec['at'] = new Date(NOW - (30_000 + i * 6_300)).toISOString();
    return;
  }

  // ── Beyond the pulse window, the old linear walk ─────────────────────────
  //
  // Unchanged: 47 minutes a record, which is what Decay and Status summarise
  // for the `access` and `mutation` traffic a used corpus accumulates. The
  // long history now comes from the striped population above, so this walk no
  // longer has to carry a job it was never shaped for.
  rec['at'] = new Date(NOW - (30_000 + (i - PULSE_RECORDS) * 47 * MINUTE + 20 * MINUTE)).toISOString();
});
parsed.sort((a, b) => String(a['at']).localeCompare(String(b['at'])));
writeFileSync(auditLog, `${parsed.map((r) => JSON.stringify(r)).join('\n')}\n`);
const spanDays = Math.round((Date.parse(String(parsed.at(-1)?.['at']))
  - Date.parse(String(parsed[0]?.['at']))) / DAY);
console.log(`demo-corpus: ${parsed.length} records re-clocked across the pulse window `
  + `and ${spanDays} days — sessions striped so the twelve-week sparkline and the `
  + 'ninety-day heatstrip both have something to plot');

const missing = ['mutation', 'injection', 'hook', 'focus'].filter((k) => (produced[k] ?? 0) === 0);
if (missing.length > 0) {
  console.log(`demo-corpus: NOTE — no real generator produced: ${missing.join(', ')}. ` +
    'Those screens will show their empty states, which is honest but not a demonstration.');
}

// ── The newest session must have something left to deliver ─────────────────
//
// **Without this the injection preview shows "0 items" and both panes are
// empty, and that is CORRECT behaviour reading as a broken screen.**
//
// The preview does not replay a recorded injection; it RE-COMPUTES what the
// most recent session would be given, which is what makes it a preview. The
// seen file is a per-session dedupe: once a session has been injected into,
// every item it already holds is correctly dropped as nothing new, so a
// re-computation for that session delivers zero. Every session above has been
// injected into, so the newest one had nothing left and the scene had nothing
// to draw.
//
// The real corpus does not show this only because no hook has ever run against
// it — it has no seen files at all, so its preview always computes a full
// delivery. That difference is invisible until a fixture reproduces it, which
// is one more argument for having one.
//
// **THE SEEN FILE IS NO LONGER DELETED, and the reason it used to be is gone.**
//
// It was removed because the newest session had already been injected with
// almost everything the corpus held, so the preview — which excludes what a
// session has already seen — computed a nearly empty delivery. That was true of
// a corpus of NINE normative items. It is not true of one built on the real
// corpus, which carries fifty-one.
//
// Measured both ways before and after the base landed, because the trade was
// real and worth pricing rather than asserting:
//
//     nine items,  seen DELETED   Injected now  0 rows    Delivered  4 rows
//     nine items,  seen KEPT      Injected now  5 rows    Delivered  2 rows
//     real base,   seen KEPT      Injected now  6 rows    Delivered  4 rows
//
// The last line is the one that says the deletion was a workaround for the pool
// and never a property anybody wanted: with depth behind it, both screens are
// full at once and neither is borrowing from the other.
//
// **THE JUSTIFICATION THAT STOOD HERE WAS WRONG, AND IT COST THE FIXTURE THE
// STATE IT MOST NEEDED TO CARRY.** It read: *"a session that has a history in
// the audit log and no seen file is a shape the product never produces, and a
// fixture that produces it is teaching every screen a lie about what a real
// workspace looks like."* Measured against the live corpus on 2026-08-29, SEVEN
// of nineteen ledger sessions have exactly that shape, and the product's own
// `/clear` path is what makes it — the table and the reasoning are on
// `CLEARED_SESSION` above. Keeping every seen file did not stop the fixture
// lying; it moved the lie. It went from *"a session that received six things
// shows none"* to *"no session can ever show none"*, and a screen cannot be
// measured against a state its corpus has abolished.
//
// So both are here now, one session apart: session 23, the default every
// screen lands on, keeps its full history and draws rows; session 20 had its
// window destroyed and draws nothing, with `/api/sessions` still reporting its
// injection. That is the owner's report, reproducible on demand.
//
// This closes the fixture half of
// `TASK-injected-now-lands-on-the-one-session-that-has-no-lines-and` — the
// landing is not the empty one, AND the empty one still exists to be drawn.
// The other half, that `{"lines":[]}` must say something rather than render a
// bare table head, is `screens/injected.js`' and is drawn from `inj.zeroLines`.
// What NEITHER half closes is the read model underneath: `{lines: [], error:
// null}` is the answer for a seen file that was read and held nothing AND for
// a seen file that does not exist, and those are the two facts
// `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` clause 2
// forbids collapsing. Session 20 is the case that proves it — see the header
// of `test/ui/injected-endpoints.test.ts`.
const stateDir = path.join(OUT, '.my_context', 'state');
if (existsSync(stateDir)) {
  const seen = readdirSync(stateDir).filter((f) => f.endsWith('.seen.jsonl'));
  const gone = !seen.includes(`${session}-${CLEARED_SESSION}.seen.jsonl`);
  console.log(`demo-corpus: ${seen.length} seen files kept — the newest session keeps its `
    + 'history, so Injected now lands on rows rather than on a bare table head');
  console.log(gone
    ? `demo-corpus: and ${session}-${CLEARED_SESSION} has none, so the empty-seen-file state `
      + 'is a state a screen can be measured against rather than only described'
    : `demo-corpus: WARNING — ${session}-${CLEARED_SESSION} still has a seen file; the cleared-`
      + 'window state is NOT in this corpus and no screen can be measured against it');
}

// The projection is a WRITE, and the read-only UI may never build it. Building
// it here is the difference between a demo corpus that works on first open and
// one that greets the owner with a 503 he has to know how to clear.
cli(['audit', '--limit', '1']);
console.log('demo-corpus: audit projection built');

// **The LEDGER projection, which is a different projection and was never
// built.** Measured 2026-08-23 by the agent building the Decay screen:
// `/api/decay` over this corpus answered `ledger: "not-projected"`,
// `report: null`, `series: []`, so the recency comb had nothing to plot — on a
// build where the comb is written and correct.
//
// The line above builds the AUDIT projection and nothing else. `topUpLedger` is
// reached only by `status`, `decay` and `audit replay-ledger`, and this script
// ran none of them, so a corpus that has recorded every injection still could
// not say when any item was last used. One command closes it, and `decay` is
// the honest one to run: it is the command whose own screen needs the answer.
cli(['decay']);
console.log('demo-corpus: ledger projection built, so the recency comb has teeth');
console.log(`demo-corpus: done. Serve it with:\n  node src/cli/index.ts ui --port 58888 --no-open   (cwd: ${OUT})`);
