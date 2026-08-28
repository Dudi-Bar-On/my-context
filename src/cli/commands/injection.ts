import { scopePolicyFor, type Config } from '../../core/config.ts';
import { emptyScopeInjection, RATIONALE_NOT_INJECTED } from '../../core/render-item.ts';
import { isEligible, type GateCode } from '../../core/select.ts';
import type { Item } from '../../core/types.ts';

/**
 * `injection()`'s answer: the sentence a human reads, whether the item is
 * injected at all, and the CODE for the gate that decided it.
 *
 * Named rather than spelled inline at each read-model surface that serves it,
 * so there is one shape to extend and not five near-copies of it — the defect
 * `ItemSummary` (`ui/read-model.ts`) is annotated for.
 *
 * **`injected === (gate === 'passed')`, always.** Both fields are written by
 * one branch each and cannot disagree, which is the whole reason the code is
 * added HERE rather than derived from the phrase by whoever reads it.
 */
export interface InjectionVerdict {
  phrase: string;
  injected: boolean;
  /**
   * The first gate this item fails, in `select`'s own order (`GateCode`,
   * core/select.ts), or `'passed'` when it fails none.
   *
   * **Three of the six can ever appear here, and that is the shape of the
   * question rather than a gap.** This function is asked about an ITEM and a
   * config, with no event, no focus and no budget in hand, so it answers the
   * gates that are properties of the item: `eligible` (rung 1), `tier`
   * (rung 2), and `scope` (rung 4) in its one item-level form — an unscoped
   * item under `scopePolicy: "inert"`, which `matchesScope` refuses on every
   * path there is. The other three are facts about a SELECTION, and each is
   * already machine-readable where it is decided: `focus` (rung 3) in
   * `Selection.focus.hidden`, `seen` (rung 5) in the caller's own `seen` list,
   * `budget` (rung 6) in `Selection.spilled`. A full ladder is composed from
   * those four sources — and from none of their sentences.
   */
  gate: GateCode;
}

/**
 * Whether an item is injected, and on what terms — the thing a human
 * approving a change to a governing item actually needs, because "active" and
 * "injected" are not the same in this system: a draft, or an item in a
 * disabled or rationale category, is active-looking but governs nothing, while
 * changing an `always` item's reach removes something from every future
 * session.
 *
 * It lives here rather than in either of its two callers because it is one
 * fact with a long history of being spelled differently in each place that
 * needed it. `mycontext supersede` owned this function first; `mycontext edit`
 * needs the identical answer — and needs it twice, for the item as it is and
 * for the item as the edit would leave it — and a second copy is precisely the
 * drift `SCOPE_UNRESTRICTED`, `RATIONALE_NOT_INJECTED` and `emptyScopeInjection`
 * were each centralised to end.
 *
 * The order of the checks mirrors `select` (core/select.ts) exactly, which is
 * the only way this phrase can be true:
 *
 *   const eligible   = merged.filter((i) => isEligible(i, config));
 *   const injectable = eligible.filter((i) => isNormative(i, config));
 *
 * `isEligible` is imported rather than re-derived. The TIER check has to be
 * here because `select` applies it BEFORE it ever looks at `always` or
 * `scope`: a scoped `decision` or `lesson` is eligible and still never
 * injected in full — it contributes an aggregate count to the session index
 * and nothing more. Reading `always`/`scope` first would print "injected when
 * work touches src/db/**" for an item that is injected nowhere, which is a
 * preview asserting a property the system does not have.
 *
 * It takes an `Item`-shaped value rather than an `Item` so a caller can ask
 * the question about an item it has not written yet: `mycontext edit` builds
 * the post-edit shape and asks this the same question about it, which is what
 * makes its "after" line a statement about the item that will exist rather
 * than a guess.
 *
 * **Every return writes the gate and the sentence together** (`InjectionVerdict`
 * above). The sentence is untouched — it is what the CLI prints and what a
 * human reads — and the code is a second FIELD off the same branch, not a
 * second reading of the item. The `no`/`yes` helpers are what make that
 * structural: a refusal cannot be added without naming the gate it fails, and
 * there is no second `if` chain here for a later edit to leave disagreeing
 * with this one.
 */
export function injection(
  item: Pick<Item, 'type' | 'status' | 'always' | 'continuity' | 'scope'>, config: Config,
): InjectionVerdict {
  const no = (gate: GateCode, phrase: string) => ({ phrase, injected: false, gate });
  const yes = (phrase: string) => ({ phrase, injected: true, gate: 'passed' as const });

  // `isEligible` reads only `status` and the category's `enabled` flag, so the
  // narrowed shape above satisfies it; the cast is what lets this be asked of
  // a hypothetical item rather than a stored one. Both refusals below are the
  // SAME gate: rung 1 is "active, not retired, category enabled", one gate
  // with two sentences rather than two gates with one each.
  if (!isEligible(item as Item, config)) {
    if (item.status !== 'active') {
      return no('eligible', `not injected (status "${item.status}")`);
    }
    return no('eligible', Object.hasOwn(config.categories, item.type)
      ? `not injected (category "${item.type}" is disabled in this project)`
      : `not injected (category "${item.type}" is not in this project's config)`);
  }
  // **The continuity tier, answered BEFORE the governance tier and not after
  // it.** `select`'s continuity tier draws from `eligible` and never consults
  // `isNormative` (see its comment there): continuity answers "what does the
  // next session need in order not to start over", which is orthogonal to what
  // governs, and the item the tier exists for is a `reference` — rationale by
  // catalogue. Asking the tier gate first is therefore not an optimisation but
  // the correctness of this function: below it, a rationale item returns
  // `RATIONALE_NOT_INJECTED`, and this preview would have told a reader that
  // the one item carrying the project's continuity guarantee is not injected,
  // on every screen that asks. The order here mirrors `select`'s.
  if (item.continuity) {
    return yes(
      'CONTINUITY — injected in full at every session start and after every compaction, '
      + 'against budgets.continuity, regardless of scope and of the governance tier',
    );
  }
  // `isNormative`'s test, spelled out: `config.categories[type]?.tier ===
  // 'normative'`. `Object.hasOwn` guards the prototype-pollution hazard a
  // bare index carries on a type of "constructor".
  const normative = Object.hasOwn(config.categories, item.type)
    && config.categories[item.type].tier === 'normative';
  // `RATIONALE_NOT_INJECTED` (render-item.ts) rather than a literal: several
  // previews have to say the same thing, and two previews describing one fact
  // in two wordings is this project's recurring defect class.
  if (!normative) return no('tier', RATIONALE_NOT_INJECTED);
  // Normative and eligible, so the only remaining question is on what terms.
  // `always` is named first and in full for the same reason `review promote`'s
  // preview names it: it is the field with the largest injection footprint,
  // and a preview that omits it hides what the approval actually costs.
  if (item.always) {
    return yes('PINNED — injected in full at every session start, regardless of scope');
  }
  if (item.scope.length) {
    return yes(`injected when work touches ${item.scope.join(', ')}`);
  }
  // What an empty scope means is per-category config (`scopePolicy`, spec
  // §4b), and both halves of the answer change with it: under `global` and
  // `required` no scope is the WIDEST setting — nothing restricts the item —
  // while under `inert` it is the narrowest there is, the item is injected on
  // no file at all, and `injected: true` would overstate what an approval
  // costs. `emptyScopeInjection` (render-item.ts) is the one definition.
  const empty = emptyScopeInjection(scopePolicyFor(config, item.type));
  // The gate is READ OFF the verdict that one definition already returned.
  // Under `inert` an unscoped item matches no path at all — that is
  // `matchesScope` (rung 4, `scope`) refusing it everywhere, and it is the one
  // form of the scope gate answerable with no event in hand. Re-asking
  // `scopePolicyFor` here to spell the same condition a second time is exactly
  // the second decision this field exists not to be.
  return { ...empty, gate: empty.injected ? 'passed' : 'scope' };
}
