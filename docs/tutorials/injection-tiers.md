# See what my_context actually injected, and why

**Tested on:** my_context v1.0.2, Node 24, Windows 11.

## What it is for

Everything my_context does at runtime is one question: *which items reach this
session, and in what form?* When the answer surprises you — an item you expected
did not arrive, or one you forgot about did — this is the feature that tells you
why.

## How it works

There are exactly four ways an item can arrive, and the tier is the answer to
"why did it come, and how much of it came".

| Tier | When | What arrives |
|---|---|---|
| **pinned** | every session start | the item **in full** |
| **index** | every session start | id and title only |
| **jit** | the first time a touched file matches the item's scope | the item **in full** |
| **restored** | after a compaction | in full, for items this session had already seen |

There is a fifth budget, `continuity`, which is not a tier of its own but a
ceiling on the handover text a session may be given after a compaction.

Rationale-tier items appear in none of the four. In the session index they are
reduced to a bare count — `2 lesson · 1 reference · 1 todo` — with no ids and no
content.

### The restored tier, which is easy to misunderstand

When Claude compacts, `PreCompact` writes a manifest of every item id the
session touched:

```json
{
  "sessionId": "9e5b6b17-…",
  "capturedAt": "2026-08-17T14:47:02.709Z",
  "itemIds": [
    "CONST-evidence-must-cite-a-captured-record-id",
    "CONST-live-pass-probe-of-the-agent-normative-trust-boundary",
    "LESSON-agent-created-items-must-land-as-drafts-not-active",
    "REF-campaign-handover-read-this-before-acting-on-any-finding",
    "RULE-harness-cases-must-reach-the-behaviour-they-name"
  ]
}
```

**That manifest is deliberately permissive.** It lists every id — including a
draft and a rationale item. It makes no trust decision, and it stores ids only,
never text.

The gate runs on the *other* side. When `SessionStart` fires with
`source: compact`, it re-applies the **current** policy and, from the five
above, restored exactly one in full: the active normative `RULE`. The draft and
the rationale item came back as `1 lesson · 1 drafts pending review`.

This ordering is the useful part: **the policy in force when context is rebuilt
wins, not the policy frozen when it was captured.** Retier a category or reject
a draft between the two events and the change is honoured.

### The verdict, and where it comes from

Whether one item is injected is decided by a single gate ladder, and the answer
carries a *code* for the first gate the item failed rather than only a sentence.
Three of those codes are properties of the item alone — it is not eligible, its
category is on the wrong tier, or its scope excludes the file — and those three
are the ones any surface can answer without a session, a focus or a budget in
hand. The rest need the event.

That is why the CLI has no `mycontext injection` verb: the verdict is not a
command, it is a field that travels with an item wherever an item is shown.

## From the CLI

There is no injection command. What the terminal gives you is the verdict
attached to the reads you already run:

```bash
mycontext show <id>              # the item, with what its tier and scope mean for it
mycontext status                 # how many normative items carry no scope, and what that costs
mycontext decay                  # which items have not been injected lately
mycontext audit --items --role injected   # which items actually reach sessions
```

`--role` is the one flag that only means something with `--items`: it selects
whether to count an item as the record's `subject`, as `injected`, or as
`spilled`. Passing it without `--items` is refused rather than ignored.

To make a session start with an item in full, `mycontext pin <id> --yes` asks
for the pinned tier; `mycontext carry <id>` is the one-shot version that spends
itself on the next injection instead.

**From an agent**, `load_context` answers what would be injected now.

**What the CLI can do here that the UI cannot.** Change what arrives — `pin`,
`unpin` and `carry`. And read the ledger's own arithmetic through
`audit --items --role`, which the browser summarises but does not expose flag
for flag.

## From the UI

The **Injected now** screen (`nav.inj`) is this feature's screen. It draws live
state for a selected session, in three columns — item, tier, when — each read
straight off that session's own seen-file.

Two things about it are load-bearing:

- **Its source is the seen file, not the ledger.** The ledger's copy is a
  replayed projection nothing on this screen updates, and it would show a
  different number. The screen says so twice, in its own subtitle and again in
  its note.
- **No join invents a column.** There is no fourth cell holding a title fetched
  from somewhere else. What the endpoint read is what the screen draws.

**What the UI can do here that the CLI cannot.** Show one real session's
arrivals, in order, with the tier that carried each — the terminal can tell you
what would be injected, and the audit log can tell you what has been, but only
this screen shows one session's actual history as a session.

**What the UI cannot do here.** Pin, unpin or carry anything from this screen;
change a tier (that is the Configure screen); or show a session that has not
recorded anything yet.
