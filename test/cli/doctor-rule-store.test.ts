// @basis TASK-two-checks-route-their-only-disclosure-to-a-surface-nobody,
// INV-nothing-is-dropped-silently
/**
 * **`mycontext doctor` says when the product rule store cannot be verified** —
 * `TASK-two-checks-route-their-only-disclosure-to-a-surface-nobody`, the
 * `assertDoor` half, on the surface a person is actually on.
 *
 * Report 3's P5: the attribution argument behind `assertDoor`'s
 * `catch { return 0 }` is sound, and *"the routing sends the only disclosure to
 * a command that runs on nobody's schedule"*. `mycontext rules verify` is still
 * that command and is still this finding's remedy; what these tests pin is that
 * a `doctor` run no longer shows nothing at all.
 *
 * **Every fixture is a store of its own under `MYCONTEXT_RULES_DIR`, never the
 * shipped one** — `KNOWN-running-the-test-suite-can-leave-the-shipped-rule-store`
 * measured what happens when a test damages `src/rules/entries` to make a
 * point.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
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

interface DoctorJson {
  counts: { errors: number; warnings: number; infos: number };
  exitCode: number;
  findings: { code: string; about?: string }[];
  disclosures: { code: string; about?: string; level: string; message: string; remedy: unknown }[];
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-cli-rulestore-'));
  runCli(['init'], cwd, () => {});
  mkdirSync(path.join(cwd, 'src', 'db'), { recursive: true });
  writeFileSync(path.join(cwd, 'src', 'db', 'writer.ts'), 'export const x = 1;\n');
  return cwd;
}

/** A sound store of one product entry, sealed. */
function soundStore(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-cli-rulestore-good-'));
  writeFileSync(path.join(dir, 'fact.md'), PRODUCT_ENTRY, 'utf8');
  writeManifest(dir);
  return dir;
}

/** `mycontext doctor --json` with the doors pointed at `store`. */
function doctorJson(store: string): DoctorJson {
  const cwd = project();
  const before = process.env[RULES_DIR_ENV];
  process.env[RULES_DIR_ENV] = store;
  let out = '';
  try {
    runCli(['doctor', '--json'], cwd, (s) => { out += `${s}\n`; });
    return JSON.parse(out) as DoctorJson;
  } finally {
    if (before === undefined) delete process.env[RULES_DIR_ENV];
    else process.env[RULES_DIR_ENV] = before;
    removeTree(cwd);
  }
}

test('doctor --json discloses a rule store whose manifest is corrupt', () => {
  const store = soundStore();
  try {
    // The plant: the seal is unreadable, so nothing can say the entries are
    // the ones that shipped. `loadRules` still reads the entry, so the DOOR
    // counts 1 and has nothing to report — the attribution argument, intact.
    writeFileSync(path.join(store, 'manifest.json'), '{ this is not json', 'utf8');

    const body = doctorJson(store);
    const disclosure = body.disclosures.find((d) => d.code === 'rule_store_unverified');
    assert.ok(disclosure, 'a doctor run over a store nothing can verify must not show nothing at all');
    assert.equal(disclosure!.level, 'info');
    assert.equal(disclosure!.about, 'rule_store_unverified', 'self-routed, as governing_spill_pressure is');
    assert.deepEqual(disclosure!.remedy, { route: 'copy', argv: ['mycontext', 'rules', 'verify'] },
      'the command report 3 named is offered, and it is one the reader can actually run');
    assert.match(disclosure!.message, /manifest/);

    // Every property report 3 asked to be preserved: it is not in the
    // worklist, not in the counts, and not in the exit code.
    assert.equal(body.findings.some((f) => f.code === 'rule_store_unverified'), false);
    assert.equal(body.exitCode, 0);
  } finally {
    removeTree(store);
  }
});

test('doctor --json discloses a store no door could read, as an UNCOUNTED zero', () => {
  const store = soundStore();
  try {
    const body = doctorJson(path.join(store, 'no-such-store'));
    const disclosure = body.disclosures.find((d) => d.code === 'rule_store_unverified');
    assert.ok(disclosure);
    assert.match(disclosure!.message, /could NOT be read at all/);
    assert.match(disclosure!.message, /UNCOUNTED zero/,
      'a door that could not look must not be reported as a door that found nothing');
    assert.equal(body.exitCode, 0);
  } finally {
    removeTree(store);
  }
});

test('doctor --json says nothing about a sound store, so the line can be cleared', () => {
  const store = soundStore();
  try {
    const body = doctorJson(store);
    assert.equal(body.disclosures.some((d) => d.code === 'rule_store_unverified'), false,
      'a check that draws a line on a healthy install is a line nobody can clear');
    // Non-vacuity: the same call really did produce a doctor document.
    assert.ok(Array.isArray(body.findings));
    assert.ok(Array.isArray(body.disclosures));
  } finally {
    removeTree(store);
  }
});

test('the text report prints it too, under its own heading and after the summary', () => {
  const store = soundStore();
  try {
    writeFileSync(path.join(store, 'manifest.json'), '{ this is not json', 'utf8');
    const cwd = project();
    const before = process.env[RULES_DIR_ENV];
    process.env[RULES_DIR_ENV] = store;
    let out = '';
    try {
      const code = runCli(['doctor'], cwd, (s) => { out += `${s}\n`; });
      assert.equal(code, 0, 'a disclosure about the INSTALL must not fail the corpus');
    } finally {
      if (before === undefined) delete process.env[RULES_DIR_ENV];
      else process.env[RULES_DIR_ENV] = before;
      removeTree(cwd);
    }
    assert.match(out, /rule_store_unverified — about the `rule_store_unverified` check/);
    assert.match(out, /mycontext rules verify/);
  } finally {
    removeTree(store);
  }
});
