import { createHash } from 'node:crypto';

const SCHEMA_VERSION = 1;

export function createAnnotationWorksheet(corpus, reviewer) {
  validateCorpus(corpus);
  const reviewerId = requireNonEmptyString(reviewer, 'reviewer');
  return {
    schema_version: SCHEMA_VERSION,
    reviewer: reviewerId,
    corpus_sha256: hashCorpus(corpus),
    allowed_codes: [...new Set(corpus.map((item) => item.expected_code))].sort(),
    cases: corpus.map((item, index) => ({
      case_id: caseId(index),
      name: item.name,
      source_url: item.source_url,
      source_type: item.source_type,
      language: item.language,
      runtime: item.runtime,
      target_platform: item.target_platform,
      log: item.log,
      selected_code: null,
      notes: '',
    })),
  };
}

export function compareAnnotationWorksheets(reviewerA, reviewerB) {
  validateWorksheet(reviewerA);
  validateWorksheet(reviewerB);
  if (reviewerA.reviewer === reviewerB.reviewer) {
    throw new Error('reviewer worksheets must belong to different maintainers');
  }
  if (reviewerA.corpus_sha256 !== reviewerB.corpus_sha256) {
    throw new Error('reviewer worksheets were generated from different corpus versions');
  }
  if (reviewerA.cases.length !== reviewerB.cases.length) {
    throw new Error('reviewer worksheets contain different case counts');
  }
  if (stableJson(reviewerA.allowed_codes) !== stableJson(reviewerB.allowed_codes)) {
    throw new Error('reviewer worksheets contain different allowed codes');
  }

  const agreements = [];
  const conflicts = [];
  for (let index = 0; index < reviewerA.cases.length; index += 1) {
    const itemA = reviewerA.cases[index];
    const itemB = reviewerB.cases[index];
    if (itemA.case_id !== itemB.case_id) {
      throw new Error(`worksheet case order mismatch at index ${index}`);
    }
    if (itemA.selected_code === itemB.selected_code) {
      agreements.push({ case_id: itemA.case_id, selected_code: itemA.selected_code });
    } else {
      conflicts.push({
        case_id: itemA.case_id,
        reviewer_a_code: itemA.selected_code,
        reviewer_b_code: itemB.selected_code,
        resolved_code: null,
        notes: '',
      });
    }
  }

  return {
    schema_version: SCHEMA_VERSION,
    corpus_sha256: reviewerA.corpus_sha256,
    reviewers: [reviewerA.reviewer, reviewerB.reviewer],
    allowed_codes: reviewerA.allowed_codes,
    totals: {
      cases: reviewerA.cases.length,
      agreements: agreements.length,
      conflicts: conflicts.length,
    },
    agreements,
    conflicts,
  };
}

export function lockDiagnosticAnnotations(corpus, comparison, adjudication = undefined) {
  validateCorpus(corpus);
  validateComparison(comparison);
  const corpusSha256 = hashCorpus(corpus);
  if (comparison.corpus_sha256 !== corpusSha256) {
    throw new Error('comparison does not match the source corpus');
  }
  if (comparison.totals.cases !== corpus.length) {
    throw new Error('comparison case count does not match the source corpus');
  }

  const labels = new Map(
    comparison.agreements.map((item) => [item.case_id, {
      code: item.selected_code,
      status: 'agreed',
    }])
  );
  let adjudicator;
  if (comparison.conflicts.length > 0) {
    adjudicator = requireNonEmptyString(adjudication?.adjudicator, 'adjudicator');
    if (comparison.reviewers.includes(adjudicator)) {
      throw new Error('adjudicator must be different from both reviewers');
    }
    if (!Array.isArray(adjudication?.resolutions)) {
      throw new Error('adjudication resolutions are required for conflicts');
    }
    const resolutions = new Map(
      adjudication.resolutions.map((item) => [
        requireNonEmptyString(item.case_id, 'resolution case_id'),
        requireAllowedCode(item.resolved_code, 'resolved_code', comparison.allowed_codes),
      ])
    );
    for (const conflict of comparison.conflicts) {
      const resolvedCode = resolutions.get(conflict.case_id);
      if (!resolvedCode) {
        throw new Error(`missing adjudication for ${conflict.case_id}`);
      }
      labels.set(conflict.case_id, { code: resolvedCode, status: 'adjudicated' });
    }
  }

  const lockedCorpus = corpus.map((item, index) => {
    const id = caseId(index);
    const label = labels.get(id);
    if (!label) {
      throw new Error(`comparison is missing ${id}`);
    }
    return {
      ...item,
      expected_code: label.code,
      annotation: {
        status: label.status,
        reviewer_count: 2,
        reviewer_ids: comparison.reviewers,
        ...(label.status === 'adjudicated' ? { adjudicator } : {}),
      },
    };
  });

  const lockedAt = new Date().toISOString();
  const report = {
    schema_version: SCHEMA_VERSION,
    locked_at: lockedAt,
    source_corpus_sha256: corpusSha256,
    locked_corpus_sha256: sha256(stableJson(lockedCorpus)),
    reviewers: comparison.reviewers,
    adjudicator: adjudicator ?? null,
    totals: comparison.totals,
  };
  return { lockedCorpus, report };
}

export function createAdjudicationTemplate(comparison) {
  validateComparison(comparison);
  return {
    schema_version: SCHEMA_VERSION,
    corpus_sha256: comparison.corpus_sha256,
    adjudicator: '',
    resolutions: comparison.conflicts.map((item) => ({
      case_id: item.case_id,
      reviewer_a_code: item.reviewer_a_code,
      reviewer_b_code: item.reviewer_b_code,
      resolved_code: null,
      notes: '',
    })),
  };
}

export function hashCorpus(corpus) {
  validateCorpus(corpus);
  const blindFields = corpus.map((item, index) => ({
    case_id: caseId(index),
    name: item.name,
    source_url: item.source_url,
    source_type: item.source_type,
    language: item.language,
    runtime: item.runtime,
    target_platform: item.target_platform,
    log: item.log,
  }));
  return sha256(stableJson(blindFields));
}

function validateCorpus(corpus) {
  if (!Array.isArray(corpus) || corpus.length === 0) {
    throw new Error('corpus must be a non-empty array');
  }
  for (const [index, item] of corpus.entries()) {
    for (const key of [
      'name', 'source_url', 'source_type', 'language', 'runtime',
      'target_platform', 'log', 'expected_code',
    ]) {
      requireNonEmptyString(item?.[key], `corpus[${index}].${key}`);
    }
  }
}

function validateWorksheet(worksheet) {
  requireNonEmptyString(worksheet?.reviewer, 'worksheet reviewer');
  requireNonEmptyString(worksheet?.corpus_sha256, 'worksheet corpus_sha256');
  if (!Array.isArray(worksheet?.allowed_codes) || worksheet.allowed_codes.length === 0) {
    throw new Error('worksheet allowed_codes must be a non-empty array');
  }
  if (!Array.isArray(worksheet?.cases) || worksheet.cases.length === 0) {
    throw new Error('worksheet cases must be a non-empty array');
  }
  const allowedCodes = new Set(worksheet.allowed_codes);
  for (const item of worksheet.cases) {
    requireNonEmptyString(item?.case_id, 'worksheet case_id');
    const selectedCode = requireCode(item?.selected_code, `${item.case_id} selected_code`);
    if (!allowedCodes.has(selectedCode)) {
      throw new Error(`${item.case_id} selected_code is not in allowed_codes`);
    }
  }
}

function validateComparison(comparison) {
  requireNonEmptyString(comparison?.corpus_sha256, 'comparison corpus_sha256');
  if (!Array.isArray(comparison?.reviewers) || comparison.reviewers.length !== 2) {
    throw new Error('comparison must contain exactly two reviewers');
  }
  if (comparison.reviewers[0] === comparison.reviewers[1]) {
    throw new Error('comparison reviewers must be different');
  }
  if (!Array.isArray(comparison?.allowed_codes) || comparison.allowed_codes.length === 0) {
    throw new Error('comparison allowed_codes must be a non-empty array');
  }
  if (!Array.isArray(comparison?.agreements) || !Array.isArray(comparison?.conflicts)) {
    throw new Error('comparison agreements and conflicts must be arrays');
  }
  if (!Number.isInteger(comparison?.totals?.cases)) {
    throw new Error('comparison totals are invalid');
  }
  if (comparison.totals.cases !== comparison.agreements.length + comparison.conflicts.length) {
    throw new Error('comparison totals do not match agreements and conflicts');
  }
  for (const item of comparison.agreements) {
    requireNonEmptyString(item.case_id, 'agreement case_id');
    requireAllowedCode(
      item.selected_code,
      `${item.case_id} selected_code`,
      comparison.allowed_codes
    );
  }
  for (const item of comparison.conflicts) {
    requireNonEmptyString(item.case_id, 'conflict case_id');
    requireAllowedCode(
      item.reviewer_a_code,
      `${item.case_id} reviewer_a_code`,
      comparison.allowed_codes
    );
    requireAllowedCode(
      item.reviewer_b_code,
      `${item.case_id} reviewer_b_code`,
      comparison.allowed_codes
    );
  }
}

function requireAllowedCode(value, label, allowedCodes) {
  const code = requireCode(value, label);
  if (!allowedCodes.includes(code)) {
    throw new Error(`${label} is not in allowed_codes`);
  }
  return code;
}

function requireCode(value, label) {
  const code = requireNonEmptyString(value, label);
  if (!/^[a-z][a-z0-9_]*$/.test(code)) {
    throw new Error(`${label} must be a snake_case error code`);
  }
  return code;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function caseId(index) {
  return `case-${String(index + 1).padStart(3, '0')}`;
}

function stableJson(value) {
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
