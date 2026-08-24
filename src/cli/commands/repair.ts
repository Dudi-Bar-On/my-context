import { COMMAND_FLAGS } from '../../core/command-flags.ts';
import { computeItemChecksum } from '../../core/item.ts';
import { persist } from '../../core/persist.ts';
import type { Item } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext, toCliMessage } from './context.ts';
import { table } from './format.ts';
import { confirmAction } from './review.ts';
import { registerCommand, type Emit } from './registry.ts';

const USAGE = 'usage: mycontext repair [--yes]';

/** Every flag `mycontext repair` accepts. Anything else is refused, not absorbed. */
/**
 * This command's flag surface, LIFTED to `core/command-flags.ts` so a read
 * surface can have it without reaching a module that writes. Nothing about
 * what is accepted changed; the reasoning is in that module's header.
 */
const { allowed: REPAIR_FLAGS, values: REPAIR_VALUE_FLAGS } = COMMAND_FLAGS.repair;

/**
 * Items whose RECORDED checksum disagrees with a fresh hash of their content
 * — the same comparison `loadLayer` (rebuild.ts) makes when it reports
 * `checksum mismatch for "<id>"`, using the same `computeItemChecksum`, so
 * this command can never disagree with the report it exists to answer.
 *
 * An item with NO recorded checksum (`checksum: ''` — hand-authored, or
 * written before the field existed) is deliberately NOT a candidate. Nothing
 * reports it, because there is no recorded value to disagree with content;
 * re-stamping one would rewrite a file nobody complained about, and a
 * hand-authored file is exactly where a rewrite through `renderItem` is most
 * likely to reorder or drop something the author put there. `mycontext repair`
 * answers a specific complaint, and that is not one of them.
 */
export function needsRestamp(items: Item[]): Item[] {
  return items
    .filter((i) => i.layer === 'project')
    .filter((i) => i.checksum !== '' && computeItemChecksum(i) !== i.checksum)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Global-layer items with the same disagreement, which this command will not
 * touch: `requireWritableItem` (mutate.ts) refuses every write to a non-project
 * item, and persisting one anyway would write a project-layer shadow file for
 * an id the index marks `global`. Counted and named rather than silently
 * skipped — a human who ran `repair` because `doctor` reported a mismatch is
 * owed the reason their mismatch is still there afterwards. */
export function skippedGlobal(items: Item[]): Item[] {
  return items
    .filter((i) => i.layer !== 'project')
    .filter((i) => i.checksum !== '' && computeItemChecksum(i) !== i.checksum)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * What re-stamping does and does not do, printed before the confirmation
 * prompt so it is read before the decision, not after it.
 *
 * The second paragraph is not a hedge. This repository's own corpus carried
 * exactly one mismatched item — `OPENQ-how-do-filters-respect-dependencies`
 * — whose observation text had been truncated at write time by a defect since
 * fixed (a trailing parenthetical was parsed as the observation's `context`
 * field, so the text ended at "merely referential" and the rest survived only
 * in `context`). The file was internally self-consistent afterwards:
 * `renderItem(parseItem(file)) === file` held, and the stale recorded checksum
 * was the ONLY evidence anything had been altered. Running this command on it
 * would have re-stamped that evidence away and blessed the truncated text.
 * It was repaired by rewriting the observation and then writing the item back
 * through `writeItem` (commit d7f75a1), which is a different act from what
 * this command performs.
 */
const HONESTY: string[] = [
  'What re-stamping does: it recomputes each item\'s checksum from the text now in its file,',
  'so the recorded checksum agrees with the content again and `doctor` stops reporting it.',
  '',
  'What it does NOT do: recover anything. If content was lost or mangled when the item was',
  'written, that loss is already on disk — re-stamping certifies the damaged text and removes',
  'the stale checksum, which may be the only remaining evidence that the file was ever altered.',
  'Read each file listed above (and `git diff`/`git log` on it) before answering yes.',
  '',
  'One more change to expect: each file is rewritten from what my_context parsed out of it, in',
  'the canonical layout every write path produces. Two consequences, both verified rather than',
  'assumed: frontmatter fields a hand-written file omitted come back spelled out with their',
  'defaults, and the "# heading" line is re-rendered from "title:" — so a hand-edit that changed',
  'one of the two without the other ends up with both reading what "title:" says, which is the',
  'value my_context was already using. The body, observations and relations are unchanged.',
];

function cmdRepair(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  // Refused, not absorbed — `mycontext add` and `mycontext query` do the same.
  // A swallowed `--dry-run` on a command with a confirmation gate is the worst
  // possible flag to guess about.
  const unknown = args.find((a) => a.startsWith('--') && !REPAIR_FLAGS.includes(a.slice(2).split('=')[0]));
  if (unknown) {
    out(
      `my_context: unknown flag "${unknown.split('=')[0]}" for \`repair\`. It accepts --yes only. ` +
      `Running it without --yes lists what would be re-stamped and changes nothing.\n\n${USAGE}`,
    );
    return 1;
  }

  const { ctx, errors } = openMutateContext(ws);
  try {
    const items = ctx.store.all();
    const candidates = needsRestamp(items);
    const globals = skippedGlobal(items);

    if (candidates.length === 0) {
      out(
        globals.length === 0
          ? 'my_context: nothing to re-stamp — every project item\'s checksum matches its content.'
          : 'my_context: nothing to re-stamp in this project.',
      );
      if (globals.length) reportGlobals(globals, out);
      // F2 (see `openMutateContext`'s doc comment): only `status` and `doctor`
      // exit non-zero on an unrelated corpus load error. `repair` reports it
      // and exits 0 — including here, where it had nothing to do.
      emitLoadErrors(errors, out);
      return 0;
    }

    // Listed in full BEFORE anything is written and before the prompt: id and
    // file path per item, so the answer to "what is this about to touch" is on
    // screen rather than something the human has to reconstruct afterwards.
    out(`my_context: ${candidates.length} project item(s) have a checksum that disagrees with their content:`);
    out('');
    for (const line of table(
      ['id', 'file'],
      candidates.map((i) => [i.id, i.filePath]),
      { indent: '  ' },
    )) out(line);
    out('');
    for (const line of HONESTY) out(line);
    if (globals.length) { out(''); reportGlobals(globals, out); }
    out('');

    if (!confirmAction(args, out, `Re-stamp ${candidates.length} item(s)?`)) return 1;

    // `persist` (core/persist.ts) is the one write path: it recomputes the checksum
    // from the item's content and writes the file atomically, then upserts the
    // same object into the index. No checksum is composed here, so this
    // command cannot produce a value `rebuild` would then disagree with.
    for (const item of candidates) {
      persist(ctx, item);
      out(`my_context: re-stamped ${item.id} (${item.filePath})`);
    }
    out('');
    out(
      `my_context: re-stamped ${candidates.length} item(s). Their recorded checksums now match ` +
      `their current content. Nothing was recovered — if any of that content was already wrong, ` +
      `it is still wrong and now checksums clean.`,
    );
    // The load errors below come from the rebuild this command opened with,
    // i.e. from BEFORE the writes above. Repeating the "checksum mismatch"
    // lines for the very items just re-stamped would print a statement that
    // stopped being true two lines earlier — the kind of contradiction between
    // a command's own report and its own result this project keeps finding.
    // Only those exact lines are withheld, matched to the item that resolved
    // them; every other load error (an unparseable file elsewhere, an unknown
    // type on the same file) is still reported, and F2 still says exit 0.
    const remaining = errors.filter((e) => !candidates.some(
      (i) => e.file === i.filePath && e.message.startsWith(`checksum mismatch for "${i.id}":`),
    ));
    if (remaining.length < errors.length) {
      out(
        `my_context: the ${errors.length - remaining.length} checksum-mismatch report(s) for the ` +
        `item(s) above are resolved by this run and are not repeated. Re-run \`mycontext doctor\` ` +
        `to see the corpus as it stands now.`,
      );
    }
    emitLoadErrors(remaining, out);
    return 0;
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  } finally {
    ctx.store.close();
  }
}

function reportGlobals(globals: Item[], out: Emit): void {
  out(
    `my_context: ${globals.length} global-layer item(s) also disagree with their checksum and are ` +
    `NOT repaired from here — global items are read-only in a project (see ` +
    `mycontext_help("categories")). Run \`mycontext repair\` from the global layer's own ` +
    `workspace. They are: ${globals.map((i) => i.id).join(', ')}.`,
  );
}

registerCommand({
  name: 'repair',
  usage: 'repair [--yes]',
  summary: 're-stamp project items whose recorded checksum no longer matches their content',
  run: cmdRepair,
});
