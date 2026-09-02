---
id: RULE-ui-work-consults-every-installed-design-frontend-and-browser
type: rule
title: UI work consults every installed design, frontend and browser tool
status: active
severity: hard
always: true
summary: Work on the interface draws on every specialist tool available for designing, building and checking it in a real browser, rather than on just one of them.
summary_of: 2bf6e5a2e6a7a7dc
scope: []
tags:
  - ui
  - tooling
  - frontend
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: d6dc2209cdef2253
---

# UI work consults every installed design, frontend and browser tool

**Any UI, UX or frontend work consults every installed tool for it. Not one of
them — all that apply.**

These are installed on this machine and each knows something an improvised
approach will not:

**Design and visual direction**
- `frontend-design` — distinctive, intentional visual design; how not to read as
  a templated default.
- `ui-ux-pro-max:design`, `:design-system`, `:ui-styling`, `:brand` — searchable
  local data: styles, palettes with reasoning profiles, font pairings, UX
  guidelines, icons, chart types, stack-specific implementation.
- `artifact-design` — before writing any artifact page.
- `dataviz` — **before writing the first line of chart code**, choosing chart
  colours, or laying out a dashboard. This project has 18 graphical views; that
  is 18 reasons to read it first.

**Implementation**
- `frontend-excellence:component-architect`, `:css-expert`, `:react-specialist`,
  `:state-manager`, `:frontend-optimizer`.
- `visual-documentation-skills:*` — dashboards, flowcharts, timelines,
  architecture diagrams as HTML.

**Inspection and correctness, in a real browser**
- `chrome-devtools-mcp:chrome-devtools` — debugging, automation, network,
  console.
- `chrome-devtools-mcp:a11y-debugging` — semantic HTML, ARIA, focus states,
  keyboard navigation, tap targets, contrast. **Not optional for this UI**: it
  ships in two languages and mirrors right-to-left, so keyboard order and focus
  are load-bearing rather than polish.
- `chrome-devtools-mcp:debug-optimize-lcp`, `:memory-leak-debugging`.
- `claude-in-chrome` — driving a page in the user's own browser.
- `webapp-testing:webapp-testing`.

**Why consulting all of them matters here.** This UI has constraints that punish
a generic approach: a strict CSP with no external anything, no `innerHTML`,
logical CSS properties only, `light-dark()` theming, full EN/HE parity with
bidi isolation, and a print stylesheet. A tool that knows one of those will
catch what a general instinct misses — and the mockup has already lost content
twice to changes that looked reasonable in isolation.

**The order that works.** Design tools before writing markup; implementation
tools while writing it; browser tools to verify what was actually produced. The
last step is not optional — **this project has repeatedly found that a file
which reads correctly behaves differently when loaded**, most starkly when the
mockup's JavaScript turned out never to have run at all.

**And the boundary.** None of these overrules
`INSTR-the-mockup-is-the-ui-specification-build-it-exactly-and-ask`. They tell
you how to build well what the mockup specifies; they never license building
something else.
