---
id: RULE-read-the-process-s-own-log-before-forming-any-hypothesis
type: rule
title: read the process's own log before forming any hypothesis about the process
status: active
severity: hard
always: true
summary: Read what a running program wrote about itself before guessing why it misbehaved; the answer is usually already sitting there on disk.
summary_of: d8bdf69b3a9496fa
scope: []
tags:
  - v2
  - agents
  - pinned-2026-08-23
origin: human
source_file: null
source_anchor: null
source_checksum: c3ad9b7454e4bc66
valid_from: 2026-08-23
valid_until: null
checksum: 4f5ce2f16a08b310
---

# read the process's own log before forming any hypothesis about the process

> Read the process's own log before you form any hypothesis about the process.
>
> Measured on 2026-08-23. A web server was reported as showing a blank page. It
> was investigated as a front-end defect and diagnosed at length. The server's log
> was two lines, and the second one was the whole answer:
>
>   mycontext ui: exited after 15 idle minutes.
>
> The same session had already been settled once this way: three wrong diagnoses
> of a lockout ended the moment the server's refusal log showed that
> `POST /api/handoff` had never been called at all.
>
> A process that writes a log is a process that has already told you what it did.
> Reasoning about it while that file goes unread is choosing a guess over a
> measurement that is sitting on disk.
>
> DO
> - Read the log FIRST, in full if it is short, from the end if it is long.
> - Check the process is still alive before diagnosing its behaviour:
>   `netstat`, a `ps` equivalent, or a request that must answer.
> - Quote the log line you acted on when you report the cause.
> - When you start something in the background, send its output to a file you
>   name, and read that file rather than re-deriving what it would have said.
>
> DO NOT
> - Diagnose a running system from its symptom alone when it keeps a log.
> - Assume a process is running because you started it.
> - Treat "it worked when I tested it" as covering a later report; measure the
>   state at the time being reported.
