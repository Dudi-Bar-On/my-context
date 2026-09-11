// @basis TASK-the-store-loads-refuses-what-it-cannot-parse-and-proves-it, INV-nothing-is-dropped-silently, TASK-seed-the-store-and-migrate-the-rules-that-already-exist
/**
 * **The template per kind IS the schema, and this file is what makes that one
 * thing rather than three.**
 *
 * D41 spec §4 puts a table in the design — kind, what it answers, the parts it
 * requires — and says the table is "the schema, the check AND the form". A
 * table that is only prose becomes three tables the moment somebody writes the
 * validator by hand: a `prohibition` that loads without a `why` in one place
 * and not in another has already stopped being one template.
 *
 * So every assertion below reads `TEMPLATE` rather than a list typed out here.
 * A part added to a kind in `schema.ts` is a part this file requires on the
 * next run, and a part deleted there is a test that goes red — which is the
 * only shape in which "one table" survives a second author.
 *
 * `plan:store seq:1`, Task 1.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALWAYS, KINDS, TEMPLATE, TIERS, parseEntry, partsOf, type EntryError, type Kind,
} from '../../src/rules/schema.ts';

/** The frontmatter one legal entry of `kind` needs, part for part. */
function fields(kind: Kind): Record<string, string> {
  const out: Record<string, string> = {
    id: `an-entry-of-kind-${kind}`,
    kind,
    tier: 'developer',
    title: `an entry of kind ${kind}`,
  };
  for (const part of partsOf(kind)) {
    out[part.name] = part.name === 'check'
      ? 'detective:the archive is asked whether this held'
      : `the ${part.name} of this entry`;
  }
  return out;
}

/** Which parts of `kind` are written as an indented `- ` block on disk. */
function listParts(kind: Kind): string[] {
  return partsOf(kind).filter((p) => p.shape === 'list').map((p) => p.name);
}

/**
 * One entry file, with `overrides` applied and `undefined` meaning "omit".
 *
 * A `list` part is emitted as a list unless the override deliberately writes a
 * scalar — which is what `a list part written as one scalar is refused` below
 * relies on.
 */
function entry(kind: Kind, overrides: Record<string, string | undefined> = {}): string {
  const merged: Record<string, string | undefined> = { ...fields(kind), ...overrides };
  const lists = listParts(kind).filter((n) => !Object.hasOwn(overrides, n));
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined) continue;
    if (lists.includes(key)) {
      lines.push(`${key}:`, `  - ${value}`, '  - and then the next one');
      continue;
    }
    // A `:` inside a value is the one thing this parser needs quoted, and
    // `check` carries one in every legal form.
    lines.push(`${key}: ${/[:#]/.test(value) ? JSON.stringify(value) : value}`);
  }
  lines.push('---', '', 'The prose of the entry.', '');
  return lines.join('\n');
}

function refusal(text: string, path = 'x.md'): EntryError {
  const answer = parseEntry(text, path);
  assert.equal('error' in answer, true, `expected a refusal, got an entry:\n${text}`);
  return answer as EntryError;
}

/* ══ 1. THE PER-KIND TEMPLATE ══════════════════════════════════════════════ */

test('a prohibition without a why does not load', () => {
  const bad = parseEntry(entry('prohibition', { why: undefined }), 'x.md');
  assert.equal('error' in bad, true);
  assert.match((bad as EntryError).error, /why/);
});

/**
 * **Five tests, five different messages, and deliberately not one loop with a
 * generic assertion.**
 *
 * The plan asks for this by name (Task 1 step 4): a single generic test would
 * pass over four kinds silently the day a fifth stopped being checked. Each
 * kind names the part it dropped, so a failure says which template broke.
 */
test('a fact without its truth does not load, and the refusal names `truth`', () => {
  assert.match(refusal(entry('fact', { truth: undefined })).error, /\btruth\b/);
});

test('a procedure without its steps does not load, and the refusal names `steps`', () => {
  assert.match(refusal(entry('procedure', { steps: undefined })).error, /\bsteps\b/);
});

test('a standard without its trigger does not load, and the refusal names `trigger`', () => {
  assert.match(refusal(entry('standard', { trigger: undefined })).error, /\btrigger\b/);
});

test('a definition without what it is confused with does not load, and says so', () => {
  assert.match(refusal(entry('definition', { confusedWith: undefined })).error, /\bconfusedWith\b/);
});

/**
 * The two parts every kind carries (spec §4's second table). Asserted ACROSS
 * the kinds rather than on one, because "every kind" is the claim: an
 * `example` required on `fact` and forgotten on `standard` is the same defect
 * as a missing `why`, one table over.
 */
for (const part of ALWAYS) {
  test(`every kind requires \`${part.name}\`, and the refusal names it`, () => {
    for (const kind of KINDS) {
      const bad = refusal(entry(kind, { [part.name]: undefined }));
      assert.match(
        bad.error, new RegExp(`\\b${part.name}\\b`),
        `${kind} loaded without \`${part.name}\`, or refused without naming it`,
      );
    }
  });
}

/**
 * The whole table, walked. This is the assertion that cannot go stale: a part
 * added to `TEMPLATE` tomorrow is required tomorrow, with no edit here.
 */
test('every part of every kind is required, and its absence names it', () => {
  for (const kind of KINDS) {
    for (const part of partsOf(kind)) {
      const bad = refusal(entry(kind, { [part.name]: undefined }));
      assert.match(
        bad.error, new RegExp(`\\b${part.name}\\b`),
        `${kind} loaded without \`${part.name}\`, or refused without naming it`,
      );
    }
  }
});

test('a complete entry of every kind loads', () => {
  for (const kind of KINDS) {
    const answer = parseEntry(entry(kind), `${kind}.md`);
    assert.equal('error' in answer, false, `a complete ${kind} was refused: ${JSON.stringify(answer)}`);
  }
});

/**
 * The template is a floor AND a ceiling. A `fact` carrying a `why` is either a
 * prohibition filed as a fact or a field nothing reads — and a field nothing
 * reads is the "empty required field teaches people to write filler" failure
 * spec §4 names, arriving from the other direction.
 */
test('a part belonging to another kind is refused, not ignored', () => {
  const bad = refusal(entry('fact', { why: 'a reason a fact has nowhere to put' }));
  assert.match(bad.error, /\bwhy\b/);
});

/**
 * Spec §7: no `status`, no `supersedes`, no `always`, no decay, no
 * `valid_until` — "these are constants, not items with a life". A corpus
 * field that merely goes unread would make the store look like it had a
 * lifecycle it does not have.
 */
test('a corpus lifecycle field is refused by name', () => {
  assert.match(refusal(entry('fact', { status: 'active' })).error, /\bstatus\b/);
  assert.match(refusal(entry('fact', { valid_until: '2027-01-01' })).error, /\bvalid_until\b/);
});

/* ══ 2. THE CHECK FIELD ════════════════════════════════════════════════════ */

test('check: none must carry a reason', () => {
  assert.match(refusal(entry('fact', { check: 'none' })).error, /reason/);
});

test('check: none with a reason is legal, and the reason survives', () => {
  const answer = parseEntry(entry('fact', { check: 'none - nothing observes this' }), 'x.md');
  assert.equal('error' in answer, false);
  assert.deepEqual(
    'error' in answer ? null : answer.check,
    { how: 'none', why: 'nothing observes this' },
  );
});

test('check: detective names a check', () => {
  const answer = parseEntry(entry('fact', { check: 'detective:questions carry numbers' }), 'x.md');
  assert.deepEqual(
    'error' in answer ? null : answer.check,
    { how: 'detective', name: 'questions carry numbers' },
  );
});

test('check: preventive names a check', () => {
  const answer = parseEntry(entry('fact', { check: 'preventive:body-stops-at-first-heading' }), 'x.md');
  assert.deepEqual(
    'error' in answer ? null : answer.check,
    { how: 'preventive', name: 'body-stops-at-first-heading' },
  );
});

test('check: a preventive with nothing after the colon names no check', () => {
  assert.match(refusal(entry('fact', { check: 'preventive:' })).error, /names no check/);
});

/**
 * Spec §4 draws the preventive/detective line and argues it is "not cosmetic":
 * under a single-kind field every entry governing the assistant's own output
 * would declare `none`, and the store would understate its own
 * enforceability. A third word is therefore a refusal, not a synonym.
 */
test('check: a word that is neither preventive, detective nor none is refused', () => {
  const bad = refusal(entry('fact', { check: 'enforced:something' }));
  assert.match(bad.error, /preventive/);
  assert.match(bad.error, /detective/);
});

/* ══ 3. THE FRAME: id, kind, tier ══════════════════════════════════════════ */

test('an unknown kind is refused and the five are named', () => {
  const bad = refusal(entry('fact', { kind: 'anti-pattern' }));
  for (const kind of KINDS) assert.match(bad.error, new RegExp(`\\b${kind}\\b`));
});

test('an unknown tier is refused and the two are named', () => {
  const bad = refusal(entry('fact', { tier: 'internal' }));
  for (const tier of TIERS) assert.match(bad.error, new RegExp(`\\b${tier}\\b`));
});

test('a refusal always carries the path, so the file can be opened', () => {
  assert.equal(refusal(entry('fact', { truth: undefined }), 'entries/a.md').path, 'entries/a.md');
});

test('a file with no frontmatter at all is refused, not read as an empty entry', () => {
  const bad = refusal('just prose, no fence\n');
  assert.match(bad.error, /frontmatter/);
});

test('frontmatter this parser cannot read is refused by the entry, never thrown', () => {
  const bad = refusal('---\nkind: [unclosed\n---\n\nbody\n');
  assert.match(bad.error, /frontmatter/);
});

/* ══ 4. THE PARTS THAT SURVIVE ═════════════════════════════════════════════ */

test('an ordered list part parses as a list, and a text part as text', () => {
  const text = [
    '---', 'id: a-procedure', 'kind: procedure', 'tier: developer',
    'title: how something is done',
    'steps:', '  - first', '  - second',
    'proof: it came out the other end',
    'example: the run on 2026-09-10',
    'check: "none - nothing watches this yet"',
    '---', '', 'prose', '',
  ].join('\n');
  const answer = parseEntry(text, 'p.md');
  assert.equal('error' in answer, false, JSON.stringify(answer));
  if ('error' in answer) return;
  assert.deepEqual(answer.parts.steps, ['first', 'second']);
  assert.equal(answer.parts.proof, 'it came out the other end');
});

test('a list part written as one scalar is refused rather than read as one step', () => {
  const bad = refusal(entry('procedure', { steps: 'do the thing then the other thing' }));
  assert.match(bad.error, /\bsteps\b/);
  assert.match(bad.error, /list/);
});

test('the body is the prose after the frontmatter, and it is kept', () => {
  const answer = parseEntry(entry('fact'), 'x.md');
  assert.equal('error' in answer, false);
  if ('error' in answer) return;
  assert.equal(answer.body, 'The prose of the entry.');
});

/**
 * Spec §6: the owner's own words, verbatim, "for documentation only and
 * should not be injected to the context". Phase 1 owes the FIELD; the
 * never-injected half is Task 6's assertion and is named there.
 */
test('request is optional, kept verbatim, and its absence is not an error', () => {
  const withOut = parseEntry(entry('fact'), 'x.md');
  assert.equal('error' in withOut ? null : withOut.request, undefined);
  const messy = 'make it   so the thing DOESNT happen again , pls';
  const withIt = parseEntry(entry('fact', { request: messy }), 'x.md');
  assert.equal('error' in withIt ? null : withIt.request, messy);
});

/**
 * **`movedFrom` is a field because the renderer has to decide per tier who is
 * told** — the owner's ruling of 2026-09-11, after the first product-tier
 * entry shipped a footer naming a corpus item no install outside this
 * repository holds. Written into the body it would ship wherever the body
 * ships; written as a field, `deliver.ts` discloses it to the developer tier
 * and to nobody else.
 *
 * `movedOn` alone is refused for the reason this file refuses a stray field
 * everywhere else: nothing reads it, so it is a date about nothing sitting in
 * a store whose whole claim is that a field it carries is a field it uses.
 */
test('movedFrom and movedOn are optional, kept verbatim, and absent is not an error', () => {
  const withOut = parseEntry(entry('fact'), 'x.md');
  assert.equal('error' in withOut ? null : withOut.movedFrom, undefined);
  const withIt = parseEntry(
    entry('fact', { movedFrom: 'RULE-where-this-came-from', movedOn: '2026-09-11' }), 'x.md',
  );
  assert.equal('error' in withIt ? null : withIt.movedFrom, 'RULE-where-this-came-from');
  assert.equal('error' in withIt ? null : withIt.movedOn, '2026-09-11');
});

test('a movedOn with no movedFrom beside it is refused, and the refusal names both', () => {
  const error = refusal(entry('fact', { movedOn: '2026-09-11' })).error;
  assert.match(error, /\bmovedOn\b/);
  assert.match(error, /\bmovedFrom\b/);
});

test('a standard surfaces its trigger, and no other kind has one', () => {
  const standard = parseEntry(entry('standard'), 's.md');
  assert.equal('error' in standard ? null : standard.trigger, 'the trigger of this entry');
  const fact = parseEntry(entry('fact'), 'f.md');
  assert.equal('error' in fact ? null : fact.trigger, undefined);
});

/* ══ 5. THE TABLE ITSELF ═══════════════════════════════════════════════════ */

test('every kind has a template, and every part of it can be rendered as a form field', () => {
  assert.deepEqual([...KINDS].sort(), Object.keys(TEMPLATE).sort());
  for (const kind of KINDS) {
    assert.ok(TEMPLATE[kind].length > 0, `${kind} has no parts, so its template enforces nothing`);
    for (const part of partsOf(kind)) {
      assert.ok(part.asks.trim() !== '', `${kind}.${part.name} asks nothing, so no form can label it`);
      assert.ok(
        part.shape === 'text' || part.shape === 'list',
        `${kind}.${part.name} has no shape, so no form knows what control to draw`,
      );
    }
  }
});

test('no kind redeclares a part every kind already carries', () => {
  const always = ALWAYS.map((p) => p.name);
  for (const kind of KINDS) {
    const own = TEMPLATE[kind].map((p) => p.name).filter((n) => always.includes(n));
    assert.deepEqual(own, [], `${kind} declares ${own.join(', ')} twice — once is the point`);
  }
});
