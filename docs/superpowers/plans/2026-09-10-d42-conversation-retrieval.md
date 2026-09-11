# D42 — Conversation retrieval · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** let the owner find his way back — search the archive, mark anchors, and reconstruct a subject from a passage he copied, without the noise ever entering his context.

**Architecture:** FTS5 over the existing conversation index (Node 24's bundled SQLite already has it) plus an `anchors` table. Retrieval writes a **mission** for a subagent, which reads in its own window, verifies against **code and git**, and returns a small, chronological, **cited** file that the owner reads in the UI. Only what he chooses returns to his context.

**Tech Stack:** `node:sqlite` FTS5 (`bm25`, porter, trigram — Hebrew verified) · vendored markdown-it for document headings and inline code · the existing conversation reader and viewer.

**Spec:** `docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md` — approved 2026-09-10.
**Research:** `reports/2026-09-10-lexical-selection-research.md` — 1,187 lines, and it decides several tasks below. **Read both before Task 1.**

## Global Constraints

- `CONST-zero-runtime-dependencies` and `CONST-node-24-no-build-step` — no new package, no build step, erasable TypeScript only, explicit `.ts` on relative imports.
- **Nothing is injected into the owner's context without him choosing it** (spec §10). This is the rule that makes the rest safe; it is asserted, not assumed.
- **The harness's own files are read, never rewritten.** `readSubagentMeta`'s header rules it; `archive/33` and `/48` both turned on it.
- **Bytes, not characters.** `iterateTranscript` walks byte offsets from the Buffer — the corpus is Hebrew from record 5.
- **A test declares its basis**; `npm run check:basis` gates it.
- **Prove by REMOVAL, and distrust a green removal proof.** On 2026-09-10 two removal proofs passed because the assertions had moved across a test boundary and `-g` selected a test that did not contain them. **Plant an impossible value first** to prove an assertion can fail at all.
- **Read the suite's own exit code**, never a pipeline's.
- **A delegated worker runs no git command that writes.** The dispatching session commits, staging by explicit path.

---

## What the research already settled — do not re-litigate these

| decision | measurement |
|---|---|
| **No new dependency** | prose is **0.97%** of 793.6 MB; whole pipeline **8.1 s**, 3.5 MB index. Nothing here is a performance problem. |
| **FTS5, not a library** | Node 24's SQLite 3.51.2 has `ENABLE_FTS5`, `bm25()`, porter, trigram — Hebrew verified. `node:sqlite` already imported in 14 files. |
| **Match NAMES, not headings** | as FTS5 queries: headings **4%**, word-bags **32%**, item-id slugs **68%**. |
| **markdown-it for documents** | vendored, zero import statements, **4,348 headings and 59,600 inline-code spans over 7.53 MB in 536 ms**. A regex misses **44%** of inline code. |
| **Exact 8-gram dedup, ~40 lines** | 8-gram index **629 ms / 60 pairs**; SimHash 677 ms; MinHash+LSH **4,065 ms**. Brute force over 3,136,260 pairs took **20 ms** — LSH solves a problem that does not exist here. |
| **No lexical signal/noise classifier** | punctuation density **AUC 0.499**, a coin flip; best single feature 0.836; a two-rule classifier admitted **47%** of the noise. Route by tool name instead: `Bash` is **65.5%** of `tool_result` bytes. |
| **Nothing to adopt** | near-duplicate packages 5–14 years abandoned; the most-downloaded has a **53-bit precision bug**. MCP returns **zero** servers for the category. |

---

## Phase 1 — Search and anchors

*Worth having even if nothing else ships: it improves the viewer he uses today.*

### Task 1: An FTS5 index over the archive's prose

**Files:**
- Create: `src/core/conversation-search.ts`
- Modify: `src/core/conversation-index.ts` (schema version)
- Test: `test/core/conversation-search.test.ts`

**Interfaces:**
- Produces: `buildSearchIndex(index)`, `searchArchive(index, query, scope): Hit[]` where `Hit = { sessionId, recordIndex, byteOffset, snippet, score }`

- [ ] **Step 1: Failing test — a phrase in a session is found, with its byte offset.**
- [ ] **Step 2: Failing test — Hebrew is found.** The corpus is Hebrew from record 5; a search that only works in English is broken here, and trigram is what makes substring matching work.
- [ ] **Step 3: Implement.** Index **prose only** — `classifyTurn` already does the 99% reduction in thirteen lines; reuse it rather than writing a filter.
- [ ] **Step 4: A NEW TABLE IS A NEW SCHEMA VERSION.** `openReadOnlyChecked` walks `CONVERSATION_TABLE_COLUMNS` and refuses a shape it does not read — that is by design (`seq:12`/`33`). Assert that an older index reports Incomplete and heals on rebuild, and **run the rebuild yourself** so the owner's server is not left stale, as `archive/34`'s lane did.
- [ ] **Step 5: Commit.**

### Task 2: The viewer's search uses it

**Files:**
- Modify: `src/ui/read-model-conversations.ts`, `src/ui/public/screens/conversations.js`
- Test: `test/ui/conversations-endpoint.test.ts`, `e2e/conversations.spec.ts`

- [ ] **Step 1: Failing test — a search finds a phrase that is NOT in any drawn row.** The document is virtualised; a search that only reads what is on screen is the defect, not the feature.
- [ ] **Step 2: Implement**, scoped by session and date (Task 5 adds the controls).
- [ ] **Step 3: Browser proof, BOTH projects, serially.** Beware: assertions inserted into a large spec can land in a neighbouring test — check which test yours is in before trusting a pass.
- [ ] **Step 4: Commit.**

### Task 3: The anchors table

**Files:**
- Create: `src/core/anchors.ts`
- Modify: `src/core/conversation-index.ts`
- Test: `test/core/anchors.test.ts`

**Interfaces:**
- Produces: `markAnchor({ sessionId, byteOffset, label })`, `anchorsFor(sessionId)`, `searchAnchors(query)`

- [ ] **Step 1: Failing test — an anchor survives a rebuild.** `archive/34` measured why a column cannot: `upsert` sets every column from `excluded` and the Stop hook rebuilds every turn, so a hand-typed value lives **one turn, silently**.
- [ ] **Step 2: Failing test — an anchor survives `removeMissing` pruning the session row.** The second failure `seq:34` measured; a table keyed by session id outlives the row.
- [ ] **Step 3: Implement as a TABLE**, following `persisted` and `named`.
- [ ] **Step 4: Failing test — the position is a BYTE offset** and resolves to the right record in a Hebrew transcript.
- [ ] **Step 5: Commit.**

### Task 4: Anchors set two ways

**Files:**
- Modify: `src/cli/commands/conversation.ts`, `src/ui/public/screens/conversations.js`, both string tables
- Test: `test/cli/anchors.test.ts`, `e2e/anchors.spec.ts`

- [ ] **Step 1: Failing test — the owner marks an anchor from the viewer.**
- [ ] **Step 2: Failing test — a table or a report is marked automatically**, without him asking (his ruling). Assert on a planted turn containing a table.
- [ ] **Step 3: Failing test — a ruling he gave is marked automatically.**
- [ ] **Step 4: Implement.** Both string tables.
- [ ] **Step 5: Browser proof, both projects.**
- [ ] **Step 6: Commit.**

### Task 5: Scope controls

**Files:**
- Modify: `src/ui/read-model-conversations.ts`, `screens/conversations.js`
- Test: `test/ui/conversations-endpoint.test.ts`, `e2e/conversations.spec.ts`

- [ ] **Step 1: Failing test — search narrows by session NAME** (names exist since `archive/34`).
- [ ] **Step 2: Failing test — search narrows by a date range, IN THE READER'S ZONE.** `archive/37` made `zonedFields` the single day derivation so the filter and the printed stamp cannot disagree — reuse it, do not compute a second day.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Browser proof, both projects, including a DST boundary** — `archive/37`'s lane proved a fixed offset passes July and fails January.
- [ ] **Step 5: Commit.**

---

## Phase 2 — Retrieval

### Task 6: A selection becomes a query

**Files:**
- Create: `src/core/retrieval/from-selection.ts`
- Test: `test/core/from-selection.test.ts`

**Interfaces:**
- Produces: `queryFromPassage(text): { names: string[]; terms: string[] }`

- [ ] **Step 1: Failing test — identifiers are extracted from a copied passage.** Item-id slugs, file paths, backticked names — the tokens that matched **68%** where headings matched 4%.
- [ ] **Step 2: Failing test — a passage with NO names yields a stated "nothing to match on"**, never a guess. A guess that resolves is worse than silence.
- [ ] **Step 3: Implement** using Aho–Corasick over backticked identifiers (**39 terms per block** measured).
- [ ] **Step 4: Commit.**

### Task 7: Subjects from documents

**Files:**
- Create: `src/core/retrieval/subjects.ts`
- Test: `test/core/subjects.test.ts`

- [ ] **Step 1: Failing test — headings and inline code are extracted from a spec.** Use **vendored markdown-it**, not a regex: it misses 44% of inline code, and inline code is what this runs on.
- [ ] **Step 2: Failing test — depth is a knob.** Shallow reads titles and headings; deep reads the documents fully. Assert the two return different sets.
- [ ] **Step 3: Failing test — session text matches the vocabulary**, and what does not match is surfaced as an unnamed thread rather than dropped.
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Commit.**

### Task 8: Noise removal

**Files:**
- Create: `src/core/retrieval/noise.ts`
- Test: `test/core/noise.test.ts`

- [ ] **Step 1: Failing test — the `said`/`work`/`deed` classification decides what is kept.** Reuse `archive/13`'s classification; a second definition of noise would drift from the screen's.
- [ ] **Step 2: Failing test — text repeating more than once is dropped**, and the count removed is REPORTED. On the real corpus the top repeated 8-gram is an injected harness note appearing **195 times**.
- [ ] **Step 3: Implement the exact 8-gram inverted index** — about 40 lines. **Do not implement MinHash or LSH**: measured 4,065 ms against 629 ms, solving a problem this scale does not have.
- [ ] **Step 4: Failing test — routing is by TOOL NAME, not by punctuation.** Assert that a prose-bearing tool's output survives and `Bash` output does not. A lexical classifier scored **AUC 0.499**.
- [ ] **Step 5: Commit.**

### Task 9: The mission

**Files:**
- Create: `src/core/retrieval/mission.ts`
- Test: `test/core/mission.test.ts`

**Interfaces:**
- Produces: `writeMission(request): { path: string }`

- [ ] **Step 1: Failing test — the mission names the material, the verification duties, and the citation requirement.** Three assertions, because a mission missing any one produces a result that cannot be trusted.
- [ ] **Step 2: Failing test — the mission NEVER contains the raw material inline.** The point is that the noise does not enter a context window.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Commit.**

### Task 10: Results are files, and they cite

**Files:**
- Create: `src/core/retrieval/result.ts`
- Modify: `.gitignore`
- Test: `test/core/retrieval-result.test.ts`

- [ ] **Step 1: Failing test — the result directory is GITIGNORED.** Results contain conversation text, and the owner ruled conversation files are gitignored so no sensitive data reaches git. Assert against the real `.gitignore`.
- [ ] **Step 2: Failing test — every claim carries a citation** that resolves to a turn, a commit, or a file and line.
- [ ] **Step 3: Failing test — a result whose citations no longer resolve REPORTS that it has aged**, rather than being silently wrong.
- [ ] **Step 4: Implement**; index the directory so the UI can list it.
- [ ] **Step 5: Commit.**

### Task 11: The UI — read the result, choose what returns

**Files:**
- Modify: `src/ui/public/screens/conversations.js`, `read-model-conversations.ts`, both string tables
- Test: `e2e/retrieval.spec.ts`

- [ ] **Step 1: Failing test — the four modes are offered**, scoped by session and date.
- [ ] **Step 2: Failing test — a result is rendered, and NOTHING reaches the context until the owner chooses.** This is the rule that makes the feature safe; assert it directly.
- [ ] **Step 3: Failing test — he can return part of a result** (a table alone), not only the whole thing.
- [ ] **Step 4: Failing test — what returns is DATED, marked a record, and a superseded ruling says so on arrival.** Plant a supersession and assert the marking; this prevents the defect `CLAUDE.md` opens with.
- [ ] **Step 4a: Failing test — a result can be STAGED FOR A FRESH WINDOW instead of returned here.** Spec §10a, owner ruling 2026-09-11. The screen offers two destinations: this session (steps 2–4) and a cleared one. The second calls `stageRestoreSummary` / `approveStagedRestore` in `src/core/restore-stage.ts` — D34's carrier, which shipped 2026-09-11. **Do not build a second delivery path**; staging, the verified-present check, the owner's clear and the loop guard all come with that carrier and are already tested.
- [ ] **Step 4b: Failing test — staging is NOT delivery.** Assert that staging a result puts nothing into any context: the clear is still his act, and `driftCheck`'s shape is the precedent for asserting an inability rather than promising it.
- [ ] **Step 4c: Failing test — a STAGED result is marked too.** Dated, a record rather than a current instruction, a superseded ruling saying so on arrival. A fresh window makes this more important, not less: there is less context around it to contradict a stale claim.
- [ ] **Step 5: Implement.** Both string tables.
- [ ] **Step 6: Browser proof, BOTH projects, serially**, and on `/lane.html` as well as the session document — both run the same `mountDocument`.
- [ ] **Step 7: Commit.**

### Task 12: Rounds compose

**Files:**
- Modify: `src/core/retrieval/mission.ts`, the UI
- Test: `e2e/retrieval.spec.ts`

- [ ] **Step 1: Failing test — a first round returns a subject list; a second round extracts from a chosen subject.**
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Commit.**

---

## Phase 3 — Drift detection

*Last, deliberately: retrieval is the cure and stands alone; this is prevention and needs Phase 2's machinery to judge against.*

### Task 13: Notice divergence

**Files:**
- Create: `src/review/drift.ts`
- Test: `test/review/drift.test.ts`

- [ ] **Step 1: Failing test — drift is detected against an anchor**, not against a guess at intent.
- [ ] **Step 2: Failing test — it is OFF by default.** Telling him he has drifted when he has not is worse than silence.
- [ ] **Step 3: Reuse `loop/2`'s trigger machinery** — it already computes *is this session worth looking at* and measured the shape: 3,924 tool calls → 261 considerations → 164 fires → **3 passes**, where firing on every `Stop` would have been **766**.
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Commit.**

---

## Self-review notes for the executor

- **Phase 1 is shippable alone.** If Phase 2 is never built, the viewer still gained real search and anchors. Do not entangle them.
- **Task 10 Step 1 is the privacy boundary.** If results are ever committed, conversation content reaches git, which the owner ruled against.
- **Task 11 Step 2 is the safety boundary.** Everything else can be imperfect; this one cannot.
- **The measurements above are the design.** If a task's implementation implies one of them is wrong, re-measure and say so — three lanes on 2026-09-09/10 corrected their own items from measurement, and it was the most valuable thing each of them did.
