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
  assertWithinRoot,
  PathValidationError,
  pathExists,
  readTextFile,
} from './utils/filesystem.js';
import { runCommandWithLog, commandExists } from './utils/command.js';
import { sha256File } from './utils/checksum.js';
import { parseJson5 } from './utils/json5.js';
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
  try {
    assertWithinRoot(plan_path, source_dir);
    const planStat = fs.lstatSync(plan_path);
    if (!planStat.isFile() || planStat.isSymbolicLink()) {
      return failed('plan_invalid', `Forge.md 不是普通文件: ${plan_path}`, '重新生成项目内的 Forge.md');
    }
  } catch (error) {
    if (error instanceof PathValidationError) {
      return failed(error.code, error.message, 'plan_path 必须指向 source_dir 内的普通文件');
    }
    throw error;
  }

  if (signing_config_path && !pathExists(signing_config_path)) {
    return failed(
      'harmony_signing_invalid',
      `显式签名配置不存在: ${signing_config_path}`,
      '修正 signing_config_path，或删除该参数以使用工程 build-profile.json5'
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

  // 任意目标的 bundle/API 错误，以及 APP 的签名错误，都在构建前返回。
  if (!compliance.store_ready) {
    return {
      status: 'failed',
      error: {
        code: compliance.blocking_code ?? 'harmony_signing_invalid',
        summary: build_target === 'app'
          ? '发布构建未通过合规预检，无法产出可上架 APP'
          : '调试构建未通过项目预检，无法产出可安装 HAP',
        suggested_fix: compliance.next_actions[0] ?? '补全正式签名与 Profile 后重试',
      },
      decision_basis: {
        target_platform: `harmonyos/${device_type}`,
        build_method: build_target === 'app'
          ? 'hvigorw assembleApp（发布，需正式签名）'
          : 'hvigorw assembleHap（调试）',
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
  const buildStartedAt = Date.now();
  const buildResult = runCommandWithLog(hvigorw, [task], {
    cwd: source_dir,
    timeout: 600000,
    logDir: path.join(source_dir, '.forgekit', 'logs'),
    logFileName: `pack-harmonyos-${task}-${Date.now()}.log`,
  });
  const buildDurationMs = Math.max(1, Date.now() - buildStartedAt);

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
      `构建成功但未在工程或模块的 build 目录找到 *.${build_target} 产物`,
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
    buildDurationMs,
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
      target_version: `API ${projectInfo.compatibleSdkVersion ?? parseHarmonyApiVersion(api_version) ?? 'unknown'}`,
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
  if (!pathExists(appJsonPath) || !pathExists(buildProfilePath)) {
    return null;
  }
  const info: HarmonyOSProjectInfo = { appJsonPath, buildProfilePath };
  const appJson = parseJson5(readTextFile(appJsonPath));
  const app = getRecord(appJson, 'app');
  if (app) {
    info.bundleName = getString(app, 'bundleName');
    const compatibleSdkVersion = getValue(getRecord(app, 'apiVersion'), 'compatibleSdkVersion');
    info.compatibleSdkVersion = parseHarmonyApiVersion(compatibleSdkVersion);
  }
  if (!info.compatibleSdkVersion && info.buildProfilePath) {
    const profile = parseJson5(readTextFile(info.buildProfilePath));
    const products = getValue(getRecord(profile, 'app'), 'products');
    if (Array.isArray(products)) {
      for (const product of products) {
        const compatibleSdkVersion = getValue(asRecord(product), 'compatibleSdkVersion');
        const api = parseHarmonyApiVersion(compatibleSdkVersion);
        if (api) {
          info.compatibleSdkVersion = api;
          break;
        }
      }
    }
  }
  return info;
}

function parseHarmonyApiVersion(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isInteger(value)) {return String(value);}
  if (typeof value !== 'string') {return undefined;}
  const parenthesized = value.match(/\((\d{1,2})\)\s*$/);
  if (parenthesized) {return parenthesized[1];}
  return /^\d{1,2}$/.test(value.trim()) ? value.trim() : undefined;
}

function checkToolchain(sourceDir: string): { ok: boolean; reason: string } {
  if (!commandExists('node')) {
    return { ok: false, reason: 'node 命令不可用（需 >=18 LTS）' };
  }
  const nodeMajor = Number.parseInt(process.versions.node.split('.')[0], 10);
  if (!Number.isInteger(nodeMajor) || nodeMajor < 18) {
    return { ok: false, reason: `Node.js ${process.versions.node} 不受支持（需 >=18）` };
  }
  if (!commandExists('ohpm')) {
    return { ok: false, reason: 'ohpm 不可用：请安装 HarmonyOS Command Line Tools 并将 bin 加入 PATH' };
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

  // API 版本：api_version 是期望值，不会改写工程；与工程配置不一致时拒绝。
  const requestedApi = parseHarmonyApiVersion(ctx.api_version);
  const configuredApi = ctx.projectInfo.compatibleSdkVersion;
  const api = configuredApi ?? requestedApi;
  const apiNum = api ? parseInt(api, 10) : NaN;
  const apiOk = !Number.isNaN(apiNum) && apiNum >= 9 && apiNum <= 24;
  checks.push(`compatibleSdkVersion[${api ?? '缺失'}]：${apiOk ? '在支持范围(9-24)' : '超出支持范围或不合法'}`);
  if (!apiOk) {
    storeReady = false;
    blockingCode ??= 'harmony_compatible_version_mismatch';
    nextActions.push('在 build-profile.json5 / app.json5 设置 compatibleSdkVersion 为 9-24 之间（当前基线推荐 17）');
  }
  if (ctx.api_version && !requestedApi) {
    storeReady = false;
    blockingCode ??= 'harmony_compatible_version_mismatch';
    checks.push(`请求 API[${ctx.api_version}]：格式不合法`);
    nextActions.push('api_version 使用纯数字或 DevEco 版本格式，例如 17 或 5.0.5(17)');
  } else if (requestedApi && configuredApi && requestedApi !== configuredApi) {
    storeReady = false;
    blockingCode ??= 'harmony_compatible_version_mismatch';
    checks.push(`请求 API[${requestedApi}] 与工程 compatibleSdkVersion[${configuredApi}] 不一致`);
    nextActions.push('先修改 build-profile.json5 的 compatibleSdkVersion，再使用相同 api_version 重试');
  }

  // 发布态：正式签名 + Profile
  if (ctx.build_target === 'app') {
    const signing = loadSigningConfig(ctx.source_dir, ctx.signing_config_path);
    if (!signing.found) {
      storeReady = false;
      blockingCode ??= 'harmony_signing_invalid';
      checks.push('release 签名：未找到被产品引用或名为 release 的 signingConfig');
      nextActions.push('在 AGC 生成 CSR → 签发正式 .cer → 创建发布 .p7b → 配置 build-profile.json5 signingConfigs');
    } else {
      checks.push(`release 签名：已配置 signingConfig "${signing.name}"`);
      // 校验正式签名材料齐全（.cer + .p12 + .p7b）
      const missing = signing.missingMaterials ?? [];
      if (missing.length > 0) {
        storeReady = false;
        blockingCode ??= missing.includes('profile') ? 'harmony_profile_missing' : 'harmony_signing_invalid';
        checks.push(`release 签名材料缺失：${missing.join(', ')}`);
        nextActions.push('补齐签名材料与凭据字段（.cer/.p12/.p7b、storePassword、keyAlias、keyPassword）');
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
  const candidates = signingConfigPath
    ? [signingConfigPath]
    : [path.join(sourceDir, 'build-profile.json5'), path.join(sourceDir, 'signing-config.json')];

  for (const p of candidates) {
    if (!pathExists(p)) {continue;}
    const raw = readTextFile(p);
    if (!raw) {continue;}
    const json = parseJson5(raw);
    const app = getRecord(json, 'app');
    const appConfigs = getValue(app, 'signingConfigs');
    let cfg: Record<string, unknown> | undefined;
    if (Array.isArray(appConfigs) && appConfigs.length > 0) {
      const products = getValue(app, 'products');
      const referencedName = Array.isArray(products)
        ? products.map(asRecord).map((product) => product?.signingConfig)
          .find((name): name is string => typeof name === 'string')
        : undefined;
      cfg = appConfigs.map(asRecord).find((candidate) =>
        candidate?.name === referencedName || (!referencedName && candidate?.name === 'release')
      );
    } else if (getRecord(json, 'material')) {
      cfg = asRecord(json);
    }
    if (!cfg) {continue;}
    const mat = getRecord(cfg, 'material') ?? {};
    const missing: string[] = [];
    const configDir = path.dirname(path.resolve(p));
    if (!materialExists(configDir, getString(mat, 'certpath'))) {missing.push('cer');}
    if (!materialExists(configDir, getString(mat, 'storeFile'))) {missing.push('p12');}
    if (!materialExists(configDir, getString(mat, 'profile'))) {missing.push('profile');}
    if (!getString(mat, 'storePassword')) {missing.push('storePassword');}
    if (!getString(mat, 'keyAlias')) {missing.push('keyAlias');}
    if (!getString(mat, 'keyPassword')) {missing.push('keyPassword');}
    return { found: true, name: getString(cfg, 'name'), missingMaterials: missing };
  }
  return { found: false };
}

function materialExists(configDir: string, materialPath?: string): boolean {
  return Boolean(materialPath && pathExists(path.resolve(configDir, materialPath)));
}

function findArtifact(sourceDir: string, buildTarget: 'hap' | 'app'): string | null {
  const ext = buildTarget === 'app' ? '.app' : '.hap';
  const found: Array<{ path: string; modifiedAt: number }> = [];
  const buildDirs = [path.join(sourceDir, 'build')];
  const buildProfile = parseJson5(readTextFile(path.join(sourceDir, 'build-profile.json5')));
  const modules = getValue(getRecord(buildProfile, 'app'), 'modules')
    ?? getValue(asRecord(buildProfile), 'modules');
  if (Array.isArray(modules)) {
    for (const module of modules) {
      const srcPath = getString(asRecord(module) ?? {}, 'srcPath');
      if (srcPath) {
        const moduleBuildDir = path.resolve(sourceDir, srcPath, 'build');
        try {
          assertWithinRoot(moduleBuildDir, sourceDir);
          buildDirs.push(moduleBuildDir);
        } catch (error) {
          if (!(error instanceof PathValidationError)) {throw error;}
        }
      }
    }
  }
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) {continue;}
      if (stat.isDirectory()) {walk(full);}
      else if (entry.endsWith(ext)) {found.push({ path: full, modifiedAt: stat.mtimeMs });}
    }
  };
  for (const buildDir of buildDirs) {
    if (!pathExists(buildDir)) {continue;}
    try {
      const buildDirStat = fs.lstatSync(buildDir);
      if (!buildDirStat.isDirectory() || buildDirStat.isSymbolicLink()) {continue;}
      walk(buildDir);
    } catch {
      /* ignore unreadable output directories */
    }
  }
  found.sort((left, right) => right.modifiedAt - left.modifiedAt || left.path.localeCompare(right.path));
  return found[0]?.path ?? null;
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
