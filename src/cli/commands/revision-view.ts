import { lineDiff, valueLines, type DiffLine } from '../../core/revision-diff.ts';
import {
  changedFields,
  type PendingRevision, type RevisionField, type RevisionRecord, type RevisionValue,
} from '../../core/revision-log.ts';
import { outputWidth, wrap, type Detail } from './format.ts';

/**
 * How `mycontext review` renders a pending revision: as a DIFF against the
 * text the item governs right now, never as an identifier a human is asked to
 * approve on trust.
 *
 * **A diff is not a table, and this is deliberately not one.** `review list
 * --full` became a record view because a table can never be narrower than the
 * sum of its columns' longest tokens and an id is one token — eight columns
 * beside a sixty-seven-character id measured 210 columns against a 100-column
 * budget. A diff is worse than that case, not better: its widest "column"
 * would be a line of a body, which is prose of any length, so every level here
 * is a record view — the item id as a heading on its own line, labelled
 * metadata under it, and the changed text at full width beneath that.
 *
 * **Nothing is elided.** Every field the revision changes gets a block, and
 * every line of every one of those fields is printed: `-` for what the item
 * says now, `+` for what the revision proposes, two spaces for a line both
 * agree on. `review promote`'s preview was criticised in audit for omitting
 * `always`, the field with the largest injection footprint, and a diff that
 * showed the first few lines of a body would be the same defect in a shape
 * that admits it less obviously. The only thing that varies by detail level is
 * the METADATA around the diff, never the diff.
 */

// `changedFields` used to be defined here as well — a byte-for-byte copy of
// `core/revision.ts`'s then-private `fieldsOf` (B7.3). The one definition lives
// beside `REVISION_FIELDS` in `core/revision-log.ts` (web-ui plan 2, Task 1),
// and the import above now names that module directly (Task 2) rather than
// reaching it through revision.ts's re-export — so nothing this file imports
// pulls `mutate.ts` into the graph of the diff the UI server also serves.

/**
 * One diff line, wrapped into the layout budget.
 *
 * A continuation is indented two columns PAST the text column, so it can never
 * be mistaken for an unmarked context line: a reader scanning the marker
 * column sees `-`, `+`, or blank at one column, and anything further right is
 * the line above continuing. Nothing is truncated; a single token wider than
 * the budget overflows rather than being broken, exactly as `wrap` does
 * everywhere else in this CLI, because a broken id or URL stops being
 * copy-pasteable.
 */
function markedLines(line: DiffLine, indent: number, width: number): string[] {
  const pad = ' '.repeat(indent);
  const cont = ' '.repeat(indent + 4);
  const wrapped = wrap(line.text, Math.max(width - indent - 4, 20));
  // `trimEnd` on the marker line only, so an EMPTY line of a body renders as a
  // bare `-` rather than a marker followed by a space no reader can see and
  // every diff of a file with blank lines carries.
  return wrapped.map((text, i) => (i === 0 ? `${pad}${line.mark} ${text}`.trimEnd() : `${cont}${text}`));
}

/**
 * The diff of one field: a heading naming the field, then every line of both
 * texts. `missing` is what stands in for a side that does not exist — the
 * only case being an item whose file is gone, where there is no current text
 * to diff against and saying so is the honest rendering.
 */
export function fieldDiff(
  field: RevisionField,
  from: RevisionValue | undefined,
  to: RevisionValue | undefined,
  opts: { indent?: number; width?: number; missing?: string } = {},
): string[] {
  const indent = opts.indent ?? 2;
  const width = opts.width ?? outputWidth();
  const missing = opts.missing ?? '(no current value — the item is not in the index)';
  const before = valueLines(field, from) ?? [missing];
  const after = valueLines(field, to) ?? [missing];
  return [
    `${' '.repeat(indent)}${field}`,
    ...lineDiff(before, after).flatMap((line) => markedLines(line, indent + 2, width)),
  ];
}

/** A labelled metadata line under a revision's heading, wrapped with a hanging
 * indent so a long explanation cannot be read as the start of the next field. */
function labelled(label: string, text: string, width: number, labelWidth = 8): string[] {
  const hang = 2 + labelWidth + 2;
  return wrap(text, Math.max(width - hang, 40))
    .map((line, i) => (i === 0 ? `  ${label.padEnd(labelWidth)}  ${line}` : ' '.repeat(hang) + line));
}

/**
 * What a revision's `state` line says, and it is the same sentence wherever a
 * revision is shown.
 *
 * Staleness is the fact a reviewer cannot be allowed to miss — it means a
 * human changed the very text this proposal rewrites — so it is on every
 * detail level, in capitals, naming the fields that moved. `--full` and the
 * `promote-revision` preview additionally SHOW that change as a diff; this
 * line alone never claims to.
 */
export function stateLine(rev: PendingRevision): string {
  if (rev.itemMissing) {
    return `STALE — ${rev.itemId} is no longer in the index or on disk, so this revision cannot ` +
      'be promoted. Discard it, or run `mycontext rebuild` if the index is stale.';
  }
  if (rev.stale) {
    return `STALE — a human changed ${rev.changedSince.join(', ')} after this was staged. ` +
      'Promoting it overwrites that change, so it is refused without --force.';
  }
  return 'applies cleanly — nothing has changed underneath it since it was staged';
}

/**
 * One pending revision, whole.
 *
 * `alsoPending` is the other revisions queued on the SAME item. It is shown at
 * `--full` because an item may carry more than one (see `stageRevision`), and
 * a reviewer promoting one of them makes the others stale — a consequence
 * nobody can anticipate from a view that shows one proposal at a time.
 */
export function renderRevision(
  rev: PendingRevision,
  opts: { detail?: Detail; alsoPending?: PendingRevision[]; width?: number } = {},
): string[] {
  const width = opts.width ?? outputWidth();
  const detail = opts.detail ?? 'short';
  const lines = [rev.itemId];
  lines.push(...labelled('revision', rev.revisionId, width));
  lines.push(...labelled('staged', `${rev.stagedAt} by ${rev.origin}`, width));
  lines.push(...labelled('state', stateLine(rev), width));
  if (detail === 'full' && opts.alsoPending && opts.alsoPending.length > 0) {
    // Per revision, and stated per FIELD, because staleness is per field:
    // `decorate` (revision.ts) compares only the fields a revision itself
    // rewrites, so promoting a body proposal does NOT make a title proposal on
    // the same item stale. A blanket "promoting this one makes them stale"
    // would be false for exactly that pair, which an item carrying two
    // proposals is as likely to be as not.
    const mine = changedFields(rev.changes);
    lines.push(...labelled(
      'also',
      `${opts.alsoPending.length} other revision(s) pending on this item: ` +
      opts.alsoPending.map((r) => {
        const fields = changedFields(r.changes);
        const collides = fields.some((f) => mine.includes(f));
        return `${r.revisionId} (${fields.join(', ')} — ` +
          `${collides
            ? 'rewrites what this one rewrites, so promoting this one makes it stale'
            : 'a different field, unaffected by promoting this one'})`;
      }).join('; '),
      width,
    ));
  }
  for (const field of changedFields(rev.changes)) {
    lines.push(...fieldDiff(field, rev.current[field], rev.changes[field], { width }));
  }
  if (detail === 'full' && rev.stale && !rev.itemMissing) {
    lines.push('  what changed underneath this revision (it was staged against the "-" text):');
    for (const field of rev.changedSince) {
      lines.push(...fieldDiff(field, rev.base[field], rev.current[field], { indent: 4, width }));
    }
  }
  return lines;
}

/**
 * A settled revision, one line, plus its proposed text at `--full`.
 *
 * This is what makes `discardRevision`'s "the proposal is NOT deleted" claim
 * something a user can act on rather than a promise about a file format: the
 * discard message names `mycontext review revisions <id> --full`, and this is
 * what that prints. The one-line form says the text exists and where to see
 * it; it never implies it is showing it.
 */
export function renderSettled(
  rev: RevisionRecord, opts: { detail?: Detail; width?: number } = {},
): string[] {
  const width = opts.width ?? outputWidth();
  const fields = changedFields(rev.changes).join(', ');
  const lines = [
    ...labelled(
      rev.revisionId,
      `${rev.state} ${rev.settledAt ?? '(no timestamp)'} — proposed ${fields}, staged ` +
      `${rev.stagedAt} by ${rev.origin}` +
      (rev.reason === null ? '' : `. Reason: ${rev.reason}`),
      width,
      16,
    ),
  ];
  if (opts.detail !== 'full') return lines;
  for (const field of changedFields(rev.changes)) {
    lines.push(`  ${field} it proposed`);
    for (const line of valueLines(field, rev.changes[field]) ?? []) {
      for (const wrapped of wrap(line, Math.max(width - 8, 20))) lines.push(`    ${wrapped}`);
    }
  }
  return lines;
}
