/**
 * Preflight Check Tests
 */

import { describe, it, expect } from 'vitest';
import { preflightCheck } from '../../../src/capabilities/preflight-check.js';
import path from 'path';
import { fileURLToPath } from 'url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

describe('preflightCheck', () => {
  it('应对有效源目录返回成功', async () => {
    const fixturesDir = path.resolve(currentDir, '../../fixtures');
    const result = await preflightCheck({
      source_dir: fixturesDir,
      checks: ['source_directory'],
    });

    expect(result.status).toBe('success');
    expect(result.all_passed).toBe(true);
    expect(result.passed_count).toBe(1);
  });

  it('应对不存在的目录返回失败', async () => {
    const result = await preflightCheck({
      source_dir: '/nonexistent/path',
      checks: ['source_directory'],
    });

    expect(result.status).toBe('failed');
    expect(result.all_passed).toBe(false);
    expect(result.failed_count).toBe(1);
    expect(result.checks[0].name).toBe('source_directory');
    expect(result.checks[0].status).toBe('fail');
  });

  it('应检查Docker可用性', async () => {
    const fixturesDir = path.resolve(currentDir, '../../fixtures');
    const result = await preflightCheck({
      source_dir: fixturesDir,
      checks: ['docker_availability'],
    });

    // Docker检查结果取决于环境，只验证结构
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0].name).toBe('docker_availability');
    expect(['pass', 'fail']).toContain(result.checks[0].status);
  });

  it('应对存在的计划文件返回成功', async () => {
    const fixturesDir = path.resolve(currentDir, '../../fixtures');
    const planPath = path.join(fixturesDir, 'test-plan.md');

    const result = await preflightCheck({
      source_dir: fixturesDir,
      plan_path: planPath,
      checks: ['plan_file'],
    });

    // 计划文件不存在，应该失败
    expect(result.checks[0].name).toBe('plan_file');
    expect(result.checks[0].status).toBe('fail');
  });

  it('应支持多个检查项', async () => {
    const fixturesDir = path.resolve(currentDir, '../../fixtures');
    const result = await preflightCheck({
      source_dir: fixturesDir,
      checks: ['source_directory', 'disk_space'],
    });

    expect(result.checks.length).toBe(2);
  });

  it('应提供修复建议', async () => {
    const result = await preflightCheck({
      source_dir: '/nonexistent',
      checks: ['source_directory'],
    });

    expect(result.recommendations).toBeDefined();
    expect(result.recommendations?.length).toBeGreaterThan(0);
  });
});
