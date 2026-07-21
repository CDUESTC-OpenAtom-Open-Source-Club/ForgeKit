/**
 * pack_deb - Ubuntu deb 包构建能力（v0.1 可选）
 *
 * 流程：校验 plan_path → 校验 Python 项目 → 检查 dpkg-deb → 生成 debian/ 元数据 → 构建 → 校验和
 * 符合 V0.1_IMPLEMENTATION M5 / DESIGN §5.4
 */

import * as fs from 'fs';
import * as path from 'path';
import { assertSourceDir, PathValidationError, pathExists } from './utils/filesystem.js';
import { runCommandWithLog, commandExists } from './utils/command.js';
import { sha256File } from './utils/checksum.js';
import type { PackDebOutput } from './types.js';

export interface PackDebInput {
  source_dir: string;
  plan_path: string;
  version: string;
  distro?: string; // ubuntu-22.04
  arch?: string; // x86_64 | aarch64
}

export async function packDeb(input: PackDebInput): Promise<PackDebOutput> {
  const { source_dir, plan_path, version, distro = 'ubuntu-22.04', arch = 'x86_64' } = input;

  // 1. 校验 source_dir
  try {
    assertSourceDir(source_dir);
  } catch (e) {
    if (e instanceof PathValidationError) {
      return failed(e.code as any, e.message, '请提供有效的项目根目录路径');
    }
    throw e;
  }

  // 2. plan_path 校验
  if (!pathExists(plan_path)) {
    return failed(
      'plan_not_found',
      `Forge.md 不存在: ${plan_path}`,
      '先调用 generate_packaging_plan'
    );
  }

  // 3. 校验是 Python 项目（v0.1 范围）
  if (!isPythonProject(source_dir)) {
    return failed(
      'language_not_supported',
      'pack_deb v0.1 仅支持 Python 项目（需 pyproject.toml / setup.py / requirements.txt / *.py）',
      '改用 build_docker_image，或等待 v0.2 多语言支持'
    );
  }

  // 4. 检查 dpkg-deb 可用
  if (!commandExists('dpkg-deb')) {
    return failed(
      'dpkg_unavailable',
      'dpkg-deb 命令不可用（当前系统非 Debian/Ubuntu）',
      '在 Ubuntu/Debian 环境运行，或使用 Docker 构建 deb（v0.2 支持）'
    );
  }

  // 5. 准备构建目录（dist/forgekit/deb/<name>_<version>_<arch>）
  const debArch = arch === 'aarch64' ? 'arm64' : 'amd64';
  const packageName = inferPackageName(source_dir);
  const buildDir = path.join(
    source_dir,
    'dist',
    'forgekit',
    'deb',
    `${packageName}_${version}_${debArch}`
  );
  fs.mkdirSync(path.join(buildDir, 'DEBIAN'), { recursive: true });
  fs.mkdirSync(path.join(buildDir, 'usr', 'local', 'bin'), { recursive: true });

  // 6. 生成 debian/control
  const controlContent = generateControl(packageName, version, debArch, source_dir);
  fs.writeFileSync(path.join(buildDir, 'DEBIAN', 'control'), controlContent, 'utf-8');

  // 7. 复制项目文件到 usr/local/bin
  copyProjectFiles(source_dir, buildDir);

  // 8. 构建 deb
  const debFileName = `${packageName}_${version}_${debArch}.deb`;
  const distDir = path.join(source_dir, 'dist', 'forgekit', 'deb');
  const buildResult = runCommandWithLog(
    'dpkg-deb',
    ['--build', buildDir, path.join(distDir, debFileName)],
    {
      timeout: 120000,
      logFileName: `pack-deb-${packageName}-${version}.log`,
    }
  );

  if (!buildResult.success) {
    return failed(
      'deb_build_failed',
      `dpkg-deb 构建失败（exit ${buildResult.exitCode}）`,
      '查看日志：常见原因是 control 文件格式错误或依赖声明问题',
      buildResult.logPath
    );
  }

  // 9. 校验和
  const artifactPath = path.join(distDir, debFileName);
  const checksum = pathExists(artifactPath) ? sha256File(artifactPath) : undefined;

  // 10. 决策依据
  const decision_basis = {
    target_platform: `${distro}/${arch}`,
    target_version: distro,
    build_method: 'dpkg-deb（标准 Debian 打包）',
    compatibility_notes: [
      `架构：${debArch}（Debian 命名）`,
      `适用系统：${distro} 及兼容发行版`,
      '需目标系统已安装 Python 运行时（v0.1 不打包解释器）',
    ],
  };

  return {
    status: 'success',
    artifacts: [
      {
        type: 'deb-package',
        path: artifactPath,
        checksum,
      },
    ],
    logs: {
      path: buildResult.logPath,
      summary: `deb 构建成功：${debFileName}（exit 0）`,
      full_available: true,
    },
    decision_basis,
    artifact_path: artifactPath,
    checksum,
    build_log: buildResult.logPath,
  };
}

// ========== 辅助函数 ==========

function failed(
  code: string,
  summary: string,
  suggestedFix: string,
  detailLog?: string
): PackDebOutput {
  return {
    status: 'failed',
    error: { code: code as any, summary, detail_log: detailLog, suggested_fix: suggestedFix },
  };
}

function isPythonProject(sourceDir: string): boolean {
  return (
    pathExists(path.join(sourceDir, 'pyproject.toml')) ||
    pathExists(path.join(sourceDir, 'setup.py')) ||
    pathExists(path.join(sourceDir, 'requirements.txt')) ||
    fs.readdirSync(sourceDir).some((f) => f.endsWith('.py'))
  );
}

function inferPackageName(sourceDir: string): string {
  const pyproject = pathExists(path.join(sourceDir, 'pyproject.toml'))
    ? fs.readFileSync(path.join(sourceDir, 'pyproject.toml'), 'utf-8')
    : '';
  const match = pyproject.match(/name\s*=\s*["']([^"']+)["']/);
  if (match) {
    return match[1].toLowerCase().replace(/[^a-z0-9+\-.]/g, '-');
  }
  return path
    .basename(path.resolve(sourceDir))
    .toLowerCase()
    .replace(/[^a-z0-9+\-.]/g, '-');
}

function generateControl(name: string, version: string, arch: string, sourceDir: string): string {
  const hasRequirements = pathExists(path.join(sourceDir, 'requirements.txt'));
  return [
    'Package: ' + name,
    'Version: ' + version,
    'Architecture: ' + arch,
    'Maintainer: ForgeKit <noreply@forgekit.local>',
    'Section: utils',
    'Priority: optional',
    'Description: Packaged by ForgeKit from source project',
    ' ' + (name + ' v' + version + ', built via ForgeKit pack_deb (v0.1).'),
    hasRequirements ? 'Depends: python3' : '',
    'Homepage: https://github.com/muzimu217/ForgeKit',
    '',
  ]
    .filter((line, idx) => !(line === '' && idx > 0))
    .join('\n');
}

function copyProjectFiles(sourceDir: string, buildDir: string): void {
  // 简化策略：复制 .py 文件和 requirements.txt 到 /usr/local/bin
  const binDir = path.join(buildDir, 'usr', 'local', 'bin');
  const entries = fs.readdirSync(sourceDir);
  for (const entry of entries) {
    if (entry === 'dist' || entry === 'node_modules' || entry === '.git') {
      continue;
    }
    const src = path.join(sourceDir, entry);
    const stat = fs.statSync(src);
    if (stat.isFile()) {
      fs.copyFileSync(src, path.join(binDir, entry));
    }
  }
}
