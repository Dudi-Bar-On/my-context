# v2.0 review addendum — what an external verification pass changed

**Date:** 2026-08-18
**Status:** findings and corrections; the decisions in §4 are the owner's to take.
**Base:** `master` at `6265115`, tag `v1.0.1`.
**Binds:** `specs/2026-08-16-web-ui-design.md`, `specs/2026-08-16-never-miss-an-injection-design.md`,
and the three `plans/2026-08-16-web-ui-*` documents.
**Origin:** an external test campaign against `1.0.0` (419 recorded runs across eight surfaces, a
22-check live pass inside Claude Code, and a line-by-line audit of 4,625 README lines producing 716
claims), followed by a review of the v2.0 material on 2026-08-18.

This document lives in `specs/` rather than `plans/` because §3 corrects a spec section, and the
mockup note establishes the spec as the authority the plans defer to. It is nonetheless binding on
the plans: §2 names a prerequisite for `plans/…web-ui-3-watch-and-ask.md`.

---

## 0. Provenance — read this before using anything below

This project's characteristic defect is asserting a property the code does not have. An addendum
whose subject is that defect must say which of its own claims were executed and which were read.

| Section | How it was established |
|---|---|
| §1 | **Executed.** Three probe suites against the shipped code, in disposable workspaces, with wall times and verbatim output |
| §2 | **Executed and read.** The defect read off `src/cli/commands/audit.ts`, then reproduced against a real corpus |
| §3 | **Read.** Two `file:line` sites in the shipped hook, plus eight seen files observed during the live pass |
| §4 | **Neither.** Recommendations. Nothing here is decided by this document |
| §5 | Corrections to documents, each verified against the code it describes |
| §6 | What this pass did **not** cover, including where its own author was wrong |

Nothing in §1–§3 rests on a claim this pass did not run.

---

## 1. The never-miss guarantees, verified by execution

`specs/2026-08-16-never-miss-an-injection-design.md` recommends **B + A + C, layered**. All of it
shipped — commit `081341e` names "design C" directly, and `55ac96a` merged a fourteen-task phase.
Until now that was established by reading. It is now established by running.

### 1.1 The Markdown fallback holds, and discloses

PreToolUse, one corpus, two items (one scoped, one unscoped), four index states:

| Index state | Injection | Disclosure |
|---|---|---|
| healthy | both items | none |
| overwritten with 4,096 bytes of garbage | both items | `my_context: served from Markdown; the index was unavailable.` |
| deleted | both items | identical, byte-for-byte, to the corrupt case |
| rebuilt | both items | none — the note is not sticky |

The degraded output is the healthy output **plus one line** — same items, same bodies, same
`_scope:` line, same order, and `tokens: 54` identical in the audit record, so budget accounting
matched too. Exit 0 throughout.

The audit record names the **actual** SQLite error rather than a generic flag: `file is not a
database` for the corrupt case, `unable to open database file` for the deleted one. The hook never
repaired the index — md5 before and after are equal — so the read-only posture holds in the failure
path as well as the happy one.

### 1.2 The refresh drop holds, and this is the measurement that justifies the phase

SessionStart, with the SQLite write lock held by another process (`BEGIN IMMEDIATE`, verified
exclusive by a second holder dying with `errcode: 5`):

| Path | Profile | Wall time | Exit |
|---|---|---|---|
| **hook** | `HOOK_OPEN_PROFILE` | **1,532 ms** | 0 — injection byte-identical to baseline |
| **manual** (`mycontext rebuild`) | `DEFAULT_OPEN_PROFILE` | **17,583 ms** | 1 — `database is locked` |

The manual figure reproduces §0.1's 16.9 s to three digits. Against `hooks.json`'s 10 s kill, the
pre-fix hook path would have been killed mid-wait: **injection gone, nothing disclosed**. The fix is
worth exactly that difference, and the difference is now measured rather than modelled.

The audit note `index refresh dropped: database locked` appeared in 3/3 locked runs and 0/3
unlocked. It lands *while the lock is held*, because the log is JSONL beside the database rather
than a table inside it — as `inject.ts` · `// is JSONL beside the database, so nothing that stopped the refresh can` · ~602 claims.

### 1.3 The PreCompact snapshot lands in every degraded state

Snapshot written in all four: healthy, deleted, corrupted with 64 KiB of random bytes, and present
but empty. Exit 0, zero bytes on stdout, every time.

**Over-capture demonstrated, not asserted.** With a transcript naming two id-shaped ghosts:

| Run | Index | Captured |
|---|---|---|
| `pc-4` | healthy | 3 ids |
| `pc-5` | deleted | **5 ids** — the same 3, plus `GHOST-deleted-long-ago`, `GONE-removed-yesterday` |

`pc-5 ⊃ pc-4` exactly: strict over-capture on both arms, never a miss. Both documented skip reasons
are reachable and both disclose — `index unavailable` and `index empty`.

**Zero SQLite writes**, proven: md5 and mtime of `.index.db` unchanged across a run. **Timing**: worst
observed **154 ms against the 10,000 ms kill — 1.5% of budget**, and losing the index costs nothing
measurable, because the failing open returns immediately.

---

## 2. Defect — five disclosures are written and none is rendered

**This is the substantive finding of the pass, and it is a prerequisite for Watch.**

`detailCell` (`src/cli/commands/audit.ts`) returns from inside its
`record.kind === 'injection' || record.op === 'pre-compact'` branch. `record.note` is read only on
the final line, which an injection record never reaches.

Every disclosure the JIT path can raise is a `note` on an injection record
(`src/hooks/pre-tool-use.ts` · `const noteParts: string[] = [];` · ~253):

| Disclosure | What it tells the reader |
|---|---|
| `subagent <agent_id> (<agent_type>)` | which context window received this |
| `focus hid N on this path, M load-bearing relation(s) dangling` | what a focus removed |
| `seen file unreadable; injected without dedupe` | dedupe was skipped |
| `served from markdown fallback: <reason>` | the index was unusable |
| `N item file(s) dropped by the fallback (first: <file>)` | **items that never reached the session** |

SessionStart's `index refresh dropped: …` is the same shape and equally hidden.

Reproduced on a corpus where two of four runs were served from a broken index:

```
│ when           │ op  │ who      │ subject               │ detail            │
│ 08-18 12:52:20 │ jit │ fb-basel │ src/billing/charge.ts │ 2 jit, ~54 tokens │
│ 08-18 12:52:41 │ jit │ fb-corru │ src/billing/charge.ts │ 2 jit, ~54 tokens │  ← corrupt index
│ 08-18 12:53:19 │ jit │ fb-delet │ src/billing/charge.ts │ 2 jit, ~54 tokens │  ← no index
│ 08-18 12:53:59 │ jit │ fb-recov │ src/billing/charge.ts │ 2 jit, ~54 tokens │
```

Four identical rows. The JSONL holds the disclosure for two of them.

**Why this is invariant-level, not cosmetic.** `INV-nothing-is-dropped-silently` states that an item
excluded from injection appears in `spilled`, the index, or a `LoadError`. The fifth row above —
*"N item file(s) dropped by the fallback"* — is exactly that case, recorded faithfully and rendered
nowhere a person reads. The invariant is satisfied in the data and defeated at the renderer.

**Why it binds the plans.** `plans/2026-08-16-web-ui-3-watch-and-ask.md` builds the audit stream, and
the CLI is the precedent an implementer copies. The consequence is stated in the shipped code, at
the `recordAudit` call this defect hides:

> *"A subagent's delivery is named as such: without it, two deliveries of one item under one
> sessionId read as a dedupe failure rather than as two context windows."*

A Watch screen that renders injection records the way `mycontext audit` does will show two
deliveries of one item under one session and invite precisely that misreading.

**Constraint on the fix, and why the obvious fix is wrong.** The docblock above `HEADERS` records
that this table's floor is 91 columns at 38-character ids against a 100-column budget, and that
adding a `kind` column would push it to 109 and cause the terminal to rewrap.

Appending the note itself was measured against the real `table()` and **must not be done**. `table()`
narrows only while the table's longest *unbreakable* token fits the budget, and these notes are built
from ids, paths and errno strings, so their longest token is unbounded:

| detail cell | floor | rendered |
|---|---|---|
| no note (before the fix) | 91 | 100 — narrows to budget |
| marker ` — note` (**what shipped**) | **91** | **100** — costs the budget nothing |
| full note, markdown fallback | 94 | 100 — fits, barely |
| full note, refresh drop | 100 | 100 — zero slack |
| full note, `dropped by the fallback (first: <file>)` | 113 | **186 — budget unreachable** |
| full note, `cross-layer duplicate id(s):` — `inject.ts` · `cross-layer duplicate id(s):` · ~733 | 123 | **178 — budget unreachable** |
| full note, `SNAPSHOT WRITE FAILED (<msg>)` — `pre-compact.ts` · `SNAPSHOT WRITE FAILED (${reason}).` · ~90 | 123 | **209 — budget unreachable** |

Three real note shapes push the floor past the point where `table()` stops narrowing at all, so
appending them trades a silent wrong answer for the rewrap failure `list --full` exists to avoid.

**What shipped instead** (`f2e2a69`): a fixed ` — note` marker plus a legend printed only when a row
carries one, with `--json` as the faithful surface. Hanging the marker off the em-dash the mutation
branch already uses means no existing token grows — `tokens` does not become `tokens,` — so the floor
stays at exactly 91 and the marker is free. Measured at 100 characters with and without notes
present, including a hostile case built from a 38-character id and a Windows path.

Any future change here measures width in **characters**: box glyphs are three bytes in UTF-8, so
`wc -c` and `awk length()` both overstate by about eight per row.

---

## 3. Correction to web-ui §9.5 — `session_id` keys three of four things

§9.5 records:

> The same `session_id` keys the ledger, the audit records and the status-line tee.

Accurate as written. What it does not say is that **the seen file is keyed differently**, and Core
rests on `seen`:

| The call | The key it passes |
|---|---|
| `src/hooks/pre-tool-use.ts` · `recordAudit(ws.projectRoot, {` · ~275 | the raw `session_id` |
| `src/hooks/pre-tool-use.ts` · `appendSeen(ws.projectRoot, dedupeKey, selection.full.map((e) => ({` · ~303 | `dedupeKey` — `session_id`, then `::` and `agent_id` when there is one |

`ledgerKey` (`src/hooks/io.ts` · `export function ledgerKey(input: HookInput): string | null {` · ~61) appends `agent_id` when present, because a subagent begins with
an empty context window; its docblock records the two-directional bug that motivated it. Observed
during the live pass: eight concurrent subagents produced **eight separate seen files** alongside the
parent's, all under one `session_id`.

**The design is right; only the wording is incomplete.** `seen` is per *context window*; the ledger,
audit and restore path are per *session*, meaning the parent thread. `/api/select` with the parent's
`seen` previews the parent thread, which is the Claude the user is talking to — the correct answer,
not a compromise.

Recommended amendment to §9.5: name the fourth key and its scope, so an implementer building Core
does not discover it. Suggested wording:

> The same `session_id` keys the ledger, the audit records and the status-line tee. The **seen file
> is keyed on `session_id` + `agent_id`** (`ledgerKey`, `io.ts` · `return input.agent_id ?` · ~63), because dedupe is per context
> window rather than per session: a subagent shares the session id and starts with an empty window.
> `/api/select` passes the parent's `seen`, so the preview is of the **parent thread**, and the
> screen says so.

---

## 4. For the owner to decide

Recommendations. This document decides none of them.

**4.1 `doctor` is a dead end for the one message that sends you there.** Run against a workspace
whose index was deleted, `doctor` reported `0 error(s), 0 warning(s), 0 note(s)` and silently
rebuilt the index as a side effect. Defensible under `INV-markdown-is-the-source-of-truth` — "delete
it, it rebuilds" is the documented recovery. But the user journey is: a session says *"served from
Markdown; the index was unavailable"*, the user runs `doctor` to find out why, and is told
everything is fine, because by then it is, with no trace of what was wrong. The audit log is the
only surviving record, and §2 is why that does not help either. Options: report the rebuild as a
note, or leave it and accept that the audit log is the diagnostic surface.

**4.2 Scope and sequencing were already decided; this pass found no reason to revisit them.** §4
grades every screen against §1's test, with two exceptions written down as exceptions, and the three
plans are the phasing. Recorded here only because an earlier draft of this review questioned it
before reading §4 — see §6.

**4.3 Whether §2 of this addendum ships as a `1.0.2`.** It is a rendering fix to a released
surface, so `PATCH` under `VERSIONING.md` — the program made to do what it already said it did. It
is also the kind of change `VERSIONING.md`'s "honest edge" paragraph exists for: the audit table
starts printing text it did not print before.

---

## 5. Corrections to documents whose subject has since shipped

**5.1 `specs/2026-08-16-never-miss-an-injection-design.md` header.** It reads *"Status: design with a
recommendation; pending owner review. Nothing here is implemented."* It shipped in `1.0.0` as a
fourteen-task phase (`55ac96a`), and §1 above verifies it by execution. The commit that landed the
design artifacts (`d08cd04`) distinguishes shipped work from v2.0 work in its message, but a reader
opening the file is told the opposite.

**5.2 §0.5 of the same document** flagged that `src/core/audit.ts` · `audit log and this one opens no database: the write is owned by` · ~744 cited a
`mycontext audit replay-ledger` command that did not exist. It exists now — §4.2 built it. It is
also the subject of finding `A-037` from the campaign, where the README described it as rebuilding
the ledger whole when it tops up incrementally; corrected in `1.0.1`.

---

## 6. What this pass did not establish, including where it was wrong

**Not verified.** Contention under real concurrent load; Linux and macOS; corpora larger than ~40
items; the `full` profile as a working configuration; ingest at scale; upgrade and migration paths.

**A contention test was proposed and withdrawn.** The reviewer recommended building one before
reading §2 of the never-miss design, which reports **21,900 read-only trials under hammering
writers, held transactions, TRUNCATE checkpoints and crash recovery, with not one read blocking or
returning `SQLITE_BUSY`**, worst case 17.2 ms. The stall was never read contention; it was that
every hook took the write lock it did not need. Building a contention suite would have re-measured
that, less rigorously. The three probes in §1 were run instead, because they exercise code paths
that had never run in a real session.

**Three "load-bearing decisions" were raised that were already decided.** The `/api/select`
session-versus-fresh fork (§9.5), the screen scope (§4), and the cost of Hebrew mirroring (§3). All
three were raised from a reading of §0, §2 and a list of headings, without opening §1, §3, §4, §9,
the three plans, or the mockup. The mockup in particular answers questions this review asked, and
its own note is a more rigorous self-audit than the review that skipped it.

That failure is worth recording rather than quietly fixing, for the same reason the specs record
theirs: a review that starts from a summary reproduces the summary's blind spots, and the cost is
paid by whoever trusts its conclusions.
