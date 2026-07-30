import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const cli = path.join(root, 'dist/cli/index.js');
const knownLog = 'COPY backend/*.py .\nWhen using COPY with more than one source file, the destination must be a directory and end with a /';

const fromText = JSON.parse(execFileSync(process.execPath, [cli, 'diagnose', '--text', knownLog], {
  encoding: 'utf8',
}));
assert.equal(fromText.status, 'success');
assert.equal(fromText.diagnosis.code, 'build_config_invalid');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgekit-diagnose-'));
try {
  fs.writeFileSync(path.join(tempDir, 'build.log'), knownLog);
  const fromFile = JSON.parse(execFileSync(process.execPath, [cli, 'diagnose', 'build.log'], {
    cwd: tempDir,
    encoding: 'utf8',
  }));
  assert.equal(fromFile.diagnosis.code, 'build_config_invalid');

  const fromStdin = spawnSync(process.execPath, [cli, 'diagnose', '-'], {
    input: knownLog,
    encoding: 'utf8',
  });
  assert.equal(fromStdin.status, 0);
  assert.equal(JSON.parse(fromStdin.stdout).diagnosis.code, 'build_config_invalid');

  const unknown = spawnSync(process.execPath, [cli, 'diagnose', '--text', 'unusual build stop 731'], {
    encoding: 'utf8',
  });
  assert.equal(unknown.status, 1);
  assert.equal(JSON.parse(unknown.stdout).diagnosis.code, 'unknown_error');

  const empty = spawnSync(process.execPath, [cli, 'diagnose', '-'], { input: '', encoding: 'utf8' });
  assert.equal(empty.status, 2);
  assert.equal(JSON.parse(empty.stdout).status, 'failed');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log('ForgeKit CLI diagnose smoke passed');
