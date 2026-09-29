---
id: DEC-the-browser-suite-runs-headless-by-default-a-person-who
type: decision
title: the browser suite runs headless by default; a person who wants to watch opts in
status: active
severity: soft
always: false
summary: The automated browser tests no longer open visible windows on the machine unless someone asks to watch, because the tests themselves are now the evidence and the windows only cost time and focus.
summary_of: da9cdf90ec834edd
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-22
valid_until: null
checksum: 0b0a22908ccbd6ce
---

# the browser suite runs headless by default; a person who wants to watch opts in

Owner ruling, 2026-09-22, during release phase 3, reversing the ruling of 2026-08-22 ("when you use playwright do not use it headless, i want to see the debug and test activities you make", recorded in e2e/playwright.config.ts). The 2026-08-22 ruling answered a real risk - an agent reporting green numbers over a page nobody had looked at - and the answer then was to make the run watchable. Today the suite is the evidence (the gate, its two-phase retry, the recorded baseline), CI has always run it headless, and headed local runs steal focus and run slower. From now on e2e/playwright.config.ts runs headless unless MYCONTEXT_E2E_HEADED is set; CI is unchanged. Landed with task 3.9 of release/3.
