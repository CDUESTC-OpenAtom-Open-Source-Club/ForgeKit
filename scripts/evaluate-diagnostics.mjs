import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { evaluateDiagnosticCases } from '../dist/capabilities/diagnostic-evaluation.js';

const corpusArg = process.argv[2];
if (!corpusArg) {
  console.error('Usage: node scripts/evaluate-diagnostics.mjs <corpus.json>');
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

if (!Array.isArray(cases) || !cases.every(isValidCase)) {
  console.error('Corpus must be an array of { name, log, expected_code } objects');
  process.exit(2);
}

const report = evaluateDiagnosticCases(cases);
console.log(JSON.stringify({ corpus: corpusPath, ...report }, null, 2));
process.exitCode = report.failures.length === 0 ? 0 : 1;

function isValidCase(item) {
  return item &&
    typeof item.name === 'string' &&
    typeof item.log === 'string' &&
    typeof item.expected_code === 'string';
}
