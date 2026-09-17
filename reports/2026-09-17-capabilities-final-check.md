# `docs/capabilities/` — the final check — 2026-09-17

`TASK-four-repair-passes-have-landed-and-nothing-has-checked-the` · lane BE · `docs/capabilities/**`
only (a second lane held `docs/system/**` at the same time). Read-only: no document was changed, no
`git` command that writes was run, port 58888 was never touched. Chromium was used twice, for the
two short parse runs `check:diagrams` performs.

---

## 1. The answer, in one paragraph

**The discipline held.** **234 claims were checked and 5 were found wrong** — a rate of 2.1%,
against 15 per repair on the two passes before it, and none of the five is in the class that
produced every worst finding of this campaign. **Not one direction, quantifier or edge was found
reversed.** Sixty line-and-symbol citations were resolved against the code and **sixty of sixty
landed on the exact line, to zero lines of drift**, including every citation the last repair wrote
for the findings it was closing. Six pasted command blocks were re-run and diffed whole and five
reproduced byte-for-byte modulo the figures their own captions declare as moving. The five findings
are: one withdrawn claim that survived in the same chapter's summary bullet, two unmarked
abridgements in pasted output (one of them three cuts in one block), one caption whose date
contradicts the block beneath it, and one self-measuring figure that does not reproduce at the
commit that wrote it. **Four of the five are the same shape — a repair that was made in one place
in a chapter and not swept through the rest of it** — and none of them is a claim about how the
system works. **I do not recommend another round.** §6 argues why the two gates are not enough on
their own and names, concretely, what they cannot see.

---

## 2. The denominator — what 234 means

| what | how many | how checked |
|---|---|---|
| mermaid fences parse | 39 | `npm run check:diagrams`, run here: red proof refused the pre-repair chapter-7 fence at line 78, then 39/39 in 1.2s |
| fence byte-identity across copies | 3 | `mermaidBlocks` extraction of `README.md`, `docs/README.he.md`, `00-index.md`, `09-cli-and-mcp.md`, compared as strings |
| cited item ids | 81 | every `` `TYPE-slug` `` in all 17 chapters resolved against a recursive walk of `.my_context/items/` (1,326 items) |
| line-and-symbol citations, and the relationships they carry | 60 | each `file.ts:N` opened at N and the symbol beside it read; direction and quantifier checked in the code, not inferred from the citation |
| volatile figures re-measured | 23 | the command the document names beside each, re-run today |
| pasted command blocks re-run and diffed whole | 6 | `search`, `ready`, `ready --held`, `check:diagrams`, `check-basis`, `check-handover` |
| internal-consistency checks (a section against its own neighbours) | 20 | read, not derived — see §4 for the three this class caught |
| **total** | **234** | |

Two further gates were run for their own sake and both are green as claimed: `npm run
check:diagrams` → **39 fences, 21 of 27 documents, 0 failures, 1.2 s**; `node --import
./test/helpers/pin-rendering.ts --test "test/docs/*.test.ts"` → **112 pass, 0 fail**.

---

## 3. Where the discipline is visible in the evidence

This is the part the brief asked for and it is worth stating before the findings, because the
findings are small and this is not.

**Sixty of sixty line citations resolved exactly.** Not "within ±3 lines" — exactly. `select.ts:1638`
is the two-conjunct spare-band gate; `:1685-1687` is the continuity filter and `:1692` is its
`fitToBudget`; `:1749` is `fresh.filter(matchesScope)` and `:1750-1756` is the two-band JIT call
with no `spareFrom`; `:924-937` is the `continue`-not-`break` block; `:1543` is the seen gate;
`:1486-1503` is `tiersRun` from signature to `return`. `overlap.ts:491-492`, `:497`, `:500-502`,
`:507` are the four steps of the disposition gate in order. `mutate.ts:1200` is `recordVerdicts` and
`:1215` is the retirement that follows it. `mutate.ts:529-531` is the stray refusal thrown before the
contradiction refusal. `needs.ts:291-297` is `workItems` and `:489` is its call. `conversation-index.ts:1668`
is the assistant branch of `classifyTurn`. `conversation-search.ts:605` and `:613` are the two `put`
calls. `read-model-retrieval.ts:360-365` is `pointersFor`'s four-parameter signature and `:851` its
call. `read-model-conversation-document.ts:421` is `p?: string`, `:1797-1798` and `:1820` are the
only two places it is ever assigned, `:1830-1837` is the `work` run that is built without it.
`transcript-scroll.js:75-77` is `matchesNode` and the `hay` line quoted beside it in chapter 15 is
byte-identical to the source. `conversations.js:7874` is the OR, `:6979-6987` is the declaration
that refuses to pin every marked row, `:9551-9552` is the clear-and-refill.

**The quantifiers I tried hardest to break held.** Chapter 2's diagram asks `always: true?` under a
parenthetical *"(asked of normative items only)"* — the obvious way for that to be false is for the
pinned tier to filter on `always` without filtering on normativity. It does not: `select` builds
`injectable = eligible.filter(isNormative)` at `:1519`, `fresh` from `injectable`, and the pinned
tier's `fresh.filter((i) => i.always)` at `:1563` therefore cannot reach a rationale-tier item. The
parenthetical is exactly true. Chapter 15's *"set in exactly two places"* is exactly two `node.p =`
in the whole file. *"eight `DOC_SHORTCUTS` keys"* is eight entries. *"34 rows in 6 sections"* is
34 in 6 — and the code comment beside `REGEX_REF` still says *"33-row table"*, which the refresh
pass named as a code comment behind its own data rather than quietly copying. *"22 worked
examples — 3 plain, 5 wildcard, 5 logical, 9 regular expression"* is exactly that, and *"fifteen
worked examples had already shipped"* is true of the state at `5211551d`, which I checked in git
rather than accepting.

**The `.index.db` correction — the worst finding of the campaign — is correct, and correct in all
three copies.** `pre-tool-use.ts:287-288` is `store = Store.openReadOnlyChecked(ws.dbPath);
candidates = store.activeInjectable(...)` inside the `try`, with `activeInjectableFromItems` only
in the `catch`. The `00-index.md` fence draws `DB -.-> SEL` labelled *"and read FIRST before a
file — Markdown is the fallback there"*; it is byte-identical to `README.md`'s §3 fence; and
`docs/README.he.md:501` carries the same edge in the same direction with the same meaning.

**A near-miss worth recording, because it is the shape of a false finding I did not publish.**
Chapter 15 says `lib/panel.js` *"has three callers today"*. The working tree has four — but the
fourth is `src/ui/public/app.js`, uncommitted, another lane's work in progress. At HEAD there are
three. Checking `git show HEAD:` rather than the working tree is the difference between a finding
and a fabrication, and this pass makes that check.

---

## 4. The five findings

Each names the chapter, what it says, what is true, and how I established it.

### 4.1 `05-anchors.md:525-528` — a withdrawn claim survives in the same chapter's summary

The chapter's §5.6 carries a heading that reads **"The five and a half minutes was the TURN, not a
flush"** and, at `:331-332`, withdraws the batching claim in as many words: *"An earlier revision of
this section said marks are 'flushed to `.anchors.jsonl` in batches' and that one sat unflushed for
up to 5m 37s. The writer does not batch, and that claim is withdrawn."*

Two hundred lines later, in §5.7's bullet list, the withdrawn claim is still standing:

> - **The writer batches its flush, and that is the actual "on the fly" delay** (§5.6, Path 1) —
>   measured up to 5m 37s from a turn being written to its anchor reaching `.anchors.jsonl` […]

It cites, as its authority, the section that refutes it. **How established**: `markAnchor`
(`src/core/anchors.ts:207-232`) builds one row and calls `withAnchorWrite(index, () =>
index.putAnchor(row))` synchronously; `grep -n "flush\|batch\|queue" src/core/anchors.ts` returns
nothing at all. The claim is false, not merely stale. **How it survived**: `git log -L 525,526`
puts the bullet at `1ec219c2`, and `git show c415c6db -- docs/capabilities/05-anchors.md | grep
"batches its flush"` is empty — the refresh pass wrote the withdrawal and did not sweep the
chapter for the claim it was withdrawing. **This is the most material of the five**: it is the
only one that tells a reader something false about how the system behaves.

### 4.2 `07-restore-and-handover.md:438, :464, :465` — three unmarked cuts in one pasted block

The block is introduced as *"real output, run against this repository right now, 2026-09-16"* and
is cut in three places with a typed `...`, none of them marked:

- `:438` — a bare `...` as the block's first line, hiding the `RETIRED` findings above it.
- `:464` — `4 pointer(s) name work that was RETIRED with a successor. REPORTED, never gated: ...`
- `:465` — `7 instruction(s) carried into 3+ blocks with the work still open. REPORTED, never gated: ...`

**How established**: `node scripts/check-handover.ts` re-run here. Those last two lines are not
truncated by the tool — it prints a full paragraph after each colon, and what the `...` removes is
the reasoning for the tier, **including `WHAT WOULD MAKE IT A GATE` in both cases**. The run also
prints a closing line the block drops entirely (*"An instruction written in prose that names no lane
and no item is invisible here"*). `git log -- scripts/check-handover.ts` shows the script unchanged
since `19939273` (2026-09-14) and `git show c9eec6d0:scripts/check-handover.ts | grep -c "WHAT WOULD
MAKE IT A GATE"` returns 2 — so the paragraphs were being printed on the day the block was captured.
This is the exact class — *"10 abridged and 5 doctored"* — that `reports/2026-09-17-capabilities-repaired-again.md`
§5.3 reports closing; that sweep did not reach chapter 7's block.

### 4.3 `12-packs-export-import-procedures.md:184` — an unmarked abridgement of a category line

```
my_context: about to export 1235 item(s) as a pack named "test-preview", version "1.0.0"
  adr 3   constraint 7   decision 99   ...   task 866
```

**How established**: `src/cli/commands/export.ts:235` is `lines.push(\`  ${categoryLine(report.byCategory)}\`)`
— one printer, used by both blocks, which wraps the whole list. The first block in the same chapter
shows it whole over three lines; the second replaces the middle with a typed `...` and nothing says
so. The block is honestly dated (*"re-run read-only … on 2026-09-13 (1,235 items; it was 1,108 on
2026-09-12, so read the figures as a dated reading)"*), so the numbers are fine; the cut is not.

### 4.4 `09-cli-and-mcp.md:235` — a caption contradicting the block one line below it

> `search "<words>"` — … **Real output, 2026-09-16:**
> ```
> $ node src/cli/index.ts search "budget" --limit 3     # 2026-09-17, captured by redirecting the command to a file
> ```

The lead says 2026-09-16; the block says 2026-09-17; the paragraph below the block discusses
*"1,306 when this block was first captured"*. **How established**: `git log -L 235,235` puts the
lead at `1ec219c2` and `e515eff4` re-captured the block without updating the sentence above it.
The block itself is a faithful capture — I re-ran the command and it reproduces row for row, with
only the counts moved (174→176 phrase, 1,320→1,326 searched, 177→179 matched), exactly as the
paragraph beneath it says they will.

### 4.5 `00-index.md:242` — the self-measuring figure does not reproduce, while claiming it does

> *17 files, 8,915 lines, 639,654 bytes … re-measured **2026-09-17**, after the additive pass …
> `wc -l docs/capabilities/*.md` and `wc -c docs/capabilities/*.md` reproduce it on any later checkout.*

At the very commit that wrote the sentence, and with `docs/capabilities/` clean in the working
tree, those two commands return **8,935** and **641,714** — twenty lines and 2,060 bytes more.
**How established**: both commands run against the working tree, then re-derived from
`git show c415c6db:` for all 17 files, with identical results, so this is not working-tree noise
from the other lane. The sentence contains its own escape — *"treat it as a lower bound rather than
a constant"* — and as a lower bound it holds. It is the **reproduction** claim that is false: the
figure was taken before the last twenty lines of the pass were written, which is the self-reference
trap the sentence half-recognises and does not finish escaping.

### Not a finding, recorded because I looked at it hard

`15-document-and-lane-viewer.md:118` states the UI string tables write `…` **80** times
(*"re-counted 2026-09-16 … 43 and 37"*) and calls the figure *"stable (the string tables change
rarely)"*. Today it is 44 and 37, i.e. 81, because `ef52818f` touched `en.js` this morning. I
checked `git show c9eec6d0:src/ui/public/strings/en.js | grep -o "…" | wc -l` → **43**: the figure
was true on the date it carries. **A dated figure that moved is the system working, not a finding** —
but the parenthetical calling it stable was falsified within twenty-four hours, and that is the
second time in this reference that a claim of stability has aged worse than the number it was
defending.

---

## 5. Which chapters were swept, how deeply, and what I could not establish

| chapters | depth |
|---|---|
| `00`, `02`, `05`, `09`, `10`, `13`, `15`, `16` | **deep** — diagram edges read against the code, every cited line opened, pasted output re-run and diffed whole |
| `03`, `04`, `06`, `07`, `12`, `14` | **medium** — diagram edges and the load-bearing citations checked; one output block per chapter re-run where one existed |
| `01`, `08`, `11` | **mechanical only** — fences, cited ids, and re-measurable figures. Their prose was not read line by line |

**What I could not establish either way, and did not guess:**

- **`09-cli-and-mcp.md:348`'s cut marker** — *"33 further line(s) of this run are not shown"*. Today's
  run leaves 37 lines below the same point. The difference is entirely explained by the open-question
  table growing from 5 wrapped rows to 9 as its title re-wrapped, which is content that moved between
  the capture and now; I cannot reconstruct the table's height on 2026-09-17 without the capture file,
  so I record it as consistent-but-unproven rather than as a finding.
- **`15-document-and-lane-viewer.md:282`'s pixel table** is marked unverified in the document itself
  and needs a browser driving the real screen. Another lane held the browser; I did not take it.
- **The four screenshot placeholders in chapter 15** are placeholders on purpose (`rulings/101` owns
  them). Nothing to verify; they claim nothing.
- **Chapters `01`, `08` and `11`'s prose** was not read claim by claim. Their fences parse, their
  cited ids resolve, their re-measurable figures re-measure, and `11`'s `src/review/` sixteen-modules
  figure is correct and dated — but a false sentence in their prose would not have been found here,
  and I am not claiming otherwise.

---

## 6. The judgement: are the two gates enough, and what can they not see

**They are not enough on their own, and they are worth keeping. The gap between those two sentences
is the whole of this section.** A gate whose blind spots nobody can describe is a gate nobody should
trust, so here is the description, from reading `scripts/check-diagrams-parse.ts` and
`test/docs/*.test.ts` rather than from their names.

### 6.1 What `npm run check:diagrams` actually proves

It proves one thing completely: **no reader of any document under `README.md`, `docs/README.he.md`,
`docs/capabilities/` or `docs/system/` will meet a mermaid error box.** It proves it honestly —
it refuses the pre-repair chapter-7 fence on every run before it reports a green number, and it
refuses to pass on a sweep below a pinned floor, so it cannot silently degrade into a gate that
checks nothing. That is a real defect class, it really shipped, and it is really closed.

### 6.2 What it cannot see

**It calls `mermaid.parse()`. Parse is grammar. Everything below is grammatical.**

1. **A reversed edge parses.** `DB -.-> SEL` and `SEL -.-> DB` are both valid mermaid. The worst
   finding of this entire campaign — `.index.db` *"never by injection"* — was in a fence that parsed
   perfectly for as long as it was wrong. So was the `TP → UN` edge in chapter 4 and the `PreCompact`/`PostCompact`
   inversion in chapter 7.
2. **An edge LABEL is an opaque string.** *"every ref"* where the code has four buckets, *"only
   after every scoped item already fit"* where `fitToBudget` continues past a miss, *"asked of
   normative items only"* if it had been false — mermaid never reads any of it. Every quantifier
   error this campaign found lived inside a label or a node, and the gate is structurally incapable
   of an opinion about any of them.
3. **A node naming a symbol that does not exist parses.** `pointersFor(index, query.names + query.terms, scope)`
   passed this gate with three parameters against a four-parameter function.
4. **A line citation inside a label is text.** `select.ts:1638` in a node is never resolved, never
   opened, never compared to anything.
5. **It draws nothing, by ruling.** So a fence that parses and *renders* wrong is invisible: a label
   that overflows its box, a diagram too wide to read, and in particular `01-items-and-corpus.md:35`'s
   `linkStyle 3,4` — an ORDINAL into the edge list. Insert an edge above it and it silently colours
   two different edges. That parses today and will parse after it starts lying.
6. **It does not compare copies of the same fence.** Five fences exist in two or three places
   (`README.md`, `docs/README.he.md`, `00-index.md`, `09-cli-and-mcp.md`). Edit one copy only and
   the gate still says 39/39. The byte-identity those chapters rest their provenance notes on was
   established by hand, by the repair pass, and nothing re-establishes it. **This is the cheapest
   real gate still missing** — it is a string comparison over an extractor that already exists.
7. **A fence and its own caption can disagree and both pass.** `00-index.md`'s `.index.db` node and
   the paragraph explaining it are checked against each other by nobody.
8. **The floor is a minimum, not an equality.** `FENCE_FLOOR = 38` with 39 fences present: deleting
   one passes green.

### 6.3 What `test/docs/*.test.ts` actually proves — and the fact that matters most

**Those 112 tests do not read `docs/capabilities/` at all.** Not one of them opens a capability
chapter for its content. I checked this directly, because the name invites the opposite conclusion:
`test/docs/capabilities.test.ts` is about the **capabilities summary section of the two READMEs**
(`## What it can do`), not about this reference. `grep -rn "docs/system" test/docs/` returns nothing.
The only test that touches these files at all is `doc-system.test.ts`, which walks every `.md` under
`docs/` to assert the document manifest admits it and that it round-trips through `GET /api/doc/:id`
— i.e. it asserts that a capability chapter is **servable**, and nothing whatsoever about what it says.

What the 112 really gate, and gate well, is the **two READMEs and the generated surfaces**: that both
documents state the real number of CLI commands, slash commands, MCP tools, hooks, categories and
profiles; that the approval boundary is enumerated whole; that every documented example block is
generated from a real run and round-trips idempotently; that English and Hebrew carry the same
section structure and the same examples in the same order; that every tutorial's version, hook count,
profile value and budget number is the one the build ships. That is a strong ring fence, and it is
drawn around a different document.

### 6.4 So: what holds `docs/capabilities/` true from here

**Nothing automated holds a sentence in these seventeen chapters true.** The gates hold the
*pictures* parseable and the *READMEs* numerate. Between them they would have caught **one** of the
five findings in this report — none of them, in fact, since 4.1 through 4.5 are all prose or pasted
output — and **none** of the 28 diagram claims, the 15 repair-written claims, or the 38 before them.

That is the honest answer, and it is not an argument for another verification round. It is an
argument for the three cheap gates the blind spots above name, each of which is a script this
repository already knows how to write:

1. **Byte-identity across fence copies** (§6.2.6) — the extractor exists; this is a comparison and a
   list of which fences are meant to be identical. It closes the one class where a document can go
   wrong silently and mechanically.
2. **Resolve every `` `file.ts:N` `` citation in the documents** — the repair pass already built this
   as a throwaway (`reports/2026-09-17-capabilities-repaired-again.md` §4.13) and it found nine
   errors nobody had listed. Sixty of sixty resolved today; the number to protect is that one.
3. **Point `check-cited-items.ts` at `docs/`** — it does not look there at all, which is why 81
   id citations in these chapters have never been gated. It found nothing wrong today; that is a
   reason to make the check permanent, not a reason to skip it.

None of the three can read a quantifier or a direction. **Nothing can, except a person reading the
code, which is what the last three passes did and what made them different.** The right thing to
record is not that the documents are certified — they are not — but that the *method* changed and
the measurement moved with it: 38 → 21, 28 → 15, 21 → 15, and now **234 → 5, with zero in the class
that produced every serious finding before it.**

---

## 7. Recommendation

**Stop. Do not spend another verification round on `docs/capabilities/`.**

The five findings in §4 are between one and four lines each and four of them are a sweep that
stopped one section short. If the owner wants them closed, that is a fifteen-minute edit by a lane
that is already in these files, not a pass: delete the bullet at `05-anchors.md:525-528`, re-capture
`check-handover.ts` and `export --dry-run --as-pack` whole, fix one date at `09-cli-and-mcp.md:235`,
and either re-measure `00-index.md:242` last or drop the sentence claiming it reproduces.

The thing actually worth another lane's time is §6.4's list of three gates — because those are the
only way the next repair pass's fifteen new claims get caught by something other than a person
being asked to read four hundred pages again.
