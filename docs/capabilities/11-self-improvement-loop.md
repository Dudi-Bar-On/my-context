<!-- Chapter 11 of 13 — my_context capabilities documentation -->

# 11. The self-improvement loop

## What it is, in one sentence

A background pass — triggered from the `Stop` and `PreCompact` hooks — reads a
session's own transcript, classifies what it finds against a fixed rubric, and
*could* draft proposals for a person to review. It ships wired end to end, and
it ships **off**: the loop's own default configuration guarantees it writes
nothing to any workspace unless a person deliberately turns separate dials —
`enabled`, `maxProposalsPerPass`, and (since 2026-09-13) `model`, each shipped
at the value that does nothing.

This is not "planned" or "coming soon." Every module described below exists,
is imported, is exercised by `test/review/*`, and runs today in this very
repository's own hook path — it runs, decides there is nothing to do (or that
it isn't even switched on), and returns. The engineering is finished; the
authorization is granted one dial at a time, and **this repository has now
turned on all three** — confirmed directly against `.my_context/config.json`
on 2026-09-16: `enabled: true`, `maxProposalsPerPass: 5`, `model:
"claude-opus-5"`. (An earlier version of this chapter said only two of the
three were on and that `model` was unset; that stopped being true at some
point after 2026-09-13 and this chapter had not been re-read against the live
config since. Every place below that describes `model` as unset in *this*
workspace is corrected in place, flagged rather than silently fixed, because a
config value this load-bearing deserves the flag.) A fresh install still has
all three closed — the distinction between what the product ships and what
this repository sets is the one this whole section exists to keep separate.

**Source root:** `src/review/` held **thirteen** modules at commit `870e57c5` (2026-09-13) —
`trigger.ts`, `pass.ts`, `input.ts`, `rubric.ts`, `propose.ts`, `dedupe.ts`,
`claim.ts`, `decline.ts`, `declined.ts`, `prompt.ts`, **`pending.ts`**,
**`drift.ts`** and **`model.ts`**. **Naming that count "at HEAD" was already wrong by the time an
earlier version of this sentence was corrected once** — a commit hash is a fixed point and "HEAD"
is not one, and three more modules have landed since:
`backfill-recommendations.ts`, `promote.ts` and `recommend.ts`, for **sixteen** at the actual
current HEAD as this correction was written (re-run `ls src/review/*.ts` for the true count at any
later moment; do not trust "sixteen" either, past this sentence). `pending.ts`, `drift.ts` and
`model.ts` were absent from an even earlier draft of this list; `drift.ts` is a **third off-switch**
this chapter's "what's built but off" section has to account for, and
`model.ts` — landed 2026-09-13 — reverses this chapter's single most repeated
claim (see "Reaching a model").

Configuration lives in `src/core/config.ts` (`ReviewConfig`, `DEFAULT_REVIEW`).
The design document the code repeatedly cites by section number is
`docs/superpowers/specs/2026-09-08-self-improvement-loop-design.md`.

*(This chapter describes `src/review/` **as committed at HEAD**, which moved
three times during this revision — `0d683f2b`, `5388f018`, `870e57c5`, all on
2026-09-13. Where a claim here is newer than the rest of the chapter, it says
so and names the commit.)*

## Why it exists

The corpus (chapter [Items and the corpus](./01-items-and-corpus.md)) is
authored by people. This subsystem asks a narrower question: could the
*process itself* — the actual tool calls and turns of a real session — notice
patterns worth turning into a governing item, the way a human reviewer
skimming a transcript might? If so, could it draft that observation without
ever silently writing to the corpus, exactly the way [creation and the
gates](./03-creation-and-gates.md) never let an `add` or `edit` bypass review?

The design's own stated reason for building this at all, and for gating it as
hard as it is gated, is upstream prior art: an unrelated project's kill switch
(referenced in code as "upstream's issue #82708") turned off on paper while a
second code path kept creating items anyway, because the "off" state was one
of several toggles rather than one. `src/core/config.ts`'s `DEFAULT_REVIEW`
comment names this directly and states the rule it drew from it: **one
switch, for one subsystem** (`ReviewConfig.enabled`) — never a family of
knobs any one of which, left on, defeats the others.

## Instrumentation: what's actually measured

Two independent signals feed this chapter, and it is worth being precise that
they are *not* the same subsystem, even though a reader coming from "the
self-improvement loop" might expect them to be one thing:

### 1. Contribution — delivery counts read from the audit log

`node src/cli/index.ts contribution --short`, run against this repository's
live corpus on **2026-09-12**, printed (every count rises with every hook fire,
so this is a reading rather than a constant):

```
my_context contribution — how often each item was actually delivered into a session, read backwards
out of the audit log. The log holds 2841 injection record(s) of 44858 total, naming 183 distinct
id(s); the corpus holds 1108 item(s), of which 158 could be chosen by `select` today.

A record is one DELIVERY, not one session: 1384 jit, 1376 subagent-start, 54 session-start, 25
compact-restore, 2 manual. So a high count is mostly a count of subagent dispatches and hook fires,
and reading any figure below as a number of sessions would overstate it by more than an order of
magnitude.
```

This is `src/core/contribution.ts` reading `src/core/audit.ts`'s log
backwards: every time [injection](./02-injection.md) actually delivered an
item, that's one row. It is a measurement of *use*, never of *correctness* —
the tool is explicit that reading, `show`, or MCP `get_item` leave no trace
here, so a "cold" item may simply be one nobody has needed to re-fetch.

### 2. Decay — items that have gone quiet

`node src/cli/index.ts decay --full` reports items not auto-injected across a
window of recent sessions. On this corpus, **2026-09-12**:

```
my_context decay — items not injected in the last 20 session(s). The ledger holds 26 session(s).
...
cold (1) — not auto-injected in the window; check before acting:
  RULE-never-weaken-byte-identity
    type           rule
    injections     0
    last injected  never
    scope          test/core/rebuild.test.ts test/core/item.test.ts
    title          Never weaken a byte-identity or round-trip assertion to make it pass

unrestricted (124) — active and normative with no scope, so they apply to every file and compete for
the jit budget on every file operation.
```

Both `contribution` and `decay` are **read-only reporting commands** a person
runs by hand. Neither one, on its own, writes a proposal — they are the raw
material `src/core/retire.ts` (below) draws on when *arguing* whether a
retirement rule could exist.

## The trigger: when the pass even looks

`src/review/trigger.ts::reviewTrigger` is called from `Stop` and `PreCompact`
and decides, in one synchronous function that **never throws**
(`INV-hooks-fail-open`, honoured explicitly in a `catch` that returns `null`),
whether to spawn a detached child process that does the actual reading. The
gates run in this order, cheapest first:

1. **Not inside a lane.** If `agent_id` is set, this is a subagent, not a
   session — refuse immediately so ten lanes finishing at once don't become
   ten passes over one parent transcript.
2. **A workspace, and a config that parses.**
3. **`review.enabled`** — the one switch. `false` returns `null`: no verdict,
   no audit row, no state file, no child. This is the switch the upstream
   incident was about, and the code comment says so.
4. **The ration on *looking*, `maxFiresPerSession`.** Once a session has
   fired its cap of passes, the trigger refuses and says so
   (`"the session's ration of N pass(es) is spent"`).
5. **The interval, `everyNToolCalls`** — waived only on `PreCompact` with
   `onPreCompact: true`, because context is about to be lost.
6. **Something new to read** — one `stat` against the byte offset the last
   pass stopped at.

Three configuration values gate *whether the pass runs, proposes, or reaches a
model*, and all three ship at the value that does nothing. `DEFAULT_REVIEW` in
`src/core/config.ts`:

```ts
export const DEFAULT_REVIEW: ReviewConfig = {
  enabled: false,
  everyNToolCalls: 15,
  onPreCompact: true,
  maxFiresPerSession: 3,
  readWholeTranscript: true,
  includeSubagents: true,
  maxProposalsPerPass: 0,
  queueCeiling: 15,
  model: null,          // added 870e57c5 — see "Reaching a model"
};
```

`enabled: false` is the first, blunter off-switch — with it unset, the trigger
returns `null` before it ever reads a byte of transcript, and no child is ever
spawned. Those are the **shipped defaults**, and they are what a fresh install
gets.

**This repository no longer runs on them, and both gates are now open here.**
`.my_context/config.json` at HEAD carries:

```json
  "review": {
    "enabled": true,
    "maxProposalsPerPass": 5
  }
```

Two commits, sixteen minutes apart on 2026-09-13: `0d683f2b` (20:17, *"the
self-improvement loop is on — and the ration stays at 0, which is what the code
argues for"*) opened gate one, and `5388f018` (20:33, *"the ration goes to the
number the design printed, and the loop is proved end to end"*) raised gate two
to **5** — the figure §11 of the design document printed all along, which
`DEFAULT_REVIEW` deliberately ships as `0`.

`review list` still answers `my_context: no drafts pending review` on this
workspace (run 2026-09-13, after both commits) — an open ration is permission to
propose, not a proposal.

**The argument this chapter is built on is unchanged, and it is worth being
precise about what did and did not move.** Two independent dials, not one, is
still the design — that claim is about `DEFAULT_REVIEW`, and `DEFAULT_REVIEW`
still ships `enabled: false` **and** `maxProposalsPerPass: 0`, so a workspace
that turns the loop on and changes nothing else still reads, reports and writes
nothing. What changed is one workspace's answer to those dials: this one, the
project that dogfoods the tool, after a dry run. The source's own condition for
raising it was *"the owner's, after reading a week of `review-last-pass.json`"*
— so read this repository's config as the exercise of that judgement, not as a
new default.

A reader checking the loop's state **in their own project** should run
`node src/cli/index.ts review list` rather than infer it from here.

### Why `Stop` and `PreCompact`, and not `SessionEnd`

`trigger.ts`'s own header comment gives a measured reason for choosing these
two hooks over `SessionEnd`, which sounds like the more natural fit: counted
in this project's own audit log over fifteen days and three sessions, there
was **not one `session-end` row**, against 1,094 `stop`, 17 `pre-compact`,
and 54 `session-start` rows. A trigger keyed to `SessionEnd` would have fired
zero times in this project's own life so far.

### The rubric — deciding a *stretch* is worth reading, before any model is involved

`src/review/rubric.ts::worthAPass` is a fixed heuristic, not a model call —
and it stays one now that a model path exists, because it is the gate that
decides whether the expensive half runs at all.
the design's own arXiv citation (`arXiv:2606.23525`) is used to justify gating
by trajectory content rather than a raw tool-call counter, but the rubric here
is deterministic classification over what the trigger already read cheaply,
not an LLM judging the stretch. A replay script
(`scripts/review-trigger-replay.ts`) run over the owner's own 87 MB, 36,448
row session transcript at the shipped `everyNToolCalls: 15` measured:

```
considerations                    261
the rubric fires                  164   (62.8%)
the rubric declines                97   (37.2%)
passes that actually run            3   ← maxFiresPerSession
```

The rubric's own comment is explicit that **it is not the ration** —
`maxFiresPerSession` is: 164 rubric-positive stretches collapsed to 3 actual
passes in that session, against a hypothetical 766 passes if `Stop` fired the
pass on every single call.

## What one pass does: `src/review/pass.ts`

A fired pass runs in a **detached, unref'ed child process** — `spawn(...,
{detached: true, stdio: 'ignore'}).unref()` — specifically so a hook where
"somebody is staring at a prompt" (the file's own words) is never blocked on
it, and specifically with an `'error'` listener attached, because an
`EventEmitter` with none rethrows a failed spawn as an uncaught exception that
would take the whole hook down.

The pass:

1. **Gathers** (`src/review/input.ts::gather`) the new stretch of transcript
   since the last pass's recorded offset (or the whole transcript, if
   `readWholeTranscript` is true — the shipped default), plus subagent
   transcripts if `includeSubagents` is true.
2. **Classifies** observations into `POINT_CATEGORIES`
   (`src/core/session-summary.ts`) — the same taxonomy a person skimming a
   transcript for "was anything here worth keeping" would use.
3. **Writes one report**, always, to `<corpusRoot>/state/review-last-pass.json`
   — gitignored, a workspace-local artifact, never a corpus item on its own.
   The report is written **before** anything is proposed, so a failure in the
   proposing half never costs the coverage record.
4. **Only then**, if the ration allows it, calls into `propose.ts`.

## Proposals: what a proposal would actually look like today

This is the most consequential thing to get right in this chapter, because it
contradicts what a reader might assume "AI-generated proposals" means.
`src/review/propose.ts`'s own header states it without hedging:

> "Nothing in this product calls a model, and this module does not either.
> `prompt.ts` is the artifact a forked session would carry ... and it is
> built, tested and unused by the code path below. What runs today is a
> DETERMINISTIC proposer."

**That quote is still `propose.ts`'s header verbatim, and it is still true of
`propose.ts`** — the deterministic proposer is what that module is. It is **no
longer true of the product**, as of `870e57c5` (2026-09-13): the model path
lives in `src/review/pass.ts`, beside `propose`, not inside it. See "Reaching a
model" below, and read the header as a statement about one module rather than
about the tool.

`src/review/prompt.ts` — a fully-built, 250-line model prompt, pinned for
structure by its own test — was for days imported by nothing but that test.
What the deterministic proposer does is rule-based classification of
observations already gathered, with no generation step, and it is deliberately
narrower than the design imagines in one more way:

```ts
export type Artifact = 'check' | 'rule' | 'lesson';
export const AUTHORABLE: readonly Artifact[] = ['check'];
```

Of the three kinds of draft the design imagines this loop could eventually
author, **the deterministic proposer** is restricted to `check` (landing as a
`task` item) alone. The code's own reasoning: a model-free proposer can *select*
an observation well, but it cannot *compose* — every draft it could write for
`rule` or `lesson` would just be a sentence lifted verbatim out of a
transcript, and the project judged that acceptable for a `task` ("work to be
built") but not acceptable to file, unread, into a corpus this very project
governs itself by.

**The model path has its own, wider set**, and the two differ because the two
proposers differ:

```ts
export const MODEL_AUTHORABLE: readonly Artifact[] = ['check', 'rule', 'lesson'];
```

`AUTHORABLE`'s argument was one sentence long and it was about a *lexical*
proposer — "A lexical proposer can select an observation. It cannot write a
rule" — a premise that is false of something that composes. The source is
explicit that this is not a relaxation: a model proposal passes **every** gate
the deterministic one does — §12's screen, §5c's relevance gate checked against
the evidence the model itself cited, §8's decline ledger, §5b's near-duplicate
suppression against the same `pending` list — and §4's artifact order still
applies, because the prompt states it and `parseReply` refuses any tier outside
it. **And the ration is unchanged:** widening *what* may be authored does not
widen *how much*.

## Reaching a model

*(New at `870e57c5`, 2026-09-13. This section post-dates the rest of the
chapter.)*

**The mechanism is the harness's own CLI, headless.** `src/review/model.ts`
spawns `claude --print --model <name> --output-format text` through
`node:child_process`, with the prompt on **stdin** — never in argv, because the
prompt carries transcript excerpts and runs to tens of kilobytes, Windows caps
a command line near 32K, and a Windows command line is readable by every local
account for the lifetime of the spawn. `cliInvocation(model)` is exported
precisely so a test can read the argv without spawning.

**`CONST-zero-runtime-dependencies` is untouched, and the source argues it
rather than asserting it.** `node:child_process` is a builtin, so nothing
enters `dependencies`. The CLI is not a package this product depends on — *"it
is the ambient program that INVOKED the hook in the first place, so its
presence is the precondition for the pass existing rather than an assumption
the pass adds."* It carries the user's own credentials, so this product still
holds none. Three alternatives were refused, each by name: `node:https` by hand
(needs an API key this product must never hold), the MCP surface (inverted —
MCP makes this product a tool *provider*, not a caller), and a prompt written
to disk for someone to carry (*"the thing that looks like calling a model and
does not"*). A fourth, dispatching a subagent, is **unavailable by
construction**: the pass is a detached child of a hook with `stdio: 'ignore'`,
so there is no agent in that process to dispatch anything.

**`review.model` is a real config key now**, `string | null`, defaulting to
**`null`** — which `DEFAULT_REVIEW`'s own comment says means "no model is
reached by any path", for the same reason `maxProposalsPerPass` ships at 0: *"a
workspace that sets `enabled: true` and changes nothing else must not start
spending tokens on a subsystem nobody has read the output of yet."* §11 printed
`"model": "haiku"`; the name §11 printed is the name to set it to, and setting
it is the owner's. **It is no longer a refused key** — `model` left
`REVIEW_LATER_KEYS`, which now holds only `crossSessionSameCwd`, and the source
records why: *"It was refused for as long as the refusal was true."*

**The call site is in `pass.ts:445–502`, not in `propose.ts`**
(`const modelCandidates` opens the block at `:445`, `if (options.model !== null)` at `:446`,
`reviewPrompt(input)` at `:447`, `callAgentCli` at `:449`), and the
placement is argued in the comment immediately above it, at `:440–444`: it runs *before* the
proposing block and its result is folded in, so that **a model call that fails still leaves a report saying it
was attempted and why**, and so `propose` stays testable without a transport.
`options.model === null` short-circuits the whole block. The call is bounded by
`MODEL_TIMEOUT_MS = 180_000` and `MAX_REPLY_BYTES = 1_000_000`, and
`isUsableModelName` is checked twice — once for the report, once at the
boundary the bytes actually cross — with the grammar imported from
`core/config.ts` rather than restated, "so the name a config accepts and the
name a spawn accepts cannot drift apart".

**Provenance travels on `by`, and `origin` was deliberately not split.**
`origin === 'review'` is the trust boundary, compared as a literal in seven
modules; widening it to distinguish a model-written draft would have widened a
trust boundary to carry an unrelated fact. Instead `Proposer` is
`'deterministic' | 'model'` and the requirement — *an item says which produced
it* — is met three times over on an axis that cannot be mistaken for trust: the
`proposer:` tag on the item (`proposerTag`), the first line of the review brief
a person actually reads, and a `by` column on every row of
`review-last-pass.json`.

**Measured:** two live runs on 2026-09-13, 79.2 s, returning 2 candidates the
rule-based half could not have composed. **Corrected 2026-09-16: this is no
longer true.** `.my_context/config.json` sets `review.model:
"claude-opus-5"` in this workspace — confirmed by reading the file directly —
so the model path is live here, not dormant. The 2026-09-13 measurement above
is still a real, reproducible run of the mechanism; what changed is only
whether *this specific repository* currently has the switch on. Do not trust
the sentence "nothing activates in this workspace" anywhere else in this
chapter without checking the live config first — see the correction at the
top of this chapter.

## The ration — the exact mechanism, and why it is not a budget

The term **the ration** is a defined term in the shipped [product rule
store](./10-rule-store.md), entry `def-the-ration` (tier: `developer` — one
of the entries that apply in this repository specifically):

```
means: "the cap on how much the self-improvement pass may put in front of a
person: `review.maxProposalsPerPass` bounds ONE pass, and `review.queueCeiling`
bounds the QUEUE — past the ceiling a pass writes nothing at all and says so,
while capture continues and proposals wait."

confusedWith: "an injection budget. A budget bounds what is DELIVERED into a
context window and spills the rest; the ration bounds what is WRITTEN for a
human to review, and HOLDS the rest. And it is not a throttle for cost: it
exists because oversight has a capacity, and past it reviewer reliability
decays so that MORE escalation makes the system LESS safe."
```

So the ration is deliberately *not* the same concept as the injection budget
in [Injection](./02-injection.md) — a budget spills excess to an index line
in a context window; the ration holds excess in a queue for a human, on the
theory (cited to `arXiv:2606.08919`) that escalating everything to a reviewer
past their real capacity makes oversight *less* reliable, not more.

Two numbers implement it, both live in `ReviewConfig`:

- **`maxProposalsPerPass`** bounds one pass. **It ships at `0`** — though this
  repository now sets it to `5`; see the config block above.
- **`queueCeiling`** bounds the whole pending queue. It ships at `15` — which
  the code states is *derived*, not chosen: the design's own printed example
  values are `maxProposalsPerPass: 5` × `maxFiresPerSession: 3` = 15, i.e.
  exactly one session's worth of proposals at full ration. The reasoning
  given: if a full session's worth of proposals is still sitting unreviewed,
  the correct response is to stop adding to the queue, not to raise the
  ceiling.

Confirmed directly in `src/core/config.ts` (line 737):

```ts
  maxProposalsPerPass: 0,
```

with the surrounding comment explaining precisely why the shipped default
deviates from the design document's own printed example of `5`: a first dry
run over a real transcript showed the deterministic proposer selecting well
but composing poorly, and the project judged that filing such drafts
unattended into its own governing corpus was not defensible. The comment
closes by quoting the project's own plan: *"Do not proceed on green tests
alone. Read the drafts."* — raising the ration is stated as the owner's
decision to make, after reading a week of real `review-last-pass.json`
reports.

**So: today, in this repository and in every workspace that has not
explicitly overridden it, the self-improvement loop reads its own signals,
classifies them, and writes a coverage report — and proposes nothing. It is
built and wired end to end; the tap is shut until a person raises the
number.**

## Nothing is silently dropped by the ration

Both the `def-the-ration` entry and the config's own comments are emphatic on
one point: past either cap, **capture still happens**. A pass at
`maxProposalsPerPass: 0` still reads, still classifies, still writes
`review-last-pass.json` — the report's `proposed.rationed` field is how many
observations *would* have been proposed, and `held` (once the queue ceiling
is what stopped it) says which cap was the reason. Nothing observed is
thrown away; it is simply not turned into a draft a human has to look at.

## Retirement: why there is no retirement rule yet

`src/core/retire.ts` defines the shape a retirement rule *would* take
(`RetirementRule`, `RetirementCandidate`) but ships it as `null`:

```ts
export const RETIREMENT_RULE: RetirementRule | null = null;
```

Not a config default of zero — an actual `null`, so nothing downstream can
reach `candidates` without a caller first constructing a rule and naming the
measurement behind it. The reasons are recorded as measured facts
(`WHY_NO_RULE`, dated 2026-09-11 against this repository's own corpus and
audit log), and they tie directly back to the ration being zero:

```ts
export const WHY_NO_RULE: string[] = [
  'the population a rule could ever touch is empty: 0 items of origin `review` exist, because '
  + '`review.maxProposalsPerPass` ships at 0 and the loop has never proposed anything',
  'both signals the design names fire on nothing: 0 injectable items have never been delivered, '
  + 'and 0 were ever spilled without also being delivered',
  'the low tail of every exposure-corrected delivery statistic is the PINNED tier — all 39 '
  + '`always: true` items rank in the least-delivered 69 of 157, and not one reaches the '
  + 'most-delivered 89',
];
```

In plain terms: a rule for automatically retiring low-contribution items
cannot yet be written responsibly, because the very population it would
watch (items *originating from* this loop) is empty, and because the naive
signal ("pinned items should be delivered often") is measurably backwards on
this corpus — pinned items rank among the *least*-delivered because they are
injected once per session start rather than repeatedly per tool call, which
would make a naive rule punish exactly the items the project chose to pin.

## Worked example: reading the current state end to end

```
$ node src/cli/index.ts review list
my_context: no drafts pending review.

$ node src/cli/index.ts decay --full
my_context decay — items not injected in the last 20 session(s). The ledger holds 26 session(s).
...
cold (1) — not auto-injected in the window; check before acting:
  RULE-never-weaken-byte-identity  ...

$ node src/cli/index.ts contribution --short
my_context contribution — how often each item was actually delivered into a session, read backwards
out of the audit log. ... 158 could be chosen by `select` today.
```

**Use case.** A team turns `review.enabled: true` on in a new project,
leaves `maxProposalsPerPass` at its shipped `0`, and works normally for a
week. Nothing appears in `review list` — by design. What they get instead is
a week of `review-last-pass.json` coverage reports they can read by hand,
answering "if this had been switched fully on, what would it have proposed,
and how good were those proposals really?" before they ever raise the ration
above zero. That reading step is the intended on-ramp, not a bug in the
default.

## What's NOT built / built but off

This entire chapter describes a mechanism that is **built, tested, and
wired into the real hook path — and shipped off by two independent defaults**
(three, counting `drift` below):

- **`review.enabled` defaults to `false`.** No child process is ever spawned
  from any hook until a workspace explicitly sets this. **This repository sets
  it to `true`** as of `0d683f2b`; the default is what a fresh install gets.
- **`maxProposalsPerPass` defaults to `0`**, even once `enabled` is turned
  on. A workspace that flips only `enabled` still writes nothing — the ration
  is a second, independent dial, and the code comment says explicitly this is
  intentional and not "a second kill switch." **This repository now sets it to
  `5`** as of `5388f018`, which is the design's own printed figure.
- **`drift.enabled` defaults to `false`, and it is a third off-switch this
  chapter previously did not name.** `DEFAULT_DRIFT: DriftConfig = { enabled:
  false }` (`src/review/drift.ts:122`). Two things about it are worth knowing
  before looking for it in the wrong place:
  - **The key is top-level `drift`, not `review.drift`**, and that is forced
    rather than chosen: `requireReview` refuses any key it does not know inside
    the `review` block, so `{"review": {"drift": …}}` would not switch it on —
    it would **stop the whole config loading**. A top-level key is the one shape
    an unknown key survives in, because unknown top-level keys are skipped and
    disclosed (see `skippedKeys`, [chapter 2](./02-injection.md)).
  - Every unreadable state resolves to off, deliberately, and `DEFAULT_DRIFT` is
    a value rather than an inline `false` so that "what does this do if I do
    nothing" has an answer you can read rather than infer.
  Drift measures a session against an **anchor** ([chapter 5](./05-anchors.md))
  — two texts the owner produced — never against a guess at intent, and each
  refusal (no anchor, an anchor with no name in it, a stretch the rubric
  declined) is stated rather than returned as a bare `false`.
- **A model CAN now be called, and `review.model` defaults to `null` so that
  nothing reaches one — as a product default.** This bullet used to read "No
  model is ever called"; `870e57c5` (2026-09-13) made that false.
  `src/review/model.ts` spawns the harness's own CLI headless and
  `src/review/prompt.ts` — unimported by the product for days — is now what
  it sends. See "Reaching a model" above. The **switch** itself,
  `DEFAULT_REVIEW.model`, is `null` in the shipped default — but **this
  workspace does set it**: `.my_context/config.json` carries `review.model:
  "claude-opus-5"`, confirmed 2026-09-16. So the accurate sentence for *this
  repository* is "a model is reached, on this repository's own configuration,"
  not "no model is reached by any path." A fresh install still gets the
  off-by-default `null`.
- **`src/review/drift.ts` is still imported by nothing but its own test** — its only
  importer anywhere is `test/review/drift.test.ts`. (An earlier version of this
  bullet also named `test/core/retrieval-return.test.ts` as an importer; that file only
  *mentions* `drift.test.ts` inside two comments, it does not import the module —
  re-verified directly against both files.) At 18.5 KB it is the larger of the two
  modules this chapter used to describe as unwired, and it is now the only one.
- **`src/review/pending.ts`, by contrast, IS wired**, and this chapter
  discusses `queueCeiling` at length without naming the module that computes
  the queue: `src/cli/commands/status.ts`, `statusline.ts`,
  `statusline-powerline.ts`, `src/core/questions.ts`, `src/ui/read-model.ts` and
  `src/ui/public/app.js` all read it.
- **The deterministic proposer authors `check` (task) drafts only**
  (`AUTHORABLE = ['check']`), because it cannot compose prose well enough to be
  trusted with the normative tier. **The model path authors all three**
  (`MODEL_AUTHORABLE = ['check', 'rule', 'lesson']`) — two sets, because two
  proposers, and every gate applies to both.
- **No retirement rule exists.** `RETIREMENT_RULE` is `null`, with the exact
  measured reasons recorded in `WHY_NO_RULE` rather than left implicit.
- **`crossSessionSameCwd` is the one key the design document (§11) prints that
  the config schema still refuses** — `REVIEW_LATER_KEYS = ['crossSessionSameCwd']`.
  It is refused rather than silently accepted and ignored, on the same boundary
  this file calls out for `maxProposalsPerPass`: a config key that looks live
  but does nothing is worse than a parse error. The stated reason is specific —
  the sightings ledger lives *inside* one corpus root, so "same cwd" is not a
  setting, it is the only thing the file can express, and accepting the key
  "would promise a comparison nothing performs."
  **`model` used to be on that list and is not any more** (`870e57c5`). The
  source records the transition rather than erasing it: *"It was refused for as
  long as the refusal was true — 'nothing in this product calls a model' — and
  `src/review/model.ts` ended that."* Any sentence saying `review.model` is
  refused is now wrong; it is accepted, validated against a name grammar, and
  defaults to `null`.
- **`src/lesson/` (`derive.ts`, `staging.ts`) is not described in this
  reference at all**, despite `mycontext lesson` / `lesson-stage` /
  `lesson-accept` being the human-authored half of the same pipeline this
  chapter is about.
- **A third off-by-default gate exists outside this subsystem and the index's
  roll-up misses it:** `dispatchGate` / `dispatchGate.enabled`
  (`src/core/config.ts:600`, `DEFAULT_DISPATCH_GATE = { enabled: false }`) —
  whether an `Agent` dispatch must name a task item. Like `review` it is
  shipped off, refused rather than skipped on an unknown sub-key, and — like
  `review` — **this repository turns it on** (`"dispatchGate": {"enabled":
  true}` in `.my_context/config.json`). It belongs in the same roll-up as the
  two dials above.

## See also

- [00 — Index](./00-index.md)
- [03 — Creation and the gates](./03-creation-and-gates.md) — the same
  human-approval posture applied to every other way an item enters the
  corpus, not just this loop's drafts.
- [09 — The CLI and the MCP server](./09-cli-and-mcp.md) — `review`,
  `decay`, and `contribution` as CLI commands.
- [10 — The product rule store](./10-rule-store.md) — `def-the-ration`,
  the developer-tier entry that names and defines the term this chapter
  builds on.
