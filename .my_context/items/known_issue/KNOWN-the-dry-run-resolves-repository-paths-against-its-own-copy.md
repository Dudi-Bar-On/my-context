---
id: KNOWN-the-dry-run-resolves-repository-paths-against-its-own-copy
type: known_issue
title: the dry run resolves repository paths against its own copy, so add --file is falsely refused
status: active
severity: hard
always: false
summary: Previewing a command that names a file looks for it in a temporary copy, so it tells the person their file is missing when it is not.
summary_of: f8396eba0a304d3e
scope: []
tags:
  - v2
  - ui
  - execute
  - correctness
  - owner-blocking
origin: human
source_file: null
source_anchor: null
source_checksum: d3744f832ac6eb47
valid_from: 2026-08-27
valid_until: null
checksum: 2e0ce34b2b188466
---

# the dry run resolves repository paths against its own copy, so add --file is falsely refused

> `plan:execute seq:5b` derives a boundary command's effect by running it against
> a scratch COPY of the corpus, with the child's `cwd` inside that scratch. But
> `resolveWorkspace(cwd)` derives BOTH the corpus location and every
> repository-relative path from that one `cwd`. They are the same lever, and the
> dry run needs them pointed at different places: the corpus at the copy, the
> paths at the real repository.
>
> Reported by the owner 2026-08-27 from two live confirms, and reproduced:
>
>     add --file my-context/README.md
>       -> "my-context/README.md could not be read (no such file, or no
>           permission)... it is resolved relative to the directory you ran the
>           command in."
>
>     a reference capture
>       -> "...is outside this repository
>           (C:\Users\UserC\AppData\Local\Temp\myctx-effect-lySUnd)"
>
> The second names a TEMP DIRECTORY as the user's repository, which is how the
> defect was spotted.
>
> **Why this is worse than a missing feature.** It is a FALSE refusal. §3.2 says
> a command whose effect cannot be shown does not run, and that is sound when the
> effect is genuinely unknowable — but here the command runs perfectly well and
> the confirm says it cannot. The reader is told their file is missing when it is
> not, and pointed at a path they never typed.
>
> Blast radius is exactly one catalogue command: `add --file`, the sole
> path-bearing argument on a boundary command. `search --path` is below the
> boundary and never dry-runs.
>
> **Mitigated 2026-08-27, not fixed.** `execute-effect.ts` now refuses `--file`
> up front, in words that name the real limit — the copy does not contain the
> repository's files — rather than letting the child produce a message that
> blames the user's path. An honest refusal beats a wrong one.
>
> **The real fix is a decoupling, and it is the owner's call**, because it is a
> change to `resolveWorkspace` and not to the UI: the corpus directory and the
> path root have to be settable independently, which today means giving
> `findProjectRoot` an override it deliberately does not have. That override is
> a way for any caller to redirect where the corpus is read and written, so it
> is a security surface and not a refactor.
>
> Until then `add --file` is composable and copyable from the UI, and not
> executable.
