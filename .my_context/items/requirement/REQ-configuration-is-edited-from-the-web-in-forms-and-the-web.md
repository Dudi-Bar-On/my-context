---
id: REQ-configuration-is-edited-from-the-web-in-forms-and-the-web
type: requirement
title: configuration is edited from the web, in forms, and the web writes the config file
status: active
severity: soft
always: false
summary: Everything about the config is editable from the browser, including writing the file, with approval and a structured form rather than raw text.
summary_of: 87f435cfa84b5c78
scope:
  - src/ui/public/screens/**
  - src/core/config.ts
  - src/cli/commands/config.ts
tags:
  - v2
  - config
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 9c838bf3d1ff4d6b
---

# configuration is edited from the web, in forms, and the web writes the config file

Owner requirement, 2026-09-04, for later rather than now: he wants everything relating to the
config editable from the web including updating the config file itself, possibly behind a user
approval, and the editing structured by forms or something similar so that working with it is
more comfortable.

THIS CONTRADICTS A LOAD-BEARING RULE AND THE CONTRADICTION IS THE WHOLE OF THE WORK. The web UI
is read-only, and says so in its own navigation, whose third section is headed CHANGE, COMPOSED,
NEVER RUN. Every write surface today composes a command a person runs in a terminal; the doctor
settlement works this way, and so does the config writer shipped the same day this was asked for.
A browser that writes config.json is not an extension of that design, it is a reversal of it, and
whoever implements this must have the reversal ruled on rather than assume this requirement
settles it. His own words leave it open: maybe we will add a user approval before.

What the requirement asks for, taken apart. Every config subject reachable and editable from the
browser, not only the two category operations the writer covers today. A structured editor rather
than free text, because the config fails closed by name and a typo is a refusal rather than a
default. Approval before a write, in whatever form is decided. And the file itself updated, which
is the part that needs the ruling above.

Three things already exist and should be reused rather than rebuilt. The config writer already
copies the file aside before writing and prints where, so backup is solved. It already warns with
the real number of items a change would touch before the gate, so blast radius is solved. And the
approval boundary is derived by probing rather than declared, so a new write surface joins it by
behaving like one, not by being listed.

Read before designing: the existing composed-command pattern on the doctor screen, the config
writer command and its refusals, and the ruling that the app is what is built while the mockup is
history, which is what permits a screen the mockup never drew.
