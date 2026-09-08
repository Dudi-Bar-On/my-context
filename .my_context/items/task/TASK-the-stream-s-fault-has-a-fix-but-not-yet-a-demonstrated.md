---
id: TASK-the-stream-s-fault-has-a-fix-but-not-yet-a-demonstrated
type: task
title: the stream's fault has a fix but not yet a demonstrated cause, and the keep-alive is a mitigation
status: active
severity: soft
always: false
summary: The live feed kept dying and the repair that was made is a sound one, but nothing has yet been caught doing the killing, so this records what was ruled out and what to look at next time it happens.
summary_of: 873224ce29384ff8
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
source_checksum: 7be3eb7cac19d681
valid_from: 2026-09-08
valid_until: null
checksum: 5fb700602c1626e6
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
