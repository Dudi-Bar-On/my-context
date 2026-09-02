---
id: RULE-look-for-a-skill-before-acting-and-read-it-before-deciding
type: rule
title: Look for a skill before acting, and read it before deciding it does not apply
status: active
severity: hard
always: true
summary: Check whether a ready-made procedure already covers what you are about to do, and read it before deciding that it does not apply.
summary_of: c12b568b8b9f1f66
scope: []
tags:
  - process
  - skills
  - tooling
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: fca36ee4f5dd62f3
---

# Look for a skill before acting, and read it before deciding it does not apply

**Before acting, look for a skill that already covers the act.**

A large set of skills is installed on this machine, and they encode workflows
that have been thought through more carefully than an improvised approach will
be. Reaching for one is not overhead; skipping one is how the same mistake gets
made a fourth time.

**Check first, not after.** The check comes before exploring the codebase,
before clarifying questions, and before the first tool call — because a skill
usually tells you *how* to explore and *what* to ask. Deciding you already know
the shape of the work is exactly the moment the check is worth most.

**The superpowers set, and what each is for:**

- `superpowers:brainstorming` — before any creative work: a feature, a component,
  a behaviour change. Explores intent and requirements before implementation.
- `superpowers:writing-plans` — a spec exists and multi-step work follows.
- `superpowers:executing-plans` / `superpowers:subagent-driven-development` —
  running a written plan, in a parallel session or this one.
- `superpowers:dispatching-parallel-agents` — two or more independent tasks with
  no shared state.
- `superpowers:systematic-debugging` — **any** bug, test failure or unexpected
  behaviour, before proposing a fix.
- `superpowers:test-driven-development` — before writing implementation code.
- `superpowers:verification-before-completion` — before claiming something works.
- `superpowers:requesting-code-review` / `receiving-code-review`.
- `superpowers:using-git-worktrees` — isolation before feature work.
- `superpowers:finishing-a-development-branch` — integration decisions.

**Process skills come first when several apply.** They set the approach;
implementation skills then carry it out. "Let us build X" is brainstorming, then
the implementation skill. "Fix this bug" is systematic-debugging, then the
domain skill.

**The honest limit.** A skill that turns out to be wrong for the situation is
abandoned, and that judgement is yours to make — after reading it, not instead
of reading it. And the user's own instructions outrank any skill: where they
conflict, the user wins and the conflict is worth saying aloud.
