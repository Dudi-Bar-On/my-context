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
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

cli(['init']);

// ── Budgets small enough that ordinary content spills ──────────────────────
const configPath = path.join(OUT, '.my_context', 'config.json');
const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
config['budgets'] = { pinned: 2400, jit: 1800, restored: 2400, index: 900 };
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

// ── Items: every tier, every category, and enough to overrun ───────────────
// PINNED (always:true) — more than the 2,400-token budget, so some spill and
// the ghost lane draws.
const pinned: [string, string, string][] = [
  ['constraint', 'The pool is capped at 20 connections', 'connection pooling'],
  ['constraint', 'Zero runtime dependencies', 'dependency policy'],
  ['rule', 'Customer email is never logged', 'personally identifiable information'],
  ['rule', 'Money is an integer number of cents', 'monetary representation'],
  ['standard', 'Every endpoint answers within 200ms at p95', 'latency budget'],
  ['requirement', 'The audit log is append-only', 'auditability'],
];
for (const [category, title, topic] of pinned) {
  cli(['add', category, title, '--body', body(topic, 3), '--yes']);
}
console.log(`demo-corpus: ${pinned.length} pinned candidates`);

// A scoped set, so Scope coverage has governed AND ungoverned paths to colour.
const scoped: [string, string, string][] = [
  ['constraint', 'Migrations run forward only', 'src/db/**'],
  ['rule', 'Handlers validate at the boundary', 'src/api/**'],
  ['standard', 'Components carry no business logic', 'src/ui/**'],
];
for (const [category, title, scope] of scoped) {
  cli(['add', category, title, '--body', body(scope, 2), '--scope', scope, '--yes']);
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

// A focus change — the feed draws this as a regime RULE across the table rather
// than as a row, and it is the only thing that draws one.
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

const lines = readFileSync(auditLog, 'utf8').split('\n').filter(Boolean);
for (const line of lines) {
  try { const k = (JSON.parse(line) as { kind: string }).kind; produced[k] = (produced[k] ?? 0) + 1; } catch { /* skip */ }
}
console.log(`demo-corpus: ${lines.length - before} records written by the real code ` +
  `(${Object.entries(produced).map(([k, n]) => `${k} ${n}`).join(', ')})`);

// ── Only the clock is rewritten ────────────────────────────────────────────
const NOW = Date.now();
const parsed = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
// Newest first for spreading, then written back oldest first as the log is.
parsed.sort((a, b) => String(b['at']).localeCompare(String(a['at'])));
parsed.forEach((rec, i) => {
  // 6.3s apart walks the whole twenty-minute window and lands several records
  // in some ten-second buckets and none in others — the varied column heights
  // the mockup shows. Beyond 180 records the history stretches back over days,
  // which is what Decay and Status summarise.
  const msAgo = i < 180 ? i * 6_300 : (i - 180) * 47 * 60_000 + 20 * 60_000;
  rec['at'] = new Date(NOW - msAgo).toISOString();
});
parsed.sort((a, b) => String(a['at']).localeCompare(String(b['at'])));
writeFileSync(auditLog, `${parsed.map((r) => JSON.stringify(r)).join('\n')}\n`);
console.log(`demo-corpus: ${parsed.length} records re-clocked across the pulse window and ~2 weeks`);

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
// So the newest session's seen file is removed: it is a session that HAS a
// history in the audit log and is about to be injected into again. Both views
// then agree — the stream shows what it was given, the preview shows what it
// would be given now, and they are the same items.
const stateDir = path.join(OUT, '.my_context', 'state');
if (existsSync(stateDir)) {
  const seen = readdirSync(stateDir).filter((f) => f.endsWith('.seen.jsonl'));
  // Newest by the session index this script assigned, not by mtime: the files
  // are written within the same second and mtime cannot order them.
  const newest = seen.sort((a, b) => {
    const n = (f: string) => Number(/-(\d+)\.seen\.jsonl$/.exec(f)?.[1] ?? -1);
    return n(a) - n(b);
  }).at(-1);
  if (newest !== undefined) {
    rmSync(path.join(stateDir, newest));
    console.log(`demo-corpus: cleared ${newest} so the newest session has a full delivery to show`);
  }
}

// The projection is a WRITE, and the read-only UI may never build it. Building
// it here is the difference between a demo corpus that works on first open and
// one that greets the owner with a 503 he has to know how to clear.
cli(['audit', '--limit', '1']);
console.log('demo-corpus: audit projection built');
console.log(`demo-corpus: done. Serve it with:\n  node src/cli/index.ts ui --port 58888 --no-open   (cwd: ${OUT})`);
