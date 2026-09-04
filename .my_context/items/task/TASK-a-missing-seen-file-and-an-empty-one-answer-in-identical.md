---
id: TASK-a-missing-seen-file-and-an-empty-one-answer-in-identical
type: task
title: a missing seen file and an empty one answer in identical bytes so the screen says something false
status: active
severity: soft
always: false
summary: A session that was never recorded looks exactly like one that received nothing, so the screen confidently tells the reader something untrue.
summary_of: 1202daefd1d96c18
scope: []
tags:
  - v2
  - ui
  - injected
  - walk
  - "plan:walk"
  - "seq:111"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/collapse.md"
source_anchor: null
source_checksum: c7de387c5b4a3601
valid_from: 2026-08-29
valid_until: null
checksum: 3e9750c511b14dbb
plan: walk
seq: "111"
state: done
priority: "1"
source: "named by plan:walk seq:35, 2026-08-29"
---

# a missing seen file and an empty one answer in identical bytes so the screen says something false

> > Named precisely by `plan:walk seq:35` on 2026-08-29, in a read model that lane did not own.
>
> **The collapse**
>
> `readJsonlFile` swallows `ENOENT` (`src/core/jsonl-log.ts`), so `readSeen` answers a **missing** seen file and one that was **read and held nothing** in identical bytes. `apiInjected` passes that on verbatim, and the screen cannot tell the two apart.
>
> Those are exactly the two things `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` separates — and that standard says explicitly that its scope reaches read models, for this reason.
>
> **It is not hypothetical: seven of nineteen live sessions are in that shape.** `/clear` fires `SessionEnd`, `hooks/session-end.ts` calls `clearWindowState` → `clearSeen`, and the seen file is removed while the ledger and audit log are deliberately left alone, because the injection did happen. `rebuild`'s 30-day mtime sweep is a second producer.
>
> **The consequence is a false sentence on screen.** A cleared session is told *"This session was read and has received nothing yet."* Nothing was read. There was no file.
>
> **The fix, precisely**
>
> `InjectedBody` gains `seen: 'read' | 'absent'`, filled from `readSeen` **where the fact still exists** — an `existsSync` in the endpoint would be a second spelling of the same question, and a second spelling is how these two facts came apart in the first place.
>
> Then `screens/injected.js` draws a new key. The English is already drafted by the lane that found it:
>
>     inj.noSeenFile — "No seen file was written for this session, so nothing was
>     read here — the audit log may still record what it was given."
>
> **Done when**
>
> A cleared session and an empty one draw different sentences; a test drives the real `session-end` hook with `{reason: 'clear'}` and asserts the difference rather than asserting a non-empty output; and no caller re-derives the fact with `existsSync`.
