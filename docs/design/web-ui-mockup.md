# The web UI mockup — what it is, and what it is not

**Artifact:** [`docs/design/web-ui-mockup.html`](web-ui-mockup.html) — a single self-contained
HTML file, no external assets. Open it in a browser.
**Authority it defers to:** `docs/superpowers/specs/2026-08-16-web-ui-design.md`.
**Plans that build the real thing:** `docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md`,
`…-web-ui-2-palette-and-work.md`, `…-web-ui-3-watch-and-ask.md`.

## What it is

A **visual reference** for the v2.0 web UI: layout, typography, colour tokens (light and dark),
screen composition, and the tone of every on-screen sentence. The owner reviewed and revised it.
Use it to see what a screen is meant to feel like before building it.

**Where it and the spec disagree, the spec wins.** This file was drawn once; the spec has been
amended four times against the shipped code. No claim in the mockup overrides a sentence in the
spec, and no plan task is satisfied by matching the mockup instead of the spec.

## What it is not

**It is a static mockup with no backend.** Every number, item id, session id, SQL result, git
hash and timestamp in it is **fabricated for demonstration**. `INV-prices-are-integer-cents`,
session `a3f9c1`, the 43-item corpus, the 0.55 ms p95 — none of these came from a running system.

**Three things in it are known NOT to be implemented, and were called out as such when it was
delivered.** They look functional. They are not:

1. **The global search box is decoration.** The input in the top bar (with the ⌘K hint) has no
   handler; typing in it does nothing, and no search feature exists behind it. The spec commits
   to no global search anywhere.
2. **The session picker only raises a toast.** Clicking `session a3f9c1` shows a toast naming
   what the real control would be (spec §3: `recentSessions(20)`, last-injection times, a
   labelled cold-session option, an empty-ledger state). None of that exists in the mockup.
3. **There is no keyboard navigation beyond focus rings.** The only keyboard affordance is
   `:focus-visible` outline styling. No shortcut — including the advertised ⌘K — is bound.

A mockup that implies capability the product does not have is this project's characteristic
defect (30+ recorded instances of asserting a property the code does not have). This note exists
so the mockup does not become the next one.

## Divergences from the spec, both directions

Compiled by reading the mockup's full source (markup and script) against spec §4. An implementer
building a screen should scan this list before copying anything from the mockup.

### The mockup shows things the spec does not commit to

- **Global search + ⌘K** (top bar) — no such feature in the spec. Decoration (above).
- **Theme toggle and dark palette** — the mockup ships a working light/dark toggle; the spec
  never mentions theming.
- **Toast notifications** — a mockup device; the spec specifies none.
- **A "Volume" chart on the *Injected now* screen** — the spec puts injection volume in the
  Watch status strip (§4), not on a Core screen.
- **A "Version" panel on Status** (mycontext / node / profile) — spec's Status is corpus counts,
  the draft queue and pending revisions.
- **A corpus claim on the Relations screen** — "Eight relation labels in this corpus sit outside
  `RELATION_TYPES`" is fabricated demo prose, not a fact about any corpus or a spec commitment.
- **Buttons with no behaviour**: the Capture screen's "Compose an edit to the existing rule",
  "Capture anyway" and "View" have no handlers; the coverage map's "Printable" button raises a
  toast instead of a print rendering (the spec requires a real print stylesheet).
- **Canned interactions**: the palette's "Run" search prints one hard-coded result; the query
  builder's SQL and result rows are hard-coded pairs; the budget simulator budgets over a
  hard-coded six-item list with a plain greedy loop — not `select()`, not `itemCost`.

### The spec requires things the mockup lacks

- **English/Hebrew mirroring (spec §3).** The mockup is English-only, has no language switch,
  and its CSS uses physical properties (`margin-left`, inline `padding-left`, `text-align:left`)
  — the spec makes a physical property a defect and requires logical properties from the first
  stylesheet. **Do not copy the mockup's CSS verbatim.**
- **The session selector contract (§3)**: default `recentSessions(1)[0]`, list of 20 with
  last-injection times, labelled cold-session option, empty-ledger state. Mockup: a toast.
- **Focus records in the audit stream (§4, §5).** The spec pins four record kinds; the mockup's
  filters are all/mutations/injections/hooks and its rows show only three kinds — no
  `focus-set`/`focus-clear`.
- **The bridge's conditional context number (§4b, §7).** The mockup's footer shows the context
  figure unconditionally. The spec shows it only when the status line bridge is installed, with
  a distinct "not yet known" state after a compact and an "unknown" fallback — neither state
  appears in the mockup.
- **Server lifecycle states (§2).** No exit banner ("the server has exited — restart with
  `mycontext ui`"), no heartbeat, no token handoff — the mockup has no server.
- **The Configure editor's full scope (§4).** The mockup previews `scopePolicy` and `agentEdits`
  only; the spec also requires budgets over all four tiers, `enabled`/`tier` shown as a diff of
  the governing set, and validation against `resolveConfig`'s enums.
- **The command palette as a builder (§4).** The spec requires composing commands from
  selections with real pickers and a live glob tester; the mockup shows one static capture
  summary and one canned search.
- **The query builder's filters (§4, Ask).** The spec requires structured filters for people who
  do not write SQL; the mockup offers only four predefined queries.
- **Help topics (§4, Learn).** The spec's `HELP_TOPICS` are categories, scope, capture,
  workflow; the mockup renders a fragment of `scope` only. (Its corpus cross-links *are* the
  right shape — that part matches the conditional pass.)
- **Budget simulation fidelity.** Only the jit tier is adjustable in the mockup; the Configure
  screen's budget preview covers all four tiers.

### Where the mockup is faithful and worth copying

The compose-don't-write treatment (every write is a command composed and copied, with the
on-screen note), the review queue's per-field staleness, the doctor grouping by finding code
with three levels distinct, the ego-graph constraints (no physics, explicit dangling-edge
rendering), the "as of last response" labelling, the strip's three-valued git vocabulary with no
ahead/behind, and the recorded exceptions on Status and Help — all match the spec's decisions
and give the implementer the intended rendering of them.
