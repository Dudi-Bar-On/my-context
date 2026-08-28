/**
 * The one writer behind `DEC-the-ui-writes-budgets-and-the-simulator-always-meant-to`:
 * `.my_context/config.json`'s `budgets` key, and NOTHING else in that file.
 *
 * Task `plan:budget seq:5`. The owner's ruling reversed
 * `DEC-should-the-web-ui-be-allowed-to-write-config-json` narrowly — "the UI
 * writes BUDGETS… budgets ONLY. Never `categories`, never `watchedDocs`, never
 * `profile`, never `ui`." This module is where that narrowness is ENFORCED
 * rather than merely intended: `writeBudgets` reads the raw JSON object off
 * disk, replaces exactly the `budgets` property on it, and writes the rest of
 * the object back byte-for-byte as parsed. There is no code path here that can
 * touch a sibling key, because no sibling key is ever read into a variable
 * this module can reassign.
 *
 * **Reachable only from the browser, behind a confirm — never from a CLI
 * command.** The task's own words: "no COMMAND edits a budget, and an agent
 * still cannot — a person can, here, behind a confirm." That is a property of
 * WHO CALLS this module, not of anything inside it, and it is kept by omission:
 * `src/cli/commands/` never imports it, and `src/ui/execute.ts` — the one
 * caller — reaches it only after a single-use nonce minted by the confirm GET
 * has been redeemed. See that module's docstring for the route.
 *
 * **A positive integer or a refusal — never a clamp.** The owner's standing
 * ruling: validation is against what is possible, and a refusal must say what
 * it refused. `0`, a negative number, a fraction and a non-numeric string are
 * all refused BY NAME; none of them is silently rounded, floored or dropped to
 * the default. `config.ts`'s own `requireBudgets` accepts `>= 0` for a whole
 * FILE a user hand-edits (a `0` there is a deliberate "give this tier nothing",
 * and the file is the user's to write however they choose); this is a NUMBER
 * TYPED INTO A FORM FIELD behind a confirm, and `>= 1` is the narrower, more
 * defensible bound for that surface — a UI control offering "0" invites a typo
 * that silently starves a tier, which is exactly the failure
 * `INV-nothing-is-dropped-silently` exists to end.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_BUDGETS, resolveConfig, type Budgets } from './config.ts';

/** A refusal a caller (the confirm GET or the write POST) may show verbatim. */
export class BudgetRefusal extends Error {}

/**
 * The four keys this module will ever read or write, in the order
 * `DEFAULT_BUDGETS` declares them — never a list respelled here, for
 * `config.ts`'s own reason: a fifth budget appears in this list the day it is
 * added to `Budgets`, and no second spelling of the tier names has to be found
 * and kept in step.
 */
export const BUDGET_KEY_NAMES = Object.keys(DEFAULT_BUDGETS) as (keyof Budgets)[];

/**
 * One caller-supplied value, made a positive integer or refused BY NAME.
 *
 * Accepts a `number` (the POST body, real JSON) or a digit-only `string` (the
 * confirm GET's query string, which has no types) — and nothing else. A
 * boolean, an array, an object, `NaN`, `Infinity`, a fraction, zero, a
 * negative number or a string carrying anything but digits is refused, naming
 * the key and what was sent.
 */
export function requirePositiveIntegerBudget(key: string, raw: unknown): number {
  const fail = (): never => {
    throw new BudgetRefusal(
      `budgets.${key} must be a positive integer (estimateTokens units — characters / 4). `
      + `Got ${JSON.stringify(raw)}. Nothing was changed.`,
    );
  };
  let n: number;
  if (typeof raw === 'number') {
    n = raw;
  } else if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
    n = Number(raw.trim());
  } else {
    return fail();
  }
  if (!Number.isInteger(n) || n <= 0) return fail();
  return n;
}

/**
 * The proposed values, one caller-supplied bag validated key by key.
 *
 * A key that is not one of `BUDGET_KEY_NAMES` is refused rather than dropped —
 * `INV-nothing-is-dropped-silently` applies to a screen's own request body as
 * much as to a file: a caller who thinks they set `budgets.pined` and had it
 * silently ignored is worse served than one who is told the key does not
 * exist.
 */
export function parseProposedBudgets(values: Record<string, unknown>): Partial<Budgets> {
  const out: Partial<Budgets> = {};
  for (const key of Object.keys(values)) {
    if (!(BUDGET_KEY_NAMES as string[]).includes(key)) {
      throw new BudgetRefusal(
        `"${key.slice(0, 60)}" is not a budget this screen writes. Expected one of: `
        + `${BUDGET_KEY_NAMES.join(', ')}.`,
      );
    }
    out[key as keyof Budgets] = requirePositiveIntegerBudget(key, values[key]);
  }
  return out;
}

/** One budget key that differs between what is in force and what was proposed. */
export interface BudgetFieldDiff {
  field: string;
  before: number;
  after: number;
}

/** Every proposed key that actually differs from `current`, in `BUDGET_KEY_NAMES` order. */
export function diffBudgets(current: Budgets, proposed: Partial<Budgets>): BudgetFieldDiff[] {
  const out: BudgetFieldDiff[] = [];
  for (const key of BUDGET_KEY_NAMES) {
    const after = proposed[key];
    if (after === undefined || after === current[key]) continue;
    out.push({ field: `budgets.${key}`, before: current[key], after });
  }
  return out;
}

/** `.my_context/config.json` under a corpus directory. */
function configFile(corpusDir: string): string {
  return path.join(corpusDir, 'config.json');
}

/**
 * The file's raw JSON object and its resolved `Budgets`, read FRESH off disk.
 *
 * Never `ctx.ws.config` — that is a snapshot taken once, when the UI server
 * started (`src/ui/server.ts` · `const ws = resolveWorkspace(options.cwd);`),
 * and the whole premise of a Configure-screen write is that the file is the
 * user's to edit while the server runs. This mirrors
 * `read-model-config.ts`'s `apiConfigGet` exactly: absent file resolves to
 * defaults, and a file that does not parse or does not resolve is a
 * `BudgetRefusal` naming the loader's own sentence rather than a crash — the
 * config the user is looking at right now is the config this module reads.
 */
export function currentBudgets(corpusDir: string): { raw: unknown; budgets: Budgets } {
  const file = configFile(corpusDir);
  let raw: unknown = {};
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      throw new BudgetRefusal(
        `${file} is not valid JSON, so a budget cannot be written through it: `
        + `${err instanceof Error ? err.message : String(err)}. Fix the file first.`,
      );
    }
  }
  try {
    return { raw, budgets: resolveConfig(raw).budgets };
  } catch (err) {
    throw new BudgetRefusal(
      `${file} does not resolve, so a budget cannot be written through it: `
      + `${err instanceof Error ? err.message : String(err)}. Fix the file first.`,
    );
  }
}

/**
 * What writing `proposed` would change — the diff, and nothing more. Never
 * touches disk. This is the confirm GET's whole job: derive what would be
 * shown, without minting anything and without writing anything.
 */
export function diffBudgetsAgainstDisk(
  corpusDir: string, proposed: Partial<Budgets>,
): BudgetFieldDiff[] {
  return diffBudgets(currentBudgets(corpusDir).budgets, proposed);
}

/**
 * Write `proposed` into `config.json`'s `budgets` key — BUDGETS ONLY.
 *
 * Reads fresh (see `currentBudgets`), so what is overwritten is the file as it
 * stands the moment this runs, not the state a confirm rendered up to two
 * minutes earlier. If the corpus moved in between such that the diff is now
 * empty, nothing is written and `[]` comes back — a no-op is not an error.
 *
 * **Every top-level key that is not `budgets` passes through UNTOUCHED.**
 * `next` is built by spreading the parsed raw object and then overwriting
 * exactly one property; `profile`, `categories`, `watchedDocs`, `ui` and
 * `handover` are never read into a name this function can reassign, so there
 * is no line here that could touch them even by a future edit's mistake — the
 * BUDGETS-ONLY property is structural, not a discipline to remember.
 */
export function writeBudgets(
  corpusDir: string, proposed: Partial<Budgets>,
): BudgetFieldDiff[] {
  const { raw, budgets } = currentBudgets(corpusDir);
  const diff = diffBudgets(budgets, proposed);
  if (diff.length === 0) return diff;

  const merged: Budgets = { ...budgets };
  for (const { field, after } of diff) {
    const key = field.slice('budgets.'.length) as keyof Budgets;
    merged[key] = after;
  }
  const base = (raw !== null && typeof raw === 'object' && !Array.isArray(raw))
    ? (raw as Record<string, unknown>)
    : {};
  const next = { ...base, budgets: merged };
  writeFileSync(configFile(corpusDir), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return diff;
}
