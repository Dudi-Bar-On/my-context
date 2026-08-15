/**
 * The one version this build reports, read from the one file that owns it.
 *
 * `package.json` is the source of truth — see `VERSIONING.md` for why, and for
 * what a release requires. `.claude-plugin/plugin.json` and
 * `.claude-plugin/marketplace.json` repeat the number because Claude Code and
 * `claude plugin install` read those files and cannot read this one; they are
 * checked against `package.json` by `test/release.test.ts`, and rewritten from
 * it by `scripts/set-version.ts`. Nothing here re-derives a version from them,
 * so a drift is reported rather than silently resolved in one direction.
 *
 * Read at module load, not baked in at build time: there is no build step, and
 * a constant transcribed into a `.ts` file is a fourth place to forget.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** `src/core/version.ts` → the repository root's `package.json`. */
export const MANIFEST = path.join(import.meta.dirname, '..', '..', 'package.json');

/**
 * `MAJOR.MINOR.PATCH`, with an optional `-prerelease` and `+build`, anchored.
 *
 * Anchored deliberately: an unanchored match would accept `v0.1.0` and
 * `0.1.0 (dev)`, and both would then travel into `mycontext status`, into the
 * manifests `scripts/set-version.ts` writes, and into a git tag, as a version
 * that no tool can order against another one.
 */
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/** True for a string this project will accept as a version. */
export function isSemver(value: string): boolean {
  return SEMVER.test(value);
}

/**
 * The `version` field of a `package.json`, or a thrown error naming what is
 * wrong with it.
 *
 * Throws rather than returning a fallback. A fallback — `'unknown'`, `'0.0.0'`
 * — is the silent-drop defect this repository keeps producing, moved into the
 * one string whose entire purpose is to let a user say what they are running:
 * a bug report filed against `0.0.0` is worse than a build that refuses to
 * start, because it looks like an answer.
 *
 * Split from the file read so the failure modes are testable without moving
 * the real `package.json` out from under a running suite.
 */
export function parseVersion(source: string, from: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (err) {
    throw new Error(`my_context: ${from} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`my_context: ${from} does not contain a JSON object`);
  }
  const value = (parsed as Record<string, unknown>).version;
  if (value === undefined) {
    throw new Error(`my_context: ${from} has no "version" field — this build cannot say what it is`);
  }
  if (typeof value !== 'string') {
    throw new Error(`my_context: ${from} has a non-string "version" field (${typeof value})`);
  }
  if (!isSemver(value)) {
    throw new Error(
      `my_context: ${from} has version "${value}", which is not MAJOR.MINOR.PATCH — see VERSIONING.md`,
    );
  }
  return value;
}

/** The version of this build. */
export const VERSION = parseVersion(readFileSync(MANIFEST, 'utf8'), 'package.json');
