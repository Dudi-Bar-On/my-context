import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  boolFlag, COMMANDS, flag, flagOccurrences, hasFlag, listFlag, positionals, registerCommand,
} from '../../src/cli/commands/registry.ts';

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

/**
 * The defect this whole group exists for: `flag` returned the FIRST match and
 * said nothing about the rest, so `--scope a/** --scope b/**` produced an item
 * scoped to `a/**` alone and reported success. Two answers are defensible and
 * both are here, one per shape of flag — a single-valued flag refuses
 * (`flag`), a list-valued one collects (`listFlag`). Neither keeps the first
 * and stays quiet.
 */
test('a repeated single-valued flag is refused, not silently reduced to the first', () => {
  assert.throws(() => flag(['--by', 'A', '--by', 'B'], 'by'), /--by was given 2 times/);
  assert.throws(() => flag(['--by=A', '--by=B'], 'by'), /--by was given 2 times/);
  // Mixed spellings are still two occurrences of one flag.
  assert.throws(() => flag(['--by', 'A', '--by=B'], 'by'), /--by was given 2 times/);
});

test('the repeated-flag refusal quotes the values it refused to choose between', () => {
  assert.throws(
    () => flag(['--limit', '5', '--limit', '10'], 'limit'),
    /"5", "10"/,
  );
});

test('a repeated flag is refused even when the two occurrences agree', () => {
  // Deliberate: "they agree" is a judgement about values, and the caller who
  // wrote it twice may have meant a list. Refusing says so; picking one does
  // not.
  assert.throws(() => flag(['--by', 'A', '--by', 'A'], 'by'), /given 2 times/);
});

test('listFlag unions every occurrence, and each occurrence is still comma-split', () => {
  assert.deepEqual(listFlag(['--scope', 'a/**', '--scope', 'b/**'], 'scope'), ['a/**', 'b/**']);
  assert.deepEqual(listFlag(['--scope', 'a/**, b/**'], 'scope'), ['a/**', 'b/**']);
  // The two spellings compose, which is the point of collecting rather than
  // refusing: neither form is "the" way to write a list.
  assert.deepEqual(
    listFlag(['--scope', 'a/**,b/**', '--scope=c/**'], 'scope'),
    ['a/**', 'b/**', 'c/**'],
  );
});

test('listFlag distinguishes absent from present-and-empty, and drops duplicates', () => {
  assert.equal(listFlag(['--tags', 'x'], 'scope'), null, 'absent is null, not []');
  assert.deepEqual(listFlag(['--scope='], 'scope'), [], 'present but empty means "no scope"');
  assert.deepEqual(listFlag(['--tags', 'a,b', '--tags', 'b,c'], 'tags'), ['a', 'b', 'c']);
});

test('flagOccurrences reports the form of each occurrence and skips the value token', () => {
  assert.deepEqual(flagOccurrences(['--body', 'x', '--body=y'], 'body'), [
    { value: 'x', bare: true },
    { value: 'y', bare: false },
  ]);
  // A bare flag with nothing after it is one occurrence carrying no value —
  // the caller decides whether that is legal, but it is never invisible.
  assert.deepEqual(flagOccurrences(['--body'], 'body'), [{ value: null, bare: true }]);
  // The value token is consumed, exactly as `positionals` consumes it: this
  // is ONE occurrence whose value happens to look like a flag, not two.
  assert.deepEqual(flagOccurrences(['--body', '--body'], 'body'), [
    { value: '--body', bare: true },
  ]);
  assert.deepEqual(positionals(['--body', '--body'], ['body']), []);
});

test('hasFlag is true for both the space and equals forms, false otherwise', () => {
  assert.equal(hasFlag(['--stdin'], 'stdin'), true);
  assert.equal(hasFlag(['--stdin=true'], 'stdin'), true);
  assert.equal(hasFlag(['--file', 'x'], 'stdin'), false);
});

/**
 * The Task 10 follow-up this closes: `hasFlag` used to match any `--yes=`
 * prefix, so `--yes=false` and `--yes=no` — the spellings an operator reaches
 * for to DECLINE — confirmed the action. These pin the fix at the parser, so
 * every flag in the CLI reads the same dialect.
 */
test('a negated boolean flag is false, not merely present', () => {
  for (const spelling of ['false', 'FALSE', 'no', 'No', 'off', '0']) {
    assert.equal(boolFlag([`--yes=${spelling}`], 'yes'), false, spelling);
    assert.equal(hasFlag([`--yes=${spelling}`], 'yes'), false, spelling);
  }
});

test('an affirmative boolean flag, in every accepted spelling, is true', () => {
  for (const spelling of ['true', 'TRUE', 'yes', 'on', '1']) {
    assert.equal(boolFlag([`--yes=${spelling}`], 'yes'), true, spelling);
    assert.equal(hasFlag([`--yes=${spelling}`], 'yes'), true, spelling);
  }
});

test('a bare boolean flag is true and an absent one is null/false', () => {
  assert.equal(boolFlag(['--yes'], 'yes'), true);
  assert.equal(hasFlag(['--yes'], 'yes'), true);
  assert.equal(boolFlag(['--file', 'x'], 'yes'), null);
  assert.equal(hasFlag(['--file', 'x'], 'yes'), false);
});

test('an unparseable boolean value is refused, never silently read as true or false', () => {
  // Silently choosing either answer is the failure this replaces: "true"
  // confirms an action the operator tried to decline, "false" quietly drops
  // a flag they meant to pass.
  for (const bad of ['maybe', '', 'y', 'n', '2']) {
    assert.throws(() => boolFlag([`--yes=${bad}`], 'yes'), /--yes accepts/, JSON.stringify(bad));
    assert.throws(() => hasFlag([`--yes=${bad}`], 'yes'), /--yes accepts/, JSON.stringify(bad));
  }
});

/**
 * This used to read the first occurrence and drop the rest silently, so
 * `--yes=false --yes=true` declined without ever saying that a `--yes=true`
 * had been discarded. On `--yes` the discarded token is a decision about
 * whether an item starts governing the project.
 */
test('a boolean flag given as both true and false is refused, not resolved silently', () => {
  assert.throws(() => boolFlag(['--yes=false', '--yes=true'], 'yes'), /both true and false/);
  assert.throws(() => boolFlag(['--yes', '--yes=no'], 'yes'), /both true and false/);
  assert.throws(() => hasFlag(['--yes=false', '--yes'], 'yes'), /both true and false/);
});

test('a boolean flag repeated in agreement is not an error — it asks for one thing twice', () => {
  assert.equal(boolFlag(['--json', '--json=true'], 'json'), true);
  assert.equal(boolFlag(['--json=off', '--json=0'], 'json'), false);
});

test('boolFlag does not consume the next token as a value', () => {
  // `--yes false` is a bare flag followed by a positional, not a value form:
  // `positionals()` only skips the next token for declared value-flags, so
  // reading it here would make the two parsers disagree about the same argv.
  assert.equal(boolFlag(['--yes', 'false'], 'yes'), true);
  assert.deepEqual(positionals(['--yes', 'false'], []), ['false']);
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
