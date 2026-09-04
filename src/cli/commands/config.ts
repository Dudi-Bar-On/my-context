import { CATEGORIES } from '../../core/categories.ts';
import { COMMAND_FLAGS } from '../../core/command-flags.ts';
import {
  CategoryWriteRefusal, deleteCustomCategory, disableCategory,
  setConfigField, unsetConfigListEntries, type FieldWriteResult,
} from '../../core/config.ts';
import { enumError } from '../../core/teach.ts';
import type { Item } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext, toCliMessage } from './context.ts';
import { outputWidth, paragraph, refuseUnknownFlag } from './format.ts';
import {
  csv, flag, hasFlag, positionals, registerCommand, type Emit,
} from './registry.ts';
import { confirmAction } from './review.ts';

/**
 * **`mycontext config <name> --delete|--disable [--yes]`.**
 *
 * `rulings/20` widened, owner ruling 2026-09-04, given directly: "Yes, build
 * it as specified." The specification, verbatim from the board: *"a config
 * writer with DELETE (custom categories only — shipped ones are never
 * deletable), DISABLE for shipped ones, `--yes` for Execute, backup-before-
 * write, and an item-count warning before a change touching many items."*
 *
 * This is the one place `.my_context/config.json` is written from a command a
 * person types — every other write to that file today is a hand-edit,
 * because `DEC-should-the-web-ui-be-allowed-to-write-config-json` kept the
 * WEB UI to composing text for a human to paste (`src/ui/screens/config.js`'s
 * own words: *"the screen composes; it does not write"*) and
 * `budgets-write.ts` is reachable only from the browser, behind a confirm,
 * and never from a CLI command. Neither ruling is about this surface: a
 * terminal command with a confirmation gate is the shape every other write in
 * this product already takes — `edit`, `pin`, `ack` — applied here to the one
 * file that had none.
 *
 * **DELETE removes a category's `config.json` entry; DISABLE sets
 * `enabled: false` on it.** The distinction between what each may act on is
 * SHIPPED vs CUSTOM, taken from `core/categories.ts`'s own `CATEGORIES`
 * rather than restated here — see `core/config.ts`'s header on
 * `deleteCustomCategory`/`disableCategory` for why a shipped category can
 * never really be "deleted" (the catalogue would keep resolving it on the
 * next read regardless) and why DISABLE is legal on either kind. This file is
 * the human boundary around those two functions: it owns the item-count
 * warning, the confirmation gate and the backup-path report; the write itself
 * — and the refusal that a shipped category is undeletable — lives in
 * `core/config.ts`, where it can be unit-tested with no store, no
 * confirmation and no terminal at all.
 *
 * **`--yes` is `confirmAction` (review.ts), the same mechanism `edit`, `pin`,
 * `focus` and `supersede` already use** — refused off a TTY without it,
 * answered with a prompt on one. That is what makes it a REAL refusal rather
 * than a documented convention: `test/helpers/approval-boundary.ts` derives
 * the approval boundary by running the actual parser, and this command's
 * write forms land in that derived set because they genuinely refuse without
 * the flag, not because a list says they should.
 *
 * **The item-count warning is a WARNING, not a second consent token.** This
 * command's write is ONE act on ONE named category — never N independent acts
 * across N items, which is the shape `mycontext ack --all --code <code>`
 * exists for and the shape whose consent
 * `DEC-doctor-gets-a-bulk-settlement-overturning-the-no-bulk-ruling` ruled
 * must be a COUNT rather than `--yes`: *"A flag is one token … The guard is
 * intrinsic to the act rather than bolted onto it."* That argument is about a
 * command that settles many independent rulings in one run, each its own
 * write and its own audit record. This command makes exactly one write —
 * `config.json`'s one `categories` entry — regardless of how many items in
 * the corpus already carry the category; the count is the BLAST RADIUS of
 * that one write, printed before the gate so it is read rather than guessed,
 * and `--yes` is what the specification actually asked for. A count-as-
 * consent token here would be consent for a number that names existing items,
 * not for the write about to happen — the two are not the same fact, and
 * conflating them would be borrowing `ack`'s ceremony for a problem `ack`
 * does not have.
 *
 * ── `rulings/57`: `--set`/`--unset`, FIELD-LEVEL rather than category-level ──
 *
 * `--delete`/`--disable` above act on a whole category, and two things this
 * project needed could not be reached at that granularity: `dispatchGate.
 * enabled` is not inside any category at all, and clearing one retired name
 * (`progress`, `last_change`) out of `categories.task.extraFields` while
 * leaving the rest of `task` exactly as it stood cannot be spelled as
 * "delete the category" or "disable the category" — both throw away far more
 * than the one stale name.
 *
 * `--set <value>` and `--unset <value>[,<value>...]` read the SAME positional
 * this command already had, now as a dotted PATH rather than a bare category
 * name — a bare name is a one-segment path, so `config rule --disable` and
 * `config dispatchGate.enabled --set true` are the same grammar at two
 * depths. `--set` writes one scalar; `--unset` removes one or more entries
 * from a list. Both are refused BY NAME when the path names no key this
 * build's config.json understands, or when the value is the wrong type —
 * `core/config.ts`'s `setConfigField`/`unsetConfigListEntries` reuse
 * `resolveConfig` itself for every type check rather than keeping a second
 * opinion that could disagree with it; see that module's own header for the
 * one check `resolveConfig` cannot make on its own (R14.2 skips an unknown
 * TOP-LEVEL key rather than refusing it, which is right for loading and wrong
 * for writing).
 *
 * The item-count warning above this section is CATEGORY-shaped: it counts
 * items of one type. A field path is not always inside a category —
 * `dispatchGate.enabled` touches no item on disk at all — so the blast-radius
 * line for `--set`/`--unset` is the field's own before/after, plus the same
 * item count ONLY when the path is under `categories.<name>`, where it means
 * the same thing it already means for `--delete`/`--disable`.
 */
const { allowed: ALLOWED, values: VALUE_FLAGS } = COMMAND_FLAGS.config;

const USAGE = 'usage: mycontext config <name> --delete [--yes]\n'
  + '       mycontext config <name> --disable [--yes]\n'
  + '       mycontext config <path> --set <value> [--yes]\n'
  + '       mycontext config <path> --unset <value>[,<value>...] [--yes]';

/** `out` for a sentence rather than a line, wrapped to the layout budget —
 * the spelling `ack`/`review`/`status` already use. */
function say(out: Emit, text: string): void {
  for (const line of paragraph(text, '', outputWidth(), '  ')) out(line);
}

/**
 * The one coercion `--set`'s value goes through, and the only type decision
 * made in this file: read it as JSON when it parses as JSON — so `true`,
 * `false` and `6000` become the boolean/number `resolveConfig` expects — and
 * fall back to the raw string otherwise, which is what an ordinary word like
 * `rationale` or a sentence like `A ticket, as this team says it` is (neither
 * is valid JSON on its own). Whether the RESULT is the right type for the
 * field it is about to be written to is answered by `resolveConfig`, inside
 * `setConfigField` — never guessed a second time here.
 */
function coerceConfigValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function cmdConfig(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }
  if (refuseUnknownFlag(args, ALLOWED, VALUE_FLAGS, USAGE, out)) return 1;

  let del: boolean;
  let disable: boolean;
  let setSpec: string | null;
  let unsetSpec: string | null;
  try {
    del = hasFlag(args, 'delete');
    disable = hasFlag(args, 'disable');
    setSpec = flag(args, 'set');
    unsetSpec = flag(args, 'unset');
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }

  const acts = [del, disable, setSpec !== null, unsetSpec !== null].filter(Boolean).length;
  if (acts > 1) {
    say(out,
      'my_context: --delete, --disable, --set and --unset name four different acts; pass one. ' +
      'Nothing was written.');
    return 1;
  }
  if (acts === 0) {
    out(`my_context: config needs --delete, --disable, --set or --unset.\n\n${USAGE}`);
    return 1;
  }

  const rest = positionals(args, VALUE_FLAGS);
  if (rest.length === 0) {
    out(`my_context: config needs a category name or field path.\n\n${USAGE}`);
    return 1;
  }
  if (rest.length > 1) {
    say(out,
      `my_context: config acts on one target at a time; got ${rest.length} ` +
      `(${rest.join(', ')}). Nothing was written.`);
    return 1;
  }

  if (setSpec !== null || unsetSpec !== null) {
    return cmdConfigField(ws, rest[0], setSpec, unsetSpec, args, out);
  }

  const name = rest[0];

  if (!Object.hasOwn(ws.config.categories, name)) {
    out(enumError('category', name, Object.keys(ws.config.categories).sort(), 'categories'));
    return 1;
  }
  const shipped = Object.hasOwn(CATEGORIES, name);

  // Refused here, before the corpus is even opened for the item-count warning
  // below — a shipped category cannot be deleted no matter how many items
  // carry it, so there is nothing that count would be a warning FOR.
  if (del && shipped) {
    say(out,
      `my_context: "${name}" ships with my_context and can never be deleted. It is resolved ` +
      'from the catalogue no matter what config.json says, so removing its entry would not ' +
      'make it disappear — it would only discard whatever this project customised about it, ' +
      `while reporting the delete as done. Use \`mycontext config ${name} --disable\` ` +
      'instead: it stops new captures and injection under this category while the ' +
      'declaration and every item already carrying it are left exactly as they are. Nothing ' +
      'was written.');
    return 1;
  }

  // ── THE ITEM-COUNT WARNING, before the gate and regardless of consent ────
  const { ctx, errors } = openMutateContext(ws);
  let items: Item[];
  try {
    items = ctx.store.all();
  } catch (err) {
    ctx.store.close();
    out(toCliMessage(err));
    return 1;
  }
  ctx.store.close();
  const affected = items.filter((i) => i.type === name).length;

  const verb = del ? 'delete' : 'disable';
  say(out,
    `about to ${verb} category "${name}" (${shipped ? 'shipped' : 'custom'}).` +
    (affected === 0
      ? ' No item in this corpus carries it yet.'
      : ` ${affected} item(s) in this corpus already carry it.` + (
        del
          ? ' Deleting the declaration does not touch any of them on disk, but this workspace ' +
            'will no longer recognise the category they name — its scope policy and edit ' +
            'policy fall back to their absent-category defaults for every one of them.'
          : ' None of them are edited or deleted, but none of them will be selected for ' +
            'injection any more, and `mycontext add` will refuse a new item of this category, ' +
            'until it is enabled again.'
      )));
  out('');

  if (!confirmAction(
    args, out, `${verb.charAt(0).toUpperCase()}${verb.slice(1)} category "${name}"?`,
  )) {
    emitLoadErrors(errors, out);
    return 1;
  }

  try {
    const result = del
      ? deleteCustomCategory(ws.projectRoot, name)
      : disableCategory(ws.projectRoot, name);
    if (!result.wrote) {
      say(out, `my_context: "${name}" is already disabled. Nothing was written.`);
      emitLoadErrors(errors, out);
      return 0;
    }
    say(out,
      `my_context: ${verb === 'delete' ? 'deleted' : 'disabled'} category "${name}" in ` +
      'config.json. ' +
      (result.backupPath
        ? `The previous config.json was copied to ${result.backupPath} before writing.`
        : 'There was no existing config.json to back up before writing.'));
    emitLoadErrors(errors, out);
    return 0;
  } catch (err) {
    out(err instanceof CategoryWriteRefusal ? err.message : toCliMessage(err));
    emitLoadErrors(errors, out);
    return 1;
  }
}

/**
 * The blast-radius line for `--set`/`--unset`, printed before the gate —
 * `cmdConfig`'s own item-count warning, one level down. A field path under
 * `categories.<name>` gets the SAME item count `--delete`/`--disable` already
 * print, because it means the same thing there: how many items on disk carry
 * that category, none of which this write touches. Every other path touches
 * no item at all — `dispatchGate.enabled` governs a hook, not a corpus row —
 * so the line there is the field's own before/after and nothing more.
 */
function describeFieldChange(path: string, preview: FieldWriteResult, itemCount: number | null): string {
  const before = preview.before === undefined ? '(not declared)' : JSON.stringify(preview.before);
  const base = preview.action === 'set'
    ? `about to set "${path}" to ${JSON.stringify(preview.after)} — currently ${before}.`
    : `about to remove ${(preview.before as string[])
      .filter((v) => !(preview.after as string[]).includes(v))
      .map((v) => JSON.stringify(v)).join(', ')} from "${path}", leaving ` +
      `${(preview.after as string[]).length} entr${(preview.after as string[]).length === 1 ? 'y' : 'ies'}.`;
  if (itemCount === null) {
    return `${base} This does not touch any item already on disk; it changes what every future ` +
      'read of config.json sees.';
  }
  return `${base} ` + (itemCount === 0
    ? 'No item in this corpus carries this category yet.'
    : `${itemCount} item(s) in this corpus already carry this category; none of them are ` +
      'edited by this write.');
}

/**
 * `mycontext config <path> --set <value>` / `--unset <value>[,...]` — see the
 * header's `rulings/57` section. Handles both acts, because they share every
 * step except the underlying writer and the wording of the change.
 */
function cmdConfigField(
  ws: Workspace, path: string, setSpec: string | null, unsetSpec: string | null,
  args: string[], out: Emit,
): number {
  const setting = setSpec !== null;
  const corpusDir = ws.projectRoot as string;

  let removeValues: string[] = [];
  let coerced: unknown;
  if (setting) {
    coerced = coerceConfigValue(setSpec);
  } else {
    removeValues = csv(unsetSpec ?? '');
    if (removeValues.length === 0) {
      say(out,
        `my_context: --unset needs at least one value to remove, e.g. --unset progress. ` +
        'Nothing was written.');
      return 1;
    }
  }

  // Full validation happens here, via a dry run — the same writer the real
  // write below calls, re-read fresh a second time so a file that changes in
  // between is still caught. A path that cannot be written is refused here,
  // before anything is printed that implies a decision is pending.
  let preview: FieldWriteResult;
  try {
    preview = setting
      ? setConfigField(corpusDir, path, coerced, { dryRun: true })
      : unsetConfigListEntries(corpusDir, path, removeValues, { dryRun: true });
  } catch (err) {
    out(err instanceof CategoryWriteRefusal ? err.message : toCliMessage(err));
    return 1;
  }

  if (!preview.wrote) {
    say(out,
      `my_context: "${path}" already ` +
      `${setting ? `is ${JSON.stringify(coerced)}` : `does not carry any of ${removeValues.join(', ')}`}. ` +
      'Nothing was written.');
    return 0;
  }

  const segments = path.split('.');
  const categoryScoped = segments[0] === 'categories' && segments.length >= 2;
  let itemCount: number | null = null;
  let errors: ReturnType<typeof openMutateContext>['errors'] = [];
  if (categoryScoped) {
    const opened = openMutateContext(ws);
    errors = opened.errors;
    try {
      itemCount = opened.ctx.store.all().filter((i: Item) => i.type === segments[1]).length;
    } catch (err) {
      opened.ctx.store.close();
      out(toCliMessage(err));
      return 1;
    }
    opened.ctx.store.close();
  }

  say(out, describeFieldChange(path, preview, itemCount));
  out('');

  if (!confirmAction(args, out, `${setting ? 'Set' : 'Update'} "${path}"?`)) {
    emitLoadErrors(errors, out);
    return 1;
  }

  try {
    const result = setting
      ? setConfigField(corpusDir, path, coerced)
      : unsetConfigListEntries(corpusDir, path, removeValues);
    if (!result.wrote) {
      say(out, `my_context: "${path}" already matched. Nothing was written.`);
      emitLoadErrors(errors, out);
      return 0;
    }
    say(out,
      `my_context: ${setting ? 'set' : 'updated'} "${path}" in config.json. ` +
      (result.backupPath
        ? `The previous config.json was copied to ${result.backupPath} before writing.`
        : 'There was no existing config.json to back up before writing.'));
    emitLoadErrors(errors, out);
    return 0;
  } catch (err) {
    out(err instanceof CategoryWriteRefusal ? err.message : toCliMessage(err));
    emitLoadErrors(errors, out);
    return 1;
  }
}

registerCommand({
  name: 'config',
  usage: 'config <name> --delete|--disable [--yes]',
  summary: 'delete/disable a category, or set/unset one field, in config.json',
  run: cmdConfig,
});
