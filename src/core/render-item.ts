import type { Item } from './types.ts';

/**
 * The ONE spelling of an empty `scope`, for every surface that renders the
 * field. Scope restricts, so declaring none is the widest setting there is —
 * `-` and `(none)` both read as the narrowest, which is the opposite.
 *
 * `(unrestricted)` rather than `(every file)`, which was the first attempt and
 * is a claim this value cannot make. It describes the FIELD — the item
 * declares no restriction — and not a consequence, because the consequence
 * depends on the item's tier. Every surface that renders this also renders
 * RATIONALE items (`mycontext list --full` and the MCP list line both do), and
 * a rationale item is never injected on any file whatever its scope says, so
 * `scope (every file)` printed beside `adr` would have been a false claim on
 * this repo's own corpus. It is also the word `decay`'s own section,
 * `status`'s usage line and `review promote`'s completion line already use, so
 * the release names the concept once.
 *
 * Centralised because it had already drifted. `list --full` printed `-`,
 * `decay --full` printed `(every file)`, `review list --full` printed `-` and
 * the two approval-gate previews printed a third wording — four surfaces, one
 * fact, three answers, inside one release. Two commands disagreeing about the
 * same field is this project's recurring defect class (the audit found five
 * instances of it in one plan), and the fix for that class is a single
 * definition rather than a fifth careful edit.
 *
 * `test/cli/scope-rendering.test.ts` holds the surfaces to this: one test
 * executes every command that renders the field and asserts they agree, and a
 * second reads the sources so that a NEW site inlining its own literal fails
 * even though no existing test enumerates it.
 */
export const SCOPE_UNRESTRICTED = '(unrestricted)';

/**
 * An item's `scope` field as a display value.
 *
 * `separator` is presentation and may differ (tables pack with a space,
 * labelled previews read better with a comma); the EMPTY case may not, and is
 * `SCOPE_UNRESTRICTED` everywhere.
 */
export function scopeField(scope: string[], separator = ' '): string {
  return scope.length ? scope.join(separator) : SCOPE_UNRESTRICTED;
}

/**
 * The same field for a surface whose record has no separate `always` column,
 * so the pin has to be folded into this cell.
 *
 * `always` wins over the scope: a pinned item reaches every session before any
 * file is touched, so naming its globs instead would understate how it
 * arrives. `review list --full` does NOT use this — it prints `always` as its
 * own column and so must show the scope itself in the scope column.
 */
export function scopeCell(item: { always: boolean; scope: string[] }): string {
  return item.always ? 'always' : scopeField(item.scope);
}

/**
 * Renders a single item's full-text block, exactly as it appears in the
 * injected context. Shared by `render.ts` (actual output) and `select.ts`
 * (`itemCost`, so budgeting can never drift from what is actually rendered).
 * Pure — no I/O — so `select` stays I/O-free.
 */
export function renderItemBlock(item: Item): string {
  const lines = [`### ${item.id} · ${item.type} · ${item.title}`];
  if (item.body) lines.push('', item.body);
  if (item.observations.length) {
    lines.push('');
    for (const o of item.observations) {
      const tags = o.tags.map((t) => ` #${t}`).join('');
      const ctx = o.context ? ` (${o.context})` : '';
      lines.push(`- [${o.category}] ${o.text}${tags}${ctx}`);
    }
  }
  if (item.scope.length) lines.push('', `_scope: ${item.scope.join(', ')}_`);
  return lines.join('\n');
}

/**
 * Renders a single index-summary line for a normative item. Shared so
 * `select.ts`'s index-budget accounting never drifts from what `render.ts`
 * actually emits.
 */
export function renderIndexLine(entry: { id: string; type: string; title: string }): string {
  return `- ${entry.id} · ${entry.type} · ${entry.title}`;
}
