/**
 * **The `cli` topic's flag reference, and the property that makes it worth
 * having: it is DERIVED from `COMMAND_FLAGS` and `FLAG_DECLARATIONS`
 * (`core/command-flags.ts`), not written down.**
 *
 * Until now `cli.md` said, in its own words, that it would never print a
 * per-command flag list: "a second copy of a per-command flag list is stale
 * the day a flag is added, and nothing would tell you." That was true of a
 * HAND-KEPT list. It stops being true the moment the list is generated from
 * the same declarations `FLAG_DECLARATIONS` (`plan:builder seq:2`) already
 * keeps in step with the real parser — `test/cli/command-flags.test.ts`
 * requires `Object.keys(FLAG_DECLARATIONS)` to equal `Object.keys(COMMAND_FLAGS)`
 * and every accepted flag to be declared, in both directions.
 *
 * `flagReference` re-states that same guarantee as a RENDERING refusal, on
 * `relationTable`'s terms (`src/help/index.ts`): the two tables disagree in
 * silence is exactly the shape `RELATION_TABLE`'s history warns about — a
 * vocabulary of twelve documented as nine, for over a day, because nothing
 * that RENDERED the table checked the two against each other. So the tests
 * below are that test's shape, one surface over.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { flagReference, helpTopic } from '../../src/help/index.ts';
import { COMMAND_FLAGS, FLAG_DECLARATIONS } from '../../src/core/command-flags.ts';
import { resolveConfig } from '../../src/core/config.ts';
// Importing `runCli` is also what POPULATES `COMMANDS`: loading src/cli/index.ts
// registers the CLI's commands, which `{{COMMAND_LIST}}` needs to render the
// rest of the `cli` topic — see test/help/cli-topic.test.ts, same import, same reason.
import '../../src/cli/index.ts';

const CONFIG = resolveConfig({});
const REPO = path.join(import.meta.dirname, '..', '..');

const SOURCE = readFileSync(
  path.join(REPO, 'src', 'help', 'topics', 'cli.md'), 'utf8',
).replaceAll('\r\n', '\n');

function topic(): string {
  return helpTopic('cli', CONFIG);
}

/* -------------------------------------------------------------------- *
 * The guarantee: a declared flag reaches the topic.                     *
 * -------------------------------------------------------------------- */

test('every declared flag reaches mycontext help cli', () => {
  const text = topic();
  for (const [command, flags] of Object.entries(FLAG_DECLARATIONS)) {
    for (const flag of Object.keys(flags)) {
      assert.match(
        text, new RegExp(`^\\| \`${command}\` \\| \`--${flag}\` \\|`, 'm'),
        `${command} --${flag} is declared and has no row in the cli topic's flag reference`,
      );
    }
  }
  assert.equal(text.includes('{{'), false, 'an unexpanded placeholder reached the reader');
});

test('flagReference renders without throwing against the real declarations', () => {
  assert.doesNotThrow(() => flagReference());
});

/* -------------------------------------------------------------------- *
 * The refusal: acceptance and documentation cannot disagree in silence. *
 * -------------------------------------------------------------------- */

test('an accepted, undeclared flag stops the cli topic rendering, and names itself', () => {
  // `ack` is a real command with a real declared set; this widens what the
  // PARSER accepts without touching what is DECLARED, which is the exact
  // shape of a flag shipped with no note for it.
  const commandFlags = {
    ...COMMAND_FLAGS,
    ack: { ...COMMAND_FLAGS.ack, allowed: [...COMMAND_FLAGS.ack.allowed, 'zzz_flag'] },
  };
  assert.throws(
    () => flagReference(commandFlags, FLAG_DECLARATIONS),
    /ack --zzz_flag/,
  );
});

test('a declaration for a flag the command refuses is refused too', () => {
  // The opposite widening: `ack` gains a NOTE for a flag its own parser spec
  // does not accept — documenting syntax that comes back "unknown option".
  const declarations = {
    ...FLAG_DECLARATIONS,
    ack: { ...FLAG_DECLARATIONS.ack, zzz_flag: { note: 'a flag invented by this test' } },
  };
  assert.throws(
    () => flagReference(COMMAND_FLAGS, declarations),
    /ack --zzz_flag/,
  );
});

test('a note containing a pipe is refused rather than breaking the table', () => {
  const commandFlags = { zzz_cmd: { allowed: ['zzz_flag'], values: [] } };
  const declarations = { zzz_cmd: { zzz_flag: { note: 'one thing | another' } } };
  assert.throws(
    () => flagReference(commandFlags, declarations),
    /contains a "\|", which ends a cell/,
  );
});

/* -------------------------------------------------------------------- *
 * Generated, not written.                                              *
 * -------------------------------------------------------------------- */

test('cli.md carries the placeholder exactly once', () => {
  assert.equal(
    (SOURCE.match(/\{\{FLAG_REFERENCE\}\}/g) ?? []).length, 1,
    'cli.md must carry {{FLAG_REFERENCE}} exactly once — the flag reference is generated from ' +
    'COMMAND_FLAGS and FLAG_DECLARATIONS, and a pasted copy would stop tracking them the ' +
    'moment it was pasted',
  );
});

test('the cli topic serves the flag reference outside a workspace', () => {
  const text = topic();
  assert.match(text, /\| command \| flag \|/);
  assert.equal(text.includes('{{'), false, 'an unexpanded placeholder reached the reader');
});
