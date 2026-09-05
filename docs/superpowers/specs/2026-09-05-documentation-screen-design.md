# Documentation screen — design

**Status:** design AGREED for the corpus-scoped half; owner rulings pending for two open
questions named below. Written 2026-09-05 from `reports/2026-09-05-documentation-screen-definition.md`,
which is the research this design is cut from — every requirement cited here traces to a source
quoted in that report's §2. What remains before this can be built is those two rulings and a plan,
not more research.

## What settles this design, and what does not

Two owner rulings this design depends on and cannot make for itself:

1. **Which screen hosts the document viewer** — Coverage's existing file tree, or the
   Documentation screen's Contents card. `DEC-the-markdown-viewer-lives-in-coverage-and-renders-by-id`
   (2026-08-26) and `DEC-markdown-is-served-from-a-manifest-rendered-by-one-renderer` (2026-08-28)
   currently name both, and neither claims to reverse the other (report §5).
2. **What the manifest may contain** — only `watchedDocs`-scoped documents (the narrower,
   2026-08-26 requirement), or a wider glob over `reports/` and `docs/` (the 2026-08-28 decision's
   own example). This decides how much has to be brought into the corpus before anything can be
   served.

**This design proceeds on the assumption most consistent with the fuller requirement record** —
Documentation hosts it, and the manifest is `watchedDocs`-scoped, widened deliberately over time —
because `REQ-the-two-readmes-are-the-base-of-a-documentation-system-that` and
`TASK-research-a-documentation-tool-then-build-the-full` (`plan:walk seq:24`) both name the
Documentation screen as the destination, and `REQ-a-repository-document-is-viewable-in-the-ui-only-once-it-is-part-of-the-corpus`
is the more specific, later-argued rule about what a route may serve. **This assumption is
labelled as such and is the first thing `docsys/2` either confirms or overturns**; nothing below
is built until it is.

## 1. What a "documentation page" is

A documentation page is **one entry in a server-built manifest**, never a client-supplied path.
The server enumerates the documents `watchedDocs` names at start (today: `README.md`,
`docs/README.he.md`; extended by `docsys/4` to name the tutorial files), gives each a stable id,
and answers `GET /api/doc/:id` with `{ id, title, headings, markdown, language }`. This is exactly
the shape `DEC-markdown-is-served-from-a-manifest-rendered-by-one-renderer` already ruled: *"the
server globs a document set at start, gives each a stable id, and answers `/api/doc/:id`. The
client never sends a path."* No new security decision is made here — the boundary is the one
already ruled, narrowed to `watchedDocs` per the corpus-membership requirement rather than widened
to an unscoped glob (the open question this design flags rather than answers).

A page's **headings become its own index**: the manifest walks each document's ATX headings
(`#`…`######`, the same shapes `markdownNodes` already parses) and records `{ ordinal, level, text,
anchor }` per heading, in document order. The five-literal `CONTENTS` array in `docs.js` today is
replaced by this derived list — for the one document currently reachable (`README.md`, once
brought into the corpus), this produces the real table of contents rather than five hand-picked
entries, closing gap #5 in the report.

## 2. How the index and links work

**The Contents card becomes two levels.** A document picker (which document — today: README EN,
README HE, and whatever `docsys/4` and later work add) beside a heading list scoped to the
selected document, both drawn from the manifest returned by `GET /api/doc`. Selecting a heading
renders that document from its anchor, reusing the existing `.two`/`card pane` layout `docs.js`
already draws — this is a data-source change, not a new visual language, and stays inside
`RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done`'s bar until a mockup session revises
the section (which any UI change here still needs, per `DEC-claude-drafts-the-mockup-and-the-owner-approves`,
named but not exercised by this spec).

**The deep link is `#/docs/:id/:anchor`**, parsed by the shell's existing `route()` the way every
other screen's hash route is. Opening it selects the document and scrolls to the heading — this is
what makes `dv.sub`'s original promise (*"one integer gives both a deep link and a language switch
that lands on the same section"*) buildable rather than aspirational, closing gap #6.

**A link between documents** is an ordinary Markdown link (`[text](#anchor)` or `[text](doc-id#anchor)`)
already inside a document's own prose, resolved by the router the same way any other hash link is
— no new inline syntax is added to `markdownNodes` for this. A citation *from an item* to a
document (the reverse direction) is out of scope for this spec; it is the Coverage screen's
existing "what governs" job and stays there regardless of which owner ruling lands (§ "What is
explicitly out of scope").

## 3. CLI-versus-UI coverage, where they differ

**Derived, never hand-written**, per R1/R4 and `STD-documentation-is-regenerated-not-edited-to-match`'s
own argument. A small script (in the shape of `scripts/gen-commands.ts`) walks `COMMANDS` (the CLI
registry) and the UI's own route table (`registerReadRoutes`) and produces one row per CLI command
naming whether an equivalent UI action exists — a route that reads the same data, or explicitly
none. This is the same derivation discipline already load-bearing for the command table and flag
reference in both READMEs; nothing here invents a second manual.

**Where they differ, the documentation says so — a sentence, not a silent omission.** A CLI-only
command (most of them; the UI is read-only by design, per `mycontext ui`'s own description) is
marked as such rather than left off a UI-facing table. This satisfies R2's *"where a capability
exists on one surface and not the other, the documentation says so"* without implying every CLI
command should gain a UI action — that is explicitly not this spec's claim.

## 4. Hebrew tracking, and what an untranslated page shows

Applying `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` the way the Tutorials
screen already does for its EN/HE columns (report §3, R9 there): each manifest entry carries
`hasHebrewMirror: boolean`, computed by checking whether the document's counterpart exists on disk
(`docs/README.he.md` for `README.md`; the same pattern extends to whatever `docsys/4` brings in).

- **A document with a Hebrew mirror** shows a plain ✅ beside its entry in the document picker,
  exactly as `dv.parity` already promises for the whole screen.
- **A document with no Hebrew mirror** shows the same `to write` chip Tutorials uses
  (`<span class="chip warn" data-g="▲">`), never a blank cell and never a silent fallback to
  English prose under a Hebrew heading — R10's *"the switch self-disables when the parity test is
  red"* is the screen-wide version of the same rule; this is its per-document instance.
- **A heading inside a document that exists only in one language** is not separately tracked —
  parity is a document-level fact here, the same granularity `test/docs/parity.test.ts` already
  checks structurally. Finer-grained (per-heading) parity is explicitly out of scope (below).

## 5. How it is kept true

**Extends the existing gates; replaces none of them**, per the dispatching instruction.

- `test/docs/inventory.test.ts` and `test/docs/counts.test.ts` continue to hold README.md and
  `docs/README.he.md` against the running program exactly as today; nothing in this design changes
  what they check.
- **New:** a manifest test asserting that every document `watchedDocs` names resolves to a
  reachable `GET /api/doc/:id` entry, and that no id in the manifest names a path outside what
  `watchedDocs` matches — the same shape `inventory.test.ts` already takes for commands, applied to
  documents (`docsys/8`).
- **New:** a heading-index test asserting the manifest's heading list for `README.md` matches the
  file's own ATX headings exactly (count and order) — the same "derived, not hand-kept" discipline
  the corpus already applies to counts, applied to the index.
- **New:** a coverage-derivation test in the shape of `parity.test.ts`, asserting the CLI-vs-UI
  coverage table (§3) is regenerated from `COMMANDS` and the route table rather than committed as
  static prose — a hand-edited row here is the exact defect `gen:docs` exists to prevent.
- **Unchanged and explicitly not sufficient on its own:** `STD-documentation-is-regenerated-not-edited-to-match`'s
  own admission stands — none of this checks that the *prose* is true, only that the names, counts
  and structure agree with the program. `reports/2026-08-22-DOCS-REVIEW.md`-style human review
  remains the check for R12 (inferred), and stays a review obligation rather than a gate.

## 6. What is explicitly OUT of scope

- **Full-text search across documents.** Named in the tooling recommendation (report §6) as the
  kind of feature that would change the build-vs-generator trade-off; nothing here requires it.
- **A generated site independent of the app shell**, with its own theme, its own build, or its own
  URL space. The manifest and route serve the same running app; there is no `dist/` and no second
  deployable.
- **Per-heading Hebrew parity.** §4 tracks parity at the document level, matching
  `parity.test.ts`'s own granularity; a document half-translated at the heading level is not
  separately disclosed by this design.
- **Citing a document from an item's body**, or resolving a citation the other direction (item →
  document). This is Coverage's "what governs" pane's existing job (§2) and is untouched.
- **Widening the manifest beyond `watchedDocs`** without the owner ruling `docsys/2`/`docsys/3`
  name. This design does not glob `reports/` and `docs/` wholesale, and building it that way before
  the ruling lands would pre-empt the very question this spec flags as open.
- **A documentation generator or third-party package of any kind**, pending the ruling in report §6
  and `docsys/3`. This design is written entirely against hand-built machinery so that adopting one
  later is an addition to evaluate, not a rewrite to undo.
- **Changing `NOGOAL-not-a-claude-mem-replacement`'s boundary.** This design treats the two
  READMEs, plus whatever `watchedDocs` is deliberately widened to include, as the fixed source set
  — never an open-ended index of "everything in the repository," which is the shape the non-goal
  warns against.

## Implementation order, when the two rulings land

1. `docsys/1` — the string fix. No dependency; can land the same day this spec is read.
2. `docsys/2`, `docsys/3` — the two owner rulings this design is written against.
3. `docsys/4` — bring the documents into the corpus, with a refresh mechanism.
4. `docsys/5` — the manifest, the route, the derived index, and the deep link (§1, §2).
5. `docsys/6` — per-document Hebrew tracking (§4).
6. `docsys/7` — CLI-vs-UI coverage disclosure (§3).
7. `docsys/8` — the new gates (§5).

Steps 1–3 are worth settling before any pixel changes: they are a string, two decisions, and a
corpus-membership mechanism, and everything after them is written against whichever answer they
give.
