/**
 * **How this product reaches a model at all** — `plan:loop seq:6`, design §5,
 * §5a, §11, §12, §13.
 *
 * ── THE GAP THIS FILE CLOSES, STATED AS IT WAS MEASURED ────────────────────
 *
 * `prompt.ts` is 250 lines of full model prompt, pinned for STRUCTURE by
 * `test/review/prompt.test.ts`, and on 2026-09-13 `grep -rn "from
 * '.*review/prompt.ts'"` over `src`, `test`, `e2e`, `scripts` and `hooks`
 * returned ONE line — the test. Nothing in the product imported it. The design
 * calls its caller "the fork" (§5) and specifies exactly one thing about it,
 * `spawn(..., { detached: true, stdio: 'ignore' }).unref()`; §5a then argues
 * that fork is a CACHE-PARITY fork of an agent session. **No section of the
 * design and no step of any plan ever names the mechanism** — no binary, no
 * argv, no channel. The caller was implied and never specified, which is why
 * the prompt shipped unreachable rather than wired badly.
 *
 * ── THE MECHANISM, AND THE ARGUMENT AGAINST ZERO DEPENDENCIES ──────────────
 *
 * `CONST-zero-runtime-dependencies` is `hard`, and `package.json` carries no
 * `dependencies` key at all. Four ways to reach a model were considered:
 *
 *  - **`node:https` by hand.** Refused. It needs an API key this product has
 *    never held and must never hold; §12's second anti-learning rule exists
 *    because a credential shape in a file is itself the defect. And §0 records
 *    that the upstream failure this design descends from surfaced on
 *    SUBSCRIPTION OAuth credentials as a billing-shaped HTTP 400 — precisely
 *    what a hand-rolled client re-invites.
 *  - **The MCP surface.** Refused as inverted. MCP makes this product a tool
 *    PROVIDER to an agent. It is not a way for this product to call a model.
 *  - **A prompt written to disk for a person or an agent to carry.** Refused
 *    as the thing that looks like calling a model and does not.
 *  - **A subagent dispatched by the agent running the pass.** UNAVAILABLE BY
 *    CONSTRUCTION, and worth recording because it is the obvious answer: §5
 *    requires the pass to be a DETACHED child of a hook with `stdio: 'ignore'`
 *    — `Stop` is where a person is staring at a prompt — so there is no agent
 *    in that process to dispatch anything.
 *
 * What is left is the one §5 had already chosen without saying so: **spawn the
 * harness's own CLI, headless, and read its stdout.** `node:child_process` is
 * a builtin, so nothing enters `dependencies`. The CLI is not a package this
 * product depends on; it is the ambient program that INVOKED the hook in the
 * first place, so its presence is the precondition for the pass existing
 * rather than an assumption the pass adds. It carries the user's own
 * credentials, so this product still holds none. And §11's `"model": "haiku"`
 * was always describing this: a model NAME is a CLI flag, not an SDK object.
 *
 * **Measured 2026-09-13 on this machine.** `claude` resolves to a PE
 * executable at `~/.local/bin/claude.exe`; `printf '…' | claude --print
 * --model haiku --output-format text` exited 0 and printed the answer. The
 * probe is in the report for `plan:loop seq:6`, and `agentCliProbe` below is
 * the same call in this module's own words.
 *
 * ── WHERE THIS DIVERGES FROM §5a, AND WHY THAT IS NOT A NARROWED SCHEMA ────
 *
 * §5a forbids narrowing `tools[]`. The call below advertises none, and the
 * divergence is argued rather than taken: §5a gives two reasons and both are
 * about a fork that RESUMES the session — cache parity, which §5a itself says
 * whole-file input has already forfeited (*"a pass that reads a 61 MB file is
 * not a cache-parity fork… that is accepted deliberately"*), and starvation,
 * which happened because upstream's fork had to READ files to be useful and
 * was denied. This call is handed its evidence inline. It has nothing to read,
 * and §13's boundary says it may do nothing but propose. **The write boundary
 * is still not the tool schema**: `createItem` with `origin: 'review'` refuses
 * every non-draft, every edit and every supersede, exactly as before.
 *
 * ── AND THE ONE GUARANTEE THIS FILE ENFORCES RATHER THAN REQUESTS ──────────
 *
 * **A prompt that reaches a model with its rules dropped is worse than no
 * prompt.** So `rulesMissing` is checked on the text about to be sent, and a
 * call whose prompt has lost any of the five anti-learning rules is REFUSED,
 * naming the rule. That is the difference between a prompt that carries the
 * rules and a pipeline that is known to deliver them: the second is a gate
 * that can fail, which is §4's whole argument applied to §4's own machinery.
 */
import { spawn } from 'node:child_process';
import { MODEL_NAME_GRAMMAR } from '../core/config.ts';

/**
 * The program spawned, with no extension and no shell.
 *
 * **No `shell: true`, ever.** A shell would make the model name and every
 * future argument a command-injection surface, and `src/ui/open.ts` already
 * records what shape-inspection of an untrusted string costs this project. On
 * Windows `CreateProcess` appends `.exe` to an extension-less name, which is
 * what makes the bare spelling resolve to the `claude.exe` measured on PATH;
 * on POSIX it is the plain executable. Nothing here is written to a `.cmd` or
 * a shell builtin, so the one case Node's own docs warn about does not arise.
 */
export const AGENT_CLI = 'claude';

/**
 * How long one call may take before the child is killed and the pass reports
 * a timeout.
 *
 * The pass is already detached from `Stop` (`pass.ts`), so this bounds nothing
 * a person is waiting on. What it bounds is a detached process living forever
 * on a machine nobody is watching — which is the failure mode a background
 * subsystem actually has.
 */
export const MODEL_TIMEOUT_MS = 180_000;

/**
 * How much output is kept. A model that ignores the output contract and writes
 * an essay must not be able to fill a disk through a process with no console.
 */
export const MAX_REPLY_BYTES = 1_000_000;

/** The argv for one headless call. Exported so a test can read it without spawning. */
export function cliInvocation(model: string): { command: string; args: string[] } {
  return {
    command: AGENT_CLI,
    args: [
      // `--print` is the non-interactive form. The prompt goes on STDIN and
      // never in argv: it carries transcript excerpts and runs to tens of
      // kilobytes, Windows caps a command line near 32K, and `src/ui/open.ts`
      // records that on Windows a command line is readable by every local
      // account for the lifetime of the spawn. Neither is a reason to truncate
      // the prompt; both are reasons not to put it in argv.
      '--print',
      '--model', model,
      '--output-format', 'text',
    ],
  };
}

/**
 * `true` when this name may be handed to a process.
 *
 * **The grammar is `core/config.ts`'s**, imported rather than restated, so the
 * name a config accepts and the name a spawn accepts cannot drift apart. It
 * lives there because that is where it is enforced and because a validator
 * importing this module would pull `node:child_process` into the import graph
 * of every surface that reads a config.
 */
export function isUsableModelName(name: string): boolean {
  return MODEL_NAME_GRAMMAR.test(name);
}

/**
 * **The five anti-learning rules, keyed on their CONTENT and not on the
 * constant that happens to hold them today.**
 *
 * Design §12 calls the list a scar record and says the fifth was added
 * upstream LATER, as a separate fix. A pipeline that delivered four of five
 * would look exactly like one that delivered five, and the rule it dropped
 * would be the one a future session most needs. So these are the words, and
 * `rulesMissing` runs over the text about to leave this process — not over
 * `ANTI_LEARNING`, which would prove only that a constant equals itself.
 */
export const ANTI_LEARNING_MARKERS: { rule: string; probe: RegExp }[] = [
  { rule: '1 — missing binaries', probe: /missing binaries/i },
  { rule: '2 — unset credentials', probe: /unset credentials/i },
  { rule: '3 — transient failures that resolved', probe: /transient failures that resolved/i },
  { rule: '4 — one-off task narratives', probe: /one-off task narratives/i },
  {
    rule: '5 — unresolved failures written up as if they worked',
    probe: /unresolved failures written up as if they worked/i,
  },
];

/**
 * The rules this text does NOT carry, by name. `[]` is the only value that
 * lets a call proceed.
 */
export function rulesMissing(prompt: string): string[] {
  return ANTI_LEARNING_MARKERS.filter(({ probe }) => !probe.test(prompt)).map(({ rule }) => rule);
}

/** What one call did, including every way it can fail to reach a model. */
export type ModelOutcome =
  | { ok: true; text: string; ms: number; command: string; promptBytes: number }
  | { ok: false; why: string; ms: number; command: string; promptBytes: number };

export interface ModelCallOptions {
  model: string;
  /** Where the child runs. The project root, so its own config resolves. */
  cwd: string;
  timeoutMs: number;
}

/**
 * One call. Injected everywhere it is used, so the pass is testable on a
 * machine with no CLI and no network — and so a test can read the exact bytes
 * that would have been sent.
 */
export type ModelCall = (prompt: string, options: ModelCallOptions) => Promise<ModelOutcome>;

/**
 * Spawn the CLI, write the prompt to its stdin, read its stdout.
 *
 * **Every failure is named and none is silent** (`INV-nothing-is-dropped-
 * silently`). A missing binary, a non-zero exit, a timeout and an empty answer
 * are four different facts with four different remedies, and a pass that
 * reported "no proposals" for any of them would be telling the reader the
 * session taught nothing when what happened is that nothing was asked.
 *
 * **`program` is a parameter for one reason and it is not convenience.** The
 * missing-binary path is the one this module cannot afford to get wrong: a
 * `ChildProcess` whose exec failed emits `'error'` on a later tick and an
 * `EventEmitter` with no listener rethrows it as an uncaught exception, which
 * in a detached child with no console is the difference between a report
 * saying "no CLI on this machine" and no report at all. `src/ui/open.ts`
 * measured that on Node v24.14.0 and also measured the mistake to avoid — a
 * fake that THREW would prove a control flow `child_process` never takes. So
 * the test names a binary that genuinely is not there, and needs a way to say
 * which.
 */
export function agentCliCall(program: string = AGENT_CLI): ModelCall {
  return (prompt, options) => callVia(program, prompt, options);
}

/** The production transport: `AGENT_CLI`, spawned. */
export const callAgentCli: ModelCall = agentCliCall();

const callVia = (program: string, prompt: string, options: ModelCallOptions): Promise<ModelOutcome> => {
  const { args } = cliInvocation(options.model);
  const command = program;
  const printable = `${command} ${args.join(' ')}`;
  const promptBytes = Buffer.byteLength(prompt, 'utf8');
  const started = Date.now();

  const missing = rulesMissing(prompt);
  if (missing.length > 0) {
    // Refused BEFORE the spawn — see the header. This is the guarantee the
    // module exists to make, so it is checked at the last moment before the
    // bytes leave the process rather than at the moment they were composed.
    return Promise.resolve({
      ok: false as const, ms: 0, command: printable, promptBytes,
      why:
        `refused before sending: the prompt is missing anti-learning rule(s) ` +
        `${missing.join(', ')}. A prompt that reaches a model with its rules dropped is ` +
        `worse than no prompt.`,
    });
  }
  if (!isUsableModelName(options.model)) {
    return Promise.resolve({
      ok: false as const, ms: 0, command: printable, promptBytes,
      why:
        `refused before sending: "${options.model}" is not a usable model name. A name ` +
        `beginning with "-" is an OPTION to the program being spawned.`,
    });
  }

  return new Promise<ModelOutcome>((resolve) => {
    let settled = false;
    const done = (outcome: ModelOutcome): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(outcome);
    };

    let child;
    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        // Never a shell. See AGENT_CLI.
        shell: false,
        windowsHide: true,
      });
    } catch (err) {
      return resolve({
        ok: false, ms: Date.now() - started, command: printable, promptBytes,
        why: `the model CLI could not be started: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* already gone */ }
      done({
        ok: false, ms: Date.now() - started, command: printable, promptBytes,
        why: `the model CLI did not answer within ${options.timeoutMs} ms and was killed`,
      });
    }, options.timeoutMs);
    // A timer in a detached child must not be the thing that keeps it alive.
    if (typeof timer.unref === 'function') timer.unref();

    const out: Buffer[] = [];
    let outBytes = 0;
    const err: Buffer[] = [];
    child.stdout?.on('data', (chunk: Buffer) => {
      if (outBytes >= MAX_REPLY_BYTES) return;
      outBytes += chunk.length;
      out.push(chunk);
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      if (err.length < 32) err.push(chunk);
    });

    // `spawn` does NOT throw when the program is missing — `src/ui/open.ts`
    // measured that on Node v24.14.0, and an EventEmitter with no 'error'
    // listener rethrows as an uncaught exception. In a detached child that is
    // the difference between a report saying "no CLI on this machine" and no
    // report at all.
    child.on('error', (e: Error) => {
      done({
        ok: false, ms: Date.now() - started, command: printable, promptBytes,
        why: `the model CLI could not be started: ${e.message}`,
      });
    });

    child.on('close', (code: number | null) => {
      const text = Buffer.concat(out).toString('utf8');
      if (code !== 0) {
        const tail = Buffer.concat(err).toString('utf8').replace(/\s+/g, ' ').trim().slice(0, 300);
        return done({
          ok: false, ms: Date.now() - started, command: printable, promptBytes,
          why: `the model CLI exited ${code ?? 'on a signal'}${tail === '' ? '' : `: ${tail}`}`,
        });
      }
      if (text.trim() === '') {
        return done({
          ok: false, ms: Date.now() - started, command: printable, promptBytes,
          why: 'the model CLI exited 0 and printed nothing, so no answer was received',
        });
      }
      done({ ok: true, text, ms: Date.now() - started, command: printable, promptBytes });
    });

    child.stdin?.on('error', () => { /* the close handler owns the verdict */ });
    child.stdin?.end(prompt, 'utf8');
  });
};

/**
 * One proposal as a model returned it. **Every field is untrusted** — design
 * §8 says so of the decline ledger for the same reason it holds here: this is
 * text a model wrote after reading a transcript, and a transcript is a
 * poisoning surface (arXiv:2608.21230).
 */
export interface ModelCandidate {
  artifact: 'check' | 'rule' | 'lesson';
  /** What it is about. The relevance gate is checked against the evidence. */
  target: string;
  title: string;
  summary: string;
  brief: string;
  evidence: { source: string; recordIndex: number }[];
}

/** Bounds on what a reply may contain, so one bad answer cannot flood a queue. */
export const MAX_CANDIDATES = 20;
const MAX_TITLE = 300;
const MAX_SUMMARY = 1000;
const MAX_BRIEF = 4000;
const MAX_TARGET = 200;

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const flat = value.replace(/\s+/g, ' ').trim();
  if (flat === '' || flat.length > max) return null;
  return flat;
}

export interface ParsedReply {
  candidates: ModelCandidate[];
  /** Elements that were not usable, with a reason each. Counted, never dropped silently. */
  rejected: string[];
  /** Set when the reply as a whole could not be read as the contract asks. */
  unparseable: string | null;
}

/**
 * Read the reply.
 *
 * **The contract asks for a bare JSON array and this reads one out of prose
 * anyway**, because a model that prefixes "Here is what I found:" has still
 * answered and discarding it would make the pipeline's reliability a function
 * of one sentence. What it does NOT do is guess: the first balanced
 * bracket-delimited run is parsed, and anything that is not an array of
 * objects with the required fields is rejected BY NAME.
 */
export function parseReply(raw: string): ParsedReply {
  const slice = firstArray(raw);
  if (slice === null) {
    return {
      candidates: [], rejected: [],
      unparseable: 'the reply contained no JSON array, so the output contract was not followed',
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(slice);
  } catch (e) {
    return {
      candidates: [], rejected: [],
      unparseable: `the reply's JSON array did not parse: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  if (!Array.isArray(parsed)) {
    return { candidates: [], rejected: [], unparseable: 'the reply parsed to something that is not an array' };
  }

  const candidates: ModelCandidate[] = [];
  const rejected: string[] = [];
  for (const [index, row] of parsed.entries()) {
    if (candidates.length >= MAX_CANDIDATES) {
      rejected.push(`element ${index}: beyond the ${MAX_CANDIDATES}-proposal bound on one reply`);
      continue;
    }
    if (row === null || typeof row !== 'object' || Array.isArray(row)) {
      rejected.push(`element ${index}: not an object`);
      continue;
    }
    const r = row as Record<string, unknown>;
    const artifact = r.artifact;
    if (artifact !== 'check' && artifact !== 'rule' && artifact !== 'lesson') {
      rejected.push(`element ${index}: artifact is not check, rule or lesson`);
      continue;
    }
    const target = text(r.target, MAX_TARGET);
    if (target === null) {
      // §5c: a proposal that names no target cannot be checked against its own
      // evidence, and the gate that refuses it is the whole reason upstream
      // issue #66350 could happen without one.
      rejected.push(`element ${index}: names no target, so nothing narrows where it applies`);
      continue;
    }
    const title = text(r.title, MAX_TITLE);
    const summary = text(r.summary, MAX_SUMMARY);
    const brief = text(r.brief, MAX_BRIEF);
    if (title === null || summary === null || brief === null) {
      rejected.push(`element ${index}: title, summary or brief is missing, empty or over length`);
      continue;
    }
    const evidence: { source: string; recordIndex: number }[] = [];
    if (Array.isArray(r.evidence)) {
      for (const e of r.evidence) {
        if (e === null || typeof e !== 'object' || Array.isArray(e)) continue;
        const row2 = e as Record<string, unknown>;
        const source = text(row2.source, 400);
        const at = row2.recordIndex;
        if (source === null || typeof at !== 'number' || !Number.isInteger(at) || at < 0) continue;
        evidence.push({ source, recordIndex: at });
      }
    }
    if (evidence.length === 0) {
      rejected.push(`element ${index}: cites no evidence, and §5c refuses a proposal that names none`);
      continue;
    }
    candidates.push({ artifact, target, title, summary, brief, evidence });
  }
  return { candidates, rejected, unparseable: null };
}

/** The first balanced `[ … ]` run in the text, or `null`. Strings and escapes respected. */
function firstArray(raw: string): string | null {
  const start = raw.indexOf('[');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * A one-line liveness probe, for a person asking "can this machine reach a
 * model at all" without spending a pass.
 *
 * It sends a prompt carrying the five rules — because `callAgentCli` refuses
 * one that does not, and a probe that bypassed the gate would be probing a
 * path the product never takes.
 */
export async function agentCliProbe(
  model: string, cwd: string, call: ModelCall = callAgentCli,
): Promise<ModelOutcome> {
  const rules = ANTI_LEARNING_MARKERS.map(({ rule, probe }) =>
    `${rule}: ${probe.source.replace(/\\/g, '')}`).join('\n');
  return call(
    `${rules}\n\nIgnore everything above. Reply with exactly the JSON array [] and nothing else.`,
    { model, cwd, timeoutMs: MODEL_TIMEOUT_MS },
  );
}
