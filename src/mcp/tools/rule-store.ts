/**
 * **The rule store's two READ tools, moved out of the registry.**
 *
 * `TASK-26-tool-specs-keep-their-handlers-inline-where-one-already` names
 * `src/mcp/tools/ingest.ts` as the precedent nobody followed: one tool's schema
 * and logic in its own module, its spec entry left in `tools.ts`. This is that
 * shape, and these two are first because the boundary was already drawn twice.
 *
 * **By the code.** The six helpers below sat behind their own banner in
 * `tools.ts` — `THE RULE STORE, REACHABLE WITHOUT A TERMINAL` — and nothing
 * outside these two tools called any of them.
 *
 * **By the tests.** `test/mcp/rule-store-tools.test.ts` exercises
 * `list_rules` and `verify_rules` and no other tool; measured across all
 * fourteen files under `test/mcp/`, it is one of only three that name a tool
 * set this module could be cut around. (The other two became `focus.ts` and
 * `audit.ts`. `tools.test.ts` names all 28 and draws no boundary at all — so
 * the tests do NOT support splitting the remaining specs one per file, and this
 * lane did not invent one for them.)
 *
 * Every line below is the line that shipped, moved and de-indented, not
 * rewritten.
 */
import path from 'node:path';
import { RULES_DIR_ENV, resolveStoreDir, workspaceIsMyContext } from '../../rules/deliver.ts';
import { storeMeta, verifyManifest } from '../../rules/manifest.ts';
import type { Entry } from '../../rules/schema.ts';
import { entriesDir, loadRules } from '../../rules/store.ts';
import { resolveWorkspace } from '../../core/workspace.ts';
import { object, optStr, S_STRING, type Args } from './args.ts';

/* ─── THE RULE STORE, REACHABLE WITHOUT A TERMINAL (`mcpsurface/1`) ──────────
 *
 * There was no MCP path to the rule store at all — while `missedDoorLine`, a
 * sentence written FOR A MODEL, told it to run `mycontext rules list` and
 * `mycontext rules verify`. An agent whose Bash tool is denied could do
 * neither, so the product's own advice for "find out what you were given"
 * pointed at a door that surface does not have. Report 6 called it the largest
 * CLI-to-MCP gap in the product that nothing argues for, and `parity.ts` is
 * where the DELIBERATE absences are named — this was not among them.
 *
 * ── WHAT IS REUSED, AND WHY NONE OF IT IS REIMPLEMENTED ─────────────────────
 *
 * Every question below is answered by the function the CLI and the doors
 * already ask. `resolveStoreDir` in particular is `deliver.ts`'s, for the
 * reason `cli/commands/rules.ts` records after being caught by exactly this:
 * with `MYCONTEXT_RULES_DIR` set, resolving the store a second way would
 * describe a directory no door reads, with nothing saying so. A third
 * resolution here would be a third answer to *"which store is this"*.
 *
 * `workspaceIsMyContext` is `deliver.ts`'s export, not the CLI's private copy
 * of the same comparison — the tier decides whether developer-tier entries are
 * law, and two answers to that is the shape spec §3 exists to prevent.
 *
 * ── READ ONLY, DELIBERATELY, AND THE ABSENCE IS THE POINT ───────────────────
 *
 * `mycontext rules verify --restore` writes. `verify_rules` offers no such
 * argument and never will: `refuseUnknownArgs` refuses it by name, so a model
 * that reaches for it is told where the act lives instead of being quietly
 * ignored. The gap this item names is a READ an agent cannot perform; putting
 * a write beside the fix would be answering a different question.
 */

/** The store a DOOR would read right now — never resolved a second way. */
function ruleStoreDir(): string {
  return resolveStoreDir();
}

/** Whether developer-tier entries are law here. `false` without a workspace. */
function rulesReaderIsMyContext(cwd: string): boolean {
  const ws = resolveWorkspace(cwd);
  return ws.projectRoot ? workspaceIsMyContext(ws.projectRoot) : false;
}

/**
 * The line that says this answer is not about the installed package, or `''`.
 * Same argument as `substitutedStoreLine` and the CLI's `substitutionLines`: a
 * reader holding an answer about somewhere else needs telling, and a sentence
 * printed every time is a sentence nobody reads.
 */
function ruleStoreSubstitution(dir: string): string {
  return path.resolve(dir) === path.resolve(entriesDir()) ? ''
    : `NOT the installed package: \`${RULES_DIR_ENV}\` points at ${dir}, and that is the ` +
      'store every door reads too.\n';
}

/** `store version N, published YYYY-MM-DD`, or `''` for a store published before the field. */
function ruleStoreVersion(dir: string): string {
  const meta = storeMeta(dir);
  if (meta === null) return '';
  return `store version ${meta.version}` +
    `${meta.publishedAt === null ? '' : `, published ${meta.publishedAt}`}\n`;
}

function ruleCheckLine(entry: Entry): string {
  return entry.check.how === 'none' ? `none - ${entry.check.why}` : `${entry.check.how}:${entry.check.name}`;
}

/** One entry in full — the `rules show` answer, for a reader with no terminal. */
function renderRuleEntry(entry: Entry): string {
  const lines = [`${entry.id} · ${entry.kind} · ${entry.tier}`, entry.title, ''];
  for (const [name, value] of Object.entries(entry.parts)) {
    if (name === 'check' || name === 'example') continue;
    if (Array.isArray(value)) {
      lines.push(`${name}:`);
      for (const step of value) lines.push(`  - ${step}`);
      continue;
    }
    lines.push(`${name}: ${value}`);
  }
  lines.push(`example: ${entry.example}`, `check: ${ruleCheckLine(entry)}`);
  if (entry.body !== '') lines.push('', entry.body);
  // Spec §6, the owner's own words: "for documentation only and should not be
  // injected to the context". This tool is a documentation surface a model
  // asked for by name, which is the one place it belongs — the same line
  // `mycontext rules show` draws.
  if (entry.request !== undefined) {
    lines.push('', 'asked for as (verbatim, never injected):', entry.request);
  }
  return lines.join('\n');
}

export const LIST_RULES_SCHEMA: Record<string, unknown> = object({
  id: {
    ...S_STRING,
    description:
      'One entry id, to read that entry in full instead of listing them. Omit it to list ' +
      'every entry in force here.',
  },
});

export function runListRules(cwd: string, args: Args): string {
  const dir = ruleStoreDir();
  const isMyContext = rulesReaderIsMyContext(cwd);
  const { entries, refused } = loadRules(dir, isMyContext);
  const preamble = ruleStoreSubstitution(dir) + ruleStoreVersion(dir);
  // A blank line only when there IS a preamble — the answer must not open
  // on whitespace in the ordinary case.
  const head = preamble === '' ? '' : `${preamble}\n`;

  const id = optStr(args, 'id');
  if (id !== undefined) {
    const entry = entries.find((e) => e.id === id);
    if (entry === undefined) {
      throw new Error(
        `my_context: no rule entry "${id}" applies here. ` +
        `list_rules with no id names the ${entries.length} that do.`,
      );
    }
    return `${head}${renderRuleEntry(entry)}`;
  }

  // Two different truths that must not collapse into one sentence: the
  // store holds nothing, and the store holds nothing that applies HERE.
  // The second is the ordinary case outside my_context, and reading it as
  // the first looks exactly like a broken install.
  if (entries.length === 0 && refused.length === 0) {
    return head + (isMyContext
      ? 'my_context: the rule store is empty.'
      : 'my_context: no rule entry applies in this workspace. Developer-tier entries apply ' +
        'only inside my_context itself; product-tier entries apply everywhere, and there ' +
        'are none.');
  }

  const lines = [
    `my_context rules — ${entries.length} entry(s) in force here. ${isMyContext
      ? 'This workspace IS my_context, so developer-tier entries apply too.'
      : 'Developer-tier entries do not apply outside my_context and are not listed.'}`,
    '',
    ...entries.map((e) => `${e.id} · ${e.kind} · ${e.tier} · ${e.title}`),
  ];
  // A file that did not load is NAMED, never counted and dropped
  // (`INV-nothing-is-dropped-silently`), and — as on the CLI — naming it is
  // not the same as failing: `verify_rules` is the one that answers whether
  // the store is intact.
  if (refused.length > 0) {
    lines.push('', `could not be read (${refused.length}):`);
    for (const r of refused) lines.push(`  ${path.basename(r.path)}: ${r.error}`);
    lines.push(
      '',
      'This listed what it could read. verify_rules answers whether the store is intact.',
    );
  }
  return head + lines.join('\n');
}

export const VERIFY_RULES_SCHEMA: Record<string, unknown> = object({});

export function runVerifyRules(): string {
  const dir = ruleStoreDir();
  const answer = verifyManifest(dir);
  const head = ruleStoreSubstitution(dir);

  if (answer.ok) {
    return `${head}my_context: the rule store is intact — every entry matches the checksum ` +
      `that shipped with it.\n  ${dir}\n${ruleStoreVersion(dir)}`.trimEnd();
  }
  const lines = [
    `my_context: the rule store has been changed since it was installed — ` +
    `${answer.problems.length} problem(s). Writes to it are refused while that is true; ` +
    `reads still work, because a damaged install is one you can still recover from.`,
    '',
    ...answer.problems.map((p) => `  ${p.entry} — ${p.why}: ${p.detail}`),
    '',
    // The act that repairs it writes, and this surface does not. Naming the
    // command is the honest answer — not an apology for an absent argument.
    'Putting back what shipped is `mycontext rules verify --restore` in a terminal, or a ' +
    'reinstall of the package. Nothing on this surface writes to the store.',
  ];
  return head + lines.join('\n');
}
