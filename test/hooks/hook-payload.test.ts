// @basis TASK-one-flat-input-type-spans-fifteen-events-so-a-handler, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **A handler may read its own event's fields and no others — at compile time,
 * which is the only time the claim can be false.**
 *
 * `TASK-one-flat-input-type-spans-fifteen-events-so-a-handler` measured it:
 * `HookInput` is one flat interface with ~25 optional fields spanning every
 * platform event, so `input.compact_summary` COMPILES on a `SessionStart`
 * handler and yields `undefined` at run time. A runtime test cannot hold this
 * up — `undefined` is exactly what an absent optional field yields whether the
 * event carries it or not, so the wrong read and the right read look identical
 * from outside. So every assertion below is a `@ts-expect-error`, which is
 * itself an error when the line under it compiles, and `npm run typecheck` is
 * what runs them.
 *
 * The runtime tests here are about the OTHER half: that `payloadOf` is an
 * identity function which changes no value, adds no key and costs the hook
 * startup path nothing.
 *
 * Removal proofs for every directive are recorded in the lane report.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHookInput, payloadOf, type HookEvent } from '../../src/hooks/io.ts';

const HOOKS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'hooks');

/* -------------------------------------------------------------------------- *
 * 1. A field its event never sends.
 * -------------------------------------------------------------------------- */

test('a SessionStart payload has no compact_summary — THE measured defect, now a COMPILE error', () => {
  const start = payloadOf(parseHookInput('{"source":"startup"}').input, 'SessionStart');

  // @ts-expect-error -- the item's own example: `compact_summary` is `PostCompact`'s,
  // it used to compile here, and it yielded `undefined` — a field that cannot exist
  // on this event, accepted by the compiler.
  void start.compact_summary;

  // @ts-expect-error -- and `trigger`, which belongs to PreCompact, PostCompact and Setup.
  void start.trigger;

  // What the event DOES carry is unchanged and still optional, because the
  // platform's schema says what it accepts and not what it sends.
  assert.equal(start.source, 'startup');
  assert.equal(start.session_id, undefined, 'an absent base field is still absent');
});

test('one key name, three vocabularies — the collision a flat interface could not hold', () => {
  // `source` is documented on `HookInput` as "SessionStart only". It is not:
  // `ConfigChange` carries a `source` too, with a completely different
  // vocabulary (`CONFIG_SOURCES`). One flat interface can declare a key once;
  // a per-event map declares it twice, under two events, with two comments.
  const config = payloadOf(parseHookInput('{"source":"project_settings"}').input, 'ConfigChange');
  assert.equal(config.source, 'project_settings', 'ConfigChange reads its OWN source vocabulary');

  // @ts-expect-error -- and it cannot reach SessionStart's neighbours while doing so.
  void config.compact_summary;

  // The same shape again, one field over: `trigger` is `manual | auto` on the
  // compaction events and `init | maintenance` on `Setup`.
  const setup = payloadOf(parseHookInput('{"trigger":"init"}').input, 'Setup');
  const precompact = payloadOf(parseHookInput('{"trigger":"manual"}').input, 'PreCompact');
  assert.equal(setup.trigger, 'init');
  assert.equal(precompact.trigger, 'manual');

  // @ts-expect-error -- Setup carries no file_path, whatever ConfigChange does.
  void setup.file_path;

  // @ts-expect-error -- and PreCompact carries no compact_summary; PostCompact does.
  void precompact.compact_summary;
});

test('an observation event cannot read a tool event, and vice versa — two COMPILE errors', () => {
  const changed = payloadOf(parseHookInput('{"file_path":"a.ts","event":"add"}').input, 'FileChanged');
  const tool = payloadOf(parseHookInput('{"tool_name":"Write"}').input, 'PreToolUse');

  // @ts-expect-error -- `FileChanged` is the platform's own top-level file_path event
  // and knows nothing about tools.
  void changed.tool_name;

  // @ts-expect-error -- and `tool_input.file_path` is a tool ARGUMENT, not this key:
  // the two are different fields that a flat interface spelled once each and let
  // every handler see both.
  void tool.event;

  assert.equal(changed.file_path, 'a.ts');
  assert.equal(changed.event, 'add');
  assert.equal(tool.tool_name, 'Write');
});

/* -------------------------------------------------------------------------- *
 * 2. The narrowing costs nothing.
 * -------------------------------------------------------------------------- */

test('payloadOf is identity: same object, no key added, no value changed', () => {
  const parsed = parseHookInput('{"session_id":"s1","trigger":"auto","compact_summary":"x"}').input;
  const view = payloadOf(parsed, 'PostCompact');

  assert.equal(view, parsed, 'the SAME object — no copy, so no allocation on the hook startup path');
  assert.deepEqual(
    Object.keys(view).sort(), ['compact_summary', 'session_id', 'trigger'],
    'no key is added and none is removed: the narrowing is a type and erases',
  );
  assert.equal(view.compact_summary, 'x');
  assert.equal(view.trigger, 'auto');
});

test('the event name is passed as a literal, never read off the payload', () => {
  // A payload claiming to be something else narrows to what the HANDLER says,
  // because the handler is a process spawned by `hooks.json` for exactly one
  // event and the field is caller-supplied. `parseHookInput` already documents
  // that `{}` is indistinguishable from a real payload downstream; a narrowing
  // that trusted `hook_event_name` would inherit that problem.
  const lying = parseHookInput('{"hook_event_name":"PostCompact","source":"startup"}').input;
  const view = payloadOf(lying, 'SessionStart');
  assert.equal(view.source, 'startup', 'narrowed to what the handler is registered for');

  // @ts-expect-error -- and the lie buys nothing: PostCompact's field is still unreachable.
  void view.compact_summary;
});

/* -------------------------------------------------------------------------- *
 * 3. What is migrated, and what is not — by name.
 * -------------------------------------------------------------------------- */

/**
 * **Every event in `hooks.json` has an entry in `HookEventFields`.**
 *
 * The map is the claim "these are the events and these are their fields", and a
 * registered event missing from it is a handler with nothing to narrow to. Read
 * off `hooks.json` rather than retyped, so a nineteenth event registered
 * tomorrow fails here instead of silently falling back to the flat interface.
 */
test('the payload map covers every event hooks.json registers', () => {
  const manifest = JSON.parse(
    readFileSync(path.resolve(HOOKS, '..', '..', 'hooks', 'hooks.json'), 'utf8'),
  ) as Record<string, unknown>;
  const registered = Object.keys(manifest.hooks as Record<string, unknown>).sort();

  // The map's own keys, read out of the source: `HookEvent` is a type and
  // cannot be enumerated at run time, which is the honest cost of an erasable
  // brand-and-map design and is why this reads the declaration instead.
  const io = readFileSync(path.join(HOOKS, 'io.ts'), 'utf8');
  const body = io.slice(io.indexOf('export interface HookEventFields {'));
  const mapped = [...body.slice(0, body.indexOf('\n}')).matchAll(/^ {2}([A-Z][A-Za-z]*)[?]?:/gmu)]
    .map((m) => m[1]!)
    .sort();

  assert.ok(mapped.length > 0, 'the detector must be able to see entries at all');
  assert.deepEqual(
    mapped, registered,
    'every registered event needs a per-event payload shape, and an entry for an event '
    + 'nothing registers is a shape nothing can check.',
  );
});

/**
 * **Which handlers are migrated, by name — including the ones that are not.**
 *
 * The migration is per handler on purpose: a widening of `HookInput` itself
 * would have broken every call site at once and been unlandable, so each
 * handler narrows at its own entry and each is independently landable. That
 * makes "how far did it get" a real question, and this is the answer, written
 * down rather than left to a report.
 *
 * The three unmigrated handlers were being edited by another lane in the same
 * working tree while this one ran. That is the only reason they are not done,
 * and it is recorded here so the next lane picks them up rather than
 * rediscovering them.
 */
test('the unmigrated handlers are exactly the three another lane held', () => {
  // **The detector is what a file IMPORTS, not the word `HookInput`.** That
  // word appears in prose all over this directory, and `post-tool-use.ts`
  // deliberately keeps the NAME as an alias of `HookPayload<'PostToolUse'>` so
  // its own signatures read unchanged. It is also possible to handle a payload
  // without naming the type at all — `session-start.ts` does, taking
  // `parseHookInput`'s return value inline — and a detector that looked for the
  // word would have called that file migrated. So:
  //
  //   handles a payload  =  imports `parseHookInput` or `HookInput` from io.ts
  //   migrated           =  imports `HookPayload` from io.ts
  //
  // and the answer is the difference. The two anti-vacuity assertions below
  // prove the detector can see each side.
  const imported = (file: string): string => {
    const src = readFileSync(path.join(HOOKS, file), 'utf8');
    // `import type { … }` as well as `import { … }`: four of the migrated
    // handlers need only the type, and a detector that missed those would
    // report them as unmigrated — a false RED, which is the direction that
    // wastes a reader's time rather than hiding a defect, but wrong either way.
    return [...src.matchAll(/import\s*(?:type\s+)?\{([^}]*)\}\s*from\s*'\.\/io\.ts'/gu)]
      .map((m) => m[1]!)
      .join(',');
  };
  const named = (list: string, name: string): boolean =>
    new RegExp(`(^|[\\s,])(type\\s+)?${name}([\\s,]|$)`, 'u').test(list);

  const handlesPayload = (f: string): boolean => {
    const list = imported(f);
    return named(list, 'parseHookInput') || named(list, 'HookInput');
  };
  const migrated = (f: string): boolean => named(imported(f), 'HookPayload');

  assert.equal(
    handlesPayload('session-start.ts') && !migrated('session-start.ts'), true,
    'ANTI-VACUITY: the detector must be able to SEE an unmigrated handler, including one '
    + 'that never names the type — session-start.ts takes parseHookInput\'s value inline.',
  );
  assert.equal(
    migrated('file-changed.ts'), true,
    'ANTI-VACUITY: and it must recognise a migrated one.',
  );

  const flat = readdirSync(HOOKS)
    .filter((f) => f.endsWith('.ts') && f !== 'io.ts' && f !== 'observe.ts')
    .filter((f) => handlesPayload(f) && !migrated(f))
    .sort();

  assert.deepEqual(
    flat, ['session-start.ts', 'stop.ts', 'subagent-start.ts'],
    'every other handler reads a `HookPayload<E>`. These three still read the flat '
    + '`HookInput`, so each can still read a field its event never sends. `observe.ts` is '
    + 'excluded above because it is the DISPATCHER — it is handed a spec and a payload '
    + 'before anything knows which event it has, so `HookInput` is the correct type there '
    + 'and the narrowing happens one call down, in each spec\'s own `observe`.',
  );
});
