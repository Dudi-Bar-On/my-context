# Capture what you just decided, before you forget it

Every command and every block of output on this page was run against a fresh
workspace while writing it. Nothing here is illustrative.

**Tested on:** my_context v1.0.2, Node 24, Windows 11.

## What it is for

You tell Claude "card numbers never go in the logs." Two hours later, in a new
session, Claude writes `logger.info(card.number)`.

The usual fixes don't hold. `CLAUDE.md` gets long, and everything in it is
loaded every session whether or not it is relevant. Re-explaining works until
the context window turns over. Neither one can answer "what governs this file?"

Capture is the feature that fixes that. It stores the sentence as a **file in
your repository**, attaches it to the paths it is about, and lets the rest of
the product hand it to Claude the moment Claude touches one of them.

## How it works

An item is one Markdown file under `.my_context/items/<category>/`, with YAML
frontmatter and a body. Nothing else. It diffs, it reviews, and it survives the
tool being uninstalled.

**There are 29 categories, and they sit in two tiers.** The tier is the whole
mechanism, so it is worth reading before the list:

- **Normative** categories (16: `constraint`, `invariant`, `rule`,
  `requirement`, `standard`, `pattern`, `glossary`, `instruction`, `non_goal`,
  `open_question`, `runbook`, `procedure`, `environment`, `known_issue`,
  `exception`, `contract`) — these say what must hold. They are *injected*: they
  reach a session automatically.
- **Rationale** categories (13: `adr`, `decision`, `lesson`, `tradeoff`,
  `assumption`, `edge_case`, `risk`, `measurement`, `reference`, `plan`, `task`,
  `todo`, `note`) — these record why. They are never injected; they are
  searchable history, and the session index reduces the whole tier to a bare
  count.

`known_issue` is on the normative side even though it reads like a fact. Its
whole job is "this is broken, don't spend effort on it", and it cannot do that
job from a tier Claude never reads. `todo` and `note` are on the rationale side
for the mirror-image reason: they are the inbox, and neither asserts anything.
`procedure` is normative because it is `runbook`'s one-shot sibling.

**Authorship decides trust, through the tier.** You write a normative item, it
governs immediately. *Claude* writes one through the `create_item` MCP tool and
it lands as a **draft** that governs nothing until you promote it. An agent
writing a *rationale* item lands active with no human act, deliberately —
rationale is never injected, so it cannot steer anything. That boundary is the
subject of *Review a pending change before it governs*.

Three frontmatter fields decide most of what happens afterwards:

- **`summary`** — one plain sentence for a reader who does not know this
  codebase. Capture refuses without one (or an explicit `--summary-omitted`).
- **`scope`** — the globs this item attaches to. Empty means every file.
- **`origin`** — `human`, `agent` or `ingest`. No tool lets a caller set this
  field, which is what the trust boundary is built on.

## From the CLI

```bash
mycontext add constraint "Card numbers never reach the logs" \
  --scope "src/billing/**" \
  --severity hard \
  --summary "A rule against ever writing a full card number to a log file." \
  --body "Log the last four digits and the processor's reference."
```

Notice there is no `--yes`. Run it that way first and it refuses, having first
told you exactly what it was about to do:

```console
about to create constraint "Card numbers never reach the logs" — active, and governing this project at once.
my_context: refusing without confirmation — stdin is not interactive. Rerun with --yes to confirm, or run this from an interactive terminal.
```

That sentence is doing real work. It tells you the item will be **active**, and
that active means *governing this project at once*. Add `--yes`:

```console
my_context: created CONST-card-numbers-never-reach-the-logs (active) at items/constraint/CONST-card-numbers-never-reach-the-logs.md.
```

Leave the summary out and it refuses for a different reason, and does not create
anything:

```console
my_context: this capture carries no summary, and an item created without one can never afterwards be asked for it. […] Nothing was created.
```

### What it wrote

```markdown
---
id: CONST-card-numbers-never-reach-the-logs
type: constraint
title: Card numbers never reach the logs
status: active
severity: hard
always: false
summary: A rule against ever writing a full card number to a log file.
summary_of: e7377c8d689fd20c
scope:
  - src/billing/**
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 0f5e13431b7c9ebc
---

# Card numbers never reach the logs

Log the last four digits and the processor's reference.
```

**The slash commands.** Every category has its own `/mycontext:add-<category>`
command — 29 of them, plus a general `/mycontext:add` — and each previews before
it writes. They exist so a capture inside a session does not need you to
remember the category flag.

**From an agent**, the same feature is the `create_item` MCP tool, which is what
makes a normative capture land as a draft.

**What the CLI can do here that the UI cannot.** `--always` (ask for the pinned
tier at capture time), `--original-id`, and `--summary-omitted` are CLI-only.
`--note`, `--observation`, `--step` and `--extra` are repeatable at the CLI; the
UI composes one value per flag.

## From the UI

The **Capture** screen (`nav.ch`) is the browser's front door to this feature,
and its verdict states what it adds over the terminal: *it shows what already
governs before you add another*. It composes an `add` from real pickers — the
live category list, a glob field tested against the actual file tree — and, next
to it, the overlap check: the items already governing the scope you just typed.
That check is the reason to capture here rather than in a terminal.

The **Composer** screen holds the same `add` entry as one of 27 catalogue
commands, if you would rather build the line beside every other verb.

**What the UI can do here that the CLI cannot.** The overlap check. A terminal
can tell you what an `add` will create; only this screen tells you what is
already governing the same paths, before you add a near-duplicate.

**What the UI cannot do here.** It cannot capture without your explicit consent:
the browser sends a catalogue id and a bag of values, never a command, and the
server rebuilds the argv itself and shows you the exact line in a confirm dialog
before anything runs. `add` sits on the trust boundary, so it gets the
field-by-field confirm rather than the light one. And the three CLI-only flags
above are not composable here at all.
