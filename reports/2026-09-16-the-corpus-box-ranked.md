# THE CORPUS BOX, RANKED

`TASK-the-corpus-box-refuses-to-rank-so-it-returns-the-right-item` (`semantic/7`, lane AL),
2026-09-16. The owner ruled it in the same day, reading `semantic/1`'s measurement.

Every number below is `node scripts/measure-corpus-rank.ts`, which reads the corpus read-only,
masks it in memory and writes nothing. It imports `searchItems` from `src/core/rank.ts` and
scores **the code that ships** — it is not a second implementation beside the one that runs.
Re-run it; nothing here is typed by hand.

---

## THE ANSWER IN ONE PARAGRAPH

`filterItems` refused to rank in its own docblock, on an argument it never measured: *"there is no
signal in a corpus this size to support one."* The signal was there. What was missing was that
`--text` is ONE contiguous substring over FOUR fields, so two words the item holds but does not
adjoin return nothing at all — and nothing that did come back had an order over it. The repair is
two changes, not one, and the measurement separates them: **the union** (score the query as
independent words) turns `anywhere 0/44` into `44/44`, and **the order** (BM25 over seven fields,
weighted) turns that pile into an answer at `@1 26/44`. **The score the case was made on — 15 at
rank one — was NOT beaten: the shipped ranker sits at 14, and a bootstrap over the 44 queries puts
the 95% band at [8, 20], so 14, 15 and 18 are the same number.** What IS beaten, outside the band,
is recall and the unpruned query, and those are reported as the result instead.

---

# 1. WHAT IT RANKS ON, AND WHY

`FIELD_WEIGHTS` (`src/core/rank.ts`) is the whole claim. A corpus item is not a passage; a match in
a title is evidence about what the item **is**, and the same word in a body is evidence that the
item **mentions** something.

| field | weight | why |
|---|---|---|
| `title` | 3 | the item's name. A word here says the item is ABOUT it. |
| `summary` | 3 | **equal to the title, deliberately.** A summary is written to `STD-a-summary-is-one-plain-sentence-for-someone-who-does-not`, which FORBIDS project vocabulary — so it is the one field written in the words a reader would actually type rather than the words an agent settled on. Ranking it below the title would penalise the only field on the reader's side of the vocabulary gap. |
| `tags` | 2 | curated, few per item, so a hit is strong — but a label is not a claim. |
| `id` | 2, de-slugged | an id is a slug OF the title, i.e. the title in a second spelling. Below the title *because* it is a duplicate; equal weights would quietly make a title worth 5. |
| `body`, `observations`, `extra` | 1 | the baseline, and what `searchableText` already read. |

**`request` is NOT ranked and that is the one thing left for the owner.** It holds his verbatim
words, which makes it the most valuable field in the corpus for exactly this problem. Two reasons
it is out: his ruling on that field ("documentation only and should not be injected to the
context") is about INJECTION and has never been asked about SEARCH, so it is his to answer; and the
ground truth this whole build is scored against IS the `request` field, so indexing it would score
the fixture instead of the mechanism. `steps` is out for the narrower reason that the measurement
never covered it.

**The order of operations is the load-bearing part.** `searchItems` does scope → match → order:

1. **SCOPE** — every structured filter (`type`, `status`, `tag`, `path`, `relation`, `linked-to`)
   goes through `filterItems`, the one predicate, with `text` withheld.
2. **MATCH, inside the scope** — an item matches if it contains the query as one contiguous
   substring (`filterItems` again, the SHIPPED predicate, unchanged) **or** shares at least one
   content word with it.
3. **ORDER** — BM25 over the seven fields, descending, ties by id ascending.

**A bound is not a scope, and there is no bound in the ranker.** The caller slices and the caller
says by how much. `nothing-to-do-and-could-not-look-are-different-answers` (rule store) is written
about ranking applied before a scope, and this function is shaped so it cannot be built that way by
accident: the index is constructed FROM the scope, so there is nothing to rank until the scope
exists. §8's removal proof P5 shows what it costs when that is inverted.

---

# 2. BEFORE AND AFTER, AGAINST THE 42 (44 TODAY)

SET R is `semantic/1`'s and is not re-derived: every item carrying the owner's verbatim `request`,
paired with the item that request produced. It was 42 when the case was made; **the corpus has
grown and it is 44 today**, and this project tests against the current corpus. Every 8-word window
of a request is deleted from the item it points at before scoring.

**One correction to the baseline, made here and named.** `measure-search-floor.ts` scores its `R0`
rung against the UNMASKED corpus while every ranked rung is masked. That flatters the baseline: its
`3/44` on the whole request is three items found by their own copy of the question. Both rows are
printed.

## 2a. The whole request as the query

```
BEFORE filterItems, masked corpus                @1  0   @5  0   @10  0   anywhere  0/44   MRR 0.000
BEFORE filterItems, UNMASKED (the floor script's own R0)
                                                 @1  3   @5  3   @10  3   anywhere  3/44   MRR 0.068
AFTER  searchItems, ranked                       @1 26   @5 38   @10 40   anywhere 44/44   MRR 0.712
       UNMASKED control (the leak, for scale)    @1 40   @5 43   @10 43   anywhere 44/44   MRR 0.941
```

**0 → 26 at rank one, and 0 → 44 of 44 returned at all.** The masked ranked run reproduces the
floor script's hand-written `R3` (`@1 26`, `@5 38`, `@10 40`) exactly, by a different
implementation over a different field-combination rule — two independent codepaths landing on the
same number, which is the strongest form this evidence takes.

## 2b. The five most distinctive words — the protocol the case was made on

This is the simulated reader: the request pruned to its five rarest content words. **The floor
script uses TWO spellings of this protocol without naming the difference, which is why its `R2` and
`R3` rungs are not comparable to each other** — `R1`/`R2` dedupe query words by surface form,
`R3` dedupes by conflation key, and **the number 15 comes from the `R3` spelling**. Both are run.

```
                                                 dedup by SURFACE form (R1/R2's protocol)
BEFORE filterItems: those 5 as one substring     @1  0   @5  0   @10  0   anywhere  0/44   MRR 0.000
AFTER  searchItems, ranked                       @1 14   @5 27   @10 29   anywhere 40/44   MRR 0.444
   (the floor script's best rung at this protocol: R2, @1 11, @5 25, anywhere 38, MRR 0.383)

                                                 dedup by CONFLATION KEY (R3's protocol — the 15)
BEFORE filterItems: those 5 as one substring     @1  0   @5  0   @10  0   anywhere  0/44   MRR 0.000
AFTER  searchItems, ranked                       @1 14   @5 29   @10 30   anywhere 39/44   MRR 0.452
   (the floor script's R3: @1 15, @5 24, @10 28, anywhere 36, MRR 0.441)
```

## 2c. THE HONEST READING, WITH THE NOISE BAND

```
2,000 bootstrap resamples of the 44 queries, pruned-to-5, shipped ranker:
  @1   2.5%  8    median 14    97.5% 20
  @5   2.5% 20    median 27    97.5% 33
whole request:
  @1   2.5% 19    median 26    97.5% 33
```

**Forty-four queries cannot separate 14 from 15, and cannot separate either from 18.** The 95% band
on `@1` is eleven items wide. So:

- **THE SCORE WAS NOT BEATEN AND I AM NOT CLAIMING IT.** 14 against 15 is the same number.
  Anything I could have done to push `@1` to 16 or 18 on this set would have been tuning to a
  statistic the set cannot resolve, and §4 below is the record of trying three such knobs and
  refusing all three.
- **WHAT IS BEATEN, OUTSIDE THE BAND, IS RECALL.** `anywhere` goes 0/44 → **40/44** on the pruned
  query and **44/44** on the whole one. The floor script's best rung at any protocol was 38, and
  its `R3` — the rung the 15 comes from — reaches only 36. Recall is a more stable statistic than
  `@1` and it moves in the right direction at every protocol.
- **AND `@5` AND `@10` MOVE TOO**: 25→27 and 28→29 at the surface protocol, 24→29 and 28→30 at the
  key protocol.
- **AND THE WHOLE-REQUEST NUMBER IS THE ONE A READER ACTUALLY GETS**: `@1 26/44`, MRR 0.712,
  against 0.000. Nobody types five rare words; §3 explains why the pruned protocol is harsher than
  reality and in which direction.

---

# 3. WHICH HALF EARNED IT — one scorer, different field sets

Every row is `buildIndex` + `scoreAll` from `src/core/rank.ts` through the `fieldsOf` hook. The
BM25 under all of them is one implementation; only the fields differ.

```
                                             pruned to 5                        whole request
shipped — all seven fields         @1 14  @5 27  any 40  MRR 0.444    @1 26  @5 38  any 44  MRR 0.712
FLAT — every field worth 1         @1 14  @5 24  any 40  MRR 0.430    @1 25  @5 36  any 44  MRR 0.694
REVERSED — body 3, title 1         @1 12  @5 25  any 40  MRR 0.412    @1 24  @5 37  any 44  MRR 0.681
minus summary                      @1 14  @5 26  any 39  MRR 0.436    @1 25  @5 37  any 44  MRR 0.694
minus tags                         @1 14  @5 27  any 40  MRR 0.438    @1 25  @5 38  any 44  MRR 0.704
minus id                           @1 14  @5 26  any 40  MRR 0.442    @1 25  @5 38  any 44  MRR 0.700
minus body                         @1 10  @5 18  any 26  MRR 0.302    @1 17  @5 27  any 44  MRR 0.494
SHIPPED FIELDS ONLY (what --text could read)
                                   @1 14  @5 25  any 39  MRR 0.424    @1 24  @5 37  any 44  MRR 0.678
```

**FOUR READINGS:**

- **THE UNION IS THE WHOLE STORY, AND WEIGHTING IS ALMOST NONE OF IT.** "SHIPPED FIELDS ONLY" —
  the four fields `--text` could already read, scored as independent words — is `@1 24` on the
  whole request. All the extra coverage together buys +2, and the weighting buys +1 to +2 over
  flat. `reports/2026-09-16-the-search-grammar.md` §4 said the same from the FTS5 side (`F2n → F2
  is COVERAGE, not weighting`) and this reproduces it from the other.
- **REVERSING THE WEIGHTS COSTS MORE THAN FLATTENING THEM.** Flat is −1 MRR point on the whole
  request; reversed is −3. So the direction of the weighting is doing real work even where its
  magnitude is not, which is why it is held by a test rather than left to the aggregate.
- **`body` IS LOAD-BEARING AND NOTHING ELSE IS.** Dropping it costs `anywhere` 40 → 26. Dropping
  summary, tags or id costs at most one item each. A title-and-summary-only ranker — the shape
  somebody will propose as "cheaper" — loses a third of the recall.
- **AND ANY ONE FIELD REMOVED IS INSIDE THE NOISE.** The honest way to read the middle rows is
  "these fields cost nothing to include and each occasionally rescues an item", not "summary is
  worth exactly one".

---

# 4. THREE REFINEMENTS PROPOSED, MEASURED AND REFUSED

Each was proposed on an argument that reads well. Each is refused on a number. None ships.

```
shipped: max over forms, b=0.75, no coord        @1 14   @5 27   @10 29   any 40/44   MRR 0.444
+ coordination bonus ^0.25                       @1 13   @5 28   @10 30   any 40/44   MRR 0.433
+ coordination bonus ^0.50                       @1 12   @5 29   @10 30   any 40/44   MRR 0.425
+ coordination bonus ^1.00                       @1 12   @5 29   @10 30   any 40/44   MRR 0.422
length norm b=0.30                               @1 11   @5 29   @10 30   any 40/44   MRR 0.417
length norm b=0.90                               @1 13   @5 26   @10 29   any 40/44   MRR 0.427
SUM over forms instead of MAX                    @1 14   @5 23   @10 29   any 40/44   MRR 0.425
```

- **A COORDINATION BONUS** — "an item answering four of your five words should beat one answering
  two, even if the two are rarer." It is Lucene's `coord`, it is the most natural thing to reach
  for, and **every strength of it loses MRR**. It trades `@1` for `@5` monotonically. Refused.
- **TUNING THE LENGTH NORMALISATION `b`.** Corpus items vary from a one-line invariant to a
  6,000-character task, so `b` looks like the obvious knob. Both directions are worse than 0.75.
  Refused, and 0.75 stays because it is the textbook default and nothing measured beats it.
- **SUM OVER SURFACE FORMS INSTEAD OF MAX** — an exact-form bonus: a document spelling the word
  exactly as you typed it scores its surface form AND its conflation key. It costs `@5` four items.
  Refused. `max` stays: **a word scores once, at the best evidence any of its forms can show.**

**Under the key-dedup protocol, `SUM` reaches `@1 18` and would have let this report claim it beat
15.** It is not shipped, and this paragraph is why: it is worse on the other three metrics and on
the other protocol, the difference is inside the bootstrap band, and a number bought by picking the
variant that happened to win on one statistic is a number nobody can explain. That is the trade the
item's own brief refuses — *a miss you can explain is worth more than a score you cannot.*

---

# 5. WHAT IT STILL MISSES, AND WHY

Thirty of 44 are not at rank one under the pruned protocol. They fall into four groups, and the
first group is about the BENCHMARK rather than the ranker.

**GROUP 1 — the protocol selects the owner's typos, because a misspelling is by construction the
rarest token in the corpus.** Of the 30 misses, ten are asked with a query containing at least one
of `currentlly`, `completelly`, `somthing`, `triggerd`, `occures`, `disapear`, `opend`, `reaserch`,
`helpfull`, `realy`. "Five most distinctive words by idf" is a rule that reaches for
exactly these. When the typo survived the mask inside the target item it nails rank 1; when it
survived inside a DIFFERENT item — a report quoting him, an item that carried his phrasing forward
— that other item wins and the target lands at rank 2 or 3. Six of the 30 are at rank 2 and two at
rank 3, and this is most of them:

```
rank 2  [currentlly designs functionality chances identify]  -> DEC-the-mockup-is-a-reference-to-initial-thoughts-and-only-a
rank 2  [completelly expansive users development semantic]   -> RULE-search-may-rank-its-results-and-the-model-it-asks-is-the
rank 3  [disapear somthing represent refreshed repairs]      -> RULE-a-screen-shows-the-new-state-after-the-reader-acts-on-it
rank 3  [triggerd till currentlly occupy percentage]         -> TASK-the-handover-is-asked-for-again-at-every-percent-not-written
```

A real reader does not type five rare words, which is `reports/2026-09-16-the-search-grammar.md`
§4's `F5` finding from the other side (*"more query terms helps under bm25, which argues against
pruning a query down to its distinctive words before searching"*). The whole-request row, `@1
26/44`, is the number that describes what a reader gets.

**GROUP 2 — ONE REQUEST, TWO ITEMS. This is a ground-truth defect, not a search defect.** Two
queries appear TWICE in the miss list with different targets, because one request of his produced
two items:

```
rank 2   [currentlly designs functionality chances identify]  -> DEC-the-mockup-is-a-reference-to-...
rank 4   [currentlly designs functionality chances identify]  -> TASK-the-mockup-stops-being-a-1-1-target-...
rank 17  [clicked transcription expanded linked searched]     -> TASK-a-lane-is-named-by-what-it-did-...
rank 113 [clicked transcription expanded linked searched]     -> TASK-a-lane-opens-inside-the-whole-app-...
NOT RETURNED [intermediary describestreamevent immediacy suspicious aggressive]
                                                              -> TASK-a-tool-call-keeps-160-characters-...
NOT RETURNED [intermediary describestreamevent immediacy suspicious aggressive]
                                                              -> TASK-the-stream-s-fault-has-a-fix-but-not-yet-a-demonstrated
```

`@1` can be 1 for at most one of each pair, **so the metric's ceiling on this set is 41, not 44.**
Nobody has said that out loud before and it is worth knowing before anyone chases the last three.

**GROUP 3 — THE FOUR NOT RETURNED AT ALL, which is the only real recall failure and it has one
cause.** After masking, the target item shares NO content word with the five it was asked with.
`NOTE-twenty-seven-task-states-were-written-straight-into-the` asked with
`[managed generates maybe generation reliable]`; `OPENQ-should-the-credential-survive-a-reload`
asked with `[internet happy realy reliable maybe]`. These are the queries where the owner described
a FEELING about the work and the item recorded the MECHANISM — no lexical bridge exists, and this
is the residue `semantic/1` already measured as the alias table's actual job (58 words of it) and
as what a model would be needed for. Nothing here reaches them and nothing lexical will.

**GROUP 4 — the long tail, six items past rank 20, up to rank 174.** `[repos userc continue users
trusted]` (rank 88) and `[batches hope harm anymore bit]` (rank 26) are the shape: the pruned query
is five words with no topic in them. They are the same failure as group 1 read at a longer
distance.

---

# 6. THE PRICE OF THE UNION, AND WHY THE COUNTS TRAVEL

```
matched-set size over 44 pruned queries: min 1   median 210   max 923   (corpus 1295)
of those, matched as ONE contiguous substring — the whole of what shipped:  0
```

**A five-word OR over 1,295 items matches 210 of them at the median and 923 at the worst.** That is
what buys the recall and it is not free. `INV-nothing-is-dropped-silently` is why none of it is
hidden and all of it is counted: `searchItems` returns the COMPLETE set, the caller bounds it, and
every surface now prints both halves of the claim.

```
$ mycontext search --text "refuses to rank" --limit 6
┌───────────────────────────────────────────────────────────────────┬───────────────┬────────────┐
│ TASK-the-corpus-box-refuses-to-rank-so-it-returns-the-right-item  │ task          │ active     │
│ LESSON-counting-the-word-refusal-counted-the-wrong-thing          │ lesson        │ active     │
│ OPENQ-may-search-rank-its-results-and-is-a-model-worth-a-runtime  │ open_question │ superseded │
│ TASK-five-perf-files-index-the-percentile-one-rank-high-and-their │ task          │ active     │
│ RULE-search-may-rank-its-results-and-semantic-search-is-not       │ rule          │ active     │
│ TASK-ship-the-search-the-research-recommended-three-readings-of   │ task          │ active     │
└───────────────────────────────────────────────────────────────────┴───────────────┴────────────┘

Ordered by relevance, most relevant first. 3 contain(s) that text as one phrase; 346 more share at
least one of its words. Searched 1295 item(s).

349 item(s) match; 6 shown. Raise the cap with --limit 349, or narrow the search.
```

Three sentences, three different facts: **the order**, **which half of the match each row rests
on**, and **the bound**. `GET /api/search` carries the same as `ranked`, `exact`, `widened`,
`searched` beside the existing `total`/`truncated`, and `query_items` appends the same sentence.
**`ranked` is `false` when no `text` was given** — a structured-only filter returns items in
`ORDER BY id` and calling that "most relevant first" would be a lie a client could act on.

---

# 7. COST

```
searchItems, 6-word query, 1295 items               22.5 ms   (warm)
filterItems, same query, same corpus                 5.2 ms
searchItems, scoped to --type task first            14.1 ms
FTS5 building the same corpus into a throwaway index  535 ms   (the grammar report §4)
```

**It was 250 ms before the memo and that is worth recording, because tokenising IS the cost.**
Scoring is one millisecond of it; turning 2.9 MB of body text into terms is the rest. `TOKENS` is a
`WeakMap` keyed on the **Item object**, not a cache with a lifetime: an `Item` is immutable once
loaded and a changed item is a different object, so there is no invalidation rule to get wrong and
no way to serve a stale answer. A reloaded corpus simply misses and does not leak the old one.

---

# 8. EVERY REMOVAL PROOF, AND WHAT EACH ONE REDDENED

Eleven proofs. Each was RUN — the named line deleted or inverted in `src/core/rank.ts`,
`test/core/corpus-rank.test.ts` re-run, the source restored. **Ten reddened at their own line. One
reddened nothing, and that is the most useful row in the table.**

| # | what was removed or inverted | what reddened |
|---|---|---|
| P1 | the exact-substring clause — **the floor** | `the floor does not move: every substring match is still returned`, `the floor does not move on this project's own corpus`, `NOTHING IS DROPPED` |
| P2 | `title` weight 3 → 1 | both `WEIGHTING:` tests |
| P3 | weights REVERSED (title/summary 1, body 3) | both `WEIGHTING:` tests |
| P4 | `summary`, `tags`, `id` dropped from `rankFields` | `WEIGHTING: a summary match…`, `COVERAGE: summary, tags and id are searchable` |
| P5 | **rank BEFORE the scope** — the bound-before-scope defect, rebuilt | `SCOPE BEFORE RANK: a filtered-out item does not appear`, `an unranked answer says it is unranked` |
| P6 | a bound (50) put INSIDE the ranker | `the floor does not move on this project's own corpus`, `NOTHING IS DROPPED` |
| P7 | the id tie-break dropped | `ties break by id, so the answer is deterministic` |
| P8 | the conflation key no longer indexed | `the conflation group joins phase and phases in both directions` |
| P9 | **the tokenising memo deleted** | **NOTHING. `fail 0`.** |
| P10 | `ranked: true` reported unconditionally | `an unranked answer says it is unranked` |
| P11 | the surface form dropped from the query group | `the conflation group joins phase and phases in both directions` |

**P9 IS THE FINDING.** Deleting the memo reddens no test at all, and it should not: it is a cost
change, the object-keyed correctness property is tested (`the tokenising memo is keyed on the
object`) but its EXISTENCE is not, and the only evidence it is there is §7's 250 ms → 22.5 ms. So
**a future edit that deletes the memo for looking redundant will pass `npm test` and make every
search eleven times slower in silence.** Recorded here rather than papered over with a timing
assertion, because a wall-clock assertion on a contended machine is a flaky test and this project
has three lanes' worth of evidence that contended timings are worth less than an honest note.

**Two fixture-power checks were built in deliberately**, after today's two failures of exactly that
kind (lane AF's rebuilt bm25 fixture, and a proof of mine that reddened nothing):

- The two WEIGHTING fixtures are built to the **same token count**, differing only in WHICH field
  holds the word, so BM25's length normalisation cannot be what decides them. Without that, a
  short title-only document wins on length alone and the test passes for a reason it does not
  state.
- `the floor does not move on this project's own corpus` asserts `compared >= 7` of its 9 queries
  actually matched something. If the corpus ever stops containing those words the comparison
  becomes vacuous, and a vacuous green would be indistinguishable from a passing one.

---

# 9. THE UI, DRIVEN IN BOTH LANGUAGES

My own server on port **58901**, `--no-open`, killed at the end and verified down; **58888, the
owner's, was never touched and was verified still LISTENING on pid 38960 afterwards.**

**`GET /api/search`, from inside the page** — the two shapes, both confirmed:

```
text="refuses to rank"   total 349  truncated true  ranked true  exact 3  widened 346  searched 1295
                         items[0] = TASK-the-corpus-box-refuses-to-rank-so-it-returns-the-right-item
type=task (no text)      total 918  ranked false    exact 0      widened 0    searched 918
                         items[0] = TASK-2052-controls-compute-three-accessible-names-between-them  (ORDER BY id)
```

**The Composer, `search`, Execute → Run it, ENGLISH** (`reports/2026-09-16-the-corpus-box-ranked/composer-en.png`):
the command composed to `mycontext search --text "refuses to rank" --limit 6`, exit 0, the target
item at row one, and both new sentences printed under the table.

**The Composer, `search`, Execute → Run it, HEBREW** (`…/composer-he.png`): `dir="rtl"`,
`lang="he"`, the chrome translated (`מרכיב פקודות`, `הרצה`, `להריץ`, `מה הורץ`, `קוד יציאה 0`,
`מה הפקודה אמרה`), the same command, the same exit 0, the same ranked table with the target at row
one.

**A HEBREW QUERY, through the page**: `text="הזרקה של פריטים"` returns 1 item, `ranked true`,
`exact 0`, `widened 1` — the union reaching an item the substring predicate could not. Folding is
Unicode-aware (`\p{L}`) so Hebrew survives tokenising unchanged, and `conflate`'s ASCII guard means
no Hebrew word is ever rewritten. The front-particle problem `semantic/1` measured is NOT solved
here and was not in scope; `hebrewVariants` is wired into `queryGroups` so a query beginning with a
particle also tries the bare word, and that is a reach improvement, not the repair.

**Console: two errors, both mine and neither from the app** — a `favicon.ico` 404, and a 403 from
my own `curl`-shaped probe before I switched to driving the page.

**ONE THING THE READER DOES NOT GET IN HEBREW, stated plainly rather than glossed:** the two new
sentences are printed by the **CLI**, and the CLI is English on every surface. Execute shows the
CLI's own ASCII output by design (`DEC-run-is-removed-execute-is-the-only-way-to-run-what-the`), so
a Hebrew reader sees translated chrome around an English answer. That is pre-existing behaviour for
every command, not something this change introduced — but this change is the first time the
Composer's output carries a *sentence worth reading* rather than a table of ids, so it is the first
time it matters. **No screen renders `/api/search`**, which is where a translated ranked box would
live. Named in §11 as the owner's call.

---

# 10. WHAT WAS TOUCHED

**NEW**
- `src/core/rank.ts` — the ranker. `fold`, `words`, `content`, `conflate`, `hebrewVariants`,
  `HEBREW`, `HEBREW_PARTICLES`, `FIELD_WEIGHTS`, `rankFields`, `buildIndex`, `queryGroups`,
  `scoreAll`, `searchItems`. Writes nothing, so it is not a `WRITERS` entry;
  `test/ui/no-writes.test.ts` green.
- `scripts/measure-corpus-rank.ts` — this report's numbers. Read-only.
- `test/core/corpus-rank.test.ts` — 17 tests, one `@basis` line, every assertion with its proof.
- `reports/2026-09-16-the-corpus-box-ranked.md` and `…/composer-en.png`, `…/composer-he.png`.

**CHANGED**
- `src/core/search.ts` — **the refusal in the docblock is corrected in place**, which is the point
  of the item. `filterItems` itself is byte-for-byte unchanged.
- `src/cli/commands/search.ts` — calls `searchItems`; prints the order sentence; `ranked`, `exact`,
  `widened`, `searched` added to `--json`; `USAGE` corrected.
- `src/ui/read-model-work.ts` — `apiSearch` calls `searchItems`; four fields added to the body.
- `src/mcp/tools.ts` — `query_items` calls `searchItems` and appends the order sentence.
- `scripts/measure-search-floor.ts` — its `conflate`, stop list and folding MOVED into
  `src/core/rank.ts` and are imported back. **The proof that the move changed nothing is the
  script's own output, captured before and diffed after: every scored row identical, the only
  differences the two nondeterministic cosine-benchmark timings.** A test
  (`the floor measurement imports its key from the shipped module`) keeps it from growing a second
  copy.
- `test/core/search-floor.test.ts` — header only, pointing four now-closed findings at their
  closures. Every assertion in it is unchanged and still true of `filterItems`.

**Gates**: `npm test` 8,801 tests, **fail 0**. `tsc --noEmit` clean. `check:basis`,
`check:text-files`, `check:test-glob`, `check:cited-items`, `check:dependencies` all pass — the one
spent line `check:basis` reports in `basis-undeclared.txt` is pre-existing and that file is
unmodified.

**A RED THAT TURNED OUT TO BE A REAL FINDING ABOUT THE SUITE, AND IS NOT MINE.** On the first
full-suite run, `test/cli/rules.test.ts` reddened twice on a checksum mismatch for
`numbered-options-on-a-question-put-to-the-owner`. Re-run alone: 15/15 green. Re-run in the full
suite: green. So it looked transient — and then `git status` showed why it was not:

```
 M src/rules/entries/manifest.json
 M src/rules/entries/numbered-options-on-a-question-put-to-the-owner.md

+++ numbered-options-on-a-question-put-to-the-owner.md
+
+planted by test/cli/rules.test.ts
```

**`test/cli/rules.test.ts` writes into the SHIPPED rule store — `src/rules/entries/`, the real
directory, not a temp copy — and on that run it did not clean up.** The line it plants stayed on
disk, the manifest was re-stamped around it, and every subsequent run of that file was measuring a
store the previous run had edited. `mycontext rules verify` reported the store damaged.

Nothing in this change touches `src/rules/`. I restored both files from `HEAD` by reading them with
`git show` and writing them back — no git command that writes — and `mycontext rules verify` now
says *"the rule store is intact — every entry matches the checksum that shipped with it."*
`git status` carries only the twelve paths in this section.

**This is worth an item and I have not filed one, because filing is not this lane's call:** a test
that mutates the installed package under `src/` can leave the working tree dirty, can make the next
run of itself measure its own leftovers, and — since the store is checksum-gated — can make
`rules verify` refuse writes to it for reasons nobody caused. Named here so the next person to see
that red does not spend the twenty minutes I did.

---

# 11. FOR THE OWNER

1. **MAY SEARCH READ THE `request` FIELD?** Your ruling on it — *"documentation only and should not
   be injected to the context"* — is about INJECTION. Whether SEARCH may read it has never been
   asked, and it is 28,610 characters of your own verbatim words on 44 items: the single field most
   likely to hold the word you would type. It cannot be measured on SET R (the queries ARE that
   field), so this needs your ruling rather than a number. If you say yes it is one line in
   `rankFields`.
2. **NO SCREEN RENDERS `/api/search`.** The corpus box in the UI today is the Composer running the
   real CLI, so a Hebrew reader gets translated chrome around an English answer (§9). A ranked
   corpus box as a proper screen — translated, with the three counts drawn rather than printed —
   is a build, not a fix, and it is yours to want.
3. **THE ACCEPTANCE SET'S CEILING IS 41, NOT 44** (§5, group 2), and its 95% band on `@1` is eleven
   items wide (§2c). If ranking is worked on again, the next honest step is a bigger ground-truth
   set rather than a better scorer — every knob in §4 is inside the noise of this one.
4. **FOUR QUERIES ARE NOT REACHED BY ANYTHING LEXICAL** (§5, group 3). That is the residue
   `semantic/1` sized at 58 words and is the same question `semantic/6` is open on.
