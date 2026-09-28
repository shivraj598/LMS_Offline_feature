/**
 * Runs the API and the Vite dev server together for local development:
 *   npm run dev:all
 * Output is prefixed so you can tell which process logged what.
 */
import { spawn } from 'node:child_process';

const children = [];

function start(name, command, args) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  children.push(child);
  const prefix = `[${name}]`;
  const wire = (stream, target) => {
    stream.setEncoding('utf8');
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) if (line.trim()) target.write(`${prefix} ${line}\n`);
    });
  };
  wire(child.stdout, process.stdout);
  wire(child.stderr, process.stderr);
  child.on('exit', (code) => {
    process.stdout.write(`${prefix} exited with code ${code}\n`);
    stopAll();
  });
  return child;
}

function stopAll() {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
}

process.on('SIGINT', () => {
  stopAll();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stopAll();
  process.exit(0);
});

start('api', process.execPath, ['server/index.js']);
start('web', process.execPath, ['node_modules/vite/bin/vite.js']);
