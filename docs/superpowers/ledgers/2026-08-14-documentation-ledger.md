# SDD ledger — plan: docs/superpowers/plans/2026-08-14-mycontext-documentation.md

Spec: `docs/superpowers/specs/2026-08-14-mycontext-documentation-design.md`
Branch: `fix/wave-1-boundary` (shared with the audit's Wave 1 fixes, which completed first)

## ✅ The red window is CLOSED

Opened at `8036bcb` (Task 4), closed at `374c558` (Task 6). `npm test` is 1513 pass / 0 fail
/ 1 skipped. The section below is kept as the record of what the window was for.

## ⚠ The suite was intentionally RED

From `8036bcb` (Task 4) until Task 6 completes. `test/docs/inventory.test.ts` fails with the list of
undocumented commands and tools — that failure **is** the task list for Tasks 5–7. No task between
those two may be marked complete while it is red for any *other* reason, and the red window must
close at Task 6.

## Pre-flight

Wave 1 of the audit's executive plan finished on this branch first (17 commits, 1476 tests). The
documentation plan starts from that state.

## Rulings

**R1 — planned features are quarantined, not woven in.** The user asked for the roadmap to appear in
the documentation. Documenting unbuilt behaviour in the present tense would be this project's
characteristic defect committed deliberately in its most-read file. Ruling: shipped behaviour in the
present tense; everything planned in its own section, each entry naming the wave that delivers it.
*Cost if wrong:* a reader who skims may miss the section boundary and expect something unbuilt.

**R2 — the update instruction is a test, not a sentence.** The user asked that the docs "be updated
once we implement or change". A note asking future-us to remember is the mechanism that already
failed here repeatedly. Ruling: enforce with inventory parity, example verification and EN/HE
structural parity. *Cost if wrong:* three tests to maintain, and they check existence, not truth.

**R3 — `list --full` width is out of scope for this plan.** Task 1 surfaced that it renders ~490
columns on the real corpus (pre-existing; boxes made it visible). Narrowing it is a product decision
about which columns earn their place. Ruling: docs feature the readable detail levels; the width
issue is queued separately. *Cost if wrong:* the docs under-show the richest view.

## Task log

**Task 1 — box-drawing renderer.** `32d93e7`, `75b0877`, `2450e77`. 1476 → 1484.

The flagged risk was real: this harness exports `TERM`, which PowerShell inherits, so
`supportsUnicode()` answers `true` under `npm test` here while a clean `cmd.exe` gets ASCII. Pinning
box glyphs in command-level assertions would have produced a suite green on this machine and red on a
clean Windows box — and doc examples that don't match what such a user sees. Fixed by making the
shared test helpers accept either glyph, pinning the actual characters only in the renderer's own
tests, and adding an end-to-end test that drives a real command in both modes.

Blast radius was **13 test files, not the 4 the plan named** — several parse generated ids out of a
table's first column by regex. Any future column change hits the same set.

Two negative assertions were *strengthened* rather than transcribed (`doesNotMatch` on a
column-anchored pattern → on the bare id), because a negative assertion gets weaker when you make it
demand a column boundary.

**Task 2 — fixture corpus.** `0fc7aee`, `1e3a352`. 1484 → 1488.

Ten items, built entirely through shipped surfaces (`init`, `add`, MCP `create_item`, `review
promote`, `supersede`); no hand-written frontmatter; `doctor` reports 0 findings.

Three deviations from the plan, all justified: the fixture is a whole workspace, not just
`.my_context`, because five `.js` files under `src/` are needed for the scoped globs to be live and
`doctor` to be clean. `rebuild(ws)` as written in the plan does not exist — the real signature is
`rebuild(store, roots, config)`. And the materializer rebuilds the **project layer only**, because
the CLI folds in `~/.my-context` when present, which would make generated examples machine-dependent.

Measured widths: `list --full` 140, `review list --full` 128, `decay` a fixed **284-column** caveat
paragraph at *every* detail level, `status --full` 159.

**Task 3 — example harness.** `725806e`, `d9235fc`, `da4376d`, `b161f6b`, `1ab373b`. 1488 → 1506.

Four traps found, each of which would have silently corrupted the documentation:

1. **CRLF.** This tree's README is CRLF, so the plan's `\n`-anchored regex finds zero blocks — the
   generator writes nothing and the verifier verifies nothing, both reporting success.
2. **The global-layer leak needed two levers.** `HOME` alone is insufficient on Windows;
   `USERPROFILE` is also consulted. Proved with a test carrying both halves so it cannot go vacuous.
3. **`MYCONTEXT_UNICODE=1` was not sufficient** — `MYCONTEXT_ASCII` takes precedence, so a maintainer
   exporting it would regenerate every table in the fallback and the diff would read as legitimate.
4. **Each example needs its own fixture.** The docs show `add`, which mutates; the plan's generator
   iterated in reverse while its test iterated forward, so a shared workspace would have made the two
   disagree by construction.

**Controller error, corrected:** the plan told Task 6 to write a worked example for `mycontext
search`. **There is no such CLI command.** `/mycontext:search` is a slash command that calls the
`query_items` MCP tool. Found by Task 3; the plan was corrected before Task 6 was dispatched. This is
a live instance of the two-surface asymmetry the user raised, and it belongs in the roadmap section.

**Task 4 — inventory parity (INTENTIONALLY RED).** `8036bcb`. 1506 → 1511 (1507 pass, 3 fail by design).

The plan's snippet would not have compiled: `COMMANDS` is a `Map`, not an array. `TOOL_NAMES` was
already exported.

Enumerated the true command set **by executing `mycontext help`** rather than trusting either source —
neither the registry nor the switch is complete alone. 22 commands: 7 switch builtins plus 15 registry
entries. A fifth guard test pins the banner as trustworthy in both directions, including that every
advertised name actually dispatches.

The two known asymmetries are handled by shape, not by an exception list: CLI is `mycontext <name>`
(space), slash is `/mycontext:<name>` (colon), so the reverse extractor excludes `search` structurally.
The extractor reads only code spans and fenced blocks, so prose like "mycontext stores items" cannot
manufacture a false positive — verified in both directions.

**Work remaining for Tasks 5–7:** 10 of 22 CLI commands, 32 of 38 slash commands, and 6 of 11 MCP
tools are undocumented.

**Task 5 — README sections 1–4.** `c9bf755`. 1511 → 1514 (1511 pass, 3 fail by design).

The plan's first worked example could not run, exactly as Task 3 predicted: the fixture
already holds `CONST-postgres-pool-capped-at-20`, so `add`ing it exits non-zero, and a `show`
of a just-added item cannot work when every example gets its own fixture. Replaced with
`add constraint "Uploads capped at 10 MB" … --yes` (a title absent from the fixture) and
`show CONST-postgres-pool-capped-at-20` (an item the fixture already has).

**The generator cannot reach the most important output in the document.** Injection is
produced by the SessionStart and PreToolUse hooks, and no CLI command renders a selection —
so `gen:docs`, which only runs `node src/cli/index.ts <command>`, can never fill an injection
block. Sections 3 and 4 quote four such blocks (a session start, a JIT injection, a budget
spill note, an index truncation line). `test/docs/injection.test.ts` closes the gap from the
other side: it runs the real hooks against the same fixture, in a child process with
`HOME`/`USERPROFILE` neutralised (`GLOBAL_DIR` is computed at module load, so it cannot be
neutralised in-process), and asserts the README quotes their output verbatim. Mutation-checked
on all three assertions. Its emptiness guard is load-bearing — every hook fails open and
returns `''`, and `''` is a substring of every document.

One false claim caught in draft by counting rather than by reading: "six of its ten items are
normative" — it is seven and three. Verified by resolving each item's category tier against
the fixture's config.

Detail levels used, all inside the widths Task 3 measured: `list --summary` (25), `show` (83).
`list --full`, `status --full` and `decay` do not appear in these sections.

**Task 6 — README sections 5–7. `374c558`. 1514 tests, 1513 pass, 0 fail — the red window is
closed.**

The failing inventory list was the work list, and it was shorter than the plan predicted:
Task 5 had already documented `list` and `show`, so 8 CLI commands remained, not 10.

Every configuration claim in §6 was produced by running the real hooks against the fixture
with a mutated `config.json`, never by reading `resolveConfig`. That is what caught the one
claim the plan's phrasing would have led to a false version of: **config does not simply
"replace rather than merge".** `watchedDocs` replaces — `["docs/rfc/**"]` makes the default
`docs/prd/**` stop nudging, proved both directions — but `budgets` and `categories` merge
per key: `{"budgets":{"index":30}}` leaves the other three at their defaults, and
`{"categories":{"standard":{"enabled":false}}}` touches no other category. §6 says both,
because saying only the first would have been the characteristic defect in the file most
likely to be read.

Two claims trimmed for the same reason. "Every write is stamped as an agent write" is false
for `link_items`, which carries no `origin` at all — `LinkInput` has no such field, because
a relation touches nothing the boundary covers. Both places that made the claim now name
the exception.

Detail levels used, all measured: `list` default (102 columns), `status` default, `status
--summary`, `review list` (102), `doctor` (75), `examples rule`. `decay --summary` is
included with its 284-character caveat line measured and named as a follow-up rather than
presented as acceptable. `list --full` and `status --full` do not appear.

`decay` is the only command whose own output argues against featuring it, and it is featured
anyway: leaving it out would have left an undocumented command and a reader with no idea the
report exists.

**A generator trap for whoever writes the Hebrew mirror:** an example marker with a truly
empty fence does not parse. `CLOSE` is `\r?\n```\r?\n<!-- /example -->`, so the block needs a
blank line inside the fence before generation — ```` ```text\n\n``` ```` — or
`collectExamples` throws "unterminated example block" and `npm run gen:docs` writes nothing.

**Not verified, and left out rather than guessed:** how this repository is installed as a
Claude Code plugin. §5 names where the surfaces are declared (`commands/`,
`hooks/hooks.json`, `.mcp.json`) and stops there, because nothing in the repository states
an install route and inventing one would be a false claim in the first paragraph a new user
reads. Task 7 should close it if the answer is known.

**For Task 8:** the parity test's `depths()` regex counts `#` lines inside fenced blocks, and
both §3/§4 (Task 5) and §6's scope demonstration quote injected output whose lines begin
`###`. The Hebrew mirror must copy those blocks verbatim or the depth sequences will not
match.

**Task 7 — roadmap, diagrams, presentation.** 1514 tests, 1513 pass, 1 skipped. `tsc` clean.

**The install gap is closed, and the answer was reached by running Claude Code, not by
reading its documentation.** `claude --plugin-dir <path>` loads this repository as a plugin
for one session; `claude --plugin-dir . plugin details mycontext` prints the component
inventory (38 commands plus the `mycontext` skill, four hooks, one MCP server), which is
what the README now tells a reader to run to confirm the plugin loaded rather than assume
it. The persistent route is genuinely absent and is documented as absent:
`claude plugin marketplace add ./` fails with `Marketplace file not found at
.claude-plugin/marketplace.json`, which this repository does not ship (task #72).

**`claude plugin validate .` found a live defect that §5 was asserting the opposite of.**
19 of the 38 command files — the 17 `list-<type>` commands plus `review` and `status` —
carry `argument-hint: [--full|--short|--summary] [--json]`, which opens a YAML flow sequence
and then trails a second one. Claude Code's own message: *at runtime this command loads with
empty metadata (all frontmatter fields silently dropped)*. So `disable-model-invocation:
true` is **declared and not in effect** on those 19, and §5's sentence "All 37 of those carry
`disable-model-invocation: true` — they are your surface, not the model's" was false as
written. It now says *declare*, names the 19 files and the consequence, and §8 carries the
fix. Recorded as task #71 rather than fixed here: Task 7 is a documentation task, the fix is
a generator change plus regeneration of 19 committed files, and the honest sentence closes
the truth defect immediately either way.

`test/plugin/commands.test.ts`'s "every command file is frontmatter-shaped and user-only"
passes on all 38 because it checks shape with its own parser and never parses the YAML. That
is the same half-checking pattern the audit's S1 names, inside the suite that exists to
prevent it — task #71 carries the test fix too.

**The five diagrams were verified by parsing, not by reading.** `mermaid` 11.16.1 plus
`jsdom` in a throwaway directory outside the repository, calling `mermaid.parse()` on every
fenced `mermaid` block in `README.md`; the checker was itself smoke-tested against a
deliberately broken diagram first, so a green run is not vacuous. Two real syntax errors were
caught this way and would have shipped as raw code blocks on GitHub: an unclosed fence after
the `stateDiagram-v2` note block, and `--by` inside a state-transition label, where `--`
starts an arrow. The state diagram's labels are now free of `--` for that reason. The probe
directory was deleted.

**Section 8's wave numbers come from `docs/audit/2026-08-14-executive-plan.md`, which is no
longer in the working tree** — `docs/audit/` is untracked and holds only a `.bak` of the
report. The plan was recovered from commit `fe6e5b8`, where it was originally committed.
The README names the waves and describes each in one clause rather than linking to a path a
reader cannot open.

**Claims verified by execution for §8**, not taken from the audit: the three absent
requirements are `active`, `severity: hard` and scoped in this repo's own corpus (`show` on
each), so the plugin JIT-injects them as binding while not satisfying them; `mycontext help`
lists 21 commands and none of them edits; 17 of the 21 have no slash command and 8 of the 11
tools have none; `create_item`'s schema declares no `relations` property; `list --full` is
840 characters wide on the real corpus, not the ~490 recorded earlier — it has grown.

**The trap for Task 8 and Task 9, restated:** §8 mentions no CLI command that does not
exist, and that took care. `test/docs/inventory.test.ts` extracts `mycontext <name>` from
every code span *and every fenced block* — including the mermaid diagrams — so a roadmap
sentence about a future `mycontext edit` would fail the suite. Planned commands are named
without the `mycontext ` prefix (`there is no \`edit\` command`) for exactly that reason.
The Hebrew mirror must keep that shape.

**One assertion added**, per the plan's suggestion: `test/docs/examples.test.ts` now carries
a floor of 10 worked examples (the README has 11), because the loop below it is vacuous on a
document that lost every marker. Mutation-checked by raising the floor to 99 and watching it
redden. Deliberately a floor, not an exact count — adding an example must never be what
breaks the suite.

## Follow-ups recorded, not fixed here

- `list --full` renders ~490 columns on the real corpus; `decay`'s caveat is 284 columns unwrapped at
  every level (task #69).
- `mycontext add` cannot set `severity`; only `review promote` and MCP `create_item` can, so the docs
  cannot show a human capturing a `hard` constraint (task #70).
- `create_item` silently ignores a `relations` argument — accepted, dropped, no message (task #68).
- `OPENQ-does-sessionstart-injection-actually-work` is a half-wired retirement in the real corpus;
  `mycontext supersede` would repair it.
- 19 of 38 generated slash commands have unparseable frontmatter, so their
  `disable-model-invocation: true` is inert (task #71); the commands test that should have
  caught it never parses the YAML.
- No `.claude-plugin/marketplace.json`, so there is no persistent plugin install (task #72).
