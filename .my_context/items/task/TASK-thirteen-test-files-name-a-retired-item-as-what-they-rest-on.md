---
id: TASK-thirteen-test-files-name-a-retired-item-as-what-they-rest-on
type: task
title: thirteen test files name a retired item as what they rest on
status: active
severity: soft
always: false
summary: Thirteen tests declare that they depend on a rule or decision that has since been retired, so the declaration no longer points at anything that governs; each must name the successor or say it rests on none.
summary_of: 4e25eabb20277c42
scope: []
tags:
  - "plan:release"
  - "seq:21"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-22
valid_until: null
checksum: d5458e67ed5e835d
plan: release
seq: "21"
state: todo
---

# thirteen test files name a retired item as what they rest on

Measured 2026-09-22 by npm run check:basis (release phase 3): RETIRED reported, not gated, for test/core/audit-tokens.test.ts, test/core/carried-index.test.ts, test/core/conversation-search.test.ts, test/core/inject-subagent.test.ts, test/core/select.test.ts, test/e2e/reduce.test.ts, test/hooks/session-start-clear.test.ts, test/hooks/session-start-restore.test.ts, test/hooks/subagent-start.test.ts, test/mcp/tools.test.ts, test/rules/lane-still-gets-the-no-git-rule.test.ts, test/ui/read-model.test.ts, and one more the script lists (thirteen in all). Some cite RULE-a-delegated-worker-runs-no-git-command-that-touches-the, superseded by RULE-a-delegated-worker-never-runs-a-command-that-reaches-beyond; others cite items retired in release phase 2. RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none is the rule: a basis that names a retired item names nothing. Closing condition: every @basis line in the thirteen files names the successor of each retired id (follow superseded_by) or drops it with the reason in the comment; npm run check:basis reports zero RETIRED; the change touches only the basis lines and their comments. Same class as rulings/115 (documents citing retired items); release phase 8, beside task 8.1.
