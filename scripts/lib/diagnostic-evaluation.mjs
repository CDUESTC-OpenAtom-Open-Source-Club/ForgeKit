/**
 * Evaluate a diagnostic classifier against a labeled corpus.
 *
 * This is development tooling, intentionally kept outside the published
 * runtime under src/. The classifier is injected so the same evaluator can
 * exercise source code in tests and compiled code in the CLI script.
 */
export function evaluateDiagnosticCases(cases, classifyLog) {
  const byExpectedCode = {};
  const confusion = {};
  const failures = [];
  let correct = 0;
  let unknownCount = 0;

  for (const item of cases) {
    const actualCode = classifyLog(item.log)?.code ?? 'unknown_error';
    const isCorrect = actualCode === item.expected_code;
    if (isCorrect) {
      correct += 1;
    } else {
      failures.push({
        name: item.name,
        expected_code: item.expected_code,
        actual_code: actualCode,
      });
    }
    if (actualCode === 'unknown_error') {
      unknownCount += 1;
    }

    const category = byExpectedCode[item.expected_code] ?? { total: 0, correct: 0 };
    category.total += 1;
    category.correct += isCorrect ? 1 : 0;
    byExpectedCode[item.expected_code] = category;

    confusion[item.expected_code] ??= {};
    confusion[item.expected_code][actualCode] =
      (confusion[item.expected_code][actualCode] ?? 0) + 1;
  }

  const total = cases.length;
  const normalizedByCode = Object.fromEntries(
    Object.entries(byExpectedCode).map(([code, metrics]) => [
      code,
      {
        ...metrics,
        accuracy: ratio(metrics.correct, metrics.total),
      },
    ])
  );

  return {
    total,
    correct,
    accuracy: ratio(correct, total),
    unknown_count: unknownCount,
    unknown_rate: ratio(unknownCount, total),
    by_expected_code: normalizedByCode,
    confusion,
    failures,
    corpus_audit: auditDiagnosticCorpus(cases),
  };
}

export function auditDiagnosticCorpus(cases) {
  const duplicateLogs = [];
  const sensitiveFindings = [];
  const seenLogs = new Map();
  let independentlyAnnotated = 0;

  for (const item of cases) {
    const normalizedLog = item.log.replace(/\s+/g, ' ').trim().toLowerCase();
    const priorName = seenLogs.get(normalizedLog);
    if (priorName) {
      duplicateLogs.push({ first: priorName, duplicate: item.name });
    } else {
      seenLogs.set(normalizedLog, item.name);
    }

    const findings = findSensitiveData(item.log);
    if (findings.length > 0) {
      sensitiveFindings.push({ name: item.name, findings });
    }

    if (
      item.annotation?.reviewer_count >= 2 &&
      ['agreed', 'adjudicated'].includes(item.annotation?.status)
    ) {
      independentlyAnnotated += 1;
    }
  }

  return {
    source_count: new Set(cases.map((item) => item.source_url).filter(Boolean)).size,
    duplicate_count: duplicateLogs.length,
    duplicate_logs: duplicateLogs,
    sensitive_finding_count: sensitiveFindings.length,
    sensitive_findings: sensitiveFindings,
    independently_annotated_count: independentlyAnnotated,
    all_independently_annotated: cases.length > 0 && independentlyAnnotated === cases.length,
  };
}

export function evaluateReleaseGate(report, options = {}) {
  const minimumCases = options.minimumCases ?? 50;
  const minimumAccuracy = options.minimumAccuracy ?? 0.8;
  const minimumCasesPerCode = options.minimumCasesPerCode ?? 3;
  const failures = [];

  if (report.total < minimumCases) {
    failures.push(`corpus has ${report.total} cases; requires at least ${minimumCases}`);
  }
  if (report.accuracy < minimumAccuracy) {
    failures.push(`accuracy is ${formatPercent(report.accuracy)}; requires ${formatPercent(minimumAccuracy)}`);
  }
  for (const [code, metrics] of Object.entries(report.by_expected_code)) {
    if (metrics.total < minimumCasesPerCode) {
      failures.push(`${code} has ${metrics.total} cases; requires at least ${minimumCasesPerCode}`);
    }
  }
  if (report.corpus_audit.duplicate_count > 0) {
    failures.push(`corpus contains ${report.corpus_audit.duplicate_count} duplicate logs`);
  }
  if (report.corpus_audit.sensitive_finding_count > 0) {
    failures.push(`corpus contains ${report.corpus_audit.sensitive_finding_count} logs with possible sensitive data`);
  }
  if (!report.corpus_audit.all_independently_annotated) {
    failures.push(
      `${report.corpus_audit.independently_annotated_count}/${report.total} cases have two-reviewer annotation`
    );
  }

  return { passed: failures.length === 0, failures };
}

function findSensitiveData(text) {
  const patterns = {
    email: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i,
    secret: /\b(?:bearer\s+[a-z0-9._~+/-]{12,}|(?:token|api[_-]?key|secret|password|authorization)\s*[:=]\s*[^\s,;]+)/i,
    provider_token: /\b(?:gh[pousr]_[a-z0-9_]{20,}|github_pat_[a-z0-9_]{20,}|sk-[a-z0-9_-]{20,})\b/i,
    user_path: /(?:\/Users\/|\/home\/)[^/[\]\\\s]+\//i,
  };
  return Object.entries(patterns)
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name);
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function ratio(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}
