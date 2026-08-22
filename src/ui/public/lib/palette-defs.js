// The command catalogue (spec §4, Work: "build a command from selections and
// inputs, with real pickers and a live glob tester"). Write commands are
// COMPOSED AND COPIED with the on-screen note — per spec §2 the only treatment
// of a write anywhere in this UI. Read commands EXECUTE: they navigate to the
// screen that renders the answer, or fetch the endpoint that serves it.
//
// ── WHY THIS FILE IS A LIST AT ALL, AND WHAT STOPS IT GOING STALE ──────────
//
// A hand-kept list of commands is a defect waiting to happen; this repository
// has already paid for four of them (§7 of both READMEs, the recommended deny
// block, and the skill, each of which went stale on the day a command shipped
// — see `test/helpers/approval-boundary.ts`). The honest answer would be to
// derive this catalogue from the CLI's own registry at load time. A browser
// module cannot: there is no bundler, no build step and no runtime dependency,
// and the registry is TypeScript that only Node ever loads.
//
// So the list is here, and EVERY claim it makes is derived somewhere else and
// compared against it. `test/ui/palette-lib.test.ts` runs the real CLI and
// fails this file when:
//
//   * a def names a command string the registry does not have (derived from
//     `COMMANDS` and the four `SUBCOMMANDS` exports);
//   * a def advertises a flag the command refuses, or omits one it accepts
//     (derived by probing the real argument parser, the same probe
//     `approval-boundary.ts` uses, with every omission named and reasoned);
//   * a def's `boundary` or `ungated` marking disagrees with
//     `approvalBoundary()` (derived from which command strings the parser
//     accepts `--yes` on);
//   * any argv this file composes is one the real parser REFUSES.
//
// That last one is the load-bearing check. It is why `--always` on `edit`
// carries `joined: true` below: `mycontext edit <id> --always false` is
// refused outright ("unexpected argument \"false\"") while `--always=false` is
// the form that unsets, and a catalogue that composed the first would hand the
// user a broken command with every other test in this file still green.
//
// ── WHAT THIS FILE WILL NOT DO ────────────────────────────────────────────
//
// It composes. It does not run, and it holds nothing that could: no network
// name, no dynamic evaluation, no navigation, no import of any kind. That is
// checked over these bytes, not promised — see `command.js`'s header.
//
// **Promotion stays a human act, at CLI distance.** Both READMEs and the skill
// say an agent must never promote on a user's behalf, and the gate that makes
// that mean something is a person reading a command and running it. Every
// promotion here therefore composes exactly what the CLI takes, `--yes` shown
// rather than hidden, one item named by id. `review promote --all --pack
// <name>` — every draft a pack imported, settled in one confirmation — is a
// real flag pair and is deliberately NOT offered: turning a bulk promotion
// into a checkbox is a design decision about how close to one click an
// unreviewed promotion should sit, and this task is not the place to take it.
// `FLAGS_NOT_OFFERED` in the test names it, so adding it later means editing a
// test that states the reason rather than editing a list that does not.

/** `--yes`, spelled once. On the approval boundary it is SHOWN, never implied. */
const yes = { name: 'yes', boolean: true };

export const PALETTE = [
  // --- writes: composed, copied, never executed --------------------------
  {
    name: 'add', kind: 'write', base: ['mycontext', 'add'], overlap: true, boundary: true,
    args: [
      { name: 'category', source: 'categories', required: true },
      { name: 'title', input: 'text', required: true },
    ],
    // `--step` and `--extra` are repeatable at the CLI and single-valued here:
    // this model is one value per flag, and a screen that needed two steps
    // would have to grow a repeat control rather than quietly compose one.
    flags: [
      { name: 'body', input: 'textarea' }, { name: 'file', input: 'text' },
      { name: 'note', input: 'text' }, { name: 'step', input: 'text' },
      { name: 'scope', input: 'glob' }, { name: 'tags', input: 'text' },
      { name: 'severity', options: ['hard', 'soft'] }, { name: 'extra', input: 'text' },
      yes,
    ],
  },
  {
    name: 'edit', kind: 'write', base: ['mycontext', 'edit'], boundary: true,
    args: [{ name: 'id', source: 'items', required: true }],
    flags: [
      { name: 'title', input: 'text' }, { name: 'body', input: 'textarea' },
      { name: 'scope', input: 'glob' }, { name: 'tags', input: 'text' },
      { name: 'severity', options: ['hard', 'soft'] },
      // `--always[=false]`: a switch with an explicit false, so it must be
      // composed JOINED. Space-separated is a refusal, not a synonym.
      { name: 'always', options: ['true', 'false'], joined: true },
      { name: 'status', options: ['active', 'draft', 'deprecated', 'validated'] },
      { name: 'extra', input: 'text' },
      yes,
    ],
  },
  { name: 'pin', kind: 'write', base: ['mycontext', 'pin'], boundary: true, args: [{ name: 'id', source: 'items', required: true }], flags: [yes] },
  { name: 'unpin', kind: 'write', base: ['mycontext', 'unpin'], boundary: true, args: [{ name: 'id', source: 'items', required: true }], flags: [yes] },
  { name: 'harden', kind: 'write', base: ['mycontext', 'harden'], boundary: true, args: [{ name: 'id', source: 'items', required: true }], flags: [yes] },
  { name: 'soften', kind: 'write', base: ['mycontext', 'soften'], boundary: true, args: [{ name: 'id', source: 'items', required: true }], flags: [yes] },
  {
    name: 'supersede', kind: 'write', base: ['mycontext', 'supersede'], boundary: true,
    args: [{ name: 'id', source: 'items', required: true }],
    flags: [
      { name: 'by', source: 'items', required: true },
      { name: 'reason', input: 'text' },
      yes,
    ],
  },
  { name: 'refresh', kind: 'write', base: ['mycontext', 'refresh'], boundary: true, args: [{ name: 'id', source: 'items', required: true }], flags: [yes] },
  { name: 'repair', kind: 'write', base: ['mycontext', 'repair'], boundary: true, args: [], flags: [yes] },
  {
    // The one member of the approval boundary with NO gate to show. It creates
    // an `active` rule with no `--yes` and no prompt of any kind (§3, §7), so
    // there is no token for a human to withhold — `ungated` is how the screen
    // is told to say that instead of rendering a checkbox that does not exist.
    name: 'lesson-accept', kind: 'write', base: ['mycontext', 'lesson-accept'],
    boundary: true, ungated: true,
    args: [{ name: 'id', input: 'text', required: true }, { name: 'key', input: 'text', required: true }],
    flags: [
      { name: 'title', input: 'text' }, { name: 'scope', input: 'glob' },
      { name: 'severity', options: ['hard', 'soft'] },
      { name: 'directive', options: ['do', 'dont'] },
    ],
  },
  {
    name: 'lesson-discard', kind: 'write', base: ['mycontext', 'lesson-discard'],
    args: [{ name: 'id', input: 'text', required: true }, { name: 'key', input: 'text', required: true }],
    flags: [],
  },
  {
    name: 'review promote', kind: 'write', base: ['mycontext', 'review', 'promote'], boundary: true,
    args: [{ name: 'id', source: 'drafts', required: true }],
    flags: [
      { name: 'scope', input: 'glob' }, { name: 'always', boolean: true },
      { name: 'severity', options: ['hard', 'soft'] }, yes,
    ],
  },
  {
    name: 'review discard', kind: 'write', base: ['mycontext', 'review', 'discard'], boundary: true,
    args: [{ name: 'id', source: 'drafts', required: true }], flags: [yes],
  },
  {
    name: 'review promote-revision', kind: 'write', base: ['mycontext', 'review', 'promote-revision'],
    boundary: true,
    args: [{ name: 'id', source: 'revisions', required: true }],
    flags: [{ name: 'revision', input: 'text' }, { name: 'force', boolean: true }, yes],
  },
  {
    name: 'review discard-revision', kind: 'write', base: ['mycontext', 'review', 'discard-revision'],
    boundary: true,
    args: [{ name: 'id', source: 'revisions', required: true }],
    flags: [{ name: 'revision', input: 'text' }, { name: 'reason', input: 'text' }, yes],
  },
  // rebuild rewrites .index.db on disk — a write for composition purposes
  // even though it is not in the deny recipe (it rebuilds a derived file the
  // README tells users they may delete freely).
  { name: 'rebuild', kind: 'write', base: ['mycontext', 'rebuild'], args: [], flags: [] },

  // --- reads: executed by the UI -----------------------------------------
  { name: 'status', kind: 'read', base: ['mycontext', 'status'], args: [], flags: [], screen: '#/status' },
  { name: 'doctor', kind: 'read', base: ['mycontext', 'doctor'], args: [], flags: [], screen: '#/doctor' },
  { name: 'decay', kind: 'read', base: ['mycontext', 'decay'], args: [], flags: [], screen: '#/decay' },
  { name: 'review revisions', kind: 'read', base: ['mycontext', 'review', 'revisions'], args: [], flags: [], screen: '#/work' },
  {
    name: 'help', kind: 'read', base: ['mycontext', 'help'],
    args: [{ name: 'topic', source: 'topics' }], flags: [], screen: '#/learn',
  },
  {
    name: 'list', kind: 'read', base: ['mycontext', 'list'],
    args: [{ name: 'category', source: 'categories' }], flags: [],
    endpoint: () => '/api/items',
  },
  {
    name: 'show', kind: 'read', base: ['mycontext', 'show'],
    args: [{ name: 'id', source: 'items', required: true }], flags: [],
    endpoint: (values) => `/api/item/${encodeURIComponent(values.id)}`,
  },
  {
    name: 'search', kind: 'read', base: ['mycontext', 'search'],
    args: [],
    flags: [
      { name: 'text', input: 'text' }, { name: 'type', source: 'categories' },
      { name: 'tag', input: 'text' }, { name: 'path', input: 'text' },
      { name: 'status', input: 'text' }, { name: 'relation', input: 'text' },
      { name: 'limit', input: 'text' },
    ],
    endpoint: (values) => {
      const qs = new URLSearchParams();
      for (const key of ['text', 'type', 'tag', 'path', 'status', 'relation', 'limit']) {
        if (values[key]) qs.set(key, values[key]);
      }
      return `/api/search?${qs.toString()}`;
    },
  },
];

/** The argv for a def and its collected values. Missing required input throws
 * — a half-built command must not be composable, let alone copyable. */
export function commandFor(def, values) {
  const argv = [...def.base];
  for (const arg of def.args) {
    const value = values[arg.name];
    if (value === undefined || value === '') {
      if (arg.required) throw new Error(`${def.name}: ${arg.name} is required`);
      continue;
    }
    argv.push(value);
  }
  for (const flag of def.flags) {
    const value = values[flag.name];
    if (flag.boolean) {
      if (value === true) argv.push(`--${flag.name}`);
      continue;
    }
    if (value === undefined || value === '') {
      if (flag.required) throw new Error(`${def.name}: --${flag.name} is required`);
      continue;
    }
    // A switch that also takes an explicit value is joined with `=`. The CLI
    // reads `--always false` as a stray positional and refuses the whole
    // command, so the two forms are not interchangeable here.
    if (flag.joined) argv.push(`--${flag.name}=${value}`);
    else argv.push(`--${flag.name}`, value);
  }
  return argv;
}
