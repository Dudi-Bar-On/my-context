---
id: a-fixture-must-not-be-what-makes-a-proof-pass
kind: standard
tier: developer
title: a proof's power must come from its subject, never from how its fixture happens to be arranged
trigger: writing a removal proof, or reading one somebody else wrote
shape: after the mutation reddens the assertion, ask of the fixture — would this still fail if the thing under test were wrong, but the fixture were arranged differently? Change one incidental property of the fixture (a position, a count, a boundary) and re-run. If the assertion goes green, the FIXTURE was carrying the proof
example: "on 2026-09-13 a Hebrew seam proof was shifted ONE BYTE, so the 1 MiB boundary fell between two characters instead of inside one, and all three assertions passed on broken code — the proof's power lived entirely in the byte placement, not in the text being Hebrew"
check: "none - a fixture's incidental properties are not distinguishable from its essential ones by any scan. The nearest enforcement is that the proof was TAKEN at all: RULE-a-regression-test-is-worth-nothing-until-you-have-watched-it and `def-prove-by-removal`."
request: do we have more lessons we learned today and yesterday that worth putting in the store as part of the product ?
---

**Eight lanes hit this in one week, and every one had already taken a correct removal proof.**
That is what makes it worth an entry of its own: `def-prove-by-removal` catches an assertion
that cannot fail; **this catches an assertion that can only fail for the wrong reason.**

The four measured instances, because the shape is easier to recognise than to define:

- **One byte.** A UTF-8 seam proof whose boundary fell *inside* a two-byte character. Moved one
  byte left, it fell *between* two characters and every assertion passed on broken code. The
  fixture now asserts its own boundary is a continuation byte **before** it asserts anything else.
- **One lane.** A test proving that a query scopes to a lane had a fixture holding exactly **one**
  lane — so the scope filter could be deleted and the single row still came back. A second lane
  was added.
- **A bound never crossed.** Two assertions about a 60-item cap ran against a fixture holding
  seven, so counting before and after the bound gave the same answer either way. The fixture now
  holds 65.
- **A byte no probe returns.** An anchor-ownership guard was proved at byte 0, a turn no probe
  ever returns, so the whole guard could be deleted with the test still green.

The tell is always the same: **the fixture is the smallest thing that makes the test pass**, and
smallest is not the same as representative. A one-lane fixture, a seven-item list, a zero offset
and an even byte boundary are all the natural first thing to write.

The remedy is one extra question, asked once per proof, and it costs a minute: *what about this
fixture is incidental, and what happens if I change it?* Where the answer matters, **the fixture
guards itself** — the seam proof now fails loudly if its own boundary stops splitting a character,
which is the shape to copy.
