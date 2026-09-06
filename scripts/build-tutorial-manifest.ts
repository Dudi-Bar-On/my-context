#!/usr/bin/env node
/**
 * Clusters four already-globbable surfaces — `src/cli/commands/*.ts` (minus
 * plumbing), `src/ui/public/screens/*.js` (minus the meta reader screens),
 * `commands/*.md`, and the 29 keys `src/core/categories.ts`'s `CATEGORIES`
 * carries — into one tutorial per FEATURE, and writes the result to
 * `docs/tutorials/manifest.json`.
 *
 *   npm run gen:tutorials
 *
 * **`CLUSTERS` below is the one hand-authored table this build has** — the
 * clustering itself (which command belongs with which screen) is a judgement
 * about what a user is trying to DO, and no glob can make that call. What is
 * NOT hand-typed is the two biggest slash-command groups: the 29
 * `add-<category>.md` and 29 `list-<category>.md` filenames are derived from
 * `CATEGORIES`' own keys through `commandSlug` (the exact function
 * `src/plugin/commands.ts` uses to name them), and the four `pin`/`unpin`/
 * `harden`/`soften` filenames are derived from `edit.ts`'s own
 * `NAMED_ENTRY_POINTS`. A category or a named entry point added anywhere
 * else in this repository updates its slash filename here for free; only the
 * CLUSTER a file belongs to is ever typed by hand.
 *
 * **This is the deliverable's enforcement mechanism, not merely its
 * producer.** `validateCoverage` below runs the identical closed-set check
 * `test/core/tutorial-manifest.test.ts` runs independently — every currently
 * globbed file, except the named meta/plumbing exclusions, claimed by
 * EXACTLY one cluster — and throws, naming the file, before writing anything.
 * A cluster that falls out of date with the surfaces it draws from fails this
 * script loudly rather than freezing a stale roster silently.
 */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMainEntry } from '../src/core/paths.ts';
import { CATEGORIES } from '../src/core/categories.ts';
import { commandSlug } from '../src/plugin/commands.ts';
import { NAMED_ENTRY_POINTS } from '../src/cli/commands/edit.ts';
import { TUTORIAL_MANIFEST_PATH, type TutorialManifestEntry, type TutorialTier } from '../src/core/tutorial-manifest.ts';

export const CLI_DIR = 'src/cli/commands';
export const SCREENS_DIR = 'src/ui/public/screens';
export const SLASH_DIR = 'commands';

/** Files in `src/cli/commands/` that register no user-facing verb of their own. */
export const PLUMBING_CLI = new Set(['index.ts', 'registry.ts', 'format.ts']);

/**
 * Screens that read and browse the documentation themselves — never a tutorial
 * subject.
 *
 * `docs.js` and `tut.js` were two of these and are GONE:
 * `DEC-the-documentation-and-tutorials-screens-become-one-list-and`, owner
 * ruling 2026-09-05, replaced both with one console page. This set was not
 * updated with them, so `library.js` — the page that replaced them, and which
 * is the same kind of thing they were — has been claimed by no cluster and
 * excluded by nothing since that day. `test/core/tutorial-manifest.test.ts`
 * asserts in a LOOP, so the first unclaimed file masks the rest, and the two
 * dead names are what kept `library.js` from being the first.
 *
 * Corrected here (`plan:library seq:1`), which is the change that surfaced it:
 * `cli-help.js` is the Library's command-line card, a second module of that
 * same page, and it landed alphabetically ahead of `library.js` and failed in
 * its place. Both are meta for exactly the reason `docs.js` and `tut.js` were
 * — a screen whose subject is the documentation is not itself a feature a
 * tutorial teaches — and the dead names are removed rather than left as two
 * entries nothing can ever match.
 *
 * The manifest itself is unchanged by this: a META screen is filtered out
 * before coverage is computed and was never an entry.
 */
export const META_SCREENS = new Set([
  'parts.js', 'learn.js', 'library.js', 'cli-help.js',
]);

/**
 * One cluster before its derived slash entries (the per-category and
 * per-named-entry-point files) are appended. `categories: true` marks the
 * one cluster — capturing an item — that claims every category key; every
 * other cluster claims none, per the spec's own ruling that "the categories"
 * is one feature, not 29.
 */
interface Cluster {
  id: string;
  title: string;
  tier: TutorialTier;
  cli: string[];
  slash: string[];
  screens: string[];
  categories?: true;
}

const CLUSTERS: Cluster[] = [
  {
    id: 'capturing-an-item-and-the-categories',
    title: "Capture what you just decided, before you forget it",
    tier: 'basic',
    cli: [],
    slash: ['add.md'],
    screens: ['capture.js'],
    categories: true,
  },
  {
    id: 'reading-and-searching-the-corpus',
    title: "Find the item you're thinking of, from the CLI or the UI",
    tier: 'basic',
    cli: ['query.ts', 'search.ts', 'audit.ts'],
    slash: ['show.md', 'query.md', 'search.md', 'audit.md'],
    screens: ['ask.js'],
  },
  {
    id: 'checking-on-the-corpus',
    title: "Check whether your corpus is healthy, and what's ready to work on",
    tier: 'basic',
    cli: ['status.ts', 'doctor.ts', 'ready.ts', 'ack.ts'],
    slash: ['status.md', 'doctor.md', 'ready.md'],
    screens: ['status.js', 'doctor.js'],
  },
  {
    id: 'narrowing-a-session-focus',
    title: 'Narrow what gets injected into this session',
    tier: 'advanced',
    cli: ['focus.ts'],
    slash: ['focus.md'],
    screens: ['palette.js'],
  },
  {
    id: 'injection-tiers',
    title: 'See what my_context actually injected, and why',
    tier: 'advanced',
    cli: ['injection.ts'],
    slash: [],
    screens: ['injected.js'],
  },
  {
    id: 'injection-preview-and-spilled-items',
    title: 'Preview what a query would inject, and pull back what spilled',
    tier: 'advanced',
    cli: ['carry.ts'],
    slash: [],
    screens: ['preview.js'],
  },
  {
    id: 'scope-and-coverage',
    title: 'See which files and areas your corpus actually covers',
    tier: 'advanced',
    cli: [],
    slash: [],
    screens: ['coverage.js'],
  },
  {
    id: 'budgets-and-the-simulator',
    title: 'Simulate a budget before you commit to it',
    tier: 'advanced',
    cli: [],
    slash: [],
    screens: ['simulate.js'],
  },
  {
    id: 'configuration',
    title: 'Configure how my_context behaves for this project',
    tier: 'advanced',
    cli: ['config.ts'],
    slash: [],
    screens: ['config.js'],
  },
  {
    id: 'revisions-and-the-review-queue',
    title: 'Review a pending change before it governs',
    tier: 'advanced',
    cli: ['review.ts', 'revision-view.ts', 'edit.ts', 'supersede.ts'],
    slash: ['review.md', 'supersede.md', 'edit.md', 'promote.md', 'discard.md'],
    screens: ['work.js'],
  },
  {
    id: 'template-packs',
    title: 'Start a new project from a template pack',
    tier: 'advanced',
    cli: ['pack.ts'],
    slash: [],
    screens: ['packs.js'],
  },
  {
    id: 'export-and-import-your-corpus',
    title: 'Export your corpus, and import it somewhere else',
    tier: 'advanced',
    cli: ['export.ts'],
    slash: [],
    screens: ['port.js'],
  },
  {
    id: 'linking-items-and-the-relations-graph',
    title: 'Link two items, and see how your corpus connects',
    tier: 'advanced',
    cli: ['link.ts'],
    slash: ['link.md', 'unlink.md'],
    screens: ['graph.js'],
  },
  {
    id: 'ingesting-and-refreshing-from-a-source-file',
    title: 'Pull items out of a document you already wrote',
    tier: 'advanced',
    cli: ['ingest.ts', 'refresh.ts'],
    slash: ['ingest.md', 'refresh.md'],
    screens: [],
  },
  {
    id: 'lessons-staging-and-promotion',
    title: 'Turn an incident into a lesson, staged before it governs',
    tier: 'advanced',
    cli: ['lesson.ts'],
    slash: ['lesson.md', 'lesson-stage.md'],
    screens: [],
  },
  {
    id: 'the-inbox',
    title: 'Triage quick captures out of the inbox',
    tier: 'basic',
    cli: ['todo.ts', 'inbox-promote.ts'],
    slash: ['todo.md', 'inbox-promote.md'],
    screens: [],
  },
  {
    id: 'decay-finding-what-stopped-mattering',
    title: 'Find what stopped mattering',
    tier: 'advanced',
    cli: ['decay.ts'],
    slash: ['decay.md'],
    screens: ['decay.js'],
  },
  {
    id: 'corpus-integrity-detecting-and-repairing-drift',
    title: 'Detect and repair a corpus that drifted from disk',
    tier: 'advanced',
    cli: ['context.ts', 'repair.ts'],
    slash: [],
    screens: [],
  },
  {
    id: 'the-audit-log-live-stream',
    title: 'Watch what my_context is doing, live',
    tier: 'advanced',
    cli: [],
    slash: [],
    screens: ['watch.js'],
  },
  {
    id: 'sessions-and-continuity',
    title: 'Carry work from one session into the next',
    tier: 'advanced',
    cli: ['session.ts'],
    slash: ['session-carry.md', 'session-name.md'],
    screens: [],
  },
  {
    id: 'the-status-line',
    title: "Show my_context state in your terminal's status line",
    tier: 'advanced',
    cli: ['statusline.ts', 'statusline-install.ts', 'statusline-powerline.ts'],
    slash: [],
    screens: [],
  },
  {
    id: 'procedures',
    title: 'Write and run a procedure',
    tier: 'advanced',
    cli: ['procedure.ts'],
    slash: ['procedure.md'],
    screens: ['proc.js'],
  },
  {
    id: 'the-web-ui-itself',
    title: 'Open and use the web UI',
    tier: 'basic',
    cli: ['ui.ts'],
    slash: ['ui.md'],
    screens: [],
  },
  {
    id: 'loading-context-into-a-session',
    title: "Load this project's context at the start of a session",
    tier: 'basic',
    cli: [],
    slash: ['LoadMyContext.md'],
    screens: [],
  },
];

/**
 * Every category's `add-<slug>.md` goes to the one categories cluster; every
 * category's `list-<slug>.md` goes to the corpus-reading cluster, where a
 * reader actually goes to browse one category's items. Neither list is typed
 * here — both are the category keys, slugged the same way the generator that
 * writes the files on disk slugs them.
 */
function withDerivedSlash(clusters: Cluster[]): Cluster[] {
  const categoryKeys = Object.keys(CATEGORIES);
  const addFiles = categoryKeys.map((k) => `add-${commandSlug(k)}.md`);
  const listFiles = categoryKeys.map((k) => `list-${commandSlug(k)}.md`);
  const namedFiles = NAMED_ENTRY_POINTS.map((e) => `${e.name}.md`);
  return clusters.map((c) => {
    if (c.id === 'capturing-an-item-and-the-categories') {
      return { ...c, slash: [...c.slash, ...addFiles] };
    }
    if (c.id === 'reading-and-searching-the-corpus') {
      return { ...c, slash: [...c.slash, ...listFiles] };
    }
    if (c.id === 'revisions-and-the-review-queue') {
      return { ...c, slash: [...c.slash, ...namedFiles] };
    }
    return c;
  });
}

/** `readdirSync`, filtered to the extension and sorted, so glob order never depends on the OS. */
function listFiles(dir: string, ext: string): string[] {
  return readdirSync(dir).filter((f) => f.endsWith(ext)).sort();
}

/**
 * Every currently-globbed file (minus the named exclusions), claimed by
 * EXACTLY one cluster — the same check `test/core/tutorial-manifest.test.ts`
 * runs independently over the frozen manifest. Run here, before the manifest
 * is even written, so a stale `CLUSTERS` table fails the generator itself
 * rather than freezing a wrong roster.
 */
export function validateCoverage(repoRoot: string, clusters: Cluster[]): void {
  const errors: string[] = [];

  function checkSurface(label: string, files: string[], pick: (c: Cluster) => string[]): void {
    const claimedBy = new Map<string, string[]>();
    for (const c of clusters) {
      for (const f of pick(c)) claimedBy.set(f, [...(claimedBy.get(f) ?? []), c.id]);
    }
    for (const f of files) {
      const owners = claimedBy.get(f) ?? [];
      if (owners.length !== 1) {
        errors.push(`${label} "${f}": claimed by ${owners.length} tutorials (${owners.join(', ') || 'none'})`);
      }
    }
  }

  const cliFiles = listFiles(path.join(repoRoot, CLI_DIR), '.ts').filter((f) => !PLUMBING_CLI.has(f));
  checkSurface('CLI command', cliFiles, (c) => c.cli);

  const screenFiles = listFiles(path.join(repoRoot, SCREENS_DIR), '.js').filter((f) => !META_SCREENS.has(f));
  checkSurface('UI screen', screenFiles, (c) => c.screens);

  const slashFiles = listFiles(path.join(repoRoot, SLASH_DIR), '.md');
  checkSurface('slash command', slashFiles, (c) => c.slash);

  const categoryKeys = Object.keys(CATEGORIES).sort();
  checkSurface('category', categoryKeys, (c) => (c.categories ? categoryKeys : []));

  if (errors.length > 0) {
    throw new Error(`tutorial manifest coverage failed:\n${errors.join('\n')}`);
  }
}

/** `CLUSTERS`, its derived slash files appended, turned into the manifest's own shape. */
export function deriveTutorialManifest(repoRoot: string): TutorialManifestEntry[] {
  const clusters = withDerivedSlash(CLUSTERS);
  validateCoverage(repoRoot, clusters);
  return clusters.map((c): TutorialManifestEntry => ({
    id: c.id,
    title: c.title,
    tier: c.tier,
    cli: [...c.cli].sort(),
    slash: [...c.slash].sort(),
    screens: [...c.screens].sort(),
    categories: c.categories ? Object.keys(CATEGORIES).sort() : [],
    enFile: `docs/tutorials/${c.id}.md`,
    heFile: `docs/tutorials/${c.id}.he.md`,
  }));
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  const repoRoot = path.join(import.meta.dirname, '..');
  const manifest = deriveTutorialManifest(repoRoot);
  const outPath = path.join(repoRoot, TUTORIAL_MANIFEST_PATH);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`wrote ${manifest.length} tutorials to ${TUTORIAL_MANIFEST_PATH}`);
}
