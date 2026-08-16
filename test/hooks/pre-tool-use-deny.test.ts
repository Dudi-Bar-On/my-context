import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  linkSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { denyReason, extractFilePath, runPreToolUse } from '../../src/hooks/pre-tool-use.ts';
import { canonicalizeNearestExisting, toPosix } from '../../src/core/paths.ts';
import { removeTree } from '../helpers/tmp.ts';

const CWD = path.resolve('/repo');

function hookInput(toolName: string, filePath: string): string {
  return JSON.stringify({
    session_id: 's1',
    hook_event_name: 'PreToolUse',
    cwd: CWD,
    tool_name: toolName,
    tool_input: { file_path: filePath },
  });
}

function decision(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw) as { hookSpecificOutput: Record<string, unknown> };
  return parsed.hookSpecificOutput;
}

test('writing an item file is denied and names the create_item tool', () => {
  const out = runPreToolUse(
    hookInput('Write', path.join(CWD, '.my_context/items/constraint/CONST-a.md')), CWD);
  const d = decision(out);
  assert.equal(d.hookEventName, 'PreToolUse');
  assert.equal(d.permissionDecision, 'deny');
  assert.match(String(d.permissionDecisionReason), /create_item/);
});

/**
 * `mycontext add` now routes through `mutate.ts`'s `createItem` (it no
 * longer bypasses the trust model), but it is still a human-facing CLI
 * command an agent in a hook-driven session cannot reach for. The hook that
 * enforces the write boundary must still point an agent at the MCP tool, not
 * a CLI command.
 */
test('no deny reason points the model at the CLI add command', () => {
  for (const rel of [
    '.my_context/items/constraint/CONST-a.md',
    '.my_context/config.json',
    '.my_context/.index.db',
  ]) {
    const reason = denyReason(path.join(CWD, rel));
    assert.ok(reason, rel);
    assert.doesNotMatch(reason, /mycontext add/, rel);
  }
});

test('editing an item file is denied too', () => {
  const out = runPreToolUse(
    hookInput('Edit', path.join(CWD, '.my_context/items/adr/ADR-a.md')), CWD);
  assert.equal(decision(out).permissionDecision, 'deny');
});

/**
 * MultiEdit reaches the same files as Edit and Write. `hooks.json`'s
 * PreToolUse matcher must list it, or a MultiEdit straight into
 * `.my_context/items/CONST-x.md` — flipping `status: draft` to `active` —
 * is blocked by nothing at all.
 */
test('a MultiEdit into an item file is denied, and hooks.json actually matches MultiEdit', () => {
  const out = runPreToolUse(
    hookInput('MultiEdit', path.join(CWD, '.my_context/items/constraint/CONST-a.md')), CWD);
  assert.equal(decision(out).permissionDecision, 'deny');

  const config = JSON.parse(
    readFileSync(path.join(import.meta.dirname, '../../hooks/hooks.json'), 'utf8'),
  ) as { hooks: { PreToolUse: { matcher: string }[] } };
  const matcher = config.hooks.PreToolUse[0].matcher;
  assert.ok(
    new RegExp(`^(?:${matcher})$`).test('MultiEdit'),
    `hooks.json PreToolUse matcher ${JSON.stringify(matcher)} does not match MultiEdit`,
  );
  for (const tool of ['Read', 'Edit', 'Write']) {
    assert.ok(new RegExp(`^(?:${matcher})$`).test(tool), `matcher lost ${tool}`);
  }
});

/**
 * NotebookEdit is a lower-risk sibling of the MultiEdit gap closed above —
 * it can still write cell content straight into an item file's path. The
 * PreToolUse matcher must list it too, or a NotebookEdit into
 * `.my_context/items/CONST-x.md` is blocked by nothing at all.
 */
test('hooks.json PreToolUse matcher covers NotebookEdit', () => {
  const config = JSON.parse(
    readFileSync(path.join(import.meta.dirname, '../../hooks/hooks.json'), 'utf8'),
  ) as { hooks: { PreToolUse: { matcher: string }[] } };
  const matcher = config.hooks.PreToolUse[0].matcher;
  assert.ok(
    new RegExp(`^(?:${matcher})$`).test('NotebookEdit'),
    `hooks.json PreToolUse matcher ${JSON.stringify(matcher)} does not match NotebookEdit`,
  );
  for (const tool of ['Read', 'Edit', 'MultiEdit', 'Write']) {
    assert.ok(new RegExp(`^(?:${matcher})$`).test(tool), `matcher lost ${tool}`);
  }
});

test('writing the index database is denied and names the rebuild command', () => {
  const out = runPreToolUse(hookInput('Write', path.join(CWD, '.my_context/.index.db')), CWD);
  assert.match(String(decision(out).permissionDecisionReason), /mycontext rebuild/);
});

test('writing anything else under .my_context is denied with the general reason', () => {
  const out = runPreToolUse(hookInput('Write', path.join(CWD, '.my_context/config.json')), CWD);
  const reason = String(decision(out).permissionDecisionReason);
  assert.match(reason, /config\.json/);
  assert.match(reason, /managed by my_context/i);
});

test('the global layer is protected as well', () => {
  const out = runPreToolUse(
    hookInput('Write', path.join(path.resolve('/home/u'), '.my-context/items/rule/RULE-a.md')),
    CWD,
  );
  assert.equal(decision(out).permissionDecision, 'deny');
});

/**
 * NTFS (and APFS by default) resolve paths case-insensitively, so on the
 * plugin's first-target platform `.MY_CONTEXT/items/…` names the exact same
 * directory as `.my_context/items/…`. A case-SENSITIVE segment match therefore
 * let a Write straight into an item file through with empty output and exit 0
 * — reproduced against the real hook binary over stdin, then written through:
 * `mycontext rebuild` indexed the forged file as an `active`, `always: true`,
 * `origin: human` constraint, i.e. a pinned governing item injected into every
 * session, defeating the spec §7.1 draft/review gate outright.
 *
 * The assertion on the reason text is deliberate: an earlier revision of this
 * test asserted only that output was non-empty, which a JIT-context response
 * would also satisfy. Naming a phrase unique to the item deny message means a
 * silent-allow regression cannot pass by returning some other JSON.
 */
test('the item write-deny is case-insensitive on the managed segment', () => {
  for (const spelling of ['.MY_CONTEXT', '.My_Context', '.my_CONTEXT', '.MY-CONTEXT', '.My-Context']) {
    const out = runPreToolUse(
      hookInput('Write', path.join(CWD, spelling, 'items/constraint/FORGED.md')), CWD);
    assert.notEqual(out, '', `${spelling} was allowed through (empty output = allow)`);
    const d = decision(out);
    assert.equal(d.permissionDecision, 'deny', spelling);
    assert.match(String(d.permissionDecisionReason), /bypasses the review boundary/, spelling);
  }
});

test('the non-item write-deny is case-insensitive too', () => {
  for (const rel of ['.MY_CONTEXT/config.json', '.My_Context/.index.db', '.MY-CONTEXT/state/x.json']) {
    const reason = denyReason(path.join(CWD, rel));
    assert.notEqual(reason, null, rel);
  }
});

/**
 * The 8.3 short-name bypass, closed.
 *
 * On an NTFS volume with 8.3 short-name generation enabled (`fsutil 8dot3name
 * query C:`), `.my_context` also answers to a generated short name —
 * `MY_CON~1` on the machine this was written on. That string shares no
 * characters with either spelling the segment regex knows, so no regex over
 * the path could ever match it; a `Write` to
 * `<repo>\MY_CON~1\items\constraint\FORGED.md` passed the real hook binary
 * with empty output and exit 0, and the file landed in
 * `.my_context\items\constraint\`. Reproduced end to end before the fix, and
 * confirmed gone after it.
 *
 * This test needs a REAL directory, not a synthetic path: the check now goes
 * through the filesystem, and the short name only exists if the volume
 * generates one. Where it does not (8.3 disabled, or any non-Windows
 * filesystem) there is no bypass to close, and the test says so rather than
 * asserting something vacuous.
 */
test('an 8.3 short-name spelling is denied', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-8dot3-'));
  try {
    mkdirSync(path.join(dir, '.my_context', 'items'), { recursive: true });
    const short = path.join(dir, 'MY_CON~1');
    let resolves = false;
    try {
      resolves = realpathSync.native(short) === realpathSync.native(path.join(dir, '.my_context'));
    } catch { /* no short name on this volume */ }
    if (!resolves) {
      t.skip('this volume does not generate 8.3 short names, so there is nothing to bypass');
      return;
    }

    const reason = denyReason(path.join(short, 'items', 'constraint', 'FORGED.md'));
    assert.notEqual(reason, null, 'the 8.3 short name walked past the write-deny');
    assert.match(String(reason), /bypasses the review boundary/);
  } finally {
    removeTree(dir);
  }
});

/**
 * A symlink (POSIX) or junction (Windows, no elevation needed) pointing INTO
 * the managed directory is another name for that directory, so a write
 * through it is a write into the corpus. This is a deliberate widening that
 * came with canonicalization; it is asserted rather than left to happen
 * quietly.
 */
test('a symlink or junction pointing into the managed directory is denied', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-link-'));
  try {
    const managed = path.join(dir, '.my_context');
    mkdirSync(path.join(managed, 'items'), { recursive: true });
    const link = path.join(dir, 'sneaky');
    try {
      symlinkSync(managed, link, 'junction');
    } catch (err) {
      t.skip(`cannot create a link on this machine: ${(err as NodeJS.ErrnoException).code}`);
      return;
    }

    const reason = denyReason(path.join(link, 'items', 'constraint', 'FORGED.md'));
    assert.notEqual(reason, null, 'a link into .my_context walked past the write-deny');
    assert.match(String(reason), /bypasses the review boundary/);
  } finally {
    removeTree(dir);
  }
});

/**
 * The narrowing hazard canonicalization introduces, and the reason
 * `denyReason` checks the raw spelling as well as the canonical one.
 *
 * If `.my_context` is itself a link pointing outside the repo, its canonical
 * path crosses no managed segment — so a canonical-ONLY check would allow a
 * write that the plain string check has always denied. Mutating the `??` in
 * `denyReason` into a canonical-only lookup must turn this test red.
 */
test('a .my_context that is itself a link out of the tree is still denied', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-outlink-'));
  try {
    const elsewhere = path.join(dir, 'elsewhere');
    const repo = path.join(dir, 'repo');
    mkdirSync(path.join(elsewhere, 'items'), { recursive: true });
    mkdirSync(repo, { recursive: true });
    const managed = path.join(repo, '.my_context');
    try {
      symlinkSync(elsewhere, managed, 'junction');
    } catch (err) {
      t.skip(`cannot create a link on this machine: ${(err as NodeJS.ErrnoException).code}`);
      return;
    }

    // The premise: canonicalization really does take this path out of the
    // managed tree. Without this assertion the test could pass for the
    // trivial reason that the link did not resolve.
    assert.doesNotMatch(
      toPosix(canonicalizeNearestExisting(path.join(managed, 'items', 'constraint', 'X.md'))),
      /\.my_context/,
      'premise broken: the canonical path still names .my_context',
    );

    const reason = denyReason(path.join(managed, 'items', 'constraint', 'X.md'));
    assert.notEqual(reason, null, 'canonicalization narrowed the deny — the raw check was lost');
  } finally {
    removeTree(dir);
  }
});

/**
 * The whole difficulty of canonicalizing a `Write` target: neither the file
 * nor its directories exist yet, so `realpathSync` throws on the path as
 * given and only the nearest existing ANCESTOR can be resolved.
 */
test('canonicalization resolves the nearest existing ancestor and keeps the remainder', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-canon-'));
  try {
    const managed = path.join(dir, '.my_context');
    mkdirSync(managed, { recursive: true });
    const real = realpathSync.native(managed);

    // `items/constraint/` and the file do not exist.
    const target = path.join(managed, 'items', 'constraint', 'NEW.md');
    assert.equal(
      canonicalizeNearestExisting(target),
      path.join(real, 'items', 'constraint', 'NEW.md'),
    );

    // None of the tail exists: the nearest existing ancestor is `dir` itself,
    // so the result is dir's CANONICAL spelling plus the untouched tail. Not
    // `path.resolve(nowhere)` — that keeps dir as spelled, and on a machine
    // whose %TEMP% is an 8.3 short name (`C:\Users\RUNNER~1\…`, the GitHub
    // Windows runner) the two differ, which is the exact difference
    // canonicalization exists to resolve.
    const nowhere = path.join(dir, 'no', 'such', 'tree', 'at', 'all.md');
    assert.equal(
      canonicalizeNearestExisting(nowhere),
      path.join(realpathSync.native(dir), 'no', 'such', 'tree', 'at', 'all.md'),
    );

    // An existing file is resolved outright, with no tail to re-append.
    assert.equal(canonicalizeNearestExisting(managed), real);
  } finally {
    removeTree(dir);
  }
});

/**
 * Case-sensitivity is a property of the filesystem, and canonicalization must
 * not invent a resolution the filesystem does not perform. On Linux
 * `.MY_CONTEXT` is a genuinely different directory from `.my_context`, and
 * canonicalizing a path through it must leave it alone. (The segment regex's
 * `i` flag denies that path anyway — deliberate over-blocking, documented on
 * `MANAGED_SEGMENT` — but that is a separate decision from what
 * canonicalization is allowed to do.)
 */
test('canonicalization does not fold case on a case-sensitive filesystem', (t) => {
  if (process.platform === 'win32' || process.platform === 'darwin') {
    t.skip('this platform resolves paths case-insensitively by default');
    return;
  }
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-case-'));
  try {
    mkdirSync(path.join(dir, '.my_context', 'items'), { recursive: true });
    mkdirSync(path.join(dir, '.MY_CONTEXT', 'items'), { recursive: true });
    const canonical = canonicalizeNearestExisting(
      path.join(dir, '.MY_CONTEXT', 'items', 'constraint', 'X.md'));
    assert.match(toPosix(canonical), /\.MY_CONTEXT\/items/);
  } finally {
    removeTree(dir);
  }
});

/**
 * THE RESIDUAL canonicalization does not close, pinned so it cannot change
 * unnoticed — not a property being asserted as safe.
 *
 * A symlink has a target, so realpath resolves it. A HARD link does not: it
 * is a second, equal directory entry for the same file, and no API can say
 * which entry is "real". So a hard link placed outside `.my_context` that
 * points at an existing item file is a path the write-deny cannot recognize,
 * and a `Write` through it edits the item in place — flipping `status: draft`
 * to `active`, say.
 *
 * Why this is not a new hole: creating the link needs `mklink /H`, `ln`, or
 * an equivalent, i.e. a shell. `Bash` is not in the PreToolUse matcher and
 * the hook only inspects a `file_path` argument, so an agent that can create
 * the link can already redirect straight into `.my_context/` and run
 * `mycontext rebuild`. This is a corollary of that documented route, not a
 * separate one — but it is the specific thing canonicalization looks like it
 * should have covered and does not, so it is written down here.
 *
 * Everything else probed on this machine IS denied: 8.3 short names, junctions
 * and symlinks, `\\?\` prefixes, `\\localhost\C$` UNC admin shares, `subst`
 * drives, `..` traversal, trailing dots, and `::$DATA` alternate-stream
 * suffixes — each of those either names `.my_context` in the string or
 * resolves to it.
 */
test('RESIDUAL: a hard link to an item file is NOT denied', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-hardlink-'));
  try {
    const item = path.join(dir, '.my_context', 'items', 'constraint', 'CONST-a.md');
    mkdirSync(path.dirname(item), { recursive: true });
    writeFileSync(item, 'body');
    const hard = path.join(dir, 'looks-ordinary.md');
    try {
      linkSync(item, hard);
    } catch (err) {
      t.skip(`cannot create a hard link on this machine: ${(err as NodeJS.ErrnoException).code}`);
      return;
    }
    assert.equal(denyReason(hard), null);
  } finally {
    removeTree(dir);
  }
});

/**
 * The hook runs against paths that do not exist at all — synthetic ones in
 * this very file, and real ones on a machine where the repo lives somewhere
 * the hook cwd does not describe. Canonicalization must be invisible there.
 */
test('a path with no existing ancestor at all is still judged by its spelling', () => {
  assert.notEqual(
    denyReason(path.join(CWD, 'no-such-tree/.my_context/items/constraint/X.md')), null);
  assert.equal(denyReason(path.join(CWD, 'no-such-tree/src/writer.ts')), null);
});

test('a relative path is resolved against the hook cwd before the check', () => {
  const out = runPreToolUse(hookInput('Write', '.my_context/items/rule/RULE-a.md'), CWD);
  assert.equal(decision(out).permissionDecision, 'deny');
});

test('a native Windows path is normalized before the check', () => {
  assert.notEqual(denyReason('C:\\repo\\.my_context\\items\\rule\\RULE-a.md'), null);
});

test('Read is never denied — reading an item is legitimate', () => {
  const out = runPreToolUse(
    hookInput('Read', path.join(CWD, '.my_context/items/constraint/CONST-a.md')), CWD);
  assert.equal(out, '');
});

test('writes outside .my_context are not denied', () => {
  assert.equal(runPreToolUse(hookInput('Write', path.join(CWD, 'src/db/writer.ts')), CWD), '');
  assert.equal(denyReason(path.join(CWD, 'src/my_context_notes.md')), null);
});

test('a directory merely named my_context is not protected', () => {
  assert.equal(denyReason(path.join(CWD, 'my_context/items/x.md')), null);
});

test('a directory or file that merely starts with .my_context is not protected', () => {
  assert.equal(denyReason(path.join(CWD, '.my_context-notes/x.md')), null);
  assert.equal(denyReason(path.join(CWD, '.my_contextrc')), null);
});

test('extractFilePath accepts the three tool input shapes and rejects the rest', () => {
  assert.equal(extractFilePath({ tool_input: { file_path: 'a.ts' } }), 'a.ts');
  assert.equal(extractFilePath({ tool_input: { path: 'b.ts' } }), 'b.ts');
  assert.equal(extractFilePath({ tool_input: { notebook_path: 'c.ipynb' } }), 'c.ipynb');
  assert.equal(extractFilePath({ tool_input: { file_path: '   ' } }), null);
  assert.equal(extractFilePath({ tool_input: {} }), null);
  assert.equal(extractFilePath({}), null);
});

test('malformed or empty stdin produces empty output, never a throw', () => {
  assert.equal(runPreToolUse('', CWD), '');
  assert.equal(runPreToolUse('{ not json', CWD), '');
  assert.equal(runPreToolUse('[]', CWD), '');
  assert.equal(runPreToolUse('null', CWD), '');
  assert.equal(runPreToolUse(JSON.stringify({ tool_name: 'Write' }), CWD), '');
});

test('an error mid-decision falls back to allow, not deny', () => {
  // A non-string cwd survives parseHookInput (it only rejects non-object/array
  // top-level values) and reaches path.resolve(cwd, filePath), which throws for
  // a non-string first argument. The catch in runPreToolUse must turn that into
  // '' (allow) rather than let it propagate or somehow deny.
  const raw = JSON.stringify({
    session_id: 's1',
    cwd: 12345,
    tool_name: 'Write',
    tool_input: { file_path: '.my_context/items/rule/RULE-a.md' },
  });
  assert.equal(runPreToolUse(raw, CWD), '');
});
