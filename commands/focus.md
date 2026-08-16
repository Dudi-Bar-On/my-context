---
description: Narrow what my_context injects, and report what that hides
argument-hint: "[<tag>…] [--tag t] [--category c] [--scope path] [--preview] [--show] [--clear]"
disable-model-invocation: true
---

Narrow — or widen — what my_context injects into sessions in this project.

Run: `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" focus $ARGUMENTS`

Print the report as it is printed. With no arguments it shows the focus now in effect;
`--clear` removes it; `--preview` reports the cost and changes nothing.

**Focus discloses and allows.** It hides exactly what it was asked to hide, and reports
two numbers: how many items are hidden, and how many load-bearing relations that leaves
dangling — an edge with one end hidden and the other still visible, such as a hidden
`open_question` that `blocks` a requirement still on screen. It never refuses a hide.
Read those numbers out; a dangling count above zero is the user's decision to make, not
a failure.

**Nothing is deleted and nothing is dropped.** A hidden item is still in the corpus and
still readable with `/mycontext:show`. `severity: hard` items are never hidden at all,
and the report says how many were kept for that reason.

The focus belongs to this workspace, not to one session, so it outlives the session that
set it. Every injection under a focus says so.
