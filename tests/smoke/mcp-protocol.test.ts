/**
 * MCP 协议层冒烟测试
 * 验证：工具可被发现、plan_path 校验生效、结构化输出
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { executeTool } from '../../src/mcp-server/tools/executor.js';
import { registerTools } from '../../src/mcp-server/tools/registry.js';

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgekit-smoke-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('MCP 协议层冒烟测试', () => {
  describe('工具发现测试', () => {
    it('能列出所有 5 个工具', () => {
      const tools = registerTools();
      const toolNames = tools.map((t) => t.name);

      expect(toolNames).toContain('inspect_project');
      expect(toolNames).toContain('generate_packaging_plan');
      expect(toolNames).toContain('build_docker_image');
      expect(toolNames).toContain('pack_deb');
      expect(toolNames).toContain('preflight_check'); // v0.2新增
      expect(tools.length).toBe(5);
    });

    it('所有工具都有正确的 Schema', () => {
      const tools = registerTools();

      tools.forEach((tool) => {
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
        expect(tool.inputSchema.required).toBeDefined();
        expect(tool.description).toBeTruthy();
      });
    });

    it('构建类工具有 plan_path 必需字段', () => {
      const tools = registerTools();
      const buildTools = tools.filter((t) => ['build_docker_image', 'pack_deb'].includes(t.name));

      buildTools.forEach((tool) => {
        expect(tool.inputSchema.properties?.plan_path).toBeDefined();
        expect(tool.inputSchema.required).toContain('plan_path');
      });
    });
  });

  describe('plan_path 强制校验测试', () => {
    it('build_docker_image 缺失 plan_path 返回 plan_not_found', async () => {
      const result = await executeTool('build_docker_image', {
        source_dir: tmpDir,
        image_name: 'test',
      });

      expect(result.status).toBe('failed');
      expect(result.error?.code).toBe('plan_not_found');
      expect(result.error?.summary).toContain('Forge.md');
      expect(result.error?.suggested_fix).toContain('generate_packaging_plan');
    });

    it('pack_deb 缺失 plan_path 返回 plan_not_found', async () => {
      const result = await executeTool('pack_deb', {
        source_dir: tmpDir,
        version: '1.0.0',
      });

      expect(result.status).toBe('failed');
      expect(result.error?.code).toBe('plan_not_found');
    });

    it('非构建类工具不强制 plan_path（用真实临时目录）', async () => {
      const result = await executeTool('inspect_project', { source_dir: tmpDir });

      expect(result.status).toBe('success');
      expect(result.error).toBeUndefined();
    });
  });

  describe('结构化输出测试', () => {
    it('inspect_project 返回 ForgeKitResult 结构（含 decision_basis）', async () => {
      const result: any = await executeTool('inspect_project', { source_dir: tmpDir });

      expect(result).toHaveProperty('status');
      expect(result.status).toBe('success');
      expect(result.decision_basis).toBeDefined();
    });

    it('构建类工具 plan_path 校验通过后进入能力层（无 docker 则返回 daemon 错误）', async () => {
      const planPath = path.join(tmpDir, 'Forge.md');
      fs.writeFileSync(planPath, '# Forge Plan');

      const result: any = await executeTool('build_docker_image', {
        source_dir: tmpDir,
        plan_path: planPath,
        image_name: 'test',
      });

      // plan_path 校验通过（不会返回 plan_not_found）
      expect(result.error?.code).not.toBe('plan_not_found');
    });
  });

  describe('错误结构验证', () => {
    it('plan_not_found 错误有完整字段', async () => {
      const result = await executeTool('build_docker_image', {
        source_dir: tmpDir,
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