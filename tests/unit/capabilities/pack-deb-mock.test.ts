/**
 * M5: pack_deb 成功路径（mock dpkg-deb + command）
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

vi.mock('../../../src/capabilities/utils/command.js', () => ({
  commandExists: () => true,
  runCommand: () => ({ success: true, exitCode: 0, stdout: '', stderr: '' }),
  runCommandWithLog: (_cmd: string, args: string[]) => {
    // dpkg-deb --build <src> <out>，模拟创建输出文件
    const outPath = args[args.length - 1];
    try {
      const fs = require('fs');
      fs.mkdirSync(require('path').dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, 'fake deb content');
    } catch {
      // ignore
    }
    return {
      success: true,
      exitCode: 0,
      stdout: 'building package',
      stderr: '',
      logPath: '/tmp/deb.log',
    };
  },
  snippet: (t: string) => t,
}));

vi.mock('../../../src/capabilities/utils/checksum.js', () => ({
  sha256File: () => 'abc123fakechecksum',
}));

import { packDeb } from '../../../src/capabilities/pack-deb.js';

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgekit-deb-mock-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('M5: pack_deb 成功路径结构', () => {
  it('返回 decision_basis + artifact_path + checksum', async () => {
    const dir = path.join(tmpDir, 'py-pkg');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'app.py'), 'from flask import Flask');
    fs.writeFileSync(path.join(dir, 'requirements.txt'), 'flask==2.3.0\n');
    const planPath = path.join(dir, 'Forge.md');
    fs.writeFileSync(planPath, '# plan');

    const result = await packDeb({
      source_dir: dir,
      plan_path: planPath,
      version: '1.0.0',
      distro: 'ubuntu-22.04',
      arch: 'x86_64',
    });

    expect(result.status).toBe('success');
    expect(result.artifact_path).toContain('_1.0.0_amd64.deb');
    expect(result.checksum).toBe('abc123fakechecksum');

    // decision_basis
    expect(result.decision_basis?.target_platform).toBe('ubuntu-22.04/x86_64');
    expect(result.decision_basis?.build_method).toContain('dpkg-deb');
    expect(result.decision_basis?.compatibility_notes?.length).toBeGreaterThan(0);

    // artifacts
    expect(result.artifacts?.[0].type).toBe('deb-package');
    expect(result.artifacts?.[0].checksum).toBe('abc123fakechecksum');

    // logs
    expect(result.logs?.summary).toContain('构建成功');
  });

  it('control 文件正确生成', async () => {
    const dir = path.join(tmpDir, 'control-check');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'app.py'), '');
    fs.writeFileSync(path.join(dir, 'requirements.txt'), '');
    const planPath = path.join(dir, 'Forge.md');
    fs.writeFileSync(planPath, '# plan');

    await packDeb({ source_dir: dir, plan_path: planPath, version: '2.1.3' });

    const controlPath = path.join(
      dir,
      'dist',
      'forgekit',
      'deb',
      'control-check_2.1.3_amd64',
      'DEBIAN',
      'control'
    );
    expect(fs.existsSync(controlPath)).toBe(true);
    const control = fs.readFileSync(controlPath, 'utf-8');
    expect(control).toContain('Package: control-check');
    expect(control).toContain('Version: 2.1.3');
    expect(control).toContain('Architecture: amd64');
    expect(control).toContain('Depends: python3');
  });
});
