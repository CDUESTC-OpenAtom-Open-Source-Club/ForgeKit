import { describe, expect, it } from 'vitest';
// @ts-expect-error Development-only JavaScript helper intentionally lives outside src/.
import {
  auditDiagnosticCorpus,
  evaluateDiagnosticCases,
  evaluateReleaseGate,
} from '../../../scripts/lib/diagnostic-evaluation.mjs';
import { diagnoseBuildError } from '../../../src/capabilities/utils/error-diagnostic.js';

describe('evaluateDiagnosticCases', () => {
  it('计算准确率、未知率、分类指标和混淆结果', () => {
    const report = evaluateDiagnosticCases([
      {
        name: 'copy missing',
        log: 'failed to calculate checksum: "/app.py": not found',
        expected_code: 'docker_copy_failed',
      },
      {
        name: 'unknown signature',
        log: 'an unseen builder failure 731',
        expected_code: 'network_unreachable',
      },
    ], diagnoseBuildError);

    expect(report.total).toBe(2);
    expect(report.correct).toBe(1);
    expect(report.accuracy).toBe(0.5);
    expect(report.unknown_count).toBe(1);
    expect(report.unknown_rate).toBe(0.5);
    expect(report.by_expected_code.docker_copy_failed.accuracy).toBe(1);
    expect(report.confusion.network_unreachable.unknown_error).toBe(1);
    expect(report.failures).toEqual([
      {
        name: 'unknown signature',
        expected_code: 'network_unreachable',
        actual_code: 'unknown_error',
      },
    ]);
  });

  it('空语料返回零值而不是 NaN', () => {
    const report = evaluateDiagnosticCases([], diagnoseBuildError);

    expect(report.total).toBe(0);
    expect(report.accuracy).toBe(0);
    expect(report.unknown_rate).toBe(0);
  });

  it('审计重复日志、敏感信息和独立标注状态', () => {
    const audit = auditDiagnosticCorpus([
      {
        name: 'first', log: 'password=hunter2 user@example.com', expected_code: 'unknown_error',
        annotation: { status: 'agreed', reviewer_count: 2 },
      },
      {
        name: 'duplicate', log: 'password=hunter2 user@example.com', expected_code: 'unknown_error',
        annotation: { status: 'pending', reviewer_count: 0 },
      },
    ]);

    expect(audit.duplicate_count).toBe(1);
    expect(audit.sensitive_finding_count).toBe(2);
    expect(audit.independently_annotated_count).toBe(1);
    expect(audit.all_independently_annotated).toBe(false);
  });

  it('发布门禁单独报告未满足条件', () => {
    const report = evaluateDiagnosticCases([
      {
        name: 'copy missing',
        log: 'failed to calculate checksum: "/app.py": not found',
        expected_code: 'docker_copy_failed',
        annotation: { status: 'pending', reviewer_count: 0 },
      },
    ], diagnoseBuildError);
    const gate = evaluateReleaseGate(report);

    expect(gate.passed).toBe(false);
    expect(gate.failures).toContain('corpus has 1 cases; requires at least 50');
    expect(gate.failures).toContain('0/1 cases have two-reviewer annotation');
  });
});
