---
id: TASK-call-a-model-with-the-prompt-this-build-already-ships-and
type: task
title: call a model, with the prompt this build already ships and nothing calls
status: active
severity: soft
always: false
summary: Let the review pass hand its existing prompt to a model and turn the answer into draft suggestions, keeping the rule-free proposer it already has and marking which of the two wrote each draft.
summary_of: 8dbba60d902edc1e
scope:
  - src/**
  - test/**
tags:
  - v2
  - review-loop
  - "plan:loop"
  - "seq:6"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 1357c0ae4fae6fc0
needs: loop/5
priority: "1"
state: done
plan: loop
seq: "6"
verified_on: 2026-09-13
---

# call a model, with the prompt this build already ships and nothing calls

D36. The owner was given three options for the self-improvement loop, chose "turn on what exists" AND
"wire the model", and asked for the second immediately rather than deferred. This is the second.

THE MEASUREMENT, TAKEN 2026-09-13 BEFORE ANY CODE MOVED.

  1. `review.enabled` is `true` in `.my_context/config.json`. The subsystem is on.
  2. `maxProposalsPerPass` is absent from that file, so it resolves to `DEFAULT_REVIEW`'s `0`
     (`src/core/config.ts`). The pass reads, reports, and writes nothing. That 0 is argued in
     `core/config.ts` and is the owner's to overturn after a week of evidence. It stays 0 here.
  3. `src/review/propose.ts` opens with "Nothing in this product calls a model, and this module
     does not either." Its proposer is deterministic and lexical.
  4. `src/review/prompt.ts` is 250 lines of full model prompt - five anti-learning rules, the
     artifact order, the shape contract, the relevance gate, the boundary - pinned for STRUCTURE
     by `test/review/prompt.test.ts`. `grep -rn "from '.*review/prompt.ts'"` over src, test, e2e,
     scripts and hooks returns ONE line, and it is the test. Nothing in the product imports it.

So the most important file in the change, by the design's own words, is carried by nothing.

WHAT THE DESIGN SAID IT WOULD BE CALLED BY, AND WHAT IT DID NOT SAY.

`docs/superpowers/specs/2026-09-08-self-improvement-loop-design.md` §5 names the caller "the fork"
and specifies exactly one thing about it: `spawn(..., { detached: true, stdio: 'ignore' }).unref()`,
the pattern in `src/ui/open.ts`, never awaited. §5a then argues the fork is a CACHE-PARITY fork -
same session id, inherited system prompt, byte-identical `tools[]` - and that denial is at DISPATCH
rather than by a narrowed schema. That is a description of forking an AGENT SESSION, which is the
Hermes pattern §0 records this design as descending from.

`prompt.ts`'s own header says the same thing in the subjunctive: "the artifact a forked session
would carry".

But NO SECTION OF THE DESIGN AND NO STEP OF ANY PLAN EVER NAMES THE MECHANISM. Not a binary, not an
argv, not a channel. `plans/2026-09-08-self-improvement-trigger-and-pass.md` Task 5 says "spawn
detached" and the child it spawns is `node src/review/pass.ts` - a bare Node process with
`stdio: 'ignore'`, no model anywhere near it. Task 4 of `-proposals.md` builds `prompt.ts` and its
tests and stops; no later task consumes it. §11's config block prints `"model": "haiku"`, and
`core/config.ts` REFUSES that key by name, with the reason written out: a user told their loop runs
on Haiku would be told something untrue.

THE CALLER WAS IMPLIED AND NEVER SPECIFIED. That is the gap, and it is why the prompt shipped
unreachable rather than being wired badly.

THE MECHANISM, AND THE ARGUMENT AGAINST CONST-zero-runtime-dependencies.

`CONST-zero-runtime-dependencies` is `hard`, and `package.json` has no `dependencies` key at all.
No SDK, no HTTP client, nothing. Four candidates were considered and three are refused:

  - `node:https` by hand. Refused. It needs an API key this product has never had and must never
    hold; §12's second anti-learning rule exists because a credential shape in a file is a defect.
    And §0 records that the upstream failure this design descends from surfaced on SUBSCRIPTION
    OAuth credentials as a billing-shaped HTTP 400 - the exact class of failure a hand-rolled
    client re-invites.
  - The MCP surface. Refused as inverted. MCP makes this product a tool PROVIDER to an agent; it
    is not a way for this product to call a model.
  - A prompt written to disk for a person or an agent to carry. Refused as the thing the owner
    named unacceptable: it looks like calling a model and does not.
  - A subagent dispatched by the agent that runs the pass. UNAVAILABLE BY CONSTRUCTION, and this is
    worth recording because it is the obvious answer. The pass is not run by an agent. §5 requires
    it to be a DETACHED child of a hook with `stdio: 'ignore'`, because `Stop` is where a person is
    staring at a prompt. There is no agent in that process to dispatch anything.

What is left is the one §5 already chose without saying so: SPAWN THE HARNESS'S OWN CLI, headless,
and read its stdout. `node:child_process` is a builtin, so nothing enters `dependencies`; the CLI
is not a package this product depends on but the ambient program that INVOKED the hook in the first
place - its presence is the precondition for the pass existing, not an assumption the pass adds.
It carries the user's own credentials, so this product still holds none. `claude` resolves on this
machine at /c/Users/UserC/.local/bin/claude. And it is what §11's `"model": "haiku"` was always
describing: a model NAME is a CLI flag, not an SDK object.

The honest cost, recorded rather than hidden: the binary can be absent, and a model path that
degrades silently is worse than none. The absence must reach `review-last-pass.json` by name.

WHAT THIS TASK MUST PRODUCE.

  - The model path is an ADDITION, never a substitution. `propose.ts`'s deterministic proposer
    stays: its header's argument - "asking a model to prefer checks is a request that fails
    silently" - is not weakened by a model existing, it is the reason the model's output must pass
    the same screens.
  - Provenance distinguishes them. `origin: 'review'` is the trust boundary for both; a second
    axis must say WHICH produced a draft, on the draft and in the report.
  - The five anti-learning rules must be shown to REACH the model. A prompt that arrives with its
    rules dropped is worse than no prompt, and that is provable per-assertion by removal.
  - It must be provable with `maxProposalsPerPass` at 0. Today ration 0 skips the proposing block
    entirely (`pass.ts`), so the report cannot say what WOULD have been proposed. A proof that
    needs the ration raised is not a proof of this.

BUILT AND PROVED 2026-09-13, UNCOMMITTED.

THE MECHANISM. `src/review/model.ts` spawns the harness's own CLI - `claude --print --model <name>
--output-format text` - with the prompt on STDIN, never in argv (Windows caps a command line near
32K, and `src/ui/open.ts` records that a command line is readable by every local account for the
lifetime of the spawn). No shell. `node:child_process` is a builtin and `dependencies` is still
absent from package.json; `node scripts/check-dependency-budget.ts` exits 0.

THE GUARANTEE THAT IS ENFORCED RATHER THAN REQUESTED. `rulesMissing` runs over the exact text about
to leave the process, keyed on the CONTENT of each of the five anti-learning rules rather than on
the constant that holds them. A prompt that has lost one is REFUSED before the spawn, naming the
rule. Removing rule 5 from `prompt.ts` turns six assertions red, including the ration-0 proof.

TWO LIVE RUNS AGAINST THE REAL CLI, both with the ration at 0 and both writing nothing.
  - Run 1: 8,071-byte prompt, 83.6 s, 5 of 5 rules delivered, 1 candidate returned - and SUPPRESSED
    as a near-duplicate of what the deterministic proposer had already found. The two proposers
    share one suppression list, which is what makes that possible.
  - Run 2, on observations the lexical proposer screens as narrative: 7,810-byte prompt, 79.2 s,
    2 candidates returned, both ranked, both in `proposed.withheld` with `by: "model"` - one a
    `check` landing as a task, one a `rule`. `rationed: 2`, `drafts: []`, `created: []`, and the
    corpus listing was byte-identical before and after. THE RATION IS WHAT STOPPED IT, and the
    report says what it would have written.

PROVENANCE, AND ONE REFUSAL. The request was that `origin` say which proposer produced an item. It
is refused and the refusal is the safer reading: `origin: 'review'` is not a label, it is THE trust
boundary, compared as a literal in `trust.ts` (the only thing that forces `draft`), `mutate.ts`
four times, `retire.ts`, `decline.ts`, `vocabulary.ts` and `propose.ts`. A second origin would have
to be added to all of them and the one that was missed would fail SILENTLY - a model draft coming
out `active` and governing. So provenance travels on `Proposer`: a `proposer:` tag on the item, the
first line of the review brief, and `by` on every row of `review-last-pass.json`.

WHAT THE MODEL MAY AUTHOR, AND WHY IT DIFFERS. `AUTHORABLE` is `check` alone because a LEXICAL
proposer quotes rather than composes - its own comment says widening it "waits for the writer §5
describes". `model.ts` is that writer, so `MODEL_AUTHORABLE` is all three tiers. The ration is
unchanged: widening WHAT may be authored is not widening HOW MUCH.

FILES. New: `src/review/model.ts`, `test/review/model.test.ts`. Modified: `src/review/prompt.ts`
(an output contract, which no section of the design and no plan step ever specified),
`src/review/propose.ts`, `src/review/pass.ts`, `src/review/trigger.ts`, `src/core/config.ts`
(`review.model` accepted, having been refused by name while the refusal was true),
`test/review/pass.test.ts`.

NOT DONE, ON PURPOSE. `docs/capabilities/11-self-improvement-loop.md` says "No model is ever
called" in four places. That is true of the committed tree and false the moment this lands, so it
must be corrected in the same commit - lines 213, 219, 379-382 and 390-396. It was left alone
because another lane was verifying that exact document while this ran.
