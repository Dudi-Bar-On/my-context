---
id: TASK-sweep-every-timestamp-comparison-for-the-millisecond-tie
type: task
title: sweep every timestamp comparison for the millisecond tie that broke the watch window
status: active
severity: soft
always: false
summary: One place compared two clock readings and broke when both happened in the same millisecond; nobody has checked whether the other places that compare clock readings can break the same way.
summary_of: a38ac527db93d1b3
scope: []
tags:
  - "plan:release"
  - "seq:16"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-22
valid_until: null
checksum: 6d7d565701c72c48
plan: release
seq: "16"
state: done
---

# sweep every timestamp comparison for the millisecond tie that broke the watch window

Owner ruling at checkpoint 1 (2026-09-22): take it. Origin: release/13 site 4 — src/core/context-share.ts bounded the /api/watch/context window with at >= preCompactAt, and a synchronous burst of recordAudit calls tied the millisecond, so a record from before the compaction counted as after it (CI run 35715432299: 3 injections / 6200 tokens against 2 / 2200). The fix bounds on the audit table's seq. The lane did not sweep the rest of the code for the same shape.

Closing condition: every comparison of two clock readings in src/ (at, since, until, createdAt, updatedAt, mtime, and the like, compared with <, <=, >, >=) is listed in the task's observation with one of three verdicts each - cannot tie (the two readings come from different scales or a tie is harmless), can tie and is now bounded on a monotonic fact (seq, a counter, insertion order) with a test that forces the tie the way test/ui/watch-model.test.ts does, or can tie and is left with a written reason. Files: whatever the sweep names; expected to touch src/core/ledger.ts, src/core/audit-db.ts, src/core/decay.ts, src/ui/watch-model.ts. Phase 4 (silent failures and disclosures), same lane group as the audit and ledger tasks.

The sweep, recorded 2026-09-23 by the dispatching session from task 4.16 (commits 60729972, 8178d9c0). Three verdicts: FIXED (bounded on a monotonic fact), REASON (can tie, left with a written reason), NOT A TIE. One line per site:

FIXED     core/context-share.ts · shareSql — epoch vs injection record, same log; `seq > ?` when the epoch has a row (release/13). `at >= ?` remains only on the transcript branch, which has no row to anchor a seq to; disclosed in place.
FIXED     core/audit.ts · AuditFilter.sinceSeq — the seq bound exists on the filter and filterSelect honours it (release/13).
FIXED     ui/watch-model.ts · /api/watch/context — passes sinceSeq when the epoch has one (release/13).
FIXED     doctor/state-verification.ts · checkTaskUnverified `transitionAt < adoptedAt` — a task's recorded state transition vs the workspace's first recorded verified_on write, two readings of one clock from one log. Now `earlierThan(transition, adopted)`: by the clock, and by the record's POSITION in readAudit's oldest-first sequence on a tie. Test forces the tie both ways (task 4.16).
FIXED     core/handover-ask.ts · lastRecordedAsk `ms <= bestMs` — two ask latches' askedAt. Was "broken by the first one read, which is arbitrary", and readdirSync promises no order. Now broken on the filename, continuity.ts's precedent. Test pins the contract (task 4.16; see the test's own docblock for why it cannot go red on Windows).
FIXED     core/continuity.ts · newestSessionKey — two files' mtimeMs; already `(at === best.at && name < best.name)`. This is the precedent the site above now follows.
FIXED     core/decay.ts · byColdest — two items' lastUsed; already falls through to a.id.localeCompare(b.id).
REASON    cli/commands/statusline-install.ts:686 · delegateEntry `entry.replacedAt >= best.replacedAt` — two installs' replacedAt. The reason is already written at the line: `>=` rather than `>` so that a tie falls to insertion order, which is install order. Reachable only on a machine with two profiles, neither of which is the one Claude Code reads. Left as is.
REASON    core/audit.ts:1607 · `row.at > READER_STARTED_AT` — a row's clock vs this process's start. Different processes, no shared monotonic fact; READER_STARTED_AT is itself an approximation from process.uptime(), so it is already ±ms. A tie downgrades a skew disclosure to a plain damage report — more conservative, never wrong.
REASON    core/handover-ask.ts ×2 · `writtenMs > askedMs` — the handover file's mtime vs the ask's timestamp. Argued in place: the ask is delivered at the END of a turn and the writing happens in the next one, so a response is milliseconds to minutes later and never simultaneous. Different clocks besides.
NOT A TIE core/audit-db.ts · filterSelect `at >= ?` / `at < ?` — a record vs a user-supplied bound; half-open by construction, inclusive-since / exclusive-until.
NOT A TIE core/audit.ts · filterAudit `r.at < since` / `r.at >= until` — same, and deliberately the same half-open reading, which is the point of one filter implementation.
NOT A TIE ui/watch-model.ts:343 · volume `since` — a record vs `now - minutes`, a derived window edge for a rolling chart.
NOT A TIE ui/watch-model.ts:884 · apiItemHistory `a.at >= ?` — a record vs `now - 12 weeks`, same.
NOT A TIE core/session-summary.ts:955 · `extract.at >= range.at` — a transcript record vs a user-supplied --since; inclusive lower bound, documented, and a range past the end is an explicit empty answer.
NOT A TIE doctor/checks.ts:1820 · `at < ASSUMPTION_OVERDUE_INTRODUCED_AT` — a record vs a hard-coded constant date; different scales.
NOT A TIE cli/commands/audit.ts ×3 and core/audit-db.ts:1538 · `record.at > row.last` — a running maximum; both branches store the same value.
NOT A TIE core/contribution.ts:84-85 · firstAt / lastAt — a running min and max; same.
NOT A TIE doctor/state-verification.ts:802 · `record.at < earliest` — a running minimum; now expressed through earlierThan, which is strict, so a tie leaves the first-read (lower-index) record standing.
NOT A TIE review/pending.ts:198 · `ms < oldest` — a running minimum over two arrays in a deterministic order.
NOT A TIE core/ledger.ts:877, core/statusline-tee.ts:135 · `mtimeMs < cutoff` — a retention sweep against a derived edge; a tie keeps the file and the next sweep takes it.
NOT A TIE core/lock.ts:216, :422 · `Date.now() - mtimeMs > LOCK_STALE_MS` — a duration vs a threshold, not an ordering; a tie reads "not yet stale", the safe direction for a lock.
NOT A TIE core/turn-refresh-soon.ts:148 · `now - state.at < gapMs` — same shape; a tie reads "too soon", the direction that does not spawn work.
NOT A TIE core/context-occupancy.ts:186, cli/commands/statusline.ts:238, cli/commands/statusline-powerline.ts:1804 and :1845 · an age vs a freshness threshold — same shape.
NOT A TIE ui/watch-model.ts:1207 · `Date.now() - wroteAt < keepAlive` — an SSE keep-alive interval, same shape.
NOT A TIE ui/public/lib/heartbeat.js:125 and :210 · `Date.now() - askedAt|firedAt < LOOK_GAP_MS` — same shape, browser side.
NOT A TIE core/retire.ts:141, core/conversation-index.ts:1050-1051, ui/public/app.js (Date.parse ×8) — parse-then-age and durations, never an ordering between two siblings.
NOT A TIE core/handover-ask.ts:1291 · `.sort(a.dispatchedAt.localeCompare(b.dispatchedAt))` — Array#sort is stable, so a tie preserves the source order, which here is audit-record order: the log's own monotonic fact, by construction.
NOT A TIE core/restore-staging.ts:331 · `.sort((a.approvedAt ?? '').localeCompare(...))` then `[0]` — stable sort over readRestoreStagingDir's `names.sort()`, so a tie resolves by filename, deterministically and already.
NOT A TIE Every `ORDER BY …at` in src/ (conversation-index.ts ×6, conversation-search.ts, ledger.ts ×2, ui/ask-model.ts, ui/preview-history.ts) — every one already carries a secondary key (session_id, item_id, id, seq, record_index). Checked individually.
NOT A TIE ui/read-model-conversation-document.ts:2270 · `resume.at >= bytes`; core/anchor-pass.ts:607 · `at > 0`; core/acknowledge.ts:159; ui/public/screens/conversations.js (`parts[mid].at <= offset` ×3) — `at` is a BYTE OFFSET or a record INDEX here, not a timestamp. Listed because the greps catch them and a reader will meet them.
NOT A TIE cli/commands/format.ts ×3 (cellAt), pack/manifest.ts:220, ui/execute-catalogue.ts:163, ui/public/lib/fold.js (charCodeAt ×6), ui/public/lib/vendor/markdown-it.esm.min.js (charCodeAt, many), ui/public/screens/config.js:1803 (wizAt, a step index) — caught by the `…At` pattern and not clocks at all.
