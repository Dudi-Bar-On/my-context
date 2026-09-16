Deep research for `TASK-the-conversation-search-takes-one-substring-and-nothing-else` (`semantic/2`, D77),
2026-09-16. The owner asked for the internet, named Notepad++, and asked whether an existing Node
package could carry it. This answers all three and then says which three things to ship.

Every number below is `node scripts/measure-search-grammar.ts`, which reads the archive index and the
corpus read-only, builds its own throwaway in-memory FTS5 tables, and writes nothing. Its findings
are pinned as assertions in `test/core/search-grammar.test.ts`. Every claim about an external tool
carries a link; a claim about Notepad++ with no link is worth nothing and there are none here.

## THE ANSWER IN ONE PARAGRAPH

The feature the owner is missing is not regular expressions and is not a checkbox. It is that his two
words are required to be **adjacent**, and nothing lets him say *near* instead. `NEAR` is already in
FTS5, already works under the trigram tokenizer the Hebrew measurement bought, costs 0.2 ms, and
under trigram it means something FTS5 does not document — **a distance in characters**. Measured over
1,420 two-word phrases he actually typed: as a phrase 31.7% of them return anything, median 3 spans;
as two AND-ed terms 100%, median 38; **as `NEAR(..., 30)` — "in the same sentence" — 99.6%, median 4.**
The whole of what he is asking for sits in that one row, and it needs no dialog, no dependency and no
ranker.

---

# 1. THE FEATURE LANDSCAPE, WITH LINKS

## Notepad++ — the reference he named

The Find dialog's options, from the manual
([npp-user-manual.org/docs/searching](https://npp-user-manual.org/docs/searching/)):

  — **Search Mode**, three mutually exclusive radios: *Normal* ("All text is treated literally"),
    *Extended* (`\n \r \t \0 \x…` escapes), *Regular expression*.
  — **Match whole word only**, **Match case**, **Wrap around**, **Backward direction**,
    **In selection**, **Transparency**, a 2-button mode.
  — Regex mode adds one more: **`.` matches newline** — "with this unchecked, the regular expression
    `.` matches any character except the line-ending characters … with this checked, `.` also matches
    the line-ending characters."
  — A separate **Mark** tab: **Mark All**, **Bookmark line** ("a bookmark is dropped on each line
    where an individual hit occurs"), **Purge for each search**.
  — **Find All in All Opened Documents** — "Lists all the search-results in a new **Search results**
    window."

**Which of those does a reader actually reach for, and which are there for history.** The manual
itself answers part of it, and its answer is a refusal: **"Regular expression 'backward' search is
disallowed due to sometimes surprising results"** — the example given is `t\w+` over *"to the test
they travelled"*, 5 matches forward and 17 backward. The reference tool for feature-richness deleted
one of its own combinations because the result was incomprehensible.

The rest divides cleanly. **Extended mode**, **Backward**, **Wrap around**, **Transparency** and
**2-button mode** are artefacts of a cursor-based editor: they exist because Find moves a caret
through a buffer one hit at a time. There is no caret here. **Mark All / Bookmark line / Find All in
All Opened Documents** are the same feature seen three ways — *show me every hit at once instead of
walking them* — and that is what this product's search screen already is. So the Notepad++ surface,
transposed honestly onto a search box over an archive, collapses to: **case**, **whole word**,
**regex**, and *a results list*, of which the results list already ships.

Notepad++'s regex is Boost v1.90 as of v8.9.1, "originally based on PCRE syntax"
([same manual](https://npp-user-manual.org/docs/searching/)).

## ripgrep — read for what it left out, which is the more valuable half

Andrew Gallant's refusals are documented and argued, and two of them apply directly.

**Look-around and backreferences: never.**
([FAQ](https://github.com/BurntSushi/ripgrep/blob/master/FAQ.md)) — *"ripgrep's default regex engine
does not support lookaround or backreferences. This is primarily because the default regex engine is
implemented using finite state machines in order to guarantee a linear worst case time complexity on
all inputs. Backreferences are not possible to implement in this paradigm."* Upstream he is flatter
([rust-lang/regex#910](https://github.com/rust-lang/regex/discussions/910)): *"To the degree I can be
certain about anything, I'd say no, general look-around will never be supported."* The demonstration
in [the blog post](https://burntsushi.net/ripgrep/) is a competitor dying on `(a*)*c`: *"PCRE2 match
error: match limit exceeded / Aborted (core dumped)."*

**Fuzzy search: closed in ten minutes.**
([#1053](https://github.com/BurntSushi/ripgrep/issues/1053)) — *"this is a rather large feature
request and unlikely to happen at all. At least, inside of ripgrep… Instead, I recommend that
someone come up with a vision for how it works and go build it."*

**Smart case — the most useful quotation in the whole survey**, because he shipped a feature he
dislikes and then had to specify it precisely. ([#717](https://github.com/BurntSushi/ripgrep/issues/717))
— *"Haha yeah I am not a fan of it, but recognize that others like it. It should definitely work
intuitively."* The settled rule, now the shipped man page: *"ripgrep chooses to match case
insensitively if and only if there is at least one literal character in the pattern and that all such
literals are not considered as uppercase."* The bug that forced the precision is instructive: `rg -S
'foo\w'` was matching `FOOBAR`, because `\w` expands to a class containing `A-Z`. A "smart" heuristic
over a pattern language needs a specification, and ripgrep needed two months and an issue thread to
write one.

**And the retrospective**, from the README's own *"Why shouldn't I use ripgrep?"*: *"Despite initially
not wanting to add every feature under the sun to ripgrep, over time, ripgrep has grown support for
most features found in other file searching tools."* He lost. Worth knowing before claiming a small
surface will stay small.

## VS Code — why three, and the eight-year proof that it is three

The editor Find widget has exactly **Match Case, Match Whole Word, Regular Expression**
([codebasics.md](https://github.com/microsoft/vscode-docs/blob/main/docs/editing/codebasics.md)).

The evidence that this is an equilibrium rather than an accident: `search.smartCase` exists, defaults
to `false`, and lives **only in the Search view, never in Find**
([search.common.contribution.ts](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/search/browser/search.common.contribution.ts)).
The issue asking for it in Find ([#55247](https://github.com/microsoft/vscode/issues/55247)) was
opened 2018-07-27 and **is still open** — with 30 upvotes, a written spec by VS Code's own search
owner, and a working implementation one layer away. The spec author asked himself the question in
[#41119](https://github.com/microsoft/vscode/issues/41119): *"Does this make sense for editor find or
just search?"* The answer has been *just search* for eight years.

VS Code also collects exactly the telemetry that would settle "which options do people tick" —
`isRegExp`, `isWordMatch`, `isMultiline`, `isCaseSensitive`, `isSmartCase`, each stamped
`"purpose": "FeatureInsight", "isMeasurement": true`
([search.ts](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/services/search/common/search.ts))
— and has never published it. **There is no public data on find-dialog option usage from anyone.**
Stated plainly rather than guessed at.

The nearest published thing is about query *operators*, and it is worth having.
[Sadowski, Stolee & Elbaum, ESEC/FSE 2015](https://research.google/pubs/pub43835/), 27 Google
developers, 3,870 queries: *"The average number of keywords per query was 1.85 (median of 1, maximum
of 11)"*; **26.5% used `file:`**, **5.4% used `lang:`**; average time between two queries in a
session 23 s, median 8 s. The
[2025 replication](https://dl.acm.org/doi/10.1145/3715774) over 30 months and 100,000 quarterly users
reports no operator rates at all. **Median one keyword.** Whatever is built here is used by somebody
typing one or two words and reformulating in eight seconds.

## Sublime Text

The URL in the brief 404s — **Sublime's official docs contain no search page at all**; the index
points at the community [docs.sublimetext.io](https://docs.sublimetext.io/guide/usage/search-and-replace.html),
which is where the option list lives (regex `Alt R`, case `Alt C`, exact match `Alt W`, find all
`Alt ⏎`; Boost PCRE). What is genuinely distinct, verified against the
[official changelog](https://www.sublimetext.com/download): a **Wrap** toggle, a **Highlight results**
toggle, `find_in_files_context_lines` (grep-style context in a GUI), and — the good one —
**`regex_auto_escape`**: *"Find: Patterns taken from an open file are now escaped for regex
searches."* That is a real answer to "the user does not know what mode they are in", and it is not a
checkbox.

## Mail clients and GitHub — where the default lives

**GitHub code search states the load-bearing fact twice**
([docs](https://docs.github.com/en/search-github/github-code-search/understanding-github-code-search-syntax)):
*"By default, adjacent terms separated by whitespace are equivalent to using the `AND` operator. For
example, the search query `sparse index` is the same as `sparse AND index`, meaning that the search
results will include all documents containing both the terms `sparse` and `index`, in any order."*
Quotes mean *"an exact string, including whitespace"*. Case is **insensitive with no toggle** — the
only escape is `(?-i)` inside a regex. Look-around is **not supported**, the same refusal as ripgrep,
for the same reason one layer down.

**notmuch** ([search-terms(7)](https://notmuchmail.org/manpages/notmuch-search-terms-7/)) — *"Each
term in the query will be implicitly connected by a logical AND if no explicit operator is provided
(except that terms with a common prefix will be implicitly combined with OR)."* It has proximity:
*"`notmuch search term1 NEAR term2` will return results where term1 is within 10 words of term2"*,
tunable as `NEAR/2`, and `ADJ` for the same in order. And a case heuristic that rhymes with
ripgrep's: *"a search for a capitalized word will be performed unstemmed, so that one can search for
'John' and not get results for 'Johnson'."*

**mu** ([mu-query(7)](https://raw.githubusercontent.com/djcb/mu/master/man/mu-query.7.org)) — same
implicit AND, plus the one UI idea in this whole survey I would steal outright: **`--analyze` prints
the parsed query back to you**, `(and (subject "hi") (_ "there"))` expanded into every field it will
actually touch. Rather than adding a toggle, make the parse visible.

**Gmail** ([operators](https://support.google.com/mail/answer/7190)) — `AROUND 10` is proximity in a
consumer mail box, `{ }` is OR shorthand, `-` is exclusion, `" "` is phrase. Gmail documents none of
its defaults: not multi-term combination, not case, not wildcards.

**GitHub's Blackbird post**
([github.blog](https://github.blog/engineering/architecture-optimization/the-technology-behind-githubs-new-code-search/))
is the one to read against this index, because it is the same tokenizer at 115 TB. On why code is not
prose: *"we want to search for punctuation…; we don't want stemming; we don't want stop words to be
stripped from queries."* On trigrams: *"bigrams aren't selective enough and quadgrams take up too
much space."* And the warning that applies here directly: *"For common grams like `for` trigrams
aren't selective enough. We get way too many false positives and that means slow queries. An example
of a false positive is something like finding a document that has each individual trigram, but not
next to each other."* GitHub solved it with "sparse grams". **This archive is 11,006 spans, not 15.5
billion documents, and the false positives cost 0.2 ms — so the problem GitHub had to invent an
algorithm for is a problem this index can simply pay.**

## Node packages — every one of them, and what the idea costs without it

`CONST-zero-runtime-dependencies` is hard and nothing below is recommended. What is worth having is
the size of each idea when written by hand.

| package | the parsing idea | its size | booleans | parens |
|---|---|---|---|---|
| [Fuse.js extended](https://raw.githubusercontent.com/krisk/Fuse/main/src/search/extended/parseQuery.ts) | split on `\|` into OR-groups, AND within | **118 lines** | OR only | no |
| [search-string](https://github.com/mixmaxhq/search-string) (Mixmax) | char state machine, `field:value`, `-neg` | **334 lines** | no | no |
| [search-query-parser](https://github.com/nepsilon/search-query-parser) | **one regex** plus bookkeeping | 423 lines, the regex is ~1 | no | no |
| [lunr.js](https://lunrjs.com/guides/searching.html) | hand-written lexer + state machine | **464 lines** | `+`/`-` only | no |
| [liqe](https://github.com/gajus/liqe) | a nearley grammar | 297-line grammar → **22 KB generated**, + nearley | yes | yes |
| [lucene-query-parser](https://unpkg.com/lucene-query-parser@1.2.0/) | a PEG grammar | 372-line grammar → **58 KB generated** | yes | yes |

**The finding:** nobody hand-wrote a parenthesised boolean parser. The moment parentheses are wanted,
every library reaches for a generator and pays 22–67 KB of table. That is not because it is hard —
precedence climbing is ~150 lines — it is because they all wanted full Lucene fidelity (ranges,
boosts, fuzzy, proximity, regex literals) and a grammar file buys all of it at once.

Three specific ideas worth taking, at their measured cost:

  — **Never throw.** Elasticsearch shipped `simple_query_string` for exactly this reason:
    [*"the `simple_query_string` query does not return errors for invalid syntax. Instead, it ignores
    any invalid parts of the query string."*](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-simple-query-string-query)
    Contrast lunr, which throws `QueryParseError` in twelve places including on a trailing colon —
    *"expecting term, found nothing"* — so a reader who has typed `title:` and not yet the term gets
    an exception. **~10 lines to get right, and it is the whole difference between a grammar that can
    live behind a keystroke and one that cannot.**
  — **An unpaired quote is a literal.** search-string's `getQuotePairMap` pre-scans the string,
    records which quote characters are actually *paired*, and the main loop only enters quote state
    at a paired index ([utils.ts](https://raw.githubusercontent.com/mixmaxhq/search-string/master/src/utils.ts)).
    **~30 lines**, and it is the answer to "he has typed one `"` and not the second yet".
  — **BM25 is three lines.** MiniSearch's `calcBM25Score` is `idf * (d + tf*(k+1) / (tf + k*(1-b+b*len/avg)))`
    with `{k:1.2, b:0.7, d:0.5}` ([MiniSearch.ts](https://raw.githubusercontent.com/lucaong/minisearch/master/src/MiniSearch.ts)),
    plus ~40 lines of bookkeeping. **And this index does not even need those three lines: `bm25()` is
    compiled into the SQLite Node already bundles, and `matchProse` already orders by it.**

And the honest negative on Hebrew: **there is no JS package that does this properly.** Orama ships
stemmers for 31 languages and [`he` is not among them](https://github.com/oramasearch/orama/tree/main/packages/stemmers/lib).
[HebMorph](https://github.com/synhershko/HebMorph) is the real work and it is Java/.NET only, built on
hspell's ~460k-word dictionary, and its method is *"for each valid Hebrew prefix, the prefix letters
are removed and the process is repeated"* — **the dictionary lookup is the load-bearing part**, because
stripping blindly destroys real words (`מים`, `הר`, `שם`). A dictionary-free heuristic can only ever
be *add a variant, never replace the original*, which is exactly what `hebrewVariants` already does.

---

# 2. WHAT FTS5 ACTUALLY SUPPORTS UNDER TRIGRAM — MEASURED, NOT ASSUMED

Run against the real archive index (SQLite 3.51.2, 11,006 prose spans, `tokenize='trigram'`),
read-only. `0` means *accepted and matched nothing*, which is the answer a reader cannot tell from
*not here*.

| operator | on the real index | verdict |
|---|---|---|
| `"byte offset"` — what ships | 98 | the contiguous substring, today's entire grammar |
| `"byte" "offset"` (juxtaposition) | 166 | **AND, and it works** |
| `"byte" AND "offset"` | 166 | same set |
| `"byte" OR "offset"` | 905 | **works** |
| `"byte" NOT "offset"` | 718 | **works** |
| `("byte" OR "offset") AND "trigram"` | 62 | **parentheses work** |
| `NEAR("byte" "offset", 30)` | 122 | **works — and see §2.1** |
| `NEAR("byte" "offset", 0)` | 0 | a window of zero admits nothing |
| `"byte"*` | 884 | |
| `"byte"` | 884 | **IDENTICAL — `*` is a NO-OP under trigram** |
| `by*` | 0 | shorter than a trigram: silent zero |
| `^"byte"` | 2 | works, means *"the span begins with"* — almost never wanted |
| `text : "byte offset"` | 98 | column filter works on the one indexed column |
| `kind : "prompt"` | 0 | **`kind` is UNINDEXED — accepted, always zero, silently** |
| `"ui"` | 0 | two characters: silent zero (today correctly reported) |
| `"ui" AND "search"` | 0 | **SILENT ZERO — while `"search"` alone returns 654** |
| `"BYTE OFFSET"` | 98 | trigram folds case by default |

**So the grammar is already there.** AND, OR, NOT, parentheses and NEAR all work; nothing needs to be
written to make them work; the only thing standing between a reader and all of it is that
`searchArchive` wraps the whole query in one pair of quotes.

Two things are NOT there, and both are traps rather than absences:

  — **Prefix matching is meaningless.** A trigram index already matches substrings — `"byte"` finds
    `bytes` and `abytec` — so a `*` checkbox would cost a control, a label, two translations and a
    test to deliver exactly nothing. Pinned as a test.
  — **A term shorter than three characters is a silent zero, and inside a boolean it takes the whole
    query down with it.** `MIN_QUERY_CHARS` guards the *whole* query today and is right for one
    substring. The moment a query is split, the guard is in the wrong place: `"ui" AND "search"` is a
    legal, four-character query with a real answer available, and it returns nothing and raises
    nothing. **21.0% of the 104,343 words he has typed are shorter than three characters.**

## 2.1 The operator nobody documented: NEAR is a distance in CHARACTERS

A trigram tokenizer emits one token per character position, so FTS5's *token* distance is a
*character* distance. Measured over 41 synthetic documents, `alpha` + N dots + `omega`:

```
NEAR N=  2  matches gaps 0..0        NEAR N= 20  matches gaps 0..18
NEAR N=  3  matches gaps 0..1        NEAR N= 30  matches gaps 0..28
NEAR N=  5  matches gaps 0..3        NEAR N= 40  matches gaps 0..38
NEAR N= 10  matches gaps 0..8        NEAR N= 50  matches gaps 0..40 (all)
```

**LAW: `NEAR(a b, N)` matches when at most `N-2` characters separate the two substrings.** Held on
every N tried, and pinned at both boundaries in `test/core/search-grammar.test.ts` — the largest gap
that must match and the smallest that must not.

None of that is in the FTS5 documentation, because none of it is true under `unicode61`. It is a
property of *this* tokenizer, which is to say it is a free gift from the decision the Hebrew
measurement already paid for. In readable units: **`NEAR(…, 12)` is "in the same clause", `NEAR(…, 30)`
is "in the same sentence", `NEAR(…, 200)` is "in the same paragraph".**

## 2.2 The curve between "one phrase" and "two AND-ed terms"

1,420 two-word phrases he actually typed (both words 5+ letters), sampled by stride from 14,197, the
same sampling `measure-search-floor.ts` §7 uses so the numbers are comparable line for line:

```
phrase  (ships)   450 of 1420   31.7%   median    3 spans   mean   6.1
NEAR 12          1294 of 1420   91.1%   median    4 spans   mean  11.1
NEAR 30          1415 of 1420   99.6%   median    4 spans   mean  14.3
NEAR 80          1420 of 1420  100.0%   median    7 spans   mean  21.7
NEAR 200         1420 of 1420  100.0%   median   10 spans   mean  33.1
AND              1420 of 1420  100.0%   median   38 spans   mean 109.4
OR               1420 of 1420  100.0%   median  860 spans   mean 964.7
```

**Read the median column, not the reach column.** Every pair here was taken *from* a prompt that is
itself in the index, so a near co-occurrence is guaranteed to exist somewhere and the reach column is
inflated by construction — a caveat that belongs to `semantic/1`'s 100% for AND exactly as much as to
NEAR's 99.6%. What is *not* inflated is how many spans a reader is handed: **NEAR 30 hands back a
tenth of what AND does** and still reaches nearly everything AND reaches.

**And the three readings are strictly nested.** Checked on 178 of them by comparing rowid SETS rather
than counts: phrase ⊆ NEAR 30 in 178/178, NEAR 30 ⊆ AND in 178/178. So an answer that shows phrase
hits, then NEAR hits, then AND hits **cannot lose a hit the shipped search returns today** — for
terms of three characters or more. §3 is the counterexample that bound is hiding.

Cost, median of 25 on the real index: **phrase 0.44 ms, NEAR 30 0.20 ms, AND 0.20 ms, OR 0.24 ms.**
Three queries instead of one is under a millisecond. And `snippet()` works on every form — under AND
and NEAR it brackets each matched term separately (`"… — [BYTE] [OFFSET]S vs…"`), so the screen needs
no change to render a multi-term hit.

---

# 3. HEBREW — MEASURED BEFORE ANYTHING WAS OFFERED

Fixture, as `semantic/1` built it: 1,353 Hebrew strings from the shipped UI table plus 23 Hebrew lines
from corpus items = 1,376 documents, 3,654 word types. **His archive itself is not the fixture and
cannot be: of 524 main-session prompts, exactly one contains Hebrew, carrying five Hebrew word
types.** The script prints that line itself, above every Hebrew number it then reports. So read all
of §3 as evidence about the **mechanism** — what this index can and cannot match — and none of it as
evidence about his traffic. It is what decides where the Hebrew findings land in the recommendation.

**Finding 1 — the three-character floor costs an order of magnitude more in Hebrew.**

```
word types by length: 1:9  2:57  3:278  4:814  5:1183  6:864  7:314  8:93  9:29  10:9  11:2  12:1  13:1
types under 3 chars:        66/3654  (1.8%)
OCCURRENCES under 3 chars: 1954/13446 (14.5%)
```

In English a two-letter word is almost never the word you are looking for. **In Hebrew it is one word
in seven, and this index cannot match any of them.** `MIN_QUERY_CHARS` reports that correctly today
for a whole query. Nothing reports it per term.

**Finding 2 — and that floor is exactly where splitting a Hebrew query goes wrong.** 9,598 adjacent
Hebrew word-pair types in the fixture, of which **2,391 (24.9%) contain a word shorter than three
characters**. The counterexample, taken from the fixture rather than invented:

```
"הם רשות"
  as ONE substring, which is what ships:   1 hit
  as "הם" AND "רשות":                      0 hits    <- the split is STRICTLY WORSE
  "רשות" alone:                            3 hits    (the removal proof: the fixture answers)
```

**So "phrase is a subset of AND" is FALSE in Hebrew.** A surface that *replaced* the substring reading
with a boolean one would lose real Hebrew hits and say nothing. A surface that shows the substring
reading **first** and the boolean readings after it cannot. **That is why the tiers are ordered
phrase-first, and Hebrew is the only reason.** Pinned as a test.

**Finding 3 — the grammar itself is language-blind, which is the whole point of trigram.** 1,030
Hebrew two-word pairs, both words 3+ letters:

```
phrase     815 of 1030   79.1%
NEAR 12   1018 of 1030   98.8%
NEAR 30   1029 of 1030   99.9%
AND       1030 of 1030  100.0%
```

(No median column: the fixture is 1,376 *short* strings, so every form returns one span and the
precision spread the English archive shows cannot be measured on it at all.)

**Finding 4 — splitting does nothing for the particle, but it is what makes the repair expressible.**
He types the particle glued to the front of a word and the text writes the bare word. 1,030 such
queries:

```
phrase                                      1   0.1%
NEAR 30                                    21   2.0%
AND                                        38   3.7%
NEAR 30, one particle stripped PER TERM  1029  99.9%
```

**AND is as blind to a glued particle as the phrase is.** What the split buys is the *ability to
strip one*, which cannot be done to a contiguous substring without destroying it. The split is not the
repair; it is the only thing that makes `semantic/1`'s 1.3% → 100% repair expressible at all.

**Finding 5 — the strip has its own floor, and it is total.** 157 three-letter Hebrew word types in
the fixture begin with a particle letter, and **157 of 157** strip down to a two-character term this
index cannot match. So a strip must ADD a variant and keep the original, never replace it — which is
what `hebrewVariants` already returns and what a caller could still throw away. Pinned as a test.

**No bidi control marks in the fixture** (0 of 1,376), and 3 spans in the whole archive. Not a hazard
here today.

---

# 4. THE CORPUS SIDE: `filterItems` REFUSES TO RANK, AND THAT IS THE REAL GATE

SET R, exactly as `semantic/1` built it — 42 owner-authored (request, item) pairs, every 8-word window
of a request deleted from the item it points at, query = the five most distinctive words. What is new
is the candidate: **SQLite's own FTS5, same trigram tokenizer, same `bm25()` `matchProse` already
orders by, no new ranker written, no dependency added.**

```
S0  shipped: whole request as one substring       @1  3   @5  3   @10  3   anywhere  3/42   MRR 0.071
S0b shipped: those 5 words as one substring       @1  0   @5  0   @10  0   anywhere  0/42   MRR 0.000
F1  FTS5: 5 terms AND-ed, bm25                    @1  1   @5  2   @10  2   anywhere  2/42   MRR 0.036
F2  FTS5: 5 terms OR-ed, bm25                     @1 15   @5 25   @10 25   anywhere 33/42   MRR 0.457
F2n F2 over the SHIPPED fields only               @1 13   @5 22   @10 24   anywhere 33/42   MRR 0.419
F3  F2 + column weights (title/summary 3, tags 2) @1 13   @5 25   @10 26   anywhere 33/42   MRR 0.431
F4  FTS5: NEAR all five, 400 characters           @1  1   @5  1   @10  1   anywhere  1/42   MRR 0.024
F5  FTS5: 10 terms OR-ed, bm25                    @1 18   @5 25   @10 29   anywhere 36/42   MRR 0.516
```

Building the whole corpus into a throwaway in-memory FTS5 table costs **535 ms for 1,282 items**.

Four readings, and the third is the one to carry away:

  — **S0b → F2 is 0/42 → 15/42 at rank one**, and it reproduces `semantic/1`'s hand-written BM25
    (@1 15–16, MRR 0.452–0.476) **by a completely different mechanism**. Two independent
    implementations landing on the same number is the strongest form this evidence takes.
  — **F1 and F4 are the warning.** AND-ing is right for TWO words and ruinous for FIVE (2/42), and
    NEAR over five terms is worse still (1/42). A reader who types a sentence does not mean *"all of
    these, and close together"*. **Whatever a surface does with two terms it must not do with five.**
    This is why the recommendation below is scoped to the archive box and not applied blindly.
  — **F2n → F2 is COVERAGE, not weighting**, and **F3 shows weighting did not help at all** (@1 13
    against 15). `semantic/1` said the same sentence — *"TITLE AND SUMMARY AS WELL AS BODY is not
    about weighting, it is about COVERAGE"* — and this reproduces it from the other side.
  — **F5 beats F2.** More query terms helps under bm25, which argues against pruning a query down to
    its "distinctive" words before searching.

**Is any of the archive-side work worth having before `filterItems` ranks?** Yes — and this is the
one place where the two surfaces genuinely differ. `matchProse` **already orders by `bm25()`**. The
archive has had ranking since the day it was written; it has never had a query grammar to rank. The
corpus has neither. So:

  — On the **archive**, the three recommendations below are complete on their own and need nothing
    from `filterItems`.
  — On the **corpus**, none of them is worth having alone, because an unranked union of three tiers
    over 1,282 items returns items in `ORDER BY id` and a reader would be handed the alphabet. The
    corpus needs the decision in §6, not a grammar.

---

# 5. THE THREE I WOULD SHIP FIRST

The failure mode to avoid is a Find dialog with nine checkboxes nobody ticks. **None of these three is
a checkbox.** Notepad++ earned its options over two decades of people walking a caret through a
buffer; a box this reader opens to find one passage has earned none of them. VS Code's three toggles
have survived eight years of pressure for a fourth. The right number of new controls here is zero.

## ONE — Read one query three ways and show the answer in tiers

**What a reader could do that he cannot today.** Type two words that are not adjacent in the text and
find the passage. Today that fails 68.3% of the time and says nothing about why.

**The mechanism.** Split the trimmed query on whitespace. Send **three** queries instead of one —
`"a b"`, then `NEAR("a" "b", 30)`, then `"a" AND "b"` — and show the union in that order, each block
under a line that says what it is: *"your words, next to each other"* / *"in the same sentence"* /
*"both somewhere in the same turn"*. A one-word query is unchanged: all three readings collapse to the
same query and one is sent.

**Under trigram?** Measured yes — §2, §2.2. **In Hebrew?** Measured yes, and Hebrew is what fixes the
*order*: phrase first, because §3 Finding 2 is a real pair the phrase finds and the AND does not.

**What it costs with no dependency.** No parser. No grammar. `String.split(/\s+/)`, the existing
per-term quoting, three `index.matchProse` calls at 0.2–0.5 ms each, and one `tier` field on
`ProseHit`. `snippet()` already brackets each term separately, so the screen renders it unchanged.
There is nothing here for Elasticsearch's *"ignore invalid parts"* rule to protect against, because
there is no syntax to get wrong.

**Useful without ranking?** **Yes, and this is the point.** The tier *is* the ordering, and it is
derived from the query rather than from a score — so it is not the relevance claim `filterItems`
refuses to make. It is three different questions asked in order of how literally they were meant.

**Why first.** It is the whole of what he asked for, it is measured at 31.7% → 99.6% reach with a
tenfold smaller result set than the obvious alternative, it cannot lose a hit that works today, and it
adds no control to any screen.

## TWO — Move the three-character floor from the query to the term, and say so

**What a reader could do that he cannot today.** Be told that one of his words is unsearchable instead
of being told there is nothing there.

**The mechanism.** The per-term check that ONE requires. Terms under three characters do not go into
the boolean tiers — they stay glued into the phrase tier, which can still match them — and
`SearchResult.note` says which words were too short and why, through the channel
`conversations.js` already draws when `searchable === false`.

**Under trigram?** It *is* the trigram bound: `"ui" AND "search"` returns 0 while `"search"` returns
654. **In Hebrew?** This is where it earns its slot: 14.5% of Hebrew word occurrences and **24.9% of
adjacent Hebrew word pairs** are under the floor, against 21.0% of the English words he types.

**What it costs.** A length test and a sentence. `MIN_QUERY_CHARS` already exists and already has the
right sentence written for it; this is the same disclosure one level down.

**Useful without ranking?** Yes — it is a disclosure, not an ordering.

**Why second.** Not because it is exciting but because **ONE is a regression generator without it.**
`INV-nothing-is-dropped-silently` and `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`
are both about exactly this shape, and `TASK-the-automatic-marking-stopped-and-said-nothing-because-a`
is the incident yesterday where a step that could not look reported that there was nothing to do.
Shipping ONE alone would re-create it inside the feature meant to fix search.

## THREE — `-word` to exclude, and nothing else that looks like syntax

**What a reader could do that he cannot today.** Cut the tier-three block down when both his words are
common. This is the only operator in the whole survey that every single surveyed surface has — Gmail
`-`, GitHub `NOT`, notmuch `not`/`-`, ripgrep `-v`, Elasticsearch `simple_query_string` `-` — and it
is the one thing tiering alone cannot do.

**The mechanism.** A leading `-` on a whitespace-delimited term of three or more characters becomes
` NOT "term"` on every tier. Anything else — a `-` inside a word, a lone `-`, a `-` on a short term —
is a literal character, on Elasticsearch's rule: *"does not return errors for invalid syntax. Instead,
it ignores any invalid parts of the query string."*

**Under trigram?** Measured: `"byte" NOT "offset"` returns 718. **In Hebrew?** Hebrew uses the hyphen
as *maqaf* (`־`, U+05BE) and not ASCII `-`, so an ASCII leading hyphen cannot collide with a Hebrew
word; the short-term guard from TWO covers the rest.

**What it costs.** About fifteen lines, no parser, and it is reversible by deleting them.

**Useful without ranking?** Yes — it is a filter, which is precisely the kind of claim `filterItems`
already makes for `--tag` and `--type`.

**Why third, and why not `+`, `OR`, quotes or parentheses.** Because it is subtractive and therefore
safe: a reader who types `-foo` and gets a smaller list learns the rule in one try. Everything else in
the operator zoo is additive or structural and needs to be *taught*. And once `(` is in the box, the
survey says what happens: nobody hand-writes that parser, liqe needed an Earley engine and a runtime
ambiguity check, lunr throws twelve different ways including on a trailing colon, and a query box
behind a keystroke cannot throw.

## The fourth, named so it is not lost, and why it is not in the three

**The Hebrew front-particle variant per term** — `hebrewVariants` glued into tier two as an extra
`OR`-ed form, guarded at three characters. `semantic/1` measured it at 1.3% → 100% and this report
measured it again at 0.1% → 99.9% under the split. It is not in the three for one honest reason: **his
archive contains one Hebrew prompt.** The measurement rests on the shipped UI string table, so on the
surface he actually asked about it would change nearly nothing today. It belongs the day Hebrew turns
up in the transcripts, and the reason to write it down now is that ONE is the only moment at which it
is cheap — a contiguous substring has no term to strip a particle from.

---

# 6. WHAT I WOULD REFUSE, AND WHY

**Regular expressions.** The single most requested feature and the wrong one here. It cannot use the
index at all — a regex must scan, and the trigram index is what makes 11,006 spans answer in 0.2 ms —
so it turns a search box into a table scan. Both scaled tools in the survey refuse its expensive half
for structurally the same reason: ripgrep's default engine
([*"Backreferences are not possible to implement in this paradigm"*](https://github.com/BurntSushi/ripgrep/blob/master/FAQ.md))
and GitHub code search
([*"'look-around' assertions are not supported"*](https://docs.github.com/en/search-github/github-code-search/understanding-github-code-search-syntax)).
And the measured usage is against it: median **one keyword** per query
([Sadowski et al. 2015](https://research.google/pubs/pub43835/)).

**Whole-word matching.** It would be actively harmful. The trigram index has no concept of a word
boundary, so `-w` would have to be a post-filter in JS over every hit — and in Hebrew it is worse than
useless, because the whole reason this index is trigram is that Hebrew glues particles onto word
fronts. `unicode61` was measured at **1/3,927** against trigram's 51. A whole-word option is
`unicode61`'s semantics reintroduced through a checkbox.

**A case-sensitivity toggle.** Trigram folds case by default and 98 = 98 for `"byte offset"` and
`"BYTE OFFSET"`. Making it *optional* would mean a second index or a post-filter. And the smart
version is the trap ripgrep documented: `rg -S 'foo\w'` matched `FOOBAR` because `\w` contains `A-Z`,
and it took two months and an issue thread to write a rule anyone could state
([#717](https://github.com/BurntSushi/ripgrep/issues/717)). VS Code has held the line for eight years
([#55247](https://github.com/microsoft/vscode/issues/55247)).

**Prefix `*`.** Measured to be a literal no-op: `"byte"*` and `"byte"` return the same 884 rows,
because a trigram index already matches substrings. A control that does nothing is worse than a
missing one — it teaches a reader a false model of what the index does.

**Parentheses, `OR`, `AND` as typed keywords, `field:value`.** Every one of them turns the box into a
language that can be typed wrong. The corpus already has a structured query surface for the
field-scoped questions — `--type`, `--status`, `--tag`, `--path`, `--relation`, `--linked-to` — and
duplicating them as a string grammar is the two-hand-kept-expressions defect `filterItems` exists to
avoid. Also worth knowing before adding a colon: **`kind : "prompt"` is accepted by FTS5 today and
returns 0 for ever**, because `kind` is `UNINDEXED`. A colon grammar over this schema would fail
silently on exactly the columns a reader would reach for.

**Backward search, wrap-around, extended escapes, mark-all, bookmark-line.** Notepad++'s, and they are
properties of a caret walking a buffer. This screen already shows every hit at once, which is the
thing Notepad++ needed three separate features to approximate. Notepad++ itself refuses one of them in
regex mode — *"Regular expression 'backward' search is disallowed due to sometimes surprising
results"* — which is the reference tool agreeing.

**Any npm package.** `CONST-zero-runtime-dependencies`, and the survey shows nothing is needed: the
grammar is compiled into SQLite, `bm25()` is compiled into SQLite, and the largest hand-written idea
in the whole landscape is a 118-line splitter that this recommendation does not need either.

---

# 7. A PROPOSAL, NOT A CHANGE

`src/` belongs to another lane and nothing here was edited. For the record, the shape of ONE and TWO
in `src/core/conversation-search.ts` is about thirty lines and touches one function:

```ts
export interface ProseHit { /* … */ tier: 'phrase' | 'near' | 'both'; }

/** Terms long enough for a trigram index to match, and the ones that were not. */
export function termsOf(query: string): { terms: string[]; short: string[] } { /* … */ }

export function searchArchive(index, query, scope = {}): SearchResult {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_CHARS) return /* unchanged */;
  const { terms, short } = termsOf(trimmed);
  const phrase = `"${trimmed.replace(/"/g, '""')}"`;
  if (terms.length < 2) return /* exactly today's answer, unchanged */;
  const q = terms.map((t) => `"${t.replace(/"/g, '""')}"`);
  const seen = new Set<string>(); const hits: ProseHit[] = [];
  for (const [tier, match] of [
    ['phrase', phrase],
    ['near',   `NEAR(${q.join(' ')}, 30)`],
    ['both',   q.join(' AND ')],
  ] as const) {
    for (const h of index.matchProse(match, scope, limit)) {
      const key = `${h.sessionId}/${h.recordIndex}`;
      if (seen.has(key)) continue;           // the tiers nest; first wins
      seen.add(key); hits.push({ ...h, tier });
    }
  }
  return { query: trimmed, searchable: true, note: noteFor(short), hits };
}
```

`limit` needs a decision it does not have today (per tier, or shared), and that decision is a
measurement rather than a guess — which is why this is a sketch and not a patch.

---

# 8. WHAT WOULD MAKE THESE NUMBERS WRONG

**What was scanned.** The live archive index (11,006 prose spans, 523 main-session prompts), the live
corpus (1,282 items, 42 with a verbatim `request`), the shipped Hebrew string table (1,353 strings)
plus 23 Hebrew lines from corpus items. Nothing left the machine except the web searches, which
carried no archive content.

**What counted as a match.** A row returned by `conversation_prose MATCH`, counted per span. "Reach"
means a query returns at least one span; it is never a claim that the span is the right one.

**What would make it wrong.**

  — **The two-word fixture is biased toward NEAR, and toward AND equally.** Every pair was taken from
    a prompt that is itself indexed, so a near co-occurrence is guaranteed somewhere. The *reach*
    column is inflated for every row below `phrase`; the *median* column is not, and the
    recommendation rests on the median.
  — **There is no log of real searches**, because no surface audits one. SET R's 42 pairs are
    *requests that produced items*, not queries somebody ran, and 42 is small.
  — **The Hebrew fixture is not his archive.** 1,376 short UI strings against one Hebrew prompt in
    524. Every Hebrew number here describes the UI's Hebrew, and is offered as evidence about the
    *mechanism* (what the index can and cannot match) rather than about his traffic.
  — **The archive grew while this ran.** The prompt count was 523 at the start of the session and 524
    at the end, because this lane's own turns are being indexed under it. Every count in this report
    is right for the run printed beside it and will be slightly different on the next one.
  — **The Hebrew medians are structurally 1** because the fixture documents are one line long, so the
    precision half of the Hebrew case is genuinely unmeasured.
  — **`NEAR`'s `N-2` law was derived from ASCII dots.** It should hold for any single-codepoint
    separator; a separator outside the BMP, or a combining sequence, was not tried.
  — **The corpus grows under the script.** Two runs an hour apart do not produce identical numbers;
    §4's 1,282 items against `semantic/1`'s 1,253 is a day of drift, not a discrepancy.
  — **`bm25()` under trigram scores trigram phrases, not words.** F2's 15/42 landing on
    `semantic/1`'s 15/42 by a different route is strong evidence it behaves sensibly, but it is
    agreement between two measurements, not a proof.

---

# FOUND AND DELIBERATELY NOT FIXED

  1. **`kind : "prompt"` is a silent zero.** FTS5 accepts a column filter against an `UNINDEXED`
     column and returns nothing, for ever. Harmless today because `searchArchive` quotes the colon
     into data — and a landmine the moment any colon grammar is considered. Not fixed: nothing is
     broken today, and the repair is "do not add a colon grammar", which is §6.

  2. **`^"byte"` works and means "the span begins with".** A real, reachable FTS5 operator whose
     meaning on a conversation turn is almost never what a reader would guess. Left alone.

  3. **`measure-search-floor.ts` §6 defines the Hebrew vocabulary as `[֐-׿]{3,}`** — three
     letters or more — so the 14.5%-of-occurrences finding in §3 above is structurally invisible to
     it, and its 3,547 word types are 3,654 by the wider definition. Not a defect in that script; it
     was measuring particle stripping, for which short words are irrelevant. Named because the two
     numbers will look like a contradiction to the next reader, and they are not.

  4. **Column weights measured NEGATIVE and were not pursued.** `bm25(it, 0, 3, 3, 2, 1)` scored @1 13
     against unweighted 15. Left in the script's output rather than deleted, because a later reader
     will otherwise propose it.

  5. **`scripts/check-basis.ts` reports one spent line in `scripts/basis-undeclared.txt`** (a file
     that now declares a basis) and ten declarations naming retired items. Reported by the gate
     itself, not mine to edit, and green.

  6. **`src/core/conversation-search.ts` line 248 and `src/core/anchor-pass.ts` both cite
     `STD-nothing-to-do-and-could-not-look-are-different-answers`, and no such item exists.**
     `mycontext show` answers *"no item with id"*. The standard it means is
     `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` and the incident is
     `TASK-the-automatic-marking-stopped-and-said-nothing-because-a`, both of which do exist and are
     cited three lines away in the same header. `check-cited-items.ts` cannot see it: it is one of
     2,585 id-shaped strings that answer to no item, which the gate deliberately does not report
     because *"nothing tells an invented id from a deleted one by inspection"*. Not fixed because
     `src/` belongs to another lane — but it is a citation that resolves to nothing in the exact file
     this task is scoped to, and it is a one-word edit.

     **AND IT IS PROPAGATING, WHICH TURNS A NOTE INTO A HANDOVER.** `scripts/check-basis.ts` exited
     **0** when this lane started and exits **1** now: `1 finding(s) set the exit code: 0 MISSING, 0
     MALFORMED, 1 DANGLING`, and the dangling declaration is
     `test/cli/anchor-backfill.test.ts:1` — a file another lane created during this session, whose
     `@basis` names the same phantom id, copied out of the header above it. So the gate that does
     catch this catches it on the TEST side only, and the untracked `src/` citation is what fed it.
     The repair is one id in three places and it is not this lane's to make.

  7. **`filterItems` has no index and no ranking, and FTS5 would give it both for 535 ms of build
     time.** 0/42 → 15/42 at rank one. Deliberately not touched: `src/` belongs to another lane, and
     the refusal to rank is a recorded decision with a reason — *"a relevance score would be a claim
     about which item answers the question best, and there is no signal in a corpus this size to
     support one."* §4 is the evidence that the signal now exists. Reversing a recorded decision is
     an owner's call and an item of its own, not a lane's patch.
