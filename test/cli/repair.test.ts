import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { COMMANDS } from '../../src/cli/commands/registry.ts';
import { needsRestamp, skippedGlobal } from '../../src/cli/commands/repair.ts';
import { parseItem } from '../../src/core/item.ts';
import { rebuild, writeItem } from '../../src/core/rebuild.ts';
import { select } from '../../src/core/select.ts';
import { Store } from '../../src/core/store.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';
import { cells } from '../helpers/table.ts';

/**
 * `mycontext repair` exists because four places in the codebase used to tell a
 * human to hand-edit an item's frontmatter, and following that instruction
 * poisons the item's checksum permanently: nothing recomputes it until some
 * other write happens to touch the item, `rebuild` does not repair it, and the
 * mismatch is reported forever with a message that blames the user for editing
 * the file outside my_context.
 */

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function withProject(fn: (cwd: string) => void): void {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-repair-'));
  runCli(['init'], cwd, () => {});
  try {
    fn(cwd);
  } finally {
    removeTree(cwd);
  }
}

function itemPath(root: string, type: string, id: string): string {
  return path.join(root, 'items', type, `${id}.md`);
}

/**
 * Writes a well-formed item through `writeItem` — the plugin's own write path,
 * the one `add`/`review promote`/`ingest-apply` all end in — so the file on
 * disk is in exactly the canonical, correctly-checksummed state a real corpus
 * holds. Tests then corrupt exactly the `checksum:` line, which is what a
 * hand-edit of any other field amounts to from the corpus's point of view.
 * Using the real writer (rather than a hand-rolled abbreviation of it) is what
 * makes the byte-identity assertions below mean something.
 */
function writeGoodItem(root: string, id: string, type: string, body = 'Body.'): string {
  const rel = `items/${type}/${id}.md`;
  const shell = `---\nid: ${id}\ntype: ${type}\ntitle: ${id}\nstatus: active\n---\n\n# ${id}\n\n${body}\n`;
  return writeItem(root, parseItem(shell, rel, 'project'));
}

function corruptChecksum(file: string): void {
  const text = readFileSync(file, 'utf8');
  writeFileSync(file, text.replace(/^checksum: .*$/m, 'checksum: deadbeefdeadbeef'), 'utf8');
}

// ── the selector, directly ───────────────────────────────────────────────────

test('needsRestamp picks exactly the project items whose checksum disagrees with their content', () => {
  withProject((cwd) => {
    const root = path.join(cwd, '.my_context');
    writeGoodItem(root, 'CONST-fine', 'constraint');
    const broken = writeGoodItem(root, 'CONST-broken-sum', 'constraint');
    corruptChecksum(broken);

    const items = ['CONST-fine', 'CONST-broken-sum'].map((id) =>
      parseItem(readFileSync(itemPath(root, 'constraint', id), 'utf8'), `items/constraint/${id}.md`, 'project'));

    assert.deepEqual(needsRestamp(items).map((i) => i.id), ['CONST-broken-sum']);
  });
});

test('needsRestamp leaves an item with NO recorded checksum alone', () => {
  // Nothing reports one (loadLayer skips the comparison when `checksum` is
  // empty), so re-stamping it would rewrite a file nobody complained about.
  const text = `---\nid: CONST-hand\ntype: constraint\ntitle: Hand\nstatus: active\n---\n\n# Hand\n\nB.\n`;
  const item = parseItem(text, 'items/constraint/CONST-hand.md', 'project');
  assert.equal(item.checksum, '');
  assert.deepEqual(needsRestamp([item]), []);
});

test('needsRestamp refuses a global-layer item, and skippedGlobal is where it shows up instead', () => {
  const text =
    `---\nid: CONST-g\ntype: constraint\ntitle: G\nstatus: active\nchecksum: deadbeefdeadbeef\n---\n\n# G\n\nB.\n`;
  const item = parseItem(text, 'items/constraint/CONST-g.md', 'global');
  assert.deepEqual(needsRestamp([item]), []);
  assert.deepEqual(skippedGlobal([item]).map((i) => i.id), ['CONST-g']);
});

// ── the dry run ──────────────────────────────────────────────────────────────

test('a dry run lists every item it would re-stamp, with id and file path', () => {
  withProject((cwd) => {
    const root = path.join(cwd, '.my_context');
    corruptChecksum(writeGoodItem(root, 'CONST-a', 'constraint'));
    corruptChecksum(writeGoodItem(root, 'REQ-b', 'requirement'));

    const { out } = run(['repair'], cwd);
    assert.match(out, /2 project item\(s\) have a checksum that disagrees/);
    assert.match(out, cells('CONST-a', 'items/constraint/CONST-a.md'));
    assert.match(out, cells('REQ-b', 'items/requirement/REQ-b.md'));
  });
});

test('a dry run changes nothing on disk', () => {
  withProject((cwd) => {
    const root = path.join(cwd, '.my_context');
    const file = writeGoodItem(root, 'CONST-a', 'constraint');
    corruptChecksum(file);
    const before = readFileSync(file, 'utf8');
    const beforeMtime = statSync(file).mtimeMs;

    const { code, out } = run(['repair'], cwd);
    assert.equal(code, 1, 'an unconfirmed repair is a refusal, like review promote/discard');
    assert.match(out, /refusing without confirmation/);
    assert.equal(readFileSync(file, 'utf8'), before, 'the file was rewritten by a run that only listed');
    assert.equal(statSync(file).mtimeMs, beforeMtime);
    // And the mismatch is still reported afterwards, i.e. nothing was quietly
    // half-done.
    assert.match(run(['doctor'], cwd).out, /checksum mismatch for "CONST-a"/);
  });
});

test('the dry run states what re-stamping cannot do, before the confirmation, not after', () => {
  withProject((cwd) => {
    const root = path.join(cwd, '.my_context');
    corruptChecksum(writeGoodItem(root, 'CONST-a', 'constraint'));

    const { out } = run(['repair'], cwd);
    assert.match(out, /does NOT do: recover anything/);
    assert.match(out, /re-stamping certifies the damaged text/);
    assert.match(out, /may be the only remaining evidence/);
    assert.doesNotMatch(out, /repairs corruption/i);
    assert.match(out, /canonical layout/, 'the reformatting is disclosed, not discovered afterwards');
    assert.match(out, /re-rendered from "title:"/);
    // Ordering: the honest paragraph must precede the confirmation refusal.
    assert.ok(
      out.indexOf('does NOT do') < out.indexOf('refusing without confirmation'),
      'the caveat has to be readable before the decision point, not after it',
    );
  });
});

// ── the write ────────────────────────────────────────────────────────────────

test('repair --yes re-stamps the checksum and doctor goes clean', () => {
  withProject((cwd) => {
    const root = path.join(cwd, '.my_context');
    const file = writeGoodItem(root, 'CONST-a', 'constraint');
    const original = readFileSync(file, 'utf8');
    corruptChecksum(file);

    assert.match(run(['doctor'], cwd).out, /checksum mismatch for "CONST-a"/);

    const { code, out } = run(['repair', '--yes'], cwd);
    assert.equal(code, 0);
    assert.match(out, /re-stamped CONST-a/);

    const after = run(['doctor'], cwd);
    assert.equal(after.code, 0);
    assert.doesNotMatch(after.out, /checksum mismatch/);
    // The ONLY thing that changed is the checksum line: re-stamping must not
    // quietly reformat or drop any of the item's content.
    assert.equal(readFileSync(file, 'utf8'), original);
  });
});

test('repair --yes preserves observations, relations, scope and tags byte for byte', () => {
  withProject((cwd) => {
    const root = path.join(cwd, '.my_context');
    const rel = 'items/constraint/CONST-rich.md';
    const shell =
      `---\nid: CONST-rich\ntype: constraint\ntitle: Rich\nstatus: active\nseverity: hard\n` +
      `scope:\n  - "src/db/**"\ntags:\n  - db\n---\n\n# Rich\n\nProse body.\n\n` +
      `## Observations\n- [fact] Something observed #db (in the writer)\n\n` +
      `## Relations\n- constrains [[CONST-rich]]\n`;
    const file = writeItem(root, parseItem(shell, rel, 'project'));
    const original = readFileSync(file, 'utf8');
    corruptChecksum(file);

    assert.equal(run(['repair', '--yes'], cwd).code, 0);
    assert.equal(readFileSync(file, 'utf8'), original);
    assert.match(original, /- \[fact\] Something observed #db \(in the writer\)/);
    assert.match(original, /- constrains \[\[CONST-rich\]\]/);
    assert.equal(run(['doctor'], cwd).code, 0);
  });
});

test('an abbreviated hand-written file IS reformatted into the canonical layout — the one change re-stamping makes beyond the checksum', () => {
  // Not a defect, and not silent either: `repair` writes through the same
  // `writeItem`/`renderItem` path every other write path uses, which renders
  // the full frontmatter with defaults made explicit. A file the plugin wrote
  // is already in that shape, so it comes back byte-identical (the tests
  // above). A file a human hand-wrote with fields omitted comes back with
  // those fields spelled out. The item's meaning is unchanged — every field
  // added here is the default `parseItem` already read — but the bytes are
  // not, so it is pinned rather than left as a surprise.
  withProject((cwd) => {
    const root = path.join(cwd, '.my_context');
    const rel = 'items/constraint/CONST-terse.md';
    const file = path.join(root, ...rel.split('/'));
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(
      file,
      `---\nid: CONST-terse\ntype: constraint\ntitle: Terse\nstatus: active\n` +
      `checksum: deadbeefdeadbeef\n---\n\n# Terse\n\nBody.\n`,
      'utf8',
    );

    assert.equal(run(['repair', '--yes'], cwd).code, 0);
    const after = readFileSync(file, 'utf8');
    assert.match(after, /^severity: soft$/m);
    assert.match(after, /^origin: human$/m);
    assert.match(after, /^# Terse$/m);
    assert.match(after, /^Body\.$/m);
    assert.equal(run(['doctor'], cwd).code, 0);
  });
});

test('a hand-edited title: leaves the "# heading" re-rendered from it, and nothing else moves', () => {
  // The realistic case, reproduced end to end by hand before it was written
  // down: someone edits `title:` in the frontmatter (the thing four places in
  // this codebase used to tell them to do) and the H1 below it now disagrees.
  // `parseItem` takes the title from the frontmatter and consumes the H1, so
  // repair's re-render brings the H1 into line with the value my_context was
  // already using. Pinned because the confirmation text claims exactly this.
  withProject((cwd) => {
    const root = path.join(cwd, '.my_context');
    const file = writeGoodItem(root, 'CONST-titled', 'constraint', 'The body must survive.');
    writeFileSync(
      file,
      readFileSync(file, 'utf8').replace(/^title: .*$/m, 'title: A different title'),
      'utf8',
    );

    assert.equal(run(['repair', '--yes'], cwd).code, 0);
    const after = readFileSync(file, 'utf8');
    assert.match(after, /^title: A different title$/m);
    assert.match(after, /^# A different title$/m, 'the heading follows title:, as the prompt says it will');
    assert.match(after, /^The body must survive\.$/m);
    assert.equal(run(['doctor'], cwd).code, 0);
  });
});

test('repair --yes says plainly that nothing was recovered', () => {
  withProject((cwd) => {
    const root = path.join(cwd, '.my_context');
    corruptChecksum(writeGoodItem(root, 'CONST-a', 'constraint'));
    const { out } = run(['repair', '--yes'], cwd);
    assert.match(out, /Nothing was recovered/);
    assert.match(out, /still wrong and now checksums clean/);
  });
});

test('repair --yes touches only the items that needed it', () => {
  withProject((cwd) => {
    const root = path.join(cwd, '.my_context');
    const untouched = writeGoodItem(root, 'CONST-fine', 'constraint');
    const before = statSync(untouched).mtimeMs;
    corruptChecksum(writeGoodItem(root, 'CONST-a', 'constraint'));

    const { out } = run(['repair', '--yes'], cwd);
    assert.doesNotMatch(out, /CONST-fine/);
    assert.equal(statSync(untouched).mtimeMs, before, 'a healthy item must not be rewritten');
  });
});

// ── nothing to do, and flags ─────────────────────────────────────────────────

test('repair exits 0 with a plain answer when there is nothing to re-stamp', () => {
  withProject((cwd) => {
    writeGoodItem(path.join(cwd, '.my_context'), 'CONST-fine', 'constraint');
    const { code, out } = run(['repair'], cwd);
    assert.equal(code, 0);
    assert.match(out, /nothing to re-stamp/);
    assert.doesNotMatch(out, /refusing without confirmation/, 'there was nothing to confirm');
  });
});

test('repair refuses an unknown flag instead of absorbing it', () => {
  withProject((cwd) => {
    const { code, out } = run(['repair', '--dry-run'], cwd);
    assert.equal(code, 1);
    assert.match(out, /unknown flag "--dry-run"/);
    assert.match(out, /accepts --yes only/);
  });
});

test('repair outside a workspace explains how to make one', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-norepair-'));
  try {
    const { code, out } = run(['repair'], cwd);
    assert.equal(code, 1);
    assert.match(out, /mycontext init/);
  } finally {
    removeTree(cwd);
  }
});

test('repair is advertised in the usage banner like every other command', () => {
  withProject((cwd) => {
    const { out } = run(['help'], cwd);
    assert.match(out, /^\s+repair \[--yes\]\s+re-stamp project items/m);
  });
});

// ── the global layer ─────────────────────────────────────────────────────────

/** Runs `repair` against an explicit workspace whose `globalRoot` is a
 * tempdir, so the global-layer behaviour can be exercised without touching
 * the real `~/.my-context` — the same technique `doctor.test.ts` uses. */
function runWithGlobalRoot(cwd: string, globalRoot: string, args: string[]): { code: number; out: string } {
  const ws = { ...resolveWorkspace(cwd), globalRoot };
  let out = '';
  const def = COMMANDS.get('repair')!;
  if (def.workspace === 'none') throw new Error('repair must be a workspace command');
  const code = def.run(ws, args, (s) => { out += s + '\n'; }, cwd);
  return { code, out };
}

test('a mismatched global-layer item is named and left alone, not silently skipped', () => {
  withProject((cwd) => {
    const globalRoot = mkdtempSync(path.join(tmpdir(), 'myctx-global-'));
    try {
      writeFileSync(
        path.join(globalRoot, 'config.json'),
        JSON.stringify({ profile: 'standard', categories: {}, budgets: {} }, null, 2) + '\n',
      );
      const gfile = path.join(globalRoot, 'items', 'constraint', 'CONST-global.md');
      mkdirSync(path.dirname(gfile), { recursive: true });
      writeFileSync(
        gfile,
        `---\nid: CONST-global\ntype: constraint\ntitle: G\nstatus: active\nchecksum: deadbeefdeadbeef\n---\n\n# G\n\nB.\n`,
        'utf8',
      );
      const before = readFileSync(gfile, 'utf8');

      const { code, out } = runWithGlobalRoot(cwd, globalRoot, ['--yes']);
      assert.equal(code, 0);
      assert.match(out, /nothing to re-stamp in this project/);
      assert.match(out, /CONST-global/);
      assert.match(out, /global items are read-only in a project/);
      assert.equal(readFileSync(gfile, 'utf8'), before, 'a global item must not be rewritten from a project');
      // And no project-layer shadow file was written for that id.
      assert.equal(
        statSync(path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-global.md'), { throwIfNoEntry: false }),
        undefined,
      );
    } finally {
      removeTree(globalRoot);
    }
  });
});

// -- the README claim that motivates this whole command --------------------

test('rebuild does not recompute a checksum a hand edit invalidated, and repair does', () => {
  // README, verbatim: "`mycontext rebuild` does **not** recompute it -
  // verified by execution: edit `always:` by hand, run `rebuild`, and the
  // `checksum:` line is byte-identical to what it was before."
  //
  // That sentence is the entire justification for `mycontext repair`
  // existing, and nothing tested it. A `rebuild` that quietly re-stamped
  // would make the command pointless AND make the docs false, and the suite
  // would have stayed green either way. Asserted here by doing exactly what
  // the README describes, on `always:` specifically.
  withProject((cwd) => {
    const root = path.join(cwd, '.my_context');
    const file = writeGoodItem(root, 'CONST-pinned', 'constraint');
    const original = readFileSync(file, 'utf8');
    const checksumLine = (text: string): string => {
      const match = /^checksum: .*$/m.exec(text);
      assert.ok(match, 'the item must carry a checksum line at all');
      return match[0];
    };

    writeFileSync(file, original.replace(/^always: false$/m, 'always: true'), 'utf8');
    assert.notEqual(
      readFileSync(file, 'utf8'), original,
      'the hand edit must actually have changed the file, or this test proves nothing',
    );

    const rebuilt = run(['rebuild'], cwd);
    assert.equal(rebuilt.code, 0);
    assert.equal(
      checksumLine(readFileSync(file, 'utf8')), checksumLine(original),
      'README says rebuild leaves the checksum line byte-identical after a hand edit',
    );

    // Which is why doctor keeps reporting it, forever, until repair is run.
    assert.equal(run(['doctor'], cwd).code, 1);
    assert.match(run(['doctor'], cwd).out, /checksum/i);

    const repaired = run(['repair', '--yes'], cwd);
    assert.equal(repaired.code, 0);
    assert.match(repaired.out, /re-stamped CONST-pinned/);
    assert.notEqual(
      checksumLine(readFileSync(file, 'utf8')), checksumLine(original),
      'repair must move the checksum, or it did not do the one thing it claims',
    );
    assert.match(readFileSync(file, 'utf8'), /^always: true$/m, 'the hand-edited value stands');
    assert.equal(run(['doctor'], cwd).code, 0);
  });
});

/**
 * B1 — the route `repair` completes, demonstrated end to end rather than
 * argued about. `update_item` refuses `always`/`severity` on a governing
 * normative item and `review promote` acts only on drafts, so until this
 * command existed a hand edit of those fields left a permanent mismatch that
 * `doctor` reported and `rebuild` never cleared. `repair --yes` clears it —
 * which is the command's whole purpose, and also means the sequence
 * "hand edit + repair" changes what governs this project and leaves nothing
 * behind afterwards. Three shipped documents said that route did not exist;
 * this test is what stops them saying it again.
 */
test('hand edit plus repair --yes changes what governs, and leaves no evidence', () => {
  withProject((cwd) => {
    const root = path.join(cwd, '.my_context');
    const file = writeGoodItem(root, 'CONST-governing', 'constraint');
    const before = readFileSync(file, 'utf8');
    assert.match(before, /^status: active$/m, 'the fixture must actually govern');
    assert.match(before, /^always: false$/m);
    assert.match(before, /^severity: soft$/m);

    // Exactly what `update_item` refuses, done by hand.
    writeFileSync(
      file,
      before.replace(/^always: false$/m, 'always: true')
        .replace(/^severity: soft$/m, 'severity: hard'),
      'utf8',
    );
    assert.equal(run(['doctor'], cwd).code, 1, 'before repair the edit is visible and reported');

    const repaired = run(['repair', '--yes'], cwd);
    assert.equal(repaired.code, 0);
    assert.match(repaired.out, /re-stamped CONST-governing/);

    const after = readFileSync(file, 'utf8');
    assert.match(after, /^always: true$/m);
    assert.match(after, /^severity: hard$/m);
    assert.equal(run(['doctor'], cwd).code, 0, 'no evidence of the change remains in the corpus');

    // And the change is not cosmetic: the item is now PINNED — injected in
    // full at every session start rather than appearing as one index line.
    const ws = resolveWorkspace(cwd);
    const store = Store.open(ws.dbPath);
    try {
      rebuild(store, { project: ws.projectRoot as string }, ws.config);
      const chosen = select(store.all(), { event: 'session-start' }, ws.config);
      assert.deepEqual(chosen.full.map((e) => e.item.id), ['CONST-governing']);
    } finally {
      store.close();
    }
  });
});
