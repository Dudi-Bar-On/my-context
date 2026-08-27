import type { Item, ScopePolicy, Step, Tier } from './types.ts';

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
 * What a RATIONALE-tier item's injection amounts to, as a clause a preview can
 * print. One spelling, because two previews say it: `mycontext supersede`'s
 * "what you are retiring" line and `review promote`'s completion line.
 *
 * `select` (select.ts) filters `isNormative` BEFORE it looks at `always` or
 * `scope` — `eligible.filter((i) => isNormative(i, config))` — so a rationale
 * item is never injected in full whatever those two fields say. A preview that
 * reads them first prints "injected when work touches src/db/**", or "injected
 * at every session start", for an item that is injected nowhere. `supersede`'s
 * preview was written tier-first for exactly this reason; `review promote`'s
 * was not, and said "pinned: injected in full at every session start" for a
 * rationale draft carrying `always: true`.
 */
export const RATIONALE_NOT_INJECTED =
  'rationale tier — searchable, and counted in the session index, but never injected in full';

/**
 * What `always: true` does on `tier`, as a clause `review promote`'s preview
 * can print beside the flag.
 *
 * `always` is the field with the largest injection footprint on the normative
 * tier and none at all on the rationale one, and the preview is the human's
 * one look at what they are approving — so the two cases cannot share a
 * sentence. The rationale phrase says the same thing `inertFieldError`
 * (mutate.ts) refuses for, in the same terms: the flag is a field on every
 * item and only governs on one tier.
 */
export function alwaysInjection(tier: Tier): { pinned: boolean; phrase: string } {
  return tier === 'normative'
    ? { pinned: true, phrase: 'pinned: injected in full at every session start, regardless of scope' }
    : {
      pinned: false,
      phrase: 'INERT: only normative items are admitted to the pinned tier, so this ' +
        'changes nothing about what is injected',
    };
}

/**
 * The heading the steps sit under inside an item's block — **four hashes, one
 * level below the item's own `###`.**
 *
 * The file writes `## Steps` (item.ts · `renderItem`), and copying that level
 * here would be wrong in a way only visible in the assembled document:
 * `renderSelection` (render.ts) emits `## my_context — these govern this
 * project` and `## my_context index` as its OWN sections and each item as a
 * `###` under them, so a `##` inside a block would close the item and start a
 * document-level section — the steps would read as belonging to the injection,
 * not to the procedure that owns them. `####` nests, and cannot be mistaken
 * for the start of the next item either.
 *
 * It is a heading at all — where `## Observations` deliberately is not, its
 * lines going in bare — because in the block the two lists become adjacent and
 * the grammars overlap: `- [x] Roll the endpoint` is also a well-formed
 * observation line with category `x` (item.ts records that overlap at `STEP`
 * and rules that it must not be resolved by widening either regex). A reader
 * that mistakes a procedure's steps for commentary about it has lost the
 * content the item exists to deliver, and one word prevents it.
 */
const STEPS_HEADING = '#### Steps';

/**
 * One step, as the injected block spells it — **the same spelling the file
 * uses**, and it has to be: `parseSteps` (item.ts) refuses any step that would
 * not re-render byte for byte, so `- [ ] text` / `- [x] text` is not a
 * presentation choice here but the round-trip invariant itself, seen from the
 * injection side.
 *
 * Written out rather than imported from `item.ts` for the same reason the
 * observation line below is written out rather than imported: this module
 * renders for a context window and `item.ts` renders for disk, and the one
 * import would drag the frontmatter serializer, `node:crypto` and the whole
 * parser onto a path that today needs nothing but `types.ts` — on the hook.
 * The cost of the copy is drift, and drift is what
 * `test/core/steps-injection.test.ts` · `test('the injected step lines are
 * byte-identical to the step lines in the file'` holds shut: it renders one
 * item both ways, with both markers, and requires the checkbox lines to match.
 */
function renderStepLine(step: Step): string {
  return `- [${step.checked ? 'x' : ' '}] ${step.text}`;
}

/**
 * Renders a single item's full-text block, exactly as it appears in the
 * injected context. Shared by `render.ts` (actual output) and `select.ts`
 * (`itemCost`, so budgeting can never drift from what is actually rendered).
 * Pure — no I/O — so `select` stays I/O-free.
 *
 * **Everything added here is charged for, and everything omitted is not.**
 * `select.ts` · `export function itemCost(item: Item): number {` is
 * `estimateTokens(renderItemBlock(item)) + estimateTokens(BLOCK_SEPARATOR)` —
 * there is no second description of an item's size anywhere, and the UI's
 * budget simulator imports that same function. So a field left out of this
 * string is a field the selector believes is free, and one added is one it
 * starts paying for at every tier boundary. A stepless item must therefore
 * come out of here byte-identical to what it always did, which is what
 * `test/core/steps-injection.test.ts` pins first.
 *
 * The section order mirrors the file's (item.ts · `renderItem`): body, steps,
 * observations. A procedure's steps ARE the procedure; the observations are
 * commentary on it, and a reader who has seen the file meets the same sequence
 * here.
 */
export function renderItemBlock(item: Item): string {
  const lines = [`### ${item.id} · ${item.type} · ${item.title}`];
  if (item.body) lines.push('', item.body);
  if (item.steps.length) {
    lines.push('', STEPS_HEADING);
    for (const s of item.steps) lines.push(renderStepLine(s));
  }
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
 * The marker a carried index line wears, and the whole of what `carried`
 * costs in `budgets.index`.
 *
 * Measured on this repository's own corpus (Task 3's probe,
 * `reports/probes/2026-08-20-carry-set.md`): 29 tokens across 11 marked lines,
 * taking the index from 470 to 499 against a budget of 1200.
 *
 * **Exported so the carry disclosure can QUOTE it rather than retype it**
 * (`core/render.ts` · `function renderCarried(` · ~47). That line tells the
 * reader which marker to look for; a second literal there would be a second
 * spelling of one string, and the failure mode is the quiet one — a renamed
 * marker with a disclosure still pointing at the old word, both green.
 */
export const CARRIED_MARKER = ' · carried';

/**
 * Renders a single index-summary line for a normative item. Shared so
 * `select.ts`'s index-budget accounting never drifts from what `render.ts`
 * actually emits.
 *
 * **The `carried` marker is INSIDE this string, and that placement is the
 * requirement rather than a style choice.** This function is called twice for
 * every line: once by `select.ts` · `const cost = estimateTokens(renderIndexLine(line));` · ~379
 * to charge `budgets.index`, and once by `core/render.ts` ·
 * `const listed: string[] = normative.map((n) => renderIndexLine(n));` · ~112 to emit
 * it. A marker appended anywhere else would charge the budget for a line
 * shorter than the one delivered — mis-sizing an injection, which is the
 * failure §6a names. Both call sites pass the whole entry object, so both see
 * the same string by construction.
 */
export function renderIndexLine(
  entry: { id: string; type: string; title: string; carried?: boolean },
): string {
  return `- ${entry.id} · ${entry.type} · ${entry.title}${entry.carried ? CARRIED_MARKER : ''}`;
}
