# The spare band still works. The room it was built to spend is gone.

Measured 2026-09-11, on this repository's own corpus, with the product's own
instrument — `select()` at `event: 'session-start'`, and the
`governingSpill.titled` disclosure that `plan:budget seq:16` names as the
measurement of whether it worked.

## What was built, and it is running

`TASK-the-pinned-tier-sits-half-empty-while-sixty-nine-governing`
(`plan:budget seq:16`, owner ruling 2026-09-04, *"yes 3 and 2"*) asked for an
admission change rather than a budget rise: governing items that are not
`always` may draw on pinned budget the `always` items have not used. That is
the SPARE BAND in `src/core/select.ts`, and it shipped 2026-09-07.

Its item is still `state: todo`. The work is in the tree, documented at the
site, and firing on every session start. **The item is bookkeeping behind the
code, not the other way round.**

## The two measurements side by side

The 2026-09-07 column is this project's own recorded figure, carried in the
comment at the implementation site. It is quoted, not re-derived here.

| | 2026-09-07 | 2026-09-11 | change |
|---|---:|---:|---:|
| items in corpus | 996 | 1,085 | +89 |
| `budgets.pinned` | 30,000 | 30,000 | unchanged |
| `always` items admitted | 37 | 39 | +2 |
| what they cost | 22,582 | 29,016 | **+6,434** |
| left for the spare band | 7,418 | 947 | **−6,471** |
| governing items the band admitted | 13 | 3 | −10 |
| `governingSpill.titled` | 69 | 79 | **+10** |
| `governingSpill.untitled` | 0 | 0 | unchanged |

`pinnedSpill` is `null`: every `always` item was delivered in full, so the
band's precondition still holds and `always` still has absolute precedence.
The mechanism is not broken. It has nothing left to spend.

Delivering all 79 titled governing items in full would cost 45,543 tokens.

## Where the 29,016 goes

Ten of the 39 pins are 54% of the tier.

| tokens | cumulative | item |
|---:|---:|---|
| 5,839 | 20% | `REF-the-d-numbers-what-each-one-means-and-which-are-only` |
| 2,071 | 27% | `STD-v2-0-progress-report-and-the-format-progress-reports-use` |
| 1,500 | 32% | `STD-the-progress-table-has-one-format-and-this-is-it` |
| 1,196 | 37% | `REQ-restore-the-graphical-views-the-design-sketches-already` |
| 1,048 | 40% | `INSTR-the-mockup-is-the-ui-specification-build-it-exactly-and-ask` |
| 1,021 | 44% | `RULE-drive-the-ui-through-playwright-while-doing-the-work-not` |
| 886 | 47% | `INSTR-read-the-relevant-mycontext-help-before-writing-any-command` |
| 845 | 50% | `CONST-zero-runtime-dependencies` |
| 704 | 52% | `RULE-ui-work-consults-every-installed-design-frontend-and-browser` |
| 673 | 54% | `RULE-parallel-agents-share-no-mutable-resource-enumerate-and` |

Median pin: 569 tokens. Cheapest: 62.

**The D map is the single largest line item in every session start**, at 5,839
tokens and a fifth of the tier. It is pinned by explicit owner ruling *("save D
persistent")* and it earns that pin — it is the only place a D number survives a
compaction, and this report was written from it. But it also grows every time a
number is assigned or a subject is widened, and D37 alone has been widened three
times. **Nothing else in the corpus has a growth rate written into its own
purpose.** That is a fact about the budget, not an argument for unpinning it.

## What this changes about the item's last instruction

`seq:16` ends by asking whether a gap remains once admission is fixed, and says
to pin what is still not reached — while also warning that if the admission
change landed, pinning *"is not merely unnecessary but harmful, since a pin is
permanent and would keep delivering after the tier already covers the item."*

Measured: **the gap remains and has widened**, from 69 titled to 79. And the
prescribed stopgap is now the mechanism causing it. Every item pinned takes
from the band, one for one — the band is defined as what `always` did not use.
Pinning more to fix a titled count would shrink the band that reduces it.

So the stopgap is not taken, and it is not taken on the item's own reasoning
rather than by declining the instruction.

## What is left, and it is the owner's

Three levers exist and all three are his, not a lane's:

1. **Raise `budgets.pinned`.** 45,543 would deliver every titled governing item
   in full. `.my_context/config.json` is his file.
2. **Unpin something.** 54% of the tier is ten items. Each is a ruling he made.
3. **Accept 79 titled.** They are NAMED rather than silently degraded — that
   disclosure shipped alongside `seq:16` — so nothing is lost silently, and an
   agent that needs one fetches it by id.

No recommendation is made here. The measurement is the deliverable.
