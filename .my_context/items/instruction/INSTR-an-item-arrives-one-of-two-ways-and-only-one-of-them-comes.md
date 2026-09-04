---
id: INSTR-an-item-arrives-one-of-two-ways-and-only-one-of-them-comes
type: instruction
title: an item arrives one of two ways, and only one of them comes back on its own
status: active
severity: soft
always: false
summary: Pinned and normative items are re-delivered until present; every other item returns as an id and must be loaded again deliberately.
summary_of: f91ee9a3cde201fc
scope: []
tags:
  - v2
  - injection
  - agent-behaviour
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: f6bdba12730f68d8
---

# an item arrives one of two ways, and only one of them comes back on its own

Owner ruling 2026-09-04, stated as the behaviour the product guarantees and the behaviour an
agent must know. There are two distinguished cases and confusing them is what makes an agent
believe it holds something it does not.

CASE ONE, an item that is pinned or normative. The injection delivers it. After a new session or
a compaction the injection checks whether it is in the context and, if it is not, delivers it
again. Presence is the product’s responsibility here, not the reader’s, and this is what makes
a rule something that can be relied on rather than something that was once mentioned.

CASE TWO, every other item. Its id may be in the context; its body is not. The body arrives only
when something loads it deliberately - a person, an agent, an MCP tool, the CLI, or a slash
command. Once loaded it stays for certain until a compaction or a new session.

What happens at a compaction is the part that must be understood or the two cases blur. A
snapshot is taken beforehand, and an item that appears in it comes back afterwards AS AN ID
ONLY. Nothing reloads the body on anybody’s behalf. Whoever needs it again issues the load
again. The id returning is a reminder that this item mattered, never evidence that its text is
present.

The failure this prevents is precise and has already happened here. An agent that sees an id and
assumes the body is present acts on a title, which is the same failure as a rule delivered as an
index line: every count says it arrived, and nothing that governs actually reached the agent.

Where this must be written. The owner asked for it to live where an agent always reads - the
project instructions or a skill - and not only in the corpus, because an agent that has not been
told this rule cannot follow it, and the rule is precisely about what an agent may assume it
holds. It belongs in both: here so it governs, and there so it is always in hand.

This bounds the verification work recorded separately for the seen gate. For case one an item is
checked and re-delivered rather than assumed. For case two an id returning without a body is
correct behaviour and not a defect, so nothing should try to repair it by re-injecting bodies
nobody asked for.
