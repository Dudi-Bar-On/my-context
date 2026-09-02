---
id: CONST-a-correction-records-the-class-of-error-not-only-the
type: constraint
title: A correction records the class of error, not only the instance
status: active
severity: soft
always: false
summary: When recording a mistake, name the general kind of mistake it is and not only the single instance, or the same fault reappears one step over.
summary_of: c3fc2530a4840583
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-18
valid_until: null
checksum: 58b1bdf1550214a7
---

# A correction records the class of error, not only the instance

Every row in a corrections log (a spec's section 0, a plan's section 0) names the general failure it is an instance of, in a dedicated Class column.

Recording only the instance is how a corrected defect recurred one parameter over: the web-UI spec's third pass corrected /api/select for omitting seen, and the endpoint went on to omit focus. A reader who had read section 0 attentively still would not have caught it, because the row said what was missing rather than what the rule was.
