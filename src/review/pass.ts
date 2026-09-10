/**
 * **The pass: it reads, it writes one report, and it creates nothing** —
 * `plan:loop seq:2`, design §5.
 *
 * ── PHASE 2 ENDS AT A DRY RUN ON PURPOSE ───────────────────────────────────
 *
 * `dryRun` is the ONLY mode this build has. The pass reads the whole session,
 * writes `state/review-last-pass.json`, and creates no item, no draft, no
 * staging entry and no revision. That is so it can run on real sessions for
 * days before `plan:loop seq:3` is allowed to propose anything — and the only
 * risk in the meantime is disk time.
 *
 * `created` is a FIELD on the report and always `[]`, rather than a sentence in
 * this comment, because a reader checking whether the loop has started writing
 * to the corpus should be able to check it rather than trust it.
 *
 * ── THE ONE ASSERTION THAT PROTECTS THE PERSON ─────────────────────────────
 *
 * `Stop` is the hook where somebody is staring at a prompt. The child is
 * `detached: true`, `stdio: 'ignore'`, `.unref()`ed and **never awaited** —
 * `src/ui/open.ts`'s pattern, including the part of it that is easy to leave
 * out: a `ChildProcess` whose spawn failed emits `'error'` on a later tick,
 * and an `EventEmitter` with no `'error'` listener rethrows it as an uncaught
 * exception. `openBrowser` records the measurement that established this on
 * Node v24.14.0, and the listener below is the difference between a hook that
 * returns and a hook that takes the session down.
 *
 * ── AND WHAT THE REPORT IS FOR ─────────────────────────────────────────────
 *
 * It is the whole output of this phase. Its first field after the stamp is the
 * wholeness line, because a report whose coverage is a footnote is a report
 * whose coverage nobody reads.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMainEntry } from '../core/paths.ts';
import { POINT_CATEGORIES, type PointCategory } from '../core/session-summary.ts';
import { gather, wholenessLine, type PassInput, type SkippedSource } from './input.ts';
import { worthAPass, type RubricVerdict } from './rubric.ts';

/** The report's name under `<corpusRoot>/state/`. */
const REPORT_FILE = 'review-last-pass.json';

/** Where the pass writes what it read. Gitignored with the rest of `state/`. */
export function passReportPath(stateRoot: string): string {
  return path.join(stateRoot, 'state', REPORT_FILE);
}

/**
 * What one pass looked at and concluded.
 *
 * **Everything here is a floor and the report says so in `wholeness`.** The
 * transcript records what was SAID; it does not record what was understood,
 * what was acted on, or the parts of a lane's reasoning that never reached its
 * transcript — `plan:loop seq:1`'s standing caveat, which applies unchanged.
 */
export interface PassReport {
  at: string;
  sessionId: string | null;
  /** Always `true` in this build. A field, not a promise. */
  dryRun: true;
  /** `wholenessLine(input)`. The first thing a reader should read. */
  wholeness: string;
  whole: boolean;
  /** Where this pass started returning points. The last report's `readTo`. */
  sinceByte: number;
  /** Where it stopped. The NEXT pass's `sinceByte`. */
  readTo: number;
  sources: string[];
  skipped: SkippedSource[];
  readBytes: number;
  records: number;
  unreadable: number;
  ms: number;
  rubric: RubricVerdict;
  byCategory: Record<string, number>;
  points: {
    category: PointCategory; who: string; source: string; recordIndex: number;
    at: string | null; text: string;
  }[];
  /**
   * **Always empty in this phase**, and a field rather than a sentence so that
   * "the loop has not started writing to the corpus" is something a reader
   * checks rather than believes.
   */
  created: string[];
}

/**
 * The last report, or `null`.
 *
 * Read by TYPE and not trusted, `readCounter`'s posture for its reason: the
 * one field this build acts on is `readTo`, and a `readTo` that arrived as a
 * string would silently become `NaN` in an arithmetic comparison and turn
 * every pass into a whole-file send.
 */
export function readPassReport(stateRoot: string): PassReport | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(passReportPath(stateRoot), 'utf8'));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as PassReport;
  } catch {
    return null;
  }
}

/** The offset the last pass stopped at, or 0 for a workspace with no report. */
export function lastReadTo(stateRoot: string): number {
  const previous = readPassReport(stateRoot);
  const value = previous?.readTo;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

/**
 * Write the report atomically. `writeCounter`'s shape, for `writeCounter`'s
 * reason — a torn report is worse than no report, because the half that
 * survives is a `readTo` the next pass would obey.
 */
function writeReport(stateRoot: string, report: PassReport): boolean {
  const target = passReportPath(stateRoot);
  const tmp = `${target}.tmp-${process.pid}`;
  try {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(tmp, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    renameSync(tmp, target);
    return true;
  } catch {
    try { rmSync(tmp, { force: true }); } catch { /* survivable litter */ }
    return false;
  }
}

/** How many points of each category the pass found. Zeros are drawn, not omitted. */
function tally(input: PassInput): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const category of POINT_CATEGORIES) counts[category] = 0;
  for (const point of input.points) {
    counts[point.category] = (counts[point.category] ?? 0) + 1;
  }
  return counts;
}

export interface PassOptions {
  /** The corpus root — `findProjectRoot`'s answer, the `.my_context` directory. */
  workspace: string;
  transcript: string;
  sessionId: string | null;
  subagentDir: string | null;
  includeSubagents: boolean;
  /** The ONLY mode this build has. Typed as the literal so a caller cannot pass false. */
  dryRun: true;
  budgetBytes?: number;
  capBytes?: number;
}

/**
 * Read, decide, report. **Creates nothing.**
 *
 * The rubric is applied HERE as well as in the hook, and the duplication is
 * deliberate rather than sloppy: the hook's rubric decides whether to spend a
 * fire on a stretch it can see cheaply, and this one records what the whole
 * read actually found. When the two disagree — the hook fired and the pass
 * found nothing worth firing on — that disagreement is in the report, and it
 * is the signal that the trigger is mistuned. A pass that reused the hook's
 * verdict could never show it.
 */
export async function runPass(options: PassOptions): Promise<PassReport> {
  const sinceByte = lastReadTo(options.workspace);
  const input = gather({
    transcript: options.transcript,
    sinceByte,
    includeSubagents: options.includeSubagents,
    subagentDir: options.subagentDir,
    ...(options.budgetBytes === undefined ? {} : { budgetBytes: options.budgetBytes }),
    ...(options.capBytes === undefined ? {} : { capBytes: options.capBytes }),
  });

  const report: PassReport = {
    at: new Date().toISOString(),
    sessionId: options.sessionId,
    dryRun: true,
    wholeness: wholenessLine(input),
    whole: input.whole,
    sinceByte,
    readTo: input.readTo,
    sources: input.sources,
    skipped: input.skipped,
    readBytes: input.readBytes,
    records: input.records,
    unreadable: input.unreadable,
    ms: input.ms,
    rubric: worthAPass(input.points.map((p) => ({ category: p.category, who: p.who }))),
    byCategory: tally(input),
    points: input.points,
    created: [],
  };
  writeReport(options.workspace, report);
  return report;
}

/** What the hook did about the pass, so the audit row can carry it. */
export interface SpawnOutcome {
  spawned: boolean;
  /** Present when the spawn failed, and it says why. */
  why?: string;
}

/**
 * Start the pass in a detached child and return IMMEDIATELY.
 *
 * `spawnFn` is injected so the kill switch and the failure path are testable
 * on one machine; production passes none. **The kill switch is not checked
 * here** — it is checked by the one caller, before this function is reached,
 * because §11's rule is one switch for one subsystem and a second check in a
 * second place is how a switch that does not kill gets written.
 */
export function spawnPass(options: PassOptions, spawnFn: typeof spawn = spawn): SpawnOutcome {
  const args = [
    '--disable-warning=ExperimentalWarning',
    path.resolve(import.meta.dirname, 'pass.ts'),
    '--workspace', options.workspace,
    '--transcript', options.transcript,
    ...(options.sessionId === null ? [] : ['--session', options.sessionId]),
    ...(options.subagentDir === null ? [] : ['--subagents', options.subagentDir]),
    ...(options.includeSubagents ? [] : ['--no-subagents']),
  ];
  try {
    const child: ChildProcess = spawnFn(process.execPath, args, {
      detached: true, stdio: 'ignore',
    });
    // BEFORE unref and before anything can return — see the header. Without
    // this listener a machine on which the spawn fails takes down the hook.
    child.on('error', () => { /* the pid check below is the answer */ });
    child.unref();
    if (child.pid === undefined) {
      return { spawned: false, why: 'the child could not be started on this system' };
    }
    return { spawned: true };
  } catch (err) {
    return { spawned: false, why: err instanceof Error ? err.message : String(err) };
  }
}

/** The child's own argument reader. Positional-free, so an absent flag is absent. */
function flag(argv: string[], name: string): string | null {
  const at = argv.indexOf(name);
  if (at === -1 || at + 1 >= argv.length) return null;
  const value = argv[at + 1];
  return value === undefined || value.startsWith('--') ? null : value;
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  const argv = process.argv.slice(2);
  const workspace = flag(argv, '--workspace');
  const transcript = flag(argv, '--transcript');
  if (workspace !== null && transcript !== null) {
    void runPass({
      workspace,
      transcript,
      sessionId: flag(argv, '--session'),
      subagentDir: flag(argv, '--subagents'),
      includeSubagents: !argv.includes('--no-subagents'),
      dryRun: true,
    }).catch(() => { /* a detached child has nobody to tell */ });
  }
}
