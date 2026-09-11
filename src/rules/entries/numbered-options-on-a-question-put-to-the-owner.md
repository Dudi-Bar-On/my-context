---
id: numbered-options-on-a-question-put-to-the-owner
kind: standard
tier: developer
title: a question put to the owner carries numbered options and one marked recommendation
trigger: putting a decision to the owner
shape: options numbered `1 —`, `2 —`, each on its own line; the recommendation first and marked as the recommendation
example: the 2026-09-10 question that produced this ruling — the options were a bare prose list, he answered "1 is ok", and nothing could say which option he had counted as 1
check: "detective:scripts/check-ask-numbering.ts — every question put to the owner in the archive carries options numbered `1 —` and exactly one marked recommendation, and it is the first"
request: there should be numbers on the options so i can answer by number, and say which one you recommend
---

The first entry in this store, chosen deliberately (design §4). It exercises the whole
shape end to end — template, trigger, example, detective check — on something small,
where being wrong costs a badly formatted question rather than a corrupted corpus.

Its rationale is a measured one and not a preference: he answers by number, so an
unnumbered list makes his answer depend on an order he inferred rather than one he can
see. A mis-mapped number is a silent wrong ruling.

Its own history is the argument for the store existing at all. He asked for it, it was
written into a memory file as prose, and within the same conversation nothing could say
whether it was being obeyed.

**MEASURED 2026-09-11, over the whole archive, by the check named above** — 2,657
assistant turns in this workspace’s session transcripts, of which **108 questions** put
a decision to the owner and **0 held** the standard. 26 of the 108 (24.1%) enumerated
their options at all, in some other form; 3 (2.8%) marked exactly one recommendation;
none did both in the shape above. That is the store’s first piece of evidence about
itself: the standard was asked for, written down as prose, and obeyed zero times out of
108. Every figure is a FLOOR — the trigger is a turn’s closing paragraph, so an ask
buried mid-turn is not counted.
