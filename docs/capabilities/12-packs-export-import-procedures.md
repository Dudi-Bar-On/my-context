# Packs, export/import, procedures, runbooks, tutorials, the skills

Five capabilities share this chapter because they are all about moving normative
knowledge across a boundary — out of this workspace to another one (packs,
export), out of the ongoing/repeatable distinction inside one workspace
(procedures vs. runbooks), or out to a person learning the tool (tutorials,
skills).

## Packs

**What it is.** A pack is a portable artefact — a directory or a ZIP file —
holding a subset (or all) of a corpus's items, plus enough of `config.json` and
`history.jsonl` to make sense of them, and a `manifest.json` that names every
file it contains with a byte count and a SHA-256 hash. It travels the way any
file travels: someone hands it to you, or you clone a repo that has one at some
path. There is no registry and no network fetch on any code path — `docs/TEMPLATES.md`
says this outright: *"This product makes no network request at all, on any code
path. A pack reaches you the way any other file does."*

**Why it exists.** Normative knowledge captured in one project — "money is an
integer of minor units," "card numbers never reach application logs" — is
often true of a whole class of projects, not just the one it was written in.
A pack is how that knowledge moves without the receiving project silently
trusting it: everything a pack brings in lands as a **draft** and governs
nothing until a person promotes it (same draft/promote pipeline as any other
agent-authored capture, chapter 3, [`./03-creation-and-gates.md`](./03-creation-and-gates.md)).

**How to use it.**
```
mycontext pack import <path> [--name <text>] [--dry-run] [--json] [--yes] [--overwrite-changed]
mycontext pack list [--json]
mycontext init --pack <path>            # found a whole new workspace from one
mycontext export --out <path> --as-pack --pack-name <name> --pack-version <text>
```

**Worked example — a real pack, read from disk.** This repository ships a
demo pack at `.demo-pack/`, not invented for this document:

```
$ node src/cli/index.ts pack list
my_context: no packs have been imported into this workspace. `mycontext pack import <path>` reads
one, and `mycontext export --as-pack` writes one.
```

`.demo-pack/manifest.json` (real file, 4 items, protocol `my_context/pack@1`):
```json
{
  "protocol": "my_context/pack@1",
  "kind": "pack",
  "name": "billing-starter",
  "version": "1.0.0",
  "generator": "mycontext 1.0.2",
  "itemCount": 4,
  "files": [
    { "path": "config.json", "bytes": 433, "sha256": "b751a42b…" },
    { "path": "history.jsonl", "bytes": 695, "sha256": "de3fba97…" },
    { "path": "items/constraint/CONST-card-numbers-never-reach-application-logs.md", "bytes": 528, "sha256": "4c646ea4…" },
    { "path": "items/glossary/GLOSS-capture.md", "bytes": 416, "sha256": "32696584…" },
    { "path": "items/invariant/INV-a-refund-never-exceeds-the-captured-amount.md", "bytes": 468, "sha256": "33e83672…" },
    { "path": "items/rule/RULE-money-is-an-integer-of-minor-units-never-a-float.md", "bytes": 527, "sha256": "1e1c86e6…" }
  ]
}
```
One of its items, verbatim, showing the shape an item takes inside a pack —
`origin: human`, a fresh `checksum`, and no live `source_file`:
```markdown
---
id: RULE-money-is-an-integer-of-minor-units-never-a-float
type: rule
title: Money is an integer of minor units, never a float
status: active
severity: soft
always: false
origin: human
checksum: f11fbe6a0d72ea84
---

# Money is an integer of minor units, never a float

A float cannot represent a tenth of a cent, and a rounding error that appears
once per transaction appears a million times per month.
```

**Import mechanics, from `src/cli/commands/pack.ts` and `src/pack/`.** The
command file's own doc comment (quoted, not paraphrased — it states the order
precisely) lays out six steps: parse the subcommand and flags before the corpus
is opened; read and verify the artefact and run `planImport` — which is pure,
so "everything it refuses is refused with nothing written"; resolve `--name`
through `refusePackName`'s two refusals; **always** print the collision
report — sorting arriving items into `new` / `changed` / `identical` buckets,
because a non-interactive refusal would otherwise never say what it declined;
then the import gate (unless `--dry-run`); then, only if the `changed` bucket
holds something, a **second, separate** confirmation gate for overwrites,
spelled `--overwrite-changed` non-interactively — deliberately not answered by
the same `--yes` that answered the first gate, because "consent to the import
you described" is not "consent to replacing an item you wrote yourself."
Declining that second gate is not an error: new items still land, and the
changed ones are reported and skipped, never silently.

`src/pack/` splits the work by concern: `reader.ts` reads and verifies an
artefact (dir or zip) against its manifest hashes; `collide.ts` computes the
three-way collision buckets and renders the report (`collisionJson` /
`renderCollisionReport`); `import.ts` holds `planImport` (pure) and
`applyImport` (the write); `manifest.ts` builds and validates `manifest.json`,
including `refusePackName`; `bundle.ts` and `dir-writer.ts`/`zip.ts` are the
export-side counterparts (see below); `config-io.ts` reads/writes the pack's
own `config.json`; `history.ts` and `imported-audit.ts` carry the
pack-history and import-audit records; `screen.ts` renders pack metadata for
the web UI's Template Packs screen (chapter 8, [`./08-web-ui.md`](./08-web-ui.md)).

**Use case.** A team runs three services from three separate `my_context`
workspaces but wants "an amount is always an integer of minor units" enforced
in all three. One workspace captures and matures the rule, then exports it
`--as-pack`; the other two `pack import` it, review the resulting draft, and
promote it — each workspace deciding for itself whether the rule fits, never
inheriting it silently.

## Export / import as a corpus operation

**What it is**, distinct from a pack specifically: `mycontext export` writes
*this* workspace's corpus to a path outside it, either whole (an "export") or
projected as a pack (`--as-pack`). `--format dir|zip` picks the container;
`--dry-run` prints the exact preview an export would produce and performs
**zero writes** — confirmed directly from `src/cli/commands/export.ts`: the
write block at the bottom of the command is gated on `if (!request.dryRun &&
request.out !== null)`, and `--out` is not even required when `--dry-run` is
set.

**Why it exists**, and why the preview names what does *not* travel: the
command's own doc comment states the reasoning outright — *"An allow-list is
only half a disclosure. A user who hands someone an export of their corpus is
entitled to know what is not in it, in the same breath as what is —
otherwise the omission is discovered by the receiver, or never."* `buildBundle`
(`src/pack/bundle.ts`) only knows what it assembled, so the *"not travelling"*
line is printed by `export.ts` itself.

Also notable: `export` deliberately has **no `--yes` and no confirmation
gate**, on the stated grounds that `confirmAction` guards writes to *the
corpus*, and this command writes only to a path the user named on the command
line — "a gate here would be a prompt with nothing to protect, and it would
train exactly the reflex the gate on the import side depends on." `export` is
therefore absent from the approval-boundary set that chapter 13's test harness
(`test/helpers/approval-boundary.ts`) derives by asking the parser which
commands accept `--yes`.

**Worked example — real output, run read-only against this repository's own
corpus (1,108 items, confirmed live):**
```
$ node src/cli/index.ts export --dry-run
my_context: about to export 1108 item(s) as a full export
  adr 3   constraint 7   decision 99   instruction 11   invariant 6   known_issue 32   lesson 43
  measurement 1   non_goal 3   note 27   open_question 29   reference 5   requirement 32   rule 55
  standard 15   task 740
  history: 4274 mutation record(s), filtered to mutations and joined to these items
  not travelling: injections, hook actions, focus records, the index, session state,
                  revisions, ingest sessions and staged lessons
  nothing was written — this was a --dry-run. Run it again without --dry-run to write the artefact
  above.

$ node src/cli/index.ts export --dry-run --as-pack --pack-name test-preview --pack-version 1.0.0
my_context: about to export 1108 item(s) as a pack named "test-preview", version "1.0.0"
  adr 3   constraint 7   decision 99   ...   task 740
  history: 4274 mutation record(s), filtered to mutations and joined to these items
  not travelling: injections, hook actions, focus records, the index, session state,
                  revisions, ingest sessions and staged lessons
  dropped for a pack: source_file on 67 item(s), source_checksum on 97 item(s)
  nothing was written — this was a --dry-run. Run it again without --dry-run to write the artefact
  above.
```
The second run demonstrates something a `--dry-run` on `--as-pack` earns for
free: it *also* discloses what a pack projection additionally drops relative to
a full export — here, `source_file` on 67 items and `source_checksum` on 97 —
because a pack travels to a machine that does not have those source files, and
a stale pointer to a path on someone else's disk is worse than none.

**Not travelling, in every export, per the tool's own printed line**:
injections, hook actions, focus records, the index, session state, revisions,
ingest sessions, and staged lessons. All of these are re-derivable state, not
the Markdown source of record — the same truth/derived-index split that
governs `.my_context/` generally.

**Use case.** Before handing a corpus snapshot to a security reviewer, run
`export --dry-run` first to see exactly which items and how many history
records would travel, confirm nothing unexpected is included, then drop
`--dry-run` to actually write the ZIP.

## Procedures vs. runbooks

**The distinction**, quoted directly from the `procedure` category's doc
comment in `src/core/categories.ts` (the doc comment for `procedure`,
immediately following `runbook`'s definition):

> *"The one-shot sibling of `runbook`, and the pair is deliberate (spec §6o).
> `runbook` is REPEATABLE: it is performed whenever the named operation comes
> up, and it governs for as long as the operation exists. A `procedure` is
> performed ONCE — a migration, a data fix, a one-time correction — and then
> it is finished, which is why it is the category that carries a lifecycle and
> `runbook` is not. Collapsing the two would lose the property that makes the
> one-shot honest: it stops being injected when it is done.
>
> The test an author applies, and it is the same sentence the topic file, both
> READMEs and both `examples` outputs give: will you do this again next time
> the situation arises? Then it is a `runbook`. Is it done once and then
> finished? Then it is a `procedure`.
>
> NORMATIVE, like `runbook`, and unlike `todo`/`note`: an active procedure is
> injected in full, is named in the index, and an agent-authored one lands
> `draft` through `trustedStatus` with no exception anywhere."*

Both categories are normative (chapter 1, [`./01-items-and-corpus.md`](./01-items-and-corpus.md)),
prefix `RUN` and `PROC` respectively, and are enabled by default. Only
`procedure` gets a lifecycle command — `mycontext procedure` refuses `runbook`
by name, and the refusal is deliberate rather than a gap, because "a runbook
has no lifecycle... it is performed again every time the named operation comes
up."

**The procedure lifecycle**, from `src/cli/commands/procedure.ts`'s own
table (quoted, real code comment):

| Stage     | Representation                    | Injects                         | Command                              |
|-----------|------------------------------------|----------------------------------|----------------------------------------|
| proposed  | `status: draft`                    | nothing                          | `mycontext add procedure …`            |
| ready     | `status: draft` + tag `ready`      | nothing, not even an index line  | `mycontext edit <id> --tags …`         |
| active    | `status: active` + `always: true`  | the full block, every session    | `mycontext procedure activate`         |
| done      | `status: deprecated`               | nothing; counted in `retired`    | `mycontext procedure done`             |
| abandoned | `status: superseded`               | nothing                          | `mycontext supersede <id> --by <id>`   |

Nothing was added to the `Status` enum for this — the whole lifecycle is a
projection over `status` + `always` + a `ready` tag that already existed for
other purposes.

**Step tracking is not stored in the item.** A tick (`procedure step <id> <n>`)
writes one `progress` audit record (`PROGRESS_OPS = ['step-done', 'step-undone',
'step-reset']` in `src/core/audit.ts`), replayed on demand by
`src/core/progress.ts`. `procedure.ts`'s doc comment is explicit about why:
*"why `step` writes no item, takes no index write lock, and leaves the file's
checksum exactly where it was — and why `show` says out loud that the `- [x]`
it prints is rendered rather than stored."* This is the same discipline chapter
1 documents for `state:` fields generally — the rendered checkbox is a view,
never itself the record — and it is also why progress is workspace-scoped, not
session-scoped: two terminals on the same workspace share one record set (real
CLI note, captured below).

**Worked example — real, read-only output against this repo (0 procedures
exist here today):**
```
$ node src/cli/index.ts procedure list
0 procedure(s). Capture one with `mycontext add procedure "<title>" --step "..."`.
note: progress is recorded per workspace, not per session — two terminals on this workspace share
      one record set.
```

**Use case.** A one-time data migration ("rename the `amount_cents` column
everywhere and backfill the old rows") is captured as a `procedure` with
`--step` entries for each stage, activated so every session sees it in full
until it's finished, ticked off step by step across however many sessions it
takes, then marked `done` — at which point it stops being injected and is
counted only in the retired total. A recurring operation ("how we roll a
hotfix") is captured as a `runbook` instead, and stays injected indefinitely
because there is no "finished" state for something performed again next time.

## Tutorials

**What it is.** Documentation is generated from, and checked against, the
product's own surfaces rather than hand-maintained prose that can drift. The
per-feature tutorial roster lives at the checked-in `docs/tutorials/manifest.json`
(24 entries, confirmed by listing it live), each entry a `TutorialManifestEntry`
(`src/core/tutorial-manifest.ts`) naming: a stable kebab-case `id`; a `title`
phrased as *"a job a reader is trying to do, not a feature name"*; a `tier`
(`basic` | `advanced`); and the concrete surface files it claims —
`cli` command filenames, `slash` command filenames (from `commands/*.md`),
`screens` filenames (from `src/ui/public/screens/*.js`), and `categories` keys.

**How it stays honest.** `scripts/build-tutorial-manifest.ts` (run by hand via
`npm run gen:tutorials`) *derives* the manifest by globbing the four real
surfaces — CLI commands, slash commands, UI screens, categories — and
clustering them into features; `test/core/tutorial-manifest.test.ts` re-globs
those same four surfaces independently and fails, **naming the file**, the
moment something claimed twice or not at all appears. This means an unclaimed
new CLI command or UI screen breaks a test rather than silently having no
tutorial — the same "no silent gap" discipline that runs through this whole
product (chapter 1's `INV-nothing-is-dropped-silently`, cited by a sibling
chapter).

Real entry, `capturing-an-item-and-the-categories` (first in the manifest):
title *"Capture what you just decided, before you forget it"*, claims all 30
`add-*.md` slash commands, the `capture.js` screen, and all 29 `CATEGORIES`
keys. Every tutorial has the same four sections per `docs/TUTORIAL.md`: what
it's for, how it works, how to use it from the CLI, and how to use it from the
UI — "with each surface saying what it can and cannot do, because they are not
the same."

**Where they live.** Each entry points to an English file and a Hebrew file
(`enFile`/`heFile`) under `docs/tutorials/` — e.g.
`capturing-an-item-and-the-categories.md` and its `.he.md` twin, both present
on disk. `docs/TUTORIAL.md` itself is now a redirect page, not the tutorial
content — a real, checked quote: *"This page moved. It used to be one long
'first twenty minutes' chapter. The tutorials are now one file per feature...
served by the product itself — open the web UI (`mycontext ui`) and read them
on the Tutorials screen, or read the Markdown directly."* `docs/TUTORIAL.md`
lists six "basic tier" tutorials read first (capture → load context → search →
check health → inbox → web UI) and points onward to `docs/TUTORIAL-ADVANCED.md`
for the rest.

**Use case.** A new contributor asks "how do I search the corpus?" — instead
of writing a fresh Slack answer, point them at
`docs/tutorials/reading-and-searching-the-corpus.md` (or the Tutorials screen
in the web UI, chapter 8), knowing the tutorial is verified never to have
silently fallen out of sync with the actual `search`/`query` CLI commands.

## Templates (the pack directory)

`docs/TEMPLATES.md` is the one and only discovery surface for packs, and it is
deliberately, honestly empty today — a real, checked quote: *"The list. It is
empty. That is not an oversight and it is not a placeholder. No packs have been
published yet, so a list seeded with plausible-looking examples would be a
document that lies on the day it ships... It stays empty until there is
something true to put in it."* When an entry does exist, it carries a **link**
and an **author**, "because those are the two things a person needs in order
to decide whether to run `mycontext pack import` on it" — and neither is
verified by this repository; it is curated by hand.

## Skills and slash commands

This plugin ships one Claude Code **skill**, `skills/mycontext/SKILL.md`
(confirmed on disk — the only file under `skills/mycontext/`). Its frontmatter:

```yaml
name: mycontext
description: Use when project knowledge is at stake — a constraint, requirement,
  decision, rule or lesson is being established, or you are about to assume how
  this project works. Captures normative knowledge as Markdown and retrieves
  what already governs.
```

The skill's body teaches an agent to call `create_item` (the MCP tool, chapter
9, [`./09-cli-and-mcp.md`](./09-cli-and-mcp.md)) **in the turn the knowledge is
established**, restates the normative/rationale tier split from chapter 1 in
plain language for an agent deciding where something lands, and points to
`mycontext_help`/`mycontext_examples` for anything uncertain. This is the
`mycontext:mycontext` skill visible in this very session's own skill listing —
its content is exactly this file.

`mycontext:LoadMyContext` (also visible in this session's skill listing)
corresponds to `commands/LoadMyContext.md` at the repository root. Alongside
it, `commands/` ships **95 slash command files** (confirmed by listing the
directory): one per CLI command family plus one `add-<category>.md` and
`list-<category>.md` per category (`add-adr.md` … `add-tradeoff.md`,
`list-adr.md` … `list-tradeoff.md`), plus single-word commands mirroring `add`,
`audit`, `decay`, `discard`, `doctor`, `edit`, `focus`, `handover`,
`harden`, `inbox-promote`, `ingest`, `lesson`, `lesson-stage`, `link`, `pin`,
`procedure`, `promote`, `query`, `ready`, `refresh`, `review`, `search`,
`session-carry`, `session-name`, `show`, `soften`, `status`, `supersede`,
`todo`, `ui`, `unlink`, `unpin`. Registration is declared in
`.claude-plugin/plugin.json` (name `mycontext`, version `1.0.2`) and
`.claude-plugin/marketplace.json`, which is how Claude Code discovers both the
skill and the slash commands when this plugin is installed.

## What's NOT built / built but off

- **No pack registry, index, or update channel** — `docs/TEMPLATES.md` states
  this is deliberate, not a gap to be filled: *"no registry, no re-fetch, no
  update channel and no version check over the network."* Updating a pack
  means re-importing a newer artefact you fetched yourself; there is no
  `pack update` command.
- **`docs/TEMPLATES.md`'s list is genuinely empty** — no packs have been
  published anywhere the project curates, so there is no real third-party pack
  to demonstrate beyond the repo's own `.demo-pack/`.
- **This workspace has 0 procedures and 0 imported packs right now** —
  confirmed by real `procedure list` and `pack list` output above; the worked
  examples for those two commands are necessarily "nothing here yet" rather
  than a populated example, which is itself informative about how rarely this
  repository's own maintainers reach for the one-shot-lifecycle category.
- An open question already recorded in this corpus, found while searching —
  `OPENQ-does-export-import-ever-import-or-is-a-third-of-that-screen` — flags
  that the Export/Import UI screen's relationship to actual import behavior is
  still unsettled; treat any UI-side import claim about that screen (chapter 8)
  as provisional until that question is resolved. Also found:
  `NOTE-packs-is-the-app-ahead-of-its-design-and-well-defended`,
  `TASK-export-as-pack-has-no-unicode-screen-so-a-hostile-pack-name`,
  `TASK-export-wire-screenpackmeta-which-is-written-but-never-called`, and
  `TASK-pack-import-name-bypasses-refusepackname-and-screenpackmeta` — four
  live, open items recording specific known rough edges in the pack/export
  surface, cited here rather than restated, per this project's own citation
  discipline.

## See also

- [Index](./00-index.md)
- [Items and the corpus](./01-items-and-corpus.md) — the draft/promote pipeline every imported item goes through.
- [The CLI and the MCP server](./09-cli-and-mcp.md) — full command reference, including `create_item`.
