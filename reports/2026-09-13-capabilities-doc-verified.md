# `docs/capabilities/` verified against the code — 2026-09-13

**The question asked:** is the capabilities reference complete, and is it accurate?

**The answer, in two sentences.** It is **accurate in its mechanisms and wrong in its
absolutes** — every chapter describes how the machinery works correctly, and several chapters
state a guarantee more strongly than the code provides, which on this project is the specific
defect that costs most. It is **not complete**, and the largest hole is not a missing chapter
but a missing *day*: nothing written on 2026-09-12 knows about anything that landed on
2026-09-13, and five surfaces that shipped today appear in **zero** of the fourteen files.

This was written 2026-09-12 22:27–22:44 by thirteen parallel forks. `docs/capabilities/` has
not been touched since. The verification below is read-only: no source, test, corpus item or
chapter was changed, no git command that mutates state was run, no server was started, and the
working tree was confirmed clean before and after.

---

## Verdict per chapter, one line each

| # | Chapter | Verdict |
|---|---------|---------|
| 0 | Index | **Accurate.** Its "built but off" roll-up is correct on all four entries; it under-counts its own size (~300 KB stated, 328 KB actual) and inherits every chapter error it summarises. |
| 1 | Items and the corpus | **Stale in named places.** Mechanism, 29-category catalogue, frontmatter table and both worked examples are correct; three counts moved today, two absolutes are overstated, one internal link is dead. |
| 2 | Injection | **Wrong in named places.** Budgets, the spare band and `GoverningSpill` are exact to the character. The doors table misreports which hooks are doors *and* which event each passes to `select` — and contradicts the product constant the chapter itself quotes two lines above. |
| 3 | Creation and the gates | **Wrong in named places.** The summary gate and contradiction gate are right line-for-line. The checksum section describes a hash function that is not `computeItemChecksum`, cites a finding code that does not exist, and names the wrong escape-hatch flag. Zero coverage of the gate layer that landed today. |
| 4 | The conversation archive | **Wrong in two places.** The FTS5 schema, the trigram-vs-unicode61 Hebrew measurement and the `persist` account are exact to the character. It claims a CLI capability that does not exist, and its `forget` scope claim is contradicted by the code. |
| 5 | Anchors | **Accurate, one miscount.** Written *after* the anchor rework, so it has the three creation paths, the per-turn pass and the retired `report` grammar right. Says "seven fields" and then names eight. Its live count is 636 anchors; the file now holds 712. |
| 6 | Retrieval | **Wrong in one place, stale in another — and the wrong one was wrong on the day it was written.** The guarantee, the seven modules and the four modes are described accurately and honestly. The status claim is not. |
| 7 | Restore and handover | **Accurate — the best-verified chapter in the set.** Every command, flag, usage string, quoted sentence and pasted live output still reproduces today, `check:handover` byte for byte. Its defects are all narrowness: one list claimed complete that is not, and three guarantees stated wider than the code. |
| 8 | The web UI | **Wrong in its headline security claim.** The 20-screen rail table is exactly right and every quoted source header is verbatim. The no-writes guarantee is stated as three exceptions; the test enforces twelve. |
| 9 | The CLI and MCP | **Stale, with one wrong list and one wrong worked example.** All 26 MCP tools are named correctly. It counts 33 command files where 32 register a command, and its one MCP example — the one it flagged as schema-derived — is wrong about the output shape in both respects. |
| 10 | The product rule store | **Overstated in named places.** Counts, tier split, isolation and the delivery/assertion topology are accurate and well-evidenced. The checksum seal is presented as live tamper-evidence; nothing runs it, and its repair path is unreachable code. |
| 11 | The self-improvement loop | **Accurate — the strongest chapter in the set — and one claim went stale *during this verification*.** It says all three of the things it had to say. Its statement that the loop is off in this repository stopped being true at 20:17 today. It omits two of the thirteen modules in its own source root, one of which is a third off-switch. |
| 12 | Packs, export/import, procedures | **Accurate on flags, wrong on one count.** Every flag spelling verifies verbatim. Claims 95 slash-command files where there are 91 — and its own enumeration on the same page sums to 91. Predates today's pack-import refusal. |
| 13 | The testing discipline | **Accurate, and silent on the one thing that changed today — which is its own subject.** Every mechanism it describes is described correctly. It never says *where* any gate runs, and as of today eight of nine run in CI and one runs pre-commit. |

---

## Counts

- **Claims checked properly:** ~230 across the 14 files (command and flag spellings, file paths,
  defaults, counts claimed complete, and every absolute — "never", "always", "only", "nothing").
- **WRONG** (a reader would be misled or blocked): **26**
- **STALE** (was true when written, has since changed): **30**
- **OVERSTATED** (stronger than the code supports): **17**

**73 defects in 4,784 lines — roughly one every 65 lines.** The distribution matters more than
the total: the *mechanism* prose is overwhelmingly right, and almost every defect is a **number,
a name, or an absolute**. Nine of the WRONGs are a count or a list the chapter claimed complete
(33 command files, 95 slash files, seven anchor fields, three write exceptions, three refusals,
two excluded fields, twelve rule entries replayed, seven schema tables, five modules of seven).

Six defects were **wrong on the day they were written**, not stale — the write-exception count,
the Composer-is-the-only-writer claim, retrieval's "no CLI calls it", the `search`-covers-the-
archive claim, the checksum-shape description, and the `--summary-omitted` flag name. Those are
the ones a revision cannot fix by re-running a command; they need re-reading the code.

- **Surfaces with zero coverage anywhere in the reference:** see §The gaps.

---

## The single worst inaccuracy

**`08-web-ui.md:21, 29, 48, 293` — "the no-writes guarantee, and its three named exceptions" /
"Nothing else under `src/ui/` writes to disk".**

`RULED_WRITES` in `test/ui/no-writes.test.ts:607–783` holds **twelve bindings across five
files**, and the test asserts set *equality*, so twelve is the enforced number, not a floor:
`anchor-write.ts` ×3, `execute.ts` ×3, `retrieval-write.ts` ×2, `security.ts` ×1,
`server.ts` ×3.

It is the worst for four reasons, not one:

1. It is a **security claim**, and it is wrong by a factor of four in the permissive direction.
2. It is **not stale**. `anchor-write.ts` landed in `c096454c` at 2026-09-12 10:24; the chapter
   was written at 22:37 — twelve hours later. Only `retrieval-write.ts` (22:45) post-dates it,
   by eight minutes.
3. The corpus **already files it**:
   `.my_context/items/task/TASK-three-prose-claims-that-the-web-surface-binds-no-writer-have.md`
   names this chapter by path in its `scope:` and states "RULED_WRITES … currently holds 12
   bindings across 5 files". The chapter and the corpus disagree, and the corpus is right.
4. The chapter then builds a second claim on top of it — `08-web-ui.md:170`, "the Composer …
   the one place the 'read-only' UI can actually cause a write" — which is false twice over:
   the Conversations screen writes anchors and stages retrievals through
   `POST /api/conversations/anchors/{mark,relabel,drop,sweep}` and
   `POST /api/retrieval/{stage,approve}` **with no composed command at all**
   (`src/ui/anchor-write.ts:38–40` says so in its own header: *"NOTHING HERE COMPOSES A COMMAND
   OR STARTS A PROCESS"*), and the Copy+Execute control is adopted by eight screens, not one.

A reader auditing this tool for whether a local web surface can write to their corpus would
come away with the wrong answer.

**Runner-up, and the worst by the brief's own test ("a command that does not exist"):**
`04-conversation-archive.md:145` — "`search` covers both the Markdown item corpus **and the
conversation archive** from one command". `mycontext search` never touches the archive;
`searchArchive` has zero callers under `src/cli/`, and `conversation`'s USAGE has no `search`
subcommand. **There is no CLI path to FTS5 archive search at all.** The chapter then spends its
longest and most rigorously measured section — the trigram tokenizer, the Hebrew hit table, the
`MIN_QUERY_CHARS = 3` floor — teaching a reader how a search they cannot run from the CLI
behaves. The measurement is real; the way in is not.

---

## Anything the document claims that is stronger than the code supports

This is the category the project's own rule is about — a comment claiming what the code no
longer does is worse than no comment — so it is collected here across chapters rather than
buried in each.

| Where | The claim | What the code provides |
|---|---|---|
| `08-web-ui.md:21,29,48,293` | Three audited write exceptions; nothing else writes | Twelve bindings across five files, enforced by set equality — `test/ui/no-writes.test.ts:607–783` |
| `08-web-ui.md:170` | The Composer is the one place the UI can cause a write | Two whole write surfaces bypass command composition entirely — `src/ui/anchor-write.ts:38–40`, `src/ui/retrieval-write.ts:420–427` |
| `10-rule-store.md:81–97` | The checksum seal protects the store | `verifyManifest` has one caller outside the maintenance-only pair: a CLI command a person must choose to run. No hook, no door, no `doctor` check, no CI. `loadRules` `readdirSync`s the directory and never asks the manifest, so any `.md` dropped into `entries/` is delivered as a governing constant — `src/rules/store.ts:85`, `src/cli/commands/rules.ts:228` |
| `10-rule-store.md:95,168` | `rules verify --restore` puts back what shipped | `packageStore` and `store` are assigned the same `entriesDir()`, so the guard `path.resolve(a) !== path.resolve(b)` is always false and `restoreEntries` is never reached — `src/cli/commands/rules.ts:177–196, 221–224`. The chapter reproduces, as documentation, the exact defect a corpus item files. |
| `10-rule-store.md:119` | `pre-tool-use.ts` runs "on every tool call" | Registered with matcher `Read\|Edit\|MultiEdit\|Write\|NotebookEdit\|Agent` — `hooks/hooks.json:29` |
| `01-items-and-corpus.md:14` | No second copy of a rule's text anywhere | `items.data TEXT NOT NULL` stores the whole serialized item, body included — `src/core/store.ts:29`; `.my_context/.revisions/` holds staged bodies |
| `01-items-and-corpus.md:80` | Every governing item is at least named in the index line | The index tier has its own budget; `GoverningSpill.untitled` exists precisely to name items that got no line at all — `src/core/select.ts:431–440, 1188–1196` |
| `01-items-and-corpus.md:86,109` | A rationale item is never injected in full | The continuity tier draws from `eligible`, never consults `isNormative`, and `categories.ts:125` annotates that as the point: a `reference` with `continuity: true` is delivered in full — `src/core/select.ts:1666` |
| `03-creation-and-gates.md:312–315` | `--supersedes` on `add`/`edit` fires the same mechanism | Only when the write is in contradiction scope *and* governing, *and* the id was actually raised as a candidate — `src/core/mutate.ts:1026, 1213, 2100`. Otherwise it records no edge at all. |
| `03-creation-and-gates.md:235–236` | Unordered collections are sorted before hashing | True of `canonicalContent`; `computeItemChecksum` passes `scope`/`tags` straight through unsorted — `src/core/item.ts:806` |
| `09-cli-and-mcp.md:31–83` | "The real, current top-level usage line (run yourself with `node src/cli/index.ts --help`)" | The block is **abridged** and presented as verbatim output. It silently drops real flags: `ready --questions`, `focus --tag/--category/--scope/--relations/--yes`, `restore --session/--range/--subject/--points/--reasoning/--code/--from-result/--claims`, `export --type/--status/--tag/--pack-name/--pack-version`, `statusline --settings`, `session carry --none/--show`. Verified by running each subcommand's own usage. |
| `12-packs…md:64–82` | "One of its items, **verbatim**" | Seven frontmatter lines omitted and the body re-wrapped |
| `10-rule-store.md:173,177` | "All twelve, each with its **real** `rules show` output" | Live output orders `id · kind · tier` first, title second — the reverse of what the chapter states — and the reproduced blocks are silently truncated |
| `13-testing-discipline.md:456–459` | "A live, unfixed finding exists **right now**" — a NUL byte in `src/ui/retrieval-write.ts` | Ran it: `1325 text file(s) scanned: none contains a NUL byte.` Exit 0. Stated in the present tense. |
| `04-conversation-archive.md:250–253` | `conversation forget` drops the entire index "and the tables themselves" | Drops four of seven tables; `conversation_prose` (the 42 MB FTS5 table), `prose_sources` and `anchors` survive — `conversation-index.ts:3096–3102` vs `:134–157` |
| `04-conversation-archive.md:194–210` | "real output" for `conversation secrets --json` | 7 of `SecretCandidate`'s 14 fields, no elision mark — `conversation-secrets.ts:611–634` |
| `07-restore-and-handover.md:265–282` | "The other refusals, each stated rather than defaulted" — three bullets | `OnDemandAskVerdict` has seven values; `off` and `unwritable` are never mentioned — `handover-ask.ts:1382–1384` |
| `07-restore-and-handover.md:54` | The staged summary is delivered "at the next session start" | Gated on `!manual && !subagent && !compacting`, so a PostCompact start, a subagent start and a manual injection get nothing — `inject.ts:566–568`. The chapter frames the problem as "cleared **or** compacts". |

---

## Chapter detail

*Each defect: chapter file and line · the claim · what the code does · the code's file and line ·
severity.*

*Order below: 1, 2, 3, 8, 10, 12, 13, then 4, 7, 5, 6, 9, 11 — grouped by how they were checked,
not by number.*

### Chapter 1 — Items and the corpus

Mechanism, the 29-category catalogue, the frontmatter table and both worked examples are
correct. The defects are three counts that moved today, two absolutes, and a dead link.

1. `:10` — "`resolveWorkspace` in `src/core/workspace.ts:169`" — now declared at
   `src/core/workspace.ts:224`; today's `288377eb` inserted ~60 lines of header above it. (It was
   at 162 when the chapter was written, so 169 already pointed inside the function.) — **STALE**
2. `:14` — "There is no second copy of a rule's *text* anywhere else in the project" — the index
   stores the whole serialized item, body included, in `items.data TEXT NOT NULL`
   (`src/core/store.ts:29`); `.my_context/.revisions/` also holds staged bodies. The paragraph's
   framing (index is a cache, Markdown is truth) is right; the absolute is not. — **OVERSTATED**
3. `:35`, `:225` — "rule … 55" / "the largest normative category by volume" — 56 rule files on
   disk; three rule items were touched today. — **STALE**
4. `:59`, `:100`, `:286` — "task … 740" / "this corpus alone holds 740 task items" — **865** task
   files on disk after today's `ee4a3a4a` ("113 findings become items"). Mitigated: `:63` dates
   the counts 2026-09-12. — **STALE**
5. `:80` — "every other `active` normative item is **at least named** in the session's index line
   so an agent can pull it" — the index tier has its own budget; overflow is recorded as a
   `Spill` at `tier: 'index'`, and `GoverningSpill.untitled` exists precisely to name governing
   items that got no line at all — `src/core/select.ts:431–440, 1188–1196`. — **OVERSTATED**
6. `:86` — "A rationale item is **never** injected in full" — the continuity tier draws its
   candidates from `eligible`, not `injectable`, and never consults `isNormative`, so a
   rationale-tier item with `continuity: true` **is** delivered in full. The code says this is
   the point of the tier: "The item this tier exists for is a `reference`, which is
   rationale-tier by catalogue" — `src/core/select.ts:1637–1669`, `src/core/categories.ts:125`.
   (The rest of the bullet — never named in the session index, reduced to a bare count — is
   correct.) — **WRONG**
7. `:109` — "`select` filters `isNormative` before it ever reads `always`/`scope`, so the
   question of whether a reference could govern never even arises" — the same defect from the
   other side; `TIER_UPDATES.rationale.continuity` is annotated "never consults isNormative, so a
   reference can carry it" — `src/core/categories.ts:125`. — **OVERSTATED**
8. `:248` — `[Packs, procedures, and runbooks](./12-packs-procedures.md)` — no such file. —
   **WRONG** (dead link; see gaps §C7)

**Right and worth protecting:** both shipped examples are byte-accurate against the live CLI
(`examples rule --short`, `examples glossary --short`, `:218–222`, `:234–235`); the
`mycontext show RULE-1-1-…` block at `:168–196` matches real output field for field including
`acknowledged` rendered as `code@hash` and the dated `summary_was`; and every code-sourced
measurement verifies — the 276/213/13/5 state figures (`categories.ts:16–20`), 518 retained and
"all 133 disagree with the audit log" (`categories.ts:448–460`), median title 70 / 202 of 730 /
one at 566 / median body 1,693 (`types.ts:130–146`), `SUMMARY_HISTORY_MAX` = 3, and `request`
excluded from rendering, summary basis and checksum. All ten cited item ids exist on disk.

### Chapter 2 — Injection

Budgets, the spare band and `GoverningSpill` are exact to the character. The doors table — the
chapter's own headline subject — is not.

1. `:31–36` — the table headed "The doors" **lists `PreToolUse` as a row and omits `PreCompact`**.
   The chapter quotes `def-a-door`'s `confusedWith` at `:26–28` ("`PreToolUse` is not a door") and
   then contradicts it two lines later; `def-a-door`'s `means` names "session start — new,
   resumed and compact-restore — `PreCompact`, and subagent start". — **WRONG**
   *(Note for a revision: `def-a-door` itself is separately wrong the other way — see chapter 10's
   gaps. The code excludes `PreCompact` from delivery and asserts there instead. So the table is
   wrong, and the constant it should have followed is also wrong. That needs an owner ruling, not
   a doc edit.)*
2. `:34` — compaction row, "Event passed to `select`: `'session-start'` (`source: 'compact'` is
   the proxy)" — `SelectEvent` has a real `'compact'` member and `buildInjectionResult` passes it:
   `event: manual ? 'manual' : subagent ? 'session-start' : compacting ? 'compact' :
   'session-start'` — `src/core/inject.ts:410, 699–700`, `src/core/select.ts:18`. — **WRONG**
3. `:35` — subagent row, "Event passed to `select`: `'subagent'`" — `'subagent'` is an
   `InjectionEvent`, never a `SelectEvent`; the subagent branch selects as `'session-start'`, and
   the source says so in capitals ("`SelectEvent` deliberately gains no member") —
   `src/core/inject.ts:65, 640–642, 699`. — **WRONG**
4. `:72` — "an unknown key is refused outright (typo protection — `"budgets" for "budgets"` is
   named in the source as the concrete case this guards)" — the sentence is self-identical and
   names nothing. The source's concrete case is `"pined": 9000` — `src/core/config.ts:1752`. —
   **WRONG** (misquote)
5. `:89–92` — "the `rationale` tier's table has **no `always` entry at all**, so setting it on a
   `decision` or `lesson` is refused" — `TIER_UPDATES.rationale` *does* carry an `always` entry,
   with `values: ['false']` and the note "Only false. `--always true` is REFUSED here". The
   refusal comes from the closed value set plus `inertFieldError` in `cli/commands/edit.ts`, not
   from absence — `src/core/categories.ts:95–102, 124`. Conclusion holds; mechanism is false. —
   **WRONG**
6. `:151–154` — "`Selection.full` … tagged with its tier (`'pinned' | 'jit' | 'restored' |
   'continuity'`, **or `'index'`** for the title-only fallback)" — `SelectionEntry.tier` has
   exactly those four members and no fifth; `'index'` exists only on `Spill['tier']`, and
   title-only lines are `IndexLine`s in `Selection.index.normative`, never in `Selection.full` —
   `src/core/select.ts:155–162, 1192`. — **WRONG**
7. `:182–183` — "empty at every budget the index has ever been set to, **from 1,200 up to 470**"
   — the source reads "`displaced` is `0` from 1200 **down to** 470"; the probe lowered the
   budget (470 < 1,200) — `src/core/select.ts:436`. — **WRONG** (direction inverted)
8. `:10` — "`src/core/inject.ts` (`buildInjectionResult`, **1,157 lines**)" — now 1,231. It was
   exactly 1,157 at `288377eb^`, so this was true until today. — **STALE**
9. `:59` — "overrides all but `continuity`" — the JSON block quoted immediately below *does*
   contain `"continuity": 2000`, set explicitly to a value that happens to equal
   `DEFAULT_BUDGETS.continuity` — `.my_context/config.json:8–14`, `src/core/config.ts:93–95`. —
   **OVERSTATED** (minor)

**Right and worth protecting:** the spare-band snippet at `:120–123` matches
`src/core/select.ts:1620–1623` **character for character**, and every number in that section —
37 `always` items, 22,582, 7,418, 13 admitted all `hard`, 82→69, "69 of the 82 do not fit" —
matches `select.ts:1602–1618` and `:862–863`. The `GoverningSpill` section is equally exact: the
interface, the six `GOVERNING_TYPES`, the rendered sentence, the `⚠` marker, "never budgeted",
and `governingSpill === null` on a `'tool'` event because `tiersRun` never adds `'index'`
(`select.ts:421–445, 1804–1817`, `render.ts:228–256`). `DEFAULT_BUDGETS` and the
`budgets-write.ts:63` error string are verbatim.

### Chapter 3 — Creation and the gates

The two gate narratives hold line for line. The checksum section does not — it describes a
different hash function — and there is zero coverage of the gate layer that landed today.

1. `:229–234` — "`computeItemChecksum` … hash a canonicalised `ContentShape` … deliberately
   **excluding** bookkeeping fields (`id`, `status`, `origin`, provenance, lifecycle dates,
   storage location, `request`)" — `computeItemChecksum` hashes a larger shape that explicitly
   **includes `id`, `status` and `origin`**: `{id, type, title, status, severity, always, scope,
   tags, origin, extra, body}` plus conditional `continuity`, `summary`/`summary_of`,
   `summary_was`, `acknowledged`, `steps`, then unconditional `observations` and `relations`.
   Only `request` is genuinely excluded, and the code says so ("its absence is the only
   unconditional one in this function") — `src/core/item.ts:802–845, 895–900`. — **WRONG**
2. `:230–233` — "`itemSummaryBasis`/`contradictionBasis` … all hash a canonicalised
   `ContentShape`: type, title, body, steps, severity, always, continuity, scope, tags,
   observations, relations, extra" — `itemSummaryBasis` hashes only the **four** fields
   `SUMMARY_BASIS` marks `summarised` (`body`, `steps`, `observations`, `extra`), two of them
   narrowed further (`summarisedExtra` drops `WORKFLOW_EXTRA_KEYS`; `summarisedObservations`
   drops lifecycle categories). `title`, `severity`, `always`, `continuity`, `scope`, `tags`,
   `relations`, `type` are all `unsummarised` — `src/core/content-hash.ts:291–304, 339–340,
   539–557`. This also silently contradicts the chapter's own correct `:61–63`. — **WRONG**
3. `:230` — "`contradictionBasis` (`content-hash.ts`)" — it is `src/core/verdict-store.ts:59`,
   and it is a one-line delegation `item.summaryOf ?? itemSummaryBasis(item)`, not an independent
   hash. — **WRONG** (file path)
4. `:291` — "a real `mycontext doctor --json` run reports **zero `checksum_mismatch`** and zero
   `checksum_basis_migration` findings" — **`checksum_mismatch` is not a finding code.** The only
   checksum-related `code:` literal in `src/doctor/checks.ts` is `checksum_basis_migration`, and
   the string `checksum_mismatch` appears nowhere in `src/`, `test/` or `docs/` except this line.
   A real same-basis mismatch surfaces as a `LoadError`, not a coded finding — which the chapter
   itself says correctly at `:252–255`, so `:291` contradicts `:254` —
   `src/doctor/checks.ts:470`, `src/core/rebuild.ts:226`. — **WRONG**
5. `:75–82`, `:91` — "**`--summary-omitted`, the explicit escape hatch**" … "the hatch is a flag
   and a flag can be typed over a whole corpus" — two flags conflated. `--summary-omitted` is a
   **creation**-surface flag only (`src/cli/index.ts:509, 904`; `add` and `lesson-accept`);
   `mycontext edit` does not accept it. The **edit** gate's hatch — which is what
   `summary-gate.ts`'s quoted sentence is actually about — is **`--summary-unchanged`**
   (`src/cli/commands/edit.ts:93, 658, 722`, refused by `summaryUnchangedRefusal` at `:973`), and
   the chapter never names it anywhere. A reader following `:91` types the wrong flag. — **WRONG**
6. `:235–236` — "Unordered collections (`scope`, `tags`) are sorted before hashing" — true of
   `canonicalContent` (`content-hash.ts:110–111`), but `computeItemChecksum` passes
   `scope: item.scope, tags: item.tags` straight through unsorted (`src/core/item.ts:806`), and
   the sentence sits in the paragraph that names `computeItemChecksum` first. — **OVERSTATED**
7. `:312–315` — "It also fires as the direct answer to the contradiction gate's `--supersedes`
   flag on `add`/`edit` — **the same mechanism**" — the command does not fire;
   `createItem`/`updateItem` call the shared `supersedeItem`, and only under two conditions the
   chapter does not state: the write must be in contradiction scope and governing (`gated`,
   `src/core/mutate.ts:1026`), and the id named by `--supersedes` must actually have been raised
   as a candidate (`settled.some(c => c.id === draft.supersedes)`, `:1213`, `:2100`). Otherwise
   no edge is recorded at all. — **OVERSTATED**
8. `:13–16`, `:410` — "`src/core/mutate.ts` (the contradiction gate, ~L395–580)",
   "`src/cli/index.ts` (the `add` command, ~L820–1010)", "`edit.ts` is 1,312 lines" — all three
   moved in today's `86a0c840`: the gate block is now `mutate.ts:416` → `carryVerdicts` at
   `:575+`; `cmdAdd` is `src/cli/index.ts:808–1299`; `edit.ts` is 1,320 lines. — **STALE**
9. `:298–334` (the whole "Supersession edges" section) — complete as of 2026-09-12 and unaware of
   `86a0c840`. Missing: `unsupersedeRefusal` (`src/core/relations.ts`) — `edit <superseded id>
   --status <anything>` is now **refused** where it previously flipped two of the supersession's
   four facts and exited 0; and the same commit **rewrote** `retirementEdgeRefusal`'s remedy away
   from `edit <id> --status active` toward "supersede the SUCCESSOR back"
   (`relations.ts:270–276`). Also absent: `supersedeItem`'s stand-down — it clears `always` and
   drops a `hard` severity (`standDownFields`, `src/cli/commands/supersede.ts:133–150`) — and
   `existingSuccessorRefusal` (`:110`). — **STALE**
10. `:367–371` — "The finding codes present in this run, by count" — a 2026-09-12 snapshot that
    does not include **`laundered_enum`**, an `error`-level code registered the next day by
    `44b3623b` (`src/doctor/checks.ts:4289`). — **STALE**

**Right and worth protecting:** the entire summary-gate section (`:32–128`) —
`SUMMARY_MAX_CHARS = 250` (`validate.ts:403`), the derived-not-flag-list argument, the "seventeen
items" hole, and `summaryRequiredAtCreate` / `summaryAtCreateRefusal` / `summaryReaffirmed` /
`summaryOmittedRefusal` all existing with those exact names (`summary-gate.ts:239, 313, 484,
529`), plus "imported by exactly the five AUTHORED surfaces … deliberately NOT called from
`updateItem` or `createItem`" quoted verbatim from the module header. The contradiction-gate
section (`:130–190`): `OVERLAP_CAP = 5` (`overlap.ts:181`), `contradictionGate` as the pure
function (`:420`), the verdict path `.my_context/.verdicts/contradiction.jsonl`
(`verdict-store.ts:68`), `carryVerdicts` and the `carried` marker (`mutate.ts:575`, `:454`).
`repair`'s honesty quote at `:273–279` is verbatim from `HONESTY` (`repair.ts:74–80`). `:242–259`
on when the checksum is checked is right in every detail, including "no recorded checksum →
silently exempt", which is exactly `if (item.checksum)` at `rebuild.ts:204`.
*(Incidental: `src/core/mutate.ts:429` still says "the four AUTHORED surfaces" where there are
five — a stale code comment, not a chapter error, and worth an item.)*

### Chapter 8 — The web UI

The headline security claim is the report's single worst inaccuracy and is treated in full
above. The rest:

1. `:21`, `:29`, `:48`, `:293` — three named write exceptions / "Nothing else under `src/ui/`
   writes to disk" — **twelve bindings across five files**, asserted by set equality —
   `test/ui/no-writes.test.ts:607–609, 640, 665, 690, 732–734, 760, 782–783`. — **WRONG**
2. `:170` — "the Composer … the one place the 'read-only' UI can actually cause a write" —
   false twice: two write surfaces compose no command at all
   (`src/ui/anchor-write.ts:38–40, 357–366`, `src/ui/retrieval-write.ts:420–427`), and the
   Copy+Execute control is adopted by **eight** screens
   (`src/ui/public/lib/command-actions.js:3`, imported by
   `screens/{config,conversations,coverage,doctor,packs,port,proc,work}.js` and `lib/builder.js`).
   — **WRONG**
3. `:92`, `:284` — "`app.js`'s own comment … 'TWENTY-ONE OF TWENTY-ONE', counting `cli-help` as a
   screen in its own right" — the 21st was never `cli-help`, which has never appeared in `NAV`
   or `SCREENS`. At the time the comment was written `NAV` listed 21 ids including `gaps`, `docs`
   and `tut`; it went stale when `gaps` retired (2026-09-04) and `docs`+`tut` merged into
   `library` (2026-09-05), with `conversations` added —
   `git show e8a8177416d8:src/ui/public/app.js:278–283` vs `src/ui/public/app.js:245–308`.
   The "the comment is stale" half is right; the attributed cause is invented. — **WRONG**
4. `:270–276`, `:291–292` — "This chapter did not locate a dedicated `scripts/check-*` parity
   script by name … take the mechanism as 'at least partially test-covered, exact enforcement
   unverified'" — `test/ui/strings-parity.test.ts` has existed since 2026-08-20 (its first commit
   is literally titled "…with key-parity test") and asserts identical key sets in both directions
   plus `{slot}` parity on values — `:116–123, 204, 229`. The hedge is unjustified; the chapter
   looked in `scripts/` and never grepped `test/ui/` for "parity", with `strip-parity`,
   `styles-parity`, `duration-parity` and `zoned-stamp-parity` in the same directory listing. —
   **WRONG**
5. `:265–266` — "Both files measure **exactly 1,313 lines**" — now **1,314** each (today's
   `06cb85e7` added a key pair). The sentence also conflates the grep count with file length:
   `en.js` is 2,386 lines and `he.js` 1,629. Substance holds — both key sets extract at 1,314,
   zero duplicates, zero asymmetry either way. — **STALE**
6. `:187–191` — Conversations described as "the UI view of the conversation archive … and
   anchors", with the only non-read note being that a transcript opens `/lane.html` — it is now
   the product's **largest write surface**, and it sits in the `nav.read` ("Read") group while
   performing four anchor writes and a stage/approve cycle
   (`screens/conversations.js:921, 1853, 2326, 2419–2462`, `app.js:307`). — **STALE**
7. `:41–44` — the `recordNonceMint` bullet is substantively right, but it is not a distinct entry
   in the enforced set: `security.ts` contributes exactly one binding (`recordAudit`), shared by
   `recordRefusal` and `recordNonceMint` — `test/ui/no-writes.test.ts:734`,
   `src/ui/security.ts:422, 500`. The chapter's "three" is not even the shape the test counts in.
   — **OVERSTATED**

**Right and worth protecting:** the rail table at `:52–89` is **exactly correct** — `NAV` is
4+6+7+3 = 20 (`app.js:303–308`), `SCREENS` defines a loader for all 20 and no others
(`:245–292`), and all 20 labels match `s.<id>` in `strings/en.js:133–156, 2219` verbatim
including the non-obvious ones (`palette` → "Composer", `graph` → "Relations", `port` →
"Export / import", `library` → "Help"); the four group taglines match word for word;
`screens/parts.js` is correctly *not* counted. Every source quotation checked is verbatim and
correctly attributed. `execute.ts` still registers exactly two routes (`:625–626`), and the
Composer mechanism section (`:219–250`) is accurate end to end — audit-before-run, `execFile`
with no shell, the append-only `execute`/`execute-done` pair, `writeBudgets` being the whole of
the budget write. `RAIL_COUNTS`, the `#/gaps` → `coverage` redirect, the landing-screen decision,
the stream-routes-are-not-idle-activity rule and `ApiContext.configError` all check out, as does
every endpoint the chapter names.

### Chapter 10 — The product rule store

Counts, tier split, isolation and the delivery/assertion topology are accurate and
well-evidenced. The seal is oversold, and the precedence quote drops the part that matters.

1. `:168` — "`--restore` … calls `restoreEntries` to copy the shipped package's entries back over
   a damaged local copy" — `cmdRulesVerify` sets `const packageStore = entriesDir(); const store
   = entriesDir();` then guards on `path.resolve(packageStore) !== path.resolve(store)`, which is
   **always false**; `restoreEntries` is never reached and the command prints "nothing was
   restored: the store being verified IS the installed package … Reinstall the package" —
   `src/cli/commands/rules.ts:177–196, 221–224`. — **WRONG**
2. `:95` — "it just won't accept edits through the maintenance path until `mycontext rules verify
   --restore` puts back what shipped" — the same dead path. The chapter repeats, **as
   documentation**, the exact defect a corpus task files: `StoreDamagedError`'s remedy names a
   branch whose condition is always false — `src/rules/manifest.ts:295–300`. — **WRONG**
3. `:131` — the `PRECEDENCE` quote ends at "settled in silence." The real constant ends
   "…settled in silence (`STD-the-precedence-order-when-four-sources-of-truth-disagree`)._" — a
   corpus id **no consumer install can resolve**, inside the block the product says outranks
   everything — `src/rules/deliver.ts:143–148`. This is the headline finding of `5c8f4ea8`, and
   the chapter's "Provenance disclosure" section at `:137–143` then presents the v5 product-tier
   strip as having closed that class, which it did not. — **OVERSTATED**
4. `:81–97` ("The checksum seal: what it protects") — presented as live tamper-evidence.
   `verifyManifest` has exactly one caller in `src/` outside the maintenance-only
   `assertStoreWritable`/`writeEntry` pair: the CLI command a person must choose to run. No hook,
   no door, no `doctor` check and no CI consults it, and `loadRules` `readdirSync`s the directory
   without ever asking the manifest, so **any `.md` dropped into `entries/` is delivered as a
   governing constant** — `src/rules/store.ts:85`, `src/cli/commands/rules.ts:228`. —
   **OVERSTATED**
5. `:119` — "`pre-tool-use.ts` (line 684) — the earliest hook that runs *after* every door, **on
   every tool call**" — registered with matcher `Read|Edit|MultiEdit|Write|NotebookEdit|Agent`
   (`hooks/hooks.json:29`), so it fires on matched tools only; and the call is now at
   `src/hooks/pre-tool-use.ts:703` (the chapter's `pre-compact.ts:217` is likewise now 219,
   both moved by today's `288377eb`). — **OVERSTATED + STALE**
6. `:115` — "(`manual` is the `/LoadMyContext` skill)" — `deliverAtDoor` has exactly two callers
   in `src/` and neither can emit `'manual'`: `session-start.ts:132` emits
   `'compact-restore'|'session-start'`, `subagent-start.ts:320` emits `'subagent-start'`. Nothing
   in the product ever writes a `manual` delivery row; the `'manual'` in `core/inject.ts` is the
   corpus injection event, a different mechanism — `src/rules/delivered.ts:165`. — **WRONG**
7. `:44` — "**Two** corpus-lifecycle fields are explicitly excluded … `status`, `supersedes`,
   `always`, `valid_until`" — four are named in the sentence and four in the code comment —
   `src/rules/schema.ts:312`. — **WRONG**
8. `:28` — "together are 1,083 lines" — `wc -l` gives 136 + 659 + 384 = **1,179**;
   `delivered.ts` grew 104 lines today in `dc0f14fb`. — **STALE**
9. `:145–153` — "The full manifest changelog (**real**…)" with row 1 glossed "seed: the numbering
   standard, plus 8 `def-*` definitions" — `numbered-options-on-a-question-put-to-the-owner`
   appears under v1's `changed` and in **no `added` list, ever**, so replaying the changelog from
   empty yields **11** entries against a store of 12. The gloss conceals precisely that. This
   reconciles the "eleven" corpus item: 12 real entries, 11 reconstructible —
   `src/rules/entries/manifest.json:62–79`. — **OVERSTATED**
10. `:117` — the assertion "checks whether the current session/subagent key already has a
    recorded delivery row in `.rules/delivered.jsonl`" — as of today `deliveredFile()` forks on
    `isTestProcess()` to `.rules/delivered.test.jsonl`, symmetrically for `recordDelivery`,
    `deliveries`, `wasDelivered` and `assertDelivered` — `src/rules/delivered.ts:122, 146,
    196–199` (`dc0f14fb`). — **STALE**
11. `:64` — "`packageRoot()` … resolves **three** directories up from `store.ts`'s own location"
    — it resolves `dirname(store.ts) + '..' + '..'`, i.e. two levels
    (`src/rules` → `src` → package root) — `src/rules/store.ts:51–53`. The conclusion it draws is
    right. — **WRONG as stated**
12. `:173`, `:177` — "renders one entry … (title, id·kind·tier, …)" and "All twelve, each with
    its **real** `rules show` output" — live output puts `id · kind · tier` first and title
    second, and the reproduced blocks are silently truncated (entry 1 drops the `check:` tail and
    the whole body prose). Verified by running
    `rules show an-unknown-category-means-a-possible-wrong-corpus`. — **OVERSTATED**

**Right and worth protecting:** the counts verify independently — 12 `.md` files, 23,101 bytes,
exactly **one** `product` (`an-unknown-category-means-a-possible-wrong-corpus`) and eleven
`developer`, checked per-file against frontmatter and against live `rules list`. The **isolation
claim is exact**: the only `src/core/` import anywhere in `src/rules/` is `schema.ts:31` →
`../core/frontmatter.ts`, with `test/rules/isolation.test.ts:112, 128, 142` holding the
`list`/`ready`/`doctor` probes — matching `def-the-corpus`'s own `check:` field verbatim. The
delivery-vs-assertion topology is exactly right, including the `compact-restore`/`session-start`
ternary living in one hook file. `renderCorrection` / `correctionAtDoor` "wired to nothing" is
confirmed — the sole importer in the whole repo is `test/rules/update-correction.test.ts:32`, so
the index chapter's claim holds. Checksum *mechanics* are exact
(`createHash('sha256').update(text.replace(/\r\n/g,'\n'),'utf8')`, `manifest.ts:126–128`;
`Damage = 'missing'|'altered'|'unexpected'` with all problems reported, not the first). The
budget account is exact (`DEFAULT_BUDGET_BYTES = 20_000`, measured against the `product` tier
only, `manifest.ts:496–506`), as are the `p50 0.371 ms / p95 0.503 ms` figures and every CLI
spelling.

### Chapter 12 — Packs, export/import, procedures

1. `:346` — "`commands/` ships **95 slash command files** (confirmed by listing the directory)" —
   the directory holds **91** `.md` files and nothing else, unchanged at HEAD and in
   `git ls-tree`. The chapter's own enumeration on the same page sums to 91 (29 `add-*` +
   29 `list-*` + 32 single-word + `LoadMyContext.md`), so the figure contradicts itself four
   lines from its own evidence. — **WRONG**
2. `:286–287` — "claims all **30** `add-*.md` slash commands" — the manifest entry lists 30 slash
   files but only **29** are `add-*.md`; the 30th is `add.md`. (The adjacent "all 29 `CATEGORIES`
   keys" is correct.) — `docs/tutorials/manifest.json` entry 0. — **WRONG** (minor)
3. `:84–98` — the six-step import-mechanics narrative describes no status/enum refusal. As of
   today `readArtefact` **refuses the whole artefact** if any item carries a status, severity or
   origin outside the vocabulary ("carries a field this build cannot read… Nothing was
   imported") — a refusal that lands **before** `planImport` and is the pack surface's strongest
   new guarantee — `src/pack/reader.ts:310–337` (`44b3623b`). — **STALE**
4. `:64–82` — "One of its items, **verbatim**" — the quoted Markdown omits seven frontmatter
   lines the real file carries (`scope`, `tags`, `source_file: null`, `source_anchor`,
   `source_checksum`, `valid_from`, `valid_until`) and re-wraps the body. "verbatim" is the
   load-bearing word. — **OVERSTATED**
5. `:147`, `:150`, `:161` — "(1,108 items, confirmed live)" / `about to export 1108 item(s)` —
   `.my_context/items/**/*.md` is now **1,234** files. Labelled as a real run and presented as
   current state. — **STALE**
6. `:100–109` — the `src/pack/` module inventory names 11 files; the directory holds 12
   (`layout.ts` omitted). Framed as "splits the work by concern", so the list reads as complete.
   — **STALE** (minor)

**Right and worth protecting:** **every flag spelling verifies verbatim against the parsers** —
`export --out <path> [--format dir|zip] [--as-pack --pack-name <name> --pack-version <text>]
[--dry-run] [--json]` (`src/cli/commands/export.ts:77–80`) and `pack import <path> [--name]
[--dry-run] [--json] [--yes] [--overwrite-changed]` / `pack list [--json]`
(`src/cli/commands/pack.ts:106–108`), both confirmed against live output. The `--dry-run`
zero-writes claim is literally `if (!request.dryRun && request.out !== null)` (`export.ts:352`).
The "no `--yes` on export, deliberately" reasoning and its `test/helpers/approval-boundary.ts`
consequence are quoted correctly; `NOT_TRAVELLING` matches item for item. The
procedure/runbook doc-comment quote is accurate and correctly located
(`src/core/categories.ts:204–219`); the lifecycle table matches
`src/cli/commands/procedure.ts:32–38`; `PROGRESS_OPS` matches `src/core/audit.ts:495`;
`pack list` and `procedure list` outputs reproduce verbatim. Tutorials: 24 manifest entries,
6 basic / 18 advanced, `enFile`/`heFile` present, and `docs/TUTORIAL.md`'s six basic tutorials in
**exactly** the stated order. The skills claim is correct and precise — `skills/mycontext/SKILL.md`
is the only file under `skills/`, and its frontmatter matches character for character.

### Chapter 13 — The testing discipline

Every mechanism it describes is described correctly. It is silent on the one thing that changed
today, and that thing is its own subject.

1. `:297–343` (the `check:*` gates) and `:445–466` ("What's NOT built") — **the chapter describes
   nine gates and never says where any of them runs.** As of today's `deb3d809`,
   `.github/workflows/ci.yml:78–125` runs eight of the nine on every PR and push to master
   (`check:test-glob`, `check:basis`, `check:retired`, `check:text-files`, `check:vendor`,
   `check:dependencies`, `check:needs-cycles`, `check:handover`) plus `verify:citations`, then
   `typecheck`/`test`/`test:perf`/`test:e2e`; `release.yml:43–84` runs the same set. **Before
   that commit, four of them ran nowhere.** A reader of this chapter cannot tell a wired gate
   from an unwired one — which is precisely the vacuous-gate failure the repository keeps
   catching. — **STALE / no coverage**
2. `:445–466` — omits `.githooks/pre-commit` (new today) and `npm run hooks:install`
   (`git config core.hooksPath .githooks`). One gate — `check:dependencies` — now runs at commit
   time on a staged `package.json` or a staged `CONST-zero-runtime-dependencies`, with
   `--no-verify` named as the escape hatch. — **STALE**
3. `:456–459` and `:336–340` — "**A live, unfixed finding exists right now**: `check-text-files.ts`
   found one real NUL byte in `src/ui/retrieval-write.ts` at byte 8280, in this repository's
   current working tree" — ran it: `1325 text file(s) scanned: none contains a NUL byte. / every
   one of them still diffs.` Exit 0. Stated in the present tense inside "What's NOT built". —
   **STALE**
4. `:447` — "461 of 611 test files (75%) are exempt via the baseline" — now **460 of 621 (74%)**;
   `8aa489fc` removed one baseline line and the suite grew by ten files. Present-tense claim. —
   **STALE** (minor)
5. `:226–235` — the quoted `check-basis.ts` tail ("150 of 611 … 138 distinct … 461 predate") is
   correctly labelled "run 2026-09-12" and is now `161 of 621 … 156 distinct … 460 predate`.
   Honest because dated; flagged only because "What's NOT built" reuses its numbers as current. —
   **STALE** (dated, disclosed)
6. `:99–156` and `:460–463` (mutation testing) — "`npm run mutate` was not found wired into any
   `check:*` or `test:*` script" **still holds at HEAD**, re-checked against every `package.json`
   script and both workflows. — no defect.

**Right and worth protecting:** the `@basis` section is the strongest single section in the
reference and is accurate line by line against `scripts/check-basis.ts` — the 26-fixture/`cdc9fd8`
measurement, the "exactly one cited an item and it cited the wrong one" detail, the `none`-is-
legal design, the `REASON_MIN_WORDS = 3` / `REASON_MIN_CHARS = 12` floor calibrated on the
21-character worked example (`:206–213`), and the four tiers with `RETIRED` alone non-gating
(`:361, 507, 518`). The baseline prose (490 files, six declared, 484, nine retrofitted, ceiling
enforced by `test/scripts/basis-gate.test.ts:151`) matches the checker's own header (`:31–50`).
The mutate exit-code table is exact including `4 INCONCLUSIVE` (`scripts/mutate.ts:42–51`). The
`no-writes.test.ts` account — equality not emptiness, symbol not file, the
`revision-log.ts`/`jsonl-log.ts` example, derived membership after `core/ui-server-record.ts` and
`ui/execute-effect.ts` — is verbatim-faithful to that file's header. All five parity
ledgers/files exist as named, `mycontext_help` really is `cli: 'help', slash: null`
(`src/plugin/parity.ts:86`), and `check-vendor`, `check-needs-cycles` and `check-dependencies`
all reproduce their pasted output exactly today. The nine-script count is right.

### Chapter 4 — The conversation archive

The FTS5 section is the best-evidenced piece of measurement in the whole reference: the
`CREATE VIRTUAL TABLE` block is character-identical to `src/core/conversation-index.ts:459–468`
including `tokenize = 'trigram'` and every `UNINDEXED`; all four measurement tables reproduce
exactly (the 856,905,563 / 162,611 / 8,402,679 / 7,750 / 0.98% prose census; the Hebrew
unicode61-vs-trigram hit table שורה 3/11, תוך 0/14, שרה 0/8, anchors 54/58; the
17,842,176 B / 264 ms vs 42,119,168 B / 1,870 ms build cost). Two claims do not hold.

1. `04-conversation-archive.md:145` — "`search` covers **both** the Markdown item corpus **and
   the conversation archive** from one command" — **WRONG. `mycontext search` never touches the
   archive.** `src/cli/commands/search.ts:1–18` imports only `filterItems` from
   `core/search.ts`; it never imports or calls `searchArchive`, and `searchArchive`
   (`src/core/conversation-search.ts:469`) has **zero callers anywhere under `src/cli/`** — its
   only callers are `anchor-pass.ts`, `ui/read-model-conversations.ts` and
   `ui/read-model-retrieval.ts`. Confirmed live: `search "ui"` returns an ordinary item table
   with no archive hits and no trigram-floor note. `conversation`'s own USAGE has no `search`
   subcommand either, so **there is currently no CLI path to FTS5 archive search at all.** This
   is a chapter telling a reader a capability exists that does not — the highest-cost class of
   error named in the brief, and the runner-up to the single worst inaccuracy above.
2. `04-conversation-archive.md:250–253` — "`conversation forget […]` drops the **entire index**
   for the workspace — every session and subagent row, **and the tables themselves**" —
   **WRONG.** `forgetConversations` (`src/core/conversation-index.ts:3096–3102`) drops exactly
   four tables: `conversations`, `subagents`, `persisted`, `named`. The schema has **seven**
   (`:134–157`). `conversation_prose` — the 42 MB FTS5 table this chapter's longest section is
   about — plus `prose_sources` and `anchors` all survive untouched. The chapter also never
   warns that `forget` destroys the `persist` marks and session names it discusses two
   paragraphs earlier.
3. `04-conversation-archive.md:153–164` — "`iterateTranscript` … walks the file as a raw
   `Buffer` in 1 MiB chunks" and "is written once and shared" — **STALE.** Since today's
   `86a0c840` that walk lives in `src/core/line-walk.ts` (`eachLine` / `forEachLine`,
   `LINE_WALK_CHUNK_BYTES = 1 MiB`), which `iterateTranscript` now delegates to
   (`conversation-index.ts:1539–1556`). "Written once" was generous when written: there were
   **four** independent buffer-carry loops, and two of them (`session-summary.ts`,
   `ui/read-model-conversations.ts`) were **splitting Hebrew characters across the chunk seam**
   — fixed by `ae4984d7`, unified by `86a0c840`. Neither the defect nor the new module appears
   anywhere in `docs/`.
4. `04-conversation-archive.md:16–17` — "one live session here is **106,591,470 bytes**, 43,854
   records" — now 112,272,459 bytes / 45,949 records for the same `sessionId`. Undated, where
   the measurement two paragraphs below carries "measured 2026-09-11". — **STALE**.
5. `04-conversation-archive.md:185–189` — an owner ruling presented as a verbatim quote with
   **three silent corrections**: the source (`src/core/conversation-secrets.ts:7–10`) reads
   "askd", "uppon it's", "place holder"; the chapter prints "asked", "upon its", "placeholder",
   and adds a terminal period. In a corpus whose own rules treat verbatim quotation as evidence,
   a tidied quote marked as the owner's words is the wrong kind of edit. — **STALE / inexact**.
6. `04-conversation-archive.md:16, 37, 89, 152–153` — every cited source line number drifted 1–3
   lines under `86a0c840` (`:318`→317, `:1391`→1390, `:458–468`→459–468, `:1509`→1506,
   `:368–376`→369–377). All still land inside the right block, so cosmetic — but it is precisely
   the rot `RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number` describes,
   arriving in one day, in a chapter that uses source line numbers as its primary address.
7. `04-conversation-archive.md:194–210` — the `conversation secrets --json` "real output"
   candidate object shows 7 fields; `SecretCandidate` has 14
   (`src/core/conversation-secrets.ts:611–634`), with no elision mark. — **OVERSTATED**.

### Chapter 7 — Restore and handover

The chapter that survived the day best. Both `restore` usage blocks are copied correctly from
`USAGE` (`src/cli/commands/restore.ts:71–76`) including the `--from-result` / `--claims` second
form; `restore --show`'s pasted output still reproduces verbatim; the `check:handover` worked
example reproduces **exactly** today — 4682 lines, 45 blocks, 218 pointers (134 lane / 84 item),
0 dangling, 4 retired, 7 carried, exit 0. The loop guard is right in every detail, including
the marker value, the stem-substring `isMarkedSummary`, `summary-marker.ts` importing nothing,
`droppedOwnSummary`, the separate `isCompactSummary` path, and `retrieval/return.ts:301`
stamping the same marker. The `'human'` actor claim is right twice over — at the call site and
in the refusal inside. Its defects are all about breadth:

1. `07-restore-and-handover.md:265–282` — "**The other refusals, each stated rather than
   defaulted:**" followed by exactly three bullets — a list claimed complete that is not.
   `OnDemandAskVerdict` has **seven** values (`src/core/handover-ask.ts:1382–1384`). The chapter
   covers `no-occupancy`, `work-in-flight`, `work-unknown` here and `outside-session`
   separately; **`off`** (no `handover.path` configured — the *first* gate, before the session
   check) and **`unwritable`** are never mentioned. — **OVERSTATED**.
2. `07-restore-and-handover.md:276–279` — "`--anyway` proceeds past this refusal explicitly" is
   stated only under *work in flight*. The code reads "Proceed past `work-in-flight` **and**
   `work-unknown`. Never past the other refusals" (`handover-ask.ts:1452`). A reader hitting
   `work unknown` is left believing they are stuck. — **STALE / incomplete**.
3. `07-restore-and-handover.md:54` — step 7 DELIVER, "delivers the staged, approved summary
   once, at the next session start" — narrower in code: delivery is gated on
   `!manual && !subagent && !compacting` (`src/core/inject.ts:566–568`), so a **PostCompact**
   start, a subagent start and a manual injection get nothing. The chapter opens (`:5–9`) by
   framing the problem as "cleared **or** compacts", so a reader can reasonably conclude the
   compaction boundary is covered by `restore`. It is not. — **OVERSTATED**.
4. `07-restore-and-handover.md:215–219` — the illustrative footer is quoted as "…from **the head
   of** `reports/V2-HANDOVER.md`…". In this repository the **marker** branch is what fires: the
   default marker is U+23ED (⏭, `src/core/config.ts:483`) and `reports/V2-HANDOVER.md` line 1 is
   `## ⏭ 2026-09-12 — …`, so the real line reads "from **the marked section** of…"
   (`src/core/handover.ts:203–209`). The chapter's own §7.4 quotes that ⏭ line without
   connecting it. — **STALE**.
5. `07-restore-and-handover.md:102` — "state (`PROPOSED`/`approved`/`delivered`)" matches
   neither layer: stored states are all lowercase, and `--show` uppercases all three
   (`restore.ts:330`). — **STALE**, cosmetic.

### Chapter 5 — Anchors

The chapter was written *after* the anchor rework and knows it: it has the three creation
paths, `markAnchorsOnTurn` (`core/anchor-pass.ts`) as the per-turn pass at `:156`, the retired
`report` grammar with its two-directional removal test, the owner's ruling that a composed
command is not the UI having the capability, and the four anchor write routes. This was the
chapter most at risk of being pre-rework, and it is not.

1. `05-anchors.md:48` — "Every row has the same **seven** fields" — then names **eight**:
   `id`, `sessionId`, `agentId`, `byteOffset`, `label`, `kind`, `origin`, `at` (nine with
   `protocol`). — **WRONG** (internal miscount).
2. `05-anchors.md:36–38` — "Confirmed on this workspace: `wc -l .my_context/.anchors.jsonl` →
   636" — now **712**. Presented as current state rather than as a dated reading. — **STALE**.
3. No coverage of `list-anchors` as a retrieval mode (`src/core/retrieval/mission.ts:50`,
   `src/ui/read-model-retrieval.ts:105, 779`) — arguably chapter 6's, but it is the one anchor
   capability reachable only from the retrieval surface, and neither chapter claims it.

### Chapter 6 — Retrieval

The guarantee, the seven modules, the four `RetrievalMode` values and the isolation tests are
described accurately and — in one place — more honestly than the corpus itself (see §What it
gets right). The status claim is the problem.

1. `06-retrieval.md:47–49` — "nothing in the CLI or MCP surface calls any of them yet"; and
   `:64–66` — "No `mycontext` CLI command and no MCP tool currently exposes retrieval …
   that is the only way to exercise the capability today"; and `:443–447` — "**No CLI command,
   MCP tool, or hook triggers retrieval.** It can only be exercised by importing the modules
   directly." — **`src/cli/commands/restore.ts` imports and calls three of the seven retrieval
   modules**: `readResult` (`retrieval/result.ts`), `markReturn` and `returnReviewForm`
   (`retrieval/return.ts`), and `stageableReturn` (`retrieval/return-stage.ts`) —
   `src/cli/commands/restore.ts:8–12`. `restore` is a registered top-level CLI command with a
   `--from-result <file>` / `--claims <1,3,7>` form built specifically for this path. Those
   imports landed in `121b01b0` at 2026-09-12 **03:13**, nineteen hours before the chapter was
   written. — **WRONG**, and wrong on the day it was written, not stale.
2. `06-retrieval.md:45–47` — "**Status: built, largely unwired** … Five of the seven modules
   are complete and tested" — as of today's `11f6655e` (13:52), the remaining two are wired:
   `src/ui/read-model-retrieval.ts:69` imports `removeNoise` from `retrieval/noise.ts` and
   `:72` imports the subject vocabulary from `retrieval/subjects.ts`. All seven now have a real
   consumer in `src/`. The section heading is the first thing the chapter says about itself.
   — **STALE**.
3. `06-retrieval.md:443–466` ("What's NOT built") repeats claim 1 and does not know about
   `11f6655e`. The Task 11 and Task 12 bullets remain fairly hedged and survive.

### Chapter 9 — The CLI and the MCP server

1. `09-cli-and-mcp.md:26–30` — "Grepping `src/cli/commands/*.ts` for that call turns up exactly
   **33 files** that register a command", with `registry` in the list — **32 files register a
   command.** `registry.ts` matches the grep because it *defines* `registerCommand` at
   `src/cli/commands/registry.ts:46`, not because it calls it. `node src/cli/index.ts registry`
   answers `my_context: unknown command "registry"`. The chapter reproduced a grep artifact
   without running the command — and then had to walk it back in prose 240 lines later
   (`:274`, correctly). The section heading at `:272` still reads "Ops — `config`, `registry`,
   `statusline`", listing a command that does not exist. — **WRONG**.
2. `09-cli-and-mcp.md:335–340` — the one MCP worked example, which the chapter honestly flags
   as built from the schema because the server was disconnected. **The schema no longer
   matches, in both halves:**
   - "→ same payload shape CLI `ready --json --limit 3` would print" — the MCP `ready` tool
     returns **plain text**, not JSON: its `run` ends `return lines.join('\n')` and composes
     `${row.item.id} · ${plan}/${seq} · pri … · ${state} · ${title}` lines
     (`src/mcp/tools.ts:1360–1440`). There is no JSON payload at any point.
   - "a `ready` array of `{task, pri, state, title}`" — the CLI's real `ready --json` rows carry
     `{id, title, type, plan, seq, priority, state, needs}`. No field is named `task` or `pri`.
     (The rest of the sentence — counts of ready/open/held and blocking open questions — *is*
     right: `readyTotal`, `open`, `heldTotal`, `openQuestions.blockingTotal`.)
   - The schema's own `limit` default of 50 is documented in the tool and not in the chapter.
   — **WRONG**. This is the claim the brief asked to re-verify, and it does not hold.
3. `09-cli-and-mcp.md:290` — "`src/mcp/tools.ts` (2,728 lines)" — now **2,756**
   (today's `86a0c840`). — **STALE**.
4. The abridged-`--help` problem is in the overstatement table above. Related and unstated:
   `--help` on **every** subcommand exits 1 with `my_context: unknown option "--help"` before
   printing usage — the chapter tells a reader to "run yourself" and does not warn them.
5. **What it gets right and should be protected:** all **26** MCP tools are named, and the
   count "26 tools" is exactly correct (`grep -c "name: '"` gives 27; one is in a comment).
   `src/mcp/server.ts` really is 60 lines, `.mcp.json` is reproduced verbatim, and the
   CLI↔MCP asymmetry list (no tool for `carry`, `config`, `rules`, `restore`, `pin`/`unpin`,
   `conversation`, `export`, `ui`; `preview_pack_import` with no commit path) is accurate.
   The `registry.ts`/`format.ts`/`context.ts`/`injection.ts`/`revision-view.ts` "these are not
   commands" paragraph is right and worth keeping — it just forgot to remove `registry` from
   the list 240 lines above it.

### Chapter 11 — The self-improvement loop

**It says all three of the things the brief asked about, and says them correctly.**

- `review.enabled` defaults `false`: stated at `:135–143` and again at `:373–375`, cited to
  `DEFAULT_REVIEW` in `src/core/config.ts` — verified at `src/core/config.ts:712`.
- `maxProposalsPerPass` is `0`: stated at `:150`, `:265`, `:277`, `:375–378`, and the reproduced
  `DEFAULT_REVIEW` block at `:126–134` matches `src/core/config.ts:712–722` **key for key and
  value for value**, including `queueCeiling: 15`.
- `src/review/prompt.ts` is imported by nothing but its own test: stated at `:218–221` and
  `:379–383` — verified, the only importer anywhere is `test/review/prompt.test.ts:15`.

Also verified correct: `AUTHORABLE = ['check']` (`src/review/propose.ts:492`),
`RETIREMENT_RULE = null` with `WHY_NO_RULE` (`src/core/retire.ts:91, 98`), and the claim that
`crossSessionSameCwd` and `model` are refused rather than accepted-and-ignored
(`src/core/config.ts:617–626`).

**One of those three went stale while this verification was running.**

`11-self-improvement-loop.md:139–143` — "This repository's own `.my_context/config.json` carries
**no `review` key at all**, meaning `def-the-corpus`'s own project runs on the shipped default:
`review.enabled` is `false` here too", evidenced by `review list` printing "no drafts pending
review". At **20:17 today**, commit `0d683f2b` — *"the self-improvement loop is on — and the
ration stays at 0, which is what the code argues for"* — added

```json
  "review": {
    "enabled": true
  }
```

to `.my_context/config.json`. **The loop is now switched on in this repository.** (This commit
was not made by this verification; it landed from another lane mid-run, and it is why `HEAD`
moved from `8aa489fc` to `0d683f2b` between the start and the end of this report.) — **STALE**

The chapter's *argument* survives intact, and in fact this is the best possible demonstration of
it: the first gate is now open here and the second is not, so the loop still proposes nothing.
That is exactly the "two independent dials, not one" claim the chapter is built around, tested
in the wild within a day of being written. But the sentence a reader would act on — "the loop is
off here" — is now false, and both the chapter and `00-index.md:74–78` state it.

The remaining defects are omissions, not errors:

1. `11-self-improvement-loop.md:20–23` — the source-root list names ten modules
   (`trigger, pass, input, rubric, propose, dedupe, claim, decline, declined, prompt`).
   `src/review/` holds **thirteen**. Missing: `pending.ts` and `drift.ts`. — **incomplete**.
2. **`src/review/drift.ts` is a third off-switch the chapter never mentions**, and the chapter's
   "What's NOT built / built but off" section presents itself as the complete enumeration.
   `DEFAULT_DRIFT: DriftConfig = { enabled: false }` (`src/review/drift.ts:122`), read from a
   **top-level `drift` key, not `review.drift`** — `requireReview` would refuse the key inside
   the `review` block and stop the whole config loading (`src/review/drift.ts:35–45`). Every
   unreadable state resolves to off, deliberately.
3. **`src/review/drift.ts` is also imported by nothing but its own test** — the sole importer
   anywhere is `test/review/drift.test.ts:53`. That is the same status the chapter singles out
   `prompt.ts` for, and `drift.ts` is larger (18.5 KB vs 13.3 KB). The bullet "No model is ever
   called" is the only place the chapter names an unwired module, and it names the smaller one.
4. `pending.ts` — unlike the other two — **is** wired, into `src/cli/commands/status.ts:25`,
   `statusline.ts:18`, `statusline-powerline.ts:14` and `src/ui/read-model.ts:96`. The chapter
   discusses `queueCeiling` at length without naming the module that computes the queue.

---

## What it gets right that is worth protecting

The brief asked for this specifically, and it is the part of the document that should survive
any revision.

**1. It found three real code/doc disagreements and said so rather than smoothing them.**

- `06-retrieval.md:53–63` — "This is **more wired than the governing task item currently
  says**": `TASK-reconstruct-a-subject-from-a-passage-you-copied-without-the` still reads
  "NOTHING IS WIRED. No command, route or hook reaches retrieval," with `state: todo`, while
  the UI routes and client screen code were already on disk. The chapter names the item, states
  the gap, and tells the reader to treat the item's prose as behind the code. That is exactly
  the right move, and it is the more valuable half of a chapter whose own status claim is wrong
  in the opposite direction.
- `08-web-ui.md:92–96` — the `app.js` comment reading "TWENTY-ONE OF TWENTY-ONE" is stale
  against a 20-entry `NAV`. The *observation* is right (the comment is stale); the *cause* the
  chapter attributes to it is not — the 21st was never `cli-help`, it was `gaps`, `docs` and
  `tut` before two retirements and a merge. Keep the finding, fix the explanation.
- `01-items-and-corpus.md:152–161` — the `task.state` tag-vs-field measurement (276/213/13/5,
  518 retained, "all 133 disagree with the audit log") is quoted correctly from
  `src/core/categories.ts:16–20, 448–460`.

**2. Its worked examples are real, and the dated ones are dated.** Chapter 1's
`mycontext examples rule --short` and `examples glossary --short` blocks are byte-accurate
against the live CLI; its `mycontext show RULE-1-1-…` matches field for field including
`acknowledged` rendered as `code@hash`. Chapter 13's `check-basis.ts` tail is labelled "run
2026-09-12" — which is why its drift is disclosed rather than misleading.

**3. Chapter 2's budget, spare-band and `GoverningSpill` sections are exact to the character** —
the snippet at `02-injection.md:120–123` matches `src/core/select.ts:1620–1623` character for
character, and every number (37 `always` items, 22,582, 7,418, 13 admitted all `hard`, 82→69)
matches `select.ts:1602–1618`.

**4. Chapter 13's `@basis` section is the strongest single section in the reference** — the
26-fixture measurement, the "exactly one cited an item and it cited the wrong one" detail, the
`none`-is-legal design, the `REASON_MIN_WORDS = 3` / `REASON_MIN_CHARS = 12` floor and its
21-character calibration, and the four tiers with `RETIRED` alone non-gating — all verified
line by line against `scripts/check-basis.ts`.

**5. Chapter 10's counts, isolation proof and delivery/assertion topology** — 12 entries, one
`product` and eleven `developer`, the single `src/core/` import in all of `src/rules/`
(`schema.ts:31 → ../core/frontmatter.ts`), and `deliverAtDoor` at exactly two call sites and
`assertDoor` at exactly two others.

**6. Chapter 12's flag spellings** — every one verifies verbatim against the parsers, including
`export --out <path> [--format dir|zip] [--as-pack --pack-name <name> --pack-version <text>]
[--dry-run] [--json]` and the `--dry-run` zero-writes claim, which is literally
`if (!request.dryRun && request.out !== null)` at `src/cli/commands/export.ts:352`.

**7. Chapter 7's `check:handover` worked example reproduces byte for byte today** — 4682 lines,
45 blocks, 218 pointers (134 lane / 84 item), 0 dangling, 4 retired, 7 carried, exit 0 — as does
`restore --show`'s pasted output, every `restore` usage string, and the whole loop-guard account
down to the marker value and `summary-marker.ts` importing nothing. A chapter written from a real
run against a live report, twenty-four hours later, still reproducing exactly, is the standard the
rest of the reference should be held to.

**8. Chapter 4's FTS5 measurement** — the `CREATE VIRTUAL TABLE` block character-identical to
source, the Hebrew unicode61-vs-trigram hit table, the build-cost comparison, the
`MIN_QUERY_CHARS = 3` floor with its "reported, not silence" rationale, and the `persist`
three-state `--replace` account. The *evidence* in that chapter is first-rate; only the two
claims about how a reader reaches it are wrong.

**9. The "What's NOT built / built but off" convention itself.** Every chapter carries one, and
the index collects them. That convention is why the errors above are findable at all — a
reference that only described the working parts would have hidden every one of them.

---

## The gaps

### A. Everything that shipped today, in zero of the fourteen files

Grepped across all of `docs/capabilities/`. Each of these returns **no match at all**:

| Surface | Landed | Where it lives |
|---|---|---|
| `--json` failure envelope | `86a0c840` | `src/cli/json-envelope.ts` — a failing `--json` run now emits a JSON envelope on stdout derived from `COMMAND_FLAGS`/`SUBCOMMAND_FLAGS`, exit code untouched; `show` deliberately exempt. Chapters 3, 9 and 12 all quote `--json` output and none says what a failing run emits. |
| The `forEachLine` module | `86a0c840` | `src/core/line-walk.ts` — one buffer-carry walk now owns four that were separate. Chapter 4's subject. |
| The pre-commit hook and the wired gates | `deb3d809` | `.githooks/pre-commit` (runs `check:dependencies`), `npm run hooks:install`, and `ci.yml`/`release.yml` now running eight of the nine `check:*` gates plus `verify:citations`. Chapter 13's subject, and chapter 13 never says where a gate runs. |
| The status/severity/origin read boundary | `44b3623b` | `src/core/item.ts`, `src/core/validate.ts`, `src/core/vocabulary.ts:340–375`, `src/doctor/checks.ts:4289` (`laundered_enum`, error level), `src/pack/reader.ts:310–337` (a pack carrying an unreadable enum is refused whole). Chapters 1, 3 and 12 each describe a surface this changed. |
| `clearUiServerRecord` taking an identity | `fe4086c1` | `src/core/ui-server-record.ts:343–357` — `clearUiServerRecord(owner: UiServerIdentity, globalRoot?)` returns `'names-another-server'` unless **both** `pid` and `port` match. *(Correction to the brief: this is `fe4086c1` in `ui-server-record.ts`, not `e6ee79e0` in `ui-server-upkeep.ts` — `e6ee79e0` is the console-window / `windowsHide` fix, and `ui-server-upkeep.ts` neither defines nor calls the function.)* |
| The UTF-8 chunk-seam defect | `ae4984d7` | `test/core/chunk-seam-utf8.test.ts` — two readers were silently cutting a Hebrew character in half at every 1 MiB boundary **while chapter 4 was being written**. Nothing in `docs/` records it, and chapter 13 does not carry the one-byte fixture-guard proof either. |

And one more that landed *after* this verification started: **`0d683f2b` (20:17) sets
`review.enabled: true` in this repository's own `.my_context/config.json`**, which falsifies a
claim in chapter 11 and one in `00-index.md:74–78` (see chapter 11's section).

Also uncovered from today: the `supersede` inverse refusal (`unsupersedeRefusal`,
`src/core/relations.ts`) — `edit <superseded id> --status …` is now refused where it previously
flipped two of the supersession's four facts and exited 0 — and the rewritten
`retirementEdgeRefusal` remedy ("supersede the SUCCESSOR back",
`RULE-a-supersession-is-unwound-by-superseding-the-successor-back`).

### B. Environment variables — 9 of 12 appear nowhere

`grep -rhno "MYCONTEXT_[A-Z_]*" src/` yields twelve. Three are mentioned (`MYCONTEXT_WIDTH`,
`MYCONTEXT_ASCII`, `MYCONTEXT_UNICODE`). Absent entirely:

- **`MYCONTEXT_CORPUS_DIR`** — which corpus is in use. This is the exact subject of the
  repository's own `CLAUDE.md` opening paragraph.
- **`MYCONTEXT_RULES_DIR`** — replaces the *entire* rule store, with a `substitutedStoreLine`
  disclosure and verification against a manifest that is not the one that shipped
  (`src/rules/deliver.ts:332, 341–347, 417–421`). Chapter 10 argues at `:55` that nothing here
  is "an environment variable a stranger's project could accidentally acquire" — true of the
  tier, unmentioned for the store source.
- `MYCONTEXT_MIRROR_DIR`, `MYCONTEXT_UI_SESSIONS_DIR`, `MYCONTEXT_ITEM_EXISTS`,
  `MYCONTEXT_DOC_CLOCK`, `MYCONTEXT_DOC_LOCALE`, `MYCONTEXT_STATUSLINE_NO_BLINK`,
  `MYCONTEXT_STATUSLINE_ONE_LINE`.

### C. The sweep, by surface

Every surface was enumerated from source, then each exact name grepped across all fourteen
files. **ABSENT = literal zero hits in all fourteen.**

| Surface | Enumerated | Documented | ABSENT |
|---|---|---|---|
| CLI commands | 48 | 48 | **0** (9 thin) |
| MCP tools | 26 | 26 | **0** (16 thin) |
| Rule store entries | 12 | 12 | **0** |
| UI screen modules | 22 | 21 | **1** |
| Config keys | ~34 | 27 | **7** (+6 thin) |
| `MYCONTEXT_*` environment variables | 12 | 3 | **9** |
| Hook doors (`hooks.json` events) | 18 | 5 | **13** (+2 thin) |
| Hook source files | 22 | 5 | **16** |
| npm scripts | 21 | 7 | **14** |
| `scripts/*.ts` files | 36 | 12 | **19** |
| CLI flags | ~95 distinct | ~72 | **23** |
| Doctor finding codes | 61 | 17 | **44** |

**The command and tool surface is complete.** All 48 CLI commands and all 26 MCP tools are
named. That is the part a reader is most likely to check, and it holds. Everything below the
command line is where the reference thins out.

**The three highest-value gaps, in order: doctor finding codes, hook doors, CLI flags.**

#### C1. Doctor finding codes — 44 of 61 absent (the largest single gap)

`src/doctor/checks.ts` (+ `shared-tail.ts`) defines 61 finding codes. Seventeen are documented.
This is not cosmetic: **the code string is the vocabulary `mycontext ack <id> <code>` takes**, so
a reader who wants to rule on a finding has no list of what to type. `09-cli-and-mcp.md:47`
paraphrases five of them ("index freshness, orphans, drift, dead globs, permissions, session
ids") while the literal strings `dead_scope`, `index_stale`, `nested_corpus`, `not_writable`,
`session_id_mismatch` appear nowhere.

Absent: `assumption_overdue`, `assumption_overdue_coverage`, `audit_log_size`,
`body_review_limits`, `body_truncation`, `check_failed`, `citation_form_excused`,
`citation_marker`, `cli_lookup_failed`, `cli_not_on_path`, `cli_path_mismatch`,
`cli_path_unverifiable`, `config_key_skipped`, `continuity_inert`, `continuity_overflow`,
`contradiction_drain_limits`, `corpus_size_fallback_ceiling`, `dead_scope`, `foreign_store`,
`governing_spill_pressure`, `index_missing`, `index_not_ignored`, `index_stale`,
`index_unreadable`, `laundered_enum`, `needs_malformed`, `nested_corpus`, `not_writable`,
`orphan_relation`, `retired_still_binding`, `scope_policy_inert`, `scope_policy_required`,
`session_id_mismatch`, `source_anchor_missing`, `state_audit_coverage`, `summary_too_long`,
`summary_unanchored`, `tag_projection_drift`, `task_verification_coverage`,
`tutorial_roster_unreadable`, `tutorial_unlisted`, `unknown_category`, `watched_doc_coverage`,
`watched_doc_unserved`.

#### C2. Hooks — 13 of 18 doors, and 16 of 22 files, absent

`hooks/hooks.json` registers eighteen events. Chapter 2's stated subject is "the doors that
trigger injection", and five are documented: `session-start`, `subagent-start`, `pre-tool-use`,
`pre-compact`, `stop`. (Chapter 2's doors table is separately *wrong* about which of those are
doors — see the per-chapter detail.)

Absent as both event name and file: `PostToolUse` (`post-tool-use.ts`, 19.8 KB),
`PostToolUseFailure`, `SubagentStop` (`subagent-stop.ts`, 18 KB), `Setup`, `FileChanged`,
`InstructionsLoaded`, `ConfigChange`, `PermissionDenied`, `TaskCreated`, `TaskCompleted`,
`UserPromptExpansion`. Thin: `PostCompact` (discussed six times in chapter 7 as a *handover
delivery point*; `post-compact.ts`, 18.9 KB, is never named as a file and its non-handover work
is not described) and `SessionEnd` (mentioned three times in chapter 11 **only to explain why it
is not used as a trigger**; `session-end.ts`, 14.8 KB, is never described).

Also absent: **`hooks/hooks.json` itself** — the file declaring every door, its matcher and its
timeout is never named anywhere; `src/hooks/io.ts` (28.5 KB — `parseHookInput`, `hookContext`,
`hookBlockDecision`, `preToolUseDeny`, `pinnedSpillLine`, the `HookEventName` union);
`src/hooks/observe.ts` (18.4 KB, the shared observation runner imported by nine hooks);
`src/hooks/self-register.ts` (generates the Claude Code settings hooks block from
`hooks/hooks.json`, and backs `npm run hooks:install`); `src/hooks/task-events.ts`.

#### C3. CLI flags — 23 absent, and the structural reason

The root cause is the abridged banner at `09-cli-and-mcp.md:36–78` (see the overstatement table):
six entries were shortened to `[...]`, and the per-subcommand flag tables were never transcribed
at all. **`src/core/command-flags.ts` and `src/core/edit-flags.ts` — the single source of truth
for every CLI flag — are themselves never named in any chapter**, which is why no chapter was
ever written from them.

Absent: `audit --until/--kind/--origin/--role/--files`; `contribution --retire`;
`export --no-history`; `focus --category/--preview/--relations`; `ready --questions`;
`search --text`; `--title` (on `add`, `edit`, `inbox-promote`, `lesson-accept`);
`--stdin` (on `ingest-apply`, `lesson-stage`); `lesson-accept --directive`;
`procedure step --undo`; `review promote-revision --revision/--force`;
`review discard-revision --revision`; `review promote --source`; `session carry --none`;
`statusline install|uninstall --settings`; `edit --continuity`; `edit --summary-unchanged`.

That last one is the costly one: `--summary-unchanged` is the **edit gate's actual escape
hatch**, and `03-creation-and-gates.md:91` sends a reader to `--summary-omitted` instead, which
`edit` does not accept.

#### C4. Scripts — 14 npm scripts and 19 script files absent

Never named: `test:perf`, `test:e2e:single-phase`, `test:e2e:install`, `typecheck`,
`gen:commands`, `gen:docs`, `verify:citations`, `check:retired`, `check:text-files`,
`check:vendor`, `check:needs-cycles`, `check:dependencies`, `check:cited-items`,
`hooks:install`. (Chapter 13 describes the `check:*` gates by *mechanism* but names only three
of them as npm scripts, and — see its verdict — never says where any of them runs.)

Nineteen files in `scripts/` have zero hits, including `e2e-gate.ts` (behind `npm run test:e2e`),
`gen-commands.ts`, `gen-doc-examples.ts` (29 KB), `check-faint-usage.ts` (33 KB),
`check-ask-numbering.ts`, `check-cssom-restatement.ts`, `gen-cli-ui-coverage.ts`,
`gen-diagrams.ts`, `migrate-rules.ts` (40 KB), `seed-dogfood.ts` (46 KB),
`backfill-requests.ts` (33 KB), `vendor-webawesome.ts`, `convert-hebrew-bidi-marks.ts`,
`set-version.ts`, `changelog-section.ts`, the three `restamp-summary-basis*.ts`, and
`doc-clock.ts` / `doc-fixture.ts` / `repair-openq-filters.ts`.

#### C5. Config keys — 7 absent, one of them a whole feature

- **`watchedDocs`** (`Config.watchedDocs`, `config.ts:757`, validated by `requireWatchedDocs` at
  `:2102`) — absent, *and* its doctor codes `watched_doc_coverage` / `watched_doc_unserved` are
  absent, so the entire watched-documents feature is undocumented.
- **`dispatchGate`** / `dispatchGate.enabled` (`config.ts:777`, `DEFAULT_DISPATCH_GATE`) —
  absent. This is a third off-by-default gate the index's "what's built but off" roll-up misses.
- `skippedKeys` (`config.ts:805`) and its doctor code `config_key_skipped` — absent. Chapter 2
  describes unknown-key handling and never names the field that records it.
- `agentEdits` (`ResolvedCategory:131`, `RawCategory:813`), `extraFields`
  (`ResolvedCategory:130`, `RawCategory:815`), `ui.enabled` (`UiConfig:275`), `ui.port`
  (`UiConfig:312`) — all absent as config keys.
- The config **write** surface — `FieldWriteOptions` / `FieldWriteResult` /
  `CategoryWriteResult` (`config.ts:2319–2599`), i.e. what `config --set/--unset/--delete/
  --disable` does about backups and dry runs — absent.

#### C6. Directories and modules with no coverage

Absent as directories: **`src/lesson/`** (`derive.ts`, `staging.ts` — zero hits, despite chapter
11 being the self-improvement chapter) and **`src/help/`** (`index.ts`, `he.ts`, and all eight
files under `help/topics/`; `09-cli-and-mcp.md:347` concedes `help tools`/`help slash` were not
verified — the other five topics are not mentioned at all).

Absent files worth naming: `src/cli/json-envelope.ts`; `src/core/command-flags.ts` and
`src/core/edit-flags.ts` (see C3); `src/core/line-walk.ts`; `src/review/drift.ts`;
`src/mcp/tools/ingest.ts` and `src/mcp/provenance.ts`; `src/plugin/commands.ts`;
`src/ingest/chunk.ts`; `src/doctor/shared-tail.ts`;
`src/ui/public/screens/parts.js` (the shared screen-chrome module every screen imports); and
roughly 30 `src/core/` modules including `statusline-tee.ts`, `context-share.ts`,
`ui-server-probe.ts`, `ui-server-upkeep.ts`, `ui-sessions.ts`, `verdict-store.ts`,
`window-state.ts`, `code-identity.ts`, `corpus-drift.ts`, `corpus-identity.ts`,
`conversation-search.ts`, `conversation-redaction.ts`, `conversation-mirror.ts`,
`ledger-replay.ts`, `restore-staging.ts`, `restore-store.ts`, `review-counter.ts`,
`render-item.ts`, `tag-projection.ts`, `revision-diff.ts`, `summary-history.ts`,
`session-names.ts`, `audit-tail.ts`, `open-store.ts`.

#### C7. One dead internal link

`01-items-and-corpus.md:248` links `[Packs, procedures, and runbooks](./12-packs-procedures.md)`.
No such file. Chapter 12 is `12-packs-export-import-procedures.md`, which is what `00-index.md:53`,
`08-web-ui.md:178` and `09-cli-and-mcp.md:96` all link to correctly. It is the only dead link in
the set — every other `./NN-*.md` reference resolves.

### D. Per-chapter holes named by the verification lanes

**Chapter 1** — the read boundary (above); `Item.layer` (`project | global`) is absent from the
frontmatter table though `mergeLayers` makes project items shadow global ones by id
(`select.ts:1309–1318`); `WRITABLE_SECTIONS` is `{steps, observations, relations, request}`
(`item.ts:194`) and only `request` is covered.

**Chapter 2** — no section on the **continuity tier**, one of the five budgets it lists, and the
only full-text tier not gated on `isNormative`; no mention of the **one-shot carry**
(`mycontext carry`, `IndexSummary.carried`, `select.ts:1148–1196`), an injection-ordering
mechanism with its own disclosure; no mention of the **`seen` gate** (`select.ts:20–77`) or
**focus narrowing** (`FocusReport`, `select.ts:1330–1365`), both of which decide what reaches
the model and both of which its own purity argument depends on; nothing on what injection does
when config is unreadable (`injectionFailureNote`, `inject.ts:188`; `configUnreadableLine`,
`hooks/io.ts:426`).

**Chapter 3** — the whole workflow-gate layer; `--summary-unchanged` and
`summaryUnchangedRefusal` (`src/cli/commands/edit.ts:93, 658, 722, 973`), which is the edit
gate's *actual* escape hatch and is named nowhere; `repair`'s loss holdback
(`repair.ts:81–91`); `preflightSupersede` / `supersedeQuestion` (`mutate.ts:1033, 1898`);
`supersedeItem`'s stand-down (clears `always`, drops `hard` — `supersede.ts:133–150`) and
`existingSuccessorRefusal` (`:110`).

**Chapter 8** — the largest gaps in the set. The entire `src/ui/anchor-write.ts` surface and its
four routes, plus the owner ruling driving it
(`REQ-every-anchor-capability-is-reachable-from-the-screen-and-a`); the whole retrieval
stage/approve surface (`retrieval-write.ts`, `read-model-retrieval.ts`, `read-model-staging.ts`)
including a **second confirm+nonce pair outside `execute.ts`** binding the nonce to
`[key, sha256(payload + reviewForm)]` recomputed from disk — a security mechanism the chapter's
"there is no second code path" framing tells a reader does not exist; ~62 of ~76 registered API
routes, including the whole `/api/watch/*` SSE family, `/api/ask/*`, `/api/render`, `/api/glob`,
`/api/overlap`, `/api/command/check`, `/api/config/{check,preview}`, `/api/handoff`; the modules
`git-info.ts`, `idle.ts`, `maintenance/`, `zoned-day.ts`, `execute-nonce.ts`,
`read-model-{flags,cli-help,work}.ts`; the client libraries
`lib/{sse,heartbeat,live-invalidation,disclosure,pane-resize,sanitize,highlight,markdown,diagrams,wa-tree,palette-defs,builder}.js`;
the token/nonce bootstrap and its `sessionStorage` lifetime (`app.js:310–340`); the CSP
`style-src 'self'` / no-`innerHTML` discipline that shapes every DOM builder; the pages
`tree-proof.html` and `doc.html`; and the RTL **mirroring mechanism itself** (`lib/i18n.js`,
`translate()`, the `.m` / `unicode-bidi:isolate` spans, `{mv:…}` monospace value slots) — the
Hebrew section covers only key parity.

**Chapter 10** — `MYCONTEXT_RULES_DIR` (above); the absence of any MCP path to the rule store
while `missedDoorLine`, text written *for a model*, tells it to run `mycontext rules list`; the
delivered block omitting the tier that `rules show` prints (`deliver.ts:200`); store version and
changelog being readable only from `src/ui/maintenance/`, which `package.json` excludes, while
the chapter reproduces the changelog as though an install could consult it; `def-a-door`'s own
`means` naming `PreCompact` as a door where the code excludes it and asserts there instead —
cited twice by the chapter as the authority for the split it contradicts; where the "missed
door" sentence goes (`process.stderr.write`, to the person, not into the model's context —
`pre-tool-use.ts:741`); `RuleSet.refused` rendering; the 5,000-row `trim()` cap on
`delivered.jsonl`.

**Chapter 12** — the laundered-enum pack refusal and its `doctor` disclosure;
`src/cli/json-envelope.ts`'s effect on a failing `pack import --json` / `export --json`;
`src/pack/layout.ts` (the module inventory names 11 of 12 files).

**Chapter 13** — `test/scripts/workflow-gates.test.ts`, which asserts gates are *reached*
rather than *correct* ("a green `dependency-budget.test.ts` says the dependency budget can be
computed, never that anything computes it before a merge") and pins the deliberate **absence**
of `check:cited-items` from CI. That is the sharpest instance of this chapter's own thesis and
it is missing entirely. Also: `test/rules/*` (16 files); `scripts/e2e-gate.ts` behind
`npm run test:e2e`; and `test:perf`, which runs in both workflows and is never mentioned.

**Chapter 4** — `src/core/line-walk.ts`, the module that as of today owns the byte-vs-character
seam decision for four readers; the UTF-8 chunk-seam defect it was extracted to fix; and
`reports/2026-09-13-conversations-js-mapped.md` (`826c7b55`), which maps
`src/ui/public/screens/conversations.js` into seven units and one 2,370-line closure — the
chapter refers to "the UI's virtualized transcript scroller" without describing it.

**Chapter 7** — the `restore` delivery exclusions (`manual`, `subagent`, `compacting`), which
are the difference between the chapter's promise and what the code does.

**Chapter 11** — `src/review/drift.ts` and `src/review/pending.ts` (see per-chapter detail).

---

## Method, and what was not checked

Checked read-only, on 2026-09-13. **`HEAD` was `8aa489fc` when this began and `0d683f2b` when it
finished** — another lane committed mid-run, and that commit invalidated a chapter-11 claim (see
its section). Every finding below `8aa489fc` was re-checked against the working tree as it stands.

Commands run:

- `node src/cli/index.ts --help` and each subcommand's own usage banner (every subcommand
  refuses `--help` as an unknown option, exits 1, and prints usage anyway).
- `node src/cli/index.ts ready --json`, `list`, `show`, `query`, `rules list`, `rules show`.
- `node scripts/check-text-files.ts`, `check-basis.ts`, `check-handover.ts`,
  `check-vendor.ts`, `check-needs-cycles.ts`, `check-dependencies.ts` (each confirmed
  non-writing by reading it first).
- `git log`, `git show`, `git show --stat`, `git log -S` — read-only only. Working tree
  confirmed clean at start and at finish.
- Source reading across `src/core/`, `src/cli/`, `src/mcp/`, `src/hooks/`, `src/rules/`,
  `src/review/`, `src/pack/`, `src/ui/`, `src/doctor/`, `scripts/`, `test/`, `package.json`,
  `.github/workflows/`, `.githooks/`, `hooks/hooks.json`, `.mcp.json`.

**Not checked, and a revision should not assume these are clean:**

- **Nothing was verified by driving the UI.** The owner's server on 58888 was not touched, no
  browser was driven, and no server was started. Chapter 8's verdict rests entirely on reading
  `src/ui/` and `test/ui/`, which is enough to settle the write-surface count but not enough to
  settle whether every affordance it describes is reachable on the running screen.
- **The test suite was not run.** Claims about what a test asserts were read from the test
  source, not from a run.
- **No mutating command was executed** — `add`, `edit`, `ack`, `supersede`, `repair`,
  `pack import`, `restore --approve`, and every `lesson*` command were read from source only,
  so chapters 3, 7 and 12's accounts of their *output* are verified against the code that
  produces it, not against a live run.
- Chapters were sampled at roughly 190 load-bearing claims, not exhaustively. The three counts
  the lanes found wrong (95 vs 91 slash files, 33 vs 32 command files, 7 vs 8 anchor fields)
  suggest that **every number in the document should be re-derived rather than trusted**, and
  that the ones found are unlikely to be all of them.

---

*Verified read-only, `HEAD` `8aa489fc` → `0d683f2b`. No source, test, corpus item or chapter was
changed by this verification; this report is the only file it wrote. The `.my_context/config.json`
change visible mid-run belongs to `0d683f2b`, not to this work.*
