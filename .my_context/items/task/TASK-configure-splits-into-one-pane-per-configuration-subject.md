---
id: TASK-configure-splits-into-one-pane-per-configuration-subject
type: task
title: Configure splits into one pane per configuration subject
status: active
severity: soft
always: false
summary: Break the settings page into one clear section per subject, each showing its current value, instead of one flat page covering only part of them.
summary_of: 635cfd3470ee5ee9
scope: []
tags:
  - "plan:config"
  - "seq:1"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: f5121b3de9eba869
plan: config
seq: "1"
state: done
---

# Configure splits into one pane per configuration subject

OWNER INSTRUCTION 2026-08-23: the Configure implementation should be refactored to something like the composer does - very structured and very user friendly - with a clear separation between the different configuration subjects.

MEASURED: the screen today is one flat page. Its sections are Budgets, What changes, a scope-policy strip, Apply this, and Watched documents - which covers three of the seven things config.json actually carries and mixes a preview into the middle of them.

THE SUBJECTS, from `CATEGORY_KEYS` and the top-level config shape: Profile, Categories (tier, prefix, description, extraFields, agentEdits, scopePolicy), Budgets, Watched documents. Each gets its own pane with its own heading, its own current value and its own settle step - so a reader can find the one thing they came to change.

PARITY: the mockup is the design of record and this changes what it draws, so the mockup moves in the same commit and `styles-parity` / `screen-parity` / `strings-parity` move with it.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS. An owner instruction of 2026-08-23, unbuilt, and it is the parent of the other three config tasks.

IT IS THE SAME WORK AS plan:walk seq:13, "the config screen gains a composer, and the mockup gains one first". seq:13 is blocked on the owner because the mockup moves first; THIS task is the specification of what the mockup should draw -- Profile, Categories, Budgets, Watched documents, each with its own heading, its own current value and its own settle step. Take this task INTO that mockup sitting; without it seq:13 arrives with no pane list.

THE MEASUREMENT IN IT IS STILL TRUE and is the argument: the screen today is one flat page whose sections cover three of the seven things config.json actually carries, and it mixes a preview into the middle of them.

AND IT NOW CARRIES A SECOND OWNER REQUIREMENT, given 2026-08-25 and recorded after this task was written: every configuration entry is treated as ask or composer does -- the user SELECTS wherever possible, and where free text is unavoidable there are explanatory instructions about the value and a default or recommended value as a PLACEHOLDER before the user types. That requirement governs every pane here.
