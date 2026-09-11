---
id: def-a-door
kind: definition
tier: developer
title: a door is a hook where a context window begins, and it carries an obligation to deliver
term: a door
means: "a hook at which an agent’s context window BEGINS or is rebuilt, and therefore a place the product rule store must be delivered: session start — new, resumed and compact-restore — `PreCompact`, and subagent start. Every door records that it delivered, under the key the delivery is later asserted against."
confusedWith: "every hook. `PreToolUse` is not a door: it is the earliest hook that runs AFTER every door, which is what makes it the place to assert that some door fired. A hook running inside an already-established context window carries no obligation to deliver."
example: 1,082 subagent-starts against 54 session-starts in 36,024 records — so a design guarding only session start guards the rarest event, and the door that carries the weight is the one nobody names first.
check: "preventive:test/rules/delivery.test.ts carries one test per door, each named for its door, so removing a door reddens exactly that door’s test rather than a shared one."
---

The word exists because "inject at session start" was the instinct and the measurement corrected
it. Nothing can inspect a model’s context window, so what is verifiable is that we injected at
every door and none was missed — a count rather than a promise.

A door is therefore a place with an obligation, not merely a place where an event happens.
