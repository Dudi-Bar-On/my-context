/**
 * **The corpus file browser, driven in a real browser on the real server** —
 * `TASK-the-library-browses-the-corpus-files-and-a-file-opens` (`library/2`),
 * and the owner's served-path ruling of 2026-09-06 recorded as
 * `DEC-the-ui-serves-the-corpus-through-its-own-route-rather-than`.
 *
 * `e2e/wa-tree.spec.ts` drives `/tree-proof.html` — the component in
 * isolation, over hand-written markup, with no corpus, no routing and no
 * screen in the way. This file drives the SHIPPED SCREEN over the shipped
 * endpoint, and asserts the four things that file cannot:
 *
 *   1. **The tree is BOUNDED against a real corpus.** `.demo-corpus` holds
 *      hundreds of item files; the DOM must hold tens. That is the whole of
 *      the scale claim, and it is a property of the RUN — re-rooting plus
 *      `lazy` — not of the source.
 *   2. **A click on a folder's NAME descends and a click on its CHEVRON
 *      expands in place.** `library/2` says this must be decided and written
 *      down because a folder click "cannot silently do both". Both gestures
 *      are here, and each is asserted NOT to do the other's job.
 *   3. **A file opens RENDERED, in its own tab, frontmatter and all.** The
 *      file browser's whole point is the Markdown on disk, which is a
 *      different artefact from the item pane's index-rendered view.
 *   4. **Both languages.** `dir="rtl"` is not optional, and the tree's arrow
 *      keys and chevron both have to swap.
 *
 * `RULE-a-ui-change-is-not-verified-until-someone-has-looked-at-it` is why the
 * screenshots at the end are not decoration.
 */
import { test, expect } from './app.ts';
import type { Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { settleScreen } from './settle.ts';

const REPO = path.resolve(import.meta.dirname, '..');

const LIB = '[data-p="library"]';
/**
 * The corpus card, addressed by WHAT IT CONTAINS rather than by its position.
 *
 * The Library holds four cards now — Tutorials, Documents, the corpus browser
 * and (since `library/1`) the command-line reference — and `.card` `.last()`
 * silently became a different card the day the fourth landed. `:has()` names
 * the one card that owns a tree, which is a property rather than an ordering.
 */
const CARD = `${LIB} .card:has(.corpustree)`;
const TREE = `${LIB} .corpustree wa-tree`;
const CRUMBS = `${LIB} .crumbs`;

/** Open the Library and wait for the property, never for a clock. */
async function openLibrary(page: Page): Promise<void> {
  await page.evaluate(() => { location.hash = '#/library'; });
  const settled = await settleScreen(page, 'library', { requires: '.corpustree wa-tree-item' });
  expect(
    settled.settled,
    `the Library never settled — ${settled.count} elements and ${settled.inFlight} /api reads `
    + `still open after ${settled.attempts} samples. Measured nothing; failing as itself.`,
  ).toBe(true);
  // The elements are custom: `role="tree"` appears only once the module has
  // loaded, registered `wa-tree` and upgraded the element. Waiting on the ROLE
  // is what makes a failure here mean "the component did not come up" rather
  // than "the screen drew".
  await expect(page.locator(TREE)).toHaveAttribute('role', 'tree', { timeout: 15_000 });
  await expect(page.locator(`${TREE} wa-tree-item`).first())
    .toHaveAttribute('role', 'treeitem');
}

/**
 * Switch the console's language through the control a person uses, which
 * RELOADS the page — so the Library is re-opened afterwards.
 *
 * The reload re-fetches every static asset, so a server started before a
 * sibling lane's edit comes back with `#exited` (the code-skew banner) covering
 * the page. `e2e/app.ts` dismisses it on the FIRST load and cannot dismiss one
 * that appears on a later one; this is that same dismissal, for the same
 * reason, at the one point in this file that reloads. Without it the RTL
 * screenshot is a picture of a banner.
 */
async function switchToHebrew(page: Page): Promise<void> {
  await page.locator('#lang').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl', { timeout: 15_000 });
  const skew = page.locator('#exited:not([hidden])');
  if (await skew.isVisible().catch(() => false)) {
    await skew.getByRole('button').first().click().catch(() => {});
  }
}

/** The breadcrumb, as one string — what says WHERE the reader is. */
function crumbText(page: Page): Promise<string> {
  return page.locator(CRUMBS).innerText();
}

/**
 * Wait for the expand animation to land.
 *
 * `wa-tree-item` opens by animating its children container's height from 0 to
 * its scroll height and only then setting `height: auto`, so a measurement
 * taken mid-animation sees a clipped subtree. `height: auto` is the state the
 * animation ENDS in, which is why it is the thing waited for — the same
 * property `e2e/wa-tree.spec.ts` waits on, for the same reason.
 */
async function settleExpansion(page: Page): Promise<void> {
  await page.waitForFunction(() => [...document.querySelectorAll('wa-tree-item')].every((item) => {
    const children = item.shadowRoot?.querySelector<HTMLElement>('[part="children"]');
    return children === null || children === undefined
      || children.style.height === 'auto' || children.hidden;
  }), undefined, { timeout: 10_000 });
}

/* ══ THE BOUND ═════════════════════════════════════════════════════════════ */

test('the tree is BOUNDED against a real corpus — hundreds of files, tens of elements', async ({
  app,
}) => {
  await openLibrary(app.page);

  const measured = await app.page.evaluate(async () => {
    const response = await fetch('/api/corpus', { credentials: 'same-origin' });
    const body = await response.json() as { files: string[]; indexed: number };
    return {
      files: body.files.length,
      indexed: body.indexed,
      elements: document.querySelectorAll('wa-tree-item').length,
      // **The FRAME's own height, not the page's.** The page is shared — the
      // Library draws four cards and `library/1` added the fourth — so a page
      // measurement would be a claim about somebody else's card as much as
      // this one. The property that matters is this control's: `.corpustree`
      // carries a `max-block-size` and its own scrollbar precisely so that the
      // deepest folder cannot make the page grow, which is the lesson the
      // 942-option `<select>` taught at ~3,900px.
      frameHeight: Math.round(
        document.querySelector('.corpustree')?.getBoundingClientRect().height ?? -1,
      ),
    };
  });

  expect(measured.files, 'the demo corpus must be big enough for this to be a bound at all')
    .toBeGreaterThan(300);
  expect(measured.elements,
    `${measured.elements} tree elements for ${measured.files} corpus files. Only the CURRENT `
    + 'folder\'s children are built and every folder is lazy, so this must stay in the tens.')
    .toBeLessThan(60);
  expect(measured.elements, 'no rows at all is not a bound, it is a broken screen')
    .toBeGreaterThan(0);
  expect(measured.frameHeight,
    `the tree frame drew ${measured.frameHeight}px tall. It has a max-block-size and its own `
    + 'scrollbar, so no corpus may make it grow without limit.')
    .toBeLessThan(700);
  expect(measured.frameHeight, 'a frame with no height is not a bounded tree, it is no tree')
    .toBeGreaterThan(50);
});

/* ══ THE TWO GESTURES ══════════════════════════════════════════════════════ */

test('the CHEVRON expands a folder in place, and does NOT descend into it', async ({ app }) => {
  const { page } = app;
  await openLibrary(page);

  const before = await crumbText(page);
  const folder = page.locator(`${TREE} > wa-tree-item`).first();
  await expect(folder).toHaveAttribute('data-kind', 'dir');
  const beforeCount = await page.locator(`${TREE} wa-tree-item`).count();

  await folder.locator('[part="expand-button"]').click();
  await expect(folder).toHaveAttribute('aria-expanded', 'true');
  await settleExpansion(page);

  // Lazy: the folder's children did not exist a moment ago and do now.
  const afterCount = await page.locator(`${TREE} wa-tree-item`).count();
  expect(afterCount,
    'expanding a lazy folder must BUILD its children — nothing was added, so either the '
    + 'wa-lazy-load handler never ran or the folder was never lazy')
    .toBeGreaterThan(beforeCount);

  // ...and the children are DOM descendants of the folder, which is what makes
  // a collapsed folder hide its subtree by containment.
  const nestedByContainment = await folder.evaluate(
    (element) => element.querySelector(':scope > wa-tree-item') !== null,
  );
  expect(nestedByContainment,
    'a child item must be a DOM CHILD of its folder. A flattened sibling list is the shape the '
    + 'owner rejected for library/2.').toBe(true);

  // The reader did NOT move.
  expect(await crumbText(page), 'the chevron must not descend — that is the name\'s job')
    .toBe(before);
});

test('the NAME descends into a folder, the breadcrumb comes back out', async ({ app }) => {
  const { page } = app;
  await openLibrary(page);

  const before = await crumbText(page);
  // Address the `<bdi>`, never the `wa-tree-item`: an item filtered by a
  // descendant's text matches the ANCESTOR too, which is what nesting means.
  const label = page.locator(`${TREE} > wa-tree-item > bdi.wa-name`).first();
  const name = (await label.innerText()).replace(/\/$/, '');
  await label.click();

  // The tree re-rooted: the breadcrumb grew a crumb naming the folder, and it
  // is a BUTTON at the position the reader can climb back to.
  await expect(page.locator(`${CRUMBS} .crumb.here`)).toHaveText(name);
  const descended = await crumbText(page);
  expect(descended).not.toBe(before);
  expect(descended).toContain(name);

  await page.locator(`${CRUMBS} button.crumb`).first().click();
  await expect(page.locator(`${TREE} > wa-tree-item`).first())
    .toHaveAttribute('data-kind', 'dir');
  expect(await crumbText(page), 'the breadcrumb must return the reader to where they started')
    .toBe(before);
});

/* ══ THE FILE, RENDERED, IN ITS OWN TAB ════════════════════════════════════ */

test('a file opens RENDERED in its own tab, frontmatter and all', async ({ app }, info) => {
  const { page } = app;
  await openLibrary(page);

  // Descend until there are files to open — the corpus root holds only
  // category folders.
  await page.locator(`${TREE} > wa-tree-item > bdi.wa-name`).first().click();
  const file = page.locator(`${TREE} wa-tree-item[data-kind="file"] a.wa-file`).first();
  await expect(file).toBeVisible();

  const href = await file.getAttribute('href');
  expect(href, 'a file row must be a real anchor, so middle-click and copy-link work')
    .toMatch(/^\/doc\.html\?corpus=items%2F/);
  expect(await file.getAttribute('target')).toBe('_blank');
  expect(await file.getAttribute('rel')).toBe('noopener');

  const [opened] = await Promise.all([
    page.context().waitForEvent('page'),
    file.click(),
  ]);
  await opened.waitForLoadState('domcontentloaded');

  // The path is shown HERE and only here — the list draws segments, the
  // document says where it lives, which is what GitHub does too.
  await expect(opened.locator('#docpath')).toHaveText(/^\.my_context\/items\//);
  // The tag says WHICH of the two things this page renders a reader is looking
  // at: a corpus file, not a repository document.
  await expect(opened.locator('#docstate .tag')).toHaveText('Corpus file');

  // The FRONTMATTER is served and drawn rather than stripped — that is the
  // whole difference between this and the console's index-rendered item pane.
  const front = opened.locator('article#doc details.frontmatter');
  await expect(front).toBeVisible();
  await expect(front.locator('pre code')).toContainText('id:');
  await expect(front.locator('pre code')).toContainText('type:');

  // And the body is rendered Markdown in GitHub's own stylesheet, not raw text.
  await expect(opened.locator('article.markdown-body h1').first()).toBeVisible();
  const wearsGitHub = await opened.evaluate(() => [...document.styleSheets]
    .some((sheet) => (sheet.href ?? '').includes('github-markdown')));
  expect(wearsGitHub, 'the document page must wear github-markdown-css').toBe(true);

  // The picture, for the same reason as the two at the end of this file:
  // every assertion above can pass over a page nobody could read.
  const shot = await opened.screenshot();
  const dir = path.join(REPO, 'test-results', 'corpus-tree');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'document.png'), shot);
  await info.attach('corpus-file-rendered', { body: shot, contentType: 'image/png' });

  await opened.close();
});

/* ══ BOTH LANGUAGES ════════════════════════════════════════════════════════ */

test('the tree mirrors under dir="rtl", and the arrow keys swap with it', async ({ app }) => {
  const { page } = app;
  await openLibrary(page);
  await switchToHebrew(page);
  await openLibrary(page);

  // The chevron is OURS (`wa-icon` is not vendored), so it does not mirror
  // itself — `styles.css` flips it, and this is the assertion that the flip
  // reached a tree the Library built rather than only the proof page.
  //
  // **It must address a CLONE on a `wa-tree-item`, never the pair slotted on
  // the `<wa-tree>` itself.** Those two are the template `WaTree.initTreeItem`
  // copies from; the tree's own shadow root has no `expand-icon` slot to
  // render them into, so they are unrendered, and Chrome answers
  // `getComputedStyle(...).transform` for an unrendered element with `none`
  // whatever the cascade says. Measured in a live browser 2026-09-06: the
  // template answers `none` under `dir="rtl"` and the clone answers
  // `matrix(-1, 0, 0, 1, 0, 0)`. The first draft of this spec asked the
  // template and reported a working flip as broken.
  const flipped = await page.locator(`${TREE} wa-tree-item > svg.wa-chev`).first()
    .evaluate((element) => getComputedStyle(element).transform);
  expect(flipped, 'the slotted chevron must be mirrored under dir="rtl"')
    .toBe('matrix(-1, 0, 0, 1, 0, 0)');

  // ArrowLeft expands under RTL — the APG behaviour the component owns and the
  // single strongest reason an external control was adopted over a hand-built
  // one. ArrowRight must NOT expand, or the swap is only half done.
  const first = page.locator(`${TREE} > wa-tree-item`).first();
  await first.focus();
  await page.keyboard.press('ArrowRight');
  await expect(first, 'ArrowRight must not expand under dir="rtl"')
    .toHaveAttribute('aria-expanded', 'false');
  await first.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(first, 'ArrowLeft must expand under dir="rtl"')
    .toHaveAttribute('aria-expanded', 'true');

  // The Hebrew table is what is drawn — an unkeyed English sentence would
  // survive every assertion above.
  await expect(page.locator(`${CARD} h3`)).toHaveText('קובצי הקורפוס');
});

/* ══ THE PICTURE ═══════════════════════════════════════════════════════════ */

for (const direction of ['ltr', 'rtl'] as const) {
  test(`the corpus browser is legible, and here is the picture — ${direction}`, async ({
    app,
  }, info) => {
    const { page } = app;
    await openLibrary(page);
    if (direction === 'rtl') {
      await switchToHebrew(page);
      await openLibrary(page);
    }
    await page.locator(`${TREE} > wa-tree-item`).first()
      .locator('[part="expand-button"]').click();
    await settleExpansion(page);

    // Ink that is legible at all: a component adopted into a dark product can
    // upgrade, satisfy every ARIA assertion, and draw black on black.
    const ink = await page.locator(`${TREE} bdi.wa-name`).first()
      .evaluate((element) => getComputedStyle(element).color);
    expect(ink, 'a tree label drew in pure black on this product\'s dark ground')
      .not.toBe('rgb(0, 0, 0)');

    const shot = await page.locator(CARD).screenshot();
    const dir = path.join(REPO, 'test-results', 'corpus-tree');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `${direction}.png`), shot);
    await info.attach(`corpus-tree-${direction}`, { body: shot, contentType: 'image/png' });
  });
}
