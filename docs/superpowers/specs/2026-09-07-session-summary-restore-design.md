# Restoring a session from its own transcript

**Design AGREED — owner, 2026-09-07.**

When a context window has lost more than it should, the session's own transcript
file is read, summarised to a recipe, reviewed by the owner as numbered points,
and — **only on his approval, and only after he clears the window** — injected.

---

## 1. The problem, stated exactly

The session file and the context window are not the same thing, and the
difference is the whole reason this feature exists.

- **The session file** is `~/.claude/projects/<project>/<session-id>.jsonl`,
  append-only. Every prompt, answer, tool call and result is a line appended to
  the end. Nothing is rewritten while the session runs. The owner's current
  session is **51.3 MB and 24,757 records**.
- **The context window** is what is sent to the model each turn. It has a hard
  limit and is assembled fresh. It cannot hold 24,757 records and never could.

When the window fills, the harness summarises the older part and continues.
**The file is untouched — the compaction event is appended to it like anything
else.** So everything that left the window is still on disk, in full.

**Nothing automatic brings it back.** `--resume` continues from the compacted
state. `my_context`'s own restore tier scans the transcript after a compaction,
but reaches only the **final 8 MB** — a sixth of this session.

So there is a real state, reached in practice: *the window has forgotten
something load-bearing, the disk still holds it, and no existing mechanism will
return it.* This feature is the answer to that state and to nothing else.

---

## 2. What this is NOT

**It is not a routine mechanism, and it must not become one.** Owner ruling,
2026-09-07: *"this is not a usual ongoing behaviour but a solution for special
cases when this is the last option to restore important things that otherwise
would be lost."*

Consequences that follow, and each is a design constraint rather than a
preference:

- **No budget management.** Owner ruling: it takes as much as it requires. The
  existing tiers (`pinned`, `jit`, `restored`, `continuity`, `index`) budget a
  recurring cost. This has no recurring cost, because it happens when a person
  decides it must.
- **No automatic triggering, ever.** An agent may propose it and may build it.
  Only the owner injects.
- **It is not a replacement for the handover.** The handover is written
  continuously and is the ordinary mechanism. This is the one for when the
  ordinary mechanism was not enough.

---

## 3. The sequence — and why it is an override rather than an append

The owner's Amendment 2 settles the mechanics, and it is the key to the design.

A hook cannot *replace* what is in a context window; the harness owns the
window. What it can do is *add*. So on its own, an injection is an append, and
appending to a window that is already too full is self-defeating.

**His answer: clear first, then inject.**

```
1.  PROPOSE   agent (or owner) says: this window has lost something; the
              transcript still has it.
2.  BUILD     agent reads the session file and builds the summary, against a
              stated recipe (§4). Automatic — no approval needed to BUILD.
3.  REVIEW    owner reads a SHORT form: numbered main subjects only (§5).
4.  APPROVE   owner approves. Nothing is injected yet.
5.  STAGE     the summary is written to disk, marked for delivery.
6.  CLEAR     THE OWNER clears the context window. His act, not the agent's.
7.  DELIVER   the next injection delivers the staged summary into the now-empty
              window.
```

**Step 6 is what turns an append into an override**, and step 5 is what lets the
summary survive it: a clear empties the window, so anything held only in the
window is gone — the summary must be on disk before the clear, not in the
conversation.

**Both halves already exist and must be reused rather than reinvented:**

- `mycontext carry <id>` already marks something for delivery at the next
  injection, one-shot, then forgets. That is exactly step 5 and step 7.
- The SessionStart / compact-restore path already delivers into a fresh window.
  That is step 7's carrier.

---

## 4. The recipe — what to take and what to skip

The summary's quality is the whole value, and this is the part that needs
research rather than assertion. What follows is the starting point and the one
measurement we already have.

### 4a. The mechanical filter, which is free and large

Measured on the owner's own session, 2026-09-07: of **24,757 records, 15,788
carry no `message` object at all.** They are `attachment`, `system`, `ai-title`,
`file-history-snapshot`, `last-prompt`, `mode`, `queue-operation` and similar.

**That is 64% of the file removed before anything semantic happens**, by a filter
on record type — a mechanical test, not a judgement. Everything below operates
on the remaining 36%.

(The same 15,788 records are why the archive's list shows 8,969 classified
records against 24,757 total. The two features share this measurement.)

### 4b. The hypothesis for what to keep

Stated as a hypothesis because it is one, and §7 says how to settle it.

**Keep:**
- **Decisions and their reasons.** "We ruled X because Y." The reason is what
  cannot be recovered from the code.
- **Corrections.** "I was wrong about X; the truth is Y." A correction that is
  lost is a mistake that will be made again — this session made four.
- **Measurements.** A number somebody counted, with what was counted. Expensive
  to reproduce, cheap to carry.
- **Unresolved questions**, and who they are waiting on.
- **What was tried and failed**, with why. The most expensive thing to rediscover.

**Skip:**
- **Tool outputs.** Reproducible by running the tool again.
- **Code and file contents.** Already on disk; a summary quoting a file is a
  second copy that can go stale.
- **Anything the corpus already holds.** Items are injected on their own account;
  duplicating them spends the window twice on the same sentence.
- **Process narration.** "Now I will read the file."

### 4c. Options, because one recipe will not fit every emergency

The owner asked for options so the summary can be built accurately. The axes
that appear to matter:

- **Range** — the whole session, or from a named point (a compaction boundary, a
  timestamp, a message).
- **Subjects** — everything, or restricted to named subjects.
- **Depth** — the numbered-points form only, or points plus their reasoning.
- **Include code** — off by default per §4b, on when the lost thing *is* a piece
  of code that exists nowhere else (a reverted patch, a command that worked).

---

## 5. The review form

**The owner reviews a SHORT form, not the payload.** His words: *"the summary
content to be injected should be also shortened only for user review in numbered
points of the main subjects included."*

So there are two artefacts:

- **The payload** — what would be injected. As long as it needs to be.
- **The review form** — numbered main subjects, one line each. What he reads and
  approves.

This is the same division the product already uses in `supersedeItem` and
`execute`: a person approves against a readable statement of what will happen,
not against the bytes.

**A consequence that must be stated rather than discovered:** he is approving a
summary he has not read in full. So the review form must be honest about
coverage — how much of the session was read, what the filter dropped, and where
the recipe chose to skip. A review form that reads as complete when it is
partial is worse than no review form.

---

## 6. The loop guard

The injected summary becomes part of the transcript, because everything does. So
a later summary would summarise the summary, and the compounding is silent.

**Every injected summary carries a marker, and the reader that builds a summary
excludes marked records.** Without this the feature degrades itself the second
time it is used.

---

## 7. How the recipe gets settled

Not by argument. **Build the recipe, run it against this very session — 51.3 MB,
24,757 records, a compaction already behind it — and have the owner read the
numbered points and say what is missing.**

This session is the ideal test case and it will not be available forever, which
is an argument for building the reader early even if the injection half waits.

---

## 8. Relationship to the archive

This feature reads the session file. `plan:archive` already does: `archive/1`
indexes every transcript, `archive/7` reads one as a continuous document,
`archive/4` mirrors a session marked persistent so it survives deletion.

**The reader is shared, not duplicated.** A second scanner over the same JSONL
would drift from the first — which is the failure this whole day has been about.
Whatever `archive/1`'s scanner produces is what this summarises.

**And the dependency runs the other way too:** Claude Code prunes old session
files, and the owner ruled on 2026-09-07 that a pruned session's row is deleted.
So a session that was never marked persistent cannot be restored by this feature
either. **`archive/4` is this feature's prerequisite in practice**, even though
nothing in the code will say so.

---

## 9. Failure modes

- **The summary is wrong or thin.** Mitigated by §5's review form and by §7 —
  and it is a real risk, because the payload is not what the owner reads.
- **The clear happens without the stage.** Then the summary is gone with the
  window. Staging (§3 step 5) MUST complete and be verifiable on disk before the
  owner is told it is safe to clear.
- **Recursive summarisation.** §6.
- **It becomes routine.** §2. If this is being used weekly, the handover is
  failing and that is the thing to fix.

---

## 10. Not building

No automatic detection of "the window lost something". No automatic injection
under any condition. No new dependency. No budget tier (§2). No second transcript
scanner (§8).
