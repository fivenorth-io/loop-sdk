import { expect, test } from 'bun:test';
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dir, '..');

test('build does not emit the Bun.serve demo as dist/server.js', () => {
  const build = spawnSync('bun', ['run', 'build'], { cwd: root, encoding: 'utf8' });
  if (build.status !== 0) {
    throw new Error(build.stderr || build.stdout || 'build failed');
  }
  expect(existsSync(join(root, 'dist/server/index.js'))).toBe(true);
  expect(existsSync(join(root, 'dist/server.js'))).toBe(false);
});
