/**
 * M1 Executor Test - 验证 plan_path 强制校验
 */

import { describe, it, expect } from 'vitest';
import { executeTool } from '../../../src/mcp-server/tools/executor.js';

describe('M1: Executor - plan_path 强制校验', () => {
  it('构建类工具缺失 plan_path 时返回 plan_not_found 错误', async () => {
    // 缺失 plan_path
    const result = await executeTool('build_docker_image', {
      source_dir: '/tmp/test',
      image_name: 'test',
      // plan_path 缺失
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('plan_not_found');
    expect(result.error?.summary).toContain('Forge.md');
    expect(result.error?.suggested_fix).toContain('generate_packaging_plan');
  });

  it('pack_deb 缺失 plan_path 时也返回 plan_not_found', async () => {
    const result = await executeTool('pack_deb', {
      source_dir: '/tmp/test',
      version: '1.0.0',
      // plan_path 缺失
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('plan_not_found');
  });

  it('非构建类工具不强制 plan_path', async () => {
    // inspect_project 不强制 plan_path
    const result = await executeTool('inspect_project', {
      source_dir: '/tmp/test',
      // 无 plan_path，不应报错
    });

    expect(result.status).toBe('success');
    expect(result.error).toBeUndefined();
  });

  it('构建类工具提供 plan_path 后通过校验（占位响应）', async () => {
    const result = await executeTool('build_docker_image', {
      source_dir: '/tmp/test',
      plan_path: '/tmp/test/Forge.md', // 提供 plan_path
      image_name: 'test',
    });

    // M1 阶段返回占位成功响应
    expect(result.status).toBe('success');
    expect(result.decision_basis).toBeDefined();
    expect(result.warnings).toContain('当前为协议层占位响应，未实现实际能力');
  });
});

describe('M1: Executor - 结构化输出', () => {
  it('所有工具返回 ForgeKitResult 结构', async () => {
    const tools = ['inspect_project', 'generate_packaging_plan'];

    for (const toolName of tools) {
      const result = await executeTool(toolName, { source_dir: '/tmp/test' });

      // 验证结构
      expect(result).toHaveProperty('status');
      expect(['success', 'failed']).toContain(result.status);

      if (result.status === 'success') {
        expect(result.decision_basis).toBeDefined();
        expect(result.next_actions).toBeDefined();
      }
    }
  });
});