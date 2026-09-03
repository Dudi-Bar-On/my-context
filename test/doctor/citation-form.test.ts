/**
 * `checkCitationForm` — the only thing that counts bare `file:line` pointers
 * where they are written.
 *
 * `scripts/verify-citations.ts` deliberately does not walk `.my_context/`: it
 * resolves citations BY FRAGMENT, and a tree whose citations carry no fragment
 * is out of scope until they do. That leaves the corpus with a form nothing can
 * check, and normalising it once does not keep it — agents and the owner write
 * `file:line` constantly. So the form is stated in a corpus `standard`, which
 * is read before the writing, and counted here, which is where the claim that
 * the writing changed can be checked rather than believed.
 *
 * Two properties are what make the check survive contact with a real corpus,
 * and both are tested below. It reports ONE finding per item, because "this
 * item's citations are unresolvable" is one fact per item and a per-pointer
 * report buries `doctor` under prose. And it ignores a pointer whose file this
 * repository does not have, because `file.ts:123` written to DESCRIBE the form
 * is far more common than a citation of a file named `file.ts` — a check that
 * reports the example as the fault it documents earns itself a permanent
 * finding nobody can ever clear.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkCitationForm } from '../../src/doctor/checks.ts';
import { parseItem } from '../../src/core/item.ts';
import type { Item, Layer } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

function withRepo(fn: (repoRoot: string) => void): void {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-cite-'));
  try {
    mkdirSync(path.join(root, 'src'), { recursive: true });
    writeFileSync(path.join(root, 'src', 'select.ts'), 'export function select() {}\n', 'utf8');
    fn(root);
  } finally {
    removeTree(root);
  }
}

function item(id: string, body: string, layer: Layer = 'project'): Item {
  const rel = `items/note/${id}.md`;
  const text = `---\nid: ${id}\ntype: note\ntitle: ${id}\nstatus: active\n---\n\n# ${id}\n\n${body}\n`;
  return parseItem(text, rel, layer);
}

test('an item with no bare pointer produces no finding', () => {
  withRepo((root) => {
    const one = item('NOTE-ok', 'The selector lives in `select.ts` and is worth reading.');
    assert.deepEqual(checkCitationForm(root, [one]), []);
  });
});

test('a citation already written in the form is not reported', () => {
  withRepo((root) => {
    // The form itself: file, verbatim fragment, optional hint. No `file:line`
    // token appears in it, which is the whole reason the check can be blunt.
    const one = item('NOTE-form', 'It is at `select.ts` · `export function select(` · ~1.');
    assert.deepEqual(checkCitationForm(root, [one]), []);
  });
});

test('a bare pointer to a file this repo HAS is one note naming the pointer and the form', () => {
  withRepo((root) => {
    const one = item('NOTE-bare', 'The selector is at `select.ts:1`, which is where to look.');
    const findings = checkCitationForm(root, [one]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.code, 'citation_form');
    assert.equal(findings[0]!.level, 'info');
    assert.equal(findings[0]!.item, 'NOTE-bare');
    assert.match(findings[0]!.message, /select\.ts:1/);
    assert.match(findings[0]!.message, /VERBATIM fragment/);
  });
});

test('a pointer whose file this repo does not have is an EXAMPLE, not a fault', () => {
  withRepo((root) => {
    const one = item('NOTE-example', 'Never write `file.ts:123`; nothing can check it.');
    assert.deepEqual(checkCitationForm(root, [one]), []);
  });
});

test('many pointers in one item are ONE finding, counted, with the first three shown', () => {
  withRepo((root) => {
    const one = item(
      'NOTE-many',
      'See `select.ts:1`, `select.ts:2`, `src/select.ts:3-9` and `select.ts:4,8`.',
    );
    const findings = checkCitationForm(root, [one]);
    assert.equal(findings.length, 1);
    assert.match(findings[0]!.message, /^4 citation\(s\)/);
    assert.match(findings[0]!.message, /select\.ts:1, select\.ts:2, src\/select\.ts:3-9, …/);
  });
});

test('two items with bare pointers are two findings, each naming its own item', () => {
  withRepo((root) => {
    const findings = checkCitationForm(root, [
      item('NOTE-a', 'at `select.ts:1`'),
      item('NOTE-b', 'also at `select.ts:2`'),
    ]);
    assert.deepEqual(findings.map((f) => f.item), ['NOTE-a', 'NOTE-b']);
  });
});

test('an item that is not this project’s is not this project’s to fix', () => {
  withRepo((root) => {
    assert.deepEqual(checkCitationForm(root, [item('NOTE-g', 'at `select.ts:1`', 'global')]), []);
  });
});

/**
 * **The specimen marker: `<!-- historical-citation: why -->` inside an item
 * body.**
 *
 * Three items in this corpus hold sixteen bare pointers whose sentences are
 * ABOUT the pointer — a stale citation quoted so it can be named as stale, a
 * measured count, a doctor message reproduced verbatim. Converting one is not a
 * repair; it falsifies a quotation. So the item may say so on the line, with
 * the same marker `scripts/verify-citations.ts` already honours in plans, under
 * the same three rules: it must excuse something, it must be well formed, and
 * it may only excuse what this check would otherwise have reported.
 *
 * The assertion that matters most is the second one below. An exemption that
 * blinded the check would be worse than the findings it cleared, so a real bare
 * pointer on an unmarked line — in the same item, on the line after a marked
 * one — is still counted, by name.
 */
test('a marked pointer is excused, and the excusing is disclosed once', () => {
  withRepo((root) => {
    const one = item(
      'NOTE-mark',
      'The stale one was `select.ts:1`. <!-- historical-citation: the sentence names the ' +
        'pointer as stale; rewriting it would make the claim false -->',
    );
    const findings = checkCitationForm(root, [one]);
    assert.deepEqual(findings.map((f) => f.code), ['citation_form_excused']);
    const disclosure = findings[0]!;
    assert.equal(disclosure.level, 'info');
    assert.equal(disclosure.item, undefined);
    assert.deepEqual(disclosure.remedy, { route: 'none', why: 'nothing' });
    assert.match(
      disclosure.message,
      /^1 bare pointer\(s\) across 1 item\(s\) are excused as SPECIMENS/,
    );
  });
});

test('THE ASSERTION THAT MATTERS: an unmarked pointer beside a marked one still fires', () => {
  withRepo((root) => {
    const one = item(
      'NOTE-both',
      'Quoted: `select.ts:1` <!-- historical-citation: quoted as written, not claimed -->\n' +
        'And a real one: `select.ts:2`, which is a live pointer.',
    );
    const findings = checkCitationForm(root, [one]);
    const form = findings.filter((f) => f.code === 'citation_form');
    assert.equal(form.length, 1, 'the marker must not blind the check to the next line');
    assert.equal(form[0]!.item, 'NOTE-both');
    assert.match(form[0]!.message, /^1 citation\(s\)/);
    assert.match(form[0]!.message, /select\.ts:2/);
    assert.doesNotMatch(form[0]!.message, /select\.ts:1/);
    assert.equal(findings.filter((f) => f.code === 'citation_form_excused').length, 1);
  });
});

test('two pointers on one marked line are one marker and two excused spans', () => {
  withRepo((root) => {
    const one = item(
      'NOTE-two',
      'Both `select.ts:1` and `select.ts:2` are quoted. <!-- historical-citation: a measured ' +
        'count of what the corpus held, not a pointer to follow -->',
    );
    const findings = checkCitationForm(root, [one]);
    assert.deepEqual(findings.map((f) => f.code), ['citation_form_excused']);
    assert.match(findings[0]!.message, /^2 bare pointer\(s\) across 1 item\(s\)/);
  });
});

test('the excused count spans items and is still ONE line naming none of them', () => {
  withRepo((root) => {
    const findings = checkCitationForm(root, [
      item('NOTE-x', 'at `select.ts:1` <!-- historical-citation: quoted, not claimed -->'),
      item('NOTE-y', 'at `select.ts:2` <!-- historical-citation: quoted, not claimed -->'),
    ]);
    assert.deepEqual(findings.map((f) => f.code), ['citation_form_excused']);
    assert.match(findings[0]!.message, /^2 bare pointer\(s\) across 2 item\(s\)/);
  });
});

test('nothing excused draws no line at all', () => {
  withRepo((root) => {
    const findings = checkCitationForm(root, [item('NOTE-plain', 'at `select.ts:1`')]);
    assert.deepEqual(findings.map((f) => f.code), ['citation_form']);
  });
});

test('a marker with no reason is a finding, and its pointer is still counted', () => {
  withRepo((root) => {
    const one = item('NOTE-noreason', 'at `select.ts:1` <!-- historical-citation: -->');
    const findings = checkCitationForm(root, [one]);
    assert.deepEqual(findings.map((f) => f.code), ['citation_marker', 'citation_form']);
    assert.equal(findings[0]!.level, 'warn');
    assert.equal(findings[0]!.item, 'NOTE-noreason');
    assert.match(findings[0]!.message, /body line 1: malformed/);
    // Fails twice: the marker is named AND the pointer it did not excuse is.
    assert.match(findings[1]!.message, /select\.ts:1/);
  });
});

test('a misspelled or unterminated marker is malformed, not invisible', () => {
  withRepo((root) => {
    for (const bad of [
      '<!-- historical-citations: plural, so it is not the marker -->',
      '<!-- historical-citation the colon is missing -->',
      '<!-- historical-citation: the close is on the next line',
    ]) {
      const findings = checkCitationForm(root, [item('NOTE-bad', `at \`select.ts:1\` ${bad}`)]);
      assert.deepEqual(findings.map((f) => f.code), ['citation_marker', 'citation_form'], bad);
    }
  });
});

test('a marker on a line with no bare pointer does not silently pass', () => {
  withRepo((root) => {
    const one = item('NOTE-empty', 'Nothing is cited here. <!-- historical-citation: a reason -->');
    const findings = checkCitationForm(root, [one]);
    assert.deepEqual(findings.map((f) => f.code), ['citation_marker']);
    assert.match(findings[0]!.message, /body line 1: excuses nothing/);
  });
});

test('a marker cannot satisfy itself with a pointer written inside its own reason', () => {
  withRepo((root) => {
    const one = item('NOTE-self', 'Prose. <!-- historical-citation: about `select.ts:1` -->');
    const findings = checkCitationForm(root, [one]);
    assert.deepEqual(findings.map((f) => f.code), ['citation_marker']);
    assert.match(findings[0]!.message, /excuses nothing/);
  });
});

test('a marker over a pointer this repo does not have excuses nothing', () => {
  withRepo((root) => {
    // `file.ts:123` is already ignored as an EXAMPLE of the form, so there is
    // no finding for a marker to excuse and the marker is the fault.
    const one = item('NOTE-ex', 'Never write `file.ts:123`. <!-- historical-citation: a reason -->');
    const findings = checkCitationForm(root, [one]);
    assert.deepEqual(findings.map((f) => f.code), ['citation_marker']);
  });
});

test('a second marker on one line is a fault, and the first still excuses', () => {
  withRepo((root) => {
    const one = item(
      'NOTE-dup',
      'at `select.ts:1` <!-- historical-citation: quoted -->' +
        ' <!-- historical-citation: quoted again -->',
    );
    const findings = checkCitationForm(root, [one]);
    assert.deepEqual(findings.map((f) => f.code), ['citation_marker', 'citation_form_excused']);
    assert.match(findings[0]!.message, /a second marker on one line/);
  });
});

test('every marker fault in one item is ONE row, listing each by body line', () => {
  withRepo((root) => {
    const one = item(
      'NOTE-many-faults',
      'Prose. <!-- historical-citation: excuses nothing -->\n' +
        'at `select.ts:1` <!-- historical-citation -->',
    );
    const findings = checkCitationForm(root, [one]);
    assert.equal(findings.filter((f) => f.code === 'citation_marker').length, 1);
    const row = findings[0]!;
    assert.match(row.message, /^2 `historical-citation` marker\(s\)/);
    assert.match(row.message, /body line 1: excuses nothing/);
    assert.match(row.message, /body line 2: malformed/);
  });
});

test('the excused line is a DISCLOSURE — it names the check it is about, not an item', () => {
  withRepo((root) => {
    // `doctor.ts` routes anything carrying `about` out of the worklist and
    // under its own heading, so the reader is not handed a row that says
    // nothing is owed. Without this field the line would be counted as work.
    const one = item('NOTE-about', 'at `select.ts:1` <!-- historical-citation: quoted -->');
    const findings = checkCitationForm(root, [one]);
    assert.deepEqual(findings.map((f) => f.code), ['citation_form_excused']);
    assert.equal(findings[0]!.about, 'citation_form');
    assert.equal(findings[0]!.item, undefined);
  });
});

test('a marker fault is a FINDING, not a disclosure — a person repairs it', () => {
  withRepo((root) => {
    const one = item('NOTE-fault-is-work', 'at `select.ts:1` <!-- historical-citation -->');
    const findings = checkCitationForm(root, [one]);
    assert.equal(findings[0]!.code, 'citation_marker');
    assert.equal(findings[0]!.about, undefined);
  });
});
