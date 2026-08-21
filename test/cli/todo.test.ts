/**
 * `mycontext todo` — the inbox listing surface (plan Task 3).
 *
 * The load-bearing tests in this file are the two that say what this command
 * is NOT. §6m's ruling is that `todo` gets its own surface and the review
 * queue is *not* widened, so:
 *
 *  - `the review queue is not widened by anything this command lists` runs
 *    `review list` beside `todo` and asserts the todo is absent from it. A
 *    test that only checked `todo`'s own output would stay green if the queue
 *    were widened tomorrow, which is the half-checking this repo keeps paying
 *    for.
 *  - `the disclosure line carries its own condition` pins the sentence that
 *    tells a reader why nothing here reaches an agent. A guarantee printed
 *    without its condition is the failure mode; the condition here is the
 *    resolved tier, so the sentence is asserted to change when the tier does.
 *
 * Everything else is this command's own surface: the refusals that keep a
 * mistyped flag from being absorbed, and the disclosures that keep a hidden
 * item from being a dropped one.
 *
 * Refusals are asserted against THIS COMMAND's usage line, never against the
 * top-level banner. `test/cli/add-flags.test.ts` records why: an assertion
 * that matches a flag name against the banner can pass on another command's
 * advertisement of the same flag.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  const lines: string[] = [];
  const code = runCli(args, cwd, (s) => lines.push(s));
  return { code, out: lines.join('\n') };
}

/**
 * The same output with every run of whitespace collapsed to one space.
 *
 * The disclosures go through `paragraph` (format.ts) and are wrapped to the
 * layout budget, so "review queue" lands with a newline between the two words
 * at this width and a regex over the raw text misses a phrase that is plainly
 * there. Asserting on the collapsed form pins the sentence rather than the
 * column it happened to break at.
 */
function prose(out: string): string {
  return out.replace(/\s+/g, ' ');
}

/** A throwaway project, disposed by the caller. */
function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-todo-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  return cwd;
}

function withProject(fn: (cwd: string) => void): void {
  const cwd = project();
  try {
    fn(cwd);
  } finally {
    removeTree(cwd);
  }
}

/** Rewrites `.my_context/config.json` through the same file `init` wrote. */
function reconfigure(cwd: string, edit: (config: Record<string, unknown>) => void): void {
  const file = path.join(cwd, '.my_context', 'config.json');
  const config = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  edit(config);
  writeFileSync(file, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

test('`mycontext todo` lists todos and nothing else', () => {
  withProject((cwd) => {
    run(['add', 'todo', 'Retry the dispatcher on 5xx', '--yes'], cwd);
    run(['add', 'note', 'Seed script leaves orphaned carts', '--yes'], cwd);
    run(['add', 'decision', 'Use Postgres', '--yes'], cwd);

    const { code, out } = run(['todo'], cwd);
    assert.equal(code, 0);
    assert.match(out, /TODO-retry-the-dispatcher-on-5xx/);
    assert.doesNotMatch(out, /NOTE-/);
    assert.doesNotMatch(out, /DEC-/);
  });
});

test('the review queue is not widened by anything this command lists', () => {
  withProject((cwd) => {
    run(['add', 'todo', 'Retry the dispatcher on 5xx', '--yes'], cwd);

    const listed = run(['todo'], cwd);
    assert.match(listed.out, /TODO-retry-the-dispatcher-on-5xx/);

    // §6m: `todo` is its own surface AND the queue stays as it was. Asserted
    // on the queue itself, not on a sentence about the queue.
    const queue = run(['review', 'list'], cwd);
    assert.equal(queue.code, 0);
    assert.doesNotMatch(queue.out, /TODO-retry-the-dispatcher-on-5xx/);
  });
});

test('the disclosure line carries its own condition', () => {
  withProject((cwd) => {
    run(['add', 'todo', 'Retry the dispatcher on 5xx', '--yes'], cwd);

    const rationale = prose(run(['todo'], cwd).out);
    assert.match(rationale, /rationale tier/);
    assert.match(rationale, /never injected/);
    assert.match(rationale, /does not enter the review queue/);

    // The claim is a consequence of the resolved tier, not a slogan. Retier
    // `todo` in config — which `resolveConfig` honours — and the guarantee
    // must stop being printed, because it has stopped being true.
    reconfigure(cwd, (config) => {
      const categories = config.categories as Record<string, Record<string, unknown>>;
      categories.todo = { ...categories.todo, tier: 'normative' };
    });
    const normative = prose(run(['todo'], cwd).out);
    assert.doesNotMatch(normative, /never injected/);
    assert.match(normative, /retiered to the normative tier/);
    assert.match(normative, /IS injected in full/);
    assert.match(normative, /appears in `mycontext review`/);
  });
});

/**
 * The route out is named, and the name is one the CLI actually dispatches.
 *
 * This sentence shipped naming `mycontext add <category>` followed by
 * `mycontext supersede <todo id> --by <new id>` — deliberately, because when
 * Task 3 landed `inbox-promote` did not exist, and naming a command that does
 * not exist is a defect this repository has paid for. Task 4 built the
 * command, so the sentence has to move with it; the second half of this test
 * is what stops it naming a command again that the program does not have.
 */
test('the inbox names the route out, and that route is a real command', () => {
  withProject((cwd) => {
    run(['add', 'todo', 'Retry the dispatcher on 5xx', '--yes'], cwd);
    const listed = prose(run(['todo'], cwd).out);
    assert.match(listed, /mycontext inbox-promote <todo id> --to <category>/);
    assert.match(listed, /derived_from/);
    // The retirement is named as what it is, so a reader is not left thinking
    // the capture disappears.
    assert.match(listed, /retires the todo as `deprecated`/);
    // Not the withdrawn route: two commands where one exists is the wording
    // this replaced, and it must not come back beside the new one.
    assert.doesNotMatch(listed, /mycontext supersede <todo id>/);

    const banner: string[] = [];
    runCli(['help'], cwd, (s) => banner.push(s));
    assert.match(banner.join('\n'), /^ {2}inbox-promote /m,
      'the inbox names a command the usage banner does not advertise');
  });
});

test('an empty inbox says so rather than printing an empty table', () => {
  withProject((cwd) => {
    const { code, out } = run(['todo'], cwd);
    assert.equal(code, 0);
    assert.match(out, /no todo items/i);
    // The tier line is printed on the empty path too — it is the answer to
    // "why did nothing here reach my agent", which is asked most when the
    // list is short.
    assert.match(prose(out), /never injected/);
  });
});

test('--tag narrows, and it is the tag that narrows rather than the text', () => {
  withProject((cwd) => {
    run(['add', 'todo', 'Retry the dispatcher', '--tags', 'billing', '--yes'], cwd);
    run(['add', 'todo', 'Rename the config key', '--yes'], cwd);

    const kept = run(['todo', '--tag', 'billing'], cwd);
    assert.equal(kept.code, 0);
    assert.match(kept.out, /Retry the dispatcher/);
    assert.doesNotMatch(kept.out, /Rename the config key/);
  });
});

test('an unknown flag is refused by name, against this command\'s own usage', () => {
  withProject((cwd) => {
    run(['add', 'todo', 'Retry the dispatcher', '--tags', 'billing', '--yes'], cwd);

    const { code, out } = run(['todo', '--tags', 'billing'], cwd);
    assert.equal(code, 1);
    assert.match(out, /unknown option "--tags"/);
    // This command's usage line, not the top-level banner: a banner match can
    // pass on another command's advertisement of the same flag.
    assert.match(out, /usage: mycontext todo/);
    assert.doesNotMatch(out, /usage: mycontext <command>/);
    // Refused instead of absorbed: nothing was listed on the way out.
    assert.doesNotMatch(out, /TODO-retry-the-dispatcher/);
  });
});

test('the refusal comes before the listing, not after it', () => {
  withProject((cwd) => {
    run(['add', 'todo', 'Retry the dispatcher', '--yes'], cwd);
    const { out } = run(['todo', '--limit', '1', '--agnet'], cwd);
    // One line of refusal plus the usage block, and no table at all — the
    // `cmdAdd` lesson: a gate that validates after it has printed is a gate
    // the reader has already acted on.
    assert.match(out, /unknown option "--agnet"/);
    assert.doesNotMatch(out, /rationale tier/);
  });
});

test('retired todos are hidden by default and shown with --all, with the count disclosed', () => {
  withProject((cwd) => {
    run(['add', 'todo', 'Retry the dispatcher', '--yes'], cwd);
    run(['add', 'todo', 'Rename the config key', '--yes'], cwd);
    run(['edit', 'TODO-retry-the-dispatcher', '--status', 'deprecated', '--yes'], cwd);

    const shown = run(['todo'], cwd);
    assert.equal(shown.code, 0);
    assert.doesNotMatch(shown.out, /TODO-retry-the-dispatcher\b/);
    assert.match(shown.out, /TODO-rename-the-config-key/);
    // Hidden is fine, unmentioned is not.
    assert.match(prose(shown.out), /1 retired \(superseded\/deprecated\/validated\) and not shown/);
    assert.match(prose(shown.out), /`mycontext todo --all` lists them too/);

    const all = run(['todo', '--all'], cwd);
    assert.equal(all.code, 0);
    assert.match(all.out, /TODO-retry-the-dispatcher/);
    // Nothing is being hidden now, so nothing claims to be.
    assert.doesNotMatch(all.out, /1 retired/);
  });
});

test('a draft todo is listed rather than hidden with the retired ones', () => {
  withProject((cwd) => {
    run(['add', 'todo', 'Retry the dispatcher', '--yes'], cwd);
    run(['edit', 'TODO-retry-the-dispatcher', '--status', 'draft', '--yes'], cwd);

    const { out } = run(['todo'], cwd);
    // `draft` is neither done nor dead. Folding it into "retired" would both
    // hide it and misdescribe it in the one sentence that mentions it.
    assert.match(out, /TODO-retry-the-dispatcher/);
    assert.doesNotMatch(out, /1 retired/);
  });
});

test('--limit caps the table and says it capped it', () => {
  withProject((cwd) => {
    run(['add', 'todo', 'Retry the dispatcher', '--yes'], cwd);
    run(['add', 'todo', 'Rename the config key', '--yes'], cwd);

    const { code, out } = run(['todo', '--limit', '1'], cwd);
    assert.equal(code, 0);
    assert.match(prose(out), /2 todo item\(s\); 1 shown/);
    assert.match(prose(out), /Raise the cap with --limit 2/);
  });
});

test('--limit refuses a value that is not a positive whole number', () => {
  withProject((cwd) => {
    const { code, out } = run(['todo', '--limit', 'lots'], cwd);
    assert.equal(code, 1);
    assert.match(prose(out), /--limit takes a positive whole number \(got "lots"\)/);
  });
});

test('--tag twice is refused rather than answered with one of them', () => {
  withProject((cwd) => {
    const { code, out } = run(['todo', '--tag', 'billing', '--tag', 'search'], cwd);
    assert.equal(code, 1);
    assert.match(prose(out), /--tag was given 2 times/);
  });
});

test('--all=false means false, and --all=maybe is refused rather than guessed', () => {
  withProject((cwd) => {
    run(['add', 'todo', 'Retry the dispatcher', '--yes'], cwd);
    run(['edit', 'TODO-retry-the-dispatcher', '--status', 'deprecated', '--yes'], cwd);

    const declined = run(['todo', '--all=false'], cwd);
    assert.equal(declined.code, 0);
    assert.doesNotMatch(declined.out, /TODO-retry-the-dispatcher\b/);
    assert.match(prose(declined.out), /1 retired/);

    const guessed = run(['todo', '--all=maybe'], cwd);
    assert.equal(guessed.code, 1);
    assert.match(prose(guessed.out), /--all accepts/);
  });
});

test('the detail levels are the same four every report carries', () => {
  withProject((cwd) => {
    run(['add', 'todo', 'Retry the dispatcher', '--tags', 'billing', '--yes'], cwd);

    const summary = run(['todo', '--summary'], cwd);
    assert.equal(summary.code, 0);
    assert.match(summary.out, /1 todo item\(s\)/);
    assert.doesNotMatch(summary.out, /TODO-retry-the-dispatcher/);

    const full = run(['todo', '--full'], cwd);
    assert.equal(full.code, 0);
    assert.match(full.out, /TODO-retry-the-dispatcher/);
    assert.match(full.out, /origin\s+human/);

    const both = run(['todo', '--full', '--summary'], cwd);
    assert.equal(both.code, 1);
    assert.match(prose(both.out), /pass only one of --full, --short or --summary/);
  });
});

test('no line of any detail level ends in whitespace', () => {
  withProject((cwd) => {
    run(['add', 'todo', 'An untagged thing', '--yes'], cwd);
    run(['add', 'todo', 'A tagged thing', '--tags', 'infra', '--yes'], cwd);

    for (const level of [[], ['--short'], ['--full'], ['--summary']]) {
      const { out } = run(['todo', ...level], cwd);
      const dirty = out.split('\n').filter((line) => /\s$/.test(line));
      assert.deepEqual(
        dirty, [],
        `\`mycontext todo ${level.join(' ')}\` emitted line(s) ending in whitespace: ` +
        `${JSON.stringify(dirty)}. An untagged item at --full is the case that produces one — ` +
        'a labelled line with nothing after it reads as a field that failed to load.',
      );
    }
  });
});

test('--json carries the counts the prose carries, including what is hidden', () => {
  withProject((cwd) => {
    run(['add', 'todo', 'Retry the dispatcher', '--tags', 'billing', '--yes'], cwd);
    run(['add', 'todo', 'Rename the config key', '--yes'], cwd);
    run(['edit', 'TODO-retry-the-dispatcher', '--status', 'deprecated', '--yes'], cwd);

    const { code, out } = run(['todo', '--json'], cwd);
    assert.equal(code, 0);
    const payload = JSON.parse(out) as {
      items: { id: string; status: string; tags: string[] }[];
      count: number; matched: number; retiredHidden: number; truncated: boolean;
      tier: string; injected: boolean;
    };
    assert.deepEqual(payload.items.map((i) => i.id), ['TODO-rename-the-config-key']);
    assert.equal(payload.count, 1);
    assert.equal(payload.matched, 1);
    // The machine form must not be the one place the hidden item vanishes.
    assert.equal(payload.retiredHidden, 1);
    assert.equal(payload.truncated, false);
    assert.equal(payload.tier, 'rationale');
    assert.equal(payload.injected, false);

    // `injected: false` on its own would pass for the wrong reason — it is
    // also what a hardcoded `false` prints. The field has to move when the
    // tier moves, which is the only thing that makes it worth carrying.
    reconfigure(cwd, (config) => {
      const categories = config.categories as Record<string, Record<string, unknown>>;
      categories.todo = { ...categories.todo, tier: 'normative' };
    });
    const retiered = JSON.parse(run(['todo', '--json'], cwd).out) as
      { tier: string; injected: boolean };
    assert.equal(retiered.tier, 'normative');
    assert.equal(retiered.injected, true);
  });
});

test('a disabled `todo` category still lists what was captured before it was switched off', () => {
  withProject((cwd) => {
    run(['add', 'todo', 'Retry the dispatcher', '--yes'], cwd);
    reconfigure(cwd, (config) => {
      const categories = config.categories as Record<string, Record<string, unknown>>;
      categories.todo = { ...categories.todo, enabled: false };
    });

    const { code, out } = run(['todo'], cwd);
    assert.equal(code, 0);
    assert.match(out, /TODO-retry-the-dispatcher/);
    assert.match(prose(out), /The `todo` category is disabled in this project's config/);
    assert.match(prose(out), /Disabling is not deletion/);
  });
});

test('outside a workspace it says where to start rather than printing an empty inbox', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-todo-bare-'));
  try {
    const { code, out } = run(['todo'], cwd);
    assert.equal(code, 1);
    assert.match(out, /no workspace here/);
    assert.doesNotMatch(out, /no todo items/);
  } finally {
    removeTree(cwd);
  }
});

test('`search --type todo` already answered the same question, and still does', () => {
  withProject((cwd) => {
    run(['add', 'todo', 'Retry the dispatcher on 5xx', '--yes'], cwd);
    const { code, out } = run(['search', '--type', 'todo'], cwd);
    assert.equal(code, 0);
    assert.match(out, /TODO-retry-the-dispatcher-on-5xx/);
  });
});

test('the command is advertised in the banner and dispatches', () => {
  withProject((cwd) => {
    const banner = run(['help'], cwd).out;
    assert.match(banner, /^ {2}todo /m);
    assert.doesNotMatch(run(['todo'], cwd).out, /unknown command/);
  });
});
