---
id: OPENQ-does-run-honour-the-flags-a-composed-read-carries-or-refuse
type: open_question
title: does Run honour the flags a composed read carries, or refuse the reads it cannot honour
status: deprecated
severity: soft
always: false
summary: Two buttons on one screen answer the same written command differently, and which one should change is a decision for the owner.
summary_of: c2b5f10e0c4db804
scope:
  - src/ui/public/lib/palette-defs.js
  - src/ui/public/screens/palette.js
  - src/ui/read-model.ts
tags:
  - v2
  - ui
  - composer
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: 2026-09-06
checksum: c16ff8e95bad8744
---

# does Run honour the flags a composed read carries, or refuse the reads it cannot honour

The ruling asked for by `TASK-the-composer-has-two-run-buttons-and-they-disagree-about` (plan:builder
seq:15). That task says in its own words that neither shape "should be chosen by whoever happens to
be in the file". This is the choice, put to the owner with both shapes costed and with the
population measured exhaustively rather than sampled.

MEASURED, 2026-09-06, in the browser against this repository's own corpus

`mycontext list rule` composed in the Composer, RUN pressed: the screen answers **966 rows**,
captioned "966 rows", whose first rows are `ADR-build-rather-than-adopt`,
`ADR-markdown-plus-disposable-index`, `ADR-normative-vs-rationale-tiers` — every category in the
corpus — beneath a command box reading `mycontext list rule`. `Run` calls `endpoint: () =>
'/api/items'`, which never reads `values.category`; `apiItems` declares `unknownParams(url, [])`, so
`/api/items?category=rule` is a 400 and there is nowhere for the category to go.

The same line EXECUTED returns the real CLI table: 52 rules.

**Two figures in the reporting task are wrong and are corrected here.** It says 965 rows and 56
rules. The corpus was 965 items the day it was written and is 966 today, so that one is drift. The
56 is not: `mycontext list rule` returns **52 rules**, and 56 is the number the execute pager prints
— "Showing the first 20 of 56" — because it counts LINES of the rendered table, and 52 data rows
plus a top border, a header, a separator and a bottom border is 56. The disagreement is 966 against
52, not 965 against 56.

THE POPULATION IS TWO, AND IT WAS DERIVED RATHER THAN READ

Each read entry was composed with a sentinel in every field and its run target checked for the
sentinel. Nine read entries; eight of them runnable; **two drop a composed value**:

    status, doctor, decay, review revisions   no composable field at all      agree
    show                                      id  -> /api/item/:id            agree
    search                                    all seven flags -> query string agree
    list                                      category DROPPED -> /api/items  DISAGREE
    help                                      topic DROPPED -> #/learn        DISAGREE
    audit                                     runnable: false, no Run drawn   correctly refuses

`audit` is the shape that is already right: it composes `--files`, honours nothing, and draws no Run
button at all, saying so in `pal.copyOnly`.

**`help` is the one the reporting task did not know about, and it is worse than `list`.** The topic
picker offers all seven `HELP_TOPICS` — categories, scope, capture, workflow, cli, tools, slash —
and Run navigates to `#/learn` for every one of them. `#/learn` draws `UI_HELP_TOPICS`, which is
four. Measured: composing `mycontext help slash` and pressing Run lands on a Learn screen on which
the word "slash" does not appear anywhere. `list` answers a different question; `help` answers no
question at all for three of the seven topics it offers.

OPTION 1 — THE RUN TARGET GROWS THE PARAMETERS THE COMPOSED LINE IMPLIES

For `list` this is small and exact. `mycontext list [category]` takes a category and the detail
flags and nothing else (`LIST_USAGE`), and the Composer offers only the category. `/api/items` would
allow one more parameter, validated against `ws.config.categories` exactly as `apiSearch` already
validates `type`, and filter on it. **The refusal-by-default property survives**: `?catgory=rule`
still 400s on the allow-list and `?category=rulz` 400s with the declared categories named, so no
typo becomes a silently ignored filter. Cost: about a dozen lines in `read-model.ts` with its
docblock, its `read-model.test.ts` cases, and one line in `palette-defs.js`.

The cost that is not lines: `/api/items` is the id-resolution target every screen in this UI
resolves an id against, and this widens its contract. It is additive and the default answer does not
move, but it is still a read endpoint growing a filter because a different screen wanted one.

**For `help` this option is not small and part of it is structurally unavailable.** Honouring
`help <topic>` on `#/learn` needs the Learn screen to accept `#/learn/<topic>` (the shell already
splits a hash that way — `screenFromHash`) AND an answer for `cli`, `tools` and `slash`, which
`/api/help/:topic` refuses by design. One of them cannot be served at all: `helpTopic('cli', …)` is
generated from the CLI's command registry, and loading that registry would pull `core/mutate.ts` —
the whole write surface — into the read server's import graph, which Task 14 forbids. So option 1
settles `list` and leaves `help` needing a Learn-screen design the owner has not been asked for.

OPTION 2 — RUN REFUSES ANY ENTRY WHOSE COMPOSED FLAGS IT CANNOT HONOUR

One mechanism covers both entries, and it can be DERIVED rather than declared: compose the target
with the values in hand and withhold Run when a composed value does not appear in it — which is
exactly the probe that produced the table above, so a tenth entry added later is classified with no
edit and a catalogue that drifts cannot lie about it. The shape already exists on this screen for
`audit`: no button, and one sentence where the button would have been.

Nothing becomes unanswerable by it. `mycontext list` bare still Runs; `mycontext list rule` keeps
Execute, which answers correctly. A reader is told the truth instead of being shown a plausible
answer to a different question.

Its cost is a sentence. `pal.copyOnly` is the wrong one — it says "this one is yours to run", which
is about a command this browser cannot execute AT ALL, and Execute is right there. A new key in both
string tables is new product copy, which is the owner's under
`DEC-claude-drafts-the-mockup-and-the-owner-approves`.

AND IN HEBREW THE SCREEN SAYS THE TWO BUTTONS ARE THE SAME THING

Found while driving the second language, and it changes the frame rather than decorating it.
`'pal.run': 'Run'` and `'exec.btn': 'Execute'` are two words in English. In `he.js` both are
**`הרצה`**. A Hebrew reader on the Composer is shown two adjacent buttons carrying the identical
label, which do different things and — for `list <category>` — return different answers. The
reporting task's charge is that "nothing on the screen says the two buttons mean different things";
in Hebrew the screen positively says they are the same thing. Whichever option is chosen, this is a
second copy decision inside the same ruling, and it is the owner's too.

RECOMMENDATION, WHICH IS NOT A DECISION

Option 2, as the standing rule, with option 1 available afterwards per entry as an improvement
rather than as the fix. The reasoning: option 2 is derived, so it cannot go stale and it covers the
entry nobody had counted; it is the treatment this screen already gives `audit`; and it fails in the
direction that cannot mislead. Option 1 on `/api/items` is a good change on its own merits for
`list` and would turn Run back on for it — but adopted as THE fix it settles one of the two entries
and leaves the other disagreeing silently, which is the state the reporting task exists to end.

WHAT IS BLOCKED ON THIS

`builder/11` (D12) is the exhaustive test of this surface and asserts that the two paths agree. It
cannot assert agreement against a known disagreement. It is not blocked on the ANSWER, though — the
table above is exhaustive and citable, so that test can be written now to require agreement for the
six entries that agree and to name `list` and `help` as the two exceptions this question settles.

## Relations
- relates_to [[TASK-the-composer-has-two-run-buttons-and-they-disagree-about]]
- blocks [[TASK-the-composer-is-tested-as-a-user-would-use-it-every-field]]
