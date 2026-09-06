/**
 * `POST /api/command/check` — the parse-without-executing gate (plan:builder
 * seq:4).
 *
 * **Two claims are worth testing here and everything else is scaffolding for
 * them.**
 *
 *   1. **It cannot disagree with the CLI.** The item's requirement is that the
 *      UI's check and the CLI's refusal are the same code. That is not provable
 *      by reading the imports, so `the endpoint's verdict is the CLI's verdict,
 *      for every command string` hands the SAME argv to both and fails on any
 *      command where they differ — swept over every command the registry
 *      dispatches, in both directions: a line the endpoint accepts and the CLI
 *      refuses, and a line the endpoint refuses and the CLI takes.
 *   2. **It cannot execute, and that is structural.** The item asks for the
 *      bound `recordRefusal` has: not a promise in a comment but a property
 *      that fails when it stops holding. `nothing this endpoint can reach is
 *      able to start a process` walks the module's real transitive import graph
 *      and fails if `execute.ts`, `execute-catalogue.ts`, `src/cli/index.ts` or
 *      `node:child_process` ever becomes reachable from it.
 *
 * The sweep runs the real CLI, so it runs in a throwaway workspace — the
 * established shape for a parse probe in this repository (`palette-lib.test.ts`
 * · `function workspace()`). Nothing it sends gets past flag validation, which
 * is the whole point of the sentinel, and the run-wide `installRealHomeGuard`
 * would abort the run if anything did.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { COMMAND_FLAGS, SUBCOMMAND_FLAGS } from '../../src/core/command-flags.ts';
import { EDIT_FLAGS } from '../../src/core/edit-flags.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { apiCommandCheck, checkCommand } from '../../src/ui/read-model-command.ts';
import { registeredRoutes } from '../../src/ui/routes.ts';
import { registerReadRoutes } from '../../src/ui/server.ts';
import { commandStrings, SENTINEL } from '../helpers/approval-boundary.ts';
import { sandbox } from '../helpers/workspace.ts';

const check = (cwd: string, argv: string[]) => checkCommand(resolveWorkspace(cwd), argv);

/** `mycontext …`, the way a page composes it. */
const line = (...words: string[]): string[] => ['mycontext', ...words];

test('/api/command/check is registered, so a page can actually reach it', () => {
  registerReadRoutes();
  assert.ok(
    registeredRoutes().some((r) => r.method === 'POST' && r.path === '/api/command/check'),
    'the read model exists and nothing serves it. `registerCommandRoutes` must be called from ' +
    '`registerReadRoutes`, for the same two reasons the calls beside it give — a model that ' +
    'answers is not a route that is served, and `server-e2e.test.ts`\'s sweep accepts a 404.',
  );
});

/**
 * **The bound the item asked for, measured rather than promised.**
 *
 * `recordRefusal` is structurally unable to record a served read because it
 * refuses to write a record that is not a refusal. A checker has no output to
 * guard that way, so the equivalent bound is on REACHABILITY: the one thing
 * that could ever run a command is a module that can start a process, and none
 * is reachable from here.
 *
 * The walk is deliberately crude and deliberately whole-graph. It follows every
 * relative specifier transitively and collects every bare specifier it meets,
 * so a `node:child_process` three modules deep is caught exactly as one at the
 * top would be. `no-writes.test.ts` owns the sophisticated version of this walk
 * for the whole server; this is the same idea aimed at one module, and it
 * exists because the server's graph LEGITIMATELY contains `execute.ts` — the
 * question here is not whether this server can run anything, it is whether THIS
 * ENDPOINT can.
 */
const FORBIDDEN_MODULES = [
  'src/ui/execute.ts', 'src/ui/execute-catalogue.ts', 'src/ui/execute-effect.ts',
  'src/ui/execute-nonce.ts', 'src/cli/index.ts',
];
const FORBIDDEN_BARE = ['node:child_process', 'child_process'];

function graphFrom(entry: string): { files: Set<string>; bare: Set<string> } {
  const files = new Set<string>();
  const bare = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (files.has(file)) continue;
    files.add(file);
    const source = readFileSync(file, 'utf8');
    // `from '…'` and bare side-effect imports, static and dynamic alike. A
    // pattern that missed `await import(…)` would miss exactly the escape hatch
    // a later change would reach for.
    for (const m of source.matchAll(/(?:from|import)\s*\(?\s*(['"])([^'"]+)\1/g)) {
      const spec = m[2];
      if (spec.startsWith('.')) queue.push(path.resolve(path.dirname(file), spec));
      else bare.add(spec);
    }
  }
  return { files, bare };
}

test('nothing this endpoint can reach is able to start a process', () => {
  const repo = path.resolve(import.meta.dirname, '../..');
  const entry = path.join(repo, 'src', 'ui', 'read-model-command.ts');
  const { files, bare } = graphFrom(entry);

  // Anti-vacuity: a walk that resolved nothing would pass every assertion
  // below, which is the failure mode this whole test is guarding against in
  // someone else's code.
  assert.ok(
    files.size > 3,
    `the walk reached ${files.size} files from read-model-command.ts. It imports more than ` +
    'that, so the specifier pattern has stopped matching and this test now proves nothing.',
  );

  const reachable = [...files].map((f) => path.relative(repo, f).split(path.sep).join('/'));
  const forbidden = FORBIDDEN_MODULES.filter((m) => reachable.includes(m));
  assert.deepEqual(
    forbidden, [],
    'the command CHECKER can now reach a module that runs commands. That is the one property ' +
    'plan:builder seq:4 asks to be structural rather than promised: the endpoint must be ' +
    'unable to run a command even if a later change tried to. Whatever needed this import ' +
    'belongs behind POST /api/execute, which has a nonce, a confirm and `runnable: true`.',
  );
  const spawners = FORBIDDEN_BARE.filter((m) => bare.has(m));
  assert.deepEqual(
    spawners, [],
    'a module reachable from the command checker imports a process spawner. See above — this ' +
    'endpoint answers, it does not act.',
  );

  // The walk is proved able to FAIL, on a module that really does spawn: the
  // server itself reaches `execute.ts`, which holds this server's one execFile.
  const control = graphFrom(path.join(repo, 'src', 'ui', 'execute.ts'));
  assert.ok(
    FORBIDDEN_BARE.some((m) => control.bare.has(m)),
    'the detector no longer notices `node:child_process` in a module that plainly imports it, ' +
    'so the assertions above are green for the wrong reason.',
  );
});

/**
 * **The claim that the check and the refusal cannot disagree, made checkable.**
 *
 * Every command string the registry dispatches is handed the sentinel flag —
 * a flag no command accepts — and both surfaces are asked. They must agree,
 * and then the same command string is asked again WITHOUT the sentinel and
 * they must agree the other way, so a checker that simply refused everything
 * would fail as loudly as one that accepted everything.
 *
 * The second half is the one that needs the care. A bare `mycontext add` is
 * refused by the CLI — for a missing positional, which is PAST the flag gate
 * and is a refusal this endpoint deliberately does not make. So the agreement
 * asserted there is narrower and exact: the CLI must not refuse it for a FLAG,
 * which is the only question the endpoint answers.
 */
const FLAG_REFUSALS = ['unknown option "', 'unknown flag "', 'was passed'];

/**
 * The one command string this sweep will not hand to the real CLI, and the
 * reason is not that the check is weak.
 *
 * `mycontext ui` STARTS THIS SERVER. Its flag validation may well refuse the
 * sentinel before it binds a socket, and the reason that is not good enough is
 * that being wrong costs the developer's own running server: a second server
 * rewrites the global record at `~/.my-context/ui-server.json` and captures
 * `mycontext ui` until it dies. A test that is probably safe against a cost
 * that lands on somebody else's machine is not a trade worth taking for one
 * command's coverage, and the endpoint's answer for `ui` is still asserted
 * below — it is only the CLI half that is withheld.
 */
const NOT_PROBED: Record<string, string> = {
  ui: 'starts the web server. See the comment above — the CLI half is withheld, not the check.',
};

test('the endpoint\'s verdict is the CLI\'s verdict, for every command string', () => {
  const box = sandbox();
  try {
    const run = (argv: string[]): string => {
      const lines: string[] = [];
      try { runCli(argv, box.cwd, (s) => lines.push(s)); }
      catch (err) { lines.push(`THREW: ${(err as Error).message}`); }
      return lines.join('\n');
    };
    const refusedForAFlag = (text: string): boolean =>
      FLAG_REFUSALS.some((marker) => text.includes(marker));

    const strings = commandStrings();
    assert.ok(strings.length > 40, `commandStrings() returned ${strings.length}; derivation broken`);

    const disagreements: string[] = [];
    let compared = 0;
    let refusedByBoth = 0;

    for (const command of strings) {
      const words = command.split(' ');

      // (a) With a flag nothing accepts. **Nothing is assumed about what the
      //     CLI will do** — the CLI is asked, and the endpoint must give the
      //     same answer. That distinction is the whole test: the first draft
      //     asserted that every command refuses the sentinel, which is a claim
      //     about the CLI and is false for the three commands that validate no
      //     flags. Asking both and comparing cannot be wrong that way.
      const verdict = check(box.cwd, [...line(...words), SENTINEL]);
      if (!Object.hasOwn(NOT_PROBED, command)) {
        compared += 1;
        const cliRefuses = refusedForAFlag(run([...words, SENTINEL]));
        if (cliRefuses) refusedByBoth += verdict.ok ? 0 : 1;
        if (verdict.ok === cliRefuses) {
          disagreements.push(
            `${command} ${SENTINEL}: the CLI ${cliRefuses ? 'refused' : 'accepted'} it and the `
            + `endpoint answered ${verdict.ok ? 'ok' : JSON.stringify(verdict.code)}`);
        }
        // A refusal must be for the right REASON as well as in the right
        // direction: `unknown-option` and not, say, `unknown-command`.
        if (!verdict.ok && cliRefuses && verdict.code !== 'unknown-option') {
          disagreements.push(
            `${command} ${SENTINEL}: refused as ${JSON.stringify(verdict.code)}, not as a flag`);
        }
      } else if (verdict.ok) {
        // The CLI half is withheld for `ui`, so the endpoint half is asserted
        // on its own: it has a flag spec, so it must refuse the sentinel.
        disagreements.push(`${command} ${SENTINEL}: the endpoint accepted a flag nothing takes`);
      }

      // (b) Without it. The endpoint checks flag NAMES and there are none, so
      //     it must accept — and the CLI must not refuse for a FLAG either.
      const clean = check(box.cwd, line(...words));
      if (!clean.ok) {
        disagreements.push(`${command}: the endpoint refused a line with no flags on it — `
          + `${clean.error ?? ''}`);
      }
      if (!Object.hasOwn(NOT_PROBED, command) && refusedForAFlag(run(words))) {
        disagreements.push(`${command}: the CLI refused a FLAG on a line that has none`);
      }
    }

    assert.deepEqual(disagreements, [], 'the check and the CLI disagree about what parses');
    assert.ok(compared > 40, `only ${compared} command strings reached the real CLI`);
    // Anti-vacuity: an endpoint that answered `ok` to everything would agree
    // with the CLI on the three flagless commands and disagree on the rest, so
    // this cannot pass by accident — but it is asserted rather than reasoned.
    assert.ok(
      refusedByBoth > 40,
      `only ${refusedByBoth} command strings were refused by BOTH surfaces. The sweep is ` +
      'passing without exercising the refusal path, which is the half that matters.',
    );

    // Every withheld row is still a real command string, so an excuse cannot
    // outlive the command it excuses.
    assert.deepEqual(
      Object.keys(NOT_PROBED).filter((c) => !strings.includes(c)), [],
      'NOT_PROBED names a command string the registry does not have',
    );
  } finally { box.dispose(); }
});

/**
 * Every argv the catalogue composes must pass the check — which ties seq:4 to
 * seq:3's gate rather than leaving two lists to agree by luck.
 *
 * `palette-lib.test.ts` already proves those argvs parse, by running the real
 * CLI. This proves the ENDPOINT says so too, which is the fact `builder/6`
 * depends on: it will refuse a Copy on a `false` from here, so a catalogue
 * entry the checker rejects is a button that can never be pressed.
 */
test('every command string the catalogue composes passes the check', async () => {
  const defs = (await import(
    new URL('../../src/ui/public/lib/palette-defs.js', import.meta.url).href
  )) as { PALETTE: { base: string[] }[] };
  const box = sandbox();
  try {
    const refused = defs.PALETTE
      .map((def) => ({ def, verdict: check(box.cwd, [...def.base]) }))
      .filter(({ verdict }) => !verdict.ok)
      .map(({ def, verdict }) => `${def.base.join(' ')}: ${verdict.error ?? ''}`);
    assert.deepEqual(
      refused, [],
      'the checker refuses a command the catalogue composes. builder/6 gates Copy on this ' +
      'verdict, so these entries would become buttons that can never be pressed.',
    );
    assert.ok(defs.PALETTE.length > 20, 'the catalogue came back too small to prove anything');
  } finally { box.dispose(); }
});

test('an unknown command is refused, in the CLI\'s own sentence', () => {
  const box = sandbox();
  try {
    const verdict = check(box.cwd, line('nosuchcommand', '--json'));
    assert.equal(verdict.ok, false);
    assert.equal(verdict.code, 'unknown-command');
    assert.equal(verdict.command, null, 'there is no command string to name');
    assert.match(verdict.error ?? '', /^my_context: unknown command "nosuchcommand"\.$/);
  } finally { box.dispose(); }
});

test('an unknown subcommand is refused, and a known one scopes the flags', () => {
  const box = sandbox();
  try {
    const bad = check(box.cwd, line('review', 'nosuchsub'));
    assert.equal(bad.ok, false);
    assert.equal(bad.code, 'unknown-subcommand');
    assert.match(bad.error ?? '', /^my_context: unknown review subcommand "nosuchsub"\.$/);

    // `--pack` is a `review promote` flag and NOT a `review list` flag, so the
    // subcommand is what decides the answer. A checker that used the command's
    // union everywhere would accept both and be useless exactly where a
    // composer needs it.
    assert.ok(SUBCOMMAND_FLAGS['review']['promote'].allowed.includes('pack'));
    assert.ok(!SUBCOMMAND_FLAGS['review']['list'].allowed.includes('pack'));
    assert.equal(check(box.cwd, line('review', 'promote', 'X', '--pack', 'p')).ok, true);
    const listed = check(box.cwd, line('review', 'list', '--pack', 'p'));
    assert.equal(listed.ok, false);
    assert.equal(listed.flag, 'pack');
    assert.equal(listed.command, 'review list', 'the answer names what it actually parsed');
  } finally { box.dispose(); }
});

test('a bare subcommanded command is answered against the union, and says so', () => {
  const box = sandbox();
  try {
    const verdict = check(box.cwd, line('review', '--pack', 'p'));
    assert.equal(verdict.ok, true, 'no subcommand accepts nothing — the union does');
    assert.ok(
      verdict.unchecked.some((s) => s.includes('No subcommand was given')),
      'the union answer must name itself. It cannot refuse a line the CLI would take, but it ' +
      'can accept a flag belonging to a subcommand other than the default, and a caller that ' +
      'is not told that will read `ok` as more than it is.',
    );
  } finally { box.dispose(); }
});

test('the unknown-option refusal is the CLI\'s sentence, and names the flag', () => {
  const box = sandbox();
  try {
    const verdict = check(box.cwd, line('list', '--nosuchflag'));
    assert.equal(verdict.ok, false);
    assert.equal(verdict.code, 'unknown-option');
    assert.equal(verdict.flag, 'nosuchflag');
    assert.equal(verdict.error, 'my_context: unknown option "--nosuchflag".');
    // The same sentence the CLI prints, verbatim — the first line of it.
    const lines: string[] = [];
    runCli(['list', '--nosuchflag'], box.cwd, (s) => lines.push(s));
    assert.equal(lines.join('\n').split('\n')[0], verdict.error);
  } finally { box.dispose(); }
});

/**
 * `--flag=value` and `--flag value` are the same walk, because it is literally
 * the CLI's walk. This is the case a re-implementation gets wrong: a value flag
 * spelled with `=` must NOT swallow the next token, and one spelled with a
 * space must.
 */
test('value flags are walked exactly as the parser walks them', () => {
  const box = sandbox();
  try {
    // `search --type` takes a value; `list` does NOT accept `--type` at all,
    // which is worth stating here because it is easy to assume otherwise —
    // `mycontext list rule` filters by a POSITIONAL, and the composed line that
    // looks like a flag is a different command surface entirely.
    assert.ok(COMMAND_FLAGS['search'].values.includes('type'));
    assert.ok(!COMMAND_FLAGS['list'].allowed.includes('type'));
    assert.equal(check(box.cwd, line('search', '--type=rule')).ok, true);
    assert.equal(check(box.cwd, line('search', '--type', 'rule')).ok, true);
    assert.equal(check(box.cwd, line('list', '--type', 'rule')).ok, false);
    // The token a value flag swallows is never read as a flag, even when it
    // looks like one would be refused.
    assert.equal(check(box.cwd, line('search', '--type', '--nosuchflag')).ok, true);
    // And with `=`, nothing is swallowed, so the next token IS checked.
    const caught = check(box.cwd, line('search', '--type=rule', '--nosuchflag'));
    assert.equal(caught.ok, false);
    assert.equal(caught.flag, 'nosuchflag');
  } finally { box.dispose(); }
});

/**
 * `edit` is the one command whose answer is about THIS project rather than
 * about the CLI, and a static checker would be wrong in the next repository.
 */
test('edit is checked against the flags this workspace declares', () => {
  // `read-model-flags.test.ts` · `DECLARES_STATE` — the same fixture, because
  // what makes a declaration a real `mycontext edit` flag (`store: 'field'` and
  // a `command` naming the command) is that test's finding and not this one's.
  const box = sandbox({
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
  });
  try {
    const ws = resolveWorkspace(box.cwd);
    const verdict = checkCommand(ws, line('edit', 'RULE-x', '--state', 'open'));
    assert.equal(
      verdict.ok, true,
      '--state is declared by this project\'s task category, so `mycontext edit --state` parses ' +
      'HERE. A checker reading the static EDIT_FLAGS would refuse a command the CLI accepts.',
    );
    assert.ok(!EDIT_FLAGS.allowed.includes('state'), 'the static list must NOT hold it');
    assert.ok(
      verdict.checked.some((s) => s.includes('computed from this project')),
      'the per-workspace answer must say that it is one',
    );
  } finally { box.dispose(); }
});

/**
 * **A command that validates NO flags is not a command that refuses them, and
 * this test exists because the first draft got it backwards.**
 *
 * `FLAGLESS_COMMANDS` was given an empty spec, which made every `--flag` on
 * `help`, `rebuild` and `show` an `unknown-option`. The agreement sweep caught
 * it: the CLI refuses none of the three. That is the dangerous direction — a
 * false REFUSAL — because `builder/6` blocks the Copy on this verdict, so a
 * person would have been stopped from copying a line their own terminal takes.
 *
 * So the answer is `ok: true` with the limit named, and both halves are
 * asserted here: the verdict, and the sentence that keeps `ok` from being read
 * as more than it is.
 */
test('a command that validates no flags is accepted, and the limit is named', () => {
  const box = sandbox();
  try {
    for (const name of ['rebuild', 'help', 'show']) {
      const verdict = check(box.cwd, line(name, '--nosuchflag'));
      assert.equal(
        verdict.ok, true,
        `${name} does not refuse flags, so neither may this. A refusal the CLI would not make ` +
        'is the one failure this endpoint must never produce.',
      );
      assert.ok(
        verdict.unchecked.some((s) => s.includes('NO flag validation')),
        `${name}: an unbounded ok is worse than a refusal — the limit must be in the answer`,
      );
      // And the CLI really does take it, so this is agreement rather than a
      // softened assertion.
      const out: string[] = [];
      runCli([name, '--nosuchflag'], box.cwd, (s) => out.push(s));
      assert.ok(
        !out.join('\n').includes('unknown option "'),
        `${name} now refuses an unknown flag. It has grown a parser — give it a spec in ` +
        'COMMAND_FLAGS and this branch stops being right.',
      );
    }
  } finally { box.dispose(); }
});

/**
 * **Every answer says what it did not look at.** `builder/6` refuses a Copy on
 * this verdict, so an `ok: true` that reads as "this command will work" is the
 * failure mode worth testing for: the refusal a person cannot act on is bad,
 * and an approval nobody bounded is worse.
 */
test('every answer discloses what it did not check', () => {
  const box = sandbox();
  try {
    for (const argv of [
      line('list'), line('list', '--nosuchflag'), line('nosuchcommand'),
      line('review', 'nosuchsub'), line('review', 'promote', 'X'),
    ]) {
      const verdict = check(box.cwd, argv);
      assert.ok(verdict.unchecked.length >= 3, `${argv.join(' ')}: nothing was disclosed`);
      assert.ok(verdict.checked.length >= 1, `${argv.join(' ')}: nothing was claimed either`);
      assert.ok(
        verdict.unchecked.some((s) => s.includes('positional')),
        `${argv.join(' ')}: arity is the limit a composer is most likely to hit, and it is not ` +
        'named. An undisclosed limit is the promise this endpoint must never make.',
      );
    }
  } finally { box.dispose(); }
});

/**
 * `mycontext init` refuses a flag in a sentence of its own, so the endpoint says
 * so rather than passing off the shared wording as init's.
 *
 * The exception is RE-CHECKED here rather than merely declared: the day `init`
 * starts using `refuseUnknownFlag` like everything else, this fails and the note
 * comes out, instead of standing as a warning about a difference that has gone.
 */
test('init\'s own refusal wording is disclosed, and it really is its own', () => {
  const box = sandbox();
  try {
    const verdict = check(box.cwd, line('init', '--nosuchflag'));
    assert.equal(verdict.ok, false, 'init does refuse an unknown flag');
    assert.ok(
      verdict.unchecked.some((s) => s.includes('words this refusal itself')),
      'the endpoint returns the SHARED sentence for init, so it must say that init\'s own ' +
      'terminal output will read differently',
    );
    const out: string[] = [];
    runCli(['init', '--nosuchflag'], box.cwd, (s) => out.push(s));
    assert.ok(
      !out.join('\n').includes('unknown option "--nosuchflag"'),
      'init now uses the shared refusal wording. The endpoint\'s sentence is exact for it, so ' +
      'delete its OWN_REFUSAL_WORDING row rather than leaving a note about a difference that ' +
      'no longer exists.',
    );
  } finally { box.dispose(); }
});

test('a body the route cannot read is a 400, and a refused command is a 200', () => {
  const box = sandbox();
  try {
    const ws = resolveWorkspace(box.cwd);
    const url = new URL('http://localhost/api/command/check');
    const status = (body: unknown): number => apiCommandCheck(ws, url, body).status;

    assert.equal(status(undefined), 400, 'no body at all');
    assert.equal(status({}), 400, 'no argv field');
    assert.equal(status({ argv: 'mycontext list' }), 400, 'a string is not an argv');
    assert.equal(status({ argv: ['mycontext', 7] }), 400, 'a number is not an argument');
    assert.equal(status({ argv: ['list'] }), 400, 'the composed line starts with the binary');
    assert.equal(status({ argv: ['mycontext'] }), 400, 'a binary with no command is not a line');

    // The distinction the precedent exists to make: a command this endpoint
    // REFUSES is a question answered, not a request it could not read.
    const refused = apiCommandCheck(ws, url, { argv: line('list', '--nosuchflag') });
    assert.equal(refused.status, 200, 'a refusal is this endpoint\'s success case');
    assert.equal((refused.body as { ok: boolean }).ok, false);

    // An unexpected query parameter is refused the way every read model
    // refuses one; the endpoint takes its whole input in the body.
    const withParam = new URL('http://localhost/api/command/check?argv=x');
    assert.equal(apiCommandCheck(ws, withParam, { argv: line('list') }).status, 400);
  } finally { box.dispose(); }
});

/**
 * The four flag records partition the registry — `command-flags.test.ts` owns
 * that assertion — and this is the consequence that matters here: there is no
 * command the checker has to answer "I do not know" for. A hole would surface
 * as `unknown-command` on a command that plainly exists, which is a REFUSAL and
 * would block a Copy that should have been allowed.
 */
test('no command the CLI dispatches is unknown to the checker', () => {
  const box = sandbox();
  try {
    const unknown = commandStrings()
      .map((c) => ({ c, v: check(box.cwd, line(...c.split(' '))) }))
      .filter(({ v }) => v.code === 'unknown-command')
      .map(({ c }) => c);
    assert.deepEqual(
      unknown, [],
      'the checker does not recognise a command the registry dispatches. The four flag records ' +
      'in core/command-flags.ts are supposed to partition the registry exactly; a gap there ' +
      'reaches a reader as a refusal for a command that exists.',
    );
    assert.ok(Object.keys(COMMAND_FLAGS).length > 20, 'the flag map came back too small');
  } finally { box.dispose(); }
});
