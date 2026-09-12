# The store, the CLI, the MCP surface and the gates, reviewed

**2026-09-13 · four surfaces read at `HEAD` (`5515ed2`), working tree clean at
the start**

Nothing was written but this file. No source, no test, no corpus item, no git
state was changed; no git command that writes was run. The full suite was not
run — three other lanes were live — but every `npm run check:*`, `npm run
verify:citations` and `mycontext doctor` was, and the read-only CLI was
exercised directly. No server was started and no browser driven. The one
mutation performed anywhere was against a **throwaway copy of the rule store**
in a scratch directory, to prove what `verifyManifest` does under tampering;
the repository's own `src/rules/entries/` was never touched.

**This repository's MCP server showed as disconnected for this session.** I
drove the server myself over stdio (`node src/mcp/server.ts`, read-only calls
only: `initialize`, `tools/list`, `ping`, `get_item` on a bad id, `doctor`), so
the MCP findings below are behavioural where they say "observed" and
source-derived where they say "read". What I could *not* confirm is named in
*What I could not assess*.

**Coverage.** `src/rules/` (2,160 lines) read whole. `src/cli/index.ts` (1,699)
and all 40 files of `src/cli/commands/` read or sampled; 48 registered commands
enumerated against `src/core/command-flags.ts` mechanically. `src/mcp/`
(3,399 lines) read whole; 26 tools listed from the live server.
`scripts/check-*.ts`, `scripts/verify-citations.ts`, `src/doctor/checks.ts`,
`.github/workflows/{ci,release}.yml`, and the two named UI tests read whole.
Evidence for the store's delivery findings is the workspace's own
`.my_context/.rules/delivered.jsonl` (269 rows) joined against
`.my_context/.audit/*.jsonl` (45,440 rows).

---

## The five I would fix first

1. **Every consumer install is handed a citation it cannot resolve, inside the
   one block this product says outranks everything else.** `src/rules/deliver.ts:148`
   — the `PRECEDENCE` paragraph, delivered verbatim at every door in every
   install, ends `(\`STD-the-precedence-order-when-four-sources-of-truth-disagree\`)`.
   That item exists only in *this* repository's corpus. This is the exact defect
   store version 5 was published to fix — the changelog's own words: *"a citation
   that resolves to nothing, inside the block this product says outranks every
   other source"* — fixed on `movedFrom` and missed on the frame text three lines
   above it. **High · one line.**

2. **A Markdown file dropped into the store is delivered as a governing
   constant at every door, and no door ever asks the manifest.** Proved by
   experiment in a scratch copy: a planted `evil.md` with `tier: product` is
   reported `unexpected` by `verifyManifest`, and is *still* returned by
   `loadRules` and rendered into the delivered block. `deliverAtDoor`
   (`src/rules/deliver.ts:383`) never calls `verifyManifest`; `doctor` never
   walks the directory, by design; no gate runs `rules verify`. The "reads are
   never blocked" ruling (`src/rules/manifest.ts:264`) is right and should
   stand — but *disclosing* is not *blocking*, and `renderRefusals`
   (`deliver.ts:212`) already proves the pattern. **High · small.**

3. **`<command> --help` exits 1 on all 38 commands that take flags.**
   `src/cli/index.ts:1617` checks `--help` only at the global level; every
   command then refuses it through `refuseUnknownFlag`
   (`src/cli/commands/format.ts:467`). The output *is* the usage the user
   wanted, and the process reports failure. Observed on
   `status list doctor search ready todo rules audit edit` and 29 more.
   **High · one line** (intercept `--help`/`-h` before dispatch in `runCli`).

4. **`doctor`'s largest finding code is pure noise in every consumer repo, and
   it is a hard-coded date that makes it so.** `src/doctor/checks.ts:2341` —
   `VERIFIED_ON_INTRODUCED_AT = '2026-09-03T12:00:00.000Z'`. It is *this*
   repository's grandfather cutoff, shipped in product code. In an install
   created today every `state` write is after it, so `task_unverified` fires on
   **every** closed task from day one with nothing grandfathered. Here it is 53
   of 107 findings; there it is all of them. **High · small.**

5. **The only gate that is red is the only gate that nothing but a release
   runs, and four more run nowhere at all.** `verify:citations` exits **1**
   today (2 documentation citations broken) and appears in `release.yml:63`
   and in no CI step — so every tag cut today fails at a gate no pull request
   exercises. `check:needs-cycles`, `check:handover`, `check:dependencies` and
   `check:cited-items` are in neither workflow and there is no pre-commit hook
   anywhere (`.git/hooks/` holds only `.sample` files). `check:dependencies` is
   the one that guards `CONST-zero-runtime-dependencies`, this project's
   headline promise. **High · small** (add the four to `ci.yml`, add
   `verify:citations` to CI *after* settling the two live breaks).

**Counts.** 27 findings: **8 high, 12 medium, 7 low.** By surface — store 9
(3 high), CLI 8 (1 high), MCP 4 (0 high), gates 6 (4 high). Nothing in the MCP
surface reaches the top five, and that is a finding in its own right: it is the
second-healthiest of the four.

---

# 1 · The product rule store

12 entries, 23,638 bytes rendered at the developer tier, 2,035 at the product
tier. `mycontext rules verify` → exit 0, intact. Manifest format v1, store
version 5, five changelog rows.

### S1 · The delivered block cites an item a consumer cannot resolve · HIGH · one line

`src/rules/deliver.ts:148`. Rendered the consumer way
(`loadRules(entriesDir(), false)`), the whole 2,035-byte block is: preamble,
precedence, and one `fact`. The precedence paragraph ends:

> `…the disagreement is named below rather than settled in silence (`STD-the-precedence-order-when-four-sources-of-truth-disagree`).`

**Consequence.** A model in a stranger's install is told that a named authority
governs the precedence order it must obey, and can neither fetch it nor
discover that it was never real. `mycontext list` will not show it; `get_item`
returns `no item with id`. The manifest's own v5 note argues this case
explicitly for `movedFrom` and the fix stopped at the entry boundary.

**Recommendation.** Drop the parenthetical from `PRECEDENCE`, or gate it the
way `provenance()` (`deliver.ts:181`) already gates `movedFrom` — the
allow-list `TIERS_THAT_DISCLOSE_PROVENANCE` is right there and is the correct
mechanism. A test asserting that the consumer-tier rendering contains no
`^[A-Z]{2,}-` token would hold it.

### S2 · A planted entry is delivered as governing; the door never consults the manifest · HIGH · small

`src/rules/store.ts:81` (`loadRules`), `src/rules/deliver.ts:383`
(`deliverAtDoor`), `src/rules/manifest.ts:193` (`verifyManifest`).

**Measured.** Copied the store to a scratch directory and planted one file:

```
planted: {"ok":false,"entry":"evil.md","why":"unexpected", …}
planted entry LOADS and is in force: [ 'an-unknown-category-means-a-possible-wrong-corpus', 'evil' ]
```

An `altered` entry behaves the same way — `verifyManifest` names it, `loadRules`
delivers it. `mycontext rules verify` catches both usefully (it names the entry,
the damage kind and every problem, not just the first — good), but **nothing
runs it**: not a hook, not a door, not `doctor` (which by design never walks
this directory), not CI.

**Consequence.** The one directory whose contents are asserted to outrank every
other source is the one directory with no integrity check on the read path. A
stray file from a bad merge, a half-finished edit, or a malicious write lands in
every agent's context window at every door, labelled a product constant.

**Recommendation.** Disclose, do not block. `deliverAtDoor` already has the
directory and already renders a refusal block; call `verifyManifest(dir)` and
fold `altered`/`unexpected` entries into `renderRefusals`' existing paragraph,
and add a `tampered: N` field to the delivery row. That is a measurement, not a
hostage, and it keeps the `manifest.ts:264` ruling intact.

### S3 · The two findings I was asked to start from — measured, and one of them is not what it looked like

**(a) "Its delivery leaves no audit trace."** Half true, and the half that is
false matters more.

There *is* a record: `.my_context/.rules/delivered.jsonl`, 269 rows, written by
`recordDelivery` (`src/rules/delivered.ts:159`). What is true is that **the
audit log knows nothing about it** — 45,440 audit rows across four files, zero
store ops, because `AUDIT_OPS` is a closed vocabulary and `src/rules/` may not
import `src/core/` (`delivered.ts:18-33`). Both halves of that argument hold and
I would not widen `AUDIT_OPS`.

What is actually wrong is downstream: **nothing reads the file.** No CLI
command, no MCP tool, no `doctor` check, no UI screen — the only non-test
importers of `DELIVERED_DIR` are `scripts/migrate-rules.ts:68` (for an unrelated
path) and the module itself. Spec §8.2 promises *"a count instead of a
promise"*, and the count is unreachable without `jq`.

Here is the count, which took one join to produce and which nobody has seen:

| | rows |
|---|---|
| total rows in the live log | 269 |
| written by the **test suite** into the owner's workspace | **157 (58%)** |
| real rows (session `595db3b1…`) | 112 |
| — `delivered` at `subagent-start` | 105 |
| — `delivered` at `compact-restore` | 2 |
| — `delivered` at `session-start` | **0** |
| — `missed` at `subagent-start` | 4 |
| — `missed` at `session-start` | 1 |

Joined against the audit log by agent id, from 2026-09-11T10:00 (after the store
stabilised at 12 entries): **83 completed corpus injections at the subagent
door, 81 store delivery rows, 1 real miss — and the assertion caught that one
and wrote its `missed` row.** The mechanism works. The earlier apparent gap is
the store's own immaturity (1 → 9 → 12 entries), not loss; I checked before
claiming otherwise.

Two things the record does say, and nobody is listening:

- **The `session-start` door has never once delivered successfully.** Zero
  `delivered:session-start` rows in the log's whole life, one `missed` row
  (2026-09-11T00:42, *"1 constant(s) would have applied"*). The audit log agrees
  — zero `session-start` ops in the same window. This owner has run one long
  session, so the door has genuinely not been exercised since the store shipped;
  its delivery path is **unproven in production**, and the only evidence about it
  on disk is a miss.
- **`entries` counts track the store's growth exactly** (1 → 9 → 12), which is
  the cheap continuous proof that the tier filter is working at the door. That
  is worth something and nothing surfaces it.

**Cost to record properly, and what it is worth.** The record already exists and
already costs a `readFileSync` per assertion. What is missing is ~40 lines: a
`mycontext rules delivered [--json]` subcommand (or a `doctor` code) that reads
the file and prints doors, deliveries, misses and the miss rate. With that,
*"did it arrive"* becomes a one-command answer instead of an unanswerable one,
and the two facts above surface on their own. **Medium · small.**

**(b) "A correction arrives stapled to a full copy of the store it corrects."**
Recorded accurately and **already settled correctly.** `renderCorrection`,
`correctionAtDoor` and `SESSION_SCOPE_DOORS` (`deliver.ts:585-724`) are called
by **nothing** in `src/` — verified by grep across the whole tree; the only
callers are `test/rules/update-correction.test.ts`. The 8,472-against-23,772
figure describes what *would* happen if the correction were wired to a door, and
the owner's 2026-09-11 ruling is that it never will be. The source comment's
*"that is the second copy §12.3's own second bullet forbids"* is describing the
reason the code has no caller, not describing a shipped defect.

**Judgement: not a defect, and I would change nothing.** The reasoning at
`deliver.ts:470-517` is the strongest piece of argued design in the store — it
prices three alternatives, gives measured numbers for each, and rejects the
cheap one (`planPublish`'s checksum diff) on correctness rather than cost. The
one thing I would add is a single line in `deliver.ts`'s module header saying
"three exports below have no caller and that is the end state", because the
argument currently lives 470 lines down, and `TASK-the-maintenance-tool-crud…`
already had to write *"a later session must not 'finish' it"* — which is what
you write after somebody nearly did. **Low · one line.**

### S4 · The test suite writes into the owner's live delivery record · MEDIUM · small

`test/rules/lane-still-gets-the-no-git-rule.test.ts:107` and `:131` call
`deliverAtDoor({ stateRoot: PROJECT_ROOT, … })`, where `PROJECT_ROOT` is the
**real** `.my_context`. Each `npm test` appends three rows under keys `test::…`,
`lane-still-gets-the-no-git-rule::proof` and `eyeball::x`.

**Consequence.** 157 of 269 rows — 58% — are synthetic. The one number spec §8.2
asks this file to produce (misses over deliveries) cannot be computed from it
without knowing which session ids are real. The rows also carry
`entries: 1` and `entries: 9` values that no real door ever produced at those
times, so the growth signal is corrupted too. Every other test in the suite
builds a temp workspace; this one does not, because the assertion it makes is
*"this repository recognises itself as my_context"*, which needs the real path.

**Recommendation.** Keep the real `workspaceIsMyContext(PROJECT_ROOT)`
assertion, which is the valuable one, and give the two `deliverAtDoor` calls a
`stateRoot` in a temp directory — the assertions are on `delivered.entries` and
`delivered.text`, neither of which depends on where the row is written.
Alternatively `recordDelivery` could refuse a key it can tell is synthetic, but
that is a second rule to keep; the test change is one line each.

### S5 · `MYCONTEXT_RULES_DIR` steers the doors and is ignored by `mycontext rules` · MEDIUM · small

`src/rules/deliver.ts:419` (`resolveStoreDir`) reads the variable;
`src/cli/commands/rules.ts:80`, `:136` and `:220-221` call `entriesDir()`
unconditionally. `DoorContext.storeDir`'s own comment
(`deliver.ts:362`) says *"Overridden only by tests and by `mycontext rules`"* —
`mycontext rules` never overrides it and never has.

**Consequence.** With the variable set, every door delivers directory X while
`rules list` prints the package's entries and `rules verify` verifies the
package's manifest. `missedDoorLine` (`delivered.ts:280`) tells the reader to
*"Run `mycontext rules list` to read them, and `mycontext rules verify` if you
suspect the store itself"* — both of which then answer about a store the reader
is not holding. The substituted-store disclosure (`substitutedStoreLine`,
`deliver.ts:341`) is also suppressed when the substituted store renders nothing,
which is exactly the empty-store sandbox case.

**Recommendation.** Route all three subcommands through the same
`resolveStoreDir`, and print the resolved directory unconditionally (`verify`
already does). Fix the stale comment in the same edit.

### S6 · The store has a version and a changelog, and no shipped surface prints them · MEDIUM · small

`manifest.json` carries `store.version: 5`, `publishedAt`, and five changelog
rows. The only readers are `src/ui/maintenance/router.ts:205` and
`screens/publish.ts:31` — and `package.json:12` excludes `!src/ui/maintenance/`
from the published package. So in a real install **nothing can answer "which
store version do I have"** or "what changed in it". `rules verify` says
*"intact"* without saying intact *as of what*.

Spec §12.1's whole point is that *"a store update is an artifact a user's
install can take on its own"*; an artifact whose version is invisible cannot be
taken knowingly.

**Recommendation.** One line in `cmdRulesVerify` and one field in its `--json`:
`store version 5, published 2026-09-11`. A `rules changelog` subcommand is the
larger version and is not needed yet.

### S7 · The changelog cannot reconstruct the store · LOW · small

Replaying `manifest.json`'s changelog from empty yields 11 entries; the store
has 12. `numbered-options-on-a-question-put-to-the-owner` appears in v1 under
**`changed`** and in no `added` list, ever. It was seeded alongside the eight
definitions and mis-filed at publish.

**Consequence.** The changelog is the mechanism §12.1 names for how an install
learns what moved, and it disagrees with the store by one entry. Anyone writing
the "apply store update" path later will find the arithmetic does not close.

**Recommendation.** A one-row correction at the next publish, plus a test that
replays the changelog and asserts the result equals `entries`. That test is the
durable half.

### S8 · The two integrity questions are asked by two commands, neither of which mentions the other · LOW · small

`rules verify` reads only the manifest (`rules.ts:228`); `rules list` reads only
the parser (`rules.ts:80`). `writeManifest` deliberately gives a row to a file
too broken to parse (`manifest.ts:152-155`), so a store can be **checksum-intact
and unloadable** and `verify` will say *"the rule store is intact — every entry
matches the checksum that shipped with it."*

**Recommendation.** Have `verify` also load, and report refusals beside
problems. Two lines; it closes the one gap the module's own comment admits.

### S9 · The delivered block does not say which tier an entry is · LOW · one line

`renderEntry` (`deliver.ts:196`) prints `` `id` · kind `` and nothing else;
`mycontext rules show` prints `id · kind · tier`. So the surface where tier
*matters* — the one a stranger's agent reads — is the one that omits it, and the
developer-only surface has it. In this repository a model holding twelve
constants cannot tell which one also governs its users.

**What is genuinely good here.**

- **The isolation argument is real and is enforced.** `src/rules/` imports
  exactly one thing from `src/core/` (the frontmatter parser), and
  `test/rules/isolation.test.ts` walks the import graph in both directions. The
  refusal to reach for `recordAudit` (`delivered.ts:26-33`) costs the store an
  audit trail and is still the right call — the reasoning names the cost.
- **`TIERS_THAT_DISCLOSE_PROVENANCE` as an allow-list is correct**, and so is
  `SESSION_SCOPE_DOORS`. Both carry the argument for the shape
  (`deliver.ts:170-177`, `:570-581`): `!== 'product'` admits the next tier
  somebody adds while thinking about something else. This is the *opposite* of
  the default-harmless pattern that damages the gates, and it is the same author
  making the choice. The tier filter itself is proven against the same directory
  loaded twice (`store.test.ts:75-76`), which proves the filter and not the field.
- **`parseEntry` never throws and never returns a partial entry**
  (`schema.ts:246`), and `loadRules` names every file it could not read rather
  than shipping a silent subset — including refusals it deliberately does *not*
  tier-filter (`store.ts:78-80`), because a file too broken to load may have an
  unreadable tier. That reasoning is exactly right.
- **`TEMPLATE` is genuinely the only place a part is named.** `renderEntry`
  walks `partsOf(kind)`; there is no literal `'why'` or `'trigger'` in
  `deliver.ts`. A kind that gains a part gains a rendered line with no edit.
- **The refusals teach.** `parseCheck` (`schema.ts:207`) explains *preventive
  vs detective vs none* in the refusal text; the stray-field refusal guesses the
  kind the entry was probably meant to be (`schema.ts:321`); the duplicate-id
  refusal names both files. `movedOn` without `movedFrom` is refused as "a date
  about nothing" — a field nothing would ever print, caught at parse.
- **Line endings are normalised before hashing** (`manifest.ts:127`), so a
  Windows clone's first `rules verify` does not say "your rules have been
  tampered with". That is the difference between a check people run and one they
  turn off.
- **`restoreEntries` copies the package's manifest rather than regenerating it**
  (`manifest.ts:393-400`), so a restore cannot end by certifying the planted file
  it just declined to delete. That is a subtle trap, seen and closed.

---

# 2 · The CLI surface

48 registered commands (41 in `src/cli/commands/`, 7 in `src/cli/index.ts`).
Flag specs centralised in `src/core/command-flags.ts` and enforced by one
`refuseUnknownFlag`.

### C1 · `<command> --help` is a failure · HIGH · one line

`src/cli/index.ts:1617` handles `--help` only when it is the *command*. Every
command then hits `refuseUnknownFlag` (`format.ts:467`) and returns 1. Observed
on 38 commands; all printed their correct, complete usage block behind
`my_context: unknown option "--help".` and exited 1.

**Consequence.** `mycontext status --help` under `set -e` kills the script. A
wrapper, a Makefile, a `command -v`-style probe, or any agent checking exit
codes reads the tool's own documentation as an error. Bare `mycontext` also
exits 1 while `mycontext --help` exits 0 printing byte-identical output — same
bytes, two codes.

**Recommendation.** Intercept `--help`/`-h` in `runCli` before dispatch and
print the command's `USAGE`, exit 0. The per-command `USAGE` constants are
already accurate and complete (verified on 26 of them); nothing new has to be
written.

### C2 · `edit --distinct` and `edit --supersedes` are documented nowhere · MEDIUM · small

Accepted at `src/core/edit-flags.ts:75` and `:84`; parsed and honoured at
`src/cli/commands/edit.ts:1122-1125`; absent from `USAGE`
(`edit.ts:90-97`), absent from the banner (`edit.ts:1157`), absent from
`mycontext edit --help` (confirmed: zero matches for `--distinct`).

**Consequence.** These are the *answers to the contradiction gate* — the two
flags a user reaches for precisely when the tool has just refused them. The
refusal that raises the gate names ids; it does not name the flag that settles
them, and no help text does either. The user's only route is the MCP tool's
description or the source.

**Recommendation.** Add both to `EDIT_USAGE` with the one-sentence framing the
MCP schema already uses (*"answer the contradiction gate"*).

### C3 · The `--help` banner under-states 19 commands' flags, and over-states 6 · MEDIUM · medium

Mechanically diffed `COMMAND_FLAGS`/`SUBCOMMAND_FLAGS` against every
`CommandDef.usage`: **23 of 41 registered commands accept flags their banner
line never mentions; 0 advertise a flag they do not accept.** The direction is
the safe one. The worst cases: `audit` omits twelve (`--until --session --kind
--origin --role --items --sessions --files` plus all four detail flags),
`restore` omits ten, `review` omits every flag of every subcommand.

The inverse error is smaller but sharper: six commands advertise a
**subcommand-scoped** flag at command level, so the banner promises something
that is refused. Observed, all exit 1 with `unknown option`:
`rules list --restore`, `session carry --json`, `session name --json`,
`conversation subagents --full`, `review revisions --type task`,
`procedure list --yes`.

**Recommendation.** `add` already solves this: `ADD_FLAG_SUMMARY` is *derived*
from `ADD_USAGE` (`index.ts:506-521`) because the hand-kept copy had already
drifted. Apply the same derivation to `CommandDef.usage` — or, cheaper, make the
banner print only positionals and a `[flags]` marker, and let `--help` (once C1
is fixed) carry the truth.

### C4 · Nothing is ever written to stderr · MEDIUM · small

`src/cli/index.ts:1698` binds the injected `Emit` to `console.log`, and every
command emits through it. Confirmed: `node src/cli/index.ts bogus 2>&1 1>/dev/null`
produces nothing but Node's own warning.

**Consequence.** Diagnostics and data share one stream. `mycontext show X --json
> out.json` on a miss writes `my_context: no item with id "X".` into `out.json`.
`mycontext list 2>/dev/null` suppresses nothing, including the load-error lines
that `emitLoadErrors` prints at exit 0. A script can only separate the two by
checking `$?` first — which is correct behaviour and is documented nowhere.

Measured across eleven commands: `show --json`, `list <bad category> --json` and
`search --json` (no filter) all emit **prose to stdout with exit 1** while
`help cli`'s flag table says `--json` means *"One JSON document instead of a
table, for a program to read."*

**Recommendation.** Either route refusals to stderr (the conventional fix, and
it makes `2>/dev/null` mean what people expect), or — smaller and equally
honest — emit `{"error": "...", "exitCode": 1}` on the `--json` path and say in
`help cli` that `--json` is parseable only when the exit code is 0. The second
is one helper and touches no command's prose.

### C5 · "Nothing found" exits 0 in six commands and 1 in three · MEDIUM · small

Query-shaped commands exit 0 on empty (`search.ts:253`, `todo.ts:284`,
`ready.ts:404`, `audit.ts:349`, `query.ts:501`, and `focus/carry --show`,
`pack list`, `review list`, `ingest-status`, `restore --show` — all observed
exit 0). Target-shaped commands exit 1 (`show` `index.ts:1458`, `rules show`
`rules.ts:143`, `lesson.ts:220`).

That split is defensible and I would keep it. Two things break it:

- **`rules list` exits 1 because a *file* was unreadable** (`rules.ts:126`,
  `:91`) while the equivalent condition elsewhere — an unparseable corpus item —
  is a warning at exit 0 (`src/cli/commands/context.ts:15-17,56-63`). Same class
  of damage, opposite codes, in the same binary.
- **The contract is written down nowhere.** `help cli` documents flags in a
  generated table and says nothing about exit codes, and only `status --json`
  carries an `exitCode` field.

**Recommendation.** Add an "exit codes" paragraph to `help cli` stating the two
rules and the load-error exception. That is where a script author looks, and it
costs nothing to keep true.

### C6 · There is no way to ask the CLI its version outside a workspace · LOW · one line

There is no `--version` and no `-v` (both → `unknown command`, exit 1). The
decision is argued at `src/cli/commands/status.ts:243-245`: the version is a
field of `status --json`, *"rather than a `--version` flag, which would be a
twelfth surface to document and refuse flags on"*. The argument is reasonable
and assumes `status` is reachable. It is not: run outside a workspace,
`status --json` prints `my_context: no workspace here.` and exits 1 —
**observed**. So the first fact any bug report needs is unobtainable from a
fresh install until `mycontext init` has been run.

**Recommendation.** Either handle `--version`/`-v` in `runCli` beside `--help`
(three lines, and it needs no flag spec because it never reaches a command), or
make `status --json` emit `{version, …}` with a `noWorkspace: true` field
instead of refusing.

### C7 · Refusals that do not name what would unblock them · LOW · small

Against this repo's own `RULE-a-refusal-states-its-unblocking-condition`
(cited in `query.ts:284`), compliance is high. The misses:

- `src/cli/commands/review.ts:1067-1071` — *"belongs to the global layer and
  cannot be promoted or discarded from this project"*, then points at a help
  **topic**, not an action. `init`'s `--global` refusal (`index.ts:178-182`)
  spells out the whole manual procedure for the same constraint; that is the
  standard.
- `src/cli/commands/lesson.ts:118` — names the constraint, no next move.
- `src/cli/commands/lesson.ts:483` — no route, while its sibling at `:479` gives
  one.
- `src/cli/commands/ingest.ts:94` — says where it looked, not that `ingest`
  takes a file rather than a directory.
- `query`'s SQL error (`query.ts:518`) passes SQLite's `no such table: nope`
  straight through without naming the tables that do exist — observed.

### C8 · One concept, several spellings · LOW · medium

Concrete pairs, all verified in `src/core/command-flags.ts`:

- **"remove this" has six spellings**: `--clear` (`carry`, `focus`, `ack`,
  `conversation name`), `--off` (`conversation persist`), `--none`
  (`session carry`), `--drop` (`conversation anchor`), `--discard` (`restore`),
  `--unset` (`config`). Three of those are session-shaped state.
- **"category" has four**: `--type` (`search`, `export`, `review list`),
  `--category` (`focus`), `--to` (`inbox-promote`), bare positional (`list`,
  `add`, `examples`). `focus --category` against `search --type` is the sharpest
  pair — same act, same shape of command.
- **"draft" and "candidate" are one concept**, and `ingest.ts:387` uses both in
  one sentence: *"apply extracted candidates as drafts"*. `draft` is also a real
  `status` enum value, so `candidate` is the one to retire.
- **`--all` means "widen the listing"** in `decay`/`todo` and **"switch to bulk
  mode"** in `ack`/`review promote`.
- `--dry-run` (`export`, `pack import`) against `--preview` (`focus`);
  `--anyway` / `--force` / `--overwrite-changed` for one idea.

**Recommendation.** None of these is worth a breaking rename on its own. What is
worth doing is adding the *synonyms* — `--clear` accepted wherever `--off` and
`--none` are, `--type` accepted wherever `--category` is — and picking one word
in prose. `command-flags.ts` is already the single table that makes that a
contained change.

### C9 · Every `mycontext` invocation prints a Node warning · LOW · small

`src/cli/index.ts:1` is a bare `#!/usr/bin/env node`, so every run emits
`(node:NNN) ExperimentalWarning: SQLite is an experimental feature…` to stderr.
Every *other* entry point in the project solved this: all eleven hooks in
`hooks/hooks.json`, `statusline-install.ts:99`, and `review/pass.ts:354` all
pass `--disable-warning=ExperimentalWarning`. The one entry point a person types
does not.

**Recommendation.** `#!/usr/bin/env -S node --disable-warning=ExperimentalWarning`
(npm's Windows shim parses shebang arguments; BSD and GNU `env` both support
`-S`), or a two-line `bin/mycontext.js` that re-execs. Worth confirming on macOS
before shipping.

**What is genuinely good here.**

- **The pipe problem is closed structurally, and I could not break it.**
  `process.stdout.isTTY` appears **once** in all of `src/cli/`
  (`statusline.ts:881`, which is a status-line renderer, not a report);
  `process.stdout.columns` likewise. Width is the constant `OUTPUT_WIDTH = 100`
  with the argument written above it (`format.ts:65-82`: *"A width-adaptive
  layout produces different bytes when piped than when watched"*). Unicode is
  env-gated, not TTY-gated (`format.ts:55-63`). There is no colour, no spinner,
  and no `process.stdout.write` anywhere in `src/cli/` — everything goes through
  one injected `Emit`. `table()` pads and never cuts, and never elides
  (`format.ts:196-199`). Eight commands were run redirected and through `| cat`
  and compared: **byte-identical, every time, including a 121 KB `list`.** This
  is the one area I would change nothing.
- **Every cap is disclosed.** `contribution` prints "(N shown) … `--full` for
  all N"; `search` prints "N match; M shown. Raise the cap with `--limit`";
  `query` says when 1000 fired; `audit` labels "(most recent 20)". Nothing
  truncates in silence.
- **`--json` carries load errors as a document field, never as a trailing text
  line** (`status.ts:229-237`, `doctor.ts:440`, `decay.ts:165`, `todo.ts:201`,
  `search.ts:212-228`), with `test/cli/json-load-errors.test.ts` holding it.
  That is precisely the discipline C4 asks to be extended to the refusal path.
- **One flag table, one refusal function.** `COMMAND_FLAGS` +
  `refuseUnknownFlag` means there is exactly one place a flag is declared and one
  place an unknown one is refused — which is why the *phantom-flag* direction of
  C3 is empty. `status --ful` produces a typo-aware refusal; `--full --summary`
  together produce "pass only one of".
- **The good refusals are very good.** `config.ts:199-206` (delete → disable,
  with the reason the delete would change nothing), `export.ts:162-166`
  (`--pack-name` without `--as-pack`), `review.ts:864-867` (*"Rerun with
  `--yes`, or run this from an interactive terminal"*), `repair.ts:174-178`
  (four concrete ways to settle a held item), `search`'s category refusal, which
  prints the full accepted list *and* the closest match.
- **`query` is genuinely safe**: SELECT-only with the rejected verb quoted back,
  a forbidden-keyword list, a 1000-row cap that announces itself, and a refusal
  that offers the double-quoting escape hatch only where it is the only route.

---

# 3 · The MCP surface

26 tools, listed from the live server. Total description budget 4,205 bytes —
tight, and the schemas are strict (`additionalProperties: false`, observed on
`get_item`).

**Confirmed by calling the server:** `initialize` (twice, one legacy and one
unsupported version), `tools/list`, `ping` with `id: 0`, a request with
`id: null`, `tools/call get_item` on a missing id, `tools/call doctor`, and
`resources/list`. Everything else below is read from source.

### M1 · No MCP path to the rule store · MEDIUM · medium

There is no `rules_verify`, `rules_list` or `rules_show` tool. `missedDoorLine`
(`delivered.ts:280`) — text written *for a model* — instructs it to *"Run
`mycontext rules list` to read them, and `mycontext rules verify` if you suspect
the store itself."* An agent whose Bash tool is denied cannot do either.

This is the largest CLI↔MCP gap that is not deliberate. The other absences all
are, and correctly: there is **no `promote`, `ack`, `pin`, `harden`, `config`,
`review promote` or `lesson-accept` tool**, because those are the approval
boundary and an agent must not cross it. `create_item`'s schema has no `status`
field at all (`tools.ts:608`), so a capture cannot arrive `active` by
construction rather than by validation — that is exactly right and should be
said out loud somewhere.

**Recommendation.** Add a read-only `rules_list` / `rules_show` pair (they are
thin wrappers over `loadRules`; `verify` can wait). Or, cheaper and arguably
better: have `missedDoorLine` not name a command the reader may not have.

### M2 · No tool carries annotations · MEDIUM · small

`ToolDefinition` (`protocol.ts:81-85`) is `{name, description, inputSchema}` and
nothing else; zero tools in the live `tools/list` carry an `annotations` block
(observed). MCP's `readOnlyHint` / `destructiveHint` / `idempotentHint` are how a
client decides what to auto-approve.

**Consequence.** A client cannot tell `get_item` from `supersede_item` without
parsing English. Users either approve everything or are prompted for reads. This
project has thought harder than most about which acts are approval-worthy —
`create_item` vs the absent `promote` is that thinking — and none of it is
machine-readable at the boundary.

**Recommendation.** Add `annotations: { readOnlyHint: true }` to the fourteen
readers and `destructiveHint: true` to `supersede_item`. The list already exists
implicitly in the SPECS table.

### M3 · The unsupported-version error is unreachable through `initialize` · LOW · small

`ERROR_UNSUPPORTED_VERSION` (-32022) and its `{supported, requested}` data are
defined at `protocol.ts:59` and raised only from `announcedVersion`, which reads
`params._meta` (`protocol.ts:126-131`). `initialize` carries its version in
`params.protocolVersion`, which that path never sees — so the switch at
`:186-190` falls through to `LATEST_PROTOCOL_VERSION`.

**Observed:** `initialize` with `protocolVersion: "2099-01-01"` returns
`protocolVersion: "2026-07-28"` and no error — the server tells a client it
speaks a revision the client never asked for.

That is spec-conformant (a server may answer with a version it does support),
so this is a **comment** defect more than a behaviour one: the module header at
`protocol.ts:6-12` claims *"the unsupported-version fallback to
LATEST_PROTOCOL_VERSION is unreachable"*, and it is in fact the only reachable
branch for the standard handshake.

**Recommendation.** Fix the comment to say which branch is which, and consider
answering the *oldest* supported version rather than the newest to an
unrecognised request — understating is the safe direction, which is the
reasoning `ASSUMED_VERSION` already applies two lines above.

### M4 · A request with `id: null` gets no response, ever · LOW · one line

`protocol.ts:158` — `const isNotification = message.id === undefined ||
message.id === null`. **Observed:** `{"jsonrpc":"2.0","id":null,"method":"tools/list"}`
produced no reply at all. JSON-RPC 2.0 permits `null` as a request id (it
discourages it, and the spec's own error examples use it). A client that spells
its first id that way hangs; `serveStdio` has no timeout and no `error` handler
on either stream.

Also minor and in the same file: `initialize` advertises
`capabilities: { tools: { listChanged: false } }` while `server/discover`
(`:194`) advertises `capabilities: { tools: {} }` — two answers to one question.

**What is genuinely good here.**

- **`provenance.ts` is the best-argued file in the four surfaces.** It exists
  because a frozen MCP process reported *719 of 736 items* as checksum
  mismatches for an hour, and the footer now rides on **every successful
  result** rather than on a diagnostic tool — because *"the whole defect is that
  nobody was suspicious"*. It deliberately does **not** ride on thrown errors,
  and says why (a refusal is a message about the arguments, and stapling a
  provenance block to the shortest text on the surface would make it the
  longest). `splitProvenance` exists so the two readers who need the answer
  alone do not re-derive where it ends.
- **Wrong-typed arguments are refused, not ignored.** `optStr`/`optBool`/
  `optNum`/`optList`/`optEnum` (`tools.ts:88-120`) each refuse a present,
  non-null value of the wrong type, with the defect that motivated it recorded:
  `update_item({title: 12345})` used to return *"updated"* without touching the
  title. `null` is treated as absent throughout, deliberately, because that is
  how a model spells "not set".
- **A tool that refuses its input returns `isError: true` in a *result*, not a
  protocol error** (`protocol.ts:148-152`), because only result content reaches
  the model and the teaching message is the whole point. Observed working on
  `get_item("nope")`.
- **Truncation is disclosed everywhere.** `listOf` (`tools.ts:317`) appends
  `"… N more. Narrow the filter or raise \"limit\"."`; `ready` and `list_todos`
  print "N shown" with the remedy; `list_drafts` appends the pending-revision
  notice **even to the empty answer**, because it once told an agent *"no drafts
  are waiting for review"* in a workspace with proposals waiting.
- **The schema is static on purpose** (`tools.ts:586-602`) so `tools/list` is
  byte-stable for prompt caching, and the cost — project-declared extra fields
  being unreachable through the flattened argument list — is stated in the
  comment rather than discovered later. The refusal happens at the argument
  gate, by name, so nothing is silently dropped.
- **`create_item.steps` is `S_STRING`, not an object** (`tools.ts:650-660`), so
  *"nothing in this product ever writes `checked: true`"* holds by construction
  at the boundary. A model that never sees the field cannot invent a done flag.
- **`SERVER_INFO.version` is read from `package.json`** (`protocol.ts:47`) after
  a transcribed `'0.1.0'` shipped wrong through two releases. Confirmed live:
  `1.0.2`.
- `MAX_PENDING_LINE_LENGTH` guards both the slow-trickle and single-oversized-
  write cases, and `writeMessage` relies on `JSON.stringify` escaping newlines so
  the stdio framing cannot be broken by content.

---

# 4 · The gates

Ten npm gates, three unscripted checkers, `doctor`, and two UI tests.

### G1 · Five gates are wired to nothing, and the one that is red is a release-only gate · HIGH · small

| gate | CI | release | status today |
|---|---|---|---|
| `check:test-glob` | ✅ `ci.yml:69` | ✅ | 0 — 523 files reached |
| `check:basis` | ✅ `ci.yml:80` | ✅ | 0 |
| `check:retired` | ✅ `ci.yml:84` | ✅ | 0 |
| `check:text-files` | ✅ `ci.yml:85` | ✅ | 0 — 1,313 files, no NUL |
| `check:vendor` | ✅ `ci.yml:91` | ❌ | 0 |
| `check:needs-cycles` | ❌ | ❌ | 0 |
| `check:handover` | ❌ | ❌ | 0 |
| `check:dependencies` | ❌ | ❌ | 0 |
| `check:cited-items` | ❌ | ❌ | 0 |
| `verify:citations` | ❌ | ✅ `release.yml:63` | **1** |

There is **no pre-commit hook** — `.git/hooks/` holds only `.sample` files, and
`hooks/hooks.json` is the Claude Code plugin manifest, not git.

Three consequences, in order of sharpness:

- **Every release cut today fails**, at a gate no pull request runs.
  `verify:citations` reports `1223 doc citations: 581 ok, 577 moved, 2 broken` —
  the exit 1 comes from the 2 documentation breaks only.
- **`check:dependencies` guards `CONST-zero-runtime-dependencies`, the
  project's headline promise, and runs in neither workflow.** A dependency added
  in a PR is caught by `test/scripts/dependency-budget.test.ts` only to the
  extent that test exercises the real `package.json`.
- **`check:vendor` is in CI and not in release**, so a tagged build can publish
  a patched vendored asset that master would have rejected.

**Recommendation.** Add the four missing checks to `ci.yml`; add `check:vendor`
to `release.yml`; settle the two documentation citations and then add
`verify:citations` to CI too. All five are cheap (each ran in seconds).

### G2 · The default-harmless shape, beyond `isWriter` · HIGH · medium

`test/ui/no-writes.test.ts:550-551` is the canonical instance:

```ts
const isWriter = (module: string, symbol: string): boolean =>
  (WRITERS[module] ?? []).includes(symbol);
```

An unknown module yields `[]` → `false` → *"not a writer"*. The file records the
defect landing **four times by name** — `core/ui-server-record.ts` (2026-08-27),
`ui/execute-effect.ts`, `review/trigger.ts` (2026-09-10), `core/anchors.ts`
(2026-09-12) — each time fixed by adding a key, each time green beforehand. The
**keys** are now derived (`:1676-1702`), which closes half of it. The **symbol
lists are still hand-kept** (`:197-203`), so a module already in the table that
grows a new writing export is still answered "harmless"; and `WRITE_ROOTS =
['src']` (`:1397`) means a writer outside `src/` is never derived at all.

**The same shape, found in eleven other places.** Ranked by what an unlisted
input buys:

| file:line | the table | unknown input gets | what passes silently |
|---|---|---|---|
| `scripts/check-text-files.ts:38` | `EXTENSIONS` (9 extensions) | not scanned | a NUL in `.tsx`, `.jsonl`, `.txt`, `.svg`, `.sh`, `.toml`, `.mts` — the exact "file stops diffing" defect the gate exists for |
| `scripts/check-text-files.ts:37` | `DIRS` (8 roots) | not scanned | `.github/`, `.claude-plugin/`, `reports/`, and every root file including `README.md` and `package.json` |
| `scripts/check-text-files.ts:50` | `if (entry.name.startsWith('.')) continue` | skipped | `.claude-plugin/` is in `package.json:files` and **ships**, and is unscannable |
| `scripts/check-retired.ts:39` | `ROOTS` (3 doc roots) | unchecked | a retired phrase left standing in `reports/`, `README.md`, `docs/capabilities/` |
| `scripts/check-faint-usage.ts:87` | `SCANNED_FILES` (3 paths) | unscanned | any new stylesheet applying `--faint` to small text |
| `scripts/check-cited-items.ts:191`, `verify-citations.ts:350` | `SOURCE_ROOTS` + a `.ts/.js/.mjs/.cjs` extension test | unwalked | citations in `commands/`, `skills/`, `hooks/` |
| `src/core/config.ts:207-211` | `scopePolicyFor` | the permissive `DEFAULT_SCOPE_POLICY` | an item of an undeclared category gets the default policy instead of a refusal — and the sibling at `:216-219` takes the *other* answer, so the inconsistency is already known |
| `src/hooks/post-tool-use.ts:43` | `WRITING_TOOLS` (3 tools) | `nudgeFor` returns `''` | any other write route produces no watched-doc nudge; `NotebookEdit`'s exclusion is argued at `:37-42`, the open default is not |

`check-text-files.ts` deserves its own sentence, because its docblock
(`:24-30`) **already records** that `skills/` sat outside the gate for exactly
this reason and calls it a defect — and the fix was to add one entry rather than
to change the shape. This is the same lesson `isWriter` learned four times.

**Two counter-examples in the tree already show the right shape, and both were
written by the same hands:**

- `test/ui/no-writes.test.ts:1616-1624` fails on any `node:fs` name that is in
  neither the write nor the read set, with *"an unclassified API is read as
  harmless"* — and `:1626-1631` refuses `node:fs/promises` outright rather than
  answering "no writes".
- `scripts/check-dependency-budget.ts:157-165` fails on an unknown word with
  *"which this check does not know. Known: …"*.
- `scripts/check-cssom-restatement.ts:708-714` treats "parsed nothing" as a
  parse failure, not a pass: *"A checker that finds nothing agrees with a file
  that violates nothing."*

**Recommendation.** One rule, applied to the eight rows above: **a scanner
enumerates what it will skip, not what it will scan.** For `check-text-files.ts`
that means walking the repo minus `node_modules`/`.git` and refusing an unknown
*binary-looking* extension rather than allow-listing text ones — the same
inversion `no-writes.test.ts` already applied to `node:fs`. Where inversion is
genuinely impossible, an anti-vacuity floor (`assert(scanned > N)`) is the cheap
second-best, and `no-writes.test.ts:1666-1690` already has two.

### G3 · `mycontext doctor` — which codes earn their keep · HIGH (for the noise) · small

Run at `HEAD`: **1 error, 58 warnings, 48 notes across 107 findings**, of which
**102 are acknowledged**. Exit 1, driven by the single error
(`src/cli/commands/doctor.ts:276-278` — only `error`-level findings fail).

| code | n | level | verdict |
|---|---|---|---|
| `task_unverified` | 53 | warn | **Noise, and worst in a consumer repo** — see below |
| `body_disagrees_with_meta` | 23 | info | **Earns its keep.** Catches *"body shouts ANSWERED on an item still open"*. English-lexicon heuristic (`checks.ts:4254`, `:4265`), so it will mis-fire on non-English corpora — but every finding here was real |
| `contradiction_pair` | 6 | info | **Earns its keep.** The single most valuable check in the product: two governing items that disagree is the defect the whole corpus exists to prevent |
| `citation_form` | 5 | info | **Noise in a consumer repo.** It enforces *this project's* `file · fragment` convention on a stranger's prose. Highest false-positive risk of the eleven |
| `open_question_blocks` | 5 | info | Earns its keep — cheap, structural, no heuristic |
| `state_unaudited` | 7 | info | Earns its keep, and partitions cleanly with `task_unverified` |
| `reference_no_source` | 3 | warn | Earns its keep — structural |
| `source_drift` / `source_missing` | 2 / 1 | warn / error | **The most valuable codes here.** A snapshot whose source moved is a silent lie, and this is the only thing that sees it |
| `body_ends_unfinished` | 1 | info | Keep, but it is honest about being a heuristic that a clean truncation leaves no trace of |
| `tag_projection_unprojected` | 1 | info | Structural, cheap |

**The `task_unverified` problem is a product defect, not dogfooding residue.**
`VERIFIED_ON_INTRODUCED_AT = '2026-09-03T12:00:00.000Z'` (`checks.ts:2341`) is
this repository's own grandfather cutoff, hard-coded into shipped product code.
It was set with *"a five-hour margin ahead of every `TASK-*` create record
measured in this repository's own audit log on 2026-09-03"* — a fact about this
workspace. In a consumer install created today, **every** `state` write is after
it, so nothing is ever grandfathered and `task_unverified` fires on every closed
task forever. Here it produces 53 of 107 findings; there it produces one per
closed task, from the first one.

**Recommendation.** Derive the cutoff per workspace: the earliest `state` write
in *that* audit log, or the corpus' creation time, with the constant kept only
as a floor. Fifteen lines, and it turns the largest code from noise into signal.

Two smaller consumer-repo traps in the same file:

- `checks.ts:852` — `isServableDocPath` hard-codes `docs/` and `reports/`. A
  consumer whose docs live in `documentation/` or `adr/` gets
  `watched_doc_unserved` for a correct configuration.
- `checks.ts:3335` — `FIXTURE_DIRS = ['test','tests','fixtures','harness','.scratch','.demo-corpus']`
  for `nested_corpus`. A consumer using `__fixtures__`, `spec/` or `e2e/` gets
  their own test fixture reported as a real nested corpus. (Same allow-list
  shape as G2.)

And one failure message worth fixing: `checks.ts:4616-4622` — when a check
*throws*, the finding says `a doctor check threw: <message>` with **no code, no
check name and no item**, although the `checks[]` index is in scope. The one
finding that means "a gate is broken" is the only one that does not say which.

### G4 · `test/ui/sessions-pin.test.ts` — no masking, three brittle matchers · MEDIUM · small

Confirmed: all three scans run against raw `readFileSync(f, 'utf8')`, with no
comment or string masking anywhere in the file — in contrast with
`no-writes.test.ts`, which runs every scan over `src.masked` (`maskNonCode`) and
carries a dedicated guard that the masker did not over-blank (`:1642-1674`).

- **`:125`** — `MINTERS.some((name) => src.includes(name + '('))`. A commented-out
  call, a prose sentence, or `'startUiServer(…)'` inside an error-message fixture
  all count as minting. `runUi` is a generic enough identifier that an unrelated
  local helper would too. The file half-sees this at `:123-125` (*"A CALL, not a
  mention"*), but the guard only excludes a bare mention with no paren.
- **`:77`** — the import matcher accepts **single-quoted specifiers only**, so
  `import x from "../helpers/pin-sessions-dir.ts"` is invisible: the pin is not
  credited (false positive) and a double-quoted import of a minting helper is not
  followed (false negative). Latent today; two files in `test/` are close.
- **`:138`** — the pin check is a literal substring including the bracket, quote
  and `=`. `process.env.MYCONTEXT_UI_SESSIONS_DIR = …`, a double-quoted key, or
  two spaces before the `=` all fail to match and the file is reported an
  offender.
- **`:157-165`** — the offender message lists file paths with **no line
  numbers**, and prescribes an import fix that is wrong for the second shape the
  same test accepts (`:135-142`).

**Recommendation.** Reuse `maskNonCode` from `no-writes.test.ts` (it is already
written and already guarded), widen the import regex to both quote styles, and
match the pin with a regex rather than a literal. The anti-vacuity floor at
`:150-155` is already right and should stay.

### G5 · Five of ten checks print red and exit 0 · MEDIUM · small

Run today:

- `check:handover` — 218 pointers, 0 dangling, but *"4 naming retired work + 7
  carried instructions — **REPORTED, never gated**"*.
- `check:cited-items` — *"106 citations in 51 files name 23 retired items; 34
  read as a live ruling. **REPORTED, NEVER GATED. This run exits 0 and no flag
  changes that.**"*
- `check:basis` — 150 of 611 declare a basis, 461 exempt via
  `scripts/basis-undeclared.txt`, and **10 declarations name a retired item**,
  reported and not gated.
- `scripts/check-ask-numbering.ts:325-329` — *"Reporting is the whole job; a
  non-zero exit is not."*
- `verify:citations` — the 51 source failures need `--strict-source`; the **57
  corpus failures have no flag that gates them at all**.

Most of these have a written rationale and the rationale is sound — a gate that
fires on a legitimate historical citation is a gate people turn off. The two
that will rot unread are `check:basis`'s ten retired declarations and
`verify:citations`' 57 ungateable corpus citations, **because nothing runs either
of them** (G1). Report-only plus never-run equals not a gate.

**Recommendation.** Once G1 wires them into CI, give each a ratchet: a committed
count file, gated on *increase* only. That turns "reported, never gated" into
"cannot get worse", which is the only form these can take without a bulk
cleanup first.

### G6 · Failure messages without a location or a remedy · LOW · small

Most are excellent — `check-text-files.ts:82-88` names file, byte offset and the
exact escape; `check-retired.ts:118-122` names `doc:line`, the phrase and the
line; `check-needs-cycles.ts:262-287` prints every cycle member **and the
`mycontext edit` command to break it**. The gaps:

- `scripts/check-vendor.ts:290-291` — a bare problem string and a count, no line
  number and **no remediation sentence**. Every other checker ends with a repair
  instruction; this one, which fires on committed third-party code, does not.
- `src/doctor/checks.ts:743-746` — the `default:` branch of `deletingTheGlob`
  gives the reader advice derived from a policy the code did not recognise.
  Worse than no message: confidently wrong for an unknown policy. (Same shape as
  G2.)
- `scripts/check-cssom-restatement.ts:709-712` — names the stylesheet, gives no
  line and no next step.

**What is genuinely good here.**

- **`check:test-glob` is the best gate in the project**, and it runs *before*
  `npm test` in both workflows with the reason in a comment: *"a check that runs
  afterwards tells you the suite you already trusted was wrong"*. It caught an
  unquoted glob that ran 2 of 4 files and exited 0.
- **`check:basis` is a genuinely novel gate** — it holds every test to declaring
  what it rests on, and it *gates* (unlike its five report-only siblings),
  because one reversal reddened 26 fixtures across ten files and not one named
  the rule it encoded. `scripts/basis-undeclared.txt` is the right shape for the
  backlog: an explicit, shrinking, committed exemption list rather than a
  heuristic.
- **Every gate has a test that proves the gate** —
  `test/scripts/basis-gate.test.ts`, `cited-items.test.ts`,
  `handover-check.test.ts`, `dependency-budget.test.ts`, `vendor-gate.test.ts`,
  `e2e-gate.test.ts`. The one exception is `check:needs-cycles`, which has no
  test anywhere, and is also in neither workflow — the only gate in the project
  with no evidence behind it at all.
- **The CI workflow is itself argued.** Why `push` is scoped to master (a
  measured double-run, with both run ids), why tags are absent, why
  `cancel-in-progress` is `pull_request`-only, why the browser suite is ubuntu-
  only and after the cheap checks, why the temp sweep is 30 minutes and
  `myctx-*` only. This is a workflow file that will still be correct when
  somebody edits it.
- **`doctor`'s acknowledgement model is right.** 102 of 107 findings are
  acknowledged and **still reported and still counted** — *"acknowledging
  distinguishes a finding, it does not silence it."* That is the only
  acknowledgement design that does not decay into suppression.
- **The `check:text-files` story the brief mentions is real and is the right
  outcome**: the gate caught a literal NUL byte in the very chapter documenting
  the gate, because the chapter pasted the gate's own output. A gate that fires
  on its own documentation is a gate that is actually reading.

---

## What I could not assess, and why

- **Whether the plugin's hooks deliver correctly under a live `claude` session.**
  Every finding about the doors is derived from source plus the delivery record
  and the audit log on disk. I did not start a session, and the record cannot
  distinguish "the hook did not run" from "the hook ran and could not write" —
  `deliverAtDoor`'s `recorded` flag is returned and **dropped by both callers**
  (`session-start.ts:130`, `subagent-start.ts:316`), which a sibling review
  already filed as M2 on 2026-09-12. That is why S3's session-start finding says
  *unproven*, not *broken*.
- **Whether the MCP server behaves correctly under Claude Code specifically.**
  The configured server was disconnected all session. I drove
  `node src/mcp/server.ts` over stdio myself and the seven calls above behaved as
  the source says, but `resolveServerCwd`'s own comment
  (`src/mcp/server.ts:6-13`) records that `CLAUDE_PROJECT_DIR` has never been
  confirmed for this server by a live session, and I could not confirm it either.
  Every MCP tool that writes was left uncalled.
- **Whether the five unrun gates would pass in CI.** I ran each locally and
  recorded the exit codes above, but on Windows only; `check:text-files`,
  `check:vendor` and `verify:citations` all walk paths, and ubuntu could differ.
- **The full test suite.** Not run — three lanes were live. So I cannot say
  whether the paired `test/scripts/*.test.ts` files exercise their checkers
  against the *real* tree or only against fixtures, which is the difference
  between G1's four unrun gates being unenforced and merely unwired. That is the
  one question in this report I would want answered before acting on G1, and it
  is answerable by reading four test files.
- **Consumer-repo behaviour end to end.** I rendered the product-tier delivery
  by calling `loadRules(entriesDir(), false)` directly and read the tier filter's
  code path, but I did not `mycontext init` a throwaway workspace and drive a
  door through it. S1 and G3's consumer findings are therefore source-and-render
  derived, not observed in a stranger's install.
- **`src/ui/` beyond the two named tests**, `src/ingest/`, `src/pack/`,
  `src/review/`, `src/lesson/` and `src/core/` except where a finding reached
  into them. Out of scope by the brief.
