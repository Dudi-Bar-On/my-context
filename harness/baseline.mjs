import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { REPO } from './lib/workspace.mjs';

const execFileAsync = promisify(execFile);

/** The 11 failures caused by node:sqlite's ExperimentalWarning reaching stderr. */
export const KNOWN_RED = new Set([
  'session-start exits 0 and says nothing when stdin is garbage',
  'session-start exits 0 and says nothing when stdin is empty',
  'pre-tool-use exits 0 and says nothing when stdin is garbage',
  'pre-tool-use exits 0 and says nothing when stdin is empty',
  'pre-compact exits 0 and says nothing when stdin is garbage',
  'pre-compact exits 0 and says nothing when stdin is empty',
  'session-start writes the injected context on stdout for a real payload',
  'pre-tool-use emits the deny envelope for a write into the managed directory',
  'pre-compact writes a restore snapshot and keeps stdout clean',
  'nothing but MCP messages reaches stdout',
  'load_context runs over stdio without a byte of stray stdout',
]);

const { stdout } = await execFileAsync('npm', ['test'], { cwd: REPO, shell: true })
  .catch((e) => ({ stdout: e.stdout ?? '' }));

// Node's test runner prints each failing test name TWICE: once inline where
// it fails, and again in the "failing tests:" summary block at the end.
// Deduping here is required — without it `failed.length` is roughly double
// the true number of distinct failures, and would never agree with
// `KNOWN_RED`, which pins distinct test names.
const rawMatches = [...stdout.matchAll(/^\s*✖ (.+?) \(\d/gm)].map((m) => m[1]);
const failed = [...new Set(rawMatches)];
const unexpected = failed.filter((n) => !KNOWN_RED.has(n));
const fixed = [...KNOWN_RED].filter((n) => !failed.includes(n));

console.log(`failed: ${failed.length}  known-red: ${KNOWN_RED.size}`);
if (fixed.length) console.log(`no longer failing:\n  ${fixed.join('\n  ')}`);
if (unexpected.length) {
  console.error(`NEW FAILURES:\n  ${unexpected.join('\n  ')}`);
  process.exit(1);
}
console.log('baseline matches the pin');
