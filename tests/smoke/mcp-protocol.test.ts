/**
 * MCP 协议层冒烟测试
 * 验证：工具可被发现、plan_path 校验生效、结构化输出
 */

import { describe, it, expect } from 'vitest';
import { executeTool } from '../../src/mcp-server/tools/executor.js';
import { registerTools } from '../../src/mcp-server/tools/registry.js';

describe('MCP 协议层冒烟测试', () => {
  describe('工具发现测试', () => {
    it('能列出所有 4 个工具', () => {
      const tools = registerTools();
      const toolNames = tools.map(t => t.name);

      expect(toolNames).toContain('inspect_project');
      expect(toolNames).toContain('generate_packaging_plan');
      expect(toolNames).toContain('build_docker_image');
      expect(toolNames).toContain('pack_deb');
      expect(tools.length).toBe(4);
    });

    it('所有工具都有正确的 Schema', () => {
      const tools = registerTools();

      tools.forEach(tool => {
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
        expect(tool.inputSchema.required).toBeDefined();
        expect(tool.description).toBeTruthy();
      });
    });

    it('构建类工具有 plan_path 必需字段', () => {
      const tools = registerTools();
      const buildTools = tools.filter(t =>
        ['build_docker_image', 'pack_deb'].includes(t.name)
      );

      buildTools.forEach(tool => {
        expect(tool.inputSchema.properties?.plan_path).toBeDefined();
        expect(tool.inputSchema.required).toContain('plan_path');
      });
    });
  });

  describe('plan_path 强制校验测试', () => {
    it('build_docker_image 缺失 plan_path 返回 plan_not_found', async () => {
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

    it('pack_deb 缺失 plan_path 返回 plan_not_found', async () => {
      const result = await executeTool('pack_deb', {
        source_dir: '/tmp/test',
        version: '1.0.0',
        // plan_path 缺失
      });

      expect(result.status).toBe('failed');
      expect(result.error?.code).toBe('plan_not_found');
    });

    it('非构建类工具不强制 plan_path', async () => {
      const result = await executeTool('inspect_project', {
        source_dir: '/tmp/test',
        // 无 plan_path
      });

      expect(result.status).toBe('success');
      expect(result.error).toBeUndefined();
    });
  });

  describe('结构化输出测试', () => {
    it('所有工具返回 ForgeKitResult 结构', async () => {
      const tools = [
        { name: 'inspect_project', args: { source_dir: '/tmp' } },
        { name: 'generate_packaging_plan', args: { source_dir: '/tmp', goals: ['Docker'] } },
        { name: 'build_docker_image', args: { source_dir: '/tmp', plan_path: '/tmp/Forge.md', image_name: 'test' } },
        { name: 'pack_deb', args: { source_dir: '/tmp', plan_path: '/tmp/Forge.md', version: '1.0.0' } },
      ];

      for (const { name, args } of tools) {
        const result = await executeTool(name, args);

        // 验证结构
        expect(result).toHaveProperty('status');
        expect(['success', 'failed']).toContain(result.status);

        if (result.status === 'success') {
          expect(result.decision_basis).toBeDefined();
        } else if (result.error) {
          expect(result.error.code).toBeDefined();
          expect(result.error.summary).toBeDefined();
        }
      }
    });

    it('返回 decision_basis（协议层占位）', async () => {
      const result = await executeTool('build_docker_image', {
        source_dir: '/tmp/test',
        plan_path: '/tmp/test/Forge.md',
        image_name: 'test',
      });

      expect(result.status).toBe('success');
      expect(result.decision_basis).toBeDefined();
      expect(result.decision_basis?.build_method).toContain('协议层');
    });
  });

  describe('错误结构验证', () => {
    it('plan_not_found 错误有完整字段', async () => {
      const result = await executeTool('build_docker_image', {
        source_dir: '/tmp/test',
        image_name: 'test',
      });

      expect(result.error?.code).toBe('plan_not_found');
      expect(result.error?.summary).toBeTruthy();
      expect(result.error?.suggested_fix).toBeTruthy();
      expect(result.error?.plan_correction).toBeTruthy();
    });

    it('未知工具返回 unknown_error', async () => {
      const result = await executeTool('unknown_tool', {});

      expect(result.status).toBe('failed');
      expect(result.error?.code).toBe('unknown_error');
    });
  });
});