# 16. The board — plans, `needs`, `ready`, `path`, and the D-numbers

`docs/capabilities/00-index.md` · previous: [`13-testing-discipline.md`](./13-testing-discipline.md)

**This chapter did not exist before this pass, and it is the largest single gap this audit found.**
Every other undocumented subject in this project has a tutorial, a report, or at least a chapter
section naming it. This one — how work is chosen, what a task waits on, and how a person tracks a
whole subject to completion — had none of the right shape: two corpus reference items, a pointer in
`CLAUDE.md`, a narrative in `reports/V2-HANDOVER.md`, and a 48-line header comment at the top of
`src/core/needs.ts` (the file itself runs to 866 lines, heavily commented throughout — an earlier
version of this sentence said 200, over-counting the file's *total* commentary as if it were the
top-of-file header specifically). It is also, by the project's own account, the subject a newcomer must
understand *before doing any work here at all* — which is exactly why it sits this late in the
reference: everything in it presumes the categories, states and items chapters 1–3 already
established.

## 16.1 The problem this replaces: a progress table nobody could trust

`reports/EXECUTION-BOARD.md` was a hand-maintained progress table, retired 2026-09-07 for a reason
this project can now demonstrate rather than merely assert: a hand-kept board and the corpus it
describes are two copies of one fact, and the copy always wins the argument until someone checks.
`CLAUDE.md` at the repository root states the retirement directly and points here instead —
"`mycontext ready [--plan <p>] [--held]` computes what is dispatchable from the corpus' own `needs:`
fields. It cannot go stale, because nobody keeps it by hand."

**Measured 2026-08-28, the day this started**: 425 non-superseded task items, **zero** carrying a
machine-readable dependency; a regex sweep for a dependency stated in prose matched 4 of roughly 28
mentions, and one of the four resolved to a plan that does not exist — harvested out of the middle
of a sentence. That is the argument for a *field*, made in numbers: a notation with a 25% hit rate
and a false positive in the same pass is not a notation.

## 16.2 `needs` — the one dependency a task can declare

`src/core/needs.ts` defines the frontmatter field `needs`, a comma-separated list of `plan/seq`
references (e.g. `needs: recall/2, walk/18`). Three deliberate design choices, each argued from a
measured failure:

- **The direction is `needs`, never `blocks`.** A task's author knows what their own task is
  waiting for; they almost never know who will one day depend on it. `open_question` uses `blocks`
  instead, correctly, because whoever files a *question* does know who is stuck on its answer —
  `blocks` is derivable from `needs` by inversion, and `needs` is derivable from nothing, so the
  field lives on the side that can actually be filled in honestly.
- **A reference to work that does not exist yet is legitimate, and stays legitimate.** Plans are
  written before every task inside them exists. Refusing an unresolved reference would make the
  field useless at the exact moment — while a plan is being laid out — that it is most needed. Three
  separate questions are kept separate rather than collapsed into one verdict: is the reference
  well-shaped (`plan/seq`)? does anything in the corpus answer to it (resolved / **unresolved**, a
  note, never an error)? and is what it resolves to `done` (satisfied / pending)?
- **The module is pure.** No I/O, no clock, no workspace — the caller supplies the items. The same
  read serves a `doctor` check and every report in this chapter from one function, so "is this
  corpus's dependency graph honest" cannot mean two different things depending on which command
  asked.

`PLAN_FIELD`/`SEQ_FIELD`/`STATE_FIELD` are read from configuration rather than hardcoded to the
category name `task` — deliberately, because `task` was itself a *custom* category (config-declared)
when this module was written, and another project may call the same idea `story` or `ticket`. What
the checks require is a plan, a position in it, and a state; that is what is asked for, by shape,
never by name.

## 16.3 `mycontext ready` — what is dispatchable, computed fresh on every run

`ready [--plan <p>] [--held] [--questions] [--limit <n>]` lists every open task whose every `needs`
reference is `done`, ranked by priority. **Nothing is cached and there is no stored "ready" state
to go stale** — every run re-derives the answer from the corpus as it stands this instant, which is
the property that makes the whole mechanism trustworthy in the first place: a second copy of
readiness would disagree with the first the moment one of them updated alone, which is precisely
the defect `reports/EXECUTION-BOARD.md` was retired for.

Real output against this repository, `--held` — **the command prints up to three tables, and an
earlier version of this section pasted only the third (the held list) under a sentence promising
the first (the ready list) too**, which made its own worked example claim to show something it did
not. All three, unabridged, 2026-09-16:

```
$ mycontext ready --held --limit 3
┌────────────┬─────┬───────┬───────────────────────────────────────────────────────────────────┐
│ task       │ pri │ state │ title                                                               │
├────────────┼─────┼───────┼───────────────────────────────────────────────────────────────────┤
│ anchors/12 │ 1   │ todo  │ take the lane report and the owner's own words as automatic marks…  │
│ anchors/13 │ 1   │ todo  │ a user who installs mycontext mid-project has conversations nobody… │
│ budget/6   │ 1   │ todo  │ an edited budget shows what it was, and one control puts it back    │
└────────────┴─────┴───────┴───────────────────────────────────────────────────────────────────┘

149 ready of 153 open task(s)

┌─────────────────────────────────────────────────────┬─────────┬─────────────────────────────┐
│ question                                            │ blocks  │ title                         │
├─────────────────────────────────────────────────────┼─────────┼─────────────────────────────┤
│ OPENQ-does-export-import-ever-import-or-is-a-third… │ walk/89 │ does Export / import ever…    │
└─────────────────────────────────────────────────────┴─────────┴─────────────────────────────┘

┌───────────┬─────┬───────┬──────────────────────────┬───────────────────────────────────────────┐
│ task      │ pri │ state │ held by                  │ title                                     │
├───────────┼─────┼───────┼──────────────────────────┼───────────────────────────────────────────┤
│ walk/18   │ 1   │ todo  │ a blocker has not landed │ build init --rewrite-watched, and offer it│
│ docsys/11 │ 3   │ todo  │ a blocker has not landed │ both READMEs learn the composer and help  │
│ port/99   │     │ todo  │ a blocker has not landed │ LAST UI TASK: return the UI to the real   │
└───────────┴─────┴───────┴──────────────────────────┴───────────────────────────────────────────┘
149 ready; 3 shown. Raise the cap with --limit 149, or narrow it with --plan.

4 open task(s) held and not listed above: 4 a blocker has not landed. `mycontext ready --held` lists
them.

1 open question(s) stand between this list and open work. A question is finished by an ANSWER, not
by work...
```

The **first** table is the ready list itself (columns `task │ pri │ state │ title`, no `held by`);
the **second**, printed only when a blocking question exists, is that question named directly; the
**third**, printed only with `--held`, is the held list this section is actually about, with its
own `held by` column. Every number is real and moved by exactly one between this section's first
draft and this repair (`150 ready` → `149 ready`, `3` open task total unchanged at `153`) — ordinary
drift from lanes closing work in between, not an error.

**Open questions that block work are surfaced by name; questions that block nothing yet are counted
and not listed** — a deliberate anti-noise design, stated in the report's own text: *"a list that
showed every question every time would train a reader to skip it."* `src/core/questions.ts`
(`plan:governance seq:9`) is the mechanism, added specifically because before it existed a decision
awaiting the owner sat in the corpus with nothing putting it in front of him — every one that
reached him did so only because an assistant happened to remember to ask, which does not survive a
compaction (chapter 7), the exact thing this product exists to fix. It was deliberately built as a
**second predicate over the same `open_question` category** rather than folded into the review
queue: the review queue is one specific definition (`status === 'draft' && layer === 'project'`)
consumed by seven other counts across the product, and widening it to include questions would have
made it *become* the question queue under a name that still says "drafts."

## 16.4 The D-numbers — a subject is bigger than a task, and it is named once, forever

`REF-the-d-numbers-what-each-one-means-and-which-are-only` is a **pinned reference item** — the
owner ruled it "save D persistent" on 2026-09-07, because it is the only place a D number survives a
compaction, and the value of a stable number is that "do D11" means exactly one thing across
sessions. Its own governing statement: *"A D NUMBER NAMES A SUBJECT, not a fixed list of items — a
subject may WIDEN, and widening is neither renumbering nor reuse."* A D number is never renumbered
and never reused; assigning one and recording it in this item are **one act**, not two — a number
announced anywhere else is not a D number yet.

The item carries a `[D-MAP]` block: delimited rows, each naming a D number, which plan(s)/items make
it up, and (as of 2026-09-16, `store/10`-adjacent work) an explicit `status` — including
`held-by-owner` for a subject the owner has ruled should wait on him specifically. `REF-the-wave-map-…`
is a second, related reference for how subjects were grouped into delivery waves. The **narrative**
behind every widening, every retired instruction, and the reasoning for the ordering lives in
`reports/2026-09-11-the-d-numbers-record.md` — the item carries the map, the report carries the
record, and the two are deliberately not the same document.

## 16.5 `mycontext path` — per-subject progress, and the column no other command has

Shipped 2026-09-16, directly in response to the owner's own words: *"a mechanism that will make all
of them be dispatched, progress tracked and 100% completed so i could use it as a reliable path to
complete all currently known opened Ds."* `ready` already answers "what can I start" over the whole
corpus; nothing before `path` answered "where is `D72` specifically up to" — the tables that tried
were regex sweeps over the register's own prose, and **two rows came out wrong the day this was
measured**: `D78` was reported closed because its text merely *quotes* `D57`'s closure, and `D57`
was reported `0/3` because the regex matched an unrelated day's items by name alone.

```
$ mycontext path --d 72
┌─────┬────────┬──────┬───────┬──────┬───────┬───────────┐
│ D   │ status │ done │ ready │ held │ yours │ work      │
├─────┼────────┼──────┼───────┼──────┼───────┼───────────┤
│ D72 │ open   │ 2/4  │ 2     │ 0    │ 0     │ readmodel │
└─────┴────────┴──────┴───────┴──────┴───────┴───────────┘
```

**Nothing here is stored, on the same principle as `ready`.** Every number is computed on the run
from the `[D-MAP]` block plus the live state of the items it names — a stored "progress" file would
be exactly the defect this whole mechanism exists to prevent. The one thing genuinely *read* rather
than derived is **membership** (which subject a plan belongs to — an assignment only a person can
make) and a subject's own `status`, because closing a subject is a **judgement**, never a count: the
item's own words, quoted directly in `path.ts`'s source, are *"THE SUBJECT CLOSES when a reader
opening a conversation can tell at a glance what was marked and why it was worth marking — not when
twelve items are done."*

**The `YOURS` column is the whole point of the command, and no other command can compute it.**
Three things sit waiting on the owner right now, on this repository, and every existing report drew
them as ordinary open work — which means every one of those reports was offering him work he had
already decided to defer. `YOURS` is derived from two things the corpus already holds, never a new
field: a subject whose row reads `held-by-owner`, or an open question naming that subject in its
`blocks` (§16.3's mechanism, pointed at a subject instead of at the whole corpus). The way something
enters this column is to file the question; the way it leaves is for the owner to answer it, with
nobody editing a status by hand.

```
$ mycontext path --summary
WAITING ON YOU — 2 subject(s), and no other command can say so...
  D46 · walk/89 — does Export / import ever import, or is a third of that screen permanently a
     description of an act this product cannot perform?
  D67 — the whole subject is held by your own ruling.

21 subject(s) read "open" with every item done: D8, D13a/b, D14, ... A subject closes on a
JUDGEMENT and never on a count — nothing here will close one for you.

18 open work item(s) belong to no subject at all... `npm run check:board --orphans` names them.

100% here means every remaining step is either DISPATCHABLE or NAMED AS YOURS. It is not a promise
that every subject closes: one is held by your own ruling and others end in decisions only you can
make.
```

**What 100% can and cannot mean is stated on every run, deliberately, so the mechanism cannot be
misread as promising more than it does.** The honest version of the owner's request is a path where
every remaining step is either dispatchable or named as his — never a promise that every subject
closes.

## 16.6 What keeps the board itself honest — `check:board`, gated in CI

The board is only as trustworthy as its two moving parts: the D-MAP's own prose, and the discipline
of closing an item when the work that finishes it lands. `scripts/check-board.ts`
(`npm run check:board`, wired into both `.github/workflows/ci.yml` and `release.yml`) checks both,
and its own header states the standard directly: *"the board is not true, and this is what keeps it
true."*

**Tier 1 — the D-MAP parses, and this one gates the build.** Every line between the block's
sentinels must parse, no D number may repeat, every member must name work the corpus actually
holds, and no item may fall under two subjects. The double-claim check is the one worth naming
specifically: one item claimed by two subjects makes both rows' totals count it, so the board's
totals stop adding up while every individual row still looks correct in isolation — the kind of
lying error nobody audits for by eye.

**Tier 2 — a commit named an item, and the item is still open. Reported, never gated.** First
measured the day this chapter was written: 23 of 153 open task items had already been named by a
commit since 2026-09-14 — one lane's work was in `HEAD` with the item it finished still reading
`state: todo`, so the subject it belonged to reported two of its four items shipped as zero. **This
number is one of the fastest-moving in the whole reference, because it counts a race this project's
own lanes are actively closing.** Re-run for this repair pass, 2026-09-16 (later the same day):
`node scripts/check-board.ts` now reports **3 of 153 open work items, over the last 120 commits
(2026-09-12 to 2026-09-16)** — a real drop, not a correction, as lanes closed the items the first
reading caught mid-flight. Read whatever number a fresh run gives you as current; the mechanism is
what this section is actually documenting. This is the project's
own dispatch loop failing to verify the one thing that actually matters: every brief says "close
each finished item," some lanes do and some do not, and the commit step checks the code and the
tests and never checks that the item's own state changed. **It cannot be a hard gate, and the
reason is not caution**: a commit that *creates* an item names it too, a partial landing is
legitimate, and a handover commit names every live lane on purpose. The four things the check
knows *not* to report — done/deprecated/superseded work,
filing commits, bookkeeping-only commits (nothing changed outside `reports/`/`.my_context/`), and
an item carrying its own `NAMED-BUT-OPEN <sha> — <what remains>` self-expiring acknowledgement —
were what cut a much larger naive sweep down to a handful of real findings on the day this
mechanism was first measured; re-derive the current ratio from a fresh run rather than trusting a
specific historical count here.

`npm run check:needs-cycles` is the sibling gate: it refuses a `needs` graph containing a cycle, and
runs beside `check:board` in the same two workflows.

## 16.7 What's NOT built / built but off

- **There is still no way for a commit to *declare* which item it closes.** `check:board`'s Tier 2
  is a report, not a gate, specifically because nothing today lets a commit say "this finishes
  `TASK-x`" the way it can say what files it touched — the header names a commit trailer as the one
  thing that would make this gateable, and it does not exist.
- **A dependency stated only in prose is invisible to `needs`, `ready`, and `path` alike.** All
  three are explicit that this is a statement about the corpus's own honesty, not a promise about
  the work — `mycontext doctor` is what reports a `blocked` task naming nothing machine-readable.
- **`path`'s `YOURS` column depends entirely on a subject's row reading `held-by-owner` or an open
  question naming it** — a real decision waiting on the owner that was never filed as a question,
  and whose subject was never marked held, is invisible to this column exactly as an unwritten
  `needs` reference is invisible to `ready`. The mechanism only ever knows what the corpus was told.
- **This chapter does not describe `mycontext status`'s own board-adjacent counts**, or the
  `check:board --orphans` flag beyond naming that it exists — both are real surface this pass did
  not verify past what is shown above.
- Every count in this chapter (`149 ready`, `78 subjects`, `3 of 153`, `2 waiting on you`) is a
  **dated reading from 2026-09-16**, taken against a corpus that both commands recompute from
  scratch on every run — and several of them already moved once *within* the same day this chapter
  was written and re-verified. Re-run them for today's numbers; that is the entire point of the
  mechanism.

## See also

- [00 — Index](./00-index.md)
- [01 — Items and the corpus](./01-items-and-corpus.md) — the `task`/`open_question` categories and
  `state` field this whole chapter's mechanism reads
- [07 — Restore and handover](./07-restore-and-handover.md) — why a decision that only ever reached
  the owner in conversation does not survive a compaction, which is `questions.ts`'s own reason to
  exist
- [09 — CLI and MCP](./09-cli-and-mcp.md) — `ready` and `path` in the full command reference
- [13 — The testing discipline](./13-testing-discipline.md) — `check:board` and
  `check:needs-cycles` among the full `check:*` gate inventory
