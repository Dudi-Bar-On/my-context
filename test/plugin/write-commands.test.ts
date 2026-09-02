/**
 * The write half of the Phase 4 slash surface, held to what its own files say.
 *
 * Every generated write command tells the model the same thing: run the CLI
 * command WITHOUT `--yes`, because that prints the real preview and then
 * refuses without writing anything, and hand the `--yes` form to the user. That
 * is a claim about how these commands behave, written down in eleven files, and
 * this test is what makes it true rather than believed. It parses the exact
 * invocation out of each generated file, RUNS it, and checks the three things
 * the file promises:
 *
 *   - it exits 1 (the file says so explicitly, because a model that reads 1 as
 *     a failure will retry, and the retry is the thing that must not happen);
 *   - it reached the confirmation — i.e. it printed a preview and then declined,
 *     rather than refusing earlier for some unrelated reason such as a bad id,
 *     which would look identical from the exit code alone;
 *   - **it wrote nothing.** The whole corpus is compared byte for byte across
 *     the call.
 *
 * The commands are discovered from `generateCommands`, not listed here, so a
 * twelfth write command cannot be added without either satisfying this or
 * being named in `NO_DRY_RUN` with a reason.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { createRegistry } from '../../src/mcp/tools.ts';
import { generateCommands } from '../../src/plugin/commands.ts';
import { removeTree } from '../helpers/tmp.ts';

const generated = new Map(generateCommands(resolveConfig({})).map((f) => [f.file, f.content]));

/**
 * The line each write command tells the model to run, pulled out of the
 * generated text and split the way a shell would — the same technique
 * `commands.test.ts` uses on the `add-<type>` fallback, and for the same
 * reason: a test that compared the sentence to another copy of the sentence
 * would pass on a file that was confidently wrong.
 */
function dryRunArgv(content: string): string[] | null {
  const marker = content.indexOf('Run it WITHOUT `--yes`');
  if (marker < 0) return null;
  const rest = content.slice(marker);
  const line = rest.split('\n').find((l) => l.includes('/src/cli/index.ts" '));
  assert.ok(line, 'a dry-run block must name the command it is talking about');
  const after = line!.slice(line!.indexOf('/src/cli/index.ts" ') + '/src/cli/index.ts" '.length);
  const end = after.indexOf('`');
  assert.ok(end > 0, 'the invocation must be closed on the same line');
  const argv: string[] = [];
  for (const [, quoted, bare] of after.slice(0, end).matchAll(/"([^"]*)"|(\S+)/g)) {
    const token = quoted ?? bare;
    if (token !== undefined && token !== '') argv.push(token);
  }
  return argv;
}

/**
 * The write commands that deliberately have no dry run, each with the reason,
 * so "this file has no preview" is a decision recorded here rather than a gap
 * discovered later.
 */
const NO_DRY_RUN: Record<string, string> = {
  'link.md': 'link_items is an MCP tool call, not a CLI command — there is nothing to dry-run',
  'lesson.md': 'the whole command is "print this for the user"; nothing is run at all',
  'lesson-stage.md': 'staging writes nothing into the corpus, so it needs no preview',
  'ingest.md': 'ingest-apply writes origin "ingest" drafts and the model runs it directly',
  'add-reference.md': 'a capture creates an item that does not exist yet, so there is no ' +
    '"before" for a preview to show — the generated file itself is the preview',
};

const CORPUS = ['.my_context', 'items'];

/** Every item file and its bytes — the "nothing was written" comparison. */
function corpusSnapshot(cwd: string): Record<string, string> {
  const root = path.join(cwd, ...CORPUS);
  const out: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else out[path.relative(root, full)] = readFileSync(full, 'utf8');
    }
  };
  walk(root);
  return out;
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

const GOVERNING = 'CONST-the-pool-is-capped-at-twenty';
const REPLACEMENT = 'CONST-the-pool-is-capped-at-fifty';
const DRAFT = 'RULE-drafts-are-reviewed-by-a-human';
const REFERENCE = 'REF-the-quarterly-roadmap';
const LINKED_TO = 'DEC-stripe-was-chosen-for-payments';
/**
 * Pinned and hard, so `unpin` and `soften` MOVE a value rather than landing in
 * `edit`'s "nothing to change" branch — which exits 0 and writes nothing for a
 * reason that has nothing to do with the gate under test, and would let these
 * two tests pass while the preview was gone.
 */
const PINNED_HARD = 'CONST-secrets-never-reach-the-logs';
/**
 * A capture in the inbox, for `inbox-promote.md`'s dry run. It is a `note`
 * rather than a `todo` only because `note` is the half of the inbox with no
 * listing command of its own, so a fixture that exercises it covers the id a
 * user is likelier to have had to look up.
 */
const CAPTURE = 'NOTE-the-pool-setting-came-up-again';
/**
 * A one-time procedure sitting at the `ready` stage — `status: draft` plus the
 * `ready` tag — which is the state `procedure activate` exists to move it out
 * of. Drafted rather than left active so the dry run previews a real
 * transition instead of a no-op.
 */
const PROCEDURE = 'PROC-backfill-the-tenant-id-column';

/**
 * One workspace every dry run is exercised against: two active governing
 * constraints, a draft waiting for review, a reference whose source has moved
 * on, and a relation to remove. Built once per test through the real CLI and
 * the real tool registry, so the fixtures are ones the product itself makes.
 */
function fixture(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-slash-write-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  run(['add', '--summary-omitted', 'constraint', 'The pool is capped at twenty', '--body', 'Twenty.', '--yes'], cwd);
  run(['add', '--summary-omitted', 'constraint', 'The pool is capped at fifty', '--body', 'Fifty.', '--yes'], cwd);
  run(['add', '--summary-omitted', 'decision', 'Stripe was chosen for payments'], cwd);

  // A draft: `create_item` through the MCP server passes `origin: 'agent'`,
  // which `trustedStatus` demotes — the route a real review queue fills by.
  createRegistry(cwd).call('create_item', { summary_omitted: true,
    type: 'rule', title: 'Drafts are reviewed by a human', body: 'Because promotion is an act.',
  });
  createRegistry(cwd).call('link_items', { from: GOVERNING, to: LINKED_TO, relation: 'blocks' });

  run(['add', '--summary-omitted', 'note', 'The pool setting came up again', '--body', 'Twice this week.'], cwd);

  run(['add', '--summary-omitted', 'procedure', 'Backfill the tenant id column', '--body', 'One-time correction.',
    '--step', 'Take the table out of the nightly job', '--step', 'Backfill oldest first',
    '--yes'], cwd);
  run(['edit', PROCEDURE, '--status', 'draft', '--tags', 'ready', '--yes'], cwd);

  run(['add', '--summary-omitted', 'constraint', 'Secrets never reach the logs', '--body', 'Never.', '--yes'], cwd);
  run(['pin', PINNED_HARD, '--yes'], cwd);
  run(['harden', PINNED_HARD, '--yes'], cwd);

  writeFileSync(path.join(cwd, 'roadmap.md'), '# Roadmap\n\n## Q3\n\n- one\n', 'utf8');
  run(['add', '--summary-omitted', 'reference', 'The quarterly roadmap', '--file', 'roadmap.md',
    '--note', 'What we said we would do.'], cwd);
  // Drifted, so `refresh` reaches its write path rather than its "already
  // current, nothing was written" early return.
  writeFileSync(path.join(cwd, 'roadmap.md'), '# Roadmap\n\n## Q3\n\n- one\n- two\n', 'utf8');

  for (const id of [GOVERNING, REPLACEMENT, DRAFT, REFERENCE, LINKED_TO, PINNED_HARD, CAPTURE,
    PROCEDURE]) {
    const shown = run(['show', id], cwd);
    assert.equal(shown.code, 0, `the fixture is missing ${id}:\n${shown.out}`);
  }
  return cwd;
}

/** What each `<placeholder>` in a generated invocation stands for. */
const SUBSTITUTIONS: Record<string, Record<string, string[]>> = {
  // The representative flag pair is a body edit AND the summary the gate now
  // asks for beside it: `--body` alone is refused, which is what the file's own
  // paragraph about `--summary` says.
  'edit.md': {
    '<id>': [GOVERNING], '<the': ['--body'],
    'flags>': ['A rewritten body.', '--summary', 'A plain sentence for the fixture.'],
  },
  'supersede.md': { '<retired': [GOVERNING], 'id>': [], '<replacement': [REPLACEMENT] },
  'inbox-promote.md': { '<id>': [CAPTURE], '<category>': ['decision'] },
  'procedure.md': { '<id>': [PROCEDURE] },
  'promote.md': { '<id>': [DRAFT] },
  'discard.md': { '<id>': [DRAFT] },
  'refresh.md': { '<id>': [REFERENCE] },
  'unlink.md': { '<id>': [GOVERNING], '<relation>': ['blocks'], '<target>': [LINKED_TO] },
  'pin.md': { '<id>': [GOVERNING] },
  'unpin.md': { '<id>': [PINNED_HARD] },
  'harden.md': { '<id>': [GOVERNING] },
  'soften.md': { '<id>': [PINNED_HARD] },
};

/**
 * Placeholders are substituted from the table above rather than guessed from
 * their text: `supersede <retired id> --by <replacement id>` tokenizes into
 * `<retired`, `id>` and `<replacement`, `id>`, and a rule that mapped every
 * `id>` to one item would retire an item in favour of itself. Anything the
 * table does not name is passed through unchanged, so a NEW placeholder
 * reaches the CLI verbatim and fails loudly rather than being silently mapped
 * to something plausible.
 */
function substitute(file: string, argv: string[]): string[] {
  const table = SUBSTITUTIONS[file] ?? {};
  const out: string[] = [];
  for (const token of argv) {
    if (Object.hasOwn(table, token)) out.push(...table[token]);
    else out.push(token);
  }
  return out;
}

test('every generated write command either dry-runs or says why it does not', () => {
  const withDryRun: string[] = [];
  for (const [file, content] of generated) {
    if (!/for the USER to run|print the command for the USER/i.test(content)) continue;
    if (dryRunArgv(content)) withDryRun.push(file);
    else {
      assert.ok(
        Object.hasOwn(NO_DRY_RUN, file),
        `commands/${file} hands a command to the user without a dry run and is not listed ` +
        `in NO_DRY_RUN — decide which it is and record the reason`,
      );
    }
  }
  assert.deepEqual(
    withDryRun.toSorted(),
    ['discard.md', 'edit.md', 'harden.md', 'inbox-promote.md', 'pin.md', 'procedure.md',
      'promote.md', 'refresh.md', 'soften.md', 'supersede.md', 'unlink.md', 'unpin.md'],
    'the set of write commands that preview through a dry run changed',
  );
  // Not vacuous in the other direction either: every NO_DRY_RUN entry must be
  // a file that exists and really has none.
  for (const file of Object.keys(NO_DRY_RUN)) {
    assert.ok(generated.has(file), `NO_DRY_RUN names ${file}, which is not generated`);
    assert.equal(dryRunArgv(generated.get(file)!), null,
      `${file} is listed as having no dry run, but it has one`);
  }
});

for (const [file, content] of generated) {
  const argv = dryRunArgv(content);
  if (!argv) continue;

  test(`the dry run commands/${file} names previews, refuses and writes nothing`, () => {
    const cwd = fixture();
    try {
      const before = corpusSnapshot(cwd);
      const { code, out } = run(substitute(file, argv), cwd);

      assert.equal(
        code, 1,
        `commands/${file} tells the model exit 1 is expected; the command exited ${code}:\n${out}`,
      );
      assert.match(
        out, /refusing without confirmation/,
        `commands/${file} claims the dry run reaches a confirmation and declines. It did ` +
        `not — so it refused for some other reason, and the "preview" the file promises ` +
        `the user is not there:\n${out}`,
      );
      assert.deepEqual(
        corpusSnapshot(cwd), before,
        `commands/${file} tells the model nothing was written. Something was.`,
      );
    } finally {
      removeTree(cwd);
    }
  });
}
