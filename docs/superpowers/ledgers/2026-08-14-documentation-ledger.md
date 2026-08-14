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
- ~~19 of 38 generated slash commands have unparseable frontmatter, so their
  `disable-model-invocation: true` is inert (task #71); the commands test that should have
  caught it never parses the YAML.~~ **Fixed — see the Task 8 entry below.**
- No `.claude-plugin/marketplace.json`, so there is no persistent plugin install (task #72).

## Task 8 — the unparseable `argument-hint` (task #71)

**The defect, in one line:** every generated `argument-hint` began with `[`, which opens a
YAML flow sequence. On 19 files the value was `[--full|--short|--summary] [--json]` — one
sequence closed, a second opened — and `claude plugin validate .` rejected all 19 with *"At
runtime this command loads with empty metadata (all frontmatter fields silently dropped)"*.
The `disable-model-invocation: true` line beneath it therefore never loaded: the model could
invoke the 17 `list-<type>` commands, `review` and `status`, all of which said it could not.
The characteristic defect of this repository — a declaration asserting a property that is
not in effect — in the surface the user types.

**The other 19 were wrong too, less loudly.** `argument-hint: [the decision in one sentence]`
is *valid* YAML: it parses as a one-element list, not the string the field holds. Fixed by
the same change.

**The fix is not "add quotes" but "stop hand-rolling the emission".** `frontmatter()` in
`src/plugin/commands.ts` now builds the block with `serializeFrontmatter`, this repository's
one escaping path, which quotes whatever needs quoting. Double-quoted is what it emits and
what `parseFrontmatter` reads back; rendering is unaffected either way, because Claude Code
parses the YAML and shows the string — the user sees `[--full|--short|--summary] [--json]`
on the argument line, no quotes. A single-quoted emitter would have needed its own `''`
doubling rule, a second escaping path to keep correct.

**The latent instance, closed at the same time.** `resolveConfig` validates a custom
category's `tier` and `description` but never its NAME, which is an arbitrary JSON key — and
the name is interpolated into the frontmatter `description`. A category named `db: pooling`
emitted `description: Capture a db: pooling in ...`: the identical bug, one config file away.
A test now drives the generator with `db: pooling # notes` and parses the result.

**The parser needed two changes before the test could use it**, and both are honest
statements about what it could not do:

1. `KEY_LINE` rejected every hyphenated key, so `parseFrontmatter` could not read
   `argument-hint` or `disable-model-invocation` **at all** — which is precisely why the test
   guarding `commands/` checked shape with regexes. A leading `-` is still rejected.
2. It accepted `[--full|--short] [--json]` as the single-element array
   `['--full|--short] [--json']`. It was **not** strict enough to reject the broken form; it
   is now, and for the reason real YAML has: `[`, `]`, `{`, `}` are flow indicators and
   cannot appear unquoted in a plain flow scalar. `serializeFrontmatter` never emits inline
   arrays, so nothing round-trips differently.

**Proof the strengthened test sees the old content** (this was the point of the task, so it
was done by mutation, not by argument). With `commands/list-decision.md` restored from
`71b190a^`:

```
✖ every command file has frontmatter that PARSES, and is user-only
  Error: unsupported frontmatter syntax at line 2:
  "argument-hint: [--full|--short|--summary] [--json]"
```

and on the *same bytes*, all four of the checks the test used to make return `true`:
`/^---\n/`, `/^description: .+$/m`, `/^argument-hint: .+$/m`,
`/^disable-model-invocation: true$/m`. Restoring `commands/add-decision.md` instead fails
with `add-decision.md: argument-hint must be a string — 'object' !== 'string'`, so the
quieter half of the defect is caught too. Both files were restored with `git checkout --`
after the source was already committed.

**Verified with the real tool, not asserted.** `claude --plugin-dir . plugin validate .`
(Claude Code 2.1.232) printed 19 errors before and `✔ Validation passed`, zero errors, after.
That the metadata now loads is Claude Code's own statement about the file it just parsed —
the consequence sentence quoted above is that same tool's account of the failing case. No
separate runtime observation of `disable-model-invocation` taking effect was made, and none
is claimed here. `claude --plugin-dir . plugin details mycontext` was tried as a second
witness and is not one: its per-component token figures are byte-based and identical before
and after the fix (`list-decision  ~20  ~170` either way), so it says nothing about whether
the frontmatter parsed. It still lists 39 skills before and after.

**Suite:** 1520 tests, 1519 pass, 1 POSIX-only skip; `tsc --noEmit` clean.

**README corrected in both places.** §5 said the files *declare* the flag and named the 19 —
true when written, wrong the moment the fix landed. It now says the flag is in effect, says
that it was not until this task, and names the regex-shaped test as the reason it went
unnoticed. §8's roadmap paragraph is past-tense and points back at §5. The follow-up bullet
above is struck through rather than deleted.

## Task 8 (plan) — the Hebrew mirror and the repository introduction

`608fd37`, `4ba6144`. 1520 tests, 1519 pass, 1 POSIX-only skip; `tsc --noEmit` clean.
`docs/README.he.md` is a full mirror: 62 heading levels in the same order as `README.md`
(the parity regex counts `#` lines inside fences, so §3/§4's injected output and §6's scope
demonstration are copied verbatim), the same 11 example markers in the same order, and the
same five Mermaid diagrams with translated labels.

**The stated cost, carried from spec §8 and repeated at the top of the mirror itself:** this
document doubles the cost of every future documentation change; structural parity is
enforceable and translation freshness is not, so a hurried edit can leave the Hebrew present
but stale. The mirror's own intro says so, and says the English is authoritative on conflict —
the alternative is a reader trusting a paragraph nothing checks.

**The four injection blocks are now pinned in both documents.** `test/docs/injection.test.ts`
reads `README.md` and `docs/README.he.md` and asserts each quotes the SessionStart injection,
the JIT injection, the spill disclosure and the index truncation line verbatim.
Mutation-checked by breaking each of the four in the Hebrew file alone and watching the
matching assertion redden. This was Task 5's recommendation, and it is the only thing that can
keep those blocks honest here: `gen:docs` cannot fill them, so without the assertion they are
hand-copied text nothing checks.

**RTL was settled by looking at the rendered page, and the plan's guidance turned out to be
half right.** Method: render the real file through GitHub's own renderer
(`gh api -X POST /markdown -f mode=gfm`), inject the returned HTML into a browser through
Playwright, screenshot it, and read the screenshot. Three findings source review would not
have produced:

1. **A `dir="rtl"` container reverses a box-drawing table.** The first probe wrapped a whole
   document in one RTL div; the `list --summary` example came back with its corners swapped
   and `10 item(s)` rendered as `item(s) 10`. So Hebrew prose lives in `<div dir="rtl">`
   blocks and every fenced block — text, bash, json and mermaid alike — is deliberately left
   OUTSIDE them. That also keeps the fences at the same nesting depth as in the English
   document, so GitHub's client-side Mermaid step is not asked to do anything new.
2. **"Wrap inline English in backticks, GitHub renders code LTR" is false.** GitHub emits
   `<code>` with no `dir`, so a span inherits the RTL paragraph direction: `mycontext show
   <id>` rendered with the angle brackets *mirrored*, and `mycontext query "SELECT …"` with
   its quotes on the wrong ends. Fixed with a U+200E LEFT-TO-RIGHT MARK beside any span whose
   edge character is not alphanumeric — 220 of them — and confirmed by re-rendering and
   re-screenshotting the same region. The convention is recorded in an HTML comment at the top
   of the file, because the next person to add a `<id>` span will not otherwise know.
3. Markdown *does* parse inside `<div>` blocks separated by blank lines — verified against
   GitHub's renderer rather than assumed. 41 open/close pairs, balance checked mechanically.

**Anchors.** Hebrew heading slugs were checked by reimplementing github-slugger and validating
it against `README.md` first: all 48 English headings and every in-document link resolve under
it, and under the same function every Hebrew link resolves too. Exactly one Hebrew heading
carries an LRM, and it is not a link target.

**One deliberate localization reversal.** §1's story was first translated with Israeli
currency (אגורות/שקלים), which reads more naturally — then changed back to סנטים/דולרים,
because the verbatim `INV-prices-are-integer-cents` block quoted three sections later says
"cents" and "dollars", and prose that disagrees with the output printed beside it is the drift
this plan exists to prevent.

**Numbers were diffed, not re-typed.** Every integer outside fenced blocks in both documents
was extracted and counted; the two multisets are identical apart from the "1." and "2." of the
mirror's own HTML comment.

**Concerns for whoever comes next.**
- The mirror's Mermaid diagrams have not been seen rendered as diagrams. Their syntax is the
  English syntax with translated labels, and GitHub's Mermaid step runs client-side, which the
  `/markdown` API does not exercise. A failure there shows as a code block, not as a false
  claim.
- §5 quotes Claude Code's own English message about dropped frontmatter inside a Hebrew
  sentence. It is left in English deliberately — it is what the tool prints — which makes that
  paragraph read heavier in Hebrew than in English.
- The Hebrew is real Hebrew, not transliterated English, but it is a *close* translation: the
  English sentence rhythm shows through in the long clause-stacked paragraphs of §4 and §7,
  and a Hebrew editor would break several of them up. It does not read as though it were
  drafted in Hebrew from scratch.

## Task 9 (plan) — EN/HE structural parity, and the rule in our own corpus

`96df92d`, `01de56d`. 1523 tests, 1522 pass, 1 POSIX-only skip; `tsc --noEmit` clean.
`doctor`: 0 errors, 0 warnings, 0 notes.

**`test/docs/parity.test.ts` counts headings OUTSIDE fenced blocks, deliberately.** Both
documents agree either way today — 62 `#` lines counted raw, 48 headings counted after
stripping fences, and both sequences are identical between the two files — so the choice costs
no coverage. It buys a true failure message: §3, §4 and §6 quote injected output verbatim, that
output contains `## my_context index`, and a raw count lets a change to the *tool's* words
redden a test whose message says "a section was added or removed in one language only".
Those quoted blocks are already pinned in both documents, with the exact text to paste, by
`test/docs/injection.test.ts` and `test/docs/examples.test.ts`.

**The plan's third test was replaced, not transcribed.** As written it read its own source and
matched `/does not claim to verify translation quality/` against it. That is vacuous twice over:
the regex literal itself satisfies the search, so the assertion stays green after the comment it
means to protect is deleted; and even a form immune to that could only fail when *this file* is
edited, never when the Hebrew goes stale — it reports on its own prose. What replaced it
demonstrates the limitation against the real documents: every Hebrew letter outside the fences is
replaced with `ם`, and both parity checks still pass on the result — the blindness made concrete
rather than asserted. It fails if the checks ever become content-sensitive, which is exactly the
moment the disclaimers here, in the mirror's introduction and in spec §8 would need correcting.

**Five mutations, each run to red and restored** (source committed first, at `96df92d`):
delete a Hebrew heading → `README.md has 48 headings, docs/README.he.md has 47`; append
`--json` to one Hebrew example marker → the two command lists diff; delete one fence line from
the mirror → `has an odd number of ``` lines (77) — an unclosed fenced block hides everything
after it`; add a heading to `README.md` only → red at 49 vs 48; break the heading regex to
`#{7,9}` → `only 0 headings were found in README.md; the parser is broken, not the document`.
The last two guards exist because this file's two silent-pass modes are an unbalanced fence
(which swallows the document's tail) and a regex that matches nothing (two empty sequences
"agree").

**`STD-documentation-is-regenerated-not-edited-to-match`** was captured with `mycontext add`,
not hand-written. It names all four tests and states what none of them check: whether the prose
is *true*, and whether the Hebrew is *current*.

**A defect found by dogfooding the plan's own command.** `mycontext add` takes only the FIRST
occurrence of a value flag (`valueFlag` → `flag`, `src/cli/index.ts:144`), so the plan's
`--scope A --scope B --scope C` created an item scoped to `README.md` alone and reported
success. No warning; the two dropped globs are invisible in the output. The item was rewritten
with one comma-separated `--scope` (the documented spelling) by deleting the file, running
`rebuild`, and re-adding — there is no delete command, and the file was still untracked.
**Repeated value flags should be refused rather than silently dropped**, the same way
`unknownFlag` refuses an unknown one; queued as a backlog item, not fixed here.

**Concerns for whoever comes next.**
- The third test compares the garbled mirror against `README.md` with the same functions the
  first test uses, so it also reddens whenever the first does. That is duplicate signal, not
  extra coverage; the first test's message is the one to read.
- Parity is checked on the depth *sequence*, not on heading text or slugs. Two sections swapped
  between equal depths in one language only would pass. The anchors were validated by hand in
  Task 8; nothing checks them now.

## Plan complete

All nine tasks are done. What shipped: a box-drawing table renderer with an ASCII fallback, a
committed documentation fixture, a generator that fills every example block by running the real
CLI against it, a README rewritten from 182 reference lines into full documentation with five
Mermaid diagrams, a complete Hebrew mirror, and four tests that keep the whole of it from
drifting.

What each test guards:
- `test/docs/inventory.test.ts` — every CLI command, slash command and MCP tool is documented,
  and nothing documented is missing. Both sides derived from the live registries.
- `test/docs/examples.test.ts` — every marked block is re-executed against the fixture and
  diffed, so a stale example is fixed by `npm run gen:docs`, never by editing the block.
- `test/docs/injection.test.ts` — the four injected-context blocks, which the generator cannot
  fill because no CLI command renders a selection, are quoted verbatim in both documents.
- `test/docs/parity.test.ts` — the two documents carry the same heading structure and the same
  examples, in the same order.

What remains unenforceable, stated rather than left to be discovered: **whether the prose is
true.** A test can check that a command exists, that output matches and that structure agrees; it
cannot check that the sentence around the name is accurate. The claims about the trust boundary,
the injection tiers and the configuration semantics are human-reviewed. **Whether the Hebrew is
current** is that same gap with a second failure mode: a mirror that is present, structurally
identical, and quietly a version behind. A green suite is not verified prose in either language.
