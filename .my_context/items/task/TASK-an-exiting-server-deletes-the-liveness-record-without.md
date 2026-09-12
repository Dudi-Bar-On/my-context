---
id: TASK-an-exiting-server-deletes-the-liveness-record-without
type: task
title: an exiting server deletes the liveness record without checking the record still names it
status: active
severity: soft
always: false
summary: A server shutting down erases the note that says where the CURRENT server is, so a live server becomes invisible and nothing puts it back when it dies.
summary_of: d21ca3bb46f86b82
scope:
  - src/ui/server.ts
  - src/core/ui-server-record.ts
  - src/core/ui-server-probe.ts
  - src/cli/commands/ui.ts
tags:
  - ui-server
  - upkeep
  - "plan:live"
  - "seq:26"
  - "state:done"
  - v2
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/clearbody.md"
source_anchor: null
source_checksum: 19e7c01ac446f986
valid_from: 2026-09-12
valid_until: null
checksum: 5cb27821155f4b4c
plan: live
seq: "26"
state: done
priority: "1"
---

# an exiting server deletes the liveness record without checking the record still names it

> MEASURED 2026-09-12 around 11:20-12:22Z, after the owner said the server was going down "again and again and again". IT WAS NOT DOWN. It was LISTENING on 58888 as pid 266860 and answering 200, and `~/.my-context/ui-server.json` WAS ABSENT. The product diagnosed itself exactly: "no liveness record ... but a server answered on the configured ui.port 58888, so here is a credential from it. The record is still missing: NOTHING ELSE CAN FIND THIS SERVER, SO THE UPKEEP HOOK WILL NOT PUT IT BACK AFTER IT EXITS." At 12:21:44Z it exited, and nothing put it back. That is the loop the owner has been living in.
>
> THE LINE, AND WHY IT IS WRONG. `src/ui/server.ts`:
>
>     server.once('close', () => { clearUiServerRecord(); });
>
> AN EXITING SERVER DELETES THE RECORD WITHOUT CHECKING THE RECORD STILL NAMES ITSELF. The file is ONE file per user, so when server A shuts down after server B has started and written its own record, A'S CLOSE HANDLER DELETES B'S RECORD. B is alive, serving, and invisible. Today that had at least three chances to fire: the restarts at 22:35 to 23:14 the night before, the hook-driven replacements this morning, and a probe server the dispatcher ran briefly on 58899 and then stopped.
>
> THE COMMENT ABOVE THAT LINE GUARDS THE OPPOSITE FAILURE, which is why nobody saw this. It argues at length that one `close` listener is better than a `clearUiServerRecord()` copied into each route, because copies drift and "a stale record does not look broken, it looks like a server somewhere else." Every word of that is about FORGETTING TO CLEAR. Nothing there considers CLEARING SOMEBODY ELSE'S.
>
> AND THIS EXACT CHECK ALREADY EXISTS ON THE OTHER SIDE OF THE SAME MECHANISM. `TASK-the-upkeep-stops-the-ui-server-before-it-knows-a-replacement` added, on 2026-09-11, a re-read of the liveness record immediately before the kill, declining with `replaced-elsewhere` if it no longer names the pid the probe proved. THE KILL PATH ASKS "IS THIS STILL MINE?"; THE CLEAR PATH DOES NOT. Same file, same week, same class of mistake, opposite end.
>
> WHAT THIS ASKS FOR:
>
> 1. `clearUiServerRecord` REFUSES UNLESS THE RECORD NAMES THIS PROCESS. Read it, compare `pid` -- and `port`, because a pid can be recycled -- and remove nothing otherwise. Where that check belongs is the doer's call: inside `clearUiServerRecord` itself makes it impossible for any future caller to get wrong, which is the argument the existing comment already makes about a single listener; a check at the call site leaves the function honest to its name. Argue it either way, but the DEFAULT must be safe.
>
> 2. A REMOVAL PROOF THAT A SECOND SERVER'S EXIT CANNOT ERASE A LIVE ONE'S RECORD. Two servers, the second writes its record, the first closes, and the record still names the second. Deleting the guard must turn that red at its own line.
>
> 3. THE THREE OTHER CALLERS MUST BE JUDGED, NOT ASSUMED. `src/core/ui-server-probe.ts` clears the record on a dead probe -- that one is CORRECT and must keep working, because it is clearing a record it has just proved stale. Say in the test which callers clear on purpose and which clear by accident.
>
> AND A SECOND DEFECT, FOUND IN THE SAME HOUR AND CHEAPER THAN IT LOOKS. The owner pasted a URL that "doesn't work". It worked; IT HAD EXPIRED. A starting server prints its URL carrying `OPENER_NONCE_TTL_MS`, TEN SECONDS, because that credential is meant to be spent by an automatic browser launch in milliseconds. `MINT_NONCE_TTL_MS` is 30 s and `PRINTED_NONCE_TTL_MS` is ten minutes. SO THE ONE URL A PERSON ACTUALLY READS OFF THEIR TERMINAL CARRIES THE SHORTEST LIFE OF THE THREE. If the launch fails, or the reader copies it, or looks away, it is dead. A printed URL a human is expected to click must not carry the opener's TTL -- either print the long-lived one, or say beside it that it is about to expire and how to get another. Owner ruling 2026-09-03 set the 30 s / ten minute split deliberately, so THIS IS A THIRD CASE THAT SPLIT DID NOT COVER, not a reversal of it.
