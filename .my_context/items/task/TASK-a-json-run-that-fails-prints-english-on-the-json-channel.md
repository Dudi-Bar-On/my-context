---
id: TASK-a-json-run-that-fails-prints-english-on-the-json-channel
type: task
title: a --json run that fails prints English on the JSON channel
status: active
severity: soft
always: false
summary: Asking for machine-readable output and then failing gives a script a sentence it cannot parse, with the real reason inside the text that broke it.
summary_of: 4a15542dc66481ed
scope:
  - src/cli/**
tags:
  - v2
  - cli
  - "plan:rulings"
  - "seq:72"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 02e86b2b8b2d9bd5
plan: rulings
seq: "72"
state: done
priority: "2"
---

# a --json run that fails prints English on the JSON channel

> FOUND by the store/CLI/MCP/gates review and VERIFIED BY HAND 2026-09-13 - and the verification changed what the defect is.
>
> THE REVIEW SAID a failing command can emit nothing on stdout, so a script consuming `--json` gets an empty parse rather than a reason. MEASURED:
>
>     $ mycontext show NO-SUCH-ITEM --json
>     my_context: no item with id "NO-SUCH-ITEM".
>     stdout: 44 bytes   exit: 1
>
> IT IS NOT EMPTY. IT IS PLAIN ENGLISH PROSE ON THE JSON CHANNEL. That is worse than nothing: a consumer that checks for empty output is fine, and a consumer that parses what it was promised gets a `SyntaxError` at character 0 naming `my_context` - an error message about the parser, pointing at the product's own name, with the real reason sitting in the string it failed to read.
>
> WHAT THIS ASKS FOR. When `--json` is given, EVERY exit path emits JSON, including the failing ones: an `{"error": ...}` envelope carrying the same sentence the human form prints, plus whatever the command already knows - the id it could not find, the flag it refused, the gate that stopped it. The human form is unchanged.
>
> THREE THINGS TO SETTLE RATHER THAN ASSUME:
>   - WHICH STREAM. A `--json` consumer reads stdout; a human reads stderr. Today the refusal goes to stdout. Decide deliberately and say why.
>   - THE EXIT CODE STAYS. This is about the channel being honest, not about making a failure look like a success.
>   - EVERY COMMAND, OR THE ONES THAT TAKE `--json`? The second, and the gate should be able to tell them apart mechanically rather than by a hand-kept list - which is this project's own D51 pattern and the shape it keeps getting bitten by.
>
> AND A REMOVAL PROOF PER COMMAND FAMILY, not one. The refusal paths differ: a bad id, a bad flag, a gate refusal and an absent corpus are four different code paths and a test that proves one proves one.
