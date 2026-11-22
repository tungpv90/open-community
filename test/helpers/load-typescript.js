import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

/**
 * Imports a dependency-free TypeScript module from `src/` under Node 20, which cannot strip
 * types natively. The module is transpiled to ESM and loaded from a temporary file.
 */
export async function importTypeScript(relativePath) {
  const sourceUrl = new URL(`../../${relativePath}`, import.meta.url);
  const source = await readFile(sourceUrl, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: relativePath,
  });
  const directory = await mkdtemp(join(tmpdir(), 'open-community-test-'));
  const file = join(directory, relativePath.replace(/[\/]/g, '_').replace(/\.tsx?$/, '.mjs'));
  await writeFile(file, outputText);
  return import(pathToFileURL(file).href);
}
