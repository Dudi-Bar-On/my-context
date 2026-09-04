/**
 * The STATIC half of the no-writes enforcement (spec §2, §6; plan Task 14).
 *
 * WHAT IT PROVES: the set of write symbols BOUND by a module under `src/ui/`
 * is exactly the set the owner ruled in, and that set has one member — the
 * refusal record in `src/ui/security.ts` (owner ruling B4, plan §0.6). It is
 * the mechanism behind the §8 risk row "a UI write silently voids the user's
 * Bash deny rules": the deny rules match command STRINGS, an HTTP route is not
 * a command string, so the only acceptable number of write-capable routes is
 * the number the owner ruled, and no other.
 *
 * The unit of the ban is the SYMBOL, not the file (owner ruling, Task 14).
 * `revision-log.ts` imports only `readJsonlFile` from `jsonl-log.ts`, which
 * also exports three writers; `focus.ts` and `seen-file.ts` are imported for
 * `readFocus` and `readSeen` and also export writers. Banning the files would
 * need an allow-list, and an allow-list grows into a row of holes nobody
 * re-examines.
 *
 * The SCOPE of the ban is `src/ui/` and the re-export chains its bindings
 * resolve through (owner ruling 2026-08-20, plan §0.5). Applied to the whole
 * reachable graph it was red on day one, on `focus.ts` binding `recordAudit`
 * and `seen-file.ts` binding `appendJsonlLine` — while `readFocus` and
 * `readSeen`, the functions the read model actually calls, write nothing. That
 * is guilt by co-location, not evidence that the UI writes.
 *
 * Assertion 2 is an EQUALITY, not an emptiness check. A second write binding
 * fails; so does deleting the ruled one. An allow-list is a set a test agrees
 * not to look at and can only grow; an exact set fails in both directions and
 * cannot be extended without a diff that reads as exactly what it is.
 *
 * ── THE TABLE'S MEMBERSHIP IS DERIVED, NOT REMEMBERED (2026-08-31) ─────────
 *
 * `WRITERS` had two hand-kept halves and only one of them was ever checked. Its
 * CONTENTS have a test; its MEMBERSHIP had nothing, so a module that wrote and
 * was not named at all was judged a NON-writer by `isWriter` and `src/ui/` could
 * bind it with this file green. That is not hypothetical twice over:
 * `core/ui-server-record.ts` did it on 2026-08-27, and `ui/execute-effect.ts`
 * was still doing it four days later.
 *
 * Membership is now DERIVED from the property that actually makes something a
 * writer — it calls, by a name it imported from `node:fs`, an API that mutates
 * the filesystem — over the whole of `src/`. See the derivation section below
 * for the property, its scope, and the three things it deliberately cannot see.
 * The symbol lists stay hand-written, because deciding WHICH exports of a
 * writing module carry the write is a judgement; what is no longer possible is
 * a writing module nobody named.
 *
 * ── HOW `import type` IS TREATED, AND WHY ──────────────────────────────────
 *
 * A type-only import is not a runtime edge, and this file treats it as one
 * only where that is provably true. `tsconfig.json` sets
 * `verbatimModuleSyntax: true` and `erasableSyntaxOnly: true`, which fixes the
 * erasure semantics exactly:
 *
 *   - `import type { X } from './m.ts';`  — the WHOLE STATEMENT is erased. The
 *     module is never loaded. It is therefore NOT a graph edge and NOT a
 *     binding: this walk does not follow it and does not check it.
 *   - `import { type X, y } from './m.ts';` — only the SPECIFIER is erased.
 *     The statement survives as `import { y } from './m.ts';`, so the module
 *     IS loaded. This walk follows the edge and drops only the `type X`
 *     binding.
 *
 * Anything looser would let a value import be laundered as a type; anything
 * stricter would redden the suite on types that cost nothing at runtime — the
 * `type Workspace`, `type Item` and `type JsonResult` the read model imports
 * on every screen.
 *
 * The choice is made to FAIL LOUDLY rather than be trusted, in both
 * directions, by two tests below:
 *
 *   - `a writer imported as a type is still a writer` — every banned symbol is
 *     verified to be a `function`/`const`/`class` export, i.e. a VALUE. So a
 *     `src/ui/` module naming one of them in a type-only position is not a
 *     type, it is a value wearing the one costume this walk is built to skip,
 *     and it fails with its own message.
 *   - `nothing in the graph binds an identifier literally named "type"` — the
 *     one shape that would make the classifier read a value statement as a
 *     type statement (`import type from './m.ts'`, `{ type }`, `{ x as type }`)
 *     is refused rather than silently mis-read.
 *
 * ── WHAT THIS CANNOT SEE, said plainly so a green run is not over-read ─────
 *
 * It proves WHICH symbols a module under `src/ui/` BINDS. It cannot prove when
 * they are CALLED, nor that the UI does not otherwise WRITE: a core read that
 * writes internally, or a module that writes at import time, leaves no import
 * line to look at. That is not hypothetical here — `Store.open` self-heals on
 * corruption by deleting the database and both journals
 * (`core/store.ts` · `rmSync(dbPath, { force: true });` · ~345), which is why
 * this server is routed to `Store.openReadOnlyChecked`. The invariant itself
 * is proved at RUNTIME, in `test/ui/server-e2e.test.ts`: `the read surface
 * changes not one byte of the corpus`. Neither test may be quoted for the
 * other's claim.
 *
 * ── A MEASURED FACT ABOUT THE GRAPH, RECORDED BECAUSE IT SURPRISES ─────────
 *
 * The reachable graph from `src/ui/server.ts` DOES contain `src/core/mutate.ts`
 * today. It arrives by `read-model.ts` → `help/index.ts` → `mcp/tools.ts`:
 * `help/index.ts` builds the `tools` help topic from the MCP registry
 * (`help/index.ts` · `import { createRegistry } from '../mcp/tools.ts';` · ~15)
 * and `mcp/tools.ts` binds three writers
 * (`mcp/tools.ts` · `createItem, supersedeItem, updateItem,` · ~12).
 * That does NOT violate the ban, which is scoped to `src/ui/` bindings by the
 * ruling above, and no assertion here is written against it — a module-level
 * ban was rejected twice (plan §0.5) and re-adding one by the back door is not
 * this task's to do. It is recorded because the plan's own Architecture
 * paragraph says the server's "runtime import graph reaches only read
 * functions", and that sentence is not true of the tree this test runs on.
 *
 * What IS asserted, because it is a single named entry point rather than a set
 * of co-located writers, is that `src/cli/index.ts` is never reachable. Loading
 * it is not a co-location accident: it registers the entire mutating command
 * surface by side effect, as `help/index.ts` says in its own words —
 * (`help/index.ts` · `import src/cli/index.ts: loading it is what registers the commands.` · ~378).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');
const abs = (name: string): string => path.join(REPO, ...name.split('/'));
const rel = (file: string): string => path.relative(REPO, file).split(path.sep).join('/');

const ENTRY = abs('src/ui/server.ts');

/**
 * The ban's scope: a file is IN it when it lives under `src/ui/`. Chains
 * resolved OUT of it (into `src/core/`) are followed to place a symbol — that
 * is the "re-export reach" — but a core module's own bindings are not
 * themselves checked. Owner ruling 2026-08-20; the reasoning and the
 * limitation it accepts are in the header above and in plan §0.5.
 */
const UI_PREFIX = 'src/ui/';
const isUiModule = (file: string): boolean => rel(file).startsWith(UI_PREFIX);

/** (defining module → the symbols in it that write). The table in the plan. */
const WRITERS: Record<string, string[]> = {
  'src/core/mutate.ts': ['createItem', 'updateItem', 'supersedeItem'],
  'src/core/relations.ts': ['linkItems', 'unlinkItems'],
  'src/core/revision.ts': ['stageRevision', 'promoteRevision', 'discardRevision'],
  'src/core/jsonl-log.ts': ['appendJsonlLine', 'ensureLogDir', 'healTornTail'],
  'src/core/audit.ts': ['recordAudit'],
  'src/core/focus.ts': ['writeFocus', 'clearFocus', 'setFocus', 'unsetFocus'],
  'src/core/seen-file.ts': ['appendSeen'],
  // Reached from 2026-08-22, when `/api/select` began passing the hook's fifth
  // narrowing input and bound `resolveCarry`. Both modules are the same shape
  // as `focus.ts` and `seen-file.ts`: a reader the UI needs, sitting in a file
  // that also exports the writer for the same state. The reader is why the
  // edge exists; naming the writer is what keeps the edge from widening
  // quietly into one.
  'src/core/continuity.ts': ['setCarrySource'],
  'src/core/session-names.ts': ['setSessionName'],
  // Reached from 2026-08-23, when `startUiServer` began persisting the digest
  // of the token it mints so that a tab open across a restart is not locked
  // out for good. Named here BEFORE it was ruled in, and the assertion below
  // went red exactly as it should have: an undeclared writer in this graph is
  // the failure mode this table exists to make loud, and a new module quietly
  // widening the surface would otherwise have shipped green.
  'src/core/ui-sessions.ts': ['recordSessionDigest'],
  // Reached from 2026-08-27, when `startUiServer` began recording WHERE it is
  // listening so a hook can tell a live server from a crashed one's leftovers.
  // Named here BEFORE it was ruled in, the same way `recordSessionDigest` was
  // and for the same reason — and this time the naming was the whole finding.
  //
  // **The agent that added the write reported that this test STAYED GREEN**, and
  // was right to report it rather than add itself to `RULED_WRITES`. The ban
  // detects only writers this table already knows: `isWriter` consults it, so an
  // unnamed writing module resolves correctly, is placed correctly, and is then
  // judged a non-writer. `RULED_WRITES` is the second half of the check; this is
  // the first, and a hole here is silent by construction.
  //
  // That is `RULE-prove-your-measurement-can-see-every-kind-of-member` landing on
  // this file rather than on something it was measuring. Filed as
  // `plan:rulings` — the membership of this table should be DERIVED from what
  // the modules actually call, so an unnamed writer cannot hide again.
  //
  // `uiServerRecordPath` is bound by `src/ui/server.ts` too and is deliberately
  // NOT here: it builds a path for a disclosure message and writes nothing.
  'src/core/ui-server-record.ts': ['writeUiServerRecord', 'clearUiServerRecord'],
  // Owner ruling, 2026-08-27 — `DEC-the-ui-writes-budgets-and-the-simulator-always-meant-to`,
  // reversing `DEC-should-the-web-ui-be-allowed-to-write-config-json` narrowly:
  // "the UI writes BUDGETS… budgets ONLY." `writeBudgets` overwrites exactly the
  // `budgets` key of `.my_context/config.json`, byte-for-byte, and touches no
  // other file this ban would notice. See `RULED_WRITES` below for the three
  // properties that bound it before it was named here.
  'src/core/budgets-write.ts': ['writeBudgets'],

  /* ── The rows below arrived on 2026-08-31 from the DERIVED membership, and
   * not one of them was written by someone who remembered it. Every module
   * under `src/` that calls a filesystem-mutating API is now required to be a
   * key here (`every module in src/ that writes to the filesystem is named in
   * WRITERS`, below), and these eighteen are what that requirement produced
   * against the twelve-key table above.
   *
   * The KEYS are derived; the SYMBOL LISTS are still judgement, because
   * deciding WHICH exports of a writing module carry the write is a judgement —
   * `focus.ts` has been in this table since day one for exactly that reason,
   * and `readFocus` beside `writeFocus` is why the ban resolves symbols rather
   * than banning files. What is no longer possible is a module that writes and
   * is not named AT ALL, which is what `ui-server-record.ts` was on 2026-08-27
   * and what `execute-effect.ts` still was this morning. ─────────────────── */

  // `cmdExport` writes the archive through a local `writeArchive`. Its only
  // export is the two-statement `export { cmdExport };` form — see the VALUE
  // check below, which had to learn the same form `definedIn` already knew.
  'src/cli/commands/export.ts': ['cmdExport'],
  'src/cli/commands/statusline-install.ts': ['cmdStatuslineInstall', 'cmdStatuslineUninstall'],
  // Already banned outright by BANNED_ENTRY_MODULES, and named here anyway:
  // the entry ban is about LOADING it, this is about binding out of it, and a
  // module that is covered twice for two different reasons is not covered once.
  'src/cli/index.ts': ['runCli'],
  // The same shape as `focus.ts`, and the reason it matters: `watch-model.ts`
  // and `ask-model.ts` bind six readers out of this module. `openProjection`
  // discards the database and both journals on corruption — `Store.open`'s
  // self-heal, one file over — and `syncProjection`/`keepProjectionCurrent`
  // write the projection itself. The read surface is routed to
  // `openProjectionReadOnlyChecked`, which builds nothing and says so.
  'src/core/audit-db.ts': ['openProjection', 'syncProjection', 'keepProjectionCurrent'],
  'src/core/handover-ask.ts': ['writeLatch', 'resetAsksForWindow', 'discloseIgnoredAsk'],
  // `read-model.ts` binds `Ledger`, `LedgerUninitializedError` and
  // `readSnapshotMeta` from here. The writers are the snapshot pair.
  'src/core/ledger.ts': ['writeSnapshot', 'pruneSnapshots'],
  'src/core/lock.ts': ['acquireLock', 'reclaimStaleLock'],
  'src/core/rebuild.ts': ['writeItem', 'rebuild'],
  // `watch-model.ts` binds `classifyContext` and `readTee` from here; `writeTee`
  // and the stale-temp sweep are the writers sitting beside them.
  'src/core/statusline-tee.ts': ['writeTee', 'sweepStaleTeeTemps'],
  // EMPTY ON PURPOSE, and the one entry in this table that is. See
  // NO_BANNABLE_SYMBOL below: the writer here is `Store.open`, a static method,
  // and the importable symbol is the class it hangs off — which both
  // `read-model.ts` and `ask-model.ts` bind in order to call
  // `Store.openReadOnlyChecked`. Naming `Store` would redden the ban on a
  // binding the owner deliberately routed AROUND the write, which is the
  // day-one "guilt by co-location" ruling arriving one level down: inside a
  // class instead of inside a file.
  'src/core/store.ts': [],
  'src/core/ui-server-upkeep.ts': ['upkeepUiServer'],
  'src/core/window-state.ts': ['clearWindowState'],
  'src/ingest/session.ts': ['ensureIngestDir', 'saveSession', 'openIngestSession'],
  'src/lesson/derive.ts': ['saveStaging', 'stageRuleCandidates', 'acceptStagedRule', 'discardStagedRule'],
  'src/pack/dir-writer.ts': ['writeBundleDirectory'],
  'src/pack/import.ts': ['applyImport'],
  // `packs-model.ts` binds `importedDir` and `readImportRecords` from here.
  // `writeImportedHistory` and `quarantine` write through `appendJsonlLine`
  // rather than directly, and are named because they are writers, not because
  // the scan demanded them.
  'src/pack/imported-audit.ts': ['writeImportRecord', 'writeImportedHistory', 'quarantine'],
  // **THE ONE THE DERIVATION CAUGHT ON THE REAL TREE, 2026-08-31.** A module
  // under `src/ui/` that writes with no import line to look at: `deriveEffect`
  // makes a scratch directory under `tmpdir()`, copies the corpus into it, runs
  // the command there and removes it. `execute.ts` has bound it since the
  // Execute preview shipped and this ban said nothing, because a binding-shaped
  // ban can only see modules its table already names. Ruled in below.
  'src/ui/execute-effect.ts': ['deriveEffect'],
  // Landed 2026-09-04 with `mycontext config <name> --delete|--disable
  // [--yes]` (`rulings/20`) — the first command-line write to `config.json`.
  // `deleteCustomCategory` and `disableCategory` are the two exported symbols
  // that carry the write; `backupThenWrite`, `backupSuffix` and
  // `assertStillResolves` are the private helpers those two call and are not
  // themselves importable, so they carry nothing this ban needs to name.
  //
  // Widened the same day, `rulings/57`: `setConfigField` and
  // `unsetConfigListEntries` are the FIELD-level writers beside the two
  // CATEGORY-level ones above, calling the same private `backupThenWrite`
  // through the same fresh-read-then-`assertStillResolves` shape — named here
  // for the identical reason: a symbol this table does not name is a symbol
  // `src/ui/` could bind with this file green.
  'src/core/config.ts': [
    'deleteCustomCategory', 'disableCategory', 'setConfigField', 'unsetConfigListEntries',
  ],
};

const isWriter = (module: string, symbol: string): boolean =>
  (WRITERS[module] ?? []).includes(symbol);

/** Every banned name, regardless of where it is defined — used by the type guard. */
const BANNED_NAMES = new Set(Object.values(WRITERS).flat());

/**
 * The write bindings under `src/ui/` that the owner has ruled in — the WHOLE
 * set, in the exact form the ban assertion builds. Owner ruling B4,
 * 2026-08-20, plan §0.6: a refused request is recorded in the audit log with
 * the check that refused and the submitted `Host`/`Origin`, and that is the
 * one write this read-only surface performs.
 *
 * This is NOT an allow-list. It says nothing about WHEN `recordAudit` is
 * called; that it runs only on the refusal path and never on a served read is
 * proved in `test/ui/server-e2e.test.ts`.
 */
const RULED_WRITES = [
  // **NAMED AS ALLOWED, 2026-08-31, because the derived membership found it and
  // nothing else ever would have.** This binding is not new — `execute.ts` has
  // bound `deriveEffect` since the Execute preview shipped — but until
  // `src/ui/execute-effect.ts` became a key in WRITERS it was judged a
  // NON-writer and this equality never saw it. It is the second instance of the
  // exact defect `ui-server-record.ts` was on 2026-08-27, still live in the tree
  // four days later, and it was found by deriving rather than by remembering.
  //
  // It is ALLOWED, and this entry records the allowance rather than widening the
  // ban. Three properties bound it, each checkable rather than promised:
  //
  //   - it writes ONLY under `os.tmpdir()`. `mkdtempSync(path.join(tmpdir(),
  //     'myctx-effect-'))` is the root of everything it touches, the copy goes
  //     INTO that scratch, and the `finally` removes it. No corpus, no global
  //     root, no repository — which is why `server-e2e.test.ts`'s byte snapshot
  //     of the workspace has always held over this route and still does;
  //   - the copy is `dereference: true`, so a symlink in the corpus is copied as
  //     its CONTENT rather than followed back out to the real file. Without it
  //     this module writes to the real corpus — found by review 2026-08-28,
  //     reproduced immediately, and pinned by the `CopyTree` seam that exists so
  //     a test can assert the filter is wired;
  //   - it is a PREVIEW. It exists to show what a command would do before the
  //     confirm, so it runs the command against a copy precisely so that the
  //     original is not the thing being changed.
  //
  // What this entry does NOT claim is that a symbol-level ban could have caught
  // it: `execute-effect.ts` calls `cpSync`, `mkdtempSync` and `rmSync` itself,
  // and a module that writes with its own hands imports nothing for the walk to
  // read. The derived membership is what sees that; the binding is what this
  // line makes loud.
  'src/ui/execute.ts binds deriveEffect (defined in src/ui/execute-effect.ts)',
  // Owner ruling, 2026-08-26, and it is the one entry here that is a WRITE PATH
  // rather than a write beside one. `POST /api/execute` runs a catalogue
  // command, and spec 3.4 makes the record the thing that authorises it: the
  // `execute` row is appended BEFORE the process starts and a failure to write
  // it aborts with 500, so A RUN THAT CANNOT BE RECORDED DOES NOT HAPPEN.
  // `execute-done` is appended after it returns, carrying the exit code.
  //
  // This test is NARROWED here, not widened, and the difference is the whole
  // of it: what has stopped being true is "the UI never writes", which the
  // owner reversed deliberately with the residual in front of him twice. What
  // still holds, and still fails, is "a READ path never writes" — every read
  // module is untouched, and `execute.ts` is named one symbol at a time.
  //
  // Three properties bound it, each checkable rather than promised:
  //
  //   - the route composes NOTHING. `execute-catalogue.ts` rebuilds argv from
  //     the same catalogue the browser composed from and refuses anything not
  //     in that entry's declared shape, so no caller text becomes a command;
  //   - it runs behind a single-use nonce bound to the exact id and argv a
  //     confirm dialog rendered, so a page that never showed a confirm cannot
  //     mint one;
  //   - the write is APPEND-ONLY. A first draft amended the row in place with a
  //     whole-file rewrite and would have silently destroyed any row a hook
  //     appended in between; the attempted/complete pair replaced it.
  'src/ui/execute.ts binds recordAudit (defined in src/core/audit.ts)',
  // Owner ruling, 2026-08-27 (`DEC-the-ui-writes-budgets-and-the-simulator-always-meant-to`,
  // task `plan:budget seq:5`). The Simulate screen has always let a person drag
  // budgets until a setup fits; this is the missing step — APPLYING that
  // answer rather than making the reader retype it into a file the deny hook
  // (`pre-tool-use.ts`) still refuses an agent for touching.
  //
  // Three properties bound it, each checkable rather than promised:
  //
  //   - BUDGETS ONLY, structurally. `writeBudgets` (`src/core/budgets-write.ts`)
  //     spreads the parsed `config.json` object and reassigns exactly the
  //     `budgets` property; `categories`, `watchedDocs`, `profile`, `ui` and
  //     `handover` are never read into a name the function can reassign, so
  //     there is no line in it that could touch them;
  //   - behind the SAME single-use nonce a boundary command gets, minted by
  //     the SAME confirm GET and redeemed by the SAME `POST /api/execute` —
  //     `src/ui/execute.ts`'s `BUDGETS_ID` branch, not a second route and not
  //     a second place a nonce is minted;
  //   - every value is a validated positive integer or the write is refused
  //     BY NAME (`requirePositiveIntegerBudget`) — never silently clamped.
  //
  // Reachable only from a browser behind that confirm. No CLI command composes
  // it — `palette-defs.js` carries no entry for it and `resolveCommand` never
  // resolves `BUDGETS_ID` — so an agent scripting the CLI still cannot reach
  // this write; only a person, in the browser, past the confirm, can.
  'src/ui/execute.ts binds writeBudgets (defined in src/core/budgets-write.ts)',
  'src/ui/security.ts binds recordAudit (defined in src/core/audit.ts)',
  // Owner requirement, 2026-08-27:
  // `REQ-the-ui-server-is-running-whenever-the-owner-looks-or-it-says`. The
  // server writes down WHERE it is listening — `~/.my-context/ui-server.json`,
  // pid, host, bound port, url — so a hook can tell a live server from a
  // crashed one's leftovers and put it back up. Before it there was no liveness
  // record of ANY kind: no pidfile, no lockfile, no port probe, and a second
  // `mycontext ui --port 58888` surfaced a raw bind error.
  //
  // Three properties bound it, each checkable:
  //
  //   - it runs in `listen`'s callback, AFTER the socket binds and outside every
  //     request path, so no request can reach it — the same shape as
  //     `recordSessionDigest` below and unlike `recordAudit` above, which is on
  //     the refusal path and needs `server-e2e.test.ts` to bound WHEN;
  //   - what it writes is MACHINE state, not corpus state, and it lands in the
  //     global directory rather than a repository — a pid committed to git means
  //     something else on the next machine;
  //   - it is a HINT and is never believed. `core/ui-server-probe.ts` proves
  //     liveness on the port and deletes a record that fails, so the worst a
  //     wrong record can do is cost one probe.
  //
  // `clearUiServerRecord` is named beside it because removal is the other half:
  // a record left behind by an exit is exactly the stale claim the probe exists
  // to catch, and leaving the removal unruled would have made the tidy path the
  // undeclared one.
  'src/ui/server.ts binds clearUiServerRecord (defined in src/core/ui-server-record.ts)',
  // Owner ruling, 2026-08-23. `startUiServer` records `sha256(token)` for the
  // token it mints, so the NEXT process still recognises a tab that was open
  // across a restart. Before it, a restarted server locked out every open tab
  // permanently: the reload answered 403, the stale cookie was expired, and
  // every refresh after that answered 401 with no way back but a nonce printed
  // in the terminal — measured over real HTTP after three earlier fixes that
  // each addressed a different layer of the same symptom.
  //
  // Three properties keep this from widening the surface it sits in, and each
  // is checkable rather than promised:
  //
  //   - it runs BEFORE the socket binds, in `startUiServer`'s body, so it is
  //     not reachable from any request path — unlike `recordAudit` above, which
  //     is on the refusal path and needs `server-e2e.test.ts` to bound WHEN;
  //   - what it writes is a DIGEST, never a token, so the artefact is not a
  //     credential. `mode: 0o600` is not honoured on win32, so a plain token
  //     file would have been one;
  //   - it writes OUTSIDE every corpus, under the global root, which is why
  //     `server-e2e.test.ts`'s byte snapshot of the workspace still holds. That
  //     assertion is the one that would otherwise have caught this, and it
  //     still means what it says.
  'src/ui/server.ts binds recordSessionDigest (defined in src/core/ui-sessions.ts)',
  'src/ui/server.ts binds writeUiServerRecord (defined in src/core/ui-server-record.ts)',
];

/**
 * Modules the UI must never load, each for a reason that is about the module
 * itself and not about what happens to sit next to it in the file.
 *
 * `src/cli/index.ts` registers the whole mutating command surface as an import
 * side effect. `help/index.ts` says so in its own words — the registry "is
 * populated by side effect when `src/cli/index.ts` loads — it imports
 * `cli/commands/index.ts` AND registers the seven built-ins itself"
 * (`help/index.ts` · `AND registers the seven built-ins itself` · ~367) — and
 * `cli/commands/index.ts` is sixteen bare `import './x.ts';` statements.
 * So merely reaching it puts every writing command in the process. That is a
 * property of LOADING the module, which is exactly what an import walk can see,
 * unlike a writer that merely shares a file with a reader.
 */
const BANNED_ENTRY_MODULES = ['src/cli/index.ts'];

/* -------------------------------------------------------------------------- *
 * Reading source without a parser.
 *
 * Zero runtime dependencies and `erasableSyntaxOnly`: there is no parser
 * library to reach for, so this reads source with regexes. That is sound only
 * because two things are true, and both are asserted below rather than
 * assumed: the graph contains no dynamic escape hatch (`require(`, dynamic
 * `import(`) and no star form (`export *`, `import * as`), and every scan runs
 * over source whose COMMENTS, STRINGS AND TEMPLATES have been masked out.
 *
 * The masking is not optional garnish. Run against raw source, the obvious
 * statement regex matches 30 things across `src/` that are not statements at
 * all: prose in a doc comment, an error message quoting an import line, a
 * multi-line `export function` whose body happens to contain the word `from`
 * followed by a quote. One of them resolves to a specifier of `", target: "`,
 * which an unguarded walk hands to `readFileSync` — an ENOENT thrown out of a
 * test is not a failure, it is a test that never produced a verdict.
 * -------------------------------------------------------------------------- */

/**
 * Replace the interior of every comment, string literal and template literal
 * with spaces, preserving the file's length and every newline so that an index
 * into the masked text is an index into the original.
 *
 * Deliberately LINE-BOUNDED wherever it can be: a quote that does not close on
 * its own line is left alone rather than allowed to swallow the lines below it,
 * because the common cause of an unbalanced quote in this codebase is a regular
 * expression like `/['"]/`, and a masker that swallowed from there to the next
 * apostrophe would blank real import statements and shrink the graph in
 * silence. Only the two constructs that genuinely span lines — block comments
 * and template literals — carry state across one.
 *
 * Over-blanking is caught by `every relative specifier in the source is an edge
 * the walk followed` below; under-blanking is caught by `every module specifier
 * in the graph resolves`. Neither failure can be silent.
 */
/**
 * Can a `/` at `index` begin a regex literal rather than a division?
 *
 * The classic ambiguity, answered the conservative way: a regex may only follow
 * a token that CANNOT end an expression. Anything else — an identifier, a
 * number, `)`, `]` — is division and the `/` is left as code. Deciding wrongly
 * in this direction under-masks, which the specifier guard catches; deciding
 * wrongly in the other direction blanks real code, which is the failure this
 * whole masker exists to avoid.
 */
function startsRegex(source: string, index: number): boolean {
  let j = index - 1;
  while (j >= 0 && (source[j] === ' ' || source[j] === '\t')) j -= 1;
  if (j < 0 || source[j] === '\n') return true; // first thing on its line
  const prev = source[j]!;
  if ('(,=:[!&|?{};+*%^~<>'.includes(prev)) return true;
  // `return /re/`, `case /re/`, `typeof /re/`, `in`, `of` … — a word that
  // cannot END an expression is the only other place a regex may start.
  const word = /([A-Za-z_$][\w$]*)$/.exec(source.slice(0, j + 1));
  return word !== null
    && ['return', 'case', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
      'do', 'else', 'yield', 'await'].includes(word[1]!);
}

function maskNonCode(source: string): string {
  const out = source.split('');
  const blank = (from: number, to: number): void => {
    for (let i = from; i < to; i++) if (out[i] !== '\n') out[i] = ' ';
  };
  const lineEnd = (from: number): number => {
    const n = source.indexOf('\n', from);
    return n === -1 ? source.length : n;
  };
  const lineStart = (from: number): number => source.lastIndexOf('\n', from) + 1;
  /** Index of the next unescaped `ch` at or after `from`, within `limit`. */
  const closer = (ch: string, from: number, limit: number): number => {
    for (let i = from; i < limit; i++) {
      if (source[i] === '\\') { i += 1; continue; }
      if (source[i] === ch) return i;
    }
    return -1;
  };

  let i = 0;
  let inBlockComment = false;
  let inTemplate = false;
  while (i < source.length) {
    const stop = lineEnd(i);
    if (inBlockComment) {
      const end = source.indexOf('*/', i);
      if (end === -1 || end >= stop) { blank(i, stop); i = stop + 1; continue; }
      blank(i, end + 2);
      inBlockComment = false;
      i = end + 2;
      continue;
    }
    if (inTemplate) {
      const end = closer('`', i, stop);
      if (end === -1) { blank(i, stop); i = stop + 1; continue; }
      blank(i, end);
      inTemplate = false;
      i = end + 1;
      continue;
    }
    const c = source[i]!;
    const d = i + 1 < stop ? source[i + 1]! : '';
    // AN ESCAPED CHARACTER IS NEVER A DELIMITER, and `closer` has always known
    // that while this loop did not. `src/help/index.ts:299` is
    // `` `${silent.map((n) => `\`${n}\``).join(', ')} — ` `` — a nested template
    // whose inner backticks are escaped. Six backtick characters, two of them
    // escaped: `closer` skipped the escaped pair, this walk did not, and the
    // parity came out odd, so the last one opened a "template" that ran to line
    // 326 and blanked `export function updatableSurface` on the way. That file
    // is IN the server's graph, so the ban has been reading it mangled — it
    // survived only because the mangling starts below the imports. Found
    // 2026-08-31 by the over-blanking guard, on the first pass that read the
    // whole of `src/`.
    if (c === '\\') { i += 2; continue; }
    if (c === '/' && d === '/') { blank(i, stop); i = stop + 1; continue; }
    // A REGEX LITERAL IS NON-CODE TOO, and not masking it is what the docblock
    // above has been apologising for in two places. `/['"]/` was handled by
    // leaving an unbalanced QUOTE alone; the same file's `/['`$|&;<>…]/` and
    // `src/doctor/checks.ts:1690`'s `.replace(/`/g, '')` put a BACKTICK in the
    // same position, where "leave it alone" is not available — an unbalanced
    // backtick is how a real multi-line template begins. Masking the regex
    // itself answers all three at once, and it is the construct that was
    // missing rather than a special case for each.
    //
    // The regex-vs-division ambiguity is resolved CONSERVATIVELY: only after a
    // token that cannot end an expression. `a / b` and `(x) / 2` are division
    // and stay untouched; a `/` this cannot classify is left alone as well, so
    // the failure mode is under-masking (caught by `every relative specifier in
    // the source is an edge the walk followed`) rather than over-masking
    // (caught by `the masker did not blank a top-level declaration`).
    if (c === '/' && d !== '*' && startsRegex(source, i)) {
      let j = i + 1;
      let inClass = false;
      let closed = -1;
      for (; j < stop; j++) {
        const ch = source[j]!;
        if (ch === '\\') { j += 1; continue; }
        if (inClass) { if (ch === ']') inClass = false; continue; }
        if (ch === '[') { inClass = true; continue; }
        if (ch === '/') { closed = j; break; }
      }
      // Unclosed on its own line is not a regex — regex literals cannot span
      // lines — so it falls through to be read as whatever it really is.
      if (closed !== -1) { blank(i + 1, closed); i = closed + 1; continue; }
    }
    if (c === '/' && d === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end === -1 || end >= stop) { blank(i, stop); inBlockComment = true; i = stop + 1; continue; }
      blank(i, end + 2);
      i = end + 2;
      continue;
    }
    if (c === '`') {
      const end = closer('`', i + 1, stop);
      // A BACKTICK INSIDE A REGEX CHARACTER CLASS IS NOT A TEMPLATE, and this
      // is the same correction the quote branch below already carries, arriving
      // one character over. The docblock names `/['"]/` as the reason an
      // unbalanced quote is left alone; `src/cli/commands/statusline-install.ts`
      // holds `/['`$|&;<>(){}[\]*?!%\r\n]/` — the shell-metacharacter class —
      // and the backtick in it opened a "template" that swallowed 10 lines,
      // including `export function cmdStatuslineInstall` and the `mkdirSync`
      // and `writeFileSync` beside it. Found 2026-08-31 by the derived
      // membership scan, which is the first thing in this file to read modules
      // outside the server's graph; the over-blanking guard below is what
      // stops the next one being silent.
      //
      // The test is deliberately narrow: an UNCLOSED `[` before it on this
      // line AND a `]` after it on this line. A real multi-line template
      // opener — `spawn(node, ['-e', ` at end of line — has no `]` after it,
      // so it still opens, which is what keeps this from becoming the
      // "leave every backtick alone" rule that would blank nothing.
      if (end === -1) {
        const before = source.slice(lineStart(i), i);
        const openBracket = before.lastIndexOf('[');
        const inCharClass = openBracket !== -1
          && !before.slice(openBracket + 1).includes(']')
          && source.slice(i + 1, stop).includes(']');
        if (inCharClass) { i += 1; continue; }
        blank(i + 1, stop); inTemplate = true; i = stop + 1; continue;
      }
      blank(i + 1, end);
      i = end + 1;
      continue;
    }
    if (c === "'" || c === '"') {
      const end = closer(c, i + 1, stop);
      // Unbalanced on this line: almost always a regex character class or an
      // apostrophe, never a string. Leave it, and leave the lines below it.
      if (end === -1) { i += 1; continue; }
      blank(i + 1, end);
      i = end + 1;
      continue;
    }
    i += 1;
  }
  return out.join('');
}

interface Specifier {
  /** The name the SOURCE module exports. */
  exported: string;
  /** The name the IMPORTING module binds it as. */
  local: string;
  /** `{ type X }` — erased by `verbatimModuleSyntax`, so not a runtime binding. */
  typeOnly: boolean;
}

interface Statement {
  kind: 'import' | 'export';
  /** `import type …` / `export type …`: erased whole, so not a runtime edge. */
  typeOnly: boolean;
  named: Specifier[];
  /** `import * as ns` / `export *` / `export * as ns`. */
  star: boolean;
  /** `import Default from …` — the project has no default exports. */
  defaultBinding: string | null;
  /** The module specifier as written, or `null` for a bare `export { … };`. */
  spec: string | null;
  /** Line the statement starts on. */
  line: number;
  /** Line the SPECIFIER sits on — not the same for a multi-line clause. */
  specLine: number;
  text: string;
}

/**
 * A module's source in both forms. The scans run over `masked`; the specifier
 * is read back out of `raw` at the same offsets, because masking blanks string
 * interiors and a module specifier IS a string. Handing a scan its own masked
 * text as the original is how a resolver ends up asking the filesystem for a
 * path made of spaces.
 */
interface Source {
  masked: string;
  raw: string;
}

const sourceOf = (raw: string): Source => ({ masked: maskNonCode(raw), raw });

/**
 * One statement's clause is bounded by `[^;]` on purpose. A lazy `[\s\S]*?`
 * spans whatever it must to find the next `from '…'`, which across this
 * codebase means swallowing entire function bodies and reporting their braces
 * as import specifiers. A clause that reaches a `;` has left its statement.
 */
const FROM_STATEMENT =
  /(?:^|\n)[ \t]*(import|export)\b([^;]*?)\bfrom[ \t]*(['"])([^'"]*)\3/g;
/** `import './side-effect.ts';` — an edge with no bindings. `cli/commands/index.ts` is eighteen. */
const SIDE_EFFECT_IMPORT = /(?:^|\n)[ \t]*import[ \t]*(['"])([^'"]*)\1[ \t]*;/g;
/** `export { A, B as C };` — the second half of the two-statement re-export. */
const BARE_EXPORT = /(?:^|\n)[ \t]*export[ \t]*\{([^}]*)\}[ \t]*;/g;

const lineOf = (text: string, index: number): number =>
  text.slice(0, index).split('\n').length;

function parseClause(clause: string): Pick<Statement, 'named' | 'star' | 'defaultBinding'> {
  const braces = /\{([^}]*)\}/.exec(clause);
  const outsideBraces = braces === null ? clause : clause.slice(0, braces.index);
  const star = outsideBraces.includes('*');
  const named: Specifier[] = [];
  if (braces !== null) {
    for (const piece of braces[1]!.split(',')) {
      const spec = piece.trim();
      if (spec === '') continue;
      const typeOnly = /^type\s+\S/.test(spec);
      const body = typeOnly ? spec.replace(/^type\s+/, '') : spec;
      const as = /^(\S+)\s+as\s+(\S+)$/.exec(body);
      if (as) named.push({ exported: as[1]!, local: as[2]!, typeOnly });
      else named.push({ exported: body, local: body, typeOnly });
    }
  }
  const bareDefault = /^\s*([A-Za-z_$][\w$]*)\s*(?:,|$)/.exec(outsideBraces);
  return { named, star, defaultBinding: bareDefault === null ? null : bareDefault[1]! };
}

/** Every `import`/`export … from` statement in one source, in order. */
function statementsIn(src: Source): Statement[] {
  const { masked, raw } = src;
  const out: Statement[] = [];
  for (const m of masked.matchAll(FROM_STATEMENT)) {
    const clause = m[2]!;
    // A clause that swallowed the start of another statement is not a clause.
    if (/\n[ \t]*(?:import|export)\b/.test(clause)) continue;
    const typeOnly = /^\s*type\s+\S/.test(clause);
    const specStart = m.index + m[0].length - m[4]!.length - 1;
    out.push({
      kind: m[1] as 'import' | 'export',
      typeOnly,
      spec: raw.slice(specStart, specStart + m[4]!.length),
      line: lineOf(masked, m.index) + (m[0].startsWith('\n') ? 1 : 0),
      specLine: lineOf(masked, specStart),
      // Quoted from RAW, never from the masked copy: a failure message that
      // names `export * from ' '` has told the reader nothing.
      text: raw.slice(m.index, m.index + m[0].length).trim().replace(/\s+/g, ' ').slice(0, 120),
      ...parseClause(typeOnly ? clause.replace(/^\s*type\s+/, '') : clause),
    });
  }
  for (const m of masked.matchAll(SIDE_EFFECT_IMPORT)) {
    const specStart = m.index + m[0].indexOf(m[1]!, 1) + 1;
    out.push({
      kind: 'import',
      typeOnly: false,
      named: [],
      star: false,
      defaultBinding: null,
      spec: raw.slice(specStart, specStart + m[2]!.length),
      line: lineOf(masked, m.index) + (m[0].startsWith('\n') ? 1 : 0),
      specLine: lineOf(masked, specStart),
      text: raw.slice(m.index, m.index + m[0].length).trim(),
    });
  }
  return out;
}

/**
 * Resolve a module specifier the way Node does for this project, and say so
 * when it cannot. The house rule is an explicit `.ts` extension on every
 * relative import; the extra candidates exist so that the day someone writes
 * `./m` or `./m.js` the walk REPORTS it instead of walking a shorter graph and
 * reporting nothing, which is the shape of a checker that examines no files.
 */
function resolveSpec(fromFile: string, spec: string): string | null {
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [
    base,
    `${base}.ts`,
    base.replace(/\.js$/, '.ts'),
    path.join(base, 'index.ts'),
  ];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

interface Graph {
  /** Reachable module → its source, masked and raw. */
  files: Map<string, Source>;
  statements: Map<string, Statement[]>;
  /** Specifiers that named nothing on disk. A hole in the walk, never a pass. */
  unresolvedSpecs: string[];
}

/**
 * Every module reachable from `entry` at RUNTIME. A whole-statement
 * `import type … from` is not a runtime edge and is not followed: the module is
 * never loaded, so it cannot execute anything. A statement with only
 * per-specifier `type` markers IS followed — `verbatimModuleSyntax` keeps the
 * statement and therefore the load.
 */
function buildGraph(entry: string): Graph {
  const files = new Map<string, Source>();
  const statements = new Map<string, Statement[]>();
  const unresolvedSpecs: string[] = [];
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (files.has(file)) continue;
    const src = sourceOf(readFileSync(file, 'utf8'));
    files.set(file, src);
    const stmts = statementsIn(src);
    statements.set(file, stmts);
    for (const s of stmts) {
      if (s.spec === null || !s.spec.startsWith('.')) continue; // node: builtins only
      if (s.typeOnly) continue; // erased whole: never loaded
      const target = resolveSpec(file, s.spec);
      if (target === null) {
        unresolvedSpecs.push(`${rel(file)}:${s.line} imports '${s.spec}', which names no file`);
        continue;
      }
      queue.push(target);
    }
  }
  return { files, statements, unresolvedSpecs };
}

/**
 * The module that DEFINES `symbol`, following re-export chains. `null` when the
 * chain cannot be followed — which every caller treats as a failure, never as
 * an absence.
 *
 * Three chain shapes, and no others, because no others occur and a guess is
 * worse than a refusal:
 *   1. `export { X } from './m.ts'` / `export { X as Y } from './m.ts'`.
 *   2. `import { X } from './m.ts'` … `export { X };` — the two-statement form
 *      `revision.ts` actually uses, which an `export … from` regex cannot see.
 *   3. A local `export function|const|let|class X` — the chain ends.
 */
function definedIn(
  module: string,
  symbol: string,
  read: (file: string) => Source | null,
  resolve: (from: string, spec: string) => string | null = resolveSpec,
  seen: Set<string> = new Set(),
): string | null {
  const key = `${module}#${symbol}`;
  if (seen.has(key)) return null; // a cycle: refuse rather than loop
  seen.add(key);
  const src = read(module);
  if (src === null) return null;
  const text = src.masked;

  const exportedDecl = new RegExp(
    `^[ \\t]*export[ \\t]+(?:async[ \\t]+)?(?:function|const|let|var|class)[ \\t]+${symbol}\\b`, 'm');
  const localDecl = new RegExp(
    `^[ \\t]*(?:export[ \\t]+)?(?:async[ \\t]+)?(?:function|const|let|var|class)[ \\t]+${symbol}\\b`, 'm');

  const step = (spec: string, exported: string): string | null => {
    const next = resolve(module, spec);
    return next === null ? null : definedIn(next, exported, read, resolve, seen);
  };

  // 1. `export … from` — the one-statement form.
  for (const s of statementsIn(src)) {
    if (s.kind !== 'export' || s.spec === null || s.typeOnly) continue;
    const hit = s.named.find((n) => !n.typeOnly && n.local === symbol);
    if (hit) return step(s.spec, hit.exported);
  }

  // 2. Declared and exported right here: the chain ends.
  if (exportedDecl.test(text)) return module;

  // 3. `export { … };` — the two-statement form. The listed entry gives the
  //    LOCAL name; that local is either declared here or imported from
  //    somewhere, and it is the local — not the exported alias — that the
  //    import statement bound.
  for (const m of text.matchAll(BARE_EXPORT)) {
    for (const piece of m[1]!.split(',')) {
      const entry = piece.trim();
      if (entry === '') continue;
      const as = /^(\S+)\s+as\s+(\S+)$/.exec(entry);
      const local = as ? as[1]! : entry;
      const exported = as ? as[2]! : entry;
      if (exported !== symbol) continue;
      if (localDecl.test(text)) return module;
      for (const s of statementsIn(src)) {
        if (s.kind !== 'import' || s.spec === null || s.typeOnly) continue;
        const hit = s.named.find((n) => !n.typeOnly && n.local === local);
        if (hit) return step(s.spec, hit.exported);
      }
      return null;
    }
  }

  return null;
}

/**
 * UI modules that are deliberately NOT reachable from `src/ui/server.ts`, each
 * named with the entry point that DOES reach it.
 *
 * The reachability assertion below used to require the two sets to be equal,
 * and its message named the only two explanations its author had in view:
 * "either dead code or a route nobody wired". `src/ui/open.ts` (plan Task 15)
 * is a third, and it is the one case where being off the server's graph is the
 * REQUIREMENT rather than the defect: it spawns the user's browser, and
 * `server.ts` is a standalone server entry that must never spawn a process.
 * The module reaches the user through `mycontext ui`, which is a CLI command —
 * and the ban itself is unaffected, because the ban scans the whole directory
 * on disk (see the merged scan in the ban test) rather than the walk.
 *
 * This is a named exception and NOT an allow-list, because it is verified in
 * both directions: the module must still be absent from the server's graph, and
 * the entry point named here must really import it. An entry that stops being
 * true fails as itself.
 */
const OFF_SERVER_GRAPH: Record<string, string> = {
  'src/ui/open.ts': 'src/cli/commands/ui.ts',
};

/** Every `.ts` file that exists under `src/ui/`, whether or not anything imports it. */
function uiFilesOnDisk(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ts')) out.push(full);
    }
  };
  walk(abs('src/ui'));
  return out.sort();
}

/* -------------------------------------------------------------------------- *
 * DERIVING THE MEMBERSHIP OF `WRITERS`.
 *
 * `WRITERS` used to be hand-kept in both halves, and only one of them was ever
 * checked. The CONTENTS — does the named module still export the named symbol,
 * as a value — has a test below and has had one for a long time. The
 * MEMBERSHIP had nothing: a module that writes and is not named at all resolves
 * correctly, is placed correctly, and is then judged a NON-writer by `isWriter`,
 * so `src/ui/` can bind it and the equality assertion never notices. That is
 * how `core/ui-server-record.ts` shipped two writers into `server.ts` on
 * 2026-08-27 with this file 14/14 green, and how `ui/execute-effect.ts` sat in
 * the tree for four days after it.
 *
 * It is also the fifth instance this month of one shape: the approval-boundary
 * probe expanded four subcommanded commands when there were five; `verify:citations`
 * walked a hand-listed set of roots and missed both READMEs; the wave map was
 * authored and covered 51 of 126 tasks; the READMEs' audit-kind table said six
 * where the code had seven; `core/command-flags.ts` said 38 where the CLI
 * dispatches 39. Each was fixed the same way and so is this: stop listing,
 * start deriving.
 *
 * ── THE PROPERTY MEMBERSHIP IS DERIVED FROM ────────────────────────────────
 *
 * A module is a writer when **it calls, by a name it imported from `node:fs`,
 * an API that mutates the filesystem.** Both halves of that are read off the
 * source rather than assumed:
 *
 *   - the IMPORT gives the binding, so a local helper that happens to be called
 *     `rename` is not mistaken for `fs.rename`. `core/ui-server-record.ts` has
 *     exactly such a helper (`retryTransientRenameOnce(rename: () => T)`), and a
 *     bare name-match reports it as two writes that do not exist;
 *   - the CLASSIFICATION says which of those names mutate, and it is required
 *     below to cover every `node:fs` name the tree actually imports, so a new
 *     API cannot arrive and be silently treated as harmless.
 *
 * `openSync` is neither, on its own: `openSync(file, 'r')` mutates nothing and
 * `openSync(file, 'wx')` creates. It is classified by its FLAGS, read out of the
 * RAW source because masking blanks string interiors — and a flags argument this
 * scan cannot read as a literal counts as a WRITE, which is the safe direction.
 *
 * ── WHAT THIS SCAN CANNOT SEE, said plainly ────────────────────────────────
 *
 * Writes that do not go through `node:fs`. `Store`, `Ledger` and the audit
 * projection all write through `node:sqlite`, and `syncProjection` mutating a
 * database is invisible to every regex here — those symbols are named in
 * `WRITERS` by judgement, not because this scan asked for them. And a module
 * that writes only by CALLING one of these is not itself a member: `mutate.ts`,
 * `relations.ts` and `revision.ts` are all in the table and none of them touches
 * `node:fs`. That direction is checked separately below rather than left as a
 * gap — a key that is not a derived writer must reach one.
 *
 * ── SCOPE, AND WHY IT IS NOT `src/core/` ───────────────────────────────────
 *
 * The whole of `src/`. The plan said `src/core/` and the task item said
 * `src/core/` and `src/pack/`, and narrowing a derivation to the directories the
 * old table already covered is the same defect wearing a new hat. Measured over
 * the whole tree it is 6 modules wider than `core` + `pack`, and one of the six
 * is `src/ui/execute-effect.ts` — a UI module that writes with its own hands,
 * bound by `execute.ts`, and unnamed. A scan stopped at `src/core/` would have
 * gone green over it.
 * -------------------------------------------------------------------------- */

/** Every directory the ban resolves defining modules into: all of `src/`. */
const WRITE_ROOTS = ['src'];

/** `node:fs` exports that CHANGE bytes on disk. */
const FS_WRITE_APIS = new Set([
  'appendFileSync', 'chmodSync', 'chownSync', 'copyFileSync', 'cpSync', 'createWriteStream',
  'fchmodSync', 'fchownSync', 'ftruncateSync', 'futimesSync', 'linkSync', 'lutimesSync',
  'mkdirSync', 'mkdtempSync', 'renameSync', 'rmSync', 'rmdirSync', 'symlinkSync',
  'truncateSync', 'unlinkSync', 'utimesSync', 'writeFileSync', 'writeSync', 'writevSync',
]);

/** `node:fs` exports that do not. Listed so that an UNKNOWN name fails loudly. */
const FS_READ_APIS = new Set([
  'accessSync', 'closeSync', 'constants', 'createReadStream', 'existsSync', 'fstatSync',
  'globSync', 'lstatSync', 'opendirSync', 'readFileSync', 'readSync', 'readdirSync',
  'readlinkSync', 'readvSync', 'realpathSync', 'statSync', 'statfsSync', 'watch', 'watchFile',
]);

/** Neither, until the flags are read. */
const FS_FLAG_SENSITIVE_APIS = new Set(['openSync']);

/** `openSync`'s read-only modes. Everything else creates, truncates or appends. */
const READ_ONLY_OPEN_FLAGS = /^rs?$/;

interface WriteCall {
  api: string;
  line: number;
  /** For a flag-sensitive API: what the flags were, or why they could not be read. */
  note: string;
}

/**
 * Which `node:fs` names a module has IN SCOPE, and under what local names.
 *
 * `node:fs/promises` is reported rather than parsed: its exports are bare verbs
 * (`rm`, `rename`, `cp`, `open`, `link`) that collide with ordinary identifiers
 * all over this codebase, so matching them by name would report writes that are
 * not there. No module under `src/` imports it today — 57 statements, all
 * `node:fs` — and the assertion below fails the day one does, rather than
 * answering "no writes" for a module this scan cannot read.
 */
function fsSurfaceOf(src: Source): {
  locals: Map<string, string>;
  namespaces: string[];
  promiseImports: number[];
} {
  const locals = new Map<string, string>();
  const namespaces: string[] = [];
  const promiseImports: number[] = [];
  for (const s of statementsIn(src)) {
    if (s.spec === null || !s.spec.startsWith('node:fs')) continue;
    if (s.typeOnly) continue; // erased whole: no binding to call
    if (s.spec !== 'node:fs') { promiseImports.push(s.line); continue; }
    if (s.defaultBinding !== null) namespaces.push(s.defaultBinding);
    for (const n of s.named) if (!n.typeOnly) locals.set(n.local, n.exported);
  }
  return { locals, namespaces, promiseImports };
}

/** Every mutating `node:fs` call in one module, by the names that module bound. */
function writeCallsIn(src: Source): WriteCall[] {
  const { locals, namespaces } = fsSurfaceOf(src);
  const probes: { re: RegExp; api: string }[] = [];
  const mutates = (api: string): boolean =>
    FS_WRITE_APIS.has(api) || FS_FLAG_SENSITIVE_APIS.has(api);
  for (const [local, exported] of locals) {
    if (mutates(exported)) probes.push({ re: new RegExp(`\\b${local}\\s*\\(`, 'g'), api: exported });
  }
  for (const ns of namespaces) {
    for (const api of [...FS_WRITE_APIS, ...FS_FLAG_SENSITIVE_APIS]) {
      probes.push({ re: new RegExp(`\\b${ns}\\.${api}\\s*\\(`, 'g'), api });
    }
  }
  const out: WriteCall[] = [];
  for (const { re, api } of probes) {
    for (const m of src.masked.matchAll(re)) {
      const line = lineOf(src.masked, m.index);
      if (!FS_FLAG_SENSITIVE_APIS.has(api)) { out.push({ api, line, note: '' }); continue; }
      // Read from RAW: the masker blanks string interiors, and the flags ARE a
      // string. Handing this scan its own masked text is how `openSync(f, 'wx')`
      // becomes `openSync(f, '  ')` and a create is read as unreadable.
      const flags = /^[^()]*\([^,()]*,\s*(['"])([^'"]*)\1/.exec(src.raw.slice(m.index, m.index + 200));
      if (flags !== null && READ_ONLY_OPEN_FLAGS.test(flags[2]!)) continue;
      out.push({
        api,
        line,
        note: flags === null
          ? ' (flags are not a literal this scan can read, so it counts as a write)'
          : ` ('${flags[2]}')`,
      });
    }
  }
  return out.sort((a, b) => a.line - b.line || a.api.localeCompare(b.api));
}

/** Every `.ts` file under `WRITE_ROOTS`. */
function srcFilesOnDisk(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ts')) out.push(full);
    }
  };
  for (const root of WRITE_ROOTS) walk(abs(root));
  return out.sort();
}

interface Derivation {
  /** Module → its mutating calls. THE DERIVED MEMBERSHIP. */
  writers: Map<string, WriteCall[]>;
  /** How many modules the scan actually read — the anti-vacuity number. */
  scanned: number;
  /** Every `node:fs` name the tree imports or reaches through a namespace. */
  vocabulary: Map<string, string>;
  /** `node:fs/promises` imports, which this scan refuses to guess about. */
  promiseImports: string[];
}

let derived: Derivation | undefined;

/** The derivation, computed once per process — the whole tree is read for it. */
function derivation(): Derivation {
  if (derived) return derived;
  const writers = new Map<string, WriteCall[]>();
  const vocabulary = new Map<string, string>();
  const promiseImports: string[] = [];
  const files = srcFilesOnDisk();
  for (const file of files) {
    const src = sourceOf(readFileSync(file, 'utf8'));
    const { locals, namespaces, promiseImports: promises } = fsSurfaceOf(src);
    for (const line of promises) promiseImports.push(`${rel(file)}:${line}`);
    for (const exported of locals.values()) {
      if (!vocabulary.has(exported)) vocabulary.set(exported, rel(file));
    }
    // A namespace import puts the WHOLE module in scope, so the vocabulary
    // question is asked of the members actually reached rather than of the
    // import line, which names nothing.
    for (const ns of namespaces) {
      for (const m of src.masked.matchAll(new RegExp(`\\b${ns}\\.([A-Za-z_$][\\w$]*)`, 'g'))) {
        if (!vocabulary.has(m[1]!)) vocabulary.set(m[1]!, `${rel(file)} (via ${ns}.)`);
      }
    }
    const calls = writeCallsIn(src);
    if (calls.length > 0) writers.set(rel(file), calls);
  }
  derived = { writers, scanned: files.length, vocabulary, promiseImports };
  return derived;
}

/**
 * The one derived writer that has no symbol to ban, named with the reason.
 *
 * NOT an allow-list, and verified in both directions by its own test below: the
 * module must still be a derived writer, its `WRITERS` list must still be empty,
 * and — the assertion that carries the actual claim — every mutating call in it
 * must still sit inside the member named here. A write that appears in a
 * DIFFERENT member of `Store` fails, which is the case this entry would
 * otherwise silently cover.
 */
const NO_BANNABLE_SYMBOL: Record<string, { member: string; reason: string }> = {
  'src/core/store.ts': {
    member: 'static open(',
    reason:
      'the writer is `Store.open`\'s corruption self-heal, which deletes the database and both '
      + 'journals. It is a static METHOD, and the only importable symbol is the class it hangs '
      + 'off — which `read-model.ts` and `ask-model.ts` both bind in order to call '
      + '`Store.openReadOnlyChecked`. The unit of this ban is the symbol, so naming `Store` '
      + 'would refuse a binding the owner deliberately routed AROUND the write. That is the '
      + 'day-one guilt-by-co-location ruling one level down: inside a class, not inside a file. '
      + 'What bounds it instead is the header\'s own routing note and the runtime half in '
      + 'test/ui/server-e2e.test.ts',
  },
};

/**
 * Does `module` reach a derived writer through its own value imports?
 *
 * This is the OTHER direction, and it is derived rather than tabled. Three keys
 * in `WRITERS` — `mutate.ts`, `relations.ts`, `revision.ts` — never touch
 * `node:fs`: they write through `persist.ts` → `rebuild.ts`'s `writeItem`,
 * through `audit.ts`, and through `jsonl-log.ts`. They are real writers and they
 * are correctly in the table, but the scan cannot see them, so a stale entry
 * naming a module that has stopped writing entirely would linger unnoticed.
 * Requiring the chain to exist is what makes that fail.
 *
 * Returns the path taken, or `null` when there is none.
 */
function reachesADerivedWriter(module: string, writers: Set<string>): string[] | null {
  const queue: { file: string; trail: string[] }[] = [{ file: abs(module), trail: [module] }];
  const seen = new Set<string>([abs(module)]);
  while (queue.length > 0) {
    const { file, trail } = queue.shift()!;
    if (trail.length > 1 && writers.has(rel(file))) return trail;
    if (trail.length > 4 || !existsSync(file)) continue;
    for (const s of statementsIn(sourceOf(readFileSync(file, 'utf8')))) {
      if (s.spec === null || !s.spec.startsWith('.') || s.typeOnly) continue;
      if (s.named.length > 0 && s.named.every((n) => n.typeOnly)) continue;
      const next = resolveSpec(file, s.spec);
      if (next === null || seen.has(next)) continue;
      seen.add(next);
      queue.push({ file: next, trail: [...trail, rel(next)] });
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- *
 * The assertions.
 * -------------------------------------------------------------------------- */

test('every node:fs API the tree imports is classified, and the promise forms are refused', () => {
  // The vocabulary's own anti-vacuity guard, and it runs in the direction the
  // vocabulary can fail: SILENTLY. An fs export nobody classified is treated as
  // a non-writer by `writeCallsIn`, so a module whose only write is through it
  // drops out of the derived set and back into the blind spot this whole
  // section exists to close. Every name the tree actually imports has to be in
  // one of the two sets, by name, before its verdict means anything.
  const d = derivation();
  const unclassified = [...d.vocabulary]
    .filter(([name]) => !FS_WRITE_APIS.has(name) && !FS_READ_APIS.has(name)
      && !FS_FLAG_SENSITIVE_APIS.has(name))
    .map(([name, where]) => `${name} (first seen in ${where})`)
    .sort();
  assert.deepEqual(unclassified, [],
    'a name imported from `node:fs` is in neither FS_WRITE_APIS nor FS_READ_APIS. Put it in '
    + 'one — an unclassified API is read as harmless, so a module whose only write goes through '
    + 'it is derived as a non-writer and this ban stops covering it, in silence.');

  assert.deepEqual(d.promiseImports, [],
    'a module under src/ imports `node:fs/promises`, and this scan deliberately does not match '
    + 'its exports: they are bare verbs (`rm`, `rename`, `cp`, `open`) that collide with ordinary '
    + 'identifiers throughout this codebase, so matching them by name reports writes that are not '
    + 'there. Teach `writeCallsIn` to read the promise forms — do not delete this assertion, '
    + 'because until it is taught, every module using them derives as a non-writer.');

  // Both directions, so a classification that answered the same way for
  // everything cannot pass here.
  const seenWrite = [...d.vocabulary.keys()].filter((n) => FS_WRITE_APIS.has(n));
  const seenRead = [...d.vocabulary.keys()].filter((n) => FS_READ_APIS.has(n));
  assert.ok(seenWrite.length >= 5 && seenRead.length >= 5,
    `the tree imports ${seenWrite.length} classified write API(s) and ${seenRead.length} read `
    + 'API(s); it has been ~10 and ~9. A vocabulary that sees only one kind is not classifying.');
});

test('the masker did not blank a top-level declaration anywhere it scanned', () => {
  // The derivation's own over-blanking guard, and it is the direction this
  // scan fails SILENTLY in: a masker that blanks real code sees fewer write
  // calls, and fewer write calls is indistinguishable from a module that does
  // not write. `every relative specifier in the source is an edge the walk
  // followed` is the same guard for the reachable graph; this one covers the
  // whole of `src/`, which nothing in this file read until the membership was
  // derived — and the first pass over it found `cmdStatuslineInstall` and two
  // fs calls blanked by a backtick in a regex character class.
  //
  // A top-level declaration at column 0 is the cheapest thing to check that
  // cannot legitimately be inside a string, a comment or a template in this
  // codebase, and a whole line of it going blank is unambiguous.
  const blanked: string[] = [];
  let checked = 0;
  for (const file of srcFilesOnDisk()) {
    const raw = readFileSync(file, 'utf8');
    const maskedLines = maskNonCode(raw).split('\n');
    raw.split('\n').forEach((line, i) => {
      if (!/^(?:export |declare |function |class )/.test(line)) return;
      checked += 1;
      if (maskedLines[i]!.trim() === '') blanked.push(`${rel(file)}:${i + 1} ${line.trim().slice(0, 70)}`);
    });
  }
  assert.ok(checked >= 1200,
    `only ${checked} top-level declaration(s) were checked across ${WRITE_ROOTS.join(', ')}; `
    + 'there have been ~1760. A guard that examines nothing reports nothing blanked.');
  assert.deepEqual(blanked, [],
    'the masker blanked a line that is a top-level declaration in the source. Every scan in '
    + 'this file runs over masked text, so whatever else is on those lines — an import, an fs '
    + 'call — is invisible to it, and the derived membership below is reporting over a smaller '
    + 'program than the one that runs. Fix the masker; do not narrow the scan.');
});

test('every module in src/ that writes to the filesystem is named in WRITERS', () => {
  // THE DERIVED MEMBERSHIP. Before this, `isWriter` consulted a table nothing
  // filled, so a new writing module was judged a non-writer and `src/ui/` could
  // bind it with this file green — which is exactly what happened to
  // `core/ui-server-record.ts` and to `ui/execute-effect.ts`.
  const d = derivation();

  // A count first, because the two ways this can lie are "found no writers" and
  // "read no files", and only one of them looks like a bug.
  assert.ok(d.scanned >= 150,
    `the derivation read ${d.scanned} module(s) under ${WRITE_ROOTS.join(', ')}; there have been `
    + '~165. A scan that reads nothing names nothing, and then every module is a non-writer.');
  assert.ok(d.writers.size >= 20,
    `the derivation found ${d.writers.size} writing module(s); it has found 27 since it landed. `
    + 'A collapse means the scan stopped recognising fs calls, not that the code stopped writing.');

  const unnamed = [...d.writers]
    .filter(([module]) => !Object.hasOwn(WRITERS, module))
    .map(([module, calls]) =>
      `${module} — ${calls.map((c) => `${c.api}:${c.line}${c.note}`).join(', ')}`)
    .sort();
  assert.deepEqual(unnamed, [],
    'a module under src/ calls a filesystem write API and is not a key in WRITERS. Until it is '
    + 'named there, `isWriter` answers NO for every symbol it defines — so a src/ui/ module can '
    + 'bind its writer and the ban below stays green. Add the module with the symbols in it that '
    + 'write; the list is judgement, the KEY is not.');
});

test('a WRITERS key that does not call fs itself still reaches one that does', () => {
  // The other direction, so the table cannot keep an entry for a module that
  // has stopped writing. It is derived too — there is no third hand-kept list
  // of "indirect writers" here, because a list is what this file is removing.
  const d = derivation();
  const writers = new Set(d.writers.keys());
  const orphaned: string[] = [];
  const indirect: string[] = [];
  for (const module of Object.keys(WRITERS)) {
    if (writers.has(module)) continue;
    const trail = reachesADerivedWriter(module, writers);
    if (trail === null) orphaned.push(module);
    else indirect.push(`${module} → ${trail.slice(1).join(' → ')}`);
  }
  assert.deepEqual(orphaned, [],
    'a module is named in WRITERS, calls no filesystem write API of its own, and reaches no '
    + 'module that does. Either it has stopped writing — in which case the entry is covering '
    + 'nothing and should go — or it writes through something this walk cannot follow, which '
    + 'needs saying out loud rather than leaving as a table entry nobody can check.');

  // Anti-vacuity: this assertion is worthless if every key is a direct writer,
  // and it would then pass unchanged on the day one stopped being either.
  assert.ok(indirect.length >= 3,
    `only ${indirect.length} WRITERS key(s) write indirectly; mutate.ts, relations.ts and `
    + 'revision.ts have all been that shape since this table existed. Fewer means the walk '
    + 'stopped following the chain, not that the code changed.');
});

test('the derived writer with no symbol to ban is still exactly the one named', () => {
  const d = derivation();
  for (const [module, { member, reason }] of Object.entries(NO_BANNABLE_SYMBOL)) {
    const calls = d.writers.get(module);
    assert.ok(calls !== undefined,
      `${module} is excused from naming a symbol on the strength of a write it no longer has. `
      + 'Drop the entry — while it stands it excuses a module that is not doing the thing.');
    assert.deepEqual(WRITERS[module], [],
      `${module} names symbols in WRITERS now, so its NO_BANNABLE_SYMBOL entry describes a `
      + 'table that no longer exists. Delete the entry — never the assertion.');
    assert.ok(reason.length > 0, `${module} is excused with no reason given`);

    // The claim itself, verified rather than trusted: every write is inside the
    // member named above. A write that appears in a DIFFERENT member is one
    // this exemption would otherwise cover in silence — and the members beside
    // it are `openReadOnly` and `openReadOnlyChecked`, which the read surface
    // calls.
    const lines = sourceOf(readFileSync(abs(module), 'utf8')).masked.split('\n');
    const memberAt = lines.findIndex((l) => l.includes(member)) + 1;
    assert.ok(memberAt > 0, `${module} no longer declares \`${member}\``);
    const nextMember = lines.findIndex((l, i) => i + 1 > memberAt && /^\s+static\s/.test(l)) + 1;
    const end = nextMember > memberAt ? nextMember : lines.length + 1;
    const outside = calls
      .filter((c) => c.line < memberAt || c.line >= end)
      .map((c) => `${c.api}:${c.line}`);
    assert.deepEqual(outside, [],
      `${module} writes OUTSIDE \`${member}\` (lines ${memberAt}–${end - 1}). The exemption says `
      + 'the write is confined to that member and it no longer is, so the symbol the read '
      + 'surface binds may now carry a write. Name the writing symbol in WRITERS instead.');
  }
});

test('the walk examines a real graph — a report over nothing is the defect, not the proof', () => {
  const g = buildGraph(ENTRY);

  assert.deepEqual(g.unresolvedSpecs, [],
    'a module specifier named no file on disk. The walk stops there, so every module BELOW it '
    + 'went unexamined and this suite would report "0 violations" over a graph it never entered.');

  // A count, so a walk that quietly collapses to a handful of files fails.
  assert.ok(g.files.size >= 40,
    `the reachable graph is ${g.files.size} modules; it has been ~57 since server.ts landed. `
    + 'A sudden collapse means the walk stopped following edges, not that the code shrank.');

  // Every UI module ON DISK is examined, not merely the ones server.ts happens
  // to reach. The ruling says "the whole directory, not only server.ts": a
  // helper under src/ui/ that binds a writer for a route to call is the exact
  // thing this test exists to catch, and it must not become invisible by not
  // being wired up yet.
  const onDisk = uiFilesOnDisk().map(rel).sort();
  const reached = [...g.files.keys()].filter(isUiModule).map(rel).sort();
  const offGraph = Object.keys(OFF_SERVER_GRAPH).sort();
  assert.deepEqual(reached, onDisk.filter((m) => !offGraph.includes(m)),
    `src/ui/ holds ${onDisk.length} module(s), ${offGraph.length} of them named in `
    + `OFF_SERVER_GRAPH, and the walk from server.ts reached ${reached.length}. Every module `
    + 'on disk is checked by the ban below — see the merged scan in the ban test — but a UI '
    + 'module unreachable from the entry point and not named above is either dead code or a '
    + 'route nobody wired, and both are worth saying out loud.');

  // The exceptions, verified rather than trusted, in both directions.
  for (const [module, importer] of Object.entries(OFF_SERVER_GRAPH)) {
    assert.ok(onDisk.includes(module), `OFF_SERVER_GRAPH names ${module}, which is not on disk`);
    assert.equal(g.files.has(abs(module)), false,
      `${module} IS reachable from server.ts now, so its OFF_SERVER_GRAPH entry describes a `
      + 'graph that no longer exists. Delete the entry — never the assertion.');
    const importerStatements = statementsIn(sourceOf(readFileSync(abs(importer), 'utf8')));
    assert.ok(
      importerStatements.some((s) => s.kind === 'import' && !s.typeOnly && s.spec !== null
        && resolveSpec(abs(importer), s.spec) === abs(module)),
      `OFF_SERVER_GRAPH says ${importer} is what reaches ${module}, and it does not import it. `
      + 'Either the entry point moved or the module really is unreachable from anywhere, which '
      + 'is the case this assertion exists to report.');
  }

  for (const load of ['src/ui/read-model.ts', 'src/ui/security.ts', 'src/core/select.ts',
    'src/core/store.ts', 'src/help/index.ts']) {
    assert.ok(g.files.has(abs(load)), `${load} is not in the graph — the walk is scanning the wrong tree`);
  }
});

test('the UI never loads src/cli/index.ts', () => {
  const g = buildGraph(ENTRY);
  const present = BANNED_ENTRY_MODULES.filter((m) => g.files.has(abs(m)));
  assert.deepEqual(present, [],
    'a module on the banned-entry list is in the UI\'s runtime import graph. Loading '
    + 'src/cli/index.ts registers the whole mutating command surface as an import side effect, '
    + 'so reaching it puts every writing command in this process. Unlike a co-located writer, '
    + 'that is a property of the LOAD, which is what an import walk can actually see.');
});

test('no star form anywhere in the reachable graph', () => {
  const g = buildGraph(ENTRY);
  const stars: string[] = [];
  for (const [file, stmts] of g.statements) {
    for (const s of stmts) {
      if (s.star && s.spec !== null && s.spec.startsWith('.')) stars.push(`${rel(file)}:${s.line} ${s.text}`);
    }
  }
  assert.deepEqual(stars, [],
    'star imports/re-exports inside the UI graph. Neither `export *` nor `import * as` leaves a '
    + 'per-symbol fact for the resolver to check, and a star form silently treated as "no symbols" '
    + 'is a checker that passes by looking at nothing (INV-nothing-is-dropped-silently applies to '
    + 'the checker itself). This is whole-graph on purpose: it is not the ban, it is what makes '
    + 'reading source with a regex a sound way to answer anything.');
});

/**
 * The one dynamic import in the graph, named with the module it loads and the
 * reason the walk cannot be made to follow it.
 *
 * `src/ui/execute-catalogue.ts` loads the BROWSER's command catalogue so that
 * the server rebuilds argv from the same file the browser composed from — one
 * catalogue, because two would drift and the drift would be silent in the worst
 * direction: the browser showing one command in a confirm dialog while the
 * server ran another. A static import cannot typecheck (`allowJs` is off, so a
 * resolved `.js` module is an implicit `any` under `strict`), and a top-level
 * `await import` is additionally what keeps `resolveCommand` SYNCHRONOUS — an
 * `await` between "resolve the argv" and "redeem the nonce against that argv"
 * would open a seam in the one ordering the execute route's security rests on.
 *
 * **What sits outside this file's assertions is not unexamined.** The target is
 * a `.js` browser module this walk would never have entered anyway — it follows
 * `.ts` — and `test/ui/palette-lib.test.ts` holds it over its own bytes to
 * exactly the property that matters here: no network name, no dynamic
 * evaluation, no navigation and no import of any kind. The guarantee moved to a
 * test that can read that file; it did not evaporate.
 *
 * Verified in BOTH directions below, so a stale entry fails as itself.
 */
const DYNAMIC_EDGES: Record<string, string> = {
  'src/ui/execute-catalogue.ts': 'src/ui/public/lib/palette-defs.js',
};

test('no dynamic escape hatch anywhere in the reachable graph', () => {
  const g = buildGraph(ENTRY);
  const dynamic: string[] = [];
  const exempted = new Set<string>();
  for (const [file, { masked }] of g.files) {
    for (const m of masked.matchAll(/\brequire\s*\(/g)) dynamic.push(`${rel(file)}:${lineOf(masked, m.index)} require()`);
    for (const m of masked.matchAll(/[^.\w$]import\s*\(/g)) {
      if (Object.hasOwn(DYNAMIC_EDGES, rel(file))) { exempted.add(rel(file)); continue; }
      dynamic.push(`${rel(file)}:${lineOf(masked, m.index)} dynamic import()`);
    }
  }
  assert.deepEqual(dynamic, [],
    'the static walk cannot see through these. A `require(` or a dynamic `import(` is an edge '
    + 'with no statement to read, so the module it loads is outside every assertion in this file. '
    + 'If it is deliberate, name it in DYNAMIC_EDGES with the module it loads and the test that '
    + 'holds that module instead — do not delete the assertion.');

  // The exemption is not an allow-list. An entry whose file no longer has a
  // dynamic import is an exemption for something that stopped happening, and it
  // would silently cover the next one somebody adds to that file.
  assert.deepEqual([...exempted].sort(), Object.keys(DYNAMIC_EDGES).sort(),
    'a DYNAMIC_EDGES entry names a file with no dynamic import left in it');
  for (const [file, target] of Object.entries(DYNAMIC_EDGES)) {
    assert.ok(existsSync(path.join(REPO, target)),
      `${file}'s dynamic edge names ${target}, which is not on disk`);
  }
});

test('every relative specifier in the source is an edge the walk followed', () => {
  // The masker's own guard, and it runs in the direction the masker can fail:
  // over-blanking. If a comment/string/template boundary is mis-read and a real
  // import statement is blanked, the walk silently loses that module and every
  // module below it — and a smaller graph reports fewer violations, which is
  // indistinguishable from a clean tree. So: scan the RAW text for anything
  // shaped like a relative module specifier and require that each one is
  // accounted for by a statement the walk actually parsed.
  const g = buildGraph(ENTRY);
  const missed: string[] = [];
  for (const [file, { raw }] of g.files) {
    const parsed = new Set((g.statements.get(file) ?? []).map((s) => `${s.specLine}:${s.spec}`));
    for (const m of raw.matchAll(/from[ \t]*(['"])(\.[^'"]*)\1|import[ \t]*(['"])(\.[^'"]*)\3[ \t]*;/g)) {
      const spec = m[2] ?? m[4]!;
      const line = lineOf(raw, m.index);
      if (!parsed.has(`${line}:${spec}`)) missed.push(`${rel(file)}:${line} '${spec}'`);
    }
  }
  assert.deepEqual(missed, [],
    'a relative module specifier appears in the source at a line the walk did not parse as a '
    + 'statement. Either the comment/string masker blanked a real import (the graph is smaller '
    + 'than the program, so every assertion here is weaker than it reads), or a doc comment quotes '
    + 'an import line and this guard needs to learn about it. Both need a human; neither is a pass.');
});

test('src/ui/ binds exactly the write symbols the owner ruled in, and no others', () => {
  const g = buildGraph(ENTRY);
  const read = (f: string): Source | null => {
    const cached = g.files.get(f);
    if (cached !== undefined) return cached;
    if (!existsSync(f)) return null;
    return sourceOf(readFileSync(f, 'utf8'));
  };

  // The whole directory, per the ruling — reachable or not. `buildGraph` gives
  // the reachable ones their masked source for free; anything on disk it did
  // not reach is read here so that no UI module escapes the ban by not being
  // wired up yet.
  const uiFiles = new Map<string, Statement[]>();
  for (const file of uiFilesOnDisk()) {
    const cached = g.statements.get(file);
    if (cached !== undefined) { uiFiles.set(file, cached); continue; }
    uiFiles.set(file, statementsIn(sourceOf(readFileSync(file, 'utf8'))));
  }
  assert.ok(uiFiles.size >= 7,
    `only ${uiFiles.size} src/ui/ module(s) are being scanned; there have been 7 since server.ts `
    + 'landed. A ban that scans nothing reports no violations.');

  const bound: string[] = [];
  const unresolved: string[] = [];
  let specifiersChecked = 0;
  for (const [file, stmts] of uiFiles) {
    for (const s of stmts) {
      if (s.spec === null || !s.spec.startsWith('.')) continue;
      if (s.typeOnly) continue; // erased whole; a type cannot be called
      const target = resolveSpec(file, s.spec);
      if (target === null) {
        unresolved.push(`${rel(file)}:${s.line} imports from '${s.spec}', which names no file`);
        continue;
      }
      if (s.defaultBinding !== null) {
        unresolved.push(
          `${rel(file)}:${s.line} binds a DEFAULT export from '${s.spec}' as `
          + `${s.defaultBinding}; no module in src/ has a default export, so this symbol cannot be placed`);
      }
      for (const { exported, local, typeOnly } of s.named) {
        if (typeOnly) continue;
        specifiersChecked += 1;
        const home = definedIn(target, exported, read);
        if (home === null) {
          unresolved.push(`${rel(file)}:${s.line} imports ${exported} from '${s.spec}'`);
          continue;
        }
        if (isWriter(rel(home), exported)) {
          bound.push(
            `${rel(file)} binds ${exported}${local === exported ? '' : ` as ${local}`} `
            + `(defined in ${rel(home)})`);
        }
      }
    }
  }

  assert.deepEqual(unresolved, [],
    'these bindings could not be traced to a defining module. An unplaced symbol is a hole in '
    + 'this analysis, not a pass: the ban cannot say whether it is a writer.');

  // A count, because the two ways this test can lie are "found no writers" and
  // "looked at no symbols", and only one of them looks like a bug.
  assert.ok(specifiersChecked >= 40,
    `only ${specifiersChecked} value specifier(s) under src/ui/ were resolved; there have been `
    + '~50 since server.ts landed. A ban that resolves nothing binds nothing.');

  assert.deepEqual(bound.sort(), RULED_WRITES,
    'the write bindings under src/ui/ are not exactly the ruled set. MORE than RULED_WRITES: '
    + 'something new writes, and it needs an owner ruling and a plan §0 row, not an entry added '
    + 'here. FEWER: the ruled refusal record (plan §0.6) has been deleted, which is a ruling '
    + 'silently dropped. Either way this is NOT proof that the UI never writes — see the header, '
    + 'and test/ui/server-e2e.test.ts for the runtime half.');
});

test('a writer imported as a type is still a writer', () => {
  // The other half of the `import type` decision. This file skips type-only
  // imports because `verbatimModuleSyntax` erases them, which is exactly the
  // costume a value import would wear to get past the ban. Every banned symbol
  // is verified below to be a `function`/`const`/`class` export — a VALUE — so
  // there is no legitimate reason for a src/ui/ module to name one in a
  // type-only position, and naming one there is not a type, it is a disguise.
  const disguised: string[] = [];
  for (const file of uiFilesOnDisk()) {
    for (const s of statementsIn(sourceOf(readFileSync(file, 'utf8')))) {
      if (s.spec === null || !s.spec.startsWith('.')) continue;
      for (const n of s.named) {
        if (!n.typeOnly && !s.typeOnly) continue;
        if (BANNED_NAMES.has(n.exported)) {
          disguised.push(`${rel(file)}:${s.line} imports ${n.exported} in a TYPE-ONLY position`);
        }
      }
    }
  }
  assert.deepEqual(disguised, [],
    'a src/ui/ module names a banned write symbol in a type-only position. Every banned symbol '
    + 'is a value (the ban-table test proves it), so this is not a type import — it is a value '
    + 'import wearing the one form this walk is built to skip.');
});

test('a type-only import is not a runtime edge, and the graph proves it on the real tree', () => {
  // The half of the `import type` decision that the synthetic unit test below
  // cannot reach: `statementsIn` may classify a statement correctly and the
  // WALK still follow it anyway. Following a type-only edge would put modules
  // in the graph that this process never loads — and then the whole-graph
  // soundness assertions would be reporting `require(` and `export *` in code
  // that is erased before it runs, which is a different test wearing this
  // test's name.
  const g = buildGraph(ENTRY);
  const valueTargets = new Set<string>();
  const typeTargets = new Map<string, string>();
  for (const [file, stmts] of g.statements) {
    for (const s of stmts) {
      if (s.spec === null || !s.spec.startsWith('.')) continue;
      const target = resolveSpec(file, s.spec);
      if (target === null) continue;
      if (s.typeOnly) { if (!typeTargets.has(target)) typeTargets.set(target, `${rel(file)}:${s.line}`); }
      else valueTargets.add(target);
    }
  }
  const only = [...typeTargets].filter(([t]) => !valueTargets.has(t));
  assert.ok(only.length > 0,
    'every relative import in the graph is a value import, so this assertion examined nothing. '
    + 'That is not a pass: it means the type/value split is untested against real source.');
  assert.deepEqual(only.filter(([t]) => g.files.has(t)).map(([t, at]) => `${rel(t)} via ${at}`), [],
    'a module reached ONLY by `import type` is in the runtime graph. `verbatimModuleSyntax` erases '
    + 'that statement whole, so this process never loads that module — and every whole-graph '
    + 'assertion here would now be judging code that does not run.');
});

test('nothing in the graph binds an identifier literally named "type"', () => {
  // The classifier reads a leading `type` keyword to decide "erased" vs "loaded
  // at runtime". Exactly three shapes make that reading wrong, and all three are
  // legal TypeScript: `import type from './m.ts'` (a default binding NAMED
  // type), `{ type }` and `{ x as type }`. None occurs today. If one ever does,
  // this fails rather than silently mis-reading a value statement as a type
  // statement — the "too loose" half of the type decision, made loud.
  const g = buildGraph(ENTRY);
  const ambiguous: string[] = [];
  for (const [file, stmts] of g.statements) {
    for (const s of stmts) {
      if (s.defaultBinding === 'type') ambiguous.push(`${rel(file)}:${s.line} default binding named 'type'`);
      for (const n of s.named) {
        if (n.local === 'type' || n.exported === 'type') {
          ambiguous.push(`${rel(file)}:${s.line} specifier binds the identifier 'type'`);
        }
      }
    }
  }
  assert.deepEqual(ambiguous, [],
    'an import binds the identifier `type`, which is the one shape that makes this file\'s '
    + 'type-vs-value classification ambiguous. Rename the binding, or teach the classifier — '
    + 'do not let it guess.');
});

test('every banned symbol is still exported by the module the ban names, as a VALUE', () => {
  // A ban entry naming a symbol that has since moved stops covering it and says
  // nothing — the §0 defect this whole table exists to avoid ("linkItems and
  // unlinkItems moved to relations.ts"). This makes the list fail loudly
  // instead of quietly shrinking. It also underwrites the type-disguise test
  // above: every banned symbol is a function/const/class, never a type.
  //
  // The TWO-STATEMENT form is accepted as well, and that is not a loosening.
  // `definedIn` has always treated `function X … ; export { X };` as a
  // definition (chain shape 3) — this check simply did not, because until the
  // membership was derived no banned symbol happened to use it. `cmdExport`
  // (src/cli/commands/export.ts) does, and it is a plain `function` exported at
  // the bottom of the file. The fallback still requires a
  // `function`/`const`/`class` declaration, so a type still fails, and a symbol
  // that has gone away still fails: what it cannot do is report a VALUE as
  // missing on the strength of the form it was written in.
  const missing: string[] = [];
  for (const [module, symbols] of Object.entries(WRITERS)) {
    const file = abs(module);
    if (!existsSync(file)) { missing.push(`${module} does not exist`); continue; }
    const text = maskNonCode(readFileSync(file, 'utf8'));
    for (const symbol of symbols) {
      const exported = new RegExp(
        `^[ \\t]*export[ \\t]+(?:async[ \\t]+)?(?:function|const|class)[ \\t]+${symbol}\\b`, 'm');
      if (exported.test(text)) continue;
      const declared = new RegExp(
        `^[ \\t]*(?:async[ \\t]+)?(?:function|const|class)[ \\t]+${symbol}\\b`, 'm');
      const listed = [...text.matchAll(BARE_EXPORT)].some((m) => m[1]!.split(',')
        .some((piece) => {
          const entry = piece.trim();
          const as = /^(\S+)\s+as\s+(\S+)$/.exec(entry);
          return (as ? as[2] : entry) === symbol;
        }));
      if (listed && declared.test(text)) continue;
      missing.push(`${module} no longer exports ${symbol} as a value`);
    }
  }
  assert.deepEqual(missing, [], 'the ban names symbols that are not there any more');
});

test('the resolver follows the two-statement re-export chain that actually exists', () => {
  // revision.ts imports readLog from revision-log.ts and re-exports it in a
  // separate `export { … };`. That is the shape an `export … from` regex misses
  // entirely, and it is why the ban RESOLVES rather than matches. Re-measured
  // rather than inherited: revision.ts changed shape on 2026-08-20 when the
  // pending-revision decoration moved out to revision-log.ts.
  const read = (f: string): Source | null =>
    existsSync(f) ? sourceOf(readFileSync(f, 'utf8')) : null;
  assert.equal(
    definedIn(abs('src/core/revision.ts'), 'readLog', read),
    abs('src/core/revision-log.ts'),
    'readLog imported from revision.ts must resolve to revision-log.ts, not to revision.ts',
  );
  // And the writers revision.ts really does define still land on revision.ts.
  assert.equal(definedIn(abs('src/core/revision.ts'), 'stageRevision', read), abs('src/core/revision.ts'));
  // A symbol that is nowhere is refused, never silently reported as absent.
  assert.equal(definedIn(abs('src/core/revision.ts'), 'noSuchSymbol', read), null);
});

/* -------------------------------------------------------------------------- *
 * The instrument's own unit tests.
 *
 * Everything above is one instrument reading source with regexes. These pin the
 * two pieces that can fail SILENTLY — the masker, which can eat a real import,
 * and the resolver, which can lose a chain — against inputs held in memory, so
 * a regression shows up here with a one-line diff rather than as a ban that
 * quietly stopped covering something.
 * -------------------------------------------------------------------------- */

test('the masker blanks comments, strings and templates and nothing else', () => {
  const cases: { name: string; source: string; expectSpecs: (string | null)[] }[] = [
    {
      name: 'a doc comment quoting an import line is not an import',
      source: "/**\n * import { createItem } from '../core/mutate.ts';\n */\nimport { a } from './a.ts';\n",
      expectSpecs: ['./a.ts'],
    },
    {
      name: 'an error message quoting an import line is not an import',
      source: "export const M =\n  'import src/cli/index.ts: loading it is what registers ' +\n  'the commands';\nimport { b } from './b.ts';\n",
      expectSpecs: ['./b.ts'],
    },
    {
      name: 'a template literal spanning lines does not hide the import below it',
      source: 'const T = `line one\nimport { x } from "./nope.ts"\nline three`;\nimport { c } from "./c.ts";\n',
      expectSpecs: ['./c.ts'],
    },
    {
      name: 'a line comment does not hide the import below it',
      source: "// import { d } from './nope.ts';\nimport { d } from './d.ts';\n",
      expectSpecs: ['./d.ts'],
    },
    {
      name: 'a regex character class holding quotes does not swallow the next line',
      source: "const Q = /['\"]/;\nimport { e } from './e.ts';\n",
      expectSpecs: ['./e.ts'],
    },
    {
      name: 'a bare side-effect import is an edge, not an invisible line',
      source: "import './side.ts';\nimport { f } from './f.ts';\n",
      expectSpecs: ['./f.ts', './side.ts'],
    },
    {
      // `src/cli/commands/statusline-install.ts:393` — the shell-metacharacter
      // class. The backtick in it opened a "template" that swallowed ten lines
      // including `export function cmdStatuslineInstall`, and the `mkdirSync`
      // and `writeFileSync` two lines further down went with it.
      name: 'a backtick inside a regex character class does not open a template',
      source: "const M = /['`$|&;<>]/;\nimport { i } from './i.ts';\n",
      expectSpecs: ['./i.ts'],
    },
    {
      // `src/doctor/checks.ts:1690` — the same character one step out of the
      // character class, where "leave an unbalanced quote alone" is not
      // available because an unbalanced backtick is how a real template opens.
      name: 'a bare backtick inside a regex literal does not open a template',
      source: "found.push(m[0].replace(/`/g, ''));\nimport { j } from './j.ts';\n",
      expectSpecs: ['./j.ts'],
    },
    {
      // `src/help/index.ts:299` — six backticks, two of them escaped. `closer`
      // skipped the escaped pair and the outer walk did not, so the parity came
      // out odd and the last backtick opened a template that ran 27 lines.
      name: 'escaped backticks inside a nested template do not break the parity',
      source: 'const s = `${xs.map((n) => `\\`${n}\\``).join(\', \')} — `;\nimport { k } from \'./k.ts\';\n',
      expectSpecs: ['./k.ts'],
    },
    {
      name: 'a multi-line clause is one statement, not a swallowed function body',
      source: "import {\n  g, h,\n} from './g.ts';\nexport function k(): string {\n  return ['x'].join(' from ');\n}\n",
      expectSpecs: ['./g.ts'],
    },
  ];
  for (const c of cases) {
    const src = sourceOf(c.source);
    assert.equal(src.masked.length, c.source.length, `${c.name}: the masker must preserve length`);
    const specs = statementsIn(src).map((s) => s.spec).sort();
    assert.deepEqual(specs, [...c.expectSpecs].sort(), c.name);
  }
});

test('the regex masker leaves division alone, and blanks only inside the slashes', () => {
  // The other half of the regex decision, and the direction it is dangerous in.
  // Masking a regex is only safe if `a / b` is never mistaken for one: a `/`
  // read as a regex opener blanks from there to the next `/` on the line, which
  // is real code going dark — the exact failure `the masker did not blank a
  // top-level declaration` exists to catch on the real tree, pinned here
  // against inputs held in memory so a regression is a one-line diff.
  const kept = [
    'const half = total / 2;',
    'const rate = (a + b) / count;',
    'const each = items[0] / divisor;',
    'const ratio = fn() / 2;',
  ];
  for (const line of kept) {
    assert.equal(maskNonCode(line), line, `division must not be masked: ${line}`);
  }

  // And a real regex IS blanked inside — but never its delimiters, so the
  // statement around it still reads as a statement.
  assert.equal(maskNonCode("const R = /['\"]/;"), "const R = /    /;");
  // `[b/c]` — the `/` inside a character class does NOT end the literal, which
  // is why the scan tracks bracket state rather than looking for the next slash.
  assert.equal(maskNonCode('if (/^a[b/c]d$/.test(x)) return;'), 'if (/         /.test(x)) return;');
  // An unterminated `/` on its line is not a regex — regex literals cannot span
  // lines — so it is left as whatever it really is rather than eating the rest.
  assert.equal(maskNonCode('const u = a /'), 'const u = a /');
});

test('the type/value split matches what verbatimModuleSyntax erases', () => {
  const source = [
    "import type { Erased } from './erased.ts';",
    "import { type Dropped, kept } from './mixed.ts';",
    "export type { AlsoErased } from './erased2.ts';",
    "import { plain } from './plain.ts';",
    '',
  ].join('\n');
  const stmts = statementsIn(sourceOf(source));

  const runtimeEdges = stmts.filter((s) => !s.typeOnly).map((s) => s.spec).sort();
  assert.deepEqual(runtimeEdges, ['./mixed.ts', './plain.ts'],
    'a whole-statement `import type` is erased and is NOT a runtime edge; a statement carrying '
    + 'only per-specifier `type` markers survives erasure and IS one');

  const bindings = stmts
    .filter((s) => !s.typeOnly)
    .flatMap((s) => s.named.filter((n) => !n.typeOnly).map((n) => n.local))
    .sort();
  assert.deepEqual(bindings, ['kept', 'plain'],
    'a per-specifier `type X` is erased and is not a runtime binding');

  // The erased statements are still PARSED, which is what lets the
  // type-disguise test above see a writer hiding in one.
  const erased = stmts.filter((s) => s.typeOnly).map((s) => s.spec).sort();
  assert.deepEqual(erased, ['./erased.ts', './erased2.ts'],
    'type-only statements must still be parsed — skipped as edges, but visible to the disguise check');
});

test('the resolver places a symbol through each chain shape, and refuses the rest', () => {
  const files: Record<string, string> = {
    '/p/ui.ts': "import { alpha, beta, gamma, delta } from '/p/hub.ts';",
    // 1. one-statement re-export, with an alias
    '/p/hub.ts': [
      "export { alpha } from '/p/home-a.ts';",
      "export { inner as beta } from '/p/home-b.ts';",
      "import { gamma } from '/p/home-c.ts';",
      "import { deep as localDelta } from '/p/home-d.ts';",
      'export { gamma, localDelta as delta };',
    ].join('\n'),
    '/p/home-a.ts': 'export function alpha(): void {}',
    '/p/home-b.ts': 'export const inner = 1;',
    '/p/home-c.ts': 'export class gamma {}',
    '/p/home-d.ts': 'export function deep(): void {}',
    '/p/dead-end.ts': "export { nothing } from '/p/empty.ts';",
    '/p/empty.ts': 'export const somethingElse = 1;',
    '/p/cycle-a.ts': "export { loop } from '/p/cycle-b.ts';",
    '/p/cycle-b.ts': "export { loop } from '/p/cycle-a.ts';",
  };
  const read = (f: string): Source | null => {
    const t = files[f];
    return t === undefined ? null : sourceOf(t);
  };
  const resolve = (_from: string, spec: string): string | null => (spec in files ? spec : null);
  const at = (m: string, s: string): string | null => definedIn(m, s, read, resolve);

  assert.equal(at('/p/hub.ts', 'alpha'), '/p/home-a.ts', 'export { X } from');
  assert.equal(at('/p/hub.ts', 'beta'), '/p/home-b.ts', 'export { X as Y } from');
  assert.equal(at('/p/hub.ts', 'gamma'), '/p/home-c.ts', 'import … ; export { X };');
  assert.equal(at('/p/hub.ts', 'delta'), '/p/home-d.ts',
    'import { deep as localDelta } … ; export { localDelta as delta }; — the chain must follow '
    + 'the LOCAL name into the import, not the exported alias');
  assert.equal(at('/p/dead-end.ts', 'nothing'), null, 'a chain that ends nowhere is refused');
  assert.equal(at('/p/cycle-a.ts', 'loop'), null, 'a cycle is refused rather than looped');
  assert.equal(at('/p/missing.ts', 'x'), null, 'an unreadable module is refused');
});
