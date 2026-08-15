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

## Carried into Tasks 5–7

- **Import cycle:** `mutate.ts → revision.ts` closes a cycle (`revision.ts` imports `updateItem` and
  three validators). ESM handles it while both sides only *call* hoisted declarations — do not add a
  top-level `const` either side reads at module-evaluation time.
- **`force` needs a human gate.** Nothing in the store enforces it; Task 6/7 must put it behind
  `confirmAction` and show the diff of what is being overwritten.
- **Count spelling:** an item can carry more than one revision, so "items with a pending revision" and
  "pending revisions" are different numbers. Pick one for `status` and `review` or they will disagree —
  the defect that shipped five times in one plan.
- **`deny` (spec §4 open question):** not added. `stageRevision`'s refusals already tell an agent
  immediately in the two cases that matter, so `deny` would only add "never accumulate at all".
- Revision log growth is unbounded, never pruned, and `doctor` has no `.revisions/` check.
