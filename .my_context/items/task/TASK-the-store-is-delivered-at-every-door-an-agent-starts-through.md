---
id: TASK-the-store-is-delivered-at-every-door-an-agent-starts-through
type: task
title: the store is delivered at every door an agent starts through, and the delivery is recorded
status: active
severity: soft
always: false
summary: The product rules reach every worker that starts, and the system can prove they arrived rather than assume it.
summary_of: f7a88f1fe48e1a90
acknowledged:
  - task_unverified@bca51e8afed1b817
scope:
  - src/rules/**
  - src/hooks/**
  - test/rules/**
tags:
  - v2
  - store
  - "plan:store"
  - "seq:2"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-10
valid_until: null
checksum: e811263de1fabf74
plan: store
seq: "2"
state: done
priority: "1"
needs: store/1
---

# the store is delivered at every door an agent starts through, and the delivery is recorded

D41 PHASE 2, BUILT 2026-09-11. Plan: docs/superpowers/plans/2026-09-10-d41-product-rule-store.md Tasks 6-8. Design: docs/superpowers/specs/2026-09-10-product-rule-store-design.md sections 8 and 9.

NOTHING CAN INSPECT A CONTEXT WINDOW, so "verify it is in memory" is not the deliverable. What is verifiable is that we injected at every door and none was missed: each injection is RECORDED and a later hook ASSERTS the session has had one.

WHAT WAS BUILT. src/rules/deliver.ts renders the applicable set -- every part name taken from schema.ts TEMPLATE so no part is named twice, and `request` is absent STRUCTURALLY rather than by a filter, because a filter is a list somebody forgets to extend. src/rules/delivered.ts appends one row per door to .my_context/.rules/delivered.jsonl and answers the assertion. Three doors deliver: session-start, compact-restore (the same hook, recorded apart) and subagent-start. Two hooks assert: pre-tool-use at the first tool call, pre-compact at the last moment before a window is rebuilt.

THE DOOR THAT CARRIES THE WEIGHT IS SUBAGENT-START, measured over 36,024 audit records: 1,082 subagent-start against 54 session-start, 23 compact-restore. It is keyed on ledgerKey -- session::agent -- never on the bare session id, or a delivery to a child would tell the assertion its parent had been delivered to.

THREE THINGS MEASUREMENT CONTRADICTED, and each changed the build.

ONE: PRECOMPACT IS NOT A DOOR. Section 8.1 lists it. Read off Claude Code build 2.1.261, the PreCompact consumer takes each hook's stdout and returns it as `newCustomInstructions` -- the brief the COMPACTION runs under, and it REPLACES the `custom_instructions` the payload arrived with, i.e. whatever the user typed after /compact. Delivering there would hand a summariser a page of product rules and silently discard a user's instruction. The window after a compaction is opened by SessionStart(source: compact), which IS a door and already delivers. PreCompact became the second ASSERTION site instead, and it is the only one that sees a session whose every tool call was a Bash -- PreToolUse is registered under Read|Edit|MultiEdit|Write|NotebookEdit|Agent and never fires for one.

TWO: THE ASSERTION MAY NOT SPEAK TO THE MODEL. The first draft folded the sentence into additionalContext and reddened five tests whose subject is a property worth more than the disclosure: pre-tool-use says NOTHING about a file it has no opinion on. The person, not the model, can fix a door that did not run -- the fix is a hook registration or a permission -- so the sentence goes to stderr and the durable half is the row. PreCompact writes neither stderr nor stdout: that file already ruled that a compaction is the one moment where an unsolicited paragraph of ours competes with Claude Code's own notice. Its verdict rides in the audit row it was already writing.

THREE: A MISS WITH NOTHING TO MISS IS RECORDED AND NOT REPORTED. Reporting unconditionally reddened a test asserting the hook's stderr is empty, in a sandbox where the shipped store's only entry is developer tier and applies to nothing -- which is the state of every sandbox in the suite and every stranger's install until the store carries its first product entry. The row is still written, because "no door ran for this key" is the fact section 8.2 asks to be countable; the sentence is withheld, because a check that cries wolf is a check people turn off.

PRECEDENCE. A product entry wins and the conflict is REPORTED -- both halves asserted, because a silent win teaches a reader their own rule is being obeyed when it is not. A conflict is an EXACT slug match between an entry id and a corpus id with its category prefix stripped, which is precisely the pair migration will produce at plan:store seq:4 and nothing that merely rhymes. The losing item is not deleted, hidden or rewritten. The corpus ids reach the check through a new Injection.deliveredIds, because test/rules/isolation.test.ts forbids core/inject.ts from importing src/rules/ at all.

STD-the-precedence-order-when-four-sources-of-truth-disagree gained the fifth source in the same act, through the CLI, numbered 0 so every position below it keeps the number it has had since 2026-08-25.

TWELVE REMOVAL PROOFS, one per assertion rather than one per file -- the lesson seq:1 paid for. Each reddened exactly the assertions it should and no others: the binary dropping the block (1 red), the door delivering nothing (11), the subagent hook dropping the block (2), the record never written (10), each assertion site removed (4 and 1), the conflict block unrendered (2), the corpus ids withheld at the hook (3) and at core/inject.ts (3), the request field rendered (2), a refusal dropped instead of named (1), and an import from inject.ts to the store (1, which proves the isolation walk still guards the edge this phase came closest to crossing).

UNIT SUITE 7,539 of 7,545 passing. Four failures, none of them this work: two statusline-chain cases that pass in isolation and are contention only, and the two diagram-gate cases seq:1 left owing a gen:docs run that needs the browser.
