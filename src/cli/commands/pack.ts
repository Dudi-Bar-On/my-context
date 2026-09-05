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
import { refusePackName } from '../../pack/manifest.ts';
import { readArtefact } from '../../pack/reader.ts';
import { screenPackMeta } from '../../pack/screen.ts';
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
 *   2b. `--name`, through the two refusals every other pack name takes. It is
 *      before the report and not after it because the report's own first line
 *      PRINTS the name — see `refuseOverrideName`;
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
 * (`cli/commands/review.ts` · `  if (hasFlag(args, 'yes')) return true;` · ~804),
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
 * (`core/workspace.ts` · `      raw = JSON.parse(readFileSync(configPath, 'utf8'));` · ~54).
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
 *
 * Exported for `mycontext init --pack` (src/cli/index.ts), which prints the
 * same report about the same plan. A second mapping of twelve plan fields onto
 * a `CollisionReport` written there would be the hand-kept copy this project
 * has paid for four times: the two would agree until one of them changed, and
 * the one that changed would be whichever surface somebody was editing.
 */
export function reportOf(
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
 *
 * Exported for `mycontext init --pack` (src/cli/index.ts) for `reportOf`'s
 * reason, and it needs no branch for that surface: three of the four
 * conditional sentences are about the `changed` bucket, which is empty by
 * construction when the plan was computed against a corpus that does not exist
 * yet, and the fourth — the quarantine — is exactly as true there. `init`
 * prints its own "initialized" line before calling this, because that sentence
 * is about the workspace rather than about the pack.
 *
 * ## `sharedName`, and why the next step cannot be one fixed sentence
 *
 * The first sentence prints a command the user is meant to RUN. Two packs may
 * now call themselves one name — they are two membership records, kept apart
 * rather than one silently overwriting the other — and `review promote --all
 * --pack <name>` refuses to guess between them. So on exactly that path the
 * next step is `--pack <name> --source <path>`, and it is printed by knowing
 * which case this is rather than by hedging: a next-step instruction the same
 * build would refuse is worse than no instruction at all.
 *
 * `null` says the name resolves to this import alone, which is every import on
 * `init --pack` by construction — the workspace was created a moment ago.
 */
export function outcomeLines(
  out: Emit, name: string, outcome: ImportOutcome, sharedName: string | null = null,
): void {
  const hang = '            ';
  // The command is never embedded in this sentence — TASK-the-shipped-pack-
  // import-outcome-points-at-a-command-that measured `paragraph()` wrapping
  // it in half at 100 columns for exactly the case below (`sharedName ===
  // null`), which is the common case: a pack name long enough to push the
  // rest of the sentence past the column budget split `mycontext review
  // promote --all --pack <name>` across two lines, handing the reader a
  // command that reads wrong if copied from either line alone. The rendering
  // ruling this measurement settled — the same one already applied to the
  // `--source` variant below and to the prefix problem in the UI — is that a
  // command a reader may copy is emitted on its own line, never inside
  // flowing prose, so this sentence only ever points at "the command below".
  say(out,
    `imported ${outcome.imported.length} item(s) from pack "${name}" as drafts. Nothing governs `
    + 'yet. Review them one at a time with `mycontext review`, or promote the whole pack with '
    + 'the command below, which is one human act taken after the corpus is visible rather than '
    + 'before:',
    'my_context: ');
  if (sharedName !== null) {
    say(out,
      `another pack imported here calls itself ${JSON.stringify(name)} too, and each import kept `
      + 'its own membership list — so `--pack` alone names both and promotes neither. This one is:',
      hang);
  }
  // Emitted whole rather than through `say`: this line is meant to be COPIED,
  // and `paragraph` would wrap it at the terminal width and hand the reader a
  // command broken in half. The `--source` form is printed exactly as `pack
  // list` prints it, because that is the string `--source` is matched
  // against.
  out(sharedName === null
    ? `${hang}mycontext review promote --all --pack ${name}`
    : `${hang}mycontext review promote --all --pack ${name} --source ${sharedName}`);

  if (outcome.overwritten.length > 0) {
    const n = outcome.overwritten.length;
    say(out,
      `overwrote ${n} ${n === 1 ? 'item' : 'items'} you had changed — `
      + `${nameIds(outcome.overwritten)}; ${n === 1 ? 'it is' : 'each is'} a draft now too, and `
      + 'the previous version is in the audit log:',
      hang);
    // Same rendering ruling as the promote command above: an item id here can
    // run past 60 characters in a real corpus, and `say` would wrap this
    // command across two lines exactly as measured for the promote command.
    out(`${hang}mycontext audit --item ${outcome.overwritten[0]}`);
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

/**
 * The most screened code points a `--name` refusal prints, and the reason
 * there is a most.
 *
 * `screenText` reports EVERY finding by design — a screen that stopped at the
 * first would send an author round the loop once per character, and would let
 * a reviewer believe they had seen the whole of what arrived. That is right
 * for an artefact, whose fields are bounded by a file somebody wrote, and
 * wrong for a command-line value: `--name` is an unbounded string, and a name
 * of five hundred overrides would otherwise print five hundred paragraphs at a
 * reader who needed one. Four, because every finding from one row repeats that
 * row's `why` verbatim and a fifth copy of one sentence teaches nothing the
 * fourth did not.
 *
 * This is `ui/security.ts`'s field rule applied to a LIST instead of to a
 * string: bound what is shown, and mark the truncation VISIBLY so it cannot be
 * mistaken for the whole of what arrived
 * (`ui/security.ts` · `export const REFUSAL_VALUE_MAX = 256;` · ~291).
 */
const NAME_FINDING_MAX = 4;

/**
 * The most characters of a QUOTED VALUE a `--name` refusal prints.
 *
 * The screen's own findings are bounded by construction — they name a code
 * point, a row and an offset, and never interpolate the value at all.
 * `refusePackName` is not: its message quotes the value, and two of its rules
 * ("only whitespace", "has leading or trailing whitespace") fire BEFORE its
 * code-point limit does, so a name that trips one of them is quoted at whatever
 * length it arrived at. Measured through this command: `--name` holding 5,000
 * characters and one trailing space printed a 10,489-character refusal with the
 * value in it twice, and 50,000 characters printed 100,231.
 *
 * **The cap is on the VALUE and not on the message**, and the difference is the
 * whole point. Capping the message was tried first and was wrong: a sentence
 * cut at a fixed width loses its ENDING, and the ending is where
 * `refuseOpaqueMeta` says what was wrong — the value comes first and
 * "…has leading or trailing whitespace" comes after it, so a message-width cap
 * keeps the attacker's 5,000 characters and throws away the reason. That is the
 * house rule backwards. Capping the value keeps the whole sentence and shortens
 * only the part whose length somebody else chose.
 *
 * 256, the number this codebase already settled on for exactly this job
 * (`ui/security.ts` · `export const REFUSAL_VALUE_MAX = 256;` · ~291), and
 * comfortably above the longest value that could legally have been a name: 64
 * code points quote to at most 128 characters here, because the screen runs
 * first and has already refused every code point `JSON.stringify` would expand
 * to `\uXXXX`.
 */
const QUOTED_VALUE_MAX = 256;

/** The marker that makes a capped value unmistakable. One character. */
const VALUE_TRUNCATED = '…';

/**
 * A guard's own message, with every value it quotes capped and marked.
 *
 * The pattern is one JSON string literal, which is the only shape a value is in
 * here: `refuseOpaqueMeta` interpolates every value through `JSON.stringify`,
 * and the prose around them uses backticks. It is built per call rather than
 * shared, because a `/g` regular expression carries `lastIndex` with it.
 *
 * The cut is never made between the halves of a surrogate pair: half a pair is
 * a lone surrogate, which is itself a row of the screen this gate enforces, and
 * printing one in order to complain about Unicode would be its own small joke.
 */
function capQuotedValues(message: string): string {
  return message.replace(/"(?:[^"\\]|\\.)*"/g, (quoted) => {
    if (quoted.length <= QUOTED_VALUE_MAX) return quoted;
    const code = quoted.charCodeAt(QUOTED_VALUE_MAX - 1);
    const end = code >= 0xd800 && code <= 0xdbff ? QUOTED_VALUE_MAX - 1 : QUOTED_VALUE_MAX;
    return `${quoted.slice(0, end)}${VALUE_TRUNCATED}"`;
  });
}

/** A refusal in two parts: the sentence, and the bounded lines under it. */
interface NameRefusal {
  headline: string;
  details: readonly string[];
}

/**
 * The two refusals every other pack name takes, applied to the one an operator
 * typed — or `null` when the value may be this pack's name.
 *
 * ## Why the value arrives here having passed neither
 *
 * A manifest's name is refused twice before a plan exists: `parseManifest` puts
 * it through `refusePackName` (`pack/manifest.ts` · `export function refusePackName(v: unknown): string | null {` · ~314),
 * and `planImport` puts it through the Unicode screen
 * (`pack/import.ts` · `    ...screenPackMeta(manifest.name ?? '', manifest.version ?? ''),` · ~320).
 * `--name` REPLACES that value after both have run, and the replacement is what
 * every surface prints from then on — the collision report's first line, the
 * confirmation question, the outcome sentence, `.audit/imported/<slug>/import.json`
 * and `mycontext pack list`. The name is not the operator's own text either: it
 * is what a stranger's artefact suggested calling itself, retyped.
 *
 * Measured before this gate existed, both exiting 0 and both written verbatim
 * into `import.json`: a `--name` carrying U+202E RIGHT-TO-LEFT OVERRIDE, which
 * the report then printed, and a `--name` carrying a newline, which forged a
 * second line of that report reading as one of this product's own sentences.
 *
 * ## Both guards, because they are not two spellings of one rule
 *
 * `refusePackName` refuses what cannot be ONE LINE of a report — empty,
 * whitespace-only, untrimmed, past its code-point limit, a C0 or C1 control,
 * or not NFC. The screen refuses what IS a legal, trimmed, NFC line and still
 * lies about what it says: the bidi controls, the invisibles, the Tags block.
 * `screen.ts` names the gap itself — of these two strings it says
 * "`refusePackName` and `refuseDescriptiveVersion` do not catch them: neither
 * is a C0 or C1 control, none changes under NFC, and each costs one code
 * point". Neither is redundant and neither is sufficient.
 *
 * ## The screen goes first, because of what the other one's message contains
 *
 * `refusePackName` interpolates the value it refuses, and `JSON.stringify`
 * escapes a newline but leaves U+202E exactly as it is. A name carrying both a
 * trailing space and an override would then be refused in a sentence the
 * override reorders — a refusal defeated by the thing it is refusing. Screening
 * first means every value that reaches `refusePackName` from here has no
 * screened code point left in it, and the screen's own findings never
 * interpolate the value at all: they name the code point, the row and the
 * offset.
 *
 * `version` is the plan's, which `planImport` has already screened; it is
 * passed rather than a stand-in `''` so the call is about the PAIR this import
 * will actually print about itself, which is what `screenPackMeta` is for.
 * Re-screening a screened string finds nothing, which is the same reason
 * `planImport` asks the screen instead of branching around an export's absent
 * name.
 */
function refuseOverrideName(value: string, version: string): NameRefusal | null {
  const findings = screenPackMeta(value, version);
  if (findings.length > 0) {
    const details = findings.slice(0, NAME_FINDING_MAX).map((f) => capQuotedValues(f.message));
    const hidden = findings.length - details.length;
    if (hidden > 0) {
      details.push(`… and ${hidden} more screened code point(s) in this value, not listed here. `
        + `The ${details.length} above are the first ${details.length} in the order they appear.`);
    }
    return {
      headline:
        `my_context: the value --name gave carries ${findings.length} screened code point(s) and `
        + 'nothing was imported. A pack name is printed with nothing beside it — on the first '
        + 'line of the report this would have shown, in the confirmation question, in the import '
        + 'record and in `mycontext pack list` — so a code point that reorders or hides its '
        + 'neighbours there is read by someone who never opened the artefact. Nothing was '
        + 'normalised: the value is refused exactly as it was typed, and each finding below names '
        + 'its code point rather than printing it.',
      details,
    };
  }

  const bad = refusePackName(value);
  if (bad === null) return null;
  return {
    headline:
      'my_context: the value --name gave cannot be this pack\'s name here, and nothing was '
      + 'imported. It is the same rule a name inside a manifest is held to — the flag chooses '
      + 'what this workspace files the pack under, which is not a weaker thing to be.',
    details: [capQuotedValues(bad)],
  };
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
    // Resolved ONCE and used twice: it is the path the artefact is read from,
    // and it is the half of the import's key that the pack did not choose. Two
    // resolutions of one typed path could not disagree today and would be two
    // places to change the day this command learns to fetch a URL.
    const origin = path.resolve(cwd, source);
    const artefact = readArtefact(origin);
    const plan = planImport(artefact, {
      existing: (id) => ctx.store.get(id),
      rawConfig: rawWorkspaceConfig(root),
      local: ws.config,
    });

    // Before the preview, because it decides what the preview calls the pack —
    // and, for the same reason, before the preview is where the override is
    // refused: the report's first line prints the name.
    const override = flag(args, 'name');
    if (override !== null) {
      const refusal = refuseOverrideName(override, plan.version ?? '');
      if (refusal !== null) {
        say(out, refusal.headline);
        for (const detail of refusal.details) say(out, detail, '  ');
        return 1;
      }
    }

    const name = override ?? plan.pack;
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
      name, source, origin, now: Date.now(), overwriteApproved,
    });

    if (json) {
      emitJson(out, collisionJson(
        reportOf(plan, name, outcome, overwriteApproved, refused, errors),
      ));
      return 0;
    }
    // Read back rather than inferred: whether this name resolves to one record
    // is a fact about what is on disk NOW, and this import has just changed it.
    // The read is the same one `pack list` makes, so the next step this prints
    // is the command the user would compose from the table it points them at.
    const filed = readImportRecords(root).filter((r) => r.pack === name);
    outcomeLines(out, name, outcome, filed.length > 1 ? source : null);
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
