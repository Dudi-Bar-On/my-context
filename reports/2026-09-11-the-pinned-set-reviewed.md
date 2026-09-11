# The pinned set, reviewed item by item — and the answer is not "unpin"

`TASK-the-pinned-set-is-reviewed-item-by-item-still-governing`
(`plan:governance seq:3`), the review the owner asked for on 2026-09-06 when he
authorised raising the injection budget: *"in a later time we will go over what
is pinned and consider if they still relevant."*

**Nothing here was changed. No item's `always`, `severity` or `status` was
touched.** Every number below was produced by running the product's own
`select()` at `event: 'session-start'` over an in-memory copy of the corpus with
flags or bodies altered in that copy only.

---

## THE DECISION, IN THREE NUMBERS

| | recovered | `governingSpill.titled` |
|---|---:|---:|
| today | — | **75** |
| after the two TRIMS (nothing unpinned) | **5,766** | **69** |
| after the three UNPINS as well | **9,005** | **67** |

**The recommended set to unpin is three items and 3,239 tokens, and on its own
it is worth exactly nothing.** Measured: unpinning those three and changing
nothing else leaves `titled` at 75. They are worth −2 only after the two trims
have landed. That is not a rounding artefact; it is the mechanism, and the
mechanism is the finding of this review.

### The mechanism, because every recommendation below rests on it

Two facts about `select()` decide everything here.

1. **The spare band admits only `governs()` items** — `select.ts` ·
   `fresh.filter((i) => !i.always && governs(i))`. Six types govern: `rule`,
   `constraint`, `invariant`, `instruction`, `requirement`, `standard`.
   **Thirty-seven of the thirty-nine pins are one of those six.** So unpinning a
   pin hands its tokens to the band *and puts the item itself into the pool
   competing for them* — and when it loses, it lands in `titled`. An unpin costs
   +1 titled before it buys anything.
2. **`fitToBudget` is first-fit over a `byPriority` sort**, not a strict prefix
   — `select.ts` · `// First-fit, not strict priority truncation`. So the
   marginal value of freed budget is lumpy and order-dependent: freeing 458
   tokens lets `INSTR-testing-happens-against-the-current-corpus-and-an-exception`
   (1,031) in, and that one admission crowds out three smaller items that were
   already in. Net: **+3 titled for unpinning a 458-token rule.**

Put together:

> **Trimming a pinned item by N tokens strictly dominates unpinning a governing
> pin worth N tokens — by exactly one titled item — and the trimmed item goes on
> being delivered in full at every session start.**

Proved on one item. `STD-v2-0-progress-report-and-the-format-progress-reports-use`
unpinned frees 2,296 and admits 3 → titled 73 (−2, because the item itself
joins). The same item trimmed by 1,504 admits 1 → titled 74 (−1). Scale the trim
to 2,296 and it would admit 3 for −3. Same tokens, one better, and the standard
still arrives.

**This is why the ten largest pins are not the ten best candidates.** Size is the
opportunity; it is not the argument.

---

## RECOMMENDED, RANKED

Each row's `titled` is cumulative — the state of the tier after that step and
every step above it.

| # | act | item | recovers | `titled` |
|---|---|---|---:|---:|
| — | *(baseline)* | | | 75 |
| 1 | **TRIM, keep pinned** | `REF-the-d-numbers-what-each-one-means-and-which-are-only` | 4,262 | **70** |
| 2 | **TRIM, keep pinned** | `STD-v2-0-progress-report-and-the-format-progress-reports-use` | 1,504 | **69** |
| 3 | unpin | `STD-the-progress-table-has-one-format-and-this-is-it` | 1,500 | |
| 4 | unpin | `REQ-restore-the-graphical-views-the-design-sketches-already` | 1,196 | |
| 5 | unpin | `RULE-progress-is-reported-as-two-tables-with-stable-d-numbers` | 543 | **67** |

**Total recovered 9,005. `governingSpill.titled` falls 75 → 67, a fall of 8.**
The spare band's admissions rise from **5 to 16**, and every one of the eleven
new arrivals is a governing item that reaches the session today as a title only.

Steps 3–5 are ranked *below* the trims and are genuinely optional: measured
alone they move `titled` from 75 to 75. **Do not take 3–5 without 1–2.**

### The eleven governing items the band admits under the full package

`INSTR-testing-happens-against-the-current-corpus-and-an-exception`,
`REQ-a-bounded-list-gives-the-reader-a-way-to-reach-what-it-held`,
`REQ-a-repository-document-is-viewable-in-the-ui-only-once-it-is`,
`REQ-a-session-near-the-end-of-its-window-asks-for-the-handover`,
`REQ-after-a-compaction-the-next-session-is-handed-the-handover`,
`REQ-an-item-must-be-editable`,
`REQ-changes-are-timestamped-and-audited`,
`REQ-cli-output-is-tabular-with-detail-levels`,
`REQ-configuration-is-composed-the-way-a-command-is-and-still`,
`REQ-configure-and-the-simulator-agree-on-the-budgets-whatever`,
`REQ-every-screen-has-a-task-that-implements-it-until-the-mockup`.

### Explicitly NOT recommended: the seven UI and mockup pins

`REQ-restore-the-graphical-views` aside, the UI cluster —
`INSTR-the-mockup-is-the-ui-specification-build-it-exactly-and-ask` (1,048),
`RULE-drive-the-ui-through-playwright-while-doing-the-work-not` (1,021),
`RULE-ui-work-consults-every-installed-design-frontend-and-browser` (704),
`RULE-a-ui-change-is-not-done-until-a-browser-test-drives-it` (659),
`RULE-playwright-is-how-the-ui-is-tested-and-it-is-the-most` (626),
`RULE-take-the-mockup-s-design-never-its-behaviour-behaviour-comes` (572) —
is 4,630 tokens and looks like the obvious block to free.

**Measured on top of the recommended package: it buys one titled item.** 67 → 66
for 4,630 tokens and six pins. The band hands almost all of it straight back,
because six governing items leaving the tier is six more items competing for the
room they vacated. Six owner rulings surrendered for one line of disclosure is
not a trade worth putting to him.

---

## THE MEASUREMENT

Taken 2026-09-11 on this repository's own corpus, later in the day than
`reports/2026-09-11-pinned-spare-band-remeasured.md`, which is why the figures
differ from it slightly. That report read 1,085 items, 39 pins at 29,016, and
79 titled. This one reads **1,093 items, 39 pins at 28,950, and 75 titled**. The
corpus moved between the two readings; neither figure corrects the other.

`budgets.pinned` is 30,000 and untouched. `pinnedSpill` is `null` — every
`always` item is still delivered in full, so the band's precondition holds.

### Every pinned item, sorted by cost

`itemCost` is the product's own — `select.ts` · `export function itemCost(item: Item): number {` —
never estimated. **Δ titled** is what happens if *that item alone* is unpinned;
**admits** is how many governing items the band then takes that it does not take
today. A positive Δ means unpinning it makes the disclosure **worse**.

| item | type | `itemCost` | Δ titled alone | admits | verdict |
|---|---|---:|---:|---:|---|
| `REF-the-d-numbers-what-each-one-means-and-which-are-only` | reference | 5,548 | −7 | 8 | still governing — **trim** |
| `STD-v2-0-progress-report-and-the-format-progress-reports-use` | standard | 2,296 | −2 | 4 | still governing — **trim** |
| `STD-the-progress-table-has-one-format-and-this-is-it` | standard | 1,500 | 0 | 2 | **merely true** |
| `REQ-restore-the-graphical-views-the-design-sketches-already` | requirement | 1,196 | −1 | 3 | **merely true** |
| `INSTR-the-mockup-is-the-ui-specification-build-it-exactly-and-ask` | instruction | 1,048 | 0 | 1 | still governing |
| `RULE-drive-the-ui-through-playwright-while-doing-the-work-not` | rule | 1,021 | 0 | 1 | still governing |
| `INSTR-read-the-relevant-mycontext-help-before-writing-any-command` | instruction | 886 | 0 | 0 | still governing |
| `CONST-zero-runtime-dependencies` | constraint | 845 | 0 | 0 | still governing |
| `RULE-ui-work-consults-every-installed-design-frontend-and-browser` | rule | 704 | +2 | 1 | still governing |
| `RULE-parallel-agents-share-no-mutable-resource-enumerate-and` | rule | 673 | +2 | 1 | still governing |
| `RULE-a-ui-change-is-not-done-until-a-browser-test-drives-it` | rule | 659 | +2 | 1 | still governing |
| `RULE-track-development-work-in-the-task-category-and-keep-it` | rule | 655 | +2 | 1 | still governing |
| `STD-a-citation-names-a-file-a-verbatim-fragment-and-an-optional` | standard | 644 | +2 | 2 | still governing |
| `RULE-playwright-is-how-the-ui-is-tested-and-it-is-the-most` | rule | 626 | +2 | 2 | still governing |
| `INSTR-read-the-design-record-before-acting-on-a-subject-and-learn` | instruction | 617 | 0 | 0 | still governing |
| `INSTR-work-is-tracked-as-a-task-item-before-it-is-started-not` | instruction | 601 | +2 | 2 | still governing |
| `RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none` | rule | 595 | +2 | 2 | still governing |
| `RULE-look-for-a-skill-before-acting-and-read-it-before-deciding` | rule | 584 | +2 | 2 | still governing |
| `RULE-take-the-mockup-s-design-never-its-behaviour-behaviour-comes` | rule | 572 | +2 | 2 | still governing |
| `INSTR-query-and-display-the-task-item-before-starting-and-after` | instruction | 569 | +2 | 2 | still governing |
| `RULE-progress-is-reported-as-two-tables-with-stable-d-numbers` | rule | 543 | +3 | 1 | **merely true** |
| `INSTR-all-work-goes-through-subagents-and-only-the-assistant-runs` | instruction | 533 | 0 | 0 | still governing |
| `RULE-prove-your-measurement-can-see-every-kind-of-member-before` | rule | 532 | +3 | 1 | still governing |
| `INSTR-use-my-context-for-everything-you-need-to-remember-read-what` | instruction | 531 | +3 | 1 | still governing |
| `RULE-a-diagnostic-probe-never-runs-against-a-corpus-a-person-is` | rule | 518 | +3 | 1 | still governing |
| `RULE-delegate-to-subagents-reserve-the-context-window-for` | rule | 486 | +3 | 1 | still governing |
| `RULE-prove-parallel-agents-are-disjoint-by-file-not-by-topic` | rule | 476 | +3 | 1 | still governing |
| `RULE-anything-you-start-for-a-human-to-look-at-must-outlive-the` | rule | 468 | +3 | 1 | still governing |
| `RULE-run-a-gate-the-way-the-project-runs-it-never-through-an` | rule | 458 | +3 | 1 | still governing |
| `NOGOAL-not-a-claude-mem-replacement` | non_goal | 448 | +2 | 2 | still governing |
| `RULE-always-return-the-working-tree-to-master-when-work-is-not-in` | rule | 429 | +3 | 2 | still governing |
| `RULE-a-regression-test-is-worth-nothing-until-you-have-watched-it` | rule | 428 | +3 | 2 | still governing |
| `RULE-read-the-process-s-own-log-before-forming-any-hypothesis` | rule | 401 | +3 | 2 | still governing |
| `INV-nothing-is-dropped-silently` | invariant | 221 | 0 | 0 | still governing |
| `INV-markdown-is-the-source-of-truth` | invariant | 193 | 0 | 0 | still governing |
| `INV-posix-normalized-paths` | invariant | 135 | 0 | 0 | still governing |
| `RULE-erasable-syntax-only` | rule | 125 | +1 | 1 | still governing |
| `CONST-node-24-no-build-step` | constraint | 124 | 0 | 0 | still governing |
| `CONST-evidence-must-cite-a-captured-record-id` | constraint | 62 | 0 | 0 | **not confident — see below** |

Median pin 569. Twenty-two of the thirty-nine have a **positive or zero** Δ: on
this corpus, unpinning them alone makes the disclosure the same or worse.

### Nothing in the pinned set is superseded

**Zero items earned the third verdict.** Thirty-six of the thirty-nine are
instructions the owner or this project gave and has not withdrawn, and every one
of them was checked against what it names: the rule it constrains still exists,
the defect it was written from is still reachable, the tool it names is still
installed. `CONST-node-24-no-build-step` and `CONST-zero-runtime-dependencies`
read like facts but are prohibitions — *do not add a build step, do not add a
runtime dependency* — and the second is now enforced by
`npm run check:dependencies`, which parses the item's own sentence.

**So the pinned tier's cost is not staleness. It is unconditionality, and in two
cases it is size.** That is what the rest of this report is about.

---

## THE TWO LARGE CASES

### `REF-the-d-numbers-what-each-one-means-and-which-are-only` — 5,548 tokens, a fifth of the tier

**The pin is right and should stay.** It is the owner's ruling *("save D
persistent")*, it is the only place a D number survives a compaction, and it
earns that: the narrower question is the one worth asking, and the answer is
**part of it is a record, not a map**.

**It is also the one item in the set that is not a governing type.** `reference`
is not in `GOVERNING_TYPES`, so if it were unpinned the spare band **cannot take
it** — it would arrive as a title only at every session start, which is precisely
the state the pin exists to prevent. Unpinning it is measured at −7 titled and it
is still the wrong act.

**What it carries that is a record rather than a map**, quoted from the item so
the judgement is checkable:

- **Three successive answers to "what is done under D37", two of them explicitly
  superseded and all three still delivered.** The 2026-09-08 paragraph
  (*"seq:4, 5, 6, 9, 10, 11, 12 ... are open"*) is followed by the 2026-09-09
  paragraph that says it is *"now wrong in both directions"*, which is followed
  by `D37 CLOSED 2026-09-11 AT 54 OF 54`. The first is delivered at every session
  start with the authority of everything around it. **That is `CLAUDE.md`'s own
  opening defect, inside the file that warns about it** — and the item already
  removed one expired paragraph for exactly this reason on 2026-09-11, so the
  principle is its own.
- **D40's full measurement** — the `--pane-tint` values, `rgb(40,41,94)`, the
  `wellClip` trap, the 0.4-of-a-point direction — roughly 600 tokens of a design
  finding. The D row needs the subject and the pointer; the finding belongs in the
  dated report the row names.
- **The D37 widening history** — three widenings, the *"a D number names a
  SUBJECT"* precedent, *"WHAT IT COST AND WHAT IT BOUGHT"*. D37 is closed. This is
  history and history cannot go stale, which is exactly why it does not need to
  be in every window.
- **The reasons behind the post-D37 order** — about 350 tokens arguing D38, then
  D33, then D36. The order is the ruling; the argument is the record.
- **The README §12 flag-table note**, held pending a D that has since closed.
- **The D41/D42/D43 prose**, where each row already names the spec that carries it.

**Measured.** A trimmed body carrying the map, the obligation, every D row, the
ordering ruling and the "what is missing" caveat — the draft is in
`reports/2026-09-11-the-pinned-set-reviewed-drafts.md` — costs **1,286**
instead of 5,548. **`titled`
falls 75 → 70 and the band's admissions double, 5 → 10, while the D map goes on
arriving in full at every session start.** Better than unpinning it on every axis
except the raw count, and it keeps the thing the pin is for.

**The growth rate is the reason to do it now rather than once.** This item is the
only thing in the corpus with growth written into its own purpose — a row per
assignment, and a subject that may widen. A map grows by rows; a record grows by
paragraphs. Splitting them is what stops the second from paying for the first.

**Recommended, not done:** move the record to
`reports/2026-09-11-the-d-numbers-record.md` and have the item name it. The edit
is the owner's.

### `STD-v2-0-progress-report...` (2,296) and `STD-the-progress-table...` (1,500)

**The open question is already the item's own, and this is a measurement folded
into it, not a re-ask.** `STD-v2-0-progress-report-and-the-format-progress-reports-use`
ends: *"A QUESTION THIS ITEM OWES ITS OWN OWNER, put on 2026-09-11 and
unanswered: should this standard hold an instance at all? ... The recommendation
is to keep the rules here and let this item NAME the newest dated report rather
than quote one. That edit is the owner's to make or refuse."*

**What the measurement adds to that question: the instance costs 1,504 tokens,
which is 65% of the item.** The six rules that make a progress report honest cost
792. Trimming to the rules plus a pointer moves `titled` 70 → 69 on top of the D
map trim, and the standard goes on being delivered in full.

It also adds the second half of the argument the item makes for itself. The item
records that its previous instance *"said 96 tasks, 0 executed against a corpus
holding 716 tracked tasks of which 626 were done"* and stood for three weeks. A
trimmed item cannot repeat that, because there would be no number in it to go
stale — and the dated report it names goes stale **visibly**, in a file with a
date on it.

**`STD-the-progress-table-has-one-format-and-this-is-it` is the control case in
the same question and it is why the answer is yes.** It holds only its format,
names no numbers, and has never gone stale. It is recommended for **unpin**
rather than trim, and for a different reason: it is a *format consulted at a
moment* — the moment somebody draws a progress table — and it is `severity: hard`
1,500 tokens delivered into every window where nobody draws one. Its own opening
sentence is a disambiguation from the other standard, which is a cost only paid
by a reader who has both in front of them, every session, whether or not either
applies.

`RULE-progress-is-reported-as-two-tables-with-stable-d-numbers` (543) rides in the
same moment and is recommended with it. **One caveat, named rather than
discovered later:** the D map's first line cites this rule. Unpinned, it arrives
as an index line rather than in full — and the D map restates the stability rule
inline (*"a D number is STABLE FOREVER"*), so the citation does not go dark. Worth
checking against the trimmed body before both changes land together.

---

## WHAT I AM NOT CONFIDENT ABOUT — LEFT ALONE

- **`CONST-evidence-must-cite-a-captured-record-id` (62 tokens).** Its whole body
  is *"Every finding in **this campaign** cites an evidence id shaped
  `<surface>/<caseId>`."* It names no campaign, carries no tags, no scope and no
  `valid_from`, and I could not establish which campaign it means or whether that
  campaign is over. It may be superseded; it may be the oldest thing in the set
  and still binding. **At 62 tokens nothing turns on it**, and guessing at a
  verdict for a constraint is exactly the error this corpus keeps recording. The
  question to put to the owner is one line: *which campaign?*

- **The overlap in the UI and testing cluster, which I measured but did not
  judge.** Four items say overlapping things about testing the UI in a real
  browser — `RULE-drive-the-ui-through-playwright-while-doing-the-work-not`
  (1,021), `RULE-a-ui-change-is-not-done-until-a-browser-test-drives-it` (659),
  `RULE-playwright-is-how-the-ui-is-tested-and-it-is-the-most` (626),
  `RULE-ui-work-consults-every-installed-design-frontend-and-browser` (704) —
  **3,010 tokens**; and two say overlapping things about the mockup's authority —
  `INSTR-the-mockup-is-the-ui-specification...` (1,048) and
  `RULE-take-the-mockup-s-design-never-its-behaviour...` (572) — **1,620
  tokens**. Each names a distinction from the others in its own body, so the
  overlap is deliberate and documented, not accidental. **By the dominance rule
  above, consolidating them would be worth more than unpinning them and would
  lose nothing** — but a merge is a supersession, it is six owner rulings, and
  judging whether the distinctions still earn their separation is not a
  measurement. It is named here as an option and nothing more.

- **Whether `governingSpill.titled` is the right thing to minimise at all.**
  `plan:budget seq:16` names it as the measurement of whether the band worked, so
  this review used it. But every one of the 75 is **named** in the session, and an
  agent that needs one fetches it by id. A review optimising a disclosure count
  could, taken far enough, trade real pins for a smaller number. That is why the
  recommended set is three unpins rather than ten, and why the two trims — which
  cost no delivery at all — rank above them.

- **One thing this review could not measure.** `budget/15` is open precisely
  because reading an item is not audited, so nothing here distinguishes an item
  that was *delivered* from one that was *read*. Every verdict above rests on what
  an item says and what still constrains it, never on evidence that anybody acted
  on it.

---

## WHAT THIS LEAVES THE OWNER

`reports/2026-09-11-pinned-spare-band-remeasured.md` named three levers and made
no recommendation. This review adds a fourth and recommends it.

1. **Raise `budgets.pinned`.** Still his file, still untouched here.
2. **Unpin something.** Measured, ranked, and small: three items, 3,239 tokens,
   and worth nothing on its own.
3. **Accept the titled count.** Still honest; they are named, not dropped.
4. **Make two pinned items shorter.** 5,766 tokens, `titled` 75 → 69, **no pin
   removed and nothing stops being delivered.** It is the only lever on this list
   that costs nothing at all, and it is available because two pinned items are
   carrying records that a dated report could carry instead.

---

**Both trimmed bodies are written out in full, as drafts, in
`reports/2026-09-11-the-pinned-set-reviewed-drafts.md`.** They are what the
figures above were measured against. Neither has been applied.

---

*Method: `select()` at `event: 'session-start'` over `loadLayer`'s output, with
`always` flags and bodies altered in an in-memory copy. Nothing under
`.my_context/` was written. `.my_context/config.json` was read and not changed.*
