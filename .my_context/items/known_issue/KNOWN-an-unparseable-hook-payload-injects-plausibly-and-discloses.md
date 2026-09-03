---
id: KNOWN-an-unparseable-hook-payload-injects-plausibly-and-discloses
type: known_issue
title: An unparseable hook payload injects plausibly and discloses nothing
status: active
severity: soft
always: false
summary: An unreadable start-up message used to pass as a normal one; it now says plainly that it could not be read.
summary_of: 655bd86a15eeec82
summary_was:
  - 2026-09-03 When the startup message cannot be read, the result still looks complete and normal while quietly losing the parts that decide what is delivered.
acknowledged:
  - citation_form@0a782d0fffce1487
scope: []
tags:
  - hooks
  - observability
  - silent-failure
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-19
valid_until: null
checksum: 2d5be178a3cb424a
---

# An unparseable hook payload injects plausibly and discloses nothing

An unparseable hook payload does not fail and does not warn. It produces a
**plausible, complete-looking injection** with `source` and `session_id`
silently dropped — which is indistinguishable from a correct plain session
start.

**The mechanism, two functions cooperating.** `parseHookInput` swallows every
stdin failure into an empty object — `src/hooks/io.ts` · `} catch { return {}; }` (gone 2026-09-03). `session-start.ts` · `const cwd = input.cwd ?? process.cwd();` · ~207 then papers over the loss with a
cwd fallback: `buildSessionStartOutput(input.cwd ?? process.cwd(), { source:
input.source, sessionId: input.session_id })`.

With `input = {}`, `cwd` falls back to `process.cwd()` — **which is usually the
right directory**, so the workspace resolves, the corpus loads, and the pinned
tier is injected correctly. Only `source` and `session_id` are gone. So the
output looks entirely normal.

**What is silently lost when it happens:**

- `source: 'compact'` never arrives, so `inject.ts` · `const compacting = options.source === 'compact';` · ~308's `compacting` is false,
  the restore branch at `:148` is skipped, and **a compaction restores nothing**.
- `session_id` never arrives, so `buildJitOutput` returns `''` at its
  `if (!sessionId) return ''` guard and **the JIT tier delivers nothing at all**.
- `PreCompact` writes **no snapshot**, so the next compaction has nothing to
  restore even if the payload is valid then.

**How it was found.** Four consecutive hook measurements were wrong in a way
that looked like a product defect: a compaction restore that returned output
byte-identical to a plain start, a JIT tier that never fired, and a `PreCompact`
that captured nothing. Every one was a malformed payload from a test harness —
`printf` consuming one level of backslash escaping in a Windows path, leaving
single backslashes and therefore invalid JSON. **The product was correct
throughout; only the silence was wrong.** Confirmed by re-running each step with
the payload written as a file: JIT delivered 44,871 bytes, `PreCompact` captured
19 ids, and the restore landed the item at `tier: "restored"`.

**Why this is worth fixing rather than filing as harness error.** The failure is
undetectable from the outside. `INV-nothing-is-dropped-silently` is the
project's own rule, and this drops the two fields that decide whether the
restore and JIT tiers run at all — while emitting output that reads as success.
A hook that produced *nothing* would be obvious; one that produces a plausible
subset is not. It also costs debugging time disproportionate to the fault: a
whole diagnostic pass concluded the selection logic was broken.

**Suggested resolution.** Keep failing open — that part is right and
`INV-hooks-fail-open` requires it — but **disclose**. When `parseHookInput`
cannot parse stdin, the injected block should carry a line saying so, the way
spill and focus errors already are disclosed inline. An audit record with a
`note` naming the parse failure would also make it visible after the fact.
Distinguishing "no payload" from "unparseable payload" costs one boolean.
