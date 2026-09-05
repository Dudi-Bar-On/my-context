---
id: TASK-one-field-name-means-two-different-things-on-two-routes
type: task
title: one field name means two different things on two routes, which made a merge question look simpler than it is
status: active
severity: soft
always: false
summary: Two artefact routes both expose a field called carries, holding different types, so the name says less than it appears to.
summary_of: 82dbc02ccfa952f8
scope:
  - src/ui/packs-model.ts
  - src/ui/port-model.ts
  - src/ui/public/screens/**
tags:
  - v2
  - ui
  - api
  - "plan:port"
  - "seq:15"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 794208b8fbcb439d
plan: port
seq: "15"
state: todo
priority: "3"
---

# one field name means two different things on two routes, which made a merge question look simpler than it is

Owner ruling 2026-09-05, taken while settling the three rulings bundled in port/14.

The item asked whether /api/packs and /api/port should merge into one /api/artefacts, on the grounds that both serve carries and artefact and are served once from packs. Measuring the two responses before deciding showed the premise is not quite right, and the difference is the finding.

packs serves carries as CarriesRow, the config keys that travel. port serves carries as AuditKind, the audit kinds that travel. Same name, two types, two meanings. They were written at the same moment and neither model could see the other's shape, which is exactly how a collision like this survives review.

So the merge is not the tidy-up it looks like. Reconciling two routes whose shared field means different things is not moving code, it is deciding which of two concepts the name belongs to and renaming the other.

The ruling is to fix the collision first and ask about merging afterwards, when the two routes are actually comparable. A name that means two things is a defect on its own terms, whatever happens to the routes.

What to do: rename so each field says what it holds, in whichever direction reads better, and say which reading you took. Both routes are served to a screen, so a rename reaches the read model, the screen and the strings. Check what breaks before choosing.

Leave the merge question open and say so. It is a real question and it deserves to be asked about a shape that is honest first.
