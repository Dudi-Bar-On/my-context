---
id: KNOWN-every-command-the-product-tells-a-user-to-run-begins-with-a
type: known_issue
title: every command the product tells a user to run begins with a word that is not on their PATH
status: active
severity: soft
always: false
summary: Every command the product tells a person to type starts with a word their terminal does not know, so copying it hands them something that will not run.
summary_of: 2ac495457767848c
scope: []
tags:
  - v2
  - cli
  - ui
  - usability
  - owner-blocking
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 41d306cf46cc96b7
---

# every command the product tells a user to run begins with a word that is not on their PATH

**RESOLVED 2026-08-28 by `npm link`, and the interesting part is what was NOT
wrong.**

The `bin` entry in `package.json` was correct the whole time, and so were both
READMEs' install instructions. Nothing in the code was broken. The package had
simply never been linked on this machine, so the word every command starts with
resolved to nothing — and 262 documented invocations plus all 24 palette Copy
strings were wrong for a reason no file contained.

Verified after linking, in all three shells the owner uses:

    Git Bash    /c/Users/UserC/AppData/Roaming/npm/mycontext   -> usage printed
    PowerShell  …/npm/mycontext.ps1  -> `mycontext status` -> 608 item(s)
    cmd.exe     usage printed

What shipped alongside: a test on the bin VALUE (the one that existed checked
only that the KEY was present, so it would have passed with the path aimed
anywhere), and the install step in `docs/TUTORIAL.md`, which is where a new
reader lands first and which ran `mycontext init` with no link step at all.

A `doctor` check is being added for the state this issue was in: it reports
whether `mycontext` resolves and to WHAT, because resolving to a DIFFERENT
checkout is worse than not resolving at all and would otherwise look healthy.


FOUND 2026-08-27 the way it should have been found: the owner typed a command this product had just told him to run, and his shell answered `mycontext: command not found`.

    <bash-input>mycontext focus --clear</bash-input>
    /usr/bin/bash: line 1: mycontext: command not found

**`mycontext` IS NOT ON PATH ON THIS MACHINE, AND NOTHING ELSE IN THE PRODUCT DEPENDS ON IT BEING.** `package.json` declares `bin: {"mycontext": "./src/cli/index.ts"}`, so the name exists only after a global install or an `npm link`. The plugin is installed from a LOCAL DIRECTORY marketplace, which does neither. Every hook in `hooks/hooks.json` invokes `node --disable-warning=ExperimentalWarning "<root>/src/hooks/x.ts"` and works, so the product itself never assumed the name — only its OUTPUT does.

THE SCALE, counted in source: **57** printed `mycontext review`, 36 `mycontext ui`, 35 `mycontext edit`, 33 `mycontext audit`, 32 `mycontext session`, 28 `mycontext add`, 25 `mycontext init`, 16 `mycontext pack` — in refusal messages, in help topics, in doctor remedies, in the 503 body that says `Run mycontext audit to build it`.

**AND ALL 24 PALETTE ENTRIES COMPOSE `['mycontext', …]`.** So the Composer's whole purpose — compose a command and copy it — hands the user a string their shell rejects. The Copy button copies something that does not run. That is the screen's promise broken at its one job, and it went unnoticed because every gate compares what was composed against what the CLI PARSER accepts, never against what a SHELL can start.

RELATED AND ALREADY FILED: `KNOWN-statusline-install-writes-mycontext-statusline-which` is the same defect in a settings file, caught in a preview seconds before it would have destroyed the owner's status line. This is the general case that one is an instance of.

WHY EXECUTE CHANGES THE STAKES RATHER THAN FIXING IT. `POST /api/execute` runs `process.execPath` against the CLI it ships with, so the button works even though the copied text does not. That makes the divergence WIDER: the same screen now offers a control that works beside a control that does not, and the one that does not is the one a user reaches for when they want to see what happened.

THE ANSWERS, and none of them is "tell users to npm link":

  1. **Resolve the invocation the way the hooks do** and print THAT: `node "<abs>/src/cli/index.ts" <command>`. Correct everywhere, ugly to read, and unambiguous.
  2. **Offer `mycontext` but make it TRUE** — an install step that puts it on PATH, and a doctor check that says when it is not. Nicest to read, and it fails on exactly the machines where it is not run.
  3. **A slash command**, which Claude Code users already have: `mycontext help slash` says these exist. The right answer for anything a user is told to run INSIDE a session, and no answer at all for a terminal.

The choice is the owner's because it changes what every surface prints. What is NOT optional is that a product must not tell a person to run something that person cannot run.
