# Documentation review — 2026-08-22

Independent review. Nothing outside this file was touched. Findings are ranked by
consequence — how much a reader would be misled or harmed by acting on the sentence, not how
easy the fix is. Each carries where, why it is wrong (evidence from `src/`, not from another
document), the proposed fix, and both languages where both apply.

**Provenance.** This task was worked by more than one agent process concurrently in this same
worktree, racing on this exact file: an earlier pass committed a version of this report
(commit `01ebc26`) before the review was finished, and later passes — including this one —
each read whatever was on disk, re-verified every claim against `src/` independently of who
first surfaced it, and folded in what they found. `git log` on this branch shows more than one
commit touching this file as a result; that is concurrency, not rounds of owner-directed
revision. One consequence worth naming: an intermediate consolidation pass apparently dropped
a genuine, high-confidence finding from the earlier commit while merging — `docs/TUTORIAL-ADVANCED.md`'s
wrong budget-tier number, restored below as F14 after being independently re-verified against
`src/core/config.ts` again here. Nothing in this final version is carried over on trust from
any earlier pass; every citation below was checked to resolve against the code in this
worktree today.

**Ranked by consequence.** Findings F1–F11 are already in roughly that order — each states
something false that a reader would act on, ranked by how much acting on it costs. F12–F14,
folded in during consolidation, are lower-consequence or single-document gaps and sit at the
end rather than disturbing that ordering.

---

## The pattern behind the top findings

`README.md` §8 ("Not yet available") states its own rule at the top: **"no sentence below
claims otherwise [than what the code does today]."** §8 also records, in its own prose, that
it has failed this rule before — carrying, at one point, "several rounds of work carrying four
entries that described capabilities the project had already built." F1, F2 and F3 below are
three *more* live instances of exactly that failure — one of them (F2) closed 32 minutes after
the sentence describing it as open was written. This is not three unrelated typos; it is one
section with a structural blind spot. Nothing re-checks a "not built" claim when the thing
gets built, the way `test/docs/counts.test.ts` re-checks a count when the count changes. The
individual fixes are below; the section as a whole would benefit from the treatment its own
history already argues for.

---

## Findings

### F1 — §8 asserts the export/history feature is unbuilt; it shipped two days after the sentence was written

**Where:** `README.md` · `this is built: there is no export command in this release` · ~2598,
closing a `[!NOTE]` block that opens two lines above (~2587) with **"Decided for v2.0 and not
built: half of the log will travel, deliberately filtered."** A second, independent copy of
the same claim, in the glossary: `README.md` · `which is decided and not built` · ~5153.

Both mirrored verbatim in Hebrew: `docs/README.he.md` · `אין פקודת ייצוא בגרסה הזאת` · ~2782,
and `docs/README.he.md` · `הכרעה שהוכרעה ולא נבנתה` · ~5594.

**Why it is wrong.** `mycontext export` shipped in commit `2bb4293` ("feat(cli): mycontext
export, with --as-pack and the deterministic zip"), dated 2026-08-21 — **two days after** the
NOTE block was written (commit `037ccda`, 2026-08-19). It does exactly what the NOTE
describes as undecided: `src/pack/history.ts` · `` the filter here is positive: `kind === 'mutation'` `` ·
~14, and `src/cli/commands/export.ts` · `history: !hasFlag(args, 'no-history'),` · ~197 —
mutation records travel by default in `history.jsonl`; everything else (injections, hook
actions, focus records) does not, exactly the split the NOTE calls undecided. `README.md`
already contradicts itself: its own "Handing the corpus on" section, one section above the
stale NOTE, correctly describes the shipped behavior: `README.md` ·
`` `history.jsonl` — the **mutation** half of the audit log, filtered to the items that `` · ~2895.

**Proposed fix (both languages).** Replace the NOTE's closing sentence — currently "**None of
this is built: there is no export command in this release, and nothing in the log travels
today.**" — with something like "**This shipped in `mycontext export`** (`--no-history`
withholds it): the mutation half of the log travels by default, projected and redacted exactly
as described above — see [Handing the corpus on](#handing-the-corpus-on--mycontext-export)."
The lead sentence, "Decided for v2.0 and not built", becomes "Decided for v2.0, and built",
and the paragraph's future-tense verbs ("are to go with it", "are not to travel", "is to land
in") move to present tense — the design description itself is still accurate; only its tense
is wrong. At ~5153, replace "which is decided and not built" with "which is what `mycontext
export` does" (or similar), and the same in the Hebrew mirror at both spots.

**Confidence:** high.

---

### F2 — §8 says the `mycontext_help` MCP tool withholds three topics; the fix landed 32 minutes after the sentence was written, same day

**Where:** `README.md` · `` `mycontext help <topic>` serves all seven. The `mycontext_help` **tool** advertises four: `` ·
~5201, under "### Three help topics `mycontext_help` does not offer", closing with
`README.md` · `` here; `test/help/tools-topic.test.ts` pins the withheld set to exactly `cli`, `tools`, `` ·
~5219. Hebrew mirror: `docs/README.he.md` · `` `mycontext_help` מפרסם ארבעה `` · ~5644, and
`docs/README.he.md` · `` מקבע את הקבוצה הנמנעת בדיוק ל-`cli`, `` · ~5663.

**Why it is wrong.** `src/core/teach.ts` · `export const MCP_HELP_TOPICS: HelpTopic[] = HELP_TOPICS.filter((t) => t !== 'cli');` ·
~36 — the tool now withholds only `cli`; six of seven topics are advertised, not four. `git
log` gives the exact sequence: the README sentence was written in commit `95903ce` ("help: add
derived `tools` and `slash` topics, and correct the topic count"), 2026-08-21 03:31:31; the
fix that actually closes the gap it describes, `be40a3a` ("fix(mcp): mycontext_help serves
every topic its own server can render"), landed 2026-08-21 04:03:25 — **32 minutes later, the
same day.** `test/help/tools-topic.test.ts` (the file this passage cites as its own evidence)
now asserts the opposite: it requires the withheld set to equal exactly `['cli']`.

**Proposed fix (both languages).** Delete "### Three help topics `mycontext_help` does not
offer" — the gap it names is closed. The `cli`-only exclusion, which is correct and
permanent, is already stated in the paragraph immediately above it ("### Two help topics that
do not exist"); fold one sentence there if a record of it is wanted, rather than leaving the
now-false "withheld set is exactly `cli`, `tools`, `slash`" claim standing.

**Confidence:** high.

---

### F3 — §8 says `mycontext add` has no `--extra`; it shipped 2026-08-20, and the same false claim is repeated in `docs/ROADMAP.md`

**Where:** `README.md` · `` `mycontext add` has no `--extra`. `` · ~5130 (§8, "### Editing —
what still has no route"). Hebrew mirror: `docs/README.he.md` · `` ל-`mycontext add` אין `` ·
~5571. Third location, a project-tracking document repeating the identical claim:
`docs/ROADMAP.md` · `` **`mycontext add` has no `--extra`** `` · ~184 (row B7.2, status `⏸`
"ready, not started").

**Why it is wrong.** `src/cli/index.ts` · `const ADD_VALUE_FLAGS = ['body', 'file', 'note', 'step', 'scope', 'tags', 'severity', 'extra'];` ·
~481, wired at `src/cli/index.ts` · `const extra = extraFlag(args);` · ~745. Shipped in commit
`bd933d2` ("feat(cli): mycontext add --extra, sharing edit's parser"), dated 2026-08-20.
`README.md` already says so correctly elsewhere: `README.md` ·
`` A field you declare in config is honoured by `mycontext add --extra`, `` · ~4245.
`docs/ROADMAP.md`'s row is doubly stale: its citation, `src/cli/index.ts:187`, no longer
resolves to `ADD_VALUE_FLAGS` (line 481 today), on a document that states its own rule —
`docs/ROADMAP.md` · `Every row is updated the moment its status changes.` · ~40.

**Proposed fix.** Delete the "`mycontext add` has no `--extra`" bullet from §8 in both
READMEs (the two neighboring bullets in the same list are unaffected). In `docs/ROADMAP.md`,
change row B7.2's status to `✅` and its note to record that it shipped in `bd933d2`, with a
corrected line citation.

**Confidence:** high.

---

### F4 — `docs/TUTORIAL-ADVANCED.md` documents a `profile` value the loader now refuses outright — a reader who tries it breaks their own config

**Where:** `docs/TUTORIAL-ADVANCED.md` · `` | `profile` | which categories are enabled — `minimal`, `standard`, `full` | `` ·
~203, in the "5. Configuration" key-effect table.

**Why it is wrong.** `full` was removed as a profile and is refused at config-load time, by
name, with its own explanatory message: `src/core/config.ts` ·
`` 'The "full" profile was removed. It meant "every category in the catalogue" as against ' `` ·
~71. `README.md`'s own "The two profiles, and the one that was removed" section states this:
`README.md` · `` **A \`config.json\` that still says \`"profile": "full"\` is refused at load time**, `` ·
~4289. This is the one place in the reviewed set that actively tells a reader to type
something the product will reject, not just a claim quietly out of date. No derived test
covers this table — `test/core/catalogue-completeness.test.ts` only pins each tutorial's
normative/rationale category-count bullets, not this key-effect table.

**Both languages:** `docs/TUTORIAL-ADVANCED.md` has no Hebrew counterpart; no parity fix
needed.

**Proposed fix.** Change the row to `` | `profile` | which categories are enabled — `minimal`, `standard` | ``,
matching `README.md`'s own "two profiles" framing.

**Confidence:** high.

---

### F5 — `README.md`'s own count of "the six per-category keys" is now seven; `extraFields` was promoted from refused to accepted two days ago and isn't in the list

**Where:** `README.md` · `And the six per-category` · ~4180, continuing onto the next physical
line, `README.md` · `` keys — `enabled`, `tier`, `description`, `prefix`, `agentEdits`, `scopePolicy` — all apply `` ·
~4181. Hebrew mirror: `docs/README.he.md` · `וששת מפתחות התצורה שלכל קטגוריה` · ~4493, same
six-item list.

**Why it is wrong.** `src/core/config.ts` · `` const CATEGORY_KEYS = [ `` · ~267, followed on
the next line by `src/core/config.ts` ·
`` 'enabled', 'tier', 'description', 'prefix', 'agentEdits', 'scopePolicy', 'extraFields', `` ·
~268 — seven keys, not six. `extraFields` was promoted from a refused key to an accepted one
in commit `f20279a` ("feat(core): extra fields belong to a category, and a category may
declare its own"), 2026-08-20 — after the "six" sentence was last written. `README.md` uses
`extraFields` correctly as a real per-category key a few hundred lines earlier in the very
same document (`README.md` ·
`` { "categories": { "security_control": { "tier": "normative", "description": "…", "extraFields": ["control_id"] } } } `` ·
~4232), which is the same shape of internal contradiction as F1.

**Proposed fix (both languages).** Change "the six per-category keys" to "the seven
per-category keys" and add `extraFields` to the named list, in both documents.

**Confidence:** high.

---

### F6 — both READMEs' own hook-reference table omits `fork` as a `SessionStart` trigger

**Where:** `README.md` · `a session starts, resumes, is cleared, or comes back from a compaction` ·
~1907, the "Fires" cell of the `SessionStart` row in the six-hook table. Hebrew mirror:
`docs/README.he.md` · `סשן מתחיל, מתחדש, נוקה, או חוזר מכיווץ` · ~2024. Neither document
contains the word "fork" anywhere (checked by full-text search of both files).

**Why it is wrong.** `hooks/hooks.json` · `` "matcher": "startup|clear|resume|compact|fork", `` ·
~6 — `fork` is a fifth, real `SessionStart` source value; `src/hooks/io.ts`'s own doc comment
(corrected in this worktree's most recent commit, `fd49a60`, today) enumerates all five and
explains the stakes of missing one: `src/hooks/io.ts` ·
`` A `source` the matcher omits does not fail — the hook `` · ~13 — a source the matcher does
not list means the hook does not run at all for that trigger, silently. `fork` was added to
the matcher itself in a same-day fix; before it, a forked session's `SessionStart` matched
nothing and got no injection and no disclosure. The fix reached the matcher and the code
comment but not either README's own "Fires" cell — the one place a reader goes to learn what
triggers this hook.

**Proposed fix (both languages).** Change the `SessionStart` row's "Fires" cell from "a
session starts, resumes, is cleared, or comes back from a compaction" to "a session starts,
resumes, is cleared, is forked, or comes back from a compaction" (and the Hebrew equivalent).
Since neither document currently discusses forking as its own case the way `/clear` and
compaction each get a paragraph elsewhere, one added sentence — "a forked session is treated
as an ordinary session start: pinned tier and index, no restore-tier machinery" — would close
the gap completely rather than only in the table cell.

**Confidence:** high — the freshest finding in this report; the underlying fix landed today,
before this review began, and reached the code comment but not the table.

---

### F7 — `docs/TUTORIAL.md`'s very first verification step gives numbers the shipped build will not produce

**Where:** `docs/TUTORIAL.md`, in "Install", right after `claude plugin details
mycontext@mycontext`: `docs/TUTORIAL.md` ·
`` You want the four hooks — `SessionStart`, `PreToolUse`, `PreCompact`, `` · ~52, and
`docs/TUTORIAL.md` · `` reports commands and skills together as `Skills (67)` and prints no commands `` ·
~54.

**Why it is wrong.** `hooks/hooks.json` registers six hook events, not four — the two omitted
are named right in the file: `hooks/hooks.json` · `"SubagentStart": [` · ~16 and
`hooks/hooks.json` · `"PostToolUseFailure": [` · ~62. `README.md`'s own hook table lists all
six: `README.md` · `The six hooks, and what each one is for:` · ~1903. Separately, the
`commands/*.md` files that `claude plugin details` counts together with the one skill under
"Skills" now number 77 (measured: `ls commands/*.md | wc -l` → 77), so the line should read
"Skills (78)" today, not "Skills (67)" — stale by eleven. `README.md` explains the arithmetic
itself: `README.md` · `the number it shows there is the command count plus one.` · ~1900. This
is the very first thing a newcomer checks after installing, and both numbers on the line are
wrong.

**Both languages:** `docs/TUTORIAL.md` has no Hebrew counterpart.

**Proposed fix.** Name all six hooks (`SessionStart`, `SubagentStart`, `PreToolUse`,
`PreCompact`, `PostToolUse`, `PostToolUseFailure`) and update the Skills count. Write it as
"Skills (N)" with N re-derived at edit time rather than hard-coded again — this is exactly the
kind of typed number that goes stale the next time a command file is added, and `README.md`
already prefers pointing at the live command for this reason elsewhere.

**Confidence:** high.

---

### F8 — `docs/TUTORIAL-ADVANCED.md`'s own hooks appendix has the same four-hooks gap, half-fixed

**Where:** `docs/TUTORIAL-ADVANCED.md` ·
`` **Hooks:** `SessionStart` (`startup|clear|resume|compact|fork`) `` · ~471, continuing
`` · `PreCompact` · `PostToolUse` (`Write|Edit|MultiEdit`). `` · ~473.

**Why it is wrong.** Same omission as F7 — `SubagentStart` and `PostToolUseFailure` are both
missing. Notably, the `SessionStart` source-value parenthetical on this exact line **is**
current — `startup|clear|resume|compact|fork` already includes `fork` (today's `fd49a60` fix
reached this line but not the hook *count* beside it) — showing this line gets touched when
one detail on it is noticed, just not the whole thing.

**Proposed fix.** `**Hooks:** \`SessionStart\` (\`startup|resume|clear|compact|fork\`) ·
\`SubagentStart\` · \`PreToolUse\` (\`Read|Edit|MultiEdit|Write|NotebookEdit\`) · \`PreCompact\`
· \`PostToolUse\` (\`Write|Edit|MultiEdit\`) · \`PostToolUseFailure\`.`

**Confidence:** high.

---

### F9 — `ui.enabled` is a real, strictly validated config key that §6 never documents in either language — and it does nothing if a reader finds it anyway

**Where:** `README.md`'s entire "## 6. Configuration" section (~3323–4621) documents
`profile` (~3338), `categories.<name>.enabled/.tier/.agentEdits/.scopePolicy` (~4346–4487),
`budgets` (~4488), and `watchedDocs` (~4519) as its own subsections. `ui` is never mentioned.
Identically for `docs/README.he.md`'s "## 6. תצורה" (~3557–5040). Of the five real keys on the
`Config` interface (`src/core/config.ts` · `export interface Config {` · ~208 — `profile`,
`categories`, `budgets`, `watchedDocs`, `ui`), `ui` is the one orphan.

**Why it matters.** `src/core/config.ts` · `function requireUi(raw: unknown): UiConfig {` ·
~491 validates a top-level `ui` object strictly — an unknown key or non-boolean `enabled`
refuses the whole file, in the same loud-refusal style every other §6 subsection documents and
explains. It is real, shipped, and reachable by anyone who writes `{"ui": {"enabled": false}}`
into `config.json` — but neither README's config reference says the key exists. And it
wouldn't help if found: nothing reads `config.ui.enabled` to decide whether `mycontext ui` may
start. `src/cli/commands/ui.ts` · `function cmdUi(ws: Workspace, args: string[], out: Emit, cwd: string): number {` ·
~112 opens with one gate, `if (!ws.projectRoot) {` · ~115, and never consults the config's
`ui` field; neither does `src/ui/server.ts`. `{"ui": {"enabled": false}}` loads without error
and `mycontext ui` starts anyway. This exact gap is recorded in `CHANGELOG.md` (out of this
review's scope) in similar words, but the in-scope, user-facing Configuration section carries
no trace of it.

**Proposed fix (both languages).** Add a `### ui.enabled` subsection to §6, and — since
documenting a switch that does nothing would only move the defect from silence to false
comfort — state the gap in the same sentence: "`ui.enabled` is validated strictly but not yet
read by `mycontext ui` — setting it to `false` does not stop the server from starting." Given
the F1–F3 pattern above, this also fits naturally as a §8 entry if the section's convention is
meant to cover config-level gaps as well as command-level ones.

**Confidence:** high.

---

### F10 — a procedure's steps can be set at capture time, on both the CLI and the MCP tool, and neither route is documented anywhere in either README

**Where:** absence, not a wrong sentence. `README.md`'s flag reference table (~3204–3277)
documents every other value flag `add` accepts — `--body` (~3204), `--note` (~3205), `--scope`
(~3206), `--tags` (~3207), `--file` (~3223) — each with its own row naming `add`. `--step` is
not among them. The Hebrew mirror (`docs/README.he.md` ~3430–3449) lists the identical five,
no `--step`. Neither README's discussion of the `create_item` MCP tool's schema quotes its
`steps` field either, though sibling fields from the same schema (`directive`, `extraFields`)
are quoted and explained elsewhere.

**Why it matters.** Both routes are real and shipped. CLI: `src/cli/index.ts` ·
`const ADD_VALUE_FLAGS = ['body', 'file', 'note', 'step', 'scope', 'tags', 'severity', 'extra'];` ·
~481 (the same line cited in F3), consumed at `src/cli/index.ts` ·
`const steps = addValues(args, 'step');` · ~722 — `mycontext add procedure "…" --step "…" --step "…"`
is the only way to give a procedure its ordered steps from the CLI; the documented
`mycontext procedure step <id> <n>` only *ticks* an existing step, it does not create one.
MCP: `src/mcp/tools.ts` ·
`` 'Ordered steps for a `procedure` — an operation performed once and then finished. ' + `` ·
~510 — `create_item`'s `steps` array is the agent-facing equivalent. Everything else about
`procedure` is documented (category description, lifecycle commands, checksum behavior)
except how anyone actually puts steps on one at creation time.

**Proposed fix (both languages).** Add a row to the flag table: `--step "<text>"` — repeatable,
in command-line order, one step per flag, never comma-split, `procedure` only — under `add`.

**Confidence:** high on the facts; this is a coverage gap rather than a false claim, so there
is no "was this ever true" question to weigh.

---

### F11 — both tutorials claim to be tested against `my_context v1.0.0`; the shipped version is `1.0.2`

**Where:** `docs/TUTORIAL.md` ·
`**Tested on:** my_context v1.0.0, Node 24.14.0, Windows 11, Claude Code 2.1.233.` · ~6, and
identically `docs/TUTORIAL-ADVANCED.md` · ~8. `docs/TUTORIAL.md` also prints the stale version
inside a captured console block: `docs/TUTORIAL.md` ·
`my_context 1.0.0: 3 item(s), profile "standard"` · ~291.

**Why it is wrong.** `package.json` · `"version": "1.0.2",` — read live at module load:
`src/core/version.ts` · `export const VERSION = parseVersion(readFileSync(MANIFEST, 'utf8'), 'package.json');` ·
~74. `docs/TUTORIAL.md`'s header claims literal reproducibility ("Every command and every
block of output below was run against a fresh workspace while writing this page. Nothing here
is illustrative."), which is what makes the mismatch worth a line rather than ordinary
doc-aging.

**Proposed fix.** Update both "Tested on" lines and the literal `status` transcript's version
number next time either tutorial is touched for content reasons.

**Confidence:** high on the fact; low-to-medium on urgency, since no step's meaning changes.

---

### F12 — `docs/mutation-testing.md`'s exit-code table is missing a code the script has carried since yesterday

**Where:** `docs/mutation-testing.md`, the four-row table at ~16–19 (`` | `0` | **KILLED**… ``
through `` | `3` | Mutated, and the tree could not be put back… ``). No Hebrew counterpart for
this file.

**Why it is wrong.** `scripts/mutate.ts`'s own doc comment lists five exit codes, not four:
`scripts/mutate.ts` · `4 INCONCLUSIVE. The command never produced a verdict, because it could` ·
~47, and the code returns it — `scripts/mutate.ts` · `return 4;` · ~475 — when the harness's
own `spawnSync` never produced a verdict (the command could not start, or was killed by a
signal). This is not theoretical: the same comment explains why it exists —
`scripts/mutate.ts` · `the script used to print KILLED for a command that never ran` · ~49 —
because that used to silently validate mutants that were never actually tested. The fix landed
in commit `87a7774` ("fix(mutate): a command that never ran is INCONCLUSIVE, not KILLED"),
2026-08-21, one day before this review. The same fix also makes `docs/ROADMAP.md` row **E17**
stale: `docs/ROADMAP.md` ·
`**Fix shape, not built here:** treat \`spawnSync\` \`error\`/null-status as verdict 2 (refused), never 0 (killed).` ·
~334 (status `⏸`) — the fix shipped, as its own distinct verdict 4, not the remap to verdict 2
the row describes as still needed.

**Proposed fix.** Add a fifth row to `docs/mutation-testing.md`'s table:
`` | `4` | **INCONCLUSIVE** — the command never produced a verdict (could not start, or was killed by a signal). Not a kill: re-run rather than trust it. | ``.
In `docs/ROADMAP.md`, mark E17 `✅` and correct its "not built here" clause to name the actual
shape shipped (a distinct exit code 4, not a remap of code 2).

**Confidence:** high.

---

### F13 — a second, separate "four topics" leftover: the CLI's own `mycontext help` refusal message, distinct from F2's MCP-tool gap

**Where:** `README.md` · `and \`--anything\` is not one of its four` · ~3317 — §5, "Three rules
that hold across all of them," describing the CLI's `mycontext help --anything` refusal.
Hebrew mirror: `docs/README.he.md` · `אינו אחד מארבעת הנושאים שלה` · ~3550. This is a different
sentence from F2 — F2 is about the `mycontext_help` **MCP tool's** advertised topic set (§8);
this one is about the **CLI's** own refusal message (§5), and was not touched when F2's
underlying fix landed, because it describes a different surface that was never broken.

**Why it is wrong.** `src/core/teach.ts` ·
`export const HELP_TOPICS: HelpTopic[] = ['categories', 'scope', 'capture', 'workflow', 'cli', 'tools', 'slash'];` ·
~16–18 — seven topics — and the CLI's refusal is built from that exact array. `README.md`
already knows the count is seven in two other places: §8 itself says
`README.md` · `The count moved from four to seven` · ~5195, and §5's own CLI-command paragraph
says `README.md` · `` `mycontext help <topic>` explains one of seven `` · ~2083. This one
sentence in the flag appendix was the one spot never updated when the other two were.

**Proposed fix (both languages).** `` `--anything` is not one of its four topics `` → `` `--anything` is not one of its seven topics ``,
at both cited lines.

**Confidence:** high.

---

### F14 — `docs/TUTORIAL-ADVANCED.md` names the wrong tier as the expensive one, and gives it the wrong tier's number

**Where:** `docs/TUTORIAL-ADVANCED.md` ·
`Each tier has a token budget. Pinned full text is the expensive one — 8,000` · ~159, in "4.
Budgets, and what happens when they bind." No Hebrew counterpart for this file.

**Why it is wrong.** `src/core/config.ts` ·
`export const DEFAULT_BUDGETS: Budgets = { pinned: 6000, jit: 6000, restored: 8000, index: 1200 };` ·
~56 — `pinned` defaults to **6,000**, not 8,000; `restored` is the tier whose default is
8,000. This isn't a rounding slip: the sentence names the wrong tier as "the expensive one"
and states that wrong tier's number as fact. `README.md`'s own budget table gets all four
numbers right, in the same worktree: `README.md` · `` | `pinned` | 6000 | the pinned tier at session start | `` ·
~1758, and `README.md` · `` | `restored` | 8000 | the re-injection after a compaction | `` ·
~1760.

**Proposed fix.** `` Pinned full text is the expensive one — 8,000 estimated tokens by default. ``
→ `` `restored` — the re-injection after a compaction — is the expensive one, at 8,000
estimated tokens by default; `pinned` and `jit` are 6,000, `index` is 1,200. `` If the
paragraph's real intent was to warn a reader about the cost of pinning specifically, reframe
around `pinned`'s actual number (6,000) instead, since that's the budget a reader who sets
`always: true` is the one actually paying against.

**Confidence:** high.

---

## Lower-confidence / structural observations

- **Two documented install paths, no cross-reference between them.** `docs/TUTORIAL.md` ·
  `claude plugin marketplace add Dudi-Bar-On/my-context` · ~42, versus `README.md` ·
  `claude plugin marketplace add ./` · ~1874 (run from inside a clone). Both may be
  intentionally valid — a GitHub shorthand for a first-time reader versus a local-clone-relative
  path for someone already inside the repository — and this review could not confirm from
  inside an offline worktree whether `claude plugin marketplace add <owner>/<repo>` is
  currently supported syntax, so neither is asserted wrong. What's missing is any
  cross-reference telling a reader who sees both that they're alternatives rather than one
  having superseded the other. **Confidence: low** — flagged for completeness rather than
  because either form was shown to be broken.

- **No Hebrew tutorial exists.** `docs/TUTORIAL.md` and `docs/TUTORIAL-ADVANCED.md` have no
  Hebrew counterpart; only `docs/README.he.md` does. A Hebrew-reading newcomer's path from
  "what is this" to a working corpus is the ~5,800-line README rather than the ~20-minute
  tutorial an English reader gets — directly on point for the brief's "can a person find the
  thing they need, in either language" question. Whether this is deliberate scope or an
  oversight isn't something the repository alone answers. **The gap is real; whether it's a
  defect is a product call.**

- **`docs/ROADMAP.md` and `docs/audit/2026-08-14-*.md` read as frozen historical logs, with
  nothing marking them as superseded.** `docs/ROADMAP.md` calls itself living documentation
  (`docs/ROADMAP.md` · `Every row is updated the moment its status changes.` · ~40) but its
  header is six days behind the worktree it sits in (`docs/ROADMAP.md` ·
  `**Updated:** 2026-08-16 · **Master:**` · ~3, against today's commits including `fd49a60`),
  and none of the last six days' substantial work — `mycontext export`, the `mycontext_help`
  fix, today's `fork`-source fix — appears in it; F3's stale B7.2 row is one symptom of the
  same drift. The two `docs/audit/2026-08-14-*.md` files are, by their own dates, point-in-time
  snapshots from before the "production grade" push `docs/ROADMAP.md` records as closed;
  spot checks (the `MANAGED_SEGMENT` case-fold fix the production-readiness report's headline
  finding calls for — confirmed present: `src/core/paths.ts` ·
  `const MANAGED_SEGMENT = /(^|\/)(\.my_context|\.my-context)(\/|$)/i;` · ~104, trailing `i`
  flag — and the compaction-claim rewrite) show their open findings are now closed. Neither
  audit file, nor `docs/ROADMAP.md`, says so at the top, and nothing in either README or
  either tutorial links to them — a reader who lands on one cold has no signal it's a
  historical artifact rather than a live status page. **Confidence: medium** — this rests on
  spot checks across the ~1,000 combined lines of these three files, not a line-by-line
  re-verification of every individual claim in them.

- **`skills/mycontext/SKILL.md` has real but modest headroom under its cap — not the near-crisis
  a raw byte count suggests.** `test/plugin-assets.test.ts` ·
  `` assert.ok(text.length <= 6120, `SKILL.md is ${text.length} chars`); `` · ~1058 enforces
  the cap the brief mentions, and `.length` on a JavaScript string counts **UTF-16 code units**,
  not bytes. Measured directly (`node -e "console.log(fs.readFileSync('skills/mycontext/SKILL.md','utf8').length)"`):
  **6,070** code units against the 6,120 cap — **50** units of headroom (~0.8%). `wc -c` on the
  same file reports 6,116 **bytes**; the ~46-byte gap between that and the 6,070-code-unit
  figure is the file's em dashes and similar multi-byte characters, common throughout its prose
  — the two numbers answer different questions, and only the code-unit count is what the gate
  actually checks. Not a documentation error — everything currently in the file checked out
  against the code, and its two enumerated command lists (the approval-boundary set and the
  deny-required set) both matched the same derivation `test/helpers/approval-boundary.ts` uses
  to check `README.md`'s §7. Named because the real margin, while more comfortable than a byte
  count implies, is still thin enough that the next edit to this file — a new gated command,
  one clarified sentence — should be checked against the cap rather than assumed to fit.

---

## Checked and found accurate (for calibration, not listed as findings)

- **The `--yes` approval-boundary list** (`README.md` ~1403, `docs/README.he.md` ~3447: 13
  gated commands plus `edit`'s four aliases `pin`/`unpin`/`harden`/`soften`) matches
  `test/helpers/approval-boundary.ts`'s live derivation from the real argument parser, in both
  READMEs and in `skills/mycontext/SKILL.md`. This whole surface is machine-generated and
  cross-checked by `test/docs/counts.test.ts`, which is why it's clean.
- **The category catalogue** — 24 categories, 14 normative, 10 rationale — matches the
  catalogue in code and is stated consistently across `README.md`, `docs/TUTORIAL.md`,
  `docs/TUTORIAL-ADVANCED.md`, and `skills/mycontext/SKILL.md`.
- **`DEFAULT_BUDGETS`** (`src/core/config.ts` ·
  `export const DEFAULT_BUDGETS: Budgets = { pinned: 6000, jit: 6000, restored: 8000, index: 1200 };` ·
  ~56) matches the numbers `README.md` §6 quotes exactly, in both languages.
- **The `mycontext ui` row's "today the served page is an empty shell"** (`README.md` ~2402,
  `docs/README.he.md` ~2552) is accurate in both languages and matches
  `src/ui/public/index.html`'s actual four-line empty shell. This is the one place I went
  looking for "the web UI ships routes and a blank page — is that said anywhere a user would
  look," and the answer is yes, correctly, in both READMEs. The route count itself (thirty
  registered read routes) is never stated as a number in either README, so there was no count
  to go stale — it's recorded only in `CHANGELOG.md`, out of this review's scope.
- **Structural parity between `README.md` and `docs/README.he.md`**: identical counts of
  `###` headings (71), `####` (11), `#####` (6), table rows (288), and admonition blocks (15).
  Combined with F1, F2, F3, F5 and F6 above all being mirrored verbatim in Hebrew rather than
  diverging, the working conclusion is that `docs/README.he.md` is a genuine, faithful
  translation kept in lockstep with the English structure — its bugs travel *with* the
  English source, at the same location, rather than being introduced independently. No case
  was found of a fix landing in English and not in Hebrew, or of Hebrew content diverging
  from a correct English original.
- **`npm test`'s `test/docs/*.test.ts` suite** — all 98 tests pass in this worktree as of this
  review. This is the layer that holds the counts and lists the brief warned not to bother
  re-deriving (category counts, the approval boundary, hook timeouts, MCP tool counts,
  structural parity, worked-example transcripts), and it explains the shape of the findings
  above: every one of F1–F14 sits on free-form prose that no generator or test touches. The
  generated surfaces are, as expected, clean.

---

## Coverage — what was read, how

**Read in full, directly, by this pass:** `docs/TUTORIAL.md` (343 lines),
`docs/TUTORIAL-ADVANCED.md` (476 lines), `skills/mycontext/SKILL.md` (108 lines),
`docs/mutation-testing.md` (82 lines), `docs/ROADMAP.md` (391 lines, direct read of the header
and Parts A–C in full, targeted verification of specific rows — B7.2, E5, E13, E17 — across
Parts D–F). `README.md` §5 "Using it" (~1819–3323) and §7–9 (~4621–5341) were read directly in
full; §6 "Configuration" (~3323–4621) was checked subsection by subsection for its factual
content (defaults, enums, the `CATEGORY_KEYS`/`ui`-key checks) rather than read prose-first
end to end; §1–4 (~74–1819) was covered by targeted search for absolute and numeric claims
rather than a full sequential read.

**Delegated to parallel sub-agents, whose independent work fed into and was re-verified for
this consolidated report:** full sequential reads of `README.md` §1–4, all of §6, §5 and §7–9
(cross-checking the direct reads above), a full sequential read of `docs/README.he.md` (5,786
lines, both for independent staleness and the translation-vs-fork question), and a combined
pass over both tutorials, `skills/mycontext/SKILL.md`, `docs/ROADMAP.md`,
`docs/mutation-testing.md`, and both `docs/audit/2026-08-14-*.md` files. As the provenance
note above describes, this produced more coverage of `docs/README.he.md` and of `README.md`
§1–4 and §6 than any single pass in this session managed alone — every finding above that
touches those ranges (F5, F6, F9's Hebrew mirror) was cross-confirmed against `src/`
independently before inclusion, regardless of which pass first surfaced it.

**Not read at all:** `docs/audit/2026-08-14-production-readiness-report.md`'s detailed
per-requirement body (R1–R155, ~400 of its 447 lines) — its verdict, method and legend
sections (~40 lines) were read, and its headline finding was spot-checked as closed (see the
structural observations above), but the individual R-number rows were not re-verified one by
one.

**Out of scope, per the brief:** `docs/superpowers/`, `docs/design/`, `specs/`,
`CHANGELOG.md` (referenced a handful of times above only as corroborating evidence for a claim
independently verified against `src/`, never as the sole basis for a finding).

---

## Confidence tally

**High confidence (14):** F1 (export/history, two locations, both languages), F2
(`mycontext_help` topic gap, both languages), F3 (`add --extra`, both READMEs' §8 plus
`docs/ROADMAP.md`), F4 (`docs/TUTORIAL-ADVANCED.md`'s refused `full` profile), F5 (six→seven
per-category keys, both languages), F6 (`SessionStart`'s missing `fork` trigger, both
READMEs' hook table), F7 (`docs/TUTORIAL.md` four hooks and stale Skills count), F8
(`docs/TUTORIAL-ADVANCED.md` four hooks), F9 (`ui.enabled` undocumented and inert, both
languages), F10 (`--step`/`steps` undocumented, both languages), F11 (version pin, both
tutorials, flagged at low urgency despite high confidence in the fact itself), F12
(`docs/mutation-testing.md`'s missing exit code 4 and the matching `docs/ROADMAP.md` E17
staleness), F13 (a second, independent "four topics" leftover — the CLI's own refusal message,
distinct from F2's MCP-tool gap — both languages), F14 (`docs/TUTORIAL-ADVANCED.md` names the
wrong tier as the expensive one, with that wrong tier's number).

**Lower confidence / observations, not asserted as defects (4):** the no-Hebrew-tutorial gap
(real, but possibly deliberate scope), the `docs/ROADMAP.md`/audit-directory orphaning (medium
confidence, spot-checked rather than exhaustively verified), the SKILL.md size headroom (not a
defect — a heads-up for the next editor), the two undifferentiated install paths (low
confidence — flagged, not asserted broken).

Nothing above was included on a hunch. Every finding traces to a specific line in `src/`, a
specific test, or a specific commit, and every citation was checked to resolve to a single
physical source line before being written down. Where something looked wrong but couldn't be
pinned to code, it was left out rather than padded in.
