import { describe, expect, it } from 'vitest';
// @ts-expect-error Development-only JavaScript helper intentionally lives outside src/.
import {
  compareAnnotationWorksheets,
  createAdjudicationTemplate,
  createAnnotationWorksheet,
  lockDiagnosticAnnotations,
} from '../../../scripts/lib/diagnostic-annotations.mjs';
// @ts-expect-error Development-only JavaScript helper intentionally lives outside src/.
import { auditDiagnosticCorpus } from '../../../scripts/lib/diagnostic-evaluation.mjs';

const corpus = [
  {
    name: 'copy missing',
    source_url: 'https://example.test/issues/1',
    source_type: 'issue',
    language: 'javascript',
    runtime: 'docker-buildkit',
    target_platform: 'linux',
    log: 'failed to calculate checksum: "/app.js": not found',
    expected_code: 'docker_copy_failed',
    annotation: { status: 'pending', reviewer_count: 0 },
  },
  {
    name: 'disk full',
    source_url: 'https://example.test/issues/2',
    source_type: 'issue',
    language: 'python',
    runtime: 'docker',
    target_platform: 'linux',
    log: 'no space left on device',
    expected_code: 'disk_space_exhausted',
    annotation: { status: 'pending', reviewer_count: 0 },
  },
];

describe('diagnostic annotation workflow', () => {
  it('creates a worksheet without per-case expected labels', () => {
    const worksheet = createAnnotationWorksheet(corpus, 'maintainer-a');

    expect(worksheet.reviewer).toBe('maintainer-a');
    expect(worksheet.cases).toHaveLength(2);
    expect(worksheet.cases[0]).not.toHaveProperty('expected_code');
    expect(worksheet.cases[0].selected_code).toBeNull();
    expect(JSON.stringify(worksheet.cases)).not.toContain('docker_copy_failed');
  });

  it('compares independent complete worksheets and reports conflicts', () => {
    const reviewerA = completedWorksheet('maintainer-a', [
      'docker_copy_failed', 'disk_space_exhausted',
    ]);
    const reviewerB = completedWorksheet('maintainer-b', [
      'docker_copy_failed', 'docker_copy_failed',
    ]);

    const comparison = compareAnnotationWorksheets(reviewerA, reviewerB);

    expect(comparison.totals).toEqual({ cases: 2, agreements: 1, conflicts: 1 });
    expect(comparison.conflicts[0].case_id).toBe('case-002');
  });

  it('rejects the same reviewer and incomplete labels', () => {
    const reviewerA = completedWorksheet('maintainer-a', [
      'docker_copy_failed', 'disk_space_exhausted',
    ]);
    const sameReviewer = completedWorksheet('maintainer-a', [
      'docker_copy_failed', 'disk_space_exhausted',
    ]);
    const incomplete = createAnnotationWorksheet(corpus, 'maintainer-b');

    expect(() => compareAnnotationWorksheets(reviewerA, sameReviewer)).toThrow(
      'different maintainers'
    );
    expect(() => compareAnnotationWorksheets(reviewerA, incomplete)).toThrow(
      'selected_code must be a non-empty string'
    );
  });

  it('rejects worksheets whose blind case content was modified', () => {
    const reviewerA = completedWorksheet('maintainer-a', [
      'docker_copy_failed', 'disk_space_exhausted',
    ]);
    const reviewerB = completedWorksheet('maintainer-b', [
      'docker_copy_failed', 'disk_space_exhausted',
    ]);
    reviewerB.cases[0].log = 'tampered log';

    expect(() => compareAnnotationWorksheets(reviewerA, reviewerB)).toThrow(
      'case content does not match corpus_sha256'
    );
  });

  it('requires adjudication for every conflict', () => {
    const comparison = compareAnnotationWorksheets(
      completedWorksheet('maintainer-a', ['docker_copy_failed', 'disk_space_exhausted']),
      completedWorksheet('maintainer-b', ['docker_copy_failed', 'docker_copy_failed'])
    );

    expect(() => lockDiagnosticAnnotations(corpus, comparison)).toThrow('adjudicator');
    expect(() => lockDiagnosticAnnotations(corpus, comparison, {
      adjudicator: 'maintainer-c',
      corpus_sha256: comparison.corpus_sha256,
      resolutions: [],
    })).toThrow('missing adjudication for case-002');
    expect(() => lockDiagnosticAnnotations(corpus, comparison, {
      adjudicator: 'maintainer-a',
      corpus_sha256: comparison.corpus_sha256,
      resolutions: [{ case_id: 'case-002', resolved_code: 'disk_space_exhausted' }],
    })).toThrow('different from both reviewers');
  });

  it('rejects adjudication for another corpus and duplicate resolutions', () => {
    const comparison = compareAnnotationWorksheets(
      completedWorksheet('maintainer-a', ['docker_copy_failed', 'disk_space_exhausted']),
      completedWorksheet('maintainer-b', ['docker_copy_failed', 'docker_copy_failed'])
    );
    const resolution = { case_id: 'case-002', resolved_code: 'disk_space_exhausted' };

    expect(() => lockDiagnosticAnnotations(corpus, comparison, {
      adjudicator: 'maintainer-c',
      corpus_sha256: 'different-corpus',
      resolutions: [resolution],
    })).toThrow('does not match the comparison corpus');
    expect(() => lockDiagnosticAnnotations(corpus, comparison, {
      adjudicator: 'maintainer-c',
      corpus_sha256: comparison.corpus_sha256,
      resolutions: [resolution, resolution],
    })).toThrow('duplicate adjudication for case-002');
  });

  it('rejects a comparison whose allowed codes do not match the corpus', () => {
    const comparison = compareAnnotationWorksheets(
      completedWorksheet('maintainer-a', ['docker_copy_failed', 'disk_space_exhausted']),
      completedWorksheet('maintainer-b', ['docker_copy_failed', 'disk_space_exhausted'])
    );
    comparison.allowed_codes = [
      ...comparison.allowed_codes,
      'registry_auth_failed',
    ].sort();

    expect(() => lockDiagnosticAnnotations(corpus, comparison)).toThrow(
      'allowed codes do not match the source corpus'
    );
  });

  it('locks agreed and adjudicated labels with auditable metadata', () => {
    const comparison = compareAnnotationWorksheets(
      completedWorksheet('maintainer-a', ['docker_copy_failed', 'disk_space_exhausted']),
      completedWorksheet('maintainer-b', ['docker_copy_failed', 'docker_copy_failed'])
    );
    const adjudication = createAdjudicationTemplate(comparison);
    adjudication.adjudicator = 'maintainer-c';
    adjudication.resolutions[0].resolved_code = 'disk_space_exhausted';

    const { lockedCorpus, report } = lockDiagnosticAnnotations(
      corpus,
      comparison,
      adjudication
    );

    expect(lockedCorpus[0].annotation.status).toBe('agreed');
    expect(lockedCorpus[1].annotation.status).toBe('adjudicated');
    expect(lockedCorpus[1].expected_code).toBe('disk_space_exhausted');
    expect(report.totals.conflicts).toBe(1);
    expect(auditDiagnosticCorpus(lockedCorpus).all_independently_annotated).toBe(true);
  });
});

function completedWorksheet(reviewer: string, codes: string[]) {
  const worksheet = createAnnotationWorksheet(corpus, reviewer);
  worksheet.cases.forEach((item: { selected_code: string | null }, index: number) => {
    item.selected_code = codes[index];
  });
  return worksheet;
}
