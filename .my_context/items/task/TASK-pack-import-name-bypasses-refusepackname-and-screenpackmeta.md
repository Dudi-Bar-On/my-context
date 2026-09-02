---
id: TASK-pack-import-name-bypasses-refusepackname-and-screenpackmeta
type: task
title: pack import --name bypasses refusePackName and screenPackMeta
status: active
severity: soft
always: false
summary: A name typed while importing skips the safety check, so text that can forge or reverse a line of output is stored and printed as-is.
summary_of: 688987cf14c8b63d
scope: []
tags:
  - "plan:export"
  - "seq:15s"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: 0601a3669ec44e83
valid_from: 2026-08-23
valid_until: null
checksum: 0c98d41313e61a47
plan: export
seq: 15s
state: done
---

# pack import --name bypasses refusePackName and screenPackMeta

> Measured on 2026-08-23 by the agent building the Template packs read model, and
> reproduced twice with real commands rather than inferred.
>
> `src/cli/commands/pack.ts` line 312 reads
> `const name = flag(args, 'name') ?? plan.pack;` — the override is applied AFTER
> `planImport` has screened the manifest name, and nothing re-checks it. Neither
> `refusePackName` nor `screenPackMeta` ever sees the value the operator typed.
>
> Measured, both exit 0 and both written verbatim into `import.json`:
>
> - a name carrying U+202E RIGHT-TO-LEFT OVERRIDE — and the CLI then printed it
>   into its own outcome line, which is precisely the surface the Unicode screen
>   exists to protect;
> - a name carrying an embedded newline — the exact forgery `refusePackName`
>   refuses on the manifest path, whose own words are that a newline "forges a
>   second line of a report the reader is relying on".
>
> The boundary belongs where the name is ACCEPTED, not where it is read back: the
> read model deliberately did not wire the screen there, because on a read path a
> finding could only make the endpoint refuse to serve a pack already in the
> corpus — hiding a bad name instead of naming it.
>
> Until this lands, the Template packs screen must treat every name it renders as
> untrusted text.
