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
import { auditFailureNote, recordAudit } from '../core/audit.ts';
// `writeBudgets` and nothing else that touches disk: this module still binds
// no reader of `config.json` — `currentBudgets`/`diffBudgetsAgainstDisk` are
// what the budgets branch below calls to DERIVE a confirm, and only
// `writeBudgets` is ever called from the POST, after the nonce redeems. See
// `BUDGETS_ID` below for the whole route.
import {
  BudgetRefusal, diffBudgetsAgainstDisk, parseProposedBudgets, writeBudgets,
  type BudgetFieldDiff,
} from '../core/budgets-write.ts';
import type { Budgets } from '../core/config.ts';
import { CommandRefusal, catalogueEntries, resolveCommand } from './execute-catalogue.ts';
import { EffectRefusal, deriveEffect, type ItemEffect } from './execute-effect.ts';
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
 * The two languages the UI ships strings for — `src/ui/public/strings/{en,he}.js`.
 * Not derived from that directory: this is a compile-time union, and the test
 * that keeps it honest (`EXECUTION_RESIDUAL declares exactly the languages the
 * UI ships strings for`, `test/ui/execute-route.test.ts`) reads the directory
 * itself and fails if this union and that listing ever disagree.
 */
export type ExecutionLanguage = 'en' | 'he';

/**
 * The residual, in the words spec §6.3 chose (plan Task 5, Task 6, Task 8) —
 * ONE SENTENCE PER LANGUAGE as of Task 8b, and the reason it is a per-language
 * RECORD rather than a second, translated constant is worth stating plainly.
 *
 * The gate proves a request came from a browser on this machine. It never
 * proves a person asked. §6.3 requires that to be written where a reader MEETS
 * it — in the confirm dialog itself — and not only where a reader could look it
 * up, which is this project's own standard about an unstated limit being how a
 * partial claim gets read as a complete one. Before Task 8b that left the
 * sentence English in the Hebrew UI, because duplicating it into
 * `strings/he.js` was the obvious fix and the wrong one: a security sentence
 * with two spellings is a security sentence that gets reworded on one side
 * only, which is exactly what keeping it OUT of the string tables prevents.
 *
 * So the language travels to where the sentence already lives, not the other
 * way around — `CONFIRM_LANG_ARG` on the confirm GET, read by `residualFor`
 * below. `EXECUTION_RESIDUAL` stays spelled ONCE, here, now with one entry per
 * language instead of one entry: still served by the confirm rather than typed
 * into the page, still never reaching `strings/en.js` or `strings/he.js`.
 *
 * The Hebrew is a TRANSLATION, not a transcription — there is no mockup line to
 * copy, because §6.3 never reached the mockup. It keeps the English's three
 * independent claims, one sentence each (runs now / proves origin, not intent
 * / only run what you recognise), which is the shape the equality test below
 * checks: not byte equality, which no translation can have, but that neither
 * language quietly drops or merges a claim the other still makes.
 */
export const EXECUTION_RESIDUAL: Record<ExecutionLanguage, string> = {
  en:
    'This runs on your machine, now. The UI can tell it came from your browser — '
    + 'not that you asked. Only run what you recognise here.',
  he:
    'זה רץ על המחשב שלכם, עכשיו. הממשק יכול לדעת שהבקשה הגיעה מהדפדפן שלכם — '
    + 'לא שביקשתם את זה. הריצו רק את מה שאתם מזהים כאן.',
};

/**
 * The residual for the language the confirm was asked to answer in.
 *
 * An unknown or absent language answers in ENGLISH rather than throwing or
 * omitting the field: the confirm is a security surface, and it degrades to a
 * sentence the reader may not read, never to no sentence at all. A reader who
 * cannot read the warning still gets the button; a reader who never saw it
 * does not know there was one to miss.
 */
export function residualFor(lang: string | null): string {
  return lang !== null && Object.hasOwn(EXECUTION_RESIDUAL, lang)
    ? EXECUTION_RESIDUAL[lang as ExecutionLanguage]
    : EXECUTION_RESIDUAL.en;
}

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

/**
 * The query parameter that carries the reader's LANGUAGE, Task 8b.
 *
 * No catalogue entry declares an argument named `lang`, so this needed no
 * `CONFIRM_ID_ARG`-style rename to stay clear of a real one — but it still has
 * to be kept OUT of `values`, the same way `id` itself is: a caller reading the
 * catalogue's own fields would see `lang` arrive as an undeclared value and
 * refuse the confirm for a parameter that names no argument of the command at
 * all. `command-actions.js` mirrors this exact string, because a browser
 * module cannot import a `.ts` constant; the two are one decision, not two.
 */
const CONFIRM_LANG_ARG = 'lang';

/**
 * The reserved `id` a budgets confirm/write sends instead of a catalogue name.
 *
 * `DEC-the-ui-writes-budgets-and-the-simulator-always-meant-to`, task
 * `plan:budget seq:5`. **This is not a catalogue entry, and it must never
 * become one.** The task's own words: "no COMMAND edits a budget, and an agent
 * still cannot — a person can, here, behind a confirm." A catalogue id is
 * composed into an `argv` and can be scripted by anything that can name it; a
 * budget write is reachable ONLY through this exact id arriving at this exact
 * route, which is not the CLI's argument grammar and is not in
 * `palette-defs.js`.
 *
 * A colon is deliberate — no catalogue entry's `name` contains one (they are
 * the CLI's own verb/subcommand spellings, `pin`, `review promote-revision`),
 * so this id can never collide with a real command and `resolveCommand` is
 * never asked to resolve it. Kept here, beside `CONFIRM_LANG_ARG`, rather than
 * in `core/budgets-write.ts`: that module writes bytes and knows nothing about
 * routes; this is the one file that decides what an `id` on the wire MEANS.
 */
export const BUDGETS_ID = 'config:budgets';

/**
 * A query string, read as the plain `key=value` bag `parseProposedBudgets`
 * validates — the budgets branch's own `valuesFromQuery`.
 *
 * Deliberately NOT `valuesFromQuery` above: that function consults the
 * catalogue's `declaredFields(id)` for switch coercion, and `BUDGETS_ID` names
 * no catalogue entry — calling it would silently resolve to an empty field map
 * and treat every value as a bare string, which happens to be harmless today
 * but ties this branch's correctness to a catalogue lookup it has no business
 * making. `id` and `CONFIRM_LANG_ARG` are excluded for the same reason
 * `valuesFromQuery` excludes them: they name the request, not a budget.
 */
function budgetValuesFromQuery(url: URL): Record<string, unknown> {
  const values: Record<string, unknown> = Object.create(null);
  const seen = new Set<string>();
  for (const [key, raw] of url.searchParams) {
    if (key === 'id' || key === CONFIRM_LANG_ARG) continue;
    if (seen.has(key)) {
      throw new BudgetRefusal(`"${key.slice(0, 60)}" was given more than once`);
    }
    seen.add(key);
    values[key] = raw;
  }
  return values;
}

/**
 * The binding array a budgets nonce is minted and redeemed against — the
 * budgets branch's own `argv`.
 *
 * `ExecutionNonceStore.mint`/`redeem` bind on `sha256(JSON.stringify([id,
 * argv]))` and neither cares what `argv` MEANS, only that the confirm and the
 * write derive the identical array from the identical proposed values. Sorted
 * by field so that key ORDER in the request body can never change the
 * binding — `{pinned:1,jit:2}` and `{jit:2,pinned:1}` must authorise the same
 * write.
 */
function budgetBinding(diff: readonly BudgetFieldDiff[]): string[] {
  return diff.map((d) => `${d.field}=${d.after}`).sort();
}

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
    // `lang` names the READER, not an argument of the command — excluded the
    // same way `id` itself is, and for the same reason: a caller-supplied key
    // this function does not recognise as a rename becomes a VALUE, and a
    // command that never declared a `lang` argument would refuse the confirm
    // for one it was never asked to carry.
    if (key === 'id' || key === CONFIRM_LANG_ARG) continue;
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
 * What a confirm — either branch — would show, computed and NOTHING minted.
 *
 * `argv` means two different things depending on `id`: for a catalogue
 * command it is the real argv `execFile` will run; for `BUDGETS_ID` it is
 * `budgetBinding`'s array, which names no process and exists only so the same
 * nonce store can bind the same way on both branches (see `budgetBinding`).
 * Neither `handleConfirm` nor `handleExecute` cares which — they read `id` and
 * `argv` back out of whichever branch produced them and treat the pair
 * identically from there on, which is what keeps the mint/redeem call sites
 * singular (see each function's own header).
 */
interface ConfirmPlan {
  id: string;
  argv: string[];
  boundary: boolean;
  effect: ItemEffect[];
}

/**
 * Resolve `id` into a `ConfirmPlan` — throws `CommandRefusal`, `EffectRefusal`
 * or `BudgetRefusal` for anything that will not get a confirm at all (§3.2:
 * a command, or a write, whose effect cannot be shown does not get a weaker
 * confirm — it does not run).
 */
function planConfirm(ctx: ApiContext, active: Binding, id: string): ConfirmPlan {
  if (id === BUDGETS_ID) {
    const root = ctx.ws.projectRoot;
    if (root === null) throw new BudgetRefusal('mycontext ui: no workspace here');
    const proposed = parseProposedBudgets(budgetValuesFromQuery(ctx.url));
    const diff = diffBudgetsAgainstDisk(root, proposed);
    if (diff.length === 0) {
      throw new BudgetRefusal(
        'none of the proposed budget values differ from what config.json currently resolves '
        + 'to. Nothing to confirm.',
      );
    }
    return {
      id: BUDGETS_ID,
      argv: budgetBinding(diff),
      boundary: true,
      // The confirm's own field-by-field diff — real values, not a file-level
      // "(this file) → (is rewritten)". `execute-effect.ts`'s `elsewhereInCorpus`
      // can only name the FILE for a non-item write; a budget change is exactly
      // the case the task calls out by name, and it has the values on hand
      // because it read them to compute the diff, so it puts them in the same
      // `effect` shape every other boundary confirm already renders through.
      effect: [{
        id: 'config.json',
        kind: 'changed',
        fields: diff.map((d) => ({ field: d.field, before: [String(d.before)], after: [String(d.after)] })),
      }],
    };
  }

  const resolved = resolveCommand(id, valuesFromQuery(ctx.url, id));
  let effect: ItemEffect[] = [];
  if (resolved.boundary) {
    const root = ctx.ws.projectRoot;
    if (root === null) throw new CommandRefusal('mycontext ui: no workspace here');
    // `ctx.repoRoot` is the SAME value handed to `runCommand` below for the real
    // run, so the effect shown is the effect of the command as it will actually
    // be run — not of the same argv run somewhere else.
    effect = deriveEffect(root, ctx.repoRoot, active.cliEntry, resolved.argv);
  }
  return { id: resolved.id, argv: resolved.argv, boundary: resolved.boundary, effect };
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
 *
 * The budgets branch (`id === BUDGETS_ID`, `plan:budget seq:5`) is folded into
 * `planConfirm` rather than a second endpoint: `active.nonces.mint` is called
 * from exactly one place in this file, this line, whichever branch produced
 * the `id`/`argv` it is minted against.
 */
function handleConfirm(ctx: ApiContext): JsonResult {
  const active = binding;
  if (active === null) return { status: 500, body: { error: 'mycontext ui: execute is not wired' } };
  const id = ctx.url.searchParams.get('id') ?? '';
  try {
    // **The effect is derived BEFORE the nonce is minted**, so a confirm that
    // cannot be shown mints nothing. Minting first and then refusing would
    // leave a live nonce behind every refusal — spendable by anything that
    // could read the response — for a command the product just declined to
    // show. §3.2 says such a command does not run; a minted nonce is the one
    // artefact that could make that untrue.
    const plan = planConfirm(ctx, active, id);

    return {
      status: 200,
      body: {
        id: plan.id,
        // No CLI line for a budgets write — there is no command, and showing
        // `plan.argv` here (the nonce's binding array, `pinned=22000` and the
        // like) would draw a fake command line for the one write this product
        // deliberately keeps out of the CLI's reach.
        ...(plan.id === BUDGETS_ID ? {} : { argv: plan.argv }),
        boundary: plan.boundary,
        // Every item the command touches, each with the fields it changes.
        // Empty means "it was run against a copy and changed no item" — never
        // "we could not tell", which is an `EffectRefusal` and a 400 above.
        effect: plan.effect,
        // Bound to the argv above, so the POST cannot spend it on anything else.
        nonce: active.nonces.mint(plan.id, plan.argv),
        // The reader's own language, read off the query string the browser
        // built from its own `table.lang` — never guessed from `Accept-Language`
        // or any other header, because the confirm has to answer in the SAME
        // language the rest of the page it is rendered into is already in. An
        // unknown or missing one answers in English; see `residualFor`.
        residual: residualFor(ctx.url.searchParams.get(CONFIRM_LANG_ARG)),
      },
    };
  } catch (error) {
    if (error instanceof CommandRefusal) return refusal(error);
    // §3.2: a command whose effect cannot be shown does not get a weaker
    // confirm — it does not run. The reader is given the reason, which is the
    // CLI's own sentence when the dry run reached it.
    if (error instanceof EffectRefusal) return refusal(error);
    // The budgets branch's own refusal: an unknown key, a value that is not a
    // positive integer, an unreadable/unresolvable config.json, or a proposal
    // that changes nothing. Same treatment as the other two: a 400 the reader
    // may be shown verbatim, and no nonce is minted.
    if (error instanceof BudgetRefusal) return refusal(error);
    throw error;   // a bug, and the dispatch loop answers 500 for those
  }
}

/**
 * The six steps, in the order the header states, for a catalogue command —
 * unchanged. Nothing here may be reordered.
 *
 * The budgets branch (`id === BUDGETS_ID`) is a DIFFERENT shape after step 3,
 * and deliberately so: it writes one JSON key rather than starting a process,
 * so there is nothing that can "never return" and no `exitCode` to report.
 * What it keeps from the six steps is the part that IS the security story —
 * shape, then resolve, then redeem against server-derived values, never the
 * client's — and it is audited exactly once, AFTER the write succeeds, the
 * same order `mutate.ts`'s own writers use (`auditMutation` records once the
 * caller KNOWS the write happened, not before). There is no attempted/complete
 * pair here because there is no gap between "authorised" and "done" for a
 * synchronous file write to fall into.
 */
async function handleExecute(ctx: ApiContext): Promise<JsonResult> {
  const active = binding;
  if (active === null) return { status: 500, body: { error: 'mycontext ui: execute is not wired' } };
  const root = ctx.ws.projectRoot;
  if (root === null) return { status: 500, body: { error: 'mycontext ui: no workspace here' } };

  // 1 and 2. The shape, then either the catalogue or the budgets branch. Both
  // are refusals a caller may be shown, and both are 400: nothing about either
  // is a server fault.
  let body: ExecuteBody;
  let resolvedId: string;
  let argv: string[];
  let proposedBudgets: Partial<Budgets> | null = null;
  try {
    body = readBody(ctx.body);
    if (body.id === BUDGETS_ID) {
      proposedBudgets = parseProposedBudgets(body.values);
      const diff = diffBudgetsAgainstDisk(root, proposedBudgets);
      resolvedId = BUDGETS_ID;
      argv = budgetBinding(diff);
    } else {
      const resolved = resolveCommand(body.id, body.values);
      resolvedId = resolved.id;
      argv = resolved.argv;
    }
  } catch (error) {
    if (error instanceof CommandRefusal || error instanceof BudgetRefusal) return refusal(error);
    throw error;
  }

  // 3. AFTER the resolve, against the argv/binding the SERVER built. Redeeming
  // first would check the nonce against what the client said it wanted to run
  // (or write), which is the one thing the binding exists not to trust. If the
  // file moved between the confirm and this request such that the budgets
  // branch now derives a different binding array, this redeems false — the
  // same 403 a stale catalogue nonce gets, not a special case.
  if (!active.nonces.redeem(body.nonce, resolvedId, argv)) {
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

  if (resolvedId === BUDGETS_ID) {
    let diff: BudgetFieldDiff[];
    try {
      // `proposedBudgets` is never null on this branch: it is set in the same
      // `if (body.id === BUDGETS_ID)` above that put `BUDGETS_ID` into
      // `resolvedId`.
      diff = writeBudgets(root, proposedBudgets!);
    } catch (error) {
      return {
        status: 500,
        body: {
          error:
            `mycontext ui: the write nonce redeemed but config.json could not be written `
            + `(${error instanceof Error ? error.message : String(error)}). No budget was changed.`,
        },
      };
    }
    // **`writeBudgets` above is the whole of the write, and there is nothing
    // in memory left to keep in step with it.**
    //
    // A loop stood here that also assigned `ctx.ws.config.budgets[key] =
    // after`, because `resolveWorkspace()` ran once at server start and every
    // route held that same `Config` for the life of the process — so writing
    // only the FILE left `/api/simulate` drawing the old number until a
    // restart. It was correct, and it was correct for exactly ONE writer: the
    // mechanism it established was "every writer remembers", and the editor,
    // the terminal and `git checkout` do not. That is the defect `plan:live
    // seq:8` measured from the other side.
    //
    // `liveWorkspace` (core/workspace.ts) removed the snapshot instead. Every
    // request now gets a `Workspace` whose `config` was read from
    // `config.json` this request, so the next `/api/simulate` reads what
    // `writeBudgets` just wrote by the same route an out-of-band edit reaches
    // it — and `ctx.ws` here is a per-request value that dies with this
    // response, so a patch into it would now do nothing at all rather than
    // something invisible. Removed rather than kept: two mechanisms for one
    // fact is how the fact drifts.
    //
    // Audited like any other write (task `plan:budget seq:5`). `kind:
    // 'mutation'` because that is the closest of the seven existing kinds to
    // "a value changed" and adding an eighth was deliberately avoided — see
    // this task's report for why. No `itemId`: this is not an item, and
    // leaving the field absent (rather than naming `config.json`, which is not
    // an item id either) keeps every reader that joins `mutation` rows to real
    // items — `src/ui/ask-model.ts`'s `WHERE a.kind = 'mutation' AND
    // a.item_id IS NOT NULL` — correctly excluding this row rather than
    // joining it to nothing. `fields` and `note` carry the real values, which
    // is more than an ordinary item `update` row gets to say about itself.
    const write = recordAudit(root, {
      kind: 'mutation',
      op: 'update',
      origin: 'human',
      fields: diff.map((d) => d.field),
      note: diff.map((d) => `${d.field}: ${d.before} -> ${d.after}`).join('; '),
    });
    return {
      status: 200,
      body: {
        id: BUDGETS_ID,
        diff,
        ...(write.written ? {} : { auditNote: auditFailureNote(write) }),
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
    command: { id: resolvedId, argv, exitCode: null, durationMs: 0 },
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
          `mycontext ui: refusing to run ${resolvedId} — its audit record could not be `
          + `written (${write.error}). A run that cannot be recorded does not happen.`,
      },
    };
  }

  // 5. The run itself.
  const started = Date.now();
  const outcome = await active.run(
    process.execPath,
    [active.cliEntry, ...argv],
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
    root, at, resolvedId, argv, outcome.exitCode, durationMs,
  );

  return {
    status: 200,
    body: {
      id: resolvedId,
      argv,
      exitCode: outcome.exitCode,
      durationMs,
      stdout: outcome.stdout,
      stderr: outcome.stderr,
      ...(outcome.error === undefined ? {} : { error: outcome.error }),
      ...(auditNote === null ? {} : { auditNote }),
    },
  };
}
