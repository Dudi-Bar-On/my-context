// @basis TASK-status-report-drops-every-could-not-measure-disclosure-and, INV-nothing-is-dropped-silently
/**
 * **`status_report` must carry the same "what this check could not measure"
 * disclosures the `doctor` tool prints, in the same words.**
 *
 * `TASK-status-report-drops-every-could-not-measure-disclosure-and`: the tool
 * filters `isDoctorDisclosure` findings out of `real` (the array the health
 * counts are drawn from) and then never prints the filtered-out findings at
 * all — unlike the `doctor` tool, which prints them under a "notes about the
 * checks themselves" heading (src/mcp/tools.ts:1498-1506). Two tools on the
 * same surface answering the same question two different ways is exactly what
 * `INV-nothing-is-dropped-silently` forbids: a disclosure dropped is a fact
 * the corpus measured and then never showed anyone.
 *
 * The workspace below reuses the exact reproducer `test/cli/doctor-disclosures
 * .test.ts` already established for a real `isDoctorDisclosure`-true finding:
 * `checkCitationForm` (src/doctor/body-integrity.ts) emits `citation_form`
 * (a real finding) for a bare `file:line` pointer, and `citation_form_excused`
 * (`about: 'citation_form'`, a disclosure) for one marked with the
 * `historical-citation` marker as a quotation rather than a citation. The
 * marker is assembled by concatenation, not written out, for the same reason
 * that file gives: a real marker in this source would be read as a specimen
 * by the gate that walks the repository for it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { createRegistry } from '../../src/mcp/tools.ts';
import { removeTree } from '../helpers/tmp.ts';

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-status-disc-'));
  runCli(['init'], cwd, () => {});
  mkdirSync(path.join(cwd, 'src', 'db'), { recursive: true });
  writeFileSync(path.join(cwd, 'src', 'db', 'writer.ts'), 'export const x = 1;\n');
  return cwd;
}

function writeItem(cwd: string, id: string, body: string): void {
  const file = path.join(cwd, '.my_context', 'items', 'task', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    `---\nid: ${id}\ntype: task\ntitle: ${id}\nstatus: active\n---\n\n# ${id}\n\n${body}\n`,
    'utf8',
  );
}

/** The marker, assembled — see the header. */
const MARKER = `<!-- ${'historical'}-citation: quoted so it can be named as stale -->`;

const DEFECT_LINE = 'See `src/db/writer.ts:12` for the writer.';
const SPECIMEN_LINE = `The old note said \`src/db/writer.ts:34\`. ${MARKER}`;
const CLOSE = 'Nothing else is recorded here.';
const BODY_NOTED = `${DEFECT_LINE}\n\n${SPECIMEN_LINE}\n\n${CLOSE}\n`;

test('status_report prints the doctor-tool disclosure sentence and the disclosure code, and excludes it from the counts', () => {
  const cwd = project();
  try {
    writeItem(cwd, 'TASK-a', BODY_NOTED);
    const registry = createRegistry(cwd);
    const out = registry.call('status_report', {});

    // THE DISCLOSURE'S CODE must be printed somewhere in the report — today
    // it is filtered out of `real` and never printed at all.
    assert.match(out, /citation_form_excused/,
      'the disclosure `citation_form_excused` (about: "citation_form") must be printed, not ' +
      'silently dropped from the report');

    // THE SHARED SENTENCE: the same one the `doctor` tool prints at
    // src/mcp/tools.ts:1498-1506, so the two tools on this surface agree.
    assert.match(out, /notes about the checks themselves — what they could not measure, said once/);

    // THE REAL FINDINGS beside it still count, and the disclosure is not
    // among them — the health counts must not move when the disclosure is
    // printed.
    assert.match(out, /health: 0 error\(s\), 1 warning\(s\), 1 note\(s\)/,
      'the disclosure is not a finding: the health counts must still exclude it');
  } finally {
    removeTree(cwd);
  }
});
