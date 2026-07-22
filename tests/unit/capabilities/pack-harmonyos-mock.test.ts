/**
 * M6: pack_harmonyos_app（mock hvigorw + command）
 * 验证：工程识别、工具链、合规预检（store_ready）、以及成功产出 .app + 合规报告。
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

vi.mock('../../../src/capabilities/utils/command.js', () => ({
  commandExists: (cmd: string) => cmd === 'node' || cmd === 'ohpm' || cmd === 'hvigorw',
  runCommand: () => ({ success: true, exitCode: 0, stdout: '', stderr: '' }),
  runCommandWithLog: (_cmd: string, args: string[], options?: { cwd?: string }) => {
    // 模拟真实目录：APP 在根 build，HAP 在模块 entry/build。
    const task = args[args.length - 1];
    if (task === 'assembleApp' || task === 'assembleHap') {
      try {
        const projectDir = options?.cwd ?? process.cwd();
        const buildDir = task === 'assembleHap' ? path.join(projectDir, 'entry') : projectDir;
        const outDir = task === 'assembleHap'
          ? path.join(buildDir, 'build', 'default', 'outputs', 'default')
          : path.join(buildDir, 'build', 'outputs', 'default');
        fs.mkdirSync(outDir, { recursive: true });
        const artifactName = task === 'assembleApp' ? 'demo.app' : 'demo-debug.hap';
        fs.writeFileSync(path.join(outDir, artifactName), 'fake harmony artifact');
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
    { "name": "release", "material": { "certpath": "release.cer", "storeFile": "release.p12", "profile": "release.p7b", "storePassword": "test-store-password", "keyAlias": "release-key", "keyPassword": "test-key-password" } }
  ],`
    : '';
  fs.writeFileSync(
    path.join(dir, 'build-profile.json5'),
    `{ "app": {${signing} "products": [ { "name": "default", "compatibleSdkVersion": 12 } ] }, "modules": [ { "name": "entry", "srcPath": "./entry" } ] }`
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

  it('缺少 build-profile.json5 返回 harmony_project_not_found', async () => {
    const dir = path.join(tmpDir, 'missing-build-profile');
    fs.mkdirSync(path.join(dir, 'AppScope'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'AppScope', 'app.json5'), '{ app: { bundleName: "com.example.demo" } }');
    fs.writeFileSync(path.join(dir, 'Forge.md'), '# plan');
    const result = await packHarmonyOS({
      source_dir: dir,
      plan_path: path.join(dir, 'Forge.md'),
      build_target: 'hap',
    });
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('harmony_project_not_found');
  });

  it('拒绝 source_dir 外的 plan_path', async () => {
    const dir = makeHarmonyProject('outside-plan', false);
    const outsidePlan = path.join(tmpDir, 'outside-Forge.md');
    fs.writeFileSync(outsidePlan, '# outside plan');
    const result = await packHarmonyOS({
      source_dir: dir,
      plan_path: outsidePlan,
      build_target: 'hap',
    });
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('path_out_of_bounds');
  });

  it('拒绝指向普通文件的 plan_path 符号链接', async () => {
    const dir = makeHarmonyProject('symlink-plan', false);
    const realPlan = path.join(dir, 'real-Forge.md');
    const linkedPlan = path.join(dir, 'Forge.md');
    fs.writeFileSync(realPlan, '# plan');
    fs.symlinkSync(realPlan, linkedPlan);
    const result = await packHarmonyOS({
      source_dir: dir,
      plan_path: linkedPlan,
      build_target: 'hap',
    });
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('plan_invalid');
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

  it('调试 HAP 可从模块 build/outputs 中发现产物', async () => {
    const dir = makeHarmonyProject('module-hap-output', false);
    fs.writeFileSync(path.join(dir, 'Forge.md'), '# plan');
    const result = await packHarmonyOS({
      source_dir: dir,
      plan_path: path.join(dir, 'Forge.md'),
      build_target: 'hap',
      api_version: '12',
    });
    expect(result.status).toBe('success');
    expect(result.artifact_path).toContain(path.join('entry', 'build', 'default', 'outputs'));
    expect(result.artifact_path).toContain('demo-debug.hap');
    expect(result.artifacts?.[0].type).toBe('hap');
    const manifest = JSON.parse(
      fs.readFileSync(path.join(dir, 'release-manifest.json'), 'utf8')
    ) as { source: { project_type: string; language_version?: string }; build: { build_duration_ms: number } };
    expect(manifest.source.project_type).toBe('ArkTS');
    expect(manifest.source.language_version).toBe('HarmonyOS API 12');
    expect(manifest.build.build_duration_ms).toBeGreaterThan(0);
  });

  it('存在多个 HAP 时选择最新产物且不排除 debug 文件名', async () => {
    const dir = makeHarmonyProject('newest-debug-hap', false);
    fs.writeFileSync(path.join(dir, 'Forge.md'), '# plan');
    const oldOutput = path.join(dir, 'entry', 'build', 'old', 'outputs');
    fs.mkdirSync(oldOutput, { recursive: true });
    const oldArtifact = path.join(oldOutput, 'old-release.hap');
    fs.writeFileSync(oldArtifact, 'old');
    fs.utimesSync(oldArtifact, new Date(0), new Date(0));

    const result = await packHarmonyOS({
      source_dir: dir,
      plan_path: path.join(dir, 'Forge.md'),
      build_target: 'hap',
    });
    expect(result.status).toBe('success');
    expect(result.artifact_path).toContain('demo-debug.hap');
  });

  it('不跟随模块 build 目录符号链接采集外部产物', async () => {
    const dir = makeHarmonyProject('symlink-build-output', false);
    fs.writeFileSync(path.join(dir, 'Forge.md'), '# plan');
    fs.mkdirSync(path.join(dir, 'entry'), { recursive: true });
    const outsideBuild = path.join(tmpDir, 'outside-build-output');
    fs.mkdirSync(outsideBuild, { recursive: true });
    fs.symlinkSync(outsideBuild, path.join(dir, 'entry', 'build'));

    const result = await packHarmonyOS({
      source_dir: dir,
      plan_path: path.join(dir, 'Forge.md'),
      build_target: 'hap',
    });
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('harmony_build_failed');
  });

  it('从 build-profile.json5 自动读取带版本名称的 API', async () => {
    const dir = makeHarmonyProject('profile-api-version', false);
    fs.writeFileSync(path.join(dir, 'Forge.md'), '# plan');
    fs.writeFileSync(
      path.join(dir, 'AppScope', 'app.json5'),
      '{ app: { bundleName: "com.example.demo" } }'
    );
    fs.writeFileSync(
      path.join(dir, 'build-profile.json5'),
      '{ app: { products: [{ compatibleSdkVersion: "5.0.5(17)", }] }, modules: [{ name: "entry", srcPath: "./entry" }] }'
    );
    const result = await packHarmonyOS({
      source_dir: dir,
      plan_path: path.join(dir, 'Forge.md'),
      build_target: 'hap',
    });
    expect(result.status).toBe('success');
    expect(result.decision_basis?.target_version).toBe('API 17');
    expect(result.compliance?.checks).toContain('compatibleSdkVersion[17]：在支持范围(9-24)');
  });

  it('显式 API 与工程配置不一致时在构建前拒绝', async () => {
    const dir = makeHarmonyProject('api-mismatch', false);
    fs.writeFileSync(path.join(dir, 'Forge.md'), '# plan');
    const result = await packHarmonyOS({
      source_dir: dir,
      plan_path: path.join(dir, 'Forge.md'),
      build_target: 'hap',
      api_version: '17',
    });
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('harmony_compatible_version_mismatch');
    expect(result.compliance?.checks.some((check) => check.includes('不一致'))).toBe(true);
  });

  it('显式 signing_config_path 不存在时不静默回退', async () => {
    const dir = makeHarmonyProject('missing-explicit-signing', false);
    fs.writeFileSync(path.join(dir, 'Forge.md'), '# plan');
    const result = await packHarmonyOS({
      source_dir: dir,
      plan_path: path.join(dir, 'Forge.md'),
      build_target: 'app',
      signing_config_path: path.join(dir, 'missing-signing.json5'),
    });
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('harmony_signing_invalid');
    expect(result.error?.summary).toContain('显式签名配置不存在');
  });

  it('签名材料路径相对于显式配置文件目录解析', async () => {
    const dir = makeHarmonyProject('relative-signing-materials', false);
    const signingDir = path.join(dir, 'signing');
    fs.mkdirSync(signingDir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'Forge.md'), '# plan');
    fs.writeFileSync(path.join(signingDir, 'release.cer'), 'cer');
    fs.writeFileSync(path.join(signingDir, 'release.p12'), 'p12');
    fs.writeFileSync(path.join(signingDir, 'release.p7b'), 'p7b');
    const configPath = path.join(signingDir, 'signing-config.json5');
    fs.writeFileSync(
      configPath,
      '{ name: "release", material: { certpath: "release.cer", storeFile: "release.p12", profile: "release.p7b", storePassword: "test-store-password", keyAlias: "release-key", keyPassword: "test-key-password" } }'
    );
    const result = await packHarmonyOS({
      source_dir: dir,
      plan_path: path.join(dir, 'Forge.md'),
      build_target: 'app',
      signing_config_path: configPath,
    });
    expect(result.status).toBe('success');
    expect(result.compliance?.store_ready).toBe(true);
  });

  it('签名文件存在但凭据字段缺失时拒绝发布构建', async () => {
    const dir = makeHarmonyProject('missing-signing-credentials', false);
    fs.writeFileSync(path.join(dir, 'Forge.md'), '# plan');
    for (const file of ['release.cer', 'release.p12', 'release.p7b']) {
      fs.writeFileSync(path.join(dir, file), file);
    }
    fs.writeFileSync(
      path.join(dir, 'signing-config.json'),
      '{ "name": "release", "material": { "certpath": "release.cer", "storeFile": "release.p12", "profile": "release.p7b" } }'
    );

    const result = await packHarmonyOS({
      source_dir: dir,
      plan_path: path.join(dir, 'Forge.md'),
      build_target: 'app',
      signing_config_path: path.join(dir, 'signing-config.json'),
    });
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('harmony_signing_invalid');
    expect(result.compliance?.checks.some((check) => check.includes('storePassword'))).toBe(true);
    expect(result.compliance?.checks.some((check) => check.includes('keyAlias'))).toBe(true);
    expect(result.compliance?.checks.some((check) => check.includes('keyPassword'))).toBe(true);
  });
});
