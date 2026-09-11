// @basis TASK-the-maintenance-tool-crud-where-the-form-is-the-template-and
/**
 * **IT DOES NOT SHIP, AND THAT IS THE WHOLE SECURITY MODEL.**
 *
 * D41 spec §11.1 and §11.2, `plan:store seq:3` Task 9. The maintenance tool
 * has no authentication, and the item that governs this phase says in one
 * sentence why that is honest rather than lazy:
 *
 * > *`package.json`'s `files` already keeps `scripts/` out of the published
 * > package; the same mechanism keeps this out. A user does not fail to reach
 * > the tool — they do not have it. Assert that, rather than assuming it: if
 * > it ever ships, the no-authentication decision is void.*
 *
 * So this file is the thing standing between "no auth needed" and "no auth".
 * It is asserted twice over, because the two proofs fail at different moments:
 *
 *  1. **npm's own answer.** `npm pack --dry-run --json` lists exactly what a
 *     publish would upload, computed by npm from `files` with npm's rules and
 *     not with a reimplementation of them. This catches the case where the
 *     declaration is right and the semantics are not — a negation npm ignores,
 *     an `.npmignore` that reinstates the directory, a later `files` entry that
 *     overrides the exclusion.
 *  2. **The declaration itself.** A reading of `files` that names which rule
 *     does the excluding. This catches the case where npm's answer is right for
 *     an accidental reason — the directory absent from the working tree, a
 *     build artifact ignored by something unrelated — and it is the assertion
 *     that keeps failing usefully after somebody deletes the exclusion.
 *
 * **And the vacuity guard is not decoration.** Excluding a directory that does
 * not exist proves nothing at all, and a `npm pack` that produced no file list
 * would satisfy "no maintenance path appears" perfectly. Both are asserted
 * against below before either exclusion is believed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  MAINTENANCE_DIR, OWNERS_PORT, startMaintenanceServer,
} from '../../src/ui/maintenance/server.ts';

const REPO = path.resolve(import.meta.dirname, '..', '..');

/** The path inside the package that must never be uploaded. */
const TOOL = `${MAINTENANCE_DIR}/server.ts`;
/** A path inside the package that MUST be uploaded — the store itself. */
const SHIPS = 'src/rules/store.ts';

interface PackedFile { path: string }
interface Packed { files: PackedFile[] }

/**
 * What `npm publish` would upload, as npm itself computes it. `--dry-run`
 * writes no tarball and reaches no network.
 *
 * Run once for the whole file: it costs several seconds because it walks and
 * compresses the package, and three tests asking npm the same question three
 * times would pay that three times over for one answer.
 */
const packed: string[] = ((): string[] => {
  // `execSync` rather than `execFileSync(..., { shell: true })`: on Windows npm
  // is a `.cmd` shim, which Node will not spawn without a shell, and passing an
  // argv array THROUGH a shell earns DEP0190. One fixed command string has no
  // interpolation in it and no warning attached to it.
  const out = execSync('npm pack --dry-run --json', {
    cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const report = JSON.parse(out) as Packed[];
  return report[0].files.map((f) => f.path.replace(/\\/g, '/'));
})();

const manifest = JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8')) as {
  files: string[];
};

/**
 * One `files` pattern, as a matcher. npm matches these the way `.gitignore`
 * does: a trailing `/` or a bare directory name covers everything beneath it,
 * `*` stops at a separator and `**` does not.
 *
 * This is a reading of the DECLARATION and never a substitute for npm's own
 * answer above — which is why both assertions exist rather than this one.
 */
function matcher(pattern: string): (file: string) => boolean {
  const body = pattern.replace(/^!/, '').replace(/\/+$/, '');
  let source = '';
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === '*') {
      // `**` crosses separators; a single `*` stops at one.
      if (body[i + 1] === '*') { source += '.*'; i += 1; continue; }
      source += '[^/]*';
      continue;
    }
    source += /[a-zA-Z0-9/_-]/.test(ch) ? ch : `\\${ch}`;
  }
  const re = new RegExp(`^${source}(?:/.*)?$`);
  return (file) => re.test(file);
}

/* ══ 1. THE TOOL EXISTS, OR EVERY EXCLUSION BELOW IS VACUOUS ═══════════════ */

test('the maintenance tool is on disk, so excluding it means something', () => {
  assert.ok(
    existsSync(path.join(REPO, TOOL)),
    `${TOOL} is not in the working tree. Every assertion below would pass over ` +
    `a directory that does not exist, which proves nothing about what ships.`,
  );
  assert.ok(
    packed.includes(SHIPS),
    `npm pack listed no ${SHIPS}, so its file list is not a description of this ` +
    `package and its silence about ${TOOL} means nothing.`,
  );
});

/* ══ 2. npm's OWN ANSWER ═══════════════════════════════════════════════════ */

test('npm pack uploads no file from the maintenance tool', () => {
  const shipped = packed.filter((file) => file.startsWith(`${MAINTENANCE_DIR}/`));
  assert.deepEqual(
    shipped, [],
    `npm would publish ${shipped.length} file(s) from ${MAINTENANCE_DIR}. The tool has NO ` +
    `AUTHENTICATION, and spec §11.2 is explicit that this is safe only because §11.1 means ` +
    `the surface does not exist anywhere else: "if it ever ships, this section is void and ` +
    `must be revisited."`,
  );
});

/* ══ 3. THE DECLARATION THAT DOES THE EXCLUDING ════════════════════════════ */

test('`files` carries an exclusion covering the tool and not what the tool needs', () => {
  const exclusions = manifest.files.filter((pattern) => pattern.startsWith('!'));
  const covering = exclusions.filter((pattern) => matcher(pattern)(TOOL));
  assert.deepEqual(
    covering.length > 0, true,
    `no entry in package.json's \`files\` excludes ${TOOL}. npm may be leaving it out today ` +
    `for some other reason; the mechanism the spec names is this one, and it is not here.`,
  );
  for (const pattern of covering) {
    assert.equal(
      matcher(pattern)(SHIPS), false,
      `the exclusion ${JSON.stringify(pattern)} also covers ${SHIPS}, which must ship — the ` +
      `store is read from inside the installed package.`,
    );
  }
});

/* ══ 4. ITS OWN SERVER: LOOPBACK ONLY, AND NEVER THE OWNER'S PORT ══════════ */

/**
 * Attempt a start and **close whatever comes back**, returning the refusal or
 * `null`.
 *
 * `assert.rejects` is the obvious spelling and it leaks: when the refusal under
 * test is the thing that has been removed, the server BINDS, the assertion
 * throws, and the listening handle is never closed — `node --test` then waits
 * on an event loop that can never drain and the run hangs instead of failing.
 * Found by running exactly that removal proof; a proof that cannot terminate
 * is not a proof.
 */
async function refusalFrom(options: Parameters<typeof startMaintenanceServer>[0]): Promise<string | null> {
  try {
    const server = await startMaintenanceServer(options);
    await server.stop();
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

test('it binds 127.0.0.1 and refuses any other host', async () => {
  const refusal = await refusalFrom({ host: '0.0.0.0' });
  assert.notEqual(
    refusal, null,
    'a host other than loopback was accepted. Spec §11.2: "bound to loopback only ... one ' +
    'argument that prevents the tool being reachable from the network."',
  );
  assert.match(
    refusal ?? '', /refusing to bind 0\.0\.0\.0/,
    `the start failed for some reason other than this tool's own refusal: ${refusal}`,
  );
  const server = await startMaintenanceServer({});
  try {
    assert.equal(server.host, '127.0.0.1');
  } finally { await server.stop(); }
});

/**
 * **The refusal must be OURS, and the assertion says so on purpose.**
 *
 * Matching only on the number would pass over the operating system's
 * `EADDRINUSE ... 127.0.0.1:58888`, which also contains it — so on a machine
 * where the owner's server happens to be running, deleting our refusal
 * entirely would leave this test green. That is precisely the shape this
 * plan's removal proofs keep catching, and it is worth avoiding in the one
 * assertion protecting the owner's own port.
 */
test('it refuses the owner-facing port and chooses a free one otherwise', async () => {
  const refusal = await refusalFrom({ port: OWNERS_PORT });
  assert.notEqual(
    refusal, null,
    `port ${OWNERS_PORT} was accepted. It is the owner's running UI server; binding it either ` +
    `fails or, worse, succeeds after that server has exited and answers in its place.`,
  );
  assert.match(
    refusal ?? '', new RegExp(`refusing port ${OWNERS_PORT}`),
    `the start failed, but not because this tool refused it: ${refusal}`,
  );
  const server = await startMaintenanceServer({});
  try {
    assert.ok(server.port > 0, 'no port was bound');
    assert.notEqual(server.port, OWNERS_PORT);
  } finally { await server.stop(); }
});
