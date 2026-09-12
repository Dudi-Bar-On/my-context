// @basis TASK-a-status-cast-out-of-frontmatter-makes-five-gates-answer-no,
// INV-nothing-is-dropped-silently,
// RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **A value outside `Status`, `Severity` or `Origin` does not become a member
 * by being read.**
 *
 * `parseItem` used to cast all three straight out of frontmatter. A file
 * saying `status: activ` therefore produced an `Item` whose `status` was
 * `'activ'` — not a member of the union its own type claims — and
 * `GOVERNING_STATUS` (core/trust.ts) is a `Record<Status, boolean>` written
 * TOTAL precisely so that every status has an answer. Indexed with a
 * non-member it returns `undefined`, `undefined` is falsy, and
 * `governsNormatively` answered `undefined` from a function declared
 * `boolean`.
 *
 * ── WHAT WAS MEASURED, BEFORE ANY OF THIS WAS BUILT ────────────────────────
 *
 * Five gates ask that question and all five stopped firing on one mistyped
 * byte (throwaway corpus, 2026-09-13, `status: active` versus `status: activ`
 * in the same file):
 *
 *   | gate                                       | active  | activ   |
 *   | supersede preflight (mutate.ts)            | REFUSED | ALLOWED |
 *   | guarded-field refusal (mutate.ts)          | REFUSED | ALLOWED |
 *   | supersedeItem's refusal (mutate.ts)        | REFUSED | ALLOWED |
 *   | contradiction candidate filter (overlap.ts)| raised  | silent  |
 *   | pack-collision judgement (pack/collide.ts) | warns   | silent  |
 *
 * One gate the filed item also named did NOT fail open and this file says so
 * rather than asserting it did: `updateItem`'s STATUS-CHANGE refusal reads
 * `tierOf(...) === 'normative'` and never consults `GOVERNING_STATUS`, so it
 * refused in both runs. Only the explanatory clause it prints afterwards
 * (`governsNormatively`, mutate.ts) degraded. `supersedeItem`'s own refusal is
 * the fifth gate in the table above, and it is a different line from the
 * preflight.
 *
 * ── WHAT EACH GATE TEST BELOW ACTUALLY PINS, SAID PLAINLY ──────────────────
 *
 * **The local-disk fallback does not re-close these five gates, and no test
 * here claims it does.** `draft` does not govern, so `GOVERNING_STATUS.draft`
 * is `false` and each gate still answers no — the same outcome the cast
 * produced, now for a reason a reader can see instead of a table miss. What
 * the fallback buys is that the item stops CLAIMING to be active: it reads
 * `draft`, it appears in the draft queue, and `doctor` reports the file
 * (`checkLaunderedEnum`). The gates are closed against input nobody here
 * wrote by the PACK REFUSAL, which is asserted separately at the bottom.
 *
 * So each gate test carries two assertions and they are load-bearing in
 * different ways:
 *
 *  1. **the gate is asked a member of `Status`** — `false`, never `undefined`.
 *     This is the one that reddens if the cast comes back, at that gate's own
 *     line, and it is the whole of what the read boundary promises here.
 *  2. **the gate's outcome, recorded as measured** — unchanged for the three
 *     `mutate.ts` gates, and named as unchanged, because an assertion written
 *     to look like a restored protection would be worse than no test at all.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createItem, supersedeItem, updateItem } from '../../src/core/mutate.ts';
import { launderedEnums, parseItem } from '../../src/core/item.ts';
import { contradictionGate, governsNow } from '../../src/core/overlap.ts';
import { GOVERNING_STATUS, governsNormatively } from '../../src/core/trust.ts';
import { ORIGINS, SEVERITIES, STATUSES } from '../../src/core/vocabulary.ts';
import { ENUM_READ } from '../../src/core/vocabulary.ts';
import { RETIREABLE_ORIGIN } from '../../src/core/retire.ts';
import { bucketise, renderCollisionReport } from '../../src/pack/collide.ts';
import { buildBundle, type BundleOptions } from '../../src/pack/bundle.ts';
import { buildManifest, renderManifest } from '../../src/pack/manifest.ts';
import { MANIFEST_NAME } from '../../src/pack/layout.ts';
import { writeBundleDirectory } from '../../src/pack/dir-writer.ts';
import { readArtefact } from '../../src/pack/reader.ts';
import { checkLaunderedEnum, runChecks } from '../../src/doctor/checks.ts';
import { removeTree } from '../helpers/tmp.ts';
import { sandbox, type Sandbox } from '../helpers/workspace.ts';
import type { Item } from '../../src/core/types.ts';

/**
 * Rewrite one frontmatter line of an item's file and hand back what the parser
 * now makes of it, with the store updated to match.
 *
 * **The file is edited by hand DELIBERATELY and only ever in a throwaway
 * corpus**: the defect under test is a file that no write path would have
 * produced, so a test that reached it through `mycontext edit` would be
 * asserting the write validator against itself. `validateEnums` refuses every
 * value below at every write boundary, which is exactly why the read boundary
 * had never been asked.
 */
function corruptField(box: Sandbox, id: string, field: string, value: string): Item {
  const before = box.ctx.store.get(id);
  assert.ok(before !== null && before !== undefined, `${id} is not in the store`);
  const abs = path.join(box.root, ...before.filePath.split('/'));
  const text = readFileSync(abs, 'utf8')
    .replace(new RegExp(`^${field}: .*$`, 'm'), `${field}: ${value}`);
  assert.match(text, new RegExp(`^${field}: ${value}$`, 'm'), 'the fixture edit did not land');
  writeFileSync(abs, text, 'utf8');
  const reloaded = parseItem(text, before.filePath, before.layer);
  box.ctx.store.upsert(reloaded);
  return reloaded;
}

/** A governing normative item — the thing all five gates exist to protect. */
function governingRule(box: Sandbox, title: string): Item {
  const made = createItem(box.ctx, {
    type: 'rule', title, body: 'Do not log customer email addresses.',
    summary: 'Customer email addresses must never be written to any log.',
    scope: ['src/**'], status: 'active', origin: 'human',
  });
  const item = box.ctx.store.get(made.id);
  assert.ok(item !== null && item !== undefined);
  assert.equal(item.status, 'active', 'the fixture must start out governing');
  assert.equal(governsNormatively(box.ctx, item), true, 'the fixture must start out protected');
  return item;
}

function refusalOf(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  return assert.fail('expected a refusal, got none');
}

/** Whether `fn` was allowed through — the shape every gate test below reads. */
function allowed(fn: () => unknown): boolean {
  try {
    fn();
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// The read boundary itself
// ---------------------------------------------------------------------------

test('a status outside the vocabulary reads as draft, not as itself', () => {
  const box = sandbox();
  try {
    const rule = governingRule(box, 'never log emails one');
    const loaded = corruptField(box, rule.id, 'status', 'activ');
    assert.equal(loaded.status, 'draft');
    // The proposition the cast made unformable: the value is IN the union, so
    // the total table has an answer for it.
    assert.ok(STATUSES.includes(loaded.status));
    assert.equal(GOVERNING_STATUS[loaded.status], false);
  } finally {
    box.dispose();
  }
});

test('a severity outside the vocabulary reads as soft — the non-escalating member', () => {
  const box = sandbox();
  try {
    const made = createItem(box.ctx, {
      type: 'rule', title: 'a hard rule', body: 'B.', scope: ['src/**'],
      summary: 'A rule that was captured as hard severity.', severity: 'hard', origin: 'human',
    });
    const loaded = corruptField(box, made.id, 'severity', 'har');
    assert.equal(loaded.severity, 'soft');
    assert.ok(SEVERITIES.includes(loaded.severity));
    // `hard` is a GRANT — `focusHides` (select.ts) exempts a hard item from
    // focus narrowing and `GUARDED_FIELDS` protects the field — so a mistyped
    // byte must not be able to hand it out. `soft` is both the weaker member
    // and the absent default, which is why this is the one field where the
    // laundered answer and the absent answer agree.
    assert.equal(ENUM_READ.severity.absent, ENUM_READ.severity.laundered);
  } finally {
    box.dispose();
  }
});

test('an origin outside the vocabulary reads as human — the protective member', () => {
  const box = sandbox();
  try {
    const made = createItem(box.ctx, {
      type: 'lesson', title: 'a lesson from the pass', body: 'B.',
      summary: 'A lesson the review pass wrote.', origin: 'review',
    });
    const loaded = corruptField(box, made.id, 'origin', 'revie');
    assert.equal(loaded.origin, 'human');
    assert.ok(ORIGINS.includes(loaded.origin));
    // **Why `human` and not "the least trusted member".** A stored `origin`
    // never grants the ITEM authority — `trustedStatus` reads the CALLER's
    // origin. Every reader of the stored value asks whether an automatic
    // mechanism may act on the item, and `review` is the permissive answer to
    // both: it is the only origin the retirement sweep may touch
    // (`RETIREABLE_ORIGIN`, core/retire.ts) and the only one `review decline`
    // accepts. Falling back to it would be exactly backwards.
    assert.equal(RETIREABLE_ORIGIN, 'review');
    assert.notEqual(loaded.origin, RETIREABLE_ORIGIN);
  } finally {
    box.dispose();
  }
});

test('an absent field still reads its own default, which the fallback did not eat', () => {
  // The two facts are different — see `EnumReadPolicy` — and a fix that
  // collapsed them would make every item that predates a field read as the
  // laundered value instead of the intended one.
  const text = [
    '---',
    'id: RULE-bare',
    'type: rule',
    'title: a rule with no status, severity or origin line',
    '---',
    '',
    'Body.',
    '',
  ].join('\n');
  const item = parseItem(text, 'items/rule/RULE-bare.md', 'project');
  assert.equal(item.status, 'active');
  assert.equal(item.severity, 'soft');
  assert.equal(item.origin, 'human');
  assert.deepEqual(launderedEnums(text), [], 'an absent field is not a laundered one');
});

test('every legal value of all three vocabularies still reads as itself', () => {
  // Without this the fallback could swallow the whole vocabulary and every
  // assertion above would still pass.
  for (const status of STATUSES) {
    for (const severity of SEVERITIES) {
      for (const origin of ORIGINS) {
        const text = [
          '---', 'id: RULE-legal', 'type: rule', 'title: a legal rule',
          `status: ${status}`, `severity: ${severity}`, `origin: ${origin}`,
          '---', '', 'Body.', '',
        ].join('\n');
        const item = parseItem(text, 'items/rule/RULE-legal.md', 'project');
        assert.equal(item.status, status);
        assert.equal(item.severity, severity);
        assert.equal(item.origin, origin);
        assert.deepEqual(launderedEnums(text), []);
      }
    }
  }
});

test('launderedEnums names the value the parse refused, and what it read instead', () => {
  const text = [
    '---', 'id: RULE-bad', 'type: rule', 'title: a rule with three bad enums',
    'status: activ', 'severity: har', 'origin: revie',
    '---', '', 'Body.', '',
  ].join('\n');
  assert.deepEqual(launderedEnums(text), [
    { field: 'status', value: 'activ', legal: STATUSES, read: 'draft' },
    { field: 'severity', value: 'har', legal: SEVERITIES, read: 'soft' },
    { field: 'origin', value: 'revie', legal: ORIGINS, read: 'human' },
  ]);
  // The parsed item is where the evidence is gone, which is why the witness
  // reads the TEXT and not the item.
  const item = parseItem(text, 'items/rule/RULE-bad.md', 'project');
  assert.deepEqual(
    [item.status, item.severity, item.origin], ['draft', 'soft', 'human'],
  );
});

// ---------------------------------------------------------------------------
// The five gates, one test each — local disk
// ---------------------------------------------------------------------------

test('gate 1 — the supersede preflight is asked a real Status', () => {
  const box = sandbox();
  try {
    const victim = governingRule(box, 'never log emails gate one');
    // The preflight only runs when the NEW item governs and is in
    // contradiction scope, and `trustedStatus` forces every non-human
    // NORMATIVE capture to `draft`. `decision` is the reachable combination:
    // rationale tier (so `active` survives) and a member of
    // `GATED_CATEGORIES`. Measured, not assumed — with the victim intact this
    // refuses, which is what makes the arm below meaningful.
    const drive = (title: string) => () => createItem(box.ctx, {
      type: 'decision', title, body: 'We retire it.',
      summary: 'The team decided to retire the rule about email addresses in logs.',
      origin: 'agent', status: 'active', supersedes: victim.id,
    });
    assert.equal(allowed(drive('retire the email rule intact')), false,
      'the preflight must refuse while the victim genuinely governs');

    const loaded = corruptField(box, victim.id, 'status', 'activ');
    assert.equal(GOVERNING_STATUS[loaded.status], false);
    assert.equal(governsNormatively(box.ctx, loaded), false);
    // MEASURED AND UNCHANGED: `draft` does not govern either, so the preflight
    // still lets this through. The fallback makes the answer a considered
    // `false` rather than a table miss; it does not restore the protection,
    // and the pack refusal below is what closes this gate against an artefact.
    assert.equal(allowed(drive('retire the email rule corrupt')), true);
  } finally {
    box.dispose();
  }
});

test('gate 2 — the guarded-field refusal is asked a real Status', () => {
  const box = sandbox();
  try {
    const victim = governingRule(box, 'never log emails gate two');
    assert.equal(
      allowed(() => updateItem(box.ctx, {
        id: victim.id, scope: ['elsewhere/**'], origin: 'agent',
      })),
      false,
      'the field guard must refuse while the victim genuinely governs',
    );

    const loaded = corruptField(box, victim.id, 'status', 'activ');
    assert.equal(GOVERNING_STATUS[loaded.status], false);
    assert.equal(governsNormatively(box.ctx, loaded), false);
    // MEASURED AND UNCHANGED, for the reason given at gate 1.
    assert.equal(
      allowed(() => updateItem(box.ctx, {
        id: victim.id, scope: ['elsewhere/**'], origin: 'agent',
      })),
      true,
    );
  } finally {
    box.dispose();
  }
});

test('gate 3 — supersedeItem\'s own refusal is asked a real Status', () => {
  const box = sandbox();
  try {
    const victim = governingRule(box, 'never log emails gate three');
    const first = createItem(box.ctx, {
      type: 'rule', title: 'the replacement rule one', body: 'B.', scope: ['src/**'],
      summary: 'A replacement for the email logging rule.', origin: 'agent',
    });
    assert.equal(
      allowed(() => supersedeItem(box.ctx, {
        id: victim.id, by: first.id, origin: 'agent',
      })),
      false,
      'supersedeItem must refuse while the victim genuinely governs',
    );

    const loaded = corruptField(box, victim.id, 'status', 'activ');
    assert.equal(GOVERNING_STATUS[loaded.status], false);
    assert.equal(governsNormatively(box.ctx, loaded), false);
    const second = createItem(box.ctx, {
      type: 'rule', title: 'the replacement rule two', body: 'B.', scope: ['src/**'],
      summary: 'Another replacement for the email logging rule.', origin: 'agent',
    });
    // MEASURED AND UNCHANGED, for the reason given at gate 1.
    assert.equal(
      allowed(() => supersedeItem(box.ctx, {
        id: victim.id, by: second.id, origin: 'agent',
      })),
      true,
    );
  } finally {
    box.dispose();
  }
});

test('gate 4 — the contradiction candidate filter is asked a real Status', () => {
  const box = sandbox();
  try {
    const victim = governingRule(box, 'never log emails gate four');
    const draft = {
      id: null, type: 'rule', title: 'always log emails',
      body: 'Log customer email addresses.',
      summary: 'Customer email addresses must always be written to any log.',
      severity: 'soft' as const, always: false, basis: 'draft-basis',
      distinct: [], supersedes: null,
    };
    const asCandidate = (item: Item) => ({
      id: item.id, type: item.type, title: item.title, body: item.body,
      summary: item.summary, severity: item.severity, always: item.always,
      status: item.status, basis: 'victim-basis',
    });

    assert.equal(governsNow(victim.status), true);
    const intact = contradictionGate(draft, [asCandidate(victim)], []);
    assert.equal(intact.allowed, false, 'the gate must raise the pair while the victim governs');
    assert.equal(intact.raised.length, 1);

    const loaded = corruptField(box, victim.id, 'status', 'activ');
    // The gate's own predicate, at the gate's own line: `false`, not
    // `undefined` falling through an `if (!governsNow(...))`.
    assert.equal(governsNow(loaded.status), false);
    // MEASURED AND UNCHANGED, for the reason given at gate 1.
    const corrupt = contradictionGate(draft, [asCandidate(loaded)], []);
    assert.equal(corrupt.allowed, true);
    assert.equal(corrupt.raised.length, 0);
  } finally {
    box.dispose();
  }
});

test('gate 5 — the pack-collision judgement is asked a real Status', () => {
  const box = sandbox();
  try {
    const victim = governingRule(box, 'never log emails gate five');
    const report = (existing: Item) => renderCollisionReport({
      pack: 'acme.zip', version: '1', kind: 'pack', source: 'acme.zip', format: 'zip',
      manifest: { files: 1, verified: 1, missing: [], extra: [], mismatched: [] },
      buckets: bucketise(
        [{ ...existing, body: 'Overwritten by the artefact.', checksum: 'ff' }],
        (id) => (id === existing.id ? existing : null),
      ),
      config: { merged: [], refused: [], untouched: [] },
      history: { records: 0, quarantined: 0 },
      notCarried: [], refused: [], applied: false, overwriteApproved: false,
      overwritten: [], loadErrors: [],
    });
    // The sentence is WRAPPED into the report's column, so it is searched for
    // in the joined text with the wrapping collapsed. Asking `some(l =>
    // l.includes(...))` finds it only when the line break happens to fall
    // elsewhere, which is a property of the item's title and not of the gate.
    const warns = (lines: string[]) =>
      lines.join(' ').replace(/\s+/g, ' ').includes('stops governing');

    assert.equal(GOVERNING_STATUS[victim.status], true);
    assert.equal(warns(report(victim)), true,
      'the reader approving an overwrite must be told the item stops governing');

    const loaded = corruptField(box, victim.id, 'status', 'activ');
    assert.equal(GOVERNING_STATUS[loaded.status], false);
    // MEASURED AND UNCHANGED, and here the silence is now CORRECT rather than
    // accidental: a `draft` has nothing to lose by being written as `draft`
    // again, which is the judgement `consequence` (pack/collide.ts) is making.
    // Before the fix the same silence came from a table miss on a status the
    // reader was being shown as `activ`.
    assert.equal(warns(report(loaded)), false);
  } finally {
    box.dispose();
  }
});

// ---------------------------------------------------------------------------
// The pack boundary — where the answer is a refusal and not a fallback
// ---------------------------------------------------------------------------

const PACK_OPTS: BundleOptions = {
  kind: 'pack', name: 'acme security', version: '2026-09 rev 1',
  filters: {}, history: true, now: Date.UTC(2026, 8, 13, 12, 0, 0),
};

/**
 * An artefact directory whose single item carries `field: value`, with the
 * manifest RE-WRITTEN over the damaged bytes.
 *
 * The re-write is what makes this test about the enum and not about the
 * manifest: `readArtefact` verifies digests first and refuses a file whose
 * bytes are not the bytes that were hashed, so an artefact left with its
 * original manifest would be refused for the wrong reason and this test would
 * pass while checking nothing.
 */
function artefactSaying(box: Sandbox, dir: string, field: string, value: string): string {
  createItem(box.ctx, {
    type: 'rule', title: 'a rule that travelled', body: 'B.',
    summary: 'A rule written into an artefact somebody else built.', scope: ['src/**'],
  });
  const bundle = buildBundle(box.root, box.ctx.config, PACK_OPTS);
  const out = path.join(dir, `artefact-${field}`);
  writeBundleDirectory(bundle, out);

  const itemFile = bundle.files.find((f) => f.path.startsWith('items/'));
  assert.ok(itemFile !== undefined, 'the fixture bundle carries no items');
  const abs = path.join(out, ...itemFile.path.split('/'));
  const text = readFileSync(abs, 'utf8')
    .replace(new RegExp(`^${field}: .*$`, 'm'), `${field}: ${value}`);
  assert.match(text, new RegExp(`^${field}: ${value}$`, 'm'), 'the fixture edit did not land');
  writeFileSync(abs, text, 'utf8');

  const rehashed = bundle.files.map((f) => (
    f.path === itemFile.path ? { ...f, bytes: Buffer.from(text, 'utf8') } : f
  )).filter((f) => f.path !== MANIFEST_NAME);
  writeFileSync(
    path.join(out, MANIFEST_NAME),
    renderManifest(buildManifest(rehashed, { kind: PACK_OPTS.kind, name: PACK_OPTS.name,
      version: PACK_OPTS.version, now: PACK_OPTS.now })),
    'utf8',
  );
  return out;
}

for (const [field, value, legal] of [
  ['status', 'activ', STATUSES],
  ['severity', 'har', SEVERITIES],
  ['origin', 'revie', ORIGINS],
] as const) {
  test(`an artefact whose item says ${field}: ${value} is refused, not laundered`, () => {
    const box = sandbox();
    const dir = mkdtempSync(path.join(tmpdir(), 'myctx-enum-'));
    try {
      const out = artefactSaying(box, dir, field, value);
      const message = refusalOf(() => readArtefact(out));
      assert.match(message, /^my_context: /);
      assert.match(message, new RegExp(`${field} is "${value}"`));
      for (const member of legal) assert.match(message, new RegExp(`"${member}"`));
      // The manifest is NOT what refused this — see `artefactSaying`.
      assert.doesNotMatch(message, /bytes that were hashed/);
      assert.match(message, /Nothing was imported/);
    } finally {
      box.dispose();
      removeTree(dir);
    }
  });
}

test('an artefact whose enums are all legal still reads, so the refusal is not a wall', () => {
  const box = sandbox();
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-enum-'));
  try {
    // Re-stated through the same helper, so a refusal that fired on every
    // artefact whatever it said would redden here.
    const out = artefactSaying(box, dir, 'status', 'draft');
    const artefact = readArtefact(out);
    assert.equal(artefact.items.length, 1);
    assert.equal(artefact.items[0]!.status, 'draft');
  } finally {
    box.dispose();
    removeTree(dir);
  }
});

// ---------------------------------------------------------------------------
// And the owner is told about his own file
// ---------------------------------------------------------------------------

test('doctor reports a laundered status, with a command that settles it', () => {
  const box = sandbox();
  try {
    const rule = governingRule(box, 'never log emails for doctor');
    corruptField(box, rule.id, 'status', 'activ');
    const findings = checkLaunderedEnum(box.root, [box.ctx.store.get(rule.id) as Item]);
    assert.equal(findings.length, 1);
    const [finding] = findings;
    assert.equal(finding!.level, 'error');
    assert.equal(finding!.code, 'laundered_enum');
    assert.equal(finding!.item, rule.id);
    assert.match(finding!.message, /"activ"/);
    assert.match(finding!.message, /"draft"/);
    assert.deepEqual(finding!.remedy, {
      route: 'copy',
      argv: ['mycontext', 'edit', rule.id, '--status', 'draft', '--yes'],
    });
  } finally {
    box.dispose();
  }
});

test('doctor rules rather than repairs a laundered origin — there is no --origin flag', () => {
  const box = sandbox();
  try {
    const made = createItem(box.ctx, {
      type: 'lesson', title: 'a lesson for doctor', body: 'B.',
      summary: 'A lesson whose origin got mistyped.', origin: 'review',
    });
    corruptField(box, made.id, 'origin', 'revie');
    const findings = checkLaunderedEnum(box.root, [box.ctx.store.get(made.id) as Item]);
    assert.equal(findings.length, 1);
    assert.deepEqual(findings[0]!.remedy, { route: 'acknowledge' });
    assert.match(findings[0]!.message, /no `mycontext edit --origin`/);
  } finally {
    box.dispose();
  }
});

test('a clean corpus produces no laundered_enum row, and the check is wired into doctor', () => {
  const box = sandbox();
  try {
    const rule = governingRule(box, 'never log emails clean');
    assert.deepEqual(checkLaunderedEnum(box.root, [box.ctx.store.get(rule.id) as Item]), []);

    // Registered, not merely written: a check absent from `runChecks` reports
    // nothing however green its own test is.
    corruptField(box, rule.id, 'status', 'activ');
    const codes = runChecks({
      root: box.root, repoRoot: box.cwd, dbPath: ':memory:',
      items: [box.ctx.store.get(rule.id) as Item], config: box.ctx.config,
    }).map((f) => f.code);
    assert.ok(codes.includes('laundered_enum'), `runChecks emitted ${codes.join(', ')}`);
  } finally {
    box.dispose();
  }
});
