---
id: TASK-the-liveness-record-fails-silently-and-nonce-then-denies-a
type: task
title: the liveness record fails silently, and --nonce then denies a running server
status: active
severity: soft
always: false
summary: The file that lets a locked-out tab recover was never written and nothing said so, so the recovery route quietly does not work.
summary_of: 6802f1affe6c56c0
acknowledged:
  - state_unaudited@eb9c4e2a81df4600
scope: []
tags:
  - v2
  - ui
  - upkeep
  - "plan:upkeep"
  - "seq:7"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: ae493a13f603fcdc
plan: upkeep
seq: "7"
state: done
priority: "1"
source: found restarting the owner's server, 2026-08-28
---

# the liveness record fails silently, and --nonce then denies a running server

> Found 2026-08-28, immediately after restarting the owner's UI server.
>
> ## The state
>
>     server:            LISTENING on 127.0.0.1:58888, pid 5404
>     ~/.my-context/:    ui-sessions.json present (19:10), writable
>                        ui-server.json  ABSENT
>     mycontext ui --nonce:  "no server is running."
>
> `--nonce` discovers a live server through the liveness record `ui-server.json` (`core/ui-server-record.ts`, `RECORD_FILE`). The record was never written, so the command reports no server while a server is plainly listening.
>
> ## What made it worse than a missing file
>
> At startup the server DID report a sibling failure:
>
> > could not write `~/.my-context/ui-sessions.json` (EPERM … rename … .tmp -> …). The server still runs; a tab opened now will stop working when the server restarts.
>
> That disclosure is good — it names the consequence. **But `ui-server.json`'s failure was not reported at all**, and its consequence is arguably worse: `--nonce` is the documented recovery path for a locked-out tab, added the same day precisely so recovery no longer requires the restart that causes the next lockout. A silent failure disables the recovery path, and the person only learns of it when they need it.
>
> The EPERM itself was transient — the directory is writable, and the old process was still holding the file during the restart. That is ordinary on Windows. **What is not ordinary is that one of the two writes announces its failure and the other does not.**
>
> ## Two things to fix, and the second is the real one
>
> 1. **The liveness record's write failure must be disclosed**, in the same register as the sessions one: what failed, and what stops working as a result — name `--nonce` explicitly.
> 2. **A transient rename failure at startup should be retried before it is reported.** Both writes happen in the seconds after a restart, which is exactly when the previous process may still hold the file. A single retry after a short delay would have made both succeed here. Do not silently retry forever — retry once, then disclose.
>
> Worth considering as well: `--nonce` could fall back to a port scan or state its real conclusion, which is *"no LIVENESS RECORD was found"* rather than *"no server is running."* Those are different facts and only one of them was checked.
>
> ## Done when
>
> The liveness record's write failure is reported with its consequence named; a transient rename is retried once before being reported; `--nonce` distinguishes "no record" from "no server"; and a test drives the case — a record that cannot be written at start — and asserts both the disclosure and that `--nonce` says something true.
