/**
 * pack_harmonyos_app - 鸿蒙（HarmonyOS NEXT）应用打包能力
 *
 * 流程：校验 plan_path → 识别鸿蒙工程 → 校验工具链 → 合规预检（bundleName/API/正式签名）
 *      → hvigorw assembleApp|assembleHap → 失败结构化诊断 → 成功产物 + 合规报告
 *
 * 合规目标：确保打出的包"合法、且达到可上架 AppGallery 标准"，并给出下一步提示。
 * 符合 ForgeKit 多端框架 mobile/harmonyos 设计。
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import {
  assertSourceDir,
  PathValidationError,
  pathExists,
  readTextFile,
} from './utils/filesystem.js';
import { runCommandWithLog, commandExists } from './utils/command.js';
import { sha256File } from './utils/checksum.js';
import { diagnoseBuildError, type ErrorDiagnostic } from './utils/error-diagnostic.js';
import { generateReleaseManifest, saveReleaseManifest } from './manifest-generator.js';
import type { ErrorCode, PackHarmonyOSOutput } from './types.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export interface PackHarmonyOSInput {
  source_dir: string;
  plan_path: string; // 必需（Plan-before-build 强制）
  build_target?: 'hap' | 'app'; // 默认 app（上架）
  device_type?: 'phone' | 'tablet' | '2in1' | 'wearable' | 'tv' | 'car';
  api_version?: string;
  signing_config_path?: string; // 正式签名配置路径（默认读工程 build-profile.json5）
}

interface ComplianceReport {
  store_ready: boolean;
  checks: string[];
  next_actions: string[];
  blocking_code?: ErrorCode;
}

export async function packHarmonyOS(input: PackHarmonyOSInput): Promise<PackHarmonyOSOutput> {
  const {
    source_dir,
    plan_path,
    build_target = 'app',
    device_type = 'phone',
    api_version,
    signing_config_path,
  } = input;

  // 1. 校验 source_dir
  try {
    assertSourceDir(source_dir);
  } catch (e) {
    if (e instanceof PathValidationError) {
      return failed(e.code, e.message, '请提供有效的项目根目录路径');
    }
    throw e;
  }

  // 2. 校验 plan_path（构建类强制）
  if (!pathExists(plan_path)) {
    return failed(
      'plan_not_found',
      `Forge.md 不存在: ${plan_path}`,
      '先调用 generate_packaging_plan 生成 Forge.md'
    );
  }

  // 3. 识别鸿蒙工程
  const projectInfo = detectHarmonyOSProject(source_dir);
  if (!projectInfo) {
    return failed(
      'harmony_project_not_found',
      '未识别到鸿蒙工程（缺少 AppScope/app.json5 或 build-profile.json5）',
      '请确认这是 HarmonyOS NEXT 工程；或用 DevEco 创建标准 Stage 模型工程'
    );
  }

  // 4. 校验工具链
  const toolchain = checkToolchain(source_dir);
  if (!toolchain.ok) {
    return failed(
      'harmony_sdk_not_found',
      toolchain.reason,
      '安装 DevEco Studio 或 HarmonyOS Command Line Tools，将 bin 加入 PATH，并执行 ohpm install'
    );
  }

  // 5. 合规预检（核心：确保合法且可上架）
  const compliance = runComplianceChecks({
    source_dir,
    build_target,
    api_version,
    signing_config_path,
    projectInfo,
  });

  // 若发布（app）且签名/Profile 不合规，先反馈，不浪费构建
  if (build_target === 'app' && !compliance.store_ready) {
    return {
      status: 'failed',
      error: {
        code: compliance.blocking_code ?? 'harmony_signing_invalid',
        summary: '发布构建未通过合规预检，无法产出可上架 APP',
        suggested_fix: compliance.next_actions[0] ?? '补全正式签名与 Profile 后重试',
      },
      decision_basis: {
        target_platform: `harmonyos/${device_type}`,
        build_method: 'hvigorw assembleApp（发布，需正式签名）',
        compatibility_notes: compliance.checks,
        risks_acknowledged: [
          '调试证书不可上架',
          '证书(.p12)丢失将无法更新已上架应用',
        ],
      },
      compliance,
      next_actions: compliance.next_actions,
    };
  }

  // 6. 构建
  const hvigorw = resolveHvigorw(source_dir);
  if (!hvigorw) {
    return failed(
      'harmony_sdk_not_found',
      'hvigorw 不可用',
      '安装 HarmonyOS Command Line Tools 并将 hvigorw 加入 PATH'
    );
  }
  const task = build_target === 'app' ? 'assembleApp' : 'assembleHap';
  const buildResult = runCommandWithLog(hvigorw, [task], {
    cwd: source_dir,
    timeout: 600000,
    logFileName: `pack-harmonyos-${task}-${Date.now()}.log`,
  });

  // 7. 失败处理（结构化诊断）
  if (!buildResult.success) {
    const diagnostic: ErrorDiagnostic | null = diagnoseBuildError(
      `HarmonyOS build failed: ${task}`,
      buildResult.stderr,
      buildResult.stdout
    );
    return failed(
      diagnostic?.code ?? 'harmony_build_failed',
      diagnostic?.summary ?? `hvigorw ${task} 失败（exit ${buildResult.exitCode}）`,
      diagnostic?.suggested_fix ?? '查看日志定位构建错误，常见：签名配置、API 版本、ohpm 依赖',
      buildResult.logPath,
      diagnostic ?? undefined
    );
  }

  // 8. 采集产物
  const artifactPath = findArtifact(source_dir, build_target);
  if (!artifactPath) {
    return failed(
      'harmony_build_failed',
      `构建成功但未在 build/outputs 找到 *.${build_target} 产物`,
      '确认产物输出路径，或检查 build-profile.json5 的 outputs 配置'
    );
  }
  const checksum = sha256File(artifactPath);

  // 9. 生成 Release Manifest
  const manifest = generateReleaseManifest({
    sourceDir: source_dir,
    planPath: plan_path,
    targetPlatform: `harmonyos/${device_type}`,
    targetArchitecture: 'arm64',
    decisions: compliance.checks,
    risksAcknowledged: ['调试证书不可上架', '证书丢失风险'],
    artifacts: [
      {
        type: build_target === 'app' ? 'app' : 'hap',
        name: path.basename(artifactPath),
        path: artifactPath,
        size_bytes: fs.statSync(artifactPath).size,
        checksum: { sha256: checksum },
      },
    ],
    buildDurationMs: 0,
  });
  saveReleaseManifest(manifest, source_dir);

  const finalCompliance: ComplianceReport = {
    store_ready: build_target === 'app',
    checks: compliance.checks,
    next_actions:
      build_target === 'app'
        ? [
            '在 AppGallery Connect 上传该 .app 并提交审核',
            '填写应用信息、截图、隐私政策与权限说明',
            '处理审核驳回意见后发布',
          ]
        : ['调试 HAP 可直接 hdc install 到已注册设备；上架请改用 build_target=app'],
  };

  return {
    status: 'success',
    artifacts: [
      {
        type: build_target === 'app' ? 'app' : 'hap',
        path: artifactPath,
        checksum,
      },
    ],
    logs: {
      path: buildResult.logPath,
      summary: `鸿蒙构建成功：${path.basename(artifactPath)}（exit 0）`,
      full_available: true,
    },
    decision_basis: {
      target_platform: `harmonyos/${device_type}`,
      target_version: `API ${projectInfo.compatibleSdkVersion ?? api_version ?? 'unknown'}`,
      build_method: `hvigorw ${task}`,
      compatibility_notes: compliance.checks,
      risks_acknowledged: ['调试证书不可上架', '证书丢失风险'],
    },
    artifact_path: artifactPath,
    checksum,
    compliance: finalCompliance,
    next_actions: finalCompliance.next_actions,
    build_log: buildResult.logPath,
  };
}

// ========== 辅助函数 ==========

interface HarmonyOSProjectInfo {
  bundleName?: string;
  compatibleSdkVersion?: string;
  appJsonPath: string;
  buildProfilePath?: string;
}

function detectHarmonyOSProject(sourceDir: string): HarmonyOSProjectInfo | null {
  const appJsonPath = path.join(sourceDir, 'AppScope', 'app.json5');
  const buildProfilePath = path.join(sourceDir, 'build-profile.json5');
  if (!pathExists(appJsonPath)) {
    return null;
  }
  const info: HarmonyOSProjectInfo = { appJsonPath, buildProfilePath: pathExists(buildProfilePath) ? buildProfilePath : undefined };
  const appJson = readJson5(readTextFile(appJsonPath));
  const app = getRecord(appJson, 'app');
  if (app) {
    info.bundleName = getString(app, 'bundleName');
    const compatibleSdkVersion = getValue(getRecord(app, 'apiVersion'), 'compatibleSdkVersion');
    info.compatibleSdkVersion = compatibleSdkVersion === undefined
      ? undefined
      : String(compatibleSdkVersion);
  }
  return info;
}

function checkToolchain(sourceDir: string): { ok: boolean; reason: string } {
  // node 18 LTS
  const nodeCheck = commandExists('node');
  if (!nodeCheck) {
    return { ok: false, reason: 'node 命令不可用（需 >=18 LTS）' };
  }
  // hvigorw（项目内脚本或 PATH）
  const hvigorw = resolveHvigorw(sourceDir);
  if (!hvigorw) {
    return { ok: false, reason: 'hvigorw 不可用：工程缺少 hvigorw 脚本且未在 PATH 找到 HarmonyOS Command Line Tools' };
  }
  return { ok: true, reason: '工具链可用' };
}

function resolveHvigorw(sourceDir: string): string | null {
  const candidates = [path.join(sourceDir, 'hvigorw'), path.join(sourceDir, 'hvigorw.bat')];
  for (const c of candidates) {
    if (pathExists(c)) {return c;}
  }
  // PATH 中的全局 hvigorw（Command Line Tools）
  if (commandExists('hvigorw')) {return 'hvigorw';}
  return null;
}

function runComplianceChecks(ctx: {
  source_dir: string;
  build_target: 'hap' | 'app';
  api_version?: string;
  signing_config_path?: string;
  projectInfo: HarmonyOSProjectInfo;
}): ComplianceReport {
  const checks: string[] = [];
  const nextActions: string[] = [];
  let storeReady = true;
  let blockingCode: ErrorCode | undefined;

  // bundleName 格式
  const bundleName = ctx.projectInfo.bundleName;
  const bundleOk = typeof bundleName === 'string' && /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/.test(bundleName);
  checks.push(`bundleName[${bundleName ?? '缺失'}]：${bundleOk ? '合法（反向域名）' : '不合法'}`);
  if (!bundleOk) {
    storeReady = false;
    blockingCode = 'harmony_bundle_name_invalid';
    nextActions.push('将 app.json5 的 bundleName 改为反向域名（如 com.example.app），并与 AGC 应用一致');
  }

  // API 版本
  const api = ctx.api_version ?? ctx.projectInfo.compatibleSdkVersion;
  const apiNum = api ? parseInt(api, 10) : NaN;
  const apiOk = !Number.isNaN(apiNum) && apiNum >= 9 && apiNum <= 13;
  checks.push(`compatibleSdkVersion[${api ?? '缺失'}]：${apiOk ? '在支持范围(9-13)' : '超出支持范围或不合法'}`);
  if (!apiOk) {
    storeReady = false;
    blockingCode = 'harmony_compatible_version_mismatch';
    nextActions.push('在 build-profile.json5 / app.json5 设置 compatibleSdkVersion 为 9-13 之间（推荐 12）');
  }

  // 发布态：正式签名 + Profile
  if (ctx.build_target === 'app') {
    const signing = loadSigningConfig(ctx.source_dir, ctx.signing_config_path);
    if (!signing.found) {
      storeReady = false;
      blockingCode = 'harmony_signing_invalid';
      checks.push('release 签名：未找到 signingConfigs（发布必须配置正式签名）');
      nextActions.push('在 AGC 生成 CSR → 签发正式 .cer → 创建发布 .p7b → 配置 build-profile.json5 signingConfigs');
    } else {
      checks.push(`release 签名：已配置 signingConfig "${signing.name}"`);
      // 校验正式签名材料齐全（.cer + .p12 + .p7b）
      const missing = signing.missingMaterials ?? [];
      if (missing.length > 0) {
        storeReady = false;
        blockingCode = missing.includes('profile') ? 'harmony_profile_missing' : 'harmony_signing_invalid';
        checks.push(`release 签名材料缺失：${missing.join(', ')}`);
        nextActions.push('补齐缺失的签名材料（.cer/.p12/.p7b），并确保路径正确');
      } else {
        checks.push('release 签名材料：.cer / .p12 / .p7b 齐全');
      }
    }
  } else {
    checks.push('调试态(HAP)：可使用 DevEco 自动生成的 debug 签名（不可上架）');
  }

  // 知识库合规基线（隐私/权限）提示
  const knowledge = loadHarmonyOSKnowledge();
  const knowledgeCompliance = getRecord(knowledge, 'compliance');
  if (knowledgeCompliance) {
    checks.push(`合规基线：${getBoolean(knowledgeCompliance, 'privacy_policy_required') ? '需隐私政策' : ''} / ${getBoolean(knowledgeCompliance, 'permission_justification_required') ? '需权限说明' : ''}`);
    nextActions.push('上架前确认隐私政策可访问、敏感权限已说明用途');
  }

  return { store_ready: storeReady, checks, next_actions: nextActions, blocking_code: blockingCode };
}

function loadSigningConfig(
  sourceDir: string,
  signingConfigPath?: string
): { found: boolean; name?: string; missingMaterials?: string[] } {
  const candidates = [
    signingConfigPath,
    path.join(sourceDir, 'build-profile.json5'),
    path.join(sourceDir, 'signing-config.json'),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    if (!pathExists(p)) {continue;}
    const raw = readTextFile(p);
    if (!raw) {continue;}
    const json = readJson5(raw);
    // 优先 build-profile.json5 的 app.signingConfigs[]；其次独立 signing-config.json（顶层 material）
    const appConfigs = getValue(getRecord(json, 'app'), 'signingConfigs');
    let cfg: Record<string, unknown> | undefined;
    if (Array.isArray(appConfigs) && appConfigs.length > 0) {
      cfg = asRecord(appConfigs[0]);
    } else if (getRecord(json, 'material')) {
      cfg = asRecord(json);
    }
    if (!cfg) {continue;}
    const mat = getRecord(cfg, 'material') ?? {};
    const missing: string[] = [];
    if (!pathExists(path.join(sourceDir, getString(mat, 'certpath') ?? 'release.cer'))) {missing.push('cer');}
    if (!pathExists(path.join(sourceDir, getString(mat, 'storeFile') ?? 'release.p12'))) {missing.push('p12');}
    if (!pathExists(path.join(sourceDir, getString(mat, 'profile') ?? 'release.p7b'))) {missing.push('profile');}
    return { found: true, name: getString(cfg, 'name'), missingMaterials: missing };
  }
  return { found: false };
}

function findArtifact(sourceDir: string, buildTarget: 'hap' | 'app'): string | null {
  const outputsDir = path.join(sourceDir, 'build', 'outputs');
  if (!pathExists(outputsDir)) {return null;}
  const ext = buildTarget === 'app' ? '.app' : '.hap';
  let found: string | null = null;
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {walk(full);}
      else if (entry.endsWith(ext) && !entry.includes('debug')) {found = full;}
    }
  };
  try {
    walk(outputsDir);
  } catch {
    /* ignore */
  }
  return found;
}

function loadHarmonyOSKnowledge(): unknown {
  const candidates = [
    path.resolve(currentDir, '../../src/knowledge/mobile/harmonyos-packaging.yaml'),
    path.resolve(process.cwd(), 'src/knowledge/mobile/harmonyos-packaging.yaml'),
    path.resolve(currentDir, '../knowledge/mobile/harmonyos-packaging.yaml'),
  ];
  for (const c of candidates) {
    const raw = readTextFile(c);
    if (raw) {
      try {
        return yaml.load(raw);
      } catch {
        continue;
      }
    }
  }
  return null;
}

/** 极简 JSON5 解析（容忍尾逗号与注释，仅用于工程配置文件） */
function readJson5(text: string | null): unknown {
  if (!text) {return null;}
  try {
    // 去掉 // 行注释与 /* */ 块注释，去掉尾逗号
    const cleaned = text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|\n)\s*\/\/.*(?=\n)/g, '')
      .replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function getValue(record: Record<string, unknown> | undefined, key: string): unknown {
  return record?.[key];
}

function getRecord(value: unknown, key: string): Record<string, unknown> | undefined {
  return asRecord(asRecord(value)?.[key]);
}

function getString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function getBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === 'boolean' ? value : undefined;
}

function failed(
  code: ErrorCode,
  summary: string,
  suggestedFix: string,
  detailLog?: string,
  diagnosis?: ErrorDiagnostic
): PackHarmonyOSOutput {
  const result: PackHarmonyOSOutput = {
    status: 'failed',
    error: { code, summary, detail_log: detailLog, suggested_fix: suggestedFix },
    diagnosis,
  };
  return result;
}
