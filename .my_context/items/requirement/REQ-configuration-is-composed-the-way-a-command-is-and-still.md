---
id: REQ-configuration-is-composed-the-way-a-command-is-and-still
type: requirement
title: configuration is composed the way a command is, and still applied by the human
status: active
severity: hard
always: false
summary: Settings are picked from offered options with hints and examples rather than typed blind, and the person still applies the change themselves.
summary_of: 0df9e30477cbfda5
scope: []
tags:
  - v2
  - ui
  - "screen:config"
  - owner-requirement
  - builder
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 58bef181771f76f7
---

# configuration is composed the way a command is, and still applied by the human

OWNER REQUIREMENT, 2026-08-25, given in the config walkthrough: "the configuration entry should be treated exactly as ask or composer by letting the user selecting as much as possible, if free text there should exist an explanatory instructions about the value and also a default or recommended value as a placeholder before user enters it s input", together with "config should have separated sections (as it probably now but should be verified)".

VERIFIED, so the second half is already met: both the mockup and the app draw the same five sections -- Budgets, What changes, categories.lesson.scopePolicy, Apply this, Watched documents. Nothing to do there beyond keeping it true.

THE READING THIS IS WRITTEN AGAINST, stated so it can be corrected rather than assumed. The UI COMPOSES the change and the HUMAN APPLIES it. It does not write config.json. The mockup s Apply this card is explicit about why, and it is quoting the deny hook: "There is no command that edits a budget. Configuration is a file... changes to `.my_context/config.json` are the user s to make - ask, do not edit. So this is the edit, not a command." A composer that produced a patch and then applied it would break that, and `test/ui/no-writes.test.ts` besides. Composing is the ask; applying stays the user s.

WHAT IS MISSING TODAY, measured 2026-08-25: the config screen has ZERO inputs, ZERO selects and ZERO placeholders -- on BOTH sides. This is therefore not a gap between the app and the design of record. It is a NEW requirement that the mockup does not yet carry either, and the mockup will need it before the app can be 1:1 with it.

THE SAME DECLARATION SERVES THIS AND THE COMMAND BUILDERS, and it must not be invented a second time. REQ-every-command-the-ui-offers-is-built-checked-before-it-can already says it: a value that declares its legal set drives the select; one that declares a format hint and an example drives the placeholder and the help; and both drive the check. Configuration values have exactly that shape -- `scopePolicy` is a closed set of three, a budget is a positive integer with a shipped default, `watchedDocs` is a list of globs. The catalogue that describes them is the one already being built.

DONE WHEN: every configuration value the screen offers to change is SELECTED where its values are closed; every free-text value carries explanatory text about what it means and a placeholder showing the recommended or shipped default before anything is typed; an illegal value cannot be composed; and what the screen produces is the patch, which the user applies.

BUDGETS ARE SETTLED, 2026-08-25, and are NOT the free-text case above.

This requirement lists a budget as "a positive integer with a shipped default"
and therefore as free text needing an explanatory sentence and a placeholder.
That was written before the owner ruled on how a budget is chosen, and it is
superseded for budgets specifically:

  A budget is chosen on the SIMULATOR, with the slider that already exists
  there, and carried to config after a successful simulation. There is no
  budget text box on config, and no second slider.

The reason is in DEC-a-budget-is-chosen-by-simulating-it: two identical-looking
sliders meaning different things is how somebody comes to believe they changed
their config when they did not.

The rest of this requirement stands unchanged. scopePolicy is still a select,
watchedDocs is still free text and still needs its explanatory sentence -- its
replace-never-merge rule is exactly what that text exists to say before someone
loses a list -- and what the screen produces is still the patch.
