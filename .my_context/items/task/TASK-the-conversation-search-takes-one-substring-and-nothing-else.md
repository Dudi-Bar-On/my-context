---
id: TASK-the-conversation-search-takes-one-substring-and-nothing-else
type: task
title: the conversation search takes one substring and nothing else, so a reader who knows two things about a passage cannot use either
status: active
severity: soft
always: false
summary: Searching a conversation only matches one exact run of characters, so anything you half-remember is unfindable.
summary_of: 0c08a103509855af
scope:
  - src/core/conversation-search.ts
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - recall
  - "plan:semantic"
  - "seq:2"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: 29dba737c712161d
plan: semantic
seq: "2"
state: done
priority: "1"
---

# the conversation search takes one substring and nothing else, so a reader who knows two things about a passage cannot use either

OWNER REQUEST 2026-09-16: "the search in conversation is not smart, it let me search for a
specific string and i could not find more complex cases - i want you to dispatch now a subagent
that will do deep reaserch over the internet, specifically look at the notepad++ and similar and
find the best feature reach search implementation, it can also look for a solution in githib
repos if an existing node open source exists."

THIS IS A RESEARCH TASK AND ITS DELIVERABLE IS A RECOMMENDATION. Do not ship a search engine.

WHAT IS TRUE TODAY, measured by `semantic/1` on 2026-09-15 and not to be re-derived:
  — `text` is ONE CONTIGUOUS SUBSTRING on both surfaces: `filterItems` calls `String.includes`,
    `searchArchive` quotes the whole query into a single FTS5 phrase.
  — Over 1,363 two-word phrases he actually typed: 32.8% return anything AS A PHRASE; 100% as
    two AND-ed terms. Median 3 spans against median 32 — that spread is the precision it costs.
  — The shipped corpus search returns the right item 0 TIMES OUT OF 42 against his own requests.
  — `filterItems` REFUSES TO RANK, on purpose. Every candidate improvement is useless without
    ranking, and that refusal is the real gate — not the absence of features.

WHAT TO RESEARCH, and the standard is "what a reader can actually use", not a feature checklist:
  — Notepad++ and the editor tradition it belongs to — its Find dialog is the reference the
    owner named. What does it offer, and WHICH OF THOSE DOES A READER ACTUALLY REACH FOR? Whole
    word, case sensitivity, regular expressions, extended escapes, backward search, count,
    mark-all, search in selection, bookmark-matching-lines.
  — Comparable surfaces worth reading: ripgrep’s flag set and what it chose to leave out;
    VS Code’s find widget and its regex/word/case triad; Sublime; a mail client’s query
    language; GitHub code search’s qualifier grammar.
  — EXISTING NODE PACKAGES that could carry it, judged against the constraint below.

THE CONSTRAINT THAT DECIDES EVERY CANDIDATE: `CONST-zero-runtime-dependencies` is HARD.
`dependencies` is empty and stays empty. A library is therefore only interesting as a SOURCE OF
DESIGN, or if its whole idea fits in code we write and test ourselves. Report what a package
does and what it would cost to have the idea WITHOUT the package — do not recommend adding one.

AND FTS5 ALREADY OFFERS MORE THAN IS USED. The index is SQLite FTS5 with the TRIGRAM tokenizer.
FTS5 has a query grammar — AND/OR/NOT, prefix, phrase, NEAR — and `bm25()` ranking, and the
archive already orders by it. MEASURE WHAT THE TOKENIZER ACTUALLY SUPPORTS BEFORE PROPOSING IT:
trigram is not unicode61, and several FTS5 operators behave differently or not at all under it.
A proposal that assumes word boundaries is wrong here, and Hebrew is why — the trigram choice
was measured at 51x better than unicode61 for his front-particle queries.

FOR EACH CANDIDATE FEATURE, REPORT: what a reader could do that they cannot today; whether it
works under the trigram tokenizer AND in Hebrew; what it costs to implement with no dependency;
and whether it is useful WITHOUT ranking or only with it.

THE FAILURE MODE TO AVOID is a Find dialog with nine checkboxes nobody ticks. Notepad++ has
earned its options over decades of use; a box this reader opens to find one passage has not. Say
which THREE you would ship first and why those three.
