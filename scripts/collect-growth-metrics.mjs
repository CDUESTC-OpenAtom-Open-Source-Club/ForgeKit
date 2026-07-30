#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repository = process.env.GITHUB_REPOSITORY || 'CDUESTC-OpenAtom-Open-Source-Club/ForgeKit';
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const outputDir = path.resolve(process.argv[2] || 'docs/validation/metrics');

if (!token) {
  throw new Error('GH_TOKEN or GITHUB_TOKEN is required');
}

async function github(endpoint) {
  const response = await fetch(`https://api.github.com/repos/${repository}${endpoint}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'forgekit-growth-monitor',
    },
  });
  if (!response.ok) {
    throw new Error(`${endpoint}: GitHub API ${response.status} ${await response.text()}`);
  }
  return response.json();
}

function hasLabel(issue, label) {
  return issue.labels.some((entry) => (typeof entry === 'string' ? entry : entry.name) === label);
}

const [repo, views, clones, issues] = await Promise.all([
  github(''),
  github('/traffic/views'),
  github('/traffic/clones'),
  github('/issues?state=all&per_page=100'),
]);

const realIssues = issues.filter((issue) => !issue.pull_request);
const countLabel = (label) => realIssues.filter((issue) => hasLabel(issue, label)).length;
const latest = {
  schema_version: 1,
  collected_at: new Date().toISOString(),
  repository,
  acquisition: {
    repository_views_14d: views.count,
    repository_unique_visitors_14d: views.uniques,
    clones_14d: clones.count,
    unique_cloners_14d: clones.uniques,
    stars_total: repo.stargazers_count,
    forks_total: repo.forks_count,
  },
  activation: {
    pilot_issues: countLabel('pilot'),
    pilot_started: countLabel('pilot-started'),
    pilot_completed: countLabel('pilot-completed'),
    runtime_verified: countLabel('runtime-verified'),
  },
  retention: {
    reused_7d: countLabel('reused-7d'),
  },
  revenue: {
    paid_pilot_interest: countLabel('paid-pilot-interest'),
    paid_pilots: countLabel('paid-pilot'),
  },
  research: {
    research_issues: countLabel('research'),
    interview_completed: countLabel('interview-completed'),
  },
  caveats: [
    'GitHub clone counts may include CI, bots, and repeated automated fetches; they are not users.',
    'Repository traffic does not include GitHub Pages search impressions or client-side page events.',
    'Activation, retention, and revenue require explicit evidence labels on public, consented issues.',
  ],
};

fs.mkdirSync(outputDir, { recursive: true });
const previousPath = path.join(outputDir, 'latest.json');
const previous = fs.existsSync(previousPath)
  ? JSON.parse(fs.readFileSync(previousPath, 'utf8'))
  : undefined;
const materialSnapshot = { ...latest };
delete materialSnapshot.collected_at;
const comparablePrevious = previous ? { ...previous } : undefined;
if (comparablePrevious) delete comparablePrevious.collected_at;
if (!previous || JSON.stringify(comparablePrevious) !== JSON.stringify(materialSnapshot)) {
  fs.writeFileSync(previousPath, `${JSON.stringify(latest, null, 2)}\n`);
  fs.appendFileSync(path.join(outputDir, 'history.jsonl'), `${JSON.stringify(latest)}\n`);
}
const summary = `# ForgeKit growth evidence\n\n` +
  `Last collected: ${latest.collected_at}\n\n` +
  `| Funnel stage | Evidence | Current |\n|---|---|---:|\n` +
  `| Acquisition | Repository unique visitors (14d) | ${latest.acquisition.repository_unique_visitors_14d} |\n` +
  `| Acquisition | Unique cloners (14d, includes automation) | ${latest.acquisition.unique_cloners_14d} |\n` +
  `| Activation | Pilot started | ${latest.activation.pilot_started} |\n` +
  `| Value | Runtime verified | ${latest.activation.runtime_verified} |\n` +
  `| Retention | Reused within 7 days | ${latest.retention.reused_7d} |\n` +
  `| Revenue | Paid pilots | ${latest.revenue.paid_pilots} |\n\n` +
  `Do not interpret clones as users. See \`latest.json\` for caveats and the full snapshot.\n`;
fs.writeFileSync(path.join(outputDir, 'README.md'), summary);
console.log(JSON.stringify(latest, null, 2));
