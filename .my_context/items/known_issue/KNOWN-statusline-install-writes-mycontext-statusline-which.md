---
id: KNOWN-statusline-install-writes-mycontext-statusline-which
type: known_issue
title: statusline install writes `mycontext statusline`, which resolves only if the CLI is on PATH
status: active
severity: soft
always: false
summary: Setting up the status bar writes a command name the machine may not know, and a status bar that fails shows nothing, so it would fail silently.
summary_of: 81900a1183c66242
scope: []
tags:
  - v2
  - statusline
  - cli
  - owner-blocking
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 57b319bdc71282e4
---

# statusline install writes `mycontext statusline`, which resolves only if the CLI is on PATH

MEASURED 2026-08-27, in the preview immediately before installing on the owner's machine -- which is where it was caught, and it would have cost him his status line.

WHAT INSTALL WRITES: `{"type":"command","command":"mycontext statusline","refreshInterval":60}` (`INSTALLED`, `cli/commands/statusline-install.ts` ~49).

WHAT IS TRUE ON THIS MACHINE: `mycontext` IS NOT ON PATH. `command -v mycontext` finds nothing and `where mycontext` finds nothing. `package.json` declares `bin: {"mycontext": "./src/cli/index.ts"}`, so the name exists only after a global install or an `npm link`, and the plugin is installed from a LOCAL DIRECTORY MARKETPLACE that does neither.

**THE FAILURE IS WORSE THAN A MISSING STATUS LINE.** Claude Code would run the command, it would not resolve, and the bridge would never start -- so the tee never happens AND the delegate never runs. Installing to preserve the user's existing status line would have destroyed it instead, and silently, because a status line that fails prints nothing.

THE PRODUCT ALREADY KNOWS BETTER, one file over. `hooks/hooks.json` never assumes a binary: every entry is `node --disable-warning=ExperimentalWarning "<root>/src/hooks/x.ts"`, and `self-register.ts` rewrites `${CLAUDE_PLUGIN_ROOT}` to `${CLAUDE_PROJECT_DIR}` for the in-repo copy. The status line is the one surface that assumed a name on PATH.

WHY ${CLAUDE_PROJECT_DIR} IS NOT THE ANSWER HERE: the status line is installed into `~/.claude/settings.json`, the USER settings, which is not a project. The value has to be resolved AT INSTALL TIME to an absolute path -- which is correct rather than a compromise, because a per-machine settings file is exactly where a per-machine absolute path belongs.

WHAT TO WRITE INSTEAD: `node --disable-warning=ExperimentalWarning "<abs>/src/cli/index.ts" statusline`, with `<abs>` resolved from `import.meta.url` at install time, and `process.execPath` for the interpreter rather than a bare `node` -- the same reason: the shell that runs a status line is not the shell that installed it.

CONSEQUENCES TO CARRY:

  - `looksLikeOurBridge` matches on the command STRING, so it must learn the new spelling AND keep recognising the old one -- an installed bridge from before this fix must still be detected, or a reinstall chains it to itself.
  - `uninstall` restores the saved copy and is unaffected.
  - The new spelling contains quotes and a path, so `parseCommandString` must still refuse to CHAIN a previously-installed bridge -- which it already does, by identity rather than by parsing.
  - A repository that moves breaks the status line. That is true of every absolute path in a settings file and is the reason `uninstall` exists; it should be said out loud at install time.

UNTIL THIS IS FIXED, INSTALLING IS REFUSED ON THIS MACHINE. The chaining work itself is correct and green -- the preview showed it would delegate to `["node","C:/Users/UserC/.claude/hooks/gsd-statusline.js"]` exactly as intended. It is the interpreter, not the delegate, that would not have started.
