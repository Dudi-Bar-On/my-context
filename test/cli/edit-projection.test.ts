/**
 * `mycontext edit` against the DECLARATION — the seam `src/core/tag-projection.ts`
 * was written for, and the half of it that lives in this command.
 *
 * Two things are being pinned here and they are the same thing seen twice.
 *
 * **The projection.** A field that declares `projectsTo` is the only thing a
 * person sets; the tag generated from it is rewritten in the SAME write, by a
 * machine, so the two cannot disagree. Measured before that existed: 15 of this
 * project's 293 `task` items carried a `state` field and a `state:` tag naming
 * different values, and nothing anywhere read the prefix.
 *
 * **The refusals.** Every sentence this command prints about what may be
 * changed is COMPOSED from `TIER_UPDATES` and the category's own `updates`
 * rather than written out at the call site — so the vocabulary a refusal
 * teaches, the command it names as the one that works, and the flag this CLI
 * actually accepts are three readings of one declaration. Which is why the
 * fixtures below are CONFIG DOCUMENTS: `task` exists nowhere in `src/`, so a
 * refusal that knows its vocabulary can only have read it from the config.
 *
 * Every assertion drives the real command through `runCli` and checks the FILE
 * afterwards, because the property that matters is that a refusal arrives
 * before anything is written, and only the file can say that.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { OUTPUT_WIDTH } from '../../src/cli/commands/format.ts';
import { removeTree } from '../helpers/tmp.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

/**
 * The declaration under test, as a user would write it in `.my_context/config.json`.
 *
 * `state` is the measured case: a closed vocabulary, a projected tag, and a
 * command of its own. `plan` is beside it as free text with a projection, so
 * "no `values`" is exercised as the real answer it is rather than as a gap.
 */
const STATE = {
  store: 'field',
  values: ['todo', 'doing', 'blocked', 'done'],
  projectsTo: 'state',
  command: 'mycontext edit <id> --state <value>',
  note: 'Where this task is.',
};

function taskConfig(updates: Record<string, unknown> = { state: STATE }): unknown {
  return {
    profile: 'standard',
    categories: {
      task: {
        tier: 'rationale',
        prefix: 'TASK',
        description: 'A unit of planned work, tracked to completion.',
        extraFields: ['plan', 'seq', 'state'],
        updates,
      },
    },
  };
}

function project(config: unknown): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-editproj-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  writeFileSync(
    path.join(cwd, '.my_context', 'config.json'),
    JSON.stringify(config, null, 2) + '\n', 'utf8',
  );
  return cwd;
}

function withProject(fn: (cwd: string) => void, config: unknown = taskConfig()): void {
  const cwd = project(config);
  try {
    fn(cwd);
  } finally {
    removeTree(cwd);
  }
}

function itemFile(cwd: string, type: string, id: string): string {
  return readFileSync(path.join(cwd, '.my_context', 'items', type, `${id}.md`), 'utf8');
}

const TASK = 'TASK-wire-the-projection';

/**
 * One task carrying both halves of the projection in agreement, plus two
 * unrelated tags — which is what every assertion about "the others survive" is
 * measured against.
 */
function task(cwd: string): string {
  const { code, out } = run([
    'add', 'task', 'Wire the projection', '--body', 'Call the seam.',
    '--tags', 'plan:categories,seq:15,state:todo,v2',
    '--extra', 'state=todo', '--extra', 'plan=categories',
  ], cwd);
  assert.equal(code, 0, out);
  return TASK;
}

/** The `tags:` block of a rendered item, as a list of tag strings. */
function tagsOf(file: string): string[] {
  const block = /\ntags:\n((?:  - .*\n)*)/.exec(file);
  if (!block) return [];
  return block[1].split('\n').filter(Boolean).map((l) => l.replace(/^ {2}- /, '').replace(/^"|"$/g, ''));
}

/**
 * A sentence that may have been WRAPPED to the layout budget — every refusal
 * this command prints goes through `paragraph`, so matching a literal string
 * would assert where the wrap fell rather than what was said.
 */
function phrase(text: string): RegExp {
  return new RegExp(text.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'));
}

// --- the seam, step 2: the field moves and the tag is rewritten from it ------

test('--state writes the field and rewrites the projected tag in one write', () => {
  withProject((cwd) => {
    const id = task(cwd);
    const { code, out } = run(['edit', id, '--state', 'done'], cwd);

    assert.equal(code, 0, out);
    const file = itemFile(cwd, 'task', id);
    assert.match(file, /^state: done$/m, 'the field must hold the value');
    assert.deepEqual(
      tagsOf(file), ['plan:categories', 'seq:15', 'state:done', 'v2'],
      'the projected tag is rewritten in its own slot and every other tag survives',
    );
  });
});

test('--extra is the same door and projects identically', () => {
  withProject((cwd) => {
    const id = task(cwd);
    const { code, out } = run(['edit', id, '--extra', 'state=blocked'], cwd);

    assert.equal(code, 0, out);
    const file = itemFile(cwd, 'task', id);
    assert.match(file, /^state: blocked$/m);
    assert.ok(tagsOf(file).includes('state:blocked'), tagsOf(file).join(','));
    assert.ok(!tagsOf(file).includes('state:todo'), 'the old membership must not survive');
  });
});

test('--state at the value the item already holds changes nothing and says so', () => {
  withProject((cwd) => {
    const id = task(cwd);
    const before = itemFile(cwd, 'task', id);
    const { code, out } = run(['edit', id, '--state', 'todo'], cwd);

    assert.equal(code, 0, out);
    assert.match(out, phrase('nothing to change'));
    assert.equal(itemFile(cwd, 'task', id), before, 'an echo must not rewrite the file');
  });
});

test('--tags and --state compose: the projection lands on the replacement list', () => {
  withProject((cwd) => {
    const id = task(cwd);
    const { code, out } = run(['edit', id, '--tags', 'v2,ui', '--state', 'done'], cwd);

    assert.equal(code, 0, out);
    const file = itemFile(cwd, 'task', id);
    assert.match(file, /^state: done$/m);
    assert.deepEqual(
      tagsOf(file), ['v2', 'ui', 'state:done'],
      'neither instruction may be dropped in favour of the other',
    );
  });
});

test('a --tags list with no projected prefix is a tag list like any other', () => {
  withProject((cwd) => {
    const id = task(cwd);
    const { code, out } = run(['edit', id, '--tags', 'v2,ui'], cwd);

    assert.equal(code, 0, out);
    assert.deepEqual(tagsOf(itemFile(cwd, 'task', id)), ['v2', 'ui']);
  });
});

// --- the seam, step 1: a hand-written projected tag is refused --------------

test('--tags carrying a projected tag is refused, naming the command that works', () => {
  withProject((cwd) => {
    const id = task(cwd);
    const before = itemFile(cwd, 'task', id);
    const { code, out } = run(['edit', id, '--tags', 'v2,state:done'], cwd);

    assert.equal(code, 1, out);
    assert.match(out, phrase('is a PROJECTED tag, and my_context writes it'));
    // The command comes off the declaration, with the value the caller meant
    // substituted into it — not a sentence this command spells.
    assert.match(out, phrase('mycontext edit <id> --state done'));
    assert.match(out, phrase('Nothing was changed'));
    assert.equal(itemFile(cwd, 'task', id), before, 'a refusal must precede every write');
  });
});

test('the hand-written-tag refusal beats the field edit, rather than honouring one half', () => {
  withProject((cwd) => {
    const id = task(cwd);
    const before = itemFile(cwd, 'task', id);
    const { code } = run(['edit', id, '--tags', 'state:done', '--state', 'doing'], cwd);

    assert.equal(code, 1);
    assert.equal(itemFile(cwd, 'task', id), before);
  });
});

// --- the refusals, composed from the declaration ----------------------------

test('an illegal --state names the declared vocabulary and the declared command', () => {
  withProject((cwd) => {
    const id = task(cwd);
    const before = itemFile(cwd, 'task', id);
    const { code, out } = run(['edit', id, '--state', 'donee'], cwd);

    assert.equal(code, 1, out);
    // `enumError`'s house wording, over the vocabulary the CONFIG declared —
    // this list exists nowhere in src/.
    assert.match(out, phrase('"state" must be one of: todo, doing, blocked, done'));
    assert.match(out, phrase('You passed "donee"'));
    assert.match(out, phrase('The closest match is "done"'));
    // The half `enumError` cannot know: the value is projected, so a wrong one
    // does not merely sit in a field being wrong.
    assert.match(out, phrase('projected into the tag "state:donee"'));
    assert.match(out, phrase('mycontext edit <id> --state <value>'));
    assert.match(out, phrase('Nothing was changed'));
    assert.doesNotMatch(out, /about to edit/);
    assert.equal(itemFile(cwd, 'task', id), before);
  });
});

test('a declared flag on a category that does not declare it is refused, naming the one that does', () => {
  withProject((cwd) => {
    task(cwd);
    run(['add', 'rule', 'Never log secrets', '--body', 'Not at any level.', '--yes'], cwd);
    const id = 'RULE-never-log-secrets';
    const before = itemFile(cwd, 'rule', id);
    const { code, out } = run(['edit', id, '--state', 'done'], cwd);

    assert.equal(code, 1, out);
    assert.match(out, phrase('"--state" is not something a "rule" declares'));
    // Composed from the declaration on both sides: what a `rule` does declare,
    // and who declares the name that was typed.
    assert.match(out, phrase('A "rule" declares its own: directive'));
    assert.match(out, phrase('"--state" is declared by task'));
    assert.match(out, phrase('Nothing was changed'));
    assert.equal(itemFile(cwd, 'rule', id), before);
  });
});

test('a narrowed status is refused in the declaration\'s own words, not the global list', () => {
  withProject((cwd) => {
    const id = task(cwd);
    const before = itemFile(cwd, 'task', id);
    const { code, out } = run(['edit', id, '--status', 'deprecated'], cwd);

    assert.equal(code, 1, out);
    assert.match(out, phrase('"status" must be one of: draft, active'));
    assert.match(out, phrase('You passed "deprecated"'));
    assert.equal(itemFile(cwd, 'task', id), before);
  }, taskConfig({
    state: STATE,
    status: {
      store: 'field',
      values: ['draft', 'active'],
      command: 'mycontext edit <id> --status <status>',
      note: 'A task is drafted or active; it is retired by being done.',
    },
  }));
});

test('--severity hard on a rationale category keeps the refusal it has today', () => {
  withProject((cwd) => {
    const id = task(cwd);
    const { code, out } = run(['edit', id, '--severity', 'hard'], cwd);

    assert.equal(code, 1, out);
    assert.match(out, phrase('only governs on the normative tier'));
    assert.match(out, phrase('Nothing was changed'));
  });
});

// --- the flag surface IS the declaration ------------------------------------

test('a declaration whose command is the generic --extra spelling grows no flag', () => {
  withProject((cwd) => {
    const id = task(cwd);
    const { code, out } = run(['edit', id, '--state', 'done'], cwd);

    assert.equal(code, 1, out);
    assert.match(out, phrase('unknown option "--state"'));
    // The projection still holds through the spelling the declaration DOES name.
    assert.equal(run(['edit', id, '--extra', 'state=done'], cwd).code, 0);
    assert.ok(tagsOf(itemFile(cwd, 'task', id)).includes('state:done'));
  }, taskConfig({
    state: { store: 'field', values: ['todo', 'done'], projectsTo: 'state', note: 'Where it is.' },
  }));
});

test('the usage line names the declared flags, so it is discoverable before the attempt', () => {
  withProject((cwd) => {
    const id = task(cwd);
    const { out } = run(['edit', id, '--nonsense', 'x'], cwd);
    assert.match(out, phrase('--state <value>'));
  });
});

test('one field given through two spellings with two values is refused, not resolved', () => {
  withProject((cwd) => {
    const id = task(cwd);
    const before = itemFile(cwd, 'task', id);
    const { code, out } = run(['edit', id, '--state', 'done', '--extra', 'state=doing'], cwd);

    assert.equal(code, 1, out);
    assert.match(out, phrase('state'));
    assert.equal(itemFile(cwd, 'task', id), before);
  });
});

// --- layout -----------------------------------------------------------------

test('every declaration-composed refusal fits the layout budget', () => {
  withProject((cwd) => {
    const id = task(cwd);
    run(['add', 'rule', 'Never log secrets', '--body', 'Not at any level.', '--yes'], cwd);
    for (const args of [
      ['edit', id, '--state', 'donee'],
      ['edit', id, '--tags', 'v2,state:done'],
      ['edit', id, '--severity', 'hard'],
      ['edit', 'RULE-never-log-secrets', '--state', 'done'],
      ['edit', id, '--state', 'done', '--extra', 'state=doing'],
    ]) {
      const { out } = run(args, cwd);
      const over = out.split('\n').filter((l) => [...l].length > OUTPUT_WIDTH);
      assert.deepEqual(
        over, [],
        `\`${args.join(' ')}\` printed line(s) over ${OUTPUT_WIDTH}:\n${over.join('\n')}`,
      );
    }
  });
});
