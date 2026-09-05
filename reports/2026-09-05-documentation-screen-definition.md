# The Documentation screen — definition, requirements, and the gap list

**Method.** `INSTR-a-screen-is-defined-from-every-document-that-mentions-it`, applied a second
time — the first time on Tutorials, this time on `docs`, at the owner's explicit request
(`REQ-the-two-readmes-are-the-base-of-a-documentation-system-that`). Read: the original content
spec `docs/superpowers/specs/2026-08-14-mycontext-documentation-design.md` (what README.md itself
is for — the closest thing this project has to "the campaign" for documentation), the UI design of
record `docs/superpowers/specs/2026-08-16-web-ui-design.md` and its 2026-08-20 correction,
`docs/design/web-ui-mockup.html` §`data-p="docs"` (and §`data-p="learn"`, §`data-p="tut"` beside
it), `docs/superpowers/plans/2026-08-14-mycontext-documentation.md`, `reports/2026-08-22-DOCS-REVIEW.md`,
`reports/V2-HANDOVER.md`, `reports/CONTINUE-HERE.md`, `reports/CAMPAIGN-LEDGER.md`,
`reports/EXECUTION-BOARD.md`, the corpus (`search "documentation"` — 43 hits, `search "readme"` —
62 hits, every load-bearing hit shown below), `src/ui/public/screens/docs.js` in full (its own
module header is itself an evidence trail), `src/ui/public/screens/coverage.js`,
`src/ui/read-model.ts` (`UI_HELP_TOPICS`, `registerReadRoutes`), `src/core/teach.ts`
(`HELP_TOPICS`, `MCP_HELP_TOPICS`), the live string tables `src/ui/public/strings/en.js` and
`src/ui/public/strings/he.js`, `test/docs/*.test.ts`, and `package.json`. No production code
changed; no item state changed. The only writes are this file, one spec, one plan, and new `task`
items created with `state: todo`.

---

## 1. The definition

Unlike Tutorials, the record is **not silent** here — but it holds two definitions, from two
different moments, and only one of them is what currently ships.

**The end-state definition, owner ruling, 2026-08-25**
(`DEC-the-documentation-screen-serves-the-help-topics-and-says-so`): *"a full application
documentation is to be built … from the README, the app's own docs and the application itself, in
English AND Hebrew, so that this screen becomes the place a user finds every detail about what the
app is, how to use it and how to configure it."* Restated and widened the same day by
`REQ-the-two-readmes-are-the-base-of-a-documentation-system-that`: covering *"every single piece of
the app, using the CLI and using the UI,"* **indexed, with links, the way a real documentation
package works** — *"a reader navigates it rather than scrolling one long file and searching."*

**The for-now definition, same ruling, same day:** *"the screen serves `mycontext help` topics,
and `dv.sub` is corrected to say so … This ruling buys honesty now; it does not settle what docs is
for."* The mockup's own verdict text at the time called this screen's job *"the repository's own
README, rendered here and addressed by heading ordinal"* — a promise the ruling itself found false
(§3 below) and replaced, in words, with a narrower, honest one.

**What a person outside this project needs to know, in one paragraph:** the Documentation screen
is meant to become the single place inside the running app where a reader — using either the CLI
or the UI — can find and navigate everything the product does, built from the same two files
(`README.md`, `docs/README.he.md`) that already serve a terminal reader, kept true because most of
what it shows is derived from the running program rather than hand-written prose. Until that is
built, the owner ruled it should honestly show something smaller: the four `mycontext help` topics
this server can already serve, admitted as a partial, temporary answer rather than dressed up as
the full one.

**§3 finds that even the temporary, honest half of this was never applied to what ships.** The
running app's own string tables still assert the bigger, false promise today — not the corrected
one the owner approved three weeks ago. That is the single most useful finding in this report.

## 2. Requirements, each traced to their source

| # | Requirement (quoted) | Source |
|---|---|---|
| R1 | *"README.md and docs/README.he.md are the base of the documentation system rather than two files a screen happens to show … the property the whole system should inherit rather than lose"* is that several sections are already **derived** — *"the command table, the flag reference, the category keys"* | `REQ-the-two-readmes-are-the-base-of-a-documentation-system-that` |
| R2 | *"cover every single piece of the app, using the CLI and using the UI … Where a capability exists on one surface and not the other, the documentation says so"* | same, `WHAT IT MUST COVER` |
| R3 | *"indexed, with links, the way a real documentation package works. A reader navigates it rather than scrolling one long file and searching"* | same, `HOW IT MUST READ` |
| R4 | *"both readmes have been found stale five times in two days, every time by an agent and never by a reader, which is the measured reason to prefer derivation over prose wherever a fact can be derived. Whatever is built inherits that problem at a larger size"* | same, `AND IT MUST STAY TRUE` |
| R5 | A third-party tool *"may be used if required"*, but adopting one is *"an owner ruling captured as an item BEFORE it appears in package.json"* — never a commit | same, `ON TOOLING`; enforced by `CONST-zero-runtime-dependencies` ("a fourth [devDependency] is a ruling to record, never a commit to make") and `CONST-node-24-no-build-step` ("no compile step and no `dist/`") |
| R6 | *"a repository document is viewable in the UI only once it is part of the corpus … reachable through `watchedDocs`, and copied under the corpus if that is what it takes, with the copy refreshed when the source changes"* — named explicitly: `README.md`, its Hebrew version, and every tutorial | `REQ-a-repository-document-is-viewable-in-the-ui-only-once-it-is` |
| R7 | *"A reader can find a written document belonging to the project and read it properly formatted without leaving the application"*, rendered *"by the same subset renderer the Documentation screen uses, with the same refusals"* | `REQ-markdown-documents-in-the-repository-are-browsable-and` |
| R8 | Where the document viewer is hosted and what the server may serve: **two different, later, conflicting rulings** (§5) | `DEC-the-markdown-viewer-lives-in-coverage-and-renders-by-id` (2026-08-26) vs `DEC-markdown-is-served-from-a-manifest-rendered-by-one-renderer` (2026-08-28) |
| R9 | The renderer is a **security decision**: *"no HTML string is ever produced, so there is nothing to sanitise. Raw HTML, images and unknown URL schemes are refused and shown as refusals, not silently dropped"* | `docs/design/web-ui-mockup.html:3706` (`dv.mdnote`), spec:1327–1331 |
| R10 | English/Hebrew structural mirroring is a project-wide constraint, not a screen choice: one string table per language, a test asserting equal key sets, logical CSS properties only, and *"the EN/HE switch self-disables when the parity test is red"* | spec:601–620 (`dv.parity`, mockup:3701–3703) |
| R11 | The route that would serve documents is a path-traversal surface and the boundary must be *"enforced where the path is RESOLVED and not where it is received"*, with `../`, absolute-path and symlink refusal tests | `TASK-serve-markdown-documents-to-the-ui-behind-a-decided-boundary` (`plan:walk seq:25`) |
| R12 (inferred) | Documentation content itself should not merely exist but stay **factually correct**, not only structurally present — the gap `test/docs/inventory.test.ts` (names exist) and `test/docs/counts.test.ts` (numbers match) cannot close by construction | Inferred from `reports/2026-08-22-DOCS-REVIEW.md`'s F1–F14 and `STD-documentation-is-regenerated-not-edited-to-match`'s own admission: *"What none of them check: whether the prose is TRUE"* — **labelled as inference**, no document states this as a requirement of the *screen* |
| R13 (boundary, named not resolved) | `NOGOAL-not-a-claude-mem-replacement` lists as a boundary of the whole product: *"Not a general knowledge base, and not a documentation site generator"* | `NOGOAL-not-a-claude-mem-replacement`, Observations — **a tension with R2/R3's ambition, named in §5, not adjudicated here** |

## 3. What is built today, measured against those requirements

Verified live in `src/ui/public/screens/docs.js` (750 lines, read in full), `src/ui/read-model.ts`
(`UI_HELP_TOPICS`, `apiHelp`), `registerReadRoutes` in `src/ui/server.ts`, and the shipped string
tables.

- **R1/R4 (derivation machinery) — exists, unused by this screen.** `STD-documentation-is-regenerated-not-edited-to-match`
  confirms `scripts/gen-doc-examples.ts` (`npm run gen:docs`) already regenerates every marked
  example block in both READMEs from a real command run against a fixture, and `scripts/gen-commands.ts`
  generates the CLI/slash-command surface. `test/docs/inventory.test.ts`, `counts.test.ts`,
  `examples.test.ts`, `injection.test.ts` and `parity.test.ts` hold this — the whole suite (6,419
  tests) is currently green. None of this machinery is reachable from the running UI; the
  Documentation screen renders a `mycontext help` topic, not README.md, so a reader in the browser
  sees none of what these tests hold true.
- **R2/R3 (index, links, CLI-vs-UI coverage) — not built.** The screen's Contents card is five
  **literal** entries (`CONTENTS = [{ordinal:1,key:'dv.t1'}, …]`, `docs.js:197-203`) copied from
  the mockup, of which **exactly one** (`dv.t4`, "Scope") names a topic the server can actually
  serve. There is no index built from anything a gate can check, no links between documents, and
  no statement anywhere on the screen of what exists on CLI versus UI.
- **R5 (tooling ruling) — not yet made; this report proposes one (§ "Recommendation" below).**
  `package.json` `devDependencies` today are exactly the three the constraint enumerates
  (`typescript`, `@types/node`, `@playwright/test`); `dependencies` is empty. No fourth has been
  proposed or adopted.
- **R6 (corpus membership) — not built, and explicitly left open by its own source:** *"WHAT IS
  NOT YET DECIDED … WHO REFRESHES THE COPY and WHEN."* `README.md`/`docs/README.he.md` are not in
  `watchedDocs` and are not part of the corpus; they sit at the repository root, outside
  `src/ui/public/`, exactly as `docs.js`'s header records.
- **R7/R9/R11 (a browsable document viewer, safely served) — decided, not built.**
  `DEC-markdown-is-served-from-a-manifest-rendered-by-one-renderer` (2026-08-28) rules the shape —
  server-built manifest, `GET /api/doc/:id`, no client-supplied path — and this is carried as
  `TASK-serve-markdown-documents-to-the-ui-behind-a-decided-boundary` (`plan:walk seq:25`,
  **`state: todo`**), which itself `needs: walk/37`. `walk/37` (the renderer's blockquote branch)
  is **already done** — `bodyNodes()` now delegates to the same `markdownNodes` this screen uses —
  so **walk/25 is unblocked and ready today**, and nothing in this report supersedes it. No route
  named `/api/doc/:id` (or similar) exists in `registerReadRoutes` as of this reading.
- **R8 (which screen hosts it) — two live, unreconciled rulings.** See §5; not resolved here by
  design.
- **R9 (renderer) — met, and it is the strongest part of this screen.** `markdownNodes` in
  `docs.js` is a hand-written subset renderer producing no HTML string; it refuses raw HTML,
  unsafe URL schemes and (unlike the mockup's own script) images, each shown as a labelled
  refusal. It is already the one renderer `bodyNodes` (item bodies) also delegates to
  (`DEC-markdown-is-served-from-a-manifest-rendered-by-one-renderer`), so R7's *"rendered by the
  same subset renderer … with the same refusals"* is **already true in the direction that
  matters**, even though nothing yet points it at a repository document.
- **R10 (EN/HE parity) — met at the string-table level, empty at the content level.** `dv.parity`'s
  promise (*"the switch self-disables when the parity test is red"*) is real machinery
  (`test/docs/parity.test.ts`, `test/ui/*` string-key parity), but there is exactly one rendered
  document (`scope`) and it has exactly one Hebrew mirror, so the mechanism has nothing yet to
  disclose per-document.
- **R12 (inferred, content correctness) — the review exists and is marked closed.**
  `reports/2026-08-22-DOCS-REVIEW.md` found 14 stale claims in the two READMEs and the tutorial
  files; `TASK-apply-the-documentation-review-s-findings-after-the-repaint` (`plan:review seq:6b`)
  carries `state: done`, `verified_on: 2026-09-04`. Not independently re-verified line-by-line in
  this pass (out of scope for a screen-definition report), but nothing in the corpus contradicts
  the `done` state, unlike the Tutorials precedent.
- **R13 (boundary tension) — named, not resolved.** See §5.

## 4. The gap list

1. **A shipped, currently-visible false claim** on the exact screen this report is about (§5,
   first bullet) — the honesty fix the owner already ruled for on 2026-08-25 was never carried
   into the artifact that ships. This is the cheapest, highest-visibility item on this list.
2. **The host-and-boundary contradiction is unresolved and blocks everything downstream of it**
   (§5, second bullet) — no document viewer of any kind can be built correctly until an owner picks
   one, because the two live rulings currently name two different screens and (arguably) two
   different serving boundaries.
3. **No document is part of the corpus**, so R6 cannot be satisfied by anything built so far —
   `README.md`, `docs/README.he.md` and the tutorial files remain outside `watchedDocs`, and *who
   refreshes the copy and when* is explicitly undecided in the requirement's own text.
4. **The manifest-and-route half is decided and ready, and unbuilt** — `walk/25` is `state: todo`,
   unblocked (`walk/37` is done), and nothing here duplicates it; it is the load-bearing dependency
   for gaps 5–7.
5. **The Documentation screen's index is five hard-coded literals**, one of which is reachable —
   not the derived, checkable index R2/R3 ask for.
6. **No deep link exists** — `#/docs/4` (or any per-document address) is not a route the shell's
   `route()` parses, so R3's *"a reader navigates it"* has no addressable unit yet.
7. **No CLI-vs-UI coverage disclosure exists anywhere** — R2's *"where a capability exists on one
   surface and not the other, the documentation says so"* is wholly unbuilt; nothing in `docs.js`,
   `learn.js` or the mockup states this.
8. **No gate holds the new surface true once built** — `inventory.test.ts`/`counts.test.ts`/`parity.test.ts`
   are the shape to extend (per the dispatching brief's own instruction), and nothing yet extends
   them to a manifest, an index, or a CLI/UI coverage claim.
9. **The tooling ruling (R5) has not been made** — this report proposes one below; it is not
   self-executing.

None of items 1, 2, 3 or 9 requires writing a document server or a screen — they are a string
fix, an owner decision, a corpus-membership mechanism, and a ruling, in that order, and 2 and 9
block the shape everything after them takes.

## 5. Contradictions between documents

Applying `STD-the-precedence-order-when-four-sources-of-truth-disagree` (corpus/screens → plans →
specs → first documents; later overrides earlier) —

- **The running app contradicts an owner ruling about itself, and the running app is not the more
  recent artifact here — it is simply the one nobody updated.** `src/ui/public/strings/en.js:1205`
  and `he.js:830` (`dv.sub`) still read *"The README in this repository, rendered here and
  addressed by heading ordinal"* — the exact sentence `DEC-the-documentation-screen-serves-the-help-topics-and-says-so`
  (2026-08-25) found false and ruled must be corrected to describe help topics instead. `dv.v`
  (*"cross-linked to your own corpus, which a docs site cannot do"*) is a second, live instance of
  the same pattern: `docs.js`'s own header states plainly that the fetched corpus data *"is fetched
  and NOT drawn"* on this screen — cross-linking is `learn.js`'s job, confirmed by
  `src/ui/read-model.ts:3054-3057`, whose refusal message for an unreachable topic says the four
  reachable topics join to the corpus *"which is what the Learn screen draws."* Under the
  precedence order the corpus (the ruling) is authority on intent and the screen is authority on
  fact; **both now agree the string is wrong, and the string still ships.** This is the exact
  "a ruling taken and never carried into the artifact" pattern the Tutorials report found in
  `TASK-screens-tut-js-has-no-plan-behind-it`, found here a second time, in the mockup and the
  string tables rather than in a task's own frontmatter.
- **Two owner rulings, eight days apart, name two different homes for the same unbuilt feature,
  and neither says it supersedes the other.** `DEC-the-markdown-viewer-lives-in-coverage-and-renders-by-id`
  (2026-08-26): *"WHERE IT LIVES: COVERAGE … Docs and the item pane were both declined as HOMES."*
  `DEC-markdown-is-served-from-a-manifest-rendered-by-one-renderer` (2026-08-28): *"the Contents
  list the mockup already draws IS the manifest"* (the Contents list is `docs.js`'s own card, on
  the Documentation screen it says Docs was declined for two days earlier) and, in its own "What
  this does not decide" section, *"Which screen hosts the viewer … is a design question … the
  mockup's Contents list is the obvious candidate."* Read by recency, the later document should
  win — but it does not claim to reverse the earlier one, it merely observes a coincidence (the
  Contents list exists on the declined screen). `src/ui/public/screens/coverage.js` confirms the
  2026-08-26 target is still live and matches its own description exactly: a file tree with a
  *"what governs"* detail pane (`groupByKind(node.governs)`, `docs.js:288-315` equivalent in
  `coverage.js`). **Named, not resolved — this is gap #2 above and is proposed as an owner
  decision in the plan, not settled by this report.**
- **`REQ-a-repository-document-is-viewable-in-the-ui-only-once-it-is-part-of-the-corpus`
  (2026-08-26, corpus-membership required, `watchedDocs`-scoped) and
  `DEC-markdown-is-served-from-a-manifest-rendered-by-one-renderer` (2026-08-28, glob-built
  manifest of "58 markdown documents under `reports/` and `docs/`") describe boundaries of
  different width, and the later one does not name the earlier one at all.** A glob over
  `reports/` and `docs/` is wider than "in the corpus," and would reach documents (this very
  report, for one) that were never brought in through `watchedDocs`. Whether the manifest decision
  quietly widened the boundary the requirement drew two days earlier, or simply never considered
  it, is not answerable from the record. **Named, not resolved** — folded into the same owner
  decision as the previous bullet, since both concern what the manifest is allowed to contain.
- **`NOGOAL-not-a-claude-mem-replacement`'s boundary — *"not a general knowledge base, and not a
  documentation site generator"* — sits in tension with `REQ-the-two-readmes-are-the-base-of-a-documentation-system-that`'s
  ambition to build something that reads *"the way a real documentation package works."*** The
  non-goal is written about the *product's* identity toward a user's own external knowledge and
  history, not about this project documenting itself, and the requirement is explicit that the
  *source* stays the two READMEs rather than a general knowledge base ingesting arbitrary project
  content. Read narrowly, they do not conflict. Read as a design posture, they pull in different
  directions — one says "small, normative, not a docs platform," the other asks for an indexed,
  linked, navigable documentation *system*. **Named for the owner to weigh, not adjudicated here.**
- **`walk/24`'s own text already lists three tasks that fold into it** (`port/5c` superseded,
  `port/5d`, `review/6b`) **and instructs sharing a source with `builder/8`.** This report's task
  list (§ tasks, below) extends rather than duplicates `walk/24`, `walk/25` and `walk/95`, all
  three of which remain `state: todo` and correctly scoped as written — no contradiction, noted so
  a reader does not mistake the new tasks for replacements.

No coarse contradiction (two documents describing entirely different products) was found. Every
disagreement above is a decision, a requirement, or a shipped string disagreeing with a later
ruling about itself — reconciled by naming rather than by silent correction, per the method.

## 6. Tooling recommendation — a ruling for the owner, not a commit

**Recommendation: build without a third-party generator, at least for the first, corpus-scoped
half of this feature (§ spec).** The cost of each option, stated so the choice is checkable:

- **Adopting a generator (e.g. a static-site tool) costs:** a fourth `devDependency` (a ruling to
  record under `CONST-zero-runtime-dependencies`, which is explicit that this is never a commit
  made in passing); very likely a build step, which `CONST-node-24-no-build-step` currently rules
  out entirely (*"there is no compile step and no `dist/`"*) — so adopting one is not one
  constraint change but two, made at once, for a screen the product already renders with a
  hand-written subset parser it trusts for a security property (R9) no general-purpose renderer is
  guaranteed to preserve without re-auditing its output against this project's CSP.
- **Building without one costs:** the manifest, the route and the index have to be written by
  hand (this is `walk/25` plus the tasks below), and the CLI-vs-UI coverage disclosure (R2) has to
  be derived from the registry by a small, purpose-built script the way `gen-commands.ts` and
  `gen-doc-examples.ts` already derive the command table and the flag reference. **This is not new
  machinery invented for this recommendation — it is the same machinery already load-bearing for
  both READMEs**, per `STD-documentation-is-regenerated-not-edited-to-match`, extended to feed a
  route instead of a paste target.
- **The renderer question is already closed in the no-generator direction.** `markdownNodes` is
  the mockup's own renderer, already the one renderer for both help topics and item bodies
  (`DEC-markdown-is-served-from-a-manifest-rendered-by-one-renderer`), already measured against
  three corpora for the shapes it must handle, and already produces no HTML string — the strongest
  possible answer to "does it survive this project's CSP" is "it was written for it."

**What would change this recommendation:** if the owner wants prose *navigation* features this
subset renderer and hand-built manifest cannot reasonably produce — full-text search across
documents, a generated site with its own theme independent of the app shell, versioned docs — that
is a different, larger feature than what R1–R11 describe, and at that point a generator's cost
(a fourth dependency, a build step, two constraints changed at once) becomes a trade worth putting
to the owner explicitly, with a named tool and a measured cost, rather than argued about in the
abstract. Nothing gathered in this research names that larger feature as requested.

## 7. The gap list, as tasks — new items filed

Nine tasks were created via `mycontext add task`, `state: todo`, under a new plan reference
`docsys` (documentation system) so they read as one wave. Full ids and bodies are in the corpus;
the board rows below are ready to paste into `reports/EXECUTION-BOARD.md`, per the coordinator's
instruction that the shared board is not to be edited by this dispatch.

### Board rows — new wave: the documentation system (`docsys`)

**Two owner rulings gate everything else in this wave. `docsys/1` is a same-day string fix with no
dependency.**

| ref | what it is |
|---|---|
| `docsys/1` | The Documentation screen still promises the README on screen — a ruling three weeks old that was never carried into the mockup or either string table |
| `docsys/2` | Owner ruling needed: which screen hosts the document viewer, Coverage or Documentation — two live decisions name different homes |
| `docsys/3` | Owner ruling needed: adopt a documentation generator, or build the index and route by hand — this report recommends by hand, costed |
| `docsys/4` | Bring `README.md`, `docs/README.he.md` and the tutorial files into the corpus, with a refresh mechanism that makes staleness visible |
| `docsys/5` | Rebuild the Documentation screen's index from a real manifest, with a working deep link per document |
| `docsys/6` | Show, per document, whether a Hebrew mirror exists — measured, never hard-coded, following the Tutorials chip pattern |
| `docsys/7` | Disclose where CLI and UI coverage differ, derived from the command registry and route table rather than hand-written |
| `docsys/8` | Extend `inventory.test.ts`/`counts.test.ts`/`parity.test.ts`'s style of gate to hold the new manifest, index and coverage claims true |

Full task bodies, citations and `needs` chains are in the corpus (`mycontext show docsys/1` … `docsys/8`)
and repeated in the plan below.

## 8. What the owner still has to decide

1. **Which screen hosts the document viewer** — Coverage's existing file tree and "what governs"
   pane, or the Documentation screen's Contents card. Both are live, ruled homes today (§5);
   nothing here picks one.
2. **What the manifest may contain** — only what `watchedDocs` already names (the narrower,
   2026-08-26 requirement), or a wider glob over `reports/` and `docs/` (the 2026-08-28 decision's
   own example set of 58 documents). This decides how big "corpus membership" (R6) has to become
   before the viewer can serve anything.
3. **The tooling ruling (§6)** — this report recommends building without a generator and states
   the cost of the alternative; the owner's word is what makes either one a ruling rather than a
   recommendation.
4. **Whether the CLI-vs-UI coverage disclosure (R2, `docsys/7`) belongs on the Documentation screen
   itself, or on a screen of its own** — not raised as a contradiction because no existing document
   places it anywhere yet; it is a fresh design choice this report surfaces rather than resolves.
5. **Whether `NOGOAL-not-a-claude-mem-replacement`'s "not a documentation site generator" boundary
   constrains how far this feature should reach** (§5, fourth bullet) — named as a tension for the
   owner to weigh, not something this report can settle on its own reading.
