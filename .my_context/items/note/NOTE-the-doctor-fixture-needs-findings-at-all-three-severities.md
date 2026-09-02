---
id: NOTE-the-doctor-fixture-needs-findings-at-all-three-severities
type: note
title: the doctor fixture needs findings at all three severities
status: active
severity: soft
always: false
summary: The sample data raises only one health finding, so a screen built to show three levels of seriousness cannot be compared against its design.
summary_of: ce963464133b5b51
scope: []
tags:
  - v2
  - ui
  - fixture
  - "screen:doctor"
  - tree-parity
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: ed501cab26ba6c3e
---

# the doctor fixture needs findings at all three severities

For plan:port seq:94, from the doctor walkthrough of 2026-08-25.

The demo corpus produces exactly ONE doctor finding. The mockup s scene has five: one error, two warnings, two notices. Eight of doctor s tree-parity findings are that difference and the index misalignment it causes.

It also meant three real divergences were invisible until someone read the engine beside the design: `source_drift` drawn as an error and emitted as a warning, a repair command (`init --rewrite-watched`) that does not exist, and a check (`foreign_store`) that does not exist. None of them could be seen on a screen with one row.

WHAT 94 NEEDS HERE: a corpus that produces findings at all three levels, ideally the mockup s own five, so the three cards are populated and the comparison is about shape rather than about emptiness.
