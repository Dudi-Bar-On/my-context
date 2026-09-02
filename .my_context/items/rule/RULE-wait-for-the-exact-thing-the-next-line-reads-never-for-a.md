---
id: RULE-wait-for-the-exact-thing-the-next-line-reads-never-for-a
type: rule
title: Wait for the exact thing the next line reads, never for a proxy of it
status: active
severity: hard
always: false
summary: Wait for the exact thing you are about to use, not for something that usually arrives with it; the stand-in can turn up while the thing itself is missing.
summary_of: e9495aaebfbb527b
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 94ed3e0ae0dcb46d
directive: do
---

# Wait for the exact thing the next line reads, never for a proxy of it

A barrier that waits for a related signal — the page rendered, a count arrived, an element became visible — does not establish that the specific value the following line consumes exists yet. Asynchronous work assigns things in an order nobody promised, and a proxy can complete while the thing under test has not.

The failure is not merely a flake: it surfaces as an error about the thing that was missing, which is usually something the test does not assert, so the message sends the reader somewhere unrelated.

Where the exact thing cannot be waited on directly, that is a finding about the code under test, not a licence to wait for something else.

## Relations
- derived_from [[LESSON-every-bound-on-waiting-must-fail-as-itself-or-a-slow-machine]]
