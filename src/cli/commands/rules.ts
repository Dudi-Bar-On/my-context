import path from 'node:path';
import { SUBCOMMAND_FLAGS } from '../../core/command-flags.ts';
import type { Workspace } from '../../core/workspace.ts';
import {
  restoreEntries, verifyManifest, type Problem, type RestoreReport,
} from '../../rules/manifest.ts';
import { entriesDir, loadRules, packageRoot } from '../../rules/store.ts';
import type { Entry } from '../../rules/schema.ts';
import { emitJson, paragraph, refuseUnknownFlag, table, wantsJson } from './format.ts';
import { hasFlag, positionals, registerCommand, type Emit } from './registry.ts';

/**
 * `mycontext rules` — the product rule store, from the terminal.
 *
 * D41 spec §13, `plan:store seq:1` Task 5. **Developer-facing, and it reads a
 * store that is not the user's corpus.** Everything this command prints comes
 * out of `src/rules/entries/` inside the installed package; nothing it does
 * touches `.my_context/`, and `test/rules/isolation.test.ts` holds that in
 * both directions.
 *
 * ── WHY IT TAKES NO `--yes` ────────────────────────────────────────────────
 *
 * `--yes` is this project's approval boundary: the gate on an act that changes
 * what governs the project (see `test/helpers/approval-boundary.ts`, and the
 * §7 table both READMEs derive from it). None of these three subcommands is
 * such an act. `list` and `show` read. `verify --restore` puts back the bytes
 * the package shipped and can produce no other content — it is the one write
 * in this CLI whose output is fully determined by the installation, so there
 * is nothing for a person to approve that they have not already approved by
 * installing. Publishing an entry, which IS such an act, is the maintenance
 * tool's (spec §11) and does not ship.
 */

export const SUBCOMMANDS = ['verify', 'list', 'show'] as const;

const USAGE = `usage: mycontext rules verify [--restore] [--json]
       mycontext rules list [--json]
       mycontext rules show <id> [--json]`;

const RULES_FLAGS = SUBCOMMAND_FLAGS['rules'];

/**
 * Whether the workspace being worked on IS my_context (spec §3).
 *
 * Compared by PATH against the package this file ships in, rather than by
 * looking for a marker in the workspace: a marker is something a stranger's
 * project can acquire by copying a file, and the question this answers decides
 * whether rules about how THIS repository works are in force.
 */
function workspaceIsMyContext(ws: Workspace): boolean {
  if (ws.projectRoot === null || ws.projectRoot === undefined) return false;
  // `projectRoot` is the CORPUS directory (`<repo>/.my_context`), not the
  // repository — measured, after this compared the two directly and answered
  // "no" from inside my_context itself, which would have shipped the developer
  // tier to nobody at all and looked exactly like the filter working.
  return path.resolve(ws.projectRoot, '..') === packageRoot();
}

function partLines(entry: Entry): string[] {
  const lines: string[] = [];
  for (const [name, value] of Object.entries(entry.parts)) {
    if (name === 'check' || name === 'example') continue;
    if (Array.isArray(value)) {
      lines.push(`  ${name}:`);
      for (const step of value) lines.push(`    - ${step}`);
      continue;
    }
    for (const line of paragraph(`${name}: ${value}`, '  ')) lines.push(line);
  }
  return lines;
}

function checkLine(entry: Entry): string {
  return entry.check.how === 'none'
    ? `none - ${entry.check.why}`
    : `${entry.check.how}:${entry.check.name}`;
}

function cmdRulesList(ws: Workspace, args: string[], out: Emit): number {
  const { entries, refused } = loadRules(entriesDir(), workspaceIsMyContext(ws));

  if (wantsJson(args)) {
    emitJson(out, {
      store: entriesDir(),
      workspaceIsMyContext: workspaceIsMyContext(ws),
      entries: entries.map((e) => ({
        id: e.id, kind: e.kind, tier: e.tier, title: e.title, check: checkLine(e),
      })),
      refused: refused.map((r) => ({ path: r.path, error: r.error })),
    });
    return refused.length > 0 ? 1 : 0;
  }

  if (entries.length === 0 && refused.length === 0) {
    // Two different truths would otherwise collapse into one sentence: the
    // store holds nothing, and the store holds nothing that applies HERE. The
    // second is the ordinary case outside my_context, and reading it as the
    // first would look like a broken install.
    out(workspaceIsMyContext(ws)
      ? 'my_context: the rule store is empty.'
      : 'my_context: no rule entry applies in this workspace. Developer-tier entries apply only '
        + 'inside my_context itself; product-tier entries apply everywhere, and there are none.');
    return 0;
  }
  if (entries.length > 0) {
    for (const line of paragraph(
      `my_context rules — ${entries.length} entry(s) in force here. ` +
      `${workspaceIsMyContext(ws)
        ? 'This workspace IS my_context, so developer-tier entries apply too.'
        : 'Developer-tier entries do not apply outside my_context and are not listed.'}`,
    )) out(line);
    out('');
    for (const line of table(
      ['id', 'kind', 'tier', 'title'],
      entries.map((e) => [e.id, e.kind, e.tier, e.title]),
      { indent: '  ' },
    )) out(line);
  }
  // A file that did not load is NAMED, never counted and dropped
  // (`INV-nothing-is-dropped-silently`).
  if (refused.length > 0) {
    out('');
    out(`could not be read (${refused.length}):`);
    for (const r of refused) for (const line of paragraph(`${path.basename(r.path)}: ${r.error}`, '  ')) out(line);
    return 1;
  }
  return 0;
}

function cmdRulesShow(ws: Workspace, args: string[], out: Emit): number {
  const id = positionals(args, [])[1];
  if (id === undefined) {
    out(`my_context: \`rules show\` needs an entry id.\n\n${USAGE}`);
    return 1;
  }
  const { entries } = loadRules(entriesDir(), workspaceIsMyContext(ws));
  const entry = entries.find((e) => e.id === id);
  if (entry === undefined) {
    out(
      `my_context: no rule entry "${id}" applies here. ` +
      `\`mycontext rules list\` names the ${entries.length} that do.`,
    );
    return 1;
  }

  if (wantsJson(args)) {
    emitJson(out, {
      id: entry.id, kind: entry.kind, tier: entry.tier, title: entry.title,
      parts: entry.parts, example: entry.example, check: entry.check,
      trigger: entry.trigger ?? null, request: entry.request ?? null,
      body: entry.body, sourcePath: entry.sourcePath,
    });
    return 0;
  }

  out(`${entry.id} · ${entry.kind} · ${entry.tier}`);
  for (const line of paragraph(entry.title)) out(line);
  out('');
  for (const line of partLines(entry)) out(line);
  for (const line of paragraph(`example: ${entry.example}`, '  ')) out(line);
  for (const line of paragraph(`check: ${checkLine(entry)}`, '  ')) out(line);
  if (entry.body !== '') {
    out('');
    for (const line of paragraph(entry.body)) out(line);
  }
  // Spec §6: the owner's own words, verbatim, "for documentation only and
  // should not be injected to the context". This command IS the documentation
  // surface, which is the one place it belongs.
  if (entry.request !== undefined) {
    out('');
    out('asked for as (verbatim, never injected):');
    for (const line of paragraph(entry.request, '  ')) out(line);
  }
  return 0;
}

function restoreLines(report: RestoreReport, from: string, to: string): string[] {
  const lines: string[] = [];
  if (path.resolve(from) === path.resolve(to)) {
    /**
     * **The honest answer, and it is a finding rather than a feature.**
     *
     * Spec §13 says a restore comes "from the installed package first" — but
     * in this phase the store being verified IS the installed package's own
     * directory, so there is no pristine copy on this machine to copy from.
     * `restoreEntries` is real and does the work; what is missing is a second
     * copy for it to work FROM, which arrives with the workspace-side store of
     * Phase 2. Saying so is the only correct behaviour here: reporting a
     * successful restore that restored nothing is the silent success this
     * project keeps finding.
     */
    lines.push(
      'nothing was restored: the store being verified IS the installed package ' +
      `(${to}), so there is no second copy here to restore from. Reinstall the ` +
      'package to put back what shipped.',
    );
    return lines;
  }
  lines.push(report.restored.length === 0
    ? 'nothing needed restoring.'
    : `restored ${report.restored.length} entry(s) from ${from}: ${report.restored.join(', ')}.`);
  if (report.unexpected.length > 0) {
    lines.push(
      `left in place, because the package never shipped them and deleting a file nobody asked ` +
      `to delete is a decision to take rather than one to make for you: ` +
      `${report.unexpected.join(', ')}.`,
    );
  }
  return lines;
}

function cmdRulesVerify(_ws: Workspace, args: string[], out: Emit): number {
  /**
   * Two names for what is, in this phase, one directory — and they are two
   * names rather than one so that the day a workspace-side store exists
   * (spec §12.3, Phase 2) this function changes where `store` comes from and
   * nothing else. `restoreLines` reports the identity honestly rather than
   * claiming a restore it could not perform.
   */
  const packageStore = entriesDir();
  const store = entriesDir();
  const restore = hasFlag(args, 'restore');
  const restored: RestoreReport | null = restore && path.resolve(packageStore) !== path.resolve(store)
    ? restoreEntries(packageStore, store)
    : null;
  const dir = store;

  const answer = verifyManifest(dir);
  const problems: Problem[] = answer.ok ? [] : answer.problems;

  if (wantsJson(args)) {
    emitJson(out, {
      store: dir,
      ok: answer.ok,
      problems: problems.map((p) => ({ entry: p.entry, why: p.why, detail: p.detail })),
      restored: restored === null ? null : restored.restored,
      unexpected: restored === null ? null : restored.unexpected,
    });
    return answer.ok ? 0 : 1;
  }

  if (restore) {
    const report = restored ?? { restored: [], unexpected: [] };
    for (const line of paragraph(restoreLines(report, packageStore, store).join(' '))) out(line);
  }

  if (answer.ok) {
    out(`my_context: the rule store is intact — every entry matches the checksum that shipped with it.`);
    out(`  ${dir}`);
    return 0;
  }

  for (const line of paragraph(
    `my_context: the rule store has been changed since it was installed — ${problems.length} ` +
    `problem(s). Writes to it are refused while that is true; reads still work, because a ` +
    `damaged install is one you can still recover from.`,
  )) out(line);
  out('');
  for (const problem of problems) {
    for (const line of paragraph(`${problem.entry} — ${problem.why}: ${problem.detail}`, '  ')) out(line);
  }
  return 1;
}

function cmdRules(ws: Workspace, args: string[], out: Emit): number {
  const [subcommand = 'list'] = positionals(args, []);
  if (!(SUBCOMMANDS as readonly string[]).includes(subcommand)) {
    out(`my_context: unknown rules subcommand "${subcommand}".\n\n${USAGE}`);
    return 1;
  }

  const spec = RULES_FLAGS[subcommand];
  if (refuseUnknownFlag(args, spec.allowed, spec.values, USAGE, out)) return 1;

  try {
    if (subcommand === 'verify') return cmdRulesVerify(ws, args, out);
    if (subcommand === 'show') return cmdRulesShow(ws, args, out);
    return cmdRulesList(ws, args, out);
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

registerCommand({
  name: 'rules',
  usage: 'rules [verify|list|show] [<id>] [--restore] [--json]',
  summary: 'the product rule store that ships with this tool, and whether it is intact',
  run: cmdRules,
});

export { cmdRules };
