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
 * **The local-disk fallback did not re-close these gates, and the lane that
 * built it said so rather than dressing it up.** `draft` does not govern, so
 * `GOVERNING_STATUS.draft` is `false` and each gate still answered no — the
 * same outcome the cast produced, now for a reason a reader could see instead
 * of a table miss. Measured then, and recorded in this file's own header:
 * gates 1, 2 and 3 STILL LET AN AGENT THROUGH on a corrupt local file.
 *
 * **What closes them, added 2026-09-13 on the owner's ruling, is a THIRD
 * ANSWER: "we cannot tell what this item is."** It is distinct from "it
 * governs" and from "it does not govern", and it needs no lie anywhere:
 * `GOVERNING_STATUS` stays a total, honest `Record<Status, boolean>` and
 * `governsNormatively` still answers `false` for the `draft` the file is read
 * as. The gates ask a SECOND question beside it — `illegibleItemRefusal`
 * (core/trust.ts) — and refuse a NON-HUMAN caller outright when the item's own
 * file carries a value outside one of the three vocabularies.
 *
 * **"Non-human caller" is the load-bearing phrase, and every gate test below
 * asserts BOTH halves of it.** The caller's origin is the CALLER's claim
 * (`origin !== 'human'`, the same widening `trustedStatus` uses) and never the
 * item's stored `origin`, which is itself one of the laundered fields. A
 * person editing their own corrupt file must still be able to repair it, so
 * each gate test drives the same act twice: once as an agent, which is now
 * refused, and once as a human, which is not. A refusal that locked the owner
 * out of fixing his own corpus would be a worse defect than the one it closes.
 *
 * So each gate test carries three assertions:
 *
 *  1. **the gate is asked a member of `Status`** — `false`, never `undefined`.
 *     This is the one that reddens if the cast comes back, at that gate's own
 *     line, and it is the whole of what the read boundary promises.
 *  2. **a non-human caller is REFUSED**, and refused by the third answer —
 *     asserted on the refusal's own words, so a refusal that happened to
 *     arrive from some other guard could not stand in for it.
 *  3. **a human is NOT refused** by it.
 *
 * **Gate 5 is the one exception and it is not a refusal, because that gate has
 * no non-human caller to refuse.** `applyImport` has exactly two callers, both
 * CLI, both behind a human's confirmation, and the overwrite itself passes
 * `origin: 'human'` on purpose. Its whole power is what it SAYS to the person
 * deciding, so its third answer is a DISCLOSURE in the collision report — see
 * `CollisionReport.illegible` (pack/collide.ts) and the gate 5 test below.
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
import {
  bucketise, collisionJson, illegibleExisting, renderCollisionReport,
} from '../../src/pack/collide.ts';
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

/**
 * A governing normative item — the thing all five gates exist to protect.
 *
 * `type` is a parameter and not fixed at `rule` for ONE reason, and it is a
 * proof reason rather than a taste one: `GATED_CATEGORIES` (core/overlap.ts)
 * decides whether gate 4 also fires on an item, and a gate-1 test whose victim
 * gate 4 would refuse first would prove gate 1 nothing. So gate 1 uses
 * `invariant` — normative tier, so it genuinely governs, and deliberately NOT
 * in `GATED_CATEGORIES` — and gate 4 uses `rule`, which is.
 */
function governingItem(box: Sandbox, type: string, title: string): Item {
  const made = createItem(box.ctx, {
    type, title, body: 'Do not log customer email addresses.',
    summary: 'Customer email addresses must never be written to any log.',
    scope: ['src/**'], status: 'active', origin: 'human',
  });
  const item = box.ctx.store.get(made.id);
  assert.ok(item !== null && item !== undefined);
  assert.equal(item.status, 'active', 'the fixture must start out governing');
  assert.equal(governsNormatively(box.ctx, item), true, 'the fixture must start out protected');
  return item;
}

function governingRule(box: Sandbox, title: string): Item {
  return governingItem(box, 'rule', title);
}

/**
 * **The one sentence every gate's refusal must contain, asserted rather than
 * assumed.**
 *
 * Each gate below is driven twice, and the second drive being refused is not
 * by itself evidence: a refusal from `requireWritableItem`, from the summary
 * gate, or from an existing-successor check would satisfy `allowed(...) ===
 * false` while proving nothing about this item. So the refusal's own words are
 * read, and they are `illegibleRefusal`'s (core/trust.ts) — one wording shared
 * by all four refusing gates, which is why one helper can check all four.
 */
function assertThirdAnswer(message: string, id: string, said: string): void {
  assert.match(message, /^my_context: this build cannot tell what /);
  assert.match(message, new RegExp(`cannot tell what ${id} IS`));
  assert.ok(message.includes(said), `the refusal does not quote the file: ${message}`);
  // It is NOT "the item does not govern", and the message has to say so in
  // words: a caller that read this as "draft, therefore fine" would report a
  // corrupt item to its user as a draft, which is the whole failure again one
  // layer up.
  assert.ok(message.includes('This is not the same as'));
  assert.ok(message.includes('A human is NOT refused by this'));
  assert.match(message, /Nothing was written\./);
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

test('gate 1 — the supersede preflight refuses a non-human caller, and not a human', () => {
  const box = sandbox();
  try {
    // `invariant`, NOT `rule`: see `governingItem`. A `rule` is in
    // `GATED_CATEGORIES`, so gate 4 would refuse this drive one call earlier
    // and this test would be measuring gate 4 twice.
    const victim = governingItem(box, 'invariant', 'never log emails gate one');
    // The preflight only runs when the NEW item governs and is in
    // contradiction scope, and `trustedStatus` forces every non-human
    // NORMATIVE capture to `draft`. `decision` is the reachable combination:
    // rationale tier (so `active` survives) and a member of
    // `GATED_CATEGORIES`. Measured, not assumed — with the victim intact this
    // refuses, which is what makes the arm below meaningful.
    const drive = (title: string, origin: 'agent' | 'human') => () => createItem(box.ctx, {
      type: 'decision', title, body: 'We retire it.',
      summary: 'The team decided to retire the rule about email addresses in logs.',
      origin, status: 'active', supersedes: victim.id,
    });
    assert.equal(allowed(drive('retire the email rule intact', 'agent')), false,
      'the preflight must refuse while the victim genuinely governs');

    const loaded = corruptField(box, victim.id, 'status', 'activ');
    // The read boundary's own promise, unchanged and still not a protection:
    // the value is a member of `Status`, the total table has an answer for it,
    // and the answer is `false`. Nothing below asks `governsNormatively` to
    // lie about that.
    assert.equal(GOVERNING_STATUS[loaded.status], false);
    assert.equal(governsNormatively(box.ctx, loaded), false);

    // WAS `true` UNTIL 2026-09-13 — the gate let an agent retire a
    // possibly-governing item because `draft` does not govern either.
    assertThirdAnswer(
      refusalOf(drive('retire the email rule corrupt', 'agent')),
      victim.id, 'status is "activ"',
    );
    // And the other half of "non-human caller": the person who has to repair
    // the file is not locked out of his own corpus.
    assert.equal(allowed(drive('retire the email rule as a human', 'human')), true,
      'a human must still be able to act on his own corrupt file');
  } finally {
    box.dispose();
  }
});

test('gate 2 — the guarded-field refusal refuses a non-human caller, and not a human', () => {
  const box = sandbox();
  try {
    const victim = governingRule(box, 'never log emails gate two');
    const drive = (origin: 'agent' | 'human', glob: string) => () => updateItem(box.ctx, {
      id: victim.id, scope: [glob], origin,
    });
    assert.equal(allowed(drive('agent', 'elsewhere/**')), false,
      'the field guard must refuse while the victim genuinely governs');

    const loaded = corruptField(box, victim.id, 'status', 'activ');
    assert.equal(GOVERNING_STATUS[loaded.status], false);
    assert.equal(governsNormatively(box.ctx, loaded), false);

    // WAS `true` UNTIL 2026-09-13.
    assertThirdAnswer(refusalOf(drive('agent', 'elsewhere/**')), victim.id, 'status is "activ"');
    assert.equal(allowed(drive('human', 'repaired/**')), true,
      'a human must still be able to edit his own corrupt file');
  } finally {
    box.dispose();
  }
});

test('gate 3 — supersedeItem refuses a non-human caller, and not a human', () => {
  const box = sandbox();
  try {
    const victim = governingRule(box, 'never log emails gate three');
    const replacement = (n: string) => createItem(box.ctx, {
      type: 'rule', title: `the replacement rule ${n}`, body: 'B.', scope: ['src/**'],
      summary: `Replacement number ${n} for the email logging rule.`, origin: 'agent',
    }).id;
    const first = replacement('one');
    assert.equal(
      allowed(() => supersedeItem(box.ctx, { id: victim.id, by: first, origin: 'agent' })),
      false,
      'supersedeItem must refuse while the victim genuinely governs',
    );

    const loaded = corruptField(box, victim.id, 'status', 'activ');
    assert.equal(GOVERNING_STATUS[loaded.status], false);
    assert.equal(governsNormatively(box.ctx, loaded), false);

    // WAS `true` UNTIL 2026-09-13.
    const second = replacement('two');
    assertThirdAnswer(
      refusalOf(() => supersedeItem(box.ctx, { id: victim.id, by: second, origin: 'agent' })),
      victim.id, 'status is "activ"',
    );
    assert.equal(
      allowed(() => supersedeItem(box.ctx, { id: victim.id, by: second, origin: 'human' })),
      true,
      'a human must still be able to retire his own corrupt file',
    );
  } finally {
    box.dispose();
  }
});

test('gate 3 — a laundered REPLACEMENT is refused too, so the evidence is not overwritten', () => {
  // Both sides, not only the retiree: this call writes the replacement's file
  // as well, and every write path re-renders the whole item from the parsed
  // value — so the corrupt byte would be replaced by this build's reading and
  // `doctor` would stop reporting it, which is the destruction
  // `checkLaunderedEnum`'s own message warns about.
  const box = sandbox();
  try {
    const retiree = createItem(box.ctx, {
      type: 'rule', title: 'a draft rule that may be retired', body: 'B.', scope: ['src/**'],
      summary: 'A draft rule an agent is allowed to retire.', origin: 'agent',
    }).id;
    const by = createItem(box.ctx, {
      type: 'rule', title: 'a replacement whose own file is corrupt', body: 'B.',
      scope: ['src/**'], summary: 'The replacement rule, whose severity is mistyped.',
      origin: 'agent',
    }).id;
    // Retiring an agent's own draft is allowed and MUST stay allowed — the
    // narrowness `supersedeItem`'s own comment insists on, and the thing that
    // makes the refusal below attributable to the replacement's file rather
    // than to this pair being refused all along.
    assert.equal(
      allowed(() => supersedeItem(box.ctx, { id: retiree, by, origin: 'agent' })), true,
      'an agent retiring its own draft with its own draft must not be refused',
    );

    const bad = corruptField(box, by, 'severity', 'har');
    assert.equal(bad.severity, 'soft');
    assertThirdAnswer(
      refusalOf(() => supersedeItem(box.ctx, { id: retiree, by, origin: 'agent' })),
      by, 'severity is "har"',
    );
  } finally {
    box.dispose();
  }
});

test('gate 4 — the contradiction gate refuses a non-human caller, and not a human', () => {
  const box = sandbox();
  try {
    const victim = governingRule(box, 'never log emails gate four');
    // Driven through `createItem` and not through `contradictionGate` as a
    // pure function, because the thing being proved is a REFUSAL taken on the
    // caller's origin, and the pure function has no caller.
    const drive = (title: string, origin: 'agent' | 'human') => () => createItem(box.ctx, {
      type: 'decision', title, body: 'Log customer email addresses.',
      summary: 'Customer email addresses must always be written to any log.',
      origin, status: 'active',
    });
    assert.equal(allowed(drive('always log emails intact', 'agent')), false,
      'the gate must raise the pair while the victim governs');

    const loaded = corruptField(box, victim.id, 'status', 'activ');
    // The gate's own predicate, at the gate's own line: `false`, not
    // `undefined` falling through an `if (!governsNow(...))`.
    assert.equal(governsNow(loaded.status), false);

    // WAS ALLOWED UNTIL 2026-09-13: the victim left the candidate set without
    // a word, and the contradicting capture landed. The caller never named the
    // victim, which is why this gate's third answer is asked over the gate's
    // POPULATION rather than over an item the caller mentioned.
    assertThirdAnswer(
      refusalOf(drive('always log emails corrupt', 'agent')), victim.id, 'status is "activ"',
    );
    assert.equal(allowed(drive('always log emails as a human', 'human')), true,
      'a human capture is not refused by the third answer');

    // And the pure gate still answers exactly as it did — the population
    // filter is untouched, and nothing here taught `governsNow` to lie.
    const asCandidate = (item: Item) => ({
      id: item.id, type: item.type, title: item.title, body: item.body,
      summary: item.summary, severity: item.severity, always: item.always,
      status: item.status, basis: 'victim-basis',
    });
    const pureDraft = {
      id: null, type: 'rule', title: 'always log emails',
      body: 'Log customer email addresses.',
      summary: 'Customer email addresses must always be written to any log.',
      severity: 'soft' as const, always: false, basis: 'draft-basis',
      distinct: [], supersedes: null,
    };
    const pure = contradictionGate(pureDraft, [asCandidate(loaded)], []);
    assert.equal(pure.allowed, true);
    assert.equal(pure.raised.length, 0);
  } finally {
    box.dispose();
  }
});

test('gate 5 — the collision report DISCLOSES, because it has no caller to refuse', () => {
  const box = sandbox();
  try {
    const victim = governingRule(box, 'never log emails gate five');
    const report = (existing: Item) => {
      const buckets = bucketise(
        [{ ...existing, body: 'Overwritten by the artefact.', checksum: 'ff' }],
        (id) => (id === existing.id ? existing : null),
      );
      return renderCollisionReport({
        pack: 'acme.zip', version: '1', kind: 'pack', source: 'acme.zip', format: 'zip',
        manifest: { files: 1, verified: 1, missing: [], extra: [], mismatched: [] },
        buckets,
        config: { merged: [], refused: [], untouched: [] },
        history: { records: 0, quarantined: 0 },
        notCarried: [], refused: [], applied: false, overwriteApproved: false,
        overwritten: [], illegible: illegibleExisting(box.root, buckets), loadErrors: [],
      });
    };
    // The sentence is WRAPPED into the report's column, so it is searched for
    // in the joined text with the wrapping collapsed. Asking `some(l =>
    // l.includes(...))` finds it only when the line break happens to fall
    // elsewhere, which is a property of the item's title and not of the gate.
    const flat = (lines: string[]) => lines.join(' ').replace(/\s+/g, ' ');

    assert.equal(GOVERNING_STATUS[victim.status], true);
    assert.ok(flat(report(victim)).includes('stops governing'),
      'the reader approving an overwrite must be told the item stops governing');
    assert.ok(!flat(report(victim)).includes('ILLEGIBLE HERE'),
      'a legible corpus must not be warned about — a false warning costs what one always costs');

    const loaded = corruptField(box, victim.id, 'status', 'activ');
    assert.equal(GOVERNING_STATUS[loaded.status], false);
    const corrupt = flat(report(loaded));
    // WAS SILENT UNTIL 2026-09-13: `consequence` prints "stops governing" only
    // for an item `GOVERNING_STATUS` calls governing, so the person approving
    // an overwrite of a possibly-active item was shown a draft and told
    // nothing. The demotion sentence is still correctly absent — the item
    // really does read `draft` — and the disclosure is what says why.
    assert.ok(corrupt.includes('ILLEGIBLE HERE'), corrupt);
    assert.ok(corrupt.includes('status is "activ"'), corrupt);
    assert.ok(corrupt.includes('mycontext doctor'), corrupt);
    assert.ok(!corrupt.includes('stops governing'));
    // The JSON document says it too, or the two renderings of one artefact
    // would disagree.
    const json = collisionJson({
      pack: 'acme.zip', version: '1', kind: 'pack', source: 'acme.zip', format: 'zip',
      manifest: { files: 1, verified: 1, missing: [], extra: [], mismatched: [] },
      buckets: { new: [], changed: [], identical: [] },
      config: { merged: [], refused: [], untouched: [] },
      history: { records: 0, quarantined: 0 },
      notCarried: [], refused: [], applied: false, overwriteApproved: false,
      overwritten: [], loadErrors: [],
      illegible: [{ id: victim.id, says: 'status is "activ", which is not one of "active"' }],
    }) as { illegible: { id: string; says: string }[] };
    assert.deepEqual(json.illegible, [
      { id: victim.id, says: 'status is "activ", which is not one of "active"' },
    ]);
  } finally {
    box.dispose();
  }
});

test('the third answer is a THIRD one — nothing was taught to lie', () => {
  // The cheapest way to close these gates would have been to make
  // `GOVERNING_STATUS` or `governsNormatively` answer `true` for an item whose
  // file is corrupt. That would corrupt the one table in this project written
  // total so that every status has an answer, and it would do it for every
  // reader — selection, the draft queue and `doctor` all have to go on
  // treating the item as the draft it now reads as. This asserts it did not
  // happen.
  const box = sandbox();
  try {
    const victim = governingRule(box, 'never log emails third answer');
    const loaded = corruptField(box, victim.id, 'status', 'activ');
    assert.equal(governsNormatively(box.ctx, loaded), false);
    assert.deepEqual(GOVERNING_STATUS, {
      active: true, validated: true, draft: false, superseded: false, deprecated: false,
    });
    // And the item is still SELECTABLE as a draft — it did not vanish, which
    // is the half the fallback bought and this change must not undo.
    assert.equal(box.ctx.store.get(victim.id)?.status, 'draft');
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
