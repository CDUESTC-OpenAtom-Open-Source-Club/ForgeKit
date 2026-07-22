/**
 * 鸿蒙（HarmonyOS）适配器与计划生成集成测试
 * 验证：adapter-loader 能解析 harmonyos 目标并加载决策规则；
 * generate_packaging_plan 对鸿蒙工程产出 mobile 类型 Forge.md（含上架下一步）。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { resolveSystemAdapterId, loadSystemAdapter } from '../../../src/systems/adapter-loader.js';
import { generatePackagingPlan } from '../../../src/capabilities/generate-packaging-plan.js';

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgekit-harmony-plan-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('HarmonyOS adapter', () => {
  it('resolveSystemAdapterId 解析 harmonyos 目标', () => {
    expect(resolveSystemAdapterId('harmonyos')).toBe('mobile/harmonyos');
    expect(resolveSystemAdapterId('harmonyos-12')).toBe('mobile/harmonyos');
    expect(resolveSystemAdapterId('鸿蒙')).toBe('mobile/harmonyos');
    expect(resolveSystemAdapterId('ubuntu-22.04')).toBe('servers/ubuntu');
  });

  it('loadSystemAdapter 加载鸿蒙决策规则', () => {
    const adapter = loadSystemAdapter('mobile/harmonyos');
    expect(adapter).not.toBeNull();
    expect(adapter?.rules.平台).toBe('harmonyos');
    expect(adapter?.rules.风险提示?.length).toBeGreaterThan(0);
  });

  it('鸿蒙工程自动识别并产出 mobile 类型 Forge.md', async () => {
    const dir = path.join(tmpDir, 'harmony-app');
    fs.mkdirSync(path.join(dir, 'AppScope'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'AppScope', 'app.json5'),
      JSON.stringify({ app: { bundleName: 'com.example.demo', apiVersion: { compatibleSdkVersion: 12 } } })
    );
    fs.writeFileSync(path.join(dir, 'oh-package.json5'), '{}');

    const result = await generatePackagingPlan(dir, ['app']);
    expect(result.status).toBe('success');
    expect(result.plan_path).toBe(path.join(dir, 'Forge.md'));

    const forge = fs.readFileSync(result.plan_path!, 'utf-8');
    expect(forge).toContain('Type: mobile');
    expect(forge).toContain('pack_harmonyos_app');
    expect(forge).toContain('AppGallery');
    expect(result.decision_basis?.target_platform).toBe('harmonyos/12');
  });
});
