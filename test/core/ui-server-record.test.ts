/**
 * The liveness record's rules, at the unit level.
 *
 * The property every case below is really defending is **all or nothing**. A
 * later task proves a server is alive by connecting to the port this file
 * names, so a record that were read half-way — right port, missing host, or a
 * `version` this build does not write — would send a probe somewhere nobody is
 * listening and the mechanism would conclude the server had died when it never
 * existed. `null` is the only honest answer to a file that cannot be understood
 * in full, and the third case is the one that pins it.
 *
 * Every case gets its OWN temporary directory, and every case passes it
 * explicitly. Nothing here may reach the developer's real `~/.my-context`:
 * `test/core/real-home-guard.test.ts` exists because a fixture once did, and it
 * turned 134 unrelated tests red with a message pointing nowhere near the cause.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import {
  clearUiServerRecord, readUiServerRecord, uiServerRecordPath, writeUiServerRecord,
  type UiServerRecord,
} from '../../src/core/ui-server-record.ts';

/**
 * A backslash workspace on purpose: this is Windows machine state, it is
 * JSON-encoded on the way out, and a round trip that mangled it would name a
 * workspace nothing matches.
 */
const RECORD: UiServerRecord = {
  version: 1, pid: 4242, host: '127.0.0.1', port: 58888,
  url: 'http://127.0.0.1:58888/', startedAt: 1_756_300_000_000, workspace: 'D:\\repo',
};

/** One throwaway global root per case, removed however the case ends. */
function inRoot(body: (root: string) => void): void {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-uirec-'));
  try {
    body(root);
  } finally {
    removeTree(root);
  }
}

test('a written record reads back exactly', () => {
  inRoot((root) => {
    writeUiServerRecord(RECORD, root);
    assert.deepEqual(readUiServerRecord(root), RECORD);
  });
});

test('no record at all is null, not a throw', () => {
  inRoot((root) => {
    assert.equal(readUiServerRecord(root), null);
  });
});

test('unparseable, wrong-version and wrong-shape records are all null', () => {
  for (const body of ['{ not json', '{"version":2,"port":1}', '{"version":1}', '[]']) {
    inRoot((root) => {
      writeFileSync(uiServerRecordPath(root), body, 'utf8');
      assert.equal(
        readUiServerRecord(root), null,
        `${body} was read as a usable record. A partly-trusted record sends the probe to a port `
        + `nobody is listening on, and the mechanism then reports a server dead that never ran.`,
      );
    });
  }
});

test('clear removes it, and clearing nothing is not an error', () => {
  inRoot((root) => {
    writeUiServerRecord(RECORD, root);
    clearUiServerRecord(root);
    assert.equal(existsSync(uiServerRecordPath(root)), false);
    // Already-gone is the goal state. The probe clears a stale record it has
    // just disproved, and two probes racing must not turn the second into an
    // error on a hook that has to exit 0.
    clearUiServerRecord(root);
  });
});

test('the write is atomic — no temp file survives a completed write', () => {
  inRoot((root) => {
    writeUiServerRecord(RECORD, root);
    assert.deepEqual(readdirSync(root), ['ui-server.json']);
  });
});

test('the default root follows MYCONTEXT_UI_SESSIONS_DIR, so no suite can reach the real home', () => {
  // The env override is the reason a caller that passes no root — `src/ui/server.ts`
  // and the Stop hook both will — cannot write into the developer's home during a
  // run. `pin-rendering.ts` sets this variable for the whole suite; asserted here
  // rather than assumed, because the day it stops being honoured the damage lands
  // in a file this test does not name.
  const previous = process.env['MYCONTEXT_UI_SESSIONS_DIR'];
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-uirec-env-'));
  process.env['MYCONTEXT_UI_SESSIONS_DIR'] = root;
  try {
    assert.equal(uiServerRecordPath(), path.join(root, 'ui-server.json'));
    // And an explicit root still wins over it, or Task 3's tests could not hold
    // two roots apart within one process.
    assert.equal(uiServerRecordPath('X:\\elsewhere'), path.join('X:\\elsewhere', 'ui-server.json'));
  } finally {
    if (previous === undefined) delete process.env['MYCONTEXT_UI_SESSIONS_DIR'];
    else process.env['MYCONTEXT_UI_SESSIONS_DIR'] = previous;
    removeTree(root);
  }
});
