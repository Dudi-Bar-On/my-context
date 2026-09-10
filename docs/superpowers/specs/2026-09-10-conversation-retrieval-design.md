# Conversation retrieval: finding your way back

**Status:** APPROVED by the owner 2026-09-10. Assigned **D42**.
**Brainstormed:** 2026-09-10, with the owner, over one session.
**Not started.** No code exists. The D map carries the number and the reasoning.
**Depends on:** D37 (the conversation archive), which is 53 of 54 done.

---

## 0. Where this came from

The owner described a failure he has lived through, in his own words:

> *"i used to work on a subject while developing my project, because a specific
> issue took a very long time (and i didn't have a tool like mycontext) the
> development started to diverge and drift and in some point i felt lost and panic
> about how could i come back to anchors i had and to the main workplan that at
> least in the context memory could not be found anymore."*

And the observation that makes it solvable:

> *"we actually could have a very long time history … these facts enable us to
> reconstruct / restore / query / investigate and many other alike activities that
> are far away bigger then what a limited context window can show."*

**The context window is the only part of this system that forgets.** Everything
else is on disk, indexed, and readable. This design is about asking questions of
something we already have.

---

## 1. The problem, measured

**The archive is already built and already large.** Measured 2026-09-10 across
`~/.claude/projects`: **19 project directories, 900 transcripts, 368,585
records** — 31 sessions at 322.4 MB and **869 lane transcripts at 1,432.5 MB**.
`plan:loop seq:2` reads a whole workspace — 816,525,094 bytes, 152,312 records,
281 sources — in **3.3 seconds**.

**And the drift is not hypothetical in this project either.** This very session
compacted; the coordinator lost facts and rebuilt them from the transcript, told
the owner an item was filed, then told him it was not, and **both were wrong** —
settled only by reading the record. The handover file exists precisely because
context is lost, is written by hand, and is stale the moment it is written.

**The prose is 0.97% of the bytes.** A full census of all 290 transcript files in
this workspace, 793.6 MB, finds **7.71 MB of prose**. The reduction is done by
reading a record's `type` field, which `classifyTurn`
(`src/core/conversation-index.ts`) already does in thirteen lines. The whole
recommended pipeline runs over the whole archive in **8.1 seconds** with a
**3.5 MB index**.

**So nothing here is a performance problem**, and nothing justifies a dependency
bought for performance. That single measurement removes most of the design space
that would otherwise need arguing about.

---

## 2. What this is NOT

**It is not a summariser.** The owner was explicit:

> *"my say about summary is not because of its content but it is more about
> filtering huge amount of noise and irrelevant data like scripts, output and
> alike."*

So the work is **selection**, not generation. That matters beyond cost: selecting
the owner's words and the measured outcomes is not the assistant's reasoning fed
back to itself, which is the **Echo Gap** that
`2026-09-08-self-improvement-loop-design.md` §13 names — an agent preferentially
reusing its most confident mistakes.

**It is not a search box that pastes into the context.** §8 is the whole of why.

**It is not a replacement for the corpus.** The corpus holds what governs; this
holds what happened. Retrieval joins them (§5) and never blurs them.

---

## 3. The primary entry point: reconstruct from what you copied

**The strongest way in is a passage the owner selected in the viewer.**

Every extraction method is a guess at what he cares about. **A selection is not a
guess.** It inverts the hard problem: instead of *find the subjects, then pick
one*, it becomes *here is the thing — find everything related to it*.

**And the research says exactly why it will work.** Matching against the archive
as FTS5 queries: headings matched **4%**, word-bags **32%**, and **corpus item-id
slugs 68%**. Aho–Corasick over backticked identifiers found **39 terms per
block**. *The heading was the wrong unit; the NAME is the right one* — and a
passage worth copying is dense in names: item ids, file paths, function names,
command spellings, commit hashes.

**The machinery already ships.** `plan:archive seq:17` gave three copy formats;
`seq:42` put `Ctrl+C` on the well with a pre-fetch on selection so the key always
yields message text. "Reconstruct from this" is one more thing to do with a
selection the reader already has.

---

## 4. The four modes of the first round

The first round is **itself a choice**, scoped by session name and date range
(§12). All four ship in the first build, by owner ruling.

| mode | answers |
|---|---|
| **from selection** | *here is a passage — find everything related to it* (§3, primary) |
| **free text** | *I remember roughly what it said* |
| **list subjects** | *I am lost — what was being worked on?* |
| **list anchors** | *where were the fixed points?* |

**Rounds compose.** A first round may return a list of subjects; the owner picks
one; a second round extracts what he actually wants from it. Same principle every
time: **the result goes to a file, the file is rendered for him, he decides what
happens next** (§9, §10).

---

## 5. What a subject is

**Subjects come from the documents the session references** — specs, designs,
plans, roadmaps, architecture and gap documents — and the session text is matched
against that vocabulary. Owner ruling: those documents *are* the developer-domain
vocabulary, already written down, in the project's own words.

**Not clustering.** D33 measured what naive lexical matching does when nothing
anchors it: 88% of its candidate pairs involved a single item, because
`containment × 0.8` was measuring **length rather than subject**.

**Corpus first, leftovers surfaced.** Match against what the corpus and the
documents already name; show what did not match as unnamed threads the owner can
name or ignore. The leftovers are themselves a signal — work happening that no
item covers.

**The unit is the NAME, not the heading**, per §3's measurement. Headings give
structure; identifiers give matches.

**Depth is a knob he chooses.** A shallow pass reads titles and headings; a deep
pass reads the documents fully. Owner ruling: *"how deep to go and how much
effort to put on it may be a selectable option that the user could choose from."*

**Extraction is already solved in-tree.** markdown-it 15.0.1 is vendored
(`DEC-markdown-it-is-vendored-as-the-tokeniser-and-the-drawings`), imports and
parses under Node 24 unchanged in 4 ms with **zero import statements**, and found
**4,348 headings and 59,600 inline-code spans over 7.53 MB in 536 ms**. A regex
gets the headings but **misses 44% of the inline code** — and inline code is what
this actually runs on.

---

## 6. What noise is

**Reuse the document's own classification.** `plan:archive seq:13` already sorts
every node into **said · work · deed** and folds the machinery away. Retrieval
keeps what was stated and what was decided. One classification serving both the
screen and the query, so they can never disagree about what matters.

**Plus the owner's repeat rule**: *"if a group of sentences or other text repeats
more than once in the session it could be considered noise."* Confirmed by
measurement — the top repeated 8-gram in this corpus is **an injected harness
note appearing 195 times**.

**Implement the duplicate detection; do not adopt it.** Measured on identical
data: an exact 8-gram inverted index found **60 pairs in 629 ms**; SimHash **64 in
677 ms**; MinHash K=128 with LSH **62 in 4,065 ms**. SimHash's brute-force
comparison of **all 3,136,260 pairs took 20 ms** — at this scale LSH solves a
problem that does not exist. About **40 lines**.

**And one negative finding that must not be softened.** Classifying a passage as
signal or noise *lexically* does not work. Punctuation density — the feature
everyone reaches for — scored **AUC 0.499, a coin flip**; the best single feature
reached 0.836, and a two-rule classifier still admitted **47% of the noise**. The
reason is the finding: **much `tool_result` content IS prose.** Route by tool name
instead, which is exact and free: `Bash` is **65.5%** of `tool_result` bytes,
prose-bearing tools **8.8%**.

---

## 7. Anchors

**An anchor is a fixed point the owner can steer back to** — the thing he lost.

**Set two ways.** He marks one deliberately; and things that are anchors by nature
are marked automatically — **a table, a report**, a ruling he gave, a D
assignment, a plan, an item created. Owner ruling: *"these could be done
automatically by the assistant without requiring the user to initiate one."*

**Fields:** `id`, `timestamp`, **a position marker** (byte offset from the start
of the transcript), the session, and a label.

**Stored as a TABLE in the conversation index, not as a corpus category.** An
anchor is a bookmark into the archive, not governing knowledge, and putting it in
the corpus would force `list`, `ready`, `doctor`, the budgets and the injection
selector each to learn an exception.

**The precedent is hours old and was proved the hard way.** `plan:archive seq:34`
needed to store a session name — owner-supplied data the scan does not produce —
and measured that a **column** on `conversations` is lost **twice**: `upsert`
sets every column from `excluded` and the Stop hook rebuilds every turn, so a
hand-typed value lives **one turn, silently**; and `removeMissing` deletes the
whole row when the harness prunes. It used a table, following `persisted`. So
does this.

**Byte offsets, not character offsets.** `iterateTranscript` walks by bytes from
the Buffer because the corpus is Hebrew from record 5.

**And anchors sharpen retrieval.** Owner ruling: giving the subagent a specific
anchor, or several, *"will make a very accurate search about subject — in this
case the subject is clearly defined as what the user is looking for so it could
narrow the work of the subagent and the results very much."*

---

## 8. The mission: retrieval never writes into the live context

**This is the owner's design and it is better than the one it replaced.**

Retrieval does not paste found material into the working context. It **writes a
mission for a subagent**, which reads the raw material in its own fresh window
and does three things rather than one:

1. **Filters down** — the noise never enters the owner's window at all.
2. **Verifies against the codebase and git** — not merely *was this superseded in
   the corpus*, but **does the code that implemented this decision still exist**.
3. **Looks the other way too** — pulls complementary detail out of documents and
   code that the conversation never contained.

**What comes back is small, concentrated, chronological, and shows the chain of
changes** — the current correct state *in perspective of time*.

### Why this beats injecting a filtered summary

- **It verifies against ground truth rather than a description of it.** A ruling
  can stand in the corpus while the code that implemented it was reverted weeks
  ago. Git knows; the corpus does not.
- **The noise never reaches him.** Filtering-then-injecting must be perfect in
  advance. Reading elsewhere and returning a conclusion is why lanes work at all.
- **Chronology joined to git is stronger than a reconstructed narrative.** Git
  *is* the ordered record of what actually changed.

### The safeguard: it must CITE

The distilling subagent is itself a model, so it can confidently return something
wrong — the Echo Gap one step out. **Every claim it returns points at a record: a
turn, a commit, a file and line.** Then the result is *verifiable* rather than
trusted, and `verify:citations` already checks that shape
(`RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number`).

**Citations are also what make a result keepable** (§9): a reconstruction whose
citations still resolve is still true, and one whose citations have moved can
**say it has aged** instead of rotting silently.

---

## 9. Results are files, rendered in the UI

**The subagent always writes its output to a well-structured file.** It never
returns straight into the owner's context.

**He reads it in the web UI** — the Conversations area is the natural home,
suggested rather than settled — and chooses what happens next: refine, narrow,
select, or ask for a specific reconstructed subject.

**Stored in their own directory, GITIGNORED, and indexed for the UI.** They
contain conversation text, and the owner has already ruled that conversation
files are gitignored *"so no sensitive data would be saved in git"*. The same
reasoning applies unchanged. They do not go in `reports/`, which is hand-written
narrative.

**Kept, dated and re-verifiable.** Ask once, build on it many times; and because
every claim carries a citation, staleness is detectable rather than silent.

---

## 10. What returns to the context, and when

**Only what the owner chooses, at the end, after he has seen the result.**

> *"even then he could decide for example that copying a table that he looked for
> is satisfying and only the table should be returned to the context."*

**And when something does return, it arrives marked**: dated, stated plainly as a
record rather than a current instruction, and checked so a ruling that has since
been reversed **says so on arrival**.

That is not caution for its own sake. `CLAUDE.md` opens by describing the defect
it prevents, measured on 2026-09-07: **five superseded instructions being acted on
as current**, because a document repeated one after it had been reversed.

**Because the owner decides at the end, the question of an automatic trigger
mostly dissolves** — his ruling. Nothing is injected without him.

---

## 11. Search comes first, and it is nearly free

**Phase one, and worth having even if nothing else ships**, because it improves
the viewer he uses today.

**SQLite FTS5 is already present.** Node 24's bundled SQLite 3.51.2 has
`ENABLE_FTS5`, `bm25()`, porter and trigram tokenizers — verified, **including
Hebrew** via unicode61 and trigram substring matching. `node:sqlite` is already
imported in 14 files. **No dependency, no build step**, against
`CONST-zero-runtime-dependencies` and `CONST-node-24-no-build-step`.

**Phase one also carries anchors** — the list and the search over them — by owner
ruling.

**The library survey found nothing worth adopting**, for three separate reasons,
each recorded so it is not re-litigated: markdown parsers fail on dependency count
(33–50 packages); near-duplicate packages are **5–14 years abandoned**, and the
most-downloaded carries a **53-bit precision bug** in its permutation loop; and
the maintained Python reference is disqualified by runtime, its own docs reporting
precision falling to **0.69–0.77** on a corpus like this one. **MCP returns zero
servers** for `minhash`, `near-duplicate`, `text dedup`, `bm25`, `full-text` or
`lexical` — the category turned into RAG.

---

## 12. Scope

**This workspace, all its sessions**, by default — the history the owner
described losing, and the boundary the corpus already draws.

**Narrowable by session name and by date or date range**, his ruling, for when he
remembers where something was. Session names exist since `plan:archive seq:34`.

**Not across workspaces.** One project's material arriving in another's context is
a privacy question this design does not open.

---

## 13. Phasing

**Three phases. Each is worth having if the next never ships.**

| phase | what | why here |
|---|---|---|
| **1** | FTS5 search over the archive · anchors: table, marking, list, search | improves the viewer today; everything else stands on it |
| **2** | the four modes · the subagent mission · result files · the UI to read and choose | the feature itself |
| **3** | drift detection | prevention, and it needs phase 2's machinery to judge against |

**Phase 3 is deliberately last.** Retrieval is the cure and stands alone; drift
detection is prevention and needs anchors, subjects and chronology to already
work. Building it last means building it on measured foundations — and the owner
can judge whether he still wants it once finding his way back is cheap.

---

## 14. Drift detection (phase 3)

Notice divergence **while it happens**: the session has been on one thing for many
turns while the stated plan says another. That is what he actually wanted at the
time — not a way back, but a hand on the shoulder before he was lost.

`plan:loop seq:2` already computes *is this session worth looking at* — the same
machinery asking a different question. It measured the shape of that cost: 3,924
tool calls → **261 considerations → 164 rubric fires → 3 passes**, where firing on
every `Stop` would have been **766**.

**It must be able to be wrong quietly.** Telling him he has drifted when he has
not is worse than silence, which is why it is off by default and last.

---

## 15. Testing

- **Selection → query**: a copied passage yields the identifiers it contains, and
  a passage with no names yields a stated *nothing to match on* rather than a
  guess.
- **Noise**: the repeat rule removes the 195-occurrence harness note, and the
  count removed is reported rather than assumed.
- **Anchors survive a rebuild**, and survive `removeMissing` pruning the session
  row — the two failures `seq:34` measured.
- **Citations resolve**: every claim in a result file points at a record that
  exists, and a planted moved citation is reported as aged.
- **Nothing is injected without the owner choosing it** — asserted, since it is
  the rule that makes the rest safe.
- **A reversed ruling arrives saying so**, proved with a planted supersession.
- **Every assertion proved by REMOVAL** — take the mechanism out, watch the test
  go red, restore it. Ten lanes did this on 2026-09-09/10; three caught their own
  first drafts passing with the defect deliberately reinstated, and one caught a
  Playwright run reporting **exit 0 with 88 failures** because the status came
  from a pipe.

---

## 16. Not building

- No summarisation model in the pipeline; selection only, and a subagent for
  distillation.
- No clustering into invented topics.
- No MinHash/LSH — measured slower than brute force at this scale.
- No lexical signal/noise classifier — measured at chance.
- No new runtime dependency; no build step.
- No cross-workspace retrieval.
- No automatic injection.
