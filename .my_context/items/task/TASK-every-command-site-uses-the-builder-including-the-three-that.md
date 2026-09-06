---
id: TASK-every-command-site-uses-the-builder-including-the-three-that
type: task
title: the catalogue gains a runnable flag, and the three bypassing argvs move in without gaining Execute
status: active
severity: soft
always: false
summary: Separate drawing a form for a command from letting the server run it, so three hand-written commands can be described safely.
summary_of: 07d5e6d0902fb532
summary_was:
  - 2026-09-06 Make every place that offers a command use the one shared builder, starting with three that were hand-built and have drifted from it.
scope: []
tags:
  - "plan:builder"
  - "seq:7"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 60dc4857cfc81278
plan: builder
seq: "7"
state: done
needs: builder/5, builder/6, port/95
verified_on: 2026-09-06
---

# the catalogue gains a runnable flag, and the three bypassing argvs move in without gaining Execute

**RE-CUT 2026-09-06 under owner decision D4, and DONE in its new shape.** What this item asked for as one change was two, and only one of them was a refactor.

**WHY IT HAD TO BE RE-CUT**

As written it said "every command site uses the builder, including the three that bypass the catalogue" — `audit`, `init` and `procedure`. The composer architecture review (`docs/superpowers/specs/2026-09-06-composer-architecture-review.md` §2b) measured what that would have cost if taken literally: **presence in `PALETTE` was the entire execution licence.** `src/ui/execute-catalogue.ts` built its lookup from the catalogue and resolved anything it found, so moving those three argvs in — for no reason but to get their flag sets checked against the real parser, like every other command in this UI — would have handed all three `POST /api/execute` in the same edit.

One of the three is `procedure done`, the act this product reserves for its owner in its own printed words (`pr.w3`). It could not be run from this app at all, and the review found the reason was not a considered posture: it was which FILE the argv literal happened to live in. `OPENQ-the-three-proposed-screens-hold-the-only-command-blocks-in` had already named the hazard — that Execute must not be granted "as a side effect nobody weighed" — so this item, read literally, asked for exactly the thing that open question forbids.

**WHAT THIS ITEM IS NOW, AND IT IS FINISHED**

**Owner ruling D2, `reports/2026-09-06-PLAN.md`: split the two facts the catalogue conflated.** An entry-level `runnable` flag, read by `src/ui/execute-catalogue.ts`:

- being in `PALETTE` licenses a FORM — the Composer draws controls and composes a line a reader can read and copy;
- `runnable: true` licenses EXECUTION.

**An entry that omits the key is NOT runnable.** The default points the opposite way from `boundary`'s, deliberately, in the owner's words: *a mistake should withhold execution, never grant it.* Every one of the 27 entries that could already execute was marked `runnable: true` explicitly in the same pass, so an omission still means "nobody has ruled on this".

Then the three argvs moved in with `runnable: false`:

- `audit --files` — was a literal in Doctor's own `audit_log_size` remedy;
- `init --pack` — was `IMPORT_ARGV`, a module-level constant in `screens/packs.js`;
- `procedure done <id>` — was `doneArgv`, an array built per render in `screens/proc.js`.

**The executable set is identical before and after: the same 27 ids, pinned by name in `test/ui/execute-catalogue.test.ts` so that any future change to it is a ruling somebody made rather than a side effect.** What the three gained is the check they never had: `test/ui/palette-lib.test.ts` now feeds their composed argvs to the real argument parser, and the partition test holds the catalogue and the CLI registry to accounting for every command string between them.

A `runnable: false` entry renders its form and is refused execution in words a reader can act on — not a bare 404 — and both routes are stopped at `resolveCommand`, so no confirm dialog is ever drawn for a command that cannot run.

**WHAT IS NOT THIS ITEM, AND NEVER WAS**

- **Extracting the builder component** is `builder/5`. The renderer already exists in `screens/palette.js` (`controlSpecs`, `pickerOptions`, `controlFor`, `valueOf`, `missingRequired`); moving it to `lib/command-builder.js` and generalising Capture onto it is that task and is untouched here.
- **Flipping any `runnable` to `true`** is `OPENQ-the-three-proposed-screens-hold-the-only-command-blocks-in`, an owner ruling, per command. That is the second half of what this item used to bundle, and it is not "finishing builder/7" — it is answering the open question, which is what it actually is. The review's own read: `procedure done` probably earns Execute (`pr.w3` reserves the DECISION, not the click); `init --pack` very likely stays Copy-only permanently, because its effect is not on this corpus; `export` needs a prior ruling on whether a catalogue entry may write outside the workspace root at all.
- **The remaining screens.** The original coverage half — "then the rest, screen by screen" — was measured against a world where every site needed the catalogue to get Execute. It does not: `command-actions.js` is already adopted by all seven command sites, and the sites that still hand-build a value bag are `builder/5`'s work.

`export` is deliberately not moved. Its argv is filled in by the SERVER from a real export dry run rather than composed from a picker, and the review recommends leaving that pattern exactly as it is.

**THE ORIGINAL MEASUREMENT, KEPT**

`composeCommand` is called by capture, coverage, packs, palette, port, proc and work; `config.js`, `doctor.js` and `gaps.js` compose through `viewmodel.js`; and `audit`, `init` and `procedure` were built BY HAND inside screens, outside the catalogue and outside its test. Those three were the drift and they are closed.

Doctor's remedy block is correctly flagged as a legitimate SECOND MODE rather than an exception: it composes a command FOR a finding rather than from a user's choices, so the builder is prefilled and the check is a receipt rather than a gate.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order. VERDICT AT THAT TIME: STANDS. It stood; what it needed was splitting, not withdrawing.

**DEPENDENCIES, DISCHARGED**

`needs: builder/5, builder/6, port/95` was written for the coverage half. The schema move needed none of them and was landed without them: no component was extracted, no refusal was reworded, and the mockup was not touched (frozen by owner ruling). The narrowed item carries no dependency.

**LEFT FOR THE DOCTOR LANE**

`src/doctor/checks.ts` still holds `AUDIT_FILES` as `{ route: 'copy', argv: ['mycontext', 'audit', '--files'] }`. Repointing it at the catalogue id is one line plus one assertion in `test/doctor/state-unaudited.test.ts`, and it changes nothing a reader sees — a non-runnable id resolves to a null id either way — so it was left to whichever lane owns `src/doctor/**`, which was mid-edit in that file while this landed. A finding declaring its own remedy is `reports/V2-HANDOVER.md`'s design and stays regardless.
