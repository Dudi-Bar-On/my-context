/**
 * **The vendored `<wa-tree>`, driven in a real browser on the real server.**
 *
 * Everything the tree-component evaluation
 * (`docs/superpowers/specs/2026-09-06-tree-component-evaluation.md`) claims was
 * measured in a scratch directory against a throwaway static server. This file
 * re-measures the same claims against WHAT SHIPS: `src/ui/public/tree-proof.html`
 * served by `src/ui/static.ts` out of `src/ui/public/`, over the same
 * `startUiChild` harness every other spec here uses.
 *
 * `RULE-a-ui-change-is-not-verified-until-someone-has-looked-at-it` is why the
 * screenshots at the end are not decoration: a component that upgrades and
 * satisfies every ARIA assertion can still draw an invisible chevron or a row
 * of unreadable ink, and only a person looking at the picture finds that.
 *
 * ── THE FOUR CLAIMS, AND WHY EACH NEEDED A BROWSER ─────────────────────────
 *
 * 1. **The markup is genuinely NESTED.** `library/2` records the owner ruling
 *    that a flattened row list is not a tree. This is not checkable in source:
 *    `wa-tree-item`'s `connectedCallback` moves a nested item into the parent's
 *    `children` slot at runtime, and the `role="group"` container lives in
 *    shadow DOM. Only a live DOM can say whether a child item is a DOM
 *    descendant of its parent — which is what makes a collapsed folder hide its
 *    subtree by CONTAINMENT, so the `[hidden]` specificity defect already paid
 *    for in `library/2` cannot be written here.
 * 2. **The ARIA vocabulary is real** — `role=tree`/`treeitem`/`group`,
 *    `aria-expanded` — and every one of those is applied by script at upgrade
 *    time, so grepping the HTML would find none of them.
 * 3. **The arrow keys SWAP under `dir="rtl"`.** This is the assertion the
 *    evaluation says a hand-built tree gets wrong, and it is the reason a
 *    component was adopted rather than written. It cannot be tested without a
 *    focus model and a key event.
 * 4. **Zero off-origin requests.** This is the whole point of vendoring, and it
 *    is a property of the RUN, not of the source: the barrel entry point this
 *    vendoring deliberately did not take reaches the network from inside
 *    `wa-icon`, at render time, with no import to give it away. Counting the
 *    requests a page actually makes is the only check that would have caught
 *    that, so it is the one made here — in both directions, because the RTL
 *    render takes a different branch of the icon template.
 */
import { test, expect } from './app.ts';
import type { Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '..');

/** The proof-of-life page needs no token: it is static and reads no API. */
const PAGE = '/tree-proof.html';

/**
 * Every request the page made, and every one that left the origin.
 *
 * Attached to the page BEFORE `goto`, so the document request itself is
 * counted. `request` rather than `response` because a blocked or failed
 * off-origin attempt is exactly the thing being looked for and may never
 * produce a response.
 */
function watchRequests(page: Page, origin: string): { all: string[]; offOrigin: string[] } {
  const all: string[] = [];
  const offOrigin: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    all.push(url);
    if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) {
      offOrigin.push(url);
    }
  });
  return { all, offOrigin };
}

/**
 * Expand every folder and WAIT FOR THE ANIMATION TO SETTLE.
 *
 * `wa-tree-item` opens by animating its children container's height from 0 to
 * its scroll height and only then setting `height: auto`. Expanding a nested
 * tree in one pass therefore starts a cascade of overlapping animations, and a
 * screenshot taken before they land shows rows clipped and overlapping — which
 * is exactly what the first run of this spec produced, and exactly the kind of
 * thing an assertion on `aria-expanded` cannot see.
 *
 * `height: auto` is the state each animation ENDS in, so it is what is waited
 * for. `--wa-transition-normal` is this product's own `--dur-nav` (180ms), and
 * a nested cascade takes several of those.
 */
async function expandAll(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const item of document.querySelectorAll('wa-tree-item')) {
      (item as HTMLElement & { expanded: boolean }).expanded = true;
    }
  });
  await page.waitForFunction(() => [...document.querySelectorAll('wa-tree-item')].every(
    (item) => {
      const children = item.shadowRoot?.querySelector<HTMLElement>('[part="children"]');
      return children === null || children === undefined || children.style.height === 'auto';
    },
  ), undefined, { timeout: 10_000 });
}

/** Open the proof page and wait for the elements to upgrade. */
async function openTree(page: Page, port: number, dir: 'ltr' | 'rtl'): Promise<void> {
  if (dir === 'rtl') {
    // Set before any module runs, so the first render already takes the RTL
    // branch — Web Awesome's localize controller reads `document.documentElement.dir`
    // at module evaluation and then watches it, and asserting on a
    // re-render is a weaker claim than asserting on the render.
    await page.addInitScript(() => {
      const set = (): void => { document.documentElement.setAttribute('dir', 'rtl'); };
      if (document.documentElement !== null) set();
      else {
        new MutationObserver((_records, observer) => {
          if (document.documentElement !== null) { set(); observer.disconnect(); }
        }).observe(document, { childList: true });
      }
    });
  }
  await page.goto(`http://127.0.0.1:${port}${PAGE}`);
  // The elements are custom: `role="tree"` appears only once the module has
  // loaded, been evaluated, registered `wa-tree` and upgraded the element.
  // Waiting on the ROLE rather than on `load` is what makes a failure here
  // mean "the component did not come up" instead of "the HTML arrived".
  await expect(page.locator('wa-tree')).toHaveAttribute('role', 'tree', { timeout: 15_000 });
  await expect(page.locator('wa-tree-item').first()).toHaveAttribute('role', 'treeitem');
}

test('the ARIA vocabulary is real, and the markup is genuinely nested', async ({
  page, server,
}) => {
  await openTree(page, server.port, 'ltr');

  const shape = await page.evaluate(() => {
    const tree = document.querySelector('wa-tree')!;
    const items = [...tree.querySelectorAll('wa-tree-item')];
    const root = items[0]!;
    const child = root.querySelector(':scope > wa-tree-item')!;
    return {
      treeRole: tree.getAttribute('role'),
      itemRoles: [...new Set(items.map((i) => i.getAttribute('role')))],
      // The group container is in the item's own shadow root — this is the
      // element that OWNS the subtree, and the reason a collapsed folder hides
      // it by containment rather than by a CSS rule someone has to get right.
      groupRoles: [...new Set(items.map(
        (i) => i.shadowRoot?.querySelector('[part="children"]')?.getAttribute('role')))],
      // Nesting, stated as the thing that would be FALSE of a flattened list:
      // a child item is a DOM child of its parent item, and the component has
      // slotted it into the parent's `children` slot.
      childIsDomChildOfParent: child.parentElement === root,
      childSlot: child.getAttribute('slot'),
      // `aria-expanded` exists only on items that have children — a leaf must
      // not claim a state it cannot be in.
      expandedOnParent: root.getAttribute('aria-expanded'),
      expandedOnLeaf: items.at(-1)!.getAttribute('aria-expanded'),
      leafHasChildren: items.at(-1)!.querySelector('wa-tree-item') !== null,
      depth: (() => {
        let node: Element | null = items.at(-2) ?? null;
        let d = 0;
        while (node?.parentElement?.tagName.toLowerCase() === 'wa-tree-item') {
          d += 1;
          node = node.parentElement;
        }
        return d;
      })(),
    };
  });

  expect(shape.treeRole).toBe('tree');
  expect(shape.itemRoles).toEqual(['treeitem']);
  expect(shape.groupRoles, 'every item owns a role="group" container in its shadow root')
    .toEqual(['group']);
  expect(shape.childIsDomChildOfParent,
    'a child item must be a DOM CHILD of its parent item. A flattened sibling list with a '
    + 'padding-left per level is the shape the owner rejected for library/2.').toBe(true);
  expect(shape.childSlot).toBe('children');
  expect(shape.expandedOnParent).toBe('true');
  expect(shape.leafHasChildren, 'the last item must be a leaf for the next assertion to mean '
    + 'anything').toBe(false);
  expect(shape.expandedOnLeaf, 'a leaf must not carry aria-expanded').toBeNull();
  expect(shape.depth, 'the fixture must nest at least two levels deep, or "nested" is '
    + 'untested').toBeGreaterThanOrEqual(1);
});

/**
 * **The chevron expands; the label selects.**
 *
 * `library/2` says the question *"what does a click on a folder do, because it
 * cannot silently do both"* must be decided and written down. It does not need
 * inventing: the component already separates the two affordances in
 * `WaTree.handleClick`, and this is the proof that it does, so the next lane
 * can build the drill-down on it rather than on a reading of the source.
 *
 * The containment half comes first, because it is the property that makes the
 * `[hidden]` specificity defect recorded in `library/2` unwritable here: a
 * collapsed folder's subtree is inside a `display:none` container in the
 * parent's shadow root, so there is nothing to hide by hand and no rule to get
 * wrong.
 *
 * **Every locator below addresses a `<bdi>`, never a `wa-tree-item`.** A
 * `wa-tree-item` filtered by the text of a descendant matches the ANCESTOR
 * too — nesting is the whole point of this component — and `.first()` then
 * returns the visible folder rather than the hidden leaf. The first draft of
 * this test did exactly that and asserted that a hidden row was visible.
 */
test('a collapsed folder hides its subtree by containment; the chevron and the label differ',
  async ({ page, server }) => {
    await openTree(page, server.port, 'ltr');
    const docs = page.locator('wa-tree-item').filter({ has: page.getByText('docs/') }).first();
    const nested = page.locator('bdi', { hasText: 'README.he.md' });

    await expect(docs).toHaveAttribute('aria-expanded', 'false');
    await expect(nested,
      'a collapsed folder must hide its subtree — it lives in a display:none container in the '
      + "parent item's shadow root, so containment does it and no CSS rule of ours has to")
      .toBeHidden();
    await expect(docs).toHaveAttribute('aria-selected', 'false');

    // The CHEVRON expands in place and does not select.
    await docs.locator('[part="expand-button"]').first().click();
    await expect(docs).toHaveAttribute('aria-expanded', 'true');
    await expect(nested).toBeVisible();
    await expect(docs, 'expanding is not selecting').toHaveAttribute('aria-selected', 'false');

    // The LABEL selects and does not collapse. That is the affordance the
    // Library screen will hang "descend into this folder" on.
    await docs.locator('[part="label"]').first().click();
    await expect(docs).toHaveAttribute('aria-selected', 'true');
    await expect(docs, 'selecting is not collapsing').toHaveAttribute('aria-expanded', 'true');
  });

/**
 * **The RTL arrow swap, and the LTR control beside it.**
 *
 * Asserting only the RTL half would pass over a tree whose arrows did nothing
 * at all, so both directions are driven through the identical sequence and the
 * expected outcomes are mirrored. Per the APG: the "open" arrow points toward
 * the subtree, which is Right in LTR and Left in RTL.
 */
for (const dir of ['ltr', 'rtl'] as const) {
  const open = dir === 'ltr' ? 'ArrowRight' : 'ArrowLeft';
  const close = dir === 'ltr' ? 'ArrowLeft' : 'ArrowRight';

  test(`the arrow keys follow the APG under dir="${dir}" — ${open} opens, ${close} closes`,
    async ({ page, server }) => {
      await openTree(page, server.port, dir);
      expect(await page.evaluate(() => document.documentElement.dir || 'ltr')).toBe(dir);

      const docs = page.locator('wa-tree-item').filter({ has: page.getByText('docs/') }).first();
      await expect(docs).toHaveAttribute('aria-expanded', 'false');

      // Focus the collapsed folder directly rather than tabbing to it: what is
      // under test is the KEY MAP, not the tab order, and a focus walk that
      // changed length with the fixture would make this spec brittle for a
      // reason unrelated to what it claims.
      await page.evaluate(() => {
        const items = [...document.querySelectorAll('wa-tree-item')];
        const target = items.find((i) => i.textContent?.includes('docs/'))!;
        (target as HTMLElement).tabIndex = 0;
        (target as HTMLElement).focus();
      });

      await page.keyboard.press(open);
      await expect(docs, `${open} must EXPAND under dir="${dir}"`)
        .toHaveAttribute('aria-expanded', 'true');

      await page.keyboard.press(close);
      await expect(docs, `${close} must COLLAPSE under dir="${dir}"`)
        .toHaveAttribute('aria-expanded', 'false');

      // And the swap, stated as the negative: the OTHER arrow must not expand
      // it. Without this, a tree that expanded on both arrows would pass above.
      await page.keyboard.press(open === 'ArrowRight' ? 'ArrowLeft' : 'ArrowRight');
      await expect(docs,
        `${close} must not expand under dir="${dir}" — the arrows have not swapped`)
        .toHaveAttribute('aria-expanded', 'false');
    });
}

/**
 * **Zero off-origin requests, which is the whole point of vendoring.**
 *
 * Both directions, because the expand affordance renders a different template
 * branch under RTL — and the component this vendoring deliberately did not take
 * (`wa-icon`) fetches its SVG from inside exactly that branch.
 */
for (const dir of ['ltr', 'rtl'] as const) {
  test(`the page reaches nothing off origin under dir="${dir}"`, async ({ page, server }) => {
    const origin = `http://127.0.0.1:${server.port}`;
    const requests = watchRequests(page, origin);
    await openTree(page, server.port, dir);

    // Expand everything, so every template branch and every icon slot has
    // actually rendered before the count is taken. A tree nobody opened is a
    // tree whose expand affordance never drew.
    await expandAll(page);
    await expect(page.locator('bdi', { hasText: 'web-ui-mockup.html' }))
      .toBeVisible();

    expect(requests.offOrigin,
      'a vendored asset reached the network. That is the failure vendoring exists to prevent, '
      + 'and it is how the 49-file barrel closure would have failed: wa-icon fetches its SVG '
      + 'over CORS at render time, with no import statement to give it away.').toEqual([]);

    // Anti-vacuity: the listener must have seen the traffic it is clearing.
    // One document, one stylesheet, the shim and the 26 chunks.
    expect(requests.all.length, 'the request listener saw nothing, so its empty off-origin '
      + 'list proves nothing').toBeGreaterThanOrEqual(28);
    expect(requests.all.filter((u) => u.includes('/lib/vendor/webawesome/chunks/')).length)
      .toBe(26);
  });
}

/**
 * `RULE-a-ui-change-is-not-verified-until-someone-has-looked-at-it`: the
 * pictures a person reads. Both directions, expanded, at a size where the
 * indentation guides, the chevrons and the row ink are all legible.
 */
for (const dir of ['ltr', 'rtl'] as const) {
  test(`the tree is legible under dir="${dir}" — screenshot`, async ({ page, server }, info) => {
    await openTree(page, server.port, dir);
    await expandAll(page);
    await expect(page.locator('bdi', { hasText: 'web-ui-mockup.html' }))
      .toBeVisible();

    // The palette is the ten --wa-* tokens and nothing else, so a row that
    // renders with no colour at all means styles.css did not reach the shadow
    // DOM — which would look like a working tree in every assertion above.
    const ink = await page.evaluate(() => {
      const item = document.querySelector('wa-tree-item')!;
      return getComputedStyle(item).color;
    });
    expect(ink, 'the tree took no colour from the ten --wa-* tokens')
      .not.toBe('rgb(0, 0, 0)');

    // Written to a stable path as well as attached: Playwright discards a
    // PASSING test's attachments, and the rule this test exists for is that
    // somebody LOOKS. A picture only a failing run produces is a picture
    // nobody sees while the thing works. `test-results/` is already the
    // gitignored run-artefact directory `tree-parity.spec.ts` writes into.
    const shot = await page.screenshot({ fullPage: true });
    mkdirSync(path.join(REPO, 'test-results', 'wa-tree'), { recursive: true });
    writeFileSync(path.join(REPO, 'test-results', 'wa-tree', `${dir}.png`), shot);
    await info.attach(`wa-tree-${dir}`, {
      body: shot,
      contentType: 'image/png',
    });
  });
}
