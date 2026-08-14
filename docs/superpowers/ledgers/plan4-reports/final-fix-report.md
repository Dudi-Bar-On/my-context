# Final whole-branch review — fix report

**Branch:** `worktree-my-context-plan4` · **BASE:** `b05690e` · **Fix round:** `66124ba..5ebef08`
**Tests:** 1176 → **1359, all green** · `npx tsc --noEmit` clean · `git status --porcelain` empty

Eight commits. Six subagents on disjoint file sets; the cross-cutting documentation was held by
the lead so no two agents edited one file.

---

## 1. The six Criticals

### C1 — `createItem` lost content silently under concurrency

Eight racers with the same title and different bodies lost 6 items across 8 runs; every racer
reported `created: true` and exit 0.

**Ruling: exclusive create, not a lock.** `writeItem` has one caller (`persist`) reached by ten
paths, eight of which never take the ingest apply lock — and that lock is *already held* around
`applyCandidates`, which itself calls `createItem`, so reusing it would deadlock the ingest path.
The exclusive create puts the guarantee inside the single filesystem operation every path already
goes through, using the same `linkSync`-a-fully-written-temp-file construction `lock.ts` already
proves, with the same latched fallback for filesystems without hard links.

On `EEXIST`, `createItem` re-reads the file **from disk**, never from `ctx.store` — the store's
staleness *is* the bug — then either dedupes against it or advances to the next id in the family.

*Measured: **0/8** with the fix hand-reverted, **8/8** with it.* The first version of the test was
only a **5-of-8 detector**; a wall-clock rendezvous barrier and four rounds were needed, and
deterministic stale-store tests were then added so the guarantee does not rest on timing at all.

### C2 — MCP writes text the parser cannot read back

A sentence-ending double space permanently mismatched the item's checksum; `rebuild` did not repair
it. The collapse that makes the round trip work existed only in `schema.ts`, and the MCP path never
reached it. Now one `normalizeObservations` in `mutate.ts`, where both surfaces already converge.

The **validate-then-collapse ordering is load-bearing** and preserved: a line break must stay a
rejection, and a collapse running first would erase it into a space. `context` is trimmed but not
interior-collapsed, because `parseObservations` does not collapse it — checked, not assumed.

`__proto__` is refused, **verified by execution**: a `JSON.parse`-built `extra` carrying it renders
no frontmatter line, re-parses to `{}`, and mismatches its checksum. `constructor` and `prototype`
were tested identically, round-trip cleanly, and are deliberately **not** refused.

Round-trip tests cover all five adversarial variants, assert both `computeItemChecksum(reparsed) ===
reparsed.checksum` and `renderItem(parseItem(file)) === file`, and drive one variant through the
real MCP registry.

### C3 — the draft count disagreed across four surfaces

One exported `reviewQueue()` in `core/select.ts` now feeds all four. **Ruling on placement:** it is
pure (`Item[] → Item[]`), and `core` is the only layer both `src/mcp` and `src/cli` already depend
on. The layer filter is documented as part of the *definition* of the queue, not a display choice.

The two call-site inputs genuinely differ (`buildIndex` passes a post-`mergeLayers` array; the CLI
and MCP pass `store.all()` unmerged). Equivalence is argued from `mergeLayers` never preferring a
global copy plus `id` being the SQLite primary key — and then pinned by test rather than asserted.

### C4 — the approval boundary was materially incomplete, and a test pinned it as honest

Two things were missing, both reachable today:

1. `mycontext add <normative category>` creates an **active governing item** directly — absent from
   the deny list and from the "the gate holds iff these commands" sentence.
2. The `PreToolUse` write-deny has matcher `Read|Edit|MultiEdit|Write|NotebookEdit`. **`Bash` is not
   matched**, and `runPreToolUse` only inspects a `file_path` argument, which a Bash call does not
   carry. A shell redirect plus `mycontext rebuild` goes around it entirely. Adding `Bash` to the
   matcher would not close it — the hook would have to parse arbitrary command strings.

The corrected statement is now in all three places a reader arrives from: **the gate holds iff the
agent's Bash surface excludes the `mycontext` binary entirely, in every spelling, *and* direct
writes into `.my_context/`.** The deny list gains an `add` rule and states plainly that these rules
are **not complete coverage** — they are prefix matches on a command string.

`mycontext add` on a normative category now requires `--yes`, on the same terms as `promote`, and
is never described as protection against an agent.

### C5 — `SKILL.md` claimed everything lands as a draft

False for the **7 rationale categories of the 17** the standard profile enables. The skill now
branches on tier, and its test reads the **real resolved config**, so the two lists cannot drift.

### C6 — four places instructed hand-editing frontmatter

**Verified by execution:** hand-edit `always:`, run `rebuild`, and the `checksum:` line is
byte-identical — `rebuild` does not restamp — so `doctor` exits 1 from then on. Worse, that finding
is also the only signal for a genuinely lost-at-write-time item, so a hand edit makes real
corruption indistinguishable from the edit.

**Judgement call, as requested: yes, there was a real gap, and `mycontext repair` now exists.** It
re-stamps the checksum of project items whose recorded checksum disagrees with their content, after
listing every one and requiring `--yes`. It states honestly that it **cannot recover content lost at
write time** — commit `d7f75a1` shows an item that was internally self-consistent with only a stale
checksum as evidence of truncation, i.e. `repair` would have blessed the lost text.

**Ruling: `repair` is deliberately NOT named in `updateItem`'s two refusal messages.** It re-stamps
a checksum; it does not change `scope`/`always`/`severity`/`status`, so naming it there would imply
hand-editing is the sanctioned route for a change it cannot make. Verified instead that **there is
genuinely no CLI or MCP route today** for a human to change those fields on an already-*governing*
item, and the messages now say that plainly rather than inventing one. Recorded as follow-up #1.

---

## 2. Importants and Minors

All fourteen Importants fixed. Rulings worth surfacing:

- **I1** — *support* `--body`/`--scope`/`--tags` on `add` rather than refuse them. It is plumbing
  into a `createItem` that already takes all three, and it is what lets C6 remove the hand-edit
  instruction without leaving a hole. Also fixed the trap Task 10 carried forward: `--yes=false`
  and `--yes=no` **confirmed** the action.
- **I7** — refuse corrupt staging and name the file; deliberately **no `--force`**. The staging file
  is the only record of which candidates a human already accepted or discarded.
- **I8** — recover the applied log independently of the header; refuse when it cannot be reconciled.
  Sound only because the session id embeds a checksum of the exact document, which is now *checked*.
- **I10** — the anchor stays applied in the mixed case; rejections go in a separate log. They could
  not go in the applied log: `foldApplied` treats the presence of a line as "applied", so recording
  a failure there would mark the chunk done *because* it failed. Durable is not visible, so
  `ingest-status` now renders them at every level.
- **I12** — the code was right about detail levels, the README right about `--json`.
- **I13** — re-verified by execution against a copy of this branch's index: `DELETE` and `ATTACH` are
  refused; **`VACUUM INTO` succeeds**, writing a 126,976-byte readable database to a caller-chosen
  path.
- **I14** — pid-authoritative staleness plus a per-acquisition nonce. A heartbeat is not
  implementable here: the critical section is synchronous and `sleepMs` blocks the thread.

---

## 3. Verification

- **Every fix has a test that fails without it**, verified by hand-reverting and watching it go red.
- **Lead mutation run: 22/22 killed**, including one that re-introduces the C6 defect into
  `mutate.ts`. Agents reported ~40 more, including **seven mutants the ledger had recorded as
  surviving** — four in `derive.ts`, three in `lock.ts`.
- **Dogfooded against this repo's real `.my_context/`:** 39 items, 0 drafts, `doctor` 0/0/0 exit 0,
  `repair` reports nothing to re-stamp, `add` without `--yes` refuses at exit 1 and writes nothing,
  `list --ful` is refused, and `query` capped a real 59,319-row cartesian in 0 ms with a loud notice.

### Three measurements that change how results should be read

1. **The pre-existing lock suite was a 0/8 detector** for both defects I14 fixes — not weak, zero.
2. **A mutation result read against a red suite is worthless.** My first documentation run reported
   10/10 killed while the suite was already failing for an unrelated reason. Re-run against green,
   **2 of those 10 survived** and both guards were genuinely weak.
3. **One of my own assertions was vacuous on delivery** — an alternation of literal field names
   against a site that interpolates `${field}`, matching neither of the two sites it guarded.
   Mutation testing is the only reason it is not instance twenty-one.

---

## 4. Corrections to the review's own findings

- **"Test temp dirs leak on success" is wrong.** A green run leaked **0**; one *red* run leaked
  **15**. The cost of the missing `try/finally` was failure runs, not success runs.
- **`OPENQ-how-do-filters-respect-dependencies` is not currently truncated** — `d7f75a1` repaired it.
- **`doctor`'s checksum message does not accuse the user.** My own first draft of the corrected docs
  restated the review's harsher framing and was itself corrected by execution.

---

## 5. Concerns

1. **Follow-up #1 is the one I would not merge quietly.** There is no human route to change
   `scope`/`always`/`severity`/`status` on an already-governing item. The messages are now honest
   about it, which makes the gap visible rather than papered over — but it is a real hole in the
   lifecycle and it should be someone's next task.
2. **The reused-pid lock wedge is unfixed and unfixable portably.** Mitigated only by a message.
3. **The hard-links fallback was never exercised on a real filesystem lacking hard links** — only via
   a monkeypatched `fs.linkSync`. Its empty-target window is reasoned, not observed.
4. **`repair` legitimises hand-editing to a degree.** It is gated, it lists everything, and it says
   what it cannot do — but it is a re-stamp, and a user who reaches for it after content was lost at
   write time will bless the loss. The wording fights this; the affordance still exists.
5. **Parallel agents in one worktree need namespaced scratch paths.** One agent overwrote a peer's
   untracked scratch file; the contents were unrecoverable because untracked files have no git copy.
6. **11 follow-ups are recorded in the ledger** with file and line. That ledger is the only place
   they survive.
