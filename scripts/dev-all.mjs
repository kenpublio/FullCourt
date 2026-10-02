import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const frontendRoot = resolve(projectRoot, 'frontend');
const viteEntry = resolve(frontendRoot, 'node_modules/vite/bin/vite.js');

if (!existsSync(viteEntry)) {
  console.error('Frontend dependencies are missing. Run `npm install` in the frontend folder first.');
  process.exit(1);
}

const children = [];
let shuttingDown = false;

function stopChildren(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill();
  }
  setTimeout(() => process.exit(exitCode), 300);
}

function start(label, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
    windowsHide: true,
  });
  children.push(child);

  child.on('error', (error) => {
    console.error(`[${label}] Could not start: ${error.message}`);
    stopChildren(1);
  });

  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      console.log(`[${label}] stopped (${signal ?? `exit ${code ?? 0}`});`);
      stopChildren(code ?? 1);
    }
  });
}

process.on('SIGINT', () => stopChildren(0));
process.on('SIGTERM', () => stopChildren(0));

console.log('Starting FullCourt PHP API at http://127.0.0.1:8767');
console.log('Starting FullCourt frontend at http://127.0.0.1:5173');
console.log('Press Ctrl+C to stop both servers. Ensure MySQL is running separately.');

start('PHP API', 'php', ['-S', '127.0.0.1:8767', '-t', 'backend'], projectRoot);
start('Frontend', process.execPath, [viteEntry, '--host', '127.0.0.1'], frontendRoot);
