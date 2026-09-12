# 7. Restore and handover

[Index](./00-index.md)

A context window ends two ways: it is **cleared** on purpose (the owner is done
with it and wants a fresh one), or it **compacts** automatically because it
filled up. Either way, whatever the conversation held and never wrote down is
gone. my_context has two independent, non-overlapping mechanisms for that
boundary:

- **`restore`** — turns an *earlier* conversation's own transcript into a
  reviewed, approved, disk-backed summary that gets delivered into the *next*
  session that starts in this project. Built from a file after the fact.
- **`handover`** — a human-maintained prose document
  (`reports/V2-HANDOVER.md` in this repository) that is read and injected at
  `SessionStart`/`PostCompact`, plus an on-demand trigger (`handover ask`)
  that asks the *current* session to write into it right now, before it would
  otherwise be asked.

They solve the same problem — "what does the next window need in order not to
start over" — from opposite directions: `restore` mines the transcript that
already happened; `handover` is a document a person (or the assistant, on
request) chooses to write. Both refuse to let an agent alone decide that
something is safe to lose.

## 7.1 `restore` — summarise an earlier conversation, stage it, and deliver it after you clear

**What it is.** `mycontext restore` reads a session transcript (or a saved
retrieval result — see [§6, Retrieval](./06-retrieval.md)), builds a summary,
writes it to a staging directory, and — only after a human explicitly
approves it — arranges for it to be injected into the *next* session that
starts. Nothing is ever injected by `restore` itself.

**Why it exists.** Clearing a window destroys everything held only in that
conversation. The whole point of the design (`src/cli/commands/restore.ts`
cites it as `docs/superpowers/specs/2026-09-07-session-summary-restore-design.md`
§3, §5, §6) is that **the summary must become a file on disk, verified by
re-reading it back, before anyone is told it is safe to clear.** The source
states the failure mode this exists to close in one sentence: *"the clear
happens without the stage — is the one failure mode that loses the thing this
exists to save."*

**The sequence, and which command is which step** (from the doc comment at
the top of `restore.ts`):

| Step | What happens | Who/what does it |
|---|---|---|
| 1 PROPOSE | "this window has lost something the transcript still holds" | a person or an agent, in words — no code |
| 2 BUILD | reads the transcript, renders the review form and payload | `mycontext restore --build` — automatic, approves nothing, writes only to `.staging/` |
| 3 REVIEW | reads the numbered points under a coverage headline | the owner, from the printed review form |
| 4 APPROVE | commits to delivering it | `mycontext restore --approve <key>` — **the owner only**; there is no `--agent` flag |
| 5 STAGE | writes the record, then **re-reads it off disk** to prove it survived | `approveStagedRestore` |
| 6 CLEAR | the owner clears the window | **no command exists for this, and none is meant to** |
| 7 DELIVER | delivers the staged, approved summary once, at the next session start | `core/inject.ts` |

Only steps 2–5 have commands. Step 1 is a sentence a person types; step 6 is
an action Claude Code's UI takes, not something `restore` could do even if it
wanted to — building a "clear" command would let a mistaken belief that a
summary is safe directly cause the loss it exists to prevent.

### `restore --build`

```
usage: mycontext restore --build [--session <file>] [--range <spec>] [--subject <text>]
                        [--points <n>] [--reasoning] [--code]
       mycontext restore --build --from-result <file> [--claims <1,3,7>] [--json]
```

Reads a transcript (by default, the newest one this project has on disk —
found by resolving the repository root from the corpus, `ws.projectRoot`'s
parent, never from `process.cwd()`, specifically so that running this from
inside the plugin repository against a test workspace cannot summarise *the
developer's own* conversation into someone else's staging directory) and
produces a `SessionSummary`. `--range` accepts `whole`, `last-compaction`,
`compaction:<n>`, `record:<index>`, or `since:<ISO timestamp>`. `--subject`
narrows to named subjects; `--points <n>` caps how many summary points are
kept; `--reasoning` includes reasoning depth; `--code` includes code.

A second, distinct source is `--from-result <file>`: a saved
[retrieval](./06-retrieval.md) result can be staged through the *same*
carrier rather than growing a second one — an explicit owner ruling
(2026-09-11) quoted verbatim in the source: *"IT REUSES D34's CARRIER AND
MUST NOT GROW A SECOND ONE."* `--claims 1,3,7` picks which of the result's
claims to carry forward.

Building never approves and never injects anything — it only writes a
PROPOSED file under `.staging/` and prints a review form.

### `restore --show`

Lists everything currently staged, its state, coverage, and (once approved)
delivery status. Real output from this workspace:

```
$ node src/cli/index.ts restore --show
my_context: nothing is staged. `mycontext restore --build` builds one from a transcript.
```

Nothing is staged in this project right now — confirmed by reading the code
path rather than assumed: `--show` reads `readRestoreStagingDir(root)` and
this call returned an empty `staged` array. With something staged, `--show`
prints, per entry, the key, state (`PROPOSED`/`approved`/`delivered`), when it
was built and from which transcript, how many records/points/bytes it holds,
and a coverage line — `COMPLETE` or `PARTIAL — N thing(s) it does not cover`.
A staged file that exists on disk but cannot be parsed is reported explicitly
as `COULD NOT BE READ — <reason>` rather than silently omitted — the source
comment names this directly: *"a staged restore that cannot be read is
indistinguishable from one that was never staged, and the owner may be about
to clear."*

### `restore --approve <key>` / `--discard <key>`

`--approve` is **the one command in this whole surface reachable only by a
human.** `approveStagedRestore` takes an actor argument and the CLI passes the
literal `'human'` unconditionally — there is no `--agent` escape hatch,
matching `carry`'s deliberate absence of one. The command prints the review
form again before asking for confirmation, then re-reads the staged file off
disk and compares it byte-for-byte to what was shown. Only if that comparison
succeeds does it print the sentence that makes clearing safe:

> `my_context: <key> approved and verified on disk (N bytes re-read).`
> `IT IS SAFE TO CLEAR. The summary is a file now...`

If the re-read fails to match, it instead reports `NOT SAFE TO CLEAR` and
tells the owner to build again — it never prints an encouraging sentence
about clearing on any basis other than `ApprovalResult.safeToClear`.

`--discard <key>` withdraws a staged restore (with a confirmation, unless
`--yes`); notably, a record too corrupt to read is *offered* for discard
rather than refused, because "a record too corrupt to read is exactly one a
person may want gone."

**Use case:** you've been debugging a subtle SQLite issue for forty minutes
of back-and-forth in this session and the window is nearly full. You run
`mycontext restore --build --range last-compaction --reasoning`, read the
numbered points, run `mycontext restore --approve restore-2026-09-12T...`,
confirm it says SAFE TO CLEAR, and only then clear the window. The next
session that starts in this project receives the summary once, automatically.

**Why no slash command and no MCP tool exist for `--approve`.**
`src/plugin/parity.ts` records this absence deliberately, for the same reason
`carry` has none: `--approve` decides what the very next context window
receives, and the item's own words are unambiguous — *"AND NEVER AUTOMATIC. An
agent may propose and may build. ONLY THE OWNER INJECTS."* `--build`, by
contrast, *is* automatic and safe for an agent to run, because all it produces
is a file in `.staging/` — "where this product already keeps decisions a
human has not taken."

### The loop guard

**The precise failure mode:** an injected restore summary lands in the
transcript like any other message. Without a guard, the *next* `restore
--build` over that same transcript would summarise the summary — and this
compounding would happen silently, forever.

**The mechanism, read from `src/core/session-summary.ts` and
`src/core/summary-marker.ts`:** every restore payload is stamped with a
protocol string, `SESSION_SUMMARY_MARKER = 'mycontext-session-summary/1'`,
defined once in `summary-marker.ts` (a file that imports nothing, precisely so
that modules which must never reach the disk-writing half of `restore` — like
the read-only web UI — can still recognise the marker). `isMarkedSummary(text)`
is a **substring test on the stem** `'mycontext-session-summary/'`, not on the
full versioned string: *"When the payload's shape changes, a reader that only
knows `/1` must still recognise a `/2` payload as ours and skip it."* When a
future `--build` scans a transcript, any record carrying that marker is
dropped at a dedicated filter stage and counted separately as
`droppedOwnSummary` in the summary's coverage stats — so a reader can tell the
loop guard firing apart from ordinary filtering (the harness's own compaction
summaries are dropped by a *different* check, `isCompactSummary`, and counted
separately for the same reason).

The same marker mechanism protects the retrieval-result path (§7's
`--from-result`): `retrieval/return.ts` stamps the same marker at the head of
every marked return, precisely so a returned retrieval result cannot later be
re-ingested by `restore --build` either.

## 7.2 `handover` — the standing document, read at session start and asked for on demand

`handover` is not one command; it is two independent surfaces sharing one
configured file.

### The read side: `core/handover.ts`, delivered at `SessionStart`/`PostCompact`

**What it is.** If `.my_context/config.json` names a `handover.path`, that
file is read on every `SessionStart` and its freshness is checked (and the
staleness recorded) at `PostCompact`. In this repository:

```json
"handover": {
  "path": "reports/V2-HANDOVER.md",
  "thresholdPercent": 90
}
```

**Why it exists.** The module's own header states the motivating history
bluntly: *"This project has kept a handover file for exactly that since
2026-08-19 and NOTHING HAS EVER READ IT — searched across every `.ts`, `.js`,
`.mjs`, `.json`, `.yml`, `.sh` and `.ps1` in both repositories on 2026-08-27.
It has survived every boundary so far because somebody remembered, which is
not a mechanism." ` `core/handover.ts` is that missing mechanism: purely a
*reader*. It does not write, edit, or reformat the document, and it does not
judge staleness either — it reports what it read and leaves the judgement to
whoever is looking at it.

**How it selects what to deliver.** It looks for an ATX heading (`#` through
`######`, deliberately *not* Setext `===` underlines) whose text starts with a
configured marker. If found, it delivers that whole marked section — down to
the next heading at the same level or higher, so a nested detail heading isn't
silently cut off from the instruction it belongs to. If no marker is found, it
falls back to delivering the *head* of the document, backed up to the last
section boundary it can find. Either way it is capped to a token budget
(`budgetTokens × 4 chars/token`, the same crude 4-chars-per-token estimate
`select.ts` uses, deliberately — "a handover block and an injected item
compete for one window, and two different estimators would make the two
budgets incomparable in a way nothing would ever surface"), and it **always
declares what it left behind**: the rendered block ends with a line like
`_N of M lines, from the head of reports/V2-HANDOVER.md. K lines are NOT
here; read the file for them._` — an instance of the general rule
(`REQ-every-list-and-table-declares-what-leaves-it-and-when-and`) that no
list or table in this product may quietly truncate.

A **missing** configured file is the loud case, not a silent one: the block
renders `my_context: handover.path is 'X' and there is no file there.` This
matters because it's sent to stderr rather than the model (`SessionStart`'s
own delivery decides that), but is built once here so the missing-case
message can't be forgotten at any one of several call sites — the doc comment
notes nine days were once lost in August 2026 to a mechanism that found
nothing and said nothing about it.

**Which hook actually delivers it, and why the split is not a preference:**
`PostCompact` cannot deliver text to the model — build 2.1.239 declares no
`hookSpecificOutput` variant for that event, so anything `PostCompact` prints
becomes a user-facing banner the model never sees a byte of. `SessionStart`'s
stdout, by contrast, is appended to context verbatim. So `PostCompact`
*resolves and records* (updates freshness bookkeeping) and `SessionStart`
*delivers*.

### The on-demand side: `mycontext handover ask`

**What it is.** `mycontext handover ask [--anyway] [--json]` asks the
*current* Claude Code session to write its handover right now — the exact
same ask the Stop hook would make automatically once occupancy crosses
`thresholdPercent`, just triggered early. It is implemented by
`askHandoverNow` in `src/core/handover-ask.ts`, and the CLI command
(`src/cli/commands/handover.ts`) is one of three equally-weighted entry
points onto that same function per an explicit owner ruling
(`DEC-a-handover-can-be-asked-for-on-demand-and-the-ask-is-the`,
2026-09-06, quoted verbatim: *"i want you to implement all 3 ways: a cli
command, a slash command and a MCP tool, all should trigger handover update
on demand."*): the CLI command, the `/mycontext:handover` slash command, and
the `ask_handover` MCP tool all call the identical function and render the
identical fields.

**Why it's the *one* command in this CLI that a person in an ordinary
terminal cannot use.** A second owner ruling, quoted in the source: *"another
thing we cant do is to allow this action only if it is done from inside
claude code app and not elsewere."* So `handover ask` only succeeds when run
by the assistant inside a live Claude Code session — via the slash command,
the MCP tool, or the assistant itself running the CLI command in its own
shell. A human typing `mycontext handover ask` directly into a terminal they
opened themselves is *refused*, deliberately: *"an id typed by hand that
happens to be wrong succeeds silently against another session's latch...from
inside Claude Code...the session names itself."*

**The other refusals, each stated rather than defaulted:**

- **no occupancy** — the context-percentage bridge can't be read; the
  command explains why (the same sentence the status line's own stand-down
  message uses, printed verbatim rather than reworded a second time).
- **work in flight** — other lanes (subagents) are actively running in this
  session. Per a third owner ruling (2026-09-06, quoted): *"if somthing is
  running you should say it and the user could wait for the collision to
  complete or choose to stop or pause it in order to execute the update
  handover command."* Each running lane is printed **by name and description**
  (never just a count) so a person can actually decide what they'd be
  stopping. `--anyway` proceeds past this refusal explicitly; there is
  deliberately no code anywhere in my_context that can itself stop or pause a
  lane — *"the only thing that can end it is Claude Code killing it"* — so the
  choice offered is wait, or stop it yourself in Claude Code, or `--anyway`.
- **work unknown** — the audit log couldn't say whether anything is running;
  distinct from "nothing is running."

Running `handover ask` for real **stamps a per-session latch** (recording
that this session was asked, and when) even though it does not itself write
into `reports/V2-HANDOVER.md` — the file-write is left to the assistant, in
response to the returned `ask` text. Because that stamp is a state mutation,
this chapter was written **without executing it live**; its behaviour above
is drawn entirely from `src/core/handover-ask.ts` and
`src/cli/commands/handover.ts`.

## 7.3 `check:handover` — checking the handover for truth, not just currency

**What it is.** `npm run check:handover` (`scripts/check-handover.ts`) scans
`reports/V2-HANDOVER.md` for its two real pointer vocabularies — `plan/seq`
lane references (like `` `walk/119` ``) and item-id references (like
`` `TASK-…` ``) — and resolves every one of them against the live corpus.

**Why it exists, in the project's own words.** The header records the exact
defect that motivated it: `reports/V2-HANDOVER.md` once carried the
instruction *"widen `isServableDocPath` to serve `.my_context/items/**`"* in
**six consecutive blocks** (90%, 92%, 93%, 94%, 95%, 96%) — and it was wrong
the entire time, because `.my_context` is in `SKIP_DIRS` and the code path it
named would never even see a corpus file. *"A lane following the instruction
faithfully would have shipped a feature that served NOTHING, looked done, and
passed every gate. It was caught only because one lane measured instead of
trusting."* `check:handover` exists to catch the *shape* of that defect — an
instruction repeated block after block that never becomes a closed item —
mechanically, rather than relying on a future lane happening to measure again.

**Why `verify-citations.ts` (the general citation gate) doesn't cover this.**
The header states a measurement taken 2026-09-06: pointed at the (then)
2,831-line handover, that gate would raise zero faults and check zero
claims — the handover speaks no `file · fragment · ~line` citations at all,
only `plan/seq` and item-id pointers. Widening that gate to the handover
"would have been a change that looked done and served nothing," which the
project's own words call "not coverage, it is the appearance of coverage."

**The three tiers, read from the source:**

- **DANGLING is GATED** — a pointer that resolves to nothing existing is
  binary and cheap to fix, so this is the one tier that fails the check.
- **RETIRED is REPORTED, never gated** — a pointer naming a task that was
  later superseded is not the same as a pointer naming nothing. *"A RETIRED
  item EXISTS: it has a file, a status, and...a `superseded_by` edge naming
  what replaced it."* Calling that "nothing" would conflate RETIRED with
  ABSENT — a conflation this project separately ruled against
  (`TASK-code-and-tests-that-speak-with-a-retired-item-s-authority`). Gating
  on it would force either rewriting history or never retiring anything a
  handover ever mentioned.
- **CARRIED is REPORTED, never gated** — an instruction repeated across
  several blocks while still open. Repetition alone doesn't prove a defect
  ("only a person knows whether a line has been repeated five times because
  it is hard or because it is impossible") — but it's exactly the shape the
  `isServableDocPath` incident had, so it's surfaced by name.

**Worked example — real output, run against this repository right now**
(`check-handover.ts` is a pure reader: it opens the corpus read-only and
writes only to stdout, so it was safe to run for this chapter):

```
$ node scripts/check-handover.ts
...
CARRIED  reports/V2-HANDOVER.md:110
         port/99 → port/99 [todo]
         carried in 8 of 45 blocks and still open
CARRIED  reports/V2-HANDOVER.md:48
         port/98 → port/98 [todo]
         carried in 4 of 45 blocks and still open
CARRIED  reports/V2-HANDOVER.md:48
         port/93 → port/93 [todo]
         carried in 3 of 45 blocks and still open
CARRIED  reports/V2-HANDOVER.md:195
         walk/141 → walk/141 [todo]
         carried in 3 of 45 blocks and still open

4682 line(s), 45 block(s) · 218 distinct pointer(s): 134 lane, 84 item · 0 resolving to nothing, 4 naming retired work
every pointer in the handover names something that exists.

4 pointer(s) name work that was RETIRED with a successor. REPORTED, never gated: ...
7 instruction(s) carried into 3+ blocks with the work still open. REPORTED, never gated: ...
```

Zero DANGLING pointers, four RETIRED-but-successor-named (harmless, reported
only), and seven CARRIED-3+-times instructions (a signal worth a human's
attention, but not a failure). The check's exit code in this run is **0**,
because only DANGLING gates it.

## 7.4 Why `reports/V2-HANDOVER.md` is prepended to, and what that means for citations

`reports/V2-HANDOVER.md` is a **historical, append-at-the-top document** — a
real look at line 1 of the file confirms the newest block sits first:

```
## ⏭ 2026-09-12 — D41 CLOSED, 20 OF 25 DONE. `recall/2` IS RUNNING AND CLOSES D42. ...
```

with 44 more `##`/`###` blocks following it, oldest last. Because every write
inserts a new block at the top, **every line number below it moves on the
next write** — which is precisely why this document's own governing rule,
[`RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number`](../../.my_context/items/rule),
exists and why this whole capabilities document follows it: an id (`TASK-…`,
`DEC-…`, `walk/119`) keeps its name forever; a line number in a prepended-to
document is stale before the next commit.

## What's NOT built / built but off

- `restore --approve`/`--discard` have **no slash command and no MCP tool**,
  by deliberate design (see §7.1) — this is a documented absence, not a gap.
- `handover ask` cannot be exercised at all from a plain terminal — by design,
  not a missing feature.
- This chapter did not execute `restore --build`, `--approve`, `--discard`,
  or `handover ask` live, because each either mutates the corpus/staging
  directory or stamps a per-session latch; their behaviour above is drawn
  entirely from source, not from live output. `restore --show` and
  `check:handover` **were** run live and their real output is pasted above.
- Nothing is currently staged in this workspace (`restore --show` returned
  empty), so no real `--approve` review-form example could be captured
  without creating one — left undemonstrated rather than fabricated.

## See also

- [00 — Index](./00-index.md)
- [03 — Creation and the gates](./03-creation-and-gates.md) — the same
  "propose, then a distinct human approval step" shape as `restore --approve`.
- [06 — Retrieval](./06-retrieval.md) — `restore --build --from-result` stages
  a retrieval result through this same carrier.
- [13 — Testing discipline](./13-testing-discipline.md)
