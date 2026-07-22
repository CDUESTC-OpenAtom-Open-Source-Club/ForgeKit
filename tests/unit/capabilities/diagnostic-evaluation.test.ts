import { describe, expect, it } from 'vitest';
import { evaluateDiagnosticCases } from '../../../src/capabilities/diagnostic-evaluation.js';

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
    ]);

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
    const report = evaluateDiagnosticCases([]);

    expect(report.total).toBe(0);
    expect(report.accuracy).toBe(0);
    expect(report.unknown_rate).toBe(0);
  });
});
