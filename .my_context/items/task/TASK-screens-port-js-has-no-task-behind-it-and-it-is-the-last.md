---
id: TASK-screens-port-js-has-no-task-behind-it-and-it-is-the-last
type: task
title: screens/port.js has no task behind it, and it is the last unbuilt screen without one
status: active
severity: soft
always: false
summary: The export screen was the last one nobody had been asked to build, though everything it needs is ready and waiting.
summary_of: 6dbebc2ee35f3bbc
scope: []
tags:
  - "plan:port"
  - "seq:8b"
  - v2
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: 081be42b6054086c
valid_from: 2026-08-23
valid_until: null
checksum: d5ae53543faa0b8b
plan: port
seq: 8b
state: done
---

# screens/port.js has no task behind it, and it is the last unbuilt screen without one

> The rail lists twenty-one screens. Nineteen have a task; `screens/port.js` is the
> twentieth and has none — the same gap `screens/docs.js` had until it was filed on
> this same day, found the same way, by listing the unbuilt screens against the
> tasks that claim them.
>
> Everything it needs now exists. `GET /api/port` was built in the wave of
> 2026-08-23 and is wired: it serves the six `port.what` rows with a travels /
> filtered / rebuilt verdict computed from where each path lands inside an artefact,
> the audit kinds that carry and the five that do not, the three format rungs with
> `built` on each, the three bucket names, the export argv, and seven disclosures.
> All eighteen `port.` string keys are already in both tables.
>
> Three things the screen must get right, each already measured and disclosed by the
> endpoint rather than left for the screen to discover:
>
> - the `git bundle` rung is served `built: false`, because ArtefactFormat is dir
>   or zip. How that renders is an open ruling, filed separately.
> - the copy block's destination is deliberately absent: the CLI refuses to default
>   `--out`, and a server that invented one would hand the reader a command that
>   looks ready and writes somewhere they did not choose.
> - the three bucket example ids in the mockup are illustrations, not data. Sorting
>   real ids into buckets needs an artefact to have arrived.
>
> The mockup's own copy block was corrected on 2026-08-23: it wrote `--to`, and the
> flag is `--out`.
