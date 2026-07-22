import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import { diagnoseBuildError } from '../../../../src/capabilities/utils/error-diagnostic.js';

interface PublicDiagnosticCase {
  name: string;
  source_url: string;
  retrieved_on: string;
  log: string;
  expected_code: string;
}

const cases = JSON.parse(
  fs.readFileSync(new URL('../../../fixtures/diagnostic-public-cases.json', import.meta.url), 'utf-8')
) as PublicDiagnosticCase[];

describe('public diagnostic development corpus', () => {
  it('keeps provenance for every public log excerpt', () => {
    expect(cases.length).toBeGreaterThanOrEqual(10);
    for (const item of cases) {
      expect(item.source_url).toMatch(/^https:\/\/github\.com\//);
      expect(item.retrieved_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(item.log.length).toBeGreaterThan(0);
    }
  });

  for (const item of cases) {
    it(`classifies ${item.name}`, () => {
      const diagnosis = diagnoseBuildError(item.log);

      expect(diagnosis?.code).toBe(item.expected_code);
      expect(diagnosis?.evidence.length).toBeGreaterThan(0);
    });
  }
});
