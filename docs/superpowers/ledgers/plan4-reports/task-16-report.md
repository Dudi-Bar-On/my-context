# Task 16 — the user command surface, the rename, the flag trap, tabular output, and the approval boundary

Commits: `400b881` (the five requirements), `96e7868` (three screen-level defects found by running
the result against this repo's own corpus). Baseline `396b494`, 1120 tests → **1175 tests, all
green, twice**; `npx tsc --noEmit` clean.

No subagents were dispatched. Everything below was verified by execution or by quoting a source;
where I could not verify something, it says so and it is not claimed anywhere in the code or docs.

---

## What I could and could not verify about Claude Code's plugin mechanisms

This is first because two of the task's own premises turned out to need correction, and one of the
five requirements is answered by a "no".

**Sources used:** the official docs at `code.claude.com/docs/en/plugins-reference` and
`code.claude.com/docs/en/skills` (the old `docs.claude.com/en/docs/claude-code/slash-commands` URL
301s there — custom commands have been *merged into skills*), plus the locally installed
`plugin-dev` plugin from the `claude-code-plugins` marketplace, which I read but did **not** trust
where it disagreed with the official docs (it does, twice).

| Claim | Verdict |
|---|---|
| Plugin commands are namespaced `<plugin-name>:<command>` from `plugin.json`'s `name` | **Verified.** "in the UI, the agent `agent-creator` for the plugin with name `plugin-dev` will appear as `plugin-dev:agent-creator`", and for skills: "`my-plugin/skills/deploy/SKILL.md` becomes `/my-plugin:deploy`". The local `plugin-dev` skill says commands appear as `/foo (plugin:plugin-name)` — **stale**, and I ignored it. |
| Commands are auto-discovered from `commands/*.md` in the plugin root | **Verified.** "Location: `skills/` or `commands/` directory in plugin root… Skills and commands are automatically discovered when the plugin is installed." |
| Declaring `commands` in `plugin.json` **replaces** the default scan | **Verified, and the local plugin-dev reference says the opposite** ("Supplements default `commands/` directory (does not replace)"). The official text: "**Replaces the default**: `commands`, `agents`, … when the manifest specifies `commands`, the default `commands/` directory is not scanned." I did not add the field, and there is now a test asserting it is absent. |
| `argument-hint` drives autocomplete | **Verified** ("Hint shown during autocomplete to indicate expected arguments"). |
| `$ARGUMENTS` is the whole string | **Verified.** |
| `$1`/`$2` are positional | **CONTRADICTED by the current docs.** `$N` is documented as shorthand for `$ARGUMENTS[N]`, **zero-based**: "`$0` for the first argument or `$1` for the second". The brief's 1-based reading was the older behaviour. Rather than bet on which build a user runs, **no generated command uses a positional placeholder at all** — `$ARGUMENTS` only — and a test enforces that (`no generated command uses a positional argument placeholder`). A file that guessed wrong would have captured the wrong words silently, which is precisely this project's recurring failure shape. |
| `disable-model-invocation: true` makes a command user-only | **Verified**, in the sense that matters: "prevent Claude from automatically loading this skill… Also prevents the skill from being preloaded into subagents." |
| `disable-model-invocation: true` keeps the description **out of every session's context** | **NOT VERIFIED.** The docs do not say this. They say descriptions are truncated at 1,536 characters *in the skill listing*, and that this flag stops automatic loading — not that the entry disappears. I used the flag (it is right for a user-triggered surface) but the code comment explicitly records what is and is not established. If the 37 descriptions do cost context, that is a real cost this surface carries; `user-invocable: false` is the field that hides an entry from the `/` menu, which is the opposite of what is wanted here. |
| A plugin can ship a permission deny rule | **VERIFIED FALSE — this is requirement 5's answer.** A plugin's own `settings.json` is "Default configuration applied when the plugin is enabled. Only the `agent` and `subagentStatusLine` keys are supported." There is no plugin-shippable `permissions` block. So the plugin *cannot* close the lesson-accept gap on the user's behalf, and nothing in this commit pretends it can. |

Bash deny-rule semantics, verified for the rules the README now recommends: deny rules match the
command string with `*` wildcards (`Bash(rm *)`), deny beats allow, and `Bash(ls *)` enforces a word
boundary. A deny rule matches past a leading env assignment (`FOO=bar rm …` is still denied) and past
the built-in wrapper list (`timeout`, `nice`, `xargs`, …), but **not** past `npx`, `devbox run`,
`docker exec` and friends, which are explicitly *not* stripped. That is exactly why the README says
the rules raise the cost and do not close the hole: `node …/src/cli/index.ts lesson-accept` is a
different command string and is not denied.

---

## Requirement 1 — a generated user command surface

`src/plugin/commands.ts` is a pure generator: `generateCommands(config) → {file, content}[]`, driven
by the **resolved** config — the same `Config` object `mycontext_help("categories")` renders its
table from, not the static `CATEGORIES` catalog. `scripts/gen-commands.ts` (`npm run gen:commands`)
writes them to `commands/` and deletes stale files; the files are committed because Claude Code
scans the directory on disk and nothing runs at install time.

**Shipped:** 17 `add-<type>` + 17 `list-<type>` (34) + `search`, `review`, `status` (3), alongside
the pre-existing hand-written `LoadMyContext.md` — 38 files. Category names are snake_case and
command names kebab-case (`add-non-goal`, `add-open-question`, `add-edge-case`).

- `add-<type>` calls the MCP `create_item` tool, because that is the surface with full fidelity —
  the CLI's `add` still takes only a category and a title, which is the friction the ledger recorded
  under Task 1's and Task 2's dogfooding passes ("the human CLI surface cannot express a body,
  scope, tags or observations… Task 16 must close this"). It is closed by routing the *user's*
  command through the *agent's* tool, with the CLI named only as a degraded fallback and labelled
  as such.
- `add-<type>` also tells the model what happened to the item: normative → "lands as a **draft**,
  governs nothing until a human promotes it"; rationale → "lands active, and rationale is never
  auto-injected".
- `list-<type>` shells to `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" list <type> $ARGUMENTS`, so
  it works without `npm link`, and passes the new detail flags straight through.
- `review.md` carries the gate: *"**Do not promote or discard anything yourself** … Tell the user the
  exact command … and stop there, even if they say 'promote them all'. Their typing it is the
  point."* That sentence is pinned by a test.

**Deliberately not done:** no `allowed-tools` on the generated commands. The rule would have to be a
textual match against a `${CLAUDE_PLUGIN_ROOT}`-substituted command line with `$ARGUMENTS` in it; a
rule that silently fails to match is worse than an honest permission prompt. Noted as a concern.

### The drift test (`test/plugin/commands.test.ts`, 11 tests)

- generated `add-*` set === generated `list-*` set === enabled-category set, exactly;
- committed files === generator output, **byte for byte**, with the failure message naming
  `npm run gen:commands`;
- `policy`, `postmortem`, `taxonomy` (disabled) have no files;
- the generator is driven with **different** configs (`profile: full`, and a custom category) so a
  generator that ignored its argument and hardcoded today's 17 fails;
- two categories colliding on one slug throws instead of one overwriting the other;
- every file is frontmatter-shaped, `disable-model-invocation: true`, has an `argument-hint`;
- no positional placeholders, `$ARGUMENTS` present in every file;
- every `add-<type>` names *its own* type to `create_item`, and every `list-<type>` lists its own
  category — the guard against a template that emits 34 files all capturing constraints.

---

## Requirement 2 — the rename to `mycontext`

`my-context` → `mycontext` in `.claude-plugin/plugin.json`, `package.json`, `src/mcp/protocol.ts`'s
`SERVER_INFO`, and the skill (`skills/my-context/` → `skills/mycontext/`, frontmatter `name:
mycontext`). Commands now read `/mycontext:add-requirement`, and the skill is `/mycontext` /
`/mycontext:mycontext`.

A new test pins **all four spellings of the one identity together**: `plugin.json`'s name, the
`.mcp.json` server key, `package.json`'s `bin` key, and `SERVER_INFO.name`. That is the guard that
was missing — three of the four already agreed, and the one that differed was the only one that
determines what the user types.

**Deliberately unchanged: `GLOBAL_DIR = ~/.my-context`** (`src/core/workspace.ts`). That is a *data
directory* on users' disks, not the plugin's identity; renaming it would strand an existing global
layer with no migration, which is the same class of breakage the task is trying to avoid while it
is still cheap. `src/core/paths.ts` deliberately recognises both `.my_context` and `.my-context`
spellings and is untouched. Every remaining `my-context` string in the tree is either that path, a
historical ledger/report entry, or a test of that path.

Breaking-change note, as recorded: this changes command namespaces and MCP scoped tool identity
(`mcp__mycontext__*` was already the `.mcp.json` key, so tool identity is in fact *unchanged*; what
changes is the plugin/skill namespace). The only install is the local smoketest.

---

## Requirement 3 — `--yes=false`

**Fixed in the parser, not in a confirmation-only helper.** `boolFlag(args, name)` returns
`true | false | null` and accepts `true/false`, `yes/no`, `on/off`, `1/0` in any case — the same
vocabulary Claude Code's own frontmatter accepts. `hasFlag` is now `boolFlag(...) ?? false`.

*Why the general fix:* a second strict helper wired only to `--yes`/`--always` would have left
`--json=false`, `--all=false`, `--quiet=false` and `--stdin=false` all still meaning "true", and the
CLI would have grown two flag dialects — one of which lies. The trap was in `hasFlag` itself, so
`hasFlag` is what changed. Every call site is inside a command's own `catch`, or reached through
`runCli`'s, so an unparseable value produces one prefixed line and exit 1.

*Why unparseable throws:* `--yes=maybe` has no safe answer. "True" confirms an action the caller
tried to decline; "false" silently drops a flag they meant to pass. Both are silent wrongness, so it
is refused loudly and nothing is written.

Behavioural tests drive the whole command, not the parser: `--yes=false|no|0|off` on
`review promote` and `review discard` each refuse **and leave the item a draft**; `--always=false`
promotes without pinning; `--yes=maybe` refuses and writes nothing.

---

## Requirement 4 — tabular output with detail levels, and JSON

New `src/cli/commands/format.ts`: `col` (**moved** out of `decay.ts`, not copied — `status.ts`'s
import was repointed), `table(headers, rows)` (widths fitted to the widest of header and cells,
never truncating, no lines at all for zero rows), `detailLevel`, `wantsJson`, `emitJson`,
`DETAIL_USAGE`. `query.ts`'s pre-existing `renderTable` now *delegates* to `table` rather than
keeping the second copy that inspired it.

| command | `--summary` | `--short` (default) | `--full` | `--json` |
|---|---|---|---|---|
| `list` | counts by type | id/type/status/title | + origin, layer, scope | items + count + loadErrors |
| `status` | headline, queue, usage, health | + the three tallies as tables | + per-anchor ingest pending, + cold rows (see below) | the whole dashboard, hierarchical |
| `decay` | counts + full hedge | cold + unscoped tables | + warm, + injections/last-injected/scope columns | cold/unscoped/warm + `caveat` |
| `review list` | "N draft(s) pending" | id/type/origin/source/title | + severity, scope | drafts incl. `body`, `sourceAnchor` |
| `doctor` | the one-line summary (`--quiet` is a synonym) | grouped by code | one headed row per finding | counts + `exitCode` + findings |
| `ingest-status` | "N session(s), M unfinished" | session/source/applied | per-anchor applied/pending | sessions with an `anchors[]` array |

Three deliberate decisions:

1. **`--json` carries load errors *inside* the document** (`loadErrors: [...]`) instead of appending
   text lines after it. `query --json`'s own comment concedes its trailing line makes the output
   "only strictly parseable as pure JSON when `errors` is empty"; the new surfaces do not inherit
   that. F2 is still satisfied — the errors are reported, and exit codes are unchanged. `query`'s
   own established bare-array shape was left alone.
2. **The hedges are not a detail level.** `decay --summary` still prints the full
   "cold ≠ unused" caveat, `status --json` carries it as a `usage.caveat` field, and both are
   mutation-tested. A shorter report may drop rows; it may not drop the reason its own headline
   number might mislead.
3. **`--full` implies `--all`** on `decay` — "the most detail this report has" cannot mean "and still
   hides a third of the corpus".

`mycontext list` now parses its category filter with `positionals`, so `list --json requirement` no
longer filters on the literal string `--json` and returns an empty answer that looks like a true one.

---

## Requirement 5 — the approval-gate escalation

**What shipped is documentation, plus deny rules the *user* must install, because a plugin cannot
ship permission rules** (verified above). Nothing claims more than that.

Three places, each pinned by an assertion in `test/plugin-assets.test.ts`:

- **`skills/mycontext/SKILL.md`** — a new section, "The approval gate is not enforced against you":
  *"Nothing in this plugin stops an agent with a shell from running them — the gate holds only if the
  harness's Bash permissions exclude them, and that is the user's setting, not this plugin's.
  `--yes` skips the confirmation prompt; it is an audit trail, not a lock. So: never promote,
  discard or accept on the user's behalf, and never route around a refusal with `--yes`."*
  SKILL.md is 2,837 chars, inside its 4,000-char budget.
- **`README.md`** — "The approval boundary — read this before trusting it": states that the
  derivation request instructs the model to shell out to this CLI and that the same shell reaches
  `lesson-accept`; that `--yes` is **not** a security boundary (Task 10's ruling, verbatim in
  substance); that a plugin cannot ship permission rules; the three deny rules to paste into the
  user's own `.claude/settings.json`; and, immediately after, **what they do not cover** — a
  different spelling of the same program is a different command string. "The rules above raise the
  cost of an accidental promotion; they do not make one impossible."
- **`src/help/topics/workflow.md`** (`mycontext help workflow`, and the `workflow` help topic the MCP
  `mycontext_help` tool serves) — "a human action **by convention and by permission settings, not by
  enforcement**".

The `review.md` slash command carries the same instruction operationally.

I did not add a runtime interactive confirmation beyond Task 10's, and did not describe the existing
one as protection: Task 10's ruling that it "must never be described in user-facing docs as
protection against an agent" is honoured in all three texts.

---

## Mutation testing — 24 mutants, 24 killed

Each mutant was applied to the working tree, the relevant tests run, then reverted with
`git checkout --`.

| # | Mutation | Result |
|---|---|---|
| 1 | generator drops the `enabled` filter | **killed** — set-equality + byte-identity |
| 2 | `add-*` template hardcodes `type: "constraint"` | **killed** — byte-identity |
| 2b | same, *and* files regenerated (the harder case) | **killed** — `every add-<type> names its own category` |
| 3 | `disable-model-invocation: false` + regenerate | **killed** — `frontmatter-shaped and user-only` |
| 4 | `list-*` template drops its category + regenerate | **killed** — `every list-<type> lists its own category` |
| 5 | `review.md` says "promote what the user asks" + regenerate | **killed** — the review-gate test |
| 6 | slug-collision guard removed | **killed** |
| 7 | `hasFlag` reverted to the prefix match | **killed** — 6 tests, incl. 4 behavioural promote/discard |
| 8 | `boolFlag` returns `true` instead of throwing | **killed** — 4 tests |
| 9 | `detailLevel` silently picks one of two levels | **killed** — unit + end-to-end |
| 10 | `table` drops the header and rule rows | **killed** — 13 tests across format/output/query |
| 11 | `status --json` drops `usage.caveat` | **killed** |
| 12 | `decay --summary` returns before the hedge | **killed** |
| 13 | `list` reads `args[0]` instead of `positionals` | **killed** — 4 tests |
| 14 | `plugin.json` name reverted to `my-context` | **killed** — the identity test |
| 15 | `plugin.json` gains a `commands` field | **killed** |
| 16 | the boundary section deleted from SKILL.md | **killed** |
| 17 | README's "they do not make one impossible" softened to "they close it" | **killed** |
| 18 | workflow topic's "not by enforcement" → "and enforced" | **killed** |
| 19 | `ingest-status --json` flattens away `anchors[]` | **killed** |
| 20 | `status --full` drops the per-anchor lines | **killed** |
| 21 | `doctor --full` loses its header row | **killed** |
| 22 | `doctor --quiet` no longer maps to `--summary` | **killed** — 2 tests |
| 23 | `review --json` drops `body`/`sourceAnchor` | **killed** |
| 24 | `list --json` discards load errors | **killed** |

One structural weakness worth naming: mutant 2 was killed by *byte-identity against the committed
files*, not by the semantic test — the semantic tests read `commands/`, so they only bite once
someone regenerates. Mutant 2b confirms they do bite then. The pair of guards is what makes the
class covered; either alone has a hole.

---

## The real-corpus screens, judged as screens

This is where the task earned its second commit. Running the new output against this repo's own
39-item `.my_context/` found **three defects that every test passed through**.

### 1. `status --full` produced a decay list from a ledger that had measured nothing

```
usage: no sessions recorded yet — decay reporting starts once items begin to be injected.
  cold id                                               type           title
  ----------------------------------------------------  -------------  ------------------------------
  CONST-node-24-no-build-step                           constraint     Node 24 or newer, and no build step
  CONST-zero-runtime-dependencies                       constraint     The shipped plugin has zero runtime dependencies
  … 23 more, including RULE-erasable-syntax-only …
```

One line after saying it had recorded nothing, it listed 25 items under a "cold" header — including
the two items CI enforces on this very branch, which is the *exact* list Task 13's review called out
as "recommended deleting 25 items". Fixed: with an empty ledger it prints one sentence and no rows.

```
usage: no sessions recorded yet — decay reporting starts once items begin to be injected.

  25 scoped item(s) have never been injected — with no sessions recorded, that means "not measured yet", not "unused". Nothing to act on.

health: 0 error(s), 0 warning(s), 0 note(s) — details from `mycontext doctor`.
```

Two tests were added: no rows while the ledger is empty (and the sentence appears), and rows *do*
appear once the ledger holds a session.

### 2. `decay` hedged zero as if it were a small number

`(only 0 session(s) recorded so far, so "cold" mostly means "new")` reads as a caveat on a real
signal. Zero sessions is not a small measurement, it is no measurement:
`(no sessions recorded yet — nothing here has been measured; "cold" currently means only "never
injected")`. And the standing line "do not supersede anything **below on this list**" pointed at
nothing under `--summary`; it is "on this report" now.

### 3. The usage banner collided

`status [--full|--short|--summary] [--json]counts, review queue, ingest progress…` — `padEnd(28)`
against usage strings that are now longer than 28 characters. The banner uses `col` now, and a test
asserts no summary starts immediately after a `]`.

### Current output (after the fixes)

`mycontext status` — headline, three headed tallies, queue, usage, health, all quiet: 39 items,
0 errors, 0 warnings, 0 notes, exit 0.

`mycontext status --summary`
```
my_context: 39 item(s), profile "standard"

review queue: 0 draft(s) pending review — walk it with `mycontext review`.

usage: no sessions recorded yet — decay reporting starts once items begin to be injected.

health: 0 error(s), 0 warning(s), 0 note(s) — details from `mycontext doctor`.
```

`mycontext status --json` (excerpt) — `profile`, `items.{total,byCategory,byStatus,byOrigin}`,
`reviewQueue.drafts`, `ingest: []`, `stagedRules: []`, `usage.{sessionsRecorded,window,cold,unscoped,caveat}`,
`health`, `loadErrors: []`.

`mycontext doctor` / `--summary` / `--full` on a clean corpus all print the one summary line (there
are no findings to widen), and `--json` gives `{counts, exitCode: 0, findings: [], loadErrors: []}`.

`mycontext decay`
```
my_context decay — items not injected in the last 20 session(s). The ledger holds 0 session(s).
  "cold" means: not auto-injected in the last window of sessions. It does NOT mean unused — …
  Do not supersede or deprecate anything on this report alone — verify real usage first.
  (no sessions recorded yet — nothing here has been measured; "cold" currently means only "never injected")

cold (25) — not auto-injected in the window; check before acting:
  id                                                    type           usage           title
  ----------------------------------------------------  -------------  --------------  ------------------
  CONST-node-24-no-build-step                           constraint     never injected  Node 24 or newer, and no build step
  …
```
`--summary` ends at `cold 25, unscoped 0, warm 0. Rows with 'mycontext decay' (default) or '--full'.`
`--full` adds `injections`, `last injected` and `scope` columns; `--json` carries all three lists
plus the caveat.

`mycontext list --summary` gives a clean per-type table over 39 items; `list rule --full` shows
scope and origin per rule with no collision, including the 52-character ids.

`mycontext review` → "no drafts pending review"; `review list --json` → `{"drafts": [], "count": 0,
"loadErrors": []}`. `ingest-status --json` → `[]`.

**Judgement:** the default screens are readable and say only what they can support. `--full` on
`decay` is wide — a single 68-character scope value pads that column on every row — which is
inherent to a fitted table and acceptable for the level whose purpose is completeness, but it wants
a terminal wider than 120 columns. Noted, not fixed.

---

## Constraints

Zero runtime dependencies; erasable syntax only (`npx tsc --noEmit` clean); explicit `.ts`
extensions on every relative import; **no `console.log`** in anything the MCP server imports —
`format.ts` and `src/plugin/commands.ts` have none, and `scripts/gen-commands.ts` (which does) is
imported by nothing; no test writes under `src/` (the generator test only *reads* `commands/`, and
the generator itself is pure — only `npm run gen:commands` writes, and it writes to `commands/`);
`try/finally` around every temp cleanup in the new tests (`withProject`); the tool surface is
untouched at eleven registered tools with `RESERVED_TOOLS` empty; no schema exposes `origin`.
`test/cli/f2-registry.test.ts` passes unchanged — **no new CLI command was registered**, so its
"every registered command needs a setup" clause has nothing new to cover; the commands I added are
Claude Code slash commands (Markdown files), not `COMMANDS` registrations.

---

## Concerns, in the order I would want them read

1. **The 37 command descriptions may cost context, and I could not verify they do not.** The task's
   premise that `disable-model-invocation: true` keeps a description out of session context is not
   in the docs. If it turns out they are all loaded, the surface is ~37 short descriptions of rent
   per session, and the fallback is the one-line change the ledger already anticipates: collapse to
   a generic `/mycontext:add <type> <text>` (the generator makes that a small edit). Worth measuring
   in a live session before declaring the surface production-grade.
2. **`hasFlag` can now throw.** That is deliberate and every call site is covered by a `catch`, but
   it is a behaviour change to a helper used by nine commands. `CommandFn`'s "never throws" contract
   is upheld at the command boundary, not inside the parser.
3. **The deny rules in the README are prefix matches on a command string and do not close the
   hole** — `node …/src/cli/index.ts lesson-accept`, `npx`, `devbox run` and similar are different
   strings. The README says this in as many words. The honest statement remains Task 9's: the gate
   holds if and only if the agent's Bash surface excludes those commands.
4. **The generated commands carry no `allowed-tools`,** so `list-*`/`review`/`status` will prompt for
   Bash the first time. I judged an honest prompt better than a `${CLAUDE_PLUGIN_ROOT}`-substituted
   rule that might silently fail to match; if a permission prompt per command is unacceptable, the
   right fix is to measure a real rule against a real installed path, not to guess at one.
5. **`~/.my-context` still differs from everything else.** It is a data path, not identity, and
   renaming it strands existing global layers. If it should change, it needs a migration, not a
   rename.
6. **The generator's semantic tests read the committed files, not the generator's output.** Covered
   in combination with the byte-identity test (mutants 2/2b), but a future edit that weakens
   byte-identity would silently weaken the semantic guards too. `RULE-never-weaken-byte-identity`
   already governs that file class.
7. **S1 (dogfooding) has not been done for this task** — the standing instruction runs it *after* a
   clean review, and review is next. When it runs: `REQ-cli-output-is-tabular-with-detail-levels`
   already exists in this corpus and is now satisfied, which makes it a candidate for a real
   lifecycle event rather than a new capture, and the "a plugin cannot ship permission rules"
   finding is the sharpest new constraint this task established.
8. **The ledger has not been updated for Task 16.** I did not touch
   `docs/superpowers/ledgers/2026-08-15-plan4-capture-curation-ledger.md`, since the ledger has been
   the orchestrator's artifact throughout this plan. The entries it needs from here are: the
   plugin-cannot-ship-permissions finding, the `$0`-vs-`$1` correction, and the two screen-level
   defects above (both are repeats of Task 13's and Task 15's, in code written after both — the
   ledger's own thesis that "nothing carries a lesson but attention" gets another instance).
   *(Done in review round 1 — see below.)*

---

# Review round 1 — the fourth instance, and the ledger

Commit `f5356eb`. **1176 tests, green twice**; `npx tsc --noEmit` clean.

## The fix: `decay --full` said `(none)` for a pinned item

The review found, with the same technique, what my own real-corpus pass missed. `decay --full`
rendered the `scope` column from `row.scope` alone, so an `always: true` item with no scope printed
`(none)`. On this repo that is **7 of the 25 cold rows** — `RULE-erasable-syntax-only`,
`CONST-zero-runtime-dependencies`, `INV-nothing-is-dropped-silently` among them.

Three things were wrong simultaneously, which is what makes it the same class as the two I caught:

- the report's own summary said `unscoped 0`, so the screen contradicted itself;
- `core/decay.ts`'s own comment defines unscoped as *"no scope **and no pin**"* — the module knew,
  the renderer did not;
- **`list --full` renders the identical field as `always`**, so two commands shipped in one release
  disagreed about the same value.

And the action `(none)` invites — "this can never be injected, give it a scope or delete it" — is
wrong for exactly the items CI enforces on this branch. That is Task 13's decay-report defect
wearing a different column.

**Fix:** `DecayRow` now carries `always: boolean`, populated in `toRow`, with a doc comment naming
this failure. `--full`'s cell is `row.always ? 'always' : row.scope.length ? … : '(none)'` — the pin
checked first, matching `list --full` word for word. `decay --json` gains the field too, so a
consumer no longer has to infer "unreachable" from an empty `scope` array. And `status --full`'s
"N **scoped** item(s) have never been injected" is now "N **injectable** item(s) (scoped or
pinned)" — the same category error in prose.

**Tests (the column was new and had none):** a pinned, unscoped rule renders `always` in
`decay --full` and never `(none)`; it lands in `cold`, not `unscoped`; `list --full` prints `always`
for the same item; `decay --json` carries `always: true` with `scope: []`.

**Mutants 25–27, all killed:** the scope-only cell, a hardcoded `always: false` in `toRow` (killed
through both the text and the JSON assertion), and the old `status` noun.

Verified on the real corpus: `decay --full` now shows `always` on all 7 pinned rows, and
`status --full` reads "25 injectable item(s) (scoped or pinned) have never been injected".

**A process note against myself:** my mutation harness ran `git checkout -- <file>` to revert each
mutant while the *fixes* were still uncommitted, and reverted the fixes along with the mutations.
The tests I had already written caught it on the next run. Commit before mutating — a revert tool
that cannot tell your work from your mutant is a hazard, not a convenience.

## Ledger

`docs/superpowers/ledgers/2026-08-15-plan4-capture-curation-ledger.md` now carries a Task 16 entry
with: the plugins-cannot-ship-permission-rules finding **and what the deny rules do not cover**;
both premise corrections (`$0`-vs-`$1`, and the `disable-model-invocation` claim I would not make,
together with the reviewer's later quote indicating it most likely does keep descriptions out of
context); **all four repeat defects**, and the observation that every one was found by running the
output against the real corpus *after every test passed* — three by me unprompted, the fourth by the
reviewer doing it again; what the review verified independently (notably that no number contradicts
another command — the property Task 15 failed); the 27-mutant result; the structural weakness in the
command-file guards; and the five follow-ups.

## Follow-ups recorded, not fixed

1. **Requirement 5's conditional may actually resolve to "yes", and my analysis was incomplete.**
   `hooks/hooks.json` registers a `PreToolUse` hook and `src/hooks/pre-tool-use.ts` emits
   `permissionDecision: 'deny'` **today**. Adding `Bash` to that matcher and denying command strings
   is a plugin-shippable enforcement path. My claim was true of plugin `settings.json`; the README's
   "this repository cannot close the gap on your behalf" is **over-broad as written**. The
   counter-arguments are real — a Bash-string hook inherits the same different-spelling hole, and
   `INV-hooks-fail-open` constrains what a hook may do — but that analysis is missing, not
   concluded, and I have not softened the README on the strength of an analysis nobody has done.
2. `package-lock.json` still carries `"name": "my-context"`. Cosmetic (`npm ci` passes), but it
   falsifies this report's earlier "every remaining hit is a path or a test" claim, and the new
   identity test does not cover the lockfile.
3. `--yes=false` on an **interactive** terminal falls through to the prompt rather than refusing
   outright. The non-interactive path — the agent case, and the one the gate is about — refuses.
4. `the generated command set is exactly the enabled category set` derives both sides from the same
   config object, so it cannot catch a config change; disabling `rule` fails only byte-identity.
5. No end-to-end test asserts `--json=false` prints text; only the unit test covers that spelling.
