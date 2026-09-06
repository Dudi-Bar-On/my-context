---
id: TASK-four-composer-fields-have-a-closed-domain-and-still-ask-you
type: task
title: four composer fields have a closed domain and still ask you to type it
status: active
severity: soft
always: false
summary: Four inputs on the command builder could offer the answers the product already knows, instead of a blank box.
summary_of: 3fdf0c779354c85d
scope:
  - src/ui/public/lib/palette-defs.js
  - src/ui/public/screens/palette.js
tags:
  - v2
  - ui
  - composer
  - "plan:builder"
  - "seq:9"
  - "state:done"
  - "priority:2"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 6b647b4a9764668f
plan: builder
seq: "9"
state: done
priority: "2"
verified_on: 2026-09-06
---

# four composer fields have a closed domain and still ask you to type it

Owner ruling 2026-09-06 (plan D10), from a survey of every Composer field driven in the browser.

MEASURED: 89 fields across 30 commands. 21 already carry a picker, 8 carry fixed options, and 60
are free text. Most of the 60 are correctly free - a title, a body, a summary and a reason are
prose, and there is nothing to enumerate. These four are not.

  tags       add, edit     218 free tags + 3 projected prefixes. /api/tags ALREADY serves them
                           split into the two kinds, built for exactly this, and read today only
                           by the focus dialog.
  status     search        five values, closed: active, draft, deprecated, validated, superseded.
  relation   search        eighteen, and RELATION_TYPES is declared closed in vocabulary.ts.
  topic      help          seven, and HELP_TOPICS is the whole list.

These four were chosen ahead of the other three candidates on one property: every domain is small
or already split for display, so none of them needs the picker primitive to change first. The
others - finding, key and pack - are D11, and are held behind a ruling about large lists.

WHAT MUST NOT HAPPEN. `tags` accepts a COMMA-SEPARATED LIST and the composed line must stay inside
quoteArg’s safe set - the focus dialog already joins with `,` and no space for exactly that reason.
A picker that emits one value where the flag takes many is a regression, not a convenience.

AND THE VALUES ARE DERIVED, NEVER TYPED HERE. A closed list spelled into the screen is the drift
this project measures in days: the catalogue said "38 commands" and was right on 2026-08-24. Read
the vocabulary and the endpoint at runtime, so the list moves when the product does.

The five-value status vocabulary is worth one check: confirm it against the loader rather than
this item, because `superseded` is reachable and is not in the `--status` flag’s own four.
