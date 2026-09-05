---
id: DEC-an-external-documentation-tool-may-be-embedded-and-it-may
type: decision
title: an external documentation tool may be embedded, and it may cost a dependency
status: active
severity: soft
always: false
summary: A documentation tool may now be brought in from outside and built into the product, even though that means taking on a dependency.
summary_of: 5da83fcaf09432a8
scope: []
tags:
  - v2
  - ui
  - docs
  - dependencies
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 25eea4d5fab53b03
---

# an external documentation tool may be embedded, and it may cost a dependency

Owner ruling 2026-09-05, given after he rejected both the Documentation screen design and my
recommendation to build without a generator. His words: “i approve you to choose and external tool
to be embedded in mycontext (if it for example has sdk) even it’s a kind of dependency”.

WHAT THIS SETTLES. CONST-zero-runtime-dependencies says in its own words that a fourth dependency
is “a ruling to record, never a commit to make”. This is that ruling. It is scoped to the
documentation system; everywhere else the constraint stands and the next one is another ruling.

WHY HE OVERRULED ME, and he was right to. I recommended building on the existing markdown renderer
because a generator costs a dependency and very likely a build step. That reasoning was sound about
COST and silent about VALUE - I never checked what already exists, so the recommendation was really
“keep what we have” wearing the clothes of an analysis.

WHAT THE RESEARCH FOUND. Every full documentation SYSTEM - Docusaurus, VitePress, Starlight,
Nextra - needs a build step, which CONST-node-24-no-build-step forbids. Docsify needs no build and
parses markdown in the browser at runtime, but it is a single-page app that owns the whole
document, and this screen lives inside a twenty-screen console beside a nav rail and a status bar.
No whole system fits; the useful shape is an EMBEDDABLE LIBRARY rather than a site generator.

THE DRAWINGS ARE THE PRIZE. README.md holds five mermaid diagrams and the UI has no mermaid
renderer at all - zero matches under src/ui/public - so they render today as raw fenced text. That
is the concrete thing he called ugly and unreadable.

AND IT REVERSES AN EARLIER ANSWER OF HIS, deliberately. Asked the same morning under the old
constraint he chose hand-authored inline SVG, which was correct while a dependency was forbidden.
With the bar lifted, a vendored renderer keeps the drawings DERIVED from the README source rather
than five hand-drawn copies that drift from the text they illustrate - the same argument that
explains why both READMEs went stale five times in two days.

WHAT A CANDIDATE MUST STILL SATISFY, because this lifts one bar and not the others: no build step;
vendored and working offline, since a local tool must not need the network to show its own help;
embeddable into one container rather than owning the page; CSP-safe with no eval; correct under
dir=rtl for the Hebrew side; and dark theme only, because this product has no light theme.
