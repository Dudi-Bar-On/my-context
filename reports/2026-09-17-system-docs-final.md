# `docs/system/` verified and repaired in one pass — 2026-09-17

`TASK-nobody-has-checked-the-text-the-system-docs-repair-wrote-and` · `rulings/108` · lane BB

**Nobody had checked the text `rulings/103` wrote. Somebody has now, and it had written new false
claims — twelve of them.** On the capability chapters the identical sequence produced fifteen. This
pass was verifier and repairer in one, so there was no list to write prose around, and the rule was
the item's own: *before writing any sentence, read the code that sentence is about.*

**Claims checked: 214. False or materially imprecise: 31.** Twelve were written or left standing by
`103` itself; nine had rotted since `103` landed five hours earlier, because code moved under them;
ten were older and had survived every prior pass. Every one is listed below with how it was
established.

**Every sentence I wrote is marked checked or carried in §6.** 118 sentences: 104 checked against
code, source or live command output in this session; 14 carried from a prior report and labelled.

Read-only outside `docs/system/**` and this file. No `git` command that writes. Port 58888
untouched. No subagent dispatched. `docs/capabilities/**`, `README.md` and `docs/README.he.md` were
read constantly and written never — the other lane committed `e515eff4` while I worked and I took
its result as input rather than contending for the files.

---

## 1. The twelve the repair itself wrote or left standing

Defects in text `103` produced, or claims it passed over. This is the number the item asked for.

| # | Chapter | The claim `103` left | What is true | How I established it |
|---|---|---|---|---|
| 1 | `00` intro | *"one chapter (16, the board) added later"* | **Three** were added later — 14, 15 and 16 — in one commit | `git log --diff-filter=A` on each: all `1ec219c2`, 2026-09-16. `103` declared `00` "clean on 26 claims"; this is claim 27 and it is false. |
| 2 | `00` §"why these five" | *"Five had nothing of the right shape"* | **Seven** subjects have no chapter, covered in five chapters because three share a row — and an **eighth** carries the same mark and got nothing | Read every row of the inventory's documentation column: rows 6, 9, 30, 17, 18, 19, 20. Row 31 (status line) is *"Tutorial only … No chapter"* and the inventory groups it with 18/19/20 by name. |
| 3 | `01` §1 | *"three small, **pure** computations over the corpus's own **frontmatter**"* | Only one of the three is either | `parseDMap(body: string)` — `needs.ts:664`, an item **body**. `check-board.ts` calls `execFileSync('git', …)` at `:225` and `:265` — not pure, and its Tier 2 input is commit history, not the corpus. |
| 4 | `01` §1 | *"Every other category … is invisible to the board entirely"* | `open_question` is not, and §4 of the same chapter says so | `mycontext ready` prints *"1 open question(s) stand between this list and open work"*. The chapter contradicted itself three sections apart. |
| 5 | `01` §2 | *"the measurement … was taken the day the retirement started"* | Ten days earlier | `needs.ts:5` dates the 425-item measurement **2026-08-28**; `reports/EXECUTION-BOARD.md:1` is *"RETIRED 2026-09-07"*. The chapter states both dates and asserts they are one day. |
| 6 | `01` §4 diagram | node `N`: *"resolve every ref to satisfied · pending · unresolved"* | Four buckets, not three | `NeedsReading` (`needs.ts:370–382`) and `readNeeds` (`:384–395`) return `malformed` as well. An "every" that is not every. |
| 7 | `01` §4 | *"a question that blocks nothing yet is counted, not listed"* | Two populations are counted, not one | `questions.ts:76–92`: listed only while `blocks` resolves to **still-open** work. Live output: *"8 active open question(s) not listed above: 4 naming work that is already done, 4 naming nothing it blocks."* The chapter described 4 of the 8. |
| 8 | `02` §1, §5 | *"Both are driven by the same folding matcher"* / *"the one both the find panel and the archive search box share"* | The archive search shares no matcher with the find panel | `lib/fold.js` has two importers. `conversation-search.ts` imports it at `:1384–1385`, but the only consumer of `findQuery` is `findInDocument` (`:1588`). `searchArchiveTiered` (`:1174`) — the archive search — never calls it. |
| 9 | `02` §5 | *"a pattern that explodes catastrophically is … shorter than any sample a canary could have learned to distrust from"* | The argument is about the **input's** length, not the pattern's | `fold.js:610–623`: *"the input at which these patterns explode is far shorter than any string a canary could learn anything from"*, with the 21/41/61-character table. As rewritten the sentence is close to meaningless. |
| 10 | `03` §3 | The ruling quoted as one sentence with an ellipsis | A splice across four lines of the item | `DEC-the-meaning-hue-budget-is-five-…` at `:37` and `:41`. **`103` repaired exactly this defect in `02` §4 and left it standing in `03` §3 in the same pass.** |
| 11 | `04` §3 | *"The five indented lines are the disclosure"* | **Four** are indented; the fifth is blank | Ran `mycontext decay --summary` and counted. |
| 12 | `04` §4 | *"the two bare cut markers … stand for four disclosure paragraphs"* | **Three** | Ran `mycontext contribution --summary` and counted: "BASELINE", "records INJECTION", "1159 not injectable". |

Two more in the same family, listed apart because they are contradictions `103` introduced between
its own sections rather than misreadings of code:

- **`04` §6 said *"the eighteen internal call sites in §2"*** — but §2 exists to draw the opposite
  distinction, in its own words: *"'Eighteen' is a count of files, not of call expressions: by
  invocation the number is 30."* I re-derived both independently (`grep -rn "recordAudit("` by file:
  19 files, 31 hits, of which `ui/read-model.ts:1521` is a comment → **18 modules, 30 invocations**,
  and `103`'s figures are right).
- **`04` §5 said the Watch screen is *"read-only, like every other surface in this UI"***. The screen
  is read-only (no POST in `watch.js`), but the UI has two write surfaces —
  `src/ui/anchor-write.ts` and `src/ui/retrieval-write.ts` — and `02` §3 of this same directory is a
  whole section about one of them.

---

## 2. Nine that rotted between `103` landing and this pass

`103` finished against `471b13b3`. `ef52818f` landed at 16:58 and `e515eff4` after it. Five hours.

1. **`02` §6 and §7: *"Navigation and Copy are still to come."*** All three panels shipped in
   `ef52818f`. `createPanel` is called three times in `conversations.js` — `findPanel` `:10415`,
   `navPanel` `:10534`, `copyPanel` `:10677`. **`lib/panel.js`'s own header still says they are to
   come**, so the frame's docstring and its callers now disagree — the defect `02` §3 is entirely
   about, live in the file next door.
2. **`02`: `screens/conversations.js` at 11,277 lines.** Now **12,728**. `103` deliberately left the
   HEAD value because a lane was rewriting the file; that lane has landed and the tree is clean, so
   the number is simply re-measurable. It has been 11,261 → 11,277 → 12,728 in two days.
3. **`03` §7: `styles.css` at 5,498 lines.** Now **5,868**. Same commit.
4. **`03` §4: `styles.css:991`** for the 1.04:1 figure. Now **`:1003`** — the file grew by 370 lines
   and the citation moved by 12.
5. **`03` §5: `DIAGRAM_SOURCES` at `gen-diagrams.ts:61`.** Now **`:69`**; `diagramFile` moved from
   `:82` to **`:90`**. `gen-diagrams.ts` is 290 lines, not 282.
6. **`03` §2, §5, §7: the committed SVGs at 686,068 bytes.** Now **694,331** (678.1 KiB / 694.3 kB
   decimal), mean 69,433. The drawings were regenerated after `103` summed them.
7. **`03` §5 and §6: *"nothing in this repository performs [a real parse] outside the two READMEs"*,
   plus a costed recommendation for a parse-only gate.** The gate exists —
   `scripts/check-diagrams-parse.ts`, `npm run check:diagrams`, wired into `ci.yml:214` and
   `release.yml:121`. **The owner ruled on it in two words, *"the parse-only gate"*, on 2026-09-17**
   (`check-diagrams-parse.ts:23–30`). `103`'s recommendation was taken before its report was read.
   Its cost estimate was also superseded: it computed ~2.6 MB from a 68,607-byte mean; the ruling
   records the measured figure as **~1.5–1.8 MiB**, `src/ui/public` 5.04 MB → ~6.7 MB.
8. **`07` §2: the README five-routes diagram. This claim has now rotted three times.** `103`
   replaced "byte-identical" with a provenance claim and spliced the fence — and README moved again
   within the day, so the provenance claim stayed true while the picture underneath it silently
   stopped matching. The differences were substantive, and **three of the five are quantifiers**:
   `always: true?` is now asked *of normative items only*; just-in-time is *"offered again only if
   the item itself changed"* and not *"once per session"*; continuity is bounded to items *not
   already delivered* and to `budgets.continuity`, not *"every … in full"*; README draws two
   no-injection branches where `07` drew one; and the `rationale-tier items` branch was absent
   entirely. Re-spliced with `mermaidBlocks` and asserted equal to README's **and** to
   `docs/capabilities/02-injection.md`'s afterwards — all three byte-identical.
9. **`07` §3: the preview's *"1,129-item hidden list."*** Now 1,135 (`114 item(s) in focus, 1135
   hidden`). The other three figures in that caption — 6 dangling, 7 pinned, 53 `severity:hard` —
   all still reproduce exactly.

---

## 3. Ten older ones, and five findings outside the documents

### Ten nobody had listed

| Chapter | The claim | What is true |
|---|---|---|
| `01` §2 | *"harvested out of the middle of an **unrelated** sentence"* | `needs.ts:16` says *"out of the middle of a sentence"*; the target was `the/45`, now named. |
| `01` §4 | *"`path.ts` (`:6`)"* imports the two modules | `path.ts` imports `needs.ts` at `:2–5` and `questions.ts` at `:6`. The citation named half of what it claimed. |
| `01` §5 | *"an **unrelated day's** items"* | `check-board.ts:15` says *"that day's `anchors/` items"*. |
| `01` §5 | *"measured wrong twice on the same day this pass started"* | `check-board.ts:14` dates it **2026-09-16**; `docs/system/` was written 2026-09-17 (`e2162980`). Now a date. |
| `01` §5 | The D-map ruling quoted lower-cased | The item's own emphasis is *"AND A D NUMBER NAMES A SUBJECT"*. Restored, as `103` restored an owner's typo in `02`. |
| `01` §7 | *"A dependency stated only in prose is invisible to all three commands"* | True of `needs`, false of `blocks`: `PROSE_REF` (`questions.ts:164`) lifts `plan:walk seq:89` out of a sentence, added on a 2026-09-11 measurement. |
| `02` §4 | *"roughly half … is Hebrew from very early in **most transcripts**"* | `read-model-conversation-document.ts:88–90` says *"this corpus is half Hebrew, and a character offset would be wrong from record 5 onward"* — a reading of one transcript, generalised. |
| `04` §2 | *"There is no CLI verb to hand-append an entry"* | `mycontext procedure` appends `kind: 'progress'`, `origin: 'human'` records at `cli/commands/procedure.ts:275` and `:378` — two of the thirty counted in the same section. What is true is that no verb lets a caller author the *content*. |
| `05` §4 | *"creating a rule from a lesson requires a human **at a terminal**"* | Requires a *person*, not a terminal. The Composer carries `lesson-accept` with `runnable: true` (`palette-defs.js:510–518`), so a signed-in person composes and runs it through `POST /api/execute`. The trust property is unchanged; the sentence reads as a security claim and was wrong. |
| `06` §2 | *"round-tripping **tens of thousands** of candidates"* | `TITLE_VARIANTS` (4) × `BODY_VARIANTS` (4) × `SEVERITY_VARIANTS` (2) = **32**, in a 69-case file (`test/ingest/schema.test.ts:607–629`, charter at `:631–672`). Off by three orders of magnitude. |

### Three findings in code — reported, not repaired, because they are outside `docs/system/**`

1. **`styles.css:1319–1320` asserts AA compliance for a colour that fails it.** Under the heading
   *"CONTRAST RE-MEASURED FOR TEXT, not carried across"* and closing *"which is a measurement and
   not an assumption"*, it records `--ok 8.42/7.90:1, --gold 10.58/9.92:1, --warn 6.31/5.92:1,
   --crit 7.00/6.57:1` and concludes *"All clear AA; the worst is --warn at 5.92:1."* **Every one of
   those eight numbers is the retired colour's ratio on both grounds**, to the second decimal,
   wearing the shipped token's name. Recomputed from the shipped hexes: `--ok` 7.84/7.35, `--gold`
   9.31/8.74, `--warn` 6.37/5.98, `--crit` **4.75/4.45** — and 4.45 does not clear AA. The correct
   figures are eleven hundred lines above it at `:129–133`. This is the same swap `03` §4 documents,
   still live, in a comment that claims it was checked. It is now named in `03` §4.
2. **`src/ingest/schema.ts:340` cites an id that resolves to nothing** —
   `INV-a-validator-that-gates-writes-must-be-a-complete-precondition-for-the-write`, four words
   longer than the real `INV-a-validator-that-gates-writes-must-be-a-complete`. **This is where
   `06`'s invented suffix came from**: `103` repaired the chapter and the source it was copied from
   still carries it. `npm run check:cited-items` does print it, but reported-never-gated, only under
   `--unresolved`, among 2,621 id-shaped strings that are mostly fixtures — so the finding is not in
   front of anyone. Four more instances sit in `test/cli/format-table.test.ts` as fixture text.
3. **No gate checks the item ids cited in these chapters.** `check-cited-items.ts`'s `SOURCE_ROOTS`
   is `['src', 'test', 'scripts', 'e2e']` (`:191`) — `docs/` is not walked. Every id in
   `docs/system/` was verified by hand, twice, which is a reading with a date on it.

### Two gaps in the new gate's reach, measured

`DOC_SOURCES` (`check-diagrams-parse.ts:108–113`) covers the two READMEs, `docs/capabilities` and
`docs/system`. It does **not** cover `docs/the-store.he.md`, which carries **4** Mermaid fences and
is the worked example `00-index.md` names as the model for this entire directory, nor
`docs/superpowers/plans/2026-08-14-mycontext-documentation.md`, which carries 1. Five ungated
fences, four of them in the document this directory is shaped after. `docs/tutorials/` carries none,
so it is not a gap. Both now named in `03` §6.

---

## 4. What I checked that was right, so the denominator means something

**183 of 214 claims held.** The ones worth naming, because a numerator without this is noise:

- **All four contrast rows in `03` §4.** I recomputed all sixteen ratios (four shipped, four
  retired, on `--panel` and `--panel-2`) from the hexes under WCAG 2.x relative luminance without
  reading the chapter's table first: 7.84 / 9.31 / 6.37 / 4.75, and 4.45 on the darker ground,
  exactly. The brief said not to re-litigate them and the brief was right. The prose around them
  still agrees: *"`--crit` clears it by 0.25"* is correct, and so are 1.19:1 shipped and 1.26:1
  retired for `--gold` against `--ok` against the ruling's un-reproducible 1.04:1.
- **Four of the five re-captured output blocks reproduce byte for byte today.** `mycontext decay
  --summary`, `mycontext lesson --help`, `mycontext ingest --help` and `mycontext focus --show` were
  re-run and diffed against the chapters: identical. `mycontext focus --category rule --preview`'s
  retained lines all reproduce except the hidden count. **`103`'s re-captures were faithful**, none
  was doctored, and the one figure that moved is the one its own caption warned would move.
- **`04`'s 18-modules/30-invocations census** — re-derived independently, correct, including that
  `audit.ts:1699` is the eighteenth writer and that `ui/read-model.ts:1521` is a comment.
- **Every line citation in `01`** — `needs.ts:490`, `:491`, `:509` (nineteen lines apart, exactly),
  `path.ts:90`, `questions.ts:137–139`, `ready.ts:2–9`, `check-board.ts:459`/`:470`, and *"`blocks`
  appears three times in `needs.ts`, all header prose, zero in code"* (grep: `:20`, `:22`, `:26`).
- **Every line count in `04`, `05` and `06`** — 16 files under `wc -l`, all exact.
- **Every cited item id.** 26 id-shaped tokens across the eight chapters, scanned against all
  **1,324** ids under `.my_context/items/`: **20 resolve exactly**; 3 are false positives of the
  scan (`SHA-256`, `HTML-shaped`, `CLI-only`); 2 are the diagram labels `103` deliberately truncated
  with a visible ellipsis (`REF-the-d-numbers…`, `DEC-the-meaning-hue-budget-is-five…`), both
  spelled in full elsewhere in their own chapter; 1 is the over-long `INV-…-precondition-for-the-write`
  I quote **as the defect** in `06` §5 while naming the correct id in the next clause. **Zero
  invented ids**, and `103`'s decision to leave the two truncations was right.
- **All 30 relative links** in `docs/system/` resolve.
- **All 12 `docs/system/` diagrams parse**, re-run after every diagram edit.

---

## 5. Where I corrected my own draft, and where the brief was wrong

**Three times, and each is the method working rather than an aside.**

1. I wrote that `path.ts:90` was wrong and `HEADERS` was at `:89`, having counted lines off a `sed`
   window. `grep -n` says `:90`. **`103` was right and I was one edit from publishing a false
   correction of a true claim.** Counted, never eyeballed, from then on.
2. I drafted, for `03` §6, that the Navigation and Copy panels *"have not been through the hue and
   icon budget"* — plausible, unverified. Checking `ef52818f` showed it adds **no colour token and
   no new hue**, and does carry contrast readings for the panel's own ground (`--carry` 6.38:1 on
   `--panel-2`, 7.29:1 on `--paper`) that reproduce exactly when recomputed. The bullet now says
   what is true and names what it still cannot establish.
3. I cited `plugin/parity.ts:274–281` for `CLI_WITHOUT_TOOL['lesson-accept']`, taken from an `awk`
   window's **relative** line numbers. The absolute lines are `:516–523`. Caught by re-grepping
   before finishing.

**The brief was right on every point it made, and one was understated.** It said relationships read
backwards are the worst class. Counting this pass, findings 3, 4, 6, 7, 8, 9 and `01` §7's prose
bullet are all direction or quantifier errors — **seven of the thirty-one**, every one invisible to a
line-number check. The brief also predicted `07`'s README claim would have rotted again. It had, in
five ways, three of them quantifiers.

**One correction to the brief.** It said `103` "repaired the 21 false claims and found 15 more".
That is `103`'s own framing and it is fair, but the 15 include items the verifier had already
reported — `103` says so itself about `04`'s call-site count. The number should not be read as 15
defects nobody else had seen.

---

## 6. Sentence provenance — checked vs carried

**118 sentences written or substantially rewritten. 104 checked against code, source, corpus or
live command output in this session. 14 carried from a prior report and labelled where they sit.**

**The carried 14, and why each was not re-derivable here:**

- `02` §3 — *"Every anchor write inside a lane window threw for about a week"*: the duration is
  `lane.js:38–47`'s own account and is not measurable from the tree. The mechanism **is** checked.
- `02` §3 — the 2026-09-16 date on which `lane.js`'s header said four; from that header.
- `03` §3 — the eight `var(--warn)` sites of 2026-08-25, from the ruling. I did not re-count them in
  today's tree, and the count would not mean the same thing if I had.
- `03` §5 — Mermaid vendoring at 3,572,661 B / 96%; `gen-diagrams.ts:12`, a past measurement.
- `03` §5 — the first generator run producing broken-image glyphs before re-serialisation; history.
- `04` §2 — 0.55 ms p95, flat in file size; `test/perf/audit-latency.perf.ts:12–19`. I read the
  recorded columns and did not re-run the perf suite.
- `04` §3 and `05` §1 — the ruling histories behind decay's threshold and the lesson tier (2).
- `05` §5 — `TASK-lesson-accept-…`'s `state: done` is checked in frontmatter, but its *meaning* —
  that the requirement moved onto the CLI command — is carried.
- `06` §2 — the `--N` collision history, and the 2026-09-14 lock hazard proved with two live
  processes (2).
- `07` §5 — the 2026-08-24 focus and the six items it hid, from the `KNOWN-` item, whose
  `valid_from: 2026-08-27` and `valid_until: 2026-09-03` I did check.
- `02` §4 — the 2026-09-08 transcript census (63,871,429 bytes, 27,752 records, 62.6%, 2,444), read
  from `read-model-conversation-document.ts:25–32`, explicitly dated in the chapter and **not**
  re-measured: that transcript is **151,884,220 bytes** today, which is why the caption says
  re-measure and why `00`'s subject line now carries all three readings.

Everything else — every line number, every count, every quotation, every direction of every arrow,
every figure in every table — was established in this session against the file it describes.

---

## 7. What I could not establish either way

- **Whether the Navigation and Copy panels were considered against the *icon* budget.** They add no
  icon reference and the sprite is unchanged at six symbols — consistent with "checked and needed
  none" and with "not considered". Stated as unknown in `03` §6 rather than guessed.
- **Whether `styles.css:1319–1320`'s wrong figures have ever been noticed.** Nothing in the corpus
  or under `reports/` that I could find names them. Reported here; not filed, per the constraint.
- **`scripts/backfill-requests.ts`'s relationship to the live ingest flow** (`06` §5). Still not
  traced. `103` flagged it; I did not close it either, and say so rather than describing it.
- **Whether `02` §3's *"about a week"* is right.** `lane.js` asserts it; nothing dates the first
  broken write. Left as the header's claim, attributed to it.

## 8. What is now settled that a prior pass left open

- **`07` §5's `focus_active` doctor check.** `103` left it *"either the check exists under a
  different name, or the comment is stale."* Settled on the second branch: `focus_active` occurs
  exactly once in all of `src/` — in `focus.ts:41` itself — and widening from the name to the
  subject, `src/doctor/`'s seven modules mention "focus" only at `checks.ts:1417`, `:1447` and
  `:1464`, all about a tag being invisible to `mycontext focus <prefix>:<field>`. There is no doctor
  check on focus state under that name **or any other**. The residual is a comment in `focus.ts`
  that will send a reader looking for something that does not exist.
- **`05` §5's Composer picker.** `103` left it *"not independently re-verified."* Verified: the
  picker exists, `id` and `key` are both `input: 'suggest'` riding one fetch with `key` narrowed by
  `dependsOn: 'id'` (`palette-defs.js:463–478`, `:512–517`), and the entry is `runnable` — which is
  what produced the `05` §4 finding above.

---

## 9. Method, and what I ran

Commands, all read-only; every block spliced into a document is stdout, never a transcription:

    mycontext ready
    mycontext decay --summary
    mycontext contribution --summary          (twice, minutes apart — see below)
    mycontext lesson --help
    mycontext ingest --help
    mycontext focus --show
    mycontext focus --category rule --preview
    npm run check:diagrams                    (after every diagram edit)
    node scripts/check-cited-items.ts --unresolved
    node scripts/check-cited-items.ts --quiet

Computed rather than copied: sixteen WCAG 2.x contrast ratios from the hex values; the `recordAudit`
module and invocation census; the anchors-file origin and lane-id census (**1,409 rows** today — 757
with a lane id, 1 `origin: 'owner'`, 1,408 `automatic`); the 1,324-id corpus index and an id scan
over all eight chapters; a relative-link resolver over all eight chapters; the ten SVGs' byte total
and mean; `wc -l` over 31 cited files; a `mermaidBlocks` extraction and byte-equality assertion
between `07`, README §4 and `docs/capabilities/02-injection.md`.

**Two figures moved between two runs of one command, minutes apart.** `mycontext contribution
--summary` reported 3,688 injection records and 1,317 items when `103` captured it, and 3,739 and
1,324 when I re-spliced it — the same day. `04` §4 now says so in the caption, because it is the
sharpest demonstration this directory has that a count is a date and not a fact.

Files written: the eight chapters under `docs/system/` and this report. `src/`, `scripts/`, `test/`,
`e2e/`, `.my_context/`, `README.md`, `docs/README.he.md` and `docs/capabilities/` are untouched —
checked with `git status --short`, which shows the other lane's files modified by the other lane and
mine modified by me, with no overlap.

---

*Verified and repaired 2026-09-17 by lane BB, starting against `ef52818f` and finishing across
`e515eff4`, with another lane writing `docs/capabilities/**`, `README.md` and `docs/README.he.md`
throughout. The fence total printed by `check:diagrams` moved from 38 to 39 while I worked, for that
reason, which is why `03` §5 now records the shape of that reading rather than its number. Every
count in this report is itself a dated reading.*
