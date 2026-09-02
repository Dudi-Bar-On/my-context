---
id: TASK-the-test-suite-reaches-the-developer-real-home-directory-and
type: task
title: the test suite reaches the developer real home directory and a file there is now gone
status: active
severity: soft
always: false
summary: The tests reached outside their sandbox into a real personal folder, and a file that lets an installation be undone has gone missing.
summary_of: 75c5024b182ea536
scope: []
tags:
  - v2
  - gates
  - tests
  - safety
  - walk
  - "plan:walk"
  - "seq:113"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/realhome.md"
source_anchor: null
source_checksum: 2685d5cdf41407dc
valid_from: 2026-08-30
valid_until: null
checksum: 494eff302bfc0b47
plan: walk
seq: "113"
state: done
priority: "1"
source: "reported by plan:walk seq:110 and seq:111, 2026-08-30"
---

# the test suite reaches the developer real home directory and a file there is now gone

> > Reported independently by two lanes on 2026-08-30, `plan:walk seq:110` and `plan:walk seq:111`, neither of which was looking for it.
>
> **What happened**
>
> `test/core/real-home-guard.ts` exists to catch tests writing outside their sandbox. It fired during suite runs, reporting activity against **`C:\Users\UserC\.my-context`** — the developer's REAL global directory, not a temp one.
>
> **`statusline-replaced.json` is gone from that directory.** It was present and 29,701 bytes on 2026-08-27; it is absent now. Nothing in this project's git history holds a copy, because the file lives outside both repositories.
>
> **What it held, and how bad the loss is**
>
> `statusline-install.ts` writes it: a map, keyed by settings path, of the statusLine setting mycontext replaced — the thing `statusline uninstall` reads to put a user's original back.
>
> Two facts bound the damage, and both should be stated rather than assumed:
>
> * The owner's live `~/.claude/settings.json` currently reads `{"type":"command","command":"node \"C:/Users/UserC/.claude/hooks/gsd-statusline.js\""}` — a different plugin's status line, intact and plausible as the genuine setting. **Nothing observable is broken today.**
> * **29,701 bytes is very large for that map**, which strongly suggests it accumulated entries across many runs rather than holding one precious backup. That is itself evidence for the defect: tests have been reaching the real home for some time.
>
> **Why it is priority 1 regardless of this outcome**
>
> A test suite that can write to and delete files in a developer's home directory is a defect of a different class from anything else in this corpus. This time the casualty was a backup file whose loss appears harmless. The same reach could take `~/.claude/settings.json` itself, and the guard that noticed only reports — it does not prevent.
>
> It also poisons the suite: while the stray file exists, `real-home-guard` reddens **arbitrary unrelated tests**, which is why two lanes saw a shifting set of 15 then 19 failures over different tests in consecutive runs. Anyone reading that as flakiness will start ignoring the guard.
>
> **The likely reach, to be confirmed rather than assumed**
>
> `test/cli/f2-registry.test.ts` spawns `install --settings <temp>` and **does not redirect HOME** — `statusline-install.ts`'s own docblock records that this once made a test's outcome depend on the developer's machine, and the fix keyed the map rather than sandboxing HOME. `--settings` isolates which settings file is touched; it does not move `ws.globalRoot`, which is where the backup is written.
>
> **Done when**
>
> No test can write outside its sandbox — HOME redirected for every spawn that could reach `globalRoot`, not only for the ones observed doing it; `real-home-guard` FAILS the run rather than reporting into it; and a test asserts the guard fires on a deliberate escape, so the guard itself is not the next thing measuring nothing.
