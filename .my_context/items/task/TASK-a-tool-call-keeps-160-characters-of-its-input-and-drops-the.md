---
id: TASK-a-tool-call-keeps-160-characters-of-its-input-and-drops-the
type: task
title: a tool call keeps 160 characters of its input and drops the rest, so 92.8% of what was done is not in the archive
status: active
severity: soft
always: false
summary: Opening a step in a saved conversation shows what the tool was asked to do, not just a one-line label about it, so commands, written files and the questions you were asked are all there.
summary_of: 912af7792c12d9f7
scope:
  - src/ui/read-model-conversation-document.ts
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:24"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 95628e56a6d41deb
plan: archive
seq: "24"
state: done
priority: "1"
needs: archive/13
verified_on: 2026-09-10
---

# a tool call keeps 160 characters of its input and drops the rest, so 92.8% of what was done is not in the archive

Owner report 2026-09-08, pasting his own terminal output back at me: a `Write(...)` call with the
file it wrote, and a `Bash(...)` call with the command it ran, are BOTH absent from the session he
is reading in the browser. "this kind of text is ommited from the session i see in the browser ...
fix it. and if there are more alike fix them too."

AND THERE ARE MORE ALIKE. It is 92.8% of every tool call in the file.

THIS IS A CAPTURE DEFECT, NOT A RENDERING ONE, which is why the fold being openable would not have
fixed it. The content is not hidden in the read model - it was never put there.

`toolDetail` (`src/ui/read-model-conversation-document.ts` - `function toolDetail`) takes a tool
call’s whole input object and reduces it to ONE line of at most 160 characters, by walking
`DETAIL_FIELDS` and taking THE FIRST NAME PRESENT. Everything else in the input is dropped on the
floor. There is no second field, no full-input path, and `DocStep.text` does not rescue it -
that field carries a record’s TEXT blocks, and a tool call’s payload lives in `input`, not in a
text block.

MEASURED ON HIS OWN TRANSCRIPT, and the numbers are the argument:

    tool_use records                       3,261
    records losing input content           3,027   (92.8%)
    characters of input never captured 3,886,886

THE ORDERING IS WHAT DOES THE DAMAGE, because `description` is first in the table and
`description` is the one field that is ABOUT the call rather than being the call:

    Bash              2,343 calls   description wins   THE COMMAND THAT RAN is lost
    Agent               206 calls   description wins   THE ENTIRE LANE BRIEF is lost
    Write               139 calls   file_path wins     THE FILE CONTENT is lost
    AskUserQuestion      71 calls   NOTHING wins       every question and option is lost

EACH ROW IS ITS OWN LOSS AND THEY ARE NOT EQUALLY BAD:

  - BASH. `description` is prose written ABOUT the command by whoever called it. The command is
    the fact. A reader auditing what happened to their machine is shown a summary and not the
    act - and the summary is written by the same party whose actions are being audited.
  - AGENT is the worst of the four by information lost. 206 lane briefs, each hundreds of lines of
    reasoning and constraint, each reduced to a 3-to-5-word label. That is the most valuable prose
    in the session and the archive keeps none of it. It also makes plan:archive seq:15 - open a
    subagent from the turn that dispatched it - unable to show what the subagent was ASKED, even
    once seq:12 indexes what it answered.
  - ASKUSERQUESTION CAPTURES NOTHING AT ALL, and the reason is a type mismatch rather than an
    ordering one: `questions` is an ARRAY, and `toolDetail`’s fallback loop only accepts a string
    value, so it returns null. This is exactly the defect plan:archive seq:16 reports from the
    reading end - the owner cannot see the choices he was offered - and seq:16 cannot be built on
    top of a capture layer that holds none of them. THIS ITEM IS SEQ:16’S MISSING FOUNDATION.
  - WRITE and EDIT. The path without the content says a file changed and not how. For Edit, both
    old_string and new_string are the change; neither is captured.

WHAT TO BUILD, and the shape matters because `detail` itself is not wrong:

KEEP `detail` AS THE SKIMMABLE LINE. It exists for a measured reason - 2,123 of 3,014 tool calls
were Bash, and a fold reading "Bash" forty times is a fold nobody can skim. A fold summary must
stay one line. Do not fix this by making the fold verbose.

ADD THE FULL INPUT AS STEP CONTENT, behind the fold, where the tool RESULT already lives. The
reader opens a step and sees what was asked as well as what came back. Today they get half a
conversation.

AND FIX THE ORDERING WHILE YOU ARE THERE: for a tool that has both, the ACT outranks the prose
about the act. `command` before `description` for Bash; `prompt` before `description` for Agent.
A reader who wants the summary has `detail`; a reader who opens the step wants the thing itself.

THREE THINGS TO DECIDE RATHER THAN ASSUME:
  - NON-STRING INPUTS. AskUserQuestion’s `questions` is an array of objects; a browser_evaluate
    carries a function body; some inputs are numbers and booleans. A capture layer that only
    understands strings is how 71 records ended up with nothing. Decide how a structured input is
    served and drawn - and seq:16 has opinions about how a question and its options should LOOK,
    so co-ordinate rather than guess.
  - SIZE. 3.9 MB of input across 3,261 records is why this was cheap to drop. plan:archive seq:7
    removed the text caps after measuring that the largest said node was 41% of a cap that never
    fired - do the same measurement here rather than inheriting either answer. The largest single
    input in this file is worth knowing before deciding whether anything needs bounding.
  - SECRETS. A command line or a written file can contain a token. Nothing in this product
    redacts, and it has never had to, because it never captured them. Say plainly whether that
    changes with this item, because "the archive now keeps every command in full" is a sentence
    the owner should read before it is true rather than after.

AND THE COUNT MUST STILL BE HONEST. `sum(span) === records` is asserted so a fold cannot quietly
drop a record. Adding content to steps must not disturb that, and a step that carries a structured
input must still be exactly one step.

## Request

this kind of text is ommited from the session i see in the browser ● Write(C:\Users\UserC\AppData\Local\Temp\claude\D--Users-UserC-source-repos-my-context\595db3b1-a481-4553-b4c0-7248c31b2655\scratchpad\l21fix.mjs)
Wrote 71 lines to C:\Users\UserC\AppData\Local\Temp\claude\D--Users-UserC-source-repos-my-context\595db3b1-a481-4553-b4c0-7248c31b2655\scratchpad\l21fix.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const REPO = 'D:/Users/UserC/source/repos/my-context';
const ID = 'TASK-one-dead-stream-is-announced-on-every-screen-for-ever-and-a';
const F = REPO + '/.my_context/items/task/' + ID + '.md';
const a = fs.readFileSync(F, 'utf8').split(/^---$/m).slice(2).join('---').replace(/^\s*\n# [^\n]*\n/, '');
const cut = a.search(/\n## /);
const prose = (cut < 0 ? a : a.slice(0, cut)).trim();
const add = [
  '',
  'ROOT CAUSE FOUND 2026-09-08, AND IT IS NOT A DESIGN PROBLEM. The owner supplied the one fact that',
  'decided it - the drop happens "every few minutes" - and that frequency pointed at a cause rather',
  'than at a trade-off.',
  '',
  'THE STREAM WRITES NOTHING TO THE SOCKET WHEN THE AUDIT LOG IS QUIET. streamHandler',
  '(src/ui/watch-model.ts - function streamHandler) polls tail.poll() on a timer and sends a frame',
  'only when there is a resync or a record - it sends resync when the tail says so, then one frame',
  'per record, AND THERE IS NO ELSE BRANCH.',
  '',
  'Measured: no keep-alive, comment frame or heartbeat exists anywhere in that file. So through any',
  'quiet period the connection carries ZERO bytes, and a silent socket is what Windows, an antivirus',
  'shim or any intermediary reaps. "Every few minutes" is exactly that signature, and it also',
  'explains why every ordinary read keeps working: those are short requests that are never idle.',
  '',
  'SO THE FIX IS THE STANDARD ONE AND IT IS THREE BYTES A TICK: send an SSE comment line on ticks',
  'with nothing to report. A comment is ignored by every SSE consumer by specification - and by',
  'lib/sse.js, which must be CHECKED rather than assumed to skip it - so it proves the connection is',
  'alive without inventing a frame describeStreamEvent cannot name. That constraint is already',
  'recorded on this route: an unnameable frame "must not reach the feed as though it were audited',
  'history".',
  '',
  'AND THIS REVERSES MY OWN RECOMMENDATION, which is worth recording rather than quietly dropping. I',
  'proposed replacing the stream with a poll, on the reasoning that a poll recovers by construction.',
  'That reasoning is sound and the conclusion was still wrong: the stream is not inherently fragile,',
  'it was missing a keep-alive. Replacing a working subsystem to work around a three-byte omission',
  'would have cost the immediacy that is the entire point of an audit feed, and left the real defect',
  'in place for anything else that ever holds a connection open.',
  '',
  'THE STICKY FAULT IS STILL A DEFECT AND IS STILL FIXED, as defence in depth rather than as the',
  'cure - a genuine network drop can still happen, and one drop must not poison the page for its',
  'whole life. liveEnded is cleared when a subsequent read succeeds, and the chip then says the feed',
  'is NOT LIVE rather than that it just failed, because those are different claims and only the',
  'first is still true a minute later.',
  '',
  'WHAT IS NO LONGER PROPOSED, and the earlier text above is left standing because it was the honest',
  'reasoning at the time: no poll replaces this stream, no fallback path is built, and section 2 is',
  'not touched. Nothing silently reconnects, because nothing needs to - the connection stops dying.',
  '',
  'ONE THING TO MEASURE, NOT ASSUME: the keep-alive interval. STREAM_POLL_MS is the tail cadence and',
  'is not automatically the right heartbeat - too long and the reaper still wins, too short and it is',
  'noise on a socket that already exists. Find what is actually cutting it before picking the number,',
  'and if the interval has to be short enough to be suspicious, SAY SO, because that would mean the',
  'reaper is aggressive enough to deserve its own answer.',
].join('\n');
const args = ['edit', ID, '--body', prose + '\n' + add, '--summary-unchanged', '--yes'];
try {
  execFileSync('node', ['src/cli/index.ts', ...args], { cwd: REPO, encoding: 'utf8' });
  console.log('OK  live/21 carries the root cause');
} catch (e) {
  const s = String(e.stdout || '') + String(e.stderr || '');
  const ids = s.split('\n').filter((l) => /^  [A-Z]+-/.test(l)).map((l) => l.trim().split(/\s+/)[0]);
  if (!ids.length) { console.log('FAIL :: ' + s.slice(0, 600)); process.exit(1); }
  const w = [...args];
  for (const c of ids) w.push('--distinct', c);
  try {
    execFileSync('node', ['src/cli/index.ts', ...w], { cwd: REPO, encoding: 'utf8' });
    console.log('OK  (gate ' + ids.length + ')');
  } catch (e2) {
    console.log('FAIL :: ' + String(e2.stdout || e2.stderr || '').slice(0, 600));
  }
}

● Bash(cd "D:/Users/UserC/source/repos/my-context" && node "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-my-context/595db3b1-a481-4553-b4c0-7248c31b2655/scratchpad/l21fix.mjs" 2>&1 | grep -v Experimental | grep -v trace-warn)
OK  live/21 carries the root cause

● Bash(cd "D:/Users/UserC/source/repos/my-context" && git add .my_context/items/task/TASK-one-dead-stream-is-announced-on-every-screen-for-ever-and-a.md && git commit -q -F - <<'MSGEOF'
  live/21: the root cause is a silent socket, and my recommendation was wrong

  The owner supplied the fact that decided it: the drop happens "every few
  minutes". That frequency pointed at a cause rather than at a trade-off.

  streamHandler sends a frame only when there is a resync or a record. There is no
  else branch, and no keep-alive, comment frame or heartbeat exists anywhere in
  watch-model.ts. So through any quiet period the connection carries ZERO bytes,
  and a silent socket is what Windows, an antivirus shim or any intermediary
  reaps. That is exactly the observed signature, and it also explains why every
  ordinary read kept working -- those are short requests that are never idle.

  The fix is the standard one and it is three bytes a tick: an SSE comment on ticks
  with nothing to report. A comment is ignored by specification, so it proves
  liveness without inventing a frame describeStreamEvent cannot name -- a
  constraint already recorded on this route.

  AND THIS REVERSES MY OWN RECOMMENDATION. I proposed replacing the stream with a
  poll because a poll recovers by construction. The reasoning was sound and the
  conclusion was wrong: the stream is not inherently fragile, it was missing a
  keep-alive. Replacing a working subsystem to route around a three-byte omission
  would have cost the immediacy that is the whole point of an audit feed, and left
  the real defect in place for anything else that ever holds a connection open.
  The earlier reasoning stays in the item rather than being edited away.

  The sticky fault is still fixed, as defence in depth rather than as the cure: a
  real drop can still happen, and one must not poison the page for its whole life.

  So section 2 is not touched and nothing silently reconnects, because nothing
  needs to -- the connection stops dying.

  Queued rather than dispatched: it needs a string change and the running lane
  holds both string tables.

  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01LW6HUopV3KWFkLWG8CEhsY
  MSGEOF
  git push -q origin master && echo pushed)
pushed
 - fix it. and if there are more alike fix them too
