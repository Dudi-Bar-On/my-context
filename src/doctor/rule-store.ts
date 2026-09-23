/**
 * **The doctor line for the PRODUCT RULE STORE the doors would read right
 * now** — `TASK-two-checks-route-their-only-disclosure-to-a-surface-nobody`,
 * and it exists because of where the answer used to go rather than because
 * nobody was asking.
 *
 * Report 3 of the silent-failures review named the pattern (P5), quoted in the
 * item: *"The disclosure is routed to a surface nobody is on. Not silence
 * exactly — worse, because it reads as coverage. `assertDoor`'s
 * `catch { return 0 }` argues that reporting against it would blame the door
 * for the store's own damage — which `mycontext rules verify` is the surface
 * for. The attribution argument is sound; the routing sends the only
 * disclosure to a command that runs on nobody's schedule."*
 *
 * **Nothing here reverses that attribution.** `assertDoor` still returns a
 * count and never throws, `renderStoreIntegrity` still says its piece inside
 * the delivered block, and `mycontext rules verify` is still the command that
 * gives the verdict — it is this finding's own remedy. What is added is the
 * SURFACE: `mycontext doctor` is the thing a person runs, and until now a
 * doctor run said nothing at all about a rule store that could not be read,
 * could not be parsed, or could not be verified.
 *
 * ── WHY THIS IS ITS OWN MODULE AND NOT A LINE IN `checks.ts` ────────────────
 *
 * **Because spec §7 forbids the edge, and the ban is asserted.**
 * `test/rules/isolation.test.ts` walks the import closure of every module in
 * `CORPUS_MACHINERY` — `core/select.ts`, `core/inject.ts`, `core/item.ts`,
 * `cli/commands/ready.ts`, `core/store.ts` and **`src/doctor/checks.ts`** — and
 * requires that none of them reaches `src/rules/`: *"Every edge from the corpus
 * to the store is a place the store leaks — and an exception each surface
 * learns is exactly what spec §7 rejected in favour of a store the corpus has
 * never heard of."* Registering this check in `runChecks` would put
 * `checks.ts` one import from the store and turn that assertion red. The
 * boundary stands; this file sits on the other side of it.
 *
 * **`checkCliOnPath` is the precedent, one category over.** It is excluded
 * from `runChecks` because it *"answers a question about the MACHINE … not
 * about the corpus"*, and `cli/commands/doctor.ts` calls it directly. This
 * answers about the INSTALL — which store is on disk and whether it is the one
 * that shipped — and is called the same way, from `cmdDoctor` and from
 * `apiDoctor` (`src/ui/read-model.ts`), so both surfaces carry it and neither
 * re-derives it. `test/doctor/registry-membership.test.ts` records the
 * exclusion with that reason, beside `checkCliOnPath`'s own.
 *
 * ── WHY IT IS A DISCLOSURE AND NOT A COUNTED ROW ────────────────────────────
 *
 * It is report 3's own prescription for this family rather than a softening of
 * it — *"One `info` disclosure would preserve every stated property
 * (read-only, not counted toward the exit code) and end the silence."* Two
 * further reasons hold it there. The store is the PRODUCT's installed
 * infrastructure and doctor's counts are the CORPUS's worklist: a damaged
 * install is not a defect in this project's items, and mixing the two would
 * make a user's exit code depend on their npm tree. And `MYCONTEXT_RULES_DIR`
 * lets a caller point the doors at a store of their own — a maintenance draft,
 * a test fixture — so this check reports on a directory the reader may have
 * chosen deliberately. `partitionFindings`/`summarize`
 * (`cli/commands/doctor.ts`) route it out of `errors`/`warnings` on the
 * `about` field alone, and every character still prints.
 *
 * ── AND WHY THE THREE FAULTS ARE BRANCHED ───────────────────────────────────
 *
 * For the reason `checkGoverningSpillPressure` gives one module over about the
 * three projection states: "the store is broken" said three identical ways
 * would re-collapse, one level down, distinctions the code already keeps. A
 * store nothing can load delivered NOTHING at any door this session; a store
 * that loaded with entries missing delivered SOME, and the missing ones govern
 * nowhere; a store whose seal does not verify delivered entries nobody can
 * vouch for. Three different sentences for a reader, three different next
 * moves.
 */

import { normalizePosix } from '../core/paths.ts';
import { storeFault } from '../rules/deliver.ts';
import { PERSON } from './finding.ts';
import type { Finding, Remedy } from './finding.ts';

/**
 * `mycontext rules verify` — `copy` and not `run`, for `AUDIT_FILES`'s own
 * stated reason (./finding.ts): `PALETTE`
 * (`src/ui/public/lib/palette-defs.js`) carries no `rules` entry, so there is
 * nothing for the server to rebuild, and naming a nearby id would put a
 * different command behind a confirm that looked right.
 */
export const RULES_VERIFY: Remedy = { route: 'copy', argv: ['mycontext', 'rules', 'verify'] };

/** The code both the finding and its `about` carry — self-routed, as `governing_spill_pressure` is. */
export const RULE_STORE_CODE = 'rule_store_unverified';

/**
 * At most one `info` disclosure about the store a door would read right now.
 *
 * `stateRoot` is the corpus root, and it is passed rather than resolved here
 * for `loadRules`'s own stated reason about `workspaceIsMyContext`: the tier a
 * reader is entitled to is a fact about the caller, and a second place that
 * decided it would be a second answer.
 *
 * The directory is `resolveStoreDir`'s, never a second resolution. `store/8`
 * already fixed a version of this where the doors delivered directory X while
 * `rules list`/`verify` answered about the package's own, and a doctor line
 * answering about a third would be the same defect wearing a diagnostic's
 * clothes.
 */
export function checkRuleStore(stateRoot: string): Finding[] {
  const fault = storeFault(stateRoot);
  if (fault === null) return [];

  const say = fault.kind === 'unloadable'
    ? `could NOT be read at all, so every door this session ran delivered nothing from it and ` +
      `the missed-door assertion counted zero constants — an UNCOUNTED zero, not a measured ` +
      `one. ${fault.detail}`
    : fault.kind === 'partial'
      ? `loaded with ${fault.refused.length} entr(y/ies) REFUSED, so those constants are in ` +
        `force nowhere and no door said so: ` +
        `${fault.refused.map((r) => `${normalizePosix(r.path)} — ${r.error}`).join(' ')}`
      : `could not be verified against the manifest sealed with it — ` +
        `${fault.problems.length} problem(s): ` +
        `${fault.problems.map((p) => `${p.entry} (${p.why}): ${p.detail}`).join(' ')}`;

  return [{
    level: 'info', code: RULE_STORE_CODE,
    // Self-routed, exactly as `governing_spill_pressure` is: there is no
    // separate primary check whose reach this limits — it is the whole of what
    // this check has to say, said as a disclosure rather than as a worklist
    // row.
    about: RULE_STORE_CODE,
    remedy: RULES_VERIFY,
    message:
      `The product rule store a door would read right now — ${normalizePosix(fault.dir)} — ` +
      `${say} These constants OUTRANK every other source in a consuming session, which is why ` +
      `this is said here rather than left to a command nobody runs on a schedule. It is a ` +
      `disclosure about the INSTALL and not a defect in this corpus, so it counts toward ` +
      `nothing in the report above. \`mycontext rules verify\` gives the verdict and ` +
      `\`mycontext rules verify --restore\` puts back the bytes that shipped.`,
  }];
}


/**
 * **What both surfaces call** — `cmdDoctor` (`cli/commands/doctor.ts`) and
 * `apiDoctor` (`ui/read-model.ts`) — so the terminal and the screen carry the
 * same disclosure and neither re-derives it. A check reported in one and
 * absent from the other is the routing defect this whole item is about,
 * reintroduced one door over.
 *
 * The wrapper is the defensive stance `runChecks` takes with every check it
 * owns and `cmdDoctor` already takes with `checkCliOnPath`: a check that
 * throws must never crash the command reporting it. The fallback carries
 * `about` as well, so a failure of this check is routed exactly where its
 * findings are and still counts toward nothing — this module is closing a
 * silence, not opening a new one.
 */
export function ruleStoreFindings(stateRoot: string): Finding[] {
  try {
    return checkRuleStore(stateRoot);
  } catch (err) {
    return [{
      level: 'info', code: RULE_STORE_CODE, about: RULE_STORE_CODE,
      remedy: PERSON,
      message:
        `the product rule store check itself failed unexpectedly, so nothing here says whether ` +
        `the constants a door would deliver are the ones that shipped: ` +
        `${err instanceof Error ? err.message : String(err)}. ` +
        `\`mycontext rules verify\` answers the same question directly.`,
    }];
  }
}
