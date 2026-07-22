/**
 * M6: pack_harmonyos_app（mock hvigorw + command）
 * 验证：工程识别、工具链、合规预检（store_ready）、以及成功产出 .app + 合规报告。
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

vi.mock('../../../src/capabilities/utils/command.js', () => ({
  commandExists: (cmd: string) => cmd === 'node' || cmd === 'hvigorw',
  runCommand: () => ({ success: true, exitCode: 0, stdout: '', stderr: '' }),
  runCommandWithLog: (_cmd: string, args: string[], options?: { cwd?: string }) => {
    // 模拟 hvigorw assembleApp 成功，并产出 .app 产物（写入 source_dir 的 build 目录）
    const task = args[args.length - 1];
    if (task === 'assembleApp' || task === 'assembleHap') {
      try {
        const outDir = path.join(options?.cwd ?? process.cwd(), 'build', 'outputs', 'default');
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, `demo.${task === 'assembleApp' ? 'app' : 'hap'}`), 'fake harmony artifact');
      } catch {
        /* ignore */
      }
    }
    return { success: true, exitCode: 0, stdout: 'BUILD SUCCESSFUL', stderr: '', logPath: '/tmp/harmony.log' };
  },
  snippet: (t: string) => t,
}));

vi.mock('../../../src/capabilities/utils/checksum.js', () => ({
  sha256File: () => 'abc123fakeharmonychecksum',
}));

import { packHarmonyOS } from '../../../src/capabilities/pack-harmonyos.js';

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgekit-harmony-mock-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeHarmonyProject(name: string, withSigning: boolean): string {
  const dir = path.join(tmpDir, name);
  fs.mkdirSync(path.join(dir, 'AppScope'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'AppScope', 'app.json5'),
    JSON.stringify({
      app: {
        bundleName: 'com.example.demo',
        vendor: 'example',
        versionCode: 1000000,
        versionName: '1.0.0',
        apiVersion: { compatibleSdkVersion: 12, targetSdkVersion: 12 },
      },
    })
  );
  const signing = withSigning
    ? `
  "signingConfigs": [
    { "name": "release", "material": { "certpath": "release.cer", "storeFile": "release.p12", "profile": "release.p7b" } }
  ],`
    : '';
  fs.writeFileSync(
    path.join(dir, 'build-profile.json5'),
    `{ "app": {${signing} "products": [ { "name": "default", "compatibleSdkVersion": 12 } ] } }`
  );
  if (withSigning) {
    fs.writeFileSync(path.join(dir, 'release.cer'), 'cer');
    fs.writeFileSync(path.join(dir, 'release.p12'), 'p12');
    fs.writeFileSync(path.join(dir, 'release.p7b'), 'p7b');
  }
  return dir;
}

describe('M6: pack_harmonyos_app 工程识别', () => {
  it('非鸿蒙工程返回 harmony_project_not_found', async () => {
    const dir = path.join(tmpDir, 'not-harmony');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'Forge.md'), '# plan');
    const result = await packHarmonyOS({ source_dir: dir, plan_path: path.join(dir, 'Forge.md'), build_target: 'app' });
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('harmony_project_not_found');
  });

  it('发布(app)缺少正式签名 → 合规预检不通过，store_ready=false', async () => {
    const dir = makeHarmonyProject('no-signing', false);
    fs.writeFileSync(path.join(dir, 'Forge.md'), '# plan');
    const result = await packHarmonyOS({ source_dir: dir, plan_path: path.join(dir, 'Forge.md'), build_target: 'app', api_version: '12' });
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('harmony_signing_invalid');
    expect(result.compliance?.store_ready).toBe(false);
    expect(result.compliance?.checks?.some((c) => c.includes('bundleName'))).toBe(true);
  });

  it('完整正式签名 + 工具链 → 成功产出 .app 与合规报告(store_ready=true)', async () => {
    const dir = makeHarmonyProject('signed', true);
    fs.writeFileSync(path.join(dir, 'Forge.md'), '# plan');
    const result = await packHarmonyOS({ source_dir: dir, plan_path: path.join(dir, 'Forge.md'), build_target: 'app', api_version: '12' });
    expect(result.status).toBe('success');
    expect(result.artifact_path).toContain('.app');
    expect(result.checksum).toBe('abc123fakeharmonychecksum');
    expect(result.compliance?.store_ready).toBe(true);
    expect(result.compliance?.next_actions?.some((a) => a.includes('AppGallery'))).toBe(true);
    expect(result.artifacts?.[0].type).toBe('app');
  });
});
