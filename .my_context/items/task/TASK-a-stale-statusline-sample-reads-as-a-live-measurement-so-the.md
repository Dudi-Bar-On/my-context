---
id: TASK-a-stale-statusline-sample-reads-as-a-live-measurement-so-the
type: task
title: a stale statusline sample reads as a live measurement so the handover ask never fires
status: active
severity: soft
always: false
summary: An old reading is treated as current, so nothing notices the context is nearly full and the handover is never written.
summary_of: e8de3e40b02225c9
acknowledged:
  - citation_form@b97a439e9a2e4fc0
scope: []
tags:
  - v2
  - hooks
  - handover
  - ui
  - walk
  - "plan:walk"
  - "seq:123"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/stale.md"
source_anchor: null
source_checksum: null
valid_from: 2026-08-31
valid_until: null
checksum: 5bad92406f714367
plan: walk
seq: "123"
state: done
priority: "1"
source: owner report, 2026-08-31
---

# a stale statusline sample reads as a live measurement so the handover ask never fires

> > Found 2026-08-31, after the owner reported the strip showing **60.1%** while their real occupancy was **~100%**.
>
> **The measurement**
>
>     tee receivedAt   2026-08-30T05:54:54Z      29 hours old
>     strip shows      context 60.1% ... as of last response, 27h ago
>     real occupancy   ~100%
>     handover latch   asks: 0, askedAt: null, window opened 2026-08-29
>
> **The cause: `readOccupancy` has no staleness check.**
>
> It carefully distinguishes three unmeasurable reasons — `no-bridge` (the directory is absent), `no-sample` (the file is missing or unreadable), `unknown-shape` (the payload does not carry the fields). **A 29-hour-old sample is none of them.** The directory exists and the file parses, so it returns a *measured* percentage.
>
> **The consequence is not cosmetic.** `src/hooks/stop.ts` · `const occupancy = readOccupancy(root, sessionId);` · ~260 calls `readOccupancy`, compares the result against `handoverThresholdPercent()` (98, unset so defaulted), reads 60.1, and concludes no ask is needed. **The handover ask has never fired this session** — `asks: 0` — while occupancy sat far past the threshold. The mechanism that exists to protect continuity across a compaction is silently off, and every surface reports it as working.
>
> **Why the fossil exists at all, which is the part nobody would guess**
>
> The bridge is NOT installed — `~/.claude/settings.json` runs `gsd-statusline.js`. The single sample was written on 2026-08-30 when `plan:walk seq:107`'s approval-boundary probe ran `statusline install --yes` against the real machine. The install was reverted and the settings file restored byte-identical, **but the tee sample it produced was left behind.** So the state is: no bridge, and one reading that looks live.
>
> **The irony is exact and worth keeping.** Those three reasons were designed to stop a single `null` collapsing distinct absences — the same measured-zero-versus-unmeasured discipline that runs through this corpus. **They enumerate every way the bridge can be MISSING and none of the ways a reading can be WRONG.**
>
> **What must be decided, not assumed**
>
> * **What age makes a sample unusable?** It is a function of how often Claude Code calls the status line — every message — so any sample older than a few minutes means the bridge is not running. But pick the number deliberately and put the reasoning beside it.
> * **Is a stale sample a fourth `why`, or is it `no-sample`?** A fourth reason a caller can act on differently (*the bridge stopped*) is worth more than folding it into an existing one — and `context-occupancy.ts`'s own docblock argues against adding reasons nobody can act on differently, so this one must earn its place.
> * **What does `Stop` do when occupancy is unmeasurable?** It already has `occupancyStandDownLine`, so the path exists. Confirm a stale reading takes it rather than the measured path.
> * **The strip must not draw a fossil as a figure.** It already discloses age and that was not enough — the owner read 60.1% as current, which is the correct way to read a number presented as a number.
>
> **Done when**
>
> A sample older than the chosen bound is unmeasurable and says which reason; `Stop` stands down rather than comparing a fossil against a threshold; the strip does not render a stale reading as a live percentage; and a test drives a deliberately aged sample through both the hook and the strip.
