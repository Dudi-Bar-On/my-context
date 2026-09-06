---
description: Ask for the handover note NOW, before compacting or starting a new session
argument-hint: "[--anyway]"
disable-model-invocation: true
---

**Ask for this project's handover note now**, at whatever the context window currently
holds, instead of waiting for the threshold the `Stop` hook watches.

Run: `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" handover ask $ARGUMENTS`

**Run it from here and nowhere else.** The command asks THIS session to write its
handover, and it establishes which session that is from the environment Claude Code gave
the process. Run outside Claude Code it refuses, and there is deliberately no way to name a
session by hand.

It prints one of two things, and both are for you to act on rather than to summarise:

1. **The ask.** Then WRITE the file it names, in this turn: what you were doing, what you
   decided and why, and what the next session must do first. The command only records that
   an ask went out — whether it was answered is decided by whether that file is written
   after the timestamp it prints, exactly as it is for the automatic ask.
2. **A refusal, with its reason.** It refuses rather than guesses, and none of the reasons
   is fixed by running it again:
   - it cannot read how full the window is, because the status-line bridge is missing,
     silent or stale. The message says which, and what fixes it. No percentage is guessed;
   - **this session has lanes still running**, and it names them. Read them out and let the
     USER choose: wait for them to finish, stop them themselves, or say to go ahead — in
     which case run it again with `--anyway`. Do not choose for them, and never add
     `--anyway` on your own initiative.

**Nothing here writes the handover for you, and nothing here stops a lane.** my_context has
no control that ends a subagent; stopping one is something the user does in Claude Code.
