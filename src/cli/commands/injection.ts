import { scopePolicyFor, type Config } from '../../core/config.ts';
import { emptyScopeInjection, RATIONALE_NOT_INJECTED } from '../../core/render-item.ts';
import { isEligible } from '../../core/select.ts';
import type { Item } from '../../core/types.ts';

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
 */
export function injection(
  item: Pick<Item, 'type' | 'status' | 'always' | 'scope'>, config: Config,
): { phrase: string; injected: boolean } {
  const no = (phrase: string) => ({ phrase, injected: false });

  // `isEligible` reads only `status` and the category's `enabled` flag, so the
  // narrowed shape above satisfies it; the cast is what lets this be asked of
  // a hypothetical item rather than a stored one.
  if (!isEligible(item as Item, config)) {
    if (item.status !== 'active') return no(`not injected (status "${item.status}")`);
    return no(Object.hasOwn(config.categories, item.type)
      ? `not injected (category "${item.type}" is disabled in this project)`
      : `not injected (category "${item.type}" is not in this project's config)`);
  }
  // `isNormative`'s test, spelled out: `config.categories[type]?.tier ===
  // 'normative'`. `Object.hasOwn` guards the prototype-pollution hazard a
  // bare index carries on a type of "constructor".
  const normative = Object.hasOwn(config.categories, item.type)
    && config.categories[item.type].tier === 'normative';
  // `RATIONALE_NOT_INJECTED` (render-item.ts) rather than a literal: several
  // previews have to say the same thing, and two previews describing one fact
  // in two wordings is this project's recurring defect class.
  if (!normative) return no(RATIONALE_NOT_INJECTED);
  // Normative and eligible, so the only remaining question is on what terms.
  // `always` is named first and in full for the same reason `review promote`'s
  // preview names it: it is the field with the largest injection footprint,
  // and a preview that omits it hides what the approval actually costs.
  if (item.always) {
    return { phrase: 'PINNED — injected in full at every session start, regardless of scope', injected: true };
  }
  if (item.scope.length) {
    return { phrase: `injected when work touches ${item.scope.join(', ')}`, injected: true };
  }
  // What an empty scope means is per-category config (`scopePolicy`, spec
  // §4b), and both halves of the answer change with it: under `global` and
  // `required` no scope is the WIDEST setting — nothing restricts the item —
  // while under `inert` it is the narrowest there is, the item is injected on
  // no file at all, and `injected: true` would overstate what an approval
  // costs. `emptyScopeInjection` (render-item.ts) is the one definition.
  return emptyScopeInjection(scopePolicyFor(config, item.type));
}
