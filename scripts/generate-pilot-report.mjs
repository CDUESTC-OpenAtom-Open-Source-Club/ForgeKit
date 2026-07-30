#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));
const manifestPath = path.resolve(args.manifest || 'release-manifest.json');
if (!fs.existsSync(manifestPath)) throw new Error(`Manifest not found: ${manifestPath}`);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const installMinutes = numberArg(args['install-minutes'], 'install-minutes');
const baselineMinutes = numberArg(args['baseline-minutes'], 'baseline-minutes');
const forgekitMinutes = numberArg(args['forgekit-minutes'], 'forgekit-minutes');
const reused7d = args['reused-7d'] === 'true';
const checks = Array.isArray(manifest.verification?.checks_passed)
  ? manifest.verification.checks_passed
  : [];

const report = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  privacy: {
    local_only: true,
    omitted: ['hostname', 'repository URL', 'branch', 'commit message', 'file paths', 'artifact names'],
    user_must_review_before_sharing: true,
  },
  project: {
    type: manifest.source?.project_type ?? 'unknown',
    language_version: manifest.source?.language_version ?? 'unknown',
    commit_prefix: safeCommitPrefix(manifest.source?.git?.commit_sha),
    dirty: Boolean(manifest.source?.git?.is_dirty),
  },
  environment: {
    platform: manifest.build?.platform ?? 'unknown',
    architecture: manifest.build?.architecture ?? 'unknown',
    node_version: manifest.build?.node_version ?? 'unknown',
    container_runtime_version: manifest.build?.docker_version ?? 'unknown',
    forgekit_version: manifest.build?.forgekit_version ?? 'unknown',
  },
  timing_minutes: {
    install: installMinutes,
    baseline: baselineMinutes,
    forgekit: forgekitMinutes,
    saved: baselineMinutes !== undefined && forgekitMinutes !== undefined
      ? Math.max(0, baselineMinutes - forgekitMinutes)
      : undefined,
  },
  outcome: {
    build_completed: checks.includes('build_completed'),
    container_started: checks.includes('container_started'),
    healthcheck_passed: checks.includes('healthcheck_passed'),
    manifest_success: Boolean(manifest.verification?.success),
    checks_passed: checks,
    artifact_types: Array.isArray(manifest.artifacts)
      ? [...new Set(manifest.artifacts.map((artifact) => artifact.type).filter(Boolean))]
      : [],
    reused_within_7_days: reused7d,
  },
};

const outputBase = path.resolve(args.output || 'forgekit-pilot-report');
const jsonPath = `${outputBase}.json`;
const markdownPath = `${outputBase}.md`;
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(report));
console.log(JSON.stringify({ json: jsonPath, markdown: markdownPath }, null, 2));

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const name = key.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith('--')) parsed[name] = 'true';
    else {
      parsed[name] = next;
      index += 1;
    }
  }
  return parsed;
}

function numberArg(value, name) {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative number`);
  return parsed;
}

function safeCommitPrefix(value) {
  return typeof value === 'string' && /^[a-f0-9]{7,40}$/i.test(value) ? value.slice(0, 7) : 'unknown';
}

function renderMarkdown(value) {
  const timing = value.timing_minutes;
  return `# ForgeKit pilot report\n\n` +
    `> Generated locally. Review before sharing; paths, host name, repository URL and artifact names are omitted.\n\n` +
    `| Evidence | Result |\n|---|---|\n` +
    `| Project type | ${value.project.type} |\n` +
    `| Install time | ${timing.install ?? 'not recorded'} min |\n` +
    `| Baseline time | ${timing.baseline ?? 'not recorded'} min |\n` +
    `| ForgeKit time | ${timing.forgekit ?? 'not recorded'} min |\n` +
    `| Container started | ${value.outcome.container_started ? 'yes' : 'no'} |\n` +
    `| Health check passed | ${value.outcome.healthcheck_passed ? 'yes' : 'no'} |\n` +
    `| Reused within 7 days | ${value.outcome.reused_within_7_days ? 'yes' : 'no'} |\n`;
}
