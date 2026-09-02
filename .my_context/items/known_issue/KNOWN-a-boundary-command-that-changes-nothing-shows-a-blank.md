---
id: KNOWN-a-boundary-command-that-changes-nothing-shows-a-blank
type: known_issue
title: a boundary command that changes nothing shows a blank confirm that says nothing
status: active
severity: soft
always: false
summary: When a command would change nothing, the confirmation shows an empty space instead of saying so, and a reader cannot tell that from a failure to look.
summary_of: c05657625b216af9
scope: []
tags:
  - v2
  - ui
  - execute
  - legibility
origin: human
source_file: null
source_anchor: null
source_checksum: 601e9bbb56238a3c
valid_from: 2026-08-27
valid_until: null
checksum: 8c1ee333b4176e81
---

# a boundary command that changes nothing shows a blank confirm that says nothing

> Since `plan:execute seq:5b`, a boundary command whose dry run changes no item
> gets a confirm containing the residual, the command, and nothing else. No diff
> table is drawn, and no sentence says why.
>
> Reported by the owner 2026-08-28 on the Doctor screen, whose command is
> `repair`. Measured the same day: `repair` derives in ~1.35 s with an effect of
> ZERO items, because the corpus is clean — every checksum was re-stamped earlier
> that day. So the confirm is correct and says nothing.
>
> **The defect is that silence is ambiguous, and this product has a rule about
> exactly that.** "This command changes no item" and "we could not show you what
> it changes" are different facts. The second is an `EffectRefusal` and never
> reaches this screen — the derivation refuses before a nonce is minted — so the
> blank IS trustworthy. But a reader cannot know that by looking, and the shape
> they are being asked to trust is the one the task called out: "an empty diff
> beside a command that changes something is the worst outcome available here."
>
> It is also a REGRESSION IN LEGIBILITY. Before 5b this command was refused
> loudly, with a sentence naming the reason. Now it succeeds quietly. The change
> is an improvement in capability and a loss in what the screen tells you, and the
> second was not noticed because every test asserted on the populated case.
>
> The fix is a sentence, not a mechanism: when the derived effect is empty, the
> confirm says so in the reader's own language — this command runs and changes no
> item — so the blank is a statement rather than an absence. `exec.noeffect` was
> retired in 5b and must not be revived: it said the command "does not run", which
> is now false and was the opposite claim.
>
> Not caught by a test because `command-actions.test.ts` drives boundary commands
> with a populated `effect`, and the empty case has no assertion at all. Whatever
> fixes this adds one.
