import type { Item, ScopePolicy } from './types.ts';

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
 * The second spelling, and the only one — for a category whose
 * `scopePolicy` is `inert`.
 *
 * `(unrestricted)` becomes a lie there. Under `inert` an empty scope does not
 * widen the item to every path; it attaches the item to NO path, so it is
 * never JIT-injected and appears as an index line only. Printing "declares no
 * restriction" for an item the policy restricts to nothing is the same
 * inversion `-` was: the widest word for the narrowest outcome.
 *
 * `(inert)` is the word the user's own config uses — `scopePolicy: "inert"` —
 * so the cell names the setting that produced it rather than paraphrasing it
 * into a fourth vocabulary. Like `SCOPE_UNRESTRICTED` it describes THIS FIELD
 * and not the item's fate: `always` is orthogonal and pins regardless of scope
 * or policy (spec §4b), so "this empty scope attaches the item to no path" is
 * true even on a pinned item, whereas "never injected" would not be. The
 * surfaces that fold `always` into this cell (`scopeCell`) print `always` in
 * preference anyway.
 */
export const SCOPE_INERT = '(inert)';

/**
 * What an EMPTY `scope` renders as under `policy`. One function, so the six
 * surfaces cannot drift apart a second time — this time along a new axis.
 *
 * `required` renders as `global` does, and that is not an oversight: `required`
 * refuses an unscoped item at CAPTURE (mutate.ts), so an unscoped item under
 * it is one that predates the setting, and such an item still injects
 * everywhere. Rendering it as anything else would claim a restriction
 * selection does not apply.
 */
export function emptyScopeLabel(policy: ScopePolicy): string {
  return policy === 'inert' ? SCOPE_INERT : SCOPE_UNRESTRICTED;
}

/**
 * An item's `scope` field as a display value.
 *
 * `separator` is presentation and may differ (tables pack with a space,
 * labelled previews read better with a comma); the EMPTY case may not, and is
 * `emptyScopeLabel(policy)` everywhere. `policy` is required rather than
 * defaulted: a caller that has not thought about which category's policy
 * applies would otherwise print `(unrestricted)` for an `inert` category and
 * be wrong silently, which is the failure this whole module exists to prevent.
 */
export function scopeField(scope: string[], policy: ScopePolicy, separator = ' '): string {
  return scope.length ? scope.join(separator) : emptyScopeLabel(policy);
}

/**
 * The same field for a surface whose record has no separate `always` column,
 * so the pin has to be folded into this cell.
 *
 * `always` wins over the scope: a pinned item reaches every session before any
 * file is touched, so naming its globs instead would understate how it
 * arrives. That holds under every policy — `inert` governs the JIT tier, not
 * the pinned one — so `always` wins over `(inert)` too. `review list --full`
 * does NOT use this — it prints `always` as its own column and so must show
 * the scope itself in the scope column.
 */
export function scopeCell(item: { always: boolean; scope: string[] }, policy: ScopePolicy): string {
  return item.always ? 'always' : scopeField(item.scope, policy);
}

/**
 * What an empty scope means for INJECTION under `policy`, as a clause a
 * preview can print, plus whether the item reaches a session through the JIT
 * tier at all.
 *
 * Two approval previews describe this in prose — `mycontext supersede`'s
 * "what you are retiring" line and `review promote`'s completion line — and
 * both said "unrestricted, so it is injected on every file" unconditionally.
 * Under `inert` that is exactly backwards, and a preview that overstates what
 * an approval costs is the defect `supersede`'s own implementation round
 * already found once. One definition, both callers.
 *
 * Callers must handle `always` themselves and BEFORE this: a pinned item
 * arrives at every session start whatever this says, and both callers already
 * print that case in their own words.
 */
export function emptyScopeInjection(policy: ScopePolicy): { phrase: string; injected: boolean } {
  return policy === 'inert'
    ? {
      phrase: 'no scope — this category\'s scopePolicy is "inert", so an item without one is ' +
        'never injected on a file; it appears in the session index only',
      injected: false,
    }
    : {
      phrase: 'no scope — unrestricted, so nothing narrows it and it is injected on the first ' +
        'file touched in a session',
      injected: true,
    };
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
