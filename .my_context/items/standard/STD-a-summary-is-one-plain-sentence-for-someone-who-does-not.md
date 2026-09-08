---
id: STD-a-summary-is-one-plain-sentence-for-someone-who-does-not
type: standard
title: a summary is one plain sentence for someone who does not know this codebase
status: active
severity: soft
always: false
summary: A summary is one plain sentence for a reader who does not know the codebase, and it is kept short so it can be read at a glance rather than to save space.
summary_of: 5e6ad346afd94b00
summary_was:
  - 2026-09-08 One plain sentence, written for a stranger, answering only whether this is the thing they need right now.
scope: []
tags:
  - v2
  - corpus
  - summary
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/std.md"
source_anchor: null
source_checksum: null
valid_from: 2026-08-31
valid_until: null
checksum: 868358006b06b9ed
---

# a summary is one plain sentence for someone who does not know this codebase

> > Owner ruling 2026-08-31, after reading five worked examples: *"it looks fantastic, simple and explanatory… we should learn this."*
>
> **A summary is written for someone who does not know this codebase.** That is the whole rule; everything below follows from it.
>
> **What it does**
>
> It answers one question — **is this the thing I need right now?** — and nothing else. It is not a shorter body, not a restated title, and not a substitute for reading the item. It orients; the body persuades.
>
> **How to write one**
>
> * **Plain words, never project vocabulary.** No `{m:}` markers, no ids, no file paths, no line numbers, no measurements, no internal nouns. If a phrase would need this corpus to be understood, it does not belong.
> * **Say what the thing IS and why it matters** — never how it was found, what proves it, or how many. The body holds the evidence, and the body is *why* the summary can afford to be plain.
> * **One sentence where one will do**, two at most.
> * **250 characters, and it is a readability bound rather than a storage one** — about forty words. It was 160 until 2026-09-08.
>
> **Worked examples, all real**
>
>     title    Verify commit AUTHORSHIP on an agent's branch before merging it, not
>              only its diff and its gates. Five dispatc…          (566 characters)
>     summary  Check who wrote a commit before you merge it. The changes can look
>              right while the author is wrong.
>
>     title    a stale statusline sample reads as a live measurement so the
>              handover ask never fires
>     summary  An old reading is treated as current, so nothing notices the context
>              is nearly full and the handover is never written.
>
>     title    Campaign handover — read this before acting on any finding
>     body     17,775 characters
>     summary  What the last session learned, so this one does not start over.
>
> **Two things a summary must NOT do, both decided on evidence**
>
> * **It must not scale with the body.** A long body is usually long because the subject is dense — so scaling would give **the hardest items the longest summaries**, which is backwards. The reader's glance does not scale. What scales is what is available *on demand*, never what is always visible.
> * **It must not embed properties** — not `state`, not `priority`, not `status`. Those change independently and would make the summary genuinely wrong within hours; the staleness basis deliberately excludes tags for exactly that reason, since the projection once rewrote 285 items in a single pass. Properties are structured data, shown *beside* the summary as chips that can be coloured, filtered and sorted. **The summary says what the thing is; the properties say where it stands.**
>
> **When it cannot be done**
>
> If an item cannot be said plainly in 250 characters, **that is a finding about the item, not about the bound** — it is carrying more than one claim and wants splitting. Report it rather than stretching.
>
> **Why this matters more than it looks**
>
> A screen once carried 63,560 characters of true, careful prose and communicated nothing, because 91% of it was one paragraph printed sixty-one times. **Density defeats a reader as thoroughly as length does.** A summary that reads like the title is the field failing to earn its place — the reader already had the title.

RAISED TO 250 ON 2026-09-08, by owner ruling, and the reasoning is worth keeping because the first
argument against it was WRONG.

HIS CASE: 160 is not enough to describe a long body. Measured across all 1,011 summaries, he is right
and the ceiling really does bind - average 128, median 131, MAXIMUM EXACTLY 160, and 105 items (10.4%)
sitting at 150 or above. A maximum that equals the limit exactly is the signature of sentences trimmed
to fit rather than written to length.

THE ARGUMENT AGAINST IT WAS THAT A LONGER SUMMARY COSTS TOKENS IN EVERY SESSION. THAT IS FALSE, and
this project had already pinned it as a decision: IndexLine carries id, type, title and carried - not
the summary - and test/core/summary.test.ts asserts itemCost(withOne) === itemCost(bare) under the
heading "a summary costs nothing at injection". The same test records WHY: a summary on every index
line would take the index tier to about 9,900 tokens against a 1,200 budget. So the bound is a
READABILITY bound and nothing else, exactly as the line above always said.

WHAT THE RAISE COSTS INSTEAD, said plainly: at 160 (~25 words) the number nearly enforced "one
sentence" by itself. At 250 (~40 words) it no longer does, so the WORDS are now the only thing holding
that line. Anyone tempted to write two sentences because there is room should read the paragraph above
again - the split is still the answer.
