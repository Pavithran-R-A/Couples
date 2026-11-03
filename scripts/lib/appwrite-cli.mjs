// Resolves and runs the Appwrite CLI from Node on any platform.
//
// Resolution order:
//   1. APPWRITE_CLI_PATH env — runs `node <path> <args>` (test shims, or an
//      explicit entry such as <npm-global>/node_modules/appwrite-cli/run.js)
//   2. the `appwrite` executable on PATH (Linux/CI, real executables)
//   3. Windows: the npm global shim target
//      <npm-global>/node_modules/appwrite-cli/run.js via process.execPath —
//      Node refuses to spawn .cmd shims directly (ENOENT/EINVAL), so the
//      underlying JavaScript entry is invoked instead.
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

let resolved = null;

function resolveCli() {
  if (resolved) return resolved;
  const override = process.env.APPWRITE_CLI_PATH;
  if (override && fs.existsSync(override)) {
    resolved = { kind: 'node', entry: path.resolve(override) };
    return resolved;
  }
  const winShim = path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', 'appwrite-cli', 'run.js');
  if (process.platform === 'win32' && fs.existsSync(winShim)) {
    resolved = { kind: 'node', entry: winShim };
    return resolved;
  }
  resolved = { kind: 'bin', cmd: 'appwrite' };
  return resolved;
}

export function runCli(args, { timeout = 120000 } = {}) {
  const r = resolveCli();
  if (r.kind === 'node') {
    return execFileSync(process.execPath, [r.entry, ...args], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout,
    });
  }
  return execFileSync(r.cmd, args, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout,
  });
}
