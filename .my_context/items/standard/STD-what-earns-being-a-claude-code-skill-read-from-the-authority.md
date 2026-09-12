---
id: STD-what-earns-being-a-claude-code-skill-read-from-the-authority
type: standard
title: what earns being a Claude Code skill, read from the authority
status: active
severity: soft
always: false
summary: The documented contract a skill must meet, established from Claude Code's own documentation rather than from the skills already written here.
summary_of: c08094ddbae536e2
scope: []
tags:
  - v2
  - review
  - skills
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-11
valid_until: null
checksum: 35fbeb3017a89b9e
---

# what earns being a Claude Code skill, read from the authority

Established for plan:review seq:3, 2026-09-12, by reading Claude Code's own documentation rather
than this repository's 39 skills. The item's framing is the reason the method matters: auditing 39
skills against a contract derived from those same 39 skills would measure consistency and call it
correctness. Nothing in skills/** was read or edited to produce this.

WHAT WAS READ, AND WHEN. code.claude.com/docs/en/skills.md, /plugins.md, /best-practices.md and
/commands.md, all fetched 2026-09-12. THE VERSION IS NOT RECORDABLE AS THE ITEM ASKED: the
documentation states no version of its own. The highest version referenced anywhere in it is
v2.1.265, and that is a mention inside a feature note, not a statement that the page describes that
build. So the honest record is the fetch date, and a re-read is owed whenever a skill audit turns on
a detail below.

THE CONTRACT, as criteria a single skill either meets or does not.

ONE, IT HAS A REASON TO BE LOADED CONDITIONALLY. A skill is a reusable prompt whose body is loaded
only when it fires. Content that must be true every session is CLAUDE.md's, not a skill's. Content
that needs an isolated context window is a subagent's, or a skill declaring context: fork.

TWO, THE DESCRIPTION IS THE SELECTION SIGNAL AND IS WRITTEN AS ONE. Descriptions are held in context
on every turn and matched against the conversation; the body is not. A description is specific and
carries the phrases a user would actually say. The documentation's own contrast is a vague "Git
helper skill" against "Summarizes uncommitted changes. Use when the user asks what changed, wants a
commit message, or asks to review their diff". A skill whose description would not make it fire is
defective however good its body is.

THREE, DESCRIPTION PLUS when_to_use FITS 1,536 CHARACTERS. That is the documented cap on the pair,
and it is a context-efficiency bound rather than a style preference. A description absent entirely
falls back to the first non-empty markdown line, which is a fallback and not a design.

FOUR, SKILL.md STAYS UNDER 500 LINES AND NAVIGATES RATHER THAN CONTAINS. Supporting files stay on
disk until read, so reference material costs almost nothing until needed. A long SKILL.md spends
context on every invocation for material most invocations do not use.

FIVE, IT IS A REUSABLE WORKFLOW AND NOT A ONE-TIME INSTRUCTION. A sequence performed once is not a
skill; the documentation names this as an anti-pattern directly.

SIX, ITS FRONTMATTER USES ONLY THE DOCUMENTED FIELDS AND MEANS THEM. The supported set is name,
description, when_to_use, disable-model-invocation, user-invocable, allowed-tools, disallowed-tools,
context, paths, arguments and metadata. name is optional and defaults to the directory name.
disable-model-invocation true makes a skill user-only; user-invocable false makes it model-only;
paths limits activation to matching files; allowed-tools pre-approves, disallowed-tools removes.

SEVEN, ITS INVOCATION NAME IS THE ONE ITS LOCATION GIVES IT. A standalone skill is /name, a plugin
skill is /plugin:name, and a nested-path skill is /path:name. A skill whose documentation elsewhere
names it differently is telling a reader something untrue.

EIGHT, IT DOES NOT DUPLICATE ANOTHER SURFACE. A skill is distinguished from CLAUDE.md by conditional
loading, from a subagent by sharing the conversation's context unless it declares context: fork, and
from a built-in command by not being fixed behaviour.

WHAT THE AUTHORITY DOES NOT SETTLE, recorded so an audit does not invent a rule and then enforce it.
The documentation does not say what happens when SKILL.md exceeds 500 lines, so that is guidance and
not a gate. It states no character-set or naming constraints on frontmatter fields, and no per-field
length limits beyond the 1,536 pair. It gives NO RULE for when one skill should be two or two should
be one, which is precisely the question seq:4 was filed to rule on, so seq:4 must rule it rather than
cite it. It does not say whether a model may pass arguments when it auto-invokes. And it does not
define a slash command as a surface distinct from a skill at all: it uses the same slash syntax for
both, so any audit finding that rests on that distinction rests on nothing the authority says.

HOW seq:4 SHOULD USE THIS. Criteria one through eight are gates a skill passes or fails. The
paragraph above is not: an audit that scores a skill against an unsettled point is doing what this
item exists to prevent, one level up.
