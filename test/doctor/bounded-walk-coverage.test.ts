// @basis TASK-nine-sites-report-a-measured-zero-for-something-they-could, INV-nothing-is-dropped-silently
/**
 * **Two checks draw their answers from a walk that silently stopped.**
 *
 * Site M8 of `TASK-nine-sites-report-a-measured-zero-for-something-they-could`
 * (report 3, `reports/2026-09-12-silent-failures-reviewed.md`): the bounded
 * repository walk is consumed by `checkDeadScopes` (`src/doctor/checks.ts`) and
 * `checkCitationForm` (`src/doctor/body-integrity.ts`), and NEITHER said the
 * walk was partial. `checkWatchedDocsServable`, in the first of those files,
 * consumes the same walk and DOES — `watched_doc_coverage`. The convention
 * already existed and two of its three users were missing from it.
 *
 * What the silence costs is specific and report 3 measured it: a truncated walk
 * makes `checkDeadScopes` report *"scope glob `src/payments/**` matches no file
 * in the repository. Re-scope it to the path that replaced it."* — **false**,
 * on a measurement never taken, and a user or agent who follows it re-scopes a
 * governing constraint to a wrong path. `checkCitationForm` fails the other
 * way: it reports a bare `file:line` pointer only when the walk HELD that file,
 * so a file the walk never reached silently downgrades a real finding to "an
 * example of a file this repo does not have". Both checks are `warn`/`info`, so
 * the exit code stays 0 and nothing else in the run hints at either.
 *
 * `checkDeadScopes` reaches the bound soonest of the three: it walks with
 * `SCOPE_SKIP_DIRS` (two names) rather than `SKIP_DIRS` (many), so `dist/`,
 * `build/`, `coverage/` and `.next/` all count against its 20,000.
 *
 * ── WHY THIS COSTS 20,001 FILES, AND IS ONE TEST RATHER THAN A PATTERN ─────
 *
 * `FILE_LIMIT` is 20,000 and neither check takes an injectable bound. The
 * precedent is `test/ui/read-model.test.ts`' *"/api/coverage discloses a walk
 * that stopped at COVERAGE_FILE_LIMIT"*, which pays the same cost for the same
 * reason and states it: a disclosure nothing ever drives past its threshold is
 * a disclosure nobody has seen work, and a bound injected into a signature for
 * a test's benefit makes the signature answer to the test rather than to a
 * caller. One fixture serves both checks here, because both walk one
 * repository. Measured on win32 while writing this: creating and removing the
 * files is the whole of this file's cost, which is why the negative case below
 * uses a two-file repository instead.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkCitationForm, checkDeadScopes } from '../../src/doctor/checks.ts';
import { FILE_LIMIT } from '../../src/doctor/repo-files.ts';
import type { Finding } from '../../src/doctor/finding.ts';
import { parseItem } from '../../src/core/item.ts';
import { resolveConfig } from '../../src/core/config.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

const CONFIG = resolveConfig({});

const ITEM_TEXT = [
  '---',
  'id: CONST-x',
  'type: constraint',
  'title: a constraint',
  'status: active',
  'scope:',
  '  - "src/payments/**"',
  '---',
  '',
  '# a constraint',
  '',
  'See `src/payments/charge.ts:88` for the shape.',
  '',
].join('\n');

/**
 * ONE active item carrying both inputs: a scope glob and a bare `file:line`
 * pointer, each naming `src/payments/charge.ts`. Over a repository that holds
 * that file and is walked to the end, `checkDeadScopes` is silent and
 * `checkCitationForm` reports the pointer. Truncate the walk and both answers
 * flip, which is the pair of false answers M8 is about.
 */
function theItem(): Item {
  return parseItem(ITEM_TEXT, 'items/constraint/CONST-x.md', 'project');
}

/** A throwaway repository holding the one file the item names. */
function repo(): { dir: string; done: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-walk-bound-'));
  mkdirSync(path.join(dir, 'src', 'payments'), { recursive: true });
  writeFileSync(path.join(dir, 'src', 'payments', 'charge.ts'), 'export const charge = 1;\n');
  return { dir, done: () => removeTree(dir) };
}

/** `n` empty files, spread over directories so no one of them is enormous. */
function bulk(dir: string, n: number): void {
  for (let i = 0; i < n; i++) {
    if (i % 2000 === 0) mkdirSync(path.join(dir, 'bulk', `d${i / 2000}`), { recursive: true });
    writeFileSync(path.join(dir, 'bulk', `d${Math.floor(i / 2000)}`, `f${i}`), '');
  }
}

const disclosure = (findings: Finding[], about: string): Finding | undefined =>
  findings.find((f) => f.about === about);

test('a walk that stopped at its bound is disclosed by BOTH checks that read it', () => {
  const p = repo();
  const items = [theItem()];
  try {
    bulk(p.dir, FILE_LIMIT + 1);

    const dead = checkDeadScopes(p.dir, items, CONFIG);
    const deadNote = disclosure(dead, 'dead_scope');
    assert.ok(
      deadNote !== undefined,
      'checkDeadScopes tells the reader to re-scope a governing constraint on the strength of a '
      + 'walk that stopped early, and says nothing about the walk — M8',
    );
    assert.equal(deadNote.level, 'info', 'a note about the check is not a defect of the corpus');
    assert.match(
      deadNote.message, new RegExp(String(FILE_LIMIT)),
      'the bound the walk stopped at is the fact that makes the note something to act on',
    );

    const citation = checkCitationForm(p.dir, items);
    const citationNote = disclosure(citation, 'citation_form');
    assert.ok(
      citationNote !== undefined,
      'checkCitationForm decides whether a pointer names a real file from the same truncated '
      + 'walk, so a file it never reached silently stops being a finding — M8',
    );
    assert.equal(citationNote.level, 'info');
    assert.match(citationNote.message, new RegExp(String(FILE_LIMIT)));
  } finally { p.done(); }
});

test('a repository the walk finished is NOT disclosed — the note is a fact, not decoration', () => {
  const p = repo();
  const items = [theItem()];
  try {
    // Two files, nowhere near the bound. If this ever goes red the note has
    // become a permanent shrug, which is the one thing a disclosure must not
    // be — and the two answers below are the ones a complete walk gives.
    const dead = checkDeadScopes(p.dir, items, CONFIG);
    assert.equal(disclosure(dead, 'dead_scope'), undefined);
    assert.equal(
      dead.filter((f) => f.code === 'dead_scope').length, 0,
      'the glob matches src/payments/charge.ts, which this walk reached — so it is not dead',
    );
    const citation = checkCitationForm(p.dir, items);
    assert.equal(disclosure(citation, 'citation_form'), undefined);
    assert.equal(
      citation.filter((f) => f.code === 'citation_form').length, 1,
      'and the bare pointer to a file this walk DID reach is the real finding',
    );
  } finally { p.done(); }
});
