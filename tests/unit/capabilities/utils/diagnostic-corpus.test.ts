import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import { diagnoseBuildError } from '../../../../src/capabilities/utils/error-diagnostic.js';

interface DiagnosticCase {
  name: string;
  log: string;
  expected_code: string;
}

const cases = JSON.parse(
  fs.readFileSync(new URL('../../../fixtures/diagnostic-cases.json', import.meta.url), 'utf-8')
) as DiagnosticCase[];

describe('diagnostic regression corpus', () => {
  it('contains at least 15 named failure samples', () => {
    expect(cases.length).toBeGreaterThanOrEqual(15);
    expect(new Set(cases.map((item) => item.name)).size).toBe(cases.length);
  });

  for (const item of cases) {
    it(`classifies ${item.name}`, () => {
      const diagnosis = diagnoseBuildError(item.log);

      expect(diagnosis?.code).toBe(item.expected_code);
      expect(diagnosis?.evidence.length).toBeGreaterThan(0);
      expect(diagnosis?.suggested_actions.length).toBeGreaterThan(0);
      expect(diagnosis?.verification.length).toBeGreaterThan(0);
    });
  }
});
