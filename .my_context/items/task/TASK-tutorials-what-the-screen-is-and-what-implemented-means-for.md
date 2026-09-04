---
id: TASK-tutorials-what-the-screen-is-and-what-implemented-means-for
type: task
title: "Tutorials: what the screen is, and what implemented means for it"
status: active
severity: soft
always: false
summary: The screen listing six guides named for the job they help you do, which currently reads nothing and asserts its contents from fixed text.
summary_of: c117f87af5e76af1
scope: []
tags:
  - v2
  - ui
  - mockup
  - "plan:walk"
  - "seq:131"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-02
valid_until: null
checksum: c7a74fead33e45f6
plan: walk
seq: "131"
state: todo
priority: "2"
source: "plan:walk seq:27, from the module header of screens/tut.js on 2026-09-02"
---

# Tutorials: what the screen is, and what implemented means for it

WHAT THE SCREEN IS, so it can be built without opening the mockup. nav.read -- Tutorials, section data-p="tut". Six tutorials, each titled with a JOB rather than a feature, and two columns saying which of them is written in which language. IT READS NO ENDPOINT, and that is a measurement rather than an omission: the help route serves four topics, the help command itself knows seven, and not one of either list is a tutorial; every read route in the server was walked and none serves a tutorial file from the repository, so the two tutorials that exist on disk are unreachable from the browser and a request for one comes back as the refusal that names what IS served.

IT IS THE ONE SCREEN WITH NO PLAN BEHIND IT, and that changes how it was built. Its own task records that it is covered by nothing and that whether that is scope or an omission is the owner's call, so there is no plan sketch to reconcile with the design and the design is its only specification. Twelve hard-coded cells assert checkmarks about content nobody checks, one of them true of no file on disk.

WHAT IMPLEMENTED MEANS: the six job-titled rows and their two language columns drawn from something a gate can check rather than from twelve literals -- which needs either a route that serves tutorial files or a ruling that this screen is a static index; and the owner's answer to whether tutorials are in scope at all, which is the prior question and is held at plan:port seq:5d.

Filed under plan:walk seq:27, condition 3.
