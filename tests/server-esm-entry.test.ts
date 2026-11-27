import { expect, test } from 'bun:test';
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const root = join(import.meta.dir, '..');

test('built @fivenorth/loop-sdk/server loads under Node.js ESM', () => {
  const build = spawnSync('bun', ['run', 'build'], { cwd: root, encoding: 'utf8' });
  if (build.status !== 0) {
    throw new Error(build.stderr || build.stdout || 'build failed');
  }

  const dir = mkdtempSync(join(tmpdir(), 'loop-server-esm-'));
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ type: 'module' }));
    writeFileSync(
      join(dir, 'smoke.mjs'),
      `const mod = await import(${JSON.stringify(join(root, 'dist/server/index.js'))});
if (typeof mod.loop?.init !== 'function') throw new Error('missing loop');
if (typeof mod.ReadOnlyLoopSDK !== 'function') throw new Error('missing ReadOnlyLoopSDK');
console.log('ok');
`,
    );

    const run = spawnSync('node', [join(dir, 'smoke.mjs')], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: join(root, 'node_modules') },
    });
    if (run.status !== 0) {
      throw new Error(run.stderr || run.stdout || 'node smoke failed');
    }
    expect(run.stdout).toContain('ok');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
