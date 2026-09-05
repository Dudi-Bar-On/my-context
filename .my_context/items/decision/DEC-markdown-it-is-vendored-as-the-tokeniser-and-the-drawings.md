---
id: DEC-markdown-it-is-vendored-as-the-tokeniser-and-the-drawings
type: decision
title: markdown-it is vendored as the tokeniser, and the drawings ship as generated svg
status: active
severity: soft
always: false
summary: The renderer is replaced by a small vendored library, and the diagrams are rendered ahead of time into files a test keeps in step.
summary_of: 2c4fcba859e3207e
scope:
  - src/ui/public/lib/**
  - scripts/**
  - package.json
tags:
  - v2
  - ui
  - docs
  - dependencies
  - rendering
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: a873865e0786f266
---

# markdown-it is vendored as the tokeniser, and the drawings ship as generated svg

Owner ruling 2026-09-05, taken on measured evidence rather than on preference. Research spec:
docs/superpowers/specs/2026-09-05-documentation-tooling-research.md.

WHAT THE MEASUREMENT SHOWED, run over the real READMEs with the repo’s own harness:

                          today        correct
  README inside a <pre>   84%          16%
  tables surviving        0 of 29      29
  headings surviving      37 of ~100   98
  mermaid diagrams        4 as plain paragraphs, 1 as a code block

The largest single <pre> is 45,244 characters of prose. That is what the owner was looking at
when he called the screen ugly and unreadable. It was never a styling problem.

THE CAUSE IS ONE REGEX, and it is the third copy of a bug fixed twice already the same day:
FENCE = /^\s*```/ in screens/docs.js. Both READMEs use CommonMark variable-length fences - four
four-backtick blocks and two five-backtick ones, wrapping six nested three-backtick lines - so a
boolean toggled on every fence line flips parity and swallows the rest of the document. The same
defect was fixed in read-model.ts’s docHeadings and, before that, in test/helpers/markdown.ts,
whose header already warned that "a second copy of a subtle rule is how the first copy goes
quietly wrong". Three copies, three separate discoveries.

RULED, FIRST: vendor markdown-it 15.0.1 (MIT, 137,975 B, browser ESM) as a TOKENISER ONLY. It
reaches the correct answer exactly - 16% pre, 29 of 29 tables, 98 headings. Patching the regex
in place was measured too and reaches 30% and 17 of 29 tables: real, and half a fix. The library
is chosen to END this class of bug rather than to patch its third instance.

RULED, SECOND, and this is where the cost was: mermaid is a devDependency that NEVER SHIPS. A
script renders the five diagrams ahead of time into committed SVGs (~630 KB) and a regeneration
test goes red when a diagram and its source disagree. Vendoring mermaid to render in the browser
was the researcher’s recommendation and would have cost 3,572,661 B - 96% of the total - taking
src/ui/public from 2.5 MB to 6.2 MB in a plugin whose whole pitch is installing without fetching
packages.

THE RESEARCHER’S OBJECTION TO GENERATED SVG, ANSWERED. It rejected them as "a tenth class of
derived artefact that can go stale", which is this project’s recorded chronic failure and a fair
worry. It is answerable: docs/cli-ui-coverage.md shipped hours earlier as a generated artefact
held by a regeneration gate, so drift goes red rather than unnoticed. The same gate applies here.
Derivation is not the risk when the derivation is checked.

WHAT WAS VERIFIED FIRST-HAND rather than cited: all five English and five Hebrew diagrams render;
zero external network requests across three Chromium runs; dir=rtl correct with Hebrew labels and
markup intact. The widely-repeated claim that mermaid 11 pulls Manrope from Google Fonts is FALSE
for 11.17.2 - zero occurrences in the bundle, no off-origin request.

RULED OUT, and why, so nobody re-opens them: every full documentation system (Docusaurus,
VitePress, Starlight, Nextra) needs a build step, which CONST-node-24-no-build-step forbids.
Docsify fails twice over - it owns the whole document rather than one container, and it contains
new Function(n)() in executeScript, so it needs unsafe-eval and executes JavaScript found inside
your markdown. Syntax highlighting is rejected on demand rather than merit: only 20 of 117 fences
carry a highlightable language. "Embeddable docs SDK" turns out in practice to be the SaaS
category - Mintlify, GitBook, ReadMe, Algolia DocSearch - none of which suits a local tool.

WHAT THIS STILL DOES NOT SOLVE, stated rather than implied. The requirement asks for
documentation that is INDEXED, WITH LINKS. A tokeniser supplies the raw material and none of the
navigation - the tools that index are the tools that build - so the index remains ours to write.
Also unsolved: no route serves README.md today (walk/25), GitHub alert blocks, and five badges.
