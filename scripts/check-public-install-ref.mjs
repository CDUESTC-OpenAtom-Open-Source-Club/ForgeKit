import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [
  'README.md',
  'docs/GETTING_STARTED.md',
  'docs/validation/CLI_DIAGNOSE_SERVER_PILOT_2026-07-30.md',
  'site/index.html',
  'site/mcp-docker-build.html',
  'site/docker-build-failed.html',
];
const pattern = /ForgeKit#([0-9a-f]{7,40})/gi;
const references = new Map();

for (const relativePath of files) {
  const filePath = path.join(root, relativePath);
  const content = fs.readFileSync(filePath, 'utf8');
  for (const match of content.matchAll(pattern)) {
    const reference = match[1].toLowerCase();
    const paths = references.get(reference) ?? [];
    paths.push(relativePath);
    references.set(reference, paths);
  }
}

if (references.size !== 1) {
  const details = [...references.entries()]
    .map(([reference, paths]) => `${reference}: ${[...new Set(paths)].join(', ')}`)
    .join('\n');
  throw new Error(`Public install references must use one commit:\n${details}`);
}

console.log(`Public install reference check passed: ${[...references.keys()][0]}`);
