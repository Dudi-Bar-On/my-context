/**
 * **The page runs, and every screen renders.**
 *
 * The first two lines of the rule, and the ones every other spec in this
 * directory depends on. A static checker can prove the file parses, that its
 * string keys balance, that no CSS property is physical. None of them can
 * prove the script ran, because from the outside a script that never executed
 * and a script that executed perfectly produce byte-identical files.
 *
 * This project has shipped that exact failure: a literal script-closing tag
 * inside a template string ended the `<script>` element, the rest of the file
 * became markup, `alert(1)` fired on load, and nothing was reviewable until a
 * browser said so.
 */
import { test, expect } from '@playwright/test';
import { SCREENS, expectNoFaults, openMockup, showScreen } from './mockup.ts';

test('the script ran — the page is not a corpse that reads correctly', async ({ page }) => {
  const faults = await openMockup(page);

  // Four things nothing but the script can produce. If the element ends early
  // the markup still parses and the shell still draws; these stay empty.
  const built = await page.evaluate(() => ({
    sessions: document.querySelectorAll('#sesslist .row').length,
    treeItems: document.querySelectorAll('[role="treeitem"]').length,
    markdown: (document.querySelector('#mdout')?.textContent ?? '').trim().length,
    auditRows: document.querySelectorAll('#atbl tr').length,
    provenance: (document.querySelector('#provparts')?.textContent ?? '').trim().length,
  }));

  expect(faults.dialogs, 'nothing on this page may open a dialog').toEqual([]);
  expect(built.sessions, 'the session list is built by script, never by markup').toBe(3);
  expect(built.treeItems, 'the coverage tree is built by script').toBe(7);
  expect(built.markdown, 'the markdown pane is rendered by script').toBeGreaterThan(100);
  expect(built.auditRows, 'the audit feed is rendered by script').toBeGreaterThan(0);
  // `#provparts`, not `#prov`: the bar's projection group is markup now — three
  // keyed states, hidden-toggled — so `#prov` has text whether or not the script
  // ran, and asserting on it would have stopped meaning anything.
  expect(built.provenance, 'the provenance strip is painted by script').toBeGreaterThan(0);

  expectNoFaults(faults, 'on load');
});

test('the markdown renderer shows a script tag, it does not run one', async ({ page }) => {
  const faults = await openMockup(page);

  // MD_EN and MD_HE both embed `<script>alert(1)</script>` on purpose: the
  // renderer's job is to render it as TEXT. Two distinct failures are pinned
  // here at once — the renderer executing it, and the file's own script element
  // being truncated by the literal closing tag inside the template string.
  const md = await page.evaluate(() => ({
    text: document.querySelector('#mdout')?.textContent ?? '',
    scriptElements: document.querySelectorAll('#mdout script').length,
    rawHtml: (document.querySelector('#mdout')?.innerHTML ?? '').includes('<script'),
  }));

  // The dialog check goes first because it is the most diagnostic: an alert on
  // load means script markup escaped into the document, and every other
  // assertion in this file is then measuring the wreckage rather than the cause.
  expect(faults.dialogs, 'nothing on this page may open a dialog').toEqual([]);
  expect(md.text, 'the literal tag must survive as text').toContain('<script>alert(1)</script>');
  expect(md.scriptElements, 'no script element may be created from markdown').toBe(0);
  expect(md.rawHtml, 'no raw script markup may reach the DOM').toBe(false);
  expectNoFaults(faults, 'while rendering markdown');
});

test('the rail offers exactly the twenty-one screens, in order', async ({ page }) => {
  const faults = await openMockup(page);

  const rail = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.nav')].map((b) => b.dataset['s'] ?? ''));
  const panes = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-p]')].map((p) => p.dataset['p'] ?? ''));

  expect(rail, 'the rail is the specification of what screens exist').toEqual([...SCREENS]);
  expect(panes, 'every rail entry has a section and nothing has a section without one')
    .toEqual([...SCREENS]);
  expectNoFaults(faults, 'while reading the rail');
});

test('every screen renders, and every screen runs clean', async ({ page }) => {
  const faults = await openMockup(page);

  // Accumulated per screen so the failure message names the screen that broke,
  // not "somewhere in twenty-one navigations".
  const drawn: Record<string, { visible: number; heading: string; text: number; current: number }> = {};

  for (const screen of SCREENS) {
    await showScreen(page, screen);
    drawn[screen] = await page.evaluate((s) => {
      const sections = [...document.querySelectorAll<HTMLElement>('[data-p]')];
      const mine = sections.find((x) => x.dataset['p'] === s)!;
      const box = mine.getBoundingClientRect();
      return {
        // exactly one section un-hidden, and it is this one
        visible: sections.filter((x) => !x.hidden).length,
        heading: (mine.querySelector('h2')?.textContent ?? '').trim(),
        text: box.height > 0 ? mine.innerText.trim().length : 0,
        current: document.querySelectorAll('.nav[aria-current="page"]').length,
      };
    }, screen);

    expect(faults.all(), `screen "${screen}" must render without a console error`).toEqual([]);
  }

  for (const screen of SCREENS) {
    const d = drawn[screen]!;
    expect(d.visible, `"${screen}": exactly one screen is shown at a time`).toBe(1);
    expect(d.heading, `"${screen}" must draw a heading`).not.toBe('');
    // A screen that throws part-way still draws its heading. A length floor is
    // what separates "the h2 exists" from "the screen drew".
    expect(d.text, `"${screen}" must draw a body, not just a heading`).toBeGreaterThan(150);
    expect(d.current, `"${screen}": exactly one rail entry is current`).toBe(1);
  }
});

test('every screen renders in Hebrew too — the second half of "every screen"', async ({ page }) => {
  const faults = await openMockup(page);
  await page.click('#lang');
  expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');

  for (const screen of SCREENS) {
    await showScreen(page, screen);
    const text = await page.evaluate((s) =>
      document.querySelector<HTMLElement>(`[data-p="${s}"]`)!.innerText.trim().length, screen);
    expect(text, `"${screen}" must draw a body in Hebrew as well`).toBeGreaterThan(150);
    expect(faults.all(), `screen "${screen}" must render clean in Hebrew`).toEqual([]);
  }
});
