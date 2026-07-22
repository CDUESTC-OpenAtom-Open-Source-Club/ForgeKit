import { diagnoseBuildError } from './utils/error-diagnostic.js';

export interface DiagnosticEvaluationCase {
  name: string;
  log: string;
  expected_code: string;
}

export interface DiagnosticCategoryMetrics {
  total: number;
  correct: number;
  accuracy: number;
}

export interface DiagnosticEvaluationReport {
  total: number;
  correct: number;
  accuracy: number;
  unknown_count: number;
  unknown_rate: number;
  by_expected_code: Record<string, DiagnosticCategoryMetrics>;
  confusion: Record<string, Record<string, number>>;
  failures: Array<{
    name: string;
    expected_code: string;
    actual_code: string;
  }>;
}

export function evaluateDiagnosticCases(
  cases: DiagnosticEvaluationCase[]
): DiagnosticEvaluationReport {
  const byExpectedCode: Record<string, { total: number; correct: number }> = {};
  const confusion: Record<string, Record<string, number>> = {};
  const failures: DiagnosticEvaluationReport['failures'] = [];
  let correct = 0;
  let unknownCount = 0;

  for (const item of cases) {
    const actualCode = diagnoseBuildError(item.log)?.code ?? 'unknown_error';
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
  };
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}
