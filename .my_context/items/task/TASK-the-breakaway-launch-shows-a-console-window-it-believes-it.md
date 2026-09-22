---
id: TASK-the-breakaway-launch-shows-a-console-window-it-believes-it
type: task
title: the breakaway launch shows a console window it believes it suppresses
status: active
severity: soft
always: false
summary: Starting the web server pops a black window onto the owner's screen, although the launch sets two separate flags that are meant to prevent exactly that.
summary_of: c0a55dca61f58b7f
scope:
  - src/core/ui-server-upkeep.ts
tags:
  - v2
  - ui-server
  - "plan:live"
  - "seq:27"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: d8a3616cf4de3677
plan: live
seq: "27"
state: done
priority: "1"
---

# the breakaway launch shows a console window it believes it suppresses

> OWNER REPORT 2026-09-13: "when you execute the server under a new process it opens a kind of cmd window, make sure it is minimized and not on top of my windows".
>
> HE IS SEEING SOMETHING THE CODE BELIEVES IT PREVENTS, and that is the finding. `startServer` (`src/core/ui-server-upkeep.ts`) launches through
>
>     cmd.exe /d /s /c start "" /b <node> <cli> ui --port N --no-open
>
> with `{ detached: true, stdio: 'ignore', windowsHide: true }`. `/b` means START WITHOUT CREATING A NEW WINDOW and `windowsHide: true` asks Windows to hide the `cmd.exe` process outright. Both are deliberate, both are asserted -- removal proof P3 of `live/25` reddens on dropping `windowsHide`, and P2 recorded that dropping `/b` FLASHES TWO CONSOLE WINDOWS FOR ABOUT 1.5 SECONDS. So the flags are present and tested and A WINDOW APPEARS ANYWAY.
>
> THE SUSPECT, TO BE MEASURED AND NOT ASSUMED: on Windows `detached: true` maps to `CREATE_NEW_CONSOLE`, which CREATES a console, while `windowsHide` maps to `SW_HIDE`, which asks for it to be hidden. The two are pulling against each other and the window may exist for the moments before it is hidden. `detached` may also be REDUNDANT here: `live/25` proved the breakaway comes from `start ""` itself -- its removal proof P2 showed the child SURVIVED `taskkill /T` even with `/b` dropped, because `start ""` breaks the parent chain on its own.
>
> WHAT THIS ASKS FOR, and the order matters because the last fix here was the fourth attempt:
>
> 1. REPRODUCE IT FIRST. Fire the real path and observe whether a window appears, how long it lasts, and whether it takes focus. A fix for a window nobody has watched is the fourth hypothesis, not the third.
>
> 2. THEN TRY THE VARIANTS AND KEEP THE ONE THAT SHOWS NOTHING. Candidates, not a design: dropping `detached` on the Windows branch alone, since `start ""` already breaks the chain; `/min` in place of `/b`, which gives a minimised window rather than none and satisfies the owner's literal ask if nothing else does; and launching without `cmd.exe` at all.
>
> 3. THE SURVIVAL PROOF IS THE CONSTRAINT AND IT MUST STAY GREEN. `live/25` exists because the hook's own watchdog kills its whole process tree with `taskkill /PID <hook> /T /F`, and the server went with it. THE TEST THAT PROVES THE CHILD OUTLIVES A KILLED PARENT IS NOT NEGOTIABLE: measured, the old shape died and the breakaway survived. Any variant that hides the window and loses that has made the product worse in the way that cost the owner a day.
>
> 4. AND THE OWNER'S FALLBACK IS EXPLICIT: if no variant is invisible, MINIMISED AND NOT ON TOP is acceptable. Do not spend a lane chasing perfection past his stated bar.
>
> THE POSIX BRANCH IS NOT IN SCOPE. It has no window and its own known hole is recorded on `live/25`.
