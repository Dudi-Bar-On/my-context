---
id: TASK-propose-drafts-nobody-has-to-trust-preferring-a-check-over-a
type: task
title: propose drafts nobody has to trust, preferring a check over a rule over a lesson
status: active
severity: soft
always: false
summary: Turn what was learned into suggestions that are never in force until approved, favouring something that can be checked over something that must be believed.
summary_of: a874e4556ded26a8
scope:
  - src/**
  - test/**
  - scripts/**
tags:
  - v2
  - review-loop
  - "plan:loop"
  - "seq:3"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 033267d409e1a308
plan: loop
seq: "3"
state: done
priority: "1"
needs: loop/2
---

# propose drafts nobody has to trust, preferring a check over a rule over a lesson

D36c. BUILT AND MEASURED 2026-09-11. Five tasks landed, plus the read half of the decline ledger
that §8 puts on the proposing side.

WHAT A PROPOSAL IS. A fourth origin, `review` (core/types.ts), that cannot produce anything but a
draft on ANY tier — `trustedStatus` refuses it before it consults the tier, because the per-tier
rule would have left `lesson`, the pass's least-preferred artifact, as the one output needing no
approval. `updateItem` and `supersedeItem` refuse the origin outright with a message naming the
ruling. Its files land in `.my_context/.drafts/<type>/<id>.md`, a gitignored sibling of `.staging/`
carrying its own `*` .gitignore (core/drafts.ts), and `loadLayer` walks that directory as a second
root — same corpus, same id grammar, same index, so a draft is listed, shown and duplicate-checked
like any item and `select` leaves it alone because its status is draft. Verified against real git:
`git status --untracked-files=all` names no draft and still names an ordinary item.

THE ORDER IS APPLIED, NOT DECLARED. `classify` (review/propose.ts) asks §4's two questions in order
and takes the first tier that fits. Proved by REMOVAL on one sentence: "A new test in
test/review/propose.test.ts must never rest on the live corpus" is a CHECK; strip the mechanism and
it is a RULE; strip the modal too and it is a LESSON. A check becomes a `task`, which is §4's own
safety argument — approving a check creates work, not law.

DECLINE AND DEDUPE KEY ON THE CLAIM. `claimKey` (review/claim.ts) returns a readable canonical
value, not a digest: `target :: <sorted, stemmed, stopword-free, date- and ticket-free tokens>`,
capped at 24. Exact layer — a reworded, re-dated, re-markdowned restatement produces the IDENTICAL
string. Fuzzy layer — `sameClaim` scores two canonical strings at NEAR_CLAIM_THRESHOLD, with the
target as a TOTAL gate rather than a token (before that split, "the same words about a different
target" scored 0.83 and was wrongly suppressed). Readable rather than hashed because §8 calls the
ledger untrusted input, and a ledger of opaque hashes is one the owner cannot audit.

CALIBRATED, NOT CHOSEN. 0.35, from the owner's real session directory: 292 sources, 841,502,108
bytes, 158,706 records, 1,282 observations, 363 candidates, 245 same-target pairs. Suppression by
cutoff: 0.20 → 104 (42.4%), 0.30 → 52, 0.35 → 34 (13.9%), 0.40 → 27, 0.50 → 6. Read off the TEXT:
between 0.35 and 0.40 sit two candidates whose whole sentence is `node src/cli/index.ts doctor:`,
so 0.40 lets two runs of one command become two proposals; below 0.35 the pairs stop being one
claim. It is NOT `CONTRADICTION_THRESHOLD` — different question, different population,
already-normalised text — which is why the calibrated answer is lower rather than higher.

WHAT ONE REAL PASS PROPOSES. Over that session, 1,282 observations became: 106 screened (§12 plus
the narrative screen), 827 refused for naming no file, module or item, 17 suppressed as
near-duplicates, 136 classified but not authored (71 rule, 65 lesson), 196 surviving to the ranking,
5 admitted at a ration of 5 — every one a CHECK filed as a task, every one naming a target and
citing `<file> record <n>`. 1,282 accounted for exactly; the arithmetic is asserted.

THE FINDING THAT CHANGED THE BUILD. The first dry run's five highest-ranked candidates were the
OWNER'S OWN INSTRUCTIONS, proposed back to him as things this project had learned, none naming a
file. That is §12's fourth rule and its shape contract failing together — the exact outcome the plan
told me to look for. Requiring a target and screening narrative openings fixed the material but not
the underlying fact: a lexical proposer can SELECT an observation and cannot COMPOSE a rule; every
candidate it produces is a sentence from a transcript. As the body of a rule or a lesson that
sentence becomes law or knowledge nobody generalised; as the body of a task it is work somebody is
being asked to look at. So `AUTHORABLE` is `check` alone, and the rule and lesson candidates are
counted rather than written.

CONFIG, AND A DELIBERATE DEVIATION. `maxProposalsPerPass` left REVIEW_LATER_KEYS and is now a
bounded count (0..50). The DEFAULT IS 0, where §11 prints 5: a workspace that sets `enabled: true`
and changes nothing else reads, reports and writes NOTHING. Zero is the ration set to nothing, not a
second kill switch — `enabled` is still the one switch. Raising it is the owner's, after reading a
week of `state/review-last-pass.json`. `crossSessionSameCwd` and `model` stay refused: the sightings
ledger lives inside one corpus root so "same cwd" is not a setting, and nothing in this product
calls a model.

WHAT IT CANNOT SEE, DISCLOSED IN THREE PLACES. The prompt leads with `wholenessLine`; `propose.ts`'s
header states it; the report carries it. It reads a transcript, so it sees what was SAID — never
what was understood or acted on. It never sees a lane's dispatch brief: `gather` drops those and
counts them (2,003 on this session) because a brief is stored as a `type:'user'` record, and a rule
quoted into ten briefs is one rule, not ten confirmations. And the anti-learning screen catches
CARELESSNESS, NOT FALSEHOOD — a four-stage write-time screen with 83.2% recall on indirect prompt
injection rejected 0 of 360 poisoned memories. That sentence is in `prompt.ts` and a test asserts it
is.

REMOVAL PROOFS: 14, every one RED, restore green. The review clause in `trustedStatus`; the draft
filePath branch; the `.drafts` walk in `loadLayer`; the `updateItem` refusal; the target gate in
`sameClaim`; an impossible NEAR_CLAIM_THRESHOLD of 999; the check tier in `classify`; the
anti-learning screen; the relevance requirement; the decline consult; recurrence forced to confirmed
with an impossible session count of 4242; the fifth anti-learning rule; the decline cap; the
`.drafts` .gitignore write.

THE CLOSURE CHECK FIRED, WHICH IS THE RECORD OF IT WORKING. Adding a fourth `Origin` stopped the
compiler in exactly two places — `pack/history.ts`'s `Record<Origin, true>` and
`test/pack/import.test.ts`'s type-level closure assertion — which is the pair of places a new member
had to be considered. Admitted in both: a history row recording a create with origin `review` is a
true record, and import still stamps `ingest` whatever a pack says.

STILL OPEN, FOR seq:4. The decline BUTTON is D36d's; only `claimKey`, `readDeclines`,
`recordDecline` and `alreadyDeclined` are here, because the pass consults the ledger before
proposing. `isCorpusFilePath` (doctor/checks.ts) requires an `items/` prefix, so the web UI cannot
serve a draft's file — D36d's review surface needs that widened or routed like `/api/staging`. And
the D36d plan's own example strings for `claimKey` are shorter than these and score 0.267, below the
calibrated cutoff: that test needs richer bodies or its own number.
