import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkCliOnPath, CLI_BIN_NAME, defaultCliLookup, readShimTarget, type CliLookup } from '../../src/doctor/checks.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * `checkCliOnPath` reads real ambient PATH state through its `lookup`
 * parameter — see the check's own doc comment (checks.ts) for why that
 * parameter exists at all. Every test below injects a fake `lookup`
 * (per the task brief: "the lookup injected rather than by manipulating the
 * real PATH") so none of them pass or fail depending on whether THIS
 * machine happens to have `mycontext` linked. Where a candidate needs to
 * resolve through an npm-style shim, the shim is a REAL file on disk in a
 * temp directory — that part of the resolution (`readShimTarget`) reads
 * files for real, deliberately, because a fake `readFile`/`realpath` would
 * only prove the fake agrees with itself.
 */

function tmp(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-cli-path-'));
  return { dir, cleanup: () => removeTree(dir) };
}

function write(file: string, content: string): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content, 'utf8');
}

/**
 * Builds a real npm-generated-SHAPED shim on disk: `binDir/mycontext.cmd`
 * (or any name) whose text embeds `node_modules/mycontext/<relTarget>`,
 * exactly the marker every `.cmd`, `.ps1` and POSIX template this project's
 * own linked shim was read to verify carries (see the module comment on
 * `checkCliOnPath`). The file the shim's text resolves to is created too,
 * with `content` — the caller decides whether that makes it the SAME file
 * as `ownCliEntry` (healthy) or a different one (mismatch).
 */
function writeShim(binDir: string, shimName: string, relTarget: string, content: string): {
  shimPath: string; targetPath: string;
} {
  const shimPath = path.join(binDir, shimName);
  write(shimPath, `@ECHO off\r\nnode "%~dp0\\node_modules\\mycontext\\${relTarget}" %*\r\n`);
  const targetPath = path.join(binDir, 'node_modules', 'mycontext', ...relTarget.split('/'));
  write(targetPath, content);
  return { shimPath, targetPath };
}

test('healthy: PATH resolves to this checkout\'s own CLI — no finding, the same silence other clean checks return', () => {
  const { dir, cleanup } = tmp();
  try {
    const binDir = path.join(dir, 'npmbin');
    const { shimPath, targetPath } = writeShim(binDir, 'mycontext.cmd', 'src/cli/index.ts', 'own cli\n');
    const lookup: CliLookup = () => [shimPath];
    assert.deepEqual(checkCliOnPath(targetPath, lookup), []);
  } finally {
    cleanup();
  }
});

test('healthy: a direct match with no wrapper shape at all (the plain-symlink case) is also silent', () => {
  const { dir, cleanup } = tmp();
  try {
    // No "node_modules" marker in this file's own text — `readShimTarget`
    // treats the candidate's own resolved path as the answer, which is
    // exactly right for a POSIX symlink straight at the CLI with no wrapper.
    const entry = path.join(dir, 'own', 'src', 'cli', 'index.ts');
    write(entry, 'export {};\n');
    const lookup: CliLookup = () => [entry];
    assert.deepEqual(checkCliOnPath(entry, lookup), []);
  } finally {
    cleanup();
  }
});

test('not on PATH: warn, names npm link and the node fallback, never fails the build on its own', () => {
  const { dir, cleanup } = tmp();
  try {
    const packageRoot = path.join(dir, 'my-context');
    write(path.join(packageRoot, 'package.json'), '{"name":"mycontext"}\n');
    const ownEntry = path.join(packageRoot, 'src', 'cli', 'index.ts');
    write(ownEntry, 'own cli\n');
    const lookup: CliLookup = () => [];

    const findings = checkCliOnPath(ownEntry, lookup);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].level, 'warn');
    assert.equal(findings[0].code, 'cli_not_on_path');
    assert.match(findings[0].message, /command not found/);
    assert.match(findings[0].message, /npm link/);
    // Names the nearest package.json directory, not just any ancestor.
    assert.match(findings[0].message, new RegExp(packageRoot.replace(/\\/g, '\\\\')));
    // The README's own documented fallback, so a reader can act on it right now.
    assert.match(findings[0].message, new RegExp(`node ${ownEntry.replace(/[\\.]/g, '\\$&')}`));
  } finally {
    cleanup();
  }
});

test('resolves elsewhere: error — the worst of the three states, and it is worse than not resolving at all', () => {
  const { dir, cleanup } = tmp();
  try {
    const binDir = path.join(dir, 'npmbin');
    // The shim resolves to ITS OWN node_modules/mycontext copy — a
    // different checkout than `ownEntry` below, by construction.
    const { shimPath, targetPath } = writeShim(binDir, 'mycontext.cmd', 'src/cli/index.ts', 'a stale checkout\n');
    const ownEntry = path.join(dir, 'own', 'src', 'cli', 'index.ts');
    write(ownEntry, 'this checkout\n');
    const lookup: CliLookup = () => [shimPath];

    const findings = checkCliOnPath(ownEntry, lookup);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].level, 'error');
    assert.equal(findings[0].code, 'cli_path_mismatch');
    assert.match(findings[0].message, /NOT this workspace's own CLI/);
    assert.match(findings[0].message, new RegExp(shimPath.replace(/\\/g, '\\\\')));
    assert.match(findings[0].message, new RegExp(targetPath.replace(/\\/g, '\\\\')));
  } finally {
    cleanup();
  }
});

test('resolves elsewhere: at least one matching candidate does not launder a genuinely mismatched one', () => {
  // `where` on a real machine can report more than one candidate (this
  // project's own linked shim: the extensionless POSIX file AND
  // mycontext.cmd, verified by hand while building this check). If ONE of
  // them is this checkout and another is not, the mismatch must still be
  // reported — a person can still run the wrong one.
  const { dir, cleanup } = tmp();
  try {
    const binDir = path.join(dir, 'npmbin');
    const ownEntry = path.join(dir, 'own', 'src', 'cli', 'index.ts');
    write(ownEntry, 'this checkout\n');
    const { shimPath: healthyShim } = writeShim(binDir, 'mycontext', 'src/cli/index.ts', 'this checkout\n');
    // Make the second shim's target BE `ownEntry` by writing the same bytes
    // at a distinct path is not what makes it "healthy" — only the resolved
    // PATH being `ownEntry` does. So point the stray shim at a DIFFERENT
    // node_modules copy instead, deliberately.
    const strayDir = path.join(dir, 'strayBin');
    const { shimPath: strayShim } = writeShim(strayDir, 'mycontext.cmd', 'src/cli/index.ts', 'a different checkout\n');
    const lookup: CliLookup = () => [strayShim, healthyShim];

    const findings = checkCliOnPath(ownEntry, lookup);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].level, 'error');
    assert.equal(findings[0].code, 'cli_path_mismatch');
  } finally {
    cleanup();
  }
});

test('cannot tell: the platform lookup itself failing is reported, not swallowed and not healthy', () => {
  const ownEntry = path.join('unused', 'src', 'cli', 'index.ts');
  const lookup: CliLookup = () => { throw new Error('spawnSync ENOENT: where.exe not found'); };

  const findings = checkCliOnPath(ownEntry, lookup);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, 'info');
  assert.equal(findings[0].code, 'cli_lookup_failed');
  assert.match(findings[0].message, /could not be run/);
  assert.match(findings[0].message, /where\.exe not found/);
});

test('cannot tell: found on PATH but unreadable through to a target — not healthy, not a mismatch', () => {
  const { dir, cleanup } = tmp();
  try {
    const ownEntry = path.join(dir, 'own', 'src', 'cli', 'index.ts');
    write(ownEntry, 'this checkout\n');
    // A candidate that does not exist on disk at all — the lookup reported
    // it, but by the time this check reads it, it is gone. `statSync` fails,
    // `readShimTarget` returns null, and this must not be reported as either
    // healthy (silently swallowing a real "cannot tell") or a mismatch
    // (asserting a fact about a file that was never actually read).
    const vanished = path.join(dir, 'gone', 'mycontext.cmd');
    const lookup: CliLookup = () => [vanished];

    const findings = checkCliOnPath(ownEntry, lookup);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].level, 'info');
    assert.equal(findings[0].code, 'cli_path_unverifiable');
    assert.match(findings[0].message, new RegExp(vanished.replace(/\\/g, '\\\\')));
  } finally {
    cleanup();
  }
});

test('cannot tell: a candidate too large to be a text shim is unverifiable, never guessed at', () => {
  const { dir, cleanup } = tmp();
  try {
    const ownEntry = path.join(dir, 'own', 'src', 'cli', 'index.ts');
    write(ownEntry, 'this checkout\n');
    const bigCandidate = path.join(dir, 'npmbin', 'mycontext.exe');
    // One byte over SHIM_MAX_BYTES (8_192) — every real npm shim is a few
    // hundred bytes, so this is what a compiled binary looks like from here.
    write(bigCandidate, 'x'.repeat(8_193));
    const lookup: CliLookup = () => [bigCandidate];

    const findings = checkCliOnPath(ownEntry, lookup);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].code, 'cli_path_unverifiable');
    assert.equal(findings[0].level, 'info');
  } finally {
    cleanup();
  }
});

test('never crashes doctor: an exception from checkCliOnPath itself would be a bug, but nothing here throws for any of the four states', () => {
  // Not a real assertion of behavior so much as a documented contract: every
  // branch above already proves each of the four states returns normally.
  // This test exists so a future change that reintroduces a throw (e.g.
  // widening `readShimTarget`'s try/catch) fails loudly rather than only in
  // `cmdDoctor`'s own defensive wrapper.
  assert.doesNotThrow(() => checkCliOnPath('nonexistent', () => { throw new Error('boom'); }));
  assert.doesNotThrow(() => checkCliOnPath('nonexistent', () => []));
});

test('readShimTarget: a real npm-shaped .cmd shim resolves to the file it embeds, relative to its own directory', () => {
  const { dir, cleanup } = tmp();
  try {
    const binDir = path.join(dir, 'npmbin');
    const { shimPath, targetPath } = writeShim(binDir, 'mycontext.cmd', 'src/cli/index.ts', 'target\n');
    assert.equal(readShimTarget(shimPath), targetPath);
  } finally {
    cleanup();
  }
});

test('readShimTarget: a .ps1-shaped shim (forward slashes, single-quoted paths) resolves the same way', () => {
  const { dir, cleanup } = tmp();
  try {
    const binDir = path.join(dir, 'npmbin');
    const targetPath = path.join(binDir, 'node_modules', 'mycontext', 'src', 'cli', 'index.ts');
    write(targetPath, 'target\n');
    const shimPath = path.join(binDir, 'mycontext.ps1');
    write(shimPath, `& "$basedir/node_modules/mycontext/src/cli/index.ts" $args\n`);
    assert.equal(readShimTarget(shimPath), targetPath);
  } finally {
    cleanup();
  }
});

test('readShimTarget: a nonexistent candidate is null, not a thrown error', () => {
  assert.equal(readShimTarget(path.join('definitely', 'not', 'here')), null);
});

test('CLI_BIN_NAME is the name package.json actually declares under "bin"', () => {
  assert.equal(CLI_BIN_NAME, 'mycontext');
});

test('defaultCliLookup: the real platform lookup returns an array and never throws on an unknown name', () => {
  // The one test in this file that touches the REAL machine — deliberately
  // not asserting anything about link state, only that the real lookup
  // behaves like the interface `checkCliOnPath` expects for a name that is
  // never on PATH anywhere.
  assert.doesNotThrow(() => {
    const found = defaultCliLookup('mycontext-cli-on-path-test-should-never-exist-anywhere');
    assert.ok(Array.isArray(found));
    assert.deepEqual(found, []);
  });
});
