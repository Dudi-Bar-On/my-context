---
id: DEC-a-stale-summary-that-is-still-correct-is-cleared-by-passing
type: decision
title: a stale summary that is still correct is cleared by passing the same sentence back, never by inventing a new one
status: active
severity: soft
always: false
summary: A description that is still true but flagged as outdated is confirmed by repeating it word for word, never by inventing a new sentence to clear the flag.
summary_of: 2d56f16a0040a341
scope: []
tags:
  - v2
  - corpus
  - summary
  - audit
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-01
valid_until: null
checksum: d31163347948bce6
---

# a stale summary that is still correct is cleared by passing the same sentence back, never by inventing a new one

RULED 2026-09-01, on a summary that was still correct and had no honest way to say so: a summary that has gone STALE but STILL DESCRIBES ITS ITEM is cleared by passing THE SAME SENTENCE back, and never by inventing a different one to make the warning go away. That act is a RE-AFFIRMATION - "I have read this item and this sentence still describes it" - and it is recorded in the audit log under its own name.

THE DEFECT. `RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done` was this corpus's one remaining `summary_stale` warning. Its sentence had been read against its body twice in one day and confirmed correct: the 2026-08-26 amendment REMOVED a claim the summary never made. Three routes to clear it, all shut:

- The CLI short-circuited. `mycontext edit <id> --summary "<the same text>"` answered "nothing to change ... already has the summary you passed. Nothing was written." - `edit.ts` · `nothing to change — ${item.id} already has the ` · ~897.
- The escape hatch refused it, and refused it correctly. `--summary-unchanged` is turned away on an edit that raises no gate - `summary-gate.ts` · `if (!basisMoves(item, patch)) {` · ~281 - because on an ordinary edit it would mark an already-stale summary current, a machine recording that somebody checked this sentence against this text when nobody did.
- Doctor then named the only move left, and it was the dishonest one. Its message said the basis "is re-stamped by that write and by nothing else" - `checks.ts` · `code: 'summary_stale'` · ~802 - which is true only when the sentence CHANGES. So the instruction reduced to "write a different sentence", which is what `STD-a-summary-is-one-plain-sentence-for-someone-who-does-not` exists to prevent.

THE RULING: THE SHORT-CIRCUIT WAS THE REAL BUG, BECAUSE ITS SENTENCE WAS FALSE. The command asks whether the edit leaves a FIELD of the item reading differently, and for a summary passed back verbatim the answer is no. But the write still moves `summary_of`, and moving `summary_of` is exactly what takes the item from stale to current. There WAS something to change; the command reported that there was not. Everything else followed from that one false sentence.

WHY THE HATCH WAS NOT SIMPLY WIDENED INSTEAD, AND THIS IS THE WHOLE DESIGN. The clause that refuses `--summary-unchanged` here over-applies - it reasons "this edit changes nothing, so there is nothing to re-stamp", which is false when the summary is already stale. Widening it would have worked. It was rejected on COST. A flag is one token: `--summary-unchanged` could be typed over every stale summary in a corpus, in a loop, without one of them being read, and the resulting record would be indistinguishable from a person having read them all. A re-affirmation can only be spelled by REPRODUCING THE SENTENCE, which costs the same keystrokes as writing a new one and cannot be done without reading it. The guard is intrinsic to the act rather than bolted onto it, so there is no third clause to get wrong. The hatch's third refusal therefore stays absolute; only its remedy sentence changed, to name both honest endings instead of one.

IT IS A DIFFERENT ASSERTION FROM THE HATCH, AND THE AUDIT ROW SAYS WHICH. `--summary-unchanged` asserts something about the WRITE - "this edit did not change what the item means" - in answer to a gate the write raised. A re-affirmation asserts something about the ITEM - "I read this and it still holds" - unprompted. So there are two notes and not one - `summary-history.ts` · `export const SUMMARY_UNCHANGED_NOTE` · ~179 for the hatch, and `summary-history.ts` · `export const SUMMARY_REAFFIRMED_NOTE` · ~202 for this. A log that spelled both the same way could answer neither of the questions either exists for. They can never appear together, because passing a summary beside the hatch is refused. On a bare re-affirmation the row names no field at all - `summary_of` is deliberately not an audited field - so the note is the entire record that anything happened, which is precisely why it has to exist.

AND THE FOURTH DOOR, WHICH NOBODY KNEW WAS OPEN. The third route was believed shut because `rule` is normative and `agentEdits` is `review`, so an agent's content edit is staged rather than written. It was not shut. `contentChange` correctly calls an echoed summary no change - `trust.ts` · `export function contentChange(` · ~609 - so nothing was staged, the `review` branch fell through, and `update_item({id, summary: "<the same text>"})` APPLIED. Measured on a copy of this corpus on 2026-09-01: the call returned "updated", `summary_of` moved from `42ceec5245cdbe13` to `6e4c39aa30582f8a`, the `summary_stale` warning disappeared, and the audit row named no field and carried no note. An agent could take the STALE marker off a governing rule on its own say-so, and nothing recorded that it had. That is now refused in the same shape as the hatch's staging refusal - `mutate.ts` · `if (summaryReaffirmed(item, update)) {` · ~956 - because a staged revision carries TEXT and there is no new text for it to carry, and because an assertion about a governing item that this project holds for human review is a human's to make.

THE LESSON UNDER ALL OF IT: A REFUSAL IS ONLY AS GOOD AS THE STATEMENT IT MAKES. Both halves of this defect were one false sentence apiece. "Nothing to change" was false about a write that changed the stamp. "Not a change" was true of the text and false of the effect, and it let an agent walk through a review policy. Neither was a missing check; each was a check answering a narrower question than the one its wording claimed to answer.

Related: `STD-a-summary-is-one-plain-sentence-for-someone-who-does-not` is why a gratuitous rewrite is not an acceptable way out, and `RULE-do-not-amend-an-append-only-log-append-a-second-record` is the same instinct applied to the record rather than to the sentence.
