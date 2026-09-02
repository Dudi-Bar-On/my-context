import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { REPO } from './workspace.mjs';

const SERVER = join(REPO, 'src', 'mcp', 'server.ts');

/** Mirrors the hang guard run.mjs uses for CLI invocations (Task 2). */
const REQUEST_TIMEOUT_MS = 30_000;

export async function openMcp(cwd) {
  const child = spawn(process.execPath, [SERVER], {
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
  });

  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d; });

  // Record rather than throw: an unhandled 'error' event on a child process
  // or its stdin is fatal by default in Node, which would abort an entire
  // multi-case sweep over one dead server instead of failing a single call.
  let childError = null;
  child.on('error', (err) => { childError = err; });
  child.stdin.on('error', (err) => { childError = err; });

  const pending = new Map();
  let nextId = 1;

  // If the server dies (crash, or being killed) with requests still
  // in flight, drain them with a rejection naming the exit instead of
  // leaving those promises to hang until their own timeout fires.
  child.on('exit', (code, signal) => {
    const reason = childError
      ? `MCP server process error: ${childError.message}`
      : `MCP server exited (code=${code}, signal=${signal})`;
    for (const [id, { reject }] of pending) {
      pending.delete(id);
      reject(new Error(reason));
    }
  });

  const rl = createInterface({ input: child.stdout });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    if (msg.id != null && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });

  function request(method, params) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      // The server (or its process) is already gone: fail fast instead of
      // writing to a closed/ended stdin and waiting on a response that can
      // never arrive.
      const alreadyDead = child.exitCode !== null || child.signalCode !== null || !child.stdin.writable;
      if (alreadyDead) {
        reject(new Error(childError
          ? `MCP server process error: ${childError.message}`
          : `MCP server is not running (exitCode=${child.exitCode}, signal=${child.signalCode})`));
        return;
      }

      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`MCP request timed out after ${REQUEST_TIMEOUT_MS}ms: ${method}`));
      }, REQUEST_TIMEOUT_MS);
      pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });

      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`, (err) => {
        if (err && pending.has(id)) {
          pending.delete(id);
          clearTimeout(timer);
          reject(err);
        }
      });
    });
  }

  function notify(method, params) {
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
  }

  const initializeResult = await request('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'mycontext-harness', version: '1.0.0' },
  });
  notify('notifications/initialized', {});

  return {
    initializeResult,
    async listTools() {
      const r = await request('tools/list', {});
      return r.tools;
    },
    // Resolves rather than throws on a tool-level refusal, so `isError`
    // responses (and now protocol-level errors / timeouts / a dead server)
    // are observable evidence instead of harness exceptions.
    async callTool(name, args) {
      try {
        return await request('tools/call', { name, arguments: args });
      } catch (err) {
        return { protocolError: err.message };
      }
    },
    stderr: () => stderr,
    // Non-null once the child process or its stdin has emitted an 'error'
    // event (e.g. the server crashed outright). Exposed for diagnostics;
    // does not itself throw.
    childError: () => childError,
    // Waits for the child to actually exit (not just for kill() to be
    // *sent*) before resolving. On Windows, an open child process holds a
    // handle on its cwd; returning early races destroyWorkspace()'s rmdir
    // and causes a consistent EBUSY.
    async close() {
      rl.close();
      child.stdin.end();
      if (child.exitCode === null && child.signalCode === null) {
        const exited = new Promise((resolve) => child.once('exit', resolve));
        child.kill();
        await exited;
      }
    },
  };
}
