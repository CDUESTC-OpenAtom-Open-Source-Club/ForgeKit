/**
 * M6: E2E 测试 - 模拟 Agent 完整调用闭环
 *
 * 流程：inspect → plan → build（contract 验证）
 * 验证 Plan-before-build 强制约束、决策依据传递、Forge.md 写回
 *
 * 注：测试环境无 Docker/dpkg，build 阶段验证契约层（plan_path 强制、错误结构化），
 * 真实构建在有 Docker 的环境由 CI 的 docker-smoke job 验证。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { executeTool } from '../../src/mcp-server/tools/executor.js';

let tmpDir: string;
let projectDir: string;

beforeAll(() => {
  // 复制 fixture 到临时目录（避免污染源 fixture）
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgekit-e2e-'));
  projectDir = path.join(tmpDir, 'sample-python-project');
  fs.mkdirSync(projectDir, { recursive: true });

  const fixtureDir = path.join(__dirname, '..', 'fixtures', 'sample-python-project');
  for (const file of ['app.py', 'requirements.txt', 'pyproject.toml', 'Dockerfile']) {
    fs.copyFileSync(path.join(fixtureDir, file), path.join(projectDir, file));
  }
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('M6 E2E: Agent 完整调用闭环', () => {
  let planPath: string;

  it('Step 1: inspect_project 识别 fixture 项目', async () => {
    const result: any = await executeTool('inspect_project', { source_dir: projectDir });

    expect(result.status).toBe('success');
    expect(result.language).toBe('Python');
    expect(result.entrypoints).toContain('app.py');
    expect(result.existing_packaging?.dockerfile).toBe(true);
    expect(result.existing_packaging?.pyproject_toml).toBe(true);
    expect(result.existing_packaging?.requirements_txt).toBe(true);
    expect(result.recommendations?.some((r: string) => r.includes('Docker'))).toBe(true);
  });

  it('Step 2: generate_packaging_plan 生成 Forge.md', async () => {
    const result: any = await executeTool('generate_packaging_plan', {
      source_dir: projectDir,
      goals: ['Docker'],
      target_environment: 'ubuntu-22.04',
    });

    expect(result.status).toBe('success');
    planPath = result.plan_path;
    expect(planPath).toBe(path.join(projectDir, 'Forge.md'));
    expect(fs.existsSync(planPath)).toBe(true);

    // Forge.md 内容验证
    const content = fs.readFileSync(planPath, 'utf-8');
    expect(content).toContain('demo-api');
    expect(content).toContain('Python');
    expect(content).toContain('app.py');
    expect(content).toContain('## Decisions');
    expect(content).toContain('## Risks');
    expect(content).toContain('glibc');
  });

  it('Step 3a: build_docker_image 缺 plan_path → plan_not_found（契约强制）', async () => {
    const result: any = await executeTool('build_docker_image', {
      source_dir: projectDir,
      image_name: 'demo-api',
      // 故意不传 plan_path
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('plan_not_found');
  });

  it('Step 3b: build_docker_image 带 plan_path → 通过 plan 校验进入能力层', async () => {
    const result: any = await executeTool('build_docker_image', {
      source_dir: projectDir,
      plan_path: planPath,
      image_name: 'demo-api',
      tags: ['1.0.0', 'latest'],
    });

    // plan_path 校验通过（不是 plan_not_found）
    expect(result.error?.code).not.toBe('plan_not_found');
    // 无 docker 环境 → daemon/build 错误，但这是能力层返回的结构化结果
    if (result.status === 'failed') {
      expect(['docker_daemon_unavailable', 'docker_build_failed']).toContain(result.error?.code);
    }
  });

  it('契约验证：决策依据在 plan→build 间一致传递', async () => {
    // plan 生成的 target_platform 应与 build 期望一致
    const planContent = fs.readFileSync(planPath, 'utf-8');
    expect(planContent).toContain('ubuntu-22.04');
    expect(planContent).toContain('linux/amd64');
  });
});

describe('M6 E2E: Plan-before-build 强制约束', () => {
  it('任何构建工具都必须先有 Forge.md', async () => {
    // 清空目录后直接调 build
    const emptyDir = path.join(tmpDir, 'no-plan-yet');
    fs.mkdirSync(emptyDir, { recursive: true });

    const result: any = await executeTool('build_docker_image', {
      source_dir: emptyDir,
      image_name: 'x',
    });

    expect(result.error?.code).toBe('plan_not_found');
    expect(result.next_actions?.some((a: string) => a.includes('generate_packaging_plan'))).toBe(true);
  });
});