/**
 * **`hooks/hooks.json` against the platform that reads it, and against the
 * binaries it names.**
 *
 * A hook registration has no failure mode of its own. A command that points at
 * a file that does not exist, an event name the platform does not know, a
 * matcher that cannot match — none of them throws, none of them warns, and the
 * only symptom is a feature that quietly never happens. That is the `fork`
 * defect's family (`test/hooks/session-start-matcher.test.ts`), and this file is
 * the same discipline applied to the whole manifest rather than to one matcher.
 *
 * ── WHERE THE PLATFORM FACTS COME FROM ─────────────────────────────────────
 *
 * All of them are read out of the shipped executable at
 * `C:/Users/UserC/.local/share/claude/versions/2.1.239`, the method
 * `reports/probes/2026-08-20-clear-and-prompt-hooks.md` §1a describes. They are
 * hand-kept here because they live in a binary, not in a package this project
 * depends on: the job of these tests is to make a change DELIBERATE, not to
 * catch a platform change on their own. When one fails, re-read the schema on
 * the current build and record the version.
 *
 *  - `grep -a -o 'hook_event_name:kt("[A-Za-z]*")'` yields exactly 31 distinct
 *    event names — `EVENTS` below — which is the denominator `hooks seq:21`
 *    counts against.
 *  - Byte 317139714 carries the switch that decides what a matcher is tested
 *    AGAINST, per event, and `MATCHER_QUERY` below is that switch transcribed.
 *    The events absent from it have no query at all, and
 *    `let d=(a?s.filter((x)=>!x.matcher||cEE(a,x.matcher,l,c)):s)` runs every
 *    entry when the query is undefined — so a matcher on one of those is
 *    ignored rather than honoured, which is dead configuration that reads as a
 *    filter.
 *  - Byte 309954100 carries the file watcher, where a `FileChanged` entry's
 *    matcher is read a SECOND time and as something else entirely: a
 *    `|`-separated list of watch paths. `hooks/file-changed.ts` quotes both.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOOK_OPS, type HookOp } from '../../src/core/audit.ts';
import { CONFIG_CHANGE } from '../../src/hooks/config-change.ts';
import { FILE_CHANGED } from '../../src/hooks/file-changed.ts';
import { INSTRUCTIONS_LOADED } from '../../src/hooks/instructions-loaded.ts';
import { PERMISSION_DENIED } from '../../src/hooks/permission-denied.ts';
import { PROMPT_EXPANSION } from '../../src/hooks/user-prompt-expansion.ts';
import { SETUP } from '../../src/hooks/setup.ts';
import { STOP } from '../../src/hooks/stop.ts';
import { SUBAGENT_STOP } from '../../src/hooks/subagent-stop.ts';
import { TASK_COMPLETED, TASK_CREATED } from '../../src/hooks/task-events.ts';
import type { ObservationSpec } from '../../src/hooks/observe.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Every `hook_event_name` build 2.1.239 declares — 31, sorted. */
const EVENTS = [
  'ConfigChange', 'CwdChanged', 'DirectoryAdded', 'Elicitation', 'ElicitationResult',
  'FileChanged', 'InstructionsLoaded', 'MessageDisplay', 'Notification', 'PermissionDenied',
  'PermissionRequest', 'PostCompact', 'PostToolBatch', 'PostToolUse', 'PostToolUseFailure',
  'PreCompact', 'PreToolUse', 'SessionEnd', 'SessionStart', 'Setup', 'Stop', 'StopFailure',
  'SubagentStart', 'SubagentStop', 'TaskCompleted', 'TaskCreated', 'TeammateIdle',
  'UserPromptExpansion', 'UserPromptSubmit', 'WorktreeCreate', 'WorktreeRemove',
] as const;

/**
 * The payload field a matcher is tested against, per event. Absent means the
 * platform passes no query for that event and every entry runs.
 */
const MATCHER_QUERY: Record<string, string> = {
  PreToolUse: 'tool_name', PostToolUse: 'tool_name', PostToolUseFailure: 'tool_name',
  PermissionRequest: 'tool_name', PermissionDenied: 'tool_name',
  UserPromptExpansion: 'command_name',
  SessionStart: 'source', Setup: 'trigger', PreCompact: 'trigger', PostCompact: 'trigger',
  Notification: 'notification_type', SessionEnd: 'reason', StopFailure: 'error',
  SubagentStart: 'agent_type', SubagentStop: 'agent_type',
  Elicitation: 'mcp_server_name', ElicitationResult: 'mcp_server_name',
  ConfigChange: 'source', DirectoryAdded: 'source', InstructionsLoaded: 'load_reason',
  FileChanged: 'basename(file_path)',
};

interface Entry { matcher?: string; hooks: { type: string; command: string; timeout: number }[] }

function manifest(): Record<string, Entry[]> {
  const raw = JSON.parse(readFileSync(path.join(ROOT, 'hooks', 'hooks.json'), 'utf8')) as {
    hooks: Record<string, Entry[]>;
  };
  return raw.hooks;
}

/** The `src/hooks/<name>.ts` a command runs, with `${CLAUDE_PLUGIN_ROOT}` unresolved. */
function binaryOf(command: string): string | null {
  const found = /\$\{CLAUDE_PLUGIN_ROOT\}\/(src\/hooks\/[a-z-]+\.ts)/u.exec(command);
  return found ? found[1] : null;
}

/** The ten specs `hooks/observe.ts` runs — the surface seq:21 and seq:2b added. */
const SPECS: ObservationSpec[] = [
  CONFIG_CHANGE, FILE_CHANGED, INSTRUCTIONS_LOADED, PERMISSION_DENIED, PROMPT_EXPANSION,
  SETUP, STOP, SUBAGENT_STOP, TASK_CREATED, TASK_COMPLETED,
];

test('every registered event is one the platform declares', () => {
  const declared = new Set<string>(EVENTS);
  for (const name of Object.keys(manifest())) {
    assert.ok(declared.has(name),
      `hooks.json registers "${name}", which build 2.1.239 does not declare. An unknown event ` +
      'name is not rejected — it is simply never dispatched.');
  }
});

test('every registered command runs a file that exists', () => {
  for (const [name, entries] of Object.entries(manifest())) {
    for (const entry of entries) {
      for (const hook of entry.hooks) {
        assert.equal(hook.type, 'command', `${name} registers a non-command hook`);
        const rel = binaryOf(hook.command);
        assert.ok(rel, `${name}'s command does not name a src/hooks binary: ${hook.command}`);
        assert.ok(existsSync(path.join(ROOT, rel)),
          `${name} runs ${rel}, which does not exist. Claude Code reports a hook that cannot ` +
          'start on stderr and carries on; the feature simply never happens.');
        assert.ok(hook.timeout > 0, `${name} declares no positive timeout; an omitted one is 600s`);
      }
    }
  }
});

test('every observation spec is registered, and every registration has a spec', () => {
  const registered = new Set(Object.keys(manifest()));
  for (const spec of SPECS) {
    assert.ok(registered.has(spec.hook),
      `${spec.hook} has a handler and an audit op but no entry in hooks.json — a hook that is ` +
      'not registered is code that never runs (hooks seq:23 is the whole cost of that).');
  }
  // The reverse direction is bounded to the observation surface: the six older
  // binaries are registered and have no `ObservationSpec`, by design.
  const observationBinaries = new Set(SPECS.map((s) => s.hook));
  for (const [name, entries] of Object.entries(manifest())) {
    if (!observationBinaries.has(name as ObservationSpec['hook'])) continue;
    for (const entry of entries) {
      for (const hook of entry.hooks) {
        assert.ok(binaryOf(hook.command), `${name} names no binary`);
      }
    }
  }
});

test('every observation op is registered in the audit vocabulary', () => {
  for (const spec of SPECS) {
    assert.ok((HOOK_OPS as readonly string[]).includes(spec.op),
      `${spec.hook} records op "${spec.op}", which HOOK_OPS does not contain. parseAudit ` +
      'refuses a whole SEGMENT on an unknown op, so this would make the log unreadable.');
  }
  const ops = new Set<HookOp>(SPECS.map((s) => s.op));
  assert.equal(ops.size, SPECS.length, 'two observation hooks share an op');
});

test('no new registration carries a matcher it could silently miss a value with', () => {
  // The `fork` rule, applied forward. Nine of the ten name no matcher at all,
  // so no value of the queried field can make them silently not run.
  const withMatchers = Object.entries(manifest())
    .filter(([name]) => SPECS.some((s) => s.hook === name))
    .flatMap(([name, entries]) => entries.map((e) => ({ name, matcher: e.matcher })))
    .filter((e) => e.matcher !== undefined);

  assert.deepEqual(
    withMatchers.map((e) => `${e.name}:${e.matcher}`).sort(),
    ['FileChanged:.my_context/items|.my_context/config.json', 'UserPromptExpansion:^mycontext:'],
    'a new registration grew a matcher. On every event but FileChanged a matcher can only ' +
    'REMOVE firings, and a value it omits does not fail — the hook does not run. Both ' +
    'exceptions are argued in their own files; a third needs the same argument.',
  );
});

test('the matcher-bearing registrations are matched on the field the platform queries', () => {
  assert.equal(MATCHER_QUERY['UserPromptExpansion'], 'command_name',
    'the UserPromptExpansion matcher is written as a command-name prefix; if the platform ' +
    'queries something else it now filters on the wrong thing');
  assert.equal(MATCHER_QUERY['FileChanged'], 'basename(file_path)',
    'FileChanged\'s dispatch query is the basename, which is why the watch-path entry cannot ' +
    'also be the dispatching one');
});

/* ---------------------------------------------------------------------------
 * FileChanged — one string, read twice, meaning two different things.
 * ------------------------------------------------------------------------- */

test('FileChanged registers a watch-path entry and a dispatching entry', () => {
  const entries = manifest()['FileChanged'];
  assert.ok(entries, 'FileChanged is not registered');
  assert.equal(entries.length, 2,
    'FileChanged needs exactly two entries: one whose matcher declares the watch paths (the ' +
    'watcher reads it at byte 309954100 and a matcher-less entry contributes NO path, so with ' +
    'only that one the event never fires at all) and one with no matcher, which is the only ' +
    'shape the dispatch filter admits for a basename query.');

  const withMatcher = entries.filter((e) => e.matcher !== undefined);
  const without = entries.filter((e) => e.matcher === undefined);
  assert.equal(withMatcher.length, 1);
  assert.equal(without.length, 1);
  assert.equal(
    binaryOf(without[0].hooks[0].command), binaryOf(withMatcher[0].hooks[0].command),
    'both entries must run the same binary: the platform may one day dispatch the ' +
    'matcher-bearing one, and when it does it must do the same thing rather than nothing',
  );
});

test('the FileChanged watch paths are inside the workspace and exclude the audit log', () => {
  const entry = manifest()['FileChanged'].find((e) => e.matcher !== undefined);
  assert.ok(entry?.matcher);
  const paths = entry.matcher.split('|').map((p) => p.trim()).filter(Boolean);
  assert.ok(paths.length > 0, 'the matcher declares no watch path, so nothing is watched');
  for (const p of paths) {
    assert.ok(p.startsWith('.my_context/'),
      `"${p}" is watched but is not inside the workspace; FileChanged fires per file and this ` +
      'is a process spawn each time');
    assert.ok(!p.includes('.audit'),
      `"${p}" would put the audit log inside the watch set. This hook APPENDS to the audit ` +
      'log, so that is not a slow leak — it is a program that never stops.');
    assert.ok(!/\.index\.db|state|\.seen/u.test(p),
      `"${p}" watches generated state, which my_context writes to itself`);
  }
});

test('the FileChanged watch-path matcher cannot match a basename, which is why the second entry exists', () => {
  // The trap, executed rather than asserted in prose. If this ever starts
  // matching, the two entries both dispatch and every corpus edit records twice.
  const entry = manifest()['FileChanged'].find((e) => e.matcher !== undefined);
  assert.ok(entry?.matcher);
  const asRegExp = new RegExp(entry.matcher);
  for (const basename of ['CONST-x.md', 'config.json', 'RULE-y.md']) {
    assert.ok(!asRegExp.test(basename),
      `the watch-path matcher also matches the basename "${basename}", so both entries now ` +
      'dispatch and every change is recorded twice');
  }
});

/* ---------------------------------------------------------------------------
 * UserPromptExpansion — hooks seq:2b.
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * The re-survey `hooks seq:21` asks for, kept as an executable table.
 * ------------------------------------------------------------------------- */

/**
 * **The thirteen events still unregistered, each with the case for it as it
 * stands after this round.**
 *
 * `hooks seq:21`: *"after these land, redo the survey over the remaining
 * unregistered events. A case for one of them may only become visible once
 * these are in."* Three did become visible, and they are marked. The survey
 * lives here rather than in a report because a report goes stale in silence and
 * this fails the day the platform's list changes — which is the only signal
 * anyone will get that a thirty-second event exists.
 *
 * **None of these is a decision to leave anything off.** Registering any of
 * them is a ruling, and the ruling belongs to `hooks seq:22` — *survey every
 * integration surface and ship the settings* — which is BLOCKED on the owner.
 * What is recorded here is what each event carries, measured, and what it would
 * be for. Every payload sketch is read off build 2.1.239 by
 * `grep -a -b -o 'hook_event_name:kt("<Event>")'` and dumping the bytes after.
 */
const UNREGISTERED: Record<string, { payload: string; case: string }> = {
  PostToolBatch: {
    payload: 'tool_calls[]',
    case: 'NEW AFTER THIS ROUND. Its own description: "Fired once after every tool call in a ' +
      'batch has resolved, before the next model request. PostToolUse fires per-tool and may ' +
      'run concurrently for parallel calls." That is exactly the middle ground seq:21 raised ' +
      'about the capture nudge — once per edit (PostToolUse, where it is) versus once per turn ' +
      '(Stop) — and it was invisible until Stop was registered and the comparison had two ends.',
  },
  StopFailure: {
    payload: 'error, error_details?, last_assistant_message?',
    case: 'NEW AFTER THIS ROUND. `stop` rows now mark the end of every assistant turn, so the ' +
      'ABSENCE of one is newly meaningful — and ambiguous: a turn that failed and a turn whose ' +
      'hook was killed look identical. This event is the disambiguator, and it did not have a ' +
      'question to answer before `stop` existed.',
  },
  PermissionRequest: {
    payload: 'tool_name, tool_input, permission_suggestions?',
    case: 'NEW AFTER THIS ROUND. It is the precursor of the `PermissionDenied` now registered — ' +
      'the moment the user is ASKED — and its payload carries `permission_suggestions`, which ' +
      'is a hook shaping what the user is offered. That is a larger act than anything in this ' +
      'round and the pairing is what makes it worth naming.',
  },
  DirectoryAdded: {
    payload: 'directory, source: slash_command|register_repo_root',
    case: '`/add-dir` puts a second repository in the session, and that repository may have its ' +
      'own `.my_context`. Every hook here resolves ONE workspace by walking up from `cwd`, so a ' +
      'second corpus is invisible to all of them. A real gap; not a small one to close.',
  },
  WorktreeCreate: {
    payload: 'name',
    case: 'A worktree is another checkout of the same repository with its own `.my_context` and ' +
      'its own `state/`. Same shape as DirectoryAdded, one level down.',
  },
  WorktreeRemove: {
    payload: 'worktree_path',
    case: 'The other half of WorktreeCreate: a removed worktree takes a `.my_context` with it, ' +
      'including its `state/` and its share of the audit log, and nothing anywhere records that ' +
      'a corpus stopped existing.',
  },
  CwdChanged: {
    payload: 'old_cwd, new_cwd',
    case: 'Registering FileChanged already activated the platform code this event drives: the ' +
      'watcher rebases every matcher-derived watch path against the new cwd and restarts ' +
      '(build 2.1.239, byte 309955778), and it does that whether or not a CwdChanged hook ' +
      'exists — the guard is "any CwdChanged OR FileChanged hook". So the watch set already ' +
      'follows the cwd. What a hook here would add is noticing that a DIFFERENT workspace is ' +
      'now in scope.',
  },
  UserPromptSubmit: {
    payload: 'prompt, source? (declared, NOT emitted)',
    case: 'Its value narrowed rather than grew: UserPromptExpansion now covers every slash ' +
      'command, so all this adds is plain typed text — at the cost of a spawn on every prompt. ' +
      'And its `source` cannot be built on: measured constant-folded to nothing on the wire ' +
      '(reports/probes/2026-08-20-clear-and-prompt-hooks.md §3c).',
  },
  Notification: {
    payload: 'message, title?, notification_type',
    case: 'A channel the product could SPEAK on — the platform is telling the user something ' +
      'and a hook can add to it — rather than something my_context could learn from. Every ' +
      'event taken this round was taken to observe; this one would only be taken to interrupt.',
  },
  MessageDisplay: {
    payload: 'turn_id, message_id, index — output can REPLACE displayContent',
    case: 'A hook here rewrites what the user is shown. A knowledge product editing the ' +
      'assistant\'s displayed words is not a thing this project does.',
  },
  Elicitation: {
    payload: 'mcp_server_name, message, mode?, elicitation_id?, requested_schema?',
    case: 'An MCP server asking the user something. my_context is itself an MCP server; ' +
      'observing other servers\' prompts is not its business.',
  },
  ElicitationResult: {
    payload: 'mcp_server_name, action: accept|decline|cancel, content?',
    case: 'The answer to the above, and `content` is whatever the user typed — content, not ' +
      'scope, which is the line this log does not cross.',
  },
  TeammateIdle: {
    payload: 'teammate_name, team_name (deprecated)',
    case: 'Carries a deprecated field the platform says it will remove, and nothing this ' +
      'project models.',
  },
};

test('the re-survey accounts for every event the platform declares', () => {
  const registered = new Set(Object.keys(manifest()));
  const surveyed = new Set(Object.keys(UNREGISTERED));

  for (const event of EVENTS) {
    assert.ok(registered.has(event) || surveyed.has(event),
      `${event} is neither registered nor accounted for in the re-survey. hooks seq:21 asks for ` +
      'the survey to be redone after this round; an event in neither list is one nobody looked at.');
    assert.ok(!(registered.has(event) && surveyed.has(event)),
      `${event} is both registered and listed as unregistered`);
  }
  for (const event of surveyed) {
    assert.ok((EVENTS as readonly string[]).includes(event),
      `the re-survey lists ${event}, which build 2.1.239 does not declare`);
  }
  assert.equal(registered.size + surveyed.size, EVENTS.length,
    `${registered.size} registered + ${surveyed.size} surveyed does not account for the ` +
    `${EVENTS.length} events the platform declares`);
});

test('every unregistered event carries a measured payload and a stated case', () => {
  for (const [event, entry] of Object.entries(UNREGISTERED)) {
    assert.ok(entry.payload.length > 0, `${event} has no payload sketch`);
    assert.ok(entry.case.length > 80,
      `${event}'s case is a placeholder. "Not taken" with no reason is how FileChanged sat ` +
      'unregistered for a whole version — the reason is the part that can be argued with.');
  }
});

test('the UserPromptExpansion matcher admits this plugin\'s commands and nothing else', () => {
  const entries = manifest()['UserPromptExpansion'];
  assert.ok(entries && entries.length === 1);
  const matcher = entries[0].matcher;
  assert.ok(matcher, 'the entry must carry a matcher; without one this is a process spawn on ' +
    'every slash command in every session');

  // The platform's own test: the literal-list form is only tried for strings of
  // `[a-zA-Z0-9_|, -]`, and this one contains `^` and `:`, so it falls through
  // to `new RegExp(matcher)` tested against `command_name`.
  assert.ok(!/^[a-zA-Z0-9_|, -]+$/u.test(matcher),
    'the matcher would be read as a literal list, not a regex, and "^mycontext:" is not a ' +
    'command name');
  const re = new RegExp(matcher);
  // Measured command names, from reports/probes/2026-08-20-clear-and-prompt-hooks.md §3a.
  assert.ok(re.test('mycontext:status'), 'this project\'s own commands must reach the hook');
  assert.ok(re.test('mycontext:anything-added-later'), 'the namespace, not an enumeration');
  assert.ok(!re.test('probeslash'), 'a foreign project-settings command must not spawn us');
  assert.ok(!re.test('other:mycontext:x'), 'the prefix is anchored');
});
