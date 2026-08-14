# my_context

Captures the normative knowledge of a project — constraints, invariants, rules,
requirements — as Markdown in `.my_context/`, indexes it in a disposable SQLite
database, and injects the relevant parts back into Claude Code sessions.

Requires Node 24 or newer. No runtime dependencies.

## Quick start

```bash
npm install
npm link          # provides the `mycontext` command

mycontext init
mycontext add constraint "Postgres pool capped at 20"
mycontext status
```

Without `npm link`, every command also works as `node src/cli/index.ts <args>`.

## Two surfaces, one corpus

**The model** uses the eleven MCP tools (`create_item`, `query_items`, `get_item`, …).

**You** use slash commands, namespaced by the plugin's name:

```
/mycontext:add-requirement  Sessions expire after 30 minutes
/mycontext:list-decision    --full
/mycontext:search           connection pool
/mycontext:review
/mycontext:status
/mycontext:LoadMyContext
```

There is one `add-<type>` and one `list-<type>` per **enabled** category — 34 today,
plus `search`, `review` and `status`. They are generated from the same resolved config
`mycontext help categories` prints, by `npm run gen:commands`, and a test fails if the
committed files and the generator disagree: a disabled category cannot keep a command
that would then be refused. Every one of them is `disable-model-invocation: true` — they
are your surface, not the model's.

## Output

Every reporting command — `status`, `list`, `decay`, `review list`, `doctor`,
`ingest-status`, `query` — takes `--full`, `--short` (the default) and `--summary`, and
`--json`. Text output is column-aligned with headers; `--json` is the only faithful
rendering of the hierarchical reports (an ingest session's per-anchor progress, a draft's
body), and it carries any corpus load errors inside the document so it stays parseable.

## The approval boundary — read this before trusting it

A normative item captured by a model lands as a `draft` and governs nothing until a human
promotes it. A rule derived from a lesson is inert until a human accepts it. That is the
design.

**What actually enforces it: your Bash permissions, and nothing else.**
`mycontext review promote`, `mycontext review discard` and `mycontext lesson-accept` are
ordinary CLI commands. The rule-derivation request this plugin prints *instructs the model
to shell out to this CLI*, and the same shell reaches `lesson-accept`. The `--yes`
confirmation on `promote`/`discard` is **not** a security boundary — an agent composing
the command line can add `--yes` itself. What it buys is legibility: a promotion cannot
happen without an explicit, greppable token in the transcript.

**A plugin cannot ship permission rules.** Claude Code's plugin `settings.json` supports
only the `agent` and `subagentStatusLine` keys, so this repository cannot close the gap on
your behalf. If you want the boundary enforced, put it in your own
`.claude/settings.json`:

```json
{
  "permissions": {
    "deny": [
      "Bash(mycontext lesson-accept *)",
      "Bash(mycontext review promote *)",
      "Bash(mycontext review discard *)"
    ]
  }
}
```

And know what that does not cover: Bash rules match the command string, so
`node .claude/plugins/…/src/cli/index.ts lesson-accept …`, an `npx` invocation, or any
other spelling of the same program is a different string and is **not** denied. The rules
above raise the cost of an accidental promotion; they do not make one impossible. The
honest statement is the one at the top: the gate holds if and only if the agent's Bash
surface excludes these commands.

Set `always: true` in an item's frontmatter to have it injected in full at the
start of every session. Other **normative** items appear as a one-line index
entry; rationale items (`lesson`, `adr`, `decision`, `tradeoff`, …) are never
listed individually — they contribute only an aggregate count. See
`mycontext help categories`.

Design: `docs/superpowers/specs/2026-08-12-my-context-design.md`
