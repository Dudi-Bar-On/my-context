---
description: "Walk a one-time procedure: what is ready, what is running, what is finished"
argument-hint: "[list|show|activate|done|step] [the procedure id] [the step number]"
disable-model-invocation: true
---

Work a `procedure` — an operation performed once and then finished — in this project's
my_context knowledge base.

What the user typed: $ARGUMENTS

**A `runbook` is not a `procedure` and this command refuses one by name.** A runbook is
repeatable: it is performed again every time the named operation comes up, so it has no
lifecycle to activate and nothing to finish. If the user points at a `RUN-` id, say that
rather than looking for another way in.

1. If no id was given, run `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" procedure list`. It groups every procedure by stage —
   proposed, ready, active, done, abandoned — and prints `N of M` for each. Offer what it
   returns and stop until the user names one; never guess an id.

   **Three of the five subcommands are yours to run:** `procedure list`,
   `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" procedure show <id>`, and `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" procedure step <id> <n>` (with `--undo`
   to un-tick one). A step changes no item, crosses no trust boundary and takes no write
   lock — it appends one record to the audit log, and progress governs nothing.

   `show` prints the procedure with its ticks laid over the steps. **Those ticks are
   rendered from the audit log, not stored in the file** — say so if you quote them,
   because the Markdown on disk still reads `- [ ]` on every step.
2. Run it WITHOUT `--yes`, exactly as written:

   `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" procedure activate <id>`

   It prints the real preview — what the item is, what would change, and what
   governs before and after — and then refuses, because stdin here is not a terminal.
   **Exit code 1 is the expected outcome and is not a failure: nothing was written.**
3. Show that preview to the user as it was printed. Do not summarise it, re-order it or
   drop the "after" line — it is the whole of what they are being asked to approve.
4. Print the same command with `--yes` on the end, for the USER to run, and stop.

   Activation is TWO writes and this command makes them one act: `status: active` makes
   the item eligible to be selected at all, and `always: true` is what delivers it in
   full at every session start. The preview says what each of them does, because a plan
   that sets only the first ships a procedure that is indexed and never delivered.

   Do not run it yourself. It claims `origin: "human"`, which is the one claim you cannot
   make, and it is on the deny list this plugin's README recommends.

**`node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" procedure done <id>` is the user's in exactly the same way**, and for the same
reason: it claims `origin: "human"` and it is on the deny list this plugin's README
recommends. Preview it the same way — without `--yes`, show what it printed, hand the
`--yes` form over — and do not run it. You may **report** that the steps look complete
and **ask**. A procedure left `active` forever is a real failure, and a procedure retired
because a model decided it looked finished is the other one; the gate is what keeps the
second from being the fix for the first.

**One honest limit, written down rather than implied by silence.** The CLI claims
`origin: "human"` on every write it makes, so a `step` record you produced is
indistinguishable in the audit log from one the user typed. That is the same bargain every
CLI command already makes, and it is acceptable here specifically because progress governs
nothing: no tick changes what is injected, what governs, or what any other session is
shown. It would not be acceptable on `activate` or `done`, which is why those are the
user's.

Progress is recorded per workspace, not per session: two terminals on this workspace share
one record set.
