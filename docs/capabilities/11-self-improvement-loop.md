<!-- Chapter 11 of 13 — my_context capabilities documentation -->

# 11. The self-improvement loop

## What it is, in one sentence

A background pass — triggered from the `Stop` and `PreCompact` hooks — reads a
session's own transcript, classifies what it finds against a fixed rubric, and
*could* draft proposals for a person to review. It ships wired end to end, and
it ships **off**: the loop's own default configuration guarantees it writes
nothing to this or any other workspace unless a person deliberately turns two
separate dials.

This is not "planned" or "coming soon." Every module described below exists,
is imported, is exercised by `test/review/*`, and runs today in this very
repository's own hook path — it runs, decides there is nothing to do (or that
it isn't even switched on), and returns. The engineering is finished; the
authorization is not.

**Source root:** `src/review/` — `trigger.ts`, `pass.ts`, `input.ts`,
`rubric.ts`, `propose.ts`, `dedupe.ts`, `claim.ts`, `decline.ts`,
`declined.ts`, `prompt.ts`. Configuration lives in `src/core/config.ts`
(`ReviewConfig`, `DEFAULT_REVIEW`). The design document the code repeatedly
cites by section number is
`docs/superpowers/specs/2026-09-08-self-improvement-loop-design.md`.

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
live corpus, prints:

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
window of recent sessions. On this corpus, right now:

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

Two configuration values gate *whether the pass runs at all* and are
themselves off by default. `DEFAULT_REVIEW` in `src/core/config.ts`:

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
};
```

`enabled: false` is the first, blunter off-switch — with it unset, the trigger
returns `null` before it ever reads a byte of transcript, and no child is ever
spawned. This repository's own `.my_context/config.json` carries **no
`review` key at all**, meaning `def-the-corpus`'s own project runs on the
shipped default: `review.enabled` is `false` here too. `node src/cli/index.ts
review list` confirms the observable consequence:

```
my_context: no drafts pending review.
```

Once `enabled: true` is set, a second, independent gate still stands —
`maxProposalsPerPass: 0` — covered under **The ration**, below.

### Why `Stop` and `PreCompact`, and not `SessionEnd`

`trigger.ts`'s own header comment gives a measured reason for choosing these
two hooks over `SessionEnd`, which sounds like the more natural fit: counted
in this project's own audit log over fifteen days and three sessions, there
was **not one `session-end` row**, against 1,094 `stop`, 17 `pre-compact`,
and 54 `session-start` rows. A trigger keyed to `SessionEnd` would have fired
zero times in this project's own life so far.

### The rubric — deciding a *stretch* is worth reading, without a model call

`src/review/rubric.ts::worthAPass` is a fixed heuristic, not a model call —
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

So: `src/review/prompt.ts` exists — it is a fully-built prompt template meant
for a future model-backed proposer — but nothing in the current code path
ever sends it anywhere. What actually runs is rule-based classification of
observations already gathered, with no generation step. And it is
deliberately narrower than the design imagines in one more way:

```ts
export type Artifact = 'check' | 'rule' | 'lesson';
export const AUTHORABLE: readonly Artifact[] = ['check'];
```

Of the three kinds of draft the design imagines this loop could eventually
author, the shipped proposer is restricted to `check` (landing as a `task`
item) alone. The code's own reasoning: a model-free proposer can *select* an
observation well, but it cannot *compose* — every draft it could write for
`rule` or `lesson` would just be a sentence lifted verbatim out of a
transcript, and the project judged that acceptable for a `task` ("work to be
built") but not acceptable to file, unread, into a corpus this very project
governs itself by.

## The ration — the exact mechanism, and why it is not a budget

The term **the ration** is a defined term in the shipped [product rule
store](./10-rule-store.md), entry `def-the-ration` (tier: `developer` — one
of the twelve entries that apply in this repository specifically):

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

- **`maxProposalsPerPass`** bounds one pass. **It ships at `0`.**
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
wired into the real hook path — and off by two independent defaults**:

- **`review.enabled` defaults to `false`.** No child process is ever spawned
  from any hook until a workspace explicitly sets this. This repository's own
  `.my_context/config.json` does not set it, so the loop is off here too.
- **`maxProposalsPerPass` defaults to `0`**, even once `enabled` is turned
  on. A workspace that flips only `enabled` still writes nothing — the ration
  is a second, independent dial, and the code comment says explicitly this is
  intentional and not "a second kill switch."
- **No model is ever called.** `src/review/prompt.ts` — a full prompt
  template for a hypothetical model-backed proposer — exists in the source
  tree, is exercised by its own tests, and is never invoked by the live code
  path. The shipped proposer is a deterministic classifier, not a generator.
- **Only `check` (task) drafts can be authored today**, of the three kinds
  (`check`, `rule`, `lesson`) the type system already models. `rule` and
  `lesson` authoring are typed but not enabled (`AUTHORABLE` names only
  `'check'`), because the deterministic proposer cannot compose prose well
  enough to be trusted with the normative tier.
- **No retirement rule exists.** `RETIREMENT_RULE` is `null`, with the exact
  measured reasons recorded in `WHY_NO_RULE` rather than left implicit.
- **`crossSessionSameCwd` and `model`** are keys the design document (§11)
  prints as part of a nine-key config block, but the config schema explicitly
  **refuses** them rather than silently accepting and ignoring them — the
  same boundary this file calls out for `maxProposalsPerPass` itself: a
  config key that looks live but does nothing is treated as worse than a
  parse error.

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
