import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgekit-pilot-report-'));
const manifestPath = path.join(dir, 'release-manifest.json');
const output = path.join(dir, 'nested', 'evidence', 'report');
fs.writeFileSync(manifestPath, JSON.stringify({
  source: { git: { commit_sha: 'abcdef0123456789', is_dirty: false, remote_url: 'private' }, project_type: 'Node.js' },
  build: { platform: 'linux', architecture: 'amd64', hostname: 'secret-host', forgekit_version: '0.2.2-rc.1' },
  artifacts: [{ type: 'docker-image', name: 'private/image', path: '/private/path' }],
  verification: { success: true, checks_passed: ['build_completed', 'container_started', 'healthcheck_passed'] },
}));
execFileSync(process.execPath, [
  'scripts/generate-pilot-report.mjs', '--manifest', manifestPath, '--output', output,
  '--install-minutes', '8', '--baseline-minutes', '45', '--forgekit-minutes', '12',
], { cwd: process.cwd() });
const reportText = fs.readFileSync(`${output}.json`, 'utf8');
const report = JSON.parse(reportText);
assert.equal(report.timing_minutes.saved, 33);
assert.equal(report.outcome.healthcheck_passed, true);
assert.equal(report.project.commit_prefix, 'abcdef0');
assert(!reportText.includes('secret-host'));
assert(!reportText.includes('private/image'));
assert(!reportText.includes('/private/path'));
console.log('Pilot report privacy smoke test passed');
