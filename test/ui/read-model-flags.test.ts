/**
 * `GET /api/flags` — what every command accepts and what may be put in each
 * flag, for THIS workspace (plan:builder seq:2b).
 *
 * **The one assertion that matters is the last one, and everything above it is
 * scaffolding for it.** A route that reports a flag surface is worth exactly as
 * much as its agreement with the parser, and for twenty-nine commands that
 * agreement is already held by `test/cli/command-flags.test.ts`, which probes
 * every lifted spec against the real CLI. `edit` is the command that cannot be
 * covered that way, because the answer depends on a config file: the surface is
 * `[...EDIT_FLAGS.allowed, ...declaredEditFlags(config)]`, and a project that
 * declares `--state` on one of its categories accepts a flag no other project
 * does.
 *
 * So the last test builds a workspace that declares one, asks this route what
 * `edit` takes there, and then hands the real CLI a command line built from
 * that answer AND one built against it. A route that reported the static
 * eleven, or that reported the declared name without the command accepting it,
 * fails — and both of those are what a builder driven by a static catalogue
 * would have done.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCli } from '../../src/cli/index.ts';
import { COMMAND_FLAGS, FLAG_DECLARATIONS } from '../../src/core/command-flags.ts';
import { EDIT_FLAGS, editFlagSurface } from '../../src/core/edit-flags.ts';
import { apiFlags, type CommandFlagView } from '../../src/ui/read-model-flags.ts';
import { registerReadRoutes } from '../../src/ui/server.ts';
import { registeredRoutes } from '../../src/ui/routes.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { sandbox } from '../helpers/workspace.ts';

/** The route's body, typed to what this test reads out of it. */
interface FlagsBody {
  commands: Record<string, CommandFlagView>;
  unlinkArity: number;
}

const bodyOf = (cwd: string): FlagsBody => {
  const result = apiFlags(resolveWorkspace(cwd));
  assert.equal(result.status, 200);
  return result.body as unknown as FlagsBody;
};

/**
 * **That the model ANSWERS is not that the server serves it**, and the gap is
 * not theoretical: `server-e2e.test.ts`'s no-write sweep accepts a 404 on
 * purpose — a refusal writes an audit record, so the sweep must not treat one
 * as a failure — which means an unregistered route passes the sweep in silence.
 * It was measured that way: commenting out `registerFlagRoutes()` left every
 * test in this repository green except this one.
 */
test('/api/flags is registered, so a screen can actually reach it', () => {
  registerReadRoutes();
  assert.ok(
    registeredRoutes().some((r) => r.method === 'GET' && r.path === '/api/flags'),
    'the read model exists and nothing serves it. `registerFlagRoutes` must be called from ' +
    '`registerReadRoutes`, inside the guard, for the two reasons its own comment gives.',
  );
});

test('/api/flags answers for every command with a spec, and for edit as well', () => {
  const box = sandbox();
  try {
    const body = bodyOf(box.cwd);
    assert.deepEqual(
      Object.keys(body.commands).sort(),
      [...Object.keys(COMMAND_FLAGS), 'edit'].sort(),
      'the route and the flag specs disagree about which commands exist. `edit` is the one key ' +
      'that is not in COMMAND_FLAGS, and it is here BECAUSE it is not: a builder must not have ' +
      'to know which command is the per-workspace one.',
    );
    // Not a spot check: every command's declaration set is served whole, or a
    // builder falls back to a bare text box for whichever flag was dropped.
    for (const [name, spec] of Object.entries(COMMAND_FLAGS)) {
      const view = body.commands[name];
      assert.deepEqual(view.allowed, spec.allowed, `${name}: allowed does not match the spec`);
      assert.deepEqual(view.values, spec.values, `${name}: values do not match the spec`);
      assert.deepEqual(
        Object.keys(view.flags).sort(), Object.keys(FLAG_DECLARATIONS[name]).sort(),
        `${name}: the served declarations are not the declared ones`,
      );
    }
    assert.equal(body.unlinkArity, 2, '`--unlink <relation> <target>` takes two operands, and a ' +
      'builder that does not know that composes a flag with nothing after it');
  } finally { box.dispose(); }
});

test('a project that declares nothing of its own gets edit\'s eleven and no more', () => {
  const box = sandbox();
  try {
    const edit = bodyOf(box.cwd).commands['edit'];
    assert.deepEqual(
      edit.declared, [],
      'the shipped catalogue derives no edit flag — every declared name either has no `command` ' +
      '(so it is the generic --extra spelling) or names `pin`/`harden`. A non-empty answer here ' +
      'means `isEditFlag` has started matching something it should not.',
    );
    assert.deepEqual(edit.allowed, EDIT_FLAGS.allowed);
    const undescribed = edit.allowed.filter((flag) => !Object.hasOwn(edit.flags, flag));
    assert.deepEqual(
      undescribed, [],
      'a flag `edit` accepts with nothing said about it renders as a bare text box, which is ' +
      'the state this whole plan exists to end.',
    );
  } finally { box.dispose(); }
});

/**
 * The config a project would write to make `--state` a real `mycontext edit`
 * flag: `store: 'field'` (a tag is a membership and only `--tags` writes one)
 * and a `command` naming THIS command, which is the whole test `isEditFlag`
 * applies — `mycontext help categories` prints that string verbatim as the
 * spelling a person types, so anything else would let the printed instruction
 * and the accepted argv drift.
 */
const DECLARES_STATE = {
  profile: 'standard',
  categories: {
    rule: {
      updates: {
        state: {
          store: 'field',
          command: 'mycontext edit <id> --state=<value>',
          values: ['open', 'closed'],
          note: 'Whether this project still considers the rule live.',
        },
      },
    },
  },
  budgets: {},
};

test('a declared edit flag is served, described from the declaration, and ACCEPTED by the CLI', () => {
  const box = sandbox(DECLARES_STATE);
  try {
    const edit = bodyOf(box.cwd).commands['edit'];
    assert.deepEqual(
      edit.declared, ['state'],
      'the workspace declares --state on `rule` and the route did not report it. A builder ' +
      'reading a STATIC catalogue would compose without it, which is exactly the failure this ' +
      'endpoint exists to prevent.',
    );
    assert.ok(edit.allowed.includes('state'), 'the declared flag is missing from `allowed`');
    assert.ok(edit.values.includes('state'), 'a declared flag takes a value; this one does not');

    // Described from the config's own declaration rather than from a second
    // description invented here: `UpdatableName` already carries the closed
    // vocabulary and the sentence, which is why seq:2 took its shape.
    assert.deepEqual(edit.flags['state'].values, ['open', 'closed']);
    assert.match(edit.flags['state'].note, /still considers the rule live/);

    // ── the half that makes the answer worth anything ──────────────────────
    //
    // The sentinel behind each flag, exactly as `command-flags.test.ts` probes:
    // an ACCEPTED flag is followed by a refusal on the sentinel, so `cmdEdit`
    // stops at flag validation and writes nothing either way.
    const SENTINEL = '--zzz-not-a-flag-any-command-accepts';
    const run = (argv: string[]): string => {
      const lines: string[] = [];
      try { runCli(argv, box.cwd, (s) => lines.push(s)); }
      catch (err) { lines.push(`THREW: ${(err as Error).message}`); }
      return lines.join('\n');
    };
    const refuses = (text: string, flag: string): boolean =>
      text.includes(`unknown flag "${flag}"`) || text.includes(`unknown option "${flag}"`);

    for (const flag of edit.allowed) {
      // `--unlink` is the one flag the joined form cannot carry, and the CLI
      // says so in a sentence of its own: it names a relation AND a target, as
      // two words. So it is probed in the shape it actually takes — which is
      // the fact `unlinkArity` publishes, checked here rather than asserted in
      // prose. A probe that skipped it would leave the one flag no
      // `{ allowed, values }` record describes as the one flag nothing tests.
      const argv = flag === 'unlink'
        ? ['edit', 'RULE-anything', '--unlink', 'refines', 'RULE-other', SENTINEL]
        : ['edit', 'RULE-anything', `--${flag}=x`, SENTINEL];
      const answer = run(argv);
      assert.ok(
        !refuses(answer, `--${flag}`),
        `the route reports edit --${flag} as accepted here and the CLI refuses it`,
      );
      assert.ok(
        refuses(answer, SENTINEL),
        `edit --${flag} got past flag validation without refusing the sentinel, so this probe ` +
        'proved nothing about it',
      );
    }
    // The joined form of the two-operand flag, refused in its own words. This
    // is what `unlinkArity` is for: a builder that composed `--unlink=refines`
    // from a flag/value model would hand the user this refusal every time.
    assert.match(
      run(['edit', 'RULE-anything', '--unlink=refines']),
      /--unlink names a relation AND its target/,
      'the two-operand form of --unlink is no longer required, so `unlinkArity` is now a lie',
    );

    // And the other direction, which is what stops the route answering "yes"
    // to everything: a name this workspace did NOT declare is refused.
    assert.ok(
      refuses(run(['edit', 'RULE-anything', '--phase=x', SENTINEL]), '--phase'),
      'the CLI accepted a flag no category declares, so `allowed` is not the accepted set',
    );
  } finally { box.dispose(); }
});

test('editFlagSurface is the function cmdEdit parses with, not a second one beside it', () => {
  const box = sandbox(DECLARES_STATE);
  try {
    const ws = resolveWorkspace(box.cwd);
    const surface = editFlagSurface(ws.config);
    assert.deepEqual(
      surface.allowed, [...EDIT_FLAGS.allowed, ...surface.declared],
      'the resolved surface is not the base plus the declared names, which is the composition ' +
      '`cmdEdit` performs. Two compositions of one answer is the drift this plan exists to end.',
    );
    assert.deepEqual(surface.values, [...EDIT_FLAGS.values, ...surface.declared]);
  } finally { box.dispose(); }
});
