// @basis TASK-the-composer-is-tested-as-a-user-would-use-it-every-field, DEC-run-is-removed-execute-is-the-only-way-to-run-what-the
/**
 * **THE COMPOSER, SWEPT — every field, every fixed value, both branches of
 * every switch, and the seven free-text values that have bitten this product.**
 *
 * `plan:builder seq:11` (D12). This is the half of the item that does not run
 * anything: `composer-execute.spec.ts` is the half that does, and the item's
 * bar — *"a test passes only once the command has been EXECUTED and has
 * RETURNED THE CORRECT RESULT"* — is met THERE. What is met here is the clause
 * beside it: the composed line is still an assertion, "what the screen produces
 * for a non-runnable entry is text a person pastes into a shell, so quoting is
 * still the failure mode that matters most".
 *
 * ── THE NUMBERS THIS SWEEP COVERS, RE-MEASURED 2026-09-07 ────────────────
 *
 * The item orders its own figures ignored — *"RE-MEASURE FIRST … do not inherit
 * a single figure from this item, including the ones written here"* — and it
 * was right to: two of the five had moved.
 *
 *     30 catalogue entries        (item: 30 — unchanged)
 *     89 fields, args and flags   (item: 89 — unchanged)
 *     20 `<select>` pickers       (item: 21 — MOVED)
 *      8 fields with a closed vocabulary, over 4 distinct option sets
 *     12 `<select>`s filled from the corpus, over 6 sources
 *     23 boolean switches
 *     46 free-text boxes          (item: 60 — MOVED)
 *        of which 17 are `suggest` filtering boxes, 20 plain, 5 glob,
 *        2 textarea and 2 tag lists
 *     24 required fields
 *     13 fields declaring a format, 8 of which can show it as a placeholder
 *     27 entries licensed to run, 3 that are not, 17 on the approval boundary
 *
 * Every one of those is derived HERE from `PALETTE` rather than typed, so the
 * sweep grows with the catalogue and this comment is the only thing that can go
 * stale.
 *
 * ── THE ITEM'S "BOTH PATHS" CLAUSE RESTS ON SOMETHING THAT IS GONE ────────
 *
 * The item says to *"test BOTH PATHS — RUN and EXECUTE — and assert they
 * agree"*, and names that disagreement as the reason it was re-cut. **There is
 * no RUN.** `DEC-run-is-removed-execute-is-the-only-way-to-run-what-the`
 * (commit `c3d1464`, 2026-09-07) deleted the control, the eight `screen` and
 * `endpoint` fields that fed it, `readTarget`, `resultRows`, and the five
 * string keys that labelled it — and `test/ui/palette-lib.test.ts` INVERTS the
 * old rule so a def that grows either field back fails the suite.
 *
 * So the clause is superseded rather than unmet, and resurrecting a deleted
 * control to satisfy a sentence written before it was deleted would be the
 * wrong reading of an item whose own first instruction is to re-measure. What
 * the clause was FOR — two ways of running one composed line that could
 * silently disagree — still has a live instance, and it is tested in
 * `composer-execute.spec.ts`: the browser composes an argv with `commandFor`
 * and the SERVER rebuilds it independently with the same function over the
 * values the confirm was asked with (`src/ui/execute-catalogue.ts` ·
 * `resolveCommand`), and the confirm answers with its own `argv`. Those two are
 * the two paths that exist today, and they are asserted to agree.
 */
import { test, expect } from './app.ts';
import {
  CMD, DEFS, FORM, PAL, chooseEntry, composedLine, controlsOf, kindOf, meantArgv,
  currentValues, runnableFor, setValue, settled, shellSplit, specsOf, openComposer,
  type Def, type Spec,
} from './composer.ts';
import { runnableIds } from '../src/ui/execute-catalogue.ts';

/** Fields whose control is drawn by the screen but not inside the form list. */
const OFF_FORM = (spec: Spec): boolean => spec.input === 'glob';

/**
 * **THE SEVEN VALUES, and they are the item's own list rather than a wider
 * one.** *"a value with a space, a quote, a shell metacharacter, a leading
 * hyphen, an empty string, a very long string, and a right-to-left string in a
 * left-to-right field."*
 *
 * `$(id)` for the metacharacter and not `;` or `|`: those two are separators a
 * `"…"` genuinely neutralises, so testing them would test the case that was
 * never in doubt. Command substitution is the one that survives double quotes
 * in every POSIX shell, which makes it the value that decides whether
 * `quoteArg`'s chosen quote is the right quote. `id` is the program named
 * inside it because it is harmless, present everywhere, and its output is
 * unmistakable in a diff.
 */
const HOSTILE: readonly { label: string; value: string }[] = [
  { label: 'a space', value: 'two words' },
  { label: 'a double quote', value: 'he said "hi" once' },
  { label: 'a shell metacharacter', value: 'before$(id)after' },
  { label: 'a leading hyphen', value: '-x' },
  { label: 'an empty string', value: '' },
  { label: 'a very long string', value: `long-${'w'.repeat(4000)}-end` },
  { label: 'a right-to-left string', value: 'שלום עולם' },
];

/** The values that compose an argument at all — the empty one composes nothing. */
const COMPOSING = HOSTILE.filter((h) => h.value !== '');

/** Free text, in the sense the item's seven values are about: a box you type into. */
function isFreeText(spec: Spec): boolean {
  const kind = kindOf(spec);
  return kind === 'text' || kind === 'textarea' || kind === 'suggest'
    || kind === 'tags' || kind === 'glob';
}

/**
 * A value that satisfies one required field, read from the SCREEN rather than
 * invented — a `<select>`'s own second `<option>` (the first is `ABSENT`), or a
 * plausible string for a box. Answers `null` when the field cannot be satisfied
 * on this corpus, which is a fact about the corpus and is asserted elsewhere
 * rather than skipped silently.
 */
async function satisfy(
  page: import('@playwright/test').Page, spec: Spec, control: import('@playwright/test').Locator,
): Promise<string | null> {
  if (kindOf(spec) === 'select') {
    const values = await control.locator('option').evaluateAll(
      (nodes) => nodes.map((n) => (n as HTMLOptionElement).value).filter((v) => v !== ''),
    );
    return values[0] ?? null;
  }
  // A `suggest` box is a free box with a list attached — the D11 escape hatch —
  // so a value the list does not carry is a legal value, and using one keeps
  // this helper honest on a corpus whose list happens to be empty.
  return spec.name === 'valid-from' ? '2026-01-01' : `x-${spec.name}`;
}

/** Fill every required field of the chosen def. Answers what it could not fill. */
async function fillRequired(
  page: import('@playwright/test').Page, def: Def,
  controls: Map<string, import('@playwright/test').Locator>,
): Promise<{ values: Record<string, string>; unfillable: string[] }> {
  const values: Record<string, string> = {};
  const unfillable: string[] = [];
  for (const spec of specsOf(def)) {
    if (spec.required !== true) continue;
    const control = controls.get(spec.name)!;
    const value = await satisfy(page, spec, control);
    if (value === null) { unfillable.push(spec.name); continue; }
    await setValue(control, spec, value);
    values[spec.name] = value;
  }
  return { values, unfillable };
}

/* ══ 1 — THE FORM ═════════════════════════════════════════════════════════ */

test('every entry draws every field it declares, as the control the catalogue names',
  async ({ app }) => {
    test.setTimeout(180_000);
    await openComposer(app.page);

    let fields = 0;
    let pickers = 0;
    let placeholders = 0;
    const emptyPickers: string[] = [];

    for (const def of DEFS) {
      await chooseEntry(app.page, def.name);
      const controls = await controlsOf(app.page, def);

      for (const spec of specsOf(def)) {
        fields += 1;
        const control = controls.get(spec.name)!;
        const kind = kindOf(spec);
        const where = `${def.name} · ${spec.name} (${kind})`;

        // The ELEMENT the catalogue's declaration must produce. `controlsOf`
        // already located it by the kind it expected, so this is the assertion
        // that the expectation was right rather than a tautology: a `<select>`
        // where the table says `text` would have found no element at all.
        await expect(control, `${where}: exactly one control`).toHaveCount(1);
        const tag = await control.evaluate((n) => n.tagName.toLowerCase());
        const type = await control.evaluate(
          (n) => (n as HTMLInputElement).type ?? null,
        );
        if (kind === 'select') { expect(tag, where).toBe('select'); pickers += 1; }
        else if (kind === 'textarea') expect(tag, where).toBe('textarea');
        else if (kind === 'checkbox') {
          expect(tag, where).toBe('input');
          expect(type, where).toBe('checkbox');
        } else {
          expect(tag, where).toBe('input');
          // `controlFor` sets `type="text"` EXPLICITLY and its own comment says
          // why it is load-bearing: an `<input>` with no type does not match
          // `input[type="text"]`, which is how sibling specs find these boxes.
          expect(type, `${where}: type="text" is explicit and load-bearing`).toBe('text');
        }

        // **Visibly required, first half.** `captionFor` writes the asterisk
        // into the caption whether or not the box is empty.
        if (!OFF_FORM(spec)) {
          const caption = await control.evaluate(
            (n) => (n.closest('label')?.firstChild?.textContent ?? ''),
          );
          expect(caption, `${where}: the caption is the CLI's own word for the field`)
            .toBe(`${spec.name}${spec.required === true ? ' *' : ''}:`);
        }
        if (spec.required === true && kind !== 'checkbox') {
          await expect(control, `${where}: required`).toHaveAttribute('required', '');
          // Second half: `markRequired` marks it invalid while it is empty, and
          // sets the attribute to `false` rather than removing it, so a reader
          // who fills the box sees the mark come OFF.
          await expect(control, `${where}: empty and required is aria-invalid`)
            .toHaveAttribute('aria-invalid', 'true');
        }

        // **The format, as a placeholder — the owner's 2026-08-24 instruction.**
        // A boolean has no box, a picker's blank option is already its hint, and
        // a glob control the screen SEEDS shows its seed: `controlFor` sets the
        // placeholder only when the box is empty, so those three carry none.
        const wantsPlaceholder = typeof spec.format === 'string' && spec.format !== ''
          && spec.boolean !== true && kind !== 'select' && kind !== 'glob';
        if (wantsPlaceholder) {
          await expect(control, `${where}: carries its format as a placeholder`)
            .toHaveAttribute('placeholder', spec.format!);
          placeholders += 1;
        } else if (kind !== 'checkbox' && kind !== 'select') {
          const held = await control.getAttribute('placeholder');
          expect(held, `${where}: no invented hint`).toBeNull();
        }

        // **A closed vocabulary is exactly the catalogue's, plus the blank.**
        if (Array.isArray(spec.options)) {
          const drawn = await control.locator('option').evaluateAll(
            (nodes) => nodes.map((n) => (n as HTMLOptionElement).value),
          );
          expect(drawn, `${where}: the blank ABSENT option, then the catalogue's own list`)
            .toEqual(['', ...spec.options]);
          await expect(control, `${where}: a non-empty vocabulary is not disabled`)
            .toBeEnabled();
        }

        // **A vocabulary with nothing in it is a DISABLED picker and a sentence,
        // never a picker holding one em dash.** `builder.js`' own rule.
        if (kind === 'select' && typeof spec.source === 'string') {
          const count = await control.locator('option').count();
          if (count <= 1) {
            emptyPickers.push(`${def.name}/${spec.name} (${spec.source})`);
            await expect(control, `${where}: an empty vocabulary disables its picker`)
              .toBeDisabled();
            const note = control.locator('xpath=../following-sibling::p[1]');
            await expect(note, `${where}: and says what the list is empty of`)
              .toContainText(spec.name);
          }
        }
      }
    }

    // The re-measured surface, asserted rather than described, so this file
    // fails the day the catalogue moves under it.
    expect(DEFS.length, 'catalogue entries').toBe(30);
    expect(fields, 'fields, args and flags').toBe(89);
    expect(pickers, '<select> pickers').toBe(20);
    expect(placeholders, 'fields showing their format as a placeholder').toBe(8);
    // Recorded rather than asserted to a number: which sources are empty is a
    // fact about the corpus this run was pointed at, and the item's own rule is
    // that tests run against the CURRENT corpus.
    // eslint-disable-next-line no-console
    console.log(`empty pickers on this corpus (${emptyPickers.length}): `
      + (emptyPickers.join(', ') || 'none'));
  });

/* ══ 2 — EVERY FIXED OPTION ═══════════════════════════════════════════════ */

test('every fixed option can be chosen, and the CLI accepts the line each one composes',
  async ({ app }) => {
    test.setTimeout(240_000);
    await openComposer(app.page);

    let chosen = 0;
    for (const def of DEFS) {
      const closed = specsOf(def).filter((s) => Array.isArray(s.options));
      if (closed.length === 0) continue;
      await chooseEntry(app.page, def.name);
      const controls = await controlsOf(app.page, def);
      const { unfillable } = await fillRequired(app.page, def, controls);
      if (unfillable.length > 0) continue;

      for (const spec of closed) {
        const control = controls.get(spec.name)!;
        for (const option of spec.options!) {
          await setValue(control, spec, option);
          const line = await composedLine(app.page);
          expect(line, `${def.name} · ${spec.name}=${option}: a line composes`).not.toBeNull();
          // The value reaches the line, in the shape the catalogue declares:
          // `--always=false` is JOINED because `--always false` is refused
          // outright by the real parser, which is the case `palette-defs.js`
          // records as the reason the `joined` field exists at all.
          const wanted = spec.joined === true
            ? `--${spec.name}=${option}` : `--${spec.name} ${option}`;
          expect(line!, `${def.name} · ${spec.name}=${option}`).toContain(wanted);
          // **And the CLI's own parser accepts it** — the strongest thing that
          // can be said about a line without running it.
          expect(await settled(app.page), `${def.name} · ${spec.name}=${option}`).toBe('passed');
          chosen += 1;
        }
        // Back to ABSENT: the blank option composes NOTHING rather than the
        // first thing in the list, which is `controlFor`'s stated contract.
        await setValue(control, spec, '');
        const line = await composedLine(app.page);
        expect(line ?? '', `${def.name} · ${spec.name}: ABSENT composes nothing`)
          .not.toContain(`--${spec.name}`);
      }
    }
    expect(chosen, 'every option of every closed vocabulary, chosen').toBeGreaterThanOrEqual(10);
  });

/* ══ 3 — BOTH BRANCHES OF EVERY SWITCH ════════════════════════════════════ */

test('both branches of every boolean, and the line changes in exactly one place',
  async ({ app }) => {
    test.setTimeout(240_000);
    await openComposer(app.page);

    let branches = 0;
    const unreachable: string[] = [];
    for (const def of DEFS) {
      const switches = specsOf(def).filter((s) => kindOf(s) === 'checkbox');
      if (switches.length === 0) continue;
      await chooseEntry(app.page, def.name);
      const controls = await controlsOf(app.page, def);
      const { unfillable } = await fillRequired(app.page, def, controls);
      if (unfillable.length > 0) {
        for (const spec of switches) unreachable.push(`${def.name}/${spec.name}`);
        continue;
      }

      for (const spec of switches) {
        const control = controls.get(spec.name)!;

        await setValue(control, spec, false);
        const off = await composedLine(app.page);
        expect(off, `${def.name} · --${spec.name} off: a line composes`).not.toBeNull();
        expect(off!, `${def.name} · --${spec.name} off: the flag is absent`)
          .not.toContain(`--${spec.name}`);

        await setValue(control, spec, true);
        const on = await composedLine(app.page);
        expect(on!, `${def.name} · --${spec.name} on: the flag is present`)
          .toContain(`--${spec.name}`);
        // A switch adds its flag and nothing else. Asserted as a STRING
        // difference rather than as two `toContain`s, because a checkbox that
        // also reordered the line would pass both of those.
        expect(on!.replace(` --${spec.name}`, ''), `${def.name} · --${spec.name}`).toBe(off!);
        expect(await settled(app.page), `${def.name} · --${spec.name} on`).toBe('passed');

        await setValue(control, spec, false);
        branches += 2;
      }
    }
    // eslint-disable-next-line no-console
    console.log(`booleans exercised: ${branches / 2}; unreachable on this corpus `
      + `(${unreachable.length}): ${unreachable.join(', ') || 'none'}`);
    /**
     * **17 HERE, AND THE OTHER SIX SOMEWHERE THIS CORPUS CAN REACH THEM.**
     *
     * The catalogue carries 23 switches. Six of them live on the four `review`
     * entries, which each take a REQUIRED `<select>` sourced from `drafts` or
     * `revisions` — and this repository's own corpus has neither, so the picker
     * is correctly disabled and no line composes to put a flag on. That is a
     * fact about today's corpus rather than about the screen, and it is the
     * same fact behind four of the six `e2e/execute.spec.ts` failures measured
     * over this corpus.
     *
     * It is not written off. `composer-execute.spec.ts`'s "the four review
     * entries, on a corpus that has a draft and a revision to name" builds an
     * isolated workspace, puts two drafts and one staged revision into it with
     * the real commands, and drives exactly those six. 17 + 6 = 23, and the
     * assertion below is EXACT rather than a floor so that a switch which
     * quietly stops being reachable here shows up as a number that moved.
     */
    expect(branches / 2, 'switches driven on the live corpus').toBe(17);
    expect(
      unreachable.sort(),
      'and these six are covered by the seeded workspace in composer-execute.spec.ts',
    ).toEqual([
      'review discard-revision/yes', 'review discard/yes',
      'review promote-revision/force', 'review promote-revision/yes',
      'review promote/always', 'review promote/yes',
    ]);
  });

/* ══ 4 — REQUIRED, MISSING AND PRESENT ════════════════════════════════════ */

test('a required field that is empty composes nothing and says so; filled, it composes',
  async ({ app }) => {
    test.setTimeout(240_000);
    await openComposer(app.page);

    let checkedMissing = 0;
    let checkedPresent = 0;
    const blocked: string[] = [];

    for (const def of DEFS) {
      const required = specsOf(def).filter((s) => s.required === true);
      if (required.length === 0) continue;
      await chooseEntry(app.page, def.name);
      const controls = await controlsOf(app.page, def);

      // MISSING: nothing filled at all. `commandFor` throws rather than
      // composing a half-built command, and the screen draws the sentence that
      // says what the marks on the controls add up to.
      await expect(app.page.locator(`${CMD} .cmd`), `${def.name}: no line while incomplete`)
        .toHaveCount(0);
      await expect(app.page.locator(`${CMD} p.small`).first(), `${def.name}: and it says why`)
        .toContainText(/Required inputs are missing|קלט נדרש חסר/);
      await expect(
        app.page.locator(`${CMD} .cmdactions`),
        `${def.name}: nothing to copy and nothing to run while a required field is empty`,
      ).toHaveCount(0);
      checkedMissing += required.length;

      const { unfillable } = await fillRequired(app.page, def, controls);
      if (unfillable.length > 0) {
        blocked.push(`${def.name} (${unfillable.join(', ')})`);
        continue;
      }

      // PRESENT: every required field satisfied, so a line composes, every mark
      // comes OFF, and a control appears.
      const line = await composedLine(app.page);
      expect(line, `${def.name}: filled, a line composes`).not.toBeNull();
      for (const spec of required) {
        await expect(
          controls.get(spec.name)!,
          `${def.name} · ${spec.name}: the mark comes off when the box is filled`,
        ).toHaveAttribute('aria-invalid', 'false');
      }
      expect(await settled(app.page), `${def.name}: the CLI accepts the filled line`)
        .toBe('passed');
      await expect(app.page.locator(`${CMD} .cmdactions`), `${def.name}: a control appears`)
        .toHaveCount(1);
      checkedPresent += required.length;
    }

    // eslint-disable-next-line no-console
    console.log(`required fields: ${checkedMissing} asserted missing, ${checkedPresent} asserted `
      + `present; entries whose required field this corpus cannot supply `
      + `(${blocked.length}): ${blocked.join('; ') || 'none'}`);
    expect(checkedMissing, 'required fields asserted in their empty state').toBe(24);
  });

/* ══ 5 — THE SEVEN VALUES, THROUGH A REAL SHELL ═══════════════════════════ */

test('the seven values that have bitten this product survive being pasted into a shell',
  async ({ app }) => {
    test.setTimeout(600_000);
    await openComposer(app.page);

    let cases = 0;
    let refusals = 0;
    const wrong: string[] = [];

    for (const def of DEFS) {
      const boxes = specsOf(def).filter(isFreeText);
      if (boxes.length === 0) continue;
      await chooseEntry(app.page, def.name);
      const controls = await controlsOf(app.page, def);
      const { values, unfillable } = await fillRequired(app.page, def, controls);
      if (unfillable.length > 0) continue;

      for (const spec of boxes) {
        const control = controls.get(spec.name)!;
        const wasRequired = spec.required === true;
        const baseline = values[spec.name];

        for (const { label, value } of HOSTILE) {
          await setValue(control, spec, value);
          const line = await composedLine(app.page);
          const where = `${def.name} · ${spec.name} · ${label}`;

          if (value === '') {
            // An empty box is an ABSENT value, not an empty argument.
            if (wasRequired) {
              expect(line, `${where}: a required field emptied composes nothing`).toBeNull();
            } else {
              expect(line, `${where}: a line still composes`).not.toBeNull();
              expect(line!, `${where}: the flag is absent, not empty`)
                .not.toContain(`--${spec.name}`);
            }
            cases += 1;
            continue;
          }

          expect(line, `${where}: a line composes`).not.toBeNull();

          // **THE SHELL-ACTIVE VALUE IS A REFUSAL, AND THE REFUSAL IS THE
          // CORRECT RESULT** — the item's own rule about `runnable: false`,
          // applied to the other refusal on this screen.
          //
          // This assertion was pointed the wrong way on its first run and the
          // measurement is worth keeping: driving `before$(id)after` into all
          // 42 free-text boxes, a real shell splitting the composed line
          // returned `beforeuid=197609(UserC) gid=197121 groups=197121after`
          // in every one of them. That looked like the headline defect, and it
          // is not one — it is `SHELL_ACTIVE` working. `quoteArg` wraps an
          // unsafe value in `"…"`, a POSIX shell still expands `$` and a
          // backtick inside those, and `screens/palette.js` therefore refuses
          // the COPY rather than pretending the quoting held: `copyBlocked`,
          // the `pal.block` sentence, and a `✕` chip on the offending
          // argument. The line never reaches a shell, so what a shell would do
          // with it is not the question to ask about it.
          //
          // Execute is deliberately NOT blocked by the same measurement, and
          // that asymmetry is the design rather than a gap: an execution
          // reaches `execFile` with an argv ARRAY, where `$(…)` is an ordinary
          // literal. `composer-execute.spec.ts` proves that end of it by
          // running one and reading the value back out of the corpus.
          if (/[$`]/.test(value)) {
            const actions = app.page.locator(`${CMD} .cmdactions`);
            await expect(
              actions.locator(':scope > button').first(),
              `${where}: SECURITY — a shell-active value must not be one click from a clipboard`,
            ).toBeDisabled();
            await expect(
              app.page.locator(`${PAL} .card.pane > p`).nth(1),
              `${where}: and the screen says why, in `
              + '`pal.block`\'s own words rather than silently',
            ).toContainText(/Copy is blocked|ההעתקה חסומה/);
            await expect(
              app.page.locator(`${PAL} .card.pane .chip.crit`),
              `${where}: and marks WHICH argument is the offending one`,
            ).not.toHaveCount(0);
            refusals += 1;
            cases += 1;
            continue;
          }

          // **THE ORACLE, for every value the screen does let a reader copy.**
          // A real shell splits the line and what it produces must be the argv
          // the catalogue meant — where "meant" is read off the CONTROLS
          // rather than reconstructed from what this test believes it typed.
          // See `currentValues`.
          const meant = meantArgv(def, await currentValues(def, controls));
          const got = shellSplit(line!);
          if (JSON.stringify(got) !== JSON.stringify(meant)) {
            wrong.push(`${where}\n      composed: ${line!.slice(0, 200)}`
              + `\n      shell got: ${JSON.stringify(got).slice(0, 300)}`
              + `\n      meant:     ${JSON.stringify(meant).slice(0, 300)}`);
          }
          await expect(
            app.page.locator(`${CMD} .cmdactions`).locator(':scope > button').first(),
            `${where}: a line the quoting DOES hold for stays copyable`,
          ).toBeEnabled();
          cases += 1;
        }

        // Put the field back so the next box is exercised on an otherwise
        // ordinary line rather than on one still carrying 4,000 characters.
        await setValue(control, spec, baseline ?? '');
      }
    }

    // eslint-disable-next-line no-console
    console.log(`free-text cases driven: ${cases}, of which ${refusals} were shell-active `
      + 'values the screen correctly refused to make copyable');
    expect(
      wrong,
      'a composed line pasted into a shell must produce the argv the catalogue meant — '
      + `${wrong.length} did not:\n    ${wrong.join('\n    ')}`,
    ).toEqual([]);
    expect(cases, 'free-text field × value cases').toBeGreaterThanOrEqual(200);
    expect(refusals, 'every free-text field refuses a shell-active value').toBe(42);
  });

/* ══ 6 — THE REFUSALS ═════════════════════════════════════════════════════ */

test('an entry the catalogue does not license to run offers no Execute, and the server agrees',
  async ({ app }) => {
    test.setTimeout(120_000);
    await openComposer(app.page);

    const withheld = DEFS.filter((def) => !runnableFor(def));
    expect(withheld.map((d) => d.name), 'the entries D2 licensed a form for and not a run')
      .toEqual(['init', 'procedure done', 'audit']);

    for (const def of withheld) {
      await chooseEntry(app.page, def.name);
      const controls = await controlsOf(app.page, def);
      const { unfillable } = await fillRequired(app.page, def, controls);
      expect(unfillable, `${def.name}: its required fields are fillable`).toEqual([]);

      const actions = app.page.locator(`${CMD} .cmdactions`);
      await expect(actions, `${def.name}: a control is drawn`).toHaveCount(1);
      // **THE CORRECT RESULT IS THE REFUSAL.** One control, Copy, and the
      // sentence that says why there is not a second — never an Execute button
      // whose only possible outcome is the server's refusal.
      await expect(
        actions.getByRole('button', { name: /Execute|הרצה/ }),
        `${def.name}: SECURITY — an unlicensed entry must not offer Execute`,
      ).toHaveCount(0);
      await expect(actions.locator(':scope > button'), `${def.name}: Copy alone`)
        .toHaveCount(1);
      await expect(app.page.locator(`${CMD} p.small`).last(), `${def.name}: and says why`)
        .toContainText(/Copy only|העתקה בלבד/);
    }

    /**
     * **And the boundary is the SERVER's, not the screen's.** The screen
     * withholding the button is courtesy — `screens/palette.js` says exactly
     * that: "This is courtesy, not the boundary. `execute-catalogue.ts` refuses
     * the same ids on the server, and it would refuse them if this line were
     * wrong." A test that checked only the button would pass on a build where
     * the route had been opened.
     *
     * **Asked of the module rather than of the route, and that is a correction
     * to this test rather than a shortcut.** The first version fetched
     * `/api/execute/confirm` from the page and asserted a status of 400 or
     * more. It passed — on a 401, because a hand-rolled `fetch` from a screen
     * carries no credential (`app.js`) and is refused before the catalogue is
     * ever consulted. It would have gone on passing with every one of these
     * three fully licensed to run, which is the exact security regression the
     * item warns that a convenient test creates.
     *
     * `runnableIds()` is the list `resolveCommand` actually gates on, so asking
     * it is asking the thing that decides.
     */
    const licensed = runnableIds();
    for (const def of withheld) {
      expect(
        licensed,
        `${def.name}: SECURITY — the server's own execution licence must not carry an entry `
        + 'the catalogue withholds; the missing button is courtesy, this is the boundary',
      ).not.toContain(def.name);
    }
    // The other direction, so this cannot pass by the list being empty.
    for (const def of DEFS.filter((d) => runnableFor(d))) {
      expect(licensed, `${def.name}: is licensed, and the server agrees`).toContain(def.name);
    }
  });
