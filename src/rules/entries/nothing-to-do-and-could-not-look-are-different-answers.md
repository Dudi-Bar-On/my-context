---
id: nothing-to-do-and-could-not-look-are-different-answers
kind: standard
tier: developer
title: a step that can decide there is no work must be able to say it could not look, and the two answers must never share a value
trigger: writing or reviewing a cache, an incremental pass, a watcher, a sync, or anything that reads a recorded value — a size, an mtime, an offset, a ranked result set — to decide whether there is work to do
shape: two outcomes that are indistinguishable from outside and must never collapse into one return value — "I looked and there was nothing" and "I could not look". Collapse them and every layer downstream correctly decides it has no work, forever, while each one reports success. The sharpest version is a step that ALREADY KNOWS it could not look and has nowhere to say it — a truncation flag nobody reads, a deferred count nobody prints
example: "on 2026-09-15 the per-turn anchor pass stopped marking anything for half an hour. Its probes asked the archive for the best 200 matches by relevance and THEN applied the current turn's byte scope, so with 777 matching spans the newest was ranked out — bm25 has no opinion about recency. The pass answered `anchors: null`, which means 'there was nothing to do'. Measured over the window: 15 turns qualified, 6 were inside the top-200, and exactly those 6 were marked — window membership predicted the mark 15 times out of 15. The report already carried a `capped` field saying the probe hit its ceiling, set since the day the pass was written, AND NOTHING HAD EVER READ IT"
check: "detective:`archiveFreshness` in src/core/conversation-search.ts — one statSync per source against the row that claims to describe it (7 ms over 452 sources on the real archive). It fills SearchBuildReport.stale, which markAnchorsOnTurn turns into did: 'could-not-look' instead of a second null, and src/hooks/stop.ts renders as its own audit clause naming how many bytes behind and whether a probe was capped. Held by test/core/anchor-per-turn.test.ts, which freezes a recorded size against a growing file and asserts the product says so, and pins behind: null for a file that will not stat against the 0 that would be a measurement nobody took. Removal proofs 2026-09-15: deleting the comparison reddens the first, returning 0 from the failed stat reddens the second, dropping either clause reddens test/hooks/stop-conversation-refresh.test.ts"
request: the rule / invariant you have created actually should be in the store - don't you think so ?
---

**A feature can die while every one of its layers is green, and this is how.**

Each layer is asked a question it can answer honestly, and no layer is asked the question that
matters:

- *"Did the probe return matches?"* — Yes, two hundred of them. **Correct.**
- *"Are any of them in this turn's byte range?"* — No. **Correct**, they were the wrong two hundred.
- *"Did the pass have work?"* — No. **Correct**, no candidate survived the scope.
- *"Is the feature working?"* — **Nobody asks this**, and it is the only question with a wrong answer.

So the rule is not "handle errors". No error occurred. The rule is that **a decision not to work
is a claim about the world, and a claim needs a basis.**

## The two answers

| the step means | what it must return |
|---|---|
| I looked at the thing, and there was no work | a measured zero |
| I could not look — unreadable, stale, refused, truncated, out of budget | **a different value, and the reason** |

A single `null`, `0`, `[]` or `false` covering both is the defect. It is not a style preference:
the caller has no way back. Once merged, no care downstream can separate them again, because the
information is gone at the point it was known.

## The worst version: the answer existed and nobody asked

In the measured case the report **already had a `capped` flag**, set correctly since the day the
code was written, saying the probe had hit its ceiling. Every ingredient of the disclosure was
present. No caller read it, so the product could say *"I could not look"* and never did.

**A field that records a refusal is not a disclosure until something reads it.** When you add
one, add its reader in the same change, or you have written a comment with a type.

## Why it hides so well

1. **It is self-perpetuating.** Deciding there is no work is exactly what leaves the input
   unchanged, so nothing escalates and nothing retries.
2. **Internal consistency reads as health.** Every invariant *inside* the system holds; the one
   that broke is between the system and the world.
3. **It looks intermittent, not broken.** Whether the newest item falls inside a relevance
   window is arbitrary, so the feature appears to work sometimes — which is far harder to
   report, and much easier to dismiss, than a clean failure.
4. **Only the newest work is missing**, which is the part a reader cannot notice is absent. The
   history is all there; the list still has hundreds of rows; nothing looks empty.

## What this asks for, concretely

**A bounded query is not a scoped query.** If the caller is going to filter the results, the
filter belongs *in* the request. Ranking then truncating and *then* narrowing means the bound
silently decides what the scope will find — and the same defect had a second face here: 577 of
777 spans were unreachable by **any** run, so the ceiling was also a permanent cap on how much
the product could ever hold.

**Name what the decision rested on.** A step that skips work because a recorded value said so
should report that value and its source. `deferred: 3` beats a silent `continue` and costs one
field — but only if something prints it.

**Compare the record to the world, once.** If that is too expensive to do every time, it is not
too expensive to do *when the answer is "nothing to do"* — precisely when being wrong is
invisible.

**Distinguish latency from failure at the surface.** Not every pipeline can be current, and
pretending otherwise produces a rule nobody keeps. What is forbidden is a reader who cannot tell
*not yet* from *never*.

## The test that would have caught it

Not a test of the happy path — that passed throughout. **Make the world bigger than the bound
and assert the newest item is still found.** Written as a removal proof, with the preconditions
asserted rather than assumed: that the archive really is over-full, and that the newest span
really is ranked out. A fixture that quietly stops carrying the defect must fail loudly instead
of passing over it.

`a-gate-that-cannot-be-shown-to-fail-is-not-a-gate` is the same argument aimed at checkers; this
one is aimed at the steps between them.
