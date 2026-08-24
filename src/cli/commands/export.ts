import { Buffer } from 'node:buffer';
import { lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { COMMAND_FLAGS } from '../../core/command-flags.ts';
import { retryOnTransientFsError, type LoadError } from '../../core/rebuild.ts';
import type { ItemFilters } from '../../core/search.ts';
import { enumError } from '../../core/teach.ts';
import type { Status } from '../../core/types.ts';
import { STATUSES } from '../../core/validate.ts';
import type { Workspace } from '../../core/workspace.ts';
import { buildBundle, type Bundle } from '../../pack/bundle.ts';
import { writeBundleDirectory } from '../../pack/dir-writer.ts';
import type { ArtefactFormat } from '../../pack/reader.ts';
import { writeZip } from '../../pack/zip.ts';
import { emitLoadErrors, toCliMessage } from './context.ts';
import { emitJson, paragraph, refuseUnknownFlag, wantsJson } from './format.ts';
import { flag, hasFlag, positionals, registerCommand, type Emit } from './registry.ts';

/**
 * `mycontext export` — this workspace's corpus, written to a path the user
 * named, as a directory or as one ZIP, whole or projected into a pack.
 *
 * **Nothing about WHICH bytes travel is decided here.** `buildBundle`
 * (src/pack/bundle.ts) owns the selection and the allow-list walk, the two
 * writers own the containers, and this file owns three things none of them
 * can: turning a command line into `BundleOptions`, refusing everything
 * refusable before the corpus is opened, and printing the preview — including
 * the half of it that says what stayed behind.
 *
 * ## Why the preview names what did NOT travel
 *
 * An allow-list is only half a disclosure. A user who hands someone an export
 * of their corpus is entitled to know what is not in it, in the same breath as
 * what is — otherwise the omission is discovered by the receiver, or never.
 * `buildBundle` cannot print that line: it knows what it assembled, not what
 * the rest of `.my_context/` holds. So `NOT_TRAVELLING` is declared below,
 * beside the one command that shows it to a person.
 *
 * ## No `--yes`, and no confirmation gate — deliberately
 *
 * `confirmAction` guards writes to the CORPUS. This command writes only to a
 * path the user typed on the command line, and refuses to overwrite anything
 * already there. A gate here would be a prompt with nothing to protect, and it
 * would train exactly the reflex the gate on the import side depends on. That
 * decision has a visible consequence this file is the reason for: `export` is
 * absent from §7's approval boundary in both READMEs, because
 * `test/helpers/approval-boundary.ts` derives that set by asking the real
 * parser which commands accept `--yes`, and this one refuses it as an unknown
 * option like any other flag it does not have.
 *
 * ## The exit code, which is the F2 rule
 *
 * An export that did its job exits 0 even when an unrelated item file
 * elsewhere in the corpus failed to load. The load errors are still reported —
 * on every path, and inside the document under `--json` — because an artefact
 * assembled from a corpus with an unreadable file is missing that file, and
 * the person who is about to hand it to someone else is the one who needs to
 * know. Only `status` and `doctor` exit non-zero on an unrelated load error;
 * see `openMutateContext`'s doc comment in `cli/commands/context.ts`.
 *
 * ## `--out` is resolved against the caller's directory, not the process's
 *
 * `writeBundleDirectory` calls `path.resolve` on what it is handed, which
 * resolves against `process.cwd()`. `runCli` is given the invoking directory
 * as an argument and the two are not the same thing under test, so the
 * resolution happens here, once, against the `cwd` the command was handed —
 * and both writers receive an absolute path with nothing left to interpret.
 */

/**
 * This command's flag surface, LIFTED to `core/command-flags.ts` so a read
 * surface can have it without reaching a module that writes. Nothing about
 * what is accepted changed; the reasoning is in that module's header.
 */
const { allowed: ALLOWED, values: VALUE_FLAGS } = COMMAND_FLAGS.export;

const USAGE = `usage: mycontext export --out <path> [--format dir|zip]
                        [--as-pack --pack-name <name> --pack-version <text>]
                        [--type <category>] [--status <status>] [--tag <tag>]
                        [--no-history] [--dry-run] [--json]`;

/** The two containers, and the one place their names are spelled. */
const FORMATS: readonly ArtefactFormat[] = ['dir', 'zip'];

/**
 * What stays behind, in the words a person reads.
 *
 * Written down rather than derived, and that is a real cost worth stating: it
 * is the one list in this feature that a change to `.my_context/`'s layout
 * could leave stale. It cannot be derived, because the honest derivation —
 * "every directory under `.my_context/` that `buildBundle` did not read" —
 * would produce a different sentence per workspace, would name internal
 * directory names rather than the things a user has (`revisions`, `staged
 * lessons`), and would say nothing at all about a workspace that happens never
 * to have staged a revision. What keeps it honest is that the allow-list has
 * exactly one owner: `buildBundle` produces one file per selected item plus
 * `config.json`, `history.jsonl` and `manifest.json`, and has no directory
 * walk to widen. Anything added to this list is therefore a NEW kind of state,
 * which is a change to that module and not to this one.
 */
const NOT_TRAVELLING = [
  'injections', 'hook actions', 'focus records', 'the index', 'session state',
  'revisions', 'ingest sessions', 'staged lessons',
];

/** What the argument parser settled, before anything is read. */
interface ExportRequest {
  kind: 'export' | 'pack';
  name: string | null;
  version: string | null;
  format: ArtefactFormat;
  /** Absolute, already resolved against the caller's directory; null under `--dry-run`. */
  out: string | null;
  filters: ItemFilters;
  history: boolean;
  dryRun: boolean;
}

/** `out` for a sentence rather than a line — `session`'s helper, same reason. */
function say(out: Emit, text: string, prefix = ''): void {
  for (const line of paragraph(text, prefix, undefined, ' '.repeat(prefix.length))) out(line);
}

/**
 * The command line, or a message saying what is wrong with it.
 *
 * Returns a string on refusal rather than printing and returning a code, so
 * that every refusal in this function is reached the same way and none of them
 * can be the one that forgot to stop. Every one of them lands before the
 * corpus is opened, which is what makes "nothing was written" true of all of
 * them in the strongest sense: nothing was even read.
 *
 * `--pack-name` and `--pack-version` are refused OUTSIDE `--as-pack` rather
 * than ignored. A name accepted for a thing that is not a pack is the
 * accepted-and-silently-dropped shape this CLI refuses everywhere else, and it
 * is worse here than usual: the flag that was ignored is the one the receiver
 * would have read the artefact by.
 */
function parseRequest(args: string[], cwd: string): ExportRequest | string {
  const asPack = hasFlag(args, 'as-pack');
  const name = flag(args, 'pack-name');
  const version = flag(args, 'pack-version');

  if (asPack) {
    for (const [value, missing] of [[name, '--pack-name'], [version, '--pack-version']] as const) {
      if (value === null || value === '') {
        return `my_context: --as-pack needs ${missing}, and this command line has none. A pack `
          + 'is identified to its receiver by its name and its version — those two strings are '
          + 'what `mycontext pack list` shows and what a second import of the same pack is '
          + 'matched by — so there is no honest value to invent for a missing one. Nothing was '
          + 'written.';
      }
    }
  } else {
    for (const [value, given] of [[name, '--pack-name'], [version, '--pack-version']] as const) {
      if (value !== null) {
        return `my_context: ${given} means nothing without --as-pack, so it is refused rather `
          + 'than accepted and dropped. A full export is this workspace travelling whole and is '
          + 'not named or versioned: its manifest records both as null, and a value taken here '
          + 'would be the one the receiver never saw. Add --as-pack, or remove '
          + `${given}. Nothing was written.`;
      }
    }
  }

  const rawFormat = flag(args, 'format');
  if (rawFormat !== null && !(FORMATS as readonly string[]).includes(rawFormat)) {
    return `my_context: --format takes ${FORMATS.join(' or ')} (got ${JSON.stringify(rawFormat)}). `
      + '`dir` is the canonical artefact — a tree of files a receiver reads with no code at all, '
      + 'and copies with `cp -r` — and `zip` is the one file to send someone who has nothing. '
      + 'Nothing was written.';
  }
  const format = (rawFormat ?? 'dir') as ArtefactFormat;

  const status = flag(args, 'status');
  if (status !== null && !(STATUSES as readonly string[]).includes(status)) {
    return enumError('status', status, [...STATUSES], 'workflow');
  }

  const dryRun = hasFlag(args, 'dry-run');
  const rawOut = flag(args, 'out');
  if (!dryRun && (rawOut === null || rawOut === '')) {
    return 'my_context: export needs --out <path>, the destination it should write. There is no '
      + 'default: an artefact written into whatever directory the command happened to be run '
      + 'from is the one destination nobody chose. To see what would travel without writing '
      + 'anything, run `mycontext export --dry-run`. Nothing was written.';
  }

  return {
    kind: asPack ? 'pack' : 'export',
    name: asPack ? name : null,
    version: asPack ? version : null,
    format,
    // Resolved here so both writers are handed an absolute path — see the
    // module comment on why `process.cwd()` is the wrong base.
    out: rawOut === null || rawOut === '' ? null : path.resolve(cwd, rawOut),
    filters: {
      type: flag(args, 'type'),
      status: status as Status | null,
      tag: flag(args, 'tag'),
    },
    history: !hasFlag(args, 'no-history'),
    dryRun,
  };
}

/** `rule 6   standard 4   constraint 5`, in the bundle's own category order. */
function categoryLine(byCategory: Record<string, number>): string {
  return Object.entries(byCategory).map(([name, n]) => `${name} ${n}`).join('   ');
}

/**
 * The preview, printed before anything is written and printed again under
 * `--dry-run`, where it is the whole output.
 *
 * Every number here comes off `bundle.report`, which `buildBundle` assembles
 * while it walks — never re-derived from `bundle.files`. A preview that
 * recounted the files would be a second opinion about a selection that has
 * already been made, and the two would agree only until one of them changed.
 */
function previewLines(request: ExportRequest, bundle: Bundle): string[] {
  const lines: string[] = [];
  const report = bundle.report;
  const where = request.out === null ? '' : ` to ${request.out}`;
  const what = request.kind === 'pack'
    ? ` as a pack named "${request.name}", version "${request.version}"`
    : ' as a full export';
  lines.push(`my_context: about to export ${report.items} item(s)${where}${what}`);

  if (report.items > 0) lines.push(`  ${categoryLine(report.byCategory)}`);

  lines.push(...(request.history
    ? paragraph(
      `history: ${report.historyRecords} mutation record(s), filtered to mutations and joined `
      + 'to these items', '  ', undefined, '    ')
    : paragraph(
      'history: withheld by --no-history, so this artefact carries no history.jsonl at all — '
      + 'which a receiver can tell apart from one that travelled and was empty', '  ',
      undefined, '    ')));

  lines.push(...paragraph(
    `not travelling: ${NOT_TRAVELLING.slice(0, -1).join(', ')} and `
    + `${NOT_TRAVELLING[NOT_TRAVELLING.length - 1]}`,
    '  ', undefined, '                  '));

  if (report.droppedFields.length > 0) {
    lines.push(...paragraph(
      'dropped for a pack: '
      + report.droppedFields.map((d) => `${d.field} on ${d.items} item(s)`).join(', '),
      '  ', undefined, '    '));
  }

  // Grouped by the reason, which already names the flag that decided it —
  // `buildBundle` attributes each exclusion to the filter that actually
  // withheld the item rather than to every filter the user typed.
  const byReason = new Map<string, number>();
  for (const item of report.excluded) {
    byReason.set(item.reason, (byReason.get(item.reason) ?? 0) + 1);
  }
  for (const [reason, count] of byReason) {
    lines.push(...paragraph(`${reason}: ${count} item(s)`, '  ', undefined, '    '));
  }
  return lines;
}

/**
 * Write the archive as one file, refusing a destination that already holds
 * anything.
 *
 * `lstatSync` rather than `statSync`, which is the opposite of the choice
 * `dir-writer.ts` makes and is right for the opposite reason: that module
 * FOLLOWS a link because a destination directory may legitimately be a
 * Windows junction, while here any existing entry at the path — file,
 * directory, or a link of either kind — is something this command would
 * destroy or fail on, and naming it is more useful than resolving it.
 *
 * The parents are created for the same reason `writeBundleDirectory` creates
 * them: `--out ../packs/acme.zip` should work without the user making
 * `../packs` first, and refusing to would be a rule that exists only in the
 * ZIP half of one command.
 */
function writeArchive(bundle: Bundle, target: string): string[] {
  if (lstatSync(target, { throwIfNoEntry: false }) !== undefined) {
    throw new Error(
      `my_context: the export destination ${JSON.stringify(target)} already exists. An export `
      + 'never writes over something that is already there: the file it would replace may be '
      + 'the only copy of it, and "did this command destroy anything" is not a question a user '
      + 'should have to answer afterwards. Choose a path that does not exist. Nothing was '
      + 'written.',
    );
  }
  const bytes: Buffer = writeZip(bundle.files);
  retryOnTransientFsError(() => mkdirSync(path.dirname(target), { recursive: true }));
  retryOnTransientFsError(() => writeFileSync(target, bytes));
  return [target];
}

function cmdExport(ws: Workspace, args: string[], out: Emit, cwd: string): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }
  const root = ws.projectRoot;

  // Before the corpus is opened, in this order: an unknown flag first, so a
  // typo is never read as one of the checks below deciding something.
  if (refuseUnknownFlag(args, ALLOWED, VALUE_FLAGS, USAGE, out)) return 1;

  const extra = positionals(args, VALUE_FLAGS);
  if (extra.length > 0) {
    say(out,
      `my_context: export takes no positional arguments (got ${JSON.stringify(extra[0])}). The `
      + 'destination is --out, spelled as a flag because a bare path after a command that '
      + 'writes is the shape a mistyped filter takes.');
    out(USAGE);
    return 1;
  }

  let request: ExportRequest;
  try {
    const parsed = parseRequest(args, cwd);
    if (typeof parsed === 'string') { say(out, parsed); return 1; }
    request = parsed;
  } catch (err) {
    // `flag` and `boolFlag` throw on a repeated or contradictory occurrence.
    out(toCliMessage(err));
    return 1;
  }

  const errors: LoadError[] = [];
  try {
    const bundle = buildBundle(root, ws.config, {
      kind: request.kind,
      name: request.name,
      version: request.version,
      filters: request.filters,
      history: request.history,
      now: Date.now(),
    }, errors);

    const json = wantsJson(args);
    // Text first, so the preview really does precede the write. Under `--json`
    // there is no preview to precede anything: the document IS the report, and
    // it is emitted after the write so that it can say whether one happened.
    if (!json) for (const line of previewLines(request, bundle)) out(line);

    let written: string[] | null = null;
    if (!request.dryRun && request.out !== null) {
      written = request.format === 'zip'
        ? writeArchive(bundle, request.out)
        : writeBundleDirectory(bundle, request.out);
    }

    if (json) {
      emitJson(out, {
        kind: request.kind,
        name: request.name,
        version: request.version,
        format: request.format,
        out: request.out,
        dryRun: request.dryRun,
        written: written !== null,
        items: bundle.report.items,
        byCategory: bundle.report.byCategory,
        history: { travelled: request.history, records: bundle.report.historyRecords },
        notTravelling: NOT_TRAVELLING,
        droppedFields: bundle.report.droppedFields,
        excluded: bundle.report.excluded,
        // Artefact-relative, in the bundle's own order: the paths inside the
        // artefact are the format, and the absolute ones a directory write
        // returns are this machine's.
        files: bundle.files.map((f) => f.path),
        loadErrors: errors.map((e) => ({ file: e.file, message: e.message })),
      });
      return 0;
    }

    if (written === null) {
      say(out,
        'nothing was written — this was a --dry-run. Run it again without --dry-run to write '
        + 'the artefact above.', '  ');
    } else {
      say(out, `wrote ${written.length} file(s) to ${request.out}`, '  ');
    }
    emitLoadErrors(errors, out);
    return 0;
  } catch (err) {
    out(toCliMessage(err));
    // The load errors are reported even on the failure path: an item file that
    // could not be read is a fact about the corpus, and it does not stop being
    // one because the write that came after it failed.
    emitLoadErrors(errors, out);
    return 1;
  }
}

registerCommand({
  name: 'export',
  usage: 'export --out <path> [--format dir|zip] [--as-pack] [--dry-run] [--json]',
  summary: 'write this corpus to a path outside the workspace, whole or as a pack',
  run: (ws, args, out, cwd) => cmdExport(ws, args, out, cwd),
});

export { cmdExport };
