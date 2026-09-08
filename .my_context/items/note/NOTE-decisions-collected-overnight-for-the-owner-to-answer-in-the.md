---
id: NOTE-decisions-collected-overnight-for-the-owner-to-answer-in-the
type: note
title: decisions collected overnight for the owner to answer in the morning
status: active
severity: soft
always: false
summary: One place holding the questions that need the owner rather than a measurement, so work continues overnight and he answers a list instead of being interrupted.
summary_of: ad64a5f06cd2a752
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
checksum: 906601740e923b1d
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

── OBSERVED OVERNIGHT, NOT A DECISION ────────────────────────────────────────────────────────

HIS UI SERVER ON 58888 WENT DOWN AT 22:31:48Z AND DID NOT COME BACK. It had been up since
21:01:04Z as pid 111064, so about ninety minutes. Two earlier transitions the same evening were
restarts that recovered in 5 s and 11 s with a fresh pid; this one did not.

I DID NOT RESTART IT, and will not: the standing instruction is that the server on 58888 is his and
no lane or session may kill, replace, restart or bind to it. Starting one for him would be the same
act as killing one.

IT DOES NOT AFFECT THE WORK. Every lane and every check runs `startUiChild` on an ephemeral port,
so nothing overnight depended on it. What he loses is only his own open browser.

IDLE EXIT IS NOT THE EXPLANATION: `IDLE_MS` in `src/ui/idle.ts` is eight hours. So the cause is
outside the product - a machine sleep, a closed terminal, or something ending the process. I cannot
attribute it from here, and I am NOT claiming a lane did it: both running lanes were instructed not
to touch that port and both earlier lanes reported they never did. If he did not stop it himself,
that is worth knowing, because the only remaining explanations are his machine or a lane breaking a
standing rule.

── ITEM 1 SHARPENED: WHAT HE IS ACTUALLY JUDGING ON THE COLOURING ───────────────────────────

The colouring landed and the verdict is still his, but the lane took the measurement this note
said to take BEFORE asking him a second time, and it points the OPPOSITE way from my guess.

I wrote that if plain untagged fences were not good enough, the next question was whether those
fences are mostly ONE language - because a corpus that is 90% shell is a case for DEFAULTING the
language rather than guessing it. Hand-classified by first line: OF THE 160 UNTAGGED FENCES, AT
MOST 19 ARE CODE OR A COMMAND IN ANY LANGUAGE. The rest are command output, aligned ledgers,
timelines and counts tables - a column of numbers, a progress bar, a types histogram.

SO THE UNTAGGED MAJORITY IS NOT ONE LANGUAGE. IT IS MOSTLY NOT A LANGUAGE AT ALL. Both detection
and defaulting would paint a table of counts as though it were source, which is worse than leaving
it plain. That closes the escape hatch I had left myself: if he says plain is not good enough, the
answer is NOT to guess harder - it is that the ~19 real ones want a language tag written into them
at authoring time, which is my habit to change and not the product.

AND MY FENCE COUNT WAS DOUBLE. 185 fenced blocks, not 370 - my per-line scan counted every closing
fence as a block. Tagged is 25 either way, so untagged is 86.5% rather than 93.2%.

ALSO WORTH KNOWING BEFORE HE JUDGES: part 1 of that item was already built. I had read the wrong
renderer - the archive draws through markdownNodes, whose inline code has carried the box since the
renderer was vendored. So what he saw as "no colour" was a box with no HUE, not an unstyled span,
and what changed tonight is the fenced blocks and their label, not the inline spans.

── DECIDED TONIGHT BY LANES, LISTED SO HE CAN OVERTURN ANY OF THEM ───────────────────────────

  A. A LANE OPENS IN A NEW TAB, as a real anchor, not a popup and not an in-tab restore. Reversing
     it costs a landing mode and a fourth stickUntil setter, which is why it was chosen: the
     document is never unmounted, so the reader position is NOT RESTORED, IT IS NEVER LOST.
     Measured on his own corpus: scrollTop 299,226 before and after, same 18 rows, fold still open.
  B. SYNTAX COLOURING IS HAND-WRITTEN, not vendored. highlight.js was actually fetched and measured
     at 49,091 bytes across nine files with nine SHA pins, and it WOULD have passed check:vendor -
     so this was proportion, not admissibility. Reversing it is adopting those nine files and their
     upgrade ritual.
  C. UNTAGGED FENCES GET NO MARK AT ALL, and the label appears only on the 25 that declared a
     language, so "coloured" and "declared" are visibly one set. Reversing it is one rule.
