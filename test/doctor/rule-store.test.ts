// @basis TASK-two-checks-route-their-only-disclosure-to-a-surface-nobody,
// INV-nothing-is-dropped-silently
/**
 * **`checkRuleStore` itself** — the three faults, branched, and the disclosure
 * shape they all carry. `TASK-two-checks-route-their-only-disclosure-to-a-surface-nobody`.
 *
 * The two SURFACES are held separately, because a check nobody calls is the
 * silence this item is about wearing a different hat:
 * `test/cli/doctor-rule-store.test.ts` drives `mycontext doctor --json` and the
 * text report, and `test/ui/read-model.test.ts` drives `/api/doctor`. What is
 * here is the check's own behaviour.
 *
 * **Every fixture is a store of its own under `MYCONTEXT_RULES_DIR`, never the
 * shipped one** — `KNOWN-running-the-test-suite-can-leave-the-shipped-rule-store`
 * measured what happens when a test damages `src/rules/entries` to make a point.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { partitionFindings, summarize } from '../../src/cli/commands/doctor.ts';
import { checkRuleStore, ruleStoreFindings } from '../../src/doctor/rule-store.ts';
import { RULES_DIR_ENV } from '../../src/rules/deliver.ts';
import { writeManifest } from '../../src/rules/manifest.ts';
import { removeTree } from '../helpers/tmp.ts';

const PRODUCT_ENTRY = [
  '---',
  'id: a-body-stops-at-the-first-heading',
  'kind: fact',
  'tier: product',
  'title: a body stops at the first ## heading',
  'truth: everything from the first `## ` heading onwards is dropped when a body is stored',
  'breaks: the tail of a body is lost with no error, and the write reports success',
  'example: the 2026-09-07 item whose Observations block vanished on save',
  'check: "preventive:the write path refuses a body carrying a ## heading"',
  '---',
  '',
  'True for anyone who installs the tool.',
  '',
].join('\n');

/** A throwaway corpus root that is not this package, so the reader tier is `product`. */
function stateRoot(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-rulestore-ws-'));
  const root = path.join(dir, '.my_context');
  mkdirSync(root, { recursive: true });
  return root;
}

/** A sound store of one product entry, sealed. */
function soundStore(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-rulestore-good-'));
  writeFileSync(path.join(dir, 'fact.md'), PRODUCT_ENTRY, 'utf8');
  writeManifest(dir);
  return dir;
}

function withStore<T>(dir: string, fn: () => T): T {
  const before = process.env[RULES_DIR_ENV];
  process.env[RULES_DIR_ENV] = dir;
  try { return fn(); } finally {
    if (before === undefined) delete process.env[RULES_DIR_ENV];
    else process.env[RULES_DIR_ENV] = before;
  }
}

/** The check, against a throwaway corpus root, with the doors pointed at `store`. */
function checkOver(store: string): ReturnType<typeof checkRuleStore> {
  const root = stateRoot();
  try {
    return withStore(store, () => checkRuleStore(root));
  } finally {
    removeTree(path.dirname(root));
  }
}

test('a sound store draws nothing, so the line is one a reader can clear', () => {
  const store = soundStore();
  try {
    assert.deepEqual(checkOver(store), []);
  } finally {
    removeTree(store);
  }
});

test('an unsealed store is an info disclosure, routed out of the counts and out of the worklist', () => {
  const store = soundStore();
  try {
    writeFileSync(path.join(store, 'manifest.json'), '{ this is not json', 'utf8');
    const findings = checkOver(store);
    assert.equal(findings.length, 1);
    const [f] = findings;
    assert.equal(f.code, 'rule_store_unverified');
    assert.equal(f.about, 'rule_store_unverified', 'self-routed, as `governing_spill_pressure` is');
    assert.equal(f.level, 'info');
    assert.equal(f.item, undefined, 'it names no corpus item, so there is nothing to acknowledge');
    assert.deepEqual(f.remedy, { route: 'copy', argv: ['mycontext', 'rules', 'verify'] },
      'the surface report 3 named is the remedy, not the only place the answer goes');
    assert.match(f.message, /manifest/);
    assert.match(f.message, /mycontext rules verify --restore/);

    // The property report 3 asked to be preserved, in as many words:
    // read-only, and not counted toward the exit code.
    const { findings: worklist, disclosures } = partitionFindings(findings);
    assert.deepEqual(worklist, []);
    assert.equal(disclosures.length, 1);
    assert.deepEqual(summarize(findings), { errors: 0, warnings: 0, infos: 0 });
  } finally {
    removeTree(store);
  }
});

test('a store nothing can load is disclosed as unloadable, and named as an UNCOUNTED zero', () => {
  const store = mkdtempSync(path.join(tmpdir(), 'myctx-rulestore-gone-'));
  try {
    // The directory the doors would read is not there — the exact state
    // `assertDoor`'s `catch { return 0 }` used to end at.
    const findings = checkOver(path.join(store, 'no-such-store'));
    assert.equal(findings.length, 1);
    assert.equal(findings[0].code, 'rule_store_unverified');
    assert.match(findings[0].message, /could NOT be read at all/);
    assert.match(findings[0].message, /UNCOUNTED zero/);
    assert.doesNotMatch(findings[0].message, /REFUSED/);
  } finally {
    removeTree(store);
  }
});

/**
 * **The `partial` fixture is a DUPLICATE ID, and it has to be**, which is worth
 * writing down because the obvious fixture cannot reach this branch.
 *
 * An unparseable entry is sealed by `writeManifest` with a `refused` row and no
 * checksum (B12), and `verifyManifest` reports such a row as damage on every
 * call — so a store with a broken entry is `unsealed` as well, and `unsealed`
 * wins. Two files claiming one id are different: both parse, both seal with
 * real checksums, the manifest verifies clean, and `loadRules` refuses the
 * second because *"an entry is cited by id, so two files answering to one id
 * means a citation resolves to whichever was read first"*. That is a store
 * intact by every seal and still delivering less than it holds — precisely the
 * silence this check is for.
 */
test('a store that loaded with one entry refused is disclosed as partial, never as unsealed', () => {
  const store = soundStore();
  try {
    writeFileSync(path.join(store, 'fact-again.md'), PRODUCT_ENTRY, 'utf8');
    writeManifest(store);
    const findings = checkOver(store);
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /REFUSED/,
      'an entry that governs nowhere is a different fact from a store nobody can read');
    assert.doesNotMatch(findings[0].message, /could NOT be read at all/);
    assert.doesNotMatch(findings[0].message, /sealed with it/,
      'the seal is intact here — reporting it as a seal failure would be the wrong sentence');
    assert.match(findings[0].message, /fact-again\.md/);
  } finally {
    removeTree(store);
  }
});

test('the check reads the store a DOOR would read, not the package it ships in', () => {
  // `store/8`: the doors delivering directory X while the surfaces answered
  // about the package's own is the defect `resolveStoreDir` exists to prevent,
  // and a diagnostic answering about a third directory would be the same
  // defect wearing a diagnostic's clothes.
  const store = soundStore();
  try {
    writeFileSync(path.join(store, 'manifest.json'), '{ this is not json', 'utf8');
    const findings = checkOver(store);
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, new RegExp(path.basename(store)),
      'the message names the substituted store, not src/rules/entries');
    assert.doesNotMatch(findings[0].message, /\\/, 'INV-posix-normalized-paths: never a backslash');
  } finally {
    removeTree(store);
  }
});

test('ruleStoreFindings is what both surfaces call, and it agrees with the check', () => {
  const store = soundStore();
  try {
    writeFileSync(path.join(store, 'manifest.json'), '{ this is not json', 'utf8');
    const root = stateRoot();
    try {
      withStore(store, () => {
        assert.deepEqual(ruleStoreFindings(root), checkRuleStore(root),
          'the wrapper adds a catch and nothing else; two answers here would be two surfaces '
          + 'disagreeing about one install');
      });
    } finally {
      removeTree(path.dirname(root));
    }
  } finally {
    removeTree(store);
  }
});
