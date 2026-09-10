// @basis TASK-the-store-loads-refuses-what-it-cannot-parse-and-proves-it
/**
 * **THE CORPUS NEVER SEES THE STORE — and this file is a tripwire, not a
 * discovery.**
 *
 * D41 spec §7, `plan:store seq:1` Task 3. Read the plan's own warning before
 * reading the assertions, because it changes what they are for:
 *
 * > *They should PASS immediately — nothing knows about the store yet. That is
 * > a vacuous pass and it is expected: this file's value is as a guard against
 * > a later task wiring the store into a corpus surface by accident.*
 *
 * So this file was written knowing it would be green on its first run, and it
 * was PROVED CAPABLE OF FAILING before it was accepted — **twice, because one
 * proof turned out to cover only half of it.**
 *
 *   1. `cmdList` (src/cli/index.ts) was temporarily given
 *      `loadRules(entriesDir(), true)` and made to print each entry's id and
 *      title beside the corpus rows. `` `list` returns nothing from the rule
 *      store `` went red; everything else stayed green. Reverted.
 *   2. That was expected to redden the import-graph walk as well and **it did
 *      not** — `list` is implemented in `src/cli/index.ts`, which is not one
 *      of the modules that walk names, for the reason `CORPUS_MACHINERY`
 *      gives below. So the structural half was proved separately: an import of
 *      `../rules/store.ts` was added to `src/core/select.ts`, `no corpus
 *      surface can reach the store` went red, and it was reverted.
 *
 * **A guard nobody has seen fail is not a guard** — and the second proof is
 * the reason that sentence is worth obeying literally rather than in spirit:
 * the first run looked like a proof of the whole file and was a proof of one
 * assertion in it.
 *
 * ── WHY BOTH A BEHAVIOURAL AND A STRUCTURAL HALF ───────────────────────────
 *
 * They fail at different moments and neither subsumes the other. The
 * behavioural half asks the four surfaces spec §17 names — `doctor`, `list`,
 * `ready`, the injection selector — what they actually print, and would catch
 * a leak arriving through a path no import expresses (a directory walk, a
 * glob, a config). The structural half asks whether the corpus's own machinery
 * can REACH this module at all, and would catch a leak that is wired but not
 * yet visible in any output — which is exactly the state a half-finished
 * Phase 2 would be in, and exactly when a behavioural test still passes.
 *
 * ── THE REVERSE DIRECTION IS ASSERTED TOO ──────────────────────────────────
 *
 * "The corpus must not depend on it AND it must not depend on the corpus" —
 * `src/rules/` imports exactly one thing from `src/core/`, the frontmatter
 * parser, because one file format is a discipline and a second parser is a
 * second dialect. Every other edge would be a reason for a later change to the
 * corpus to have to think about the store.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { buildInjection } from '../../src/core/inject.ts';
import { entriesDir, loadRules } from '../../src/rules/store.ts';
import { removeTree } from '../helpers/tmp.ts';

const REPO = path.resolve(import.meta.dirname, '..', '..');
const SRC = path.join(REPO, 'src');

/* ══ THE FINGERPRINTS ══════════════════════════════════════════════════════ */

/**
 * What a leak would LOOK like, taken from the store itself rather than typed
 * out — an entry renamed tomorrow renames the fingerprint with it, where a
 * literal would go on passing against a string nothing produces any more.
 */
const STORE = loadRules(entriesDir(), true).entries;

const FINGERPRINTS: string[] = STORE.flatMap((e) => [e.id, e.title]);

test('the store is non-empty, or every assertion in this file is vacuous', () => {
  assert.ok(STORE.length > 0, 'the shipped store has no entries, so nothing below can leak');
  assert.ok(FINGERPRINTS.every((f) => f.trim().length > 8), 'a fingerprint is too short to be distinctive');
});

/* ══ 1. THE FOUR SURFACES, ASKED WHAT THEY PRINT ═══════════════════════════ */

interface Probe { cwd: string; run(argv: string[]): string; dispose(): void }

/** A workspace with one real corpus item in it, so no surface answers emptily. */
function probe(): Probe {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-iso-'));
  const run = (argv: string[]): string => {
    const lines: string[] = [];
    runCli(argv, cwd, (s) => lines.push(s));
    return lines.join('\n');
  };
  assert.equal(runCli(['init'], cwd, () => {}), 0, 'the probe workspace did not initialize');
  assert.equal(
    runCli([
      'add', 'rule', 'the corpus item this probe looks for', '--body', 'a body',
      '--summary', 'One plain sentence so the capture is accepted and the item exists to be listed.',
      '--yes',
    ], cwd, () => {}),
    0,
    'the probe corpus item was not created',
  );
  return { cwd, run, dispose: () => removeTree(cwd) };
}

/**
 * Four separate tests with four messages, and deliberately not a loop: a loop
 * would say "a surface leaked" and leave the reader to find out which one, and
 * the whole value of this file is arriving at the surface that was wired by
 * accident.
 */
test('`list` returns nothing from the rule store', () => {
  const p = probe();
  try {
    const out = p.run(['list', '--full']);
    assert.match(out, /the-corpus-item-this-probe-looks-for/, '`list` printed no corpus rows at all');
    for (const fingerprint of FINGERPRINTS) {
      assert.ok(
        !out.includes(fingerprint),
        `\`list\` printed ${JSON.stringify(fingerprint)}. The store is not a corpus category ` +
        `(spec §7) — if it is listable it is also decayable, superseder-able and budgeted, and ` +
        `each of those is an exception somewhere else.`,
      );
    }
  } finally { p.dispose(); }
});

test('`ready` returns nothing from the rule store', () => {
  const p = probe();
  try {
    const out = p.run(['ready']);
    for (const fingerprint of FINGERPRINTS) {
      assert.ok(
        !out.includes(fingerprint),
        `\`ready\` printed ${JSON.stringify(fingerprint)}. Readiness is computed from the ` +
        `corpus' own \`needs:\` fields; a constant has no \`needs\` and can never be ready.`,
      );
    }
  } finally { p.dispose(); }
});

test('`doctor` returns nothing from the rule store', () => {
  const p = probe();
  try {
    const out = p.run(['doctor', '--full']);
    assert.ok(out.trim().length > 0, '`doctor` printed nothing at all, so nothing was checked');
    for (const fingerprint of FINGERPRINTS) {
      assert.ok(
        !out.includes(fingerprint),
        `\`doctor\` printed ${JSON.stringify(fingerprint)}. Doctor walks directories; it simply ` +
        `never walks this one (spec §7). A finding about a store entry is a finding a user ` +
        `cannot act on.`,
      );
    }
  } finally { p.dispose(); }
});

test('the injection selector returns nothing from the rule store', () => {
  const p = probe();
  try {
    const text = buildInjection(p.cwd);
    assert.match(
      text, /the corpus item this probe looks for/i,
      'the injection carried no corpus item at all, so its silence about the store proves nothing',
    );
    for (const fingerprint of FINGERPRINTS) {
      assert.ok(
        !text.includes(fingerprint),
        `the injection carried ${JSON.stringify(fingerprint)}. Delivery is Phase 2 and it is a ` +
        `different mechanism: the store is rendered by \`src/rules/deliver.ts\` and never ` +
        `selected as a corpus item, because a constant that competed for the tier budget would ` +
        `spend a user's budget on our rules.`,
      );
    }
  } finally { p.dispose(); }
});

/* ══ 2. THE IMPORT GRAPH, BOTH DIRECTIONS ══════════════════════════════════ */

const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*['"](\.[^'"]+)['"]/g;
const BARE_IMPORT = /(?:^|\n)\s*import\s*['"](\.[^'"]+)['"]/g;

/** Every module reachable from `entry` by a relative import, `entry` included. */
function closure(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [path.resolve(entry)];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    let text: string;
    try { text = readFileSync(file, 'utf8'); } catch { continue; }
    for (const pattern of [IMPORT, BARE_IMPORT]) {
      pattern.lastIndex = 0;
      for (const match of text.matchAll(pattern)) {
        queue.push(path.resolve(path.dirname(file), match[1]));
      }
    }
  }
  return seen;
}

/**
 * The modules that COMPUTE each surface's answer, rather than the CLI entry
 * point that dispatches to them.
 *
 * This distinction is load-bearing and it is not a weakening. `src/cli/index.ts`
 * imports `cli/commands/index.ts`, which is a column of side-effect imports
 * registering every command — `mycontext rules` among them from Task 5 — so a
 * closure taken from the CLI entry reaches `src/rules/` BY DESIGN and would
 * make this assertion permanently red for the one reason that is correct. The
 * question worth asking is the narrower one: can the corpus's own machinery
 * reach the store. Nothing below may.
 */
const CORPUS_MACHINERY: Record<string, string> = {
  'the corpus store': 'src/core/store.ts',
  'the injection selector': 'src/core/select.ts',
  'the injection assembly': 'src/core/inject.ts',
  'doctor': 'src/doctor/checks.ts',
  'ready': 'src/cli/commands/ready.ts',
  'the item loader': 'src/core/item.ts',
};

test('no corpus surface can reach the store, by any chain of imports', () => {
  const RULES_PREFIX = path.join(SRC, 'rules') + path.sep;
  for (const [what, rel] of Object.entries(CORPUS_MACHINERY)) {
    const file = path.join(REPO, ...rel.split('/'));
    assert.ok(statSync(file).isFile(), `${rel} does not exist — this assertion moved, it did not pass`);
    const reached = [...closure(file)].filter((m) => m.startsWith(RULES_PREFIX));
    assert.deepEqual(
      reached.map((m) => path.relative(REPO, m)), [],
      `${what} (${rel}) reaches src/rules/. Every edge from the corpus to the store is a place ` +
      `the store leaks — and an exception each surface learns is exactly what spec §7 rejected ` +
      `in favour of a store the corpus has never heard of.`,
    );
  }
});

/**
 * Anti-vacuity for the walk above. A `closure` that silently returned only its
 * entry — a changed regex, a resolution that stopped working — would make
 * every assertion pass while checking nothing.
 */
test('the import walk actually walks, so its silence means something', () => {
  const reached = closure(path.join(SRC, 'core', 'inject.ts'));
  assert.ok(reached.size > 5, `the closure of core/inject.ts is ${reached.size} modules; the walk is broken`);
  const rulesClosure = closure(path.join(SRC, 'rules', 'store.ts'));
  assert.ok(
    [...rulesClosure].some((m) => m.endsWith(path.join('core', 'frontmatter.ts'))),
    'the walk cannot see the one import src/rules/ genuinely has, so it would not see a tenth',
  );
});

test('src/rules/ imports nothing from src/core/ except the frontmatter parser', () => {
  const files = readdirSync(path.join(SRC, 'rules')).filter((f) => f.endsWith('.ts'));
  assert.ok(files.length > 0, 'src/rules/ holds no modules, so this proves nothing');
  const strays: string[] = [];
  for (const name of files) {
    const file = path.join(SRC, 'rules', name);
    for (const pattern of [IMPORT, BARE_IMPORT]) {
      pattern.lastIndex = 0;
      for (const match of readFileSync(file, 'utf8').matchAll(pattern)) {
        const target = path.resolve(path.dirname(file), match[1]);
        if (!target.startsWith(path.join(SRC, 'rules') + path.sep)
          && target !== path.join(SRC, 'core', 'frontmatter.ts')) {
          strays.push(`${name} -> ${path.relative(REPO, target)}`);
        }
      }
    }
  }
  assert.deepEqual(
    strays, [],
    'the store reached into the corpus. One parser and one file format is the discipline ' +
    '(spec §7); every other edge makes a later change to the corpus a change that has to think ' +
    'about the store.',
  );
});

/**
 * The one edge that IS allowed, asserted from the other side. If the store
 * stopped using the corpus' parser it would have grown a second one, which is
 * the "no second parser or file format" line of spec §18 — and the assertion
 * above would go on passing, because zero edges satisfies "at most one".
 */
test('the store uses the corpus frontmatter parser rather than a second one', () => {
  const schema = readFileSync(path.join(SRC, 'rules', 'schema.ts'), 'utf8');
  assert.match(schema, /from '\.\.\/core\/frontmatter\.ts'/);
});
