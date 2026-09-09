---
id: TASK-the-stream-s-fault-has-a-fix-but-not-yet-a-demonstrated
type: task
title: the stream's fault has a fix but not yet a demonstrated cause, and the keep-alive is a mitigation
status: active
severity: soft
always: false
summary: The live feed kept dying and the repair that was made is a sound one, but nothing has yet been caught doing the killing, so this records what was ruled out and what to look at next time it happens.
summary_of: f4293ba8b7f09415
scope:
  - src/ui/watch-model.ts
  - src/ui/public/app.js
tags:
  - v2
  - ui
  - live
  - "plan:live"
  - "seq:22"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-my-context/595db3b1-a481-4553-b4c0-7248c31b2655/scratchpad/live22.md"
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: dc3fd4cb49e21512
plan: live
seq: "22"
state: done
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

── CAUSE FOUND 2026-09-09, AND IT IS OURS. `restartStaleServer`. ────────────────────────────

The upkeep DOES restart a server that is listening. `src/core/ui-server-upkeep.ts` -
`restartStaleServer` - replaces a server whose CODE IS STALE, and its own comment says so. I had
read the neighbouring sentence, "it does not restart a server that is listening but WEDGED", and
generalised it to "it never restarts a listening server". That was wrong, and it is the second
wrong root cause I gave this defect.

SO THE SEQUENCE IS: a commit lands -> the running server’s code is now stale -> the next Stop hook
calls `restartStaleServer` -> the restart calls `server.closeAllConnections()` -> every open stream
gets a clean FIN from the server.

EVERY OBSERVATION FITS, and none of them needed anything external:
  - the server holds FIN_WAIT_2 and the browser CLOSE_WAIT -> closeAllConnections on exit
  - six different pids across one night -> one per stale-code restart
  - down/up gaps of 5 s, 11 s, 6 s -> the restart itself
  - a longer gap 08:43:48Z to 08:52:03Z -> the server died with no turn ending, and came back on
    the next Stop hook, which is the respawn path rather than the restart path
  - "every few minutes" -> as often as somebody commits, which during this work was constantly

AND seq:21’S KEEP-ALIVE WAS SOLVING A PROBLEM THAT DOES NOT EXIST. Nothing external was reaping
anything, which is exactly why that lane could not reproduce a reaper over 11 and 14 minutes and
said so. Its measurement was right and my reading of it was wrong: I treated "could not reproduce"
as "not yet reproduced" and shipped a mitigation anyway. 20 seconds of keep-alive is 9 bytes a
minute buying nothing, and left in place it asserts a cause that is now measured false.

── WHAT THIS ITEM SHOULD NOW BUILD ─────────────────────────────────────────────────────────

THE DROP IS LEGITIMATE, FREQUENT AND SELF-INFLICTED, so the work is no longer to prevent it - it is
to RECOVER from it. Owner’s own instinct, 2026-09-09: "i think we need to refresh the page on the
same event we refreshing the status bar."

THE EVENT IS RIGHT AND THE ACTION IS NOT. plan:archive seq:22 already fires on
`visibilitychange` + `window.focus` at a measured 8-50 ms. Use that event. But do NOT reload the
page:
  - THE CREDENTIAL IS IN MEMORY, redeemed from a one-shot nonce, so a reload logs the reader out.
    He hit exactly this on the morning of 2026-09-09 and read it as the server being down while it
    was answering HTTP 200.
  - A RELOAD DISCARDS EVERYTHING seq:19, seq:22, seq:23 and seq:15 were built to protect: scroll
    position, open folds, the session being read, a marked passage, text in the filter box. Those
    four items exist to guarantee a reader is never moved; a periodic reload moves them on a timer.

SO: REOPEN THE STREAM ON THE LOOK TICK, not the page. And section 2 is not violated, which is worth
stating because it is the rule that froze `liveStop` in the first place: section 2 forbids SILENT
reconnection of a held-open stream, on the ground that it keeps the server alive for ever. A
reconnect fired by the reader looking at the tab is not silent, a hidden tab still asks for nothing,
and the connection it replaces was closed by OUR OWN restart rather than lost to the network.

ONE THING TO MEASURE RATHER THAN TRUST. `restartStaleServer`’s comment claims "the owner’s
already-open tab survives the restart anyway, because the new server honours previously issued
session digests out of `ui-sessions.json`". He LOST his credential on the morning of 2026-09-09 and
had to be handed a fresh nonce. So either that claim is false, or the digest survives while the
in-memory token does not and the page cannot use one without the other. That difference decides
whether this item ships "the feed comes back" or "you are logged out again", so measure it before
building.

AND REMOVE THE KEEP-ALIVE, or say why it stays. It is harmless, so do not rush it - but a constant
whose docblock explains a reaper nobody has ever observed is the kind of false explanation this
corpus spends items removing.

── BUILT 2026-09-09. THE LOOK TICK REOPENS THE STREAM, AND THE PAGE DOES NOT MOVE. ──────────

WHAT SHIPPED, in four pieces:

  - `src/ui/public/lib/heartbeat.js` gains `startLookTicks(doc, win, onLook)` and an internal
    `attachLook` that is now the ONE place `visibilitychange` and `focus` are named. `startHeartbeat`
    was rewritten onto it and behaves identically. A separate export rather than a fifth argument,
    because the heartbeat also runs on a 60 s SCHEDULE and a reopen carried on that beat would be
    the reconnection §2 forbids.
  - `src/ui/public/app.js` gains `reopenLiveStream()`, hung off that tick, gated on four things:
    a connection was opened at all, it has ENDED (`liveClosed`, set from `stream()`'s `onEnd` so a
    clean `done: true` recovers as surely as a thrown one), it had actually WORKED
    (`liveEstablished`, set by `hello` — a stream that was REFUSED is never retried, because
    retrying a refusal on every glance is one audited `ui-refused` write per glance), and
    `credentialHeld()`.
  - A new `hello` clears `liveEnded`/`liveProven` and hides the chip (`hideLiveState()`).
    seq:21's rule — clear the CLAIM, keep the RECORD — was written for a stream that never came
    back and is kept exactly where it applies; a fault replayed over a WORKING connection is the
    same lie in the other direction.
  - `screens/watch.js` clears its own `faulted` on a second `hello`, one line, because `faulted`
    gates `sayShown()` and would otherwise keep that screen on the fault sentence over a live feed
    while the shell's chip had already come down.

MEASURED, browser, both Playwright projects, `e2e/live-reopen.spec.ts`: from the reader looking at
the tab to a new `/api/watch/stream` request, 5 ms and 10 ms; to it answered, 27 ms and 36 ms. Zero
requests across three seconds of looking at a HIDDEN tab, which is the §2 half. A marker set on
`window` before the outage survives, and `location.hash` is unchanged — that is the assertion that
this is a stream reopen and not the page refresh the instinct asked for.

── THE CREDENTIAL MEASUREMENT. THIS ITEM'S PREMISE WAS WRONG, AND SO WAS MINE. ──────────────

This item said "THE CREDENTIAL IS IN MEMORY, redeemed from a one-shot nonce, so a reload logs the
reader out", and asked whether `restartStaleServer`'s claim to the contrary is false. MEASURED over
real HTTP, two servers on one ephemeral port, isolated sessions dir, the second started after the
first was killed, presenting what a page holds while it is NOT reloaded:

    header token (the in-memory one)     200 against server A     200 against server B
    mycontext_token cookie alone         200                      200
    GET /api/watch/stream                200                      200, answering with `hello`

    server B answering 368 ms after the kill

SO NOTHING ABOUT THE CREDENTIAL IS LOST. `restartStaleServer`'s comment is TRUE, and the design is
not what this item and `live/23` both describe: the token has been carried in an `HttpOnly`,
`SameSite=Strict` cookie since the owner's 2026-08-22 ruling (`src/ui/security.ts` — `TOKEN_COOKIE`),
and `core/ui-sessions.ts` keeps the DIGESTS of issued tokens so a later process honours them.
`e2e/app-restart.spec.ts` has proved the reload half in a browser all along.

WHAT WAS LOST IS THE STREAM AND ONLY THE STREAM — `closeAllConnections()` on the way out — which is
exactly what this lane built. So this ships "the feed comes back", not "you are logged out again",
and `live/23`'s option B is NOT needed for this defect. The owner's ruling stands unchanged and is
simply not reached.

ONE BOUND FOUND WHILE MEASURING, and it is the likeliest explanation of the morning he lost his
credential: `SESSION_MAX` is 64 and the store counts RESTARTS, not tabs. Sampled 2026-09-09 his
file was FULL and its 64 digests spanned 63.5 hours. `SESSION_TTL_MS` promises thirty days; a
development week delivers under three. A tab older than the last 64 restarts IS locked out.

── THE KEEP-ALIVE STAYS, AND ITS FALSE EXPLANATION DOES NOT ────────────────────────────────

Kept. Removing it would also remove the `keepalive` query parameter and the `test/ui/watch-e2e.ts`
assertion that reads a real comment off a real connection — a measurable property of the route —
and the one thing it still buys is that a connection blackholed WITHOUT a close is learnable at all:
the recovery above can only put back a connection the client knows has ended, and a FIN or an RST is
learnt at once while a blackhole is learnt only from a write that fails. Nothing on this machine has
been caught blackholing anything, so it is kept at nine bytes a minute on that footing and NOT on a
diagnosis. Its docblock has been rewritten to say so: the paragraph that offered "a silent socket is
what gets reaped" as the cause of the owner's drops is now marked wrong and kept as history.

── FOUND AND NOT FIXED ─────────────────────────────────────────────────────────────────────

See plan:live seq:24, which carries all four with their evidence: the feed's ordering after ANY
discontinuity (this is `resync`'s existing behaviour, not something the reopen introduced), the
64-restart session window above, `stream()`'s 401/403 path forgetting the stored token but not the
in-memory one, and `test/ui/open.test.ts` red on a `/api/ping` field another lane added the same day.
