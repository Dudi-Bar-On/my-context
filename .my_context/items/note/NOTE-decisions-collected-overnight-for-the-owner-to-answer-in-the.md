---
id: NOTE-decisions-collected-overnight-for-the-owner-to-answer-in-the
type: note
title: decisions collected overnight for the owner to answer in the morning
status: active
severity: soft
always: false
summary: One place holding the questions that need the owner rather than a measurement, so work continues overnight and he answers a list instead of being interrupted.
summary_of: 6bab3e0aa6e612a8
acknowledged:
  - body_disagrees_with_meta@87f777216d28f1c9
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
checksum: c824d5ecef1deed3
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

── ANSWERED 2026-09-09, ONE BY ONE, ON HIS OWN INSTRUCTION "let's answer one by one: ask recommend" ──

TWELVE PUT TO HIM, TWELVE ANSWERED. Ten confirmed what a lane had chosen; TWO changed it. That
ratio is worth recording rather than glossed: the lanes’ cheaper-to-reverse default was right ten
times out of twelve, and the two it got wrong were both about a READER’S OWN CONTEXT rather than
about the code - his timezone, and his ability to name his own sessions. Neither is a thing a
measurement could have settled, which is why they were on the list at all.

CONFIRMED AS BUILT:
  - Every shell command stays promoted, +80% outline accepted, because the walk time did not move
    and it is what lets the filter find a command by what it ran.
  - The pruned chip STAYS, after I explained the gap plainly and he confirmed a second time. His
    2026-09-07 ruling stands for rebuild time; the chip covers the up-to-one-turn window in which
    the row is served either way, and the only question was whether it explains itself.
  - A no-speaker synthetic turn gets NO heading, the literal reading of "or none".
  - A question row is headed Claude, because Claude composed it.
  - The verb is `persist`, with source values live / persisted / exported.
  - `--off` leaves the copy on disk.
  - The mirror advances on the Stop hook, 9-28 ms a turn.
  - No cap on the recovered 6.0 MB.

CHANGED BY HIM:
  - THE DATE FILTER MUST USE HIS OWN ZONE, not UTC days. Filed as plan:archive seq:37. This is his
    own timezone defect one surface over, and the list currently draws times in his zone while
    filtering dates in UTC - a row above and a control below.
  - SESSION NAMING IS WANTED after all. plan:archive seq:34 moves from "worth asking" to build:
    a name he sets wins over the harness’s, purely additive.

STILL OPEN, AND ONLY BECAUSE IT NEEDS HIS EYES RATHER THAN HIS OPINION: whether the code
colouring is good enough. He has not looked at it yet.

AND ONE ANSWER THAT IS A NON-ANSWER BY DESIGN: the stream. He chose "not sure, will watch it",
which is the correct answer to a mitigation whose cure was never demonstrated. plan:live seq:22
stays filed with the FIN measurement as the next step if the message returns.

── WHERE TO PICK UP, 2026-09-09 ──────────────────────────────────────────────────────────────

He is moving to his office and asked to pause after the running lane ends. plan:archive seq:17 (the
clipboard) is the only thing in flight; it will be verified, committed and closed, and then nothing
is dispatched.

THE QUEUE, IN ORDER, AND THE ORDER IS NOT A PREFERENCE - THREE ITEMS COLLIDE ON ONE FILE:

  1. seq:38   the colour / TUI refactor. Owns src/ui/public/styles.css and lib/markdown.js.
              This is the one he is waiting on: he judged seq:26 "not good enough" and the reason
              is measured - --edge is 1.71:1 against the transcript ground where WCAG asks 3.0:1,
              so the inline-code box AND every table frame are drawn in a border he cannot see.
  2. seq:40 + seq:41 as ONE lane. Both need src/ui/public/screens/conversations.js and seq:40 also
              needs styles.css, so it cannot run beside seq:38. Same subject either way: how a
              reader reaches a lane.

Everything queued needs conversations.js or styles.css, which is why nothing runs in parallel and
why seq:17 had to finish first.

AND ONE RULING TAKEN WHILE HE WAS ASKING, recorded so the lane does not re-open it: THE LANE ROSTER
IS A FLAT LIST WITH THE CHILDREN INDENTED, NOT A FOLDER TREE. Measured from the index: 218 lanes at
depth 1, 43 at depth 2, and only SEVENTEEN lanes have any children at all. A folder tree would be
261 rows of which 17 are folders and 244 are leaves, spending its expand/collapse affordance on
6.5% of the rows and putting the other 244 behind a level of nesting they do not need. The deciding
argument is that finding a lane is a SEARCH problem rather than a navigation one - seq:10 just built
that filter for sessions and a flat list inherits it, while filtering a tree either hides parents
whose children match or shows parents that do not. He was told this and left it open; it is cheap
to reverse if he wants folders.

STILL ON HIM, AND ONLY THESE:
  - Whether the colour refactor (seq:38) reads right once it lands. He has judged this surface
    twice and overturned me once, so seq:38 is instructed to screenshot a real dense turn of his
    own in both languages and show him BEFORE anything is committed.
  - Whether the stream still drops. "Not sure, will watch it" - plan:live seq:22 holds the FIN
    measurement for when it returns.
  - Folders instead of a flat roster, if he disagrees with the ruling above.
