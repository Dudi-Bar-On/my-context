# The tools

The MCP tools are the surface **you** drive. `help("capture")` says what is
worth capturing and `help("workflow")` says what happens to it afterwards;
this page is the surface itself — what each tool takes, what it fills in for
you, and what it refuses.

Three failures from one session, all of them answerable from this page:

- *"An agent cannot record a lesson."* It can, and it is the strongest route
  there is — see below. Believing otherwise cost several exchanges.
- `create_item(… , relations: [...])` — refused,
  `create_item does not take "relations"`, and nothing was written.
- `update_item(id, scope: [...])` on a rule that governs — refused. That is
  the design, not a bug, and reading it as one costs a retry that is refused
  again.

## Every tool, and every argument it takes

Generated from the tool registry itself, so this is what this build actually
serves rather than a list somebody kept up to date. It is the same text the
server sends you in `tools/list`: the description, then every argument, with
the required ones marked and any closed value set spelled out.

{{TOOL_REFERENCE}}

**If an argument is not on that list, the tool does not take it.** Every schema
declares `additionalProperties: false` and the server enforces it before the
handler runs: an undeclared argument is refused **by name**, the refusal lists
what the tool does accept, and nothing is written. There is no silent drop —
`update_item({sevrity: "hard"})` is answered with a refusal naming `sevrity`,
not with "updated".

That refusal reads the schema above, so it cannot go out of date, and nothing
is created by a refused call. Probing is free.

**A default appears above only where the schema states one**, and the schemas
are not uniform about it: `audit_log`'s `limit` names its default, while
`query_items`' and `list_drafts`' do not — they have one all the same. Omitting
an optional argument is how you take its default; there is no value to guess,
and none of the three is worth restating here, where it would be a copy of a
number that lives in the handler.

## What is stamped, and what is accepted

**`origin` is never taken from a tool call.** It is not in any schema on this
surface and passing it is refused by name, with this sentence attached:

> origin is never taken from a tool call: every tool that writes on an agent's
> behalf records origin "agent" itself, which is what the draft/active trust
> boundary rests on.

So the claim is not yours to make, to mistype or to forget. `create_item`,
`update_item`, `refresh_item` and `supersede_item` each pass `origin: 'agent'`
in the handler; `link_items` does too, and there it only makes the audit log's
"who" true, because adding an edge changes nothing about what governs.
`ingest_document` is the one that stamps something else — everything it applies
is written as `origin: 'ingest'` and lands as a draft, which is why you may run
the apply step of that flow yourself.

**The consequence people get backwards: this is what lets you record a
lesson, not what stops you.** `create_item(type: "lesson", …)` works, has
always worked, and lands **active** — a `lesson` is rationale tier, and
nothing on that tier is injected into a session, so there is no gate for it to
be held behind. `help("workflow")` is the whole statement of which tier is
held and why.

## What each tool refuses, and why

A refusal here is a decision, not a failure. Each one below was executed
against the running program, and each writes nothing.

- **Normative content you author lands `draft`.**
  `create_item(type: "rule", …)` answers
  *"created RULE-… (draft) … non-human-authored normative items are not
  injected until reviewed"*. It is not an error and there is nothing to retry:
  the item exists, it is indexed and searchable, and a human promotes it. A
  rationale capture answers `(active)` in the same breath, and the reply always
  says which happened — read it rather than assuming.
- **`scope`, `always` and `severity` are refused on a governing normative
  item.** Those three decide whether the item reaches a session at all, so
  `update_item` refuses them by name on an item that is `active` or
  `validated`, and names the human command that can. `status` on a normative
  item is refused on the same terms, and `supersede_item` refuses to retire one.
- **Title, body, tags and `extra` are not refused — they are STAGED.** On the
  same governing item, `update_item({title})` answers *"NOT applied — staged as
  revision REV-… "*. The item is untouched and keeps governing the text it
  already had. Do not go on reasoning as if your text were in force. Whether an
  edit stages or applies is the category's `agentEdits` setting — staging on
  every normative category, applying on every rationale one, and settable
  either way per project; `help("workflow")` owns that, and the reply says
  which happened in its first words either way.
- **An extra field its category does not declare is refused by name.**
  `create_item(type: "rule", likelihood: "high")` is answered with
  *"extra field "likelihood" is not declared by "rule""*, the fields a `rule`
  does declare, and where `likelihood` lives instead. The flat argument list
  above is the UNION over every category — one `tools/list` answer serves every
  project — so being in the list is not being accepted on your category. The
  per-argument note says which categories each one is *only* on.
- **`create_item` refuses a `relations` argument.** Below.

## The same act on the other two surfaces

Every tool has a user-invocable counterpart — a CLI command, a slash command,
or both — and where one of the two is missing that is a decision with a reason.
Generated from the parity declaration, which is checked against the running
program in both directions:

{{TOOL_PARITY_TABLE}}

{{TOOL_PARITY_NOTES}}

A name in the CLI column may be reached under a longer one: `create_item` is
`mycontext add <category>` and `/mycontext:add-<category>`, because the
category is spelled into the command name. `help("cli")` is the CLI's own
page and `help("slash")` is the slash surface's.

### Two places the surfaces deliberately differ

**Relations have no CLI spelling at all.** There is no `mycontext link`, and
`create_item` refuses a `relations` argument by name — the refusal points at
`link_items(from, to, relation)` for an ordinary edge and
`supersede_item(id, by)` for a retirement. Both gates live inside those two
tools: `link_items` enforces the closed relation vocabulary and refuses
`supersedes`/`superseded_by` by name, because those assert a lifecycle change
it never performs. A `relations` argument on `create_item` would route around
both in one step. The one relation verb the CLI does have is destructive:
`mycontext edit <id> --unlink <relation> <target>` removes an edge, and no tool
does that.

**`mycontext lesson --agent` is self-declared where `create_item` is
handler-stamped.** The flag really does record `origin: "agent"`, and it is the
only honest shell spelling — but it is a flag, so an agent that omits it is
back to claiming `origin: "human"` and nothing anywhere can tell. The tool
cannot be spelled wrong that way: it refuses to take an origin at all. Prefer
the tool; reach for the flag only when the MCP server is not available. The
gate at the far end of that flow takes neither: `mycontext lesson-accept`
refuses `--agent` by name, in every spelling, because accepting a staged
candidate creates an active rule that governs this repository — it is not a
step towards the approval gate, it *is* the gate.
