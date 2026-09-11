// @basis TASK-the-maintenance-tool-crud-where-the-form-is-the-template-and
/**
 * **THE FORM IS THE TEMPLATE — one table, not three that agree today.**
 *
 * D41 spec §11.3, `plan:store seq:3` Task 10. The governing item's sentence is
 * what these assertions are for:
 *
 * > *A prohibition's form has a `why` field and will not save without one,
 * > FROM THE SAME TABLE THE SCHEMA AND THE CHECK READ. Three things that can
 * > drift are one thing.*
 *
 * A test can assert that the form HAS a `why` field and that a save WITHOUT
 * one is refused, and both would pass over three separate hard-coded lists.
 * So the assertions below are written to fail when the three stop being one:
 *
 *  - the part controls a form draws are compared, **as an ordered list**,
 *    against `partsOf(kind)` — so a part added, removed or renamed in
 *    `schema.ts` and not in the form is a failure, in either direction;
 *  - each control's LABEL is compared against that part's `asks`, which is a
 *    sentence of prose that exists in exactly one place in this repository. A
 *    second table would have to copy those sentences verbatim to pass;
 *  - the refusal a save produces is compared against the refusal `parseEntry`
 *    produces for the same text. Two validators would have to word their
 *    refusals identically, character for character.
 *
 * **And the anti-vacuity assertion at the top is the one that makes the rest
 * mean anything**: the union of every part name across every kind, so that
 * "the form offers exactly this kind's parts" is a claim about a set that
 * genuinely contains foreign names to exclude.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeManifest } from '../../src/rules/manifest.ts';
import {
  ALWAYS, KINDS, TEMPLATE, composeEntry, parseEntry, partsOf,
  type EntryError, type Kind,
} from '../../src/rules/schema.ts';
import { entriesDir, loadRules } from '../../src/rules/store.ts';
import { moveTier, renderForm, saveFromForm } from '../../src/ui/maintenance/screens/form.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * The controls one rendered form draws, read out of the HTML STRUCTURALLY —
 * tag, `name`, and the label bound to it — rather than by asking whether a
 * substring appears. A substring check would pass on a part name that happened
 * to occur in a neighbouring field's prose, and every lane on this plan found
 * at least one assertion of exactly that shape staying green under removal.
 */
interface Control { tag: string; name: string; asks: string }

function unescape(markup: string): string {
  return markup
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .trim();
}

function controlsOf(markup: string): Control[] {
  const found: Control[] = [];
  const pattern = /<label[^>]*\sfor="([^"]+)"[^>]*>([\s\S]*?)<\/label>\s*<(input|textarea|select)([^>]*)>/g;
  for (const match of markup.matchAll(pattern)) {
    const attrs = match[4];
    found.push({
      tag: match[3],
      name: /\sname="([^"]+)"/.exec(attrs)?.[1] ?? '',
      // The prompt is its own element, so it is read as one rather than by
      // subtracting the field's name from the label's text.
      asks: unescape(/<span class="asks">([\s\S]*?)<\/span>/.exec(match[2])?.[1] ?? ''),
    });
  }
  return found;
}

/** Every part name any kind uses, so "exactly this kind's" excludes something. */
const EVERY_PART = new Set<string>([
  ...KINDS.flatMap((k) => TEMPLATE[k].map((p) => p.name)),
  ...ALWAYS.map((p) => p.name),
]);

function withStore(fn: (dir: string) => void): void {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-maint-'));
  cpSync(entriesDir(), dir, { recursive: true });
  writeManifest(dir);
  try { fn(dir); } finally { removeTree(dir); }
}

/** A complete, valid set of form values for `kind`. */
function values(kind: Kind, over: Record<string, string> = {}): Record<string, string> {
  const filled: Record<string, string> = {
    id: `probe-${kind}`,
    kind,
    tier: 'product',
    title: `a probe ${kind} written by the form test`,
    body: 'A body, because an entry is prose.',
  };
  for (const part of partsOf(kind)) {
    filled[part.name] = part.shape === 'list' ? 'first step\nsecond step' : `a written ${part.name}`;
  }
  filled.check = 'none - this is a probe entry and the archive has nothing to measure it against';
  return { ...filled, ...over };
}

/* ══ 0. THE SET THE CLAIM IS MADE AGAINST IS NOT A SINGLETON ═══════════════ */

test('the part names differ across kinds, or "exactly this kind\'s parts" is vacuous', () => {
  assert.ok(EVERY_PART.size > 6, `only ${EVERY_PART.size} distinct part names exist across all kinds`);
  for (const kind of KINDS) {
    const mine = new Set(partsOf(kind).map((p) => p.name));
    const foreign = [...EVERY_PART].filter((name) => !mine.has(name));
    assert.ok(
      foreign.length > 0,
      `a \`${kind}\` uses every part name there is, so excluding foreign parts proves nothing`,
    );
  }
});

/* ══ 1. THE FORM OFFERS EXACTLY THIS KIND'S PARTS, FROM THE SAME TABLE ═════ */

for (const kind of KINDS) {
  test(`the ${kind} form offers exactly a ${kind}'s parts, in the template's order`, () => {
    const drawn = controlsOf(renderForm({ kind, values: {}, action: '/save' }));
    const parts = drawn.filter((c) => EVERY_PART.has(c.name));
    assert.deepEqual(
      parts.map((c) => c.name),
      partsOf(kind).map((p) => p.name),
      `the ${kind} form and \`partsOf('${kind}')\` disagree about which parts a ${kind} has. ` +
      `The form, the schema and the check are one table (spec §11.3) — if the form can differ ` +
      `from the schema, the template has stopped being one thing.`,
    );
  });

  test(`the ${kind} form labels every part with the template's own words`, () => {
    const drawn = controlsOf(renderForm({ kind, values: {}, action: '/save' }));
    for (const part of partsOf(kind)) {
      const control = drawn.find((c) => c.name === part.name);
      assert.ok(control !== undefined, `no control for \`${part.name}\``);
      assert.equal(
        control.asks, part.asks,
        `the \`${part.name}\` control asks something other than what \`TEMPLATE\` says it asks. ` +
        `The label is read from the table, not written twice.`,
      );
      // Spec §11.3: "text areas large enough to write prose in — entries here
      // are paragraphs, and a one-line input produces one-line thinking."
      assert.equal(
        control.tag, 'textarea',
        `\`${part.name}\` is drawn as a <${control.tag}>. A one-line input produces one-line ` +
        `thinking, and every part of an entry is prose.`,
      );
    }
  });
}

/* ══ 2. A PROHIBITION WILL NOT SAVE WITHOUT A `why` ════════════════════════ */

test('a prohibition cannot be saved without a why, and nothing is written', () => {
  withStore((dir) => {
    const without = values('prohibition');
    delete without.why;
    const answer = saveFromForm(dir, without);
    assert.equal(answer.ok, false, 'a prohibition with no `why` was saved');
    assert.equal(
      existsSync(path.join(dir, 'probe-prohibition.md')), false,
      'the refusal still left a file behind, so the store now holds an entry the form rejected',
    );
  });
});

/**
 * **The one-validator assertion.** The save refusal is compared to the refusal
 * `parseEntry` gives for the same text: a second validator in the form would
 * have to reproduce that sentence exactly, including the `asks` clause the
 * table supplies.
 */
test('the save refusal IS the schema\'s refusal, not a second one that agrees', () => {
  withStore((dir) => {
    const without = values('prohibition');
    delete without.why;
    const answer = saveFromForm(dir, without);
    assert.equal(answer.ok, false);

    const draft = composeEntry({
      id: without.id, kind: 'prohibition', tier: 'product', title: without.title,
      parts: { prohibition: without.prohibition, example: without.example, check: without.check },
      body: without.body,
    });
    const parsed = parseEntry(draft, path.join(dir, 'probe-prohibition.md'));
    assert.ok('error' in parsed, 'the composed draft parsed, so there is nothing to compare');
    assert.equal(
      (answer as { ok: false; error: string }).error,
      (parsed as EntryError).error,
      'the form refused in its own words. Two refusals are two validators, and two validators ' +
      'drift — spec §11.3: "Schema, check and UI are one thing."',
    );
  });
});

test('a complete prohibition saves, so the refusal above is about the missing why', () => {
  withStore((dir) => {
    const answer = saveFromForm(dir, values('prohibition'));
    assert.equal(answer.ok, true, `a complete prohibition was refused: ${JSON.stringify(answer)}`);
    const written = readFileSync(path.join(dir, 'probe-prohibition.md'), 'utf8');
    const parsed = parseEntry(written, 'probe-prohibition.md');
    assert.ok(!('error' in parsed), `what the form wrote does not parse: ${JSON.stringify(parsed)}`);
    assert.equal(parsed.parts.why, 'a written why');
  });
});

/* ══ 3. AN ENTRY MOVES BETWEEN TIERS, BOTH DIRECTIONS ══════════════════════ */

/**
 * Asserted by LOADING against a foreign workspace, never by reading the `tier`
 * field back — `test/rules/store.test.ts` draws that line and it is the only
 * assertion that proves the filter rather than proving the write.
 */
test('an entry moves product -> developer and back, and the filter follows it', () => {
  withStore((dir) => {
    const saved = saveFromForm(dir, values('prohibition'));
    assert.equal(saved.ok, true);
    const id = 'probe-prohibition';
    const elsewhere = (): string[] => loadRules(dir, false).entries.map((e) => e.id);
    const here = (): string[] => loadRules(dir, true).entries.map((e) => e.id);

    assert.ok(elsewhere().includes(id), 'a product entry did not reach a foreign workspace');

    assert.equal(moveTier(dir, id, 'developer').ok, true);
    assert.equal(
      elsewhere().includes(id), false,
      'demotion to `developer` did not take the entry out of the shipped set. Spec §10: ' +
      '"Removal is demotion: moving an entry from product to developer takes it out of the ' +
      'shipped set, reversibly."',
    );
    assert.ok(here().includes(id), 'demotion removed the entry from my_context itself as well');

    assert.equal(moveTier(dir, id, 'product').ok, true);
    assert.ok(
      elsewhere().includes(id),
      'promotion back to `product` did not restore it. "Reversibly" is half of the ruling.',
    );
  });
});
