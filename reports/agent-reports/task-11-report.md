# Task 11 Report: MCP Tool Sweep

## Mechanics Summary

**Status:** Complete

**Record Count:** 55 evidence records produced in `harness/evidence/mcp.jsonl`

**Command Executed:**
```bash
node harness/sweep.mjs mcp ./cases/mcp.mjs
```

**Output:** `swept 55 cases into evidence/mcp.jsonl`

## Verification

- **Byte-stability test:** PASS (tool list is byte-stable across two independent MCP handshakes)
- **Error check:** 0 harness errors, cleanup errors, setup failures, or timeouts detected
- **Record structure:** All 55 records have complete schema with id, tool, args (where applicable), result, stderr, durationMs, and case metadata

## Case Table

Cases created in `harness/cases/mcp.mjs`:
- `handshake-and-list`: MCP initialization and tool enumeration (1 case)
- `create_item`: 10 cases covering minimal/full args, idempotence, and refusals (relations, origin, unknown arg, missing required, severity/always on decision)
- `update_item`: 8 cases covering title update, refusals on status/scope/severity/always for normative items, extra field, missing id, unknown arg
- `get_item`: 3 cases (ok, missing id, unknown arg)
- `query_items`: 5 cases (bare, type filter, all filters, bad status, unknown arg)
- `list_drafts`: 2 cases (bare, with type and limit)
- `load_context`: 2 cases (bare, argument refused)
- `link_items`: 3 cases (ok, supersedes refused, missing relation)
- `supersede_item`: 1 case (governing normative refused)
- `refresh_item`: 1 case (non-snapshot item)
- `audit_log`: 5 cases (bare, actor filter, origin arg refused, since span, all filters)
- `mycontext_help`: 5 cases (categories, scope, capture, workflow, invalid topic)
- `mycontext_examples`: 2 cases (rule, invalid type)
- `focus_context`: 5 cases (empty reports, tags, preview, clear, clear-with-axis refused)
- `ingest_document`: 2 cases (no args, session without anchor)

**Total:** 55 cases

## Evidence Quality

All cases produced exactly one evidence record each. Sample records verified:
- Handshake includes full tool schema and `serverInfo` (version: "0.1.0" noted in case 1)
- Create operations show proper status (draft for normative agent-authored, active for decision)
- Refusal cases return `isError: false` with refusal message in `content[0].text` (protocol verified in earlier tasks)
- All stderr contains expected SQLite experimental warning

## Round 2: Multi-Call Read-Back Cases (Harness Enhancement)

**Status:** Complete

**Harness Modification:** Extended `sweep.mjs` to support multi-call sequences
- Added `configPatch` support: write config.json before case execution
- Added `calls` array support: execute multiple MCP tools in one workspace, record all results

**Record Count (Final):** 62 evidence records (55 original single-call + 7 multi-call sequences)

**Cases Refactored:** 16 individual read-back cases → 7 multi-call sequences capturing full operation sequences in single workspace

### Key Findings from Multi-Call Evidence

1. **Agent-created constraint lands as draft** (`create_item-constraint-readback`)
   - Call 1: create_item returns `created CONST-agent-constraint-test (draft)`
   - Call 2: list_drafts returns item in results: `CONST-agent-constraint-test · constraint · draft · Agent Constraint Test`
   - Call 3: query_items for status:active returns "no items match"
   - **Finding:** Normative agent-created items land in draft tier, awaiting human review

2. **Agent-created decision lands as active** (`create_item-decision-readback`)
   - Call 1: create_item returns `created DEC-agent-decision-test (active)`
   - Call 2: query_items for status:active returns item in results: `DEC-agent-decision-test · decision · active · Agent Decision Test`
   - Call 3: list_drafts returns "no drafts are waiting for review"
   - **Finding:** Rationale agent-created items land in active tier immediately (not requiring review)

3. **Idempotent create does not duplicate** (`create_item-idempotent-readback`)
   - Call 1: create_item returns `created CONST-idempotent-test-item (draft)`
   - Call 2: create_item (same title) returns `already captured as CONST-idempotent-test-item. Nothing changed.`
   - Call 3: query_items returns exactly one item: `CONST-idempotent-test-item · constraint · draft · Idempotent Test Item`
   - **Finding:** Confirmed README 2707 behavior—second call reports existing item, NOT minting a `-2` suffixed duplicate

4. **update_item stages rather than applies** (`update_item-title-effect`)
   - Call 1: create_item returns constraint as draft
   - Call 2: update_item returns "NOT applied — staged as revision REV-... for review. ... is unchanged and keeps governing its current title"
   - Call 3: get_item returns: `title: Original Title` (unchanged), followed by "1 pending revision(s) on CONST-original-title (REV-...), proposing new title. It has NOT been applied"
   - **Finding:** Confirmed documented staging behavior; update held pending review, not applied to draft normative item

5. **link_items records relations on source side only** (`link_items-effect`)
   - Calls 1-2: Create two constraints
   - Call 3: link_items returns "CONST-link-source relates_to CONST-link-target"
   - Call 4: get_item on source shows "## Relations\n- relates_to [[CONST-link-target]]"
   - Call 5: get_item on target shows NO Relations section
   - **Finding:** Relations are directional; only source side records the relation

6. **focus_context persists within workspace** (`focus_context-effect`)
   - Call 1: Create tagged item with tag `focus-test`
   - Call 2: focus_context with tags:['focus-test'] returns "focus set. ... focus: tags: focus-test"
   - Call 3: focus_context with no args returns "the focus now in effect. ... focus: tags: focus-test"
   - **Finding:** Focus persists within same workspace and is reported when called with no arguments

7. **supersede_item on rationale succeeds with bidirectional relations** (`supersede_item-rationale-effect`)
   - Calls 1-2: Create two decisions (both active status)
   - Call 3: supersede_item returns "DEC-old-decision is now superseded by DEC-new-decision"
   - Call 4: get_item on old shows `status: superseded`, `valid_until: 2026-08-17`, "## Relations\n- superseded_by [[DEC-new-decision]]"
   - Call 5: get_item on new shows `status: active`, "## Relations\n- supersedes [[DEC-old-decision]]"
   - **Finding:** Supersession on rationale items succeeds; relations recorded bidirectionally

### Mechanical Summary

- **Error check:** 0 harness errors, cleanup errors, setup failures, or timeouts across all 62 records
- **Byte-stability:** Tool list remains byte-stable (verified post-sweep)
- **Retracted finding:** Removed "draft items not visible in list_drafts" — this was an artifact of previous design; multi-call sequences confirm drafts ARE visible (finding #1)

## Commit Status

**NOT COMMITTED** — files modified:
- `harness/sweep.mjs` (harness enhancement with configPatch and calls support)
- `harness/cases/mcp.mjs` (7 multi-call read-back cases replacing 16 individual ones)
- `harness/evidence/mcp.jsonl` (62 records from fresh sweep)

No git operations performed.
