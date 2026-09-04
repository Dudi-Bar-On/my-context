# Conversation archive — design

**Status:** design AGREED, not yet planned. Written 2026-09-04 from the owner's requirements, with
every claim about the harness measured rather than assumed; the three questions it opened were
answered the same day and are recorded under *Decisions taken* below. What remains before this can
be built is a plan, not a decision.

## What the owner asked for

> "an ongoing recording of the conversation on the terminal including formated data (for example
> colors, tables and so on), it should be collected like log files and i need a way to browse,
> retrieve and display the content at a later time, there should be a distinguishable way like
> color, tag, title or other way to mark user input as prompt vs agent answers and output"

With two refinements taken in the same sitting:

> "viewing the rendered conversation, browsing and all other activities could be added to the app
> as web feature"

> "if the user want to get a copy, let him do it when it browsing or looking at a conversation
> something like an export conversation, also the viewer should allow to view an exported
> conversation distinguished from the internal one that is saved at claude directory"

And, from the earlier config conversation, the whole thing is opt-in: a project either turns this
on or works exactly as it does today.

## The finding that shapes everything

**The recording already exists.** Nothing needs to be captured.

Claude Code already writes the full conversation to `~/.claude/projects/<project>/<session>.jsonl`.
Measured on one of this project's own sessions, 2026-09-04:

    size     13,095,349 bytes
    types    user=28  assistant=54  system=5  attachment=51  file-history-snapshot=3
    roles    user=28  assistant=54
    keys     type, uuid, parentUuid, timestamp, sessionId, cwd, gitBranch, version,
             message, toolUseResult, durationMs, promptId, requestId, rendered, ...

Three consequences follow, and they are the reason this design is small:

1. **`message.role` already separates prompts from answers.** The distinguishing mark the owner
   asked for is a field, not something to invent.
2. **`parentUuid` threads the conversation**, so ordering and nesting reconstruct without guessing.
3. **The product can already reach it.** `transcript_path` arrives on hook payloads
   (`src/hooks/io.ts`), and `src/core/ledger.ts` already reads transcripts today
   (`scanTranscriptIds`, `readTail`). No new plumbing to the harness is needed.

So this is a **reading and display** feature, not a recording one.

## What is NOT in the transcript, and what that costs

**The colours and tables as the terminal drew them are not there.** Checked directly: no ANSI
escape sequences appear anywhere in the file. The transcript stores structured content and the TUI
renders it at display time.

This is a real reduction against the request as first stated. A conversation will be **re-rendered**
— markdown becomes HTML, a table looks like a table — but it will not be a pixel-faithful replay of
what the terminal showed.

Byte-exact replay would need a PTY recorder (`script`, `asciinema`) wrapping the session. That is
rejected here for two reasons: vendoring one would break `CONST-zero-runtime-dependencies`, and it
could only ever capture sessions someone remembered to wrap, which is the opposite of "ongoing".
The owner chose the archive knowing this. If exact replay is ever wanted it is a separate feature
that indexes externally-produced recordings, and it does not change anything below.

## The relationship to the transcripts: read in place

**Transcripts are read where they are and never copied.** The corpus stays a curated knowledge
store rather than becoming a conversation dump; 13 MB per session never enters git; and nothing
has to be kept in step with anything.

What is kept is an **index**, in the same disposable SQLite index the corpus already uses, holding
only what a browse list needs:

    conversations(session_id, started_at, ended_at, bytes, prompts, answers,
                  branch, cwd, title, source)

`source` is the field that answers the owner's second refinement — see *Two kinds of conversation*
below.

This index is disposable in exactly the sense the rest of the index is: `INV-markdown-is-the-source-
of-truth` has an analogue here, which is that **the transcript file is the source of truth and the
index is a cache that a rebuild reconstructs**. Nothing in the archive may hold a fact that the
transcript does not.

**The limit, stated rather than discovered later:** if the harness ever prunes old transcripts, the
archive loses them too. That is the price of not copying, and it is why export exists.

## The screen

A `Conversations` screen in the existing read-only web UI.

**The list.** Sessions newest first: date, duration, prompt and answer counts, git branch, size,
and a title taken from the transcript's own `aiTitle` record — shown as the model's, and
overridable for a session worth naming. Filterable by date and branch, searchable across content.
Exported conversations appear here too, marked and carrying the date they were taken.

**The transcript view.** The conversation in order, with:

- **prompts visually distinct from answers** — the owner's requirement, and the field to key on is
  `message.role`. Distinct by more than colour alone, because the app is bilingual and themed and
  colour is not the only channel available: a tag or gutter marker carries it when colour cannot.
- **tool calls folded by default.** They are most of the volume and rarely what a reader came for.
- **attachments and system reminders folded**, and marked as machinery rather than conversation.
- Timestamps, and `durationMs` where the record carries it.

**What the screen must not do:** the web UI is read-only, and its own navigation says so — the
third section is headed *"CHANGE — COMPOSED, NEVER RUN"*. Nothing on this screen writes.

## Export: composed, never run

The owner wants to take a copy while looking at a conversation. Because the UI never writes, the
screen **composes a command** and the reader runs it — exactly as the Doctor screen composes
`mycontext ack …` and offers Execute.

    mycontext conversation export <session> --to <path>

This follows the rule `mycontext export` already states: *"writes an artefact to a path outside the
workspace, which a slash command cannot choose safely on the user's behalf: the destination is the
whole decision."* So the destination is always explicit, and the command sits on the approval
boundary with the rest of the write surface, derived by probing rather than declared in a list.

An export is **self-contained**: one file carrying the conversation and enough metadata to render
it without the original. It is a copy the owner keeps, and nothing in the archive depends on it.

## Two kinds of conversation, and why they must look different

The viewer opens two things that must never be confused:

| | source | authority |
|---|---|---|
| **live** | `~/.claude/projects/…` | the harness writes it; it can change or be pruned |
| **exported** | a file the owner chose to keep | frozen at export; the owner owns it |

The owner asked for these to be distinguishable, and the product already draws this distinction
elsewhere: `mycontext pack import` treats a stranger's corpus as categorically different from your
own, behind two confirmations. **The archive should look like that rather than invent a new
vocabulary.** An exported conversation is marked as exported wherever it appears — in the list, in
the header of the view, and in anything the viewer serves about it — and it carries the date it was
taken, because a frozen copy of a living thing is only meaningful with the date attached.

This is also why `source` is a column in the index rather than a thing inferred from a path.

## Configuration

One key, defaulting to **off**, following the precedent of `ui.enabled` and `handover` — subsystem
switches rather than tuned numbers. A project that does not turn it on behaves exactly as it does
today, and nothing scans a transcript.

This is the same shape as the owner's earlier ruling that the structured layer must be optional:
*"let this capability be flexible by adding this feature to config and allow the user to decide."*

## What this deliberately does not do

- **No pixel-faithful terminal replay.** Argued above.
- **No copying transcripts into the corpus.** Argued above.
- **No writes from the web UI.** Forced by the read-only rule.
- **No editing or annotating a conversation.** A record of what happened is not a document to
  revise; if annotation is ever wanted, the corpus is where a note belongs, with a citation.
- **No cross-project browsing.** Transcript paths are per-project and so is the corpus. A second
  project's conversations belong to that project's workspace.

## Risks, named rather than discovered

- **Transcripts contain everything ever pasted**, including anything sensitive. Reading in place
  keeps that out of git, but the browse screen surfaces it on a local port. The server is loopback
  only and token-gated, which is the existing answer, but the archive widens what a leaked nonce
  would show and that should be said out loud in the feature's own help.
- **13 MB per session is large to render.** The view must page or virtualise rather than sending a
  whole session to the browser; the corpus screens' existing bounded-list conventions apply.
- **The transcript schema is the harness's, not ours.** It can change without notice. The index
  must tolerate unknown record types by ignoring them, and the reader must never assume a key it
  has not checked for. This is the same discipline `scanTranscriptIds` already exercises.
- **A pruned transcript is a broken row in the index.** The list must show that a session's file is
  gone rather than failing to load, and that is the strongest argument for export.

## Decisions taken, 2026-09-04

All three questions this design opened were answered the same day. They are recorded here as
decisions rather than left as questions, because a spec that still asks what it should do cannot be
planned from.

**Exports are indexed and listed beside live sessions, marked and dated.** An export you cannot find
again is not a copy, it is a file; and the `source` column already exists to draw the distinction
the owner asked for. The list therefore stops being a pure mirror of what the harness holds, and
that is the accepted cost — it becomes a list of what the OWNER holds, which is the more useful
thing.

**The list is titled from `aiTitle`, and a title may be overridden.** It is already in the
transcript, so every session gets a readable name at no cost rather than a row of timestamps. The
title is shown as what it is — written by the model — and a session worth naming can be named. The
alternative considered and rejected was the first prompt, because first prompts are routinely
"continue" or "ok go ahead", which names nothing.

**Every transcript on disk is indexed, with no time window.** The index holds one row per session,
not per message — roughly two hundred bytes against a thirteen-megabyte transcript — so it stays
small however many sessions accumulate, and a rebuild is one stat and one tail per file. A rolling
window was rejected for the reason that makes this feature worth building at all: retrieval matters
most for the conversations you have forgotten, which are exactly the ones a window excludes.

## Lane activity is NOT part of this, and the measurement says why

The owner also asked to see what a subagent is doing moment by moment — the line a terminal shows
while a lane runs, such as `general-purpose  Reading audit-new-ops.test.ts family order`. That
looks like it belongs here and does not.

**Measured: the parent transcript contains zero `isSidechain` records.** None of a lane's work
appears in the conversation this archive is about. Each lane writes its own separate transcript, and
`SubagentStop` hands over its location as `agent_transcript_path`.

Those files also differ in the one property this design leans on: parent transcripts live under
`~/.claude/projects/` and persist, while lane transcripts live in the OS temp directory — measured
at 104 MB across three sessions — and can be swept away without warning.

So it is a different feature over a different source with a different risk, and the owner ruled it
belongs in the **audit stream** rather than in this viewer: one row per tool call, backfilled from
the lane's transcript when it ends. That is tracked as
`TASK-the-audit-stream-cannot-say-what-a-lane-was-doing-at-a-given`. Nothing in this design depends
on it, and it depends on nothing here.

## Implementation order, when it is scheduled

1. The index table and the scanner, with a rebuild that reconstructs it from disk.
2. `GET /api/conversations` and `GET /api/conversations/:id`, read-only, bounded.
3. The screen: list, then transcript view, then folding and search.
4. `mycontext conversation export`, on the approval boundary.
5. Opening an export in the viewer, marked as exported.

Steps 1 and 2 are worth landing alone: they make the data reachable and testable before any pixel
is drawn, and they are what everything else rests on.
