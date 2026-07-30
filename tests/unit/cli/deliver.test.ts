import { describe, expect, it, vi } from 'vitest';
import { deliverProject } from '../../../src/cli/deliver.js';

const successfulInspect = { status: 'success' as const, language: 'Node.js' };
const successfulPlan = { status: 'success' as const, plan_path: '/project/Forge.md' };

describe('deliverProject', () => {
  it('stops at complete preflight failure without building', async () => {
    const build = vi.fn();
    const result = await deliverProject({ sourceDir: '/project' }, {
      inspect: vi.fn().mockResolvedValue(successfulInspect),
      plan: vi.fn().mockResolvedValue(successfulPlan),
      preflight: vi.fn().mockResolvedValue({ status: 'failed', all_passed: false, checks: [], passed_count: 4, failed_count: 1 }),
      build,
    });
    expect(result.failed_stage).toBe('preflight');
    expect(build).not.toHaveBeenCalled();
  });

  it('requests runtime and HTTP health verification and exposes evidence', async () => {
    const preflight = vi.fn().mockResolvedValue({ status: 'success', all_passed: true, checks: [], passed_count: 5, failed_count: 0 });
    const build = vi.fn().mockResolvedValue({
      status: 'success', image_ref: 'demo:forgekit', build_log: '/logs/build.log',
      runtime_verification: { requested: true, success: true, container_started: true, healthcheck_passed: true },
    });
    const result = await deliverProject({ sourceDir: '/project', containerPort: 8080, healthcheckPath: '/health' }, {
      inspect: vi.fn().mockResolvedValue(successfulInspect),
      plan: vi.fn().mockResolvedValue(successfulPlan),
      preflight,
      build,
    });
    expect(preflight).toHaveBeenCalledWith({ source_dir: '/project', plan_path: '/project/Forge.md' });
    expect(build).toHaveBeenCalledWith(expect.objectContaining({ verify_runtime: true, container_port: 8080, healthcheck_path: '/health' }));
    expect(result.status).toBe('success');
    expect(result.evidence).toEqual(expect.objectContaining({ container_started: true, healthcheck_passed: true }));
  });

  it('uses non-conflicting inspect runtime hints when flags are omitted', async () => {
    const build = vi.fn().mockResolvedValue({ status: 'success', runtime_verification: { container_started: true } });
    await deliverProject({ sourceDir: '/project' }, {
      inspect: vi.fn().mockResolvedValue({ ...successfulInspect, runtime_hints: { container_port: 3000, healthcheck_path: '/healthz', confidence: 'high', evidence: ['Dockerfile'] } }),
      plan: vi.fn().mockResolvedValue(successfulPlan),
      preflight: vi.fn().mockResolvedValue({ status: 'success', all_passed: true, checks: [], passed_count: 5, failed_count: 0 }),
      build,
    });
    expect(build).toHaveBeenCalledWith(expect.objectContaining({ container_port: 3000, healthcheck_path: '/healthz' }));
  });
});
