---
id: TASK-ship-the-search-the-research-recommended-three-readings-of
type: task
title: "ship the search the research recommended: three readings of one query, a term floor that says so, and an exclusion — now with ranking allowed"
status: active
severity: soft
always: false
summary: Build the conversation search that finds a passage when you remember two words that are not next to each other.
summary_of: c8743f403f5a63ca
scope:
  - src/core/conversation-search.ts
  - src/core/conversation-index.ts
  - src/ui/public/screens/conversations.js
  - src/ui/public/strings/**
  - test/**
  - e2e/**
tags:
  - v2
  - recall
  - search
  - "plan:semantic"
  - "seq:4"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: 9b7a55f988993ead
plan: semantic
seq: "4"
state: todo
priority: "1"
---

# ship the search the research recommended: three readings of one query, a term floor that says so, and an exclusion — now with ranking allowed

THIS IS THE IMPLEMENTATION OF `reports/2026-09-16-the-search-grammar.md` §5, which lane AC
produced against `semantic/2` and which is COMMITTED at `c5e372dd`. READ IT FIRST AND DO NOT
RE-DERIVE ITS NUMBERS — every measurement below is already taken and is cited so that this
lane spends its time building rather than re-measuring.

THE OWNER’S COMPLAINT, 2026-09-16: "the search in conversation is not smart, it let me search
for a specific string and i could not find more complex cases". AC’s answer, in one line: the
missing feature is not regex and not a checkbox — HIS TWO WORDS ARE REQUIRED TO BE ADJACENT
and nothing lets him say NEAR instead.

── WHAT IS NEWLY PERMITTED, AND IT CHANGES ONE THING ────────────────────

`RULE-search-may-rank-its-results-and-the-model-it-asks-is-the` landed 2026-09-16: SEARCH MAY
RANK. `filterItems`’ refusal is lifted. AC wrote §5 under the old constraint and said so — the
TIER is an ordering derived from the query rather than a score, deliberately, "so it is not the
relevance claim `filterItems` refuses to make". That reasoning is now optional, not required.

BUILD THE TIERS ANYWAY, because they are better than a score and not a substitute for one: a
tier tells the reader WHY a result is where it is, and bm25 cannot. Use ranking WITHIN a tier,
which is the thing AC could not do and which is now yours to take.

AND ORDERING IS NOT FILTERING. `INV-nothing-is-dropped-silently`: a ranked set that is
truncated says so and says by how much. The bm25-before-scope defect this project already
measured — `nothing-to-do-and-could-not-look-are-different-answers`, the anchors case where a
top-200 ranking was applied BEFORE the byte scope and the pass silently stopped — is the exact
shape to not rebuild. A bound is not a scope.

── THE THREE, FROM §5, IN ORDER ───────────────────────────────────

ONE — READ ONE QUERY THREE WAYS AND SHOW THE ANSWER IN TIERS. Split the trimmed query on
whitespace; send `"a b"`, then `NEAR("a" "b", 30)`, then `"a" AND "b"`; show the union in that
order, each block under a line saying what it is. A one-word query collapses to one query.
MEASURED over 1,420 two-word phrases he actually typed: phrase 31.7% return anything (median 3
spans); NEAR(...,30) 99.6% (median 4); AND 100% (median 38). The whole complaint is that row.
Note §2.1: under TRIGRAM, `NEAR`’s distance is in CHARACTERS, not tokens — FTS5 does not
document this and 30 was chosen against it.

TWO — MOVE THE THREE-CHARACTER FLOOR FROM THE QUERY TO THE TERM, AND SAY SO. See §5.

THREE — `-word` TO EXCLUDE, AND NOTHING ELSE THAT LOOKS LIKE SYNTAX. See §5.

THE FAILURE MODE AC NAMES AND THIS LANE MUST NOT WALK INTO: a Find dialog with nine checkboxes
nobody ticks. NONE OF THE THREE IS A CHECKBOX. VS Code’s three toggles survived eight years of
pressure for a fourth; a box this reader opens to find one passage has earned none of them.
**The right number of new controls is zero.** §6 lists what AC would REFUSE and why — do not
reopen any of it without a number that is not already in the report.

── HEBREW IS NOT A TEST CASE HERE, IT IS HALF THE CORPUS ──────────────────

§3 measured it before anything was offered, and it is what fixes the ORDER of the tiers —
phrase first, because Finding 2 is a real pair the phrase finds and the AND does not. The
trigram tokenizer was chosen at 51x better than unicode61 for his front-particle queries. Any
assertion about word boundaries is wrong in this index. BYTE offsets, never character offsets.

── WHAT "DONE" MEANS ────────────────────────────────────────

The owner types two words he remembers from a passage, in either language, and finds it — on
the CONVERSATION box and on the corpus box, and §4 says which of the three transfer to which,
so read it rather than applying all three blindly to both.

HELD BY REMOVAL PROOFS, one per assertion, each shown to redden at its own line. A green
assertion is a FINDING. And it is a UI change: drive it in Playwright yourself before
reporting, in BOTH languages, the way `e2e/conversations.spec.ts` already does.

SEMANTIC SEARCH IS NOT THIS ITEM — it is `semantic/5`, and it is an ADDITION to this. What you
build must work with no model reachable at all.
