# my_context Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the storage, indexing, and selection core of my_context, plus a CLI to author items and a `SessionStart` hook that injects pinned items and a bounded index into every Claude Code session.

**Architecture:** Markdown files are the source of truth; a SQLite index is disposable and rebuildable from them. A single pure function (`core/select`) holds every behavioural rule and is tested exhaustively in isolation. Hooks are thin plumbing that read the index, call the selector, print, and exit 0 no matter what happens.

**Tech Stack:** Node 24, TypeScript (no build step — Node 24 strips types natively), `node:sqlite`, `node:test`, `node:crypto`. Zero runtime dependencies; `typescript` is a devDependency used only for `tsc --noEmit`.

**Spec:** `docs/superpowers/specs/2026-08-12-my-context-design.md`

## Global Constraints

- **Zero runtime dependencies.** devDependencies are limited to `typescript`.
- **Node >= 24.0.0.** Required for stable `node:sqlite` and native type stripping.
- **No build step.** Source is `.ts`, executed directly by Node. All relative imports carry an explicit `.ts` extension. Only erasable TypeScript syntax — no `enum`, no `namespace`, no parameter properties.
- **All stored paths are POSIX-normalized and layer-root-relative** (spec §5.4). No backslash ever reaches the database or a glob comparison.
- **Slugs and filenames use one deterministic case:** uppercase category prefix, lowercase slug body.
- **Rendered Markdown uses `\n` line endings** regardless of platform.
- **Hooks fail open:** exit 0, empty stdout, on any error. 200ms self-timeout. p95 under 50ms.
- **CI runs on `windows-latest` and `ubuntu-latest`** from the first commit.
- **TDD:** every task writes a failing test first, watches it fail, then implements.
- **Commit at the end of every task.**

---

## File Structure

| File | Responsibility |
|---|---|
| `src/core/paths.ts` | POSIX normalization and glob matching. Every path crosses this boundary |
| `src/core/types.ts` | Shared type definitions. No logic |
| `src/core/categories.ts` | The 20 category definitions: prefix, tier, default, extra fields. Profiles |
| `src/core/config.ts` | Load and merge `config.json`; category enablement, tier overrides, custom categories, budgets |
| `src/core/slug.ts` | ID generation and content checksums |
| `src/core/frontmatter.ts` | Restricted YAML subset: parse and serialize |
| `src/core/item.ts` | Parse and render a complete item file |
| `src/core/store.ts` | SQLite schema, upsert, query, `rebuild` |
| `src/core/select.ts` | **The selector.** Pure. Eligibility, tiers, budgets, spill, index |
| `src/core/render.ts` | Selection → injectable text |
| `src/cli/index.ts` | Command dispatch |
| `src/cli/commands/*.ts` | One file per command |
| `src/hooks/session-start.ts` | `SessionStart` hook entry point |
| `.claude-plugin/plugin.json` | Plugin manifest |
| `hooks/hooks.json` | Hook registration |

**Why a restricted YAML parser rather than a dependency:** the zero-dependency constraint is load-bearing (hooks must start in tens of milliseconds and the plugin must install without a package fetch). The risk is a hand-rolled parser guessing wrong on input it does not understand. The mitigation is that it must **never guess** — any construct outside the supported subset throws with the offending line. Since my_context generates every file it reads, unsupported syntax means tampering or corruption, which is exactly what should raise an error rather than parse silently.

---

## Task 1: Path normalization and glob matching

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitattributes`, `.github/workflows/ci.yml`
- Create: `src/core/paths.ts`
- Test: `test/core/paths.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `toPosix(p: string): string`, `normalizePosix(p: string): string`, `relPosix(root: string, target: string): string`, `globToRegExp(pattern: string): RegExp`, `matchesAnyGlob(path: string, patterns: string[]): boolean`

- [ ] **Step 1: Create the project scaffold**

`package.json`:

```json
{
  "name": "my-context",
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=24.0.0" },
  "bin": { "mycontext": "./src/cli/index.ts" },
  "scripts": {
    "test": "node --test \"test/**/*.test.ts\"",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.8.2",
    "@types/node": "^24.0.0"
  }
}
```

Three details here are load-bearing, each verified empirically on Node 24.18:

- **The glob must be double-quoted.** Unquoted, `npm test` on Linux runs through `sh`, which expands `**` as `*` without `globstar` — measured at 2 of 4 test files executed, **exit code 0**. CI would report success while skipping half the suite. Double quotes stop `sh` from globbing and Windows argument parsing strips them before Node sees the pattern. Single quotes do **not** work: `cmd.exe` does not strip them.
- **`typescript` must be `^5.8.2`.** `erasableSyntaxOnly` did not exist before then — under 5.7.3 it is `error TS5023: Unknown compiler option`. There is no stable 5.8.0 or 5.8.1.
- **`@types/node` is required** — see below.

`@types/node` is required, not optional: `tsconfig` sets `"types": ["node"]`, and without it every `tsc --noEmit` fails with `TS2688: Cannot find type definition file for 'node'`. It also supplies `sqlite.d.ts`, which types `DatabaseSync` for Task 7. Both remain devDependencies — the shipped plugin still has zero runtime dependencies.

**Verified runtime facts** these choices rest on, all measured on Node v24.18.0 (Windows 11):

- `node file.ts` runs TypeScript with no flag; relative imports carrying an explicit `.ts` extension resolve correctly, including across directories.
- Type stripping writes **nothing** to stdout or stderr — stderr measured at 0 bytes. Hook output is safe. `node:sqlite` emits no `ExperimentalWarning` on 24.18 either.
- `import.meta.filename === process.argv[1]` correctly detects "run as main" across relative, absolute, forward-slash, backslash, and lowercase-drive invocations, and is correctly `false` when the module is imported or run under `node --test`.
- The `Store` class shape in Task 7 (`#db` private field plus a `private constructor`) is erasable syntax and passes `erasableSyntaxOnly`.

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

`.gitattributes`:

```
* text=auto eol=lf
*.md text eol=lf
```

`.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        os: [windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24' }
      - run: npm install
      - run: npm run typecheck
      - run: npm test
```

- [ ] **Step 2: Write the failing test**

`test/core/paths.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPosix, normalizePosix, matchesAnyGlob } from '../../src/core/paths.ts';

test('toPosix converts backslashes', () => {
  assert.equal(toPosix('src\\db\\writer.ts'), 'src/db/writer.ts');
  assert.equal(toPosix('src/db/writer.ts'), 'src/db/writer.ts');
});

test('normalizePosix strips leading ./ and trailing slashes', () => {
  assert.equal(normalizePosix('./src/db/'), 'src/db');
  assert.equal(normalizePosix('src/../src/db'), 'src/db');
  assert.equal(normalizePosix('.'), '');
});

test('glob ** at end matches nested files but not the directory itself', () => {
  assert.equal(matchesAnyGlob('src/db/writer.ts', ['src/db/**']), true);
  assert.equal(matchesAnyGlob('src/db/a/b.ts', ['src/db/**']), true);
  assert.equal(matchesAnyGlob('src/db', ['src/db/**']), false);
  assert.equal(matchesAnyGlob('src/api/x.ts', ['src/db/**']), false);
});

test('glob * stays within a segment', () => {
  assert.equal(matchesAnyGlob('src/a.ts', ['src/*.ts']), true);
  assert.equal(matchesAnyGlob('src/x/a.ts', ['src/*.ts']), false);
});

test('glob ** in the middle spans zero or more segments', () => {
  assert.equal(matchesAnyGlob('src/test.ts', ['src/**/test.ts']), true);
  assert.equal(matchesAnyGlob('src/a/b/test.ts', ['src/**/test.ts']), true);
});

test('bare ** matches everything', () => {
  assert.equal(matchesAnyGlob('anything/at/all.ts', ['**']), true);
});

test('empty pattern list matches nothing', () => {
  assert.equal(matchesAnyGlob('src/a.ts', []), false);
});

test('dots in patterns are literal', () => {
  assert.equal(matchesAnyGlob('srcXa/ts', ['src/*.ts']), false);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test test/core/paths.test.ts`
Expected: FAIL — `Cannot find module '../../src/core/paths.ts'`

- [ ] **Step 4: Implement**

`src/core/paths.ts`:

```typescript
import path from 'node:path';

/** Convert a native path to POSIX form. */
export function toPosix(p: string): string {
  return p.split(path.sep).join('/').replace(/\\/g, '/');
}

/** POSIX path with no leading './', no trailing '/', and '..' resolved. */
export function normalizePosix(p: string): string {
  const collapsed = path.posix.normalize(toPosix(p));
  if (collapsed === '.' || collapsed === './') return '';
  return collapsed.replace(/^\.\//, '').replace(/\/+$/, '');
}

/** Layer-root-relative POSIX path. */
export function relPosix(root: string, target: string): string {
  return normalizePosix(toPosix(path.relative(root, target)));
}

const RE_SPECIAL = /[.+^${}()|[\]\\]/g;

/**
 * Compile a glob to a RegExp. Supported: `**` (zero or more segments, or one
 * or more when trailing), `*` (within a segment), `?` (one non-separator char).
 * Patterns and subjects must already be POSIX-normalized.
 */
export function globToRegExp(pattern: string): RegExp {
  const segments = normalizePosix(pattern).split('/');
  let re = '^';
  segments.forEach((seg, i) => {
    const last = i === segments.length - 1;
    if (seg === '**') {
      if (last) { re += '.+'; return; }
      re += '(?:[^/]+/)*';
      return;
    }
    re += seg.replace(RE_SPECIAL, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]');
    if (!last) re += '/';
  });
  return new RegExp(re + '$');
}

export function matchesAnyGlob(subject: string, patterns: string[]): boolean {
  const target = normalizePosix(subject);
  return patterns.some((p) => globToRegExp(p).test(target));
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `node --test test/core/paths.test.ts && npx tsc --noEmit`
Expected: all tests PASS, no type errors

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json .gitattributes .github src/core/paths.ts test/core/paths.test.ts
git commit -m "feat: add POSIX path normalization and glob matching"
```

---

## Task 2: Category definitions

**Files:**
- Create: `src/core/types.ts`, `src/core/categories.ts`
- Test: `test/core/categories.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: types `Tier`, `Status`, `Severity`, `Origin`, `Observation`, `Relation`, `Item`, `Layer`; `CATEGORIES: Record<string, CategoryDef>`, `PROFILES: Record<ProfileName, string[]>`, `CategoryDef { name, prefix, tier, defaultEnabled, description, extraFields }`

- [ ] **Step 1: Write the failing test**

`test/core/categories.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, PROFILES } from '../../src/core/categories.ts';

test('there are 20 categories', () => {
  assert.equal(Object.keys(CATEGORIES).length, 20);
});

test('prefixes are unique and uppercase', () => {
  const prefixes = Object.values(CATEGORIES).map((c) => c.prefix);
  assert.equal(new Set(prefixes).size, prefixes.length);
  for (const p of prefixes) assert.equal(p, p.toUpperCase());
});

test('agent-facing categories are normative and enabled', () => {
  for (const name of ['instruction', 'non_goal', 'open_question']) {
    assert.equal(CATEGORIES[name].tier, 'normative', name);
    assert.equal(CATEGORIES[name].defaultEnabled, true, name);
  }
});

test('risk is rationale, policy and postmortem and taxonomy are off by default', () => {
  assert.equal(CATEGORIES.risk.tier, 'rationale');
  for (const name of ['policy', 'postmortem', 'taxonomy']) {
    assert.equal(CATEGORIES[name].defaultEnabled, false, name);
  }
});

test('profiles have the documented sizes', () => {
  assert.equal(PROFILES.minimal.length, 8);
  assert.equal(PROFILES.standard.length, 17);
  assert.equal(PROFILES.full.length, 20);
});

test('every profile entry names a real category', () => {
  for (const list of Object.values(PROFILES)) {
    for (const name of list) assert.ok(CATEGORIES[name], `unknown category ${name}`);
  }
});

test('requirement declares the kind field', () => {
  assert.deepEqual(CATEGORIES.requirement.extraFields, ['kind']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/core/categories.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the shared types**

`src/core/types.ts`:

```typescript
export type Tier = 'normative' | 'rationale';
export type Status = 'active' | 'draft' | 'superseded' | 'deprecated' | 'validated';
export type Severity = 'hard' | 'soft';
export type Origin = 'human' | 'agent' | 'ingest';
export type Layer = 'project' | 'global';

export interface Observation {
  category: string;
  text: string;
  tags: string[];
  context: string | null;
}

export interface Relation {
  type: string;
  target: string;
}

export interface Item {
  id: string;
  type: string;
  title: string;
  status: Status;
  severity: Severity;
  always: boolean;
  scope: string[];
  tags: string[];
  origin: Origin;
  sourceFile: string | null;
  sourceAnchor: string | null;
  sourceChecksum: string | null;
  validFrom: string | null;
  validUntil: string | null;
  checksum: string;
  /** Category-specific fields, e.g. kind, directive, likelihood, impact. */
  extra: Record<string, string>;
  /** Prose between the title heading and the first `##` section. */
  body: string;
  observations: Observation[];
  relations: Relation[];
  layer: Layer;
  /** POSIX, relative to the layer root. */
  filePath: string;
}
```

- [ ] **Step 4: Implement the categories**

`src/core/categories.ts`:

```typescript
import type { Tier } from './types.ts';

export interface CategoryDef {
  name: string;
  prefix: string;
  tier: Tier;
  defaultEnabled: boolean;
  description: string;
  extraFields: string[];
}

function def(
  name: string, prefix: string, tier: Tier, defaultEnabled: boolean,
  description: string, extraFields: string[] = [],
): CategoryDef {
  return { name, prefix, tier, defaultEnabled, description, extraFields };
}

export const CATEGORIES: Record<string, CategoryDef> = {
  constraint:    def('constraint', 'CONST', 'normative', true,
    'Non-negotiable limit: budget, stack, regulation, SLA'),
  invariant:     def('invariant', 'INV', 'normative', true,
    'Condition that must always hold during execution'),
  rule:          def('rule', 'RULE', 'normative', true,
    'A do/dont directive', ['directive']),
  requirement:   def('requirement', 'REQ', 'normative', true,
    'What must be built', ['kind']),
  standard:      def('standard', 'STD', 'normative', true,
    'Formatting, coding convention, architectural guideline'),
  pattern:       def('pattern', 'PAT', 'normative', true,
    'Reusable solution, or an anti-pattern to avoid'),
  glossary:      def('glossary', 'GLOSS', 'normative', true,
    'Ubiquitous language: the agreed term, and terms not to use'),
  instruction:   def('instruction', 'INSTR', 'normative', true,
    "Governs the agent's process, not the artifact"),
  non_goal:      def('non_goal', 'NOGOAL', 'normative', true,
    'Explicit prohibition on building something'),
  open_question: def('open_question', 'OPENQ', 'normative', true,
    'Deliberately undecided; the agent must not decide it alone', ['blocks']),
  policy:        def('policy', 'POL', 'normative', false,
    'Higher-level business or security guideline governing how rules apply'),

  adr:           def('adr', 'ADR', 'rationale', true,
    'Formal decision record, MADR shape'),
  decision:      def('decision', 'DEC', 'rationale', true,
    'Lightweight decision not warranting a full ADR'),
  lesson:        def('lesson', 'LESSON', 'rationale', true,
    'What was learned; source material for generated rules'),
  tradeoff:      def('tradeoff', 'TRADE', 'rationale', true,
    'What was sacrificed for what'),
  assumption:    def('assumption', 'ASSUME', 'rationale', true,
    'Unverified premise plus validation deadline', ['validate_by', 'validated_on']),
  edge_case:     def('edge_case', 'EDGE', 'rationale', true,
    'Boundary condition; frequently worth promoting'),
  risk:          def('risk', 'RISK', 'rationale', true,
    'May occur and would harm', ['likelihood', 'impact']),
  postmortem:    def('postmortem', 'PM', 'rationale', false,
    'Incident debrief'),
  taxonomy:      def('taxonomy', 'TAX', 'rationale', false,
    'How domain concepts relate'),
};

export type ProfileName = 'minimal' | 'standard' | 'full';

export const PROFILES: Record<ProfileName, string[]> = {
  minimal: [
    'constraint', 'assumption', 'invariant', 'tradeoff', 'adr', 'edge_case',
    'rule', 'lesson',
  ],
  standard: Object.values(CATEGORIES)
    .filter((c) => c.defaultEnabled)
    .map((c) => c.name),
  full: Object.keys(CATEGORIES),
};
```

- [ ] **Step 5: Run tests and typecheck**

Run: `node --test test/core/categories.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/types.ts src/core/categories.ts test/core/categories.test.ts
git commit -m "feat: add the 20 category definitions and profiles"
```

---

## Task 3: Configuration loading and merge

**Files:**
- Create: `src/core/config.ts`
- Test: `test/core/config.test.ts`

**Interfaces:**
- Consumes: `CATEGORIES`, `PROFILES` from `categories.ts`; `Tier` from `types.ts`
- Produces: `Budgets { pinned, jit, restored, index }`, `ResolvedCategory { name, prefix, tier, enabled, description, extraFields }`, `Config { profile, categories: Record<string, ResolvedCategory>, budgets, watchedDocs }`, `resolveConfig(raw: unknown): Config`, `DEFAULT_BUDGETS`

- [ ] **Step 1: Write the failing test**

`test/core/config.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig, DEFAULT_BUDGETS } from '../../src/core/config.ts';

test('an empty config yields the standard profile', () => {
  const cfg = resolveConfig({});
  assert.equal(cfg.profile, 'standard');
  assert.equal(cfg.categories.constraint.enabled, true);
  assert.equal(cfg.categories.policy.enabled, false);
  assert.deepEqual(cfg.budgets, DEFAULT_BUDGETS);
});

test('the full profile enables everything', () => {
  const cfg = resolveConfig({ profile: 'full' });
  assert.equal(cfg.categories.taxonomy.enabled, true);
});

test('an explicit category override beats the profile', () => {
  const cfg = resolveConfig({ categories: { constraint: { enabled: false } } });
  assert.equal(cfg.categories.constraint.enabled, false);
});

test('a project can override a category tier', () => {
  const cfg = resolveConfig({ categories: { edge_case: { tier: 'normative' } } });
  assert.equal(cfg.categories.edge_case.tier, 'normative');
});

test('a custom category is accepted when it declares tier and description', () => {
  const cfg = resolveConfig({
    categories: { sla: { enabled: true, tier: 'normative', description: 'Latency target' } },
  });
  assert.equal(cfg.categories.sla.tier, 'normative');
  assert.equal(cfg.categories.sla.prefix, 'SLA');
});

test('a custom category without a tier is rejected loudly', () => {
  assert.throws(
    () => resolveConfig({ categories: { sla: { enabled: true, description: 'x' } } }),
    /unknown category "sla".*tier.*description/is,
  );
});

test('budgets merge partially', () => {
  const cfg = resolveConfig({ budgets: { pinned: 900 } });
  assert.equal(cfg.budgets.pinned, 900);
  assert.equal(cfg.budgets.index, DEFAULT_BUDGETS.index);
});

test('an unknown profile is rejected', () => {
  assert.throws(() => resolveConfig({ profile: 'enormous' }), /unknown profile/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/core/config.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`src/core/config.ts`:

```typescript
import { CATEGORIES, PROFILES, type ProfileName } from './categories.ts';
import type { Tier } from './types.ts';

export interface Budgets {
  pinned: number;
  jit: number;
  restored: number;
  index: number;
}

export const DEFAULT_BUDGETS: Budgets = { pinned: 1500, jit: 500, restored: 2000, index: 150 };

export const DEFAULT_WATCHED_DOCS = [
  'docs/superpowers/specs/**',
  'docs/superpowers/plans/**',
  'docs/prd/**',
];

export interface ResolvedCategory {
  name: string;
  prefix: string;
  tier: Tier;
  enabled: boolean;
  description: string;
  extraFields: string[];
}

export interface Config {
  profile: ProfileName;
  categories: Record<string, ResolvedCategory>;
  budgets: Budgets;
  watchedDocs: string[];
}

interface RawCategory {
  enabled?: boolean;
  tier?: Tier;
  description?: string;
  prefix?: string;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function resolveConfig(raw: unknown): Config {
  const input = isObject(raw) ? raw : {};

  const profile = (input.profile ?? 'standard') as ProfileName;
  if (!(profile in PROFILES)) {
    throw new Error(
      `my_context: unknown profile "${String(profile)}". ` +
      `Expected one of: ${Object.keys(PROFILES).join(', ')}.`,
    );
  }

  const enabledByProfile = new Set(PROFILES[profile]);
  const categories: Record<string, ResolvedCategory> = {};
  for (const def of Object.values(CATEGORIES)) {
    categories[def.name] = {
      name: def.name,
      prefix: def.prefix,
      tier: def.tier,
      enabled: enabledByProfile.has(def.name),
      description: def.description,
      extraFields: def.extraFields,
    };
  }

  const rawCategories = isObject(input.categories) ? input.categories : {};
  for (const [name, value] of Object.entries(rawCategories)) {
    const override = (isObject(value) ? value : {}) as RawCategory;
    const existing = categories[name];

    if (!existing) {
      if (!override.tier || !override.description) {
        throw new Error(
          `my_context: unknown category "${name}". To define a custom category it must ` +
          `declare both "tier" (normative | rationale) and "description".`,
        );
      }
      categories[name] = {
        name,
        prefix: override.prefix ?? name.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase(),
        tier: override.tier,
        enabled: override.enabled ?? true,
        description: override.description,
        extraFields: [],
      };
      continue;
    }

    if (override.enabled !== undefined) existing.enabled = override.enabled;
    if (override.tier !== undefined) existing.tier = override.tier;
    if (override.description !== undefined) existing.description = override.description;
  }

  const rawBudgets = isObject(input.budgets) ? input.budgets : {};
  const budgets: Budgets = { ...DEFAULT_BUDGETS };
  for (const key of Object.keys(DEFAULT_BUDGETS) as (keyof Budgets)[]) {
    const value = rawBudgets[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) budgets[key] = value;
  }

  const watchedDocs = Array.isArray(input.watchedDocs)
    ? input.watchedDocs.filter((v): v is string => typeof v === 'string')
    : DEFAULT_WATCHED_DOCS;

  return { profile, categories, budgets, watchedDocs };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test test/core/config.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/config.ts test/core/config.test.ts
git commit -m "feat: add config resolution with category and budget overrides"
```

---

## Task 4: Slug generation and checksums

**Files:**
- Create: `src/core/slug.ts`
- Test: `test/core/slug.test.ts`

**Interfaces:**
- Consumes: `ResolvedCategory` from `config.ts`
- Produces: `slugify(title: string): string`, `makeId(prefix: string, title: string): string`, `checksum(content: string): string`

- [ ] **Step 1: Write the failing test**

`test/core/slug.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, makeId, checksum } from '../../src/core/slug.ts';

test('slugify lowercases and hyphenates', () => {
  assert.equal(slugify('Postgres connection pool capped at 20'), 'postgres-connection-pool-capped-at-20');
});

test('slugify strips punctuation and collapses separators', () => {
  assert.equal(slugify('Use SQLite JSONB -- for the KB!'), 'use-sqlite-jsonb-for-the-kb');
});

test('slugify is deterministic across case variants', () => {
  assert.equal(slugify('PG Pool Cap'), slugify('pg pool cap'));
});

test('slugify truncates on a word boundary', () => {
  const long = slugify('a'.repeat(20) + ' ' + 'b'.repeat(60));
  assert.ok(long.length <= 60, `got ${long.length}`);
});

test('makeId keeps the prefix uppercase and the body lowercase', () => {
  assert.equal(makeId('CONST', 'PG Pool Cap'), 'CONST-pg-pool-cap');
});

test('checksum is stable and 16 hex chars', () => {
  const a = checksum('hello');
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(a, checksum('hello'));
  assert.notEqual(a, checksum('hello '));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/core/slug.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`src/core/slug.ts`:

```typescript
import { createHash } from 'node:crypto';

const MAX_SLUG = 60;

/**
 * Combining diacritics, built from a string so the source file contains no
 * literal combining characters (which are invisible and easy to corrupt).
 */
const COMBINING = new RegExp('[\\u0300-\\u036f]', 'g');

/** Deterministic, lowercase, hyphen-separated. Identical on every platform. */
export function slugify(title: string): string {
  const base = title
    .normalize('NFKD')
    .replace(COMBINING, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (base.length <= MAX_SLUG) return base;
  const cut = base.slice(0, MAX_SLUG);
  const lastDash = cut.lastIndexOf('-');
  return (lastDash > 0 ? cut.slice(0, lastDash) : cut).replace(/-+$/, '');
}

export function makeId(prefix: string, title: string): string {
  return `${prefix.toUpperCase()}-${slugify(title)}`;
}

/** First 16 hex chars of SHA-256. Used for tamper and drift detection. */
export function checksum(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16);
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test test/core/slug.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/slug.ts test/core/slug.test.ts
git commit -m "feat: add deterministic slug and checksum generation"
```

---

## Task 5: Restricted YAML frontmatter

**Files:**
- Create: `src/core/frontmatter.ts`
- Test: `test/core/frontmatter.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `FrontmatterValue = string | number | boolean | null | string[]`, `parseFrontmatter(text: string): Record<string, FrontmatterValue>`, `serializeFrontmatter(data: Record<string, FrontmatterValue>): string`

Supported subset — and nothing else:
- `key: scalar` where scalar is an unquoted string, a quoted string, a number, `true`/`false`, or `null`
- `key: [a, b]` inline arrays of scalars
- `key:` followed by indented `  - value` lines
- `#` comments on their own line, and blank lines

Anything else throws with the line number and content.

- [ ] **Step 1: Write the failing test**

`test/core/frontmatter.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, serializeFrontmatter } from '../../src/core/frontmatter.ts';

test('parses scalars with types', () => {
  const fm = parseFrontmatter('id: CONST-a\nalways: false\ncount: 3\nvalid_until: null\n');
  assert.equal(fm.id, 'CONST-a');
  assert.equal(fm.always, false);
  assert.equal(fm.count, 3);
  assert.equal(fm.valid_until, null);
});

test('parses inline and block arrays', () => {
  const fm = parseFrontmatter('tags: [database, perf]\nscope:\n  - "src/db/**"\n  - src/api/**\n');
  assert.deepEqual(fm.tags, ['database', 'perf']);
  assert.deepEqual(fm.scope, ['src/db/**', 'src/api/**']);
});

test('an empty inline array yields an empty list', () => {
  assert.deepEqual(parseFrontmatter('tags: []\n').tags, []);
});

test('quoted values keep colons and hashes', () => {
  const fm = parseFrontmatter('title: "a: b # c"\n');
  assert.equal(fm.title, 'a: b # c');
});

test('comments and blank lines are ignored', () => {
  const fm = parseFrontmatter('# a comment\n\nid: X\n');
  assert.equal(fm.id, 'X');
});

test('unsupported syntax throws with the line number', () => {
  assert.throws(() => parseFrontmatter('id: X\nnested:\n  deep:\n    a: 1\n'), /line 3/);
  assert.throws(() => parseFrontmatter('- bare list item\n'), /line 1/);
});

test('serialize then parse round-trips', () => {
  const data = {
    id: 'CONST-a', title: 'a: b', always: true, valid_until: null,
    scope: ['src/**'], tags: [],
  };
  assert.deepEqual(parseFrontmatter(serializeFrontmatter(data)), data);
});

test('serialize quotes values that need it', () => {
  const out = serializeFrontmatter({ title: 'a: b', plain: 'ok' });
  assert.match(out, /title: "a: b"/);
  assert.match(out, /plain: ok/);
});

test('a digit-only string is quoted so it does not return as a number', () => {
  const out = serializeFrontmatter({ checksum: '0000000000000000' });
  assert.match(out, /checksum: "0000000000000000"/);
  assert.equal(parseFrontmatter(out).checksum, '0000000000000000');
});

test('strings that look like booleans or null are quoted', () => {
  const data = { a: 'true', b: 'null', c: '42' };
  assert.deepEqual(parseFrontmatter(serializeFrontmatter(data)), data);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/core/frontmatter.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`src/core/frontmatter.ts`:

```typescript
export type FrontmatterValue = string | number | boolean | null | string[];

const KEY_LINE = /^([A-Za-z_][A-Za-z0-9_]*):[ \t]*(.*)$/;
const LIST_ITEM = /^[ \t]+-[ \t]+(.*)$/;

function fail(lineNo: number, line: string): never {
  throw new Error(
    `my_context: unsupported frontmatter syntax at line ${lineNo}: ${JSON.stringify(line)}. ` +
    `Supported: "key: scalar", "key: [a, b]", and "key:" followed by indented "- value" lines. ` +
    `This file may have been edited outside my_context.`,
  );
}

function unquote(raw: string): string {
  const t = raw.trim();
  if ((t.startsWith('"') && t.endsWith('"') && t.length >= 2) ||
      (t.startsWith("'") && t.endsWith("'") && t.length >= 2)) {
    return t.slice(1, -1).replace(/\\"/g, '"');
  }
  return t;
}

function scalar(raw: string): FrontmatterValue {
  const t = raw.trim();
  if (t === '') return '';
  if (t.startsWith('"') || t.startsWith("'")) return unquote(t);
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null' || t === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t;
}

function inlineArray(raw: string): string[] | null {
  const t = raw.trim();
  if (!t.startsWith('[') || !t.endsWith(']')) return null;
  const inner = t.slice(1, -1).trim();
  if (inner === '') return [];
  return inner.split(',').map((part) => String(unquote(part)));
}

export function parseFrontmatter(text: string): Record<string, FrontmatterValue> {
  const out: Record<string, FrontmatterValue> = {};
  const lines = text.split(/\r?\n/);
  let pendingKey: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    const listMatch = LIST_ITEM.exec(line);
    if (listMatch) {
      if (pendingKey === null) fail(lineNo, line);
      (out[pendingKey] as string[]).push(String(unquote(listMatch[1])));
      continue;
    }

    if (/^\s/.test(line)) fail(lineNo, line);

    const keyMatch = KEY_LINE.exec(line);
    if (!keyMatch) fail(lineNo, line);

    const [, key, rest] = keyMatch;
    if (rest.trim() === '') {
      out[key] = [];
      pendingKey = key;
      continue;
    }

    const arr = inlineArray(rest);
    out[key] = arr !== null ? arr : scalar(rest);
    pendingKey = null;
  }

  return out;
}

const NEEDS_QUOTES = /^[\s]|[:#]|^$|^[-[{]|[\s]$/;
/** Strings that would parse back as a number, boolean or null must be quoted. */
const LOOKS_TYPED = /^(true|false|null|~|-?\d+(\.\d+)?)$/;

function emitScalar(v: string | number | boolean | null): string {
  if (v === null) return 'null';
  if (typeof v !== 'string') return String(v);
  const needsQuotes = NEEDS_QUOTES.test(v) || LOOKS_TYPED.test(v);
  return needsQuotes ? `"${v.replace(/"/g, '\\"')}"` : v;
}

export function serializeFrontmatter(data: Record<string, FrontmatterValue>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      if (value.length === 0) { lines.push(`${key}: []`); continue; }
      lines.push(`${key}:`);
      for (const entry of value) lines.push(`  - ${emitScalar(entry)}`);
      continue;
    }
    lines.push(`${key}: ${emitScalar(value)}`);
  }
  return lines.join('\n') + '\n';
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test test/core/frontmatter.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/frontmatter.ts test/core/frontmatter.test.ts
git commit -m "feat: add restricted YAML frontmatter parser that never guesses"
```

---

## Task 6: Item parse and render

**Files:**
- Create: `src/core/item.ts`
- Test: `test/core/item.test.ts`

**Interfaces:**
- Consumes: `parseFrontmatter`, `serializeFrontmatter` from `frontmatter.ts`; `checksum` from `slug.ts`; `Item`, `Observation`, `Relation`, `Layer` from `types.ts`
- Produces: `parseItem(text: string, filePath: string, layer: Layer): Item`, `renderItem(item: Item): string`, `computeItemChecksum(item: Item): string`

- [ ] **Step 1: Write the failing test**

`test/core/item.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseItem, renderItem } from '../../src/core/item.ts';

const SAMPLE = `---
id: CONST-pg-pool-cap
type: constraint
title: Postgres connection pool capped at 20
status: active
severity: hard
always: false
scope:
  - "src/db/**"
tags: [database]
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-12
valid_until: null
checksum: 0000000000000000
---

# Postgres connection pool capped at 20

RDS permits 25 connections.

## Observations
- [limit] Pool size must never exceed 20 #database
- [symptom] Surfaces under load (not at startup)

## Relations
- derived_from [[ADR-sqlite-jsonb]]
- supersedes [[CONST-old-cap]]
`;

test('parses the common fields', () => {
  const item = parseItem(SAMPLE, 'items/constraint/CONST-pg-pool-cap.md', 'project');
  assert.equal(item.id, 'CONST-pg-pool-cap');
  assert.equal(item.type, 'constraint');
  assert.equal(item.status, 'active');
  assert.equal(item.always, false);
  assert.deepEqual(item.scope, ['src/db/**']);
  assert.equal(item.layer, 'project');
});

test('parses observations with category, tags and context', () => {
  const item = parseItem(SAMPLE, 'x.md', 'project');
  assert.equal(item.observations.length, 2);
  assert.equal(item.observations[0].category, 'limit');
  assert.equal(item.observations[0].text, 'Pool size must never exceed 20');
  assert.deepEqual(item.observations[0].tags, ['database']);
  assert.equal(item.observations[1].context, 'not at startup');
});

test('parses relations', () => {
  const item = parseItem(SAMPLE, 'x.md', 'project');
  assert.deepEqual(item.relations, [
    { type: 'derived_from', target: 'ADR-sqlite-jsonb' },
    { type: 'supersedes', target: 'CONST-old-cap' },
  ]);
});

test('a bare wikilink relation defaults to links_to', () => {
  const text = SAMPLE.replace('- supersedes [[CONST-old-cap]]', '- [[CONST-other]]');
  const item = parseItem(text, 'x.md', 'project');
  assert.deepEqual(item.relations[1], { type: 'links_to', target: 'CONST-other' });
});

test('unknown frontmatter keys are preserved as extra fields', () => {
  const text = SAMPLE.replace('type: constraint', 'type: requirement\nkind: functional');
  const item = parseItem(text, 'x.md', 'project');
  assert.equal(item.extra.kind, 'functional');
});

test('parse then render then parse is identity', () => {
  const once = parseItem(SAMPLE, 'x.md', 'project');
  const twice = parseItem(renderItem(once), 'x.md', 'project');
  assert.deepEqual(twice, once);
});

test('render always emits LF line endings', () => {
  const item = parseItem(SAMPLE, 'x.md', 'project');
  assert.equal(renderItem(item).includes('\r'), false);
});

test('an all-digit checksum survives as a string', () => {
  const item = parseItem(SAMPLE, 'x.md', 'project');
  assert.equal(item.checksum, '0000000000000000');
  assert.equal(typeof item.checksum, 'string');
});

test('a file without frontmatter delimiters throws', () => {
  assert.throws(() => parseItem('# no frontmatter\n', 'x.md', 'project'), /frontmatter/i);
});

test('a missing required field throws naming the field', () => {
  const text = SAMPLE.replace('type: constraint\n', '');
  assert.throws(() => parseItem(text, 'x.md', 'project'), /"type"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/core/item.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`src/core/item.ts`:

```typescript
import { parseFrontmatter, serializeFrontmatter, type FrontmatterValue } from './frontmatter.ts';
import { checksum } from './slug.ts';
import type { Item, Layer, Observation, Origin, Relation, Severity, Status } from './types.ts';

const DELIM = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const OBSERVATION = /^-\s+\[([a-z0-9_-]+)\]\s+(.*)$/i;
const RELATION = /^-\s+(?:([a-z0-9_]+)\s+)?\[\[([^\]]+)\]\]\s*$/i;

const COMMON_KEYS = new Set([
  'id', 'type', 'title', 'status', 'severity', 'always', 'scope', 'tags', 'origin',
  'source_file', 'source_anchor', 'source_checksum', 'valid_from', 'valid_until', 'checksum',
]);

/**
 * Coerce a scalar frontmatter value to a string.
 *
 * Numbers matter here: a 16-hex-char checksum can be all digits, so
 * `checksum: 0000000000000000` arrives as the number 0. Treating only
 * `typeof v === 'string'` as valid would silently drop it — and because both
 * read and write would drop it consistently, round-trip tests would still pass.
 */
function asString(v: FrontmatterValue): string | null {
  if (v === null || Array.isArray(v)) return null;
  const s = String(v);
  return s === '' ? null : s;
}

function requireString(fm: Record<string, FrontmatterValue>, key: string): string {
  const v = asString(fm[key]);
  if (v === null) throw new Error(`my_context: item is missing required field "${key}".`);
  return v;
}

function optString(fm: Record<string, FrontmatterValue>, key: string): string | null {
  return asString(fm[key]);
}

function stringList(fm: Record<string, FrontmatterValue>, key: string): string[] {
  const v = fm[key];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v !== '') return [v];
  return [];
}

/** Split the body into its leading prose and its `## Section` blocks. */
function splitSections(body: string): { prose: string; sections: Map<string, string[]> } {
  const lines = body.split('\n');
  const sections = new Map<string, string[]>();
  const prose: string[] = [];
  let current: string | null = null;

  for (const line of lines) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      current = heading[1].toLowerCase();
      sections.set(current, []);
      continue;
    }
    if (current === null) {
      if (/^#\s+/.test(line)) continue;
      prose.push(line);
      continue;
    }
    sections.get(current)!.push(line);
  }

  return { prose: prose.join('\n').trim(), sections };
}

function parseObservations(lines: string[]): Observation[] {
  const out: Observation[] = [];
  for (const line of lines) {
    const m = OBSERVATION.exec(line.trim());
    if (!m) continue;
    let text = m[2].trim();

    let context: string | null = null;
    const ctx = /\(([^()]*)\)\s*$/.exec(text);
    if (ctx) { context = ctx[1].trim(); text = text.slice(0, ctx.index).trim(); }

    const tags: string[] = [];
    text = text.replace(/#([A-Za-z0-9_-]+)/g, (_all, tag: string) => { tags.push(tag); return ''; })
               .replace(/\s+/g, ' ').trim();

    out.push({ category: m[1].toLowerCase(), text, tags, context });
  }
  return out;
}

function parseRelations(lines: string[]): Relation[] {
  const out: Relation[] = [];
  for (const line of lines) {
    const m = RELATION.exec(line.trim());
    if (!m) continue;
    out.push({ type: (m[1] ?? 'links_to').toLowerCase(), target: m[2].trim() });
  }
  return out;
}

export function parseItem(text: string, filePath: string, layer: Layer): Item {
  const match = DELIM.exec(text);
  if (!match) {
    throw new Error(`my_context: ${filePath} has no --- frontmatter block.`);
  }

  const fm = parseFrontmatter(match[1]);
  const body = text.slice(match[0].length);
  const { prose, sections } = splitSections(body);

  const extra: Record<string, string> = {};
  for (const [key, value] of Object.entries(fm)) {
    if (COMMON_KEYS.has(key)) continue;
    if (Array.isArray(value)) { extra[key] = value.join(', '); continue; }
    if (value === null) continue;
    extra[key] = String(value);
  }

  return {
    id: requireString(fm, 'id'),
    type: requireString(fm, 'type'),
    title: requireString(fm, 'title'),
    status: (optString(fm, 'status') ?? 'active') as Status,
    severity: (optString(fm, 'severity') ?? 'soft') as Severity,
    always: fm.always === true,
    scope: stringList(fm, 'scope'),
    tags: stringList(fm, 'tags'),
    origin: (optString(fm, 'origin') ?? 'human') as Origin,
    sourceFile: optString(fm, 'source_file'),
    sourceAnchor: optString(fm, 'source_anchor'),
    sourceChecksum: optString(fm, 'source_checksum'),
    validFrom: optString(fm, 'valid_from'),
    validUntil: optString(fm, 'valid_until'),
    checksum: optString(fm, 'checksum') ?? '',
    extra,
    body: prose,
    observations: parseObservations(sections.get('observations') ?? []),
    relations: parseRelations(sections.get('relations') ?? []),
    layer,
    filePath,
  };
}

/** Checksum over the semantic content only — never over the checksum field itself. */
export function computeItemChecksum(item: Item): string {
  return checksum(JSON.stringify({
    id: item.id, type: item.type, title: item.title, status: item.status,
    severity: item.severity, always: item.always, scope: item.scope, tags: item.tags,
    origin: item.origin, extra: item.extra, body: item.body,
    observations: item.observations, relations: item.relations,
  }));
}

function renderObservation(o: Observation): string {
  const tags = o.tags.map((t) => ` #${t}`).join('');
  const ctx = o.context ? ` (${o.context})` : '';
  return `- [${o.category}] ${o.text}${tags}${ctx}`;
}

export function renderItem(item: Item): string {
  const fm: Record<string, FrontmatterValue> = {
    id: item.id,
    type: item.type,
    title: item.title,
    status: item.status,
    severity: item.severity,
    always: item.always,
    scope: item.scope,
    tags: item.tags,
    origin: item.origin,
    source_file: item.sourceFile,
    source_anchor: item.sourceAnchor,
    source_checksum: item.sourceChecksum,
    valid_from: item.validFrom,
    valid_until: item.validUntil,
    checksum: item.checksum,
  };
  for (const [key, value] of Object.entries(item.extra)) fm[key] = value;

  const parts = [
    '---',
    serializeFrontmatter(fm).trimEnd(),
    '---',
    '',
    `# ${item.title}`,
    '',
  ];
  if (item.body) parts.push(item.body, '');
  if (item.observations.length) {
    parts.push('## Observations', ...item.observations.map(renderObservation), '');
  }
  if (item.relations.length) {
    parts.push('## Relations', ...item.relations.map((r) => `- ${r.type} [[${r.target}]]`), '');
  }
  return parts.join('\n');
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test test/core/item.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/item.ts test/core/item.test.ts
git commit -m "feat: add item parse and render with round-trip identity"
```

---

## Task 7: SQLite store — schema, upsert, query

**Files:**
- Create: `src/core/store.ts`
- Test: `test/core/store.test.ts`

**Interfaces:**
- Consumes: `Item` from `types.ts`
- Produces: `class Store { static open(dbPath: string): Store; upsert(item: Item): void; all(): Item[]; get(id: string): Item | null; deleteByLayer(layer: Layer): void; close(): void }`

The index stores items as serialized JSON in a single column plus indexed columns for the fields the selector filters on. Nothing here is authoritative — it is a cache of the Markdown.

Three verified behaviours of `node:sqlite` on Node 24.18 that this code depends on:

- **Booleans cannot be bound.** `.run(true)` throws `Provided value cannot be bound to SQLite parameter`. Hence `item.always ? 1 : 0` — that conversion is load-bearing, not stylistic. Any new binding of a boolean anywhere will throw at runtime while typechecking cleanly.
- **`.get()` returns `undefined`** for a missing row (never `null`), and returns a **null-prototype** object. Reading properties works normally; `assert.deepStrictEqual` against an object literal would not.
- **`PRAGMA journal_mode = WAL` is a no-op on `:memory:`**, which every unit test uses — SQLite silently keeps `memory`. Do not write a test asserting the mode is `wal` unless it opens a file-backed database.

- [ ] **Step 1: Write the failing test**

`test/core/store.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../src/core/store.ts';
import { parseItem } from '../../src/core/item.ts';

function makeItem(id: string, type = 'constraint', status = 'active') {
  return parseItem(
    `---\nid: ${id}\ntype: ${type}\ntitle: ${id} title\nstatus: ${status}\n---\n\n# ${id} title\n`,
    `items/${type}/${id}.md`,
    'project',
  );
}

test('upsert then get round-trips an item', () => {
  const store = Store.open(':memory:');
  const item = makeItem('CONST-a');
  store.upsert(item);
  assert.deepEqual(store.get('CONST-a'), item);
  store.close();
});

test('upsert is idempotent on id', () => {
  const store = Store.open(':memory:');
  store.upsert(makeItem('CONST-a'));
  store.upsert(makeItem('CONST-a'));
  assert.equal(store.all().length, 1);
  store.close();
});

test('upsert replaces the previous row', () => {
  const store = Store.open(':memory:');
  store.upsert(makeItem('CONST-a', 'constraint', 'active'));
  store.upsert(makeItem('CONST-a', 'constraint', 'deprecated'));
  assert.equal(store.get('CONST-a')?.status, 'deprecated');
  store.close();
});

test('get returns null for an unknown id', () => {
  const store = Store.open(':memory:');
  assert.equal(store.get('nope'), null);
  store.close();
});

test('deleteByLayer removes only that layer', () => {
  const store = Store.open(':memory:');
  const projectItem = makeItem('CONST-a');
  const globalItem = { ...makeItem('CONST-b'), layer: 'global' as const };
  store.upsert(projectItem);
  store.upsert(globalItem);
  store.deleteByLayer('project');
  assert.deepEqual(store.all().map((i) => i.id), ['CONST-b']);
  store.close();
});

test('all returns items sorted by id for determinism', () => {
  const store = Store.open(':memory:');
  store.upsert(makeItem('CONST-b'));
  store.upsert(makeItem('CONST-a'));
  assert.deepEqual(store.all().map((i) => i.id), ['CONST-a', 'CONST-b']);
  store.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/core/store.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`src/core/store.ts`:

```typescript
import { DatabaseSync } from 'node:sqlite';
import type { Item, Layer } from './types.ts';

const SCHEMA_VERSION = 1;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS items (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL,
  always      INTEGER NOT NULL,
  layer       TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_type   ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_layer  ON items(layer);
`;

export class Store {
  #db: DatabaseSync;

  private constructor(db: DatabaseSync) {
    this.#db = db;
  }

  static open(dbPath: string): Store {
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA busy_timeout = 3000;');
    db.exec(SCHEMA);
    const row = db.prepare('SELECT version FROM schema_version LIMIT 1').get() as
      { version: number } | undefined;
    if (!row) db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);
    return new Store(db);
  }

  upsert(item: Item): void {
    this.#db.prepare(`
      INSERT INTO items (id, type, title, status, always, layer, file_path, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type, title = excluded.title, status = excluded.status,
        always = excluded.always, layer = excluded.layer, file_path = excluded.file_path,
        data = excluded.data, updated_at = CURRENT_TIMESTAMP
    `).run(
      item.id, item.type, item.title, item.status, item.always ? 1 : 0,
      item.layer, item.filePath, JSON.stringify(item),
    );
  }

  get(id: string): Item | null {
    const row = this.#db.prepare('SELECT data FROM items WHERE id = ?').get(id) as
      { data: string } | undefined;
    return row ? (JSON.parse(row.data) as Item) : null;
  }

  all(): Item[] {
    const rows = this.#db.prepare('SELECT data FROM items ORDER BY id').all() as
      { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as Item);
  }

  deleteByLayer(layer: Layer): void {
    this.#db.prepare('DELETE FROM items WHERE layer = ?').run(layer);
  }

  close(): void {
    this.#db.close();
  }
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test test/core/store.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/store.ts test/core/store.test.ts
git commit -m "feat: add SQLite item index with upsert and query"
```

---

## Task 8: Lossless rebuild from Markdown

**Files:**
- Create: `src/core/rebuild.ts`
- Test: `test/core/rebuild.test.ts`

**Interfaces:**
- Consumes: `Store`, `parseItem`, `renderItem`, `relPosix`
- Produces: `LoadError { file: string; message: string }`, `loadLayer(root: string, layer: Layer, errors?: LoadError[]): Item[]`, `writeItem(root: string, item: Item): string`, `rebuild(store: Store, roots: { project?: string; global?: string }): { loaded: number; errors: LoadError[] }`

This task proves the guarantee in spec §10: **files → DB → files is byte-identical.** If that fails, "the DB is disposable" is not true.

- [ ] **Step 1: Write the failing test**

`test/core/rebuild.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Store } from '../../src/core/store.ts';
import { loadLayer, writeItem, rebuild } from '../../src/core/rebuild.ts';
import { parseItem, renderItem } from '../../src/core/item.ts';

function tempRoot(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-'));
}

const ITEM = `---
id: CONST-a
type: constraint
title: A constraint
status: active
severity: hard
always: true
scope:
  - "src/**"
tags: [db]
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: null
valid_until: null
checksum: 0000000000000000
---

# A constraint

Some prose.

## Observations
- [limit] Never exceed 20 #db

## Relations
- supersedes [[CONST-old]]
`;

test('loadLayer reads items with POSIX-relative paths', () => {
  const root = tempRoot();
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  writeFileSync(path.join(root, 'items', 'constraint', 'CONST-a.md'), ITEM);

  const items = loadLayer(root, 'project');
  assert.equal(items.length, 1);
  assert.equal(items[0].filePath, 'items/constraint/CONST-a.md');
  assert.equal(items[0].filePath.includes('\\'), false);
  rmSync(root, { recursive: true, force: true });
});

test('rebuild is lossless — files to DB to files is byte-identical', () => {
  const root = tempRoot();
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  const file = path.join(root, 'items', 'constraint', 'CONST-a.md');
  const canonical = renderItem(parseItem(ITEM, 'items/constraint/CONST-a.md', 'project'));
  writeFileSync(file, canonical);

  const store = Store.open(':memory:');
  const result = rebuild(store, { project: root });
  assert.equal(result.loaded, 1);
  assert.deepEqual(result.errors, []);

  for (const item of store.all()) writeItem(root, item);
  assert.equal(readFileSync(file, 'utf8'), canonical);

  store.close();
  rmSync(root, { recursive: true, force: true });
});

test('rebuild replaces the layer rather than accumulating', () => {
  const root = tempRoot();
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  writeFileSync(path.join(root, 'items', 'constraint', 'CONST-a.md'), ITEM);

  const store = Store.open(':memory:');
  rebuild(store, { project: root });
  rmSync(path.join(root, 'items', 'constraint', 'CONST-a.md'));
  rebuild(store, { project: root });
  assert.equal(store.all().length, 0);

  store.close();
  rmSync(root, { recursive: true, force: true });
});

test('a malformed item is reported and does not abort the rebuild', () => {
  const root = tempRoot();
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  writeFileSync(path.join(root, 'items', 'constraint', 'CONST-a.md'), ITEM);
  writeFileSync(path.join(root, 'items', 'constraint', 'broken.md'), 'no frontmatter here');

  const store = Store.open(':memory:');
  const result = rebuild(store, { project: root });
  assert.equal(result.loaded, 1);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].file, /broken\.md$/);

  store.close();
  rmSync(root, { recursive: true, force: true });
});

test('writeItem writes atomically and creates parent directories', () => {
  const root = tempRoot();
  const item = parseItem(ITEM, 'items/constraint/CONST-a.md', 'project');
  const written = writeItem(root, item);
  assert.equal(readFileSync(written, 'utf8'), renderItem(item));
  rmSync(root, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/core/rebuild.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`src/core/rebuild.ts`:

```typescript
import { readdirSync, readFileSync, mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { parseItem, renderItem } from './item.ts';
import { relPosix } from './paths.ts';
import type { Store } from './store.ts';
import type { Item, Layer } from './types.ts';

function walk(dir: string, out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

export interface LoadError { file: string; message: string }

export function loadLayer(
  root: string, layer: Layer, errors: LoadError[] = [],
): Item[] {
  const items: Item[] = [];
  for (const file of walk(path.join(root, 'items'))) {
    const rel = relPosix(root, file);
    try {
      items.push(parseItem(readFileSync(file, 'utf8'), rel, layer));
    } catch (err) {
      errors.push({ file: rel, message: err instanceof Error ? err.message : String(err) });
    }
  }
  return items;
}

/** Write an item atomically: temp file, then rename. Returns the absolute path. */
export function writeItem(root: string, item: Item): string {
  const target = path.join(root, ...item.filePath.split('/'));
  mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp-${process.pid}`;
  try {
    writeFileSync(tmp, renderItem(item), 'utf8');
    renameSync(tmp, target);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
  return target;
}

export function rebuild(
  store: Store, roots: { project?: string; global?: string },
): { loaded: number; errors: LoadError[] } {
  const errors: LoadError[] = [];
  let loaded = 0;

  for (const [layer, root] of Object.entries(roots) as [Layer, string | undefined][]) {
    if (!root) continue;
    store.deleteByLayer(layer);
    for (const item of loadLayer(root, layer, errors)) {
      store.upsert(item);
      loaded++;
    }
  }

  return { loaded, errors };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test test/core/rebuild.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/rebuild.ts test/core/rebuild.test.ts
git commit -m "feat: add lossless rebuild with atomic item writes"
```

---

## Task 9: The selector — eligibility, pinned tier, budget and spill

**Files:**
- Create: `src/core/select.ts`
- Test: `test/core/select.test.ts`

**Interfaces:**
- Consumes: `Config`, `Budgets` from `config.ts`; `Item` from `types.ts`; `matchesAnyGlob` from `paths.ts`
- Produces:
  - `SelectEvent = 'session-start' | 'compact' | 'tool' | 'manual'`
  - `SelectContext { event: SelectEvent; path?: string | null; seen?: string[]; restore?: string[] }`
  - `SelectionEntry { item: Item; tier: 'pinned' | 'jit' | 'restored' }`
  - `Spill { id: string; tier: string; reason: string }`
  - `IndexSummary { normative: { id: string; type: string; title: string }[]; counts: Record<string, number>; drafts: number }`
  - `Selection { full: SelectionEntry[]; index: IndexSummary; spilled: Spill[] }`
  - `estimateTokens(text: string): number`
  - `isEligible(item: Item, config: Config): boolean`
  - `select(items: Item[], ctx: SelectContext, config: Config): Selection`

Only the `pinned` tier and eligibility are implemented here; `jit` and `restored` are wired in Plan 2. The types are defined now so Plan 2 adds behaviour without changing signatures.

- [ ] **Step 1: Write the failing test**

`test/core/select.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { select, isEligible, estimateTokens } from '../../src/core/select.ts';
import { resolveConfig } from '../../src/core/config.ts';
import type { Item } from '../../src/core/types.ts';

const CONFIG = resolveConfig({});

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'A constraint', status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'body', observations: [], relations: [],
    layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

test('only active items are eligible', () => {
  assert.equal(isEligible(item({ status: 'active' }), CONFIG), true);
  assert.equal(isEligible(item({ status: 'draft' }), CONFIG), false);
  assert.equal(isEligible(item({ status: 'superseded' }), CONFIG), false);
});

test('disabled categories are not eligible', () => {
  const cfg = resolveConfig({ categories: { constraint: { enabled: false } } });
  assert.equal(isEligible(item(), cfg), false);
});

test('rationale categories are never injected in full', () => {
  const sel = select([item({ id: 'LESSON-a', type: 'lesson', always: true })],
    { event: 'session-start' }, CONFIG);
  assert.deepEqual(sel.full, []);
  assert.equal(sel.index.counts.lesson, 1);
});

test('a project tier override makes a rationale category injectable', () => {
  const cfg = resolveConfig({ categories: { edge_case: { tier: 'normative' } } });
  const sel = select([item({ id: 'EDGE-a', type: 'edge_case', always: true })],
    { event: 'session-start' }, cfg);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['EDGE-a']);
});

test('pinned tier takes always:true regardless of scope', () => {
  const items = [
    item({ id: 'CONST-pinned', always: true, scope: [] }),
    item({ id: 'CONST-plain', always: false }),
  ];
  const sel = select(items, { event: 'session-start' }, CONFIG);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-pinned']);
  assert.equal(sel.full[0].tier, 'pinned');
});

test('over budget, hard severity wins and the rest spill', () => {
  const big = 'x'.repeat(4000); // ~1000 tokens each
  const items = [
    item({ id: 'CONST-soft', always: true, severity: 'soft', body: big }),
    item({ id: 'CONST-hard', always: true, severity: 'hard', body: big }),
  ];
  const cfg = resolveConfig({ budgets: { pinned: 1200 } });
  const sel = select(items, { event: 'session-start' }, cfg);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-hard']);
  assert.deepEqual(sel.spilled.map((s) => s.id), ['CONST-soft']);
  assert.match(sel.spilled[0].reason, /budget/i);
});

test('spilled items still appear in the index', () => {
  const big = 'x'.repeat(4000);
  const items = [
    item({ id: 'CONST-a', always: true, severity: 'hard', body: big }),
    item({ id: 'CONST-b', always: true, severity: 'soft', body: big }),
  ];
  const cfg = resolveConfig({ budgets: { pinned: 1200 } });
  const sel = select(items, { event: 'session-start' }, cfg);
  assert.deepEqual(sel.index.normative.map((n) => n.id), ['CONST-a', 'CONST-b']);
});

test('estimateTokens is roughly chars over four', () => {
  assert.equal(estimateTokens('x'.repeat(400)), 100);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/core/select.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`src/core/select.ts`:

```typescript
import type { Config } from './config.ts';
import type { Item } from './types.ts';

export type SelectEvent = 'session-start' | 'compact' | 'tool' | 'manual';

export interface SelectContext {
  event: SelectEvent;
  /** POSIX, layer-root-relative. Used by the JIT tier (Plan 2). */
  path?: string | null;
  /** Item ids already injected this session. */
  seen?: string[];
  /** Item ids captured by the PreCompact snapshot (Plan 2). */
  restore?: string[];
}

export interface SelectionEntry {
  item: Item;
  tier: 'pinned' | 'jit' | 'restored';
}

export interface Spill {
  id: string;
  tier: string;
  reason: string;
}

export interface IndexSummary {
  normative: { id: string; type: string; title: string }[];
  counts: Record<string, number>;
  drafts: number;
}

export interface Selection {
  full: SelectionEntry[];
  index: IndexSummary;
  spilled: Spill[];
}

/**
 * Approximate token count. No tokenizer is available under the zero-dependency
 * constraint, so this deliberately over-estimates rather than under-estimates:
 * spilling one item too many is recoverable, blowing the budget is not.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function itemCost(item: Item): number {
  const parts = [
    item.id, item.type, item.title, item.body,
    ...item.observations.map((o) => `${o.category} ${o.text}`),
    ...item.relations.map((r) => `${r.type} ${r.target}`),
  ];
  return estimateTokens(parts.join(' '));
}

export function isEligible(item: Item, config: Config): boolean {
  if (item.status !== 'active') return false;
  const category = config.categories[item.type];
  return Boolean(category?.enabled);
}

function isNormative(item: Item, config: Config): boolean {
  return config.categories[item.type]?.tier === 'normative';
}

/** Hard severity first, then most-recently-relevant, then id for determinism. */
function byPriority(a: Item, b: Item): number {
  if (a.severity !== b.severity) return a.severity === 'hard' ? -1 : 1;
  if (a.layer !== b.layer) return a.layer === 'project' ? -1 : 1;
  return a.id.localeCompare(b.id);
}

function fitToBudget(
  candidates: Item[], budget: number, tier: SelectionEntry['tier'],
): { entries: SelectionEntry[]; spilled: Spill[] } {
  const entries: SelectionEntry[] = [];
  const spilled: Spill[] = [];
  let used = 0;

  for (const item of [...candidates].sort(byPriority)) {
    const cost = itemCost(item);
    if (used + cost > budget) {
      spilled.push({
        id: item.id, tier,
        reason: `budget exceeded (${used + cost} > ${budget} estimated tokens)`,
      });
      continue;
    }
    used += cost;
    entries.push({ item, tier });
  }

  return { entries, spilled };
}

function buildIndex(eligible: Item[], all: Item[], config: Config): IndexSummary {
  const normative = eligible
    .filter((i) => isNormative(i, config))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((i) => ({ id: i.id, type: i.type, title: i.title }));

  const counts: Record<string, number> = {};
  for (const item of eligible) {
    if (isNormative(item, config)) continue;
    counts[item.type] = (counts[item.type] ?? 0) + 1;
  }

  return { normative, counts, drafts: all.filter((i) => i.status === 'draft').length };
}

export function select(items: Item[], ctx: SelectContext, config: Config): Selection {
  const eligible = items.filter((i) => isEligible(i, config));

  const pinnedCandidates = eligible.filter((i) => i.always && isNormative(i, config));
  const { entries, spilled } = fitToBudget(pinnedCandidates, config.budgets.pinned, 'pinned');

  const seen = new Set(ctx.seen ?? []);
  const full = entries.filter((e) => !seen.has(e.item.id));

  return { full, index: buildIndex(eligible, items, config), spilled };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test test/core/select.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/select.ts test/core/select.test.ts
git commit -m "feat: add the selector with eligibility, pinned tier and budget spill"
```

---

## Task 10: Layer merge and index bounding at scale

**Files:**
- Modify: `src/core/select.ts` (add `mergeLayers`, export it, call it from `select`)
- Test: `test/core/select-layers.test.ts`

**Interfaces:**
- Consumes: everything from Task 9
- Produces: `mergeLayers(items: Item[]): Item[]` — project items win on id collision

- [ ] **Step 1: Write the failing test**

`test/core/select-layers.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { select, mergeLayers } from '../../src/core/select.ts';
import { resolveConfig } from '../../src/core/config.ts';
import type { Item } from '../../src/core/types.ts';

const CONFIG = resolveConfig({});

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'A', status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: '', observations: [], relations: [],
    layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

test('project wins on id collision', () => {
  const merged = mergeLayers([
    item({ id: 'CONST-a', title: 'global', layer: 'global' }),
    item({ id: 'CONST-a', title: 'project', layer: 'project' }),
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].title, 'project');
});

test('non-colliding items from both layers survive', () => {
  const merged = mergeLayers([
    item({ id: 'CONST-g', layer: 'global' }),
    item({ id: 'CONST-p', layer: 'project' }),
  ]);
  assert.deepEqual(merged.map((i) => i.id).sort(), ['CONST-g', 'CONST-p']);
});

test('project items are preferred when the pinned budget is tight', () => {
  const big = 'x'.repeat(4000);
  const cfg = resolveConfig({ budgets: { pinned: 1200 } });
  const sel = select([
    item({ id: 'CONST-global', layer: 'global', always: true, body: big }),
    item({ id: 'CONST-project', layer: 'project', always: true, body: big }),
  ], { event: 'session-start' }, cfg);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-project']);
});

test('the index stays bounded — 5000 items produce counts, not listings', () => {
  const many: Item[] = [];
  for (let i = 0; i < 5000; i++) {
    many.push(item({ id: `LESSON-${i}`, type: 'lesson', title: `Lesson ${i}` }));
  }
  const sel = select(many, { event: 'session-start' }, CONFIG);
  assert.deepEqual(sel.index.normative, []);
  assert.equal(sel.index.counts.lesson, 5000);
});

test('already-seen items are not re-injected', () => {
  const sel = select([item({ id: 'CONST-a', always: true })],
    { event: 'session-start', seen: ['CONST-a'] }, CONFIG);
  assert.deepEqual(sel.full, []);
});

test('a seen item does not consume budget and spill a fresh one', () => {
  const big = 'x'.repeat(4000); // ~1000 tokens each
  const cfg = resolveConfig({ budgets: { pinned: 1200 } });
  const sel = select([
    item({ id: 'CONST-seen', always: true, severity: 'hard', body: big }),
    item({ id: 'CONST-fresh', always: true, severity: 'soft', body: big }),
  ], { event: 'session-start', seen: ['CONST-seen'] }, cfg);

  // CONST-seen sorts first on severity. If it were budgeted before being
  // filtered, it would eat the budget and CONST-fresh would spill.
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-fresh']);
  assert.deepEqual(sel.spilled, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/core/select-layers.test.ts`
Expected: FAIL — `mergeLayers` is not exported

- [ ] **Step 3: Implement**

Add to `src/core/select.ts`:

```typescript
/** Project items shadow global items with the same id. */
export function mergeLayers(items: Item[]): Item[] {
  const byId = new Map<string, Item>();
  for (const item of items) {
    const existing = byId.get(item.id);
    if (!existing || (existing.layer === 'global' && item.layer === 'project')) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()];
}
```

Then change the first line of `select` to merge before filtering:

```typescript
export function select(items: Item[], ctx: SelectContext, config: Config): Selection {
  const merged = mergeLayers(items);
  const eligible = merged.filter((i) => isEligible(i, config));
  const seen = new Set(ctx.seen ?? []);

  // Filter `seen` BEFORE budgeting, never after. Budgeting first would let an
  // item Claude already has consume budget and push a fresh constraint into
  // spill — a silent loss that no test catches until the ledger exists.
  const pinnedCandidates = eligible
    .filter((i) => i.always && isNormative(i, config))
    .filter((i) => !seen.has(i.id));

  const { entries, spilled } = fitToBudget(pinnedCandidates, config.budgets.pinned, 'pinned');

  return { full: entries, index: buildIndex(eligible, merged, config), spilled };
}
```

- [ ] **Step 4: Run the whole suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS — including Task 9's tests, unchanged

- [ ] **Step 5: Commit**

```bash
git add src/core/select.ts test/core/select-layers.test.ts
git commit -m "feat: add layer merge with project precedence"
```

---

## Task 11: Render a selection into injectable text

**Files:**
- Create: `src/core/render.ts`
- Test: `test/core/render.test.ts`

**Interfaces:**
- Consumes: `Selection`, `IndexSummary` from `select.ts`
- Produces: `renderSelection(selection: Selection): string`

- [ ] **Step 1: Write the failing test**

`test/core/render.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSelection } from '../../src/core/render.ts';
import type { Selection } from '../../src/core/select.ts';
import type { Item } from '../../src/core/types.ts';

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'Pool capped at 20', status: 'active',
    severity: 'hard', always: true, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'RDS permits 25.', observations: [], relations: [],
    layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

const EMPTY: Selection = {
  full: [], index: { normative: [], counts: {}, drafts: 0 }, spilled: [],
};

test('an empty selection renders nothing', () => {
  assert.equal(renderSelection(EMPTY), '');
});

test('full items render id, title and body', () => {
  const out = renderSelection({ ...EMPTY, full: [{ item: item(), tier: 'pinned' }] });
  assert.match(out, /CONST-a/);
  assert.match(out, /Pool capped at 20/);
  assert.match(out, /RDS permits 25\./);
});

test('observations render as bullets', () => {
  const withObs = item({
    observations: [{ category: 'limit', text: 'Never exceed 20', tags: ['db'], context: null }],
  });
  const out = renderSelection({ ...EMPTY, full: [{ item: withObs, tier: 'pinned' }] });
  assert.match(out, /- \[limit\] Never exceed 20/);
});

test('the index summarizes rationale as counts', () => {
  const out = renderSelection({
    ...EMPTY,
    index: {
      normative: [{ id: 'CONST-a', type: 'constraint', title: 'Pool capped at 20' }],
      counts: { lesson: 130, adr: 47 },
      drafts: 340,
    },
  });
  assert.match(out, /CONST-a · constraint · Pool capped at 20/);
  assert.match(out, /130 lesson/);
  assert.match(out, /47 adr/);
  assert.match(out, /340 drafts/);
});

test('spilled items are disclosed, never silent', () => {
  const out = renderSelection({
    ...EMPTY,
    spilled: [{ id: 'CONST-b', tier: 'pinned', reason: 'budget exceeded' }],
  });
  assert.match(out, /1 item omitted/i);
  assert.match(out, /CONST-b/);
});

test('output uses LF only', () => {
  const out = renderSelection({ ...EMPTY, full: [{ item: item(), tier: 'pinned' }] });
  assert.equal(out.includes('\r'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/core/render.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`src/core/render.ts`:

```typescript
import type { Selection } from './select.ts';
import type { Item } from './types.ts';

function renderItemBlock(item: Item): string {
  const lines = [`### ${item.id} · ${item.type} · ${item.title}`];
  if (item.body) lines.push('', item.body);
  if (item.observations.length) {
    lines.push('');
    for (const o of item.observations) {
      const tags = o.tags.map((t) => ` #${t}`).join('');
      const ctx = o.context ? ` (${o.context})` : '';
      lines.push(`- [${o.category}] ${o.text}${tags}${ctx}`);
    }
  }
  if (item.scope.length) lines.push('', `_scope: ${item.scope.join(', ')}_`);
  return lines.join('\n');
}

function renderIndex(selection: Selection): string {
  const { normative, counts, drafts } = selection.index;
  if (normative.length === 0 && Object.keys(counts).length === 0 && drafts === 0) return '';

  const lines: string[] = ['## my_context index'];
  for (const n of normative) lines.push(`- ${n.id} · ${n.type} · ${n.title}`);

  const summary = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, n]) => `${n} ${type}`);
  if (drafts > 0) summary.push(`${drafts} drafts pending review`);
  if (summary.length) {
    lines.push('', summary.join(' · '), '→ use mycontext query to search these');
  }
  return lines.join('\n');
}

export function renderSelection(selection: Selection): string {
  const blocks: string[] = [];

  if (selection.full.length) {
    blocks.push('## my_context — these govern this project', '');
    blocks.push(selection.full.map((e) => renderItemBlock(e.item)).join('\n\n'));
  }

  const index = renderIndex(selection);
  if (index) blocks.push(index);

  if (selection.spilled.length) {
    const ids = selection.spilled.map((s) => s.id).join(', ');
    blocks.push(
      `_${selection.spilled.length} item(s) omitted from full text for budget: ${ids}. ` +
      `Fetch with mycontext show <id>._`,
    );
  }

  return blocks.length ? blocks.join('\n\n').replace(/\r/g, '') + '\n' : '';
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test test/core/render.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/render.ts test/core/render.test.ts
git commit -m "feat: render selections into injectable text with spill disclosure"
```

---

## Task 12: The CLI

**Files:**
- Create: `src/core/workspace.ts`, `src/cli/index.ts`
- Test: `test/cli/cli.test.ts`

**Interfaces:**
- Consumes: everything above
- Produces:
  - `resolveWorkspace(cwd: string): Workspace` where `Workspace { projectRoot: string | null; globalRoot: string; dbPath: string; config: Config }`
  - `runCli(argv: string[], cwd: string, out: (s: string) => void): number` — returns the process exit code

Commands: `init`, `add`, `list`, `show`, `rebuild`, `status`.

- [ ] **Step 1: Write the failing test**

`test/cli/cli.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';

function sandbox(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-cli-'));
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

test('init creates the workspace and config', () => {
  const cwd = sandbox();
  const { code } = run(['init'], cwd);
  assert.equal(code, 0);
  assert.ok(existsSync(path.join(cwd, '.my_context', 'config.json')));
  assert.ok(existsSync(path.join(cwd, '.my_context', 'items')));
  rmSync(cwd, { recursive: true, force: true });
});

test('init writes a gitignore for the index', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  const ignore = readFileSync(path.join(cwd, '.my_context', '.gitignore'), 'utf8');
  assert.match(ignore, /\.index\.db/);
  rmSync(cwd, { recursive: true, force: true });
});

test('add creates an item file with a slug id', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  const { code, out } = run(['add', 'constraint', 'Postgres pool capped at 20'], cwd);
  assert.equal(code, 0);
  assert.match(out, /CONST-postgres-pool-capped-at-20/);
  assert.ok(existsSync(path.join(
    cwd, '.my_context', 'items', 'constraint', 'CONST-postgres-pool-capped-at-20.md')));
  rmSync(cwd, { recursive: true, force: true });
});

test('add rejects a disabled category with a helpful message', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  const { code, out } = run(['add', 'policy', 'Some policy'], cwd);
  assert.equal(code, 1);
  assert.match(out, /policy/);
  assert.match(out, /not enabled/i);
  rmSync(cwd, { recursive: true, force: true });
});

test('add rejects an unknown category and suggests the closest', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  const { code, out } = run(['add', 'constraints', 'Typo'], cwd);
  assert.equal(code, 1);
  assert.match(out, /constraint/);
  rmSync(cwd, { recursive: true, force: true });
});

test('list shows added items', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  run(['add', 'constraint', 'Pool cap'], cwd);
  const { out } = run(['list'], cwd);
  assert.match(out, /CONST-pool-cap/);
  rmSync(cwd, { recursive: true, force: true });
});

test('show prints the full item', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  run(['add', 'constraint', 'Pool cap'], cwd);
  const { out } = run(['show', 'CONST-pool-cap'], cwd);
  assert.match(out, /Pool cap/);
  rmSync(cwd, { recursive: true, force: true });
});

test('status reports counts by category and status', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  run(['add', 'constraint', 'Pool cap'], cwd);
  run(['add', 'lesson', 'Migrations need locks'], cwd);
  const { out } = run(['status'], cwd);
  assert.match(out, /constraint\s+1/);
  assert.match(out, /lesson\s+1/);
  assert.match(out, /active\s+2/);
  rmSync(cwd, { recursive: true, force: true });
});

test('an unknown command exits non-zero with usage', () => {
  const cwd = sandbox();
  const { code, out } = run(['frobnicate'], cwd);
  assert.equal(code, 1);
  assert.match(out, /usage/i);
  rmSync(cwd, { recursive: true, force: true });
});

test('commands outside a workspace explain how to create one', () => {
  const cwd = sandbox();
  const { code, out } = run(['list'], cwd);
  assert.equal(code, 1);
  assert.match(out, /mycontext init/);
  rmSync(cwd, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cli/cli.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the workspace resolver**

`src/core/workspace.ts`:

```typescript
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { resolveConfig, type Config } from './config.ts';

export const DIR_NAME = '.my_context';
export const GLOBAL_DIR = path.join(homedir(), '.my-context');

export interface Workspace {
  projectRoot: string | null;
  globalRoot: string;
  dbPath: string;
  config: Config;
}

/** Walk upward from cwd looking for a `.my_context` directory. */
export function findProjectRoot(cwd: string): string | null {
  let dir = path.resolve(cwd);
  for (;;) {
    if (existsSync(path.join(dir, DIR_NAME))) return path.join(dir, DIR_NAME);
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function resolveWorkspace(cwd: string): Workspace {
  const projectRoot = findProjectRoot(cwd);
  const configPath = projectRoot ? path.join(projectRoot, 'config.json') : null;

  let raw: unknown = {};
  if (configPath && existsSync(configPath)) {
    try {
      raw = JSON.parse(readFileSync(configPath, 'utf8'));
    } catch (err) {
      throw new Error(
        `my_context: ${configPath} is not valid JSON: ` +
        `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return {
    projectRoot,
    globalRoot: GLOBAL_DIR,
    dbPath: projectRoot ? path.join(projectRoot, '.index.db') : ':memory:',
    config: resolveConfig(raw),
  };
}
```

- [ ] **Step 4: Implement the CLI**

`src/cli/index.ts` — note the shebang on line 1. Every user-facing message in this
plan and in Plans 2–4 refers to a `mycontext` command, so the binary must exist.
A `.ts` bin entry with a shebang was verified working end to end on Windows:
`npm link` produced a `mycontext` command that ran with type stripping intact.

```typescript
#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { CATEGORIES } from '../core/categories.ts';
import { renderItem } from '../core/item.ts';
import { rebuild, writeItem } from '../core/rebuild.ts';
import { makeId } from '../core/slug.ts';
import { Store } from '../core/store.ts';
import { DIR_NAME, resolveWorkspace, type Workspace } from '../core/workspace.ts';
import type { Item } from '../core/types.ts';

type Emit = (s: string) => void;

const USAGE = `usage: mycontext <command> [args]

  init                        create .my_context in the current directory
  add <category> <title>      create a new item
  list [category]             list items
  show <id>                   print an item
  rebuild                     rebuild the index from Markdown
  status                      report counts, budgets and health

categories: ${Object.keys(CATEGORIES).join(', ')}`;

function closest(name: string, candidates: string[]): string | null {
  const hit = candidates.find((c) => c.startsWith(name) || name.startsWith(c));
  return hit ?? null;
}

function requireWorkspace(ws: Workspace, out: Emit): string | null {
  if (ws.projectRoot) return ws.projectRoot;
  out('my_context: no workspace here. Run `mycontext init` to create one.');
  return null;
}

function openStore(ws: Workspace): Store {
  const store = Store.open(ws.dbPath);
  rebuild(store, {
    project: ws.projectRoot ?? undefined,
    global: existsSync(ws.globalRoot) ? ws.globalRoot : undefined,
  });
  return store;
}

function cmdInit(cwd: string, out: Emit): number {
  const root = path.join(cwd, DIR_NAME);
  if (existsSync(root)) { out(`my_context: ${root} already exists.`); return 1; }

  mkdirSync(path.join(root, 'items'), { recursive: true });
  writeFileSync(
    path.join(root, 'config.json'),
    JSON.stringify({ profile: 'standard', categories: {}, budgets: {} }, null, 2) + '\n',
  );
  writeFileSync(path.join(root, '.gitignore'), '.index.db\n.index.db-*\n');
  out(`my_context: initialized ${root}`);
  return 0;
}

function cmdAdd(ws: Workspace, args: string[], out: Emit): number {
  const root = requireWorkspace(ws, out);
  if (!root) return 1;

  const [category, ...titleParts] = args;
  const title = titleParts.join(' ');
  if (!category || !title) { out('usage: mycontext add <category> <title>'); return 1; }

  const resolved = ws.config.categories[category];
  if (!resolved) {
    const suggestion = closest(category, Object.keys(ws.config.categories));
    out(
      `my_context: unknown category "${category}".` +
      (suggestion ? ` Did you mean "${suggestion}"?` : '') +
      ` Known: ${Object.keys(ws.config.categories).join(', ')}`,
    );
    return 1;
  }
  if (!resolved.enabled) {
    out(
      `my_context: category "${category}" is not enabled in this project. ` +
      `Enable it in .my_context/config.json under categories.${category}.enabled.`,
    );
    return 1;
  }

  const id = makeId(resolved.prefix, title);
  const filePath = `items/${category}/${id}.md`;
  const target = path.join(root, ...filePath.split('/'));
  if (existsSync(target)) { out(`my_context: ${id} already exists at ${filePath}`); return 1; }

  const item: Item = {
    id, type: category, title, status: 'active', severity: 'soft', always: false,
    scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: new Date().toISOString().slice(0, 10), validUntil: null,
    checksum: '', extra: {}, body: '', observations: [], relations: [],
    layer: 'project', filePath,
  };

  writeItem(root, item);
  out(`my_context: created ${id} at ${filePath}`);
  return 0;
}

function cmdList(ws: Workspace, args: string[], out: Emit): number {
  if (!requireWorkspace(ws, out)) return 1;
  const store = openStore(ws);
  const filter = args[0];
  for (const item of store.all()) {
    if (filter && item.type !== filter) continue;
    out(`${item.id}  ${item.type}  ${item.status}  ${item.title}`);
  }
  store.close();
  return 0;
}

function cmdShow(ws: Workspace, args: string[], out: Emit): number {
  if (!requireWorkspace(ws, out)) return 1;
  const id = args[0];
  if (!id) { out('usage: mycontext show <id>'); return 1; }

  const store = openStore(ws);
  const item = store.get(id);
  store.close();
  if (!item) { out(`my_context: no item with id "${id}".`); return 1; }
  out(renderItem(item));
  return 0;
}

function cmdRebuild(ws: Workspace, out: Emit): number {
  if (!requireWorkspace(ws, out)) return 1;
  const store = Store.open(ws.dbPath);
  const result = rebuild(store, {
    project: ws.projectRoot ?? undefined,
    global: existsSync(ws.globalRoot) ? ws.globalRoot : undefined,
  });
  store.close();
  out(`my_context: indexed ${result.loaded} item(s)`);
  for (const err of result.errors) out(`  error  ${err.file}: ${err.message}`);
  return result.errors.length ? 1 : 0;
}

function cmdStatus(ws: Workspace, out: Emit): number {
  if (!requireWorkspace(ws, out)) return 1;
  const store = openStore(ws);
  const items = store.all();
  store.close();

  const byType = new Map<string, number>();
  const byStatus = new Map<string, number>();
  for (const item of items) {
    byType.set(item.type, (byType.get(item.type) ?? 0) + 1);
    byStatus.set(item.status, (byStatus.get(item.status) ?? 0) + 1);
  }

  out(`my_context: ${items.length} item(s), profile "${ws.config.profile}"`);
  out('');
  out('by category');
  for (const [type, n] of [...byType].sort()) out(`  ${type.padEnd(16)}${n}`);
  out('');
  out('by status');
  for (const [status, n] of [...byStatus].sort()) out(`  ${status.padEnd(16)}${n}`);

  const deadScopes = items.filter((i) => i.scope.length === 0 && i.status === 'active');
  if (deadScopes.length) {
    out('');
    out(`${deadScopes.length} active item(s) have no scope and will never JIT-activate.`);
  }
  return 0;
}

export function runCli(argv: string[], cwd: string, out: Emit): number {
  const [command, ...args] = argv;
  if (!command || command === 'help' || command === '--help') { out(USAGE); return command ? 0 : 1; }
  if (command === 'init') return cmdInit(cwd, out);

  let ws: Workspace;
  try {
    ws = resolveWorkspace(cwd);
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  }

  switch (command) {
    case 'add':     return cmdAdd(ws, args, out);
    case 'list':    return cmdList(ws, args, out);
    case 'show':    return cmdShow(ws, args, out);
    case 'rebuild': return cmdRebuild(ws, out);
    case 'status':  return cmdStatus(ws, out);
    default:
      out(`my_context: unknown command "${command}".\n\n${USAGE}`);
      return 1;
  }
}

if (import.meta.filename === process.argv[1]) {
  process.exitCode = runCli(process.argv.slice(2), process.cwd(), (s) => console.log(s));
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `node --test test/cli/cli.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/workspace.ts src/cli/index.ts test/cli/cli.test.ts
git commit -m "feat: add the CLI with init, add, list, show, rebuild and status"
```

---

## Task 13: SessionStart hook and plugin manifest

**Files:**
- Create: `src/hooks/session-start.ts`, `.claude-plugin/plugin.json`, `hooks/hooks.json`, `README.md`
- Test: `test/hooks/session-start.test.ts`

**Interfaces:**
- Consumes: `resolveWorkspace`, `Store`, `rebuild`, `select`, `renderSelection`
- Produces: `buildSessionStartOutput(cwd: string): string` — the text injected at session start; and a module entry point that prints it and exits 0

The hook must satisfy spec §6.5: exit 0 with empty stdout on any failure, and complete well under the latency ceiling.

- [ ] **Step 1: Write the failing test**

`test/hooks/session-start.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildSessionStartOutput } from '../../src/hooks/session-start.ts';
import { runCli } from '../../src/cli/index.ts';

function sandbox(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-hook-'));
}

function pin(cwd: string, id: string, title: string): void {
  const file = path.join(cwd, '.my_context', 'items', 'constraint', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: constraint
title: ${title}
status: active
severity: hard
always: true
---

# ${title}

Body text.
`);
}

test('with no workspace the hook outputs nothing', () => {
  const cwd = sandbox();
  assert.equal(buildSessionStartOutput(cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('pinned items appear in the output', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  pin(cwd, 'CONST-pool', 'Pool capped at 20');
  const out = buildSessionStartOutput(cwd);
  assert.match(out, /CONST-pool/);
  assert.match(out, /Pool capped at 20/);
  rmSync(cwd, { recursive: true, force: true });
});

test('non-pinned items appear only in the index', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  runCli(['add', 'lesson', 'Migrations need locks'], cwd, () => {});
  const out = buildSessionStartOutput(cwd);
  assert.match(out, /1 lesson/);
  assert.equal(/Migrations need locks/.test(out), false);
  rmSync(cwd, { recursive: true, force: true });
});

test('a corrupt config yields empty output rather than throwing', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  writeFileSync(path.join(cwd, '.my_context', 'config.json'), '{ not json');
  assert.equal(buildSessionStartOutput(cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('the hook completes within the latency ceiling on a large corpus', () => {
  const cwd = sandbox();
  runCli(['init'], cwd, () => {});
  for (let i = 0; i < 500; i++) {
    runCli(['add', 'lesson', `Lesson number ${i}`], cwd, () => {});
  }
  const started = process.hrtime.bigint();
  buildSessionStartOutput(cwd);
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  assert.ok(ms < 500, `session-start took ${ms.toFixed(1)}ms`);
  rmSync(cwd, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/hooks/session-start.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the hook**

`src/hooks/session-start.ts`:

```typescript
import { existsSync } from 'node:fs';
import { rebuild } from '../core/rebuild.ts';
import { renderSelection } from '../core/render.ts';
import { select } from '../core/select.ts';
import { Store } from '../core/store.ts';
import { resolveWorkspace } from '../core/workspace.ts';

/**
 * Build the text injected at SessionStart. Returns '' rather than throwing:
 * a knowledge base that breaks a session is worse than one that says nothing.
 */
export function buildSessionStartOutput(cwd: string): string {
  let store: Store | null = null;
  try {
    const ws = resolveWorkspace(cwd);
    if (!ws.projectRoot) return '';

    store = Store.open(ws.dbPath);
    rebuild(store, {
      project: ws.projectRoot,
      global: existsSync(ws.globalRoot) ? ws.globalRoot : undefined,
    });

    return renderSelection(select(store.all(), { event: 'session-start' }, ws.config));
  } catch {
    return '';
  } finally {
    try { store?.close(); } catch { /* fail open */ }
  }
}

if (import.meta.filename === process.argv[1]) {
  const timer = setTimeout(() => process.exit(0), 200);
  timer.unref();
  try {
    const text = buildSessionStartOutput(process.cwd());
    if (text) process.stdout.write(text);
  } catch {
    /* fail open */
  }
  process.exitCode = 0;
}
```

- [ ] **Step 4: Add the plugin manifest and hook registration**

`.claude-plugin/plugin.json`:

```json
{
  "name": "my-context",
  "version": "0.1.0",
  "description": "Captures project constraints, invariants, rules and decisions as Markdown, and injects the relevant ones back into context.",
  "author": { "name": "Dudi" }
}
```

`hooks/hooks.json`:

```json
{
  "description": "my_context knowledge injection",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|clear|resume",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/src/hooks/session-start.ts\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

Notes on this file, each verified against the documentation and the installed claude-mem plugin:

- **`timeout` is in seconds**, not milliseconds. 10s is a generous ceiling for a hook budgeted at 50ms; the hook also self-limits at 200ms internally.
- **`resume` is included** because a resumed session needs its constraints as much as a fresh one. `compact` is deliberately absent — that is Plan 2's restored tier.
- **No `"shell"` field, deliberately.** claude-mem sets `"shell": "bash"` on every hook, but its commands *are* bash scripts (`export PATH`, subshells, `cygpath`). This command is a bare `node "path"`, and `${CLAUDE_PLUGIN_ROOT}` is interpolated by Claude Code before execution rather than by a shell. Requiring bash would add a hard dependency on git-bash being present on Windows, contradicting the "no shell-specific assumptions" constraint in spec §5.4. **Verify this empirically in Step 5** — if the hook does not fire without a shell, prefer `"shell": "sh"` or an explicit absolute interpreter over `bash`, and record the finding as a `lesson` item once my_context can hold one.

`README.md`:

```markdown
# my_context

Captures the normative knowledge of a project — constraints, invariants, rules,
requirements — as Markdown in `.my_context/`, indexes it in a disposable SQLite
database, and injects the relevant parts back into Claude Code sessions.

Requires Node 24 or newer. No runtime dependencies.

## Quick start

```bash
npm install
npm link          # provides the `mycontext` command

mycontext init
mycontext add constraint "Postgres pool capped at 20"
mycontext status
```

Without `npm link`, every command also works as `node src/cli/index.ts <args>`.

Set `always: true` in an item's frontmatter to have it injected in full at the
start of every session. Everything else appears as a one-line index entry.

Design: `docs/superpowers/specs/2026-08-12-my-context-design.md`
```

- [ ] **Step 5: Verify the hook end to end from a shell**

Run:

```bash
npm link
mycontext init
mycontext add constraint "Pool capped at 20"
node src/hooks/session-start.ts
```

Expected: `mycontext` resolves as a command, and the final line prints the index
containing `CONST-pool-capped-at-20`, exiting 0.

- [ ] **Step 6: Run the whole suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: all PASS. Confirm the reported test-file count matches the number of files in `test/` — a lower count means the glob is being expanded by the shell rather than by Node.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/session-start.ts .claude-plugin hooks README.md test/hooks/session-start.test.ts
git commit -m "feat: add SessionStart hook and plugin manifest"
```

---

## Verification

After Task 13, confirm the plan's goal is met:

```bash
npm test                 # every suite passes on this platform
npm run typecheck        # no type errors
```

Then install the plugin locally and confirm injection actually happens in a real session:

```bash
claude --plugin-dir .
```

Create a constraint with `always: true`, start a new session, and confirm it appears in context.

## What this plan does not cover

Deliberately deferred to later plans, so the boundaries are explicit:

- **Plan 2:** JIT activation via `PreToolUse`, the `PreCompact` snapshot and restore, and the `.my_context/` write-deny. The `jit` and `restored` tiers exist as types here but are never populated.
- **Plan 3:** The MCP server, `mycontext_help`, `mycontext_examples`, and the live-capture nudge.
- **Plan 4:** Batch ingestion, lesson→rule generation with the approval gate, `doctor`, decay reporting, checksum drift detection, and supersession commands.

Two spec requirements are consciously absent, so they are not mistaken for oversights:

- **The session ledger (spec §6.6).** `SelectContext.seen` exists and is honoured, but nothing persists it yet. Plan 1 injects at exactly one moment per session, so there is nothing to deduplicate against. The ledger becomes necessary in Plan 2, when JIT fires repeatedly within a session.
- **Concurrency testing (spec §10).** `busy_timeout` is configured, but no test exercises concurrent writers, because in Plan 1 the only writer is a single-process CLI. Genuine concurrency arrives in Plan 3 when the MCP server and hooks can write simultaneously; the test belongs there, exercising the real contention rather than a synthetic one.
