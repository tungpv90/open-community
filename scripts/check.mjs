import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const roots = [
  resolve(projectRoot, 'src'),
  resolve(projectRoot, 'scripts'),
  resolve(projectRoot, 'test'),
];

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        return javascriptFiles(path);
      }
      return ['.js', '.mjs'].includes(extname(entry.name)) ? [path] : [];
    }),
  );

  return files.flat();
}

const files = (await Promise.all(roots.map(javascriptFiles))).flat();
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log(`Syntax checked ${files.length} JavaScript files`);
