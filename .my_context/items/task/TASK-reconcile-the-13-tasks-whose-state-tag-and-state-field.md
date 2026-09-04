---
id: TASK-reconcile-the-13-tasks-whose-state-tag-and-state-field
type: task
title: reconcile the 13 tasks whose state tag and state field disagree
status: active
severity: soft
always: false
summary: Two places record how far a job has got and they disagree on a growing number of jobs; settle them onto one and keep them settled.
summary_of: 10385d0fcc9c2839
acknowledged:
  - body_disagrees_with_meta@089511eb2e7246e3
scope: []
tags:
  - "plan:categories"
  - "seq:19"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: f0245a958721dd35
plan: categories
seq: "19"
state: done
needs: categories/18
---

# reconcile the 13 tasks whose state tag and state field disagree

MEASURED 2026-08-23, of the 213 task items carrying both a `state` tag and a `state` field, THIRTEEN DISAGREE: 5 have tag=done with field=doing, 7 have tag=done with field=todo, 1 has tag=done with field=blocked. Every progress count ever reported to the owner reads the TAG; anything reading the field would have reported 13 tasks differently.

OWNER RULING 2026-08-23: the tag holds the current value and the field holds the right SHAPE, so the reconciliation moves each tag's value INTO the field, and the field is canonical from then on. This is not "the tag wins" as a principle - the field is the rightful home of a value that changes; the values sitting in those fields are simply stale leftovers from an earlier workflow, which is why five still say "doing".

DO: one recorded pass through the real write surface, never by hand-editing frontmatter, so the audit log carries it. Print the 13 before and after. Then assert zero disagreements and keep the assertion.

DEPENDS ON seq 18, which is what makes the state impossible to reach again.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, AND THE NUMBER HAS GROWN. RE-MEASURED TODAY: of 265 task items carrying both a state TAG and a state FIELD, TWENTY-EIGHT DISAGREE. It was thirteen on 2026-08-23. The title had gone wrong by then, and the mechanism was still live.

THE DIRECTION IS UNIFORM AND THAT IS THE REASSURING PART: all 28 are tag=done with a stale field -- 21 field=todo, 5 field=doing, 2 field=blocked. NOT ONE is the other way round. Every progress count ever reported to the owner reads the TAG, so no count was ever inflated; the field simply lags. The owner s ruling of 2026-08-23 is confirmed by the data rather than merely asserted: the values in those fields are stale leftovers from an earlier workflow, which is why five still say "doing".

AND IT IS GROWING, WHICH IS THE ACTUAL FINDING. Thirteen to twenty-eight in two days means some closing path still moves the tag and leaves the field. Find that path FIRST; a reconciliation pass that does not close the source will be needed again next week. (Verified in passing: `edit <id> --extra state=done` keeps them in sync -- every task closed by this reconciliation is absent from the 28.)

The rest of the instruction is unchanged and is right: one recorded pass through the real write surface, never by hand-editing frontmatter, so the audit log carries it. Print the 28 before and after. Then assert zero disagreements and KEEP the assertion -- that assertion is what stops it reaching 28 again.

CLOSED 2026-08-29. RE-MEASURED FIRST, with loadLayer and projectionMismatches -- the same classifier doctor reads, not a grep -- over 456 task items: 456 carry both a state TAG and a state FIELD, and ZERO disagree. Not one stale, duplicate, absent, unknown_value or unprojected finding, across all three of this category's projections (plan, seq, state) and across every other category as well. `mycontext doctor` agrees: 0 errors, 0 warnings. Thirteen on 2026-08-23, twenty-eight on 2026-08-25, ZERO on 2026-08-29. The corpus half was already settled by the passes of 2026-08-25 and 2026-08-26 (138 task items updated on the 26th alone, per the audit log); this pass verified it rather than repeating it, and there was nothing left to correct.

THE PATH THAT MOVED THE TAG AND LEFT THE FIELD IS FOUND, AND IT WAS THE STORE. `updateItem` (src/core/mutate.ts) projected ONLY when the call carried `extra`, and `handWrittenProjectionError` was wired into src/cli/commands/edit.ts and NOWHERE ELSE. So the CLI's `--tags` door was shut and the tool surface -- the one a model actually reaches -- was open in both directions. Measured by execution against src/mcp/server.ts on 2026-08-29:

  update_item({id, tags: [..., "state:done"]})  -> tag written "state:done", field left "state: todo",
                                                  doctor exits 1 on tag_projection_drift (stale)
  update_item({id, tags: ["v2","ui"]})          -> projected tag dropped, field still "todo",
                                                  doctor exits 1 on tag_projection_drift (absent)

That first line IS the growth mechanism. A tag-only write is the only thing that can produce tag=done against a stale field, and a field-only write cannot produce it at all -- which is exactly why all 28 pointed the same way and NOT ONE pointed the other. The same hole was open on the CLI in its `absent` form: `mycontext edit <id> --tags v2,ui` stored the list as typed and dropped the projected tag while the field kept its value, so a command that exited 0 left doctor red one line later. test/cli/edit-projection.test.ts had pinned that as correct.

FIXED AT THE SOURCE. `projectOntoTags` (src/core/tag-projection.ts) regenerates every projected tag in a REPLACEMENT list from the field it is projected from, and `updateItem` now calls it whenever the caller passes `tags` -- not only when it passes `extra`. The store RECONCILES rather than refusing, which is `createItem`'s own precedent: a command has two readings and a person to hand the choice back to, a store has neither, and the field is the store. A projection whose field is ABSENT is left exactly as written, because regenerating from a field that does not exist would delete the only copy of the value. Four assertions keep it: three in test/mcp/update-item-projection.test.ts (a hand-written tag is regenerated from the field; a dropped tag is restored; an unprojected tag is left alone) and the corrected one in test/cli/edit-projection.test.ts, each ending in a doctor run that must exit 0.

THE STANDING ASSERTION IS doctor ITSELF, and it is stronger than a test: `tag_projection_drift` is an ERROR, so any reappearance of this fails the gate on the real corpus rather than on a fixture. Gates on 2026-08-29: tsc clean; 5377/5378 tests pass, the one failure being `the twenty-one ledger kinds partition` in test/ui/simulate-screen.test.ts, which is another lane's in-flight UI work and touches nothing here; check:text-files, check:retired, check:test-glob and verify:citations all green; doctor 0 errors, 0 warnings, 60 notes (59 citation_form, 1 nested_corpus at my-context/.my_context, both expected).
