# The board — how work is chosen here

`docs/system/00-index.md` · reference: [`docs/capabilities/16-the-board.md`](../capabilities/16-the-board.md)

This is the chapter the inventory that surveyed this whole project called the biggest gap of all
32 subjects it looked at — not because the board is large, but because it is the one thing a
newcomer has to understand *before doing any work here at all*, and until this pass nothing of the
right shape existed: two corpus reference items, a pointer in the repository's `CLAUDE.md`, a
narrative report, and a 48-line header comment at the top of one source file.

`docs/capabilities/16-the-board.md`, written in the same repair pass this directory belongs to,
now carries the command reference — every flag, real terminal output, the full two-tier gate. This
chapter does not repeat that. It carries the part a command reference cannot: why the board looks
like this, what it replaced, and the argument a newcomer needs before the commands make sense.

## 1. What it is, and what it is easy to confuse it with

**The board is not a file. It is three small, pure computations over the corpus's own
frontmatter**, run fresh every time they are asked for. There is no stored "board" anywhere — no
`board.json`, no cached progress percentage. If you have used a project-management tool before,
the thing you are picturing when you hear "board" — a persisted state that a person or a bot
updates — is precisely the thing this replaced, and the whole design is a reaction against it.

Three things a newcomer conflates with the board, worth separating up front:

- **The board is not the corpus.** The corpus (`.my_context/items/`) is normative knowledge —
  rules, decisions, requirements. The board is one *lens* over one *category* of it: `task` items,
  read through their `needs`, `state` and `plan`/`seq` fields. Every other category (rules,
  decisions, lessons…) is invisible to the board entirely.
- **`needs` is not `blocks`.** Both fields exist and they point opposite directions on purpose —
  see §3.
- **A D-number is not a task.** A D-number names a *subject* — a cluster of tasks a reader can hold
  in their head, like "the search grammar" or "the palette." A subject is bigger than any one item
  and outlives the items inside it; new work can be added to a subject without renumbering it. See
  §5.

`task` carries two fields that both look like status and are not the same mechanism. `needs` is
*computed over* — nothing moves it, `readyReport` just reads it (§3-§4). `state` is the other one,
and it is the opposite kind of thing: a plain hand-set value, `todo | doing | blocked | done`
(`src/core/needs.ts`, the comment at the `readyReport` loop that enumerates all four), and nothing
in this codebase transitions it automatically. A person or an agent moves a task to `blocked`; the
board never infers "blocked" from an unmet `needs` reference — that is `held`, a *read-time*
classification, not a write to `state` (§4 below is the read; this is the field it reads).

```mermaid
stateDiagram-v2
  direction LR
  [*] --> todo
  todo --> doing
  doing --> blocked
  blocked --> doing
  doing --> done
  todo --> done
  done --> [*]
  note right of blocked
    readyReport HOLDS this only
    when needs is also empty —
    a blocked task that names
    what it is blocked on is
    read exactly like todo/doing
  end note
  note right of done
    excluded from readyReport
    entirely — not "ready",
    not "held", not counted
    in "open" at all
  end note
```

**`status: deprecated` is a different field again, and it is the exit none of the four states can
express.** A task abandoned before it shipped has nowhere to go in the diagram above — `done` would
claim it landed, and it never did — so cancellation is recorded on `status`, checked first and
independently by `readyReport` (`item.status === 'deprecated'` short-circuits before `state` is even
read). A task can sit at `state: todo` and `status: deprecated` at once; the diagram shows what
`state` alone means, not the whole lifecycle of the item it lives on.

## 2. The problem this replaced, told as a story rather than a table

Before any of this existed, `reports/EXECUTION-BOARD.md` was a hand-maintained progress table — a
person, or an agent standing in for one, updated a Markdown file every time something shipped. It
was retired on 2026-09-07, and the reason is worth stating precisely because it is the reason the
whole mechanism exists: **a hand-kept board and the corpus it describes are two copies of one
fact, and the copy always wins the argument until somebody checks.** Nobody checks every time. The
corpus said one thing, the board said another, and there was no way to know which was current
without opening both.

The measurement that made the case undeniable was taken the day the retirement started: of 425
non-superseded task items in the corpus, **zero** carried anything a machine could read as a
dependency. A regex sweep for a dependency stated in prose — the kind of sentence a person writes
without thinking about it, "blocked on the search work landing first" — matched 4 of roughly 28
real mentions, and one of those four resolved to a plan that did not exist, harvested out of the
middle of an unrelated sentence. A notation with a 25% hit rate and a false positive in the same
pass is not a notation. That is the argument for turning "what this waits on" into a real
frontmatter field rather than a sentence a reader has to parse by eye — and it is why `needs` was
built the way it was, not the way prose dependency-tracking usually is.

## 3. `needs` — and why the arrow points the way it does

`src/core/needs.ts` defines `needs`, a comma-separated list of `plan/seq` references
(`needs: recall/2, walk/18`). The header comment at the top of that file is unusually good — 48
lines, and worth reading directly rather than through a summary — but three decisions inside it
are worth pulling out because each was argued from a specific measured failure, not from taste:

- **The direction is `needs`, never `blocks`.** The author of a task knows what their own task is
  waiting for. They almost never know who, months later, will depend on it. `open_question` uses
  `blocks` instead — correctly, because whoever files a *question* genuinely does know who is
  stuck on the answer. `blocks` is derivable from `needs` by inversion; `needs` is derivable from
  nothing. The field lives on the side that can be filled in honestly, which is why a task and a
  question do not share a field even though both describe a thing waiting on something else.
- **An unresolved reference is legitimate, and stays legitimate.** Plans are written before every
  task inside them exists. If citing a not-yet-filed task were refused, the field would be useless
  at exactly the moment it is most needed — while a plan is still being laid out. So `needs.ts`
  keeps three questions separate rather than collapsing them into one verdict: is the reference
  well-shaped? does anything in the corpus answer to it (resolved, or a *note* called
  `unresolved` — never an error)? and is what it resolves to actually done (satisfied vs.
  pending)? A `status: deprecated` target counts as **satisfied**, by owner ruling — discharged,
  not pending, so a dependent does not wait forever on work that was formally cancelled.
- **The module is pure.** No I/O, no clock, no workspace access — the caller hands it the items.
  That is not an implementation nicety; it is what lets one function answer "is this corpus's
  dependency graph honest" for `mycontext ready`, `mycontext path`, `mycontext doctor`, and
  `scripts/check-board.ts` alike, so the answer cannot quietly differ depending on which command
  asked.

## 4. Three lenses over one field

```mermaid
flowchart TB
  T["task item<br/>needs: plan/seq, plan/seq…"] --> N["needs.ts<br/>pure: resolve every ref to<br/>satisfied · pending · unresolved"]
  N --> R["mycontext ready<br/>what can I start right now"]
  N --> P["mycontext path --d N<br/>where is ONE subject up to"]
  N --> D["scripts/check-board.ts<br/>is the map itself honest"]
  Q["open_question<br/>blocks: item, item…"] --> N
  M["[D-MAP] block in<br/>REF-the-d-numbers…"] --> P
  R -.->|"nothing stored —<br/>recomputed every call"| R
  P -.->|"nothing stored —<br/>recomputed every call"| P
```

**`mycontext ready`** answers "what is dispatchable right now," across the whole corpus, with
nothing narrowed to a subject. **`mycontext path`** answers a different question `ready` cannot:
"where is *this one subject* up to" — done/total, ready, held, and a fourth column no other command
computes (§6). **`scripts/check-board.ts`** answers neither; it asks whether the map the other two
commands trust is itself telling the truth. All three read the same `needs.ts` machinery and none
of them cache anything — see `docs/capabilities/16-the-board.md` for the literal flags and real
terminal output of each.

`questions.ts` adds a second, deliberately separate mechanism alongside `needs`: an `open_question`
item can carry `blocks`, naming the work waiting on its answer. It was built specifically because,
before it existed, a decision the owner needed to make sat in the corpus with nothing putting it in
front of him — it reached him only when an assistant happened to remember to raise it, which does
not survive a compaction (the exact failure `docs/capabilities/07-restore-and-handover.md`
describes). A question that blocks something is surfaced by name in `ready`'s output; a question
that blocks nothing yet is counted, not listed — a deliberate anti-noise design, because a list that
showed every open question every time would train a reader to stop reading it.

## 5. The D-numbers — a subject is bigger than a task, and named once

A single task is too small a unit to plan around, and a whole corpus is too large. The D-numbers
sit between: `REF-the-d-numbers-what-each-one-means-and-which-are-only` is a pinned reference item
carrying a `[D-MAP]` block, and the item's own governing sentence is worth quoting because it is
the whole design in one line: **"a D number names a subject, not a fixed list of items — a subject
may widen, and widening is neither renumbering nor reuse."** A D number is assigned once, in this
one item, and never reassigned or reused — announcing one anywhere else does not make it real.

Parsing that block used to be a regex over prose, and it was measured wrong twice on the same day
this pass started: one subject read as closed because its own text merely *quoted* another
subject's closure sentence, and a second read `0/3` because the regex matched an unrelated day's
items by name alone, with no relation to the subject it was scoring. `needs.ts`'s `parseDMap` now
reads the block as **delimited data**, never as prose scanned for meaning — the fix was not a
smarter regex, it was refusing to parse prose as if it were structured at all.

**The `YOURS` column** — `mycontext path`'s fourth column, and the reason the command exists — is
worth calling out on its own, because it answers something no other command in this project can:
which open work is waiting on the *owner specifically*, right now, derived from two facts the
corpus already holds (a subject's own row reading `held-by-owner`, or an open question naming that
subject in its `blocks`) rather than a new field anyone has to remember to set. Every report before
`path` existed drew that work as ordinary open backlog — which meant every one of those reports was
quietly re-offering the owner work he had already decided to defer.

## 6. How it is maintained — the two-tier gate, and why only one tier gates

`scripts/check-board.ts` (`npm run check:board`) is what keeps the board honest, wired into CI. Its
own header states the standard plainly: *"the board is not true, and this is what keeps it true."*

- **Tier 1 — the map itself must parse: gates the build.** No D number may repeat, every member
  must name work the corpus actually holds, and — the one worth naming specifically — no item may
  be claimed by two subjects at once. A double claim is the kind of error nobody catches by eye:
  both rows' totals count the same item, so the totals stop adding up while every individual row
  still looks correct in isolation.
- **Tier 2 — a commit named an open item and nobody closed it: reported, never gated.** The reason
  it cannot be a hard gate is not caution, it is honesty about what a commit trailer can and cannot
  promise today: a commit that *creates* an item names it too, a partial landing is legitimate, and
  a handover commit legitimately names every live lane. Nothing today lets a commit *declare* which
  item it closes the way it can declare which files it touched — that is the missing piece a hard
  gate would need, and it does not exist yet. An item can self-silence one finding with
  `NAMED-BUT-OPEN <sha> — <reason>` in its own body, and that acknowledgement expires the moment a
  *later* commit names the same item again — so it cannot be used to permanently suppress drift, only
  to explain one specific, already-understood gap.

`npm run check:needs-cycles` is the sibling gate: it refuses a `needs` graph containing a cycle,
which nothing else here would notice, because `needs.ts` resolves references one at a time and has
no reason to detect a loop on its own.

## 7. What is known wrong with it

- **A commit still cannot declare which item it finishes.** Tier 2 above is a report because this
  is missing, not because reporting was preferred on its own merits.
- **A dependency stated only in prose is invisible to all three commands.** This is a statement
  about the corpus's honesty, not a promise about the underlying work — `mycontext doctor` is what
  flags a `state: blocked` task that names nothing machine-readable.
- **`path`'s `YOURS` column only knows what the corpus was told.** A real decision waiting on the
  owner that was never filed as an `open_question` and whose subject was never marked
  `held-by-owner` is invisible to it, for exactly the reason an un-filed `needs` reference is
  invisible to `ready`.
- **"100% closable" is deliberately not promised**, and every run of `mycontext path` says so in
  its own closing sentence: 100% means every remaining step is either dispatchable or named as the
  owner's — never a promise that every subject closes, because closing one is a judgement a person
  makes, not a count a command can reach on its own.
- Run `mycontext ready --held` and `node scripts/check-board.ts` yourself before citing any number
  from this chapter or from chapter 16 — both are recomputed from the corpus on every call, and
  several counts in the reference chapter already moved once *within the day it was written*.

## 8. Code map

| File | What it owns |
|---|---|
| `src/core/needs.ts` | The `needs`/`state`/`plan`/`seq` machinery: parsing, resolution, `readyReport`, `parseDMap`, `dBoard`. Pure, no I/O. |
| `src/core/questions.ts` | The second, disjoint mechanism: `open_question`'s `blocks` field, `questionReport`. |
| `src/cli/commands/ready.ts` | The `mycontext ready` command — what's dispatchable across the whole corpus. |
| `src/cli/commands/path.ts` | The `mycontext path` command — per-subject progress and the `YOURS` column. Newest of the three, shipped in response to a direct owner request for a reliable path to closing every open subject. |
| `scripts/check-board.ts` | The two-tier gate described in §6, wired into CI. |
| `scripts/check-needs-cycles.ts` | The sibling gate refusing a cyclic `needs` graph. |
| `REF-the-d-numbers-what-each-one-means-and-which-are-only` | The pinned corpus item holding the `[D-MAP]` block itself — not source code, but the one place a D number is real. |
| `REF-the-wave-map-what-order-the-work-is-being-done-in` | A related reference for how subjects were grouped into delivery waves; not read by any of the code above. |

## See also

- [`docs/capabilities/16-the-board.md`](../capabilities/16-the-board.md) — the full command
  reference, every flag, real terminal output
- [`docs/capabilities/01-items-and-corpus.md`](../capabilities/01-items-and-corpus.md) — the
  `task`/`open_question` categories and the `state` field this whole chapter reads
- [`docs/capabilities/07-restore-and-handover.md`](../capabilities/07-restore-and-handover.md) —
  why a decision that only ever reached the owner in conversation does not survive a compaction,
  `questions.ts`'s own reason to exist
- `CLAUDE.md` at the repository root — the pointer that sends a session here instead of to a
  retired hand-kept board
