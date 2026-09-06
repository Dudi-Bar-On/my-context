/**
 * The server's half of "the client sends an ID, never a command" (spec §3.1,
 * plan Task 1).
 *
 * WHAT THIS PROVES: `src/ui/execute-catalogue.ts` rebuilds an argv from the
 * SAME catalogue file the browser composed from, refuses anything that is not
 * in that catalogue's declared shape, and reports which confirm the command
 * gets. Nothing here runs a command — the module under test imports nothing
 * that could.
 *
 * ── TWO PLACES THE PLAN'S SKETCH IS WRONG ABOUT THE CATALOGUE ─────────────
 *
 * 1. The plan asserts `resolveCommand('doctor', {}).boundary === false` and
 *    its Task 2 comment calls `doctor` *"flagged false explicitly"*. It is
 *    not. `palette-defs.js` carries `boundary: true` on fourteen entries and
 *    carries the key AT ALL on no other — there is no `boundary: false`
 *    anywhere in the file. Under the fail-safe the plan itself mandates ("an
 *    entry with no `boundary` flag resolves as ON the boundary"), `doctor`
 *    therefore resolves as `true`. The fail-safe is the property with security
 *    value, so it is what is asserted here and the plan's number is what
 *    gives. Making `doctor` resolve `false` means writing `boundary: false`
 *    into the read entries of `palette-defs.js` — a real, separate change to a
 *    file this task may not touch.
 *
 * 2. The plan's implementation sketch opens with a STATIC import of
 *    `./public/lib/palette-defs.js`. That cannot typecheck: `allowJs` is off
 *    and `tsconfig.json`'s `include` is `.ts` only, so a resolved `.js` module
 *    is an implicit `any` under `strict` (TS7016). `palette-lib.test.ts` and
 *    `strings-parity.test.ts` both met this already and both wrote down the
 *    answer. The module under test uses a URL specifier for the same reason.
 *
 * Every deceptive character below is written as a backslash-u escape and never
 * as a literal: `check:text-files` gates NUL bytes in the repository, and a
 * literal U+202E in a test file would reorder the source of the very test that
 * exists to refuse it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CommandRefusal, boundaryOf, catalogueEntries, catalogueIds, resolveCommand,
  runnableIds, runnableOf,
} from '../../src/ui/execute-catalogue.ts';

test('every RUNNABLE catalogue entry is resolvable by id — no entry is unreachable', () => {
  const ids = runnableIds();
  assert.ok(ids.length > 0);
  assert.ok(ids.includes('add'));
  assert.ok(ids.includes('doctor'));
  // The id spelling is the catalogue's `name`, subcommand spaces and all. The
  // server must key on exactly what the browser sent, so this is pinned rather
  // than left to whichever side normalises first.
  assert.ok(ids.includes('review promote-revision'));
  assert.equal(new Set(ids).size, ids.length, 'two entries sharing a name would make one unreachable');
});

test('an id the catalogue does not have is REFUSED, and the reason names the id', () => {
  assert.throws(() => resolveCommand('rm', {}), /rm/);
  // Reached through a Map, so this is a miss rather than `Object.prototype`.
  assert.throws(() => resolveCommand('__proto__', {}), /__proto__/);
  assert.throws(() => resolveCommand('', {}), /./);
  // A refusal is a thing a caller may be shown; a bug is not. The route turns
  // this class into a 400, so the class itself is part of the contract.
  assert.throws(() => resolveCommand('rm', {}), CommandRefusal);
});

test('the argv is rebuilt from the catalogue, not from anything the caller sent', () => {
  const resolved = resolveCommand('pin', { id: 'RULE-something', yes: true });
  assert.deepEqual(resolved.argv, ['pin', 'RULE-something', '--yes']);
  assert.equal(resolved.id, 'pin');
});

test('the leading `mycontext` is NOT in the argv — the server runs the CLI it ships with', () => {
  assert.equal(resolveCommand('doctor', {}).argv[0], 'doctor');
  // A subcommand entry keeps BOTH words: only the program name is dropped.
  assert.deepEqual(resolveCommand('review discard', { id: 'D-1' }).argv, ['review', 'discard', 'D-1']);
});

test('a missing required argument is refused, never composed half-built', () => {
  assert.throws(() => resolveCommand('pin', {}), /required/);
  // `supersede`'s `--by` is a required FLAG, not an arg — the refusal has to
  // cover both halves of the shape, not just the positionals.
  assert.throws(() => resolveCommand('supersede', { id: 'A' }), /required/);
});

test('a value not in a declared option set is refused BY VALUE', () => {
  assert.throws(() => resolveCommand('edit', { id: 'A', severity: 'medium' }), /medium/);
  assert.throws(() => resolveCommand('edit', { id: 'A', status: 'retired' }), /retired/);
  // The declared members still pass, or the check above would be proving only
  // that everything is refused.
  assert.ok(resolveCommand('edit', { id: 'A', status: 'draft' }).argv.includes('--status'));
});

test('a value that is not a string is refused — no coercion, ever', () => {
  for (const bad of [42, true, null, {}, ['a'], undefined]) {
    assert.throws(() => resolveCommand('pin', { id: bad }), /id/, String(bad));
  }
});

test('a switch takes a real boolean — the STRING "true" is refused, not coerced', () => {
  // `commandFor` pushes `--yes` only for `=== true` and silently skips anything
  // else, so a coerced switch would compose a command WITHOUT the flag the
  // confirm dialog just showed. That is the drift this whole module exists to
  // make impossible.
  assert.throws(() => resolveCommand('pin', { id: 'A', yes: 'true' }), /yes/);
  assert.deepEqual(resolveCommand('pin', { id: 'A', yes: false }).argv, ['pin', 'A']);
});

test('a value carrying a NUL, a newline or a bidi override is refused', () => {
  // NUL, newline, carriage return, RIGHT-TO-LEFT OVERRIDE, RIGHT-TO-LEFT
  // ISOLATE, ZERO WIDTH SPACE, DELETE. Each renders as something other than
  // what would run, which is the whole objection.
  const deceptive = ['a\u0000b', 'a\u000Ab', 'a\u000Db', 'a\u202Eb', 'a\u2067b', 'a\u200Bb', 'a\u007Fb'];
  for (const bad of deceptive) {
    assert.throws(() => resolveCommand('pin', { id: bad }), CommandRefusal, JSON.stringify(bad));
  }
  // Not over-broad: an ordinary id, and a non-ASCII letter (HEBREW ALEF),
  // still resolve. A refusal that ate every id with a real name in it would be
  // a different bug wearing this test's badge.
  assert.deepEqual(resolveCommand('pin', { id: 'RULE-a-b' }).argv, ['pin', 'RULE-a-b']);
  assert.deepEqual(resolveCommand('pin', { id: 'RULE-\u05D0' }).argv, ['pin', 'RULE-\u05D0']);
});

test('a key the entry does not declare is refused rather than dropped', () => {
  assert.throws(() => resolveCommand('doctor', { sneaky: 'x' }), /sneaky/);
  // A key another entry declares is still not a key THIS one takes.
  assert.throws(() => resolveCommand('pin', { id: 'A', severity: 'hard' }), /severity/);
});

test('a joined switch stays joined — `--always=false` is not `--always false`', () => {
  const resolved = resolveCommand('edit', { id: 'A', always: 'false' });
  assert.ok(resolved.argv.includes('--always=false'));
  assert.ok(!resolved.argv.includes('--always'));
});

test('the reads are below the boundary and the writes are on it, and both are EXPLICIT', () => {
  assert.equal(resolveCommand('add', { category: 'rule', title: 't' }).boundary, true);
  assert.equal(resolveCommand('edit', { id: 'A' }).boundary, true);
  for (const id of ['doctor', 'status', 'decay', 'review revisions', 'rebuild']) {
    assert.equal(resolveCommand(id, {}).boundary, false, `${id} is a read or a derived rebuild`);
  }
});

test('an entry that declares no boundary is TREATED AS ON IT', () => {
  // The fail-safe, asserted against a synthetic entry rather than a real one —
  // because every real entry now declares the key, which is the point. This is
  // the property that makes "a command added later automatically gets the
  // stronger confirm" true (spec §6.1) with nobody having to remember.
  assert.equal(boundaryOf({}), true);
  assert.equal(boundaryOf({ boundary: undefined }), true);
  assert.equal(boundaryOf({ boundary: true }), true);
  assert.equal(boundaryOf({ boundary: false }), false);
});

test('EVERY catalogue entry declares the key, so an omission still means "unclassified"', () => {
  // Before 2026-08-27 there was no `boundary: false` anywhere in the file, so
  // the fail-safe gave `doctor` the field-by-field diff meant for a command that
  // changes what governs the project. The default only carries information while
  // omissions are rare; this is what keeps them rare.
  const unflagged = catalogueEntries().filter((def) => def.boundary === undefined).map((d) => d.name);
  assert.deepEqual(unflagged, [],
    'a catalogue entry declares no boundary. It will get the STRONGER confirm, which is the '
    + 'safe direction — but say which it is, with the reason, rather than leaving the next '
    + 'reader to infer it from a missing key.');
});


/* -------------------------------------------------------------------------- *
 * `runnable` — drawing a form and letting this server run it are two things.
 *
 * Owner ruling D2, 2026-09-06 (`reports/2026-09-06-PLAN.md`), on the finding in
 * `docs/superpowers/specs/2026-09-06-composer-architecture-review.md` §2b:
 * membership in `PALETTE` used to be the whole execution licence, so giving a
 * command a checked argument shape granted it `POST /api/execute` in the same
 * edit.
 * -------------------------------------------------------------------------- */

/**
 * **The fail-safe, and it points the OPPOSITE way from `boundary`'s.**
 *
 * An entry that says nothing about `boundary` gets the stronger confirm, which
 * costs a reader ceremony. An entry that says nothing about `runnable` gets
 * nothing at all, because the cost of the other direction is a command nobody
 * licensed. The owner's own words for the rule: *a mistake should withhold
 * execution, never grant it.*
 */
test('an entry that declares no runnable is NOT runnable', () => {
  assert.equal(runnableOf({}), false);
  assert.equal(runnableOf({ runnable: undefined }), false);
  assert.equal(runnableOf({ runnable: false }), false);
  assert.equal(runnableOf({ runnable: true }), true);
});

test('EVERY catalogue entry declares the key, so an omission still means "unlicensed"', () => {
  // The same argument as the `boundary` test above and a sharper consequence: a
  // default only carries information while omissions are rare, and here an
  // omission silently removes a button rather than adding ceremony. Every entry
  // that could execute before this field existed was marked `runnable: true` in
  // the pass that added it, which is what keeps the omission meaningful.
  const unflagged = catalogueEntries()
    .filter((def) => (def as { runnable?: boolean }).runnable === undefined)
    .map((d) => d.name);
  assert.deepEqual(unflagged, [],
    'a catalogue entry declares no runnable. It will be refused execution, which is the safe '
    + 'direction — but say so, with the reason, rather than leaving the next reader to infer a '
    + 'withheld button from a missing key.');
});

/**
 * **The executable set, written out.**
 *
 * These are exactly the ids `POST /api/execute` would run on 2026-09-05, the day
 * before `runnable` existed, when the set was `[...BY_ID.keys()]` and therefore
 * every entry in the catalogue. The list is transcribed rather than derived on
 * purpose — a derived assertion would follow the catalogue wherever it went, and
 * the one property this test exists for is that MOVING A COMMAND INTO THE
 * CATALOGUE DID NOT GRANT IT EXECUTION.
 *
 * A new row here is a real grant and must be an owner ruling
 * (`OPENQ-the-three-proposed-screens-hold-the-only-command-blocks-in` is the
 * open one). A row that disappears is a command that quietly lost its button.
 */
const EXECUTABLE_BEFORE_RUNNABLE = [
  'ack', 'add', 'config', 'edit', 'focus',
  'pin', 'unpin', 'harden', 'soften', 'supersede', 'refresh', 'repair',
  'lesson-accept', 'lesson-discard',
  'review promote', 'review discard', 'review promote-revision', 'review discard-revision',
  'rebuild',
  'status', 'doctor', 'decay', 'review revisions', 'help', 'list', 'show', 'search',
];

test('the executable set is exactly what it was before the flag existed', () => {
  assert.deepEqual([...runnableIds()].sort(), [...EXECUTABLE_BEFORE_RUNNABLE].sort());
  assert.equal(runnableIds().length, 27, 'the count moved; say which ruling moved it');
});

test('the catalogue is WIDER than the executable set, and the difference is named', () => {
  const composedOnly = catalogueIds().filter((id) => !runnableIds().includes(id)).sort();
  assert.deepEqual(composedOnly, ['audit', 'init', 'procedure done'],
    'the set of commands this catalogue composes and refuses to run has changed. That is a '
    + 'decision about the approval boundary either way: a command leaving this list gained '
    + 'Execute, and a command joining it lost one.');
});

/**
 * **Refused at `resolveCommand`, so BOTH routes are stopped by one check.**
 *
 * The confirm `GET` and the execute `POST` both resolve through this function.
 * Refusing here rather than at the POST is what stops a confirm dialog being
 * rendered for a command that can never run — a question with no answer, and a
 * button that teaches a reader it works.
 */
test('a catalogued command that is not runnable is REFUSED, in words a reader can act on', () => {
  for (const id of ['audit', 'init', 'procedure done']) {
    assert.throws(() => resolveCommand(id, {}), CommandRefusal, id);
    let message = '';
    try { resolveCommand(id, {}); } catch (error) { message = (error as Error).message; }
    // The id, so the reader knows which of several blocks on a screen refused.
    assert.ok(message.includes(id), `the refusal does not name ${id}`);
    // The FIELD, so the reason is checkable rather than atmospheric.
    assert.ok(message.includes('runnable: false'), `${id}: the refusal does not name the field`);
    // And what to do instead. A refusal a reader cannot act on is a 404 with
    // better prose, which is the thing this ruling was meant to stop shipping.
    assert.ok(message.includes('your own shell'), `${id}: the refusal offers no way forward`);
    // NOT the uncatalogued refusal: the catalogue knows this command and just
    // composed the line on screen. Saying it had never heard of it would be a
    // lie the reader can see through, standing next to the command.
    assert.ok(!message.includes('is in the catalogue'), `${id}: refused as if it were unknown`);
  }
});

test('a non-runnable id is refused BEFORE its values are read, so the answer never varies', () => {
  // A caller who sends garbage to a command that cannot run must get the same
  // sentence as one who sends a perfect value bag: any other behaviour makes the
  // refusal a probe for what the entry declares.
  const bad = (): string => {
    try { resolveCommand('init', { nonsense: 1, another: '\u202E' }); } catch (e) { return (e as Error).message; }
    return 'no refusal';
  };
  const good = (): string => {
    try { resolveCommand('init', { pack: '../packs/x' }); } catch (e) { return (e as Error).message; }
    return 'no refusal';
  };
  assert.equal(bad(), good());
});
