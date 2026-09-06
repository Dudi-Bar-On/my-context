---
id: TASK-a-long-picker-becomes-a-filtering-box-and-the-id-field-stops
type: task
title: a long picker becomes a filtering box, and the id field stops constraining the value
status: active
severity: soft
always: false
summary: Long lists are typed into and filtered rather than scrolled, at the cost that a name with no match can still be composed.
summary_of: 368815e3c23c131c
scope:
  - src/ui/public/lib/palette-defs.js
  - src/ui/public/screens/palette.js
tags:
  - v2
  - ui
  - composer
  - "plan:builder"
  - "seq:16"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: dc0a0b13f7e96491
plan: builder
seq: "16"
state: todo
priority: "2"
---

# a long picker becomes a filtering box, and the id field stops constraining the value

Owner ruling 2026-09-06 (plan D11, the long-domain question held since the morning).

CHOSEN: native input+datalist, the shape the D11 lane already built for the finding and pack
fields. It filters as you type, is in the tab order for free, its popup is UA chrome so it follows
dir=rtl without a rule of ours, costs zero bytes and zero ARIA of our authorship, and has no
min-content floor - so it cannot reproduce the 3,902px overflow a 942-option select caused.

REJECTED, and the reasons are measured rather than aesthetic. A hand-written combobox owes 200-300
lines of combobox/listbox roles, aria-activedescendant, arrow/Home/End/PageUp/PageDown, type-ahead,
Escape, click-outside, RTL popup placement and virtualisation - held only by Playwright, since the
node suite does not test DOM. And Web Awesome was eliminated on CAPABILITY, not cost: 3.12.0 ships
seventy components and NONE is a combobox; wa-select carries no search string and its keyboard is
typeToSelect, the same single-key type-ahead a native select already has. 69 KB and twenty pinned
files would have bought no search at all.

THE COST IS REAL AND WAS TAKEN KNOWINGLY: a datalist SUGGESTS, it does not CONSTRAIN. Today the id
picker can only name an item that exists; after this a typo composes a line naming nothing. That is
acceptable because the Composer composes a command a person then runs, and the command itself
refuses an id that does not exist - the refusal MOVES from the control to the CLI rather than
disappearing. It must not be allowed to disappear: whatever lands should prove in a test that the
refusal still happens, rather than assuming it.

SCOPE: the id picker specifically - 951 options today, rebuilt on every command switch, and nine
commands take an id. pickerOptions() already returns a plain array, so this is the drop-in the
architecture review established rather than a redesign.
