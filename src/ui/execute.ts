/**
 * The two routes that let the UI RUN a command it composed.
 *
 * Spec: `docs/superpowers/specs/2026-08-26-execute-a-composed-command-design.md`
 * §3.1 (the client sends an id, never a command), §3.3 (intent is proved per
 * action), §3.4 (every execution is audited), §6.1 (everything in the catalogue
 * runs), §6.2 (there is no kill switch) and §6.3 (the residual is stated in the
 * product).
 *
 *   GET  /api/execute/confirm?id=…&…   what the dialog must show, plus a nonce
 *   POST /api/execute                  { id, values, nonce } → it runs
 *
 * ── THE ONE PROPERTY THIS FILE EXISTS TO KEEP ─────────────────────────────
 *
 * **The string a person reads in the confirm and the argv that runs are the
 * same thing.** Both routes go through `resolveCommand`, and the nonce binds
 * the second to what the first returned. There is no second path in this module
 * that composes an argv any other way, and adding one would not be a refactor —
 * it would be the defect the confirm exists to prevent, wearing a tidier shape.
 *
 * ── THE ORDER INSIDE THE POST IS THE SECURITY STORY ───────────────────────
 *
 *   1. body shape — anything that is not `id`, `values` or `nonce` is a 400,
 *      and an `argv` in the body is named in the refusal rather than dropped;
 *   2. `resolveCommand(id, values)` — a `CommandRefusal` is a 400;
 *   3. `nonces.redeem(nonce, id, resolved.argv)` — false is a 403. AFTER the
 *      resolve, so the nonce is checked against the argv the SERVER built and
 *      never against anything the client described;
 *   4. the `execute` audit row, with `exitCode: null`. A failed write is a 500
 *      and nothing runs — spec §3.4's "a run that cannot be recorded does not
 *      happen" is an ordering, not a wish;
 *   5. the run, through `execFile` with an argv array and no shell of any kind;
 *   6. a SECOND row, `execute-done`, is appended with the real exit code and
 *      the measured duration. Appended, never an amendment of row 4 — spec §3.4
 *      as AMENDED 2026-08-27, and `recordCompletion` below for why.
 *
 * Each of those steps has an assertion in `test/ui/execute-route.test.ts` that
 * fails when the step moves, because both plausible re-orderings — redeeming
 * before resolving, auditing after running — are silent in production.
 *
 * ── WHAT THIS MODULE DOES NOT DO ──────────────────────────────────────────
 *
 * It composes nothing (that is `execute-catalogue.ts`), it decides nothing
 * about which confirm a command gets (that is the catalogue's `boundary`, cached
 * from a measurement `test/ui/palette-lib.test.ts` derives from the real
 * argument parser), and it records no OUTPUT anywhere (see `AuditRecord.command`
 * in `core/audit.ts`: the argv is scope, stdout is content, and only the first
 * belongs in a file that travels between machines).
 */
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// `recordAudit` and nothing else. This module APPENDS to the audit log and has
// no other relationship with it: no `readFileSync`, no `writeFileSync`, no
// `auditLogPath`. It used to hold all three — see `recordCompletion` for what
// they did and why they are gone — and their absence is asserted by name in
// `test/ui/execute-route.test.ts`, because a rewrite reintroduced as a
// "simplification" would look tidier and destroy other writers' rows.
import { recordAudit } from '../core/audit.ts';
import { CommandRefusal, catalogueEntries, resolveCommand } from './execute-catalogue.ts';
// A VALUE import, deliberately, even though the class is only named in type
// positions below. `verbatimModuleSyntax` erases an `import type` whole, and an
// erased edge is not an edge: `test/ui/no-writes.test.ts` walks the runtime
// import graph from `server.ts` and reports a `src/ui/` module nothing reaches
// as "either dead code or a route nobody wired". A type-only import here would
// leave `execute-nonce.ts` exactly that, while the store it defines is the only
// thing standing between a silent local page and a corpus mutation (§6.3).
import { ExecutionNonceStore } from './execute-nonce.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';

/**
 * The path to the CLI THIS SERVER SHIPS WITH, resolved from this module rather
 * than looked up.
 *
 * Never a `mycontext` found on PATH: what is on PATH is whatever the user last
 * installed, which may be a different version, a different checkout, or — the
 * case that matters — not this project at all. Resolved from `import.meta.url`
 * so it moves with the file and cannot drift into a string somebody has to
 * remember to update.
 *
 * This is a PATH, not an import. `src/cli/index.ts` registers the whole
 * mutating command surface as an import side effect, which is why
 * `no-writes.test.ts` bans it from the UI's import graph; naming it as text and
 * handing it to a child process keeps that ban true — the writing commands are
 * registered in the CHILD, in a process that exits when the run does.
 */
export const CLI_ENTRY = fileURLToPath(new URL('../cli/index.ts', import.meta.url));

/**
 * A run is bounded. `doctor` and `rebuild` are the slow ones and both finish in
 * seconds on a corpus of this size; a minute is far above that and far below
 * "the tab is wedged". A command that outlives it is killed and RECORDED as
 * killed — `exitCode: null`, never 0, because "we stopped watching" and "it
 * succeeded" are different facts and only one of them is reassuring.
 *
 * Weighed against no bound at all: an unbounded run holds a request open for as
 * long as a child process feels like living, and the idle monitor cannot reap a
 * server with a request in flight. Weighed against something shorter, ten
 * seconds say: `rebuild` over a large corpus is a legitimate slow command, and a
 * bound that kills real work would teach people to re-run it, which is worse
 * than waiting.
 */
export const RUN_TIMEOUT_MS = 60_000;

/**
 * The residual, in the words spec §6.3 chose (plan Task 5, Task 6, Task 8).
 *
 * The gate proves a request came from a browser on this machine. It never
 * proves a person asked. §6.3 requires that to be written where a reader MEETS
 * it — in the confirm dialog itself — and not only where a reader could look it
 * up, which is this project's own standard about an unstated limit being how a
 * partial claim gets read as a complete one.
 *
 * Spelled ONCE, here, and served by the confirm rather than typed into the page:
 * a sentence duplicated into the browser is a sentence that gets reworded on one
 * side only.
 */
export const EXECUTION_RESIDUAL =
  'This runs on your machine, now. The UI can tell it came from your browser — '
  + 'not that you asked. Only run what you recognise here.';

/** How much of a run's output is handed back to the page. */
const MAX_REPORTED_OUTPUT = 64 * 1024;

/**
 * How much output the child may produce before `execFile` gives up on it: 8 MiB.
 *
 * Above `MAX_REPORTED_OUTPUT` on purpose. The two answer different questions —
 * this one is "how much may the child write before we stop being able to see
 * how it ended", and a `doctor` run over a large corpus goes well past the
 * default 1 MiB. Overflowing it kills the child, and a killed child has no exit
 * code, so a bound that is too small turns an ordinary successful run into an
 * unrecorded one.
 */
const MAX_CHILD_OUTPUT = 8 * 1024 * 1024;

/**
 * The query parameter that carries an ARGUMENT named `id`.
 *
 * `?id=` is already spoken for: it names the catalogue entry. `pin`, `show`,
 * `edit` and eleven others take an argument that is also called `id`, so one
 * name would have to mean two things in one query string. Renaming the
 * catalogue's key was the alternative and it is worse: `values.id` is what the
 * POST body sends and what `commandFor` reads, and a query-string-only alias is
 * cheaper than two spellings of a field.
 */
const CONFIRM_ID_ARG = 'id_arg';

/** What a run reports back. No output is recorded; this is what the PAGE sees. */
export interface RunOutcome {
  /** `null` for a run that did not finish under observation. Never 0 for that. */
  exitCode: number | null;
  stdout: string;
  stderr: string;
  /** Present only when the run did not end by exiting — killed, or never started. */
  error?: string;
}

/**
 * The seam. Injected so the timeout and failure paths can be tested without a
 * real hanging process — a 60-second wait proves nothing extra about how a
 * killed run is RECORDED, which is the part that matters.
 */
export type CommandRunner = (
  file: string,
  args: string[],
  options: { cwd: string; timeout: number },
) => Promise<RunOutcome>;

const cap = (text: string): string =>
  text.length <= MAX_REPORTED_OUTPUT
    ? text
    : `${text.slice(0, MAX_REPORTED_OUTPUT)}\n… truncated at ${MAX_REPORTED_OUTPUT} characters.`;

/**
 * The real runner: `execFile` with an argv ARRAY, and no shell of any kind.
 *
 * The boundary is enforced by construction rather than by validating a string —
 * the same rule the markdown route took on 2026-08-26. There is no string
 * anywhere in this function that a command could be appended to, so quoting,
 * escaping and metacharacters are not problems that have to be got right; they
 * are problems that do not arise. `test/ui/execute-route.test.ts` reads this
 * file back and fails on the alternatives by name, because a shelled-out run
 * behaves identically for every command in the catalogue and differently for
 * the one that mattered.
 *
 * Never throws. Every ending — clean exit, non-zero exit, kill, a child that
 * could not be started — comes back as a `RunOutcome`, because a throw here
 * would surface as a 500 that reads "the server broke" for a command that ran
 * perfectly well and answered 1.
 */
export function execFileRunner(
  file: string,
  args: string[],
  options: { cwd: string; timeout: number },
): Promise<RunOutcome> {
  return new Promise<RunOutcome>((resolve) => {
    execFile(
      file,
      args,
      {
        cwd: options.cwd,
        timeout: options.timeout,
        maxBuffer: MAX_CHILD_OUTPUT,
        // No console window flashes up on win32 for a run the user started
        // from a browser. Cosmetic on other platforms, where it is ignored.
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const out = cap(String(stdout));
        const err = cap(String(stderr));
        if (error === null) {
          resolve({ exitCode: 0, stdout: out, stderr: err });
          return;
        }
        const failure = error as Error & { code?: number | string; killed?: boolean };
        // Checked BEFORE `killed`: an overflow also arrives killed, and
        // reporting "timed out" for a command that talked too much would send
        // a reader looking for a hang that never happened.
        if (failure.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
          resolve({
            exitCode: null,
            stdout: out,
            stderr: err,
            error: `the command produced more than ${MAX_CHILD_OUTPUT} bytes of output and was killed`,
          });
          return;
        }
        if (failure.killed === true) {
          resolve({
            exitCode: null,
            stdout: out,
            stderr: err,
            error: `the command timed out after ${options.timeout} ms and was killed`,
          });
          return;
        }
        if (typeof failure.code === 'number') {
          // An ordinary non-zero exit. Reported, never swallowed: a refusal is
          // a state to leave, and a UI that hid it would leave a person
          // believing a command they watched had done something.
          resolve({ exitCode: failure.code, stdout: out, stderr: err });
          return;
        }
        // The child never ran at all — a missing interpreter, an unreadable
        // cwd. `null` again, for the same reason: nothing exited.
        resolve({ exitCode: null, stdout: out, stderr: err, error: failure.message });
      },
    );
  });
}

/* -------------------------------------------------------------------------- *
 * The request shapes.
 * -------------------------------------------------------------------------- */

const BODY_KEYS = new Set(['id', 'values', 'nonce']);

interface ExecuteBody {
  id: string;
  values: Record<string, unknown>;
  nonce: string;
}

/**
 * The body, or a refusal. **An `argv` in the body is a 400 and it is named.**
 *
 * A client that sends one has misunderstood the contract — the client sends an
 * id, never a command (§3.1) — and the day the server starts ignoring it
 * quietly is the day someone starts relying on it having been applied. That is
 * the same reasoning `resolveCommand` uses for an undeclared VALUE key, applied
 * one level up, and it is why this refuses rather than picks the three keys it
 * knows out of whatever arrived.
 */
function readBody(raw: unknown): ExecuteBody {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new CommandRefusal(
      'the request body must be a JSON object carrying id, values and nonce',
    );
  }
  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (key === 'argv') {
      throw new CommandRefusal(
        'the body carries an argv. The client sends a catalogue id and its values; the '
        + 'server rebuilds the command. A body naming argv is refused rather than ignored, '
        + 'because an ignored field is one somebody comes to rely on.',
      );
    }
    if (!BODY_KEYS.has(key)) {
      throw new CommandRefusal(`the request body does not take "${key.slice(0, 60)}"`);
    }
  }
  if (typeof body['id'] !== 'string') throw new CommandRefusal('id must be a catalogue id');
  // A MISSING nonce is not a malformed body, it is an unauthorised request, and
  // the two deserve different answers: 400 says "fix what you sent", 403 says
  // "open the confirm". So an absent nonce becomes the empty string, which no
  // store ever minted and which therefore refuses at step 3 as a 403. A nonce
  // that is PRESENT and not a string is a shape error and stays a 400.
  const nonce = body['nonce'] ?? '';
  if (typeof nonce !== 'string') {
    throw new CommandRefusal('nonce must be the string the confirm minted');
  }
  // Absent `values` means "this command takes no arguments", which the eight
  // zero-argument entries need. A PRESENT one of the wrong shape is not
  // defaulted away — `resolveCommand` refuses it and says why.
  const values = body['values'] ?? {};
  return { id: body['id'], values: values as Record<string, unknown>, nonce };
}

/**
 * The declared fields of one catalogue entry, by name — the only thing the
 * confirm GET needs the catalogue for.
 *
 * An unknown id yields an empty map rather than a refusal: the id is refused a
 * moment later by `resolveCommand`, with the message the browser already knows
 * how to show, and refusing it twice in two different sentences is two things
 * to keep in step.
 */
function declaredFields(id: string): Map<string, { boolean?: boolean }> {
  const def = catalogueEntries().find((entry) => entry.name === id);
  if (def === undefined) return new Map();
  return new Map([...(def.args ?? []), ...(def.flags ?? [])].map((spec) => [spec.name, spec]));
}

/**
 * A query string, read as the `values` bag the POST body sends.
 *
 * **This is not a second way to compose a command.** It converts one transport
 * into the other's shape and then hands it to the SAME `resolveCommand`; the
 * argv is built in exactly one place either way.
 *
 * Two things it has to do that a body does not. A query string has no types, so
 * a field the catalogue declares as a switch is coerced from `'true'`/`'false'`
 * — and from nothing else: any other spelling is left as the string it was, so
 * `resolveCommand` refuses it by name instead of this function guessing. And a
 * query string may repeat a key, which is a caller disagreeing with itself;
 * picking one is picking FOR them, so a repeat is refused
 * (`INV-nothing-is-dropped-silently`).
 */
function valuesFromQuery(url: URL, id: string): Record<string, unknown> {
  const fields = declaredFields(id);
  // Null-prototype: the names come from a caller, and `values['__proto__'] = x`
  // on an ordinary object literal sets the prototype instead of a property.
  const values = Object.create(null) as Record<string, unknown>;
  const seen = new Set<string>();
  for (const [key, raw] of url.searchParams) {
    if (key === 'id') continue;
    const name = key === CONFIRM_ID_ARG ? 'id' : key;
    if (seen.has(name)) {
      throw new CommandRefusal(`${id}: "${name.slice(0, 60)}" was given more than once`);
    }
    seen.add(name);
    if (fields.get(name)?.boolean === true) {
      values[name] = raw === 'true' ? true : raw === 'false' ? false : raw;
      continue;
    }
    values[name] = raw;
  }
  return values;
}

/* -------------------------------------------------------------------------- *
 * The audit rows. One run is TWO of them.
 * -------------------------------------------------------------------------- */

/**
 * Append the second half of the pair: how the run actually ended.
 *
 * **This used to amend the row written before the run, and that had to go.**
 * The removed `finaliseExecutionRow` read the WHOLE audit log with
 * `readFileSync`, mutated one line in memory, and wrote the whole file back with
 * `writeFileSync`, for the tidiness of one row per run. The audit log is
 * append-only and unlocked — `core/jsonl-log.ts` · `appendJsonlLine` is a bare
 * `appendFileSync`, and every hook writes to it from its own process, with
 * `PreToolUse` firing on every file operation. A row appended by any of them
 * between that read and that write was destroyed outright: the rewrite truncated
 * the file to content that predates it. Measured rather than feared — a second
 * process appending across the rewrite lost between 1 and 21 rows per run.
 *
 * That is worse than losing our own row. It corrupts another writer's record, in
 * the log that IS the accountability story for a feature that runs commands
 * (spec §6.2). **Do not reintroduce the rewrite as a simplification**; the
 * absence of `readFileSync`/`writeFileSync` from this module is asserted by name
 * in `test/ui/execute-route.test.ts`.
 *
 * What was weighed against appending: a lock around the log, and the old
 * "one audit record per run" of spec §3.4. The lock is a new, cross-process
 * concurrency primitive in the hot path of every hook, added to spare readers a
 * join. §3.4 is AMENDED 2026-08-27 to two rows for exactly that reason, and this
 * project already had the shape ready — `pre-compact`/`post-compact` and
 * `subagent-start` are the same attempted/complete pair, for the same reason.
 *
 * **A failure here does NOT fail the run.** The command has already run;
 * reporting that as a failure would be a lie about something that happened, and
 * §3.4's ordering only ever governed the FIRST row. But it is disclosed rather
 * than swallowed, and the disclosure matters more than it used to: with the pair,
 * an `execute` row standing alone MEANS "a run that never returned", so a
 * silently missing completion row would not be a lost refinement — it would be
 * the log making a specific and false statement about this run.
 */
function recordCompletion(
  root: string,
  at: string,
  id: string,
  argv: string[],
  exitCode: number | null,
  durationMs: number,
): string | null {
  // The SAME `at` as the row before the run, deliberately: `at` plus
  // `command.id` is what joins the pair, and `recordAudit` takes an `at` for
  // exactly this case. Nothing is lost by sharing it — `durationMs` is measured
  // around the run, so the end of the run is `at` plus `durationMs`.
  const write = recordAudit(root, {
    at,
    kind: 'execution',
    op: 'execute-done',
    command: { id, argv, exitCode, durationMs },
  });
  if (write.written) return null;
  return (
    `the completion record for this run could not be written (${write.error}). The run itself `
    + `happened and its \`execute\` row stands, but nothing records how it ended — so the log `
    + `now shows an \`execute\` row with no \`execute-done\` beside it, which otherwise means a `
    + `run that never returned. It returned ${
      exitCode === null ? 'without exiting under observation' : `with exit code ${exitCode}`
    }. Fix the underlying error before relying on the log being complete.`
  );
}

/* -------------------------------------------------------------------------- *
 * The routes.
 * -------------------------------------------------------------------------- */

interface Binding {
  nonces: ExecutionNonceStore;
  cliEntry: string;
  run: CommandRunner;
}

/**
 * What the endpoint is currently wired to — NOT a nonce store.
 *
 * The store itself is created in `startUiServer` and closed over here, per
 * server, never module-global: `redeem` only ever consults the store a nonce
 * was minted in, so one server's store can never authorise a run another
 * server's store minted. That is the property, and `execute-route.test.ts`
 * measures it with two servers in one process.
 *
 * The indirection exists because the ROUTE TABLE is process-global — `routes.ts`
 * says so and refuses a duplicate registration outright — while
 * `startUiServer` is called many times in one test process. So the routes are
 * registered once and the binding is replaced, which makes the most recently
 * started server the one that owns the endpoint. An earlier server's
 * outstanding nonces then stop redeeming: a refusal, which is the safe
 * direction, and the same direction the nonce store's own eviction fails in.
 */
let binding: Binding | null = null;
let registered = false;

const refusal = (error: unknown): JsonResult => ({
  status: 400,
  body: { error: error instanceof Error ? error.message : String(error) },
});

/**
 * Wire the two routes to `nonces` and `cliEntry`.
 *
 * Called from `startUiServer` with a store that server owns. The runner is
 * injected and defaults to the real one, so a test can substitute a child
 * process that never was.
 */
export function registerExecuteRoutes(
  nonces: ExecutionNonceStore,
  cliEntry: string,
  run: CommandRunner = execFileRunner,
): void {
  binding = { nonces, cliEntry, run };
  if (registered) return;
  registered = true;

  registerRoute('GET', '/api/execute/confirm', { kind: 'json', handle: handleConfirm });
  registerRoute('POST', '/api/execute', { kind: 'json', handle: handleExecute });
}

/**
 * What the dialog must show: the resolved argv, which confirm this command
 * gets, a freshly minted nonce, and the residual.
 *
 * **The nonce is minted HERE and nowhere else, and that is the whole property.**
 * A page that never rendered a confirm cannot mint one, so an execution that
 * nobody was shown is impossible — §3.3 in one sentence. It does not make a
 * malicious local page impossible; §6.3 says out loud that nothing in this
 * design does.
 */
function handleConfirm(ctx: ApiContext): JsonResult {
  const active = binding;
  if (active === null) return { status: 500, body: { error: 'mycontext ui: execute is not wired' } };
  const id = ctx.url.searchParams.get('id') ?? '';
  try {
    const resolved = resolveCommand(id, valuesFromQuery(ctx.url, id));
    return {
      status: 200,
      body: {
        id: resolved.id,
        argv: resolved.argv,
        boundary: resolved.boundary,
        // Bound to the argv above, so the POST cannot spend it on anything else.
        nonce: active.nonces.mint(resolved.id, resolved.argv),
        residual: EXECUTION_RESIDUAL,
      },
    };
  } catch (error) {
    if (error instanceof CommandRefusal) return refusal(error);
    throw error;   // a bug, and the dispatch loop answers 500 for those
  }
}

/** The six steps, in the order the header states. Nothing here may be reordered. */
async function handleExecute(ctx: ApiContext): Promise<JsonResult> {
  const active = binding;
  if (active === null) return { status: 500, body: { error: 'mycontext ui: execute is not wired' } };
  const root = ctx.ws.projectRoot;
  if (root === null) return { status: 500, body: { error: 'mycontext ui: no workspace here' } };

  // 1 and 2. The shape, then the catalogue. Both are refusals a caller may be
  // shown, and both are 400: nothing about either is a server fault.
  let body: ExecuteBody;
  let resolved: { id: string; argv: string[]; boundary: boolean };
  try {
    body = readBody(ctx.body);
    resolved = resolveCommand(body.id, body.values);
  } catch (error) {
    if (error instanceof CommandRefusal) return refusal(error);
    throw error;
  }

  // 3. AFTER the resolve, against the argv the SERVER built. Redeeming first
  // would check the nonce against what the client said it wanted to run, which
  // is the one thing the binding exists not to trust.
  if (!active.nonces.redeem(body.nonce, resolved.id, resolved.argv)) {
    return {
      status: 403,
      body: {
        error:
          'this nonce does not authorise this command. An execution nonce is minted by the '
          + 'confirm that rendered a command, is bound to that exact command, and is spent by '
          + 'one attempt — right or wrong. Open the confirm again.',
      },
    };
  }

  // 4. The FIRST of the pair, before the run. `exitCode: null` because nothing
  // has exited yet; the `execute-done` row at step 6 carries the real code.
  const at = new Date().toISOString();
  const write = recordAudit(root, {
    at,
    kind: 'execution',
    op: 'execute',
    command: { id: resolved.id, argv: resolved.argv, exitCode: null, durationMs: 0 },
  });
  if (!write.written) {
    // Spec §3.4: a run that cannot be recorded does not happen. `recordAudit`
    // returns its failure rather than throwing — because for a MUTATION the
    // write has already happened and a throw would report a success as a
    // failure — so the check has to be here, and it has to be before the run.
    return {
      status: 500,
      body: {
        error:
          `mycontext ui: refusing to run ${resolved.id} — its audit record could not be `
          + `written (${write.error}). A run that cannot be recorded does not happen.`,
      },
    };
  }

  // 5. The run itself.
  const started = Date.now();
  const outcome = await active.run(
    process.execPath,
    [active.cliEntry, ...resolved.argv],
    // The repository root, never anything above it: spec §5 excludes anything
    // that reaches outside the workspace, and there is no argument shape in the
    // catalogue that names a path outside it either.
    { cwd: ctx.repoRoot, timeout: RUN_TIMEOUT_MS },
  );
  const durationMs = Date.now() - started;

  // 6. And what actually happened, as a SECOND row beside the one that reserved
  // it. Never an amendment of that row — `recordCompletion` has the whole
  // argument, and the rewrite it names must not come back.
  const auditNote = recordCompletion(
    root, at, resolved.id, resolved.argv, outcome.exitCode, durationMs,
  );

  return {
    status: 200,
    body: {
      id: resolved.id,
      argv: resolved.argv,
      exitCode: outcome.exitCode,
      durationMs,
      stdout: outcome.stdout,
      stderr: outcome.stderr,
      ...(outcome.error === undefined ? {} : { error: outcome.error }),
      ...(auditNote === null ? {} : { auditNote }),
    },
  };
}
