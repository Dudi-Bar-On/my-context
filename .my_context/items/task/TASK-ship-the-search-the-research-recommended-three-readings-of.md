---
id: TASK-ship-the-search-the-research-recommended-three-readings-of
type: task
title: "ship the search the research recommended: three readings of one query, a term floor that says so, and an exclusion — now with ranking allowed"
status: active
severity: soft
always: false
summary: The three readings, the per-term floor and the -word exclusion shipped on the conversation search; the corpus box was left to the ranking decision and is recorded as remaining.
summary_of: 45acf0c9bf5ad53b
summary_was:
  - 2026-09-16 Build the conversation search that finds a passage when you remember two words that are not next to each other.
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
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: 2aa7fef0e4a37710
plan: semantic
seq: "4"
state: done
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

── WHAT LANE AF SHIPPED, 2026-09-16, AND WHAT IT DID NOT ─────────────────

SHIPPED, on the CONVERSATION box, all three of §5, each held by a removal proof that reddened
at its own line:

  ONE — `searchArchiveTiered` in `core/conversation-search.ts`. Three readings of one query
  (phrase, `NEAR(…, 30)`, `AND`), the union in that order, one `TierAnswer` per reading and a
  `tier` on every hit. Fewer than two matchable words sends ONE reading, which is §5's own line.
  `searchArchive` is UNCHANGED and is still the one-substring reading, because `anchor-pass.ts`
  pages its probes with `offset` over `matchProse`'s total order and a union of three rankings
  has no stable global offset to page — that function's header carries the argument.

  TWO — the three-character floor moved from the QUERY to the TERM. A short word stays glued
  into the phrase reading, never enters a boolean, and reaches the screen as a WORD rather than
  a sentence, so the disclosure can be Hebrew. `ConversationIndex.countProse` was added so a
  reading that fills its bound says by how much — counted through the same `WHERE` the reading
  used, never around it.

  THREE — `-word` excludes, on every reading, wrapped in parentheses. Everything else that looks
  like syntax is a literal, and nothing throws.

Ranking: `matchProse` already orders each reading by `bm25()`, so the ruling of 2026-09-16 is
spent INSIDE a tier and the endpoint's sort keeps the tier as the outer key. Zero new controls.

NOT DONE, DELIBERATELY — THE CORPUS BOX. §4 of the report is explicit that none of the three is
worth having on `filterItems` alone ("an unranked union of three tiers over 1,282 items returns
items in `ORDER BY id` and a reader would be handed the alphabet"), and that AND-ing FIVE terms
is ruinous there — 2/42 against OR-ed bm25's 15/42. What the corpus needs is the RANKING that
`RULE-search-may-rank-its-results-and-the-model-it-asks-is-the` has now allowed: §4 measures
FTS5 + `bm25()` over the corpus at 0/42 → 15/42 at rank one for 535 ms of build time. That is a
different build from this one, in files this item's own scope does not name, and it wants an
item of its own rather than a quiet addition to this one.

ALSO NOT DONE: `src/core/conversation-search.ts:248` still cites the phantom id
`STD-nothing-to-do-and-could-not-look-are-different-answers`. The handover of 2026-09-16 asks
for all seven sites to be repaired as ONE act, so this lane left its one alone rather than
making that count harder to verify.

## Request

ok so now generate the grand D table progress and include all the Ds from 1 till the end, let me see, two more things: 1 - the search in conversation is not smart, it let me search for a specific string and i could not find more complex cases, i want you to dispatch now a subagent that will do deep reaserch over the internet, specifically look at the notepad++ and similar and find the best feature reach search implementation, it can also look for a solution in githib repos if an existing node open source exists, 2 - i want to add a capability that will backfill a conversation with anchores as we did, only by reading the conversation and trying to find points to be anchored as much as possible when no corpus exists, it is intended for a user that installs mycontext at the middle of development so it's conversation was created before mycontext was installed, there may be several claude code sessions that are archived and becomes conversations as we are browsing them under Conversations menu item
