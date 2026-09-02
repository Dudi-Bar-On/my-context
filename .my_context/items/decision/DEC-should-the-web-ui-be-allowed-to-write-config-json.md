---
id: DEC-should-the-web-ui-be-allowed-to-write-config-json
type: decision
title: should the web UI be allowed to write config.json
status: active
severity: soft
always: false
summary: Whether the web pages may change your settings file is still open; for now they only compose the change and you apply it yourself.
summary_of: 0b871f52c52e53f9
scope: []
tags:
  - v2
  - ui
  - config
  - open-question
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: 4d109d2271967c1b
---

# should the web UI be allowed to write config.json

OPEN QUESTION raised 2026-08-23. The owner asked whether storing configuration as binary rows in SQLite would make it safe for the UI to perform writes. The encoding argument does not hold - what makes a write safe is who can reach the endpoint and what it can change, never the byte format - but the underlying question is legitimate and is filed here rather than answered as a side effect of building a wizard.

WHAT SAYS NO TODAY, and it is a rule this product enforces against its own agent: the deny hook states that changes to .my_context/config.json are the user's to make. `read-model-config.ts` names that as the reason it previews rather than writes, and `test/ui/no-writes.test.ts` holds the whole import graph to it - the UI surface has exactly two ruled-in writes, both outside any request path.

WHAT WOULD HAVE TO BE DECIDED, not assumed: who is authorised, given that the loopback gate authenticates a BROWSER and not a person; what the audit record looks like, since config.json is not an item and the audit log is item-shaped; and what happens to the property that config.json is human-readable, diffable and reviewable in a pull request, which is also what REQ-every-category-declares-what-may-be-updated-on-its-items-and depends on when it requires the declaration be authorable by a person.

DECIDED FOR NOW: the Configure wizard composes and the user pastes (plan:config seq 3 and 4). This item exists so the larger question is settled on its merits later, rather than arriving as a consequence.
