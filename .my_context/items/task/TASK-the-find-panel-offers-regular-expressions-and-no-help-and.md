---
id: TASK-the-find-panel-offers-regular-expressions-and-no-help-and
type: task
title: the find panel offers regular expressions and no help, and nothing simpler for a reader who does not want a language
status: active
severity: soft
always: false
summary: The find panel now offers four exclusive ways of typing a query — plain words, wildcards, AND/OR/NOT/NEAR, and regular expressions — as a radio group with help and clickable worked examples, and every number the screen draws is bold.
summary_of: 32567346bd5ddce3
summary_was:
  - 2026-09-16 Add help with worked examples to the find panel, plus wildcard and logical ways of searching, and make the numbers stand out.
scope:
  - src/ui/public/screens/conversations.js
  - src/ui/public/lib/fold.js
  - src/ui/public/lib/panel.js
  - src/ui/public/lib/i18n.js
  - src/ui/public/styles.css
  - src/ui/public/strings/**
  - src/core/conversation-search.ts
  - src/ui/read-model-conversation-document.ts
  - test/**
  - e2e/**
tags:
  - v2
  - recall
  - search
  - "plan:semantic"
  - "seq:11"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: 0315b684af0528bc
plan: semantic
seq: "11"
state: done
priority: "1"
---

# the find panel offers regular expressions and no help, and nothing simpler for a reader who does not want a language

THE OWNER, 2026-09-16, HAVING USED THE PANEL: "the basic implementation is good, what i would
like to improve: 1 - regex is complex and a regex help with examples should be added, 2 -
alternatives to regex A - wildcard character pattern matching in expressions, also with help and
examples, B - some logical ops the user could use especially if supportd by sqlite like AND OR
LIKE NEAR etc include examples of use, 3 Bold the count and other numeric values you display".

READ `reports/2026-09-16-the-find-panel.md` FIRST. The panel, its frame
(`src/ui/public/lib/panel.js`) and the matcher (`findQuery` in `src/ui/public/lib/fold.js`) all
landed today and every measurement below is from it.

── THE FACT THAT DECIDES 2B, AND IT IS NOT WHAT HE ASSUMED ──────────────

**THIS SURFACE DOES NOT TOUCH SQLITE.** `findInDocument` SCANS every prose span of the open
transcript (~160 ms) and the browser paints ranges; it does not query FTS5, and that is
deliberate on two counts recorded today: the index is UNFOLDED, so it cannot see that `...`
matches `…` (463 spans against 1,024), and FTS5 cannot give in-document offsets at all —
`offsets()` was tried and fails with "unable to use function offsets in the requested context".

So AND / OR / NOT / NEAR here are IMPLEMENTED IN THE SCAN. That is not a downgrade: operators
written here compose correctly with Match case and with NFKD folding, which FTS5 operators would
not. Say so in the help rather than letting a reader think they are typing SQL.

WHAT DOES USE FTS5 IS THE OTHER BOX — the archive search across all sessions, which already reads
one query three ways (phrase, `NEAR(…,30)`, AND) and shows them in tiers. Do not confuse the two
surfaces and do not duplicate that tiering here; `§4` of `reports/2026-09-16-the-search-grammar.md`
measured that none of it transfers unchanged.

AND ONE MEASUREMENT TO CARRY INTO THE HELP: under the TRIGRAM tokenizer, FTS5’s `NEAR` distance
is counted in CHARACTERS, not words — undocumented by FTS5 and measured by this project. If you
implement a `NEAR` in the scan, choose its unit deliberately and SAY which it is.

── 1 — REGEX HELP, WITH EXAMPLES ──────────────────────────────

Examples that RUN AGAINST HIS OWN ARCHIVE, not a textbook. A help that says `\d+` matches digits
teaches nothing; one that says "`\d+ ms` finds every timing this session printed" is worth
reading. Clicking an example should put it in the box.

It must also state the refusal already shipped: a pattern shaped `(X+)+` is REFUSED STATICALLY,
because `^(\w+\s?)+$` froze the scan for 108,785 ms and a runtime canary was measured to be
unsound. A reader who meets that refusal deserves to find out why in the help, not by guessing.

── 2A — WILDCARDS ─────────────────────────────────────

`*` and `?` as everyone expects them. This is the mode for a reader who wants a pattern without
learning a language, and it is the one most likely to be used, so it should be the FIRST
alternative offered and not the last.

It will almost certainly be built by translating to a regular expression underneath — which means
THE CATASTROPHIC-BACKTRACKING REFUSAL APPLIES TO IT TOO. `*` next to `*` can produce exactly the
shape that is refused. Make sure a wildcard cannot smuggle in a pattern the regex mode would
refuse, and make sure the refusal SAYS SO IN WILDCARD TERMS rather than showing the reader a
regular expression they never typed.

── 2B — LOGICAL OPERATORS ────────────────────────────────

He named AND, OR, LIKE, NEAR. Judge each on whether it MEANS anything on this surface and say so
either way — `LIKE` is SQL’s wildcard and may simply BE 2A under another name, in which case say
that rather than shipping two spellings of one idea.

THE HARD QUESTION IS WHAT A HIT IS. A scan currently returns spans to paint. Under `AND`, a TURN
matches but no single range does — so decide and state: does `AND` paint both terms wherever they
occur, and does the count count TURNS or OCCURRENCES? The panel already draws both numbers and
they must not start disagreeing.

── HOW THE THREE MODES FIT TOGETHER ──────────────────────────

Notepad++ — the tool he named — does NOT use a checkbox for this. It uses a RADIO GROUP: Normal /
Extended / Regular expression, with Match case and Whole word as independent checkboxes beside
it. That shape is the answer to "how do four ways of typing a query coexist", it is the one he has
in mind, and `Regular expression` is already a checkbox here that would become one of its options.

Consider it and say what you chose. What must NOT happen is four checkboxes that can be ticked in
combinations nobody defined.

── 3 — BOLD THE NUMBERS ─────────────────────────────────

Every quantity the reader’s eye goes to: the turn count, the times count, the sections shown, the
record totals, "N of M". Not the whole sentence — the NUMBER. It is small, it is his direct ask,
and it applies wherever those sentences are drawn, not only inside the panel.

Both languages. Hebrew is RTL and a bidi run around a bolded numeral is where this goes wrong;
check it on screen rather than assuming.

── WHAT MUST NOT REGRESS ─────────────────────────────────

  — EVERY MODE IS IMPLEMENTED IN THE SERVER SCAN, through the one `findQuery` call the count and
    the highlights share. A mode implemented in the page would apply only to the rendered rows —
    the virtualised-DOM defect this project refuses, and it would be invisible.
  — The strip stays shrunk: 372.69 → 230.53 px was today’s win. Report it again.
  — Hebrew. `שורה` finds the glued `השורה`, and whole-word already had to be honest about what it
    cannot mean here. Whatever you add must be equally honest.
  — Held by removal proofs, one per assertion, each reddening at its own line — and a proof that
    reddens NOTHING is a finding to record, never to hide. Five did today.

## Request

about the find dialog - the basic implementation is good, what i would like to improve: 1 - regex is complex and a regex help with examples should be added, 2 - alternatives to regex A - wildcard character pattern matching in expressions, also with help and examples, B - some logical ops the user could use especially if supportd by sqlite like AND OR LIKE NEAR etc include examples of use, 3 Bold the count and other numeric values you display
