---
id: KNOWN-one-unrecognised-extra-discards-every-valid-field-in-the
type: known_issue
title: one unrecognised --extra discards every valid field in the same edit, and the command reports that it re-stamped
status: active
severity: soft
always: false
summary: An edit carrying a good field and a bad one applies neither, and says it succeeded.
summary_of: ec75141ca90cd2f6
scope:
  - src/cli/commands/edit.ts
  - src/core/mutate.ts
  - test/**
tags:
  - v2
  - silent-failure
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: 2e5466f0f5678588
---

# one unrecognised --extra discards every valid field in the same edit, and the command reports that it re-stamped

MET BY THE MAIN SESSION ON 2026-09-17 WHILE BRINGING A STALE BOARD UP TO DATE, and reproduced.

Two `--extra` flags in one call, one of them a field the category does not declare:

    mycontext edit <id> --extra needs=semantic/16 --extra state=todo --yes
      → "re-stamps the basis without new text and records in the audit log that nobody rewrote it."
      → `state` UNCHANGED. `needs` unchanged. Exit 0.

    mycontext edit <id> --extra state=todo --yes
      → applied.

**`state` IS A VALID FIELD AND IT WAS DISCARDED BECAUSE SOMETHING ELSE IN THE SAME CALL WAS NOT.**

── WHY THE MESSAGE IS THE WORST PART ───────────────────────

*"re-stamps the basis without new text"* is a SUCCESS message — it is what this command correctly
says when a person re-runs an edit that changes nothing. Here it is said about an edit that was
ASKED to change something and did not. **"Nothing to do" and "I could not do what you asked" are
the same answer today**, which is `nothing-to-do-and-could-not-look-are-different-answers` in the
write path rather than the read path.

AND IT IS SILENT ABOUT THE CAUSE. Nothing names `needs` as unrecognised. A caller who does not
already know the field list sees a success and a tree that did not move, and the natural next
conclusion is that the item was already in the state they asked for.

── WHY IT MATTERS MORE THAN A CLI PAPERCUT ───────────────────

This is how a BOARD GOES STALE while someone is actively fixing it. The owner’s words the same
day: *"we are running after our tail all the time - stop it."* Two items sat `blocked` with their
`needs` already satisfied because an edit meant to repoint them reported success and did nothing.

── WHAT WOULD FIX IT ─────────────────────────────────

  1. **REFUSE THE WHOLE EDIT AND NAME THE UNRECOGNISED FIELD**, listing what the category does
     declare. Refusing is right; refusing SILENTLY is the defect. The flag parser already knows
     the field list — it is what decided to drop it.
  2. Failing that, **apply the valid fields and warn loudly about the rest** — but pick one. What
     must not survive is a third behaviour that looks like the success case.

HOLD IT WITH A PROOF: an edit carrying one good and one unknown `--extra` must either change the
good field or exit non-zero. **It must not exit 0 having changed nothing** — and that assertion
goes red against the build as it stands today, which is what makes it worth writing.

AND CHECK `needs` WHILE YOU ARE THERE: it is a real frontmatter field that `ready` computes from,
and there appears to be no supported way to edit it at all. If that is deliberate, say so in the
refusal; if it is an omission, it is the reason this was met.

## Request

file and dispatch whatever you can also fix the "The board is stale (/99, /102, /103, /104, /105, /107 all shipped today but still read todo because nobody advanced them). Here's the true state:" update from todo to done not only these but everything else that is not updated, we are running after our tail all the time - stop it. also "The capability repair introduced 15 new false" then you told me it was error and there is not 15 so decide which and in general work sequentially until you close all the documentation actions except the hebrew then it will be the last and final - i do not want to continue mess with this so do a deterministic mechanism to close them on by on and report me when it's done
