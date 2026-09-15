---
id: nothing-to-do-and-could-not-look-are-different-answers
kind: standard
tier: developer
title: a step that can decide there is no work must be able to say it could not look, and the two answers must never share a value
trigger: writing or reviewing a cache, an incremental pass, a watcher, a sync, or anything that reads a recorded size, mtime, offset or checksum to decide whether there is work to do
shape: two outcomes that are indistinguishable from outside and must never collapse into one return value — "I looked and there was nothing" and "I could not look". Collapse them and every layer downstream correctly decides it has no work, forever, while each one reports success. The detector is cheap and almost never written - the step that trusts a recorded value must, at least once, compare it against the thing it claims to describe
example: "on 2026-09-15 the per-turn anchor pass stopped marking anything for over half an hour. `sourcesOf` took a transcript's size from the database row instead of the file; the row was stale, so the tail to read computed as zero; the search build reported nothing read; the pass answered `anchors: null`, which means 'there was nothing to do'. Every layer behaved exactly as specified. The file was 155,718 bytes ahead and the gap GREW between two checks, and the index looked healthy because `bytes === scanned_bytes` reads as caught up"
check: "none yet, and that is the finding — every test on that path asserted the happy direction. `TASK-the-automatic-marking-stopped-and-said-nothing-because-a` requires a removal proof that freezes a recorded size against a growing file and asserts the product SAYS so"
request: the rule / invariant you have created actually should be in the store - don't you think so ?
---

**A feature can die while every one of its layers is green, and this is how.**

The failure has a shape worth recognising before it is described. Each layer is asked a
question it can answer honestly, and no layer is asked the question that matters:

- *"Is there a tail to read?"* — No. **Correct**, given a stale size.
- *"Did the build read anything?"* — No. **Correct**, there was no tail.
- *"Did the pass have work?"* — No. **Correct**, nothing was read.
- *"Is the feature working?"* — **Nobody asks this**, and it is the only question with a wrong
  answer.

So the rule is not "handle errors". The errors were handled. The rule is that **a decision not
to work is a claim about the world, and a claim needs a basis.**

## The two answers

| the step means | what it must return |
|---|---|
| I looked at the thing, and there was no work | a measured zero |
| I could not look — unreadable, stale, refused, out of budget | **a different value, and the reason** |

A single `null`, `0`, `[]` or `false` covering both is the defect. It is not a style
preference: the caller has no way back. Once the two are merged, no amount of care downstream
can separate them again, because the information is gone at the point it was known.

## Why it hides so well

Three properties make this class outlive ordinary bugs:

1. **It is self-perpetuating.** The stale input makes the step decide there is no work, and
   doing no work is exactly what leaves the input stale. Nothing escalates. Nothing retries.
2. **Internal consistency reads as health.** `bytes === scanned_bytes` is what a caught-up
   index looks like. Every invariant *inside* the system holds; the one that broke is between
   the system and the world.
3. **Only the newest work is missing**, which is the part a reader cannot notice is absent. The
   history is all there. The list still has hundreds of rows. Nothing looks empty.

## What this asks for, concretely

**Name what the decision rested on.** A step that skips work because a recorded value said so
should be able to report that value and its source. `deferred: 3` beats a silent `continue`,
and costs one field.

**Compare the record to the world, once.** The stale-size class is closed by a single
`statSync` against the file the row claims to describe. If that is too expensive to do every
time, it is not too expensive to do when the answer is "nothing to do" — which is precisely
when being wrong is invisible.

**Distinguish latency from failure at the surface.** Not every pipeline can be current, and
pretending otherwise produces a rule nobody keeps. What is forbidden is a reader who cannot
tell *not yet* from *never*. "The archive is 155,718 bytes behind" is a true sentence a product
can compute; a blank where a result belongs is not.

## The test that would have caught it

Not a test of the happy path — that passed throughout. **Freeze the recorded value against a
moving world and assert the product says so.** Written as a removal proof: break the freshness
check, and watch the disclosure disappear. A green suite over a dead feature is the thing this
standard exists to make impossible, and only an end-to-end assertion can see it.

`a-gate-that-cannot-be-shown-to-fail-is-not-a-gate` is the same argument aimed at checkers;
this one is aimed at the steps between them.
