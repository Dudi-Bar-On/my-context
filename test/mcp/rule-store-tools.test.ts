// @basis TASK-there-is-no-mcp-path-to-the-rule-store-and-the-text-written, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **`mcpsurface/1`: an agent with no terminal could not reach the rule store.**
 *
 * There was no MCP path to it at all — while `missedDoorLine`
 * (`src/rules/delivered.ts`), a sentence written FOR A MODEL, told it to run
 * `mycontext rules list` and `mycontext rules verify` when a door had failed to
 * deliver. An agent whose Bash tool is denied can run neither, so the product's
 * own advice for *"find out what you were given"* pointed at a door that
 * surface does not have.
 *
 * ── WHAT MAKES THESE ASSERTIONS MORE THAN "THE TOOL RETURNED A STRING" ──────
 *
 * Two things, because a tool that reads a store is trivially easy to test
 * vacuously — the shipped store is intact, so a `verify_rules` that returned
 * the word "intact" unconditionally would pass every cheerful assertion.
 *
 *  1. The listing is compared against `loadRules` called DIRECTLY — the same
 *     answer the CLI and the doors get — rather than against text written here.
 *  2. `verify_rules` is driven against a DAMAGED store, built in a temp
 *     directory by copying what shipped and altering one byte. A stub cannot
 *     pass that one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendFileSync, cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRegistry } from '../../src/mcp/tools.ts';
import { TOOL_PARITY } from '../../src/plugin/parity.ts';
import { RULES_DIR_ENV, workspaceIsMyContext } from '../../src/rules/deliver.ts';
import { entriesDir, loadRules } from '../../src/rules/store.ts';
import { verifyManifest } from '../../src/rules/manifest.ts';
import { removeTree } from '../helpers/tmp.ts';

const REPO = path.resolve(import.meta.dirname, '..', '..');
const registry = () => createRegistry(REPO);
const call = (name: string, args: Record<string, unknown> = {}): string => registry().call(name, args);

/** The same answer the CLI and every door get, asked independently of the tool. */
function shippedEntries() {
  return loadRules(entriesDir(), workspaceIsMyContext(path.join(REPO, '.my_context'))).entries;
}

test('the rule store is reachable from MCP at all — the gap mcpsurface/1 names is closed', () => {
  const names = registry().list().map((t) => t.name);
  assert.equal(names.includes('list_rules'), true);
  assert.equal(names.includes('verify_rules'), true);

  // And both are declared on the parity map, so the reversal of
  // `CLI_WITHOUT_TOOL.rules` is recorded rather than merely done.
  const rows = TOOL_PARITY.filter((r) => r.tool === 'list_rules' || r.tool === 'verify_rules');
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal(row.cli, 'rules');
    assert.equal(typeof row.note, 'string', 'a null slash counterpart must carry its reason');
  }
});

test('list_rules names every entry the store loader says applies here, and invents none', () => {
  const text = call('list_rules');
  const expected = shippedEntries();

  // Non-vacuity first: a store that loaded nothing would make the loop below
  // assert nothing at all, and this suite runs inside my_context, where the
  // developer tier is in force and there is certainly something to list.
  assert.equal(expected.length > 0, true, 'the shipped store loaded no entries here');

  for (const entry of expected) {
    assert.equal(text.includes(entry.id), true, `list_rules omitted ${entry.id}`);
    assert.equal(text.includes(entry.title), true, `list_rules omitted the title of ${entry.id}`);
  }
  assert.match(text, new RegExp(`${expected.length} entry\\(s\\) in force`));
  assert.match(text, /This workspace IS my_context/);
});

test('list_rules with an id reads that entry in full, including the parts a listing drops', () => {
  const entry = shippedEntries()[0]!;
  const full = call('list_rules', { id: entry.id });
  const listing = call('list_rules');

  assert.equal(full.includes(entry.title), true);
  // The discriminator: `example` is rendered for one entry and never in the
  // listing, so this cannot pass by `id` merely echoing the list output.
  assert.equal(full.includes(entry.example), true, 'the full read dropped the example');
  assert.equal(listing.includes(entry.example), false, 'the listing is leaking full entries');
});

test('an unknown id is a teaching refusal that names the route that works', () => {
  assert.throws(
    () => call('list_rules', { id: 'no-such-entry-anywhere' }),
    (err: Error) => {
      assert.match(err.message, /no rule entry "no-such-entry-anywhere" applies here/);
      assert.match(err.message, /list_rules with no id/);
      return true;
    },
  );
});

test('verify_rules agrees with verifyManifest about the shipped store', () => {
  // Asked of the real verifier rather than assumed: if the working tree's store
  // were damaged right now, this test must follow it rather than contradict it.
  const truth = verifyManifest(entriesDir());
  const text = call('verify_rules');
  assert.equal(
    /the rule store is intact/.test(text), truth.ok,
    'verify_rules and verifyManifest disagree about the store that shipped',
  );
});

test('verify_rules reports a DAMAGED store, naming the entry that changed', () => {
  /**
   * The assertion a stub cannot pass. A whole store is copied to a temp
   * directory — `manifest.json` included, so it is verified against its own
   * manifest exactly as the shipped one is — and one entry file is appended to.
   *
   * `MYCONTEXT_RULES_DIR` is the supported way to point every reader at another
   * store (`deliver.ts` · `RULES_DIR_ENV`), and `resolveStoreDir` reads it at
   * call time, so the tool follows it without being told.
   */
  const dir = mkdtempSync(path.join(tmpdir(), 'mycontext-rules-'));
  const before = process.env[RULES_DIR_ENV];
  try {
    cpSync(entriesDir(), dir, { recursive: true });
    const victim = readdirSync(dir).filter((f) => f.endsWith('.md')).sort()[0]!;
    appendFileSync(path.join(dir, victim), '\nthis byte was never shipped\n');

    process.env[RULES_DIR_ENV] = dir;
    const text = call('verify_rules');

    assert.match(text, /has been changed since it was installed/);
    assert.match(text, /1 problem\(s\)/);

    /**
     * **Anchored on the problem LINE, not on the whole report — and this
     * assertion was rewritten because its first form was vacuous.**
     *
     * It read `assert.equal(text.includes(victim), true)`. That passed with
     * `problem.entry` removed from the rendered line entirely, because
     * `problem.detail` independently spells the filename ("… does not match the
     * checksum that shipped with it"). The assertion claimed to check that the
     * report NAMES the damaged entry and actually rested on a sentence written
     * by `verifyManifest` — a proof whose fixture, not its subject, carried its
     * power. Matching the line's shape is what makes dropping `p.entry` red.
     */
    const entryId = victim.replace(/\.md$/, '');
    assert.match(
      text, new RegExp(`^\\s+${entryId} — altered:`, 'm'),
      'the damage report does not name the changed entry at the head of its own line',
    );
    // The substitution is DISCLOSED — a reader holding an answer about
    // somewhere other than the package has to be told so.
    assert.match(text, /NOT the installed package/);
    // And the repair, which writes, is named rather than offered.
    assert.match(text, /mycontext rules verify --restore/);
    assert.match(text, /Nothing on this surface writes to the store/);
  } finally {
    if (before === undefined) delete process.env[RULES_DIR_ENV]; else process.env[RULES_DIR_ENV] = before;
    removeTree(dir);
  }
});

test('verify_rules offers no way to write — `restore` is refused by name', () => {
  // The absence is the point, and `refuseUnknownArgs` makes it a refusal rather
  // than a silently ignored argument.
  assert.throws(
    () => call('verify_rules', { restore: true }),
    (err: Error) => {
      assert.match(err.message, /verify_rules does not take "restore"/);
      assert.match(err.message, /Nothing was written/);
      return true;
    },
  );
});

test('both rule-store tools are advertised as reads', () => {
  // Ties `mcpsurface/1` to `mcpsurface/2`: a new tool that arrived without
  // annotations would have claimed to be a possibly-destructive write.
  for (const name of ['list_rules', 'verify_rules']) {
    const tool = registry().list().find((t) => t.name === name)!;
    assert.equal(tool.annotations.readOnlyHint, true, `${name} does not declare itself a read`);
    assert.equal(tool.annotations.openWorldHint, false);
  }
});

test('reading the rule store leaves the project corpus untouched', () => {
  /**
   * The isolation `test/rules/isolation.test.ts` holds for the CLI, held here
   * for the new surface: the rule store is NOT the user's corpus, and a tool
   * that quietly wrote to `.my_context/` while answering a question about the
   * package would be the worst possible version of this fix.
   *
   * Compared by name, size and mtime across every file under the corpus — a
   * count alone would miss a rewritten file.
   */
  const corpus = path.join(REPO, '.my_context');
  assert.equal(existsSync(corpus), true, 'no corpus to compare against');

  const snapshot = (): string[] => {
    const rows: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir).sort()) {
        const full = path.join(dir, name);
        const s = statSync(full);
        if (s.isDirectory()) { walk(full); continue; }
        rows.push(`${path.relative(corpus, full)}|${s.size}|${s.mtimeMs}`);
      }
    };
    walk(corpus);
    return rows;
  };

  const before = snapshot();
  assert.equal(before.length > 0, true, 'an empty corpus would make this compare nothing');
  call('list_rules');
  call('verify_rules');
  assert.deepEqual(snapshot(), before, 'a rule-store read changed the project corpus');
});

test('the tool descriptions come from the one source that generates them', () => {
  // `createRegistry` throws for a tool with no entry in `src/help/topics/capture.md`.
  // Asserting the text landed proves the description is generated from that
  // file rather than written twice.
  const source = readFileSync(
    path.join(REPO, 'src', 'help', 'topics', 'capture.md'), 'utf8',
  );
  for (const tool of registry().list().filter((t) => t.name.endsWith('_rules'))) {
    assert.equal(source.includes(tool.description), true, `${tool.name}'s description is not in capture.md`);
    assert.match(tool.description, /Not for:/, 'every description states what it is not for');
  }
});
