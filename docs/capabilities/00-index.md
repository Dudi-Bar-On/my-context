# my_context — capabilities reference

This is the maximal, source-grounded reference to what **my_context** actually does: every
feature, mechanism, gate, and surface, each with what it is, why it exists, how to invoke it,
a worked example built from real command output, and at least one use case. It also says
plainly where a capability is **built but off**, or **not built at all** — a document that
only describes the working parts would be the same defect this project spends its own time
deleting (see `CLAUDE.md` at the repository root).

## What my_context is

A Claude Code plugin that keeps a project's normative knowledge as **Markdown items** under
`.my_context/items/`, with a **disposable SQLite index** derived from them — the Markdown is
the truth, and deleting the index loses nothing. Hooks inject the governing subset of that
corpus into every context window at the moments a window begins. It runs on Node ≥ 24 with
**no build step** (TypeScript executed directly via native type stripping) and ships with
**zero runtime dependencies** (`CONST-node-24-no-build-step`, `CONST-zero-runtime-dependencies`).

Two more stores sit alongside the corpus and are documented here in full: a searchable
**conversation archive** of session transcripts, and a **product rule store** (`src/rules/`)
of fifteen entries (2026-09-13) shipped inside the plugin itself rather than authored per project.

## How this reference was built

Every claim in every chapter was pulled from the source tree, the live corpus of this
repository (`.my_context/items/`), or a command actually run and its real output pasted in —
never from memory or from the task brief's own paraphrase. Governing behaviour is cited by
**item id**, never by report line number (`RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number`),
because `reports/V2-HANDOVER.md` is prepended to on every write and a line number would go
stale on the next one. Each chapter closes with a "What's NOT built / built but off" section
where the author found one, and an honest note on anything that could not be verified from
source rather than asserted anyway.

No source, test, or corpus file was changed to produce this reference. No command that
mutates the corpus, the git index, or the running UI server was executed — read-only
commands and source reading only, per the standing constraints on this work.

**A number is a reading, not a constant.** The 2026-09-13 verification found that the largest
single class of defect in the first draft was a count or a list stated as current that had
since moved — task items, anchors, rule-store entries, test files, string-table keys. Every
figure in these chapters now carries the date it was taken; where a number is load-bearing, the
command that produces it is shown so a reader can re-derive it rather than trust it.

## Chapters

| # | Chapter | What it covers |
|---|---------|-----------------|
| 1 | [Items and the corpus](./01-items-and-corpus.md) | All 29 shipped item categories, frontmatter, tiers (`normative` / `rationale`), and how a category's tier decides whether it is injected in full, indexed, or reduced to a count. |
| 2 | [Injection](./02-injection.md) | The doors that trigger injection, the five-key budget, pinning (`always: true`), the spare band, first-fit packing and spill, and `governingSpill.titled` as the measure of what a reader loses when an item spills to a title-only line. |
| 3 | [Creation and the gates](./03-creation-and-gates.md) | `add`, `edit`, the summary gate, the contradiction gate, `--distinct` / `--supersedes`, the two escape hatches (`--summary-omitted` at create, `--summary-unchanged` on edit), the three content hashes, supersession edges and their three refusals, `doctor` with **all 61 finding codes**, `repair`, and the `--json` failure envelope. |
| 4 | [The conversation archive](./04-conversation-archive.md) | Indexing session and subagent transcripts, the FTS5 **trigram** tokenizer (not `unicode61` — Hebrew glues one-letter particles onto word fronts), byte offsets never character offsets, secrets detection, and persistence. |
| 5 | [Anchors](./05-anchors.md) | `.my_context/.anchors.jsonl` as the truth with the SQLite index derived from it, `origin: automatic` vs `origin: owner`, the three creation paths, and every anchor capability reachable from the web UI. |
| 6 | [Retrieval](./06-retrieval.md) | Reconstructing a subject from a pasted passage without the passage's own noise ever reaching the context window, and the actual mechanisms (more than a flat "four") that assert this guarantee never breaks. |
| 7 | [Restore and handover](./07-restore-and-handover.md) | `restore --build / --show / --approve / --discard`, the loop guard, `reports/V2-HANDOVER.md`, and `check:handover` — run for real against this repo's live report. |
| 8 | [The web UI](./08-web-ui.md) | All 20 rail screens, the Composer that builds (never silently runs) commands, the item pane, the Hebrew RTL mirror with its parallel string table, and the no-writes guarantee — **twelve ruled write bindings across five files**, asserted by set equality, including two surfaces that write without composing a command at all. |
| 9 | [The CLI and the MCP server](./09-cli-and-mcp.md) | The full command and tool reference — every CLI command and every MCP tool, with real output, grouped and cross-referenced rather than re-explained where a deeper chapter already covers one. |
| 10 | [The product rule store](./10-rule-store.md) | `src/rules/` in full: fifteen entries, the checksum seal (and why nothing checks it automatically), the `product` / `developer` tier split (one entry applies in a consumer repo; all fifteen apply in this one), `MYCONTEXT_RULES_DIR`, and delivery (session-start / subagent-start) vs. assertion (pre-compact / pre-tool-use). |
| 11 | [The self-improvement loop](./11-self-improvement-loop.md) | Instrumentation, trigger, proposals, the review queue, retirement, the ration, and the model path (`review/model.ts`, 2026-09-13) — shipped with `enabled: false`, `maxProposalsPerPass: 0` and `model: null`, three independent dials each at the value that does nothing. |
| 12 | [Packs, export/import, procedures, tutorials, skills](./12-packs-export-import-procedures.md) | Portable packs imported as drafts, `export --format dir\|zip --as-pack --dry-run`, the procedure/runbook one-shot-vs-repeatable distinction, tutorials, and the Claude Code skills this plugin ships. |
| 13 | [The testing discipline](./13-testing-discipline.md) | Removal proofs, `// @basis` declarations, seeded throwaway twins, every `check:*` gate **and where each one runs** (CI, release, or the pre-commit hook), no-writes, and the parity ledgers — as a documented capability of the project, not an implementation detail. |

## Reading paths

- **New to the project, evaluating it**: 1 → 2 → 10 → 8. Items and the corpus, how injection
  actually spends a budget, the product rule store (the one piece with no analogue in a
  typical corpus-only plugin), then the web UI as the fastest way to see all of it at once.
- **Adding this to a project**: 1, 3, 9, 12. What you will be authoring, the gates that keep
  it honest, the full command surface, and how to bring in or share a pack.
- **Working on my_context itself** (this repository): 10 first — all fourteen developer-tier
  entries govern here — then 13, 7, and 11, since those three describe mechanisms that are
  either partly unfinished (11) or exist specifically to keep this project's own claims from
  drifting from its own code (7, 13).
- **Auditing what's real vs. aspirational**: read the "What's NOT built / built but off"
  section at the end of every chapter first; chapter 11 is built almost entirely around one
  such fact (the loop is wired and gated by dials, not by unfinished code).

## What's built but off, across the whole reference

Collected here because it is easy to miss reading chapters in isolation. **Every entry here
distinguishes what the product *ships* from what *this repository* sets** — they are no longer
the same, and conflating them is how the previous version of this list went stale.

- **The self-improvement loop** (chapter 11) ships with `review.enabled: false`,
  `review.maxProposalsPerPass: 0` and `review.model: null` — **three** independent dials, each
  at the value that does nothing, not one switch. It measures contribution and decay
  continuously; it writes nothing until a person turns them on. **This repository has turned
  two of the three** (`enabled: true`, `maxProposalsPerPass: 5`, as of 2026-09-13); `model` is
  unset, so no model is reached here.
- **`review.drift`** (chapter 11) is a third off-switch inside the same subsystem, read from a
  **top-level `drift` key** rather than from inside `review` — `DEFAULT_DRIFT = { enabled:
  false }`, and `drift.ts` is imported by nothing but its own tests.
- **`dispatchGate`** (`src/core/config.ts:600`, `DEFAULT_DISPATCH_GATE = { enabled: false }`)
  — whether an `Agent` dispatch must name a task item. Shipped off; **this repository turns it
  on**. It is a whole gate this roll-up previously missed.
- **`watchedDocs`** is a config key with two `doctor` findings behind it
  (`watched_doc_coverage`, `watched_doc_unserved`) and **no chapter describes it**. This
  repository sets it (`docs/**/*.md`, `README.md`).
- **`rules verify --restore`** (chapter 10) is unreachable code: the branch it needs is guarded
  by a condition that is always false, and `StoreDamagedError`'s remedy names it anyway. The
  working remedy is reinstalling the package.
- **Nothing checks the rule store's checksum seal automatically** (chapter 10) — no hook, no
  door, no `doctor` check, no CI step — and `loadRules` never consults the manifest, so any
  `.md` dropped into `src/rules/entries/` is delivered as a governing constant.
- **`mycontext search` does not reach the conversation archive**, and **no CLI command does**
  (chapter 4). FTS5 archive search is reachable from the web UI and the automatic anchor pass
  only.
- **`restore` does not deliver across a compaction** (chapter 7): delivery is excluded on
  `manual`, `subagent` and `compacting` starts.
- **A mid-session rule-correction mechanism** in the product rule store (chapter 10) —
  `renderCorrection` / `correctionAtDoor` — is fully built and tested but wired to nothing,
  kept deliberately as pre-paid mechanics for a maintenance tool that does not exist yet.
- **The web UI's spare-band ordering** (chapter 2) was ruled for by the owner (most-spilled
  item first) but is not implemented, because the selection function is pure and cannot read
  the audit log it would need to know what has been spilling.
- **A third anchor-creation grammar** (chapter 5), matching dated report paths, shipped,
  produced real anchors overnight, and was then deliberately retired by owner ruling — with a
  regression test asserting the removal in both directions.

## Appendix: how to reproduce this reference's own evidence

Every worked example in every chapter is reproducible read-only from a checkout of this
repository:

```
node src/cli/index.ts --help
node src/cli/index.ts status
node src/cli/index.ts doctor
node src/cli/index.ts rules list
node src/cli/index.ts rules verify
node scripts/check-handover.ts
node scripts/check-basis.ts
```

None of these mutate the corpus, the conversation index, `.anchors.jsonl`, or git state. Any
command shown in a chapter that *does* mutate (`add`, `edit`, `repair`, `pack import`,
`restore --approve`, any `lesson*` command) was deliberately **not** executed while writing
this reference; those chapters describe it from source instead and say so.

---

*14 files, 5,959 lines, 394 KB, written directly against the source tree and this repository's
own live corpus on 2026-09-12, then **verified claim by claim and corrected against the code on
2026-09-13** (`reports/2026-09-13-capabilities-doc-verified.md` is the audit that drove it).
Counts, line citations and live outputs are dated where they appear; the corpus, the anchor
file and the conversation archive all grow daily, so read any figure as a reading rather than
as a constant.*
