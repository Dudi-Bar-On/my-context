# A3 — the five owner requirements, designed

**Seat:** senior designer-engineer. Constructive pass. Two reviewers are attacking feasibility and
honesty in parallel; this is the thing they attack.

**Brief:** `reports/uiux/REQUIREMENTS-ADDENDUM.md` (R1–R5).
**Read in full:** `07-arch.md`, `04-visual.md`, `06-a11y.md`, `08-onboarding.md`, `01-coverage.md`,
`09-workflows.md` §§ *Jobs to be done*; and in the repo `README.md`, `docs/README.he.md`,
`docs/TUTORIAL.md`, `docs/TUTORIAL-ADVANCED.md`, `src/help/index.ts`, `src/help/he.ts`,
`test/docs/parity.test.ts`, `test/docs/capabilities.test.ts`, `test/docs/inventory.test.ts`,
`scripts/gen-doc-examples.ts`, `scripts/gen-commands.ts`, `src/cli/index.ts`,
`src/cli/commands/format.ts`.

**Sketch:** `sketches/10-requirements.html` — R1's renderer *runs* there (feed it the hostile
document), R4's disclosure is live, R5 is shown in both themes at once with its contrast measured
in-browser.

**Provenance marks.** **[V]** verified in the repo with the command that verified it. **[M]**
measured — by me, in this pass, and the measurement is reproducible from what is written here.
**[R]** reasoned.

**Standing constraints treated as non-negotiable throughout:** zero runtime dependencies; no build
step; CSP `default-src 'none'; script-src 'self'; style-src 'self'`; mutator-free over HTTP;
EN + HE structurally mirrored with CSS logical properties only; Node 24 native TS, erasable syntax.
Nothing below asks for an exception to any of them.

---

## R1 — the markdown viewer

### First, the collision, stated so it can be resolved rather than finessed

`07-arch.md`'s rule is **`textContent` is the only text sink**, enforced by a source scan that bans
`innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write`. R1 asks for a component whose job
title is *"turn a string into markup."*

The resolution is that those are two different claims, and only one of them is banned:

> The ban is on **strings being parsed as markup**. It is not a ban on **producing structure**. A
> markdown renderer that emits elements through `document.createElement()` from a frozen tag table,
> and writes every leaf through `.textContent`, produces structure from a grammar *the renderer
> owns* and text through the one sink. The scan's regex is unchanged, and it still returns zero.

So the negative invariant survives verbatim. What changes, and must be declared rather than smuggled
in, is that the app now has a **second producer of structure** beside `<template>` + `fields()`.
`07-arch.md`'s argument for one sink was about *text*; this adds a second source of *elements*, and
the mitigation is that it is a single module with a frozen tag table and no configuration surface —
not a mini-framework.

Verified in the sketch rather than argued: the renderer there is 324 lines of code, and
`innerHTML` is never assigned in the file — `grep -c innerHTML` returns 3 and all three are prose
(two comments and one explanatory sentence), while
`grep -cE "outerHTML|insertAdjacentHTML|document\.write|eval\("` returns 0 and the physical-CSS-property
scan returns 0. [M] Those are the exact greps `07-arch.md`'s tier-1 scan runs, run against this
component.

### The pipeline — three phases, and no phase holds an HTML string

```
markdown text
  → blocks(src)        line classifier + fence/list/quote/table state machine
                       ⟶ block tokens  {t, …}   ← plain objects, pure, no DOM
  → inline(text)       code spans FIRST, then links, strong, em, del, autolinks
                       ⟶ inline tokens {t, …}   ← plain objects, pure, no DOM
  → build(tokens)      createElement(TAGS[…]) + textContent + <bdi>
                       ⟶ DocumentFragment       ← the only phase that touches DOM
```

Three properties fall out, and each is worth the shape:

1. **There is no intermediate HTML string anywhere.** Not concatenated, not escaped, not sanitised.
   There is nothing to sanitise because nothing is ever parsed.
2. **Two of the three phases are pure functions over plain objects**, so tier-1 tests assert the
   token stream with no DOM at all, and tier-3 golden trees assert the built DOM through
   `07-arch.md`'s ~150-line DOM double. The escaping rule and the testability rule are the same rule,
   one layer further down than `07-arch.md` took it.
3. **`build()` is a `switch` over a closed token set.** A construct the scanner does not recognise
   never reaches `build()` — it has already become a paragraph or a refusal token in phase 1. There
   is no default branch that improvises.

`renderMarkdown(src)` returns **`{node, refusals}`**, never a bare node. That is
`07-arch.md`'s `{data, state, fetchedAt, reason}` envelope applied to rendering: a caller physically
cannot display a rendered document without having been handed the list of what was refused.

### The subset

**Rendered.** ATX headings `#`–`######`, **demoted one level** — `#` becomes `<h2>`, and no document
may ever produce an `<h1>`, because the page owns its own heading outline and a quoted corpus file
must not be able to insert a second document title into it. Paragraphs. Fenced code (``` and `~~~`,
info string kept in `dataset.lang`, never as a class). Indented code. Unordered and ordered lists to
depth 3, with task-list items rendered as `☐`/`☑` **text**, never as checkboxes. Block quotes (which
recurse through `blocks()`, so a quote can contain a table). Thematic breaks. GFM pipe tables, as
real `<table>`/`<thead>`/`<th scope="col">` — non-negotiable, because the README is full of them and
the category table *is* a table. Inline: code spans, strong, emphasis, strikethrough, autolinks.
Links under the policy below. YAML front matter, rendered as a **collapsed, labelled `<details>`**,
never as content. And HTML comments, consumed as markers — which is how the README's
`<!-- example: … -->` blocks are recognised (see R2).

**Two HTML tag names are recognised as block markers**, not parsed as HTML: `<details>` and
`<summary>`. The README depends on them structurally and refusing them would *hide content*, which
is worse than rendering it. Two line-anchored literal matches are not an HTML parser, and the
distinction is the whole safety argument: there is no attribute parsing, no tag soup recovery, no
nesting inference beyond a depth counter.

**No syntax highlighting.** It is a second grammar over semi-trusted text, one tokenizer per
language, and it buys nothing this product needs. Refused by name so nobody adds it as "just one
more small thing".

### What is refused, and how the refusal is shown

| Construct | Treatment |
|---|---|
| Any other raw HTML block (`<script>`, `<style>`, `<iframe>`, `<div>`, …) | kept **verbatim as text** in a marked, dashed-bordered `.refused` block naming the tag and the line |
| Any inline HTML (`<img onerror=…>`, `<b>`) | kept verbatim as text in a marked inline span |
| Images `![alt](src)` | refused. `img-src 'self' data:` means a corpus image is either broken or a payload. Rendered as `[image: alt] <the src>` |
| Link target that is not one of the three safe shapes | the whole `[text](target)` kept as literal text |
| Footnotes, definition lists, math, `{#id}` heading attributes | fall through to **paragraph text** |
| Anything else the scanner has no rule for | falls through to **paragraph text** |

**Nothing is ever dropped.** That is `INV-nothing-is-dropped-silently` applied to a renderer, and it
is the reason the refusal path renders the original text rather than a placeholder.

**The link policy** — three shapes survive, everything else is text:

- `#anchor` matching `^#[A-Za-z0-9_-]+$` → in-document.
- A relative repo path matching `^[A-Za-z0-9._/-]+$` with **no `..` segment** → an in-app route,
  and the `href` is built by `hrefFor(path)` from the *validated* token. A corpus value never
  reaches `href`; the router builds it.
- `http(s)://` → **not a link.** Rendered as the label text plus the full URL made visible in a
  monospace run, so the reader judges the destination instead of trusting a label. This is the one
  place I deliberately make the product less convenient than the README on GitHub, and the reason is
  that `07-arch.md`'s fourth defence layer — *"nothing in the corpus produces a URL"* — is a sentence
  R1 would otherwise falsify. It gets a mechanism instead of a repeal.

**The ledger, not a toast.** The viewer renders a persistent band above the document: *"11 things on
this page are shown as text rather than rendered"*, itemised by kind with line numbers, each
scrollable-to. Beside it, a **"show source"** toggle for the whole document and (in the shipped
version) per refused block. That combination is what makes the refusal honest rather than lossy: the
reader loses *form*, never *content*, and one click proves it.

Measured on the sketch's hostile document: **11 refusals across 5 kinds** — 3 raw HTML blocks
(`script`, `style`, `iframe`), 4 inline HTML fragments, 1 image with a `data:` payload, 3 refused
link targets (`javascript:`, `data:text/html`, and a `../../../../etc/passwd` traversal) — and one
`RULE-<img src=x onerror=alert(1)>` id-grammar payload sitting inside a table cell that arrives as
`<code>` text because **code spans are taken first and are opaque to every later pass**. [M]

### How a reader tells semi-trusted corpus text from the product's own words

This is the part of R1 I care about most, because it is the part that is usually solved with a colour
and therefore not solved at all. Four layers, and the first is structural:

1. **Depth, inverted.** The product's own words live on **raised** surfaces — `.card`, and with R5
   the glossed ones. Quoted corpus text lives in an **inset well**: `--sink` background, a
   `border-inline-start: 3px solid` rule down its leading edge, no shadow, no gloss, ever. So R5 and
   R1 solve each other: *raised means the product is speaking; inset means we are quoting something
   we did not write.* The rule mirrors for free (it is logical), it survives `forced-colors` (a
   border does; a background does not), and it prints.
2. **A source header, always, never on hover.** Path, size, mtime, and **who wrote it** —
   `origin: human` / `origin: ingest` / `origin: agent` from the item's own field. An ingested body
   and a hand-written one look different before a word is read.
3. **`<bdi>` on every text node the renderer produces**, `class="m"` on every code span. Direction of
   corpus text is *unknown*; direction of an id or a path is *known LTR*. That is `06-a11y.md`'s
   contract, applied to the one component that will produce more corpus text than the rest of the app
   combined. Demonstrated in the sketch's Hebrew document.
4. **The document may not style itself.** No class, id, style or attribute from the source reaches
   the DOM. Every class name is a literal in the renderer's own file.

### Size — measured, not guessed

The renderer running in `sketches/10-requirements.html` is **324 lines of code, 411 with comments**,
and it renders the entire subset above including every hostile case. [M] Shipped it needs hardened
inline edge cases and section-range rendering for R2, so the budget is **~450–500 renderer lines,
~120 of viewer chrome, ~250 of tests** — about **600 lines of new source**. For comparison `marked`
is ~4k lines and renders raw HTML by default, which then needs a sanitiser: a second dependency to
close a hole the first one opened.

### Known parser limitation, stated because its failure mode is the safe one

The link regex `\(([^)\s]+)\)` stops at the first `)`, so
`[x](javascript:alert(document.domain))` is matched as a *malformed* link. It is refused and rendered
as text — which is the right outcome, reached for a slightly wrong reason. [M, observed in the
sketch] Every ambiguity in this parser resolves toward refusal, and that is the property the
adversarial fixture asserts: **no input produces an element outside `TAGS`.**

---

## R2 — README and documentation, in the UI, EN + HE

### The Mintlify ruling: refuse — and here is the argument, not the constraint

I am not resting this on `CONST-zero-runtime-dependencies` / `CONST-node-24-no-build-step`. Four
independent arguments, any one of which is sufficient:

**1. It is not one dependency; it is a build output plus a toolchain plus an ongoing audit.**
Shipping a generated docs bundle into `src/ui/public` under `script-src 'self'; style-src 'self'`
requires that the bundle contain no inline `<script>`, no inline `<style>`, no remote font and no CDN
fetch. That is not the default output of any docs generator. So the "cheap" path is an audit of a
generated bundle, on every regeneration, forever — and an audit nobody in this project wrote and
nobody can grep.

**2. It cannot do the one job that makes docs worth putting in *this* UI.** `01-coverage.md` records
that `HELP_TOPICS` has four topics against **392 capabilities**, and `08-onboarding.md` records that
the Learn screen survives §4 *only* because every topic cross-links to the reader's own corpus. A
hosted generator does not have the reader's `.my_context/`. A docs viewer that cannot say *"14 items
in this project use a scope; 2 of them match no file"* is strictly worse than a link to GitHub,
because it costs a toolchain and gives nothing a link doesn't.

**3. It converts a loopback-only surface into an egress.** The server binds `127.0.0.1`, is
mutator-free, and idles out, precisely so a repository's private governance text never leaves the
machine. Item bodies quote source files. Routing them through a hosted docs pipeline is a data-egress
decision wearing the costume of a formatting decision.

**4. Its freshness machinery is weaker than the one already shipped.** [V] `npm run gen:docs` runs
**49** marked example blocks (`grep -c "example:" README.md` → 49; `docs/README.he.md` → 49) as real
commands against a committed fixture and pastes the real stdout; `test/docs/examples.test.ts` re-runs
them and fails on drift; `test/docs/parity.test.ts` holds the two documents to the same heading
sequence and the same example sequence. A docs generator renders whatever the markdown says and has
no opinion about whether the example is *true*. Adopting one means either keeping all of that (so the
generator buys CSS) or losing it.

**What is lost by refusing, stated plainly:** stemmed full-text search, a maintained navigation
component, versioned docs, and analytics. Three of those four this product does not want. Search we
must build, and it is ~120 lines (below).

### What actually ships

**The unit is the section, never the document.** [V] `README.md` is 4,704 lines and
`docs/README.he.md` is 5,112. Neither ever crosses the wire whole.

- `GET /api/docs` → a manifest: for each document, its heading tree (depth, text, ordinal, line span,
  byte span). **Built with the repo's own `headings()` and `fenceTracker()` from
  `test/helpers/markdown.ts`** — the exact functions `parity.test.ts` and `capabilities.test.ts` use.
  This is the single most important reuse decision in R2: the UI's outline and the parity test cannot
  disagree about what a heading is, because there is one definition. (The fence exclusion matters:
  both documents quote injected output containing `## my_context index`, which is the tool's words,
  not a section.)
- `GET /api/docs/:doc?at=<ordinal>` → one section (its heading plus everything until the next heading
  of equal-or-lower depth), with `prev`/`next` ordinals. Cache class `corpus`, invalidated by
  `X-Myctx-Generation` like everything else.

**Navigation over 4,700 lines.** Three panes: document picker → outline → section. The outline's top
level is **the README's own `## Contents` list**, because `capabilities.test.ts` already establishes
that *"a section is major when the table of contents links to it"* is this document's own curated
answer to what a reader must reach from the first screen. Zero new curation, and the UI inherits a
definition that is already tested in both directions.

**The EN/HE switch, and the deep link — one integer solves both.**

`07-arch.md` puts `language` in `localStorage`, not the URL, and it is right: a shared link must not
change the recipient's language. But **document position must be in the URL**, and Hebrew headings
have Hebrew text, so a text slug is not a cross-language address.

The answer is already written down in this repository, in `capabilities.test.ts`:

> *"`parity.test.ts` already holds the two documents to the same heading sequence, so the nth heading
> of one is the same section as the nth heading of the other, and an index is a name that survives
> translation."*

So: **address a section by its ordinal in the parity-checked heading sequence.**
`/docs?doc=readme&at=h37`. Switching EN→HE keeps `at=h37` and lands you on the same section in the
other language. The URL also carries a human slug as a hint — `at=h37-budgets` — which is *ignored on
mismatch and silently repaired*, so links stay readable without becoming load-bearing.

**And the failure mode is designed, not discovered.** If the two heading sequences disagree — i.e.
`parity.test.ts` is red — the ordinal is meaningless. So `/api/docs` computes both sequences, and
when they differ the **language switch is disabled with a stated reason**: *"the two documents are
structurally out of step (68 sections vs 67); `npm test` names the one that moved."* A UI that
reports the repository's own broken invariant instead of silently landing you in the wrong place.

**Search — no index, no stemmer, no dependency.** `GET /api/docs/search?q=` line-scans the two
READMEs, the tutorials, and the four help topics (~10,600 lines total), case-folded, returning
`{doc, ordinal, line, excerpt}` grouped by section and ranked heading-match > code-span-match >
prose-match. That is comfortably inside `07-arch.md`'s ≤ 150 ms handler ceiling. Two things it needs
and two things it must admit:

- **Needs:** strip Hebrew combining marks (U+0591–U+05C7) on both query and corpus — two lines, and
  the difference between Hebrew search working and not; and refuse a query under 2 characters rather
  than returning 10,000 lines.
- **Admits, in the search box's own helper text:** no stemming, so `תקציב` does not match `תקציבים`
  and `budget` does not match `budgeting`. Substring matching partly covers English and does not
  cover Hebrew morphology at all. Stated, not hidden.

**Staying in step with `gen:docs` and `parity.test.ts` — four mechanisms:**

1. **The UI serves the file from disk.** There is no build artefact, so there is nothing to go stale.
2. **The example markers become a feature.** R1's renderer recognises `<!-- example: … -->` and
   renders the block with a label — *"generated: real output of `mycontext list constraint --full`,
   regenerated by `npm run gen:docs`"* — plus the command as a copyable `.cmd` block. A formatting
   artefact becomes the product's strongest honesty signal, for free, 49 times per document.
   (Demonstrated in the sketch.)
3. **A new test, ~15 lines:** `test/ui/docs-manifest.test.ts` asserts the manifest builder returns
   exactly the heading sequence `parity.test.ts` computes, for both documents. This is the one place
   R2 could introduce a fifth spelling — a second definition of "heading" — and it closes it at the
   cost of one import.
4. **Doc health in the provenance bar**, like every other screen: each document's mtime, the count of
   generated blocks, and whether EN/HE structure agrees. **And its limit stated:** the UI cannot know
   whether someone hand-edited a generated block without re-running `gen:docs`; only
   `examples.test.ts` proves that. The band says so rather than implying freshness it has not
   checked.

---

## R3 — tutorials

### Are a tutorial viewer and "teaching in place" rivals, or layers?

Layers — but only if the boundary is stated, otherwise the tutorial becomes exactly the docs page
`08-onboarding.md` argued against.

> **Teaching in place answers *"what is this thing on my screen?"* A tutorial answers *"what should I
> do this week?"* The first is bound to a screen. The second is bound to a **sequence over time**,
> which no single screen can hold.**
>
> **The deletion test:** any tutorial section that can be replaced by teaching in place must be
> deleted, and the teaching-in-place surface linked instead. What survives is content whose value is
> the *ordering*.

That test is what drives the refactor below, and it is why `TUTORIAL-ADVANCED.md` loses about a third
of itself.

### The set — six tutorials, grounded in `09-workflows.md`'s ranked jobs

[V] Today: `docs/TUTORIAL.md` (335 lines, 8 numbered sections) and `docs/TUTORIAL-ADVANCED.md` (476
lines, 14 sections). Both English-only. Both with **zero** generated blocks
(`grep -c "example:"` → 0 and 0) against the README's 49.

| # | Tutorial | Job it serves (`09-workflows.md`) | Provenance |
|---|---|---|---|
| 1 | **The first twenty minutes** | first-run; job 7 *"somebody new needs to know the rules here"* | keep `TUTORIAL.md`, refactored |
| 2 | **When it did not fire** | **job 1**, the top job by a distance — nine distinct causes, no surface enumerates them | new; absorbs ADV §§2–3 (scope, focus) and practises `08-onboarding.md`'s six-rung ladder as a *sequence* |
| 3 | **Walking the queue** | job 3 — and it is **four** queues, not one (drafts, pending revisions, staged lessons, unfinished ingest) | new; absorbs ADV §§7–8 |
| 4 | **Mining what you already wrote** | job 4 + `08-onboarding.md`'s bootstrap arc: `ingest` → drafts → promote → *see it arrive* | new; absorbs ADV §6. **Highest-value new tutorial** — shortest path from zero to a governed repo, and today it is documented only as a buried `####` |
| 5 | **What this costs** | job 6 — the pinned tier is charged to every session forever, and nobody has ever seen it as a number | new; absorbs ADV §4, and tells `LESSON-alphabetical-id-became-the-priority` as the incident it was |
| 6 | **The weekly ten minutes** | jobs 5, 8, 9 — doctor, decay, and what the agent decided on its own | new; absorbs ADV §§9–11. This is the one that makes the product a habit rather than a setup task |

`TUTORIAL-ADVANCED.md` **ceases to exist**. Its §§5 and 14 (configuration, "a configuration that
works") are reference and fold back into README §6; §13 (the MCP surface) is reference and folds into
README §5; §12 (the trust boundary, precisely) duplicates README §7 and is deleted under the deletion
test. Net: 2 documents → 6, each ≤ ~200 lines, each with **one job in its title**.

### The refactor the existing two need — before a word is translated

**(a) Every terminal transcript must become a generated block.** This is the highest-value change in
R3 and it is mechanical: wrap each one in `<!-- example: … -->` so `gen:docs` writes it and
`examples.test.ts` fails on drift. Today both tutorials are hand-pasted prose nobody ran.

**The honest blocker, and its price.** [V] `gen-doc-examples.ts` executes every command against
`materializeDocFixture()` — **one** fixture, in its final state. A tutorial narrative builds state
step by step (`init`, then one `add`, then two more), so `mycontext list` in §3 would print the
fixture's items, not the tutorial's two. Making the tutorials generated therefore requires
`scripts/doc-fixture.ts` to gain **named fixture states** and the marker to carry one:

```markdown
<!-- example: list --full | fixture=tutorial-step-3 -->
```

~60 lines in `doc-fixture.ts` plus a small per-step seed, and it must be stated as the price rather
than discovered halfway. It is the same price the README already paid.

**(b) Delete the duplicated prologues.** `TUTORIAL.md`'s *"What problem this solves"* and *"Install"*
restate README §1 and §5. Deletion test: they are not sequence, they are reference. Link them.

**(c) `TUTORIAL.md` §4 "The payoff" quotes an injection block verbatim.** In the README that text is
pinned by `test/docs/injection.test.ts`; here it is pinned by nothing. Generate it.

**(d) ADV §§5 and 14 contradict shipped `DEFAULT_BUDGETS`** (`09-workflows.md`, job 10). Prefer
**deleting a hand-copied number over testing it**: point at the Configure screen, which shows the
*resolved* config.

**(e) Each tutorial states its own subject version**, the way the README's examples carry their
fixture.

### Hebrew mirroring

- Files: `docs/TUTORIAL.he.md`, `docs/when-it-did-not-fire.he.md`, … — the `.he.md` convention
  `README.he.md` already set.
- **Extend `parity.test.ts` into a table rather than copying it.** [V] It is currently hardcoded to
  one pair (`EN`/`HE` constants at the top). Turn those into
  `PAIRS = [[README, README.he], [TUTORIAL, TUTORIAL.he], …]` and run the same two structural tests
  per pair. **~20 lines**, and it closes the gap `CHANGELOG.md` records for the tutorials — *"a known
  gap, recorded here rather than discovered later"* — for all six pairs at once, and for every
  tutorial added later, permanently.
- The third test (*"structural parity is blind to what the Hebrew actually says"*) runs **once**, not
  per pair: it demonstrates a property of the mechanism, not of a document.
- **Order of work, because getting it wrong is expensive:** generated blocks → split → *then*
  translate. Translating before the split means translating text that is about to be deleted.
- **One boundary, stated once in each Hebrew tutorial's prologue and nowhere else:** the CLI is not
  localized — [V] `src/help/index.ts` says so in as many words, and `MYCONTEXT_DOC_LOCALE` exists for
  exactly one caller, the `help categories` block. So the *guidance* is Hebrew and the *terminal
  output* is English, in an isolated LTR run. That is a documented boundary, not a defect, and
  `parity.test.ts` enforces that both languages run the same commands in the same order anyway.

### The checker — a tutorial cannot teach a flag that no longer exists

`scripts/check-doc-flags.ts` + `test/docs/flags.test.ts`, ~150 lines, zero dependencies, and it
follows the house rule that both sides are derived from what the program *does*.

**1. Extract.** Scan every document for `mycontext <command>[ <subcommand>] …` to end of line, in
both inline code spans and fenced blocks. Record `{doc, line, command, flags[]}`.

**2. Command names — from the running program.** [V] `test/docs/inventory.test.ts` already
establishes the method. Verified this pass: after importing `src/cli/index.ts`, the registry holds
**30 commands** including all seven former builtins. [M] A document naming `mycontext lint` fails
with the document and the line.

> **Finding, free, and it matters here.** `inventory.test.ts`'s docstring still says *"`COMMANDS`
> (the registry) omits the seven names dispatched by the hardcoded `switch` in `src/cli/index.ts` …
> which `registry.ts` refuses to let anyone register."* [V] `src/cli/index.ts` registers all seven
> (`grep -c "registerCommand({"` → 7 in that file) and its own comment says the switch was removed in
> Wave 5. The test's *method* (read the banner) is still the safest choice; its *justification* is
> stale. Two comments in this repository now disagree about where the command surface lives, and R4
> has to pick one — it picks the registry, which is now complete.

**3. Flags — by execution, against the program's own refusal.** [V] `refuseUnknownFlag`
(`src/cli/commands/format.ts:408`) prints exactly
`my_context: unknown option "--<name>".` from **one** place. So for each `(command, flag)` the
checker runs the command in a scratch workspace with `--<flag>` present and asserts that string does
not appear. It is checking the program's refusal, not a mirror of it.

**4. The honesty clause — and the measurement that proves it is needed.** Probing all 30 commands
with `--zzz-probe` in an *initialised* workspace, with required positionals supplied: [M]

- **18 refuse it** — `audit decay doctor review edit pin unpin harden soften focus ingest-status
  refresh search status supersede add list examples`. For these the flag check is **sound**.
- **12 do not** — `ingest ingest-apply lesson lesson-stage lesson-accept lesson-discard query repair
  init show rebuild help`. And these split two ways: some are genuinely permissive
  (`rebuild`'s runner drops `args` deliberately and the registry comment says so [V]), and some are
  **inconclusive** because the command errored before reaching flag validation (`ingest` on a file
  the scratch workspace does not have; `lesson-accept` on a lesson that does not exist).

A two-bucket design would have quietly called all twelve "permissive" and been wrong about half of
them. So the checker reports **three** outcomes per pair — *refused* (fail the doc), *accepted with
the command running to completion* (pass), *inconclusive* (report) — and asserts that the
inconclusive-plus-permissive set equals a **committed expected list**. A command that gains
enforcement shrinks the list and fails until it is updated; a command that loses enforcement grows it
and fails loudly. That is this project's own *"record the gap rather than discover it later"* move,
mechanised.

**5. Config keys, categories and vocabulary come free.** A document naming `categories.<name>` or a
top-level key is checked against the already-exported `TOP_LEVEL_KEYS` / `CATEGORY_KEYS` / the
resolved catalogue.

**6. One checker, six document families.** README, `README.he`, the six tutorials, `commands/*.md`,
`src/help/topics/*.md`, and R4's help payloads. **Hebrew is covered at no extra cost**, because
`parity.test.ts` already forces both languages to quote the same commands in the same order.

**What it cannot do, in the docstring, in the house register:** it cannot check that a flag is used
*correctly*, that the prose around it is true, or that a sequence of steps works. It cannot verify a
flag on a permissive command. A green suite is not a reviewed tutorial.

---

## R4 — integrated help

### The single source of truth is the program. There is no new store.

The fifth spelling is created by *writing new sentences*. So the design starts by making that
impossible:

> **Rule.** The UI writes **no explanatory prose** about a command, a flag, a category, or a config
> key. Every such sentence is fetched. The UI's own words are limited to (a) the shell's chrome,
> (b) the *question* a control answers, and (c) the composed command's landing predicate.
>
> **Enforced, not promised:** there is no `help.cmd.*` namespace in either string table, and
> `07-arch.md`'s source scan gains a rule that fails if one appears.

Four sources, all of which already exist:

| What the user needs | Where it lives today | The endpoint |
|---|---|---|
| what this command is and what it takes | the registration — `name`, `usage`, `summary` — already the one place the banner is built from | `GET /api/help/command/:name` serializes `COMMANDS.get(name)` |
| what a concept means | `src/help/topics/*.md` — the same files `mycontext help` prints, and the same `capture.md` that is already the MCP tool-description source [V] | `GET /api/help/topic/:t` returns exactly `helpTopic()`'s string, rendered by R1 |
| what a category / config key means | the resolved config + `HE_CATEGORY_DESCRIPTIONS` [V] | `GET /api/config` (exists) |
| why *this* is the way it is, in *this* repo, right now | `select()`, `doctor`, `FocusReport` — computed, never written | the existing endpoints |

The fourth row is the one a hosted docs site can never have, and it is the reason R4 belongs in the
UI at all rather than being a link.

### The mechanism — three tiers, and only one is new

**Tier 0 — the question line.** Every control's label *is* the question it answers
(*"Which files should this govern?"*, not *"Scope"*), and every screen header carries the question the
screen answers. `08-onboarding.md` established this; it costs nothing and prevents most help-seeking.

**Tier 1 — the `?` disclosure, in the flow, under the control.** A single
`<button class="explain" aria-expanded aria-controls>` immediately after the label, toggling a
`<div role="region">` **below the control**. Explicitly **not a tooltip and not a popover**, for four
reasons each of which is a measured or recorded defect: [V] the mockup's popovers are unreachable by
keyboard; a popover cannot be printed, and the spec requires a real print stylesheet; it cannot be
linked; and it covers the control while you are typing into it. The disclosure's open state is a URL
parameter (`?explain=scope`), so a doctor finding or a tutorial step can deep-link an *open*
explanation.

Its contents, in a fixed order, every part fetched or computed — demonstrated live in the sketch:

1. **What it is** — the topic paragraph, rendered by R1's renderer.
2. **In this project** — the corpus cross-link that is the whole justification for docs living here:
   *"`src/api/**` matches 38 files. 14 items carry a scope; 2 match no file and `doctor` reports them
   as `dead_scope`."*
3. **The command**, in the `.cmd` block, with `--yes` visually flagged (`04-visual.md`).
4. **How you will know it worked** — the landing predicate from `03-interaction.md`'s five-field
   command object. **This is the field that satisfies the mutator-free rule.** Help does not stop at
   *"run this"*; it names the observable: *"the audit log gains a record with `op: promote`,
   `origin: human`; this card will say **landed** and print that record's timestamp. Until then it
   says **not seen yet** — never **not run**."*
5. **Read more** — deep links into R2's docs viewer at the exact heading ordinal and into R3's
   tutorial at the exact step.

**Tier 2 — the failure-time explanation, which is the tier that actually matters.** Help that waits
to be asked is help nobody reads. The highest-value explanation in this product is attached to a
*negative* result: an item that did not inject, a scope matching nothing, an empty screen, a diverged
command. `08-onboarding.md`'s six-rung ladder is already that mechanism. R4's contribution is to
declare that **the ladder's output is the help system's primary channel**, and that its rungs
dereference the *same* four sources tier 1 does. So there is exactly one explanation of "scope" in
the whole product, and it appears in three places — beside the scope input, at ladder rung 4, and in
the docs viewer — all reading one file.

### Where it appears — the audit, so "wherever the user must act" is a list, not a claim

Every composer field (verb, subject, each flag); `--yes`, always and unconditionally, because it is
the destructive token; the session and focus selectors in the shell; every budget control; every
config key row on Configure; every one of the five zeroes; every empty state; every `doctor` finding
code; every audit record kind; and the chip/dot legends. That is roughly **40 anchor points and zero
new prose**, because every one resolves to a row in the table above.

### English and Hebrew — and the failure mode is already correct

- **UI chrome:** the string tables, key-parity tested (exists).
- **Concept topics:** `src/help/topics/<topic>.he.md`. **The mechanism already exists and already
  refuses to fail silently** — [V] `readTopicFile` throws *"the topic X has no 'he' source
  (`…/scope.he.md` does not exist). Translate the topic before asking for it in that locale"*, and
  its comment says a silent fallback *"is how the Hebrew README's categories section came to be
  English in the first place."* So the UI renders that refusal as a first-class state: *"this topic
  has no Hebrew source yet — `src/help/topics/scope.he.md`"*, plus the English text **labelled as
  English and isolated `dir="ltr"`**. Never a silent English paragraph inside a Hebrew page. The work
  is three topic translations (`scope`, `capture`, `workflow`); `categories` is already Hebrew via
  `HE_CATEGORY_DESCRIPTIONS`. [V]
- **Command output is English and always will be**, by design and in writing. Stated once in the
  shell, not 40 times.
- `test/ui/help-parity.test.ts`: every anchor id resolves to a topic that exists in **both** locales,
  or appears on a committed *English-only, tracked* list — the same shape as R3's inconclusive list.

---

## R5 — the transparent 3D gloss

### The reconciliation, on the visual seat's own terms

`04-visual.md` rejects "generic shine", `backdrop-filter` glassmorphism, and spreading the accent as
brand colour. All three objections are precise, and none of them is an objection to this:

- **It carries no hue.** The gloss is achromatic — a white/black lightness edge, never gold, never an
  accent. It therefore cannot dilute gold's one job, because it never touches gold.
- **`backdrop-filter` appears zero times.** Not used, not needed.
- **It encodes meaning, and the meaning is elevation** — which the token system already declares as a
  three-tier ladder `--e1/--e2/--e3`, and which `04-visual.md` itself says is currently rendered as
  *shadow alone*, a rendering it calls out as failing in dark mode and asks to be fixed with *"a
  dark-mode-only inset highlight, not more shadow."* **That is the same line of CSS R5 needs.** The
  gloss is not a new visual idea bolted on; it is the missing half of an elevation model the panel
  already asked for.

### The technique — three static layers, no filter

```css
.gloss{
  background-color: var(--panel);                    /* OPAQUE. Always. */
  background-image: linear-gradient(
      to bottom,                                     /* vertical ⇒ no RTL work */
      var(--sheen-top)    0%,
      transparent        42%,
      transparent        62%,
      var(--sheen-bottom) 100%);
  box-shadow:
      var(--e1),                                     /* the existing ladder */
      inset 0  1px 0 0 var(--rim-lit),               /* 0 blur, 0 spread */
      inset 0 -1px 0 0 var(--rim-shade);
  border: 1px solid var(--edge-3);                   /* the 06-a11y correction */
  border-radius: var(--r-lg);
}
```

Four new tokens, all `light-dark()`:

```
--rim-lit      light rgb(255 255 255/.95)   dark rgb(255 255 255/.10)
--rim-shade    light rgb( 24  20  8/.07)    dark rgb(  0   0  0/.55)
--sheen-top    light rgb(255 255 255/.85)   dark rgb(255 255 255/.055)
--sheen-bottom light rgb( 24  20  8/.035)   dark rgb(  0   0  0/.18)
```

### The load-bearing decision: it is opaque

The requirement says *transparent*. The **look** of transparency comes from the gradient's lightness
ramp; the **element** has an opaque `background-color` beneath it. Nothing behind the card shows
through.

That is not a dodge, it is the entire honesty argument:

> A translucent card makes the contrast of every glyph on it a function of whatever happens to be
> behind it — i.e. unmeasurable, i.e. untestable, i.e. exactly the class of claim this project has
> paid thirty times for asserting. **An opaque painted highlight has one composite colour, and one
> composite colour has one number.** The owner gets the appearance; the palette keeps its guarantees.

### The numbers — computed, and they bound the design

Composited in-browser in the sketch, and independently here. [M] Worst point of the card in each
theme, against the corrected `--faint` (`06-a11y.md`'s fix, replacing the 3.14:1 / 2.91:1 token):

| | light, flat | light, worst on gloss | dark, flat | dark, worst on gloss |
|---|---|---|---|---|
| `--ink` | 17.86 | **16.64** | 14.94 | **12.97** |
| `--dim` | 6.00 | **5.59** | 5.53 | **4.80** |
| `--faint` (corrected `#5f5d57`/`#a5a29a`) | 6.58 | **6.13** | 7.00 | **6.08** |

Every value clears 4.5:1. The gloss's **maximum** cost anywhere is 0.73 of a ratio point, on `--dim`
at the top of a dark card.

**And that worst case is what bounds the token.** Sweeping the dark-mode sheen alpha: `--dim` holds
4.5:1 up to **α = 0.075** and fails at 0.080. [M] We ship **0.055**, which measures 4.80. So:

> **`--sheen-top` in dark mode has a stated ceiling of 0.075, and it is a unit test**: a ~30-line
> `node:test` file that recomputes the composite from the token values and asserts every
> ink-on-glossed-surface pair ≥ 4.5:1. The same script `06-a11y.md` already ran by hand, run in CI.
> The gloss cannot be quietly turned up until it breaks.

**It does not touch the 1.04:1 and 2.91:1 findings.** The 2.91:1 is `--faint` on `--paper` and is
fixed by the token correction, not by R5; the gloss then costs that corrected token 0.45 of a point
and it still clears. The 1.04:1 is gold-vs-green **tier dots**, and **dots never get the gloss** —
their fix stays `06-a11y.md`'s: shape (`◆` filled / `○` hollow) plus the word in the accessible name.
R5 must not be sold as improving either, and this section exists so it cannot be.

### Degradation — three triggers, one outcome

The depth cue moves from **paint** to **edge**, because an edge is the one thing all three preserve.

- **`prefers-reduced-transparency: reduce`** — nothing here is actually transparent, but the query is
  about the *appearance*, so honour it: `background-image: none`, `box-shadow: none`, border to
  `--ink`. Three lines.
- **`forced-colors: active`** — the trap worth writing down: **`background-image` on a non-`<img>`
  element is not forced**, so a surviving gradient would wreck the system palette. Null it explicitly
  and null the shadows; set `border: 1px solid CanvasText; background-color: Canvas`. Do **not** reach
  for `forced-color-adjust: none` — let the system paint. Elevation then reads as a border, which
  high contrast keeps.
- **`prefers-contrast: more`** — sheen off, border to `--ink`.
- **`@media print`** — gradient off, shadow off, `1px solid #000` border, and
  `print-color-adjust` deliberately **not** set to `exact`: forcing ink for decoration wastes the
  reader's toner. The card prints as a ruled box.

All three are on live checkboxes in the sketch, using the *identical declarations* as the media
queries, so the simulation cannot lie about what the query does.

**One thing to land in the same print block, while it is open:** [V] `06-a11y.md` measured that
`Ctrl+P` prints a blank page from every screen but Coverage, because the print rules hide every
screen and never remove `hidden` from the one they print. A print sheet must say what it *shows*, not
only what it hides. Noted in the sketch's print block.

### Cost on a 57,000-node tree — a selector rule, not an optimisation

Three facts, in order of how much they matter:

1. **Neither a zero-blur `inset` shadow nor a `linear-gradient` creates a compositing layer or
   invokes a filter.** They are paint-time only, and the outer `--e1/--e3` shadows already exist in
   the current sheet, so R5 adds **no new blurred shadow**.
2. **The gloss is applied to card-scale surfaces only — at most about twelve per screen.** Never a
   row, never a cell, never a tree item, never a chip, never a dot. Twelve gradient paints versus
   57,000 is the whole cost story, and it is a *rule about which selectors may carry the class*, not
   a hope about how a browser behaves.
3. **Enforced.** `07-arch.md`'s source scan gains rule 8: `.gloss` may appear only on an allowlist
   (`.card`, `.floating`, `.banner`, `.empty`, `.cmd`) and never on `tr`, `td`, `li`,
   `[role="treeitem"]`, `.chip`, `.dot`. A regex over `styles.css`, the same shape as the
   logical-property scan the project already needs.

### Which surfaces get it, and which must not

**Gets it:** `.card` (resting, `--e1`); `.floating`/popover (`--e3` + `--panel-2` — the strongest
case, because in dark mode a drop shadow cannot say *above* and a lit rim can); `.banner`; `.empty`;
and **`.cmd`, the composed-command block** — the one place elevation carries product meaning, because
the composed command is the object the user takes *out* of the app into their own terminal, and
raising it above the page is the visual statement of *"this leaves here."* That is shine that earns
its place on `04-visual.md`'s own test.

**Must not:**

| Surface | Why |
|---|---|
| rows, cells, list items, tree items, chips, dots | the 57,000-node cost; and elevation on a row means nothing |
| the provenance / staleness band | a caveat that looks detachable is a caveat that gets ignored. It is an inset, not a card |
| **quoted corpus text (R1's `.doc`)** | **inverted deliberately** — corpus text is an inset well on `--sink` with a leading-edge rule. Raised = the product is speaking; inset = we are quoting. R5 becomes the reader's cue for *who is speaking*, which is R1's hardest requirement solved by R5's |
| the budget bar's spill segment | it already carries a pattern fill for the colour-alone fix; a gloss over a pattern is noise |
| focus rings | a gloss under a ring lowers the ring's measured contrast |

And the invariant that makes the R1/R5 pairing testable rather than stylistic:
**`.doc` and `.gloss` may never appear on the same element** — one more line in the same scan.

### RTL

The sheen axis is **vertical**, so it needs no mirroring and no `--grad-dir` custom property. A
diagonal sheen would imply a light source at a specific horizontal position, which then *must* mirror
in Hebrew — correct, but a second thing to test for a look that is not better. The rim insets have
zero horizontal offset, so they need nothing either. **R5 adds no RTL work at all**, which is the
reason to prefer it over every diagonal-highlight variant.

---

## What I could not solve

**1. Nothing can verify that a Hebrew tutorial says what its English original says.** [V]
`parity.test.ts` proves it in its own third test by garbling every Hebrew letter and watching the
suite stay green. Extending parity to six pairs multiplies the *structure* guarantee by six and the
*meaning* guarantee by zero. Six documents is three times as much untested translation as today, and
the only control I can offer is process: translate immediately after the English lands, never in a
batch. I do not have a mechanism.

**2. The tutorial fixture problem is real work I have costed but not solved.** Making the tutorials
generated requires named fixture states in `doc-fixture.ts`, and I estimated ~60 lines from reading
`gen-doc-examples.ts` — I did not build it. If the step states turn out to need genuine sequencing
(an `ingest` session, a staged revision, a real audit record), the number is larger and the tutorials
may have to ship with *some* transcripts still ungenerated. Which ones would have to be listed, the
way R3's checker lists its inconclusive commands.

**3. R3's flag checker cannot prove a flag is *accepted* on 12 of 30 commands.** [M] Measured, not
assumed. It can prove *refusal* everywhere; it can prove *acceptance* only where the command routes
through `refuseUnknownFlag` and reaches it. The three-outcome design keeps this visible instead of
papering it, but the gap is real and it covers `ingest`, `lesson-*` and `query` — three surfaces R3
tutorial #4 teaches directly.

**4. The markdown renderer's inline grammar will be wrong somewhere.** CommonMark's emphasis rules
are genuinely hard, and mine are a simplification. Every ambiguity in my parser resolves toward
*refusal* or toward *plain text*, so the failure mode is a paragraph that looks slightly wrong rather
than an element that should not exist — and the adversarial fixture asserts exactly that
(`no input produces an element outside TAGS`). But I cannot claim CommonMark conformance and I am not
going to.

**5. `<details>`/`<summary>` is a genuine exception to "no raw HTML" and I could not remove it.** The
README's structure depends on it; refusing it hides content, which is worse than rendering it. Two
line-anchored literals are the smallest exception I could find, and it is still an exception. If the
README were rewritten to use a markdown-native disclosure convention this would go away — that is a
document change I am not authorised to propose here.

**6. I could not make Hebrew search work properly.** Line-scanning with niqqud stripped is honest and
cheap and does not handle Hebrew morphology; a Hebrew reader searching `תקציב` will not find
`תקציבים`. A stemmer is a dependency. The design states the limitation in the search box rather than
solving it, which is the weakest answer in R2.

**7. R5's contrast test protects the tokens, not the compositions.** The ~30-line test asserts
ink-on-glossed-surface pairs. It cannot see a future component that puts `--faint` text over the
*chip* background *on* a glossed card — a three-way composite. I know of no cheap general mechanism
for that, and the honest mitigation is that `.gloss` is on an enforced allowlist of five selectors,
so the space of compositions is small enough to enumerate by hand once.

**8. `inventory.test.ts` and `src/cli/index.ts` disagree about where the command surface lives**, and
I resolved it for R4 by choosing the registry (which I verified holds all 30 commands) [M] without
fixing the stale docstring. That is a repo change, not a design decision, and it belongs to whoever
owns that file.

---

## Headline

**The two requirements that look most dangerous to the architecture turn out to defend it: a markdown
renderer that emits `createElement` from a frozen tag table and `textContent` for every leaf leaves
the `innerHTML` ban textually unchanged and still returns zero on the scan, and the gloss — made
opaque, so its contrast is one computable number rather than a function of whatever is behind it —
completes the `--e1/--e2/--e3` elevation ladder that `04-visual.md` already asked to be fixed for dark
mode.** R1 and R5 then solve each other: raised-and-glossed means the product is speaking, inset-well
means we are quoting semi-trusted text off disk, and *"`.doc` and `.gloss` never appear on the same
element"* turns the most important reading cue in the app into one line of a source scan. **The
mechanism that carries R2, R3 and R4 is the same one three times — never write a second copy: the
docs viewer addresses a section by its ordinal in the sequence `parity.test.ts` already pins, so one
integer gives both deep-linking and a language switch that lands on the same section; help fetches
every sentence it shows from the command registry, `src/help/topics/*.md` and the resolved config, so
there is no fifth spelling to drift; and the tutorial checker asks the running program whether a flag
exists rather than reading a list, which is also how it discovered that 12 of 30 commands cannot
answer, and says so.**
