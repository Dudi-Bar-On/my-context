# Versioning

`mycontext` follows [Semantic Versioning 2.0.0](https://semver.org/). Convention answers
`PATCH` and `MINOR` well enough. It does not answer what a **major** bump means for *this*
product, because "the public API" of a Claude Code plugin is not an API — so that part is
decided here rather than left to be re-argued at each release.

## What the compatibility surface actually is

Four things a user or an agent can depend on, and would notice breaking:

1. **The corpus on disk.** `.my_context/items/**/*.md` — the frontmatter fields, the ids,
   the checksum. This is the part the user owns, keeps in their repository, reviews in a
   diff and cannot regenerate. It is the most load-bearing surface here by a wide margin.
2. **The configuration format.** `.my_context/config.json` — `profile`, `categories.<name>`
   (`enabled`, `tier`), `budgets`, `watchedDocs`, and the fact that configuration
   *replaces* rather than merges.
3. **What comes back, and when.** The four injection tiers — pinned, just-in-time, restored
   after compaction, and the index — and which items land in each, given an unchanged
   corpus and an unchanged config.
4. **The three invocation surfaces.** The CLI (command names, flags, exit codes, and the
   `--json` documents, which exist to be piped), the slash commands, and the MCP tools with
   their closed argument lists.

And two things that are deliberately **not** a compatibility surface:

- **The SQLite index**, `.my_context/index.db`. It is *derived*: the Markdown is the source
  of truth and `mycontext rebuild` reconstructs the index from it. `Store.open` already
  migrates a `schema_version` 1 database to 2 in place, and a future migration is the same
  kind of event — no data is at risk, nothing the user wrote is lost, and nothing they do
  changes. **A change to the index schema is not a breaking change.** This is the single
  most useful consequence of "Markdown is the source of truth", and it is why the bar for
  `MAJOR` here is higher than it would be for a tool whose database *was* the data.
- **The module layout under `src/`.** Nothing imports this as a library; `package.json`
  exposes one `bin`. Moving a function between files is not a version event.

## What each bump means

### MAJOR — an existing installation stops working the way it did, and the user must act

Any one of these:

- **A corpus written by the previous version can no longer be read, rebuilt or injected
  without a manual step.** A frontmatter field removed, renamed, or given a new meaning; a
  change to how the checksum is computed that makes existing items report drift; an id
  scheme change that breaks recorded relations.
- **A configuration key changes meaning or is removed.** The test is whether an *unchanged*
  `config.json` produces different behaviour. Adding a key with a backward-compatible
  default does not.
- **A category is removed, or moved between tiers.** Retiering is the quiet one and belongs
  here explicitly: moving a category from `rationale` to `normative` puts items that were
  merely informational under a governing header and into the pinned and just-in-time
  budgets; moving one the other way silently stops items governing that were governing
  yesterday. The user's config file did not change. What governs their project did.
- **A command, slash command, MCP tool or flag is removed, or its meaning changes.** So is
  a field removed from — or re-meaned inside — a `--json` document, and so is a change to a
  documented exit-code contract. `status` exiting non-zero on a corpus load error and on
  nothing else is a contract a CI pipeline can be gating on.

### MINOR — new capability, nothing existing changes

A new command, tool, flag, category or config key with a backward-compatible default. A new
report or detail level. An index schema migration that `Store.open` performs on open. New
injection behaviour that an existing config does not switch on.

### PATCH — the program is made to do what it already said it did

Bug fixes, including security fixes that close a bypass. Closing a hole is a `PATCH` even
though behaviour changes, because the old behaviour was never the contract.

**The honest edge:** a `PATCH` here can still change what a session sees. Fixing a selector
that silently dropped an eligible item means more items are now injected; fixing a flag that
was accepted and ignored means a script that passed it now gets a refusal. Those are
correct, and they are still a surprise on a Tuesday. Anything in that class is called out in
`CHANGELOG.md` under **Fixed** with what changes in practice — a version number cannot carry
that, so the changelog has to.

## How 1.0 was reached

**The first tagged version is `0.9.0`, cut 2026-08-16; `1.0.0` followed on 2026-08-17.**
Nothing has been published to a registry; the tag is the release.

`0.9.0` rather than `0.1.0` because of what the four phases before it closed: the trust hole
an agent could reach with no shell, nineteen false statements in the project's own
documentation, the category vocabulary, and the gap between what the model can do through a
tool and what a person can do through a command. `0.9.0` rather than `1.0.0` because three
things listed above as unbuilt were still unbuilt: Linux certification, session focus, and
the audit log.

**All three landed, which is what `1.0.0` records.** Session focus and the audit log
shipped; Linux was certified on 2026-08-16 by run `31965803312`, green on both matrix jobs,
with the result recorded per-claim in `docs/ROADMAP.md` row E1. From `1.0.0` the four
surfaces above are frozen under the rules in this document rather than "applied one column
to the right" — `0.x` promises nothing, and this project has stopped being `0.x`.

Twelve MCP tools, 28 CLI commands, 64 slash commands, four injection tiers and a documented
trust boundary was not a sketch at `0.9.0`; it was a product one release short of promising
not to move. It has now made that promise.

## Where the version lives

**`package.json` owns it.** It is the file `npm version` mutates, the one the runtime can
read without knowing anything about plugin packaging, and the one that already carries the
project's identity (`name`, `bin`).

Three other files repeat the number, because their readers cannot read `package.json`:

| File | Read by | Site |
|---|---|---|
| `package.json` | npm, `src/core/version.ts` | **owner** |
| `.claude-plugin/plugin.json` | Claude Code, at plugin load | `version` |
| `.claude-plugin/marketplace.json` | `claude plugin install` / `marketplace add` | `version` **and** `plugins[0].version` — `claude plugin tag` refuses a release where those two disagree |

`src/core/version.ts` reads `package.json` at module load and exports `VERSION`; nothing
transcribes a version into a `.ts` file, because that would be a fourth place to forget.
`mycontext status` prints it on its headline at every detail level, and carries it as the
first field of `--json`.

## Cutting a release

Five steps. Only the first and the last need a human judgement.

1. **`CHANGELOG.md`** — close `## [Unreleased]` as `## [X.Y.Z] - YYYY-MM-DD` and open a
   fresh empty `## [Unreleased]` above it. Deciding what `X.Y.Z` *is* — reading the entries
   against the table above — is the judgement this whole document exists to support.
2. **`node scripts/set-version.ts X.Y.Z`** — writes all four version sites and prints what
   it changed. It refuses a string that is not `MAJOR.MINOR.PATCH`, and refuses to run at
   all if a manifest's shape has changed under it rather than writing to the wrong place.
3. **`npm run gen:docs`** — the documented `mycontext status` examples in `README.md` and
   `docs/README.he.md` print the version, so they are stale the moment step 2 runs. Never
   hand-edit a generated block.
4. **`npm test && npx tsc --noEmit && claude plugin validate --strict .`**
5. **Commit, then `git tag vX.Y.Z`.**

### What fails loudly when a step is skipped

A test that merely asserts the four version fields agree would catch a half-finished step 2
and nothing else. Each step has a failure of its own:

| Skipped | What fails |
|---|---|
| 1 | `test/release.test.ts` — `CHANGELOG.md` has no section accounting for the version in `package.json` |
| 2, partly | `test/release.test.ts` — names the manifest that disagrees with `package.json`, in that direction |
| 2, by hand into a manifest whose shape moved | `scripts/set-version.ts` exits 1 rather than writing to the wrong line |
| 3 | `test/docs/examples.test.ts` — the documented `status` output no longer matches what the command prints, with the exact text to paste |
| 4 | — |
| 5 | Nothing. A tag is outside anything this repository can check, which is why it is last and why it is a human's. |

While a version is in preparation and not yet released, the changelog's top section declares
which version it is for, as `## [Unreleased] — X.Y.Z when tagged`. That line is what step 1's
check reads, and it is why bumping `package.json` without touching the changelog fails.
