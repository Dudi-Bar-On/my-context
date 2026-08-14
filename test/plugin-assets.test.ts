import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SERVER_INFO } from '../src/mcp/protocol.ts';
import { TOOL_NAMES } from '../src/mcp/tools.ts';

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

test('the /LoadMyContext command discloses the compaction caveat', () => {
  assert.match(read('commands', 'LoadMyContext.md'), /not restored after a compaction/i);
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
  assert.match(
    skill,
    /never promote, discard, accept, `add` a normative item or `repair` on the\s*\n?user's behalf/i,
  );

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
  const flat = (s: string) => s.replace(/\s+/g, ' ');
  const readme = flat(read('README.md'));
  const skill = flat(read('skills', 'mycontext', 'SKILL.md'));
  const workflow = flat(read('src', 'help', 'topics', 'workflow.md'));

  // The corrected "if and only if" statement, in all three.
  for (const [name, text] of [['README', readme], ['SKILL', skill], ['workflow', workflow]] as const) {
    assert.match(
      text,
      /exclude(?:s)? the `mycontext` binary entirely, in every spelling/,
      `${name} must state that the gate covers the whole binary, not three commands`,
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

/** It is loaded into every session that touches the plugin, so it pays rent. */
test('the skill stays small enough to load into every session', () => {
  const text = read('skills', 'mycontext', 'SKILL.md');
  assert.ok(text.length <= 4000, `SKILL.md is ${text.length} chars`);
});
