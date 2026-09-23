---
id: TASK-the-product-overwrote-the-repository-s-root-gitignore-with-a
type: task
title: the product overwrote the repository's root .gitignore with a lone star
status: active
severity: soft
always: false
summary: A private-state directory is supposed to get a one-line ignore file when it is created; one code path wrote that line into the project's own top-level ignore file instead, hiding every file in the repository from git.
summary_of: 70129feccb42373b
scope: []
tags:
  - "plan:release"
  - "seq:25"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-23
valid_until: null
checksum: f74b22ed7576b664
plan: release
seq: "25"
state: todo
---

# the product overwrote the repository's root .gitignore with a lone star

Found by lane 3.9 round 3 on 2026-09-23: the root .gitignore of this repository had been truncated to a single line, *, before the lane's session began; the lane restored it from HEAD. Earlier that day git add refused reports/V2-HANDOVER.md with paths are ignored: reports, which is this defect showing. The product writes a * .gitignore into .my_context/.audit, .my_context/state and siblings on first use (ensureLogDir in src/core/audit.ts:58, src/core/ledger.ts:764 and :1124, src/core/continuity.ts:349, and the lane counted seven candidate call sites); one of them resolved its directory to the repository root - the e2e frozen-corpus junction, MYCONTEXT_UI_SESSIONS_DIR pointing at the root, or a relative path resolved from the wrong cwd are the suspects. Closing condition: the call site is found with evidence (which path, which invocation), the write refuses any target that is not a directory the product itself created under .my_context (or the sessions dir it was given) and never a file that already has other content, a test plants each suspect condition and asserts the root .gitignore is untouched, and git diff shows .gitignore equal to its committed version after a full npm test and one e2e gate. Files: the seven call sites and their tests. Release phase 3 - a product bug that damages a user's repository is fixed before the phase closes.
