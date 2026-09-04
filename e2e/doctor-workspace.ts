/**
 * **The low-level scaffolding for a throwaway Doctor workspace — shared so two
 * specs cannot drift apart on how one is built.**
 *
 * `INSTR-testing-happens-against-the-current-corpus-and-an-exception`, owner
 * ruling 2026-09-03: the live corpus is what verification runs against, and an
 * exception is asked for before it is taken. The owner gave one for the
 * specs that need a corpus in a state Doctor's own settling features have
 * removed from this repository (95 findings to zero, the same day): *"Each
 * spec builds its own temp workspace with ONE deliberate finding, exercises
 * settlement on screen, and throws it away. The live corpus is never
 * touched."*
 *
 * `e2e/doctor-settle.spec.ts` was the first to need this and wrote
 * `makeSettleWorkspace()` for its own shape: two unacknowledged findings of
 * one code, because the bulk-settlement control it exercises only draws for a
 * CODE WITH TWO OR MORE open findings — `screens/doctor.js`'s own words, "one
 * finding is not a class". `e2e/execute-output.spec.ts` needs a different
 * shape — one finding, already ruled on — because the control it exercises is
 * the per-row `mycontext ack`, which draws for a single finding regardless of
 * count. The two specs' TOP-LEVEL workspace builders therefore stay separate
 * (see each file), but the pieces both of them are built from — spawn the
 * CLI, `mkdtemp` and `init` a workspace, seed one rule whose body retracts its
 * own premise — are identical, and a second copy of them would be exactly the
 * "duplicated helper that must agree with another copy" this project names as
 * its own signature failure. This file is that shared piece, and nothing
 * more: it holds no opinion about how many rules a caller seeds or whether it
 * acknowledges any of them.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** The CLI entry every throwaway workspace here is seeded through — `init`,
 *  `add`, `ack`, `rebuild` — exactly as a person would type them. */
export const CLI = path.resolve(import.meta.dirname, '..', 'src', 'cli', 'index.ts');

/**
 * A body whose own wording retracts its premise — `checkBodyAgreement`'s own
 * trigger for `body_disagrees_with_meta` — borrowed verbatim from
 * `test/cli/ack-all.test.ts` so every file that seeds this finding seeds the
 * identical one rather than a second spelling of "a body that disagrees with
 * itself".
 */
export const RETRACTING_BODY =
  'THE PREMISE HERE IS RETRACTED. This rule no longer holds in the form its title claims.';

/** The doctor code `RETRACTING_BODY` is guaranteed to raise. */
export const RETRACTING_CODE = 'body_disagrees_with_meta';

/** Run one CLI command against a workspace and return what it printed. */
export function runCli(root: string, args: string[]): string {
  return execFileSync(process.execPath, [CLI, ...args], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
}

/** `mkdtemp` a workspace and `init` it — the two steps every caller needs
 *  before it can seed anything. */
export function initWorkspace(prefix: string): string {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  runCli(root, ['init']);
  return root;
}

/**
 * Seed one rule carrying `RETRACTING_BODY` and return the id the CLI minted
 * for it, read out of `add`'s own stdout — the same extraction
 * `test/cli/ack-all.test.ts` does, because the id is not knowable any other
 * way without inventing a second id scheme for a test to guess at.
 */
export function seedRetractingRule(root: string, title: string): string {
  const text = runCli(root, [
    'add', 'rule', title, '--body', RETRACTING_BODY,
    '--summary', `A rule about ${title.toLowerCase()}.`, '--yes',
  ]);
  const id = /\b(RULE-[a-z0-9-]+)/.exec(text)?.[1];
  if (id === undefined) {
    throw new Error(`could not read the created rule id out of: ${text}`);
  }
  return id;
}
