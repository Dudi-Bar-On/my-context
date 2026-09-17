---
id: TASK-a-fence-that-does-not-parse-ships-to-readers-because-the
type: task
title: a fence that does not parse ships to readers, because the only thing that would have caught it is a drawing step that covers two files
status: active
severity: soft
always: false
summary: A parse-only gate over every mermaid fence in the documents, drawing nothing, held by a red proof and refusing to pass on an empty sweep.
summary_of: a12c1f24bf14f414
scope:
  - scripts/check-diagrams-parse.ts
  - package.json
  - test/**
  - scripts/gen-diagrams.ts
tags:
  - v2
  - docs
  - gates
  - "plan:rulings"
  - "seq:107"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: 63f105c743566dad
plan: rulings
seq: "107"
state: done
priority: "1"
---

# a fence that does not parse ships to readers, because the only thing that would have caught it is a drawing step that covers two files

OWNER RULING, 2026-09-17, choosing between widening `DIAGRAM_SOURCES` and a parse-only gate: **"the
parse-only gate"**.

── WHY THIS EXISTS, IN ONE PARAGRAPH ────────────────────────

`docs/capabilities/07-restore-and-handover.md:78` carried `&lt;key&gt;`, whose `&` breaks mermaid’s
lexer, and it reached readers that way for as long as it existed. Its author reported *"every fence
parses"* — having checked BRACKET BALANCE, not rendering — and the main session relayed that upward
without asking how it was checked. **BALANCE IS NOT PARSING.** Nothing caught it because
`DIAGRAM_SOURCES` lists only the two READMEs, so no fence under `docs/` is generated, committed or
gated. This item closes exactly that hole and nothing else.

── WHAT IT IS NOT ─────────────────────────────────────

**IT DRAWS NOTHING.** No SVG is produced, no file is written, `DIAGRAM_SOURCES` is not touched and
the `DIAGRAMS` map gains no entry. That separation is the whole point of the owner’s choice: drawing
all 23 undrawn fences was measured at ≈1.5–1.8 MiB, which would take `src/ui/public` from 5.04 MB to
≈6.7 MB — **past the 6.2 MB that `CONST-zero-runtime-dependencies`’ sibling budget ruling already
rejected**. Whether these fences are ever DRAWN stays an open question for the owner. Whether they
PARSE stops being one.

── WHERE IT LIVES — AND THE VERIFIER’S RECOMMENDATION WAS OVER-CONSTRAINED ──

The report proposing this said it "must live in `e2e/`, Playwright is barred from `test/`". **THE
BAR IS ON `test/`, AND `scripts/` IS NEITHER.** `scripts/gen-diagrams.ts` ALREADY drives headless
Chromium through Playwright as a plain `node` script, and `package.json` already runs five
browser-touching scripts that way.

SO: `scripts/check-diagrams-parse.ts`, with a `check:diagrams` entry beside `check:vendor`,
`check:basis`, `check:retired` and the rest. It mirrors the generator it sits next to, runs under
`node` with no test runner, and joins the gate family that already runs. Wire it into whatever
aggregate runs the other `check:*` scripts — A GATE NOBODY RUNS IS NOT A GATE.

── HOW IT WORKS ─────────────────────────────────────

REUSE, DO NOT REBUILD. Every piece already exists and has been exercised:

  — **Fence extraction: the product’s own `mermaidBlocks`** (`src/ui/public/lib/markdown.js:509`),
    which is what `collectDiagrams` in `gen-diagrams.ts` already uses. Do not write a regex. A
    second extractor would disagree with the first one the day a fence gets an info string.
  — **Parser: mermaid 11.17.2 from `node_modules`** — already a devDependency and already installed,
    so THIS GATE ADDS NO DEPENDENCY. `dependencies` is `{}` and stays `{}`.
  — **Browser: headless Chromium via Playwright**, as `gen-diagrams.ts` does.
  — **Config: `gen-diagrams.ts`’s own `securityLevel: 'strict'`.** Parsing under a different config
    than the generator would let a fence pass the gate and fail the drawing.

SOURCES — DELIBERATELY WIDER THAN `DIAGRAM_SOURCES` AND DELIBERATELY SEPARATE FROM IT:
`README.md`, `docs/README.he.md`, `docs/capabilities/**`, `docs/system/**`. Do NOT read the list
from `DIAGRAM_SOURCES`; coupling them re-creates the hole, because the whole defect was that the
drawing list is short. Measured cost at this size: under ten seconds for 28 fences.

ON FAILURE, PRINT WHAT A PERSON NEEDS: the FILE, the fence’s LINE NUMBER in that file, and MERMAID’S
OWN ERROR TEXT. "A diagram failed" costs someone the twenty minutes this gate was built to save.

── THE TWO WAYS THIS GATE CAN BE BORN USELESS ───────────────────

**1. IT MUST BE PROVEN TO GO RED, AND THERE IS A PERFECT KNOWN-BAD INPUT WITH PROVENANCE.** The
PRE-REPAIR ch.7 fence — the `&lt;key&gt;` version, recoverable from git history before `471b13b3` —
FAILS in real mermaid with an error pointing at the `&`, and that has already been reproduced. Hold
the gate with a proof that feeds it that exact fence and requires a non-zero exit. A gate whose red
path has never run is a green light with no bulb behind it.

**2. IT MUST REFUSE TO PASS ON AN EMPTY SWEEP.** If `mermaidBlocks` returns nothing — a moved file,
a changed fence marker, a glob that stopped matching — a naive gate checks zero fences and exits 0,
and reports GREEN forever while the documents rot. **ASSERT A FLOOR AND PRINT THE DENOMINATOR:** say
"N fences across M files, all parse", and fail if N is below a pinned minimum. This is
`nothing-to-do-and-could-not-look-are-different-answers` applied to a gate, and this repository has
already shipped one baseline harness that printed "baseline matches the pin" without ever running a
test — see `19939273`. Do not ship the second.

── CONSTRAINTS ────────────────────────────────────────

  — `CONST-node-24-no-build-step`: erasable TypeScript only, explicit `.ts` extensions on every
    relative import, no bundler.
  — `CONST-zero-runtime-dependencies`: `dependencies` stays `{}`. A devDependency already present is
    not a new dependency; adding one to `dependencies` would be a violation.
  — `check:dependencies` enforces a size budget — run it and confirm this change moves nothing.
  — A test declares what it rests on: ONE `@basis` line listing every id, or `none` with a reason.
  — `removeTree` from `test/helpers/tmp.ts`, never a bare `rmSync`. No raw NUL bytes. LF endings.
  — RUN NO GIT COMMAND THAT CHANGES REPOSITORY STATE. Leave the tree dirty; the main session commits.
  — THE SERVER ON 58888 IS THE OWNER’S. Another lane is driving Playwright — keep your Chromium use
    to the gate’s own short runs.

REPORT: what the gate covers, how many fences it found, the measured runtime, and the RED proof’s
output. If any fence currently fails, DO NOT REPAIR IT — `rulings/106` owns document repair. Name it
and hand it over.
