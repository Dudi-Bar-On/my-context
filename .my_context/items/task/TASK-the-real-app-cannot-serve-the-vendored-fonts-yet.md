---
id: TASK-the-real-app-cannot-serve-the-vendored-fonts-yet
type: task
title: the real app cannot serve the vendored fonts yet
status: active
severity: soft
always: false
summary: The fonts, colours and icons all exist and none of them reach a browser, because the server will not hand out font files.
summary_of: 10c897375c011ce2
scope: []
tags:
  - "plan:repaint"
  - "seq:2w"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 4c940f5e603d1f12
plan: repaint
seq: 2w
state: done
priority: "1"
---

# the real app cannot serve the vendored fonts yet

Task 2 vendored nine .woff2 files into src/ui/public/fonts/ and they load in the mockup, which is opened over file://. The running application cannot serve them: src/ui/static.ts's extension allow-list is {.html,.js,.css} and .woff2 is not in it.

Also still true: src/ui/public/styles.css is the 99-byte placeholder, and src/ui/public/index.html is the empty shell whose own comment says the content is ui1 task 16's.

So the fonts, the tokens and the icons all exist and none of them reach a browser through the product. The first task that renders a real screen has to wire all three - the allow-list, the stylesheet and the shell - or it will render unstyled and the cause will look like the stylesheet rather than the door.

The allow-list is a security surface: widen it by extension with a content type, not by removing the check.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: DONE. All three things it named were wired, by ui1 Task 16, and it says so in its own words:

  `src/ui/static.ts` · ``.woff2` was added by Task 16, for the nine vendored faces`` · ~94 -- `.woff2: font/woff2` is IN the allow-list, and the file s docblock records "`.woff2` was added by Task 16, for the nine vendored faces". Added BY EXTENSION WITH A CONTENT TYPE, not by removing the check -- which is exactly the security constraint this task ended on.
  src/ui/public/styles.css is 63,411 bytes, not the 99-byte placeholder.
  src/ui/public/index.html is 9,091 bytes, not the empty shell.

The prediction in this task s last paragraph -- "the first task that renders a real screen has to wire all three, or it will render unstyled and the cause will look like the stylesheet rather than the door" -- was correct and was heeded. That is the value it delivered, and it is why it should be closed rather than left looking like an open blocker on every screen in the product.
