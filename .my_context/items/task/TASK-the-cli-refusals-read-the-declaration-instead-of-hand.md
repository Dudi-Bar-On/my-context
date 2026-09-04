---
id: TASK-the-cli-refusals-read-the-declaration-instead-of-hand
type: task
title: the CLI refusals READ the declaration instead of hand-writing it
status: active
severity: soft
always: false
summary: Build refusal messages from the same rules they enforce, so what the tool says and what it does cannot drift apart.
summary_of: d90d152142fd609b
scope: []
tags:
  - "plan:categories"
  - "seq:15"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: d74377956efdc0e4
plan: categories
seq: "15"
state: done
---

# the CLI refusals READ the declaration instead of hand-writing it

Guidance and behaviour cannot disagree if there is only one of them.

MEASURED, five things learned by trial in a single session because nothing declared them: `--severity hard` on a task is refused because task is rationale tier and severity governs only on normative - and the refusal, which is excellent, arrives only AFTER the attempt. `always` has two spellings, `edit --always=true` and `mycontext pin`. `edit --tags` REPLACES the whole list, so changing one tag silently drops the others unless every tag is read back first. `source_file` has no command at all. And `state` on a task is a tag, not a field, which nothing says.

DO: the gate in `edit` and its siblings composes its refusal FROM the declaration built in seq 13, rather than each site spelling its own sentence. A refusal then cannot drift from the rule it enforces, and adding a category cannot leave a refusal behind.

KEEP the refusals as good as they are now. This is about where the sentence comes from, not about making it terser.
