---
id: TASK-review-1b-the-second-visual-direction-panel-four-prototypes
type: task
title: "review 1b: the second visual direction panel — four prototypes, one adversary, libraries allowed"
status: active
severity: soft
always: false
summary: A second look at the visual direction, building four working prototypes so the choice can be made by looking rather than by reading.
summary_of: 72764dd7a024f99b
scope: []
tags:
  - "plan:review"
  - "seq:1b"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 87e1f55db34778f8
plan: review
seq: 1b
state: done
priority: "1"
---

# review 1b: the second visual direction panel — four prototypes, one adversary, libraries allowed

**Commissioned 2026-08-21, after the owner reviewed review 1's artifact.** His verdict: the improvements were real, but it did not produce the *wow* effect he was looking for.

**Why the first panel could not deliver one, and it was the brief's fault.** `RULE-ui-work-consults-every-installed-design-frontend-and-browser` is pinned and names twelve tools by name — `frontend-design`, `ui-ux-pro-max:design`/`:design-system`/`:ui-styling`/`:brand`, `dataviz`, the `frontend-excellence` agents, `chrome-devtools-mcp:a11y-debugging`, `visual-documentation-skills`, `webapp-testing`, `claude-in-chrome`. **The review 1 brief named exactly one: Playwright.** So the panel measured superbly and proposed entirely within the existing token set. It could say gold is 4.20:1. It could not propose a direction.

**The owner's rulings for this panel.**

Dependencies: **UI assets only.** React and any library may live in what the browser loads. The CLI, MCP server and hooks stay at zero runtime dependencies — `package.json` has no `dependencies` and `bin` points at `./src/cli/index.ts`, run from source by Node 24 with no build step in the product. The real cost of relaxing this is the **build step**, not the dependency.

Reference: **best-in-class developer tools as the floor, AND several genuinely distinct directions on top.** Both, not either.

Size: **five agents, working prototypes required.** Not options described — the same screen built four ways, so the owner rules by looking.

**The four directions.** A, the restrained instrument: zero dependencies, proving or disproving the plain-CSS ceiling. B, the component system: React and a real library stack, RTL as a hard gate. C, distinctive identity: an idea that belongs to this product and no other — its subjects are provenance, tiers, decay, scope and an audit log, which is closer to an archive or a ledger than a SaaS dashboard. D, data-first: eighteen graphical views, so the visualisation is the design. Plus an adversary building the case against each from its premise and costing all four.

**Two measured facts that define the opportunity.** The mockup contains **zero transitions, zero animations and zero keyframes** — nothing moves anywhere, and `prefers-reduced-motion` is absent because there is nothing to reduce. And **no colour in the token set means clickable**; gold means *this governs*, which is why the most repeated control in the product renders as an unstyled native button.

**Timing.** ui1 is 15/20; ui2 (14 tasks) and ui3 (15 tasks) are entirely unstarted. Decided now, they are planned once. Decided later, it is rework across roughly 29 tasks.
