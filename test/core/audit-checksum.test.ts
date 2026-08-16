/**
 * **The byte-identity trap, executed rather than asserted.**
 *
 * `docs/ROADMAP.md` D4.3 names it: an audit log that leaked into an item's
 * identity would break `files → DB → files` byte-identity, and a timestamp
 * defaulted during rebuild or repair would rewrite every file on every
 * rebuild — the exact failure `REQ-changes-are-timestamped-and-audited`'s own
 * observation warns about ("updated_at MUST NOT be stamped by writeItem").
 *
 * Nothing in `core/audit.ts` is imported by `item.ts`, `rebuild.ts` or
 * `cli/commands/repair.ts`, so the property holds by construction. These cases
 * prove it by execution anyway, because "by construction" is exactly the kind
 * of claim this project has found to be false nineteen times.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { recordAudit } from '../../src/core/audit.ts';
import { runCli } from '../../src/cli/index.ts';
import { computeItemChecksum } from '../../src/core/item.ts';
import { createItem } from '../../src/core/mutate.ts';
import { sandbox } from '../helpers/workspace.ts';

test('an item checksum does not depend on the audit log at all', () => {
  const box = sandbox();
  try {
    const { id, filePath } = createItem(box.ctx, {
      type: 'rule', title: 'A rule', body: 'Body.', origin: 'human',
    });
    const item = box.ctx.store.get(id)!;
    const before = computeItemChecksum(item);

    // Everything that could plausibly leak: more records, records ABOUT this
    // item, records of every kind.
    for (let i = 0; i < 50; i++) {
      recordAudit(box.root, { kind: 'mutation', op: 'update', origin: 'agent', itemId: id });
      recordAudit(box.root, {
        kind: 'injection', op: 'jit', sessionId: `s${i}`,
        injected: [{ id, tier: 'jit' }],
      });
    }

    assert.equal(computeItemChecksum(item), before);
    // …and the checksum the file itself carries is the one the item computes.
    const onDisk = readFileSync(path.join(box.root, filePath), 'utf8');
    assert.match(onDisk, new RegExp(`checksum: ${before}`));
  } finally { box.dispose(); }
});

test('a rebuild leaves every item file byte-identical, whatever the audit log holds', () => {
  const box = sandbox();
  try {
    const created = createItem(box.ctx, {
      type: 'rule', title: 'A rule', body: 'Body.', origin: 'human',
    });
    const file = path.join(box.root, created.filePath);
    const before = readFileSync(file, 'utf8');

    for (let i = 0; i < 20; i++) {
      recordAudit(box.root, {
        kind: 'mutation', op: 'update', origin: 'agent', itemId: created.id, fields: ['body'],
      });
    }

    assert.equal(runCli(['rebuild'], box.cwd, () => {}), 0);
    assert.equal(
      readFileSync(file, 'utf8'), before,
      'a rebuild rewrote the file — an audit record has leaked into item identity',
    );

    // Twice, because a stamp that defaults on the FIRST rebuild and then
    // stabilises would still pass a single-run check.
    assert.equal(runCli(['rebuild'], box.cwd, () => {}), 0);
    assert.equal(readFileSync(file, 'utf8'), before);
  } finally { box.dispose(); }
});

test('repair reports no checksum mismatch on items an audit log describes', () => {
  const box = sandbox();
  try {
    const created = createItem(box.ctx, {
      type: 'rule', title: 'A rule', body: 'Body.', origin: 'human',
    });
    recordAudit(box.root, {
      kind: 'mutation', op: 'create', origin: 'human', itemId: created.id,
    });

    let output = '';
    assert.equal(runCli(['repair'], box.cwd, (s) => { output += `${s}\n`; }), 0);
    assert.doesNotMatch(
      output, new RegExp(created.id),
      `repair proposed to rewrite ${created.id}, so something outside the item's own content ` +
      `is reaching its checksum`,
    );
    assert.match(output, /nothing to re-stamp/);
  } finally { box.dispose(); }
});

test('an unreadable audit log does not stop a rebuild — the corpus does not depend on it', () => {
  const box = sandbox();
  try {
    const created = createItem(box.ctx, {
      type: 'rule', title: 'A rule', body: 'Body.', origin: 'human',
    });
    const file = path.join(box.root, created.filePath);
    const before = readFileSync(file, 'utf8');

    // A log so damaged that `readAudit` refuses it outright.
    recordAudit(box.root, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'A-a' });
    writeFileSync(path.join(box.root, '.audit', 'audit.jsonl'), '{not json\n{also not\n', 'utf8');

    assert.equal(runCli(['rebuild'], box.cwd, () => {}), 0);
    assert.equal(readFileSync(file, 'utf8'), before);
  } finally { box.dispose(); }
});
