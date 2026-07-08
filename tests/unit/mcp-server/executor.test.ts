/**
 * M1+M2 Executor Test - plan_path 强制校验 + 真实 inspect_project 路由
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { executeTool } from '../../../src/mcp-server/tools/executor.js';

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgekit-exec-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Executor - plan_path 强制校验', () => {
  it('build_docker_image 缺失 plan_path 返回 plan_not_found', async () => {
    const result = await executeTool('build_docker_image', {
      source_dir: '/tmp/test',
      image_name: 'test',
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('plan_not_found');
    expect(result.error?.suggested_fix).toContain('generate_packaging_plan');
  });

  it('pack_deb 缺失 plan_path 返回 plan_not_found', async () => {
    const result = await executeTool('pack_deb', {
      source_dir: '/tmp/test',
      version: '1.0.0',
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('plan_not_found');
  });

  it('build_docker_image 提供 plan_path 但文件不存在 → plan_not_found', async () => {
    const result = await executeTool('build_docker_image', {
      source_dir: '/tmp/test',
      plan_path: '/tmp/nonexistent-Forge.md',
      image_name: 'test',
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('plan_not_found');
  });

  it('build_docker_image 提供 plan_path 且文件存在 → 通过校验', async () => {
    const planPath = path.join(tmpDir, 'Forge.md');
    fs.writeFileSync(planPath, '# Forge Plan');

    const result = await executeTool('build_docker_image', {
      source_dir: tmpDir,
      plan_path: planPath,
      image_name: 'test',
    });

    expect(result.status).toBe('success');
  });
});

describe('Executor - 路由到真实能力', () => {
  it('inspect_project 路由到真实实现', async () => {
    const projDir = path.join(tmpDir, 'inspect-target');
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(path.join(projDir, 'app.py'), 'print("hi")');

    const result = await executeTool('inspect_project', { source_dir: projDir });

    expect(result.status).toBe('success');
    // M2 真实能力会返回 language
    expect((result as any).language).toBe('Python');
  });

  it('inspect_project 源目录不存在返回 path_not_found', async () => {
    const result = await executeTool('inspect_project', {
      source_dir: '/nonexistent/xyz',
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('path_not_found');
  });

  it('未知工具返回 unknown_error', async () => {
    const result = await executeTool('unknown_tool', {});

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('unknown_error');
  });
});