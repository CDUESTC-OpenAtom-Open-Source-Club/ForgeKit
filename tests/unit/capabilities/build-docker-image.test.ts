/**
 * M4: build_docker_image 单元测试（真实行为）
 * 测试环境 Docker 不可用，测试校验/降级/Dockerfile 自动生成路径
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { buildDockerImage } from '../../../src/capabilities/build-docker-image.js';

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgekit-build-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeProject(name: string, withDockerfile = false): { dir: string; planPath: string } {
  const dir = path.join(tmpDir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'app.py'), 'from flask import Flask');
  fs.writeFileSync(path.join(dir, 'requirements.txt'), 'flask==2.3.0\n');
  if (withDockerfile) {
    fs.writeFileSync(path.join(dir, 'Dockerfile'), 'FROM python:3.10-slim\nCMD ["python","app.py"]\n');
  }
  const planPath = path.join(dir, 'Forge.md');
  fs.writeFileSync(planPath, '# Forge Plan');
  return { dir, planPath };
}

describe('M4: build_docker_image 校验路径', () => {
  it('源目录不存在返回 path_not_found', async () => {
    const result = await buildDockerImage({
      source_dir: '/nonexistent/xyz',
      plan_path: '/tmp/Forge.md',
      image_name: 'test',
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('path_not_found');
  });

  it('plan_path 文件不存在返回 plan_not_found', async () => {
    const dir = path.join(tmpDir, 'no-plan');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'app.py'), '');

    const result = await buildDockerImage({
      source_dir: dir,
      plan_path: path.join(dir, 'nonexistent-Forge.md'),
      image_name: 'test',
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('plan_not_found');
  });
});

describe('M4: Dockerfile 自动生成', () => {
  it('Python 项目无 Dockerfile 时自动生成', async () => {
    const { dir, planPath } = makeProject('autogen-python', false);
    expect(fs.existsSync(path.join(dir, 'Dockerfile'))).toBe(false);

    await buildDockerImage({
      source_dir: dir,
      plan_path: planPath,
      image_name: 'test',
    });

    // Dockerfile 应被生成（在 daemon 检查前）
    expect(fs.existsSync(path.join(dir, 'Dockerfile'))).toBe(true);
    const content = fs.readFileSync(path.join(dir, 'Dockerfile'), 'utf-8');
    expect(content).toContain('python:3.10-slim');
    expect(content).toContain('requirements.txt');
  });

  it('无法识别语言且无 Dockerfile 时返回 dockerfile_not_found', async () => {
    const dir = path.join(tmpDir, 'unknown-lang');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'random.txt'), 'hello');
    const planPath = path.join(dir, 'Forge.md');
    fs.writeFileSync(planPath, '# plan');

    const result = await buildDockerImage({
      source_dir: dir,
      plan_path: planPath,
      image_name: 'test',
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('dockerfile_not_found');
  });
});

describe('M4: Docker 构建行为', () => {
  it('docker 可用时尝试构建（成功或失败取决于环境）', async () => {
    const { dir, planPath } = makeProject('docker-test', true);

    const result = await buildDockerImage({
      source_dir: dir,
      plan_path: planPath,
      image_name: 'test',
    });

    // 两种可能：
    // 1. Docker 可用 → 构建成功或 docker_build_failed（网络/镜像问题）
    // 2. Docker 不可用 → docker_daemon_unavailable
    if (result.status === 'failed') {
      expect(['docker_daemon_unavailable', 'docker_build_failed', 'dockerfile_not_found']).toContain(result.error?.code);
      expect(result.error?.suggested_fix).toBeTruthy();
    } else {
      // Docker 可用且构建成功
      expect(result.status).toBe('success');
    }
  });
});
