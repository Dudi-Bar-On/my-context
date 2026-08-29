/**
 * **The owner's report, in a browser: *"ask screen, audit history, many item
 * records in the results are blanked wit no item - bug"*.** (`plan:walk`
 * seq:73.)
 *
 * Measured before anything was changed, and the join was never broken. Of the
 * sixty most recent records behind that screen, fifty-nine were `hook` and one
 * was `access`, and NOT ONE of the sixty carried an item id — because a
 * session-lifecycle event is not about an item and a credential refusal is not
 * about an item. The em dashes were honest. What the table could not do was say
 * what a record IS: `kind` and `op` were in its own filter vocabulary and in
 * none of its three columns, so 498 rows read `06:22:59 | — | —` and a reader
 * had no way to tell a subagent stopping from a credential being refused.
 *
 * ── WHY THIS SPEC BUILDS ITS OWN CORPUS, AND WHAT IT PUTS IN IT ────────────
 *
 * Because the shape of the log is the whole subject. `e2e/app.ts` opens
 * `.demo-corpus`, which was built to exercise every screen and therefore holds
 * injections and mutations that DO name items — and a table drawn over rows
 * that all name items passes the old three columns and proves nothing. That is
 * the fixture pattern this defect is an instance of: the mockup's audit table
 * was drawn against two sample rows that both carried an item, and the real log
 * is dominated by rows that carry none.
 *
 * So the log below is the ordinary state of any machine that has run agents:
 * mostly `hook`, a refusal, and exactly one record that names an item — kept in
 * the minority so that the assertion "the item is still shown" is made over a
 * corpus where the item is the exception rather than the rule.
 *
 * ── WHAT IS ASSERTED, AND WHAT IS DELIBERATELY NOT ────────────────────────
 *
 * Asserted: the three columns the design of record now declares; that every row
 * says what its record IS; and — the assertion the old table could not have
 * passed — that the rows are DISTINGUISHABLE from one another by what is drawn
 * in them.
 *
 * Not asserted: a row count, an order beyond newest-first, or an id. Records
 * are appended by the server's own reads while the page is open (a minted
 * credential is an `access` record), so a count taken here measures the run
 * rather than the code.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../test/helpers/tmp.ts';
import { startUiChild, type UiHarness } from '../test/ui/helpers.ts';
import { runCli } from '../src/cli/index.ts';
import { recordAudit, type AuditInput } from '../src/core/audit.ts';
import { DIR_NAME } from '../src/core/workspace.ts';

/**
 * The log, in the proportion the owner's machine had it: hooks, a refusal, and
 * one mutation. Five distinct ops among the hooks, because a table that draws
 * one op perfectly and collapses the rest would pass a one-op fixture.
 */
const HOOK_OPS = [
  ['subagent-stop', 'SubagentStop'],
  ['session-end', 'SessionEnd'],
  ['post-tool-use', 'PostToolUse'],
  ['stop', 'Stop'],
  ['task-completed', 'TaskCompleted'],
] as const;

/** The one record that names an item — the minority case, on purpose. */
const NAMED_ITEM = 'RULE-money-is-an-integer-number-of-cents';

function seed(corpus: string): void {
  for (let round = 0; round < 6; round += 1) {
    for (const [op, hook] of HOOK_OPS) {
      recordAudit(corpus, {
        kind: 'hook', op, hook, origin: 'agent', sessionId: `s-${round}`,
      } as AuditInput);
    }
  }
  recordAudit(corpus, {
    kind: 'access', op: 'ui-refused', origin: 'agent',
    refusal: { check: 'token-missing', method: 'GET', route: '/api/items' },
  } as AuditInput);
  recordAudit(corpus, {
    kind: 'mutation', op: 'create', origin: 'human', itemId: NAMED_ITEM, fields: ['body'],
  } as AuditInput);
}

interface Fixture { page: Page }

async function asking(page: Page, body: (fixture: Fixture) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ask-hook-log-'));
  const corpus = path.join(dir, DIR_NAME);
  let harness: UiHarness | undefined;
  try {
    expect(runCli(['init'], dir, () => {}), 'fixture command failed: init').toBe(0);
    seed(corpus);
    // `recordAudit` keeps the projection current as it appends, and this is the
    // same call `e2e/app.ts` makes before serving: a projection that is behind
    // its log makes every read a 503, and this spec would then be measuring a
    // refusal rather than a table.
    expect(runCli(['audit'], dir, () => {}), 'fixture command failed: audit').toBe(0);

    harness = await startUiChild(dir);
    const h = harness;
    await page.goto(`http://127.0.0.1:${h.port}/#${h.nonce}`);
    await expect(
      page.locator('.nav').first(),
      'the app never rendered a rail button — it probably has no token',
    ).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => { location.hash = '#/ask'; });
    await body({ page });
  } finally {
    if (harness !== undefined) await harness.stop();
    removeTree(dir);
  }
}

/** The result table's rows, each as its cells' visible text. */
async function rows(page: Page): Promise<string[][]> {
  return page.evaluate(() => {
    const table = document.querySelector('[data-p="ask"] table');
    if (table === null) return [];
    return [...table.querySelectorAll('tbody tr')].map(
      (row) => [...row.querySelectorAll('td')].map((cell) => (cell.textContent ?? '').trim()),
    );
  });
}

test('a log dominated by hook rows draws rows a reader can tell apart', async ({ page }) => {
  await asking(page, async ({ page: open }) => {
    const table = open.locator('[data-p="ask"] table');
    await expect(table, 'the Ask screen drew no result table').toBeVisible({ timeout: 15_000 });
    await expect(table.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

    // The columns the design of record declares, read off the page rather than
    // off the module: At · Kind · What, the Audit stream's own three.
    const heads = await open.locator('[data-p="ask"] table thead th').allTextContents();
    expect(heads.map((h) => h.trim()), 'the audit table\'s columns').toEqual(['At', 'Kind', 'What']);

    const drawn = await rows(open);
    expect(drawn.length, 'no rows were drawn at all').toBeGreaterThan(5);
    expect(new Set(drawn.map((cells) => cells.length)), 'every row has three cells')
      .toEqual(new Set([3]));

    // 1. EVERY row says what its record is. This is the assertion the reported
    //    screen failed: its Kind and What cells did not exist, and the two it
    //    had were `—` on every row of a log like this one.
    const blank = drawn.filter(([, kind, what]) => kind === '' || kind === '—'
      || what === '' || what === '—');
    expect(blank, 'a row that cannot say what its record is').toEqual([]);

    // 2. The rows are DISTINGUISHABLE. A screen that drew one word for every
    //    hook — or the kind alone, with the op still undrawn — would satisfy
    //    the first assertion and fail a reader exactly as before.
    const said = new Set(drawn.map(([, kind, what]) => `${kind} ${what}`));
    expect(said.size, 'every row of this log reads the same as every other')
      .toBeGreaterThan(3);

    // 3. And it is the record's OWN vocabulary — the words `--kind` and `--op`
    //    take, and the words somebody grepping the log will search for.
    const flat = [...said].join('\n');
    for (const [op] of HOOK_OPS) {
      expect(flat, `the log holds ${op} and the table never says so`).toContain(op);
    }
    expect(flat, 'a refusal is drawn as itself, not as another hook').toContain('ui-refused');

    // 4. The item did not go anywhere. It is one record in thirty-eight, which
    //    is the point: it is drawn BESIDE what happened to it rather than in a
    //    column of its own that is empty on every other row.
    const named = drawn.filter(([, , what]) => what.includes(NAMED_ITEM));
    expect(named.length, 'the one record naming an item lost its item').toBe(1);
    expect(named[0]![1], 'and it still says which kind of record named it').toBe('mutation');
    expect(named[0]![2], 'and what it did to it').toContain('create');
  });
});
