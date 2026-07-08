/**
 * M4: build_docker_image 成功路径（mock docker 命令）
 * 验证成功时返回完整结构：decision_basis + result.json + artifacts
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 顶层 mock：替换 command 工具，让 build-docker-image 走成功路径
vi.mock('../../../src/capabilities/utils/command.js', () => ({
  commandExists: () => true,
  runCommand: (_cmd: string, args: string[]) => {
    if (args[0] === 'version') return { success: true, exitCode: 0, stdout: '24.0.0\n', stderr: '' };
    if (args[0] === 'image' && args[1] === 'inspect')
      return { success: true, exitCode: 0, stdout: '12345678\n', stderr: '' };
    return { success: true, exitCode: 0, stdout: 'build ok\n', stderr: '' };
  },
  runCommandWithLog: () => ({
    success: true,
    exitCode: 0,
    stdout: 'build ok',
    stderr: '',
    logPath: '/tmp/build.log',
  }),
  snippet: (t: string) => t,
}));

// mock 之后导入
import { buildDockerImage } from '../../../src/capabilities/build-docker-image.js';

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgekit-build-mock-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('M4: build_docker_image 成功路径结构', () => {
  it('返回 decision_basis + result.json + artifacts', async () => {
    const dir = path.join(tmpDir, 'success');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'app.py'), '');
    fs.writeFileSync(path.join(dir, 'Dockerfile'), 'FROM python:3.10-slim\n');
    const planPath = path.join(dir, 'Forge.md');
    fs.writeFileSync(planPath, '# plan');

    const result = await buildDockerImage({
      source_dir: dir,
      plan_path: planPath,
      image_name: 'demo',
      tags: ['1.0.0', 'latest'],
    });

    expect(result.status).toBe('success');
    expect(result.image_ref).toBe('demo:1.0.0');
    expect(result.size_bytes).toBe(12345678);

    // decision_basis
    expect(result.decision_basis?.target_platform).toBe('linux/amd64');
    expect(result.decision_basis?.build_method).toContain('docker build');
    expect(result.decision_basis?.compatibility_notes?.length).toBeGreaterThan(0);

    // result.json
    expect(result.result_json?.exit_code).toBe(0);
    expect(result.result_json?.state_delta?.image_refs).toEqual(['demo:1.0.0', 'demo:latest']);
    expect(result.result_json?.state_delta?.daemon_version).toBe('24.0.0');

    // artifacts
    expect(result.artifacts?.[0].type).toBe('docker-image');
    expect(result.artifacts?.[0].path).toBe('demo:1.0.0');
    expect(result.artifacts?.[0].size_bytes).toBe(12345678);

    // logs
    expect(result.logs?.summary).toContain('构建成功');
    expect(result.logs?.full_available).toBe(true);
  });
});
