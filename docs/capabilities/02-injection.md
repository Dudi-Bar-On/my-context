# Injection

Injection is the mechanism that decides, at the moment a context window begins (or is
rebuilt), which items in the corpus actually reach the model — in what form, in what
order, and at what cost. The corpus can hold thousands of items; a context window
cannot. Injection is the answer to "given a corpus too large to paste in whole, and a
budget that is a small fraction of it, what gets shown, and how does a reader know what
was left out?"

The engine lives in `src/core/inject.ts` (`buildInjectionResult`, 1,157 lines) and
`src/core/select.ts` (`select`, `fitToBudget`, `buildGoverningSpill`, 1,833 lines).
`inject.ts` is the orchestration layer: it resolves config, calls `select` once per
event, and renders the result into text. `select.ts` is the pure selection algorithm —
literally pure: `INV-select-is-pure` forbids it any I/O at all, so every fact it acts on
(budgets, focus, what was already `seen`, what a `restore` snapshot named) is handed in
as an argument, never read from disk inside the function. That purity is what lets the
same selector run identically from a hook, from the MCP `load_context` tool, and from
the web UI's preview screen (`docs/capabilities/08-web-ui.md`) without three
implementations drifting apart.

## The doors

A **door**, in this project's own vocabulary (`def-a-door`, the product rule store —
see `docs/capabilities/10-rule-store.md`), is *"a hook at which an agent's context
window BEGINS or is rebuilt, and therefore a place [delivery] must happen."* The
definition is explicit about what is *not* a door: `PreToolUse` "is not a door: it is
the earliest hook that runs AFTER every door" — it runs inside an already-established
window and carries no delivery obligation of its own. The doors, read from the hook
sources that actually call the injection path:

| Hook | File | Event passed to `select` | What it delivers |
|---|---|---|---|
| Session start (new/resumed/cleared) | `src/hooks/session-start.ts` | `'session-start'` | Full injection: pinned tier, continuity tier, index — via `buildInjectionResult` (shared verbatim with the MCP `load_context` tool, per that file's own header) |
| Session start after compaction | same file, `source: 'compact'` | `'session-start'` (`source: 'compact'` is the proxy) | The real re-injection point after a compaction — `post-compact.ts` itself does *not* inject; it is bookkeeping (audit records, `restoredFor` accounting) around the boundary that `SessionStart(source: 'compact')` re-opens |
| Subagent start | `src/hooks/subagent-start.ts` | `'subagent'` (inside `buildInjectionResult`) | The pinned tier plus the index, into a subagent's empty window — a subagent inherits none of the parent's context and no `SessionStart` fires for it, so this hook is, in the file's own words, the only thing standing between a dispatched subagent and "no knowledge of the project's own constraints" |
| A tool call, mid-session | `src/hooks/pre-tool-use.ts` (`select(...)` at line 308) | `'tool'` | The **JIT tier** — items scoped to the path the tool is about to touch, offered in two bands (`DEC-the-jit-tier-offers-path-scoped-items-first-in-two-bands`) — plus the product rule store's *assertion* pass (chapter 10), not delivery |

`PreCompact` (`src/hooks/pre-compact.ts`) is worth naming precisely because it looks
like a door and is not one for injection purposes: it writes a *snapshot* of what item
ids were in play (`injected: itemIds.map((id) => ({ id, tier: 'snapshot' }))`) so that
the re-injection at the next `SessionStart(source:'compact')` knows what to re-offer —
"a PreCompact snapshot injects nothing, but it decides what a session [receives next]"
(the file's own comment). The restore mechanism this feeds is covered in
`docs/capabilities/07-restore-and-handover.md`.

## The budget model

Every budget is expressed in **`estimateTokens` units — characters ÷ 4** (stated
directly in `budgets-write.ts` and `config.ts`'s validation error text, e.g.
`"budgets.${key} must be a positive integer (estimateTokens units — characters / 4)"`).
There are five budget keys, one per tier, defined in `src/core/config.ts`:

```ts
export const DEFAULT_BUDGETS: Budgets = {
  pinned: 6000, jit: 6000, restored: 8000, continuity: 2000, index: 1200,
};
```

This repository's own `.my_context/config.json` overrides all but `continuity`:

```json
"budgets": {
  "pinned": 30000,
  "jit": 32000,
  "restored": 48000,
  "continuity": 2000,
  "index": 8000
}
```

A budget is validated key by key: an unknown key is refused outright (typo protection —
`"budgets" for "budgets"` is named in the source as the concrete case this guards), and
a bad value throws rather than silently falling back — *"keeping the default silently
would mean the limit you set was never in force."*

Each tier's admissions are computed by `fitToBudget(bands, budget, tier, spareFrom)`,
which does **first-fit, not strict priority truncation**: candidates are sorted by
`byPriority` and admitted while they fit; an over-budget item is `continue`d past
(skipped), not treated as a hard stop, so a later, smaller, *lower*-priority item can
still be admitted after a higher-priority one has spilled. The comment in `select.ts` is
explicit that this is deliberate, for better budget utilisation — `spilled` is therefore
**not** a strict priority prefix of the candidate list.

## Pinning (`always: true`)

Pinning guarantees an item is offered at the `pinned` tier at **every** session start —
`mycontext pin <id>` is documented in `--help` as literally `edit --always=true`, and
`mycontext unpin <id>` as `edit --always=false`; there is no separate `pin` subcommand
in `src/cli/commands/` — both are aliases dispatched onto `edit`. Only a `normative`-tier
category may carry `always` (`TIER_UPDATES.normative` in `src/core/categories.ts`
declares it; the `rationale` tier's table has no `always` entry at all, so setting it on
a `decision` or `lesson` is refused).

```
mycontext pin CONST-zero-runtime-dependencies
mycontext unpin CONST-zero-runtime-dependencies --yes
```

Pinning is a promise the pinned tier is built to keep first and in full: the pinned
band's candidates are the `always: true` items, admitted before anything else touches
`budgets.pinned`. When one does not fit, that is not a quiet degradation — it is
`PinnedSpill`, read out loud in the injected block, written to stderr, and counted in
the audit log as `audit_item.role = 'spilled'` — "the alarm for a broken `always`
promise" (`select.ts`).

## The spare band

Ruling `TASK-the-pinned-tier-sits-half-empty-while-sixty-nine-governing` (owner,
2026-09-04) addressed a measured waste: on this repository's own corpus, `budgets.pinned`
at 30,000 with 37 `always` items costing 22,582 left 7,418 tokens of the pinned tier
completely unspent, while other *governing* items (categories in `GOVERNING_TYPES`:
`rule`, `constraint`, `invariant`, `instruction`, `requirement`, `standard`) that are not
pinned were falling through to a title-only index line for lack of room elsewhere.

The fix: when every `always` item already fit (`pinnedCost <= config.budgets.pinned`),
the pinned tier's *leftover* capacity is offered — as a second, lower band — to
non-pinned governing items:

```ts
const spare = candidates.length > 0 && pinnedCost <= config.budgets.pinned
  ? fresh.filter((i) => !i.always && governs(i))
  : [];
const result = fitToBudget([candidates, spare], config.budgets.pinned, 'pinned', 1);
```

Two properties make this safe rather than a second, silent meaning for `always`:

- **`always` itself is not widened.** It is offered first, in full, and the spare band
  only ever runs on a call where every `always` item already fit.
- **A spare-band miss is not a spill.** `fitToBudget`'s `spareFrom` parameter marks band
  index 1 (0-based) as spare: a candidate that doesn't fit there records **no** `Spill`
  and falls straight through to the index tier exactly as it did before the band
  existed — "it was offered leftover room, not promised a place, and the tier owes it no
  disclosure" (`select.ts`). Measured on this corpus, 2026-09-07: 69 of the 82 governing
  candidates offered the spare band did not fit it, and none of those 69 were recorded
  as pinned-tier spills.
- **Ordering inside the band is `byPriority`, not a most-spilled rank** — the ruling
  suggested ranking by how often an item had spilled historically, but `select` is pure
  and cannot read the audit log, so the band falls back to the same priority order every
  other band uses. On this corpus that puts `severity: hard` first, and all thirteen
  items the spare band actually admits are `hard`.

The measured effect, stated directly in the source (2026-09-07, `budgets.pinned` 30,000,
996 items): the spare band admits 13 governing items for the unspent 7,418 tokens, and
`governingSpill.titled` — the count of governing items reduced to a title only — **fell
from 82 to 69** the day the band landed. That number is offered as *the* measurement of
whether the ruling worked, not a side effect of it.

## What arrives in full versus as an index line — and `governingSpill.titled`

Every full-text admission goes into `Selection.full` as a `SelectionEntry` tagged with
its tier (`'pinned' | 'jit' | 'restored' | 'continuity'`, or `'index'` for the
title-only fallback). An item that misses every full-text tier but still fits
`budgets.index` is rendered as one line — a title, not a body — via `renderIndexLine`.
An item that misses the index budget too is not rendered at all.

`GoverningSpill` (`select.ts`, `Selection.governingSpill`) is the disclosure built
specifically to make that degradation impossible to miss, for the six governing
categories only:

```ts
export interface GoverningSpill {
  titled: string[];    // governing ids that reached this session as a title only
  untitled: string[];  // governing ids that reached this session in NO form at all
  cost: number;         // estimated tokens to deliver every id above in full
}
```

- **`titled`** — a governing item (`rule`, `constraint`, `invariant`, `instruction`,
  `requirement`, `standard`) that `governs(item)` is true for, was not in `chosenIds`
  (not admitted in full anywhere), but *did* land in the index tier as a bare line. The
  comment on the type is blunt about why this needs its own name rather than being left
  as an ordinary index-tier entry: *"A title names a rule; it does not tell you what it
  requires."* Rendered into the injected block (`render.ts`, `renderGoverning`) as:

  > *N governing item(s) below carry a title only — the body was not delivered: `id`,
  > `id`, +K more. A title names a rule; it does not tell you what it requires. Read each
  > with `mycontext show <id>` before treating it as satisfied.*

- **`untitled`** — a governing item that missed the index tier's own budget too: no
  title, no line, nothing. Measured on this repository's own corpus as empty at every
  budget the index has ever been set to, from 1,200 up to 470 (`select.ts`'s own
  comment) — but it is *computed*, not assumed empty, because a corpus that grows more
  governing items, or an operator who lowers `budgets.index`, can make it non-empty.
  Rendered with a `⚠` marker when non-empty, distinct from the plain `titled` sentence.

- **`cost`** is the estimated token cost of delivering everything in both lists in full
  — "the number a person deciding whether to raise a budget needs" — and, deliberately,
  it is **never budgeted itself**: like the focus and continuity-spill notes, this
  disclosure sits outside every tier's budget and outside `Selection.tokens`, because
  "a disclosure a budget could drop is not a disclosure."

`governingSpill` is `null` on a `Selection` precisely when nothing governing went
bodyless that call — every governing candidate was admitted in full, nothing governs at
all, or the event didn't run an index tier (a `'tool'` event never adds `'index'` to
`tiersRun`; a JIT-tier spill of a governing item is already covered by the ordinary
per-item spill note).

**Why `governingSpill.titled` is treated as *the* measure of injection quality**: it is
the one number that isolates exactly the failure mode injection exists to prevent —
something that *governs* the work arriving in a form that looks like it was delivered
(it has a title, a category, an id) but carries none of the actual constraint. Every
other budget number (tokens used, items admitted) can look healthy while this one is
high. It is the number the spare-band ruling cites as its own before/after
(82 → 69), and it is why a document about this project's *quality*, not just its
mechanism, would track this count over time rather than raw admission counts.

## Worked example — reading a real Selection

There is no standalone `mycontext injection` CLI subcommand (`injection --help` returns
`unknown command "injection"`); the underlying selection is exercised by the hooks
themselves, by the MCP `load_context` tool, and — for a human to inspect interactively
without triggering a real hook — by the web UI's **Injection preview** and **Budget
simulator** screens (`docs/capabilities/08-web-ui.md`), which call the same
`buildInjectionResult`/`select` pair described above against a simulated corpus and
budget, so nothing on that screen is a second implementation of this algorithm.

## Use cases

- **A large, mature corpus that has outgrown its budget.** Raising `budgets.pinned`
  is a deliberate, visible config change; the spare band is what keeps the *unused*
  remainder of an already-adequate pinned budget from being wasted while other
  governing items degrade to titles.
- **Auditing whether "the agent was told" is actually true.** Before this
  disclosure, an agent could report treating a rule as satisfied on the strength of
  having *seen its title* in an index line. `governingSpill.titled` makes that
  distinction explicit in the injected text itself, and `mycontext show <id>` is the
  named remedy.
- **Deciding whether to pin something.** An item that keeps showing up in
  `governingSpill.titled` across sessions is a candidate for `mycontext pin` — it is
  governing, it is not fitting the ordinary governing budget, and pinning puts it in
  the one tier evaluated first.

## What's NOT built / built but off

- There is no CLI command that prints a `Selection` directly; inspecting one requires
  either a live hook run (via the audit log, `docs/capabilities/09-cli-and-mcp.md`) or
  the web UI's simulated screens.
- The spare band's "most-spilled first" ordering, suggested in the owner's own ruling,
  is explicitly **not implemented** — `select.ts` states this is because ranking by
  historical spill count would require reading the audit log, which `INV-select-is-pure`
  forbids inside this function; doing so would need a signature change and "a decision
  for the owner, not something to smuggle in behind a filesystem read." The band
  currently falls back to plain `byPriority`.

## See also

- `./00-index.md` — index
- `./01-items-and-corpus.md` — what an item, a tier, and a category are
- `./08-web-ui.md` — Injection preview and Budget simulator screens
- `./10-rule-store.md` — doors, and the assertion pass at `PreToolUse`
