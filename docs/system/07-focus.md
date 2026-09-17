# Focus — narrowing what a session sees

`docs/system/00-index.md`

## 1. What it is, and what it is confused with

Focus filters what `select.ts` — the one injection path this whole product has — is willing to
offer into a session's context window, for as long as the filter stays set. It is not a second
injection path; it is a predicate applied inside the existing one. Three things it is easy to
confuse it with:

- **Config's category enable/disable.** Config (`.my_context/config.json`) is permanent, per-project,
  and committed to the repository. Focus is temporary, per-machine, and lives under
  `.my_context/state/`, which is gitignored.
- **A Claude Code session, despite the name.** Focus is *not* scoped to one Claude Code session — it
  is scoped to the **workspace**, and persists until it is explicitly cleared. This is a deliberate
  deviation from an earlier design note that wanted session scoping, made for a measured reason: at
  the moment focus is set, neither the CLI nor the MCP server has a session id it can trust — the
  environment variable a resumed session reports does not reliably match what the hooks for that same
  session receive.
- **The review queue or ingest.** Neither reads or writes focus state; narrowing what is injected and
  deciding what governs are unrelated mechanisms that happen to both live under "corpus machinery."

## 2. How it works, and why it cannot be explained without the injection budget

`mycontext focus <tag>… [--category x] [--scope glob] [--relations] [--preview] [--yes]` writes
`.my_context/state/focus.json`, holding exactly three axes: tags, categories, and scope. The code's
own comment calls this a deliberate limit — "the axes a person already thinks in" — because every
additional axis costs the disclosure sharpness described below.

Focus sits downstream of a mechanism it never replaces: which items are even candidates for a
session's context window in the first place, before any filter narrows them further. `README.md`
§4 names five such routes — pinned, just in time, restored, continuity, index — and the diagram
below is reproduced from that section, **the same source the copy in
`docs/capabilities/02-injection.md` §4 is drawn from.**

**This drawing has now rotted three times, and the useful thing is the pattern rather than the
latest repair.** First it was claimed *byte-identical* to README's, which was true for one commit.
Then the claim was weakened to provenance and the fence spliced — and README moved again within the
day, so the provenance claim stayed true while the picture underneath it quietly stopped matching:
the copy in this chapter drew `always: true?` unqualified where README now asks it *of normative
items only*, said just-in-time was injected *"once per session"* where README now says *"offered
again only if the item itself changed"*, promised *every* `continuity: true` item *"in full"* where
README now bounds it to items not already delivered and to `budgets.continuity`, drew one
no-injection branch where README draws two, and omitted the `scopePolicy: inert` case and the
rationale-tier branch entirely. Three of those five differences are quantifiers, which is the class
this directory keeps being wrong about.

The fence below was re-extracted from README with the product's own `mermaidBlocks` and spliced
programmatically on **2026-09-17**, and asserted equal to README's and to
`docs/capabilities/02-injection.md`'s afterwards — all three byte-identical at that moment.
**Nothing gates that.** `npm run check:diagrams` parses every fence in these documents and compares
none of them to each other, so the only durable instruction is the one that does not rot: **if this
drawing and README §4 ever disagree, README's is the one that is right, and this one is stale.**

One thing the picture draws that is *not* a route: the `rationale-tier items` branch. README's own
prose still says five tiers, and that branch is what reaches none of them — no full text, no index
line, a bare count per category. All five real routes are drawn, **continuity included**; what the
prose still owes the reader is that continuity is also one of the three things focus may never
hide, named again below.

**Focus narrows the whole eligible set, before any tier is computed — not one branch of this
diagram.** `select.ts:1511–1518` filters `eligibleAll` through `focusHides` once — the comment
above the filter is *"Focus narrows the eligible set, so every tier and the index inherit it from
one place"* — and every route below draws from what survives that filter. Pinned and continuity items are not protected by lying outside focus's reach; they are
protected by three explicit exemptions written *inside* `focusHides` (`select.ts:683–694`), which is
why `exemptHard`, `exemptAlways` and `exemptContinuity` exist at all. §5 below is the proof: the
three days in August 2026 when a focus hid six pinned items could not have happened if focus could
not reach the pinned route.

```mermaid
flowchart LR
  S(["A session starts"]) --> Q{"always: true?<br/>(asked of normative items only)"}
  Q -->|yes| PIN["<b>pinned</b><br/>injected in full"]
  Q -->|no| IDX["<b>index</b><br/>one line: id · type · title"]
  S --> RAT["<b>rationale-tier items</b><br/>no full text, and no line —<br/>a bare count per category"]
  S --> CONT["<b>continuity</b><br/>each continuity: true item not already<br/>delivered to this window or pinned,<br/>while budgets.continuity lasts"]
  F(["Claude is about to read<br/>or edit a file"]) --> G{"does the item<br/>declare a scope?"}
  G -->|"yes, and it matches —<br/>band 1, offered first"| JIT["<b>just in time</b><br/>injected in full; offered again only<br/>if the item itself changed"]
  G -->|"no, and the category's scopePolicy<br/>is not inert — band 2, offered<br/>whatever band 1 left, first-fit"| JIT
  G -->|"no, and scopePolicy: inert —<br/>it matches no path at all"| NO["nothing — the item stays<br/>out of the way"]
  G -->|"yes, no match"| NO
  C(["The session is compacted"]) --> RES["<b>restored</b><br/>what was in context before"]
  C --> PIN
  C --> IDX
  C --> CONT
```

*(Reused from `README.md` §4, which owns this diagram — every route here also competes against a
byte budget per tier, and what does not fit spills rather than silently dropping; that packing
mechanism, and every number in it, belongs to `docs/capabilities/02-injection.md`, not to this
chapter.)* Focus is a predicate `select.ts` applies **inside** this map, not a sixth route beside it
— it can hide something these five routes would otherwise have offered, and, as the three
exemptions below show, three kinds of item it is not allowed to hide even then.

`select.ts` applies the filter, and the quantifier is the opposite of the one a reader expects:
**an item is in focus only if every non-empty axis has at least one match, so it is hidden if it
fails _any_ of them.** `matchesFocus`'s own docblock (`select.ts:631`) states it in four words —
*"AND across axes, OR within one"* — and gives the worked case: `--tag billing --tag invoicing
--category rule` means *"a rule tagged billing or invoicing, which is what a person means when they
type it"*. The difference is most of the corpus. Under an OR reading, `--tag billing --category
rule` would hide only what is neither tagged `billing` nor a `rule`; under the code it hides
everything that is not a `billing`-tagged `rule`.

But three classes of item are never hidden regardless of match, and this is the part that cannot be
explained by focus alone — it is a fact about the injection budget (`docs/capabilities/02-injection.md`)
that focus has to respect rather than override:

- **`severity: hard`** items — must not be violated, so focus cannot make one disappear.
- **`always: true`** items — must not fall out of context, so focus cannot make one disappear either.
- **`continuity: true`** items — must survive to the next session.

Each exemption is tracked and reported as its own list (`exemptHard`, `exemptAlways`,
`exemptContinuity`) rather than folded into one undifferentiated "kept anyway" bucket, because each
is kept for a different reason and a reader narrowing their session needs to know which one applies
to a given surviving item.

Focus also never silently *refuses* to hide something because doing so would strand a relation — it
**discloses** the cost instead, listing every dangling edge where one end would be hidden and the
other would not, and lets the person setting focus decide. `--preview` runs the identical computation
without writing anything; setting or clearing focus for real requires `--yes`, the same
approval-boundary convention this project uses everywhere a command changes state.

```mermaid
flowchart TB
  F["mycontext focus tags/categories/scope"] --> FJ[".my_context/state/focus.json<br/>workspace-scoped, gitignored"]
  FJ --> SEL["select.ts<br/>matchesFocus / focusHides"]
  SEL -->|"fails ANY non-empty axis<br/>— AND across axes, OR within one"| HIDDEN["hidden from injection"]
  SEL -->|"severity:hard, always:true,<br/>or continuity:true"| KEPT["injected anyway,<br/>reported as exemptHard/Always/Continuity"]
  SEL -->|"a kept item's relation<br/>points at a hidden one"| DANGLE["disclosed as a dangling edge,<br/>never silently dropped"]
```

## 3. Real output

The workspace this chapter was written against currently has no focus set. Both lines below are
printed; an earlier draft of this chapter kept the first and dropped the second, which is the line
that tells a reader what to do next:

```
$ mycontext focus --show
my_context: no focus is set — every eligible item is injectable.
Set one with `mycontext focus <tag>`, or see `mycontext focus --relations`.
```

Previewing a narrower focus shows the disclosure described in §2 directly:

```
$ mycontext focus --category rule --preview
...
1 continuity item(s) do not match this focus and are injected anyway...
6 load-bearing relation(s) dangling — one end is hidden, the other is not:
  DEC-index-lists-only-what-is-not-already-injected (hidden)
    constrains → INV-nothing-is-dropped-silently
  ...
53 severity:hard item(s) do not match this focus and are injected anyway — focus never hides one:
  CONST-evidence-must-cite-a-captured-record-id
  ...
Apply it by running the same command without --preview.
```

*(Real output against this repository, 2026-09-17 — **re-run while this chapter was repaired, and
every retained line still reproduces byte for byte**: 6 dangling relations, that same first pair,
53 `severity:hard` items with `CONST-evidence-must-cite-a-captured-record-id` at the head of the
list, and that closing sentence. This is the one block in `docs/system/` that marked its own cuts
from the start, and it is the one block that survived a verifier unchanged — the `...` lines here
stand for the hidden list, a 7-item pinned block, and the tails of two enumerations. **The hidden
list is the figure that moves:** the previous pass recorded 1,129 items; the same command on
2026-09-17 prints `114 item(s) in focus, 1135 hidden by focus`. The pinned block is still 7, the
dangling count still 6 and the `severity:hard` count still 53. A `--category rule` focus narrowing
to nearly nothing but `rule` items is expected to exempt most of the corpus, which is exactly what
the disclosure above shows happening.)*

## 4. Who may trigger it, and through which door

**CLI**: `focus`, with every axis plus `--show`, `--clear`, `--preview`, `--relations`, `--json`.
**MCP**: `focus_context`, in `src/mcp/tools/focus.ts` — it calls the same `readFocus`/`setFocus`/
`unsetFocus`/`focusReportLines` functions the CLI command calls, rather than reimplementing the
predicate. **UI**: a title-bar popover (`#focuspop` in `app.js`) that **composes a command rather than
writing directly** — it builds the literal `mycontext focus …` text and hands it to the UI's
Compose-and-Execute control, the same no-direct-write pattern the rest of this read-only UI follows
(`docs/capabilities/08-web-ui.md`).

## 5. What is known to have been wrong here, and the fix that is now the design

`KNOWN-a-focus-silently-overrides-always-true-so-a-pinned-item.md` (status `deprecated` as of
2026-09-03 — resolved, kept in the corpus as a record) documents the defect that produced the
exemption mechanism in §2: a focus set on 2026-08-24 silently hid six `always: true` items for three
days — including, worth stating plainly, the instruction that tells a session to use this tool's own
corpus at all. **The corpus hid the instructions that would have said it was not being followed.**
`DEC-a-focus-may-not-hide-a-pinned-item-focushides-exempts-always` is the ruling that followed, and
the `exemptAlways` mechanism in `select.ts` is its enforcement — confirmed live in the current code
rather than merely claimed fixed.

**A second claim was flagged open by the previous pass and is now settled: the comment is stale.**
`focus.ts:41` says *"`mycontext focus --show` and `doctor`'s `focus_active` check both report"* an
active focus. `focus_active` appears exactly once in the whole of `src/` — in that comment. Widened
from the name to the subject, `src/doctor/` has seven modules and the only occurrences of the word
"focus" in any of them are in `checks.ts:1417`, `:1447` and `:1464`, all about a tag being
invisible to `mycontext focus <prefix>:<field>` and none of them a check on focus state. So there
is no doctor check for an active focus under that name **or any other**, and the earlier "either
the check exists under a different name, or the comment is stale" can be closed on the second
branch. The residual is in `focus.ts`, not here: a reader of that comment will look for a check
that does not exist.

**And `mycontext focus --show` does report it**, which is the half of the comment that is true —
verified by running it (§3).

## 6. Code map

| File | Lines (2026-09-17) | What it owns |
|---|---|---|
| `src/core/focus.ts` | 658 | `readFocus`/`writeFocus`/`setFocus`/`unsetFocus`, `isLoadBearing`, `danglingEdges`, `focusReportLines` — the most heavily commented of the three chapters in this trio, with roughly 45 lines on the workspace-scoping decision alone |
| `src/cli/commands/focus.ts` | 294 | The CLI command |
| `src/mcp/tools/focus.ts` | 119 | The `focus_context` MCP tool |
| `src/core/select.ts` | 1,851 | `matchesFocus` (`:637`), `focusHides` (`:683`), `focusMatchesScope` — the actual filter, applied to `eligibleAll` at `:1515–1518` |
| `.my_context/state/focus.json` | — | The current focus, if any; gitignored, workspace-scoped |

## See also

- [`docs/tutorials/narrowing-a-session-focus.md`](../tutorials/narrowing-a-session-focus.md) — the
  beginner walkthrough this chapter builds past
- [`docs/capabilities/02-injection.md`](../capabilities/02-injection.md) — the budget and the doors
  focus narrows without replacing
- `KNOWN-a-focus-silently-overrides-always-true-so-a-pinned-item` — the resolved defect behind §5
