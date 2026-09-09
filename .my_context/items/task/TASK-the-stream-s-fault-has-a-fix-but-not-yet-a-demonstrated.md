---
id: TASK-the-stream-s-fault-has-a-fix-but-not-yet-a-demonstrated
type: task
title: the stream's fault has a fix but not yet a demonstrated cause, and the keep-alive is a mitigation
status: active
severity: soft
always: false
summary: The live feed kept dying and the repair that was made is a sound one, but nothing has yet been caught doing the killing, so this records what was ruled out and what to look at next time it happens.
summary_of: c4009047765c6795
scope:
  - src/ui/watch-model.ts
  - src/ui/public/app.js
tags:
  - v2
  - ui
  - live
  - "plan:live"
  - "seq:22"
  - "state:todo"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-my-context/595db3b1-a481-4553-b4c0-7248c31b2655/scratchpad/live22.md"
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 9defd2b01fc543fd
plan: live
seq: "22"
state: todo
priority: "2"
---

# the stream's fault has a fix but not yet a demonstrated cause, and the keep-alive is a mitigation

> FILED BY THE plan:live seq:21 LANE, 2026-09-08, and it is a CORRECTION to that item's own root
> cause rather than a follow-on from it.
>
> WHAT seq:21 CONCLUDED. That `streamHandler` writes nothing to the socket through a quiet period -
> true, verified, and now fixed - and that "a silent socket is what Windows, an antivirus shim or any
> intermediary reaps", which is what made "every few minutes" read as a signature. That second half
> is the part that could not be reproduced.
>
> WHAT WAS MEASURED, on this machine, 2026-09-08, before the fix was written:
>
>   - NODE CLIENT -> NODE SERVER, loopback, a held-open GET response written to ONCE at open and
>     never again: ALIVE at 11 minutes, when the probe gave up. No close, no error, no end. Three
>     servers in one process - default settings, `requestTimeout: 0`, and default plus a 30 s
>     comment keep-alive - and the two silent ones behaved identically to the one being fed.
>   - Node's own `server.requestTimeout` is 300000 ms and `headersTimeout` 60000 ms at their
>     defaults, and `src/ui/` overrides neither. Neither fired: they bound RECEIVING a request, and
>     a GET is received in full before the response is held open. So the 5-minute number that looked
>     like "a few minutes" is not the mechanism.
>   - GOOGLE CHROME (the `chrome` channel, headed, real profile-less context) -> the same server,
>     two connections from one page, one silent and one fed a comment every 30 s: BOTH ALIVE at 14
>     minutes, when the probe closed the browser. Zero page-side events. The tab could not be made
>     genuinely hidden - Playwright gives each page its own top-level window, which
>     `e2e/conversations.spec.ts` measured four ways the same day - so the hidden-tab case is the one
>     variable this probe did NOT cover.
>   - No third-party network filter is installed to intercept loopback: Microsoft Defender only
>     (MsMpEng, MpDefenderCoreService), which does not proxy TCP.
>
> SO THE KEEP-ALIVE SHIPPED AS A MITIGATION, NOT AS A CURE, and it is worth keeping either way: a
> connection that carries zero bytes for hours cannot tell a live peer from a dead one, and every
> long-lived stream in this product has that property until it is given a heartbeat. It is 3 bytes
> every 20 s per idle tab. But nothing here has yet DEMONSTRATED a reaper, so if the owner still sees
> "the stream refused to continue: network error" after this lands, the cause is elsewhere and this
> item is where the next measurement goes.
>
> WHAT WOULD SETTLE IT, cheapest first:
>
>   1. WHICH SIDE SENT FIN. seq:21 recorded a half-closed pair - one end CLOSE_WAIT, the other
>      FIN_WAIT_2 - without recording WHICH pid held which. `netstat -ano | findstr 58888` at the
>      moment it next happens answers it: the FIN_WAIT_2 end is the side that closed first. Server
>      side means something in this repo or in Node ended the response; browser side means Chrome
>      did, and the search moves out of this codebase.
>   2. CHROME'S NETWORK-CHANGE TEARDOWN is the strongest remaining candidate and it is NOT something
>      a keep-alive prevents. Chrome tears down sockets - loopback included - on a
>      NetworkChangeNotifier event, which a VPN connecting, a Wi-Fi roam, or a virtual adapter
>      (Docker, Hyper-V, WSL) appearing and disappearing all fire. Short requests never notice,
>      because they complete between events; a held-open stream is the only thing on the page that
>      spans one. `chrome://net-export` captured across one occurrence names the error directly.
>   3. A SERVER RESTART would produce the identical symptom, and is easy to rule in or out. Observed
>      during this lane: the pid listening on 58888 changed once (147220 -> 210468) over about forty
>      minutes, and was then stable across four minutes of sampling. Once is not "every few minutes",
>      so this is recorded as ruled OUT for the reported frequency rather than as a finding.
>
> AND THE SECOND HALF OF seq:21 IS WHY THE OWNER'S EXPERIENCE IMPROVES EITHER WAY. He was not seeing
> many faults; he was seeing ONE fault many times, because nothing ever cleared it and every screen
> re-announced it. That is fixed independently of the cause: the chip now says the feed is not
> running - a state that stays true - instead of naming an error from a moment that has passed.

── THE FIN MEASUREMENT, TAKEN 2026-09-09. THE SERVER CLOSES THE STREAM. ─────────────────────

The owner reported the fault a second time - "the live feed is not running - reload to reconnect",
which is the NEW `watch.streamNotLive` wording, so the sticky-fault half of seq:21 is working and
the DROP is what recurred. This item asked for the one measurement seq:21 never took: which side
sent FIN. Taken:

    127.0.0.1:1148   -> 127.0.0.1:58888    CLOSE_WAIT     pid 18968   chrome.exe
    127.0.0.1:58888  -> 0.0.0.0:0          LISTENING      pid 184220  node.exe  (the server)
    127.0.0.1:58888  -> 127.0.0.1:1148     FIN_WAIT_2     pid 184220  node.exe

FIN_WAIT_2 is held by the SERVER and CLOSE_WAIT by the BROWSER. FIN_WAIT_2 means this side sent FIN
and had it acknowledged; CLOSE_WAIT means this side RECEIVED one. So the server sent FIN first and
the browser is the one that had not yet closed.

AND THAT ELIMINATES EVERY EXTERNAL HYPOTHESIS THIS ITEM WAS FILED TO TEST:
  - NOT Chrome’s NetworkChangeNotifier teardown - that would close from the browser side.
  - NOT a VPN, a Wi-Fi roam or a virtual adapter appearing - same reason.
  - NOT Windows or an antivirus shim reaping an idle socket - a reaper sends RST from outside, and
    it would not leave the server in FIN_WAIT_2.
  - NOT the keep-alive being absent. His server started 2026-09-09T08:29:58Z, after the keep-alive
    landed at 2026-09-08T21:00Z, so the running process HAS it. THE KEEP-ALIVE IS NOT THE CURE, and
    that is now measured rather than suspected.

IT IS A CLEAN FIN, WHICH NARROWS IT FURTHER. `res.destroy()` sends RST; a clean FIN with an ACK is
`res.end()`. There are exactly two `res.end()` calls in `streamHandler` and BOTH are the fault
path - the opening `tail.backlog()` throw and the per-tick `tail.poll()` throw.

BUT THE OBVIOUS CAUSE OF THAT THROW IS RULED OUT TOO. `AuditTail.poll()` throws on a damaged audit
line, and the log is clean: 8,511 lines, ZERO unparseable, and it ends with a newline, so there is
no partial last line for a tail to trip on. Rotation is also not it - the log rotates at about
8.39 MB (two segments on disk, 8,390,956 and 8,395,026 bytes) and the live file is 4,533,415, about
half way. And a rotation answers `resync: true` rather than throwing, by that method’s own
contract.

── SO WHAT IS LEFT, AND THE MOST LIKELY IS THE ONE NOBODY TESTED ────────────────────────────

THE seq:21 LANE PROBED SILENT STREAMS. Node to Node alive at 11 minutes; headed Chrome alive at 14.
Both were IDLE connections carrying no frames. THE OWNER’S STREAM IS BUSY - this corpus writes
audit rows continuously while he works, so his connection is sending `record` frames the whole
time. A busy long-lived response is a materially different case and was never measured. That is
where I would look first.

THE OTHER LIVE CANDIDATE is the top-level handler catch in `src/ui/server.ts` -
`if (res.headersSent) { res.destroy(); return; }` - which tears down any response whose handler
rejects after the head is written. It should not reach a stream, because `streamHandler` writes its
head and returns synchronously while the interval keeps the response open, so nothing is left to
reject. But it is the only other place a live response dies, and "should not" is not a measurement.

WHAT TO MEASURE NEXT, in this order:
  1. INSTRUMENT THE TWO `res.end()` SITES AND THE `res.on('close')` HANDLER. One line each saying
     which fired, with the error when there is one. This is a five-minute change that converts
     every remaining guess into a fact, and it should have been the first thing seq:21 did rather
     than shipping a mitigation.
  2. HOLD A BUSY STREAM OPEN, not a silent one - write audit rows into it at the rate this corpus
     really does - and see whether it dies where a silent one lived for 14 minutes.
  3. Only if both come back clean, look outward again.

AND THE MITIGATION SHOULD PROBABLY COME OUT IF THE CAUSE IS INTERNAL. A 20-second keep-alive on a
connection nothing external was reaping is 9 bytes a minute buying nothing, and it now sits in the
code implying a cause that has been measured false. Do not remove it before the real cause is
known - it is harmless - but do not leave it there afterwards as an explanation either.
