---
id: TASK-ui-enabled-is-accepted-strictly-validated-and-read-by
type: task
title: ui.enabled is accepted, strictly validated, and read by nothing
status: active
severity: soft
always: false
summary: A setting saying whether the web view is allowed is checked carefully and then ignored, so turning it off does nothing at all.
summary_of: bfcadaba728c77bd
scope: []
tags:
  - "plan:rulings"
  - "seq:42"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 609cd1cd5a76721e
plan: rulings
seq: "42"
state: done
priority: "1"
---

# ui.enabled is accepted, strictly validated, and read by nothing

Found by the changelog agent, verified live rather than inferred: writing {"ui":{"enabled":false}} into config.json and running mycontext ui --no-open starts the server and prints a URL.

So the key parses, is strictly validated, is documented, and no code reads it. A user who sets it to false gets a UI anyway, and nothing says the setting was ignored - which is the shape of silence this project exists to prevent, in the surface it exists to configure.

Two ways out: honour it in the ui command, or remove the key. Honouring it is the smaller change and the one a reader would expect from a key called enabled.

Also recorded by the same agent, and worth keeping beside it: mycontext export's README claim that it never writes inside .my_context/ has no code behind it. What is actually enforced is the emptiness and no-overwrite rule. The changelog entry claims only what is enforced.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, priority 1, and it is a real shipped defect verified live rather than inferred: writing {"ui":{"enabled":false}} into config.json and running `mycontext ui --no-open` starts the server and prints a URL.

IT IS THE SAME SHAPE AS TWO OTHER FINDINGS THIS RECONCILIATION MADE, and together they are a class worth naming: the product ACCEPTS AND VALIDATES a setting it then ignores. Beside it now sit the status strip announcing the bridge is not installed without asking, and the Tutorials screen asserting twelve checkmarks about content nobody checks. In all three the product states something with confidence and has not looked.

IT ALSO HAS A SIBLING IN THIS PLAN: seq:20 is the ui slash command and the CLI command behind it, which WRITE config.json -- including, presumably, this key. Settling what reads ui.enabled before building the thing that writes it is the cheaper order.
