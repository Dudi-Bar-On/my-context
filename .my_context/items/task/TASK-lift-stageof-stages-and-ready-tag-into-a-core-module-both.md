---
id: TASK-lift-stageof-stages-and-ready-tag-into-a-core-module-both
type: task
title: lift stageOf, STAGES and READY_TAG into a core module both the CLI and the UI import
status: active
severity: soft
always: false
summary: A small shared vocabulary is written out twice, once for the command line and once for the screen, and the two copies will eventually disagree.
summary_of: 62b65130f69d211e
scope: []
tags:
  - "plan:api"
  - "seq:5"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: 8ad00ea9a8b679ab
valid_from: 2026-08-23
valid_until: null
checksum: 19103ac2013ba620
state: done
plan: api
seq: "5"
---

# lift stageOf, STAGES and READY_TAG into a core module both the CLI and the UI import

> `src/cli/commands/procedure.ts` imports `updateItem` at its third line, because
> `activate` and `done` mutate. A read surface may not reach that module at all,
> so the Procedures read model RE-SPELLED the three things it needed out of it:
> `stageOf`, `STAGES` and `READY_TAG`. All three are module-private there, so
> there was nothing to import even if the graph allowed it.
>
> The agent that did it named it as a defect it was creating rather than a
> preference, and cited the original beside each spelling. A closed vocabulary
> written down twice will disagree eventually, and the disagreement will be between
> a CLI and a screen showing the same lifecycle.
>
> The fix is to lift `stageOf`, `STAGES` and `READY_TAG` into a core module both
> sides import — a pure module with no write surface, which the read model may reach.
> It touches files that task did not own, which is why it is here rather than done.
>
> Adjacent and worth the same trip: `TOP_LEVEL_KEYS` is not exported from
> `core/config.ts`, so the Template packs model pinned `CONFIG_KEYS` to
> `keyof Config` minus skippedKeys as a PROXY — a key added to TOP_LEVEL_KEYS that
> Config does not carry would slip past it.
