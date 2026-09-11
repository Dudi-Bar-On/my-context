// @basis TASK-one-field-name-means-two-different-things-on-two-routes, TASK-three-rulings-the-wave-surfaced-the-unbuilt-format-rung-ask
/**
 * **One name, one shape, across the two artefact routes.**
 *
 * `/api/packs` and `/api/port` are the two routes a merge question is open
 * about, and that question was asked from a premise this file exists to keep
 * true. The premise, in the ruling's own words, was that the two routes *"both
 * serve `carries` and `artefact` … They are served once, from packs"* — so
 * merging them read as moving code. Measured on 2026-09-11 it was false in
 * both halves: `/api/packs` served `carries` as one row per top-level config
 * key (`{ key, travels, refusals }`), `/api/port` served `history.carries` as
 * the audit kinds that travel (`['mutation']`), and `artefact` was served by
 * packs and by nothing else. **The shared name was the whole of the evidence
 * that anything was shared**, and it made a merge question look answered.
 *
 * The rename that repairs it is a one-day fact. This is the part that is not:
 * a second field called the same thing holding a different type is exactly
 * what happened once, and it survived review because *"neither model could see
 * the other's shape"*. So the two responses are built here, from a real
 * workspace with a real imported pack in it, and every field NAME either body
 * carries — at any depth, inside array elements included — is collected with
 * the SHAPE it holds. A name that appears on both routes holding two different
 * shapes is a failure, reported with both shapes and both paths.
 *
 * **It compares shapes, not types, and the difference is the point.** A
 * compile-time check can only see the two `Body` interfaces' top-level keys
 * without machinery nobody will maintain; the collision that actually happened
 * was nested one level down, under `history`. The type-level pin below is
 * therefore the cheap half — it fails `tsc` if a shared TOP-LEVEL key ever
 * disagrees — and this walk is the half that would have caught the real one.
 *
 * ## What each assertion rests on, so a future reader is not guessing
 *
 * The shared-name set is PINNED rather than merely checked for collisions. A
 * newly shared name is not wrong — `where` and `message` are shared today and
 * are right to be — but it is a decision, and pinning the set is what turns it
 * from something that happens into something somebody does. The failure names
 * what to do about it.
 *
 * The two probe assertions exist because a walk that silently stopped
 * descending would report no collisions and pass. Each names fields that only
 * exist BELOW the top level and inside array elements, so a walk that lost
 * either descent goes red instead of going quiet.
 *
 * The last three tests are the other half of a rename and are described where
 * they are: the screens read these fields by name, in a file no node test
 * evaluates, and a screen left reading the old name draws an empty card and
 * throws nothing. They read the screen's SOURCE, never its DOM — the line
 * `work-screen.test.ts` draws, kept here too — so they prove both halves of a
 * rename were made and prove nothing at all about what the page looks like.
 *
 * Nothing here writes. Both models are pure reads and `no-writes.test.ts` is
 * what holds that, not this file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { apiPacks, type PacksBody } from '../../src/ui/packs-model.ts';
import { apiPort, type PortBody } from '../../src/ui/port-model.ts';
import { removeTree } from '../helpers/tmp.ts';

/* -------------------------------------------------------------------------- *
 * The compile-time half: shared TOP-LEVEL keys must hold the same type.
 * -------------------------------------------------------------------------- */

type SharedTopLevel = Extract<keyof PacksBody, keyof PortBody>;
/** Every shared top-level key whose two types are not mutually assignable. */
type Disagreeing = {
  [K in SharedTopLevel]: PacksBody[K] extends PortBody[K]
    ? (PortBody[K] extends PacksBody[K] ? never : K)
    : K;
}[SharedTopLevel];
const sharedTopLevelFieldsAgree: [Disagreeing] extends [never] ? true : never = true;
void sharedTopLevelFieldsAgree;

/* -------------------------------------------------------------------------- *
 * The fixture: a real workspace with a real pack imported into it.
 * -------------------------------------------------------------------------- */

const scratch: string[] = [];
test.after(() => { for (const dir of scratch) removeTree(dir); });

function tmp(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  scratch.push(dir);
  return dir;
}

function run(cwd: string, args: string[]): void {
  const lines: string[] = [];
  const code = runCli(args, cwd, (line: string) => lines.push(line));
  assert.equal(code, 0, `fixture command failed: ${args.join(' ')}\n${lines.join('\n')}`);
}

/**
 * A workspace with one pack in it, because a pack row is where half of
 * `/api/packs`' field names live: `packs: []` walks none of them, and a
 * collision introduced inside `packRow` would be invisible to a gate built on
 * an empty corpus.
 */
function workspaceWithPack(): string {
  const author = tmp('myctx-names-author-');
  const artefact = path.join(tmp('myctx-names-artefact-'), 'pack1');
  run(author, ['init']);
  run(author, ['add', '--summary-omitted', 'rule', 'Never log customer email', '--body', 'Redact it.', '--yes']);
  run(author, ['export', '--out', artefact, '--as-pack', '--pack-name', 'acme security',
    '--pack-version', '2026-09 rev 1']);

  const dir = tmp('myctx-names-');
  run(dir, ['init']);
  run(dir, ['rebuild']);
  run(dir, ['pack', 'import', artefact, '--yes']);
  // An import that failed before its record was written leaves exactly this,
  // and it is the only way to make `dropped` non-empty. Without it `where` and
  // `message` never appear on `/api/packs` at all, the two routes share no
  // name whatsoever, and the comparison below has nothing to compare — green
  // because it never ran, which is the failure this fixture exists to avoid.
  mkdirSync(path.join(dir, '.my_context', '.audit', 'imported', 'half-imported'));
  return dir;
}

let cached: { packs: PacksBody; port: PortBody } | null = null;

function served(): { packs: PacksBody; port: PortBody } {
  if (cached !== null) return cached;
  const dir = workspaceWithPack();
  const ws = resolveWorkspace(dir);
  const packs = apiPacks(ws, new URL('http://x/api/packs'));
  assert.equal(packs.status, 200, 'the fixture workspace did not answer /api/packs');
  const port = apiPort(ws, new URL('http://x/api/port'));
  assert.equal(port.status, 200, 'the fixture workspace did not answer /api/port');
  cached = { packs: packs.body as PacksBody, port: port.body as PortBody };
  return cached;
}

/* -------------------------------------------------------------------------- *
 * The walk.
 * -------------------------------------------------------------------------- */

/**
 * What a value IS, in one line a reader can compare by eye.
 *
 * An array is the union of its elements' shapes, so a list of rows reads as
 * `array<object{key,refusals,travels}>` rather than as `object`. An EMPTY
 * array is `array<>` and is compatible with any array below: `refusals: []` on
 * one row and `refusals: ['…']` on the next is one field, not two.
 */
function shapeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    return `array<${[...new Set(value.map(shapeOf))].toSorted().join('|')}>`;
  }
  if (typeof value === 'object') {
    return `object{${Object.keys(value as object).toSorted().join(',')}}`;
  }
  return typeof value;
}

const EMPTY_ARRAY = 'array<>';

/** Two shapes one name may hold without the name having become ambiguous. */
function compatible(a: string, b: string): boolean {
  if (a === b) return true;
  if (!a.startsWith('array<') || !b.startsWith('array<')) return false;
  return a === EMPTY_ARRAY || b === EMPTY_ARRAY;
}

/** name → shape → the paths where that name held that shape. */
type Names = Map<string, Map<string, string[]>>;

function collect(value: unknown, at: string, into: Names): void {
  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) collect(entry, `${at}[${index}]`, into);
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [name, field] of Object.entries(value)) {
    const shape = shapeOf(field);
    const shapes = into.get(name) ?? new Map<string, string[]>();
    shapes.set(shape, [...(shapes.get(shape) ?? []), `${at}.${name}`]);
    into.set(name, shapes);
    collect(field, `${at}.${name}`, into);
  }
}

function namesOf(body: unknown, route: string): Names {
  const names: Names = new Map();
  collect(body, route, names);
  return names;
}

function bothRoutes(): { packs: Names; port: Names; shared: string[] } {
  const body = served();
  const packs = namesOf(body.packs, '/api/packs');
  const port = namesOf(body.port, '/api/port');
  const shared = [...packs.keys()].filter((name) => port.has(name)).toSorted();
  return { packs, port, shared };
}

/* -------------------------------------------------------------------------- */

test('no field name means two different things on /api/packs and /api/port', () => {
  const { packs, port, shared } = bothRoutes();

  const ambiguous: string[] = [];
  for (const name of shared) {
    const here = packs.get(name)!;
    const there = port.get(name)!;
    const ours = [...here.keys()];
    const theirs = [...there.keys()];
    if (ours.some((a) => theirs.some((b) => compatible(a, b)))) continue;
    const where = (shapes: Map<string, string[]>): string =>
      [...shapes].map(([shape, paths]) => `${shape} at ${paths.join(', ')}`).join(' | ');
    ambiguous.push(`${name}: /api/packs serves ${where(here)}; /api/port serves ${where(there)}`);
  }

  assert.deepEqual(ambiguous, [],
    'one field name holds two different shapes across the two artefact routes. That is the '
    + 'defect port/15 was filed for: the name says less than it appears to, and a reader who '
    + 'takes it as a shared fact — as the merge ruling did — is reading something that was '
    + 'never measured. Rename so each field says what it holds; do not add the name to an '
    + 'exception list, because a blessed collision is the same defect wearing a checkmark.');
});

test('the set of names BOTH artefact routes carry is pinned, so a new one is a decision', () => {
  const { shared } = bothRoutes();

  assert.deepEqual(shared, ['message', 'where'],
    'the two artefact routes now share a field name they did not share before. Sharing one is '
    + 'not wrong — `where` and `message` are the disclosure pair and are right to be shared — '
    + 'but it is a decision, and the assertion above only checks that the SHAPES agree. Two '
    + 'routes agreeing on a shape while meaning different things by it is how `carries` '
    + 'survived review. Confirm the name means one thing, then update this list.');
});

test('the walk descends into /api/packs nested objects and array elements', () => {
  const { packs } = bothRoutes();

  const probes = ['configKeys', 'travels', 'refusals', 'importedAt', 'byStatus'];
  assert.deepEqual(probes.filter((name) => !packs.has(name)), [],
    'a field this walk must reach is not in the collected names. `configKeys`/`travels`/'
    + '`refusals` live inside array elements and `byStatus`/`importedAt` inside a pack row, so '
    + 'either the response stopped serving them or the walk stopped descending — and a walk '
    + 'that stopped descending reports no collisions and passes, which is the one way this '
    + 'file can be green and worthless.');
});

test('the walk descends into /api/port nested objects and array elements', () => {
  const { port } = bothRoutes();

  const probes = ['whatTravels', 'carriedKinds', 'withheld', 'verdict', 'built', 'argv'];
  assert.deepEqual(probes.filter((name) => !port.has(name)), [],
    'a field this walk must reach is not in the collected names. `carriedKinds`/`withheld` are '
    + 'one level down under `history`, `verdict`/`built` live inside array elements, and `argv` '
    + 'is under `command` — so either the response stopped serving them or the walk stopped '
    + 'descending. See the sibling assertion for why a silent walk is the failure that matters.');
});

/* -------------------------------------------------------------------------- *
 * The other half of a rename: the screens that read these fields.
 *
 * Renaming a field is two edits, and the second one is in a file no node test
 * evaluates — spec §6 names `screens/*.js` as the untested surface, and a
 * screen that reads `body.carries` from a response now serving `configKeys`
 * draws an EMPTY card rather than throwing. Nothing goes red; the table is
 * just gone, and it stays gone until somebody opens the page.
 *
 * So the read is checked where it can be: in the source text, which is the
 * technique `port-screen.test.ts` already uses for the same reason ("no audit
 * kind is transcribed into the screen"). Every `body.<name>` the screen reads
 * must be a field the real response actually carries. It does not prove the
 * card renders — only a browser does that — but it does prove the two halves
 * of a rename were both made, which is the half a rename gets wrong.
 * -------------------------------------------------------------------------- */

const PUBLIC = path.join(import.meta.dirname, '..', '..', 'src', 'ui', 'public');

/**
 * A screen's CODE, with its comments taken out.
 *
 * Both files argue at length in prose about fields they deliberately do not
 * draw — `history.importedDir` is named in a comment saying exactly that — and
 * a check that counted those would report a field as read when the line that
 * read it had been deleted. Neither file contains `://`, so the line-comment
 * rule cannot eat a URL; that is measured, not assumed.
 */
function code(screen: string): string {
  const source = readFileSync(path.join(PUBLIC, 'screens', screen), 'utf8');
  assert.equal(source.includes('://'), false, `${screen} now contains a URL; see this comment`);
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

/**
 * Every `name.x` and `name?.x` in a screen's code, deduplicated and sorted.
 *
 * The lookbehind is load-bearing: without it `tbody.append(…)` reads as a
 * field of `body` called `append`, and a pattern that matches five things that
 * are not fields is a pattern nobody can assert the whole of.
 */
function reads(source: string, holder: string): string[] {
  const pattern = new RegExp(`(?<![\\w$])${holder}\\??\\.([A-Za-z_$][\\w$]*)`, 'g');
  return [...new Set([...source.matchAll(pattern)].map((m) => m[1]!))].toSorted();
}

test('every field packs.js reads off the response is a field /api/packs serves', () => {
  const fields = reads(code('packs.js'), 'body');
  const keys = new Set(Object.keys(served().packs));

  assert.deepEqual(
    { reads: fields, unknown: fields.filter((name) => !keys.has(name)) },
    { reads: ['configKeys', 'dropped', 'landing', 'packs'], unknown: [] },
    'packs.js reads a field /api/packs does not serve, or has stopped reading one it did. A '
    + 'screen reading a renamed field draws an empty card and throws nothing, so this is the '
    + 'only place short of a browser where half a rename is visible. `artefact` is served and '
    + 'deliberately unread — that is in the screen\'s own header — so the list is what is READ, '
    + 'never what is served.');
});

test('every field port.js reads off the response is a field /api/port serves', () => {
  const fields = reads(code('port.js'), 'body');
  const keys = new Set(Object.keys(served().port));

  assert.deepEqual(
    { reads: fields, unknown: fields.filter((name) => !keys.has(name)) },
    { reads: ['buckets', 'command', 'formats', 'history', 'whatTravels'], unknown: [] },
    'port.js reads a field /api/port does not serve, or has stopped reading one it did. '
    + '`disclosures` is served and unread, which the screen\'s header already reports as a gap '
    + 'and this list therefore does not contain.');
});

test('the audit chips read the fields the response really puts under `history`', () => {
  // `auditChips`' parameter is named `history`, so its reads are visible the
  // same way — and this is the pair the collision was actually in.
  const fields = reads(code('port.js'), 'history');
  const keys = new Set(Object.keys(served().port.history));

  assert.deepEqual(
    { reads: fields, unknown: fields.filter((name) => !keys.has(name)) },
    { reads: ['carriedKinds', 'withheld'], unknown: [] },
    'port.js reads a kind list `/api/port` does not put under `history`. This is the exact pair '
    + 'port/15 renamed: a screen left reading `history.carries` would draw the withheld chips '
    + 'and silently lose the one kind that travels.');
});
