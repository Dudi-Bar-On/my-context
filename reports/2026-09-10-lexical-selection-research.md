# Lexical selection over the conversation archive — research and verdict

**Status: research, not a decision.** No product code was written, `package.json` was not
touched, and nothing was installed. Written 2026-09-10 for the retrieval feature over the
conversation archive, under the scope the owner set in the design conversation.

**The scope, restated so it is not quietly widened.** Not summarisation — a subagent with a
fresh context does the condensing and cites its sources. Not verification — correctness is
checked against the codebase and git history, which this project already has. The question is
**selection**: given the archive, which passages are worth handing to that subagent at all.

**Everything below marked "measured" was measured on this machine today**, against this
project's own archive and this project's own documents, with the scripts described in §8 so
the numbers can be re-run. Everything marked "claimed" is somebody else's number and is
attributed. The two are never mixed.

---

## 0. The one-paragraph answer

**Three of the four needs should be implemented in this repository, in a few hundred lines,
and the fourth is already sitting in the tree unused.** The archive is 793.6 MB across 290
transcript files, and a **full census — every file, not a sample — finds 7.71 MB of prose in
it: 0.97%**. The rest is machinery that `src/core/conversation-index.ts:1159` already separates
with thirteen lines and no lexical features at all. **The entire pipeline described in this
report — scan all 290 files, extract the prose, build an exact-shingle near-duplicate index,
and build a BM25 full-text index — runs over the whole archive in 8.1 seconds with no
dependencies.** That single measured fact demolishes the library question: the
**exact 8-gram inverted index written from scratch found 60 near-duplicate pairs at
Jaccard ≥ 0.90 in 629 ms** on the working sample, while **MinHash with 128 permutations plus
LSH banding found 62 in 4.1 s** and a from-scratch **SimHash found 64 in 677 ms**. Three
independent methods, one answer, and the cheap ones win. The survey found no reason to
reconsider: **every JavaScript MinHash and SimHash package on npm is between five and
fourteen years without a release**, and the most-downloaded one has a 53-bit precision bug
in its core loop.

Vocabulary matching is answered by **SQLite FTS5, which ships inside Node 24 and is already in the
plugin's dependency set at zero cost** (`node:sqlite`, SQLite 3.51.2, `ENABLE_FTS5`, `bm25()`,
porter and trigram tokenizers — all verified on this machine). Subject extraction is answered
by **markdown-it 15.0.1, which this repository already vendored on 2026-09-05** under
`DEC-markdown-it-is-vendored-as-the-tokeniser-and-the-drawings` and which imports and parses
under Node with no change (verified). The only genuinely negative finding is need 3: **no
usable off-the-shelf signal/noise classifier exists for this**, and the lexical features the
literature offers are measurably weak on this corpus — the best single feature reached
AUC 0.836 and a two-rule classifier admitted 47% of the noise. The structural label beats
every lexical feature and is free.

---

## 1. The material, measured

### 1.1 What the archive actually is

`C:/Users/UserC/.claude/projects/D--Users-UserC-source-repos-my-context`, measured 2026-09-10:

| | |
|---|---|
| Transcript files (`.jsonl`, recursive) | **288** |
| Total on disk | **791.6 MB** |
| All projects on this machine | 901 files / 1,755.4 MB |

The brief said ~816 MB across ~281 files; the tree has grown a little since. Same order.

A small thing worth noticing rather than smoothing over: the census in §1.2b, run later the
same afternoon, counted **290 files and 793.6 MB**. Two files and 2 MB arrived while this
report was being written — one of them this lane's own session. **The archive is a live,
append-only store, so any index over it is a cache with a staleness question**, which is
exactly how `conversation-index.ts` already treats its own.

### 1.2 The composition — a stratified sample of 12 files, 106.6 MB, 41,060 records

Files were sorted by size and twelve drawn evenly across the range, so the sample is not
biased toward the big sessions that dominate the byte count. Shares are of the 106.61 MB of
record bytes in those files.

| Content kind | Bytes | Share |
|---|---|---|
| `attachment` records | 18.91 MB | 17.7% |
| `user` → `tool_result` | 15.53 MB | 14.6% |
| `file-history-snapshot` | 12.27 MB | 11.5% |
| `assistant` → `thinking` | 6.77 MB | 6.3% |
| `assistant` → `tool_use` | 6.38 MB | 6.0% |
| `queue-operation` | 4.62 MB | 4.3% |
| **`assistant` → `text`** | **2.05 MB** | **1.9%** |
| **`user` → string prompt** | **2.03 MB** | **1.9%** |
| everything else (14 kinds) | ~2.9 MB | 2.7% |

**The decisive number.** Assistant text plus user text — the prose, everything a person or a
model actually said in words — is **3.68 MB of 106.65 MB in this sample, 3.45%**.

### 1.2b The census, which corrects the sample — and the correction runs the right way

That extrapolation was wrong, and the honest thing is to print both numbers. Every one of the
290 files was then scanned, not twelve, and the prose extracted in full:

| Census, all 290 files | |
|---|---|
| On disk | **793.6 MB** |
| Prose blocks | **7,543** |
| Prose bytes | **7.71 MB** |
| Prose share | **0.97%** |
| Scan + extract cost | **5.7 s** |

**0.97%, not 3.45%.** The sample was drawn at even intervals of *rank*, which weights the many
small sessions equally with the few enormous ones; the byte count is dominated by the enormous
ones, and those are the ones that are almost entirely tool output. The census is the truth and
the sample was optimistic by 3.5×.

The correction runs in the favourable direction for every conclusion in this report: there is
**less than 8 MB of prose in the whole archive**. Every cost below that was extrapolated from
the sample has been replaced by the figure from the census run.

Two consequences follow and they set the whole shape of the answer:

1. **Nothing in this problem is a big-data problem.** 7.71 MB is smaller than the repository's
   own documentation corpus (7.53 MB, §2.1). Tooling chosen for billion-document scale — Spark
   MinHashLSH, sharded LSH services, vector databases — is answering a question this project
   does not have.
2. **The reduction from 794 MB to 7.7 MB is structural, not lexical.** It is done by reading
   the record's `type` field. No classifier is involved, no model call, no heuristic that can
   be wrong.

Of that prose, **2.5% sits inside ``` fences** — so fenced code is a rounding error in prose
and is not what "noise" means here.

### 1.2c The whole thing, end to end, over the whole archive — measured

Everything this report recommends was then run as one pass over all 290 files, in plain Node 24
with no dependencies and nothing vendored beyond what is already in the tree:

| Stage | Cost |
|---|---|
| Scan 793.6 MB, parse every record, extract prose | **5.7 s** |
| Exact 8-gram shingle index (numeric keys) over 3,927 blocks of ≥ 20 words | **1.4 s** — 877,368 shingles |
| Candidate near-duplicate pairs | **< 0.1 s** — 12,275 pairs, 7,223 of them sharing ≥ 3 shingles |
| FTS5 external-content index over all 7,543 blocks | **0.2 s** |
| 2,000 boolean BM25 queries | **491 ms — 0.246 ms each** |
| **Total wall clock** | **8.1 s** |
| Peak heap | 420 MB (dominated by holding all block text in memory at once, which a streaming build would not do) |
| Index on disk | **3.5 MB** |

**Eight seconds and a 3.5 MB index for the entire archive.** Every remaining question in this
report is a question about which *design* is right, not about which library is fast enough.
Nothing here is a performance problem, so nothing here justifies a dependency bought for
performance.

### 1.3 The 17.7% called `attachment` is 100% machinery, and says so

| Attachment kind | Share of attachment bytes |
|---|---|
| `hook_success` | 39.5% |
| `total_tokens_reminder` | 17.3% |
| `queued_command` | 15.0% |
| `prompt_snapshot` | 6.4% |
| `agent_listing_delta` | 3.6% |
| `hook_additional_context` | 3.6% |
| `skill_listing` / `invoked_skills` | 5.9% |
| `file` / `edited_text_file` | 3.8% |
| `deferred_tools_record` / `_delta` | 3.4% |

Every one of these is identifiable by a single field. A classifier that had to *infer* from
the text that `total_tokens_reminder` is machinery would be solving, badly and expensively, a
problem the format already answers exactly.

### 1.4 `assistant:thinking` is three times the volume of `assistant:text`

6.77 MB against 2.05 MB in the sample. Whether reasoning is in scope for selection is a design
question this report does not decide, but it should be decided deliberately: it is the largest
body of model-authored prose in the archive and dropping it silently drops three quarters of
what the model wrote.

### 1.5 The reduction is already implemented in this repository

`src/core/conversation-index.ts:1159`, `classifyTurn`, returns `prompt | answer | machinery`
from the record type and the presence of a `text` block. Thirteen lines. Its own header
records the measurement on this project's corpus on 2026-09-07: 52,061,736 bytes, 22,605
records, **450 prompts, 1,668 answers, 6,553 machinery**.

That function is need 3's answer for the coarse cut, it exists, and it is tested. What it does
not do is discriminate *within* the prose — that is §5.

---

## 2. Need 1 — extracting subjects from structured documents

### 2.1 The material, measured

221 Markdown files under `docs/`, `docs/superpowers/specs/` and `reports/`, 7.53 MB, parsed
with the **vendored markdown-it 15.0.1**:

| | |
|---|---|
| Headings | **4,348** (h1 249 · h2 1,726 · h3 2,283 · h4 72 · h5 11) |
| Distinct heading texts | 3,863 |
| Fenced blocks | 1,471 — **20.2% of document bytes** |
| Bold (`strong`) spans | **22,271** |
| Inline code spans | **59,600** |
| Parse cost | **536 ms for 7.53 MB — 14.1 MB/s** |

Plus a second vocabulary the corpus already maintains: **1,076 item ids** under
`.my_context/items/`, each a hyphenated slug of its own title.

### 2.2 The library question is already closed, by this repository, in this repository's favour

`markdown-it@15.0.1` (MIT, 137,975 bytes, browser ESM) is pinned at
`src/ui/public/lib/vendor/markdown-it.esm.min.js` with its SHA-256 in
`src/ui/public/lib/vendor/VENDOR.md`, under `DEC-markdown-it-is-vendored-as-the-tokeniser-and-the-drawings`
(owner ruling, 2026-09-05).

**Verified today: it imports and parses under Node 24 unchanged.** A plain
`await import(...)` of that browser ESM file took **4 ms**, exported a constructor, and parsed
a 13 KB spec into 322 tokens in 6 ms. It touches no browser global at module scope. The
tokeniser is therefore available to server-side selection code at **zero** new dependency,
zero new bytes, and zero new licence obligation.

### 2.3 Why not just use a regular expression — measured, and the answer is split

A naive ~40-line fence-aware regex extractor was written and run over the same 221 files
(358 ms) and compared with the tokeniser:

| Construct | Regex | markdown-it | Regex misses |
|---|---|---|---|
| Headings | 4,341 | 4,348 | **7 — 0.2%** |
| Inline code spans | 33,555 | 59,600 | **26,045 — 44%** |
| Bold spans | 17,432 | 22,271 | **4,839 — 22%** |

**Headings are line-anchored and a regex gets them.** Inline spans are not: multi-word
backticked phrases, backtick runs of two or more, spans crossing a line break, and spans
inside table cells all defeat the pattern. Since the identifier vocabulary is what needs 1
and 4 actually run on (§4.3 measures why), losing 44% of it is not acceptable, and the
tokeniser that fixes it is already in the tree. **Use markdown-it. Do not write the third
copy of the fence regex** — `DEC-markdown-it-...` records that this project has already fixed
that same bug three times in three places.

### 2.4 What about keyphrase extraction — RAKE, YAKE, TextRank

These answer a different question. They *invent* a vocabulary from a document's statistics.
The brief explicitly asks for the opposite: **extract the subjects the documents already
declare** — headings, defined terms, item ids — and match session text against those. A
heading is a subject an author committed to; a RAKE keyphrase is a co-occurrence artefact. The
library survey in §6 records what exists, but the design does not need it, and a statistical
keyphrase extractor introduced here would reintroduce exactly the "invented topics" the owner
ruled out.

**Verdict on need 1: solved, in-tree, today. Nothing new to adopt.**

---

## 3. Need 2 — near-duplicate and repeated passages

### 3.1 The owner's heuristic is correct, and it is cheap — measured

Sentence-group repetition within a session was tested directly. Over the 3,395 prose blocks
(3.65 MB) from the twelve sampled sessions, normalised to lowercase single-spaced text and cut
into overlapping **8-word shingles**:

| | |
|---|---|
| Shingles | 561,627 total, 531,685 distinct |
| Occurrences inside a repeated shingle | **47,530 — 8.5%** |
| Pass cost | **458 ms for 3.65 MB** |

And what repeats is exactly what the heuristic predicts. The most repeated 8-grams, verbatim:

```
195x  <note>a task-notification fires each time this agent stops
195x  task-notification fires each time this agent stops with
195x  fires each time this agent stops with no
```

195 occurrences of an injected harness note. **The heuristic finds machinery, and it finds it
in under half a second.** That is a measured confirmation, on this corpus, of the owner's own
rule.

### 3.1b The heuristic in its literal form — sentence groups — is more conservative than it sounds

The owner's rule names *sentences*, not word windows. That form was measured separately, using
`Intl.Segmenter` for the sentence boundaries and requiring the group to lie inside one block:

| Group size | Distinct groups | Occurrences | In a group seen more than once |
|---|---|---|---|
| 1 sentence | 32,483 | 34,454 | 2,792 — **8.1%** |
| 2 sentences | 29,931 | 31,132 | 1,843 — **5.9%** |
| 3 sentences | 27,912 | 28,795 | 1,491 — **5.2%** |

Whole pass: **196 ms** over 34,454 sentences.

At a group size of three, **96 of 3,395 blocks — 2.8%** contain a repeated sentence group.
That is a precise flag and a narrow one. The 8-word-shingle form (§3.1) flags 8.5% of shingle
occurrences, catching partial and near-repeats the sentence form misses because one word
changed mid-sentence.

**Both are worth having and they are not the same instrument.** The sentence-group rule is the
one to *show a person* — "this passage appeared three times" is a claim you can point at. The
shingle rule is the one to *score with*. Neither costs a second.

### 3.2 MinHash + LSH, implemented from scratch and timed

Written in ~35 lines: FNV-1a-based 32-bit hash with per-permutation seeds, K = 128
permutations, 5-word shingles, LSH banding b = 32 × r = 4 (threshold ≈ (1/b)^(1/r) = 0.42).
Over the 2,505 prose blocks of ≥ 20 words:

| Stage | Cost |
|---|---|
| Signature computation | **4,026 ms** (622 blocks/s) |
| LSH banding + candidate generation | **39 ms** → 441 candidate pairs from 3,136,260 possible |
| Estimated Jaccard ≥ 0.90 | 62 pairs |
| Estimated Jaccard 0.50–0.90 | 337 pairs |

LSH does its job beautifully: it cut 3.1 million pairs to 441 in 39 ms. **The signature
computation is 99% of the cost**, because it hashes every shingle 128 times.

### 3.3 The comparison that decides it — measured

The same corpus, with an **exact 8-gram inverted index** instead — a `Map` from shingle to the
block ids containing it, then every pair sharing a shingle, then true Jaccard on 5-word sets:

SimHash was then implemented from scratch as well — 64-bit, 4-word shingles, sign-of-sum over
bit columns — so all three families are compared on the same data rather than two of them:

| | **Exact 8-gram index** | **SimHash 64-bit** | MinHash K=128 + LSH |
|---|---|---|---|
| Signature / index build | **629 ms** | **657 ms** | 4,026 ms |
| Candidate generation | included | **20 ms**, brute force over all 3,136,260 pairs | 39 ms (LSH banding) |
| **Total** | **629 ms** | **677 ms** | **4,065 ms** |
| Pairs found at the method's own "duplicate" threshold | **60** (Jaccard ≥ 0.90) | **64** (Hamming ≤ 3) | 62 (estimated Jaccard ≥ 0.90) |
| Lines of code | ~40 | ~25 | ~35 plus banding |

**Three independent methods agree on 60–64 pairs**, and two of them cost about 650 ms while
MinHash costs 4 s. MinHash's expense is structural: it hashes every shingle 128 times, where
SimHash hashes it twice and the shingle index hashes it once.

**The SimHash result carries a second lesson worth more than the timing.** Comparing all
3,136,260 pairs by brute force took **20 ms**, because a 64-bit Hamming distance is two XORs
and two popcounts. **At this scale, LSH is solving a problem that does not exist.** Every
banding scheme, every `b`-and-`r` tuning table, every sharded LSH service in the literature
exists to avoid an all-pairs comparison that this corpus can simply do, twice, in the time it
takes to read one transcript file.

**6.5× faster than MinHash, and it finds the same set.** The 62-vs-60 difference at the high threshold is
inside MinHash's own estimation error at K = 128 (standard error ≈ 1/√K ≈ 8.8%).

**One implementation detail of the comparison that affects the numbers**, recorded so the
result is reproducible and not accidentally flattering: postings lists longer than 50 blocks
were skipped when generating pairs, on the ground that a shingle appearing in 50+ blocks is
boilerplate and pairing all of them is quadratic in the least useful direction. That cap
lowers recall for pairs joined *only* by ubiquitous shingles. Raising it would find more pairs
and cost more time; it does not change which of the two methods is cheaper, because MinHash's
banding applies a cap of exactly the same kind for exactly the same reason.

**The honest limitation, stated rather than buried.** The exact-shingle index has *no recall
at all* for a near-duplicate that shares no 8-word run verbatim — a genuine paraphrase. On
this corpus that does not arise, because what repeats is machinery, and machinery repeats
byte-for-byte. If the feature later needs to catch a human restating an idea in different
words, exact shingling will silently return nothing and MinHash will not save it either
(Jaccard over word shingles is also near zero for a true paraphrase); that is a semantic
problem and belongs to the summarising subagent, which the brief put out of scope.

### 3.4 Memory — measured, and it is not a constraint

| Index over 3.65 MB of prose (526,959 shingles) | Heap | Scaled to the archive's 7.71 MB |
|---|---|---|
| `Map` with 8-word **string** keys | 75 MB | ~158 MB |
| `Map` with 53-bit **numeric** hash keys | 36 MB | **~76 MB** |

Both fit comfortably, and the numeric-key version is a two-line change (two 32-bit FNV rounds
composed into a safe integer) that halves it. The whole-archive run in §1.2c confirms the
order: 877,368 shingles indexed in 1.4 s. Its 420 MB peak heap is not the index — it is
holding all 7,543 block strings and their normalised copies in memory at once, which a
streaming build would not do. If the index must persist across runs rather than being rebuilt
in 1.4 s, it belongs in the SQLite file the project already opens, not in a heap `Map`.

### 3.5 The zero-dependency alternative that does not work — measured

`node:zlib` gives normalised compression distance for free, and NCD is a real technique with
real literature. It was timed:

- Deflating 300 blocks: 31 ms.
- NCD over 1,770 pairs: 336 ms — **0.19 ms per pair**, and it is inherently **O(n²)** because
  there is no way to bucket candidates.
- Extrapolated to all pairs over 2,505 blocks: **596 seconds.**

Against 629 ms for the shingle index on the same data. **Ruled out**, and recorded here so it
is not re-proposed.

### 3.6 Sentence segmentation is built in

`Intl.Segmenter` is present in Node 24 (ICU-backed, not a dependency), segments the 3.65 MB of
prose into 52,702 sentences in **44 ms — 82.1 MB/s**, and supports `he` and `ar` as well as
`en`, which matters for a project that ships a Hebrew UI.

Its limitation, measured rather than assumed: UAX #29 has no abbreviation lexicon, so
`Dr. Smith` splits into two sentences. For grouping repeated sentence runs that is harmless —
a mis-split sentence still repeats identically each time.

**Verdict on need 2: implement it. ~40 lines of exact-shingle inverted index, numeric keys,
built on `Intl.Segmenter` for the sentence-group form of the heuristic. Take no library.**

If a fuzzier notion of "the same passage" is ever wanted than exact shingles give, **SimHash is
the one to add, not MinHash** — 25 lines, 657 ms over the sample, and brute-force comparison at
this scale needs no LSH at all.

---

## 4. Need 4 — matching session text against a known vocabulary

Taken before need 3 because it is the one with a clean, positive answer.

### 4.1 SQLite FTS5 ships inside Node 24 — verified on this machine

`node:sqlite` is already imported in **20 places across 14 files** in this repository
(`src/core/store.ts`, `src/core/audit-db.ts`, `src/core/ledger.ts`,
`src/core/conversation-index.ts`, and others). Probing the bundled build:

```
sqlite version           3.51.2
compile options          ENABLE_FTS3, ENABLE_FTS3_PARENTHESIS, ENABLE_FTS5,
                         ENABLE_MATH_FUNCTIONS, ENABLE_RTREE, ENABLE_GEOPOLY,
                         ENABLE_DBSTAT_VTAB, ENABLE_SESSION, ENABLE_RBU,
                         ENABLE_COLUMN_METADATA, ENABLE_PREUPDATE_HOOK
FTS5                     YES — CREATE VIRTUAL TABLE ... USING fts5(...) works
bm25()                   YES — ranking function present and ordering correctly
porter + unicode61       YES
trigram tokenizer        YES
json1                    YES
spellfix1 / editdist3    no
sqlite-vec               no (as expected — it is a loadable extension)
```

**A BM25-ranked full-text index, a stemmer, and a trigram tokenizer, at zero runtime
dependency, behind an import the project already makes.** `dependencies` stays empty. Nothing
is vendored. This is the single most consequential finding in the report.

The trigram tokenizer deserves its own line: it makes substring and near-match search possible
inside FTS5 without any external fuzzy-matching library, which is the usual reason people
reach for one.

**Hebrew works, verified.** This project ships a Hebrew UI and its documents have a Hebrew
mirror, so this was tested rather than assumed:

| Probe | Result |
|---|---|
| `unicode61` phrase match on a Hebrew word | hit |
| `unicode61` match on a Hebrew word mid-sentence | hit |
| `trigram` substring match on a partial Hebrew word (`ארכיו`) | hit |
| `trigram` substring match mid-word in English (`versat`) | hit |
| `porter unicode61` stemming — query `indexing`, document `indexes` | hit |

So one FTS5 table serves both scripts. The `porter` stemmer is English-only by construction
and does nothing useful to Hebrew, which argues for `unicode61` as the primary tokenizer with
`porter` as a second column or a second table if English stemming is wanted — not for two
separate indexes.

### 4.2 Cost, measured

Over the 3,395 prose blocks (3.68 MB):

| | |
|---|---|
| Index build (in-memory, one transaction) | **57 ms — 64.8 MB/s** |
| Phrase query | **0.06 ms each** (1,500 queries in 95 ms) |
| Boolean AND-of-terms query | **0.07 ms each** (1,408 queries in 93 ms) |
| On-disk size, contentful FTS5 | 7.80 MB — 2.12× the prose |
| On-disk size, **external-content** FTS5 (bodies dropped) | **1.79 MB** |

Run over the whole archive rather than extrapolated (§1.2c): all 7,543 blocks indexed in
**0.2 s**, and the external-content index — bodies dropped, since the `.jsonl` files are the
source of truth — is **3.5 MB on disk**. Boolean BM25 queries against it measured
**0.246 ms each** over 2,000 runs.

`conversation-index.ts` already treats its index as a disposable cache rebuildable from disk,
and this one should be the same: **3.5 MB, rebuilt in under a second, storing no second copy of
anything.**

### 4.3 Which vocabulary to match — and this measurement changed the answer

Three vocabularies were tried against the same index. This is the result that should shape the
design:

| Vocabulary as query | Queries | Matched at least one block |
|---|---|---|
| Heading text as an FTS5 **phrase** | 1,500 | **61 — 4%** |
| Heading text as **AND of content words** | 1,408 | **447 — 32%** |
| Corpus **item-id slug** as AND of content words | 1,059 | **719 — 68%** |

And separately, a from-scratch **Aho–Corasick** automaton over the 6,573 distinct backticked
identifiers:

| | |
|---|---|
| Build | 6,573 patterns → 56,315 states, **49 ms** |
| Scan | 3.68 MB in **204 ms — 18.1 MB/s** |
| Result | 132,741 block-term hits, **39.1 distinct vocabulary terms per block** |

**The heading is the wrong unit and the identifier is the right one.** A heading in this
project's documents is a sentence — "The finding that shapes everything" — and sessions do not
quote sentences; they discuss the things the sentence is about. As a phrase it matched 4% of
the time. Loosened to a bag of content words it reached 32%, which is real but is no longer
"matching a subject" so much as keyword soup. The item-id slug does better at 68% precisely
because the slug is already a distillation of the subject into content words. The backticked
identifier does best of all — 39 hits per block — because it is a *name*, and names are what
sessions actually say.

The practical reading: build the vocabulary from **backticked identifiers, corpus item ids,
and heading content-words in that order of confidence**, and treat a phrase-level heading match
as a strong but rare signal rather than the primary mechanism.

### 4.4 FTS5 or Aho–Corasick

Both are zero-dependency and both are fast enough. They are not competitors:

- **FTS5** answers "which blocks are about X", ranked, with an index that persists and that
  supports boolean and phrase queries the caller composes at query time. Use it for the
  retrieval path.
- **Aho–Corasick** answers "which of these 6,573 known names appear in this block", in one
  pass, for every term at once. Use it for the *annotation* path — labelling a block with its
  subjects at index time. 40 lines, no dependency, 18 MB/s measured.

**Verdict on need 4: solved, at zero cost, by a Node builtin the project already uses. Adopt
nothing. The design work is choosing the vocabulary, and §4.3 says which one.**

---

## 5. Need 3 — signal or noise, cheaply and without a model call

This is the one with a negative answer, and it is stated plainly.

### 5.1 The coarse cut is free and already exists

§1.5: `classifyTurn` reduces 793.6 MB to 7.71 MB by reading a field. Nothing lexical competes
with that. Any tool evaluated for need 3 is competing only for the residual 0.97% — *within prose*,
is this passage signal or noise.

### 5.2 The lexical features from the literature were measured, and they are weak here

Two populations were labelled **by transcript structure, not by any classifier**, so the labels
are independent of the thing being tested: PROSE = assistant `text` blocks with fenced code
stripped (n = 1,346); NOISE = `tool_result` content (n = 3,050). Nine features from the
standard code-vs-prose repertoire were computed and scored by AUC — the probability that a
random prose passage scores above a random noise passage. 0.5 is useless, 1.0 is perfect:

| Feature | AUC | Median prose | Median noise |
|---|---|---|---|
| Longest line | **0.836** | 348 | 112 |
| Line-length SD | 0.788 | 112.3 | 30.2 |
| Letter ratio | 0.732 | 0.741 | 0.692 |
| Mean line length | 0.723 | 107.8 | 63.3 |
| **Stopword ratio** | 0.715 | 0.249 | 0.188 |
| Average word length | 0.268 (inverted: 0.732) | 4.45 | 5.14 |
| Digit ratio | 0.254 (inverted: 0.746) | 0.013 | 0.040 |
| Indentation ratio | 0.333 (inverted: 0.667) | 0.000 | 0.000 |
| **Punctuation ratio** | **0.499 — useless** | 0.038 | 0.040 |

Punctuation density is the feature every write-up of this problem reaches for first, and on
this corpus it is **exactly a coin flip**. The reason is visible in the medians: 0.038 against
0.040. Technical prose in this project is full of backticks, slashes, parentheses and dashes.

A two-rule classifier of the kind these features suggest was then built and scored:

```
stopwordRatio >= 0.16  AND  punctuationRatio <= 0.06
  prose kept  1,135 / 1,346 = 84.3% recall
  noise kept  1,434 / 3,050 = 47.0% false positive
  cost        4.86 MB in 296 ms — 16 MB/s
```

**47% false positive.** It is cheap and it is nearly worthless.

### 5.3 Why it fails, and the finding hidden inside the failure

The classifier is not broken; the label is. A large share of `tool_result` content **is prose**
— subagent reports, `get_item` output, web search results, question answers. Measured, by
attributing every `tool_result` back to the `tool_use` that produced it:

| Tool | Share of `tool_result` bytes |
|---|---|
| `Bash` | **65.5%** |
| `Read` | 16.8% |
| `Agent` | 6.0% |
| Playwright MCP | 4.6% |
| `AskUserQuestion` | 2.1% |
| `Grep` / `Write` / `Edit` | 3.1% |
| everything else | ~1.9% |

Prose-bearing tools (`Agent`, `SendMessage`, `AskUserQuestion`, `WebSearch`, `WebFetch`,
mycontext `get_item`/`load_context`) account for **8.8% of `tool_result` bytes**. So the
classifier was being asked to call that 8.8% "noise", and correctly refused.

**The structural signal beats every lexical feature and is free.** Which tool produced a block
is a lookup from `tool_use_id`; it is exact where the best lexical feature reached AUC 0.836,
and it costs nothing. `Bash` output is noise. `Agent` output is prose. That is the classifier.

### 5.4 What this means for adoption

Nothing off the shelf is worth taking for need 3. The categories were surveyed (§6.4) and each
fails on the constraints or on the task:

- **Language identifiers** (`guesslang`, `vscode-languagedetection`, `linguist`, `enry`,
  `hyperpolyglot`) answer "which programming language is this" — a different question. Most
  need a model file, a native binary, or a non-JavaScript runtime, which
  `CONST-zero-runtime-dependencies` and `CONST-node-24-no-build-step` reject outright.
- **`highlight.js` auto-detection** could in principle be repurposed as a code detector, but it
  is a highlighter being asked to be a classifier, and this project already declined to ship a
  highlighter — `DEC-markdown-it-...` records that only 20 of 117 fences carried a
  highlightable language.
- **The heuristic literature** is what §5.2 tested — and §6.4 records what it claims. The
  honest statement of what was and was not done: **single features were measured, unfitted,
  at block level. A fitted multi-feature model at line level was not tried.** The literature
  (NLoN, MSR 2018; Hirsch & Hofer, ASEW'21) claims AUC 0.95–0.99 for exactly that, so it would
  very likely do better than 0.836. What it would not do is beat the structural label, which
  is exact and free — so the experiment is only worth running if a within-prose cut turns out
  to be needed at all, and §5.3 argues it is not.

**Verdict on need 3: no usable existing tool, and the lexical approach is measurably weak on
this material. Route by record type and tool name — 20 lines, exact — and stop there. If a
residual within-prose cut is later wanted, `longestLine` and `lineLengthSD` are the two
features that earned their place (AUC 0.836 and 0.788) and both are one line each.**

---

## 6. The library survey

### 6.0 The admission test, made explicit

This project has **three** ways to take outside code, not two, and the middle one is easy to
forget:

1. **A runtime dependency.** Forbidden. `CONST-zero-runtime-dependencies`: `dependencies`,
   `optionalDependencies`, `peerDependencies` and `bundledDependencies` are all empty and stay
   empty.
2. **A vendored static asset.** Permitted, with a gate. `src/ui/public/lib/vendor/` holds
   third-party code committed unmodified, pinned by byte count and SHA-256 in `VENDOR.md`, and
   `scripts/check-vendor.ts` fails the build if a byte moves. It also fails if the file
   contains `fetch`, `XMLHttpRequest`, `Worker`, `importScripts`, `eval`, `new Function` or
   `WebAssembly`, or if it names any module specifier that is not relative and pinned in the
   same manifest.
3. **A devDependency.** Permitted and enumerated — today `typescript`, `@types/node`,
   `@playwright/test`, `mermaid`. A devDependency that never ships is how the mermaid diagrams
   are rendered ahead of time.

So the real admission test for a library here is: **is it a single self-contained file, with no
bare imports, no network access and no `eval`, that Node 24 can `import` directly?** That is a
much narrower gate than "is it on npm", and it is the reason markdown-it passed and almost
nothing else will. Anything requiring a Python runtime, a native binding, a WASM blob, a model
download or a network service at runtime fails at step 2 as well as step 1 — it is not a
close call and should not be reported as one.

**A note on how the dependency counts below were obtained**, because it changes how much they
are worth: the transitive closures were computed by walking the npm registry and resolving each
declared range to its highest matching version. Nothing was installed. They are therefore
accurate about what a package *declares* and may differ by a package or two from what a real
install deduplicates to.

### 6.1 Markdown parsers — the transitive dependency count decides, and it is not close

| Package | Version | Published | Licence | Transitive runtime deps | Unpacked |
|---|---|---|---|---|---|
| **marked** | 18.0.12 | 2026-09-07 | MIT | **0** | 472 KB |
| commonmark | 0.31.2 | 2024-09-19 | BSD-2-Clause | 3 | 657 KB |
| **markdown-it** | 15.0.1 | 2026-08-27 | MIT | 6 | 1.9 MB |
| unified (alone) | 11.0.5 | 2024-06-19 | MIT | 10 | — |
| micromark | 4.0.2 | 2025-02-27 | MIT | 27 | 205 KB |
| mdast-util-from-markdown | 2.0.3 | 2026-02-21 | MIT | **33** | — |
| remark-parse | 11.x | — | MIT | 41 | — |
| remark | 15.0.1 | **2023-09-18** | MIT | **50** | 15 KB |

The remark/unified ecosystem's smallest useful entry point for a heading extract is
`mdast-util-from-markdown` at **33 packages** — and those counts include `@types/mdast`,
`@types/unist`, `@types/debug` and `@types/ms`, because the unified packages declare `@types/*`
as real `dependencies`, so they land in a production tree. `remark` itself has had **no release
since 2023-09-18 — three years**. That whole family is out on the dependency count alone,
before the constraint is even applied.

**The 6 transitive dependencies of markdown-it are irrelevant here, and this is the point of
vendoring.** What this repository ships is the pre-bundled browser ESM file, and it was checked
today: `markdown-it.esm.min.js` contains **zero import statements and zero `require` calls** —
`argparse`, `entities`, `linkify-it`, `mdurl`, `punycode.js` and `uc.micro` are all inlined.
That is precisely why it passes `scripts/check-vendor.ts`'s rule that every module specifier
must be relative and pinned, and why a package with six declared dependencies can enter this
repository at a cost of zero.

**`marked@16.4.2` is already on disk** — MIT, **zero dependencies**, verified in
`node_modules/`, pulled in as a transitive devDependency of `mermaid@11.17.2`, which declares
`marked: ^16.3.0`. That does **not** make it eligible as a shipped dependency. It does mean it
is freely usable in tests and tooling today with no `package.json` change, which makes it the
obvious cross-check oracle for any parser written here.

### 6.2 Near-duplicate detection libraries — abandoned, native, or Python

Queried against the npm, PyPI and GitHub APIs directly on 2026-09-10, and against package
source served from jsDelivr. Nothing was installed. **Publish dates are `time[<latest
version>]`, not `time.modified`** — the latter changes on any metadata write and overstates
liveness (for `minhash` it reads 2022-05-09 while the code was last published 2018-06-02).
Download figures are npm's own counts for the week 2026-09-03 → 2026-09-09.

#### The classic names, and every one is abandoned

| Package | Version | Published | Licence | Deps | Weekly | Note |
|---|---|---|---|---|---|---|
| `minhash` | 0.0.9 | **2018-06-02 — 8 yrs** | MIT | 0 | 1,644 | the canonical JS MinHash+LSH. See the defect below. |
| `simhash` | 0.1.0 | **2012-10-25 — 14 yrs** | MIT | `buffer-crc32@0.1.x` | 118 | the oldest package in this report |
| `simhash-js` | 1.0.0 | **2017-06-29 — 9 yrs** | MIT | 0 | 675 | three files, 32-bit Charikar over Jenkins hash |
| `tlsh` | 1.0.8 | **2019-08-09 — 7 yrs** | Apache-2.0 | 0 | 925 | **requires ≥ 512 characters of input** or it throws |
| `ssdeep` | 0.1.1 | **2016-06-05 — 10 yrs** | MIT | `ffi`, `ref` | 6 | FFI wrapper over C `libfuzzy`; both deps are dead node-gyp addons |
| `shingle` | 0.0.5 | **2016-02-29 — 10 yrs** | MIT | 0 | — | |
| `string-similarity` | 4.0.4 | **2021-01-06** | ISC | 0 | **1,235,326** | **formally deprecated on npm.** Dice coefficient, pairwise, O(n²) |
| `talisman` | 1.1.4 | **2021-01-21 — 5.6 yrs** | MIT | 6 incl. `lodash` | 35,999 | richest toolbox on npm — `hash/minhash`, and a whole `clustering/` directory |
| `minhash-lsh`, `js-lsh`, `node-tlsh`, `w-shingling`, `datasketch` (JS) | — | — | — | — | — | **do not exist on npm** |

**`minhash` — the package most people land on — has a correctness defect in its core loop, and
it is the same 53-bit problem this report ran into from the other direction.** Its permutation
step is `(a * hash(str) + b) % prime` in plain JavaScript `Number` arithmetic, with `a` and `b`
drawn from 0..2^32−1 and `hash()` returning roughly 0..2^32. The product reaches ~2^64 — **2^11
times past `Number.MAX_SAFE_INTEGER`** — so low bits are silently lost before the modulus and
the "permutations" are not the universal hash family the algorithm requires. Two further
weaknesses in the same file: the string hash is the Java 31-multiplier hash, and the PRNG is
`Math.sin(seed++)`.

That is worth dwelling on, because §3.4 chose numeric shingle keys composed from **two** 32-bit
FNV rounds into a safe integer for exactly this reason. JavaScript has no 64-bit integer in
`Number`, and the most-downloaded MinHash on npm gets it wrong. **If anything here is ported,
port it from the papers, not from that file.**

`tlsh`'s 512-character minimum is a second kind of disqualification worth naming: it is a
whole-file fuzzy hash, and this project needs passage-level repeats. A large share of the prose
blocks in this archive are shorter than that.

#### The modern, dependency-free ones — and nobody uses them

| Package | Version | Published | Licence | Deps | Types | Weekly |
|---|---|---|---|---|---|---|
| `lsh.ts` | 0.1.1 | 2025-12-06 | MIT | **0** | yes | **41** |
| `superminhash` | 1.0.0 | 2025-03-29 | MIT | `seedrandom` | yes | **2** |
| `grouped-oph` | 1.1.2 | 2025-08-08 | MIT | **0** | no | **2** |
| `shingles` (WASM) | 0.1.1 | 2026-01-17 | MIT | 0 | yes | **1** |
| `simhash-ts` | 0.2.0 | 2026-06-10 | MIT | `@noble/hashes` | yes | 9 |
| `near-duplicates` | 0.2.3 | 2026-06-01 | Apache-2.0 | `xxh3-ts` | yes | 4 |
| `@counterrealist/simhash` | 1.0.2 | 2025-07-09 | MIT | `@posthog/siphash` | yes | 857 |
| `@docen/deduplicate` | 0.7.0 | **2026-09-07** | MIT | 1 | yes | 33 |
| `bloom-filters` | 3.0.4 | 2024-11-21 | MIT | **8** incl. `lodash`, `reflect-metadata` | yes | **247,993** |

**This table is the whole finding.** The three that are dependency-free *and* typed —
`lsh.ts`, `superminhash`, `shingles` — have **41, 2 and 1 weekly downloads**. The only one with
real adoption and a real MinHash inside it, `bloom-filters` at 248k/week, carries eight
dependencies including `lodash` and `reflect-metadata`, and ships no LSH index for its MinHash
anyway. **There is no maintained, typed, dependency-free MinHash+LSH in JavaScript that anyone
has validated.** `@docen/deduplicate` — published three days ago, scoped to ProseMirror
documents — is the closest thing on npm to a purpose-built repeated-passage detector, at
version 0.7.0.

**Content-defined chunking**, checked because it is the other family that solves this shape:
`fastcdc` and `node-fastcdc` are **Rust bindings via `cargo-cp-artifact`** — a Rust toolchain at
install time, flatly incompatible with `CONST-node-24-no-build-step`. `rabin-wasm` (0.1.5,
**2021-04-19**, 6 deps including `node-fetch`, 41,686 weekly) is five years unreleased and
popular only because IPFS depends on it. `gearhash-jit` (1.0.2, 2026-04-15, MIT, **zero deps**,
typed, 46,068 weekly) is the one genuinely healthy package in this entire survey — hand-written
WASM bytecode for gear-hash CDC — and `scripts/check-vendor.ts` rejects `WebAssembly` outright.

#### The reference implementations elsewhere, and why each is out

| | Version | Released | Licence | Requires | Why it is out |
|---|---|---|---|---|---|
| **`datasketch`** (Python) | **2.0.0** | **2026-07-05** | MIT | `numpy`, `scipy`, Python ≥ 3.9 | Actively maintained (2,964 stars, pushed 2026-08-09); the de facto reference for MinHash / MinHashLSH / LSH Forest / LSH Ensemble. **Disqualified by runtime, not by quality.** |
| `simhash-py` | 0.4.0 | **2017-03-22 — 9.5 yrs** | PyPI says "UNKNOWN"; repo is MIT | C++ `simhash-cpp` | A thin wrapper over a C++ extension. |
| `sourmash` | 4.9.4 | 2025-08-07 | BSD | Rust core, numpy, scipy, cffi | Genomics FracMinHash. Its scaled-sketch variant is the right idea for wildly uneven document sizes, and it is a Rust extension. |
| `ssdeep` / TLSH (C originals) | — | 2026-08-13 / 2026-07-10 | **GPL-2.0** / NOASSERTION | native | GPL alone is disqualifying for `ssdeep`; the Node binding path is dead. |
| Spark `MinHashLSH` | — | — | Apache-2.0 | JVM + Spark | See below — it is *weaker* than textbook banding. |

**Google never released a SimHash implementation.** The WWW 2007 paper states that its authors
used "the original C++ implementation of simhash, done by Moses Charikar himself", which was
never published. Every "Google simhash" in the wild is a reimplementation from the paper —
including the one measured in §3.3.

**Spark's `MinHashLSH` corrects a common assumption.** Read from `LSH.scala` on `apache/spark`
master: `setDefault(numHashTables -> 1)`. Spark does **OR-amplification only** — independent
tables of one hash each, i.e. r = 1 — so it has no S-curve and no threshold knob at all; you
trade false negatives against cost and nothing else. Its cited reference is the Wikipedia
MinHash article, not a paper. **The industrial reference implementation is less capable than
the textbook one**, which is worth knowing before "but Spark has it" is treated as an argument.

#### The papers, and exactly what they claim

All figures below are the authors' own, extracted from the paper text. **None was reproduced
here**, and none was measured on Node, in TypeScript, or at 8 MB.

**Broder, Glassman, Manasse & Zweig — "Syntactic Clustering of the Web", SRC TN 1997-015 /
WWW6, 1997.** The origin of *w*-shingling. On a 1997 AltaVista crawl: **30,000,000 documents,
150 GB**; **10-word shingles** fingerprinted to **40 bits** each; **1-in-25 sampling** yielding
~600M shingles and a 3 GB sketch file; clustering at **50% resemblance** produced **3.6 million
clusters covering 12.3 million documents**, of which 2.1M clusters (5.3M documents) were
identical documents. Total cost **~10.5 CPU-days** (sketching 4.6, shingle merge 1.7, ID-ID
merge 2.6, cluster formation 0.5). Those are 1997 DEC Alpha CPU-days and say nothing about
modern throughput; what they establish is the canonical parameter set.

**Charikar — "Similarity Estimation Techniques from Rounding Algorithms", STOC 2002.** A
**theory paper with no corpus benchmark.** It defines the LSH property
`Pr[h(x) = h(y)] = sim(x,y)` and derives the random-hyperplane family. **Attribute no
throughput or accuracy number to it — there is none.** The name "simhash" is Manku's, applied
five years later. It estimates **cosine**, not Jaccard, which is why §3.3 compares the methods
at their own thresholds rather than pretending the numbers measure the same quantity.

**Manku, Jain & Das Sarma — "Detecting Near-Duplicates for Web Crawling", WWW 2007.** The paper
everyone cites, and the source of §3.3's Hamming ≤ 3.

- Verbatim: *"With simhash, for 8B web pages, 64-bit fingerprints suffice."*
- **8B = 2^34 fingerprints × 64 bits = 64 GB**, compressed to **under 32 GB**.
- Online target: decide within **a few milliseconds** whether any fingerprint differs in at
  most **k = 3** bits. Batch: **1M queries in ~100 s**, which they state as **1B queries/day**.
- Why the naive approach fails: 64-bit fingerprints at k = 3 need **C(64,3) = 41,664 probes** —
  "prohibitively large". Their contribution is the permuted-table scheme that avoids this.
- Their stated advantage over Broder: shingle fingerprints need **24 bytes**, a 64-bit simhash
  needs **8** — a 3× storage win.
- **On the justification for k = 3, be precise: the paper gives no precision/recall table.**
  §4.1 describes sampling pairs at each Hamming distance from 1 to 10 over 2^34 fingerprints
  and hand-tagging them true positive / false positive / unknown per Henzinger's guidelines,
  and the result appears **only as a plotted curve (Figure 1)**. Anyone quoting a precision
  number for k = 3 is quoting something the paper does not state.
- **And the scale gap should be said out loud: 8 billion documents there, 7,543 prose blocks
  here.** 64-bit with k = 3 is calibrated to d = 34 bits of address space. At the ~13 bits this
  corpus occupies, the entire table-permutation apparatus is unnecessary — which §3.3 measured
  directly: all 3,136,260 pairs compared by brute force in **20 ms**.

**Li & König — "b-Bit Minwise Hashing", WWW 2010.** Abstract claim: storing only **b** bits per
hashed value instead of 64 gives, at **b = 1**, a storage reduction of **at least 21.3×** for
resemblance > 0.5. Taken from the abstract, not re-derived.

**Li, Owen & Zhang — "One Permutation Hashing", NIPS 2012.** Frames k = 500 permutations as
"prohibitive" preprocessing; permutes columns **once**, bins them, and keeps the smallest
nonzero location per bin. The stated result is a **theoretical** equivalence — OPH "should
perform very similarly to the original" — not a measured speedup. Its known weakness is empty
bins, fixed by the densification work that followed (Shrivastava & Li, 2014). **This is the
most relevant algorithmic result in the list for a single-machine job**, because it turns K
passes into one — and it is also the result §3.3 makes moot, since exact shingling needs no
such pass at all.

**Ertl — "SuperMinHash", arXiv:1706.05698, 2017.** The abstract claims "a better runtime
behavior" and "a more precise estimation of the Jaccard index" and **states no numbers at all**
— no complexity bound, no variance factor, no benchmark. Any specific constant attributed to
SuperMinHash comes from the body or from third parties. Recorded this way rather than quoted.

#### Practical parameter guidance from the primary sources

**Shingle size** (Leskovec, Rajaraman & Ullman, *Mining of Massive Datasets*, §3.2.2): *"k
should be picked large enough that the probability of any given shingle appearing in any given
document is low."* Their cases: **k = 5** character shingles for email (27^5 ≈ 14.3M possible,
against emails far shorter than 14M characters), and **k = 9 "considered safe"** for research
articles, hashed into 32-bit buckets so each costs 4 bytes rather than nine.

**A trap worth naming, because it is an order-of-magnitude error:** MMDS's k = 5 and k = 9 are
**character** shingles; Broder's w = 10 is **word** shingles. Both conventions are standard and
the literature does not always say which. **This report uses word shingles throughout** —
8-word for the exact index, 5-word for Jaccard sets, 4-word for SimHash.

**The banding formula** (MMDS §3.4.2), which is the thing people take a dependency to get
right. With **b** bands of **r** rows and a pair at Jaccard **s**: candidate probability
**1 − (1 − s^r)^b**, threshold ≈ **(1/b)^(1/r)**. Their worked example at signature length 100,
b = 20, r = 5:

| s | 0.2 | 0.3 | 0.4 | 0.5 | 0.6 | 0.7 | 0.8 |
|---|---|---|---|---|---|---|---|
| P(candidate) | .006 | .047 | .186 | .470 | .802 | .975 | .9996 |

At s = 0.8 only **about one pair in 3,000** fails to become a candidate. It is four lines of
arithmetic and is not a reason to take a dependency.

**And the most directly reusable table found anywhere** — `datasketch`'s `MinHashLSH`
optimiser, which searches all (b, r) at `num_perm = 128` to place the S-curve's transition at a
requested threshold:

| threshold | 0.3 | 0.5 | 0.7 | 0.9 |
|---|---|---|---|---|
| (bands, rows) | (37, 3) | (25, 5) | (14, 9) | **(5, 25)** |

Note b·r ≤ 128 with the remainder discarded, and the pattern: **high thresholds want few bands
of many rows, low thresholds want many bands of few rows.** §3.2 used (32, 4) for a threshold
of ≈ 0.42, which this table places between its 0.3 and 0.5 rows — consistent.

**The `datasketch` caveat that matters most for this project**, from its own documentation and
therefore a claim: on a near-duplicate corpus, precision and recall sit in the **0.92–1.0** band
at every `num_perm`, with query times **~0.03 ms — over 100× faster than a linear scan**. But
on a clustering corpus whose similarity mass sits *near* the threshold, precision falls to
**0.69–0.77** and recall to **0.69–0.84**, and the speedup collapses to **about 6×**.

**A corpus of closely related project documents and sessions is the second case, not the
first.** That is the strongest available argument — from the leading library's own published
numbers — that LSH's advantage here would be single-digit at best, before this project's
constraints are applied at all.

#### MCP servers for near-duplicate detection

The official registry returns **zero servers** for `minhash`, `near-duplicate` and
`text dedup`. `dedup` returns two, neither relevant — one dedupes **HTTP requests** on
Cloudflare Workers, the other is a listing with nothing behind it. `similarity` returns five,
four of them duplicate listings of a **music** similarity service.

The only genuine hit anywhere is **`mcp-programmatic-seo` v0.1.0, published 2026-08-23** — a
three-week-old first release scoped to auditing programmatic SEO sites. `adietish/dedupe-mcp`
detects **duplicate code** via ast-grep rules; `@opensip-cli/clone-detection` is function-body
clone detection.

**There is no MCP server offering corpus-level near-duplicate or repeated-passage detection.**
If this project wanted that behind MCP it would be building it, not adopting it.

### 6.3 Keyphrase extraction — every JavaScript implementation is abandoned

| Package | Version | Last publish | Licence | Deps | Note |
|---|---|---|---|---|---|
| rake-js | 0.1.1 | **2017-07-15 — 9 yrs** | **LGPL-3.0** | 8 | depends on `snowball@0.3.1`, **published 2011-03-10, no licence field** |
| node-rake | 1.0.1 | **2018-03-21 — 8 yrs** | MIT | 0 | 12 KB |
| rake-modified | 1.0.8 | **2021-06-22 — 5 yrs** | MIT | 10 | pulls the deprecated `fs-promise`/`mz` chain |
| textrank | 1.0.5 | **2017-03-25 — 9 yrs** | ISC | 0 | |
| keyword-extractor | 0.3.0 | 2026-08-13 | **no licence field** | 0 | stopword-list only, not RAKE |
| retext-keywords | 8.0.2 | 2024-10-23 | MIT | 10 | needs the retext/unified pipeline above it |

`node-textrank` does not exist on npm. **There is no YAKE port on npm at all.** `rake-js`'s
LGPL-3.0 is a second, independent disqualifier beyond its age.

Every RAKE and TextRank implementation on npm is a project abandoned between five and nine
years ago, and the one with a stemmer reaches a package published in 2011. **That is a finding,
not a gap to work around**: these algorithms are 50–150 lines and the packages add nothing but
risk. Since §2.4 already rules keyphrase extraction out on design grounds — the brief asks for
declared subjects, not invented ones — none of this needs deciding.

**The papers, and what they claim.** All figures are the authors', not measured here.

- **RAKE** — Rose, Engel, Cramer & Cowley, *Automatic Keyword Extraction from Individual
  Documents*, in *Text Mining: Applications and Theory*, Wiley 2010, pp. 1–20. On Inspec (500
  abstracts): claimed **precision 33.7, recall 41.5, F 37.2**. The speed claim is the more
  interesting one: **160 ms for all 500 abstracts against TextRank's 1,002 ms.**
- **TextRank** — Mihalcea & Tarau, EMNLP 2004. Inspec: claimed **precision 31.2, recall 43.1,
  F 36.2**, undirected co-occurrence graph, window 2.
- **YAKE** — Campos et al., *Information Sciences* 509 (2020) 257–289. Compared against ten
  unsupervised baselines across 20 datasets. **The per-dataset F1 table could not be retrieved
  without ScienceDirect access and is therefore not quoted here.** What is safe to state is the
  paper's own framing: corpus-free, single-document, language-independent, five cheap local
  features.
- **c-value/NC-value** — Frantzi, Ananiadou & Mima, IJODL 2000. Named because it is the one
  designed for nested multi-word technical terms, which is what this corpus's item ids are. No
  JS implementation of any quality exists.

Note the F-measures: **all three sit in the 36–37 range.** These are not accurate methods; they
are cheap ones. That is a further argument for not building selection on them.

### 6.4 Signal/noise detectors — every one fails the constraint, and mostly the task too

- **`guesslang`** — Python only, no npm package. PyPI 2.2.1, MIT, **uploaded 2021-08-01**, and
  its metadata pins `tensorflow==2.5.0`. Its claim: **93.45% accuracy over 54 languages on
  230,000 source files** (project's own docs). Disqualified on runtime, on age, and on task —
  it answers "which language", not "is this prose".
- **`@vscode/vscode-languagedetection`** — v1.0.23, MIT, 2026-01-19, and its npm metadata says
  **zero runtime dependencies**, which is misleading. TensorFlow.js is *webpacked into the
  shipped bundle* (`dist/lib/index.js` 706 KB + `dist/lib/979.js` 122 KB), and it ships
  guesslang's converted model (`model.json` 243 KB + **716 KB of weights**). 1.77 MB total. No
  runtime download, but it is a neural model executing in-process, and `check-vendor.ts` would
  reject the bundle on sight. Microsoft publishes no accuracy figure; it inherits guesslang's.
- **`linguist` (Ruby), `hyperpolyglot` (Rust), `enry` (Go)** — **there is no JS or WASM build
  of enry on npm**; `enry`, `go-enry`, `go-enry-wasm` and `@gitsense/enry` all 404. The JS
  route is `linguist-js` (3.0.3, ISC, 2026-08-22, 9 transitive deps), which is *filename-driven
  language attribution for repositories* — a different job from classifying a loose passage.
- **`highlight.js`** — 11.12.0, BSD-3-Clause, 2026-08-12, zero runtime deps but **5.4 MB across
  1,569 files**. `highlightAuto` scores the input against every registered grammar by an ad-hoc
  relevance integer. **No accuracy has ever been published by the project.** Its documented
  failure mode (issue #1213) is JavaScript reliably misdetected as YAML. The recommended
  mitigation is to pass an explicit `subset`, which concedes that the general case does not
  work. This project already declined to ship a highlighter.
- **`franc`** — 6.2.0, MIT, 2024-01-11, 3 deps. Natural-language ID by character trigrams. Fed
  a stack trace it returns a human language with confidence. Not applicable, though the
  trigram-profile technique itself is adaptable and free.
- **`istextorbinary`** — 9.5.0, **Artistic-2.0**, 2023-12-29, 4 deps. Text-vs-binary, not
  code-vs-prose.
- **`detect-indent`** — 7.0.2, MIT, 2025-09-16, **zero deps, 10 KB, 5 files**. The only one
  small enough to simply read and reimplement, and indentation regularity is a real feature.

**The heuristics literature, which is the substantive answer, and its claims.**

- **Mäntylä, Calefato & Claes, "Natural Language or Not (NLoN)", MSR 2018** (arXiv:1803.07292)
  — this is *exactly* the problem: separating natural language from logs and code in developer
  communication, at line level. Eleven features (ratios of characters, capitals, specials,
  numbers, stopwords; word length; sentence length; average word length per sentence;
  type-token ratio; hapax ratio) plus character trigrams, Lasso via glmnet. Claimed
  **within-source AUC 0.976–0.987**, and — the caveat that matters — **cross-source AUC
  0.913–0.980**, degrading when applied to a source it was not fitted on.
- **Hirsch & Hofer, "Identifying non-natural language artifacts in bug reports", ASEW'21**
  (arXiv:2110.01336) — claimed **ROC-AUC 0.95, F1 0.93**, and **10,000 lines in ≈0.72 s**.
- **Bacchelli, Dal Sasso, D'Ambros & Lanza, "Content classification of development emails",
  ICSE 2012** — five classes (text, code, stack trace, patch, junk), claimed **accuracy 89–94%,
  F up to 0.945**.
- **"Irish: A Hidden Markov Model to detect coded information islands in free text"**, *Science
  of Computer Programming*, 2015 — treats it as sequence labelling. Directly relevant: code
  arrives in *runs*, so line class is strongly autocorrelated and a two-state smoothing pass
  over per-line scores costs nothing.

**How to read this literature against §5.2.** These papers report AUC 0.95–0.99 at **line**
level on **bug reports and mailing lists**, having **fitted** their weights on labelled data
from that source. §5.2 measured single features at **block** level on **this** corpus with **no
fitting** and got 0.836 at best. Those are not contradictory results; they are different
experiments. The papers' own cross-source number — NLoN's AUC dropping to 0.913 off its
training source — is the honest warning that an unfitted transfer to this material would land
lower still. Nothing here is transferable as a *library*, but the feature list is worth having,
and two features this project would add (indentation regularity, identifier-casing share) are
absent from NLoN.

### 6.5 MCP servers for lexical search — there is nothing either

§6.2 already reported the near-duplicate half of this search. This is the retrieval half,
and it comes out the same way. The MCP registry API was queried directly (`registry.modelcontextprotocol.io/v0/servers?search=`)
for `bm25`, `full-text`, `lexical`, `keyword`, `keyphrase`, `index` and `search`.

- **`bm25`, `full-text`, `lexical`: zero results.**
- **`keyword`**: 20 results, all SEO and commercial API wrappers (search volume, CPC,
  job-board scanners) or hosted extraction APIs. Nothing local.
- **`keyphrase`**: exactly one — `io.github.IvanRublev/keyphrases-mcp`. Python, MIT, **1 star,
  11 commits**, KeyBERT + spaCy `en_core_web_trf` + a MiniLM sentence transformer, so PyTorch
  and two model downloads. It does not build an index.
- The official `modelcontextprotocol/servers` reference set — everything, fetch, filesystem,
  git, memory, sequential-thinking, time — contains **nothing** for full-text retrieval, BM25,
  keyword extraction or corpus indexing.

The three community servers closest to the description, each checked individually:

| Server | Runtime | Why it fails |
|---|---|---|
| `mtorange/mcp-local-file-search` (npm 1.1.2, MIT, 2025-07-11) | Node | Genuinely indexes a local directory with BM25 — the closest match. **1 star, 9 commits**, and its dependencies include `natural`, so it inherits that closure (below). |
| `johnhuang316/code-index-mcp` (MIT, **1,000+ stars, 257 commits**) | Python 3.10+ via `uv` | Best-maintained in the space, no model download — but its backend is `ripgrep`/`ugrep` plus tree-sitter. **Grep with a symbol index, not BM25 and not keyphrase extraction.** |
| `@tobilu/qmd` (npm 2.8.3, MIT, 2026-08-16) | Node | "On-device hybrid search for markdown with BM25, vector search, LLM reranking" — conceptually closest. Depends on `node-llama-cpp`, `better-sqlite3`, `sqlite-vec` and four tree-sitter native grammars. **Native binaries plus a local LLM.** |

**The pattern is unambiguous: the MCP ecosystem's "search" servers are RAG servers.** Nobody
has shipped a plain, well-maintained, dependency-light lexical index over local files, and the
registry's keyword namespace has been colonised by SEO vendors.

**And an MCP server would not help even if one existed.** The brief asked to evaluate this
shape separately because it escapes the dependency constraint, and that is true — an MCP server
is a separate process, not an entry in `dependencies`. But it does not escape the *product*
constraint. This plugin's pitch is installing without fetching packages; a feature that only
works when a Python server with a PyTorch model is also installed and running is not a feature
this plugin can ship. An MCP server is a viable shape for a *developer's own tooling* on this
machine, and not for the retrieval feature.

### 6.6 The NLP toolkits, and one genuinely surprising finding

| | Version | Published | Licence | Deps | Unpacked | Model? |
|---|---|---|---|---|---|---|
| wink-nlp | 2.4.0 | 2025-06-30 | MIT | **0** | 640 KB | needs `wink-eng-lite-web-model` (3.7 MB, separate package) |
| compromise | 14.17.0 | **2026-09-10** | MIT | 3 | **2.7 MB / 493 files** | no, lexicon bundled |
| natural | 8.1.1 | 2026-02-27 | MIT | **50** | **13.5 MB / 246 files** | no |

**`natural` declares 14 direct dependencies which close over 50 packages, and among the
direct ones are `mongoose`, `pg`, `redis` and `memjs` — hard, not optional** — three database drivers and a memcached client, shipped for
its optional classifier-persistence backends. Installing `natural` installs MongoDB, Postgres
and Redis clients. Worth recording because `natural` is the package most casually recommended
for exactly this kind of work, and because the one MCP server closest to the brief (§6.5)
depends on it. It is also worth recording that `natural` contains **no MinHash, SimHash or
LSH at all** — only Dice coefficient, Jaro-Winkler and n-grams — so it would not have
answered need 2 even if it were admissible.

`wink-nlp` is the cleanest (zero deps, 640 KB, ships types) and its BM25 vectoriser is
well-built, but with its model package the real install is ~4.3 MB — for something FTS5 already
does in-process for nothing.

### 6.7 Zero-dependency implementations worth reading as sources, not taking as dependencies

All MIT, all verified zero or near-zero deps. Named because porting is the recommendation, and
a good reference implementation shortens a port:

- **`@kurajs/search@0.1.0`** (2026-07-10, zero deps, 22 KB) — explicitly "portable and
  zero-dependency" BM25; the smallest complete thing to read.
- **`okapibm25@1.4.1`** (2024-09-09, zero deps, 68 KB) — straightforward Okapi BM25.
- **`minisearch@7.2.0`** (2025-09-16, zero deps, 807 KB) — a mature inverted-index engine with
  prefix and fuzzy search.
- **`porter2@2.0.0`** (2026-06-17, zero deps) / **`stemmer@2.0.1`** (2022-11-02, zero deps) —
  Porter and Porter2, if stemming is ever wanted outside FTS5.
- **`stopword@3.1.5`** (2025-06-13, zero deps) — stoplists.

The BM25 entries are listed for completeness and should be read once and then set aside:
**FTS5's `bm25()` is already in the process** (§4.1), and reimplementing BM25 in JavaScript to
sit beside a C implementation that ships with the runtime would be a mistake.

---

## 7. Verdict

| Need | What exists | Cost | Survives the constraints | Verdict |
|---|---|---|---|---|
| **1. Subjects from structured documents** | markdown-it 15.0.1 — **already vendored here**, verified importable under Node | 0 new bytes, 0 new deps; 536 ms for 7.53 MB | **Yes** — already gated by `check-vendor.ts` | **Use what is already in the tree.** ~60 lines of token walking. |
| **2. Near-duplicate / repeated passages** | MinHash/SimHash/LSH packages — **all 5–14 years abandoned**; the maintained reference (`datasketch`) is Python + numpy + scipy | MinHash measured 6.5× slower than 40 lines of exact shingling, for the same pairs | No maintained, typed, dependency-free option exists | **Implement it. ~40 lines.** Numeric shingle keys; SimHash (~25 lines) if a fuzzier match is ever needed. |
| **3. Signal vs noise without a model** | Nothing usable | best lexical feature AUC 0.836; 2-rule classifier 47% FP | Model-based detectors fail outright | **Nothing to adopt.** Route by record type and tool name — exact, and already half-written. |
| **4. Match against a known vocabulary** | **SQLite FTS5 inside `node:sqlite`** | 0 deps; 0.2 s to index the whole archive, 0.246 ms/query, **3.5 MB index** | **Yes** — Node builtin already imported in 14 files | **Adopt. It is free.** Plus ~40 lines of Aho–Corasick for annotation. |
| *(the MCP shape, evaluated separately)* | Nothing in the registry; three near-misses, all needing Python, native binaries or a local LLM | — | **No** — not on the dependency constraint but on the product one | **Not a route for the shipped feature.** |

**The plain answer to "which of these is worth pursuing".** One thing is worth adopting and it
is already installed: **SQLite FTS5 via `node:sqlite`**. One thing is worth reusing and it is
already vendored: **markdown-it**. The other two needs should be written here, in about 150
lines between them, and would be worse if they were not — the exact-shingle index is measurably
faster than the library alternative, and no library exists for need 3 at all.

**What a reader should take away about the libraries specifically.** The survey found no
candidate that both does the job and survives §6.0's admission test, and it is worth being
precise about *why*, because the two failure modes are different. The Markdown parsers fail on
dependency count (33–50 packages for the mdast route), except the two that this project has
already solved for. The near-duplicate and classification packages mostly fail on
**abandonment** — nine years, eight years, five years — or on carrying a model, a native
binary or a foreign runtime. And the MCP servers fail on neither: they fail because the whole
category turned into RAG, and a plugin whose pitch is installing without fetching packages
cannot depend on a PyTorch process.

The single largest risk to this feature is not a missing library. It is spending the effort on
the 99% of bytes that a `type` field already sorts, instead of on §4.3's question — **which
vocabulary the session text is matched against** — which is where the measured results varied
by a factor of seventeen.

---

## 8. Method, so the numbers can be re-run

All scripts were written to the session scratchpad, not to the repository, and are described
rather than committed. Each is 20–60 lines of plain Node 24 with no dependencies.

| What | How |
|---|---|
| Archive size and file count | `find` over `~/.claude/projects/D--Users-UserC-source-repos-my-context`, recursive, `.jsonl` only |
| Composition sample | 288 files sorted by size, 12 drawn at even rank intervals; every record `JSON.parse`d; bytes attributed per content block |
| **Composition census** | **all 290 files, every record parsed** — this is what §1.2b reports and it supersedes the sample's 3.45% |
| Prose extraction | `assistant` → `text` blocks and `user` string/`text` content. Sample: 3,395 blocks, 3.68 MB. Census: 7,543 blocks, 7.71 MB |
| Shingling | lowercase, whitespace-collapsed, 8-word overlapping shingles (5-word for Jaccard sets) |
| MinHash | FNV-1a 32-bit with per-permutation seeds, K = 128, LSH b = 32 × r = 4 |
| Feature AUC | all-pairs rank comparison between the two labelled populations, ties at 0.5 |
| FTS5 probe | `node:sqlite` `DatabaseSync`, `PRAGMA compile_options`, live `CREATE VIRTUAL TABLE` for each feature |
| markdown-it under Node | `await import('file:///.../src/ui/public/lib/vendor/markdown-it.esm.min.js')` |
| Node | v24.14.0; bundled SQLite 3.51.2 |

**Registry facts.** Versions, licences, publish dates and dependency counts in §6 were
obtained from the npm, PyPI and GitHub APIs directly, from package source served by
jsDelivr, and — for transitive closures — by walking the registry and resolving each declared
range to its highest matching version. Publish dates are `time[<latest version>]`, never
`time.modified`, which changes on metadata writes and overstates liveness. Eight npm and
three PyPI manifests were additionally re-checked from this session directly. **Nothing was
installed.** Those closures are accurate about what a package
*declares*, and may differ by a package or two from what a real install deduplicates to. Two
claims were additionally verified against this machine's `node_modules/`: `marked` is 16.4.2,
MIT, zero dependencies, and `mermaid` is 11.17.2 declaring `marked: ^16.3.0`. The vendored
`markdown-it.esm.min.js` was checked for module specifiers and contains **zero**.

**What is a claim and what is a measurement, one last time.** §1–§5 are measurements taken on
this machine today and can be re-run. §6 is a survey: its version numbers, licences and dates
are registry facts; its accuracy figures are the numbers papers and projects publish about
themselves and are labelled as such throughout. No benchmark from §6 was reproduced here, and
§6.3 explains why the two sets of numbers are not comparable even where they look like they are.

**What was not done.** No Playwright, no e2e specs, no test suite — another lane owns the
browser. The UI server on 58888 was not touched. Nothing was installed; `npm install` was never
run. `package.json` is unchanged, and no corpus item was created — closing mode is in force.

---

## 9. Sources

**Primary — this machine.** Node v24.14.0 with bundled SQLite 3.51.2; the transcript archive at
`~/.claude/projects/D--Users-UserC-source-repos-my-context/`; this repository's
`src/core/conversation-index.ts`, `src/ui/read-model.ts`, `src/ui/public/lib/vendor/VENDOR.md`
and `scripts/check-vendor.ts`; and the corpus items
`CONST-zero-runtime-dependencies`, `CONST-node-24-no-build-step` and
`DEC-markdown-it-is-vendored-as-the-tokeniser-and-the-drawings`.

**Primary — registries, queried 2026-09-10.** `registry.npmjs.org`, `api.npmjs.org/downloads`,
`pypi.org/pypi/<pkg>/json`, the GitHub REST API, the jsDelivr data API, and the MCP registry at
`registry.modelcontextprotocol.io/v0/servers`.

**Papers.** Broder, Glassman, Manasse & Zweig, *Syntactic Clustering of the Web*, DEC SRC
Technical Note 1997-015 / WWW6, 1997 · Charikar, *Similarity Estimation Techniques from
Rounding Algorithms*, STOC 2002, 380–388 · Manku, Jain & Das Sarma, *Detecting Near-Duplicates
for Web Crawling*, WWW 2007, 141–150 · Li & König, *b-Bit Minwise Hashing*, WWW 2010 · Li, Owen
& Zhang, *One Permutation Hashing*, NIPS 2012 · Ertl, *SuperMinHash*, arXiv:1706.05698, 2017 ·
Leskovec, Rajaraman & Ullman, *Mining of Massive Datasets*, ch. 3 · Mihalcea & Tarau,
*TextRank*, EMNLP 2004 · Rose, Engel, Cramer & Cowley, *Automatic Keyword Extraction from
Individual Documents*, in *Text Mining: Applications and Theory*, Wiley 2010, 1–20 · Campos et
al., *YAKE!*, *Information Sciences* 509 (2020) 257–289 · Frantzi, Ananiadou & Mima,
*C-value/NC-value*, IJODL 2000 · Mäntylä, Calefato & Claes, *Natural Language or Not (NLoN)*,
MSR 2018, arXiv:1803.07292 · Hirsch & Hofer, *Identifying non-natural language artifacts in bug
reports*, ASEW'21, arXiv:2110.01336 · Bacchelli, Dal Sasso, D'Ambros & Lanza, *Content
classification of development emails*, ICSE 2012 · *Irish: A Hidden Markov Model to detect
coded information islands in free text*, *Science of Computer Programming*, 2015.

**Project sources read rather than cited second-hand.** `ekzhu/datasketch` (source and docs) ·
`apache/spark` `mllib/.../feature/LSH.scala` · `duhaime/minhash` (source) · `idealista/tlsh-js`
· `seomoz/simhash-py` and `simhash-cpp` · `microsoft/vscode-languagedetection` (published
bundle contents) · `highlightjs/highlight.js` issue #1213 · `modelcontextprotocol/servers`.
