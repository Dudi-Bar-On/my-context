# Coverage — what this campaign actually exercised

The purpose of this document is to make the campaign's claims falsifiable. A
count of test cases is not coverage; a case that never reaches the behaviour it
is named for is worse than no case at all, because it reads as evidence.

---

## Totals

| Surface | Evidence records | File |
|---|---|---|
| CLI capture | 419 across all eight | `harness/evidence/cli-capture.jsonl` |
| CLI mutation | | `cli-mutate.jsonl` |
| CLI retrieval | | `cli-retrieve.jsonl` |
| CLI pipelines | | `cli-pipelines.jsonl` |
| MCP tools | | `mcp.jsonl` |
| Hooks | | `hooks.jsonl` |
| Config & categories | | `config.jsonl` |
| Slash commands | | `slash.jsonl` |

Plus:

- **22 live checks** inside Claude Code (`LIVE-PASS.md`) — the only place the
  hook layer can be exercised for real.
- **716 documentation claims** audited line by line across all 4,625 README
  lines (`claims/section-*.md`).
- **22 harness self-tests**, because a harness that lies is worse than none.

---

## The ten records that prove nothing

**These reached exit 0 without reaching the behaviour in their name.** Each was
re-run properly by an auditing agent, so no false conclusion survived into
`FINDINGS.md` — but the raw count of 419 overstates coverage by these ten, and
citing any of them as proof of its named behaviour would be wrong.

| Record | What it claims to test | Why it does not |
|---|---|---|
| `config/category-agentEdits-allow` | `agentEdits: "allow"` applies an agent edit directly | never reached the edit path |
| `config/category-scopePolicy-inert` | an unscoped item under `inert` applies to no file | never reached the selection |
| `config/unknown-category-still-indexed` | an unknown category still appears in the index | short-circuited earlier |
| `hooks/session-start-dedupe-same-session` | a second session start does not re-deliver | the precondition never held |
| `cli-retrieve/query-insert-refused` | `INSERT` is refused by the SQL sandbox | a missing-argument guard fired first |
| `cli-retrieve/query-drop-refused` | `DROP` is refused | same |
| `cli-retrieve/query-pragma-refused` | `PRAGMA` is refused | same |
| `mcp/update_item-status-on-normative-refused` | status change on a governing normative item is refused | the item was not in that state |
| `mcp/update_item-severity-on-governing-refused` | severity change is refused | same |
| `mcp/supersede_item-governing-refused` | an agent cannot supersede a governing item | same |

### The one that mattered

`config/category-scopePolicy-inert` was vacuous **and sitting directly on top of
a real defect**. The behaviour it failed to reach is exactly the behaviour that
falsifies README:1434's bolded guarantee "No scope means no restriction"
(`C-026`). Had the record count been trusted, the campaign would have shipped
that claim as verified.

**The recurring shape:** a guard firing before the thing under test. A
missing-id check before flags matter; a "nothing to change" branch swallowing a
confirmation gate; an empty workspace producing zero findings; a budget applied
to a tier the item never entered. All produce a plausible result and exit 0.

The harness was changed to record every failed setup step (`sweep.mjs`
`setupFailures`) precisely because of this class — but that catches a failed
precondition, not a precondition that succeeded and was irrelevant.

---

## Five false findings, caught before publication

Reported by agents or by early analysis, and disproven on re-derivation:

1. `harden` / `pin` / `soften` / `unpin` reported as "unknown subcommands" —
   all four are real, `NAMED_ENTRY_POINTS` in `edit.ts`.
2. `add reference --file README.md` "fails" — the fixture was missing.
3. `list_drafts` "returns nothing" — no drafts existed yet.
4. `unpin` / `soften` / `refresh` "exit 0 without `--yes`" — that is the correct
   no-op preview path.
5. **`D2-032` — "`.my_context/state/focus.json` is not gitignored".** False.
   `state/.gitignore` is `*`, `git check-ignore -v` exits 0 naming the rule, and
   `git ls-files .my_context/state/` returns nothing. The agent ran
   `check-ignore` inside its non-git `$TEMP` workspace, where it exits 1 for
   every path.

Three more were caught during the live pass before they became findings: the
CRLF checksum scare (`normalizeEol` handles it, deliberately — `mutate.ts:193`),
an agent `lesson` landing active (correct: rationale tier), and all five item
ids appearing in a compact probe (they were quoted inside the reference's
snapshotted text).

**Nine near-misses in one campaign is the number to remember.** It is why every
one of the 33 documentation contradictions was re-derived from source, a live
run, or arithmetic before reaching `FINDINGS.md`.

---

## What was NOT covered

Stated plainly, because a coverage report that lists only successes is an
advertisement.

- **Linux and macOS.** Everything here ran on Windows 11 / Node 24.14.0. The
  project's CI covers Linux and `docs/ROADMAP.md` records a certification run;
  this campaign did not reproduce it.
- **Multi-user and concurrent workspaces.** One machine, one user, no
  simultaneous sessions against one corpus beyond the eight-subagent fan-out.
- **Large corpora.** The largest corpus exercised was the plugin's own
  (~40 items). Budget spill was tested by lowering budgets, not by growing the
  corpus to where it binds naturally.
- **The `full` profile end to end.** All 21 categories were swept for schema and
  tier; the profile was not run as a working configuration for a session.
- **Real ingest at scale.** The ingest pipeline was exercised against the
  committed fixture document, not a large real PRD.
- **Upgrade and migration.** No previous version was installed and upgraded
  from; schema migration paths are untested here.
- **`claude plugin eval`.** Not run.

---

## What the live pass covered that the harness structurally cannot

The harness cannot spawn Claude Code, so these exist only in `LIVE-PASS.md`:

- JIT injection on a real tool call, and scope discrimination between two files
- Both arms of the write-deny, as Claude actually receives them
- `PostToolUse` `watchedDocs` firing and staying silent
- The draft trust boundary with a real MCP client
- **Per-subagent dedupe keys** — eight concurrent subagents produced eight
  separate seen files, and each received only the unscoped item
- **The restored tier**, closed by a real `/compact` against a captured
  no-restoration baseline

---

## How to re-run anything here

```bash
# one surface
node harness/sweep.mjs <surface> ./cases/<file>.mjs

# look up a single record
node --input-type=module -e "
const {load} = await import('./harness/lib/evidence.mjs');
const r = await load('cli-mutate');
console.log(r.find(v => v.caseId === 'pin-readback'));
"

# the plugin's own suite against the pin
node harness/baseline.mjs      # must print: failed: 11  known-red: 11
```

The 11 known-red are Node 24.14.0 emitting `ExperimentalWarning: SQLite is an
experimental feature` on stderr, against tests that assert stderr is empty. They
are environmental, they are the same 11 every run, and they are recorded as
`F1` — not fixed, because suppressing a stderr assertion to accommodate an
environment can hide a real regression later. That call is the author's.
