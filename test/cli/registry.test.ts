import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMMANDS, flag, hasFlag, positionals, registerCommand } from '../../src/cli/commands/registry.ts';

function noop(): number { return 0; }

test('flag reads a space-separated value', () => {
  assert.equal(flag(['--anchor', 'storage'], 'anchor'), 'storage');
});

test('flag reads an equals-separated value', () => {
  assert.equal(flag(['--anchor=storage'], 'anchor'), 'storage');
});

test('flag returns null when the name is absent', () => {
  assert.equal(flag(['--other', 'x'], 'anchor'), null);
});

test('hasFlag is true for both the space and equals forms, false otherwise', () => {
  assert.equal(hasFlag(['--stdin'], 'stdin'), true);
  assert.equal(hasFlag(['--stdin=true'], 'stdin'), true);
  assert.equal(hasFlag(['--file', 'x'], 'stdin'), false);
});

test('positionals skips a value-flag\'s value, not just the flag itself', () => {
  // Without the `i++` skip, "storage" would be misread as a second
  // positional instead of --anchor's value.
  assert.deepEqual(
    positionals(['ING-x', '--anchor', 'storage', '--file', 'c.json'], ['anchor', 'file']),
    ['ING-x'],
  );
});

test('positionals does not skip the following token when the flag used "=" form', () => {
  // "--anchor=storage" already carries its value inline; the token AFTER it
  // is a real positional and must not be swallowed too.
  assert.deepEqual(
    positionals(['ING-x', '--anchor=storage', 'extra'], ['anchor']),
    ['ING-x', 'extra'],
  );
});

test('positionals leaves an unlisted flag\'s value alone (not a value-flag, so not skipped)', () => {
  assert.deepEqual(positionals(['--stdin', 'yes'], []), ['yes']);
});

test('registerCommand refuses re-registering the same name', () => {
  const name = `probe-${Date.now()}`;
  registerCommand({ name, usage: name, summary: 's', run: noop });
  assert.throws(
    () => registerCommand({ name, usage: name, summary: 's2', run: noop }),
    /already registered/,
  );
  COMMANDS.delete(name);
});

test('registerCommand refuses a name already claimed by src/cli/index.ts\'s hardcoded switch', () => {
  // A registered command whose name is also a hardcoded `case` arm would be
  // advertised by usage() but could never actually run — the switch always
  // wins first in src/cli/index.ts's dispatch. See that file's `default` arm.
  // `status` moved out of the switch in Task 15 and is now a real
  // registration (`src/cli/commands/status.ts`), so it is deliberately not
  // in this list any more.
  for (const shadowed of ['init', 'add', 'list', 'show', 'rebuild', 'help', 'examples']) {
    assert.throws(
      () => registerCommand({ name: shadowed, usage: shadowed, summary: 's', run: noop }),
      /already a hardcoded case/,
      shadowed,
    );
    assert.equal(COMMANDS.has(shadowed), false, `${shadowed} must not have been registered`);
  }
});
