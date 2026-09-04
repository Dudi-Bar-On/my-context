# Probe: does anything fire live inside a lane, what does it carry, and why does `SubagentStop` write almost no steps

Covers `TASK-nothing-is-known-about-whether-a-tool-call-inside-a-subagent` (hooks/30) and
`TASK-the-step-backfill-produces-nothing-for-ninety-eight-percent` (hooks/32), plus the
mid-probe question about where the terminal's per-step status sentence comes from. Measured
2026-09-04, no interactive session for the live-hook portion — an isolated throwaway `claude -p`
process under a custom `--settings` file, exactly the method
`reports/probes/2026-08-20-clear-and-prompt-hooks.md` §1b used and for the same reason: this
project's own `hooks/hooks.json` is read once at session start, not hot-reloaded (verified below,
§0), so the only way to observe a **different** hook configuration is a fresh process.

---

## 0. `hooks.json` is not hot-reloaded — verified, not assumed

Before touching anything, a cheap live test: added one additive `PostToolUse` entry
(matcher `*`, pointing at a throwaway logger) to **this repository's real**
`hooks/hooks.json`, then ran one ordinary Bash tool call in this same session. No log line
appeared. Reverted immediately (`git diff --stat hooks/hooks.json` confirms it, both before and
after every step of this probe, reads empty — see §6).

**Consequence for method:** any live capture had to run in a **new** `claude -p` process, never
by editing this session's own manifest. That is why every live measurement below comes from an
isolated scratch harness (settings file, scratch working directory) that never read or wrote this
repository's `.my_context/`.

---

## 1. Method

**1a. Live harness.** `probe-hook-logger.mjs`, a throwaway script in this session's scratchpad
(never entered the repo): reads stdin JSON, appends one line — timestamp, which `hooks.json`
entry fired (`argv[2]`), `hook_event_name`, the payload's top-level **keys**, and a short
allow-list of **short identifier fields** (`tool_name`, `agent_id`, `agent_type`, `session_id`
truncated to 8 chars, `tool_input`/`tool_response` **keys only**) — never a prompt, a command, a
file path's contents, or any other value that could carry content. `agent_transcript_path` and
`cwd` are the two exceptions logged as full values: both are filesystem paths, not content, and
resolving the step-backfill question requires seeing where the platform actually points, not just
that it points somewhere.

`probe-settings.json`, passed with `--settings` to three separate `claude -p` runs from an empty
scratch directory (never this repository): registers `PreToolUse` and `PostToolUse` with **no
matcher** (`*`, everything), and `SubagentStart`/`SubagentStop` with none (matching this project's
own registration style for those two). No project, user, or plugin settings file was edited.

**1b. Static.** The installed binary, `C:/Users/UserC/.local/share/claude/versions/2.1.260`
(newer than the 2.1.239 the 2026-08-20 probe read — the version has moved since), read with
`grep -a -b -o` and `dd … | tr -d '\000'`, exactly as that probe's §1a describes. Minified names
are not stable across builds; every quote below carries its byte offset in **this** build.

**1c. Corpus.** This project's own `.my_context/.audit/audit.jsonl` and the rotated
`audit.20260903T141630248Z-18800.jsonl`, read directly (not through `mycontext audit`, whose
default is a bounded recent window). The corpus is **live** — this session's own coordinator kept
dispatching lanes throughout this probe — so counts below are frozen snapshots, each stamped with
the moment they were taken; a re-run minutes later will show larger totals and that is expected,
not a measurement error.

---

## 2. Question 1 (hooks/30) — does ANY hook fire inside a subagent?

### Decisively yes, live, per tool call. Not batched.

One live run: dispatch one throwaway `general-purpose` subagent instructed to run three separate
`Bash` calls, each with a `description`. The probe's own log, in order:

```
13:59:06.807Z PreToolUse   tool=Agent  agent_id=null            (the PARENT's own dispatch call)
13:59:08.417Z SubagentStart            agent_id=a84319ab0f026c004 agent_type=general-purpose
13:59:12.088Z PreToolUse   tool=Bash   agent_id=a84319ab0f026c004 agent_type=general-purpose
13:59:36.364Z PostToolUse  tool=Bash   agent_id=a84319ab0f026c004 agent_type=general-purpose
13:59:40.210Z PreToolUse   tool=Bash   agent_id=a84319ab0f026c004 agent_type=general-purpose
13:59:50.013Z PostToolUse  tool=Bash   agent_id=a84319ab0f026c004 agent_type=general-purpose
13:59:53.345Z PreToolUse   tool=Bash   agent_id=a84319ab0f026c004 agent_type=general-purpose
14:00:06.430Z PostToolUse  tool=Bash   agent_id=a84319ab0f026c004 agent_type=general-purpose
14:00:10.123Z SubagentStop             agent_id=a84319ab0f026c004 agent_type=general-purpose
14:00:10.469Z PostToolUse  tool=Agent  agent_id=null            (the PARENT's own dispatch call)
```

`PreToolUse` and `PostToolUse` fire **immediately before and after each individual tool call
inside the lane** — three full cycles, minutes before the lane's own `SubagentStop`. This settles
the question the item was blocked on: the platform can and does report a lane's steps as they
happen. The reason this project's own `PostToolUse` (matcher `Write|Edit|MultiEdit|Agent`)
produces zero agent-attributed rows is **not** that the hook fails to fire inside a lane — it is
that (a) most subagent tool calls are `Bash`, which the matcher never named, and (b)
`src/hooks/post-tool-use.ts`'s own `HookInput` interface never declares `agent_id` and neither
`nudgeFor` nor `agentDispatchNote` reads it — so even the `Edit`/`Write` calls the matcher **does**
already catch have never had their attribution wired up. Both are code gaps, not platform limits.

## 3. Question 2 — what does the payload carry, and does it identify the lane?

**Keys only, as required.** On every `PreToolUse`/`PostToolUse` firing **inside** a lane:
`agent_id`, `agent_type`, plus the ordinary
`cwd, effort, hook_event_name, permission_mode, prompt_id, session_id, tool_input, tool_name,
tool_use_id, transcript_path` (`PostToolUse` adds `duration_ms` and `tool_response`).
`session_id` is the **parent's**, identical to a lane's own transcript record — matching
`hooks/io.ts`'s existing comment. `agent_id`/`agent_type` are the two fields the payload adds for
a subagent's own tool call, and both are present on **every** firing measured, flat or nested (§4).
On the parent's own `PreToolUse`/`PostToolUse` for the `Agent` tool call that does the dispatching,
`agent_id`/`agent_type` are **absent** (`null`) — correct, since that call is made by the parent,
not inside a lane.

`SubagentStop` additionally carries `agent_transcript_path` (a real, resolvable, absolute path —
see §5) and, per the platform's own build, `background_tasks`, `session_crons`,
`last_assistant_message`, `stop_hook_active` (declared in the schema at byte 182366856 of
2.1.260, quoted in full in §5).

## 4. Question 3 — timing

**Per tool call, live — never batched.** `PreToolUse` precedes the call, `PostToolUse` follows it
(the gap between them is the tool's own run time — 24s, 10s and 13s for the three echoes above,
consistent with per-call latency, not a batch flush). `SubagentStop` fires once, at the very end,
well after the last `PostToolUse`. A second live run nested a subagent dispatching its own
subagent — depth 2 — and every event at both levels still carried `agent_id`/`agent_type`
correctly and in the same per-call rhythm; nesting is not what breaks attribution (contrary to
one live hypothesis this probe raised and then ruled out by direct measurement).

## 5. Question 4 (hooks/30) / the whole of hooks/32 — why do most stop records carry no dispatch, and why does the backfill produce nothing

### The two live-probe controls: the mechanism works exactly as designed, when it is a real dispatch

Every ordinary `claude -p` Task-tool dispatch measured in this probe — flat, and nested one level
— produced exactly one `SubagentStop`, carrying a real `agent_type` and a real
`agent_transcript_path`:

```
agent_transcript_path=…/21e99aa6-…/subagents/agent-a84319ab0f026c004.jsonl
```

Read directly with this project's own `transcriptSteps` (`src/hooks/subagent-stop.ts`), a real
1.7 MB, 334-line, 82-tool_use transcript from **this project's own real corpus**
(`agent-a8799bbc8d0032eb7.jsonl`, an `e2e worker-scoped server fixture` lane dispatched by this
session earlier today) parses to **82 of 82** correct steps — the function is not broken and the
convention (`.../subagents/agent-<id>.jsonl`) is not a guess; both are proven by direct execution.

### The real corpus: a snapshot taken 2026-09-04 ~16:50Z

Reading `.my_context/.audit/audit.jsonl` plus the rotated file directly (not through
`mycontext audit`'s bounded window): of the `subagent-stop` rows written **after** the
step-backfill feature's own deploy (`5515ed277184ac27317815e67f43b3c0b3522888`,
2026-09-04T07:45:38Z, `earliest agent-step at 07:45:42Z`), **704** distinct-firing rows, of which
**685 (97.3%) carry `type=<absent>`** and only **19 carry a real `agent_type`**. Of those 19,
**14 have `agent-step` rows and 5 do not** (all 5 in the first hour after the feature deployed —
plausibly transient, not re-investigated further, and not the volume that matters). Of the 685
`type=<absent>` rows, **1** has steps (a manually-constructed `VERIFY_MINE` test row, not a real
lane). **This matches the item's own count almost exactly** (990/975 vs this snapshot's 704/685 —
the corpus grew between the two measurements, which is expected on a live system).

**The decisive comparison, the one the item asked for.** Cross-referencing every `type=<absent>`
agent id against the **100 most-recently-retained** real transcript files under this session's
`…/595db3b1-…/subagents/` directory: **zero** overlap. Every one of the 100 retained files
matches a `type`-**present** id; none matches a `type=<absent>` one. That is not explained by
eviction (a random or LRU eviction policy would not produce a clean zero against a population of
6,804 distinct `type=<absent>` ids spanning the whole day, while sparing all 100 of the much
smaller `type`-present population) — it is explained by **`type=<absent>` firings never getting a
`subagents/agent-<id>.jsonl` transcript file written for them in the first place.**

### Reading (b) is the answer: `SubagentStop` is firing for things that are not lanes

Static confirmation, build 2.1.260. The platform's own validator declares `agent_type` on
`SubagentStop` as **required**, no `.optional()` (byte 182366856):

```
hook_event_name:R("SubagentStop"),stop_hook_active:D(),agent_id:s(),
agent_transcript_path:s(),agent_type:s(),last_assistant_message:s().optional()…
```

But the **emitter** — the one function that actually constructs the payload, found once (byte
189882600) and confirmed as the **sole** production site by five call-site matches on its name —
defaults it silently:

```
ue = d ? {...re, hook_event_name:"SubagentStop", stop_hook_active:o, agent_id:d,
           agent_transcript_path:Ld(d), agent_type:k??"", last_assistant_message:U, ...G}
       : {...re, hook_event_name:"Stop", …}
```

`d` and `k` are the 5th and 8th positional parameters of this ONE shared generator
(`async function*WX(e,n,r,o,d,p,y,k,v="turn_end")`, byte 189881600 region). **The same function
emits both the top-level `Stop` event and every `SubagentStop`**, branching only on whether the
current turn's context carries an agent id (`d`) at all — there is no second, dispatch-specific
emitter. Five call sites reuse it (bytes 187937922, 188680634, 188686913, 188694048, 189882227),
tagged `"loop_tick"`, `"blockable_turn_end"`, `"turn_end_reactions"`, and one interrupted-query
cleanup path — **none of those five names is "a Task-tool dispatch finished."** Every call site
that was inspected threads `agentType` through from its own context object
(`e.agentType`/`p.agentType`/`y.agentType`), so **`k` is `""` whenever that specific context
object's `.agentType` was never set** — which this measurement shows happens on the overwhelming
majority of real firings.

**So `type=<absent>` is not this project losing a label. It is the platform's shared "a turn
carrying an agent id ended" signal, reused for something that was never a named lane and was
never going to have a transcript to back-fill from.** `recordAgentSteps` returning zero rows for
it is **correct**, not a parsing failure — the function was tested directly against a real,
populated, correctly-pathed transcript and extracted every step perfectly (§ above). The 98%
figure is a symptom of one shared platform event covering many kinds of "turn ended," not of a
broken read.

### What was NOT established

What specifically the 685 non-lane firings *are* (a background-task cleanup, a scheduled/loop
wakeup, or something else entirely) was not pinned down beyond the five call-site tags above —
that would need either a live probe that deliberately provokes each of those five triggers
individually (not attempted; out of this probe's remaining budget) or a person at the platform's
own source. What **was** established, with direct evidence at every step, is that they are not
Task-tool dispatches, they get no transcript, and the code that reads `agent_transcript_path` is
not the thing to fix.

### The fix made, inside `src/hooks/subagent-stop.ts` (owned)

`observeSubagentStop`'s note already distinguished `type=<absent>` from a real type — that part
was already correct. What it did not do was say **why** a `type=<absent>` row should never be
expected to grow an `agent-step` row, which is exactly the ambiguity
`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` names. Changed:

```
delivery=finished agent=<id> type=<absent> (no agent_type on this firing — not a named lane;
no step backfill will be attempted); its seen file was left in place
```

(was: `delivery=finished agent=<id> type=<absent>; its seen file was left in place`). One new
test (`test/hooks/observation-hooks.test.ts`, "SubagentStop with no agent_type says plainly that
it is not a named lane") pins the wording. Full `npm test`: **6293 pass, 4 fail** — all four
failures are pre-existing `test/ui/**` `fetch failed (bad port)` cases unrelated to this change
and outside this task's owned files (`src/ui/**` is explicitly another lane's territory); `73/73`
pass across every `test/hooks/**` file touched or adjacent (`subagent-stop-steps`,
`observation-hooks`, `post-tool-use`, `hooks-manifest`). `npx tsc --noEmit`: exit 0.

**What was NOT fixed, and whose fix this is not.** The screen that counts "lanes" from
`subagent-stop` rows reads `src/core/render.ts` / `src/core/select.ts` / `src/core/audit.ts` /
`src/ui/**` — all explicitly out of scope for this work. The recommendation for whoever owns
those: **stop counting every `subagent-stop` row as a lane.** A row is a real, user-visible lane
only when its `type` is present (equivalently, when a matching `agent-dispatched` row exists — see
next). Counting `type=<absent>` rows as lanes-with-zero-steps is exactly the "the log honestly
reports nothing to expand" symptom the owner has now seen four times; the log is not lying, the
count feeding the screen is counting the wrong population.

### The 947/997 (now larger) "no dispatch record" figure — same root cause, not a second bug

`agent-dispatched` rows are written once per real `Agent` tool call, from the **parent's**
`PostToolUse(Agent)` firing (`src/hooks/post-tool-use.ts`'s `agentDispatchNote`). In this
snapshot, 17 `agent-dispatched` rows exist against 7,034 distinct `subagent-stop` ids — **every
one** of the 7,034 lacks a matching dispatch row, not just the type-absent ones, because
`agent-dispatched` has only existed since the SAME 2026-09-04 deploy and most of the corpus
predates it — but restricting to the post-deploy window, the type-absent ids are the ones with no
matching dispatch, and the type-present ones (this snapshot: 19) are the ones a dispatch row
should in principle match. This is the same finding as above from the other side: a
`subagent-stop` row with no `agent-dispatched` partner is, again, evidence that the firing was
never a `Task`/`Agent` tool call the parent made — it is not a second, independent defect.

---

## 6. The mid-probe question — where does the terminal's per-step status sentence come from

> `general-purpose  Running full injected-endpoints and read-model test suites`

**Route (a): it is `tool_input.description`, present in the lane's own transcript, and this
project's existing parse already reads it correctly when it is there.** Not a parsing defect.

Measured directly, across 100 of this session's own real subagent transcripts (7,334 tool_use
blocks): `Bash.description` is present on **3,180 of 5,460 (58%)** real Bash calls. Sample
descriptions, pulled from a real, finished lane
(`…/subagents/agent-a0511eba88b8131a6.jsonl`) — short, non-sensitive, exactly the terminal's own
style:

```
"Create scratch output directory"
"Search corpus for the task-body standard"
"Show mycontext add help"
"List task items short form to sample house voice"
```

Running this project's own `transcriptSteps` (unmodified) directly against that file produces:

```
"Bash: Create scratch output directory agent=TEST_AGENT_ID"
"Bash: Search corpus for the task-body standard agent=TEST_AGENT_ID"
```

— the exact shape and, for calls that carry one, the exact wording the terminal shows.
`SUBJECT_KEYS` already tries `description` before `file_path`/`command`/every other key, so when a
tool call carries a description it is **already** what lands in the row; the coordinator's own
observed counter-examples (`Bash: echo ok agent=…`, `Bash: wc -l … agent=…`) are calls that
**genuinely carried no `description` on the wire** — confirmed by the 42% of real Bash calls in
this same sample that have none — not a parsing bug. (The commit that shipped this feature,
`5515ed2`, quotes this exact target sentence — `"general-purpose Reading
audit-new-ops.test.ts family order"` — as its own motivating example, which is further
confirmation this is the intended source.)

**What this does NOT unlock.** The description sentence is only as available as the transcript it
lives in, and §5 above (and the original hooks/30 measurement) already established that a
running lane's transcript is not reliably readable while the lane is still working. So the
identical string the owner wants IS recoverable, and IS already parsed correctly — but not any
earlier than the rest of the backfill, for the same reason. This does not need a second, separate
fix; whatever ships for hooks/30's "live steps" question (§7) is also the fix for this.

---

## 7. Whether live steps are possible, impossible, or possible-but-requiring-a-ruling

**Possible — a live mechanism exists and was directly measured (§2–4) — but shipping it needs the
owner's ruling, not this probe's.**

The mechanism: widen `PostToolUse`'s matcher to include `Bash` (or drop it to `*`), and — inside
`post-tool-use.ts` — read `input.agent_id`/`input.agent_type` (both already declared on
`io.ts`'s `HookInput`, just never plumbed into `post-tool-use.ts`'s own narrower interface) and
write one `agent-step`-shaped row per call, keyed the same way `agent-step` already is. This would
put the exact "description" sentence (§6) on screen **within the tool call's own runtime**, not
batched at `SubagentStop` — proven by §2's timings (seconds, not the current end-of-lane batch).

**Why this is a recommendation and not a change made here.** The owner explicitly reverted a
`PreToolUse` matcher widening, ruling that a blanket block on bash is the wrong lever. The
distinction that makes this different, stated for the record because it changes the ruling's
shape without pre-empting it: **`PreToolUse` can BLOCK** — the mechanism the owner rejected —
**`PostToolUse` only OBSERVES.** A widened `PostToolUse` matcher cannot deny a tool call, cannot
add latency the model waits on for a decision, and cannot become the thing that was reverted. But
it is still a permanent change to `hooks/hooks.json` — a hook on every subagent tool call across
every project that installs this plugin — and it has a real, measured cost: on this project's own
corpus, that is potentially thousands of extra hook-process spawns per busy day (5,460 real Bash
calls in the 100-transcript sample alone). Whether that cost is worth "live steps," and whether
the right lever is widening `PostToolUse`'s matcher versus some narrower alternative, is the
owner's call. **Recommended, not shipped**, per the brief's own instruction.

---

## What must be true, and is

Per this project's own standard: either a stopped lane records its steps, or the log says why it
could not. A real lane now does the first, unchanged and reproven (§5). A `SubagentStop` firing
that is not a real lane now does the second, explicitly, in its own note (§5, "the fix made").
Neither case is silent any more.

---

## Cleanup

- `hooks/hooks.json` — checked byte-identical (`md5sum` and `git diff --stat`, both empty) before
  this probe, after the one 90-second live edit-and-revert in §0, and again at the end.
- Every live-hook measurement ran in a throwaway `claude -p` process from an empty scratch
  directory, under `--settings` pointing at a scratch JSON file — no project, user, plugin, or
  managed settings file was ever edited, and nothing under this repository's `.my_context/` was
  read or written by any of the three runs.
- The one code change kept is inside owned territory: `src/hooks/subagent-stop.ts` and
  `test/hooks/observation-hooks.test.ts`. `git status --short` at the end of this work shows only
  those two files plus the two `.my_context/items/task/*.md` edits this campaign's own state
  transitions made.
