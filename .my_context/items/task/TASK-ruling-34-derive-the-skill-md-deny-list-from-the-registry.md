---
id: TASK-ruling-34-derive-the-skill-md-deny-list-from-the-registry
type: task
title: "ruling 34: derive the SKILL.md deny list from the registry, like README section 7"
status: active
severity: soft
always: false
summary: The list telling the assistant what it must never do on your behalf is kept by hand, is out of date, and a test pins the stale version in place.
summary_of: 9f064d7c603477d0
scope: []
tags:
  - "plan:rulings"
  - "seq:34"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 4398537e681ba04a
plan: rulings
seq: "34"
state: done
priority: "1"
last_change: "2026-08-21T07:49:13Z"
progress: "100"
---

# ruling 34: derive the SKILL.md deny list from the registry, like README section 7

**Ruled 2026-08-21.**

`skills/mycontext/SKILL.md` carries a hand-kept list of what the model must never do on the user's behalf. `test/plugin-assets.test.ts` pins that exact sentence — **against a stale value**. It omits `inbox-promote`, `refresh` and `review discard-revision`.

That is the worst combination there is: a test that looks like protection and is not. It is also the surface **the model actually reads**, so it is worse than the README being wrong.

The fix already exists. Ruling 32 derived the approval boundary from `COMMANDS` by probing each command with a sentinel flag and with `--yes`, and holds both READMEs to the result. Feed the same derivation into the skill.

Land the corrected list first and watch the pinned test go red, then derive it. **A checker is not verified until it has been made red** — this project has found five that could never fail.

Note that `commands/refresh.md` already tells the model refresh is denied, so the two model-facing surfaces currently disagree with each other.
