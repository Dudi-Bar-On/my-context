---
id: LESSON-a-grep-is-a-hypothesis-not-a-measurement-read-the-output
type: lesson
title: a grep is a hypothesis, not a measurement — read the output
status: active
severity: soft
always: false
summary: Searching output for the words you expect only proves your guess; to know whether something is said, read what it actually says.
summary_of: a1d954bf3d52d308
scope: []
tags:
  - v2
  - process
  - measurement
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 5f5323e823efc948
---

# a grep is a hypothesis, not a measurement — read the output

> **The controller filed a task against a tool for a defect it had introduced into its own measurement.** 2026-08-29.
>
> **What happened**
>
> `mycontext ready` prints 50 of 124 rows by default. Asked whether it discloses that, the controller ran:
>
>     mycontext ready | grep -iE "more|not listed|truncat|showing"
>
> and matched only a line about HELD tasks. It concluded the cap was silent, told the owner so twice, and filed `categories/23` — *"mycontext ready caps at 50 and does not say so"*.
>
> The command's actual output, read a day later:
>
>     119 ready; 50 shown. Raise the cap with --limit 119, or narrow it with --plan.
>
> The line says **"shown"** and **"cap"**. Neither is in the pattern. `--json` already carried `readyTotal`, `truncated` and `limit`; `todo` disclosed the same way; `decay` never had a cap at all.
>
> **Why this is the week's own lesson, arriving from the inside**
>
> Three gates were found this week measuring a PROXY instead of the property they were written for:
>
> * `screen-parity`'s settle loop read *"element count stopped changing"* as *"finished loading"* — but screens append cards synchronously and fill them when fetches resolve, so a half-drawn screen is stable.
> * Several `toHaveCount(0)` assertions were vacuous, satisfied by the instant before an async read returns.
> * The empty-band check measured a BOX and passed a 26px row containing no text — over its own docstring's words, *"a band of nothing is a missing element"*.
>
> This is the fourth, and the only one the controller wrote. The proxy was **"does the output contain the words I expect"** standing in for **"does it disclose"**. An absence of matches is the weakest evidence available: it cannot distinguish *the thing is missing* from *I guessed the wording wrong*.
>
> **What it cost**
>
> A task filed against a healthy tool; two false statements to the owner; and a wave of planning conducted against a number the tool had correctly disclosed. The real defect — that no test covered the DEFAULT cap, only `--limit 1` — was found by the implementer, not by the report, and it is the one that actually misled the planning.
>
> **The rule**
>
> **Read the output. A grep is a hypothesis, not a measurement** — it can only confirm the wording you already imagined. Where the question is "does this surface disclose X", the check is to look at what it says, not to search it for what you expected it to say.
>
> This has a sharper corollary for a controller directing agents: **an agent given a wrong premise will often spend its budget proving it wrong.** Two tasks tonight had drifted from the code, and both implementers verified before writing — which is the behaviour to reward, and the reason briefs should say "verify this before acting on it" rather than stating a symptom as fact.
