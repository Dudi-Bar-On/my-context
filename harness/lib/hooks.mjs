import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { REPO } from './workspace.mjs';

const dir = join(REPO, 'src', 'hooks');

export const HOOKS = {
  sessionStart: join(dir, 'session-start.ts'),
  preToolUse: join(dir, 'pre-tool-use.ts'),
  preCompact: join(dir, 'pre-compact.ts'),
  postToolUse: join(dir, 'post-tool-use.ts'),
};

const TIMEOUT_MS = 30_000;

export function runHook(hookKey, payload, { cwd, timeoutMs = TIMEOUT_MS } = {}) {
  const script = HOOKS[hookKey];
  if (!script) throw new Error(`unknown hook: ${hookKey}`);
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);

  return new Promise((resolve) => {
    const started = Date.now();
    let settled = false;
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let childError = null;

    const finish = (exitCode, err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        hook: hookKey,
        exitCode,
        stdout,
        stderr,
        durationMs: Date.now() - started,
        timedOut,
        childError: err,
      });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
      finish(null, childError);
    }, timeoutMs);

    const child = spawn(process.execPath, [script], {
      cwd,
      env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    });

    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => {
      childError = err;
      finish(null, err);
    });
    child.stdin.on('error', (err) => {
      childError = err;
      finish(null, err);
    });
    child.on('close', (exitCode) => {
      finish(exitCode, childError);
    });

    child.stdin.write(body);
    child.stdin.end();
  });
}
