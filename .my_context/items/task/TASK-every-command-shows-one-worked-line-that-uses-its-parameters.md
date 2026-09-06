---
id: TASK-every-command-shows-one-worked-line-that-uses-its-parameters
type: task
title: every command shows one worked line that uses its parameters, with real values
status: active
severity: soft
always: false
summary: Each command gets a full example built from what its own options declare, so nobody has to guess a format.
summary_of: 995e17d3ba963790
scope:
  - src/ui/read-model-cli-help.ts
  - src/ui/public/screens/cli-help.js
  - src/core/command-flags.ts
tags:
  - v2
  - ui
  - help
  - cli
  - "plan:library"
  - "seq:4"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: c6d645dd8a381edd
plan: library
seq: "4"
state: done
priority: "2"
needs: builder/4
verified_on: 2026-09-07
---

# every command shows one worked line that uses its parameters, with real values

Owner request 2026-09-06: below the syntax, "a comprehansive example that will use most if not all
the parameters and will show actual values so a date would show how date looks like because other
then the user does not know the correct format".

HALF OF WHAT HE ASKED FOR ALREADY SHIPS, and this item exists so nobody rebuilds it. Measured:
148 flag declarations - 12 carry a closed vocabulary, 53 carry a FORMAT AND AN EXAMPLE, and 83 are
bare. ZERO bare declarations consume a value, so every value-taking flag already declares its shape
and one legal value, and the card already draws both. `audit --since` reads: format "an ISO-8601
instant, a date read as UTC midnight, or a span back from now", e.g. `7d`. That is `plan:builder
seq:2`, done, and it is exactly the per-parameter type-and-format-and-example he described.

WHAT IS MISSING IS THE WHOLE LINE. `audit` serves ZERO worked examples. The card reads them from
the SHIPPED README blocks via `core/doc-examples.ts`, which is right for the commands the README
demonstrates and empty for every command it does not. So a reader sees each parameter explained and
never sees them used together.

AND IT IS DERIVABLE FROM DATA THAT ALREADY EXISTS - the same trick that closed the slash-parameter
gap this morning. Each flag declares one legal value; a line that spends them is a composition, not
prose. Nothing is authored, so nothing goes stale, which is the property that matters here: a
hand-written example is exactly the drift this project measures in days.

THREE THINGS THAT MAKE THIS HARDER THAN A JOIN, and they are the whole design:

  1. "ALL THE PARAMETERS" IS NOT SATISFIABLE, and a generator that tries produces an invalid line.
     `--full|--short|--summary` are mutually exclusive by construction, and the declarations say so
     in PROSE ("Mutually exclusive with --file, which is refused rather than merged") rather than in
     data. So either exclusivity becomes declared, or the composer picks one member per group by a
     rule it can state. Decide which, and say so - do not infer exclusivity from a note by keyword.
  2. POSITIONALS ARE NOT FLAGS. `mycontext show <id>` takes no flag at all; an example made only of
     flags would omit the only thing that command takes. `positionals` is already handed to thirty
     commands by the parser and is the source for this half.
  3. THE LINE MUST BE VALID, and validity is about to become checkable rather than assertable:
     `builder/4` is landing `POST /api/command/check`, which parses a composed command without
     executing it. A generated example that the product’s own checker refuses is a defect the
     moment it is drawn, and this is the one task where that endpoint has an obvious first user.

WHETHER IT IS ALSO RUN is a separate question and probably a later one. `scripts/gen-doc-examples.ts`
runs real commands against a committed fixture and pastes true output, which is why the README
examples are trustworthy. Doing that for every command means executing writes, which needs the
scratch-corpus ruling the owner has not been asked for. CHECKED is enough for this item; RUN is a
follow-up worth naming rather than smuggling in.

HIS SCOPE IS "all the help subjects", so this covers the 44 commands. Slash commands carry a
one-line `argument-hint` and no per-parameter data, and MCP tools already draw a full argument
table from their schemas - both are different shapes and neither should be forced into this one.
