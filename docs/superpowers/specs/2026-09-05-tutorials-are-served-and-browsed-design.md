# Tutorials are served and browsed — design

**Status:** design AGREED, not yet planned in code. Written 2026-09-05 from
`REQ-the-ui-serves-and-browses-the-tutorials-and-the-tutorials`, the owner's own requirement,
following the method in `INSTR-a-screen-is-defined-from-every-document-that-mentions-it` and the
research it commissioned, `reports/2026-09-05-tutorials-screen-definition.md`. That report is not
redone here; its findings are cited, not re-derived.

## What the owner asked for

> "the ui should serve the tutorials … it should allow the user to browse it, that's one of the
> usages for the markdown renderer i have requested as a feature, it should allow to browse
> tutorials list basic and advanced, every tutorial should be on a specific feature of my context,
> it should cover every aspect of my context including it's tui cli slash commands the
> cattegories, the ui screens but in the context of how to use a feature and how it works and how
> to use it from cli and from the ui what's available in each way. they should be translated to
> hebrew and cover all the app capabilities, they may be updated later when we will have v2.0
> completed."

Settled by `REQ-the-ui-serves-and-browses-the-tutorials-and-the-tutorials` in his own restatement:
**a tutorial is a thing the UI SERVES**, not a file you read in the repository while a screen tells
you it exists. That is the finding this whole design carries forward.

## The finding that shapes everything

**No route serves a tutorial file today, and the renderer that must serve it already exists and is
in use.** Both measured, not assumed:

- `src/ui/public/screens/docs.js` draws `body.markdown` through `markdownNodes` — a hand-written
  subset renderer that never builds an HTML string, already imported cross-module by
  `src/ui/public/app.js` for item bodies (`app.js:173` imports it from `docs.js`, `app.js:1301`
  calls it). **This is one of the usages the owner asked for, not a new feature.** A second
  renderer written for the tutorials screen is exactly the failure this project has a named
  precedent against: `src/core/revision-diff.ts`'s own header states the reasoning — "there is
  still exactly one implementation of the diff … a second one written in the browser would be this
  project's most-repeated defect in a new medium." The tutorials reader reuses `markdownNodes` by
  the same cross-module import `app.js` already performs; it is not relocated, because the existing
  import proves relocation was never the blocker.
- `TASK-serve-markdown-documents-to-the-ui-behind-a-decided-boundary` (`plan:walk seq:25`,
  `state: todo`) already carries the owner's ruling for how ANY markdown document reaches the
  browser: `DEC-markdown-is-served-from-a-manifest-rendered-by-one-renderer` — "the server globs a
  document set at start, gives each a stable id, and answers `/api/doc/:id`. No client-supplied
  path ever reaches the filesystem." Its own stated scope is "every place a markdown content is
  or should be displayed" — tutorials are inside that scope by the decision's own words, not by a
  new ruling this spec invents. **This design does not re-decide the security question `walk/25`
  already settled; it applies it, scoped first to the tutorial files**, because a manifest that
  globs `docs/**/*.md` and `reports/**/*.md` in one step is a larger, separately-scheduled build
  (`walk/25` remains open for that wider corpus) and nothing about tutorials needs the wider glob to
  ship. The two tasks share one mechanism and one route shape; they do not share one task.

## What a tutorial IS

**One tutorial per FEATURE of my_context** — not per screen, not per CLI command, not per slash
command, not per category. A feature is a capability a user has a reason to reach for; screens,
commands, slash commands and categories are the SURFACES a feature is reached through, and the
tutorial's job is to teach the feature once and then say, for that one feature, what each surface
can do.

Every tutorial has the same four-part shape, each part a required heading a gate can check for
(existence, not correctness — see *How they are kept TRUE*):

1. **What it is for** — the problem the feature solves, in plain language.
2. **How it works** — the mechanism, at the depth appropriate to the tutorial's tier (see below).
3. **From the CLI** — the commands and, where they exist, the slash commands that reach this
   feature from the terminal.
4. **From the UI** — the screen or screens that reach this feature from the browser, and
   explicitly, **what is available in each way** — because the surfaces are not the same. A
   feature the CLI can do that the UI cannot (or the reverse) is stated, not implied by omission.

## Two tiers, not two files by accident

"Basic and advanced" is the owner's own split, and it is already how the two existing files are
shaped — `docs/TUTORIAL.md` teaches install-through-first-session, `docs/TUTORIAL-ADVANCED.md`
teaches the mechanisms underneath. This design keeps the two-tier split rather than inventing a
third axis:

- **Basic** — a feature a new user reaches in the first session: capture, the index, the trust
  boundary, checking on the corpus.
- **Advanced** — a feature that matters once the corpus has history: injection tiers, scope,
  budgets, revisions, decay, integrity, the MCP surface, and every specialised command and screen
  not already covered at the basic tier.

Not every feature needs both tiers. A feature with one, simple surface (for example `mycontext
statusline`) gets one tutorial, filed at whichever tier fits; a feature a beginner touches on day
one and an advanced user configures precisely (for example the trust boundary) can have a tutorial
at each tier, and that is not a duplicate — the basic one says what a new user needs, the advanced
one says what the mechanism actually does, exactly as `docs/TUTORIAL-ADVANCED.md`'s own "12. The
trust boundary, precisely" already does today against `docs/TUTORIAL.md`'s "6. The trust boundary."

## The full set — derived, not hand-typed

**The list is not authored by this document.** Per this project's own preference — a hand-typed set
rots the moment a command, screen or category is added or renamed — the feature list is produced by
a script, checked into the corpus, and re-run whenever the surfaces it clusters change. This spec
settles the RULE; the plan's first task runs it and freezes the first roster.

**The four surfaces a feature may claim, each already a glob this repository can run today:**

| surface | source | measured today |
|---|---|---:|
| CLI commands | `src/cli/commands/*.ts`, minus plumbing (`index.ts`, `registry.ts`, `format.ts` — verified by reading each: side-effect import list, command-registration types, and shared output formatting, none of them a user-facing verb) | 35 files, 32 user-facing |
| UI screens | `src/ui/public/screens/*.js`, minus `parts.js` (a shared library, not a screen) | 21 files, 20 screens |
| Slash commands | `commands/*.md` | 90 |
| Item categories | `src/core/categories.ts` (`CATEGORIES`), asserted by its own test, `test('there are 29 categories', …)` | 29 |

**The clustering rule:** a feature claims one or more entries from each surface it touches; every
entry from every surface (except the meta screens carved out below) must be claimed by exactly one
feature. Two entries are the same feature when they exist to do the same job from two different
places — `focus.ts` (CLI) and `palette.js` (UI screen) are one feature, "narrowing a session," not
two.

**Meta screens are not features and are not tutorial subjects**, named so the gate does not demand a
tutorial about the tutorial: `tut.js` (this screen), `docs.js` (the document viewer this screen
reuses), and `learn.js` (the in-app help topics, which already teach categories, scope, capture and
workflow directly and are cross-linked from tutorials rather than duplicated by one).

**Slash commands and categories are not separate tutorials.** A slash command is one more way to
reach a feature already claimed by a CLI command or a screen (`commands/add-task.md` belongs to the
same feature as `mycontext add task` and `capture.js`, not a tutorial of its own), and "the
categories" is itself one feature — capturing and shaping an item — covered by one tutorial whose
"how it works" section is the 29-row catalogue, not 29 tutorials.

**A worked example of the clustering, to show the shape rather than assert the whole roster:**

| feature | CLI | slash | UI screen | tier |
|---|---|---|---|---|
| Capturing an item, and the 29 categories | `add` verbs (`src/cli/index.ts`) | `commands/add-*.md` (29) | `capture.js` | basic |
| Injection tiers | `injection.ts` | — | `injected.js` | advanced |
| Narrowing a session (focus) | `focus.ts` | `commands/focus.md` | `palette.js` | advanced |
| Revisions and the review queue | `review.ts`, `revision-view.ts`, `edit.ts`, `supersede.ts` | `commands/review.md`, `commands/supersede.md` | `work.js` | advanced |
| Packs — export and import | `pack.ts`, `export.ts` | (none — no dedicated slash verb) | `packs.js` | advanced |
| Checking on the corpus | `status.ts`, `doctor.ts`, `ready.ts` | `commands/status.md`, `commands/doctor.md`, `commands/ready.md` | `status.js`, `doctor.js` | basic |

**Why the exact count is not asserted here:** hand-counting 32 commands, 20 screens and 90 slash
files into clusters without running the clustering is exactly the "hand-typed set" this project's
own culture warns against — the report this spec rests on names that failure mode directly: a
description asserted rather than measured is how the previous version of this screen was reported
done and was not. The plan's Task 1 runs the derivation and its output — a checked-in manifest,
`docs/tutorials/manifest.json` — is the actual, countable roster. A rough bound from the measured
surface sizes above, after the merges the worked example shows (several commands and slash files
per feature), is on the order of twenty-five to thirty tutorials across both tiers; that is a
sanity check on Task 1's output, not a number this spec commits to.

## How they are served and browsed

**List, then read in place — bounded, like every other read route.**

- `GET /api/tutorials` — **kept, widened.** Today it answers six hard-coded rows checked for
  heading existence (`apiTutorials` / `TUTORIAL_TARGETS`, `src/ui/read-model.ts:3167-3276`). It is
  widened to answer one row per entry in `docs/tutorials/manifest.json`: `id`, `title` (a job, not a
  feature name — R2 in the prior report), `tier` (`basic`/`advanced`), and the same `en`/`he`
  `done`/`todo`/`unmeasured` state the screen already draws, computed against the new per-feature
  files rather than the two monolithic ones.
- `GET /api/doc/:id` — **new**, and the tutorial-scoped instance of `walk/25`'s decided mechanism.
  The server globs `docs/tutorials/*.md` and `docs/tutorials/*.he.md` at start (not at request time,
  the same closed-set discipline `walk/25` requires), assigns each a stable id from the manifest,
  and answers that document's markdown. No client-supplied path ever reaches the filesystem — the
  same property that makes `/api/help/:topic`'s closed set of four safe today, merely made larger
  and generated instead of hand-listed. A request for an id the manifest does not carry answers the
  same shape of refusal every other route on this server gives: it names what IS served.
- **The screen**, `tut.js`, gets two views instead of one: the existing list (now driven by the
  manifest instead of twelve literals) and a reader that opens one tutorial's markdown through
  `markdownNodes`, reused exactly as `app.js` already reuses it — no new renderer, no HTML string
  built anywhere in this feature.
- **Bounded.** The manifest is generated at server start from files already in the repository —
  dozens of documents, not thousands — so no pagination is needed at this scale; if the roster ever
  grows past what one list view should render at once, the existing corpus screens' bounded-list
  convention applies (a limit and a "show more"), not a new pattern invented for this screen.

## Hebrew

**Today, zero tutorials have Hebrew content**, because zero per-feature tutorial files exist yet —
`docs/TUTORIAL.he.md` and `docs/TUTORIAL-ADVANCED.he.md` do not exist at all, confirmed by the prior
report. That is not this screen's defect; it is the starting measurement.

- **Tracked exactly as today's screen already tracks it, extended to N rows instead of six**: each
  feature's `he` cell is `done` when `docs/tutorials/<id>.he.md` exists and carries the tutorial's
  required heading, `todo` when the English tutorial exists and the Hebrew file or heading does not,
  and `unmeasured` only for the construction today's screen already has one of — a row whose own
  English target does not exist yet either, so there is nothing to check a translation against.
- **No fallback.** The instruction already binding on this screen — "Do not ship a toggle that
  falls back" — carries forward unchanged: the Hebrew column is a status, never a control, and it
  never silently serves the English tutorial under a Hebrew label.
- **The empty case is drawn, not hidden**, per `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`.
  Today's true state — zero of N tutorials translated — must render as a measured "0 of N" rather
  than as N individual `todo` chips a reader has to count for themselves to notice the pattern. The
  list view's header carries a rollup line (`he: 0/28 written`, or whatever N the manifest measures)
  computed from the same per-row state the cells already draw, so the zero is a stated fact rather
  than an absence nobody drew.
- **Authoring the Hebrew text itself is not this spec's job.** It is real, large content work,
  tracked as its own tasks below — this spec settles the mechanism that makes a written Hebrew
  tutorial appear, and the mechanism that makes an unwritten one honest, not the 1:1 translation of
  every feature.

## How they are kept TRUE

This is the part the record never addressed, named as such in the prior report's gap list: "nothing
anywhere gates a tutorial against drift." Two different claims are at stake here and they need two
different answers.

**What a gate CAN check: that the section exists, and a small, named set of facts a tutorial
states as literal, machine-derivable values.** Existence checking is already built (`apiTutorials`
today, widened above). Beyond existence, `reports/2026-08-22-DOCS-REVIEW.md` names five findings
that are not prose-quality problems — they are specific, extractable claims that disagree with a
single source of truth already in the code:

| drift class | example finding | source of truth to check against |
|---|---|---|
| a version string | F11: both tutorials say v1.0.0; shipped is 1.0.2 | `package.json`'s `version` |
| a removed value still taught | F4: the `full` profile, refused by name at load time | the profile check in `src/core/config.ts` |
| a hook roster | F7/F8: four hooks named; the product registers eight (`SessionStart`, `PreToolUse`, `PreCompact`, `PostToolUse`, `PostToolUseFailure`, `SubagentStart`, `SubagentStop`, `Stop`, measured directly against `src/hooks/`) | the hook registration list |
| a tier name and number | F14: "pinned … 8,000" names the wrong tier's number | the budget tier definitions in `src/core/config.ts` |

A test can extract each of these from the shipped tutorial text (by the same kind of pattern match
`apiTutorials` already uses to find a heading) and diff it against the live value, failing red the
day the two disagree — the mockup's own promise, that a tutorial cannot teach a flag that no longer
exists without a test going red, made real for the finite set of facts a test can actually name.
This is an EXTENSION of existence-checking, not a new category of gate: it still only checks
whether a literal token the tutorial states matches a literal token the code carries, never whether
the sentence around it makes sense.

**What no gate can check, said plainly so nothing here promises it: whether the PROSE is correct.**
Whether an explanation of why the injection tiers exist is accurate, whether a worked example's
narrative still makes sense, whether "how it works" still describes how it works when the mechanism
changes in a way that leaves every literal token it mentions unchanged — none of that is
machine-checkable, and no task in this plan claims otherwise. That is a human documents-review
responsibility, the same one that produced `reports/2026-08-22-DOCS-REVIEW.md`, and it stays a
periodic review rather than a gate. The one thing this design changes about that review is
`docs/TUTORIAL.md`'s own load-bearing claim — that every command and block of output in it was run
against a fresh workspace, nothing in it illustrative — which must survive the restructuring into
per-feature files exactly as stated: **every worked-example command block in every tutorial file
stays a generated block from a real run**, the same discipline `TASK-docs-tutorial-md-and-docs-tutorial-advanced-md-add-examples`
already established for the two monolithic files, carried forward per-file rather than relaxed by
the split.

**The heading-existence check and the literal-fact check are both drawn as what they are, not as
more than they are.** The screen's `done` chip means "the section exists, and the facts this gate
knows how to check agree with the code" — not "this tutorial is correct." Where that distinction
matters to a reader, `apiTutorials`'s own module header already carries the honest sentence; this
design requires the on-screen text to say it too, once, near the list, rather than leaving it only
in a code comment nobody browsing the UI ever reads.

## What is explicitly NOT in scope

- **A full CommonMark renderer.** `markdownNodes`'s existing, measured subset (tables, block quotes,
  ordered lists, horizontal rules, setext headings and h4+ still fall through to paragraphs
  carrying their own source) is inherited as-is. Widening it is `walk/37`'s territory, already
  closed once and not reopened by this spec; if a tutorial needs a construct the subset cannot draw,
  that is a fact about the tutorial's prose, addressed by writing around the gap, not by rebuilding
  the renderer here.
- **A tutorial per screen, per command, or per category.** Argued above; naming it here so the plan
  cannot drift into the finer grain the owner explicitly ruled out.
- **Authoring the Hebrew (or the rewritten English) tutorial text itself**, beyond what proves the
  mechanism (a small number of worked tutorials built during the plan). The bulk of translation and
  per-feature content authoring is real, ongoing content work — tracked as its own tasks, explicitly
  not expected to land inside this plan, and explicitly expected to be revised once v2.0 is
  complete, per the owner's own words.
- **Widening the document manifest to the rest of `docs/` and `reports/`.** That is `walk/25`'s
  scope. This design's route is the tutorial-scoped instance of the same mechanism; the two should
  converge on one manifest builder eventually, but this plan does not block on `walk/25` landing
  first, and does not close it.
- **Pixel-faithful anything.** No claim is made about matching the mockup's exact `tut` markup
  beyond what the mockup already specifies — those are inherited from the existing screen, not
  re-litigated.
- **A correctness gate for prose.** Argued above, stated again here because it is the requirement
  most likely to be over-promised: no task in the plan below claims to verify that a tutorial's
  explanation is accurate, only that it exists and that its stated literal facts agree with the
  code.

## Risks, named rather than discovered

- **The restructuring is real content work, not just plumbing.** Splitting two monolithic files
  into one file per feature, each carrying the four required sections, touches every existing
  chapter's shape even where its prose does not change. The plan sequences this so the mechanism
  (manifest, route, screen) lands and is provable before the bulk of the content migration, the same
  ordering the conversation-archive plan used for its own two-halves shape.
- **The generated-block promise is the thing most easily broken by a rewrite done carelessly.**
  Splitting files without re-running every example risks becoming "illustrative," the exact failure
  `docs/TUTORIAL.md` already names once. The plan's content tasks inherit the existing discipline
  explicitly rather than assuming it survives a copy-paste.
- **A feature the derivation script cannot cleanly cluster is a real possibility** — some CLI
  commands (`context.ts`, for instance) may not map to a single obvious UI screen, and some screens
  (`simulate.js`, `watch.js`) may not map to a single obvious CLI verb. The manifest format must
  allow a feature to claim zero entries from a surface it genuinely has none of (a CLI-only feature
  with no screen, or the reverse) — the coverage gate should demand every surface entry is CLAIMED,
  not that every feature claims from every surface.

## Implementation order, when it is scheduled

1. **The derivation script and the manifest.** Cluster the four surfaces into the feature roster,
   write it to `docs/tutorials/manifest.json`, and write the coverage test that fails when a new
   command, screen or category file appears unclaimed. This is worth landing alone: it makes the
   actual, countable list exist before any route or screen work depends on its shape.
2. **The two endpoints.** `GET /api/tutorials` widened to read the manifest; `GET /api/doc/:id`
   serving `docs/tutorials/*.md`/`*.he.md` from the same closed set, reusing `walk/25`'s decided
   mechanism scoped to these files.
3. **The screen.** The list view driven by the manifest (replacing `TUTORIAL_ROWS`/`TUTORIAL_TARGETS`'s
   hard-coded six), the Hebrew rollup line, and the reader view that opens one tutorial through
   `markdownNodes`.
4. **The content migration**, in two parts, sequenced so the mechanism proves itself on a small set
   first: (a) migrate the existing chapters of `docs/TUTORIAL.md` and `docs/TUTORIAL-ADVANCED.md`
   into per-feature files matching the manifest, adding the "From the UI" section every existing
   chapter is missing; (b) the remaining features the manifest names that have no existing chapter
   to migrate, written new.
5. **The literal-fact drift gates** (version, hook roster, profile names, tier names), each a small,
   independent test — landed after the content exists to check, not before.

Steps 1 and 2 are worth landing alone, exactly as the conversation archive's own plan states the
same reasoning: they make the data reachable and testable before any pixel is drawn or any tutorial
is rewritten.
