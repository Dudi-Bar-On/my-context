---
id: INSTR-testing-happens-against-the-current-corpus-and-an-exception
type: instruction
title: Testing happens against the current corpus, and an exception is asked for before it is taken
status: active
severity: hard
always: false
summary: Tests and verification run against this project real corpus rather than a fixture, and the one exception the owner approved is a private throwaway copy of that corpus, seeded with the single state a test needs and deleted afterwards.
summary_of: 00fd5531a76a4346
summary_was:
  - 2026-09-11 Tests and verification run against this project real corpus rather than a fixture, and any exception is approved by the owner in advance.
scope: []
tags:
  - dogfooding
  - testing
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-03
valid_until: null
checksum: eadb4588d052d538
---

# Testing happens against the current corpus, and an exception is asked for before it is taken

Owner ruling, 2026-09-03, in his own words: "all your tests would be on the current corpus because we are doing dog fooding, if you need an exception you should ask me first to approve".

WHAT CHANGES

Verification runs against this repository own corpus. Not a fixture, not a seeded demo workspace, not a copy made for the occasion. That includes the browser suite, which is hardwired to `.demo-corpus` today and therefore does not comply.

An exception is available and it is asked for FIRST. The asking is the rule: taking an exception and reporting it afterwards is the same as not having one.

WHY IT WAS RESTATED

It was already a requirement. `REQ-the-web-ui-is-dogfooded-against-this-corpus-and-the-e2e`, 2026-08-22, says it in the same words: this repository own corpus is what the UI displays and manipulates, not a fixture and not a seeded demo workspace. It was restated because a fix was declared landed on the strength of a green browser spec that ran against `.demo-corpus`, and the owner found the feature broken on his own screen within a minute of looking. A suite that passes on simulated data has proved something about simulated data.

WHAT IT DOES NOT LICENCE

It does not licence writing to the corpus to see what happens. The neighbouring rule about probes is about the SESSION rather than the corpus: a probe must not write injection or session records, because those become the newest rows and every latest-N reader believes them. Reading the live corpus, and running commands against it that a user would run, is the point. Manufacturing records in it is not.

THE DISTINCTION THAT MAKES BOTH TRUE

Verification asks does this feature work for a person, and can only be answered on the thing the person uses. A probe asks how does this mechanism behave, and its records are litter. The first belongs here. The second belongs in a temporary workspace.

THE EXCEPTION THAT WAS ASKED FOR, AND APPROVED — 2026-09-11

The owner approved one exception, in these words: "Each of those tests makes a private throwaway
copy of your corpus, puts the one thing it needs into the copy, runs, and deletes the copy. Your
real corpus is never touched."

IT IS RECORDED HERE SO A LATER SESSION DOES NOT HAVE TO REDISCOVER THAT IT WAS GIVEN. It was asked
for before it was taken, which is the rule this instruction is about, and the asking is what makes
it an exception rather than a breach.

WHAT IT COVERS, AND NOTHING WIDER. A browser spec that needs ONE state this corpus does not hold
today may copy this corpus, put that one state into the copy through the product's own commands,
serve the copy, and delete it when the test ends. Four states needed it, each measured on this
repository on 2026-09-11: a selection that overflows its budgets (`selection.spilled` is 0 here); a
review queue with something in it (`reviewQueue.drafts` 0, `pendingRevisions.revisions` 0); a doctor
finding whose remedy routes to `run` (all 78 findings route to `acknowledge`); and a session with a
real injection history to draw.

WHAT IT IS NOT. It is not the return of `.demo-corpus`, which was retired on 2026-09-07. It is not a
second corpus. It is not a fixture anybody maintains by hand. The copy is of THIS corpus - the same
items, the same ids, the same scale - and it is made per test and thrown away, so there is never a
second answer to "what is the app looking at". `e2e/seeds.ts` is the whole of what may be put into
one, and each seed says what it is for.

AND THE REAL CORPUS BEING UNTOUCHED IS AN ASSERTION, NOT A PROMISE.
`e2e/scratch-seeds.spec.ts` snapshots every authored byte under `.my_context/` - items, config,
revisions, staging - builds and drives a fully seeded copy, and requires the snapshot to be
byte-identical afterwards. A second test in that file proves the comparison can fail, by running it
over a tree that really changed. The shape is the one `test/ui/read-model.test.ts` already uses for
the read surface.

## Relations
- supersedes [[DEC-the-ui-is-developed-against-a-simulated-corpus-until-the]]
- supersedes [[TASK-give-the-demo-corpus-a-continuity-item-and-remove-the-two]]
- supersedes [[NOTE-what-the-fixture-must-hold-screen-by-screen-for-the]]
- supersedes [[NOTE-the-doctor-fixture-needs-findings-at-all-three-severities]]
