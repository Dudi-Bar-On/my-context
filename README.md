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

Set `always: true` in an item's frontmatter to have it injected in full at the
start of every session. Other **normative** items appear as a one-line index
entry; rationale items (`lesson`, `adr`, `decision`, `tradeoff`, …) are never
listed individually — they contribute only an aggregate count. See
`mycontext help categories`.

Design: `docs/superpowers/specs/2026-08-12-my-context-design.md`
