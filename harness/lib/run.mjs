import { spawn } from 'node:child_process';
import { CLI } from './workspace.mjs';

/** Pinned so table assertions never depend on the terminal. */
const PINNED_ENV = { MYCONTEXT_WIDTH: '100', MYCONTEXT_ASCII: '1' };

const TIMEOUT_MS = 30_000;

export function runCli(args, { cwd, env = {} } = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd,
      env: { ...process.env, ...PINNED_ENV, ...env },
    });
    child.stdin.end();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, TIMEOUT_MS);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (exitCode) => {
      clearTimeout(timer);
      resolve({
        argv: args,
        cwd,
        exitCode,
        stdout,
        stderr,
        durationMs: Date.now() - started,
        timedOut,
      });
    });
  });
}
