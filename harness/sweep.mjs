import { createWorkspace, createBareWorkspace, destroyWorkspace } from './lib/workspace.mjs';
import { runCli } from './lib/run.mjs';
import { openMcp } from './lib/mcp.mjs';
import { runHook } from './lib/hooks.mjs';
import { record } from './lib/evidence.mjs';

async function runOne(kase) {
  // Each case gets a pristine workspace: no case may depend on another's leftovers.
  const ws = kase.pristine ? await createBareWorkspace() : await createWorkspace();
  // Assigned, never returned, from inside `try` — see the `finally` below for why.
  let outcome;
  try {
    // If the case defines a fixture function, call it to set up files/state in the workspace
    if (kase.fixture) kase.fixture(ws);

    // Every failed/timed-out setup step is recorded rather than silently
    // discarded: `runCli` resolves regardless of exit code, so without this
    // a misspelled or failing precondition leaves the case running against
    // a workspace that never reached the intended state, with evidence that
    // looks legitimate.
    const setupFailures = [];
    for (const argv of kase.setup ?? []) {
      const r = await runCli(argv, { cwd: ws });
      if (r.exitCode !== 0 || r.timedOut) {
        setupFailures.push({ argv, exitCode: r.exitCode, timedOut: r.timedOut, stderr: r.stderr, stdout: r.stdout });
      }
    }

    // If the case defines a postFixture function, call it after setup but before the case argv
    if (kase.postFixture) kase.postFixture(ws);

    // If the case defines a configPatch, write it to config.json
    if (kase.configPatch) {
      const { writeFileSync } = await import('node:fs');
      const { join } = await import('node:path');
      writeFileSync(join(ws, '.my_context', 'config.json'), JSON.stringify(kase.configPatch, null, 2), 'utf8');
    }

    if (kase.kind === 'cli') {
      outcome = await runCli(kase.argv, { cwd: ws, env: kase.env });
    } else if (kase.kind === 'hook') {
      outcome = await runHook(kase.hook, kase.payload, { cwd: ws });
    } else if (kase.kind === 'mcp') {
      const mcp = await openMcp(ws);
      const started = Date.now();
      let result;
      if (kase.calls) {
        result = { calls: [] };
        for (const c of kase.calls) {
          result.calls.push({ tool: c.tool, args: c.args ?? {},
            result: await mcp.callTool(c.tool, c.args ?? {}) });
        }
      } else if (kase.tool === '__list__') {
        result = { tools: await mcp.listTools(), initializeResult: mcp.initializeResult };
      } else {
        result = await mcp.callTool(kase.tool, kase.args ?? {});
      }
      const stderr = mcp.stderr();
      await mcp.close();
      outcome = { tool: kase.tool ?? 'multi', args: kase.args, result, stderr, durationMs: Date.now() - started };
    } else {
      throw new Error(`unknown case kind: ${kase.kind}`);
    }

    if (setupFailures.length) outcome.setupFailures = setupFailures;
  } finally {
    // A throw from `finally` replaces whatever `try` was about to produce —
    // including a normal return value. `destroyWorkspace` uses
    // `rm(..., {force: true})`, which suppresses ENOENT but not an
    // EBUSY/EPERM from a still-locked handle (observed on Windows under
    // concurrent runs), so an unguarded `await destroyWorkspace(ws)` here
    // could silently discard a case's genuine, already-computed result and
    // replace it with a harness crash. Cleanup failures are recorded beside
    // the outcome instead, so a leaked workspace is visible rather than
    // silently destructive; a genuine failure in the case body above still
    // propagates normally to `runTable`'s catch.
    try {
      await destroyWorkspace(ws);
    } catch (err) {
      if (outcome) outcome.cleanupError = err.message;
    }
  }
  return outcome;
}

export async function runTable(surface, cases) {
  for (const kase of cases) {
    let outcome;
    try {
      outcome = await runOne(kase);
    } catch (err) {
      // A harness crash is itself evidence — never swallow it.
      outcome = { harnessError: err.message, stack: err.stack };
    }
    await record(surface, kase.id, { note: kase.note ?? null, ...outcome });
  }
}

const [, , surfaceArg, moduleArg] = process.argv;
if (surfaceArg && moduleArg) {
  const mod = await import(moduleArg);
  await runTable(surfaceArg, mod.cases);
  console.log(`swept ${mod.cases.length} cases into evidence/${surfaceArg}.jsonl`);
}
