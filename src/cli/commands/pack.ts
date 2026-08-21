import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { LoadError } from '../../core/rebuild.ts';
import type { Workspace } from '../../core/workspace.ts';
import {
  collisionJson, renderCollisionReport, type CollisionReport,
} from '../../pack/collide.ts';
import {
  applyImport, planImport, type ImportOutcome, type ImportPlan,
} from '../../pack/import.ts';
import { readImportRecords, type ImportRecord } from '../../pack/imported-audit.ts';
import { readArtefact } from '../../pack/reader.ts';
import { emitLoadErrors, openMutateContext, toCliMessage } from './context.ts';
import { emitJson, paragraph, refuseUnknownFlag, table, wantsJson } from './format.ts';
import { flag, hasFlag, positionals, registerCommand, type Emit } from './registry.ts';
import { confirmAction, readLineSync } from './review.ts';

/**
 * `mycontext pack import` and `mycontext pack list` — the user-facing half of
 * the import, over `planImport`/`applyImport` (src/pack/import.ts).
 *
 * **Nothing about WHAT an import does is decided here.** The buckets are
 * `collide.ts`'s, the refusals are `import.ts`'s and `config-io.ts`'s, and the
 * two renderings of the report are `collide.ts`'s. This file owns the three
 * things none of them can: turning a command line into an import, asking the
 * two questions §6n.7 requires, and printing the outcome sentence that tells a
 * user what they now have.
 *
 * ## One command with subcommands, because the registry is keyed on one word
 *
 * `COMMANDS` maps a single argv[0] to a definition, so there is no two-word
 * command to register: `pack import` is `pack` dispatching on its first
 * positional, exactly as `review` and `procedure` already do. The flag tables
 * are PER SUBCOMMAND and not one union, for the reason `review` gives — a
 * `--yes` on `list` is meaningless, and accepting it is the silent swallow the
 * unknown-flag check exists to stop. `--overwrite-changed` is on `import`
 * alone for the same reason.
 *
 * ## The order, and every refusal before the preview
 *
 *   1. the subcommand, then the flags, then the positional — all before the
 *      corpus is opened, so a typo is never read as one of the checks below
 *      deciding something;
 *   2. read and verify the artefact, then plan the import — `planImport` is
 *      pure, so everything it refuses is refused with nothing written;
 *   3. print the collision report, **always**. Not "unless `--yes`": the
 *      confirmation only asks its question on a TTY, so a non-interactive
 *      refusal would otherwise never say what it declined. The `changed`
 *      bucket printed there IS §6n.7's warning — ids, differing fields, and
 *      what each overwrite costs;
 *   4. the import gate, unless `--dry-run`;
 *   5. the overwrite gate, and only when the `changed` bucket holds something
 *      an update could actually reach;
 *   6. apply, then say what happened.
 *
 * ## Why gate 5 does not go through `confirmAction` as it stands
 *
 * `confirmAction` returns true on `--yes`
 * (`cli/commands/review.ts` · `  if (hasFlag(args, 'yes')) return true;` · ~501),
 * which is exactly right for gate 4 and exactly wrong for gate 5. §6n.7 asks
 * for an approval that is explicit and SEPARATE from choosing the pack, and
 * `--yes` is consent to the import the user described — not to replacing a
 * rule they wrote. So gate 5 reads its own flag, prompts with its own question
 * on a TTY, and never sees the command line's `--yes` at all.
 *
 * It also owns its own decline wording rather than borrowing
 * `confirmAction`'s. Declining gate 5 is **not** an error and does not abort
 * the import: the new items still land and the changed ones are reported and
 * skipped, which is §6n.7's own wording for what declining means. "Nothing
 * changed" would be false on exactly that path.
 *
 * ## The exit code, which is the F2 rule
 *
 * An import that did its job exits 0 even when an unrelated item file
 * elsewhere in the corpus failed to load. The load errors are still reported —
 * on every path, and inside the document under `--json` — because a corpus a
 * pack was planned against with an unreadable file in it is a corpus whose
 * collision report may be missing a collision. Only `status` and `doctor` exit
 * non-zero on an unrelated load error; see `openMutateContext`'s doc comment
 * in `cli/commands/context.ts`.
 */

/** The subcommands this command accepts — the single source for every list. */
export const SUBCOMMANDS = ['import', 'list'] as const;

/** The flags each subcommand accepts, and the value-taking subset. */
const PACK_FLAGS: Record<string, { allowed: string[]; values: string[] }> = {
  import: {
    allowed: ['name', 'dry-run', 'json', 'yes', 'overwrite-changed'],
    values: ['name'],
  },
  list: { allowed: ['json'], values: [] },
};

/** Every value flag any subcommand takes, for the one `positionals` call. */
const VALUE_FLAGS = [...new Set(Object.values(PACK_FLAGS).flatMap((f) => f.values))];

const USAGE = `usage: mycontext pack import <path> [--name <text>] [--dry-run] [--json] [--yes]
                                    [--overwrite-changed]
       mycontext pack list [--json]`;

/**
 * The workspace's own `config.json`, spelled here rather than reached for out
 * of `pack/layout.ts`: that module's `CONFIG_NAME` names a file INSIDE an
 * artefact, and the two happening to be the same string is not a reason to let
 * one stand for the other. `import.ts` makes the same distinction for the
 * write; this is the read.
 */
const WORKSPACE_CONFIG = 'config.json';

/** `out` for a sentence rather than a line — `export`'s helper, same reason. */
function say(out: Emit, text: string, prefix = ''): void {
  for (const line of paragraph(text, prefix, undefined, ' '.repeat(prefix.length))) out(line);
}

/**
 * The workspace's `config.json` as it is on disk, unresolved.
 *
 * The RAW document and not `ws.config`, because the merge must be over what
 * the file says: `mergePackConfig` starts from a clone of it and only ever
 * writes inside `categories`, which is what keeps `budgets`, `watchedDocs` and
 * a key written by a NEWER build intact across an import that rewrites the
 * file. A merge over the resolved shape would delete the last of those.
 *
 * It cannot fail to parse here: `resolveWorkspace` reads and parses the same
 * file before any command is dispatched, and throws on a bad one
 * (`core/workspace.ts` · `      raw = JSON.parse(readFileSync(configPath, 'utf8'));` · ~34).
 */
function rawWorkspaceConfig(root: string): unknown {
  const file = path.join(root, WORKSPACE_CONFIG);
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** `"a", "b" and "c"` — what a sentence names, never a bare count. */
function nameIds(ids: readonly string[]): string {
  if (ids.length === 1) return ids[0];
  return `${ids.slice(0, -1).join(', ')} and ${ids[ids.length - 1]}`;
}

/**
 * §6n.7's second act.
 *
 * Reads `--overwrite-changed` first and prompts only when the flag is absent
 * and stdin is a TTY. A non-interactive run with no flag is **not** a refusal:
 * it answers "no" and the import continues without the changed items, which is
 * what declining means here.
 */
export function approveOverwrite(
  args: string[],
  out: Emit,
  count: number,
  isTTY: boolean = Boolean(process.stdin.isTTY),
  readLine: () => string = readLineSync,
): boolean {
  if (hasFlag(args, 'overwrite-changed')) return true;
  if (!isTTY) return false;
  out(`overwrite the ${count} changed item(s) marked above with the pack's version? [y/N] `);
  const answer = readLine().trim().toLowerCase();
  if (answer === 'y' || answer === 'yes') return true;
  out('my_context: the changed item(s) are left exactly as they are. The rest of the import '
    + 'continues.');
  return false;
}

/**
 * The report, assembled from the plan and — after a write — from the outcome.
 *
 * Every count comes off one of those two, never re-derived from the corpus: a
 * report that recounted what it had just written would be a second opinion
 * about a decision that already has an owner, and the two would agree only
 * until one of them changed.
 */
function reportOf(
  plan: ImportPlan,
  name: string,
  outcome: ImportOutcome | null,
  overwriteApproved: boolean,
  refused: readonly string[],
  errors: readonly LoadError[],
): CollisionReport {
  return {
    pack: name,
    version: plan.version ?? '',
    kind: plan.kind,
    source: plan.source,
    format: plan.format,
    manifest: plan.manifest,
    buckets: plan.buckets,
    // `planImport` throws when the merge is refused, so a plan that exists has
    // an empty refusal list by construction — carried rather than recomputed.
    config: { merged: plan.config.merged, refused: [], untouched: plan.config.untouched },
    history: {
      records: outcome?.historyRecords ?? plan.history.records.length,
      quarantined: outcome?.quarantined ?? plan.history.unknown.length,
    },
    notCarried: plan.notCarried,
    refused: [...refused],
    applied: outcome !== null,
    overwriteApproved,
    overwritten: outcome?.overwritten ?? [],
    loadErrors: errors.map((e) => `${e.file}: ${e.message}`),
  };
}

/**
 * What a user has now, in the words that make it usable.
 *
 * The first sentence is the trust story — everything landed a draft, so
 * nothing governs — and it points at both routes out of the review queue,
 * because a forty-item queue reviewed one at a time is a queue nobody reviews.
 * The three sentences after it exist only when the pack collided, and each
 * NAMES its ids: a bare count is a number a reader cannot check anything
 * against, which is the shape §6n.7's warning is written to avoid.
 */
function outcomeLines(out: Emit, name: string, outcome: ImportOutcome): void {
  const hang = '            ';
  say(out,
    `imported ${outcome.imported.length} item(s) from pack "${name}" as drafts. Nothing governs `
    + 'yet. Review them one at a time with `mycontext review`, or promote the whole pack with '
    + `\`mycontext review promote --all --pack ${name}\`, which is one human act taken after the `
    + 'corpus is visible rather than before.',
    'my_context: ');

  if (outcome.overwritten.length > 0) {
    const n = outcome.overwritten.length;
    say(out,
      `overwrote ${n} ${n === 1 ? 'item' : 'items'} you had changed — `
      + `${nameIds(outcome.overwritten)}; ${n === 1 ? 'it is' : 'each is'} a draft now too, and `
      + 'the previous version is in the audit log — '
      + `\`mycontext audit --item ${outcome.overwritten[0]}\`.`,
      hang);
  }
  if (outcome.overwriteSkipped.length > 0) {
    say(out,
      `${outcome.overwriteSkipped.length} changed item(s) were left exactly as they are — `
      + `${nameIds(outcome.overwriteSkipped)}. Import again with --overwrite-changed, or answer `
      + 'the second question, to replace them.',
      hang);
  }
  if (outcome.overwriteBlocked.length > 0) {
    say(out,
      `${outcome.overwriteBlocked.length} changed item(s) differ in a field no write path here `
      + `can reach and were left exactly as they are — ${nameIds(outcome.overwriteBlocked)}. The `
      + 'report above names the field for each.',
      hang);
  }
  if (outcome.quarantined > 0) {
    say(out,
      `${outcome.quarantined} history record(s) carry an op this build does not know and were `
      + 'set aside under .audit/imported/unknown/ — counted, nothing dropped.',
      hang);
  }
}

function cmdImport(
  ws: Workspace, args: string[], out: Emit, cwd: string,
  isTTY: boolean, readLine: () => string,
): number {
  const root = ws.projectRoot as string;
  const [, source, ...extra] = positionals(args, VALUE_FLAGS);
  if (extra.length > 0) {
    say(out,
      `my_context: pack import takes one path (got ${JSON.stringify(extra[0])} after it). One `
      + 'artefact is imported at a time, because the report, the confirmation and the membership '
      + 'record are each about one pack — a second path here would be one of those three '
      + 'silently describing the other artefact.');
    out(USAGE);
    return 1;
  }
  if (source === undefined || source === '') {
    say(out,
      'my_context: pack import needs the path of the artefact to read — a directory or a .zip '
      + 'file that already exists. There is no default: an import is a stranger\'s corpus '
      + 'arriving in yours, and the one thing nobody should have to guess is which one.');
    out(USAGE);
    return 1;
  }

  const json = wantsJson(args);
  // Under `--json` there is one document and it is emitted at the end, so a
  // gate's own sentence goes INSIDE it — as `refused` — rather than beside it
  // as plain text, which would leave the output unparseable exactly when
  // something was declined.
  const refused: string[] = [];
  const gate: Emit = json ? (s) => refused.push(s) : out;

  const { ctx, errors } = openMutateContext(ws);
  try {
    const artefact = readArtefact(path.resolve(cwd, source));
    const plan = planImport(artefact, {
      existing: (id) => ctx.store.get(id),
      rawConfig: rawWorkspaceConfig(root),
      local: ws.config,
    });

    // Before the preview, because it decides what the preview calls the pack.
    const name = flag(args, 'name') ?? plan.pack;
    if (name === null || name === '') {
      say(out,
        `my_context: ${JSON.stringify(source)} is a full export and carries no pack name, so `
        + 'there is nothing to file its history and its membership list under. Pass --name '
        + '<text> to say what to call it here. A name invented on your behalf would be the one '
        + 'name `mycontext pack list` shows you and nobody chose. Nothing was imported.');
      return 1;
    }

    const dryRun = hasFlag(args, 'dry-run');
    // Always, and regardless of `--yes`: see the module comment.
    if (!json) for (const line of renderCollisionReport(reportOf(plan, name, null, false, [], errors))) out(line);

    if (!dryRun && !confirmAction(
      args, gate,
      `Import ${plan.allIds.length} item(s) from "${name}"? Everything lands as a draft and `
      + 'governs nothing until you promote it.',
      isTTY, readLine,
    )) {
      if (json) emitJson(out, collisionJson(reportOf(plan, name, null, false, refused, errors)));
      else emitLoadErrors(errors, out);
      return 1;
    }

    // Gate 5, and only when there is something an approval could actually
    // reach: `overwritable` is a fact about the entry, so a prompt offered for
    // a bucket of blocked entries would ask for permission nothing could use.
    const overwritable = plan.buckets.changed.filter((c) => c.overwritable);
    const overwriteApproved = !dryRun && overwritable.length > 0
      && approveOverwrite(args, gate, overwritable.length, isTTY, readLine);

    if (dryRun) {
      if (json) {
        emitJson(out, collisionJson(reportOf(plan, name, null, false, refused, errors)));
        return 0;
      }
      say(out,
        'nothing was written — this was a --dry-run. Run it again without --dry-run to import '
        + 'the pack above.', '  ');
      emitLoadErrors(errors, out);
      return 0;
    }

    const outcome = applyImport(ctx, plan, {
      name, source, now: Date.now(), overwriteApproved,
    });

    if (json) {
      emitJson(out, collisionJson(
        reportOf(plan, name, outcome, overwriteApproved, refused, errors),
      ));
      return 0;
    }
    outcomeLines(out, name, outcome);
    emitLoadErrors(errors, out);
    return 0;
  } catch (err) {
    out(toCliMessage(err));
    // Reported even on the failure path: an item file that could not be read
    // is a fact about the corpus, and it does not stop being one because the
    // import that came after it was refused.
    emitLoadErrors(errors, out);
    return 1;
  } finally {
    ctx.store.close();
  }
}

/** One row per imported pack, in the order `readImportRecords` files them. */
function listRow(record: ImportRecord): string[] {
  return [
    record.pack,
    record.version === '' ? '—' : record.version,
    String(record.items.length),
    record.importedAt,
    record.source,
  ];
}

function cmdList(ws: Workspace, args: string[], out: Emit): number {
  const root = ws.projectRoot as string;
  try {
    const records = readImportRecords(root);
    if (wantsJson(args)) {
      emitJson(out, { packs: records });
      return 0;
    }
    if (records.length === 0) {
      say(out,
        'my_context: no packs have been imported into this workspace. `mycontext pack import '
        + '<path>` reads one, and `mycontext export --as-pack` writes one.');
      return 0;
    }
    out(`my_context: ${records.length} pack(s) imported here.`);
    for (const line of table(
      ['pack', 'version', 'items', 'imported', 'source'], records.map(listRow), { indent: '  ' },
    )) out(line);

    const quarantined = records.reduce((sum, r) => sum + r.quarantined, 0);
    if (quarantined > 0) {
      say(out,
        `${quarantined} history record(s) across these packs carry an op this build does not `
        + 'know and are set aside under .audit/imported/unknown/.', '  ');
    }
    say(out,
      'Everything a pack imported landed as a draft. `mycontext review promote --all --pack '
      + '<name>` promotes one pack\'s drafts in a single human act.', '  ');
    return 0;
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }
}

/**
 * `isTTY` and `readLine` default to the real process but are accepted as
 * parameters so both gates can be driven without a pty — the same shape
 * `confirmAction` uses, and the only way the ORDER of the two questions can be
 * asserted at all.
 */
export function cmdPack(
  ws: Workspace, args: string[], out: Emit, cwd: string,
  isTTY: boolean = Boolean(process.stdin.isTTY),
  readLine: () => string = readLineSync,
): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  const [subcommand] = positionals(args, VALUE_FLAGS);
  if (subcommand === undefined || !(SUBCOMMANDS as readonly string[]).includes(subcommand)) {
    out(`my_context: unknown pack subcommand ${JSON.stringify(subcommand ?? '')}.\n\n${USAGE}`);
    return 1;
  }

  const { allowed, values } = PACK_FLAGS[subcommand];
  if (refuseUnknownFlag(args, allowed, values, USAGE, out)) return 1;

  try {
    return subcommand === 'list'
      ? cmdList(ws, args, out)
      : cmdImport(ws, args, out, cwd, isTTY, readLine);
  } catch (err) {
    // `flag` and `boolFlag` throw on a repeated or contradictory occurrence.
    out(toCliMessage(err));
    return 1;
  }
}

registerCommand({
  name: 'pack',
  // Derived from SUBCOMMANDS, not restated: `review`'s comment explains why a
  // second hand-kept spelling of a subcommand list drifts.
  usage: `pack [${SUBCOMMANDS.join('|')}] [<path>]`,
  summary: 'import an artefact somebody else wrote, and list the packs already imported',
  run: (ws, args, out, cwd) => cmdPack(ws, args, out, cwd),
});
