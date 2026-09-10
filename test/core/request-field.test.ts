// @basis TASK-an-item-records-the-request-that-produced-it-in-the-owner-s, INV-markdown-is-the-source-of-truth
/**
 * **`request` — the owner's own words, verbatim, and the four ways it could
 * look right and be wrong.**
 *
 * D41 spec §16a. The field is documentation and nothing at runtime reads it,
 * so every property worth testing is an ABSENCE — and an absence is the one
 * kind of assertion that passes when the mechanism was never built. Each test
 * below therefore plants a value first and then asserts it is missing from
 * somewhere specific, so a test that stopped exercising the field fails on the
 * plant rather than passing on the absence.
 *
 *  1. **It round-trips byte for byte, proved on a RAW FIXTURE** this code did
 *     not write. `INV-markdown-is-the-source-of-truth` promises `files → DB →
 *     files` is byte-identical, and this field is the most able to break it:
 *     free multi-line prose, unescaped, stored between a heading and the end of
 *     the file.
 *  2. **It is NEVER in the summary basis.** `itemSummaryBasis` cannot see it
 *     because it is not in `ContentShape` — recording a request must not turn a
 *     current summary stale, and the corpus-wide sweep would otherwise mark
 *     every summary in the corpus stale in one act.
 *  3. **It is NEVER injected**, and not in the checksum either. Both are what
 *     the owner asked for in the sentence the field exists to honour, and the
 *     checksum half is what makes the backfill reversible.
 *  4. **It is optional, verbatim, and refused rather than repaired.** An
 *     agent-origin item without one is not a defect; a request carrying a
 *     Markdown heading is refused at the write boundary instead of being
 *     quietly edited into something that fits.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { itemSummaryBasis, summaryState } from '../../src/core/content-hash.ts';
import { computeItemChecksum, droppedBodyText, parseItem, renderItem } from '../../src/core/item.ts';
import { createItem } from '../../src/core/mutate.ts';
import { renderIndexLine, renderItemBlock } from '../../src/core/render-item.ts';
import { itemCost } from '../../src/core/select.ts';
import { validateRequest } from '../../src/core/validate.ts';
import type { Item } from '../../src/core/types.ts';
import { sandbox, type Sandbox } from '../helpers/workspace.ts';

/**
 * The owner's actual words, mess and all — the sentence that produced this
 * field. It is used as the planted value throughout because it is exactly the
 * shape the field must survive: an apostrophe the tool has no reason to
 * escape, a possessive spelled `it's`, an em dash, and no capital letter at
 * the start. If any surface tidies it, these tests see a different string.
 */
const OWNER_WORDS = 'the user request prompt in free text should be also documented in the item '
  + 'before it\'s body and summary created, it will ease the user understanding about what the '
  + 'rule or instruction or other item type is because it was written by it\'s own words — this '
  + 'property is for documentation only and should not be injected to the context.';

/** A distinctive token that cannot occur anywhere else in a rendered item. */
const CANARY = 'zzqx-request-canary-9317';

function itemOf(box: Sandbox, id: string): Item {
  return box.ctx.store.get(id)!;
}

function fileOf(box: Sandbox, id: string): string {
  return readFileSync(path.join(box.root, itemOf(box, id).filePath), 'utf8');
}

function rule(box: Sandbox, extra: Record<string, unknown> = {}): string {
  return createItem(box.ctx, {
    type: 'rule',
    title: 'Do not log customer email',
    body: 'Secrets in logs outlive the incident.',
    summary: 'Customer email addresses must never be written to a log.',
    status: 'active',
    origin: 'human',
    ...extra,
  }).id;
}

/* -------------------------------------------------------------------------- *
 * 1. THE RAW FIXTURE — byte identity, on text this code did not write.
 * -------------------------------------------------------------------------- */

/**
 * Authored by hand, and every part of the request block is a case that could
 * break the round trip on its own:
 *
 *  - **two paragraphs**, so the blank line inside the section must survive —
 *    the thing a frontmatter scalar could not have held at all;
 *  - **a line beginning `- `**, which is `LIST_ITEM`'s shape in the
 *    frontmatter grammar and a Markdown bullet here, and must be neither;
 *  - **a line beginning `#`** with no space after it, which is NOT a heading
 *    and so must be kept, right beside the guard that refuses one that is;
 *  - **a trailing `:`**, `"` and an em dash, none of which anything escapes.
 *
 * `checksum` is deliberately a value this test never asserts on its own: the
 * fixture is about BYTES.
 */
const RAW = `---
id: RULE-do-not-log-customer-email
type: rule
title: Do not log customer email
status: active
severity: soft
always: false
scope:
  - src/**
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-01
valid_until: null
checksum: a0b1c2d3e4f56789
---

# Do not log customer email

Secrets in logs outlive the incident.

## Request

dont log the customer email anywhere, i mean it — not in the "debug" logs either:

- not in access logs
- not in #2 the retry path
`;

test('a hand-written ## Request survives files -> DB -> files byte for byte', () => {
  const parsed = parseItem(RAW, 'items/rule/RULE-do-not-log-customer-email.md', 'project');
  assert.equal(
    renderItem(parsed), RAW,
    'INV-markdown-is-the-source-of-truth: "delete the index, it rebuilds" is only a real '
    + 'recovery while the round trip is lossless. A request re-rendered differently would '
    + 'destroy the one thing this field exists to preserve — the words as they were typed',
  );
});

test('the fixture parses into the whole request, blank line and bullets and all', () => {
  const parsed = parseItem(RAW, 'items/rule/RULE-do-not-log-customer-email.md', 'project');
  assert.equal(
    parsed.request,
    'dont log the customer email anywhere, i mean it — not in the "debug" logs either:\n'
    + '\n'
    + '- not in access logs\n'
    + '- not in #2 the retry path',
    'non-vacuity: the round trip above must not be passing by keeping a raw block it never '
    + 'understood. The parsed value is read, and it is the whole of what was written',
  );
});

test('an item with no ## Request carries no request key at all', () => {
  const withoutRequest = RAW.slice(0, RAW.indexOf('\n## Request')) + '\n';
  const parsed = parseItem(withoutRequest, 'items/rule/RULE-x.md', 'project');
  assert.equal(parsed.request, undefined);
  assert.equal(
    'request' in parsed, false,
    'absent must be ABSENT, not `undefined` under a present key: this object is stringified '
    + 'by the MCP surface and the UI read model, and `undefined` stops disappearing the '
    + 'moment somebody adds a `?? null`',
  );
});

test('a request is not reported as text a canonical rewrite would drop', () => {
  assert.equal(
    droppedBodyText(RAW), null,
    '`## Request` is a WRITABLE_SECTION now, so `mycontext repair` must not warn that it is '
    + 'about to delete one — and the per-line grammar of observations/relations must not be '
    + 'run over free prose, which would report every line of a recorded prompt as a loss',
  );
});

/* -------------------------------------------------------------------------- *
 * 2. NEVER IN THE SUMMARY BASIS.
 * -------------------------------------------------------------------------- */

test('recording a request does not move the summary basis, and the summary stays current', () => {
  // **Two sandboxes rather than two items in one**, deliberately: the pair
  // must be identical in every field the basis reads, and two such items in
  // one corpus is exactly what the contradiction gate refuses to let anybody
  // write. The comparison is between two items that really were created, which
  // is the honest form of the question, and it costs one extra workspace.
  const plainBox = sandbox();
  const box = sandbox();
  try {
    const without = itemOf(plainBox, rule(plainBox));
    assert.equal(summaryState(without), 'current');

    const withRequest = itemOf(box, rule(box, { request: OWNER_WORDS }));

    // The plant, first — so this test fails loudly if the field ever stops
    // being stored, instead of passing on an absence it did not cause.
    assert.equal(withRequest.request, OWNER_WORDS, 'plant: the request must actually be there');
    assert.equal(
      itemSummaryBasis(withRequest), itemSummaryBasis(without),
      'spec §16a: never in the summary basis. Two items identical but for a request must '
      + 'hash the same, or the 1,076-item backfill marks every summary in the corpus stale '
      + 'in one act — for a field that changed nothing about what any of them says',
    );
    assert.equal(
      summaryState(withRequest), 'current',
      'and the consequence, stated as the verdict a reader actually sees',
    );
  } finally {
    box.dispose();
    plainBox.dispose();
  }
});

test('the summary basis is blind to the request even when it is CHANGED on a live item', () => {
  const box = sandbox();
  try {
    const id = rule(box, { request: OWNER_WORDS });
    const item = itemOf(box, id);
    const before = itemSummaryBasis(item);

    // Directly on the in-memory item, because there is no update surface for
    // this field by design — the point being asserted is about the hash, not
    // about who may write it.
    const moved: Item = { ...item, request: `${OWNER_WORDS} ${CANARY}` };
    assert.notEqual(moved.request, item.request, 'plant: the value really did move');
    assert.equal(
      itemSummaryBasis(moved), before,
      'a field outside ContentShape cannot reach this hash in either direction',
    );
  } finally {
    box.dispose();
  }
});

/* -------------------------------------------------------------------------- *
 * 3. NEVER INJECTED, AND NEVER IN THE CHECKSUM.
 * -------------------------------------------------------------------------- */

test('a request reaches no injected surface and costs no budget', () => {
  const box = sandbox();
  try {
    const id = rule(box, { request: `${OWNER_WORDS} ${CANARY}` });
    const item = itemOf(box, id);
    assert.ok(item.request?.includes(CANARY), 'plant: the canary is on the item');

    const block = renderItemBlock(item);
    const line = renderIndexLine(item);
    assert.equal(
      block.includes(CANARY), false,
      'the owner\'s ruling, verbatim: "this property is for documentation only and should '
      + 'not be injected to the context"',
    );
    assert.equal(line.includes(CANARY), false);
    assert.ok(block.includes('Secrets in logs outlive'), 'non-vacuity: the block is a real one');

    const withoutRequest: Item = { ...item };
    delete withoutRequest.request;
    assert.equal(
      itemCost(item), itemCost(withoutRequest),
      'and therefore no tier\'s budget moves — a documentation field that quietly started '
      + 'costing injection tokens would be worse than no field at all',
    );
  } finally {
    box.dispose();
  }
});

test('the checksum is identical with the request, without it, and after it is cleared', () => {
  const box = sandbox();
  try {
    const id = rule(box, { request: OWNER_WORDS });
    const item = itemOf(box, id);
    assert.equal(item.request, OWNER_WORDS, 'plant');

    const cleared: Item = { ...item };
    delete cleared.request;
    assert.equal(
      computeItemChecksum(item), computeItemChecksum(cleared),
      'spec §16a requires the sweep to be reversible "without touching body, summary or '
      + 'checksum". A checksum that moved when the field was cleared would make the clear a '
      + 'second mass write rather than an undo',
    );
    assert.equal(
      computeItemChecksum(item), item.checksum,
      'non-vacuity: the recorded checksum is the one this function produces, so the equality '
      + 'above is about the real value on disk and not about two hashes of nothing',
    );
  } finally {
    box.dispose();
  }
});

test('the file on disk carries the request, and it is the only thing that changed', () => {
  // Two sandboxes, for the reason the basis test above gives.
  const plainBox = sandbox();
  const box = sandbox();
  try {
    const plain = fileOf(plainBox, rule(plainBox));
    const withText = fileOf(box, rule(box, { request: OWNER_WORDS }));

    assert.ok(withText.includes('## Request'), 'plant: the section is written');
    assert.ok(withText.includes(OWNER_WORDS), 'and the words are verbatim, not escaped');
    assert.equal(
      withText.split('\n## Request\n')[0], plain,
      'everything above the section — the frontmatter, the RECORDED CHECKSUM LINE and the '
      + 'body — is byte-identical: the request is added and nothing else is disturbed',
    );
  } finally {
    box.dispose();
    plainBox.dispose();
  }
});

/* -------------------------------------------------------------------------- *
 * 4. OPTIONAL, VERBATIM, AND REFUSED RATHER THAN REPAIRED.
 * -------------------------------------------------------------------------- */

test('an agent-origin item with no request is not a defect', () => {
  const box = sandbox();
  try {
    const id = createItem(box.ctx, {
      type: 'lesson',
      title: 'The retry storm was self-inflicted',
      body: 'Backoff was reset on every 5xx.',
      summary: 'A retry loop reset its own backoff and made an outage worse.',
      origin: 'agent',
    }).id;
    const item = itemOf(box, id);
    assert.equal(item.request, undefined);
    assert.equal(fileOf(box, id).includes('## Request'), false);
    assert.equal(
      summaryState(item), 'current',
      'nothing asks for a request, so nothing about its absence is reported anywhere',
    );
  } finally {
    box.dispose();
  }
});

test('omitted, empty and whitespace-only all store nothing', () => {
  for (const request of ['', '   ', '\n\n']) {
    const box = sandbox();
    try {
      const id = rule(box, { request });
      assert.equal(
        itemOf(box, id).request, undefined,
        `${JSON.stringify(request)} must store nothing — a request that silently vanished on `
        + 'the next read would be worse than one that was never recorded',
      );
      assert.equal(fileOf(box, id).includes('## Request'), false);
    } finally {
      box.dispose();
    }
  }
});

test('a request is stored EXACTLY as written, apostrophes and dashes untouched', () => {
  const box = sandbox();
  try {
    const id = rule(box, { request: `  ${OWNER_WORDS}  ` });
    assert.equal(
      itemOf(box, id).request, OWNER_WORDS,
      'the edges are trimmed because `splitSections` trims a section\'s separator blanks and '
      + 'a value that does not round-trip is not verbatim either — and NOTHING else moves',
    );
    assert.ok(
      fileOf(box, id).includes('it\'s own words — this'),
      'no escaping, no smart-quote rewriting, no reflow: the mess is the point',
    );
  } finally {
    box.dispose();
  }
});

test('a request carrying a Markdown heading is REFUSED, never repaired', () => {
  assert.throws(
    () => validateRequest('please do this\n## and then this\nand this'),
    /starts with a Markdown heading/,
    'splitSections would read that line as a new section and delete everything under it on '
    + 'the next write. The alternative — escaping it — stores something nobody typed',
  );
  assert.throws(() => validateRequest('# top'), /starts with a Markdown heading/);
  // Not a heading: `#2` has no space after the hash, and `splitSections`
  // anchors on `^#\s`. Refusing it would refuse content this format holds.
  assert.doesNotThrow(() => validateRequest('not in #2 the retry path'));
  assert.doesNotThrow(() => validateRequest('a plain\nmulti-line\nrequest'));
});

test('createItem itself refuses it, so nothing that lands can fail to round-trip', () => {
  const box = sandbox();
  try {
    assert.throws(
      () => rule(box, { request: 'do it\n## like this' }),
      /starts with a Markdown heading/,
      'INV-a-validator-that-gates-writes-must-be-a-complete: the guard is at the '
      + 'shared write boundary, not only at a surface',
    );
    assert.equal(
      box.ctx.store.get('RULE-do-not-log-customer-email'), null,
      'and nothing was written — the refusal is BEFORE the write, not a repair after it',
    );
  } finally {
    box.dispose();
  }
});
