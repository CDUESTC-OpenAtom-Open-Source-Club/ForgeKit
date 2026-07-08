/**
 * M5: pack_deb 真实行为测试（dpkg-deb 在 macOS 不可用，测降级路径）
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { packDeb } from '../../../src/capabilities/pack-deb.js';

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgekit-deb-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('M5: pack_deb 校验路径', () => {
  it('源目录不存在返回 path_not_found', async () => {
    const result = await packDeb({
      source_dir: '/nonexistent/xyz',
      plan_path: '/tmp/Forge.md',
      version: '1.0.0',
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('path_not_found');
  });

  it('plan_path 不存在返回 plan_not_found', async () => {
    const dir = path.join(tmpDir, 'no-plan');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'app.py'), '');

    const result = await packDeb({
      source_dir: dir,
      plan_path: path.join(dir, 'no.md'),
      version: '1.0.0',
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('plan_not_found');
  });

  it('非 Python 项目返回 language_not_supported', async () => {
    const dir = path.join(tmpDir, 'non-python');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'README.md'), 'hello');
    const planPath = path.join(dir, 'Forge.md');
    fs.writeFileSync(planPath, '# plan');

    const result = await packDeb({
      source_dir: dir,
      plan_path: planPath,
      version: '1.0.0',
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('language_not_supported');
  });
});

describe('M5: dpkg-deb 不可用降级', () => {
  it('非 Debian 系统返回 dpkg_unavailable', async () => {
    const dir = path.join(tmpDir, 'python-deb');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'app.py'), '');
    fs.writeFileSync(path.join(dir, 'requirements.txt'), 'flask==2.3.0\n');
    const planPath = path.join(dir, 'Forge.md');
    fs.writeFileSync(planPath, '# plan');

    const result = await packDeb({
      source_dir: dir,
      plan_path: planPath,
      version: '1.0.0',
    });

    // macOS 无 dpkg-deb → 应返回 dpkg_unavailable
    expect(result.status).toBe('failed');
    expect(['dpkg_unavailable', 'deb_build_failed']).toContain(result.error?.code);
    expect(result.error?.suggested_fix).toBeTruthy();
  });
});
