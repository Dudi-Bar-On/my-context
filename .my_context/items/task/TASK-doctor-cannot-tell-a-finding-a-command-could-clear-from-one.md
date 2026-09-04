---
id: TASK-doctor-cannot-tell-a-finding-a-command-could-clear-from-one
type: task
title: doctor cannot tell a finding a command could clear from one nothing can
status: active
severity: soft
always: false
summary: The health screen cannot tell a problem a command could fix from one that needs judgement, so each finding should say which it is.
summary_of: 862a69fc74215f3d
scope: []
tags:
  - v2
  - ui
  - doctor
  - walk
  - "plan:walk"
  - "seq:121"
  - "state:todo"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/doctorfix.md"
source_anchor: null
source_checksum: 6bc63bb46fb300ba
valid_from: 2026-08-31
valid_until: null
checksum: b2855af5fa11513b
plan: walk
seq: "121"
state: todo
priority: "1"
source: owner ruling, 2026-08-31
---

# doctor cannot tell a finding a command could clear from one nothing can

> > Owner ruling 2026-08-31, after asking whether Doctor's notices should get a button.
>
> **The state, measured**
>
> `mycontext doctor` reports **0 errors, 0 warnings, 61 notes** — and all 61 are two codes: `citation_form` (60) and `nested_corpus` (1).
>
> `Finding` is `{ level, code, message, item? }`. **There is no `fix` field**, so the screen cannot tell a finding a command could clear from one nothing can. `doctor.js` already imports `commandActions` and the catalogue, so the machinery exists and the DATA is what is missing.
>
> **Some findings do have a mechanism** — `source_drift` has `mycontext refresh <id>` (its own docblock says the route "is mechanical and has a command"), `index_stale` has `rebuild`, checksum drift has `repair`. Today none of them offers it here.
>
> **And one must never get one, which is the load-bearing half**
>
> `citation_form` is 60 of the 61, and a fix button for it would be actively wrong. `plan:walk seq:69` measured exactly this:
>
> * of 171 bare pointers, **127 had no resolvable anchor at all** — there is nothing to convert them to;
> * **four already pointed past end of file**;
> * two mechanical expansions were tried and **rejected** because roughly **one anchor in three came out confident and wrong**.
>
> A wrong anchor is a true-looking statement about the wrong code, which is the trap that task was filed to name. These 60 are a backlog for judgement, not a queue for a button.
>
> **The ruling**
>
> `Finding` gains an optional `fix` — the command that clears it, where one exists. The screen offers Execute **only** for findings that carry it, through the existing catalogue and the existing approval boundary. Findings without one draw **a sentence saying why**, not an absence.
>
> That last clause is the point. Today a fixable finding and an unfixable one look identical, so **the missing button reads as an oversight rather than as a decision** — the same shape `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` forbids one level up.
>
> **Rulings**
>
> * **No bulk "fix all".** The findings that dominate the list have no safe mechanical fix, so such a button would either skip 60 of 61 silently or apply anchors measured wrong one time in three.
> * **`fix` is a catalogue id and a value bag, never a command string.** `doctor.js`'s own comment says it: *"a string cannot be executed. The client sends an id and a value bag and never a statement."* A command not in `palette-defs.js` is not offerable — say so rather than composing one.
> * **Every offered fix goes through the approval boundary.** Nothing here writes without the confirm the Review queue and Configure already use.
> * **The `citation_form` count is a backlog counter and should read as one.** It falls as `plan:walk seq:69`'s remaining conversions land; a reader should be able to tell that from the screen rather than reading it as 60 faults.
>
> **Done when**
>
> `Finding` carries `fix`; findings with a mechanism offer Execute through the catalogue; findings without one state why in a keyed sentence in both tables; no bulk control exists; and a browser test drives one fixable finding to green and asserts the unfixable one offers no control and says why.
