import { readFileSync } from 'fs';
import { join } from 'path';

function readJson(path: string): { version?: string } {
  return JSON.parse(readFileSync(path, 'utf8')) as { version?: string };
}

const root = process.cwd();
const expectedVersion = readJson(join(root, 'package.json')).version;

if (!expectedVersion) {
  throw new Error('Could not read version from package.json');
}

const packageJsonPaths = [
  'package.json',
  'apps/electron/package.json',
  'apps/viewer/package.json',
  'packages/core/package.json',
  'packages/shared/package.json',
  'packages/ui/package.json',
  'packages/mermaid/package.json',
];

let mismatches = 0;
for (const relPath of packageJsonPaths) {
  const fullPath = join(root, relPath);
  const actual = readJson(fullPath).version;
  if (actual !== expectedVersion) {
    mismatches++;
    console.error(`[check-version] mismatch: ${relPath} has ${actual ?? 'undefined'}, expected ${expectedVersion}`);
  }
}

if (mismatches > 0) {
  console.error(`[check-version] ${mismatches} mismatch(es) found.`);
  process.exit(1);
}

console.log(`[check-version] all package versions match ${expectedVersion}.`);
