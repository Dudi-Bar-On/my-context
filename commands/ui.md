---
description: Open the read-only web UI over this project's my_context corpus
argument-hint: "[--port N] [--no-open]"
disable-model-invocation: true
---

Open the read-only web UI over this project's my_context knowledge base.

**Do not run this one yourself. Print the command and stop.** Every other read command
here is a process that finishes; this one is a server. Two consequences, and both of them
end with you reporting a failure that did not happen:

- `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" ui` **does not return.** It holds the terminal until the page has been idle
  for eight hours or the user interrupts it, so a tool call that runs it waits until its
  own timeout and then reports a failure rather than a UI.
- It **opens a browser on the machine whose shell you are holding**, which is not
  necessarily the screen the user is looking at.

So give them the command, with whatever they asked for on the end:

    mycontext ui $ARGUMENTS

- `--port N` pins the port. Without it the operating system picks a free one, which is
  what you want unless they are forwarding it.
- `--no-open` prints the URL instead of opening anything — the form for someone working
  over SSH, and the one to offer first when you do not know where their browser is.

**What it serves.** The server binds `127.0.0.1` and refuses to start anywhere else; the
page receives a one-shot handoff nonce in the URL fragment and exchanges it once for a
token that lives only in the tab. So the URL it prints is worth one browser, once: it is
not a link to paste into a chat, and a second use of it is refused.

**It reads.** Every route it serves composes the same read functions the CLI commands do,
and the two halves of that are enforced rather than promised — `test/ui/no-writes.test.ts`
holds the symbols it may bind to an exact set, and `test/ui/server-e2e.test.ts` exercises
every route against a real corpus and requires it to come back byte-identical. A change
the UI suggests is composed there and pasted into a shell by the user, which is the same
boundary `/mycontext:edit` and `/mycontext:supersede` keep.

If a browser is not what they want, the same readings are `/mycontext:status`,
`/mycontext:doctor`, `/mycontext:decay` and `/mycontext:audit`.
