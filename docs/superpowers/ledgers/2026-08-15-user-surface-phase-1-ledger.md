# SDD ledger — plan: docs/superpowers/plans/2026-08-15-user-surface-phase-1.md

Spec: `docs/superpowers/specs/2026-08-15-mycontext-user-surface-design.md`
Branch: `feat/phase-1-editing`, from merged master `4c3add9`

## Task 4's interface, recorded because Tasks 5–7 cannot see that file's history

`src/core/revision.ts`:

```ts
stageRevision(ctx, itemId, changes, origin)
  → { revision, alsoPending, duplicate, message }
pendingRevisions(ctx)            → PendingRevision[]   // whole workspace, oldest first
revisionFor(ctx, itemId)         → PendingRevision | null   // the OLDEST pending for that item
revisionHistory(ctx, itemId)     → RevisionRecord[]    // every state, including discarded
promoteRevision(ctx, itemId, { revisionId?, force? })
  → { revision, update, invalidated, message }
discardRevision(ctx, itemId, { revisionId?, reason? })
  → { revision, logPath, message }
```

`RevisionChanges` covers `title`, `body`, `tags` only. **No `observations`** — no write surface can edit an
existing item's observations (`UpdateInput` has no such field), so carrying it would be a coverage claim
the code cannot honour. `scope`/`always`/`severity`/`status` are **refused at stage**, so `agentEdits`
cannot become a route around `guardedChange`.

All five throw `my_context:`-prefixed errors rather than returning failure shapes.

## Rulings

**R1 — the gate scales with what the edit can do.** A single `edit` command with one confirmation
would ceremoniously gate changes that cannot matter and accept fields that silently do nothing.
*Cost if wrong:* more branches to keep consistent.

**R2 — Phase 1 ships editing semantics; Phase 2 ships the surface.** Risk is concentrated in the
first: new state, a trust-boundary change, and the mechanism every later surface calls.

## Task log

**Task 1 — config keys.** `3c9689a`, `4c4f0fb`. 1620 → 1634.

Two corrections to the plan, both accepted: `enumError` lives in `src/core/teach.ts`, not `mutate.ts`;
and `categories.ts` was deliberately **not** touched, because both defaults are functions of the tier
the catalogue already declares — a literal on each of 20 entries would be 20 places to drift.

Found and left alone, as pre-existing: a mutant clearing `extraFields` in `resolveConfig`'s override
branch **passes the entire suite**, so a config-overridden built-in silently loses `rule.directive` and
`assumption.validate_by`. And `prefix` is accepted on a built-in override and never read. Both are
`INV-nothing-is-dropped-silently` violations (task #81).

**Task 2 — scope policy.** `325cd37`, `9ebd372`. 1634 → 1667.

**Thirteen** sites interpret an empty scope. `query_items({path})` was a genuine second rule-holder —
the same shape as the `has_scope` SQL filter that would have made the previous scope change a no-op in
production while every unit test passed.

Renders `(inert)` rather than a consequence, because that names the setting the user wrote and stays
true under all three policies; it deliberately does not claim "never injected", since `always: true`
still pins regardless of scope. Added a **third** structural test: the finished words may not appear
anywhere in `src/` outside `render-item.ts`.

Answered the spec's open question **yes** — an edit removing the last glob is refused under `required`.
Put `checkScopePolicy` in scope rather than deferring it, because hazard 3 is invisible by construction.

**Task 3 — inert-field refusal.** `3894221`, `2c510ab`. 1667 → 1698.

**`scope` is accepted, and the second reason is decisive on its own:** refusing it would make Task 2's
`scopePolicy: "required"` unsatisfiable — the config would demand a scope at capture while the tier
refused it, two contradicting messages for one action. A contradiction between two features shipped an
hour apart, caught before merge.

The refusal fires on the **assertion**, not the presence of a value, so `always: false` stays accepted
(it is what ingest passes for every candidate). But `review promote` gates on the **flag**, not the
change, because nothing echoes fields on a CLI — without that divergence, promoting a rationale draft
that already carried `always` succeeded **silently**. Found by running it; separate commit.

Fixed a lying preview on the way: `review promote` reported a rationale draft carrying `always: true`
as "pinned — injected in full at every session start". It never is.

**Task 4 — staged revisions.** `3277156`, `9634250`, `f8b11f5`. 1698 → 1729. Not split.

Modelled on the **ingest session**, not lesson staging, because lesson staging rewrites a whole JSON
document: two processes settling two revisions would have the second erase the first's outcome — a
human decision lost with no trace. Append-only also makes "discard does not lose the proposal"
structural rather than promised.

Took lesson staging's `loadStaging` correction: `readLog` has three outcomes, not two — absent is `[]`,
unreadable **throws**, a damaged line **throws unless it is a torn tail**. Skipping a bad middle line
could drop a `discard`, which is exactly how a discarded candidate comes back pending.

Moved `acquireApplyLock` to `src/core/lock.ts` rather than writing a fifth file lock; `src/ingest/lock.ts`
keeps both exports and all 29 existing lock tests pass unchanged.

**Stale revisions refuse**, naming the fields that moved and printing both texts; `force` overwrites and
says so. Staleness is scoped to the revision's **own** fields — whole-item staleness would make `force`
routine, and a routine `force` discards the human's edit anyway.

**A second revision accumulates.** Each records its own `base`, so promoting one leaves the others stale
rather than silently applied on top. `promoteRevision`'s `invalidated` names exactly what *this*
promotion made stale, computed from a before/after diff so it never blames itself.

Two defects found by execution, not reading:
- **`promoteRevision` decided against a stale store.** Two real processes each load the workspace
  *before* contending for the lock; the loser missed the winner's change and would have handed
  `updateItem` the winner's fields at their old values — a lost update with the lock working perfectly.
  Fixed by re-reading the item from Markdown inside the lock. Only reproducible with two processes.
- **Newline-healing a torn tail would have wedged the log.** The ingest heal leaves the fragment as a
  permanent middle line, which the stricter reader then refuses forever. `healTornTail` truncates.

**Task 5 — agentEdits at the write path.** `85bec47`, `0fe8915`. 1729 → 1757.

`updateItem` reads `agentEditsFor(config, type)` (new, config.ts, the sibling of `scopePolicyFor`) and
stages a non-human caller's content change under `review`. `MutationResult` gains an optional
`staged: { revisionId, duplicate, alsoPending }`; `created` is `false` and `status`/`filePath` are the
ones the item still has. `update_item` (MCP) is the **only** non-human caller of `updateItem` in the
codebase, so the whole policy lives or dies on that one path — driven over real stdio, four cases.

The **policy check sits after both trust-boundary refusals**, and that placement is the whole of
requirement 1. A call that would move scope/always/severity/status on a governing normative item is
refused before it can reach `stageRevision`, so `review` is not a route around `guardedChange`; and
`allow` is read only on content, so it does not widen it. Mutating the order kills a test.

**A mixed content-and-guarded call is refused whole.** Under `review` the two halves have different
fates — one held, one applied — and there is no honest outcome: applying half and reporting success is
the defect this codebase exists to avoid, and dropping half is the silent drop. On a governing item the
field guard already refuses first; the new refusal covers what it does not reach, a normative **draft**
and any rationale category a user sets to `review`. `extra` counts as the unstageable half, because
`RevisionChanges` cannot carry it.

Three claims corrected rather than written:
- `stageRevision`'s message named `mycontext review` as how a human sees a pending revision. **No
  shipped build does that** — `review` walks the draft queue. Harmless while the store was
  library-only; false to a real agent the moment Task 5 routed edits there. Now names the log path and
  says plainly that no command surfaces revisions yet. **Task 6 must replace that clause.**
- Both trust-boundary refusals ended "title, body, tags and extra are still editable here", true only
  under `allow`. Now policy-aware (`openContentPhrase`, `stagedContentCaveat`); a mutant that always
  prints the `allow` wording is killed.
- Three pre-existing tests asserted an agent's content edit landing on a `constraint`. That is now the
  `allow` behaviour, so they set it explicitly and say why — they are about the guard's narrowness, not
  the policy.

Applied uniformly, with **no draft exemption**: spec §2's agent row says "any item", and carving one
out would be widening what an agent may do without being asked. The consequence is that a normative
draft can carry both a draft-queue entry and a pending revision — Task 6's two-queue problem.

Import cycle held under every real entry point, not just `node --test`: `src/cli/index.ts` (init, add,
list), `src/mcp/server.ts` over stdio, and all four hooks (`session-start`, `pre-tool-use`,
`post-tool-use`, `pre-compact`). Nothing on either side reads a binding at module-evaluation time.

**Task 6 — `review` walks pending revisions.** `ae935a1`, `47f7381`, `a3bb56a`. 1757 → 1776 (1775 pass,
1 POSIX-only skip).

**Count spelling: PENDING REVISIONS, not items carrying one.** A revision is the unit of decision —
each is promoted or discarded on its own — so counting items would tell a human "2 waiting" for a
queue with three approvals left in it. The item count travels in the same sentence, because a lone
number cannot say which of the two it is. `pendingRevisionCounts`/`pendingRevisionLine` (review.ts)
own the numbers and the sentence; `status` prints that sentence rather than one of its own, and all
three JSON documents carry the same `pendingRevisions: { revisions, items }`. The agreement test
enumerates **thirteen** surfaces (ten text, three JSON) in one comparison, on a corpus of **3
revisions across 2 items** so the wrong spelling is a different number — on one-revision-per-item
data every wrong spelling agrees with every right one. Three mutants killed by it: swapping the
helper, making `status` alone disagree, and narrowing `review revisions <id>`'s count to the item.

**Two queues, two verbs, no guessing.** A normative draft can hold a draft-queue entry and a pending
revision at once, so `review promote <id>` and `review promote-revision <id>` are separate
subcommands: one makes the draft govern its CURRENT text, the other rewrites that text. `review list`
names the overlap under the table (and in `--full`'s new `revisions` field), and `review promote` /
`review discard` say before their confirmation that they apply no revision. The note is emitted at
those two call sites rather than once higher up, because every refusal on the command runs before any
output and a note printed above a refusal reads as an operation about to be refused.

**`force` is gated twice.** `--force` is the only way to promote a stale revision: `confirmAction`,
and a block printed **before the prompt** showing the human's intervening text — the applied diff
(`-` is what is destroyed) plus a base→current diff of what changed underneath, each with its own
legend. `--force` on a revision that is not stale says so rather than being swallowed. Both refusals
(stale, missing item) precede the preview and use the store's own wording: `staleRefusal`,
`missingItemRefusal` and `pickPendingRevision` are now exported so the CLI does not grow a second
copy of a refusal or of "which revision is this about".

**The diff elides nothing** — LCS line diff, every field, every line, unchanged lines as context. A
**record view, not a table**: `review list --full` became one because an id is an unbreakable token;
here the widest field is a line of a body, so no column set exists. Only the metadata varies by
level, never the diff. `--full` adds the other pending revisions on the item, stated **per field**,
because staleness is per field — "promoting this makes them stale" is false for a body proposal
beside a title proposal, which is as likely a pair as not.

Two false claims retired in the commit that made them false: `stageRevision`'s "no command surfaces
pending revisions yet", and `discardRevision`'s "readable through the revision history", which named
a library function a user cannot call — it now names `review revisions <id> --full`, which prints the
discarded text. The message is pinned by a test that **runs every command the message names** and
asserts each exits 0 and reports the revision; a message naming a command is only as true as the
command.

Task 4's `a revision moves no count` test needed rewriting, not deleting: `list`, `decay` and
`doctor` stay byte-identical, and `status`/`review` are byte-identical **with the pending-revision
section cut out**, so a revision leaking into any count still fails it.

Measured at the hostile id (67 chars), every level: `review` 99, `review revisions` 100, `review
revisions --full` 100, `--summary` 99, `status` 99. The one line over budget on the new surfaces is
`confirmAction`'s pre-existing non-interactive refusal at **137 columns**, shared verbatim with
`review promote`, `review discard`, `supersede` and `repair` — left alone as out of scope, and it is
the only thing standing between those commands and a clean 100.

**Task 7 — the `edit` command.** `bbe8bd6`, `5a36122`, `883ce9d`. 1776 → 1805 (1804 pass, 1
POSIX-only skip).

**The gate is one function, `gateFor`.** `confirm` is `governsNormatively`'s predicate spelled
at this surface (normative tier, `active` or `validated`); `reach` additionally asks whether any
CHANGING field is reach or force, and that is the whole of spec §2's last two rows. Both mutants
— never gate, always gate — are killed, as is widening `reach` to every gated edit.

**Row 2 has an exception and it is Task 3's, not a new one:** `scope` on a rationale item is
ACCEPTED. The table's short wording says "reach or force refused"; the code refuses `--always`
and `--severity hard` only, because `query_items({path})` matches scope over every item and
because refusing it would make `scopePolicy: "required"` on a rationale category unsatisfiable.
Pinned by its own test so this command cannot drift into the table's shorter reading.

**The refusal fires on the FLAG, not on the value moving** — the same divergence `review
promote` takes, and the survivor that found it was a mutant deleting the early
`inertFieldError` calls: `updateItem`'s own check only fires when the value MOVES, so
`--always` on a retiered item that already stores `always: true` was answered "nothing to
change". Nothing echoes on a CLI. `--always=false` and `--severity soft` stay accepted, so a
stored-but-inert flag is still removable.

**`injection()` moved out of `supersede.ts` into `src/cli/commands/injection.ts`** and takes a
`Pick<Item, …>` rather than an `Item`, which is what lets the preview ask ONE function what
governs before and after — the "after" line is a real answer about a built post-edit shape, not
a second hand-written model of `select`'s order. `globalLayerRefusal` (mutate.ts) is the same
move for the layer refusal: `requireWritableItem`, `supersede` and `edit` now share it, so the
two commands that must check EARLY (ordering: no refusal after a preview) cannot drift from the
store's sentence. `review`'s "promoted or discarded" wording is deliberately left alone — it is
a different sentence, not a third copy of this one.

**`--status superseded` is refused.** `updateItem` would have allowed it, and the result is an
item marked as replaced by nothing — with the README's "retirement without a successor is not
offered" made false the day this shipped. It names `mycontext supersede <id> --by <id>`, and
`--status deprecated` for the case with genuinely no replacement.

**A pending revision is reported twice, from both sides of the write.** Before the prompt: which
revisions this edit will make STALE, stated per FIELD (a body edit leaves a title proposal
promotable, so a blanket warning would be a warning about nothing). After the write: which ones
actually became stale, recomputed from the store — a prediction that turned out wrong must not
be the last thing a user was told. The pre-note is emitted on the UNGATED path too, which is
the one that has no prompt to carry it (a normative draft can hold both a draft-queue entry and
a revision).

Measured at the widest id a title can mint (65 chars): content 95, `--scope` 95, `--severity`
95, and the status crossing exactly 100 — at the budget, not over it. `confirmAction`'s
question is deliberately short — `Apply this edit to <id>?`, 94 columns at a 67-character id
with the ` [y/N] ` it appends — because that function does not wrap; its 137-column
non-interactive refusal is untouched.

Documentation: only the parts Task 7 made FALSE, not Task 9's prose. Both READMEs' command
table, flag table (`--always`'s "only while a draft" was false the moment this shipped, and the
glossary's "no CLI command sets `validated`"), the `--yes` list, the unknown-flag list, the
command counts (21 → 22, 17 → 18 with no slash command), §7's gate list (six commands → seven)
and the deny list; `SKILL.md` and `workflow.md`'s gate lists. `plugin-assets.test.ts` pins
`edit` in all three of its documents plus both README lists — the SIXTH `--yes` entry, asserted
as a sentence so a reflow does not break it. **The SKILL.md ceiling was NOT raised**: 4319 of
4390.

**Task 8 — `pin` / `unpin` / `harden` / `soften`.** `3abf39b`. 1805 → 1812 (1811 pass, 1 POSIX-only
skip).

**Task 7's recommendation was taken unchanged: they rewrite argv into `cmdEdit`.** `runNamed`
settles the three refusals that would otherwise be answered in `edit`'s vocabulary — unknown
flag, missing id, second positional — and then calls `cmdEdit(ws, [id, entry.sets, ...flags])`.
Everything past that point is `edit`'s, which is what makes "same preview, same gate, same
result" structural rather than promised, and what lets the agreement test compare STDOUT byte
for byte instead of comparing two renderings that merely look alike. `edit`'s own usage line is
unreachable from here precisely because those three cases are settled first.

**The plan's sketch of the equivalent is wrong and the test says so:** `pin` is `edit <id>
--always=true`, not `--always true`. `always` is a switch, so nothing consumes the next token
and `true` lands as a positional `edit` refuses. The named form is the spelling a person cannot
get wrong, which is half of why these commands earn their place.

**One test, eight corpora × four entry points, one `deepEqual`.** Each pair runs in fresh,
SEPARATE workspaces (a shared one would compare an already-edited item against a pristine one)
and compares exit code, stdout and the resulting item file. The corpora are the gate table's
rows plus the refusals a rewrite could plausibly drop: no `--yes`, `--yes=false`, a rationale
item (Task 3's `inertFieldError`, carried through verbatim — the comparison is byte-for-byte,
so "identical, not merely similar" is what is actually asserted), a normative draft, and a
pending revision on both the gated and the ungated path. Three mutants killed by THIS test and
no other: `harden` set to `--severity=soft` (one command diverging), an unconditional `--yes`
appended (the gate dropped), and an extra `about to <name>:` line (the preview diverging). A
fourth — deleting the unknown-flag refusal — is killed by the accept-surface test.

**They take an id and `--yes`, and refuse every other flag**, including ones `edit` owns.
`--yes` has to be accepted or the inherited gate could not be answered. `pin <id> --severity
hard` is refused because it is two edits under a name describing one of them, previewed and
confirmed as a single action — and a named command that takes a field it does not own is a
second, smaller `edit` with its own surface to keep in step. The refusal names `mycontext edit`
as the command that changes more than one field. Enumerated in one assertion, for the same
reason the agreement is.

**The approval-gate list: alias in prose, four separate rules in the deny list.** They are NOT
four more entries on the `--yes` list — that would say there are four more mechanisms than
there are, and the list's value is that it maps mechanisms. Both READMEs' gate list now says
they belong to it as `edit` does, and the `--yes` row names them as `edit`'s named forms. But a
permission rule matches the command STRING, so `Bash(mycontext edit *)` does **not** match
`mycontext pin …`: a deny list stopping at `edit` leaves four working routes to the write it is
denying, invisibly. Four rules added to both READMEs, and the reason both answers differ is
written down and pinned. `SKILL.md` carries the alias in ONE place — the operative "So: never …
on the user's behalf" sentence, since an agent told "never `edit`" is not thereby told "never
`pin`" — because the clause costs 34 characters and the file had 71 (4319 → 4353 of 4390), so
there was room for it in one place and that was the sentence worth spending it on; **the
ceiling was not raised.** `workflow.md` gained a paragraph.

Documentation limited to what this made false or incomplete, Task 9 still owning the prose: the
command table, the `--always`/`--severity`/`--yes` rows, the gate list, the deny list and the
counts in both languages. Two of those counts were **already** false — the English mermaid node
said 21 CLI commands (never updated for `edit`) and both "N of the M have no slash command"
lines were a task behind. Now 26 and 22 of 26, checked against the running banner.

`f2-registry.test.ts` gets four setups rather than an allowlist entry: each is a real registry
command with its own rewrite in front of `cmdEdit`, and a rewrite that dropped the id would
never reach F2 at all — which is the case that file exists to catch. Each starts from the value
its command moves AWAY from, so all four exercise a write rather than "nothing to change".

Measured at the hostile id (60+ chars): every preview line and both usage blocks inside 100.
`namedUsage` wraps through `paragraph` because `refuseUnknownFlag` prints its argument as one
`out` call and would not wrap it. The `--help` rows are 84, 90, 85 and 99 columns (`unpin` is the
long one); `review`'s 149-column row is still the widest.

## Carried into Tasks 7–9

- **`review`'s `--help` row is 149 columns** with seven subcommands. Shortening it to
  `review [<subcommand>]` was tried and reverted: it drops `list` — the DEFAULT — out of `--help`,
  the exact defect the derivation from `SUBCOMMANDS` exists to prevent, and the pin caught it. If the
  banner ever gets a width budget, this row is what it will fail on.
- **`confirmAction`'s refusal is 137 columns** (above). One wording, five commands, one edit.
- **Documentation is untouched by design** — Task 9 owns prose. `npm run gen:docs` reports both
  READMEs unchanged, because no generated example has a pending revision in its workspace. `review
  revisions`, `promote-revision` and `discard-revision` are **undocumented** until Task 9, and the
  approval-gate list does not yet mention them.
- `test/helpers/revisions.ts` (`stageIn`, `humanEdit`) is how a test creates a revision and a stale
  one; there is deliberately no CLI that stages, since staging is what happens TO an agent's edit.

## Carried into Task 7 (unresolved from Tasks 4–5)

- ~~**`stageRevision`'s message still has to be finished.**~~ **Resolved in Task 6**: it names
  `mycontext review revisions` and `mycontext status`, pinned by a test that runs both.
- **`extra` is not staged.** Under `review`, an agent changing only `extra` — which holds
  `rule.directive`, an instruction — applies immediately. Refused only when paired with a content
  change. Widening `RevisionChanges` to carry it is a Task 4 decision, not one Task 5 took alone.
- **`isError` is `false` for a staged edit**, because nothing failed. The text is unambiguous, but a
  client that branches on `isError` alone sees a success.

## Carried into Task 7 (from Task 4)

- **Import cycle:** `mutate.ts → revision.ts` closes a cycle (`revision.ts` imports `updateItem` and
  three validators). ESM handles it while both sides only *call* hoisted declarations — do not add a
  top-level `const` either side reads at module-evaluation time.
- ~~**`force` needs a human gate.**~~ **Resolved in Task 6**: `review promote-revision --force` sits
  behind `confirmAction` and prints both diffs — the one being applied and the one being destroyed —
  before the prompt. The store still enforces nothing, so any FUTURE caller of `promoteRevision`
  owes the same.
- ~~**Count spelling.**~~ **Resolved in Task 6**: pending REVISIONS, from `pendingRevisionCounts` /
  `pendingRevisionLine`, on all thirteen surfaces. Any new surface reporting this queue must print
  that sentence and join the enumerating test.
- **`deny` (spec §4 open question):** not added. `stageRevision`'s refusals already tell an agent
  immediately in the two cases that matter, so `deny` would only add "never accumulate at all".
- Revision log growth is unbounded, never pruned, and `doctor` has no `.revisions/` check.

## Carried into Tasks 8–9 (from Task 7)

- **`edit` cannot change `extra`**, which holds `rule.directive` — an instruction. A human
  editing a rule's directive still has no command, and `update_item` applies it directly even
  under `agentEdits: "review"` (Task 5's carried item). The two gaps are the same gap.
- **Nothing edits `observations`**, at any surface, by any origin. `UpdateInput` has no such
  field; `edit` inherits that and claims nothing about it.
- **The revision note is printed twice on one edit** — a prediction before the prompt and a
  fact after the write. Deliberate (see above), but it is the one place this command repeats
  itself, and a reader who finds it redundant is not wrong.
- **Task 8's four named commands must reuse `cmdEdit`'s implementation**, not its shape: the
  argument parsing, the gate and the preview all live in `cmdEdit`, which takes `args` rather
  than a parsed patch. The cheapest honest entry point is to rewrite argv (`pin <id>` →
  `edit <id> --always`) and call it, which is also what makes the enumerating agreement test
  assert on identical stdout.
- **The `--help` row for `edit` is 84 columns**, inside the banner's ordinary width; `review`'s
  149-column row remains the widest.

**Task 9 — documentation and dogfooding.** `db01c38`, `8acbddd`, `0b4454c`, `b9ec71b`.
1812 → 1820 (1819 pass, 1 POSIX-only skip).

**All three named false statements are corrected, and there were four more.** The line
numbers had all moved; each was found by reading the sentence, not the number. §7's
inventory (`README.md:1557` by the time this ran, not 1544) said an agent can "revise an
item's title, body, tags and extra fields" — under the default it can only PROPOSE, and the
same sentence also omitted `status` from `update_item`'s refusals. `update_item`'s tool-table
row listed seven freely editable fields. §8's Wave-4 entry described `edit` as unbuilt.
The four extras were one claim in four places: that `review promote --always` is the only
route to `always: true` (§4, §5, §6, the glossary `pinned` entry). **Verified by executing
each corrected sentence** — the tool responses in §6 are now derived by a test that drives
the MCP server, and `pin`'s route was run.

**Dogfooding found two defects, both invisible to the whole suite.**

1. **Two agent-facing refusals still named hand edit + `mycontext repair` as the human
   route, and opened by claiming no command makes the change.** Task 7 falsified the claim
   and Task 8 the remedy. Reached only under `agentEdits: "allow"` on a normative category
   — the one configuration that lets a guarded-field call get that far — which is why no
   test saw it. `HAND_EDIT_ROUTES` now enumerates every phrasing that could bring it back.
2. **Four revision messages told a rationale item it "governs".** Every revision test, CLI
   and store, uses a `rule`. Setting `agentEdits: "review"` on `lesson` in this repo's own
   corpus and walking one edit to a promotion produced all four. Fixed per message rather
   than by a blanket rewrite: the word is load-bearing on the normative tier and a neutral
   rewrite would have spent that. `tierOf` is exported for it. The aggregate
   `pendingRevisionLine` cannot branch (it counts both tiers in one sentence) so it says
   what is true of both.

The dogfooded lesson body was restored with `mycontext edit --body`, leaving the item file
byte-identical to `HEAD` — which is itself the edit path that lesson is about.

**The SKILL.md ceiling was raised, 4390 → 5170**, for the two things Task 8 predicted would
justify it: that an agent's content edit is STAGED by default and must not be reasoned from,
and that `review promote-revision` is the eighth gate-list command and the only one applying
a rewrite the agent itself proposed. The reason is recorded on the test and both claims are
pinned by a new one, so the next round needing space cannot spend this budget on other prose.

**The untested Hebrew lists are now pinned**, in the only way that does not pin a
translation: the deny block is JSON both documents ask a reader to copy, so the two arrays
are compared element for element; and the gate table names commands, which are Latin in both,
so every gated command the English table names must appear in the mirror. Neither can tell
whether the Hebrew *sentence* around a command is right — that stays a review obligation.

**The drifting counts are generated-adjacent rather than corrected a third time.**
`test/docs/counts.test.ts` derives the CLI total from the running usage banner, the slash
totals from `commands/`, and the "N of M have no slash command" ratio by subtracting one from
the other — including the rule that `add` and `list` DO have a slash surface, under a longer
name, which a naive version of this test would have "corrected" a right number for. The two
spelled-out totals ("Twenty-six commands", "עשרים ושש") became digits so they could be
pinned at all. Three occurrences are now checked in both languages, plus the enumeration
beside the ratio.

**Two more deny rules, and the reason is the `pin` argument from the other side.**
`Bash(mycontext review promote *)` does not match `mycontext review promote-revision …` —
the pattern wants a space where the command has a hyphen — so a deny list stopping at
`review promote` left the widest revision route open while looking closed. The non-match is
demonstrated by a test rather than asserted. The gate list is eight commands.

**The doc fixture now carries one pending revision**, staged through the real MCP server, so
the §5 walkthrough is generated rather than pasted. `status`, `status --summary` and
`review list` gained the pending-revision line as a consequence, which is true output and
introduces the concept where §5 has just explained it.

**`extra` is documented as a gap, not a route.** §6, §7 and §8 each say plainly that
`mycontext edit` cannot change it, that `update_item` applies it directly even under
`review`, and that the field a human cannot reach is the one field an agent's edit is not
held for. No sentence implies a route.

**One process failure worth recording: `git checkout -- README.md`, run to undo a mutation
probe, destroyed every uncommitted README edit in this task.** The plan warns about this in
Global Constraints and names five prior agents; this is the sixth. The work was rebuilt from
context, but the correct sequence is the one the plan states — commit, then mutate — and a
mutation probe on a documentation file should copy the file rather than let `git` restore it.

## Carried into Task 9 (from Task 8)

- **No slash command for any of the four**, nor for `edit` — spec §5's surface is Phase 2, and
  the README's "22 of 26 have no slash command" line now names all five.
- **`SKILL.md` names the four in one place only** (the prohibition sentence), because the file
  has 37 characters of headroom under its 4390 ceiling. If Task 9 needs them in the gate
  paragraph too, that is the change the ceiling has to move for.
- **The named commands are absent from the Hebrew glossary's `--always`/`--severity`
  explanations beyond the flag table rows**, which is where Task 9's prose pass should look.
- ~~**Nothing was dogfooded against this repo's own corpus.**~~ **Done in Task 9**, and it
  found the two defects recorded above.

## Carried past Phase 1 (from Task 9)

- **No slash command for `edit`, the four named forms, or any of the three revision
  subcommands.** Phase 2 owns §5's surface; the README's "22 of 26" line names them all and
  is now derived by a test rather than maintained.
- **`extra` still has no human route**, so a rule's `directive` can be superseded but not
  corrected — and it is the one field an agent's edit is NOT held for under `review`, since
  `RevisionChanges` cannot carry it. Documented as a gap in both READMEs (§6, §7, §8).
  Widening `RevisionChanges` is the fix, and it is a store decision, not a docs one.
- **`observations` are editable by nobody, at any surface.** Stated in §8; nothing anywhere
  claims otherwise.
- **The revision log is never pruned and `doctor` has no `.revisions/` check** — recorded in
  §8 of both READMEs rather than left to be discovered.
- **`isError` is `false` for a staged edit** (from Task 5, still open). A client branching on
  `isError` alone sees a success; only the text says otherwise. `SKILL.md` now tells the
  model to read that text, which is a mitigation and not a fix.
- **`confirmAction`'s non-interactive refusal is still 137 columns**, shared by six commands
  now that the two revision verbs use it. Unchanged and still the only thing between those
  commands and a clean 100.
- **The `+` side of a revision diff wraps to an 8-space continuation indent** while the `-`
  side, whose source lines are already short, does not. Legible, and noticed while reading
  the dogfooded output as a user; not changed, because the indent is what distinguishes a
  wrap from a new line of the proposal.
