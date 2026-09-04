import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openProjection, syncProjection } from '../../core/audit-db.ts';
import { handoverThresholdPercent } from '../../core/config.ts';
import { readOccupancy } from '../../core/context-occupancy.ts';
import { describeFocus, isFocusActive, readFocus } from '../../core/focus.ts';
import {
  contextEpochStart, newestAuditRow, shareOf, shareSql,
} from '../../core/context-share.ts';
import { resolveCorpus, type CorpusResolution } from '../../core/corpus-identity.ts';
import { isMainEntry } from '../../core/paths.ts';
import { classifyContext, writeTee, type ContextSample } from '../../core/statusline-tee.ts';
import { resolveWorkspace, type Workspace } from '../../core/workspace.ts';
import { readStdin } from '../../hooks/io.ts';
import { refuseUnknownFlag } from './format.ts';
import { registerCommand, type Emit } from './registry.ts';
import { cmdStatuslineInstall, cmdStatuslineUninstall, delegateFor } from './statusline-install.ts';
import {
  buildLines, buildSegments, colourAllowed, gitBranch, payloadExtras, renderPowerline,
  renderStatusLine, type LastAudit, type OccupancyView, type PowerlineInput,
} from './statusline-powerline.ts';

// --- The status line bridge (spec §4b) --------------------------------------
//
// Claude Code runs the configured statusLine command on every assistant
// message and pipes a JSON payload to its stdin. This command does two things
// with it: TEES it whole to a per-session file (core/statusline-tee.ts) so the
// web UI can join the context number to the audit log on `session_id`, and
// PRINTS one line for Claude Code to display.
//
// This is the ONE thing in the web-ui plans that writes a file, and it is a
// CLI command the user installs deliberately (`statusline install`, opt-in,
// print-and-ask — see statusline-install.ts) rather than a UI endpoint. The UI
// itself stays read-only.
//
// Every branch below exits 0 once a payload has been read. The line IS the
// surface here: a thrown error or a non-zero exit makes Claude Code's status
// line flicker or disappear between messages, so a failure is DIAGNOSED IN THE
// LINE and the process still succeeds. The one non-zero exit is the case where
// there is no payload at all, which is a human running the verb by hand.

export interface MyctxShare {
  tokens: number;
  injections: number;
  unrecorded: number;
}

/**
 * The §4b numerator: what mycontext put into THIS session's context window,
 * from the injection records' `tokens` — the estimate frozen at injection
 * time, never re-derived from today's corpus.
 *
 * Records that predate that field are COUNTED as unrecorded, not summed as
 * zero: an absent estimate is an absence, and a status line that quietly read
 * it as 0 would understate the share by exactly the amount it could not see,
 * confidently.
 *
 * **Two bounds, and both were measured before either was written**
 * (`core/context-share.ts` carries the numbers and the argument). Until
 * 2026-08-31 this summed EVERY injection record matching the session id, with
 * no time bound and no compaction boundary: on this repository's own corpus
 * that was 2,556,774 tokens beside a 1,000,000-token window at 25.1% full — a
 * fourteen-day lifetime counter printed next to a percentage of the window as
 * though the two were commensurable. Bounding it to the current compaction
 * epoch alone still gave 1,192,523, because 83% of that belongs to
 * `subagent-start` records, which carry the PARENT session's id and were
 * delivered into ninety-nine other models' windows. Both bounds live in
 * `context-share.ts` and neither is spelled here.
 *
 * The projection is synced first and this THROWS when it cannot answer, so the
 * caller can print "unavailable" rather than a number that is quietly behind
 * the log.
 */
/**
 * The newest audit row, in the three states a reader must be able to tell
 * apart: a row, an empty log, and a read that failed.
 *
 * **Empty and unreadable are not the same fact and do not render the same.**
 * "Nothing has been recorded" is a measurement; "I could not tell" is not.
 * Collapsing them would make a broken projection look like a quiet machine,
 * which is precisely the confusion this field exists to end — the same reason
 * `readOccupancy` keeps four reasons apart instead of one "unavailable".
 *
 * Opens its own connection rather than reaching into `myctxShare`'s, and that
 * costs an open: measured p50 0.020 / p95 0.048 ms for the QUERY, against
 * roughly 2.5 ms for the open itself. It is done this way because the share
 * can THROW — a projection behind its log is a refusal — and the audit clock
 * is exactly the field a reader wants when something else has just failed. A
 * health signal that goes dark whenever its neighbour does is not a health
 * signal.
 */
export function lastAudit(projectRoot: string): LastAudit {
  try {
    const db = openProjection(projectRoot);
    try {
      const row = newestAuditRow(db);
      return row === null ? { state: 'empty' } : { state: 'known', op: row.op, at: row.at };
    } finally {
      db.close();
    }
  } catch {
    return { state: 'unreadable' };
  }
}

export function myctxShare(projectRoot: string, sessionId: string): MyctxShare {
  const db = openProjection(projectRoot);
  try {
    syncProjection(projectRoot, db);
    // `null` — never compacted — becomes NO `since` at all rather than a
    // sentinel date: a session that has held everything ever injected into it
    // is correctly answered by an unbounded sum, and inventing an epoch start
    // for it would be a bound nobody measured.
    const epoch = contextEpochStart(db, sessionId);
    const { sql, params } = shareSql(sessionId, epoch);
    const row = db.prepare(sql).get(...params) as {
      injections: number; tokens: number; unrecorded: number;
    };
    return {
      tokens: Number(row.tokens),
      injections: Number(row.injections),
      unrecorded: Number(row.unrecorded),
    };
  } finally {
    db.close();
  }
}

/**
 * The loop the aggregate above replaced, kept so the two can be held to the
 * same answer over a real corpus rather than by reading the SQL.
 *
 * Re-exported from `core/context-share.ts` rather than reimplemented, so the
 * pin in `test/cli/statusline.test.ts` keeps testing the ONE loop the UI
 * server also runs.
 */
export const myctxShareByRow = shareOf;

/**
 * `readOccupancy`'s answer, for a session this bridge holds the payload of.
 *
 * **The tee is the source, not the payload in hand.** The bridge has just
 * written this sample, so reading it back costs one small file — and it is
 * what buys the three unmeasurable reasons (`no-bridge`, `no-sample`,
 * `unknown-shape`) already spelled once in `core/context-occupancy.ts`, kept
 * apart there on purpose, and not respelled here. A second classification of
 * the same payload in this file would be a second chance to be silently wrong
 * about which of the three a shape is.
 *
 * **The freshness gate is `readOccupancy`'s, not this file's.** Since
 * 2026-08-31 that module owns `CONTEXT_SAMPLE_FRESH_MS` and answers
 * `why: 'stale'` for a sample it will not present as current, and it carries
 * `receivedAt` on the known branch so nothing has to read the tee twice. The
 * age computed below is therefore the age of a sample already shown to be
 * fresh; it is still passed to `levelFor` rather than assumed, so the terminal
 * and the browser run the same predicate over the same constant.
 */
export function occupancyFromTee(projectRoot: string, sessionId: string, now: number): OccupancyView {
  const occ = readOccupancy(projectRoot, sessionId);
  if (occ.state === 'unmeasurable') return { state: 'unmeasurable', why: occ.why };
  const at = Date.parse(occ.receivedAt);
  // A stamp this product wrote and cannot parse is age 0 here and NOT a huge
  // age, because `readOccupancy` has already refused every sample it could not
  // date: anything reaching this line has been shown to be current, and
  // inventing a staleness on top of that would grey out a live reading.
  const ageMs = Number.isFinite(at) ? Math.max(0, now - at) : 0;
  // `usedTokens` and `windowSize` are `readOccupancy`'s own, passed straight
  // through: the bar draws `(549.0k / 1.0M)` beside the figure since the
  // owner's used-of-maximum ruling, and reconstructing a numerator from a
  // rounded percentage would be a worse number than the one already in hand.
  return {
    state: 'known',
    percent: occ.percent,
    ageMs,
    usedTokens: occ.usedTokens,
    windowSize: occ.windowSize,
  };
}

/**
 * The same answer for a session with no workspace to tee into — from the
 * payload in hand, which is the only thing there is.
 *
 * The mapping matches `readOccupancy`'s own, deliberately and for its stated
 * reason: `not-yet-known` is `no-sample` and NOT `unknown-shape`, because
 * `current_usage === null` is what Claude Code sends between a compaction and
 * the next API call — a perfectly well-formed payload with nothing to report
 * yet — and reporting a schema break there sends a person to re-verify their
 * Claude Code binary over nothing.
 */
export function occupancyFromPayload(sample: ContextSample): OccupancyView {
  if (sample.state === 'known' && sample.percent !== null
      && sample.usedTokens !== null && sample.windowSize !== null) {
    return {
      state: 'known',
      percent: sample.percent,
      ageMs: 0,
      usedTokens: sample.usedTokens,
      windowSize: sample.windowSize,
    };
  }
  // A sample carrying a percentage but not the two numbers it came from is a
  // shape this code cannot read — the same verdict, and the same reason, that
  // `classifyContext` gives a `current_usage` it does not recognise. It is not
  // downgraded to a percentage-only known state, because the bar would then
  // have a figure and no counts and no way to say why.
  if (sample.state === 'known' && sample.percent !== null) {
    return { state: 'unmeasurable', why: 'unknown-shape' };
  }
  if (sample.state === 'not-yet-known') return { state: 'unmeasurable', why: 'no-sample' };
  return { state: 'unmeasurable', why: 'unknown-shape' };
}

/**
 * **THE ENVIRONMENT VARIABLE THAT FORCES THE ONE-LINE FORM.**
 *
 * Set to any non-empty value and the bar renders as a single line carrying
 * every block, exactly as it did before the owner's two-line ruling of
 * 2026-08-31.
 *
 * It exists because the two-line form rests on a reading of ONE build's
 * renderer (`statusline-powerline.ts` · `renderStatusLine`, read from the
 * installed 2.1.248), and a claim about somebody else's binary is exactly the
 * kind of claim that stops being true without telling anybody. Two multi-line
 * regressions are already on record — a second line vanishing on narrow
 * terminals, and 2.1.80 truncating line 2 as though it were joined to line 1 —
 * so a user who meets a third needs a way back that does not involve waiting
 * for this project to ship. The degradation is the honest one: one line with
 * everything on it, never a second line quietly lost, which is the same rule
 * the `…` mark follows.
 *
 * Deliberately NOT auto-detected from `version` in the payload. A version
 * allow-list is a table that goes stale in silence — the argument
 * `core/context-occupancy.ts` makes against a model-to-window table, and it
 * applies here for the same reason: it would keep answering, wrongly, for
 * every build released after it was written.
 */
export const ONE_LINE_ENV = 'MYCONTEXT_STATUSLINE_ONE_LINE';

/**
 * **THE ENVIRONMENT VARIABLE THAT STOPS THE BLINK.**
 *
 * Set to any non-empty value and a `critical` block is painted without SGR 5.
 * It loses nothing that carries meaning: the level is still told by its 💀
 * icon, by its hue, and by its BOLD weight, which is the carrier — the blink
 * was always the fourth signal and never the first
 * (`statusline-powerline.ts` · `blink?: boolean`).
 *
 * It exists because the owner asked for the blink and WCAG 2.2.2 asks that
 * blinking content be stoppable, and those are both true at once. Deliberately
 * shaped like `ONE_LINE_ENV` — same prefix, same "set it to anything" rule —
 * because a user who has learned one of these has learned the other, and a
 * second convention would be a second thing to look up.
 *
 * Not auto-detected from `TERM`: a terminal that ignores SGR 5 already
 * degrades correctly by ignoring it, and an allow-list of terminals that
 * honour it is exactly the table that goes stale in silence — the argument
 * this file already makes against a version allow-list one constant above.
 */
export const NO_BLINK_ENV = 'MYCONTEXT_STATUSLINE_NO_BLINK';

/**
 * One bar, one spelling per state — the same honesty rules the UI strip
 * renders, so a user who reads both never sees them disagree, and the same
 * BANDS as well: the colour of the context block comes from the web's own
 * `occupancyLevel` (see `statusline-powerline.ts`), never from a threshold
 * spelled a second time here.
 *
 * **TWO LINES since the owner's ruling of 2026-08-31**: line 1 is identity and
 * never moves, line 2 is everything that does. The reason is a reading habit
 * rather than a width — after ten minutes nobody looks at line 1, so every
 * changing number belongs on the line the eye is still on — and it is
 * `buildLines` that owns the split. `renderStatusLine` renders each line with
 * its own caps and its own trailing reset, which is REQUIRED rather than tidy:
 * Claude Code prepends every escape from line 1 to line 2, so without that
 * reset line 2 opens painted in the last block's background.
 *
 * `myctxNote` is why the myctx half is MISSING; `teeNote` is why the sample
 * did not reach disk. They are two facts and they are two fields on
 * `PowerlineInput`, because folding them into one drops whichever did not win:
 * `writeTee` refuses an unsafe `session_id` while `myctxShare` answers for
 * that same id perfectly well, so a single note rendered only when the share
 * is absent would print a confident myctx figure and never mention that the
 * web UI is getting nothing (`INV-nothing-is-dropped-silently`, on the one
 * surface whose job is disclosure).
 */
export function statusLineText(
  input: PowerlineInput,
  colour: boolean,
  columns: number | null,
  env: Record<string, string | undefined> = process.env,
  /**
   * Render time, and it is a PARAMETER since 2026-09-02 for the reason
   * `buildLines`' already was: the bar now carries a wall clock, so a caller
   * that asserts the line verbatim would otherwise be racing the minute
   * boundary. `buildLines` and `buildSegments` both take one and both
   * defaulted to `Date.now()` independently, which meant the two rows of one
   * render could straddle a second; passing one instant down also fixes that.
   */
  now: number = Date.now(),
): string {
  const noBlink = env[NO_BLINK_ENV];
  const options = {
    colour,
    columns,
    blink: !(typeof noBlink === 'string' && noBlink !== ''),
  };
  const forced = env[ONE_LINE_ENV];
  if (forced !== undefined && forced !== '') {
    return renderPowerline(buildSegments(input, now), options);
  }
  // **THREE lines since the owner's ruling of 2026-09-01.** `renderStatusLine`
  // drops any group that is empty, so a session with no ask and no context
  // still renders two rows rather than a blank one.
  const { identity, window, account } = buildLines(input, now);
  return renderStatusLine([identity, window, account], options);
}

// --- Delegating to the status line this bridge displaced --------------------
//
// `install` chains rather than replaces (statusline-install.ts): the command it
// displaced is saved, and after the tee this file runs it with the SAME payload
// on stdin and prints its stdout as the line. The user keeps the status line he
// had; mycontext still gets its sample.
//
// The two rules the code below is shaped by:
//
//   1. THE TEE IS FIRST AND UNCONDITIONAL. It is the reason this command
//      exists; the delegation is a courtesy to somebody else's plugin. Nothing
//      the delegate does — hanging, dying, being missing — can cost us the
//      sample, because the sample is already on disk before it is asked.
//   2. A FAILED DELEGATE IS NOT A FAILED STATUS LINE. Every ending falls back
//      to our own line and exit 0, for the same reason the rest of this file
//      diagnoses in the line rather than throwing: a status line that crashes
//      is a status line the user removes, and then the measurement stops for
//      good.

/**
 * How long the displaced command may take before it is killed and we print our
 * own line instead: a second and a half.
 *
 * The register is `src/ui/execute.ts` · `RUN_TIMEOUT_MS`, and the number is the
 * opposite one because the trade is the opposite. There, a minute: a person is
 * watching a `rebuild` they asked for, and a bound that killed real work would
 * teach them to re-run it, which is worse than waiting. Here nobody is waiting
 * on purpose — Claude Code runs this per assistant message, and again on
 * `INSTALLED.refreshInterval` — and the work being killed is one line of text
 * that is already stale by the time it is late. What the bound costs when it
 * expires is one refresh of somebody else's line; what having no bound costs is
 * a status line that hangs on every message, which is the failure this whole
 * command must not be.
 *
 * Weighed against something tighter, 200 ms say: the delegate this was written
 * for is `node gsd-statusline.js`, and a Node interpreter alone takes well over
 * 100 ms to start on a cold, busy machine. A bound that tight would kill a
 * perfectly good status line most of the time and look like a bug in theirs.
 */
export const DELEGATE_TIMEOUT_MS = 1_500;

/**
 * How much the delegate may print before we stop reading: 1 MiB.
 *
 * It is producing a status LINE. A megabyte is four orders of magnitude above
 * anything that could be one, and the bound exists only so a delegate that
 * decides to stream cannot grow this process's memory on a per-message path.
 */
const MAX_DELEGATE_OUTPUT = 1024 * 1024;

/**
 * Runs the displaced command and returns the line it printed, or `null`.
 *
 * `null` for EVERY way this can fail to produce a line — missing binary,
 * non-zero exit, timeout, signal, empty or blank output — because the caller's
 * answer to all of them is the same and is the only safe one: print our own
 * line. A partial line from a command that then exited 3 is not trusted
 * either; a status line assembled from a failed run is worse than one that
 * says something true about mycontext.
 *
 * `spawnSync`, with an argv ARRAY and no `shell` option of any kind — the rule
 * `src/ui/execute.ts` · `execFileRunner` states: there is no string here that a
 * command could be appended to, so quoting and metacharacters are not problems
 * to get right, they are problems that do not arise. The string the argv came
 * from was parsed by `parseCommandString`, which REFUSES anything a shell would
 * have had to interpret.
 *
 * Synchronous because `CommandFn` is: this command is one blocking read of
 * stdin and one line out, and an async seam here would be a change to every
 * caller for no behaviour.
 */
export function runDelegate(
  argv: string[],
  input: string,
  timeoutMs: number = DELEGATE_TIMEOUT_MS,
): string | null {
  const file = argv[0];
  if (file === undefined) return null;
  try {
    const result = spawnSync(file, argv.slice(1), {
      input,
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: MAX_DELEGATE_OUTPUT,
      // No console window flashes up on win32 once per assistant message.
      windowsHide: true,
    });
    // `error` is set for a child that never ran (ENOENT) and, on some
    // platforms, for one killed by the timeout; `status` is null for a killed
    // child and non-zero for a refusal. All of them are "no line".
    if (result.error !== undefined || result.status !== 0) return null;
    const text = typeof result.stdout === 'string' ? result.stdout : '';
    if (text.trim() === '') return null;
    // One trailing newline removed, and only one: `Emit` supplies the line
    // ending, and a delegate that prints a multi-line status line keeps it.
    return text.replace(/\r?\n$/, '');
  } catch {
    // `spawnSync` throws only for a malformed invocation, which would be this
    // command's own bug — but a throw here would blank the user's status line
    // and there is a correct thing to do instead, which is our own line.
    return null;
  }
}

/**
 * The subcommands this verb dispatches on, exported for the same reason
 * `pack`, `procedure`, `review` and `session` export theirs: the registry's
 * usage line is built from this list rather than restating it, and
 * `test/helpers/approval-boundary.ts` pins what the usage line ADVERTISES
 * against what this command actually DISPATCHES.
 *
 * That pin is why this constant exists at all. Both of these take `--yes`
 * (`statusline install --yes` writes a Claude Code setting), and the probe
 * that enumerates the approval boundary reaches a flag only on a command
 * STRING it knows about — so a subcommand that is dispatched here and
 * advertised nowhere derivable is a `--yes` nothing measures. It was one:
 * the probe expanded four commands from a hand-kept list written when four
 * had subcommands, and this was the fifth.
 */
export const SUBCOMMANDS = ['install', 'uninstall'] as const;

const USAGE =
  'usage: mycontext statusline                    (reads Claude Code\'s payload on stdin)\n' +
  '       mycontext statusline install   [--settings <path>] [--yes]\n' +
  '       mycontext statusline uninstall [--settings <path>] [--yes]';

const NO_PAYLOAD =
  'my_context: `mycontext statusline` expects Claude Code\'s status-line JSON on stdin. It is ' +
  'installed as a statusLine command by `mycontext statusline install`, which prints your ' +
  'existing setting and what it would replace it with, and writes nothing without --yes.';

/**
 * The entry file this command's own CLI is launched as.
 *
 * Used to answer one question before stdin is touched: is fd 0 this command's
 * to consume? See `cmdStatusline`.
 */
const CLI_ENTRY = fileURLToPath(new URL('../index.ts', import.meta.url));

/**
 * Whether reading stdin to EOF is safe in THIS process.
 *
 * `readStdin` is `readFileSync(0)`, which blocks until end-of-file. That is
 * exactly right for the installed bridge — Claude Code writes one payload and
 * closes the pipe — and it is a hang everywhere else:
 *
 *  - `runCli` is also a library. `test/docs/inventory.test.ts` runs every
 *    command the usage banner advertises, bare and in process, to prove each
 *    one dispatches; a `node --test` child's stdin is a pipe nobody ever
 *    closes, so a `statusline` that read it there would not fail the suite, it
 *    would HANG it, with nothing in the output naming the cause. Measured on
 *    this machine before this guard was written.
 *  - a human typing `mycontext statusline` in a terminal gets a TTY, where
 *    "to EOF" means "until you press Ctrl-D" — a prompt with no prompt.
 *
 * In both cases there is no payload to read, so the answer is the same
 * explanation the empty-stdin path gives, and the process exits rather than
 * waiting on something that is never coming.
 */
function stdinIsOurs(): boolean {
  return isMainEntry(CLI_ENTRY, process.argv[1]) && process.stdin.isTTY !== true;
}

function cmdStatusline(ws: Workspace, args: string[], out: Emit, cwd: string): number {
  const sub = args[0];
  if (sub === 'install') return cmdStatuslineInstall(ws, args.slice(1), out);
  if (sub === 'uninstall') return cmdStatuslineUninstall(ws, args.slice(1), out);

  // A first argument that is not a flag is a SUBCOMMAND, and this verb has
  // exactly the two above. Refused here — before the flag check rather than
  // after it — so that the answer to "is this command dispatched by
  // subcommand?" survives an unknown flag on the same command line. That is
  // how `test/helpers/approval-boundary.ts` now asks the parser which commands
  // are subcommanded instead of keeping a list: it probes with a bogus
  // subcommand AND a sentinel flag, and a flag refusal arriving first would
  // hide the subcommand entirely — which is exactly the blind spot that let
  // `statusline install --yes` go unmeasured. The other four subcommanded
  // commands (`pack`, `procedure`, `review`, `session`) already check the
  // subcommand first, so this also makes the five agree.
  if (sub !== undefined && !sub.startsWith('--')) {
    out(`my_context: unknown subcommand "${sub}".\n${USAGE}`);
    return 1;
  }

  // The bare verb takes NO flags at all — every flag on this command belongs
  // to a subcommand. Refusing them here is what keeps `--yes` from being
  // readable as consent on a verb that never asks for any (see
  // test/helpers/approval-boundary.ts, which probes exactly this), and it has
  // to happen BEFORE stdin: a status line that silently ignored a mistyped
  // argument and then blocked on a pipe would be the worst of both.
  if (refuseUnknownFlag(args, [], [], USAGE, out)) return 1;

  if (!stdinIsOurs()) {
    out(NO_PAYLOAD);
    return 1;
  }

  const raw = readStdin();
  if (raw.trim() === '') {
    out(NO_PAYLOAD);
    return 1;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    out('mycontext: unreadable status payload (not JSON)');
    return 0;
  }

  const p = payload as {
    cwd?: unknown;
    workspace?: { project_dir?: unknown };
    session_id?: unknown;
    model?: { display_name?: unknown; id?: unknown };
  } | null;

  // Resolve the workspace from where the payload says the session lives, not
  // from this process's cwd: Claude Code documents no working directory for a
  // statusLine command, and the payload carries the truth. When that directory
  // has no workspace there is deliberately no fallback to `cwd` — teeing one
  // project's context into another project's `.statusline/` would be worse
  // than the missing sample it replaced.
  const sessionCwd =
    typeof p?.workspace?.project_dir === 'string' ? p.workspace.project_dir
    : typeof p?.cwd === 'string' ? p.cwd
    : cwd;

  let projectRoot: string | null = null;
  // The threshold the occupancy bands are derived FROM, read from the session's
  // own workspace and not from this process's: two projects may configure two
  // different asks, and colouring one session's window against the other's
  // threshold is the same class of error as teeing into the wrong `.statusline/`.
  // `null` is the handover feature switched off, which is not a threshold of
  // zero — there is no ask, so there is no band to name, and the block draws
  // neutral rather than a guessed green.
  let threshold: number | null = null;
  try {
    const sessionWs = resolveWorkspace(sessionCwd);
    projectRoot = sessionWs.projectRoot;
    threshold =
      sessionWs.config.handover === null ? null
      : handoverThresholdPercent(sessionWs.config.handover);
  } catch {
    // A corrupt config.json in that tree. Not this command's business, and not
    // a reason to blank the status line.
    projectRoot = null;
  }

  // ── WHICH CORPUS THE SESSION'S OWN DIRECTORY RESOLVES TO — owner request,
  //    2026-09-02.
  //
  // **From `extras.cwd` and NOT from `sessionCwd`, and the difference is the
  // entire field.** `sessionCwd` above prefers `workspace.project_dir`, on
  // purpose, so a tee can never land in another project's `.statusline/`. The
  // HOOKS have no such preference: they resolve by walking up from wherever
  // they were run, which is `cwd`. When the two disagree, the bar this command
  // prints is reading one corpus while the session's hooks are writing to
  // another — the failure the owner reported twice on 2026-09-02, and the one
  // no field on either bar could show.
  //
  // **One resolver, and it is the one the MCP surface already uses.**
  // `resolveCorpus` is `core/corpus-identity.ts`'s, called by
  // `toolResultProvenance` on every tool result since 2026-08-27. Two
  // resolvers that could disagree about which corpus is in play would be a
  // particularly bad version of the defect this is here to expose.
  //
  // **What it costs on a per-message path.** The ordinary case is ONE upward
  // `existsSync` walk for the root plus one more to the filesystem root
  // looking for an enclosing corpus — a handful of stats, no directory read,
  // no parse. The recursive `items/` counts inside `nesting` are taken ONLY
  // when a nested corpus was actually found, which is the alarm state: the one
  // state where a person is about to make a decision on this line, and where
  // reading "44" as a sparse project rather than as a different corpus is the
  // whole mistake.
  //
  // Never a throw. A tree this cannot walk is not a reason to blank the user's
  // status line, which is the rule the `resolveWorkspace` call above follows.
  const extras = payloadExtras(payload);
  let corpus: CorpusResolution | null = null;
  try {
    if (extras.cwd !== null) corpus = resolveCorpus(extras.cwd);
  } catch {
    corpus = null;
  }

  const sample = classifyContext(payload);
  const model =
    typeof p?.model?.display_name === 'string' ? p.model.display_name
    : typeof p?.model?.id === 'string' ? p.model.id
    : null;

  let myctx: MyctxShare | null = null;
  let myctxNote: string | null = null;
  let teeNote: string | null = null;

  // What mycontext currently has in FOCUS — the one field on this bar that says
  // what the session is for rather than what it is consuming.
  //
  // **Measured before it was built** (2026-09-01, this repository's own corpus,
  // 733 items and 8,252 audit rows): `readFocus` is p50 0.033 ms / p95 0.077 ms,
  // against a bar that already pays p95 26.6 ms for `myctxShare`. It is one
  // `readFileSync` of a few hundred bytes and ENOENT — no focus, the common
  // case — is its cheapest answer.
  //
  // Read from `state/focus.json` and NOT from the audit log, which was the
  // obvious source and is the wrong one: `focus-set` rows carry no `sessionId`
  // (verified on the real log — every focus row has `sessionId: null`), so the
  // log cannot answer "what is in focus for THIS session" at all. The file is
  // both cheaper and correct, which is not a trade.
  // The audit clock, read on every message for the same reason the tee is:
  // whether this machine is still recording anything at all is the question no
  // other field on either line can answer.
  let audit: LastAudit | null = null;
  let focus: string | null = null;
  if (projectRoot !== null) {
    audit = lastAudit(projectRoot);
  }
  if (projectRoot !== null) {
    const state = readFocus(projectRoot);
    // A focus that could not be READ is not a focus that is absent, but this
    // bar has no room to say which and `focusErrorNote` already tells the
    // person on the hook path. Nothing is claimed here either way.
    focus = isFocusActive(state.focus) ? describeFocus(state.focus) : null;
  }

  if (projectRoot !== null) {
    // FIRST, and before the delegate is so much as looked up. Rule 1 above:
    // the sample is what this command is for, and it is not allowed to depend
    // on another plugin's script behaving.
    const tee = writeTee(projectRoot, payload);
    if (!tee.written) teeNote = `tee not written (${tee.reason ?? 'no reason given'})`;

    if (typeof p?.session_id === 'string') {
      try {
        myctx = myctxShare(projectRoot, p.session_id);
      } catch (err) {
        myctx = null;
        myctxNote = err instanceof Error ? err.message : String(err);
      }
    } else {
      // No session key: there is nothing to sum, and saying so is the point.
      // The tee refused for the same reason and its note already carries it,
      // so this half stays quiet rather than repeating it.
      myctx = null;
    }
  }

  // Read back through `readOccupancy` when there is a workspace to read it
  // from, so the three unmeasurable reasons come from the one module that
  // keeps them apart; from the payload in hand when there is not, which is the
  // only source a session with no corpus has.
  const occupancy: OccupancyView =
    projectRoot !== null && typeof p?.session_id === 'string'
      ? occupancyFromTee(projectRoot, p.session_id, Date.now())
      : occupancyFromPayload(sample);

  // Computed before the delegate runs, not after: this is the fallback, and a
  // fallback assembled only once something has already gone wrong is a code
  // path that first runs on the user's machine.
  //
  // `renderer: true` — the pipe on the other side of this stdout is Claude
  // Code's status line, which renders ANSI. It is asserted by the payload
  // having parsed: a human running the verb by hand was refused above with
  // NO_PAYLOAD and never reaches here, so the pipe that gets escapes is always
  // one that asked for them. See `colourAllowed`.
  // Everything else the payload carries that this bar draws: the model modes,
  // the two rate-limit windows, the cost, the cache ratio DERIVED from the same
  // three token counts the occupancy is, and the two directories. Read off
  // `payload`, the parsed bytes Claude Code sent, and every field is
  // absent-tolerant. `extras` is taken ONCE, near the top, because the corpus
  // resolution needs `cwd` before this point — one parse, one object.

  const ownLine = statusLineText(
    {
      ...extras,
      model,
      // `projectRoot` is the `.my_context` directory, so the NAME comes from the
      // session directory Claude Code named — which is the repository, and is what
      // the owner is reading when they look at this block.
      project: path.basename(sessionCwd),
      branch: gitBranch(sessionCwd),
      occupancy,
      threshold,
      myctx,
      focus,
      lastAudit: audit,
      myctxNote,
      teeNote,
      corpus,
    },
    colourAllowed(process.env, process.stdout.isTTY === true, true),
    typeof process.stdout.columns === 'number' ? process.stdout.columns : null,
  );

  // The courtesy, last. `delegateFor` answers `null` for every reason not to
  // chain — no saved copy, nothing displaced, a command string this project
  // will not parse into argv, or the bridge itself — so there is one branch
  // here rather than five.
  const delegate = delegateFor(ws);
  if (delegate !== null) {
    // `raw`, the bytes Claude Code sent, rather than a re-serialization of the
    // parsed payload: the delegate is entitled to the same input we got,
    // including any field this build does not know about.
    const theirs = runDelegate(delegate.argv, raw);
    if (theirs !== null) {
      out(theirs);
      return 0;
    }
  }

  out(ownLine);
  return 0;
}

registerCommand({
  name: 'statusline',
  // Derived from SUBCOMMANDS, not restated: `review`'s comment explains why a
  // second hand-kept spelling of a subcommand list drifts — and here the
  // approval-boundary probe reads this very line, so a drifted one would hide
  // a `--yes`.
  usage: `statusline [${SUBCOMMANDS.join('|')}] [--yes]`,
  summary: 'the opt-in status line bridge: tee Claude Code’s context figure for the web UI',
  run: cmdStatusline,
});
