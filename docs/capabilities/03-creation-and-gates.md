# 3. Creation and the gates

[← Index](./00-index.md) · See also: [1. Items and the corpus](./01-items-and-corpus.md) · [13. Testing discipline](./13-testing-discipline.md)

An item enters the corpus through a small number of **authored surfaces** —
`mycontext add`, `mycontext edit`, the MCP `create_item` / `update_item`
tools, and `mycontext lesson-accept`. Two independent gates sit on those
surfaces and can refuse a write outright. This chapter covers both gates,
the flags that answer them, how content identity is checksummed, how
retirement (supersession) is recorded, and the two commands that audit and
repair the corpus's own bookkeeping: `doctor` and `repair`.

Everything below is read from `src/core/summary-gate.ts`, `src/core/mutate.ts`
(the contradiction gate, ~L395–580), `src/cli/index.ts` (the `add` command,
~L820–1010), `src/cli/commands/edit.ts`, `src/cli/commands/supersede.ts`,
`src/cli/commands/repair.ts`, `src/core/content-hash.ts`, `src/core/rebuild.ts`,
and `src/doctor/checks.ts`, plus a real `mycontext doctor` run against this
repository's own corpus on 2026-09-12.

## Why gates exist at all

Both gates answer the same worry from two different directions: a normative
item is injected into every session's context and treated as governing, so a
bad write is not a typo somewhere in a file tree — it is a false instruction
an agent will act on. The **summary gate** stops an item from drifting out of
sync with its own one-line description of itself. The **contradiction gate**
stops a second, conflicting instruction from quietly standing beside one
already in force. They are deliberately independent mechanisms living at
different depths of the write path (see "Why two different depths" below) —
neither substitutes for the other.

## The summary gate

**What it is.** Every item may carry a `summary` field — "one plain sentence
saying what this item IS and why it matters, for a reader who does NOT know
this codebase" (`src/core/validate.ts`, `SUMMARY_MAX_CHARS` = 250 chars). The
gate keeps that sentence honest against the content it summarises, at two
moments:

1. **On creation** (`summaryRequiredAtCreate` / `summaryAtCreateRefusal`,
   `summary-gate.ts`) — a normative item cannot be born without a summary,
   unless the omission is explicit.
2. **On edit** (`summaryRequired`, same file) — if the edit would change what
   `itemSummaryBasis` (`content-hash.ts`) considers the item's *meaning*
   (`SUMMARY_BASIS`, e.g. `body`), the new/updated text must arrive with a
   fresh summary in the same call, or the edit is refused.

**Why it exists.** The gate's own header states the origin directly: an
owner ruling — *"everytime body is changed, the summary should too, based on
the new body"* — that nothing in the codebase can enforce by generation
(zero runtime dependencies, no model access: summaries are written by a
person or an agent as ordinary prose). So it is enforced by **refusal at the
one moment the replacement is cheap** — whoever is editing has just read the
item and is holding the new text.

**Why the trigger is derived, not a flag list.** The comment in
`summary-gate.ts` is explicit that an earlier design used a hand-maintained
list of flags that invalidate a summary (`--body`, `--extra`, …), and states
this was "the defect this repository has measured eight times." The current
design instead builds the item *as the edit would leave it* and hashes it
with `itemSummaryBasis`; whatever `SUMMARY_BASIS` classifies as
"summarised" is what can trigger the gate, and that classification lives in
exactly one place.

**Why creation needed its own gate, not just the edit gate.** The same
comment explains a historical hole: `summaryRequired` waived the requirement
whenever `item.summary === null` ("nothing to invalidate"), and `create_item`
documented `summary` as optional — so an item born with no summary could
never afterwards be *required* to get one; the edit gate never triggers on a
field that started empty. Seventeen items reached that state with no
enforced path out. The fix moved the requirement to the one moment the
caller is holding the text and the item does not yet exist:
`summaryRequiredAtCreate`.

**`--summary-omitted`, the explicit escape hatch.** Rather than silently
allowing "no summary," the gate requires the *absence* to be asserted:
`--summary-omitted` (stored as `summary_omitted: true`) tells the gate "a
person considered this and chose not to write one," and it is recorded so
that "nobody wrote one" is visible in the audit trail rather than assumed.
Passing both `--summary` and `--summary-omitted` is refused
(`summaryOmittedRefusal`) as a contradiction of its own — you cannot both
supply a summary and assert you skipped it.

**A related repair path: re-affirmation.** A summary can go *stale* (fail to
match the current basis) even though it is still correct — for example, a
typo fix in the body that does not change meaning. `mycontext edit --summary
"<the same text>"` used to report "nothing to change" (false: the stamp
needed updating even though no field read differently). `summaryReaffirmed`
opens a third door instead of widening the gate: reproducing the sentence is
allowed as an explicit re-affirmation, which is more expensive to fake than
a silent bypass would be — "the hatch is a flag and a flag can be typed over
a whole corpus without a word being read, while a re-affirmation can only be
spelled by reproducing the sentence."

**Which callers the gate does and does not see.** It is imported by exactly
five authored surfaces: `mycontext add`, `mycontext edit`, the MCP
`create_item` / `update_item` tools, and `mycontext lesson-accept`. It is
deliberately *not* called from the shared internals `createItem` /
`updateItem`, so mechanical callers with no person at the keyboard —
`ingest`, pack import, `inbox-promote` — are not blocked by a gate meant for
authored prose. `lesson-accept` was added to the list only on 2026-09-12:
until then, accepting a staged rule candidate could create an active,
governing `rule` with no summary and no recorded omission, which doctor's
`summary_absent` check caught the same day it happened
(`TASK-lesson-accept-creates-a-rule-with-no-summary-so-the-accept`).

**What it does not cover.** A hand-edited `.md` file bypasses every command
boundary entirely — Markdown is the source of truth and hand-editing is
permitted. The gate can only *prevent* the case at a command boundary; it
cannot *see* a file edited outside my_context. That is what `doctor`'s
`summary_stale` check (`checkSummary`, `src/doctor/checks.ts`) exists for
instead — see "Doctor" below. The two together — gate to prevent, doctor to
detect — are what closes the hole; neither alone does.

**How to use it.**

```
mycontext add rule "Never bypass the summary gate" --body "..." --summary-omitted
mycontext edit RULE-some-id --body "new text" --summary "One plain sentence about what changed."
mycontext edit RULE-some-id --summary "Same sentence as before, verbatim" # re-affirmation
```

**Use case.** An agent is asked to correct a typo in an existing `constraint`
item's body. Because the fix changes the hashed content, `mycontext edit`
refuses the write until a `--summary` accompanies it — forcing either a
genuine re-summarisation or an explicit re-affirmation, so the corpus never
silently accumulates items whose one-sentence description no longer matches
what they say.

## The contradiction gate

**What it is.** Before any content write lands (`createItem` / `updateItem`
in `src/core/mutate.ts`), every normative candidate item is compared against
every other item already governing, using a **lexical overlap score**
(Jaccard-based; see `contradictionBasis`). If the new content scores above
threshold against something already governing, the write is refused unless
the caller has already *dispositioned* the pair.

**Why it sits one layer deeper than the summary gate — the "two different
depths" referred to above.** The header comment in `mutate.ts` states this
explicitly, citing the owner's ruling (design spec 2026-09-07, §2 §4 §5 §7):
a mechanical caller that would file a second live rule against a standing
one is *exactly* the case this gate exists for, so a caller "must either
carry dispositions decided earlier or fail cleanly naming what to settle,"
and a bypass for internal callers "would defeat §2 entirely." So unlike the
summary gate, the contradiction gate lives inside `createItem` /
`updateItem` themselves — the two functions that are the *only* write paths
for item content — so every route (`add`, `edit`, `create_item`,
`update_item`, `inbox-promote`, `lesson`, `lesson-accept`, `ingest-apply`, a
promoted revision, pack import) passes through it with no way around.
`test/core/contradiction-gate.test.ts` walks the runtime import graph of
every entry point to prove none of them reaches `persist` without going
through the gate.

**The two answers: `--distinct` and `--supersedes`.** When the gate flags a
candidate pair, the caller must disposition it one of two ways:

- `--distinct <id>` — "this capture and that item can BOTH be true" (they are
  not actually in conflict; the overlap was lexical only). Repeatable — a
  single write can raise up to five candidates, and `--distinct` can be
  passed multiple times so dropping the second flagged pair does not
  silently settle only the first while reporting all as settled.
- `--supersedes <id>` — "this item REPLACES that one" (scalar: an item has
  exactly one successor). This both answers the gate and records a
  supersession edge (see below).

Every disposition is appended to
`.my_context/.verdicts/contradiction.jsonl` as a verdict row — recorded
**after** the write lands, never before, so a refusal upstream ("nothing was
written") can never be contradicted by a verdict for a write that failed.

**The gate is lexical, and says so.** Both `mycontext doctor`'s own
contradiction findings and the CLI refusal text state the same limit
explicitly: *"Nothing in this product can tell you whether these conflict:
the match is LEXICAL, and two items that AGREE score exactly as high as two
that conflict."* The gate raises candidates for a human (or an agent acting
on the human's behalf) to rule on; it never rules on meaning itself.

**Verdicts survive an unrelated edit — "no-lapse."** A verdict is keyed to
the content hash of each side (`basis`) at the moment it was ruled. If an
item's content moves in a way that would move its `contradictionBasis`, a
verdict about it would normally lapse (the recorded basis no longer matches
the item). But an edit accompanied by `--summary` re-affirmation, in
particular, does not always change *meaning* — so `carryVerdicts` in
`mutate.ts` re-stamps (not re-rules) every verdict that is still live at
edit time: only pairs whose *other* side is unchanged are carried forward,
`ruledAt` keeps the original ruling date, and the row is marked `carried` so
the log always distinguishes an actual ruling from a re-stamp. Without this,
a typo fix would re-raise every contradiction a person had already settled
— "the wall §7 exists to prevent."

**How to use it — worked example from this repository's live corpus.**
`mycontext doctor` currently reports 6 open `contradiction_pair` findings
(all acknowledged, none superseded). One real example, verbatim from
`doctor --json` on this repository on 2026-09-12:

```
DEC-the-ui-serves-the-corpus-through-its-own-route-rather-than:
  may contradict REQ-a-repository-document-is-viewable-in-the-ui-only-once-it-is
  (requirement · hard), which also governs.
  Overlap 0.49, of which jaccard 0.34 — the lower the jaccard, the more of the
  score is the two items' LENGTHS rather than their subject.

    DEC-...: "The console can now open the project's own knowledge files,
    through a separate door with its own lock, and the rule that said it
    already could is corrected."
    REQ-...: "A document becomes viewable only once it has been brought into
    the collection; sitting somewhere in the project is not enough on its own."

  If both can be true, record it with `mycontext ack DEC-... contradiction_pair`;
  if one replaces the other, `mycontext supersede <the wrong one> --by <the right one>`.
```

Here the two items were judged compatible (both govern; the finding is
acknowledged, not superseded) — the DEC records a design change, the REQ a
standing precondition; they are not actually in conflict.

**Use case.** An agent is asked to add a new `constraint` that happens to
restate, in different words, a `constraint` already governing the same file
paths. `mycontext add` refuses the write and names the existing item's id
and overlap score. A human resolves it: if the new wording only clarifies
the old rule, `--distinct` records that they coexist deliberately; if the
new wording is meant to replace the old one outright, `--supersedes` does
both jobs — answers the gate and starts the item's life as the old one's
successor.

## Checksums and content identity

**What is hashed.** `computeItemChecksum` (`src/core/item.ts`) and
`itemSummaryBasis`/`contradictionBasis` (`content-hash.ts`) all hash a
canonicalised `ContentShape`: `type`, `title`, `body`, `steps`, `severity`,
`always`, `continuity`, `scope`, `tags`, `observations`, `relations`,
`extra` — deliberately excluding bookkeeping fields (`id`, `status`,
`origin`, provenance, lifecycle dates, storage location, `request`). Unordered
collections (`scope`, `tags`) are sorted before hashing; ordered ones
(`steps`, `observations`, `relations`) preserve command-line order because,
for a `procedure`, "the order IS the knowledge." `severity`/`always`/
`continuity` are included on purpose — they are treated as normative content,
not metadata, so flipping an item from `soft` to `hard` is not a silently
swallowed no-op.

**When it's checked.** Every write path stamps a checksum
(`writeItem`). On every index rebuild, `loadLayer` (`src/core/rebuild.ts`,
~L200–230) recomputes each item's checksum from its file and compares it to
the recorded value. A mismatch produces one of two distinguishable
`LoadError`s:

- **`kind: 'migration'`** — the recorded checksum was computed under an
  older `CHECKSUM_BASIS_VERSION`; the content is not implicated and the
  disagreement is expected until re-stamped. Reported by `doctor` as
  `checksum_basis_migration` (warn), with remedy = run `mycontext repair`.
- **Real mismatch** — the file's content no longer matches its recorded
  checksum: an edit outside my_context, or content my_context itself could
  not round-trip. Reported as a corpus load error (drives `doctor`'s
  non-zero exit code).

An item with **no** recorded checksum (hand-authored, or written before the
field existed) has nothing to compare against and is silently exempt from
this check — see `repair` below for why that matters.

**`mycontext repair [--yes]`.** Re-stamps the checksum of every *project*-layer
item whose recorded checksum disagrees with a fresh hash of its current
content (`needsRestamp`, `repair.ts`). It explicitly **does not** touch
global-layer items with the same disagreement (`skippedGlobal` — writes to
non-project items are refused elsewhere), and it explicitly **does not**
touch items with no recorded checksum at all — re-stamping one would rewrite
a file nobody complained about, and (per the command's own printed warning,
`HONESTY` in `repair.ts`) "a hand-authored file is exactly where a rewrite
… is most likely to reorder or drop something the author put there."

The command prints an explicit honesty statement before its confirmation
prompt, worth quoting because it states the tool's own limits plainly:

> "What re-stamping does: it recomputes each item's checksum from the text
> now in its file, so the recorded checksum agrees with the content again…
> What it does NOT do: recover anything. If content was lost or mangled
> when the item was written, that loss is already on disk — re-stamping
> certifies the damaged text and removes the stale checksum, which may be
> the only remaining evidence that the file was ever altered."

The comment cites a real incident from this repository's own corpus: one
item (`OPENQ-how-do-filters-respect-dependencies`) had an observation
silently truncated by a parsing defect at write time; the file was
internally self-consistent, and the *only* evidence anything had been
altered was the stale checksum. Running `repair` on it would have
re-stamped that evidence away; instead it was fixed by rewriting the
observation directly and re-persisting it — a different act from what
`repair` performs.

**Verified against this repository's corpus, 2026-09-12:** a real
`mycontext doctor --json` run reports **zero** `checksum_mismatch` and
**zero** `checksum_basis_migration` findings — this corpus is currently
clean on both counts. (It does report two `source_drift` findings, which is
a different, unrelated check — see below.) `repair` was **not run** for this
document, since it is a state-changing command and there is nothing for it
to fix right now.

## Supersession edges

**What it is.** `mycontext supersede <retired-id> --by <replacement-id>
[--reason <text>] [--yes]` retires an item in favour of a named replacement,
recording the relationship in both directions. Per its own header comment,
this command exists to close a real gap: before it, retiring an item had "no
human route at all" — `supersedeItem` existed as a function but its only
caller was the `supersede_item` MCP tool, which correctly refuses when a
non-human origin tries to retire a governing normative item (that is a human
decision) — leaving the human with no command of their own. The only
remaining route was hand-editing the file and running `repair --yes`, which
the project's own documentation calls out as "leaving no evidence it
happened."

It also fires as the direct answer to the contradiction gate's
`--supersedes` flag on `add`/`edit` — the same mechanism, reached from two
different moments (proactively retiring something old, or resolving a
conflict at the moment a new item is created).

**What it prints before acting.** `testsRestingOn`/`restingTestsLine`
(`src/core/tests-resting-on.ts`) is consulted so the operator is told, before
confirming, which tests declare that they rest on the item being retired —
tying this command directly to `RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none`
(see chapter 13). A supersession that silently orphaned a test's stated
basis would be exactly the defect that rule exists to prevent.

**How to use it.**

```
mycontext supersede DEC-old-approach --by DEC-new-approach --reason "measured wrong on 2026-09-07"
```

**Use case.** An ADR is revisited and reversed. Rather than editing the old
ADR's text in place (which would erase the historical record of what was
once decided and why), `supersede` retires it and links it forward to the
new decision — both items remain readable, and any test that cited the old
one is surfaced for review at the moment of retirement.

## Doctor

**What it is.** `mycontext doctor [--quiet] [--full|--short|--summary]
[--json]` is the corpus's self-check: index freshness, orphaned files,
source drift, dead scope globs, contradiction candidates, checksum health,
and more — implemented as a fixed battery of checks (`runChecks`,
`src/doctor/checks.ts`) plus the checksum-migration pass described above.

**Real output, this repository, 2026-09-12** (`mycontext doctor --summary`):

```
my_context doctor: 1 error(s), 55 warning(s), 49 note(s) across 105 finding(s).
my_context: 47 of the finding(s) above are ACKNOWLEDGED: a person read each one and ruled on it.
  They are still reported and still counted in the numbers above — acknowledging a finding
  distinguishes it, it does not silence it, and editing the item lapses the
  acknowledgement so the finding is open again. `mycontext ack <id> --list` shows the
  state per item.
```

The one `error`-level finding, from the same run, is a missing source file
for a `reference`-category item's snapshot:

```
source_missing (1)  [error]
  TASK-the-guard-that-excludes-lanes-from-reaping-the-server-rests: source document
  "C:/Program Files/Git/reap-body.md" could not be read (missing, unreadable, or
  outside the repository). ... still holds the snapshot taken when it was captured,
  and that text is unchanged — what cannot be checked is whether it is still current.
  Restore the file, or retire ... with `mycontext supersede`.
```

The finding codes present in this run, by count (`doctor --json`, grouped):
`task_unverified` (50), `body_disagrees_with_meta` (24), `state_unaudited`
(7), `contradiction_pair` (6), `citation_form` (5), `open_question_blocks`
(5), `reference_no_source` (3), `source_drift` (2), `body_ends_unfinished`
(1), `source_missing` (1), `tag_projection_unprojected` (1).

**Acknowledgement, not silencing.** `mycontext ack <id> <code> [--clear]`
records that a person has ruled on a finding, anchored to the item's content
*as it stands* — editing the item afterwards lapses the acknowledgement, so
the finding reopens. Doctor's own summary output states this design choice
explicitly rather than leaving it implicit: an acknowledged finding is still
printed and still counted, "acknowledging a finding distinguishes it, it
does not silence it."

**Use case.** Run `mycontext doctor` after a batch of edits (by a human or
an agent) to catch drift before it compounds: a checksum that has fallen
behind a source file, an item whose body now contradicts its own frontmatter
status, a new item that lexically overlaps something already governing and
was never dispositioned.

## What's NOT built / built but off

- **No automatic contradiction resolution.** The gate can only detect
  lexical overlap and ask a human to rule; it explicitly cannot judge
  meaning — this is stated in the tool's own refusal text, not merely
  inferred here.
- **The summary gate cannot see hand-edited Markdown.** It only fires at
  the authored command/tool surfaces; a summary made stale by editing a
  `.md` file directly is caught only after the fact, by `doctor`'s
  `summary_stale` check — the gate prevents, doctor detects, and neither
  alone closes the gap (stated directly in `summary-gate.ts`'s own
  comments).
- **`repair` does not recover lost content** — it only re-stamps a checksum
  to match what is currently on disk, and says so before it runs, with a
  cited historical incident where doing so would have destroyed the only
  evidence of a defect.
- **No verdict expiry beyond the no-lapse mechanism** — a contradiction
  verdict is carried forward across edits that don't change meaning, but
  there is no separate TTL/expiry on a verdict the way `exception` items
  carry an `until` date.

## What I could not fully verify

`edit.ts` is 1,312 lines and shares much of the same flag-parsing and gate
logic as `add`'s block in `src/cli/index.ts`; I traced the summary-gate and
contradiction-gate call sites there but did not exhaustively trace every one
of `edit.ts`'s ~30 flags. I did not run `add`, `edit`, or `repair` for real
against this corpus (all three are state-changing), so the gate-triggering
and repair behaviour above is verified from source and from `doctor`'s
existing findings, not from a live end-to-end capture.
