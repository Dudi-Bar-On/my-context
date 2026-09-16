---
id: CONST-zero-runtime-dependencies
type: constraint
title: The shipped plugin has zero runtime dependencies
status: active
severity: hard
always: true
summary: Nothing the plugin needs at run time is downloaded — source embedded in the repository is not a download and is allowed — and an automated check enforces it.
summary_of: 5e353df8d12cc777
summary_was:
  - 2026-09-16 Nothing the plugin needs at run time is downloaded, and an automated check now enforces that rather than a reviewer noticing.
  - 2026-09-06 Nothing the plugin needs at run time is downloaded, which is what lets it start in milliseconds and drop into any repository.
scope: []
tags:
  - packaging
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: f6fc7b8f2bcdcd4b
---

# The shipped plugin has zero runtime dependencies

`dependencies` is empty and stays empty — package.json declares no runtime
dependency at all, and neither `optionalDependencies` nor `peerDependencies`
nor `bundledDependencies` (or its `bundleDependencies` spelling) carries one
either; every one of those is a fetch a consumer would pay for. A plugin that
installs cleanly without a package fetch is what makes hooks start in tens of
milliseconds and what lets the plugin be dropped into any repo.

EMBEDDED SOURCE IS NOT A RUNTIME DEPENDENCY, AND THIS SENTENCE IS HERE BECAUSE ITS
ABSENCE ALREADY COST SOMETHING. The owner, 2026-09-16: *"importing a library and or
source code and embedding it in our code is not considered runtime dependency"*.

Read the rule by what it protects: a consumer installing this plugin pays for a
FETCH. A package named in `dependencies` is a fetch. Source copied into this
repository is not — it arrives with the clone, adds nothing to install time, and
cannot break because a registry moved. So vendoring is permitted and always was;
what is forbidden is the `dependencies` entry.

AND IT IS NOT A NEW PERMISSION — IT IS WHAT THIS PROJECT ALREADY DOES.
`src/ui/public/lib/vendor/` holds `markdown-it.esm.min.js` (137,975 B, MIT),
`github-markdown-light.css` (22,219 B, MIT) and twenty-six chunks of Web Awesome,
each with its licence file, all pinned, with a re-fetch route and a 22 KB
`VENDOR.md` that says why each one and why only that part of it.
`DEC-markdown-it-is-vendored-as-the-tokeniser-and-the-drawings` is the ruling,
taken 2026-09-05 on measured evidence.

WHAT WENT WRONG WITHOUT THIS PARAGRAPH: on 2026-09-16 a research lane surveyed every
candidate search library and RECOMMENDED NONE, citing this constraint — reading a
rule about downloads as a rule about libraries. The answer it could have given was
legal the whole time and sitting beside three examples of itself. **An item that
governs must say what it does NOT forbid**, because a reader obeying it cannot see
the practice it omits.

THE COSTS THAT ARE REAL, so this is not read as "vendoring is free":
  - `CONST-node-24-no-build-step` still binds, and it is now the sharper edge. Source
    runs as shipped — the vendored assets are browser ESM the page loads directly.
    A library that needs a bundler or a transpile does not fit, however small it is.
  - The LICENCE travels with the code and its file goes beside it.
  - Upstream fixes stop arriving. Vendored code is this project’s to maintain, which
    is why every entry is pinned and has a documented way to be re-fetched.
  - Take the PART, never the library. Every heading in `VENDOR.md` says *only*.

devDependencies are permitted and enumerated. Today they are four:
`typescript`, `@types/node`, `@playwright/test`, `mermaid`.

The browser suite was admitted deliberately and on the record — a test tool
violates neither the runtime rule nor the no-build-step rule, and it was the
first test dependency this project took, everything before it running on
`node:test` alone. `mermaid` is enumerated here on exactly that footing and no
wider one: `scripts/gen-diagrams.ts` draws the README diagrams in the Chromium
`@playwright/test` already downloads, the SVGs it produces are what is
committed, and nothing under `files` imports it — a build-time tool violating
neither the runtime rule nor the no-build-step rule.

AND THE RULING WAS NOT MISSING — THIS LIST WAS.
`DEC-markdown-it-is-vendored-as-the-tokeniser-and-the-drawings` ruled on
2026-09-05, 57 minutes before `52f74e4` landed the dependency, that *"mermaid
is a devDependency that NEVER SHIPS"* — and that decision's own scope names
`package.json`. What went unrecorded for weeks was the enumeration HERE, in the
one item that says a fourth is a ruling to record. A ruling in one item and the
list in another is the same drift the check below exists to stop, which is why
that check reads this sentence and no other. A fifth is a ruling to record,
never a commit to make.

THIS IS CHECKED, since 2026-09-07. `npm run check:dependencies`
(`scripts/check-dependency-budget.ts`) reads package.json and fails on any
runtime dependency at all — the case that actually matters — and on any
devDependency this item does not enumerate. It PARSES the sentence above
instead of keeping a second copy of the list, because a script holding its own
list is that drift wearing a different hat. The anchor is the words "Today they
are", a spelled-out count, a colon, and the names in backticks up to the full
stop; the count is checked against the length of the list, so a half-finished
edit fails rather than quietly widening the budget. **Edit that sentence and
you edit the budget. Break its shape and the check goes RED, never quiet.**
`test/scripts/dependency-budget.test.ts` runs the same audit against the real
package.json, so the gate also rides `npm test` in CI.

What that replaces: until 2026-09-07 nothing checked this automatically. No
`check:*` script and no CI step read a dependency list, a runtime dependency
added in a pull request went green, and the guarantee was held by review —
which missed the fourth devDependency for weeks and then found it only by hand,
while someone was verifying something else.

## Observations
- [limit] No runtime dependency may be added to package.json #packaging
- [consequence] The MCP server in Plan 3 must speak JSON-RPC by hand rather than using the SDK
- [consequence] The frontmatter parser is hand-written rather than using a YAML library
