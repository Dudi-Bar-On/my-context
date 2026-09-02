---
id: RULE-run-a-gate-the-way-the-project-runs-it-never-through-an
type: rule
title: run a gate the way the project runs it, never through an invocation you assembled
status: active
severity: hard
always: true
summary: Run the project's checks with the commands the project itself defines; a command you typed from memory can pass or fail for reasons all of its own.
summary_of: da6c0feb7fe139e9
scope: []
tags:
  - v2
  - agents
  - pinned-2026-08-23
origin: human
source_file: null
source_anchor: null
source_checksum: e08d521b7d72ee03
valid_from: 2026-08-23
valid_until: null
checksum: bcb3dc6f02a01277
---

# run a gate the way the project runs it, never through an invocation you assembled

> Run a gate the way the project runs it: through the script in package.json, never
> through an invocation you assembled yourself.
>
> Measured on 2026-08-23. The browser suite was run three times as
> `npx playwright test` from the repository root. That never loads
> `e2e/playwright.config.ts`, so it ran with no projects and none of the pinned
> context the suite depends on — and a colour-polarity assertion failed on a page
> that was correct. The real command is `npm run test:e2e`, which passes
> `--config e2e/playwright.config.ts`, and under it the same commit is green.
>
> The tool said so on the first attempt: asking for `--project=chromium` answered
> `Available projects: ""`. An empty project list is a config that was never
> loaded. That line was read as a quirk of the flag rather than as the answer.
>
> DO
> - Read `package.json`'s scripts and run the named one: `npm test`, `npm run
>   test:e2e`, `npm run typecheck`, `npm run check:*`.
> - If you must run a subset, keep the script's own flags and add a filter:
>   `npx playwright test <name> --config e2e/playwright.config.ts`.
> - Report the REAL exit code, captured with `$?` or `${PIPESTATUS[0]}` on the
>   command itself.
>
> DO NOT
> - Invent an invocation because it is shorter to type.
> - Pipe a gate through `tail`, `head` or `grep` and echo OK: the exit code
>   becomes the pipe's last stage, not the gate's.
> - Treat a green run from a hand-rolled command as evidence about the project.
> - Explain away a startup message from the runner. `Available projects: ""`,
>   `no tests found`, `0 files` are all the same sentence: you are not running
>   what you think you are running.
