# The three contradictions, with replacement text

Drafted 2026-09-03, awaiting the owner's approval. Nothing has been written to
either corpus. Restore point on both remotes: `pre-merge-nested-corpus-20260902`.

Each amendment PRESERVES what the item was protecting and replaces only the
sentence reality has overtaken. Ids, types, severities, `always`, scope and
sections are unchanged.

---

## C1 — REQ-session-focus-controls-what-loads

**Replaced sentence:**

> **The `[rule]` observations are both honoured.** Whatever focus hides is
> disclosed the way spill is, in the injected block itself and not only in a
> command's output; and focus never hides a `severity: hard` item, with the
> count of hard items kept for that reason reported alongside.

**Replacement paragraphs** (the rest of the body is unchanged):

> **The `[rule]` observations are both honoured, and the second is honoured more
> widely than it was written.** Whatever focus hides is disclosed the way spill
> is, in the injected block itself and not only in a command's output. The
> second observation asked that focus never hide a `severity: hard` item;
> `focusHides` in `src/core/select.ts` now exempts THREE classes, each as its own
> early return taken BEFORE the focus axes are consulted at all — `severity:
> hard`, `always: true`, and `continuity: true`. They are written as three
> statements rather than one `||` because they are independent rules with
> independent reasons: `hard` says an item MUST NOT BE VIOLATED, `always` says an
> item MUST NOT FALL OUT OF CONTEXT, and `continuity` says the next session MUST
> NOT START OVER. An item can carry any one without the others, which is exactly
> how the second came to be missing for as long as it was.
>
> **EXEMPTION, NOT DISCLOSURE, and that is the ruling rather than an
> implementation detail.** DEC-a-focus-may-not-hide-a-pinned-item (owner,
> 2026-08-27) rejects this item's original remedy by name: *"Not chosen:
> disclosing what a focus hides instead of exempting. Disclosure is the right
> treatment for a deliberate drop, and this is not one — the items are marked as
> never droppable."* Disclosure remains the whole treatment for what focus DOES
> hide. It is not a treatment for what focus may not hide at all. The measured
> cost of confusing the two is on the record: a focus set 2026-08-24 with `tags:
> plan:walk` hid six soft-severity pinned items for three days, among them the
> instruction to use the product for every fitting category — the product hid its
> own instruction, and nothing said so. The absence was found by counting what
> should have been injected against what was.
>
> **The exemptions are reported, and reported APART.** `renderFocus` in
> `src/core/render.ts` emits one sentence per class that fired — "N severity:hard
> item(s) … injected anyway — focus never hides one", then the same for pinned,
> then for continuity — rather than one merged count, because a reader who asked
> for a narrow corpus is owed WHICH reason kept each thing, and a merged sentence
> would assert a severity those items need not have. The injected block carries
> counts; `mycontext focus --show` names the ids, capped with the remainder
> disclosed. That disclosure is deliberately not budgeted with the tiers: a
> budget that could drop it would make focus a way to hide knowledge silently,
> which is the one unacceptable failure in this project.

**Summary** (143 chars):

> A session can narrow what it loads down to one topic, and is told what that
> hid — except the items marked never to drop, which stay regardless.

**Untouched:** the `# ` title (still true of what focus does hide), the
workspace-vs-session correction, the domains correction, the unmet-in-spirit
paragraph, and both sections verbatim.

---

## C2 — NOGOAL-not-a-claude-mem-replacement

`severity: hard`, `always: true` — it injects into every session, so its wording
is load-bearing.

**Replaced sentence:**

> Do not build session history, activity capture, or semantic search over past
> work; that is claude-mem's job and it already does it.

**Full replacement body:**

    # my_context does not replace claude-mem

    claude-mem is descriptive — it auto-summarizes what happened. my_context is
    normative — what must hold. That line survived this product growing a
    continuity tier and an audit log, so it is redrawn here rather than deleted.

    STILL REFUSED, and each is concrete:
    - No retrieval over past work. No semantic search, no index of transcripts,
      diffs or conversations, no "what did we do about X last month".
    - No automatic capture of activity. Nothing turns a session, a turn or a
      commit into an item. An item is authored by a person, or staged as a DRAFT
      by an agent and inert until a person promotes it.
    - No transcript store. The audit log records ids, tiers and token cost —
      never the text of an item and never the text of a session.

    WHAT IS BUILT, AND WHY IT IS THE OTHER SIDE OF THE LINE. The continuity tier
    carries a pointer plus a bounded digest of the handover into the next
    session, and SessionStart hands a compacted session the handover the last one
    left. A hook cannot write a handover — only the model can, and it writes it
    because it was ASKED, once, at a measured threshold. So the handover is
    AUTHORED, never observed. The audit log is a record of THIS PRODUCT'S OWN
    ACTS: what it injected, into which session, at which tier, at what cost. It
    answers "what was this corpus shown", not "what happened in this repository".

    THE TEST, when a new feature is unsure which side it is on: does it derive
    its content from the user's work without being asked? Then it is claude-mem's,
    and it does not get built here.

    ## Observations
    - [boundary] An auto-summarizer cannot produce an invariant you intend to enforce
    - [boundary] Not a general knowledge base, and not a documentation site generator

    ## Relations
    - derived_from [[ADR-build-rather-than-adopt]]

**Summary** (133 chars):

> This tool holds the rules a project must follow, not a memory of what happened
> — it never watches your work or searches your history.

---

## C3 — CONST-zero-runtime-dependencies

`severity: hard`, `always: true`.

**Replaced sentence:**

> Only `typescript` and `@types/node` are permitted, and only as devDependencies.

**Full replacement body:**

    # The shipped plugin has zero runtime dependencies

    `dependencies` is empty and stays empty — package.json declares no runtime
    dependency at all. A plugin that installs cleanly without a package fetch is
    what makes hooks start in tens of milliseconds and what lets the plugin be
    dropped into any repo.

    devDependencies are permitted and enumerated. Today they are three:
    `typescript`, `@types/node` and `@playwright/test`. The browser suite was
    admitted deliberately and on the record — a test tool violates neither the
    runtime rule nor the no-build-step rule, and it was the first test dependency
    this project took, everything before it running on `node:test` alone. A
    fourth is a ruling to record, never a commit to make.

    NOTHING CHECKS THIS AUTOMATICALLY. No `check:*` script and no CI step reads a
    dependency list, so a runtime dependency added in a pull request goes green.
    The guarantee is held by review.

    ## Observations
    - [limit] No runtime dependency may be added to package.json #packaging
    - [consequence] The MCP server in Plan 3 must speak JSON-RPC by hand rather than using the SDK
    - [consequence] The frontmatter parser is hand-written rather than using a YAML library

**Summary** (125 chars):

> Nothing the plugin needs at run time is downloaded, which is what lets it start
> in milliseconds and drop into any repository.

---

## Four things found while drafting

1. **`focusHides` exempts THREE classes, not two** — `severity: hard`,
   `always: true` AND `continuity: true`, the third landing with
   `DEC-continuity-gets-its-own-budget`. C1 states three.

2. **`DEC-focus-discloses-and-allows` should be SUPERSEDED, not amended.** Its
   false clauses are load-bearing paragraphs of its reasoning, and it carries a
   `supersedes OPENQ-how-do-filters-respect-dependencies` edge that must stay
   walkable. `mycontext supersede --by DEC-a-focus-may-not-hide-a-pinned-item`
   preserves body and edges while stamping `superseded_by` — this corpus's own
   `STD-answered-questions-are-superseded` pattern. OWNER'S CALL.

3. **`scripts/seed-dogfood.ts:53` re-emits the stale C3 sentence.** It seeds
   "Only `typescript` and `@types/node`" into any freshly seeded corpus, so
   amending the item without fixing the seed puts the stale text back.

4. **Nothing enforces C3.** Verified, not assumed: `check-test-glob`,
   `check-retired` and `check-text-files` read test globs, plan sections and NUL
   bytes; `ci.yml` runs those three plus typecheck/test/test:perf/test:e2e. No
   script reads a dependency list. The amended text says so rather than implying
   a gate exists.
