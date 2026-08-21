import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SERVER_INFO } from '../src/mcp/protocol.ts';
import { TOOL_NAMES } from '../src/mcp/tools.ts';
import { approvalBoundary, commandStrings } from './helpers/approval-boundary.ts';

const ROOT = path.join(import.meta.dirname, '..');

function read(...parts: string[]): string {
  return readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');
}

/**
 * The /LoadMyContext command and the skill are the only parts of this plugin
 * that Claude Code loads from the filesystem rather than from the MCP server,
 * so nothing else can notice if they go missing — which is exactly what
 * happened once already, when both were handed between plans and neither
 * plan shipped them. These tests are the notice.
 */
test('the /LoadMyContext command exists and calls the load_context tool', () => {
  const text = read('commands', 'LoadMyContext.md');
  assert.match(text, /^---\n/, 'the command file has frontmatter');
  assert.match(text, /description:/);
  assert.match(text, /load_context/);
  assert.ok(TOOL_NAMES.includes('load_context'), 'the tool the command calls is registered');
});

/**
 * This test used to assert the OPPOSITE and pinned it there: it required the
 * command file to say items loaded manually are "not restored after a
 * compaction". Executing PreCompact → SessionStart(compact) shows a
 * manually-loaded item restored in full, because the snapshot scans the
 * transcript for ids and a manual load writes them into it. The pin is kept
 * and pointed at the corrected statement rather than deleted — the pin is the
 * only reason the eight copies of this claim cannot drift apart again.
 *
 * The negative assertion is load-bearing on its own: the false sentence is
 * short, memorable and was correct-sounding enough to survive four documents
 * and two tests, so the exact string is banned rather than merely unrequired.
 *
 * The three conditions are pinned individually because the honest claim is
 * conditional, and a correction that keeps "usually restored" while quietly
 * dropping the conditions would be a new false claim of the same family.
 * Each is verified by execution in test/hooks/manual-load-restore.test.ts,
 * which is the behavioural half of this pair.
 */
test('the /LoadMyContext command states the real compaction behaviour, with its conditions', () => {
  // Flattened: the claim is wrapped across lines, and a regex that depends on
  // where the wrap falls breaks on the next reflow rather than on a lie.
  const text = read('commands', 'LoadMyContext.md').replace(/\s+/g, ' ');
  // "never" as well as "not": mutation testing showed that a bare negation
  // in front of the claim ("never restored after a compaction only if…")
  // satisfies every positive assertion below, so the two forms are banned
  // together. test/docs/compaction-claim.test.ts enforces the same pair
  // across the other surfaces.
  assert.doesNotMatch(
    text, /(?:never|not) restored after a compaction/i,
    'the false claim must not come back — it shipped on eight surfaces once already',
  );
  assert.match(
    text, /restored\*{0,2} ?\*{0,2}after a compaction only if/i,
    'the claim must carry its condition in the same sentence, not in a later one',
  );
  assert.match(text, /scans the transcript/i, 'the mechanism that makes restore usual');
  assert.match(text, /rationale items[^.]*never restore/i, 'condition 1: rationale never returns');
  assert.match(text, /8MB of the transcript/i, 'condition 2: the transcript tail is bounded');
  assert.match(text, /restore tier has its own budget/i, 'condition 3: the restore budget spills');
});

/**
 * The skill is the third copy of the compaction claim, and until this test
 * existed it was the only one of the eight surfaces with no pin at all —
 * mutation testing caught it, by rewriting the skill's rationale exception
 * into its opposite and watching the suite stay green.
 *
 * The skill is loaded into every session, so it gets the SHORT form: the
 * mechanism and the one exception an agent acts on. The full three-condition
 * statement lives in the command file and the READMEs, which are read once
 * rather than injected always. Its ceiling moved for these two sentences
 * (see the note on the size test below), which is the other reason they are
 * pinned — a budget raised for specific content and then spent on other
 * content was never enforced.
 */
test('the skill states the real compaction behaviour, with the exception that bites', () => {
  const skill = read('skills', 'mycontext', 'SKILL.md').replace(/\s+/g, ' ');
  assert.doesNotMatch(
    skill, /(?:never|not|does not) restores? them|(?:never|not) restored after a compaction/i,
    'the false claim must not come back — it shipped on eight surfaces once already',
  );
  assert.match(skill, /A compaction usually restores them/i, 'the corrected claim, hedged');
  assert.match(skill, /scans the transcript for ids/i, 'why "usually" is true');
  assert.match(skill, /never rationale items/i, 'the exception an agent will otherwise assume away');
});

test('the skill exists, is frontmatter-shaped, and names the tools it teaches', () => {
  const text = read('skills', 'mycontext', 'SKILL.md');
  assert.match(text, /^---\nname: mycontext\n/);
  assert.match(text, /description:/);
  for (const tool of ['create_item', 'query_items', 'get_item', 'mycontext_help']) {
    assert.match(text, new RegExp(tool), `the skill should mention ${tool}`);
  }
});

/**
 * The plugin's NAME is load-bearing in a way nothing in this repo could
 * notice: Claude Code namespaces every plugin command as
 * `<plugin.json name>:<command>`, so `my-context` here would have made the
 * user type `/my-context:add-requirement` while the CLI binary, the `.mcp.json`
 * server key and every doc said `mycontext`. Four spellings of one identity,
 * three of them agreeing and the load-bearing one differing.
 */
test('the plugin name, the MCP server key, the CLI binary and SERVER_INFO are all "mycontext"', () => {
  const plugin = JSON.parse(read('.claude-plugin', 'plugin.json')) as { name: string };
  const mcp = JSON.parse(read('.mcp.json')) as { mcpServers: Record<string, unknown> };
  const pkg = JSON.parse(read('package.json')) as { name: string; bin: Record<string, string> };

  assert.equal(plugin.name, 'mycontext', 'plugin.json — this is what namespaces /mycontext:… commands');
  assert.deepEqual(Object.keys(mcp.mcpServers), ['mycontext'], '.mcp.json server key');
  assert.deepEqual(Object.keys(pkg.bin), ['mycontext'], 'the CLI binary');
  assert.equal(pkg.name, 'mycontext');
  assert.equal(SERVER_INFO.name, 'mycontext', 'the name the MCP server reports at initialize');
});

/**
 * Without `.claude-plugin/marketplace.json` there is no persistent install:
 * `claude plugin marketplace add ./` fails with "Marketplace file not found",
 * and `--plugin-dir` — the only route that worked — lasts exactly one session.
 *
 * The two manifests are asserted to AGREE because they are two declarations of
 * one identity and nothing at runtime reconciles them: the marketplace entry's
 * `name` is what `claude plugin install <name>@<marketplace>` takes, and the
 * plugin's own `name` is what namespaces `/mycontext:…`. A version that drifts
 * between them makes `claude plugin tag` refuse the release.
 *
 * Verified against the real tool, not only these assertions: `claude plugin
 * validate --strict` passes on both files, `claude plugin marketplace add ./`
 * registers this directory, and `claude plugin install mycontext@mycontext`
 * then resolves all 39 skills, 4 hooks and the MCP server.
 */
test('the marketplace manifest exists and agrees with the plugin manifest', () => {
  const market = JSON.parse(read('.claude-plugin', 'marketplace.json')) as {
    name: string; version: string; owner: { name: string };
    plugins: { name: string; source: string; version: string; description: string }[];
  };
  const plugin = JSON.parse(read('.claude-plugin', 'plugin.json')) as {
    name: string; version: string; description: string; author: { name: string };
  };

  assert.equal(market.plugins.length, 1, 'this repository is one plugin');
  const entry = market.plugins[0];
  assert.equal(entry.name, plugin.name, 'the installable name and the namespacing name');
  assert.equal(entry.version, plugin.version);
  assert.equal(market.version, plugin.version, '`claude plugin tag` refuses a version that drifts');
  assert.equal(entry.description, plugin.description);
  assert.equal(market.owner.name, plugin.author.name);
  // `./` — the plugin IS this repository, so an install must not go looking
  // for it in a subdirectory that does not exist.
  assert.equal(entry.source, './');
});

/**
 * `plugin.json` must NOT declare a `commands` field: per the plugins
 * reference, `commands` REPLACES the default `commands/` scan rather than
 * adding to it, so declaring one path silently unloads every generated
 * command file not listed under it.
 */
test('plugin.json does not declare a commands path that would replace the default scan', () => {
  const plugin = JSON.parse(read('.claude-plugin', 'plugin.json')) as Record<string, unknown>;
  assert.equal(Object.hasOwn(plugin, 'commands'), false);
});

/**
 * Task 9's escalation, closed the only way this plugin actually can: by
 * saying so. The full sequence `lesson` → `lesson-stage --stdin` →
 * `lesson-accept <id> <key>` is the documented happy path, every leg is
 * Bash-reachable, and none of it involves a human — so "a human approved
 * this rule" is true only when the harness's Bash surface excludes those
 * commands. Nothing in this repo can enforce that (a plugin's own
 * `settings.json` supports only `agent` and `subagentStatusLine`), so the
 * deliverable is an honest, findable statement in all three places a reader
 * arrives from: the skill the model loads, the README a user reads, and the
 * help topic that describes promotion.
 *
 * These assertions exist because the statement is the whole mitigation. A
 * doc paragraph with no test is how this project has lost claims before.
 */
test('the approval boundary is stated honestly wherever promotion is described', () => {
  const skill = read('skills', 'mycontext', 'SKILL.md');
  assert.match(skill, /Nothing in this plugin\s*\n?stops an agent with a shell/);
  // The command list inside the prohibition used to be pinned here as a
  // literal regex, and that pin is now `the skill's two lists are the approval
  // boundary the program produces` below. It is moved rather than deleted, and
  // the reason is the whole of ruling 34: the literal was written when the
  // sentence named eight commands, it went on matching after `inbox-promote`,
  // `refresh` and `review discard-revision` became members, and a pin that
  // cannot notice a new member is protection in appearance only — on the one
  // surface the MODEL reads at every session start. `commands/refresh.md` was
  // meanwhile telling that same model refresh "is on the deny list this
  // plugin's README recommends", so the two model-facing surfaces disagreed.
  //
  // The replacement derives the set from the argument parser instead of
  // spelling it, so the next command to take `--yes` reddens it on the day it
  // is registered rather than a release later.

  const readme = read('README.md');
  assert.match(readme, /your Bash permissions, and nothing else/);
  assert.match(readme, /not\*{0,2} a security boundary/);
  assert.match(readme, /A plugin cannot ship permission rules/);
  // The deny rules it offers, and the honest limit of what they buy.
  assert.match(readme, /Bash\(mycontext lesson-accept \*\)/);
  assert.match(readme, /they do not make one impossible/);

  const workflow = read('src', 'help', 'topics', 'workflow.md');
  assert.match(workflow, /not by enforcement/);
  assert.match(workflow, /`--yes` is an audit trail, not a lock/);
});

/* ---------------------------------------------------------------------------
 * The skill's approval boundary, derived rather than pinned.
 * ------------------------------------------------------------------------- */

/**
 * The two sentences in SKILL.md that enumerate the boundary, each located by
 * the words around it rather than by a line number.
 *
 * They carry DIFFERENT sets, and the difference is load-bearing:
 *
 *  - The gate list says these commands "change what governs here". That is
 *    `counted` — `review discard-revision` does not belong in it, because it
 *    changes nothing about what governs, and putting it there would make the
 *    sentence false in the always-loaded file.
 *  - The deny list says never to run them on the user's behalf. That is
 *    `denyRequired`: every member INCLUDING `review discard-revision`, which
 *    ends a staged proposal for good, plus `pin`/`unpin`/`harden`/`soften`.
 *    The four aliases are inside a parenthetical rather than counted as four
 *    more commands, because they are `edit` with one flag filled in — but an
 *    agent told "never `edit`" is not thereby told "never `pin`", and this is
 *    the sentence it acts on. Same arithmetic as the README's deny rules,
 *    arrived at from the model's side rather than the permission matcher's.
 */
const SKILL_LISTS = [
  {
    what: 'gate list',
    open: '## The approval gate is not enforced against you',
    close: 'all change what governs here',
    expected: 'counted',
  },
  {
    what: 'deny list',
    open: 'So: never run',
    close: "on the user's behalf",
    expected: 'denyRequired',
  },
] as const;

/**
 * The text between two anchors, with the anchors' own presence asserted.
 *
 * A missing anchor fails LOUDLY here. The alternative — returning an empty
 * span — is the shape of the guard this repository found matching every
 * possible line and silently skipping whole documents, which is why the
 * message tells a maintainer to re-anchor rather than delete.
 */
function skillSpan(flat: string, open: string, close: string, what: string): string {
  const start = flat.indexOf(open);
  assert.ok(
    start >= 0,
    `SKILL.md no longer carries the ${what}'s opening words ("${open}"). If the wording ` +
    `changed, update SKILL_LISTS; do not delete the assertion.`,
  );
  const end = flat.indexOf(close, start + open.length);
  assert.ok(
    end > start,
    `SKILL.md no longer closes the ${what} with "${close}", so the span could not be read. ` +
    `Update SKILL_LISTS rather than dropping the check.`,
  );
  return flat.slice(start + open.length, end);
}

/**
 * Which commands a span of prose names, as the STRINGS a permission rule and
 * a shell both see.
 *
 * Every backticked run in the span is read, a leading `mycontext ` is dropped,
 * and the longest leading run of command words that the registry actually
 * knows is taken — so `` `mycontext review promote-revision --yes` `` is
 * `review promote-revision` and not `review promote`, and
 * `` `mycontext add <normative category> --yes` `` is `add`. A backticked run
 * that names no command at all (`--yes`, `.my_context/`, `agentEdits`) is not
 * a command and is skipped; a run that names one the registry does not have
 * would be skipped too, which is why the caller compares as an EQUALITY: a
 * misspelled member reads as a missing one and fails.
 */
function commandsNamedIn(span: string, known: readonly string[]): string[] {
  const found = new Set<string>();
  for (const [, code] of span.matchAll(/`([^`]+)`/g)) {
    const words = code.replace(/^mycontext /, '').split(' ');
    const pair = words.slice(0, 2).join(' ');
    if (words.length > 1 && known.includes(pair)) found.add(pair);
    else if (known.includes(words[0])) found.add(words[0]);
  }
  return [...found].sort();
}

/**
 * **The list the model reads is the list the program produces.**
 *
 * This replaces a literal regex that pinned the deny sentence word for word.
 * The pin was written when the sentence named eight commands and went on
 * passing while three more became members — `inbox-promote`, `refresh` and
 * `review discard-revision` — so the always-loaded file told the model it may
 * do on the user's behalf three things the README's own deny block forbids,
 * and nothing went red. A test that cannot fail for the reason it exists is
 * the defect this repository has now found five times; this is the sixth, and
 * the only one on a surface the model acts from.
 *
 * The set comes from `test/helpers/approval-boundary.ts`, the same derivation
 * that holds both READMEs' §7 table, count and deny block. Sharing it is the
 * point: two derivations of one boundary would drift exactly as two prose
 * lists did.
 *
 * Asserted as an EQUALITY in both directions. A missing member is a route the
 * model believes is open; an extra one names a command that has been renamed
 * or removed, and an instruction that names a command the CLI does not have
 * is an instruction a model cannot follow.
 */
test('the skill\'s two lists are the approval boundary the program produces', () => {
  const derived = approvalBoundary();
  const known = commandStrings();
  assert.ok(known.length > 0, 'the registry produced no command strings; the probe is broken');
  const flat = read('skills', 'mycontext', 'SKILL.md').replace(/\s+/g, ' ');

  for (const list of SKILL_LISTS) {
    const expected = derived[list.expected];
    assert.ok(expected.length > 0, `the derivation produced an empty ${list.expected}`);
    const named = commandsNamedIn(skillSpan(flat, list.open, list.close, list.what), known);
    assert.deepEqual(
      named, [...expected],
      `SKILL.md's ${list.what} is not the set the program produces. It is the file loaded ` +
      `into every session, so a member it omits is a write the model believes it may make ` +
      `on the user's behalf — and the generated commands/*.md tell that same model the ` +
      `command is denied.`,
    );
  }
});

/**
 * The final whole-branch review found the statement above materially
 * INCOMPLETE, and this test is what stops it regressing to the short version.
 * Two things were missing and both are reachable today:
 *
 *  1. `mycontext add <normative category>` hardcodes `origin: 'human'`
 *     (src/cli/index.ts), so it creates an ACTIVE GOVERNING item with no draft
 *     step at all. It was absent from the deny list and from the "the gate
 *     holds iff these commands" sentence, which named only lesson-accept,
 *     review promote and review discard.
 *  2. The `PreToolUse` write-deny on `.my_context/` has matcher
 *     `Read|Edit|MultiEdit|Write|NotebookEdit` (hooks/hooks.json) — `Bash` is
 *     NOT matched, and `runPreToolUse` only ever inspects a `file_path`
 *     argument, which a Bash call does not carry. A shell redirect into
 *     `.my_context/` plus `mycontext rebuild` is not seen by it.
 *
 * So the correct statement is broader than "excludes these commands": it is
 * the whole binary, in every spelling, AND direct writes into `.my_context/`.
 * Asserted in all three places a reader arrives from, because a doc paragraph
 * with no test is how this project has lost claims before.
 */
test('the approval boundary names `add` and the Bash gap in the deny list', () => {
  // These files hard-wrap, so a claim routinely straddles a newline. Matching
  // against the raw text pinned the line breaks as much as the wording and
  // broke on any reflow; the assertions below are about the SENTENCE.
  //
  // The blockquote marker is stripped for the same reason the line break is.
  // Promoting this statement to a `> [!CAUTION]` callout — which is where it
  // belongs, and where the presentation pass put it — prefixes every one of
  // its lines with `> `, so a sentence that straddles a newline collapses to
  // "entirely, > in every spelling" and the assertion fails on markup rather
  // than on wording. `>` at the start of a line is markup here, exactly as the
  // newline is.
  const flat = (s: string) => s.replace(/^[ \t]*>[ \t]?/gm, '').replace(/\s+/g, ' ');
  const readme = flat(read('README.md'));
  const hebrew = flat(read('docs', 'README.he.md'));
  const skill = flat(read('skills', 'mycontext', 'SKILL.md'));
  const workflow = flat(read('src', 'help', 'topics', 'workflow.md'));

  // The corrected statement, in all three — INCLUDING the quantifier, which
  // the comment here used to claim was checked and which nothing checked.
  //
  // Mutation testing found the hole: rewriting "the gate holds if and only if
  // the agent's Bash surface EXCLUDES the `mycontext` binary entirely" into
  // "the gate holds even when the agent's Bash surface DOES NOT EXCLUDE the
  // `mycontext` binary entirely" left every assertion below satisfied — the
  // negated sentence still contains "exclude the `mycontext` binary entirely,
  // in every spelling" — and the suite stayed green on all three surfaces at
  // once. That is the same defect class `test/docs/compaction-claim.test.ts`
  // records for the restore claim: a pin that requires a phrase is satisfied
  // by a negation placed in front of it, so the quantifier has to be pinned
  // and the negated forms banned together.
  //
  // This sentence is the entire mitigation for a boundary the product cannot
  // enforce, so an inversion of it is the worst false claim in the repository.
  for (const [name, text] of [['README', readme], ['SKILL', skill], ['workflow', workflow]] as const) {
    assert.match(
      text,
      /holds if and only if [^.]{0,80}exclude(?:s)? the `mycontext` binary entirely, in every spelling/,
      `${name} must state the boundary as an "if and only if", in the same sentence as ` +
      `the exclusion — a bare mention of the exclusion is satisfied by its own negation`,
    );
    assert.doesNotMatch(
      text,
      /(?:does not|do not|doesn't|don't|never|need not|needn't) exclude the `mycontext` binary/i,
      `${name} states the boundary in the negative — the gate does NOT hold when the ` +
      `binary is reachable, and this sentence is the whole mitigation`,
    );
    assert.match(
      text,
      /direct writes into `?\.my_context\/`?/,
      `${name} must name the direct-write route as part of the boundary`,
    );
    assert.match(
      text,
      /mycontext add/,
      `${name} must name \`mycontext add\` as a route that creates a governing item`,
    );
  }

  // The Hebrew mirror carries the same CAUTION and had no pin of any kind —
  // `parity.test.ts` compares structure, and a callout that survives a
  // rewrite of its own sentence is structurally identical. The Hebrew states
  // the exclusion in the negative by construction ("אינו כולל" — does not
  // include), so the inversion to guard against is the opposite one: dropping
  // the negation, which turns "the Bash surface does not include the binary"
  // into "the Bash surface includes the binary".
  assert.match(
    hebrew,
    /השער מחזיק אם ורק אם [^.]{0,80}אינו כולל את הקובץ הבינארי `mycontext` כלל, בכל איות/,
    'docs/README.he.md must state the boundary as an "if and only if" whose condition is ' +
    'that the Bash surface EXCLUDES the binary',
  );
  assert.match(
    hebrew, /כתיבות ישירות אל/,
    'docs/README.he.md must name the direct-write route as part of the boundary',
  );

  // B1: `mycontext repair` completes a route three documents said did not
  // exist. `update_item` refuses `always`/`severity`/`status` on a governing
  // item and `review promote` acts only on drafts, so a hand edit was the
  // only way — and it left a permanent, doctor-visible checksum mismatch.
  // `repair` clears that mismatch, which is its purpose and is also what
  // turns the hand edit into a clean, evidence-free change to what governs
  // the project. Demonstrated end to end in `test/cli/repair.test.ts`; here
  // the requirement is that both gate lists a reader arrives at say so.
  for (const [name, text] of [['README', readme], ['SKILL', skill]] as const) {
    assert.match(
      text, /mycontext repair( --yes)?`?/,
      `${name} must name repair among the commands that put an item past the draft gate`,
    );
  }
  assert.match(readme, /Bash\(mycontext repair \*\)/, 'the deny list must offer a repair rule');

  // `mycontext supersede` is the newest command that changes what governs
  // with no human in the loop, and it is the only one that does so by taking
  // an ACTIVE governing item out — the exact decision `supersede_item`
  // refuses to make for an agent. A command that walks around a documented
  // refusal has to appear wherever that refusal is described, or the three
  // gate lists a reader arrives at are quietly out of date the day it ships.
  for (const [name, text] of [['README', readme], ['SKILL', skill]] as const) {
    assert.match(
      text, /mycontext supersede/,
      `${name} must name supersede among the commands that change what governs`,
    );
  }
  assert.match(
    readme, /Bash\(mycontext supersede \*\)/, 'the deny list must offer a supersede rule');
  assert.match(
    workflow, /mycontext supersede/,
    'the workflow help topic must name the human route to retiring a governing item',
  );

  // `mycontext edit` is the SIXTH command behind the `--yes` gate and the
  // seventh that changes what governs with no human in the loop. It is the
  // widest of them: `supersede` takes a governing item out, `add` puts one in,
  // and `edit` changes any field of one that is already governing — including
  // the scope, `always`, severity and status that `update_item` refuses, which
  // is precisely why it exists. A command that walks around a documented
  // refusal has to appear wherever that refusal is described, or the three
  // gate lists a reader arrives at are quietly out of date the day it ships —
  // the same argument that put `supersede` in this test, and the reason this
  // assertion is here rather than left for the documentation task.
  for (const [name, text] of [['README', readme], ['SKILL', skill], ['workflow', workflow]] as const) {
    assert.match(
      text, /mycontext edit/,
      `${name} must name edit among the commands that change what governs`,
    );
  }
  assert.match(readme, /Bash\(mycontext edit \*\)/, 'the deny list must offer an edit rule');

  // `pin`, `unpin`, `harden` and `soften` are `edit` with one flag filled in,
  // so they reach the same write behind the same gate. That makes them an
  // ALIAS question in prose and a COVERAGE question in the deny list, and the
  // two have different answers:
  //
  //  - In prose they are not four more commands, and listing them as such
  //    would say there are four more mechanisms than there are. The README's
  //    gate list says instead that they belong to it as `edit` does, and the
  //    `--yes` table names them as `edit`'s named forms — so a reader who
  //    trusts that list to be complete is not misled either way.
  //  - A permission rule is matched against the command STRING, and
  //    `Bash(mycontext edit *)` does not match `mycontext pin …`. A deny list
  //    that stops at `edit` therefore leaves four working routes to exactly
  //    the write it is trying to deny, which is the "gate list quietly out of
  //    date the day it ships" failure in a form a reader cannot see by
  //    reading it. Each needs a rule of its own.
  for (const name of ['pin', 'unpin', 'harden', 'soften']) {
    assert.match(
      readme, new RegExp(`Bash\\(mycontext ${name} \\*\\)`),
      `the deny list must offer a ${name} rule — a prefix deny on \`edit\` does not match it`,
    );
    for (const [doc, text] of [['README', readme], ['workflow', workflow]] as const) {
      assert.match(
        text, new RegExp(`mycontext ${name}|\`${name}\``),
        `${doc} must name ${name} where the editing gate is described`,
      );
    }
  }
  // And the reason they are not four more entries has to be written down,
  // because "this list is complete" is the whole value of the list.
  assert.match(
    readme.replace(/\s+/g, ' '),
    /does not match `mycontext pin …`, and each of the four needs a\s*deny rule of its own/,
    'the README must say why the four are aliases in prose but separate rules in the deny list',
  );

  // `review promote-revision` is the eighth command that changes what governs
  // with no human in the loop, and the only one that applies a change the
  // AGENT proposed — the release valve on `agentEdits: "review"`. Its sibling
  // `discard-revision` changes nothing about what governs but settles,
  // terminally, a decision the queue exists to reserve for a human.
  //
  // Both need a deny rule of their own for a reason that is easy to miss and
  // is asserted below rather than trusted: a permission pattern matches the
  // command STRING, and `Bash(mycontext review promote *)` wants a SPACE where
  // the real command has a hyphen. A deny list that stops at `review promote`
  // therefore leaves the widest of the revision routes open while looking
  // closed — the same shape as the `edit`/`pin` case, arrived at from the
  // other direction.
  for (const name of ['promote-revision', 'discard-revision']) {
    assert.match(
      readme, new RegExp(`Bash\\(mycontext review ${name} \\*\\)`),
      `the deny list must offer a review ${name} rule — a prefix deny on ` +
      `\`review promote\`/\`review discard\` does not match it`,
    );
  }
  assert.match(
    readme,
    /`Bash\(mycontext review promote \*\)` does \*\*not\*\* match `mycontext review promote-revision …`/,
    'the README must say why the hyphenated subcommands are not covered by the shorter rule',
  );
  // Demonstrated rather than asserted: the pattern really does fail to match.
  // Without this the comment above is a claim about Claude Code's matcher that
  // nothing in this repository checks.
  const prefix = 'mycontext review promote ';
  assert.equal(
    'mycontext review promote-revision RULE-x'.startsWith(prefix), false,
    'if this ever passes, the deny-list explanation in both READMEs is wrong',
  );
  assert.equal('mycontext review promote RULE-x'.startsWith(prefix), true);

  // The `--yes` list, which is the approval-gate list a reader looks for.
  assert.match(
    readme,
    /`add`, `edit`, `review promote`, `review discard`, `review promote-revision`, `review discard-revision`, `supersede`, `repair`/,
    'the --yes flag table must list every command that confirms before acting',
  );

  // The deny list must offer an `add` rule, and must not claim completeness.
  assert.match(readme, /Bash\(mycontext add \*\)/);
  assert.match(readme, /not complete coverage/i);
  assert.match(readme, /prefix matches on a command string/);

  // The Bash limitation must be stated as a fact about the matcher, and the
  // matcher must actually be what the docs say it is.
  const hooks = JSON.parse(read('hooks', 'hooks.json')) as {
    hooks: { PreToolUse: { matcher: string }[] };
  };
  const matcher = hooks.hooks.PreToolUse[0].matcher;
  assert.equal(
    matcher.split('|').includes('Bash'), false,
    'if Bash is ever added to the PreToolUse matcher, every doc claiming it is absent must change',
  );
  assert.match(readme, /`Bash` is not matched/);
});

/**
 * The Hebrew mirror's deny list and gate list, which nothing has ever checked.
 *
 * `test/docs/parity.test.ts` compares heading structure and example markers and
 * is deliberately, demonstrably blind to what the Hebrew says. Every assertion
 * in the two tests above reads `README.md` only. So the mirror's security
 * section has been kept in step by hand across four rounds — `supersede`,
 * `edit`, the four named forms, and now the two revision subcommands — and a
 * round that forgot would ship a Hebrew reader a deny list with a working route
 * through it, with a green suite.
 *
 * What is asserted here is deliberately language-independent, because a test
 * that read Hebrew prose would be pinning a translation rather than a fact:
 *
 *  - The deny block is JSON, not prose. It is the same artefact in both
 *    documents — a reader copies it into their own settings — so the two are
 *    compared element for element. A rule added to one language only fails
 *    here with the missing rule named.
 *  - The gate table names commands, and a command name is Latin in both
 *    documents. Every `mycontext <name>` the English gate list names must
 *    appear somewhere in the Hebrew one.
 *
 * Neither can tell whether the Hebrew SENTENCE around a command is right. That
 * remains a review obligation, and it is the reason this comment does not
 * claim more than the assertions deliver.
 */
test('the Hebrew mirror carries the same deny list and names the same gated commands', () => {
  const en = read('README.md');
  const he = read('docs', 'README.he.md');

  /**
   * The `deny` array out of the one fenced JSON block that declares one.
   *
   * Every JSON block is collected and then filtered, rather than one regex
   * reaching for `"deny"`: both documents carry several `json` blocks (the
   * config examples in §6), and a pattern that spans from the first fence to
   * the first `"deny"` swallows all of them into one unparseable string.
   */
  const denyRules = (markdown: string, where: string): string[] => {
    const blocks = [...markdown.matchAll(/```json\n([\s\S]*?)\n```/g)]
      .map((m) => m[1])
      .filter((body) => body.includes('"deny"'));
    assert.equal(
      blocks.length, 1,
      `${where} should contain exactly one permissions block with a deny list, found ` +
      `${blocks.length}`,
    );
    const parsed = JSON.parse(blocks[0]) as { permissions: { deny: string[] } };
    assert.ok(parsed.permissions.deny.length > 0, `${where}'s deny list is empty`);
    return parsed.permissions.deny;
  };

  const english = denyRules(en, 'README.md');
  const hebrew = denyRules(he, 'docs/README.he.md');
  assert.deepEqual(
    hebrew, english,
    'the Hebrew mirror\'s deny list has drifted from the English one. It is JSON a reader ' +
    'copies verbatim, not prose, so the two must be identical — a rule missing from one ' +
    'language is a working route to the write it is meant to deny.',
  );

  // The gate table itself. Scoped to the table rows so a command named
  // somewhere else in the English document does not count as a gate entry.
  const rows = [...en.matchAll(/^\| `(mycontext [a-z-]+(?: [a-z-]+)?)[^|]*\| /gm)]
    .map((m) => m[1].trim());
  const gated = [...new Set(rows)].filter((c) => c.startsWith('mycontext '));
  assert.ok(
    gated.length >= 7,
    `only ${gated.length} gate-table rows were parsed out of README.md; the parser is ` +
    `broken, not the document`,
  );
  const missing = gated.filter((command) => !he.includes(command));
  assert.deepEqual(
    missing, [],
    `the Hebrew mirror does not name these gated commands at all: ${missing.join(', ')}`,
  );
});

/**
 * C5: the always-loaded, model-facing file asserted "everything you write
 * lands as a draft" and built its next sentence on it. False for the 7
 * rationale categories of the 17 the standard profile enables —
 * `create_item{type:"decision"}` lands `active`. capture.md, README.md and
 * plugin/commands.ts all branch on tier correctly; this pins the skill to the
 * same branch, and pins it to the REAL tier table rather than to a copy.
 */
test('the skill branches on tier rather than claiming everything lands as a draft', async () => {
  const skill = read('skills', 'mycontext', 'SKILL.md');
  const { resolveConfig } = await import('../src/core/config.ts');
  const enabled = Object.values(resolveConfig({}).categories).filter((c) => c.enabled);

  // Every enabled category is named on the side of the split it really is on.
  // Each side is the BULLET only, not "everything after the marker": the prose
  // under the list also mentions `decision`, and slicing to end-of-file let a
  // mutant that deleted `decision` from the rationale bullet survive.
  const lines = skill.split('\n');
  const bullet = (marker: string): string => {
    const start = lines.findIndex((l) => l.includes(marker));
    assert.notEqual(start, -1, `the skill must carry a ${marker} bullet`);
    let end = start + 1;
    while (end < lines.length && lines[end].trim() !== '' && !lines[end].startsWith('- ')) end++;
    return lines.slice(start, end).join('\n');
  };
  const normative = bullet('**Normative**');
  const rationale = bullet('**Rationale**');
  assert.ok(!rationale.includes('**Normative**') && !normative.includes('**Rationale**'));
  for (const category of enabled) {
    const side = category.tier === 'normative' ? normative : rationale;
    assert.ok(
      side.includes(`\`${category.name}\``),
      `${category.name} is ${category.tier} but the skill does not list it there`,
    );
  }

  // The converse, and without it the check above is one-directional: it only
  // catches a MISSING name. Adding a name the config does not enable — e.g.
  // `policy`, `postmortem` or `taxonomy`, which the standard profile disables
  // and `resolveCategory` refuses — survived it, and that is a false claim in
  // the always-loaded file: the model would be told a category exists that
  // `create_item` rejects. Set equality is the honest form of "these bullets
  // are the tier table", and it also catches a name listed on the WRONG side,
  // which the loop above misses whenever a category is listed on both.
  const named = (bullet: string): string[] =>
    [...bullet.matchAll(/`([a-z_]+)`/g)].map((m) => m[1]).sort();
  const expected = (tier: string): string[] =>
    enabled.filter((c) => c.tier === tier).map((c) => c.name).sort();
  assert.deepEqual(
    named(normative), expected('normative'),
    'the normative bullet must be exactly the enabled normative categories — no extras',
  );
  assert.deepEqual(
    named(rationale), expected('rationale'),
    'the rationale bullet must be exactly the enabled rationale categories — no extras',
  );

  assert.match(skill, /lands\s*\n?\s*\*\*active\*\*/, 'the skill must say rationale items land active');
  assert.doesNotMatch(
    skill, /everything you write lands as a \*\*draft\*\*/,
    'the false universal claim must not come back',
  );
});

/**
 * C6: four places instructed the reader to hand-edit an item's frontmatter,
 * and following that instruction permanently poisons the item's checksum —
 * every write path recomputes it, a hand edit does not, `rebuild` does not
 * recompute it, and `doctor` then reports a mismatch whose message says the
 * file was edited outside my_context. `capture.md` is served to the MODEL by
 * `mycontext_help("capture")` and offered it as an equivalent to the safe
 * route, while the plugin's own `PreToolUse` hook denies the model exactly
 * that write.
 *
 * This test is deliberately phrase-specific rather than a general "does not
 * say hand-edit" heuristic: it pins the four removals that were made, and each
 * file must also name a route that exists. `mycontext repair` is that route
 * for a deliberate hand edit; it re-stamps the checksum and cannot recover
 * content the edit removed, which is why the docs must not call it a repair of
 * corruption.
 */
test('nothing instructs hand-editing an item\'s frontmatter', () => {
  const readme = read('README.md');
  const capture = read('src', 'help', 'topics', 'capture.md');
  const mutate = read('src', 'core', 'mutate.ts');

  assert.doesNotMatch(
    readme, /Set `always: true` in an item's\s*\n?frontmatter/,
    'README must not tell the user to hand-edit always: — promote --always / update_item do it',
  );
  // Two assertions, because either alone is weak. The negative one is
  // phrase-specific and a reworded permission ("you may hand-edit …") slips
  // past it — mutation testing showed exactly that. The positive one requires
  // the prohibition to still be there, which no rewording of the permission
  // can satisfy.
  assert.doesNotMatch(
    capture, /hand-edits? `status:` directly/,
    'capture.md is served to the model; it must not offer hand-editing as an equivalent route',
  );
  assert.match(
    capture, /\*\*Do not tell the user to hand-edit `status:`[^*]*and do not\s*\n?edit it yourself\.\*\*/,
    'capture.md must carry the prohibition explicitly, not merely omit the old instruction',
  );
  // `[^"]*` rather than an alternation of field names: one of the two sites
  // interpolates `${field}`, so an alternation of literal names matched
  // NEITHER site and the assertion was vacuous — caught by mutation testing,
  // which is the only reason this comment is not the twenty-first instance of
  // this project's characteristic defect.
  // A boolean assert with the offending lines quoted, not `doesNotMatch` on
  // the whole file: a failure there prints all 1,300 lines of mutate.ts and
  // buries the one line that matters.
  const offenders = mutate.split('\n').filter((l) => /edit "[^"\n]*:" directly in/.test(l));
  assert.deepEqual(
    offenders, [],
    'the updateItem refusal messages must not send the caller to hand-edit frontmatter',
  );

  // The refusals themselves are asserted at RUNTIME, in
  // `test/core/mutate-guard-messages.test.ts` — the text of a thrown message
  // cannot be checked reliably by matching a source file that also contains
  // several paragraphs of comment explaining what the message used to say.

  // Each place names a route that exists, rather than merely dropping the
  // instruction and leaving the reader with nowhere to go.
  assert.match(readme, /mycontext review promote <id> --always/);
  assert.match(readme, /mycontext repair/);
  // Scoped to the prohibition paragraph, not the whole file: `update_item`
  // also appears in capture.md's tool-description list, so a file-wide match
  // stayed green when the route was removed from the sentence that needs it.
  const prohibition = capture.slice(capture.indexOf('**Do not tell the user to hand-edit'));
  const para = prohibition.slice(0, prohibition.indexOf('\n\n'));
  assert.match(para, /mycontext review promote/, 'the prohibition must name the status route');
  assert.match(para, /`update_item`/, 'the prohibition must name the content route');
});

/**
 * It is loaded into every session that touches the plugin, so it pays rent.
 *
 * The ceiling was 4000 and the file sat at 3981 — 19 chars of headroom, which
 * no honest sentence fits into. It was raised to 4300 to make room for the
 * 8.3 short-name residual on the `PreToolUse` write-deny, because the
 * alternative was cutting unrelated prose out of a security document to
 * protect a self-imposed rent target, which is the wrong trade.
 *
 * That residual is now fixed — the deny canonicalizes the path — and saying
 * so takes fewer characters than warning about it did, so the ceiling comes
 * back down to 4250 rather than being left as slack the next paragraph would
 * quietly spend. The headroom stays deliberately tight (~50 chars) so this
 * budget still bites; raise it again only for content of the same weight.
 *
 * Raised to 4390 for `mycontext supersede`, which is content of exactly that
 * weight: a sixth command that changes what governs this project with no
 * human in the loop, and the only one that does so by RETIRING an active
 * governing item — the decision `supersede_item` refuses to make for an
 * agent. A skill that lists five such commands and not the sixth is a gate
 * list that is wrong, which costs more than 140 characters do. It is named
 * in two places for two different reasons (the human's route out of a
 * refusal; the deny list an agent must not walk around), and both were
 * compressed to their shortest honest form before this number moved. The
 * ~50-char headroom is unchanged.
 *
 * **Raised to 5170 for staged revisions, and the previous task said in
 * writing that this is the change the ceiling would have to move for.** The
 * file had 3 characters of headroom, which is not room for a sentence, and
 * compressing unrelated prose a fourth time to protect a self-imposed rent
 * target is the wrong trade — the same conclusion this comment reached at
 * 4000 and at 4250.
 *
 * Two things were added, and neither is a restatement of something already
 * here:
 *
 *  1. `update_item` no longer means what this file's reader assumes. Under
 *     `agentEdits: "review"` — the DEFAULT for every normative category — an
 *     edit to title, body, tags or extra is STAGED, and the item keeps governing its
 *     old text. An agent that reads its own edit as applied goes on to reason
 *     about words nothing is enforcing, which is the precise failure this
 *     corpus exists to prevent, and no other always-loaded text says so.
 *  2. `mycontext review promote-revision` is the eighth command that changes
 *     what governs with no human in the loop, and the only one on that list
 *     the agent has a stake in: it applies a rewrite the agent itself
 *     proposed. A gate list that omits the one entry its reader is motivated
 *     to run is worse than no list.
 *
 * Headroom is back to ~50 characters, deliberately, so the budget still bites.
 *
 * **Raised to 5255 for the corrected compaction claim (Phase 1E), and this is
 * the fifth raise, so it is recorded plainly rather than absorbed.** The file
 * previously said `/LoadMyContext` is "useful after a compaction, which does
 * not restore them". That is FALSE — verified by executing PreCompact →
 * SessionStart(compact), which restored a manually-loaded item in full,
 * because the snapshot scans the transcript for ids and a manual load puts
 * them there. The replacement costs 85 characters more than the lie did, and
 * every one of them is the condition: an honest sentence here has to say that
 * restore is usual, say WHY (the transcript scan), and say where it stops
 * (rationale items never restore). The false sentence needed no condition at
 * all, which is exactly what made it cheap and wrong. Compressing unrelated
 * prose a fifth time to protect a self-imposed rent target is the wrong trade
 * — the same conclusion this comment reached at 4000, 4250 and 5170.
 *
 * Headroom is ~50 characters again, so the budget still bites.
 *
 * **Raised to 5325 for the Phase 3 catalogue swap, and this is the smallest
 * of the six raises.** The tier bullets are asserted to be exactly the
 * enabled categories (`the skill branches on tier rather than claiming
 * everything lands as a draft`, below), so `runbook`, `environment` and
 * `known_issue` are not optional text: leaving them out would make the
 * always-loaded file describe a catalogue the product does not have, and
 * naming a category that does not exist is the failure that test was written
 * to catch in the other direction. Three names and the reflow they force cost
 * 45 characters — `policy`, `postmortem` and `taxonomy` were never listed
 * here, since the bullets carry the ENABLED set and those three shipped off,
 * so nothing comes back the other way.
 *
 * Headroom is ~50 characters, as at every previous raise.
 *
 * **Raised to 5367 for `procedure`, `todo` and `note`, and this is the
 * seventh raise and the cheapest of them.** Three names arrived together and
 * they do NOT go in the same bullet, which is the only interesting thing
 * about this edit: `procedure` is normative — an active one is injected in
 * full, is named in the index, and an agent-authored one lands `draft` — so
 * it belongs beside `runbook`, while `todo` and `note` are rationale and
 * belong beside `reference`. The bullets ARE the tier table — `the skill
 * branches on tier rather than claiming everything lands as a draft` in this
 * file asserts set equality in both directions — so none of the three is
 * optional text and putting `procedure` in with its two siblings fails
 * differently from leaving it out. Three names and the reflow they force cost
 * 29 characters, measured by executing rather than predicted.
 *
 * Headroom is ~50 characters, as at every previous raise.
 *
 * **Raised to 5665 for ruling 34, and this is the eighth raise and the
 * largest of them at 248 characters.** It is also the only one spent on
 * something the file was WRONG without rather than silent about. Both of the
 * file's lists named eight commands; the program puts ten in the first and
 * fifteen strings on the second, and the three it did not name —
 * `inbox-promote`, `refresh` and `review discard-revision` — are reachable
 * today, are on the deny block both READMEs recommend, and are named as
 * denied by the generated `commands/*.md` the same model reads. Compressing
 * the gap away was never available: the missing names ARE the content, they
 * are now asserted as a set equality against the derivation (`the skill's two
 * lists are the approval boundary the program produces`), and none of them is
 * optional text.
 *
 * Two of the 248 characters are not names. `refresh` gets one clause —
 * "replaces a governing body with whatever the file it snapshots says now" —
 * because it is the one member whose name does not say what it does, and an
 * agent that reads it as a harmless re-sync is the reader this file exists
 * for; `review discard-revision` gets one, because a list headed "these
 * change what governs" that silently included a command which does not would
 * be a new false claim of the same family. `inbox-promote` gets none: the
 * name is the description. The glosses already here for `supersede`, `edit`,
 * `promote-revision` and `repair` were left exactly as they were rather than
 * trimmed to buy the space back — the same conclusion this comment reached at
 * 4000, 4250, 5170 and 5255.
 *
 * Headroom is ~50 characters, as at every previous raise.
 */
test('the skill stays small enough to load into every session', () => {
  const text = read('skills', 'mycontext', 'SKILL.md');
  assert.ok(text.length <= 5665, `SKILL.md is ${text.length} chars`);
});

/**
 * The two claims the ceiling was raised for, pinned so they cannot be
 * compressed back out by the next round that needs space. A budget raised for
 * specific content and then spent on other content is a budget that was never
 * enforced.
 */
test('the skill tells an agent its content edit may be staged rather than applied', () => {
  const skill = read('skills', 'mycontext', 'SKILL.md').replace(/\s+/g, ' ');
  assert.match(skill, /`agentEdits`/, 'the setting that decides this must be named');
  assert.match(
    skill, /\*\*stages\*\* a change to title, body, tags or extra as a pending revision/,
    'the skill must say WHICH fields are staged — "your edits" would be false for extra',
  );
  assert.match(
    skill, /do not reason as if the new text is in force/i,
    'the consequence is the point: a staged edit read as applied is reasoning from nothing',
  );
  assert.match(
    skill, /`mycontext review promote-revision --yes`/,
    'promote-revision must be on the gate list — it applies a rewrite the agent proposed',
  );
});
