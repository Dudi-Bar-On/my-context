/**
 * **The `tools` topic, and the property that makes it worth having: its
 * argument reference is DERIVED from the MCP registry, not written down.**
 *
 * The gap this topic closes is concrete, and it is the one that cost the most.
 * Nothing on any surface said that `create_item` STAMPS `origin: "agent"` in
 * the handler, so a session concluded from `commands/lesson.md` — which said
 * an agent could not record a lesson — that there was no route at all, and
 * spent several exchanges on it. There is a route; it is the strongest one
 * this product has.
 *
 * So the reference is generated, on the same terms as `commandList` and the
 * category table: a hand-written argument list is stale the first time a tool
 * gains, loses or renames an argument, and nothing catches it. The first four
 * tests are the pin — modelled on `test/help/cli-topic.test.ts`, which does
 * this for `COMMANDS`. A mutation that pastes the rendered reference into
 * `tools.md` reddens all of them.
 *
 * The rest of the file holds the topic's WRITTEN claims to the running
 * program. Every stamped/refused claim on that page is executed here against
 * the real registry and checked against what actually comes back, because a
 * claim about a refusal is exactly the kind that rots quietly: it is not
 * exercised by using the product correctly.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  HELP_TOPICS, helpTopic, toolDescriptions, toolParityNotes, toolParityTable, toolReference,
} from '../../src/help/index.ts';
import { TOOL_PARITY } from '../../src/plugin/parity.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { createRegistry } from '../../src/mcp/tools.ts';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

const CONFIG = resolveConfig({});
const REPO = path.join(import.meta.dirname, '..', '..');

const SOURCE = readFileSync(
  path.join(REPO, 'src', 'help', 'topics', 'tools.md'), 'utf8',
).replaceAll('\r\n', '\n');

function topic(): string {
  return helpTopic('tools', CONFIG);
}

/** A throwaway workspace, so a tool reaches its own checks rather than
 * stopping at "there is no workspace here". */
function workspace<T>(fn: (cwd: string) => T): T {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-tools-topic-'));
  try {
    assert.equal(runCli(['init'], cwd, () => {}), 0);
    return fn(cwd);
  } finally {
    removeTree(cwd);
  }
}

/** What the tool actually answered: its text, or the message it threw. */
function call(cwd: string, name: string, args: Record<string, unknown>): string {
  try {
    return createRegistry(cwd).call(name, args);
  } catch (err) {
    return (err as Error).message;
  }
}

/* -------------------------------------------------------------------- *
 * Derived, not written.                                                *
 * -------------------------------------------------------------------- */

test('the tool reference is generated from the registry, not written into tools.md', () => {
  const rendered = toolReference([{
    name: 'zzz_probe',
    description: 'a tool invented by this test',
    inputSchema: {
      type: 'object',
      properties: { probe: { type: 'string', description: 'invented too' } },
      required: ['probe'],
    },
  }]);
  assert.match(
    rendered, /- `zzz_probe` — a tool invented by this test/,
    'a tool definition handed straight to the renderer is missing from its output — the ' +
    'reference is not being generated from what it is given',
  );
  assert.match(rendered, /- `probe` — \*\*required\*\* — invented too/);
  assert.equal(
    SOURCE.includes('zzz_probe'), false, 'the probe leaked into the tracked topic file',
  );
});

test('every tool, and every argument it declares, reaches the topic', () => {
  const definitions = createRegistry(REPO).list();
  assert.ok(definitions.length > 1, `expected several tools, found ${definitions.length}`);
  const text = topic();

  const missing: string[] = [];
  for (const tool of definitions) {
    if (!text.includes(`\`${tool.name}\``)) missing.push(tool.name);
    if (!text.includes(tool.description)) missing.push(`${tool.name} (description)`);
    const properties = (tool.inputSchema.properties ?? {}) as Record<string, unknown>;
    for (const arg of Object.keys(properties)) {
      if (!text.includes(`- \`${arg}\``)) missing.push(`${tool.name}.${arg}`);
    }
  }
  assert.deepEqual(
    missing, [],
    'these tools, descriptions or arguments are absent from `mycontext help tools`. The ' +
    'reference is the whole surface or it is not usable as one: a reader who does not find ' +
    'an argument there concludes the tool does not take it.',
  );
});

test("tools.md carries each placeholder once and none of the registry's own words", () => {
  for (const token of ['{{TOOL_REFERENCE}}', '{{TOOL_PARITY_TABLE}}', '{{TOOL_PARITY_NOTES}}']) {
    assert.equal(
      (SOURCE.match(new RegExp(token.replace(/[{}]/g, '\\$&'), 'g')) ?? []).length, 1,
      `tools.md must carry ${token} exactly once — that section is generated, and a pasted ` +
      'copy would stop tracking its source the moment it was pasted',
    );
  }
  const spelled = Object.entries(toolDescriptions())
    .filter(([, description]) => SOURCE.includes(description))
    .map(([name]) => name);
  assert.deepEqual(
    spelled, [],
    "tools.md spells out tool descriptions that belong to capture.md's Tools section. Those " +
    'words have one home, which is also what the MCP server sends the model; a second copy ' +
    'in this file is free to drift from it.',
  );
  const notes = TOOL_PARITY.filter((r) => r.note !== undefined && SOURCE.includes(r.note));
  assert.deepEqual(
    notes.map((r) => r.tool), [],
    'tools.md spells out parity notes that belong to src/plugin/parity.ts, where they are ' +
    'checked against the running program. A second copy is not.',
  );
});

/**
 * The topic says a default is printed only where the schema states one, and
 * names the asymmetry: `audit_log`'s `limit` declares its default and the
 * other two `limit`s do not, though `optNum` gives them one. That is a claim
 * about three schemas, so it is checked against them — if a schema is ever
 * made to state its default, this reddens and the sentence gets corrected
 * rather than quietly becoming false.
 */
test('the topic is right about which limits advertise a default', () => {
  const limitOf = (tool: string): Record<string, unknown> => {
    const spec = createRegistry(REPO).list().find((t) => t.name === tool);
    assert.ok(spec, `${tool} is not registered`);
    const properties = spec.inputSchema.properties as Record<string, Record<string, unknown>>;
    assert.ok(properties.limit, `${tool} no longer takes a limit`);
    return properties.limit;
  };
  assert.match(String(limitOf('audit_log').description), /Default \d+/);
  for (const tool of ['query_items', 'list_drafts']) {
    assert.equal(
      /Default/i.test(String(limitOf(tool).description ?? '')), false,
      `${tool}'s limit now states its default in the schema. Good — but the tools topic says ` +
      'it does not, and the sentence has to move with it.',
    );
  }
  assert.match(topic(), /A default appears above only where the schema states one/);
});

test('the parity table and its notes are generated from the declaration', () => {
  const rows = [
    { tool: 'zzz_probe', cli: 'zzz-probe', slash: 'zzz-probe' },
    { tool: 'zzz_lonely', cli: null, slash: 'zzz-lonely', note: 'invented by this test' },
  ];
  assert.match(toolParityTable(rows), /\| `zzz_probe` \| `mycontext zzz-probe` \| `\/mycontext:zzz-probe` \|/);
  assert.match(toolParityTable(rows), /\| `zzz_lonely` \| — \*see below\* \|/);
  assert.match(toolParityNotes(rows), /`zzz_lonely` has no CLI spelling\. invented by this test/);
  // The two-sided row contributes no note, or the notes list would say
  // "nothing is missing here" once per tool.
  assert.equal(toolParityNotes(rows).includes('zzz_probe'), false);
});

/**
 * The counterpart of `commandList`'s empty-registry refusal, and the reason
 * the two topics differ.
 *
 * `COMMANDS` is filled BY SIDE EFFECT as `src/cli/index.ts` loads, so it is
 * empty in a process that never loaded the CLI and `cli` must refuse rather
 * than print a complete-looking empty section. `SPECS` is a module-level array
 * literal in `src/mcp/tools.ts`, which this module imports, so the tool
 * registry is complete wherever help is. The child process below is the proof:
 * it loads `src/help/index.ts` and nothing else, and gets `tools` while `cli`
 * refuses.
 */
test('the tools topic renders in a process that never loaded the CLI, where `cli` refuses', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-tools-child-'));
  try {
    const script = path.join(dir, 'probe.mjs');
    const helpUrl = pathToFileURL(path.join(REPO, 'src', 'help', 'index.ts')).href;
    const configUrl = pathToFileURL(path.join(REPO, 'src', 'core', 'config.ts')).href;
    writeFileSync(script, [
      `const { helpTopic } = await import(${JSON.stringify(helpUrl)});`,
      `const { resolveConfig } = await import(${JSON.stringify(configUrl)});`,
      'const config = resolveConfig({});',
      'const attempt = (topic) => {',
      '  try { return helpTopic(topic, config).length > 200 ? "RENDERED" : "SHORT"; }',
      '  catch (err) { return `REFUSED: ${err.message.slice(0, 60)}`; }',
      '};',
      'console.log(JSON.stringify({ tools: attempt("tools"), cli: attempt("cli") }));',
    ].join('\n'));

    const out = execFileSync(process.execPath, [script], { encoding: 'utf8', cwd: REPO });
    const result = JSON.parse(out.trim().split('\n').at(-1) as string) as Record<string, string>;
    assert.equal(
      result.tools, 'RENDERED',
      'the tools topic did not render in a process that loaded only src/help/index.ts. Its ' +
      'source is a module-level array, not a registry filled by side effect, so it must.',
    );
    assert.match(
      result.cli, /^REFUSED/,
      'the cli topic rendered in a process that never loaded the CLI, which means something ' +
      'now populates COMMANDS as a side effect of loading help — and `mycontext help cli` ' +
      'would print a partial command list as if it were the whole surface',
    );
  } finally {
    removeTree(dir);
  }
});

test('an empty tool registry is refused, never rendered as an empty reference', () => {
  assert.throws(
    () => toolReference([]),
    /the "tools" topic is generated from the MCP tool registry/,
    'an empty registry rendered instead of refused',
  );
});

/* -------------------------------------------------------------------- *
 * Stamped: executed, then read back off the topic.                     *
 * -------------------------------------------------------------------- */

test('no tool takes `origin`, and the topic quotes the refusal it really gives', () => {
  const message = workspace((cwd) => call(cwd, 'create_item', { summary_omitted: true,
    type: 'rule', title: 'Probe', body: 'why', origin: 'human',
  }));
  assert.match(message, /create_item does not take "origin"/, message);
  assert.match(message, /Nothing was written/);

  // The topic quotes the hint sentence. Quoted text is a second copy, so it is
  // pinned to the first: every line of the block quote must appear in the
  // message the program actually produced.
  const quoted = SOURCE.split('\n')
    .filter((l) => l.startsWith('> '))
    .map((l) => l.slice(2).trim())
    .join(' ');
  assert.ok(quoted.length > 40, `tools.md carries no block quote to check: ${quoted}`);
  assert.ok(
    message.replace(/\s+/g, ' ').includes(quoted),
    `tools.md quotes a sentence the program does not produce.\nquoted: ${quoted}\n` +
    `actual: ${message}`,
  );

  // And it is absent from every schema, which is what makes the refusal
  // unconditional rather than a per-tool list somebody keeps.
  const exposed = createRegistry(REPO).list().filter(
    (t) => Object.hasOwn((t.inputSchema.properties ?? {}) as object, 'origin'),
  );
  assert.deepEqual(exposed.map((t) => t.name), []);
});

test('an agent-authored normative item lands draft, and a rationale one lands active', () => {
  const { normative, rationale } = workspace((cwd) => ({
    normative: call(cwd, 'create_item', { summary_omitted: true,
      type: 'rule', title: 'Never log request bodies on probe endpoints', body: 'why',
    }),
    rationale: call(cwd, 'create_item', { summary_omitted: true,
      type: 'lesson', title: 'Probe lesson about advisory locks', body: 'why',
    }),
  }));
  assert.match(normative, /created RULE-[a-z-]+ \(draft\)/, normative);
  assert.match(rationale, /created LESSON-[a-z-]+ \(active\)/, rationale);

  const text = topic();
  assert.match(text, /Normative content you author lands `draft`/,
    'the topic must say that agent-authored normative content lands as a draft, or the ' +
    'reply reads as a failure and the caller retries something that already worked');
  assert.match(text, /`create_item\(type: "lesson", …\)` works/,
    'the claim that cost several exchanges: an agent CAN record a lesson. If this stops ' +
    'being true, correct the topic rather than deleting the assertion.');
});

/* -------------------------------------------------------------------- *
 * Refused: executed, then read back off the topic.                     *
 * -------------------------------------------------------------------- */

test('scope, always and severity are refused on a governing normative item, by name', () => {
  const answers = workspace((cwd) => {
    let out = '';
    assert.equal(
      runCli(['add', '--summary-omitted', 'rule', 'Probe governing rule', '--body', 'why', '--yes'], cwd,
        (s) => { out += `${s}\n`; }),
      0, out,
    );
    const id = /\b(RULE-[a-z0-9-]+)/.exec(out)?.[1];
    assert.ok(id, `no id in:\n${out}`);
    return {
      scope: call(cwd, 'update_item', { id, scope: ['src/**'] }),
      always: call(cwd, 'update_item', { id, always: true }),
      severity: call(cwd, 'update_item', { id, severity: 'hard' }),
      status: call(cwd, 'update_item', { id, status: 'deprecated' }),
      title: call(cwd, 'update_item', { id, title: 'Probe governing rule, reworded' }),
    };
  });

  for (const field of ['scope', 'always', 'severity']) {
    assert.match(
      answers[field as 'scope'], new RegExp(`cannot change the ${field}`),
      `update_item no longer refuses ${field} on a governing normative item:\n` +
      answers[field as 'scope'],
    );
  }
  assert.match(answers.status, /cannot change the status of a normative item/);
  // The other half of the same answer, and the one that is NOT a refusal.
  assert.match(answers.title, /NOT applied — staged as revision REV-/, answers.title);

  const text = topic();
  assert.match(text, /`scope`, `always` and `severity` are refused on a governing normative/);
  assert.match(text, /STAGED/,
    'a staged revision is not a refusal, and a topic that lists only the refusals would ' +
    'leave a caller believing its edit applied');
});

test('an extra field the category does not declare is refused by name', () => {
  const message = workspace((cwd) => call(cwd, 'create_item', { summary_omitted: true,
    type: 'rule', title: 'Probe extra field', body: 'why', likelihood: 'high',
  }));
  assert.match(message, /extra field "likelihood" is not declared by "rule"/, message);
  assert.match(message, /Nothing was written/);
  assert.match(
    topic(), /extra field its category does not declare is refused by name/i,
    'the flat argument list is the union over every category, so being in it is not being ' +
    'accepted on yours — a topic silent on that teaches the opposite',
  );
});

test('an undeclared argument is refused by name, which is the probe the topic recommends', () => {
  const { created, updated } = workspace((cwd) => ({
    created: call(cwd, 'create_item', { summary_omitted: true,
      type: 'rule', title: 'Probe typo', body: 'why', sevrity: 'hard',
    }),
    // The exact call the topic names, and the one this check was built for:
    // it used to be accepted, ignored, and answered "updated".
    updated: call(cwd, 'update_item', { id: 'RULE-anything', sevrity: 'hard' }),
  }));
  assert.match(created, /create_item does not take "sevrity"/, created);
  assert.match(created, /It accepts: type, title/);
  assert.match(updated, /update_item does not take "sevrity"/, updated);
  assert.equal(/updated/.test(updated), false, `update_item reported success:\n${updated}`);

  const text = topic();
  assert.match(text, /additionalProperties: false/);
  assert.match(text, /refused \*\*by name\*\*/);
  assert.match(text, /`update_item\(\{sevrity: "hard"\}\)` is answered with a refusal/,
    'the topic names that exact call; if it stops being the example, requote it');
});

test('create_item refuses `relations`, and the topic names the two routes that work', () => {
  const message = workspace((cwd) => call(cwd, 'create_item', { summary_omitted: true,
    type: 'rule', title: 'Probe relations', body: 'why',
    relations: [{ type: 'refines', target: 'RULE-x' }],
  }));
  assert.match(message, /create_item does not take "relations"/, message);
  assert.match(message, /link_items\(from, to, relation\)/);
  assert.match(message, /supersede_item\(id, by\)/);

  const text = topic();
  assert.match(text, /link_items\(from, to, relation\)/);
  assert.match(text, /--unlink <relation> <target>/,
    'the CLI does have one relation verb, and it is removal; a topic claiming relations are ' +
    'absent from the CLI entirely would be wrong in the costlier direction');
});

test('supersede_item refuses to retire a governing normative item', () => {
  const message = workspace((cwd) => {
    let out = '';
    runCli(['add', '--summary-omitted', 'rule', 'Probe retiree', '--body', 'why', '--yes'], cwd, (s) => { out += `${s}\n`; });
    const id = /\b(RULE-[a-z0-9-]+)/.exec(out)?.[1];
    assert.ok(id, out);
    const replacement = call(cwd, 'create_item', { summary_omitted: true, type: 'rule', title: 'Probe replacement', body: 'why' });
    const by = /\b(RULE-[a-z0-9-]+)/.exec(replacement)?.[1];
    assert.ok(by, replacement);
    return call(cwd, 'supersede_item', { id, by });
  });
  assert.match(message, /my_context:/, message);
  assert.equal(/^my_context: (retired|superseded)/.test(message), false,
    `supersede_item retired a governing normative item:\n${message}`);
  assert.match(topic(), /`supersede_item` refuses to retire one/);
});

/* -------------------------------------------------------------------- *
 * The self-declared shell spelling, which the topic warns about.       *
 * -------------------------------------------------------------------- */

test('`mycontext lesson --agent` is self-declared, and omitting it claims human', () => {
  const { flagged, bare, gate } = workspace((cwd) => {
    const run = (argv: string[]): string => {
      let text = '';
      runCli(argv, cwd, (s) => { text += `${s}\n`; });
      return text;
    };
    return {
      flagged: run(['lesson', '--agent', 'Probe lesson from an agent shell']),
      bare: run(['lesson', 'Probe lesson from a human shell']),
      gate: run(['lesson-accept', '--agent']),
    };
  });
  assert.match(flagged, /recorded as origin: agent/, flagged);
  assert.match(bare, /recorded as origin: human/, bare);
  assert.match(gate, /lesson-accept takes no --agent/, gate);

  const text = topic();
  assert.match(text, /self-declared where `create_item` is\n?\s*handler-stamped/,
    'the difference between the two honest routes is the point of that section');
  assert.match(text, /it \*is\* the gate/);
});

/* -------------------------------------------------------------------- *
 * Surfaces.                                                            *
 * -------------------------------------------------------------------- */

test('the CLI serves the topic, and does so outside a workspace', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-tools-topic-'));
  try {
    let out = '';
    const code = runCli(['help', 'tools'], cwd, (s) => { out += `${s}\n`; });
    assert.equal(code, 0, out);
    assert.match(out, /- `create_item` — /);
    assert.equal(out.includes('{{'), false, 'an unexpanded placeholder reached the reader');
  } finally {
    removeTree(cwd);
  }
});

/**
 * No Hebrew twin, established the same way `cli`'s was rather than assumed.
 *
 * `readTopicFile` throws for a locale with no `<topic>.he.md`, and the only
 * caller that passes one is `cmdHelp` under `MYCONTEXT_DOC_LOCALE`, which only
 * the documentation generator sets — and the generator embeds exactly one help
 * block, `<!-- example-md: help categories -->`, in each README. So a Hebrew
 * `tools.md` would be a translation nothing reads. If a second topic is ever
 * embedded in the Hebrew README, this is where the decision gets revisited.
 */
test('the tools topic has no Hebrew source, and asking for one says which file to create', () => {
  assert.throws(
    () => helpTopic('tools', CONFIG, 'he'),
    /the topic "tools" has no "he" source/,
    'a silent English fallback is how the Hebrew README came to carry an English section',
  );
});

/**
 * **The MCP-side gap this topic made consequential, now closed — and held
 * closed at exactly one topic.**
 *
 * `mycontext_help`'s schema used to enumerate its topics by hand, and the
 * `cli` branch reverted `enum: HELP_TOPICS` because the MCP server cannot
 * render `cli` at all. That reasoning never extended to `tools` and `slash`:
 * both render there (the child-process test above proves it for `tools`), so
 * the hand-written four were withholding two topics the server could serve,
 * one of them the page about the very surface the caller is on. The schema is
 * now `MCP_HELP_TOPICS`, derived from `HELP_TOPICS` with that one exclusion.
 *
 * The literal below stays hand-written on purpose. Deriving the expectation
 * from the same constant the schema derives from would make this assertion
 * agree with itself no matter which topics were dropped — the shape of check
 * that cannot fail. `cli` is the only topic whose withholding has a reason;
 * anything else appearing here is a topic that went quietly missing, and
 * anything vanishing from here is a topic the server cannot actually render.
 */
test('mycontext_help withholds exactly the one topic its server cannot render', () => {
  const spec = createRegistry(REPO).list().find((t) => t.name === 'mycontext_help');
  assert.ok(spec);
  const schema = spec.inputSchema as { properties: Record<string, { enum?: string[] }> };
  const accepted = schema.properties.topic.enum ?? [];
  const withheld = HELP_TOPICS.filter((t) => !accepted.includes(t));
  assert.deepEqual(
    [...withheld].sort(), ['cli'],
    'the set of topics `mycontext_help` does not offer has changed. `cli` belongs there and ' +
    'nothing else does: `commandList` refuses to render it in a process that never loaded ' +
    'the CLI registry, which is every MCP server process. A topic ADDED here was withheld ' +
    'without that reason — check whether it actually fails to render, or whether ' +
    '`MCP_HELP_TOPICS` grew an exclusion nobody argued for. An EMPTY set means `cli` is ' +
    'being offered, and it would come back complete-looking and empty.',
  );
});
