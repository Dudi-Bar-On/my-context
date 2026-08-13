/**
 * Seeds `.my_context/` with my_context's own normative knowledge.
 *
 * This exists because Plan 1 shipped checksum *verification* without an edit
 * path — `mycontext add` writes an inert skeleton (always:false, scope:[], no
 * body), and hand-editing it invalidates the checksum. `core/mutate.ts` (Plan 3)
 * is the real fix. Until then this seeds through `writeItem`, the same API the
 * CLI uses, so every checksum is computed rather than hand-stamped.
 *
 * Run once:  node scripts/seed-dogfood.ts
 * It is idempotent — re-running rewrites the same files with the same content.
 */
import path from 'node:path';
import { writeItem } from '../src/core/rebuild.ts';
import type { Item, Observation, Relation } from '../src/core/types.ts';

const ROOT = path.join(process.cwd(), '.my_context');
const TODAY = '2026-08-13';

interface Seed {
  id: string;
  type: string;
  title: string;
  status?: Item['status'];
  always?: boolean;
  severity?: 'hard' | 'soft';
  scope?: string[];
  tags?: string[];
  extra?: Record<string, string>;
  body: string;
  observations?: Observation[];
  relations?: Relation[];
}

function obs(category: string, text: string, tags: string[] = [], context: string | null = null): Observation {
  return { category, text, tags, context };
}

function rel(type: string, target: string): Relation {
  return { type, target };
}

const SEEDS: Seed[] = [
  // ── Constraints ───────────────────────────────────────────────────────────
  {
    id: 'CONST-zero-runtime-dependencies',
    type: 'constraint',
    title: 'The shipped plugin has zero runtime dependencies',
    always: true,
    severity: 'hard',
    tags: ['packaging'],
    body:
      'Only `typescript` and `@types/node` are permitted, and only as devDependencies.\n' +
      'A plugin that installs cleanly without a package fetch is what makes hooks start\n' +
      'in tens of milliseconds and what lets the plugin be dropped into any repo.',
    observations: [
      obs('limit', 'No runtime dependency may be added to package.json', ['packaging']),
      obs('consequence', 'The MCP server in Plan 3 must speak JSON-RPC by hand rather than using the SDK'),
      obs('consequence', 'The frontmatter parser is hand-written rather than using a YAML library'),
    ],
  },
  {
    id: 'CONST-node-24-no-build-step',
    type: 'constraint',
    title: 'Node 24 or newer, and no build step',
    always: true,
    severity: 'hard',
    tags: ['packaging'],
    body:
      'Source is `.ts`, executed directly by Node 24’s native type stripping. There is no\n' +
      'compile step and no `dist/`. Hooks and the CLI run the TypeScript sources as shipped.',
    observations: [
      obs('limit', 'Node >= 24.0.0 — required for stable node:sqlite and native type stripping'),
      obs('rule', 'Only erasable TypeScript syntax: no enum, no namespace, no parameter properties'),
      obs('rule', 'Every relative import carries an explicit .ts extension'),
    ],
    relations: [rel('enforced_by', 'RULE-erasable-syntax-only')],
  },

  // ── Invariants ────────────────────────────────────────────────────────────
  {
    id: 'INV-markdown-is-the-source-of-truth',
    type: 'invariant',
    title: 'Markdown is the source of truth; the SQLite index is disposable',
    always: true,
    severity: 'hard',
    tags: ['architecture'],
    body:
      '`files → DB → files` must be byte-identical. "Delete the index, it rebuilds" is the\n' +
      'documented recovery from corruption, schema mismatch and migration bugs — and that\n' +
      'promise is only real while the round trip is lossless. Any field that fails to\n' +
      'survive it silently destroys authored knowledge on the next rebuild.',
    observations: [
      obs('invariant', 'Every Item field survives parse → render → parse unchanged'),
      obs('evidence', 'Proven by a raw-fixture byte-identity test, not a canonicalized one', ['testing']),
      obs('history', 'An all-digit checksum once parsed as the number 0 and lost its leading zeros; both read and write degraded consistently, so the round-trip test still passed'),
    ],
    relations: [rel('derived_from', 'ADR-markdown-plus-disposable-index'), rel('constrains', 'RULE-never-weaken-byte-identity')],
  },
  {
    id: 'INV-select-is-pure',
    type: 'invariant',
    title: 'core/select is a pure function',
    always: false,
    severity: 'hard',
    scope: ['src/core/select.ts'],
    tags: ['architecture'],
    body:
      'No I/O, no filesystem, no clock, no `Store` import, and no mutation of its inputs.\n' +
      'Purity is the design’s central bet: it makes the entire behaviour of the system\n' +
      'testable as data-in/data-out and debuggable from a fixture rather than from inside\n' +
      'a live session. Every rule about what reaches the context window lives here.',
    observations: [
      obs('invariant', 'select imports only types and config'),
      obs('invariant', 'fitToBudget and buildIndex sort copies, never the caller’s array'),
      obs('rule', 'renderItemBlock may be imported because it is pure; a Store import would not be'),
    ],
  },
  {
    id: 'INV-nothing-is-dropped-silently',
    type: 'invariant',
    title: 'Nothing is ever dropped silently',
    always: true,
    severity: 'hard',
    tags: ['architecture'],
    body:
      'Every item excluded for budget is recorded in `spilled` with a reason and surfaced\n' +
      'in the rendered output. The same holds for truncated index lines, retired items,\n' +
      'drafts, per-file parse errors, duplicate ids, unresolvable symlinks, and items whose\n' +
      'category is disabled or misspelled. Silent truncation is the one unacceptable failure.',
    observations: [
      obs('invariant', 'An item excluded from injection appears in spilled, the index, or a LoadError'),
      obs('history', 'Two Critical bugs shipped past per-task review because they dropped items at seams no single task owned: a disabled or misspelled category vanished entirely, and symlinked item files were skipped'),
      obs('method', 'A "silence audit" — constructing inputs whose output should mention them and checking it does — catches these where ordinary tests do not', ['testing']),
    ],
  },
  {
    id: 'INV-hooks-fail-open',
    type: 'invariant',
    title: 'Hooks fail open, always',
    always: false,
    severity: 'hard',
    scope: ['src/hooks/**'],
    tags: ['reliability'],
    body:
      'Any error yields empty output and exit 0. A knowledge base that breaks the user’s\n' +
      'session is worse than one that says nothing. This holds for a missing workspace, a\n' +
      'corrupt config, an unreadable database, and a malformed item file.',
    observations: [
      obs('invariant', 'A hook never throws and never leaves a Store handle open'),
      obs('exception', 'The .my_context/ write-deny in Plan 2 is the single deliberate exception'),
      obs('limit', 'PreToolUse/JIT is held to p95 under 50ms; SessionStart to 500ms', ['performance']),
    ],
  },
  {
    id: 'INV-posix-normalized-paths',
    type: 'invariant',
    title: 'Every stored path is POSIX-normalized',
    always: true,
    severity: 'hard',
    tags: ['portability'],
    body:
      'No backslash may reach the database or a glob comparison. A scope glob `src/db/**`\n' +
      'silently matches nothing against a stored `src\\db\\writer.ts`, and a constraint that\n' +
      'quietly stops activating is indistinguishable from one that was never written.',
    observations: [
      obs('rule', 'Paths cross the boundary through relPosix/normalizePosix in core/paths.ts'),
      obs('rule', 'Slugs use one deterministic case: uppercase prefix, lowercase body — Windows is case-insensitive, Linux is not'),
    ],
  },

  // ── Rules ─────────────────────────────────────────────────────────────────
  {
    id: 'RULE-erasable-syntax-only',
    type: 'rule',
    title: 'Do not use non-erasable TypeScript syntax',
    always: true,
    severity: 'hard',
    tags: ['typescript'],
    extra: { directive: 'dont' },
    body:
      'No `enum`, no `namespace`, no constructor parameter properties. Node strips types\n' +
      'rather than compiling them, so non-erasable syntax fails at runtime while looking\n' +
      'perfectly valid to a reader. A category list is exactly where `enum` is tempting.',
    observations: [
      obs('rule', 'Use string-literal union types and plain objects instead of enum'),
      obs('enforcement', 'tsconfig sets erasableSyntaxOnly, which requires TypeScript 5.8.2 or newer'),
    ],
  },
  {
    id: 'RULE-never-bind-a-boolean-to-sqlite',
    type: 'rule',
    title: 'Never bind a JavaScript boolean to a node:sqlite statement',
    always: false,
    severity: 'hard',
    scope: ['src/core/store.ts', 'src/core/ledger.ts'],
    tags: ['sqlite'],
    extra: { directive: 'dont' },
    body:
      '`node:sqlite` throws `Provided value cannot be bound to SQLite parameter` on a\n' +
      'boolean. Convert to 1/0 at the call site. This typechecks cleanly and fails only\n' +
      'at runtime, so the type system will not catch it for you.',
    observations: [
      obs('rule', 'Write `item.always ? 1 : 0` — the conversion is load-bearing, not stylistic'),
      obs('fact', '.get() returns undefined (never null) for a missing row, and a null-prototype object'),
    ],
  },
  {
    id: 'RULE-quote-the-test-glob',
    type: 'rule',
    title: 'Keep the test glob double-quoted in package.json',
    always: false,
    severity: 'hard',
    scope: ['package.json', '.github/workflows/**'],
    tags: ['ci', 'testing'],
    extra: { directive: 'do' },
    body:
      'The script must stay `node --test "test/**/*.test.ts"`. Unquoted, `npm test` runs\n' +
      'through `sh` on Linux CI, which expands `**` as `*` without globstar — measured at\n' +
      '2 of 4 test files executed, **exit code 0**. CI reports success over half a suite.\n' +
      'Single quotes do not work either: cmd.exe does not strip them.',
    observations: [
      obs('symptom', 'A green CI matrix while most of the suite never ran', ['ci']),
      obs('rule', 'Confirm the reported test-file count matches the number of files under test/'),
    ],
    relations: [rel('derived_from', 'LESSON-green-ci-over-a-partial-run')],
  },
  {
    id: 'RULE-never-weaken-byte-identity',
    type: 'rule',
    title: 'Never weaken a byte-identity or round-trip assertion to make it pass',
    always: false,
    severity: 'hard',
    scope: ['test/core/rebuild.test.ts', 'test/core/item.test.ts'],
    tags: ['testing'],
    extra: { directive: 'dont' },
    body:
      'If the round trip fails, the defect is in parse or render — fix it there. These\n' +
      'tests are the only evidence for the claim that the index is disposable, and that\n' +
      'claim is what makes every documented recovery path safe.',
    observations: [
      obs('rule', 'A fixture written raw (not pre-canonicalized) is what makes the test able to fail'),
      obs('history', 'A canonicalized fixture would let a lossy transformation shared by parse and render cancel out and still pass'),
    ],
    relations: [rel('enforces', 'INV-markdown-is-the-source-of-truth')],
  },
  {
    id: 'RULE-filter-seen-before-budgeting',
    type: 'rule',
    title: 'Filter already-seen items before budgeting, never after',
    always: false,
    severity: 'hard',
    scope: ['src/core/select.ts'],
    tags: ['selector'],
    extra: { directive: 'do' },
    body:
      'Budgeting first lets an item Claude already has consume budget and push a fresh\n' +
      'constraint into spill — a silent loss no test catches until the ledger exists.\n' +
      'The ordering looks arbitrary and invites "simplification" back to the wrong form.',
    observations: [
      obs('history', 'This bug was fixed once in only one of the two copies of select() in the plan, so it shipped anyway'),
    ],
  },

  // ── Standards ─────────────────────────────────────────────────────────────
  {
    id: 'STD-error-message-conventions',
    type: 'standard',
    title: 'Error messages are prefixed once and name the file once',
    always: false,
    scope: ['src/**'],
    tags: ['errors'],
    body:
      'Thrown errors carry the `my_context:` prefix. `LoadError.message` carries a bare\n' +
      'sentence — the CLI owns the prefix and the filename, so a message that embeds\n' +
      'either produces `my_context: error  f.md: my_context: f.md ...`.',
    observations: [
      obs('rule', 'A failed call should teach: name the closest valid value and where to look'),
      obs('exception', 'The duplicate-id message names two files deliberately — there the repetition is the information'),
    ],
  },

  // ── Non-goals ─────────────────────────────────────────────────────────────
  {
    id: 'NOGOAL-not-a-claude-mem-replacement',
    type: 'non_goal',
    title: 'my_context does not replace claude-mem',
    always: true,
    severity: 'hard',
    tags: ['scope'],
    body:
      'claude-mem is descriptive — it auto-summarizes what happened. my_context is\n' +
      'normative — what must hold. Do not build session history, activity capture, or\n' +
      'semantic search over past work; that is claude-mem’s job and it already does it.',
    observations: [
      obs('boundary', 'An auto-summarizer cannot produce an invariant you intend to enforce'),
      obs('boundary', 'Not a general knowledge base, and not a documentation site generator'),
    ],
    relations: [rel('derived_from', 'ADR-build-rather-than-adopt')],
  },
  {
    id: 'NOGOAL-no-agent-hard-delete',
    type: 'non_goal',
    title: 'Agents never get a hard-delete tool',
    always: false,
    severity: 'hard',
    scope: ['src/mcp/**'],
    tags: ['scope', 'safety'],
    body:
      'Deletion is the user’s alone. Agents may supersede or deprecate — both reversible,\n' +
      'both leaving a trail. An agent able to hard-delete a constraint could silently remove\n' +
      'the thing preventing a bug, and nobody would see it happen.',
    observations: [
      obs('rule', 'The MCP surface in Plan 3 exposes no delete_item'),
    ],
  },

  // ── Open questions ────────────────────────────────────────────────────────
  {
    id: 'OPENQ-does-sessionstart-injection-actually-work',
    type: 'open_question',
    title: 'Has SessionStart injection ever been observed in a live session?',
    status: 'superseded',
    always: false,
    severity: 'hard',
    tags: ['verification'],
    body:
      'ANSWERED on 2026-08-13 — see [[DEC-sessionstart-injection-verified]]. Retained as a\n' +
      'record of what was unknown before Plan 2 was built, and of the fact that it went\n' +
      'unverified through an entire plan.\n\n' +
      'The original question: the hook produced correct output when invoked from a shell,\n' +
      'but the stdout → context contract with Claude Code had never been observed end to\n' +
      'end. Everything in Plan 2 is hooks, so the whole plan rested on it.',
    observations: [
      obs('resolved', 'Superseded by the decision that answers it. Verified by canary: a headless session loaded with --plugin-dir reproduced a phrase that exists only in an injected item'),
      obs('history', 'A previously "verified" invocation path — the npm link entry guard — turned out to be dead, because the toy script used to verify it had no entry guard'),
    ],
    relations: [rel('superseded_by', 'DEC-sessionstart-injection-verified')],
  },
  {
    id: 'DEC-sessionstart-injection-verified',
    type: 'decision',
    title: 'SessionStart injection is verified working, with no shell field',
    tags: ['verification', 'hooks'],
    body:
      'Verified end to end on 2026-08-13 with an unguessable canary phrase placed in a\n' +
      'pinned item in a scratch workspace. A headless session — `claude -p … --plugin-dir`\n' +
      '— reproduced the phrase, which exists nowhere but the injected item. A negative\n' +
      'control in a directory with no workspace answered NONE and started clean.\n\n' +
      'This settles three assumptions that had been carried, untested, through all of\n' +
      'Plan 1.',
    observations: [
      obs('fact', 'The SessionStart matcher fires and plain stdout reaches the model as context'),
      obs('fact', '${CLAUDE_PLUGIN_ROOT} interpolates correctly on Windows without a shell'),
      obs('fact', 'No "shell" field is needed in hooks.json — a bare `node "path"` command works, so the hard dependency on git-bash was correctly avoided'),
      obs('method', 'A canary phrase makes the test unambiguous: the model either has information available nowhere else, or it does not', ['testing']),
      obs('method', 'Always pair with a negative control — otherwise "fired and found nothing" is indistinguishable from "never fired"', ['testing']),
    ],
    relations: [rel('answers', 'OPENQ-does-sessionstart-injection-actually-work'), rel('unblocks', 'REQ-plan-2-precision-injection')],
  },
  {
    id: 'OPENQ-which-mcp-revision-does-claude-code-speak',
    type: 'open_question',
    title: 'Which MCP protocol revision does Claude Code actually negotiate?',
    always: false,
    scope: ['src/mcp/**'],
    tags: ['mcp'],
    body:
      'Three revisions are live, and the newest reportedly removes `initialize` entirely in\n' +
      'favour of `server/discover`. That claim postdates the assistant’s knowledge cutoff\n' +
      'and has not been confirmed against a client. Capture what Claude Code actually sends\n' +
      'before implementing, and build that revision — do not build a dual-era server on an\n' +
      'unverified spec claim, in the riskiest hand-written code in the project.',
    observations: [
      obs('unknown', 'Whether a dual-era server is needed at all'),
    ],
  },

  // ── Requirements ──────────────────────────────────────────────────────────
  {
    id: 'REQ-an-item-must-be-editable',
    type: 'requirement',
    title: 'There must be a supported way to edit an item',
    always: false,
    severity: 'hard',
    scope: ['src/core/mutate.ts', 'src/cli/**'],
    tags: ['usability', 'gap'],
    extra: { kind: 'functional' },
    body:
      'Today `mycontext add` writes an inert skeleton — always:false, scope:[], no body —\n' +
      'and any hand-edit invalidates the checksum, after which every command exits 1.\n' +
      'Checksum verification shipped in Plan 1 while the edit path (core/mutate.ts) belongs\n' +
      'to Plan 3, so the product currently has a lock with no key.',
    observations: [
      obs('symptom', 'checksum mismatch ... This file may have been edited outside my_context'),
      obs('option', 'A `reseal` command that recomputes checksums for deliberately edited files, satisfying "a mismatch never auto-resolves" by requiring an explicit action'),
      obs('option', 'Flags on `add` so a useful item can be created in one shot'),
    ],
    relations: [rel('discovered_by', 'LESSON-dogfooding-found-the-missing-edit-path')],
  },
  {
    id: 'REQ-plan-2-precision-injection',
    type: 'requirement',
    title: 'Injection must survive compaction and activate by scope',
    always: false,
    scope: ['src/hooks/**', 'src/core/select.ts'],
    tags: ['roadmap'],
    extra: { kind: 'functional' },
    body:
      'Session-start injection alone is not the product. JIT activation via PreToolUse and\n' +
      'a PreCompact snapshot restored at SessionStart(compact) are what make it precise\n' +
      'rather than merely present. Surviving compaction was the original motivating problem.',
  },

  {
    id: 'REQ-cli-output-is-tabular-with-detail-levels',
    type: 'requirement',
    title: 'Human-facing output is tabular, with selectable detail levels',
    always: false,
    severity: 'hard',
    scope: ['src/cli/**', 'src/core/render*.ts'],
    tags: ['cli', 'usability'],
    extra: { kind: 'non_functional' },
    body:
      '`status`, `list`, `query`, `doctor` and the decay/report commands must print aligned\n' +
      'tables with meaningful columns — a per-invocation sequence number, id, title, type,\n' +
      'status, and whatever else the command is about — not the ad-hoc line output Plan 1\n' +
      'shipped. Every such command takes a detail level: `summary` (counts and totals only),\n' +
      '`short` (one row per item, the default), and `full` (all fields, bodies included).',
    observations: [
      obs('limit', 'Zero runtime dependencies still binds: no cli-table3, no chalk. The table renderer is hand-written and belongs in one module every command shares'),
      obs('rule', 'The sequence number is presentation only, scoped to one invocation. The id is the identity — never let a sequence number be used to address an item'),
      obs('rule', 'Detect a TTY. When stdout is piped, emit machine-readable output rather than box-drawing characters; a `--json` flag should be available on every reporting command'),
      obs('rule', 'Choose the shape by the data, not by the audience: tables for flat lists, JSON for hierarchy. An item with its relations, a supersession chain, or doctor findings grouped by check do not flatten into rows without losing the structure that makes them worth reading'),
      obs('rule', 'Where hierarchy is the point, JSON is the human format too — not merely the scripting escape hatch. An indented tree is an acceptable alternative for a TTY, but never a table with a repeated parent column'),
      obs('edge_case', 'process.stdout.columns is undefined when piped or redirected — pick a fixed default width rather than crashing or emitting unbounded lines'),
      obs('edge_case', 'Legacy Windows consoles render Unicode box-drawing poorly; an ASCII fallback keeps output readable there'),
      obs('rule', 'Truncate long values to fit a column with an ellipsis rather than wrapping mid-word, and never truncate an id'),
    ],
    relations: [rel('constrains', 'STD-error-message-conventions')],
  },

  {
    id: 'REQ-items-carry-a-domain',
    type: 'requirement',
    title: 'Items carry a domain — a declared grouping above category',
    always: false,
    severity: 'hard',
    scope: ['src/core/types.ts', 'src/core/config.ts', 'src/core/store.ts', 'src/cli/**'],
    tags: ['schema', 'roadmap'],
    extra: { kind: 'functional' },
    body:
      'Categories answer "what kind of statement is this". A domain answers "what area of\n' +
      'concern" — development, research, applicative, system. One domain per item, drawn\n' +
      'from a closed set declared in config.json the way categories are.\n\n' +
      'It earns a real field rather than being a tag because it does mechanical work a tag\n' +
      'cannot: disabling a domain in config removes its items from injection entirely, so\n' +
      'research notes need not reach the window during implementation work. It also filters\n' +
      'commands and reports.',
    observations: [
      obs('decision', 'Stored as an indexed column on items — not a new table, and not separate database files'),
      obs('rationale', 'Separate DB files were rejected: the index is disposable and rebuilt from Markdown, so splitting it multiplies rebuild cost and makes cross-domain queries a manual union, while partitioning something that was never the source of truth'),
      obs('rationale', 'A join table was rejected because domain is single-valued. Multi-domain would make "which budget applies" ambiguous, and ambiguity in the budget path is where silent truncation lives'),
      obs('rationale', 'Domain metadata belongs in config.json beside the category declarations — human-editable and reviewable in a pull request, which a DB table is not'),
      obs('decision', 'Domains do NOT own token budgets. That would add a dimension to every spill decision; the budget matrix stays one-dimensional'),
      obs('fact', 'Directory nesting is nearly free already: loadLayer walks items/ recursively, parseItem reads type from frontmatter rather than the path, and computeItemChecksum does not hash filePath — so items/<domain>/<category>/x.md loads today and re-domaining a file does not invalidate its checksum'),
      obs('boundary', 'Orthogonal to layer, which is about where an item lives, and to scope, which is path-based activation. Domain is conceptual grouping for items with no natural path'),
      obs('edge_case', 'Existing items have no domain. A default domain must absorb them, or every item written before this lands needs migrating'),
    ],
    relations: [rel('constrains', 'REQ-cli-output-is-tabular-with-detail-levels')],
  },

  {
    id: 'REQ-session-focus-controls-what-loads',
    type: 'requirement',
    title: 'A session can focus on domains, controlling what loads into context',
    always: false,
    severity: 'hard',
    scope: ['src/cli/**', 'src/hooks/**', 'src/mcp/**', 'src/core/select.ts'],
    tags: ['cli', 'context-control', 'roadmap'],
    extra: { kind: 'functional' },
    body:
      'While working on one area, knowledge from unrelated domains is noise that costs\n' +
      'context the user needs for their own work. A session must be able to narrow what\n' +
      'my_context injects: `focus <domain...>`, `focus --exclude <domain...>`, `focus --clear`,\n' +
      '`focus --show`, and a `/LoadMyContext [domain...]` that re-injects under the filter.\n' +
      'Every command is mirrored as an MCP tool so Claude can narrow its own context too.\n\n' +
      'Depends on [[REQ-items-carry-a-domain]].',
    observations: [
      obs('constraint', 'Injected text cannot be retracted. Focus governs FUTURE injection — JIT activation, the next session start, and post-compaction restore. It never removes what is already in the window'),
      obs('fact', 'Compaction is the natural reload point: the window clears and SessionStart(compact) re-injects, so "reload excluding X" genuinely takes effect there'),
      obs('decision', 'Focus is session state, not config. It lives in .my_context/state/<session_id>.focus.json, reusing the pattern the restore snapshot already established — config.json is per-project and committed, and a temporary narrowing must not edit a committed file'),
      obs('rule', 'Whatever focus hides MUST be disclosed the way spill is — "N items hidden by focus" — or focus becomes a way to silently drop knowledge, which is the one unacceptable failure in this project'),
      obs('rule', 'Focus never hides a severity:hard item. Narrowing is for noise reduction, not for suppressing what must always hold'),
      obs('option', 'A `preview [--domain X]` command showing what WOULD be injected without injecting it. Nearly free because select is a pure function, and it lets scopes, domains and budgets be tuned without starting sessions'),
      obs('edge_case', 'The focus file is keyed on session id, so it must survive compaction — a compact event continues the same session'),
    ],
    relations: [rel('depends_on', 'REQ-items-carry-a-domain'), rel('constrains', 'INV-nothing-is-dropped-silently')],
  },

  // ── Lessons (rationale — index-only) ──────────────────────────────────────
  {
    id: 'LESSON-green-ci-over-a-partial-run',
    type: 'lesson',
    title: 'A test command can pass while running only part of the suite',
    tags: ['ci', 'testing'],
    body:
      'An unquoted `**` glob in an npm script is expanded by `sh` on Linux, which without\n' +
      'globstar treats it as `*`. Measured: 2 of 4 test files ran, exit code 0. The failure\n' +
      'is invisible precisely because the signal you would use to detect it — a green run —\n' +
      'is what it produces.',
    observations: [
      obs('method', 'Assert the reported test-file count, not just the pass count', ['testing']),
    ],
  },
  {
    id: 'LESSON-tests-that-cannot-fail',
    type: 'lesson',
    title: 'Several tests asserted properties they could not fail on',
    tags: ['testing'],
    body:
      'A test named "pinned tier takes always:true regardless of scope" gave every fixture\n' +
      'an empty scope. One named "index stays bounded" used rationale-tier items that are\n' +
      'never enumerated. An "output uses LF only" fixture contained no carriage return.\n' +
      'Each would pass whether the code was right or wrong, while reading as coverage.',
    observations: [
      obs('method', 'For each test ask: what one-line change to the source would make this fail? If none, it asserts nothing', ['testing']),
      obs('method', 'Deleting a line of implementation and re-running is a cheap way to find them'),
    ],
  },
  {
    id: 'LESSON-declared-but-never-consumed',
    type: 'lesson',
    title: 'Configuration was declared, defaulted, and never read',
    tags: ['design'],
    body:
      '`schema_version` was written on every open and never compared. `budgets.index` had a\n' +
      'default of 150 and nothing consumed it, so the index grew unbounded while the config\n' +
      'advertised a limit. `computeItemChecksum` was exported and never called. Each passed\n' +
      'every test, because dead code cannot fail.',
    observations: [
      obs('method', 'Grep each configuration key for a read, not just a write'),
      obs('symptom', 'A field whose only appearances are its definition and its default'),
    ],
  },
  {
    id: 'LESSON-dogfooding-found-the-missing-edit-path',
    type: 'lesson',
    title: 'Dogfooding found in one command what 175 tests did not',
    tags: ['process'],
    body:
      'Creating a single real item and trying to make it useful surfaced that the product\n' +
      'had no supported edit path — `add` writes an inert skeleton and any edit trips the\n' +
      'checksum. Every test passed, because each tested a step and none tried the journey.',
    observations: [
      obs('method', 'Run the shortest real user task end to end before believing a green suite'),
    ],
    relations: [rel('produced', 'REQ-an-item-must-be-editable')],
  },
  {
    id: 'LESSON-defects-came-from-the-plan-not-the-code',
    type: 'lesson',
    title: 'Nearly every defect originated in the plan, not in implementation',
    tags: ['process'],
    body:
      'Across thirteen tasks, roughly 25 Important-or-Critical findings were caught, and\n' +
      'essentially all of them came from plan text that had already been self-reviewed.\n' +
      'None came from an implementer misreading a brief. Reviewing your own specification\n' +
      'finds contradictions between documents, not defects inside one.',
    observations: [
      obs('method', 'Three layers catch different classes: implementers find prose-vs-code contradictions by making it run, reviewers find untested input classes by reading the diff, a whole-branch pass finds seams no task owned'),
      obs('history', 'The two Critical bugs were found only by executing the assembled system, not by reading it'),
    ],
  },

  {
    id: 'LESSON-alphabetical-id-became-the-priority',
    type: 'lesson',
    title: 'When everything is severity:hard, the id tie-break silently becomes the priority',
    tags: ['selector', 'design'],
    body:
      'The first real corpus pinned 16 items, all `severity: hard`, and blew the 1500-token\n' +
      'budget. `byPriority` sorts by severity, then layer, then id — so with severity and\n' +
      'layer tied for everything, alphabetical id decided what survived. `CONST-*` and\n' +
      '`INV-*` won; `OPENQ-*`, `REQ-*` and `RULE-*` lost. The item that spilled included the\n' +
      'open question blocking all of Plan 2 — dropped because "O" sorts after "I".',
    observations: [
      obs('cause', 'An id tie-break exists for determinism, not for ranking, but it ranks whenever the real signals tie'),
      obs('cause', 'Two severity levels cannot separate a large corpus; a mostly-hard corpus degenerates to alphabetical'),
      obs('option', 'More severity levels, or an explicit order field on pinned items'),
      obs('option', 'Keep the pinned set genuinely small — the authoring error here was pinning 16 things, not the sort'),
      obs('method', 'Spill disclosure is what made this visible at all; it named every dropped item and its tier', ['testing']),
    ],
    relations: [rel('discovered_by', 'LESSON-dogfooding-found-the-missing-edit-path')],
  },

  {
    id: 'STD-answered-questions-are-superseded',
    type: 'standard',
    title: 'An answered open_question is superseded, never deleted and never left active',
    always: false,
    scope: ['.my_context/**', 'src/core/mutate.ts'],
    tags: ['lifecycle'],
    body:
      'When an open question is answered: set `status: superseded`, add a\n' +
      '`superseded_by` relation to whatever answered it, and leave the question in place.\n\n' +
      'Leaving it `active` is the harmful option — an open_question tells an agent "do not\n' +
      'decide this yourself", so once settled it would keep warning agents off a resolved\n' +
      'question. Deleting it loses why the answering item exists, and what was unknown at\n' +
      'the time. `validated` is the wrong retirement: the spec defines it as an assumption\n' +
      'that was checked and held, and a question is not an assumption.',
    observations: [
      obs('rule', 'The answering item need not be a decision — a constraint, ADR or lesson can settle a question; the relation is what matters'),
      obs('rule', 'No dedicated "answered" status: every retired status hits the same eligibility gate, so it would add a name without adding mechanics'),
      obs('consequence', 'Plan 3’s supersedeItem handles this with no special case'),
    ],
  },

  {
    id: 'DEC-index-lists-only-what-is-not-already-injected',
    type: 'decision',
    title: 'The index lists only items not already injected in full',
    always: false,
    scope: ['src/core/select.ts', 'src/core/render.ts'],
    tags: ['selector', 'budget'],
    body:
      'The index is a table of contents for what Claude does NOT already have. An item\n' +
      'injected in full needs no advertising — the complete rule is already present — so\n' +
      'listing it again spends index budget on redundancy and pushes genuinely unseen items\n' +
      'behind the `+N more` line.\n\n' +
      'Measured on the real corpus before the change: 8 of 19 index lines named items that\n' +
      'were already present in full, while 11 items Claude could not see were hidden.',
    observations: [
      obs('rule', 'buildIndex excludes items present in the selection’s full entries from the enumerated normative listing'),
      obs('rule', 'Those items do not count toward `truncated` — they were omitted as redundant, not truncated for budget'),
      obs('rule', 'Per-category counts for rationale items are unaffected; only the normative listing changes'),
      obs('consequence', 'An item in full can no longer produce an index-tier spill, so the question of whether to suppress such a record becomes moot rather than needing a rule'),
      obs('history', 'Surfaced when the restored tier made two tiers run on one event: an item could spill from pinned and be admitted by restored, landing in both full and spilled — output that misreported its own contents'),
    ],
    relations: [rel('constrains', 'INV-nothing-is-dropped-silently')],
  },

  // ── ADRs ──────────────────────────────────────────────────────────────────
  {
    id: 'ADR-build-rather-than-adopt',
    type: 'adr',
    title: 'Build my_context rather than adopting claude-mem or Basic Memory',
    tags: ['architecture'],
    body:
      'Context: both tools already store project knowledge and were evaluated seriously.\n\n' +
      'Decision: build. claude-mem is descriptive — it auto-summarizes activity into an\n' +
      'append-only log with no relations, no lifecycle and no authored items. Basic Memory\n' +
      'has the storage half right (Markdown + SQLite + MCP) but never injects: retrieval is\n' +
      'pull-only, so the model must choose to ask.\n\n' +
      'Consequence: the storage format is borrowed from Basic Memory for Obsidian and git\n' +
      'compatibility; the injection layer is what my_context adds and is the reason it exists.',
    observations: [
      obs('driver', 'An auto-summarizer cannot produce an invariant you intend to enforce'),
      obs('driver', 'Retrieval that depends on the model asking will not fire when the model does not know to ask'),
    ],
  },
  {
    id: 'ADR-markdown-plus-disposable-index',
    type: 'adr',
    title: 'Markdown as source of truth with a disposable SQLite index',
    tags: ['architecture'],
    body:
      'Context: the knowledge base needs both human review in pull requests and fast lookup\n' +
      'inside a latency-budgeted hook.\n\n' +
      'Decision: Markdown files are authoritative and committed; SQLite is a rebuildable\n' +
      'cache, gitignored.\n\n' +
      'Consequence: "delete the index" is a safe recovery from corruption, schema mismatch\n' +
      'and migration bugs — which is why byte-identical round-tripping is enforced rather\n' +
      'than assumed, and why a corrupt index self-heals instead of silencing the plugin.',
  },
  {
    id: 'ADR-normative-vs-rationale-tiers',
    type: 'adr',
    title: 'Split categories into normative and rationale tiers',
    tags: ['architecture'],
    body:
      'Context: injecting everything would crowd out the user’s own context as the corpus\n' +
      'grows, and ADRs and lessons will always be the bulk of what gets written.\n\n' +
      'Decision: normative categories may be injected in full; rationale categories are\n' +
      'only ever counted in a bounded index.\n\n' +
      'Consequence: context cost stays fixed whether the corpus holds 40 items or 4,000.\n' +
      'An ADR explains why; the constraint it produced is what must be obeyed.',
    observations: [
      obs('driver', 'Documented failure modes of in-context memory at scale: capacity overflow, fact destruction during compaction, and behavioural drift from constraint erosion'),
    ],
    relations: [rel('produced', 'INV-nothing-is-dropped-silently')],
  },
];

function toItem(seed: Seed): Item {
  return {
    id: seed.id,
    type: seed.type,
    title: seed.title,
    status: seed.status ?? 'active',
    severity: seed.severity ?? 'soft',
    always: seed.always ?? false,
    scope: seed.scope ?? [],
    tags: seed.tags ?? [],
    origin: 'human',
    sourceFile: null,
    sourceAnchor: null,
    sourceChecksum: null,
    validFrom: TODAY,
    validUntil: null,
    checksum: '',
    extra: seed.extra ?? {},
    body: seed.body,
    observations: seed.observations ?? [],
    relations: seed.relations ?? [],
    layer: 'project',
    filePath: `items/${seed.type}/${seed.id}.md`,
  };
}

let written = 0;
for (const seed of SEEDS) {
  writeItem(ROOT, toItem(seed));
  written++;
}
console.log(`seeded ${written} items into ${ROOT}`);
