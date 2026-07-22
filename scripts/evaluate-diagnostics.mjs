import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { diagnoseBuildError } from '../dist/capabilities/utils/error-diagnostic.js';
import { evaluateDiagnosticCases, evaluateReleaseGate } from './lib/diagnostic-evaluation.mjs';

const releaseGate = process.argv.includes('--release-gate');
const corpusArg = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
if (!corpusArg) {
  console.error('Usage: node scripts/evaluate-diagnostics.mjs <corpus.json> [--release-gate]');
  process.exit(2);
}

const corpusPath = path.resolve(corpusArg);
let cases;
try {
  cases = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
} catch (error) {
  console.error(`Unable to read diagnostic corpus: ${error.message}`);
  process.exit(2);
}

if (!Array.isArray(cases) || !cases.every((item) => isValidCase(item, releaseGate))) {
  console.error('Corpus entries are missing required fields or annotation metadata');
  process.exit(2);
}

const report = evaluateDiagnosticCases(cases, diagnoseBuildError);
const gate = releaseGate ? evaluateReleaseGate(report) : undefined;
console.log(JSON.stringify({ corpus: corpusPath, ...report, release_gate: gate }, null, 2));
process.exitCode = releaseGate ? (gate.passed ? 0 : 1) : (report.failures.length === 0 ? 0 : 1);

function isValidCase(item, requireMetadata) {
  const baseValid = item &&
    typeof item.name === 'string' &&
    typeof item.log === 'string' &&
    typeof item.expected_code === 'string';
  if (!baseValid || !requireMetadata) {
    return baseValid;
  }
  return typeof item.source_url === 'string' &&
    typeof item.source_type === 'string' &&
    typeof item.language === 'string' &&
    typeof item.runtime === 'string' &&
    typeof item.target_platform === 'string' &&
    item.annotation &&
    typeof item.annotation.status === 'string' &&
    Number.isInteger(item.annotation.reviewer_count);
}
