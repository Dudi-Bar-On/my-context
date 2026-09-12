# 5. Anchors

An anchor is a bookmark into the conversation archive: a fixed point — one session (or one
subagent lane), one **byte offset** into its transcript, and a label — that lets the owner (or
retrieval, see [06 — Retrieval](./06-retrieval.md)) steer straight back to something already said,
instead of re-reading megabytes of transcript to find it again.

The mechanism is described end to end in `src/core/anchors.ts`'s own header as `plan:recall
seq:1`, Task 3 of `docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md` and §7 of
`docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md`. The governing item is
`REQ-every-anchor-capability-is-reachable-from-the-screen-and-a` (severity `hard`, tagged `v2`,
`recall`, `ui`), whose summary states the shape of the whole feature in one sentence: *"Bookmarks
are made three ways — as the conversation grows, by one catch-up run, and by hand while reading —
and every one of them, and everything else you can do with them, works from the viewer."*

## 5.1 Why an anchor exists

The conversation archive (chapter 4) is prose search over transcripts that, on this workspace, run
into the hundreds of megabytes. Finding a passage once, by search, is cheap. Finding the *same*
passage again next week is not — unless something recorded exactly where it was. An anchor is that
record: it survives the fact that search re-ranks, transcripts get re-indexed, and byte offsets are
otherwise meaningless numbers nobody would think to write down by hand.

## 5.2 The file is the truth; the index is derived

This is the same relationship the corpus itself has between its Markdown items and the disposable
SQLite index (chapter 1) — and the project draws that parallel explicitly rather than leaving a
reader to notice it. From `src/core/anchor-file.ts`'s header:

> `.my_context/.index.db` is gitignored and DEFINED as disposable — the shape is the version,
> delete it and it rebuilds. Everything in it comes back from something else: conversations, lanes
> and prose from the transcripts, items from Markdown. **Anchors were the one exception.** They
> survive a rebuild... and nothing brought them back if the file itself went.

So `.my_context/.anchors.jsonl` — one JSON object per line, protocol-tagged
`my_context/anchor@1` — is the one part of the conversation index that is **not** re-derivable from
anything else. Confirmed on this workspace:

```
$ wc -l .my_context/.anchors.jsonl
636 .my_context/.anchors.jsonl

$ head -n 1 .my_context/.anchors.jsonl
{"protocol":"my_context/anchor@1","id":"595db3b1-a481-4553-b4c0-7248c31b2655:-:100522902",
 "sessionId":"595db3b1-a481-4553-b4c0-7248c31b2655","agentId":null,"byteOffset":100522902,
 "label":"today","kind":"table","origin":"automatic","at":"2026-09-11T22:35:10.797Z"}
```

Every row has the same seven fields: `id`, `sessionId`, `agentId` (a lane id, or `null` for the
session's own transcript), `byteOffset` (bytes, **never characters** — see §5.5), `label`, `kind`,
`origin`, `at`. `readAnchorFile` refuses a damaged line rather than silently reading it as "fewer
bookmarks", because — per `INV-nothing-is-dropped-silently` — the bookmarks are exactly the thing
nothing else can put back.

**Why a rewritten document and not an append-only log**, unlike `audit.ts` or `revision-log.ts`:
the automatic pass (§5.4) relabels hundreds of anchors in one run — 345 in the run the header cites
— and an append-only log would grow by hundreds of rows to describe 565 facts, with no reader ever
asking what a label *used to be*. So it is a document, written whole and swapped in with
`writeFileSync` to a temp path + `renameSync`, atomically: a kill mid-write leaves either the whole
old file or the whole new one, never a truncated one.

**Table ↔ file reconciliation** (`reconcileAnchors`) runs on every write and at the start of every
`conversation rebuild`: if the file is absent, the table's rows are adopted into a fresh file
(`direction: 'adopted'` — every corpus that predates this mechanism passes through here once, the
565 rows the header mentions included); if the file is present, the table is rebuilt from it
(`direction: 'restored'`, the ordinary steady state, which is what makes `.index.db` disposable
again even with anchors in it).

## 5.3 `origin: automatic` vs. `origin: owner`

Every anchor row carries one of exactly two origin values — confirmed on this workspace's own
636-line file:

```
$ grep -o '"origin":"[a-z]*"' .my_context/.anchors.jsonl | sort | uniq -c
    635 "origin":"automatic"
      1 "origin":"owner"
```

- **`automatic`** — marked by the automatic pass (§5.4) because the turn under it matched a fixed
  grammar ("this is an anchor by its shape"), with no person asked.
- **`owner`** — marked by a person, through the CLI, the MCP surface, or the web UI. `markAnchor`'s
  default `origin` is `'owner'` for exactly this reason: a caller who does not say otherwise is a
  person.

The distinction is **load-bearing, not descriptive**. The automatic pass re-reads and can *take
back* its own anchors when the grammar no longer recognises what is at that byte (§5.4) — but it
never touches a row whose `origin` is `'owner'`, whatever the grammar says about the turn under it.
From `anchor-pass.ts`: *"an automatic pass that deleted a hand-made bookmark would be a far worse
defect than any it could fix."* The web UI's write routes enforce the same asymmetry from the other
direction: `apiAnchorMark` does not accept a `kind` or `origin` in the request body at all — a
point marked by hand through the screen is unconditionally `kind: 'note'`, `origin: 'owner'` — so
no request can forge a row that the automatic pass would later be entitled to erase.

`kind` on this workspace's file, similarly real:

```
$ grep -o '"kind":"[a-z_]*"' .my_context/.anchors.jsonl | sort | uniq -c
      1 "kind":"note"
    299 "kind":"ruling"
    336 "kind":"table"
```

`note` is the default kind for a hand-marked anchor. `table` and `ruling` are the two grammars the
automatic pass recognizes (§5.4) — and the one hand-marked anchor on this workspace is the `note`.

## 5.4 What "automatic by nature" means — the grammar, not a judgement

`anchor-pass.ts` is explicit that the automatic half **does not score, threshold, or infer**:

> a lexical signal/noise classifier measured **AUC 0.499** on this corpus — a coin flip — and a
> two-rule version of the best single feature still admitted 47% of the noise.

Instead it runs two fixed, syntactic grammars over turn text, first match wins:

1. **`table`** — the turn's text contains a GFM Markdown table: a delimiter row (all-dash cells,
   optional alignment colons) directly under a header row of the *same* cell count. The label is
   the first readable header cell (`tableLabel`), because the naive "whole header row joined"
   scheme produced 25 anchors literally labelled `|` before the owner's 2026-09-11 ruling fixed it.
2. **`ruling`** — *only* in a `prompt` turn (something the owner said, never something an assistant
   answered with, since assistants cite ids in nearly every turn) — text containing a normative
   corpus id matching `\b(?:DEC|RULE|INSTR|STD|CONST|INV)-[a-z0-9]+(?:-[a-z0-9]+){3,}\b`.
   `TASK-` and `REQ-` ids are deliberately excluded: this repository holds 728 `TASK-` items
   against 94 `DEC-`, and including work ids would anchor nearly every working turn.

A **third grammar — `report`** (a dated path under `reports/` or `docs/superpowers/{specs,plans}/`)
existed and was *withdrawn*. It had produced 101 of a first overnight run's 613 anchors; the owner
read them on 2026-09-11 and ruled it marks "a turn that *mentions* a report, not a report" — not
worth having. The regex and its two probes are gone, and the pass actively takes back any
previously-written `report`-kind anchor it finds standing (§5.4, the sweep). This is a documented
built-and-then-removed capability — see §5.7.

Cost containment: eight cheap substring "probes" (`|---`, `DEC-`, `RULE-`, etc., each capped at
`ANCHOR_PROBE_LIMIT = 200` hits) narrow the prose-search index to candidates before the grammar is
run over the full turn text — walking the whole ~875 MB archive on every pass would defeat the
argument for running it at all.

## 5.5 The id is derived from the position — never from a clock or a counter

`anchorIdFor(sessionId, agentId, byteOffset)` — an anchor's id is a pure function of *where* it
points, not of when it was made. This is what makes marking **idempotent by construction**: the
automatic pass re-runs on every rebuild and every qualifying turn, and marking the same point twice
produces the same row rather than a duplicate bookmark.

**The position is bytes, never characters**, and this is asserted repeatedly across the anchor
code because getting it wrong fails silently: `resolveAnchor` seeks to the offset and reads the
record that *starts* there; a character offset on an archive that is (per the code comments)
half Hebrew from record 5 onward lands mid-record and reads back as unreadable rather than
throwing. The CLI actively refuses a non-digit-string offset with an explanation of exactly this.

## 5.6 The three creation paths

`REQ-every-anchor-capability-is-reachable-from-the-screen-and-a`'s summary names them: *"as the
conversation grows, by one catch-up run, and by hand while reading."*

**Path 1 — per-turn, as the conversation grows.** `markAnchorsOnTurn` (`core/anchor-pass.ts`) is
wired into `stopConversationRefresh` in `src/hooks/stop.ts`, after `rebuildConversations`, inside
the Stop hook that fires at the end of every assistant turn. It is **scoped**: it costs nothing on
a turn where no transcript moved (a `(bytes, mtimeMs)` comparison, ~3-6 ms in steady state), and is
bounded — `TURN_PROSE_BUDGET_MS = 250` ms and `TURN_PROSE_SOURCE_BYTES = 16 MiB` — because it runs
inside the platform's 3-second hook timeout, past which the hook is killed and the turn's whole
audit row is lost. It swallows its own failure (returns `null`) rather than costing the turn its
refresh report; per the header, this was withdrawn once already for cost reasons and re-landed on
2026-09-12 only after the underlying prose-index cost regression (96.7 MB / 421 ms → 571 B / 7.5 ms)
was independently repaired — `test/core/anchor-per-turn.test.ts` measures the steady state directly
rather than trusting the earlier claim.

**Path 2 — one catch-up run.** `mycontext conversation rebuild` calls `markAutomaticAnchors`
unscoped — every probe, every one of the pass's own previously-marked rows re-read at its own byte
— which is the run a *changed grammar* (a code change, not a new turn) needs in order to trim
stale anchors. Measured on this workspace: ~550 ms in steady state (574 probe candidates + 621 of
the pass's own rows, each a seek).

**Path 3 — by hand.** A person marks a point directly, two ways:
- **CLI**: `mycontext conversation anchor <session> <byte> --label "<why>"` (see §5.8).
- **Web UI**: `POST /api/conversations/anchors/mark` from the Conversations screen — either while
  reading a transcript, or directly from a search-hit row (the read model already marks each hit
  `anchored: boolean` via `anchorIdFor`, so the screen knows before the click whether that exact
  point already has a bookmark).

All three paths converge on the same two doors — `markAnchor` / `unmarkAnchor` in
`core/anchors.ts` — which are the *only* legal way to reach `index.putAnchor`/`dropAnchor`: those
lower-level index methods refuse to run outside a transaction they recognise
(`IN_ANCHOR_TRANSACTION`, a `WeakSet` keyed by index handle), specifically so that a mutation which
commits the SQLite row without also rewriting `.anchors.jsonl` in the same transaction is
impossible rather than merely discouraged — a caller that got this wrong would silently lose the
bookmark at the very next reconciliation. This is asserted, not just designed: `test/ui/anchor-write-route.test.ts` runs a whole anchor round trip through the UI routes and checks
that **every byte of the corpus except the anchors document and the index** is untouched.

## 5.7 What's NOT built / built but off

- **The `report` grammar is built-then-removed**, not merely never-built — a documented case of the
  project measuring a feature, shipping it, watching it produce 101 useless bookmarks in one night,
  and deliberately deleting the regex and its probes rather than tuning them (§5.4). `test/cli/anchors.test.ts` holds the removal from both directions (the grammar answers `null` for a
  report-shaped path; a rebuild over a fixture naming two such paths writes no anchor at either
  byte) — specifically so a probe restored without its regex, or vice versa, would be caught.
- **No scoring/ML classification** for what counts as an anchor — ruled out on measured evidence
  (AUC 0.499), not merely undone; see §5.4.
- **No anchor ordinal is reported.** `resolveAnchor` deliberately answers only "the record at this
  byte", not "the Nth record in the transcript" — a second position that could disagree with the
  first. Callers needing an ordinal (the document view) walk the file once themselves and keep an
  outline, rather than this module inventing a second notion of position.
- **A composed CLI command the UI merely displayed for the reader to copy** was the state of the
  world until 2026-09-12, and the owner explicitly ruled it insufficient — *"a composed command the
  reader must copy into a terminal is NOT the UI having the capability, it is the UI describing
  one"* — which is why `src/ui/anchor-write.ts` exists at all. The CLI's own `anchor` command
  header records this history and states plainly it is "not retired": CLI, MCP, and UI are peers,
  per the owner's ruling ("cli is ok, mcp too").

## 5.8 Worked examples

**List every anchor (CLI):**
```
$ mycontext conversation anchor
```
Draws a table of `id | kind | set | marked | label`. On an un-indexed workspace this refuses with a
pointer to `mycontext conversation rebuild` rather than silently creating the archive tables — per
the code's own comment, "marking a bookmark is not a way to turn the archive on."

**Find by label:**
```
$ mycontext conversation anchor --find "D42"
```
Searches anchor *labels* only — a different question from `mycontext conversation search`, which
searches the archive's prose (chapter 4).

**Mark one by hand:**
```
$ mycontext conversation anchor <session-id> <byte-offset> --label "why I kept this"
```
Validates the offset is a plain digit string (refusing with an explicit "bytes, never characters —
this archive is half Hebrew" message otherwise), requires `--label`, and — after marking — reads
the record back and echoes its first line, or warns "nothing starts at that byte... that is what a
CHARACTER offset produces" if the offset didn't land cleanly, while still keeping the (probably
wrong) mark rather than silently discarding the person's action.

**Take one back:**
```
$ mycontext conversation anchor --drop <anchor-id>
```

**Use case.** Mid-session, the owner is told the archive holds a ruling he gave weeks ago about a
budget number. `mycontext conversation search "budget spare band"` finds the turn; rather than
re-running that search every time it matters, he anchors the exact byte with a label, and from then
on `mycontext conversation anchor --find "budget"` — or the Conversations screen — takes him
straight back, without re-walking the transcript or re-trusting search ranking to surface the same
hit twice.

## See also

- [00 — Index](./00-index.md)
- [04 — The conversation archive](./04-conversation-archive.md) — what the transcripts an anchor
  points into actually are, and how prose search finds candidates for the automatic pass.
- [06 — Retrieval](./06-retrieval.md) — how a pasted passage is reconstructed back to a source,
  which is the consuming half of what an anchor records.
- [08 — The web UI](./08-web-ui.md) — the Conversations screen's anchor controls in full, and the
  no-writes guarantee's narrow, tested exception for these four routes.
