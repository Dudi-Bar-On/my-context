/**
 * **The first-session sentence** — owner ruling D, 2026-09-21
 * (`reports/2026-09-21-v2-release-prompt.md` §1: *"keep the narrow spare
 * band, add the sentence"*), task B13 (`reports/2026-09-21-v2-release-runbook.md`).
 *
 * A brand-new corpus injects nothing at session start: `select`'s pinned tier
 * offers only items with `always: true` (`core/select.ts` ·
 * `const candidates = fresh.filter((i) => i.always);` · ~1563), and a fresh
 * `mycontext init` has none. A reader who has not met this product before has
 * no way to tell "nothing is pinned yet" from "pinning does not work here" —
 * both look identical from outside: an empty pinned tier and items arriving,
 * if at all, as index titles rather than full bodies. This sentence is the
 * difference, said once, at the two moments a person is in a position to act
 * on it: right after `init`, and while approving the first normative capture
 * a still-unpinned corpus can make.
 *
 * **Owner ruling D kept the narrow spare band rather than widening it.**
 * `select`'s pinned tier already offers its leftover room to governing items
 * that are not `always` (`GoverningSpill`, `select.ts` ~370-420) — so an
 * unpinned corpus is not entirely silent, it is merely not GUARANTEED. The
 * sentence names the guarantee a reader should not assume: nothing is
 * delivered in full at every session until something is pinned.
 *
 * ── ONE SENTENCE, ONE PLACE ─────────────────────────────────────────────────
 *
 * Printed at exactly two sites — `cmdInit` (after "initialized") and `cmdAdd`
 * (inside the normative-capture confirmation) — both importing this constant
 * rather than typing it. A third copy, even a byte-identical one, is the
 * defect `CLAUDE.md` names at the top of this repository: two places
 * asserting the same fact drift the day only one of them is edited.
 *
 * ── THE PREDICATE MATCHES THE SELECTOR'S OWN NOTION OF "PINNED" ────────────
 *
 * `nothingPinned` reads `item.always` — the exact field `select.ts`'s pinned
 * tier filters its candidates on (`const candidates = fresh.filter((i) =>
 * i.always);`, ~1563) — rather than re-deriving "pinned" from severity or
 * anything else this sentence has no business inventing an opinion about.
 *
 * **`status: 'active'` joins it, and this is not a re-derivation either: it is
 * the other half of the same line.** `select.ts` reaches `i.always` only after
 * `isEligible` (`status === 'active'`, category enabled) has already run, so a
 * DRAFT item carrying `always: true` never actually competes for the pinned
 * tier. This is not a theoretical gap — `mycontext init --pack` is the one
 * caller of `cmdInit`'s check that can hand it a non-empty item list, and
 * `pack/import.ts` writes every arriving item `status: 'draft'` while leaving
 * `always` exactly as the source authored it (`buildDraftItem`,
 * `applyOverwrite`: `always: item.always, status: 'draft'`, `import.ts`
 * ~439-483, ~463-483). A pack carrying a pinned rule therefore lands a DRAFT
 * that is still `always: true` on disk — nothing this corpus would actually
 * inject at a session start until a human promotes it — and a predicate that
 * stopped at `item.always` would silently suppress the sentence for a corpus
 * that has, in every sense `select` cares about, nothing pinned yet.
 */
import type { Item } from './types.ts';

/**
 * The sentence itself, printed verbatim at both sites — `cmdInit` (after
 * "initialized") and `cmdAdd`'s normative-capture confirmation — and pasted
 * into README §4 "Pinned" (both editions), so a reader meets the same words
 * wherever the product says them.
 */
export const NOTHING_PINNED_SENTENCE =
  'my_context: nothing is pinned yet, so governing items arrive as titles until one is pinned ' +
  'with --always or `mycontext pin`.';

/**
 * True when no item in `items` would actually reach `select`'s pinned tier —
 * see the header above for why `always: true` alone is not enough and
 * `status: 'active'` joins it.
 *
 * Takes the whole item list rather than a count, so a caller that already has
 * `Store.all()` in hand (both print sites do) passes it straight through with
 * no intermediate query of its own to drift from this one.
 */
export function nothingPinned(items: Item[]): boolean {
  return items.filter((item) => item.always && item.status === 'active').length === 0;
}
