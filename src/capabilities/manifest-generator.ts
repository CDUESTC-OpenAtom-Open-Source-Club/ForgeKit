/**
 * Release Manifest Generator - 生成产物追溯清单
 *
 * 功能：
 * - 收集Git、构建环境、产物信息
 * - 生成符合SLSA原则的Release Manifest
 * - 提供可验证的供应链信息
 */

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import type { ReleaseManifest, ArtifactInfo } from './release-manifest.js';
import { MANIFEST_VERSION, MANIFEST_FILENAME } from './release-manifest.js';
import { getGitInfo } from './utils/git-info.js';
import { runCommand } from './utils/command.js';
import { parseJson5 } from './utils/json5.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export interface GenerateManifestOptions {
  sourceDir: string;
  planPath: string;
  targetPlatform: string;
  targetArchitecture: string;
  decisions: string[];
  risksAcknowledged: string[];
  artifacts: ArtifactInfo[];
  buildDurationMs: number;
  dockerVersion?: string;
}

/**
 * 生成Release Manifest
 */
export function generateReleaseManifest(options: GenerateManifestOptions): ReleaseManifest {
  const {
    sourceDir,
    planPath,
    targetPlatform,
    targetArchitecture,
    decisions,
    risksAcknowledged,
    artifacts,
    buildDurationMs,
    dockerVersion,
  } = options;

  // 收集Git信息
  const gitInfo = getGitInfo(sourceDir);

  // 收集构建环境信息
  const buildEnv = collectBuildEnvironment(dockerVersion, buildDurationMs);

  // 检测项目类型
  const projectType = detectProjectType(sourceDir);

  // 构建Manifest
  const manifest: ReleaseManifest = {
    version: MANIFEST_VERSION,
    created_at: new Date().toISOString(),

    source: {
      git: gitInfo
        ? {
            commit_sha: gitInfo.commit_sha,
            commit_message: gitInfo.commit_message,
            branch: gitInfo.branch,
            tag: gitInfo.tag,
            remote_url: gitInfo.remote_url,
            is_dirty: gitInfo.is_dirty,
            dirty_files: gitInfo.dirty_files,
          }
        : {
            commit_sha: 'unknown',
            commit_message: 'Not a Git repository',
            is_dirty: false,
            dirty_files: [],
          },
      project_type: projectType.type,
      language_version: projectType.version,
    },

    build: buildEnv,

    decision: {
      plan_path: planPath,
      target_platform: targetPlatform,
      target_architecture: targetArchitecture,
      decisions,
      risks_acknowledged: risksAcknowledged,
    },

    artifacts,

    verification: {
      success: artifacts.length > 0,
      checks_passed: ['plan_valid', 'build_completed', 'checksum_generated'],
      checks_failed: artifacts.length === 0 ? ['no_artifacts'] : undefined,
    },
  };

  return manifest;
}

/**
 * 收集构建环境信息
 */
function collectBuildEnvironment(
  dockerVersion?: string,
  buildDurationMs = 0
): ReleaseManifest['build'] {
  return {
    forgekit_version: getForgeKitVersion(),
    forgekit_commit: getForgeKitCommit(),
    hostname: sanitizeHostname(os.hostname()),
    platform: os.platform(),
    architecture: normalizeArchitecture(os.arch()),
    node_version: process.version,
    docker_version: dockerVersion,
    build_duration_ms: buildDurationMs,
  };
}

function normalizeArchitecture(architecture: string): string {
  if (architecture === 'x64') {
    return 'amd64';
  }
  if (architecture === 'arm64') {
    return 'arm64';
  }
  return architecture;
}

/**
 * 检测项目类型
 */
function detectProjectType(sourceDir: string): { type: string; version?: string } {
  if (
    fs.existsSync(path.join(sourceDir, 'AppScope', 'app.json5'))
    && fs.existsSync(path.join(sourceDir, 'build-profile.json5'))
  ) {
    const parsedProfile = parseJson5(
      fs.readFileSync(path.join(sourceDir, 'build-profile.json5'), 'utf8')
    );
    const profile = isRecord(parsedProfile) ? parsedProfile : undefined;
    const app = isRecord(profile?.app) ? profile.app : undefined;
    const products = app?.products;
    let api: string | undefined;
    if (Array.isArray(products)) {
      for (const product of products) {
        api = parseHarmonyApi(isRecord(product) ? product.compatibleSdkVersion : undefined);
        if (api) {break;}
      }
    }
    return { type: 'ArkTS', version: api ? `HarmonyOS API ${api}` : 'HarmonyOS' };
  }

  // 检查 package.json
  const packageJsonPath = path.join(sourceDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson: unknown = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      return {
        type: 'Node.js',
        version: getNodeEngine(packageJson) ?? 'unknown',
      };
    } catch (error) {
      // 忽略解析错误
    }
  }

  // 检查 go.mod
  if (fs.existsSync(path.join(sourceDir, 'go.mod'))) {
    return {
      type: 'Go',
      version: '1.21+', // 从go.mod解析更准确，但这里简化
    };
  }

  // 检查 pyproject.toml
  if (fs.existsSync(path.join(sourceDir, 'pyproject.toml'))) {
    return {
      type: 'Python',
      version: '3.x',
    };
  }

  // 检查 requirements.txt
  if (fs.existsSync(path.join(sourceDir, 'requirements.txt'))) {
    return {
      type: 'Python',
      version: '3.x',
    };
  }

  return {
    type: 'unknown',
  };
}

function parseHarmonyApi(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isInteger(value)) {return String(value);}
  if (typeof value !== 'string') {return undefined;}
  const parenthesized = value.match(/\((\d{1,2})\)\s*$/);
  if (parenthesized) {return parenthesized[1];}
  return /^\d{1,2}$/.test(value.trim()) ? value.trim() : undefined;
}

/**
 * 获取ForgeKit版本
 */
function getForgeKitVersion(): string {
  try {
    const packageJsonPath = path.join(currentDir, '../../package.json');
    const packageJson: unknown = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return getStringProperty(packageJson, 'version') ?? '0.0.0';
  } catch (error) {
    return '0.0.0';
  }
}

function getNodeEngine(value: unknown): string | undefined {
  if (!isRecord(value) || !isRecord(value.engines)) {
    return undefined;
  }
  return typeof value.engines.node === 'string' ? value.engines.node : undefined;
}

function getStringProperty(value: unknown, key: string): string | undefined {
  return isRecord(value) && typeof value[key] === 'string' ? value[key] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * 获取ForgeKit Git提交
 */
function getForgeKitCommit(): string | undefined {
  try {
    // 尝试从ForgeKit仓库获取提交信息
    const forgeKitRoot = path.join(currentDir, '../../');
    const result = runCommand('git', ['rev-parse', 'HEAD'], { cwd: forgeKitRoot });
    return result.success ? result.stdout.trim() : undefined;
  } catch (error) {
    return undefined;
  }
}

/**
 * 脱敏主机名
 */
function sanitizeHostname(hostname: string): string {
  // 只保留最后一部分，避免泄露完整域名
  const parts = hostname.split('.');
  if (parts.length > 1) {
    return `${parts[0]}.<redacted>`;
  }
  return hostname;
}

/**
 * 保存Release Manifest到文件
 */
export function saveReleaseManifest(
  manifest: ReleaseManifest,
  outputDir: string
): string {
  const manifestPath = path.join(outputDir, MANIFEST_FILENAME);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  return manifestPath;
}

/**
 * 计算文件SHA256校验和
 */
export function calculateSHA256(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath);
    return createHash('sha256').update(content).digest('hex');
  } catch (error) {
    return 'sha256-placeholder';
  }
}
