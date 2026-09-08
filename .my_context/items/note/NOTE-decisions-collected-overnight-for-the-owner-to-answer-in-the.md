---
id: NOTE-decisions-collected-overnight-for-the-owner-to-answer-in-the
type: note
title: decisions collected overnight for the owner to answer in the morning
status: active
severity: soft
always: false
summary: One place holding the questions that need the owner rather than a measurement, so work continues overnight and he answers a list instead of being interrupted.
summary_of: 82bf2a838dd70f95
scope: []
tags:
  - v2
  - process
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: beebb18b91d9776b
---

# decisions collected overnight for the owner to answer in the morning

Owner instruction 2026-09-09, just after midnight local: "go and do not stop until all D37 tasks
complete or is morning, at night i can not decide so if decisions required and not blocking collect
them for me to answer in the morning".

THIS ITEM IS THAT ONE PLACE. Every decision a lane surfaces overnight that is HIS rather than a
lane's is appended here with the evidence needed to answer it, so he answers a list in the morning
instead of being woken by a question or finding the answer assumed.

THE RULE I AM WORKING TO, so a reader can audit whether I applied it honestly:
  - A decision a lane can settle with a MEASUREMENT is a lane's. It measures and reports.
  - A decision that is a matter of TASTE, of what he wants the product to be, or that spends his
    money, his machine or his attention, is HIS. It comes here.
  - A decision that BLOCKS all remaining work stops the night. Nothing is currently in that class,
    and if something lands in it I stop and say so rather than guess to keep moving.

AND THE DEFAULT WHILE HE SLEEPS IS TO KEEP THE CHEAPER-TO-REVERSE OPTION. Where a lane must pick
something to make progress, it picks what is easiest to change in the morning, and the choice is
recorded here as provisional rather than presented as settled.

── OPEN, AWAITING HIM ────────────────────────────────────────────────────────────────────────

1. archive/26 - IS THE CODE COLOURING GOOD ENOUGH? He ruled "i'll try your recommendation first
   and see if it is good enough", so this verdict is his BY DESIGN and not an oversight. What he is
   judging: inline spans get a box, fences that declare a language get coloured, and the 345 of 370
   fences (93.2%) that declare NOTHING stay plain. If plain is not good enough, the next question is
   NOT whether to guess - it is whether those 345 are mostly ONE language, because a corpus that is
   90% shell is a case for DEFAULTING the language, which carries none of the risk of detection.
   That measurement is not yet taken and should be, before he is asked to choose again.

2. live/22 - IS THE STREAM STILL DROPPING? He reported "the stream refused to continue: network
   error" every few minutes. A 20 s SSE keep-alive shipped, but the lane could NOT reproduce a
   reaper: Node to Node alive at 11 minutes, headed Chrome alive at 14, and Defender is the only
   filter installed. So it is a mitigation, not a demonstrated cure. TWO THINGS ONLY HE CAN SUPPLY:
   whether the message still appears, and whether he has a VPN or Docker/WSL/Hyper-V adapters
   coming and going - Chrome tears down sockets including loopback on a network change, which a
   keep-alive does not prevent, and which fits "every few minutes" far better than an idle reaper.

3. archive/15 - HOW A LANE OPENS: second tab, or popup. The item leaves the shape open in his own
   words ("either as a popup window with the same renderer or a different way"). I told the lane to
   CHOOSE rather than ask, because he is asleep and it is reversible - so this is a decision he can
   overturn in the morning rather than one he must make. The lane's reasoning will be in its
   closure note.

── DECIDED TONIGHT BY LANES, LISTED SO HE CAN OVERTURN ANY OF THEM ───────────────────────────

(Appended as lanes report. Each entry names what was chosen, why, and what it would cost to
reverse - because the point of listing a provisional choice is that reversing it is cheap and
staying silent about it is not.)

── ALREADY RULED TONIGHT, RECORDED SO NOBODY RE-ASKS ─────────────────────────────────────────

  - The `cd` prefix in a fold summary STAYS. "i want to get the text exactlly as it occured on the
    terminal" - fidelity over the 160-char budget, so no stripping heuristic anywhere, even though
    ~46 characters of nearly every one of 1,934 over-cap Bash commands is that constant.
  - The command LEADS the closed fold, ahead of its description.
  - A synthetic turn's speaker follows WHO CAUSED IT: Subagent for the 175 lane completions, Shell
    for the 24 background commands, none for the 47 monitor/meta/compaction records, and YOU stays
    correct for the 23 slash commands because he typed those. Claude is never the answer.
  - Security is not being handled, at his instruction, and the finding stays local and uncommitted.
