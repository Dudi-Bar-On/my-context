# Documentation review — 2026-08-22

Independent review. Nothing outside this file was written or modified. Every finding below
was checked against the running source (`src/`, `hooks/hooks.json`, `scripts/`, `test/`), not
against another document — per the brief, this is not a proofread and the derived tests
already hold the counts and the lists. What follows are sentences that assert a *behaviour*
and are checkably false today.

## Coverage — read this before the findings

- **`README.md` (5,341 lines):** read essentially end to end, section by section, with code
  cross-checks on every load-bearing claim I could locate a source for (budgets, category
  catalogue, hook list, MCP tool count, CLI/slash command counts, the approval-boundary
  table, the flag reference tables, the config schema, the trust-boundary mechanics). The
  `<!-- example -->` / `<!-- example-md -->` blocks are mechanically regenerated and diffed
  by `test/docs/examples.test.ts` and `injection.test.ts`, so I did not hand-verify their
  byte content — only whether the *prose around* them still describes reality.
- **`docs/README.he.md` (5,786 lines):** **not** read end to end — the fork tool this task
  expected was unavailable inside this session (worker forks cannot themselves spawn forks),
  and a full independent line-by-line read of a second 5,800-line document was not achievable
  in the remaining budget. What I did instead: confirmed structural parity by count
  (`grep -c` on `^### `, `^#### `, `^##### `, table rows, and `[!NOTE]`/`[!WARNING]`-style
  blocks — 71 / 11 / 6 / 288 / 15, identical in both files) — a much stronger parity signal
  than `test/docs/parity.test.ts` requires, which only checks heading depth sequence — and
  then checked every English finding below against its Hebrew mirror by locating the
  corresponding passage. Every one of the four cross-language findings below is present,
  verbatim in meaning, in both files. **What I did not do** is hunt for a Hebrew-only
  divergence with no English counterpart — a passage translated once and then drifted
  independently while English moved on, or vice versa. `test/docs/parity.test.ts` says
  outright that no test in the repository can catch that class, and I did not close that gap
  either. Treat the Hebrew coverage in this report as *spot-verified*, not audited.
- **`docs/TUTORIAL.md` (343 lines) and `docs/TUTORIAL-ADVANCED.md` (476 lines):** read
  completely, and every command shown was checked against the current CLI parser. There is no
  Hebrew tutorial to cross-check against.
- **`skills/mycontext/SKILL.md` (109 lines):** read completely; every claim checked.
- **`docs/ROADMAP.md` (392 lines):** read completely.
- **`docs/mutation-testing.md` (83 lines):** read completely, checked against `scripts/mutate.ts`.
- **`docs/audit/2026-08-14-executive-plan.md` (168 lines) and
  `docs/audit/2026-08-14-production-readiness-report.md` (447 lines):** **only skimmed** —
  roughly the first third of the plan and the first 20 lines of the report. Both are
  self-dated 2026-08-14, describe a "not yet production grade" verdict, and are not linked
  from any currently-maintained document (`README.md`, `docs/README.he.md`, `docs/ROADMAP.md`
  and `CHANGELOG.md` contain zero references to `docs/audit/`). `docs/ROADMAP.md`'s own `A5`
  row names the readiness report as the census `ROADMAP.md` grew out of, and every "Wave
  1/2/3" item the plan lists as open is shown closed in `ROADMAP.md` by 2026-08-16. I am
  confident these are superseded historical snapshots rather than live status, but I have
  **not** verified every individual finding inside them, and I flag that as a gap rather than
  papering over it.

**Confidence summary:** four findings below are high-confidence with a shipped commit,
a dated doc sentence that predates it, and matching Hebrew evidence — I'd stake the review on
those. Four more are high-confidence but single-document (no Hebrew counterpart, or the
Hebrew already agrees). The rest are lower-confidence observations, labelled as such, offered
because the brief asked for uncertainty to be ranked rather than dropped.

---

## Tier 1 — shipped in the last two days, doc still says otherwise (both languages)

### 1. The audit log's "no export command" claim is now false — twice, in both languages

**Where:**
- `README.md` · `this is built: there is no export command in this release, and nothing in the log travels` · ~2598
- `README.md` · `which is decided and not built; it rotates at 8 MiB but still never` · ~5153
- `docs/README.he.md` · `אינו בנוי: אין פקודת ייצוא בגרסה הזאת, ושום דבר ביומן אינו נוסע היום` · ~2782
- `docs/README.he.md` · `שביומן ולהשאיר את כל השאר מאחור, הכרעה שהוכרעה ולא נבנתה` · ~5594

**Why it is wrong:** `mycontext export` shipped in commit `2bb4293` ("feat(cli): mycontext
export, with --as-pack and the deterministic zip"), dated **2026-08-21 23:20:53** — two days
after the audit-log `[!NOTE]` block above was last touched (commit `037ccda`,
**2026-08-19**). It builds *exactly* the feature the NOTE says is undecided-and-unbuilt:
`src/cli/commands/export.ts` · `history: !hasFlag(args, 'no-history')` · ~197 — by default a
`history.jsonl` travels with the export — and `src/pack/history.ts` · `` `kind === 'mutation'`, and everything else is `` · ~14 — the filter is positive on the mutation kind only, which
is precisely "half the log will travel, deliberately filtered" that the NOTE calls
undecided. `README.md`'s own **later** section, "Handing the corpus on — `mycontext export`"
(~2877), correctly describes this as shipped and working — so the document currently
contradicts itself, twice, about whether this exists.

**Proposed fix:** In both places, replace the "not built" framing with the shipped state.
For the §5 NOTE (~2586–2601 in English, ~2760–2783 in Hebrew), the paragraph's last two
sentences ("**None of this is built…**" / "**שום דבר מזה אינו בנוי…**") should become
something like: *"This is now built: `mycontext export`'s `history.jsonl` carries exactly the
mutation half described above, filtered to the items that travel; `--no-history` withholds
it. See [Handing the corpus on](#handing-the-corpus-on--mycontext-export)."* — and the
Hebrew mirror correspondingly. For the second instance (~5150–5154 English, ~5591–5595
Hebrew), "…which is decided and not built…" → "…which is now built (`mycontext export`) —
see §5…", removing the now-false clause entirely rather than softening it.

**Confidence:** high.

### 2. `mycontext add --extra` shipped; three documents still say it does not exist

**Where:**
- `README.md` · `` **`mycontext add` has no `--extra`.** `` · ~5130 (§8, "Editing — what still has no route")
- `docs/README.he.md` · `` ל-`mycontext add` אין `--extra`. `` · ~5571
- `docs/ROADMAP.md` · `` **`mycontext add` has no `--extra`** `` (row **B7.2**, status **⏸**) · ~184

**Why it is wrong:** commit `bd933d2` — "feat(cli): mycontext add --extra, sharing edit's
parser" — dated **2026-08-20 10:09:23**, added it. `src/cli/index.ts` ·
`const ADD_VALUE_FLAGS = ['body', 'file', 'note', 'step', 'scope', 'tags', 'severity', 'extra'];`
· ~481 lists `extra` as an accepted value flag on `add`, and `cmdAdd` reads it: the flag is
parsed with `extraFlag(args)`, validated, and assigned to `input.extra` before the item is
created (`src/cli/index.ts`, the block beginning `const extra = extraFlag(args);`). This is
not a partial/declared-but-unwired flag like `ui.enabled` (finding 9 below) — it is fully
wired, has its own test file (`test/cli/add-flags.test.ts`), and the commit's own code
comment says so directly: *"Its absence here was an asymmetry, not a policy… `createItem`
already accepted `extra`; only the flag was missing."*

This is the most consequential finding in the set precisely because §8's entire premise —
stated in its own opening NOTE — is *"Nothing stays in this section once it ships."* This
entry violates that promise as written today.

**Proposed fix:** Delete the bullet from §8 in both READMEs (it describes a capability that
now exists, so per §8's own rule it does not belong there at all — it belongs, if anywhere,
as a one-line mention in §5's `add` flag description). In `docs/ROADMAP.md`, close row B7.2:
mark it ✅, and correct its own citations — the row cites `README.md:3178` and
`docs/README.he.md:3528` as the two places that "state the gap correctly"; those need the
same fix as the §8 bullet above (they are the "every flag, in one place" §5 material, not
duplicated here since the wording there does not name `--extra` at all — see finding 3 for
the adjacent, still-open gap in the flag *reference table*, which does not currently list
`add` as a place `--extra` works either: `README.md` · `` `--extra key=value` | one category-specific field… | `edit` `` · ~3212 should read `` | `add`, `edit` `` `).

**Confidence:** high.

### 3. The `steps` field (procedures) is invisible everywhere `create_item` and `add`'s accepted fields are enumerated

**Where:**
- `README.md` · `It accepts: type, title, body, scope, tags, severity, always, observations, source_file, source_anchor, blocks, directive, impact, kind, likelihood, validate_by, validated_on.` · ~4253
- `docs/README.he.md` — identical English error text (it is a quoted CLI message, not translated prose) · ~4587
- `README.md` · `` `mycontext add <category> <title>` | create an item — `--body` or `--file`, `--note`, `--scope`, `--tags`, `--severity`, `--yes` `` · ~2093
- `README.md` · `` `add` takes `--body` or `--file`, `--note`, `--scope`, `--tags` and `--severity hard|soft`, `` · ~2106
- `README.md` §5 "Every flag, in one place" — the "Setting a field on an item" table (~3200–3216) has no `--step` row at all, despite the section's own claim two paragraphs above it: `` Every flag the CLI accepts is in one of the seven tables below. `` · ~3172

**Why it is wrong:** commit `aee0adf` — "feat(capture): steps on add, create_item, and an
explicit refusal in ingest" — dated **2026-08-21 02:22:55** — added a `steps` field to
`create_item`'s schema (`src/mcp/tools.ts` · `steps: {` · ~496) and a repeatable `--step` flag
to `mycontext add` (`src/cli/index.ts` · `` `body`, `file`, `note`, `step`, `scope`, `tags`, `severity`, `extra` `` in `ADD_VALUE_FLAGS` · ~481). The `create_item` field list quoted
verbatim in the README's own "extra field refused" example (~4253) is now missing one real
accepted field (`steps`), and neither of `add`'s two flag-list sentences (~2093, ~2106)
mentions `--step`. The "every flag" section's own self-correction two paragraphs above this
gap (README.md ~3172–3178) is a direct admission that exactly this class of drift happens —
"twenty further flags were accepted by the shipped CLI and listed in none of them" — which is
what has happened again, this time to `--step`.

Section 6 ("Categories you define yourself") does correctly mention that `procedure`'s
worked specimen carries steps (~4230), and §5's CLI table for `procedure` correctly documents
`mycontext procedure step <id> <n>` for *ticking* a step (~2100) — so the gap is specifically
the *capture-time* flag and the `create_item` field enumeration, not the whole feature.

**Proposed fix:**
- `README.md`:4253 and `docs/README.he.md`:4587 — insert `steps` into the accepted-field list
  (after `always, observations`, matching the schema's own field order): `...severity,
  always, observations, steps, source_file, source_anchor, blocks, ...`.
- `README.md`:2093 — add `--step` to the `add` summary row: `` --body or --file, --note, --step, --scope, --tags, --severity, --yes ``.
- `README.md`:2106 — add `--step` to the prose sentence: `` `add` takes `--body` or `--file`, `--note`, `--step`, `--scope`, `--tags` and `--severity hard|soft`, ``.
- `README.md`'s "Setting a field on an item" table (~3200–3216) — add a `--step` row, e.g.
  `` | `--step "<text>"` | one ordered step of a `procedure`. Repeatable, in command-line order, not comma-split — a step is a sentence and sentences contain commas | `add` | ``, mirroring
  the code comment's own framing at `src/cli/index.ts` (the `normalizeSteps(steps)` block).
- Mirror all four changes in `docs/README.he.md` at the corresponding passages.

**Confidence:** high.

### 4. `docs/mutation-testing.md`'s exit-code table is missing a code the script has carried since yesterday

**Where:** `docs/mutation-testing.md` · the four-row table at ~16–19 (`` | `0` | **KILLED**… ``
through `` | `3` | Mutated, and the tree could not be put back… ``).

**Why it is wrong:** `scripts/mutate.ts`'s own doc comment lists **five** exit codes, not
four — `` 4 INCONCLUSIVE. The command never produced a verdict, because it could `` · ~47 —
and the code returns it: `return 4;` · ~475, reached when the harness's own `spawnSync` never
produced a verdict (the command could not start, or was killed by a signal). This is not a
theoretical code path — it exists specifically because, per the same comment, `` the script used to print KILLED for a command that never ran, which `` · ~49 silently validated mutants
that were never actually tested. That fix landed in commit `87a7774` — "fix(mutate): a
command that never ran is INCONCLUSIVE, not KILLED" — **2026-08-21**, one day before this
review.

The same fix also makes `docs/ROADMAP.md` row **E17** stale: `` **Fix shape, not built here:** treat `spawnSync` `error`/null-status as verdict 2 (refused), never 0 (killed). `` (status
**⏸**) · ~334 — describing as *not built* something that, as of the commit above, is built
(as its own distinct verdict 4, not verdict 2 as E17's proposed shape suggested).

**Proposed fix:** add a fifth row to `docs/mutation-testing.md`'s table:
`` | `4` | **INCONCLUSIVE** — the command never produced a verdict (could not start, or was killed by a signal). Not a kill: re-run rather than trust it. | ``. In `docs/ROADMAP.md`, mark
E17 ✅ and correct its "Fix shape, not built here" clause to name the actual shape shipped
(a distinct exit code 4, not a remap to 2).

**Confidence:** high. (No Hebrew counterpart exists for `docs/mutation-testing.md`.)

---

## Tier 2 — single-document, high confidence

### 5. `mycontext help` refuses against seven topics, not four — one leftover sentence, both languages

**Where:**
- `README.md` · `and `--anything` is not one of its four` · ~3317
- `docs/README.he.md` · `אינו אחד מארבעת הנושאים שלה` · ~3550

**Why it is wrong:** `src/core/teach.ts` · `` export const HELP_TOPICS: HelpTopic[] = [ 'categories', 'scope', 'capture', 'workflow', 'cli', 'tools', 'slash', ]; `` · ~16–18 — seven
topics — and `mycontext help --anything`'s refusal is built from that exact array
(`enumError('topic', topic, HELP_TOPICS, 'workflow')`, `src/help/index.ts` ~462–463). The
document itself already knows the count moved: §8's own "Two help topics that do not exist"
section states outright, `` The count moved from four to seven `` (README.md ~5195), and §5's
own CLI-command paragraph correctly says `` `mycontext help <topic>` explains one of seven `` (README.md ~2083). This one sentence, in the "three rules that hold across all of them" flag
appendix, was simply never touched when the other two were.

**Proposed fix:** `README.md`:3317 — `` `--anything` is not one of its four topics `` → `` `--anything` is not one of its seven topics ``. Same change at `docs/README.he.md`:3550.

**Confidence:** high.

### 6. `docs/TUTORIAL.md`'s "confirm it loaded" checkpoint reports numbers that no longer match reality

**Where:** `docs/TUTORIAL.md` · `` You want the four hooks — `SessionStart`, `PreToolUse`, `PreCompact`, `` · ~52, continuing `` reports commands and skills together as `Skills (67)` and prints no commands `` · ~54.

**Why it is wrong:** `hooks/hooks.json` declares **six** top-level hook types —
`"SessionStart"` ~4, `"SubagentStart"` ~16, `"PreToolUse"` ~27, `"PreCompact"` ~39,
`"PostToolUse"` ~50, `"PostToolUseFailure"` ~62 — not four; the tutorial's list is missing
`SubagentStart` and `PostToolUseFailure` entirely. And `README.md` states the exact
relationship the tutorial relies on: `` the number it shows there is the command count plus one `` (~1900) — the plugin ships **77** slash commands today (`ls commands/*.md | wc -l` =
77, matching `README.md`'s own `` 77 slash commands `` in the §5 diagram at ~1839), so
`claude plugin details` should report `Skills (78)`, not `Skills (67)`. `67` implies 66
commands at the time this tutorial's numbers were last verified — eleven fewer than exist
today, consistent with the amount of new surface (`procedure`, `inbox-promote`, `export`, the
`--step`/`--extra` work above, etc.) that has shipped since.

A newcomer following this tutorial's own "confirm it loaded" instruction today will see
numbers that do not match what is written, with nothing telling them the tutorial itself has
drifted rather than their install being broken.

**Proposed fix:** `` You want the four hooks `` → `` You want the six hooks `` and list all
six (`SessionStart`, `SubagentStart`, `PreToolUse`, `PreCompact`, `PostToolUse`,
`PostToolUseFailure`); `` `Skills (67)` `` → `` `Skills (78)` ``, with a note that this number
moves as commands are added and the reader should trust `commands + 1` over a pinned digit —
`README.md`'s own README does not print a bare count for exactly this reason (see finding 5's
neighbour, README.md ~3172–3178, which explicitly abandoned pinned flag counts after they
went stale). There is no Hebrew tutorial to mirror this in.

**Confidence:** high.

### 7. `docs/TUTORIAL-ADVANCED.md` names the wrong tier as the most expensive budget

**Where:** `docs/TUTORIAL-ADVANCED.md` · `Each tier has a token budget. Pinned full text is the expensive one — 8,000` · ~159.

**Why it is wrong:** `src/core/config.ts` ·
`` export const DEFAULT_BUDGETS: Budgets = { pinned: 6000, jit: 6000, restored: 8000, index: 1200 }; `` · ~56. The `pinned` default is **6,000**, not 8,000 — `restored` is the tier
whose default is 8,000. This is not a rounding slip: it names the wrong tier as "the
expensive one" and gives that wrong tier's number as fact. `README.md`'s own budget table
(§4, "The budget, and what happens when it does not fit") gets all four numbers right.

**Proposed fix:** `` Pinned full text is the expensive one — 8,000 estimated tokens by default. `` → `` `restored` is the expensive one — 8,000 estimated tokens by default; `pinned` and `jit` are 6,000, `index` is 1,200. `` (Or, if the intent was specifically to warn about
pinning: reframe around `pinned`'s real number, 6,000, since that is the budget a reader
setting `always: true` actually pays against.)

**Confidence:** high.

### 8. `docs/TUTORIAL-ADVANCED.md`'s appendix hook list is also missing two of six

**Where:** `docs/TUTORIAL-ADVANCED.md` · `` **Hooks:** `SessionStart` (`startup|clear|resume|compact|fork`) · `PreToolUse` `` · ~471, continuing `` (`Read|Edit|MultiEdit|Write|NotebookEdit`) · `PreCompact` · `PostToolUse` `` · ~472.

**Why it is wrong:** same root cause as finding 6 — `hooks/hooks.json` names six hook types,
this list names four, missing `SubagentStart` and `PostToolUseFailure`. Worth noting as a
*separate* instance rather than folding into finding 6: the `SessionStart` source-value list
quoted here (`startup|clear|resume|compact|fork`) is already correct and current — it
matches `src/hooks/io.ts`'s freshly-corrected comment (commit `fd49a60`, dated **2026-08-22**,
today), which just added `fork` as the fifth value. So this exact line was touched very
recently to fix one thing and left with the older, incomplete hook *count* still standing
beside the newly-fixed hook *source list* — a good example of a partial fix leaving a sibling
claim stale on the same line.

**Proposed fix:** `` **Hooks:** `SessionStart` (`startup|clear|resume|compact|fork`) · `SubagentStart` · `PreToolUse` (`Read|Edit|MultiEdit|Write|NotebookEdit`) · `PreCompact` · `PostToolUse` (`Write|Edit|MultiEdit`) · `PostToolUseFailure` ``.

**Confidence:** high.

---

## Tier 3 — real, but lower priority (missing documentation, not a false claim)

### 9. `config.json`'s `ui` key is validated but does nothing, and appears in neither README's Configuration section

**Where:** `README.md` §6 "Configuration" (~3323–4620) and `docs/README.he.md`'s mirror
(~3557–5040 per the header list) document `profile`, every `categories.<name>.*` key,
`budgets` and `watchedDocs` — and nowhere mention a top-level `ui` key. The `mycontext init`
skeleton shown at the top of §6 (`README.md` · `` "profile": "standard", "categories": {}, "budgets": {} `` · ~3328–3331) does not include it either, which is accurate to what `init`
actually writes but reinforces that a reader has no way to discover this key exists from
either README.

**Why it matters:** `src/core/config.ts`'s `requireUi` (~491–522) accepts and strictly
validates `{"ui": {"enabled": <boolean>}}` — a misspelled key or non-boolean value refuses
the *entire* config file (`` my_context: ui.enabled is ${JSON.stringify(raw.enabled)}. Expected true or `` · ~515) — but nothing in `src/cli/commands/ui.ts`'s `cmdUi` ever reads
`ws.config.ui.enabled` to decide whether to refuse starting the server. Setting
`{"ui": {"enabled": false}}` loads cleanly and `mycontext ui` starts anyway. This is exactly
the kind of gap the brief called out (`ui.enabled` "accepted, validated, documented, and read
by nothing") — except here it is *not* documented in either README's user-facing
Configuration reference at all; the only place it is written down is `CHANGELOG.md`, which is
out of this review's scope. A reader who discovers the key exists (by reading `config.ts`, or
by guessing) and sets it to turn the web UI off will see no error and no effect.

**Proposed fix:** add a `` `ui.enabled` — turning the web UI off `` subsection to §6 in both
READMEs, stating plainly that the key is accepted and validated but **not yet wired to
anything** — `mycontext ui` starts regardless of its value — matching the honesty §8 already
practices elsewhere for exactly this "declared but not in effect" class of gap. (`README.md`'s
`mycontext ui` row at ~2402 already correctly discloses that "the served page is an empty
shell," so the precedent for disclosing this command's rough edges in place is already set —
this would sit right beside it.)

**Confidence:** high on the code facts; medium on placement/priority — this is a documentation
*gap*, not a false sentence, so it is lower-stakes than tiers 1–2 even though the underlying
behaviour is a real trap for a user.

### 10. `docs/audit/*.md` are undated-looking historical snapshots with no pointer forward

**Where:** both files under `docs/audit/`, self-dated **2026-08-14** in their own headers.

**Why it matters:** neither is linked from `README.md`, `docs/README.he.md`,
`docs/ROADMAP.md`, or `CHANGELOG.md` (checked by grep across all four; zero hits for
`docs/audit`). The production-readiness report's own verdict — `` mycontext is not yet production grade `` — describes a state `docs/ROADMAP.md` shows resolved days later (Part B,
"Nothing here is optional. The product is not production grade until Part B is empty" ~70,
closed by 2026-08-16). A reader who opens `docs/audit/` without noticing the date in the
header — there is no "superseded by" banner — could reasonably mistake either file for
current status. I did not verify every individual finding inside them (see Coverage above);
what I can say confidently is that the top-line verdict of both is stale and unflagged as
such.

**Proposed fix:** add one line near the top of each file pointing at `docs/ROADMAP.md` as the
living successor, e.g. *"Historical snapshot, 2026-08-14 — every Wave 1–3 item this plan and
report describe as open is closed; see `docs/ROADMAP.md` for current status."* This is a
one-line, low-risk fix for a real "could mislead a skimming reader" problem, not a rewrite.

**Confidence:** medium — the staleness of the *verdict* is high-confidence (directly
contradicted by `docs/ROADMAP.md`'s own closed rows), but I have not exhaustively checked
every individual finding inside 615 combined lines, so I can't rule out that some rows still
describe live gaps.

### 11. `docs/ROADMAP.md`'s own header is behind its own body

**Where:** `docs/ROADMAP.md` · `` **Updated:** 2026-08-16 · **Master:** `758ee03` · **Tag:** `v0.9.0` `` · ~3.

**Why it matters:** the document's own body, one screen down, says `` **Since `v1.0.0` was tagged 2026-08-17** `` (row Q5, ~379) — one day after the header's claimed "Updated" date and
a full version past the header's own "Tag" field. `package.json` today reports version
`1.0.2`, two patch releases past even that. `docs/ROADMAP.md` explicitly disclaims being a
tested artefact (row E11 · `` ROADMAP.md is a tracking document, not a tested artefact. `` ·
~330), so this is offered as a low-stakes observation rather than a "fix this" — but the
header line is trivial to correct and currently contradicts the document under it.

**Proposed fix:** bump the header line's tag/date, or better, drop the pinned tag/version from
the header entirely (as the same document already argues for pinned counts elsewhere) and
point instead at `CHANGELOG.md` for the current version.

**Confidence:** medium — factually clear, but very low consequence (nobody reads a roadmap
header to learn the installed version).

### 12. Two different install paths, no cross-reference

**Where:** `docs/TUTORIAL.md` · `claude plugin marketplace add Dudi-Bar-On/my-context` · ~42,
versus `README.md` · `claude plugin marketplace add ./` · ~1874 (run from inside a clone).

**Why it might matter:** these are two genuinely different installation routes — a GitHub
shorthand (confirmed real: `git remote -v` shows this repository's own origin is
`https://github.com/Dudi-Bar-On/my-context.git`) versus a local-clone-relative path — and
both may be intentionally valid, with the tutorial's GitHub form being the more convenient
no-clone-needed path for a first-time reader. I could not verify from inside this offline
worktree whether `claude plugin marketplace add <owner>/<repo>` is in fact supported syntax
today, so I am not asserting either is wrong. What is missing is any cross-reference between
the two: a reader who reads both documents has no way to know these are alternatives rather
than one having superseded the other.

**Proposed fix:** if both are intended to work, add one sentence to whichever is read second
("or, from a clone: `claude plugin marketplace add ./`") so the two do not read as
contradictory.

**Confidence:** low — flagged for completeness per the brief's instruction to rank
uncertainty rather than omit it, not because I have positive evidence either is broken.

---

## What I checked and found accurate (worth stating, not padding)

Positive findings matter here because the brief's premise is that most of this document is
carefully maintained and self-testing — worth confirming that impression rather than only
reporting exceptions to it:

- **Structural parity between `README.md` and `docs/README.he.md` is excellent**: identical
  counts of every heading depth, every table row, and every admonition block. Every one of
  the four cross-language findings above is present in *both* languages in the same form —
  I found no case of the two documents disagreeing with each other; every bug found was a
  case of both agreeing on something the code had already outgrown. On the specific question
  the brief asked — "is the Hebrew document a translation or a fork?" — my evidence says
  **translation**, not fork, at least everywhere I looked.
- **The web UI's real limitation is disclosed accurately.** `README.md`'s `mycontext ui` row
  (~2402) says outright that "the served page is an empty shell" and the browser app "is
  still being built" — this matches `src/ui/public/index.html` being a bare four-line shell,
  and matches the 30 read-only routes registered across `src/ui/server.ts` (15),
  `src/ui/watch-model.ts` (4), `src/ui/ask-model.ts` (3), `src/ui/read-model-config.ts` (3)
  and `src/ui/read-model-work.ts` (5). This is exactly the "missing entirely" question the
  brief raised, and the answer is: it is *not* missing — it is said, plainly, where a user
  reading the command reference would see it.
- **`skills/mycontext/SKILL.md` is well inside its enforced cap.** The cap is
  `test/plugin-assets.test.ts` · `` assert.ok(text.length <= 6120, `SKILL.md is ${text.length} chars`); `` · ~1058. The file is currently 6,070 UTF-16 code units — 50 characters of
  headroom (~0.8%). Every claim in the file checked out against current code (the 13-command
  approval-boundary list matches README's own "thirteen," the 14/10 category split matches
  the current catalogue).
- **The `--yes` approval-boundary table, the CLI/slash/MCP command counts (37 / 77 / 14), and
  the "12 of the 37 CLI commands have no slash command" ratio all check out exactly** against
  the running registries (`registerCommand` call sites, `commands/*.md`, `CLI_WITHOUT_SLASH`
  in `src/plugin/parity.ts`) — unsurprising, since `README.md` itself names the test
  (`counts.test.ts`) that derives these numbers in both languages on every run, and it is
  right that it does.

---

## Summary

- **10 findings**, 4 flagged high-confidence-and-cross-language (tier 1), 4 more
  high-confidence-single-document (tier 2), 2 lower-priority/lower-confidence (tier 3), plus
  two low-confidence observations offered per the brief's instruction not to omit uncertainty.
- All four tier-1 bugs share one shape worth naming as its own finding: **a feature shipped in
  the 24–72 hours before this review (commits `2bb4293`, `bd933d2`, `aee0adf`, `87a7774`, all
  dated 2026-08-20 through 2026-08-22), and the one hand-written or hand-verified sentence
  describing its absence did not move with it.** Every one of these lives in exactly the kind
  of prose the project's own tooling cannot check — a quoted CLI message that is not inside a
  regenerated `<!-- example -->` block, or a flag-behaviour claim, which `README.md`'s own §8
  states outright ("no test anywhere checks whether a *flag* behaves as its row says," ~5285)
  is untested by design.
- I am confident in tiers 1 and 2. Tier 3 and the two low-confidence notes are offered as-is,
  ranked below the rest on purpose.
