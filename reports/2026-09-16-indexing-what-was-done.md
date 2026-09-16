`TASK-the-archive-indexes-what-was-said-and-none-of-what-was-done` (`semantic/10`), 2026-09-16.
The owner, on being told only a fraction of a transcript is searchable: *"why ? isn't it a text
file ? isn't transcripts text files ? what are the limitations that holds you from searching
everithing in a conversation (remind you it's archived)"* — and then, having seen the numbers:
**"Index the tool calls"**.

He was right that there is no file-format limitation. It was a choice, it was ten lines, and it is
reversed.

Every number below is a measurement taken on **this workspace's real archive** — 474 transcripts,
252,426 records, 1.27 GB — and every one is reproducible: the volumes and the cap curve come from
`node scripts/measure-tool-indexing.ts`, which reads the index and the transcripts read-only and
writes nothing; the index sizes and timings come from running the shipped build against **copies**
of `.my_context/.index.db` in a scratch directory, with the pre-change source restored from `HEAD`
into a parallel tree so that *before* and *after* are the same procedure over the same bytes.

---

# 1. THE ANSWER IN ONE PARAGRAPH

`tool_use` blocks are now indexed, as a **third kind of span** — `'ran'` — beside the two the index
has always held (`'prompt'`, `'answer'`, which together are *what was said*). The archive's
searchable characters go from **13.58 M to 43.87 M, a 3.2x widening**, and the whole of *"what
command did I run"*, *"which file did I touch"* and *"when did I last run that script"* becomes
answerable. It costs **2.0x the FTS index and 2.5x a full rebuild**, and **nothing measurable on
the per-turn refresh**, which is the cadence that actually matters. The reader chooses **said, ran
or both**; the default is *said*, so nothing written before today widened silently, and **every
answer counts what the half he did not ask for holds**, so a zero can never be mistaken for an
answer about the archive. `tool_result` is still out, deliberately, and §7 is the measurement for
the owner to rule on.

---

# 2. WHAT THE ARCHIVE IS MADE OF, RE-MEASURED HERE

`node scripts/measure-tool-indexing.ts`, over the byte ranges the index itself has scanned:

    474 transcripts, 252,426 records, 1,269,256,560 bytes, walked in 4.6 s

    tool_result     279,462,446 chars   67.0%   what every command PRINTED
    thinking         68,452,488 chars   16.4%   what the model thought
    tool_use         55,158,408 chars   13.2%   the commands, paths and arguments
    text             13,919,651 chars    3.3%   what he and Claude SAID

The dispatch's figures were taken over the whole `~/.claude` archive across projects (1,086
transcripts, 2.28 GB); these are this workspace's own 474. The shape is the same and the conclusion
is stronger: **this project indexed 3.3% of its own characters** and called the rest unsearchable.

`text` at 13,919,651 raw characters reconciles with the 13,578,400 the index actually holds — the
difference is the JSON envelope of a `text` block, which `proseOf` does not store.

---

# 3. WHAT IS INDEXED NOW

`conversation_prose` on the live index, after `mycontext conversation rebuild --full`:

    kind      spans     characters
    prompt    1,671      6,050,609
    answer    9,920      7,538,303
    ran      58,361     30,277,871      <- new
    total    69,952     43,866,783      against 11,554 spans / 13,575,116 before

**A `'ran'` span is the tool's NAME and its arguments as `key: value` lines**, not JSON:

    Bash
    command: node scripts/measure-tool-indexing.ts --sources 5
    description: measure the cap curve

The JSON is deliberately not indexed as JSON. On a trigram tokenizer a query matches as a contiguous
run of characters, and a path spelled `src\\core\\x.ts` inside a raw record is not the `src/core/x.ts`
a reader would type. Strings are rendered as their own characters; only a value that is not a string
is `JSON.stringify`d.

**One record can now produce two spans at one byte offset** — an assistant turn that says something
and then calls a tool is one `'answer'` and one `'ran'`. That is why `hitKey` in
`conversation-search.ts` now carries the kind: a key over position alone silently dropped the second
of the pair, and it would have dropped the NEW one, so the feature would have half-worked and looked
like it worked. It has its own removal proof (§9, P4).

## 3.1 The cap, and why it is on one ARGUMENT

`tool_use` is not uniformly useful. `Bash`'s `command` is a line; `Write`'s `content` and `Edit`'s
`old_string`/`new_string` are whole files, and a file that was written through a tool is a file on
disk. `TOOL_VALUE_CAP` is **2,000 characters, per argument**, with a visible `…` where a value was
cut.

**Per argument and not per block**, which is load-bearing: `Write`'s input is
`{file_path, content}` and `Edit`'s is `{file_path, old_string, new_string}`. A cap on the BLOCK
spends its whole budget on the first long value and can drop `file_path` entirely — the one argument
*"which file did I touch"* is about. Capping each value keeps every key and the head of every value.

The curve, over the real archive, as a multiple of what was said:

    cap on one argument     characters      x said
             250            14,373,578       1.06x
             500            18,716,975       1.38x
           1,000            23,852,665       1.76x
           2,000            30,100,982       2.22x     <- shipped
           4,000            37,110,082       2.73x
           8,000            42,352,794       3.12x
        uncapped            47,625,790       3.51x

2,000 keeps essentially every command and every path whole and costs 63% of uncapped. The number is
one constant, `TOOL_VALUE_CAP`; the curve above is the dial.

---

# 4. WHAT IT COSTS ON DISK

Three framings, because a full rebuild inflates an FTS5 index whether or not anything changed, and
only one of these is a like-for-like measure of the CONTENT.

**(a) What the owner sees.** The live `.my_context/.index.db`, this morning and after the rebuild:

                            before          after
    .index.db          101,785,600     323,440,640     3.18x
    FTS data            64,616,189     241,707,743     3.74x
    spans                   11,554          69,952
    characters          13,575,116      43,866,783

**(b) Same procedure both sides** — a copy of the same starting index, full-rebuilt by the before
tree and by the after tree:

                            before          after
    .index.db          147,488,768     320,036,864     2.17x
    FTS data           119,517,271     240,133,276     2.01x

**(c) Compacted both sides** — the same two, after FTS5 `optimize` and `VACUUM`:

                            before          after
    .index.db           71,114,752     241,266,688     3.39x
    FTS data            45,184,285     165,163,462     3.66x
    bytes per char            3.33            3.78

(c) is the true content cost: **3.7x the FTS data for 3.2x the characters.**

## 4.1 A FINDING THAT IS NOT MINE AND PREDATES THIS CHANGE

**A full rebuild roughly doubles the index for content it has not changed, and never reclaims it.**
Measured on the before tree alone: the same 11,554 spans occupy 64.6 MB of FTS data in the
incrementally-grown live index and 119.5 MB after `rebuild --full` — and 45.2 MB after `optimize`.
`optimize` + `VACUUM` cost 2.3 s before and 5.6 s after this change, and on the post-change index
they take 320 MB to 241 MB and make every query 20-40% faster (§6).

Nothing here ships that: adding a compaction step to `conversation rebuild` is a decision with its
own cost on a command the Stop hook runs, and it is not this item's. **It is filed as a
recommendation and the numbers are above.**

---

# 5. WHAT IT COSTS IN TIME

## 5.1 A full rebuild — run by hand, and by the Stop hook only with `--full`

Prose index only, over the same 1.27 GB, on a copy:

    before   16,298 ms
    after    41,104 ms     2.52x

End to end through the shipped command on the live archive, after the change:

    mycontext conversation rebuild --full
      transcript scan      3,187 ms   (145 MB of session transcripts re-read)
      prose index         47,540 ms   (69,952 passages from 474 transcripts)
      wall clock          52.8 s

**This is the number the owner needs before it ships, and it is a minute, not minutes.** The Stop
hook does not run `--full`; it runs the incremental path below.

## 5.2 THE PER-TURN COST, which is the one that is paid several times a turn

`src/core/turn-refresh-soon.ts` spawns a detached refresh from `PostToolUse`, gated on 15 s and
8 KiB of growth, so a working turn pays this several times. It is an INCREMENTAL scan: an unchanged
source costs one comparison and a grown one costs its TAIL.

**Nothing changed, 474 sources:**

    before   18 ms        after   28 ms

**A real tail, on the largest transcript in the archive** — the rewind is to a true line boundary,
so this is the `appended` path the hook actually takes:

    tail read        before      after
     10,299 B         29 ms      22 ms
     65,909 B         23 ms      23 ms
    282,791 B         25 ms      38 ms      <- a whole 5m37s turn's growth

**The per-turn cost is unchanged within noise**, and at the largest tail measured it is +13 ms
against a hook budget of 1,600 ms. That is the headline of this section and it is why 2.5x on a
full rebuild is affordable: the expensive path is the one nobody runs on a turn.

For completeness, the path that is NOT taken on a turn — a whole re-read of the 139 MB transcript,
which `maxSourceBytes` defers away from any bounded caller — went from 2.3-2.5 s to 4.6-7.7 s.

---

# 6. QUERY LATENCY

`searchArchiveTiered` — three readings and their counts, which is what a reader's search actually
costs. Median of 9 runs, on compacted indexes (§4c):

    query                    before   after/said   after/ran   after/both
    "byte offset"            54.3ms       65.6ms      39.8ms       69.8ms
    "npm test"               79.1ms      137.3ms      82.9ms      126.4ms
    "conversation-search"     9.9ms       28.4ms      29.8ms       20.4ms
    "anchor"                 39.2ms       89.0ms      65.5ms       56.2ms
    "removal proof"          78.4ms      129.5ms      77.7ms       86.5ms

On the live index as the rebuild leaves it (uncompacted), the same *said* queries run 50-230 ms.

**A `said` query got slower even though it reads the same rows, and the reason is worth writing
down.** `kind` is an `UNINDEXED` column of the FTS5 table, so the `MATCH` runs over every span and
the kind filter is applied to the result. Six times the spans is six times the scan. Isolated:

    "npm test"           before     after
    phrase MATCH        37.2 ms    43.3 ms
    AND MATCH           47.5 ms    55.8 ms
    one countProse       0.8 ms    14.5 ms

About 7% of the increase is the one extra `countProse` this change adds — the `elsewhere`
disclosure (§8). The rest is the larger index.

**A separate FTS table per kind would remove this entirely**, at the cost of a union query for
*both* and four more methods on the index. The item directed the `kind` column
(*"The span row already carries a `kind` column — use it"*), so that is what shipped; the number
above is the price, recorded rather than discovered later.

---

# 7. `tool_result`, CAPPED — THE NUMBERS THE OWNER HAS TO RULE ON

**Nothing here is shipped.** `tool_result` is in no index at any cap, and
`test/core/conversation-tool-index.test.ts` pins that absence deliberately, so a lane that switches
it on without his answer goes red rather than shipping quietly.

Measured, as characters and as a multiple of what was said, and projected to FTS bytes at the
compacted **3.78 bytes per character** measured in §4c:

    cap on one result    characters     x said    FTS added    FTS total    rebuild
            512          21,221,620      1.56x        80 MB       245 MB     ~+18 s
          1,024          35,352,939      2.60x       134 MB       299 MB     ~+30 s
          2,048          54,967,508      4.05x       208 MB       373 MB     ~+46 s
          4,096          77,555,117      5.71x       293 MB       458 MB     ~+65 s
       uncapped         270,979,197     19.96x      1.02 GB      1.19 GB    ~+3.8 min

(*FTS total* adds to the 165 MB the index holds now. The rebuild column extrapolates from the
25 s that 30.1 M characters of `ran` actually cost.)

**The recommendation, and it is a recommendation and not a decision.** 2,048 is the cap the item
named and it is the wrong one here: it costs more than everything else in the index put together,
for text that is overwhelmingly file dumps and test output. **512 is the interesting row** — it
catches the first screen of almost every command's output, the part that says whether it worked,
for 80 MB and eighteen seconds of rebuild. If a search over what a command PRINTED is worth having
at all, that is where to buy it.

**What it would also need**, and this is the part a number does not show: a third word for the
reader. `said` / `ran` / `both` would become four, and *both* would have to stop meaning
*everything*. The switch is built and adding a value to it is small; deciding what the words mean
is not.

---

# 8. HOW A READER ASKS FOR SAID, RAN OR BOTH

One vocabulary, two surfaces, one mapping (`kindsOf` in `core/conversation-search.ts`):

    said   prompt + answer     what he and Claude typed      <- the default
    ran    ran                 the tool calls
    both   all three

**The CLI** — new, and the first search surface this command has had:

    mycontext conversation search <query> [--sources said|ran|both]
                                 [--session <id>] [--agent <id>] [--limit <n>] [--json]

**The API** — `GET /api/conversations/search?sources=said|ran|both`. `kind=prompt|answer` still
narrows *within* what was said, and sending both is refused rather than resolved: they are two
scopes over one column and picking a winner would draw a heading that is not true of its own rows.
The body carries `scope.sources`, `kinds`, `elsewhere` and `unindexed`.

**The default is `said`, and that is a choice with a cost.** It means the anchor pass's table
probes, `retrieval/from-selection.ts`' item-id lookups, `read-model-retrieval.ts`' pointers and the
document find bar all read EXACTLY the rows they read before this change, with no edit to any of
them and no chance of a silent widening. What it costs is that a reader typing a command into a
*said* search is answered `0`, which has the same shape as *"the archive does not contain this"* —
so no search is allowed to stop there:

**Every answer counts what the kinds it did not read hold.** `TieredSearchResult.elsewhere`, one
`countProse` over the broadest reading in the complementary scope. On the terminal:

    my_context: nothing in what was said holds "measure-tool-indexing".
    my_context: and 11 more in what was RUN — add `--sources ran` to see them, or `--sources both`.

## 8.1 WHY THE SWITCH EXISTS AT ALL, MEASURED

The item's condition: *"A SEARCH THAT RETURNS EVERYTHING IS NOT BETTER THAN ONE THAT RETURNS TOO
LITTLE."* It is not hypothetical. `"npm test"` over the live archive:

    said    271 hits        both    337 hits, of which the said hits are crowded out by ran hits
                                    filling the 200-per-reading bound

Without the switch, a question about words is answered by a list of commands.

---

# 9. WHAT IS STILL NOT SEARCHABLE, AND WHERE THAT IS DISCLOSED

`INV-nothing-is-dropped-silently`. **`tool_result` (67.0%) and `thinking` (16.4%) are in no index,
at any scope** — 83.4% of the archive's characters. One definition, `UNINDEXED_BLOCKS` in
`core/conversation-search.ts`, printed by both surfaces:

  — **the CLI**, on every answer, hit or miss: *"tool_result and thinking blocks are NOT indexed at
    all, so what a command PRINTED and what the model thought cannot be found by any search here."*
  — **the API**, as `body.unindexed`, on every answer including the empty ones.
  — **the `elsewhere` count** above, which is the other half: what is indexed but out of scope.

**The sentence the item required to stay true has stayed true.** `conv.doc.matchedFull` —
*"searched in the {scanned} turns of words this transcript has, out of {records} records"* — is
unchanged and still correct, because `proseSpans` and `findInDocument` both default to `SAID_KINDS`.
`findInDocument` takes a `kind` scope now and the document screen does not yet pass one: **the find
bar still finds only turns of words, and switching it is the viewer half of this item**, which the
dispatch deliberately held back until the owner has ruled on §7. That is the one thing this item
leaves open and it is recorded on the item.

---

# 10. REMOVAL PROOFS

One per assertion, each applied to the working tree, run, and reverted byte for byte.
`test/core/conversation-tool-index.test.ts` (10 assertions) and
`test/cli/conversation-search.test.ts` (4):

    P1   the `ran` span is never written                 6 red, incl. *a record that only called a tool is indexed*
    P2   the tool name is not rendered                   *the tool NAME is indexed, not only what it was given*
    P3   a record is said OR ran, never both             *one record ... is BOTH, at one byte offset*
    P4   hitKey forgets the kind                         *one record ... is BOTH, at one byte offset*
    P5   searchArchive defaults to every kind            *a search that names no kind reads what was SAID*
    P6   elsewhere is never counted                      *a said answer counts what is in what was RUN*
    P7   an argument is never clipped                    *the cap is on one ARGUMENT*
    P8   tool_result is rendered into the ran span       *what a command PRINTED is in no index*
    P9   an empty kind set is read as no scope           *** REDDENED NOTHING — see below ***
    P9b  an empty kind set is read as NO SCOPE AT ALL    *an empty set of kinds admits nothing*
    P9c  proseSpans reads an empty set as no scope       *an empty set of kinds admits nothing*
    P10  proseSpans defaults to every kind               *a search that names no kind reads what was SAID*
    P11  the reader word maps to every kind              *the reader word and the stored kinds are one mapping*
    C1   the CLI always searches every kind              2 red, incl. *the command answers what was SAID*
    C2   the elsewhere line is never printed             *a said answer says how much is in what was RUN*
    C3   what is unindexed is never named                *every answer names what is in no index at all*
    C4   an unknown --sources value is accepted          *a sources value the flag does not know is refused*

## 10.1 P9 REDDENED NOTHING, AND THAT IS THE FINDING

Deleting `if (scope.kind.length === 0) return null;` from `proseWhere` changes no behaviour. The
query it then builds is `kind IN ()`, and **SQLite accepts an empty `IN` list and matches nothing** —
measured directly, `SELECT count(*) FROM t WHERE k IN ()` over two rows answers 0.

The assertion is not powerless: P9b and P9c, which read the empty list as *no scope at all* — the
defect the guard is meant to prevent — both redden it. So what P9 shows is that **the correct
answer currently rests on a SQLite dialect detail rather than on anything written in this project.**

The guard stays, for two reasons that are not the behaviour: `null` is cheaper than a query that
cannot match (the callers answer it in their own currency without asking SQLite at all), and the
answer should not depend on a dialect detail nobody wrote down. **The finding is recorded in the
source, at the line itself**, where the next person to delete it as dead code will read it.

---

# 11. FILES TOUCHED

    src/core/conversation-index.ts        the third kind, the kind vocabulary, kind-as-a-set in
                                          proseWhere/matchProse/proseSpans, and the P9 record
    src/core/conversation-search.ts       toolProseOf + TOOL_VALUE_CAP, the second `put` in the
                                          walk, said/ran/both, `elsewhere`, UNINDEXED_BLOCKS,
                                          hitKey carrying the kind
    src/cli/commands/conversation.ts      `conversation search`
    src/core/command-flags.ts             its flag spec and its help
    src/ui/read-model-conversations.ts    ?sources= on the search route, `elsewhere`, `unindexed`
    scripts/measure-tool-indexing.ts      NEW — every number in §2, §3.1 and §7
    test/core/conversation-tool-index.test.ts   NEW — 10 assertions
    test/cli/conversation-search.test.ts        NEW — 4 assertions
    test/ui/palette-lib.test.ts           the new subcommand, catalogued as a withheld def

## 11.1 SUITE STATE

`npm test` over 8,814 tests found exactly **two** failures. One was mine and is fixed —
`test/ui/palette-lib.test.ts` · *every command string is catalogued or named as a gap*, which is
the gate that refuses a CLI command string nothing offers and nothing explains; `conversation
search` is now catalogued there as a withheld def with its reason. The other is **not this
lane's**: `test/ui/pane-float.test.ts` · *IT IS NOT A MODAL* fails on a `::backdrop` rule in
`styles.css`, which is `semantic/9`'s in-flight work on the float panel (`src/ui/public/lib/
panel.js` is its new, untracked file). It fails with or without this change.

Every suite that touches this change is green: `conversation-search`, `search-grammar`,
`conversation-tool-index`, `conversation-search` (cli), `conversations-endpoint`,
`conversation-document`, `retrieval-compose`, `anchor-*`, `command-flags`, `command-help`,
`no-writes`, `doc-system`, `palette-lib`. `git status src/rules/entries/` is CLEAN after the full
run (`KNOWN-running-the-test-suite-can-leave-the-shipped-rule-store` did not bite this time).
