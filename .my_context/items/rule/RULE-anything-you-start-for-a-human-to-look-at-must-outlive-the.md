---
id: RULE-anything-you-start-for-a-human-to-look-at-must-outlive-the
type: rule
title: anything you start for a human to look at must outlive the work you do next
status: active
severity: hard
always: true
summary: If you start something for a person to look at, give it a life longer than the work you do next, and check it is still alive as you hand it over.
summary_of: bb3562bc21f3f394
scope: []
tags:
  - v2
  - agents
  - pinned-2026-08-23
origin: human
source_file: null
source_anchor: null
source_checksum: 9598931de40b50ca
valid_from: 2026-08-23
valid_until: null
checksum: 6d56561a8a82e0a9
---

# anything you start for a human to look at must outlive the work you do next

> Anything you start for a human to look at must outlive the work you do next, and
> you must confirm it is alive at the moment you hand it over.
>
> Measured on 2026-08-23. A UI server was started for the owner three separate
> times. Its default idle window is fifteen minutes, the work of finishing each
> change took longer than that, and nothing was touching its API in the meantime,
> so it reaped itself before the owner opened the URL. Every time. Each death was
> then reported as "the page is blank again" and investigated as a fresh defect.
>
> It also compounded a real one: a page that could not authenticate started no
> heartbeat, so it issued no request at all — the lockout starved the very timer
> that then killed the server, fifteen minutes later, in a different layer. One
> symptom, two causes, and the second looked exactly like the first.
>
> DO
> - Give the process a lifetime longer than your remaining work. For this project:
>   `mycontext ui --port 58888 --no-open --idle-ms 28800000`.
> - Verify it is listening and answering immediately before you hand over the URL,
>   and say in the handover that you checked.
> - Hand over a URL that works from a cold browser — for this UI, the freshly
>   printed nonce, because the nonce is one-shot and the previous one is spent.
> - If it must be short-lived, say so with the deadline in the same sentence as
>   the URL.
>
> DO NOT
> - Start a server, work for an hour, and hand over the URL you printed at the
>   start.
> - Assume a restart fixed anything for the human: their tab still holds the old
>   credential, and the server that issued it is gone.
> - Read "it is blank again" as a new defect before checking the process is alive.
