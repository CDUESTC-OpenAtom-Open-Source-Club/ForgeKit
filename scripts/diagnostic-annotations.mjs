import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  compareAnnotationWorksheets,
  createAdjudicationTemplate,
  createAnnotationWorksheet,
  lockDiagnosticAnnotations,
} from './lib/diagnostic-annotations.mjs';

const [command, ...args] = process.argv.slice(2);
const options = parseOptions(args);

try {
  if (command === 'prepare') {
    const corpus = readJson(requiredOption(options, 'corpus'));
    const worksheet = createAnnotationWorksheet(corpus, requiredOption(options, 'reviewer'));
    writeNewJson(requiredOption(options, 'output'), worksheet);
  } else if (command === 'compare') {
    const reviewerA = readJson(requiredOption(options, 'reviewer-a'));
    const reviewerB = readJson(requiredOption(options, 'reviewer-b'));
    const comparison = compareAnnotationWorksheets(reviewerA, reviewerB);
    writeNewJson(requiredOption(options, 'output'), comparison);
    if (options.adjudication) {
      writeNewJson(options.adjudication, createAdjudicationTemplate(comparison));
    }
  } else if (command === 'lock') {
    const corpus = readJson(requiredOption(options, 'corpus'));
    const comparison = readJson(requiredOption(options, 'comparison'));
    const adjudication = options.adjudication ? readJson(options.adjudication) : undefined;
    const { lockedCorpus, report } = lockDiagnosticAnnotations(
      corpus,
      comparison,
      adjudication
    );
    writeNewJson(requiredOption(options, 'output'), lockedCorpus);
    writeNewJson(requiredOption(options, 'report'), report);
  } else {
    usage();
    process.exitCode = 2;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function parseOptions(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith('--') || value === undefined || value.startsWith('--')) {
      throw new Error(`invalid option near ${key ?? 'end of command'}`);
    }
    parsed[key.slice(2)] = value;
  }
  return parsed;
}

function requiredOption(options, name) {
  const value = options[name];
  if (!value) {
    throw new Error(`--${name} is required`);
  }
  return value;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function writeNewJson(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  console.log(resolved);
}

function usage() {
  console.error(`Usage:
  diagnostic-annotations.mjs prepare --corpus <file> --reviewer <id> --output <file>
  diagnostic-annotations.mjs compare --reviewer-a <file> --reviewer-b <file> --output <file> [--adjudication <file>]
  diagnostic-annotations.mjs lock --corpus <file> --comparison <file> [--adjudication <file>] --output <file> --report <file>`);
}
