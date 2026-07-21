/**
 * Preflight Check - 构建前环境检查
 *
 * 目的：
 * - 在实际构建前发现环境问题
 * - 提前暴露常见错误（Docker未运行、文件缺失、权限不足）
 * - 减少构建失败率，节省用户时间
 *
 * 检查项：
 * 1. Docker可用性
 * 2. 源目录有效性
 * 3. 计划文件存在性
 * 4. 入口文件存在性
 * 5. 磁盘空间充足性
 * 6. 网络连接（可选）
 */

import * as fs from 'fs';
import * as path from 'path';
import { commandExists, runCommand } from './utils/command.js';
import { pathExists } from './utils/filesystem.js';
import type { ForgeKitResult } from './types.js';

export interface PreflightCheckInput {
  source_dir: string;
  plan_path?: string;  // 可选，如果已知
  checks?: string[];   // 指定要运行的检查项，默认全部
}

export interface PreflightCheckOutput extends ForgeKitResult {
  checks: CheckResult[];
  all_passed: boolean;
  passed_count: number;
  failed_count: number;
  recommendations?: string[];
}

export interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  details?: string;
  suggested_fix?: string;
}

/**
 * 执行Preflight检查
 */
export async function preflightCheck(input: PreflightCheckInput): Promise<PreflightCheckOutput> {
  const { source_dir, plan_path, checks } = input;

  const results: CheckResult[] = [];
  const defaultChecks = [
    'source_directory',
    'docker_availability',
    'disk_space',
    'plan_file',
    'registry_connectivity',
  ];

  const checksToRun = checks || defaultChecks;

  // 检查1：源目录有效性
  if (checksToRun.includes('source_directory')) {
    results.push(checkSourceDirectory(source_dir));
  }

  // 检查2：Docker可用性
  if (checksToRun.includes('docker_availability')) {
    results.push(checkDockerAvailability());
  }

  // 检查3：磁盘空间
  if (checksToRun.includes('disk_space')) {
    results.push(checkDiskSpace(source_dir));
  }

  // 检查4：计划文件（如果提供）
  if (checksToRun.includes('plan_file') && plan_path) {
    results.push(checkPlanFile(plan_path));
  }

  // 检查5：镜像仓库连通性
  if (checksToRun.includes('registry_connectivity')) {
    results.push(await checkRegistryConnectivity());
  }

  // 统计结果
  const passed = results.filter(r => r.status === 'pass');
  const failed = results.filter(r => r.status === 'fail');
  const all_passed = failed.length === 0;

  // 生成建议
  const recommendations: string[] = [];
  if (!all_passed) {
    recommendations.push('修复上述失败项后重新运行preflight检查');
    failed.forEach(f => {
      if (f.suggested_fix) {
        recommendations.push(f.suggested_fix);
      }
    });
  }

  return {
    status: all_passed ? 'success' : 'failed',
    checks: results,
    all_passed,
    passed_count: passed.length,
    failed_count: failed.length,
    recommendations,
    decision_basis: {
      build_method: 'preflight环境检查',
      compatibility_notes: [
        `检查项：${checksToRun.join(', ')}`,
        `通过：${passed.length}，失败：${failed.length}`,
      ],
    },
  };
}

/**
 * 检查源目录
 */
function checkSourceDirectory(sourceDir: string): CheckResult {
  if (!sourceDir) {
    return {
      name: 'source_directory',
      status: 'fail',
      message: '源目录路径为空',
      suggested_fix: '提供有效的源目录路径',
    };
  }

  if (!fs.existsSync(sourceDir)) {
    return {
      name: 'source_directory',
      status: 'fail',
      message: `源目录不存在: ${sourceDir}`,
      suggested_fix: '确认路径正确，或使用绝对路径',
    };
  }

  if (!fs.statSync(sourceDir).isDirectory()) {
    return {
      name: 'source_directory',
      status: 'fail',
      message: `路径不是目录: ${sourceDir}`,
      suggested_fix: '提供目录路径而非文件路径',
    };
  }

  return {
    name: 'source_directory',
    status: 'pass',
    message: `源目录有效: ${sourceDir}`,
    details: `绝对路径: ${path.resolve(sourceDir)}`,
  };
}

/**
 * 检查Docker可用性
 */
function checkDockerAvailability(): CheckResult {
  // 检查docker命令是否存在
  if (!commandExists('docker')) {
    return {
      name: 'docker_availability',
      status: 'fail',
      message: 'Docker命令不可用',
      details: 'docker不在PATH中或未安装',
      suggested_fix: '安装Docker Desktop（macOS/Windows）或Docker Engine（Linux）',
    };
  }

  // 检查Docker守护进程是否运行
  const daemonCheck = runCommand('docker', ['version', '--format', '{{.Server.Version}}']);
  if (!daemonCheck.success) {
    return {
      name: 'docker_availability',
      status: 'fail',
      message: 'Docker守护进程未运行',
      details: daemonCheck.stderr,
      suggested_fix: '启动Docker Desktop（macOS/Windows）或运行 `sudo systemctl start docker`（Linux）',
    };
  }

  // 检查Docker版本
  const version = daemonCheck.stdout.trim();
  return {
    name: 'docker_availability',
    status: 'pass',
    message: `Docker可用（版本 ${version}）`,
  };
}

/**
 * 检查磁盘空间
 */
function checkDiskSpace(sourceDir: string): CheckResult {
  const MIN_GB = 2; // 最小2GB
  const MIN_BYTES = MIN_GB * 1024 * 1024 * 1024;

  try {
    const stats = fs.statfsSync(sourceDir);
    const availableBytes = stats.bavail * stats.bsize;
    const availableGB = availableBytes / 1024 / 1024 / 1024;

    if (availableBytes < MIN_BYTES) {
      return {
        name: 'disk_space',
        status: 'fail',
        message: `磁盘空间不足（少于${MIN_GB}GB）`,
        details: `可用磁盘空间: ${availableGB.toFixed(2)} GB`,
        suggested_fix: '释放源目录所在分区的磁盘空间',
      };
    }

    return {
      name: 'disk_space',
      status: 'pass',
      message: '磁盘空间充足',
      details: `可用磁盘空间: ${availableGB.toFixed(2)} GB`,
    };
  } catch (error) {
    return {
      name: 'disk_space',
      status: 'skip',
      message: '无法检查磁盘空间',
      details: String(error),
    };
  }
}

/**
 * 检查计划文件
 */
function checkPlanFile(planPath: string): CheckResult {
  if (!planPath) {
    return {
      name: 'plan_file',
      status: 'skip',
      message: '未提供计划文件路径',
    };
  }

  if (!pathExists(planPath)) {
    return {
      name: 'plan_file',
      status: 'fail',
      message: `计划文件不存在: ${planPath}`,
      suggested_fix: '先调用 generate_packaging_plan 生成计划',
    };
  }

  // 检查文件是否可读
  try {
    fs.accessSync(planPath, fs.constants.R_OK);
  } catch (error) {
    return {
      name: 'plan_file',
      status: 'fail',
      message: `计划文件不可读: ${planPath}`,
      suggested_fix: '检查文件权限',
    };
  }

  return {
    name: 'plan_file',
    status: 'pass',
    message: `计划文件有效: ${planPath}`,
  };
}

/**
 * 检查镜像仓库连通性
 *
 * 尝试连接Docker Hub或其他镜像仓库
 * 超时时间：10秒
 */
async function checkRegistryConnectivity(): Promise<CheckResult> {
  const REGISTRY_URL = 'https://registry-1.docker.io';
  const TIMEOUT_MS = 10000;

  try {
    // 使用curl测试连通性（跨平台）
    const result = runCommand('curl', [
      '-sf',
      '--max-time', String(TIMEOUT_MS / 1000),
      '-o', '/dev/null',
      '-w', '%{http_code}',
      REGISTRY_URL,
    ]);

    if (result.success && result.stdout.trim().match(/^2\d{2}$/)) {
      return {
        name: 'registry_connectivity',
        status: 'pass',
        message: `镜像仓库可达（${REGISTRY_URL}）`,
      };
    }

    // 如果curl失败，尝试使用docker pull测试
    const dockerTest = runCommand('docker', [
      'pull',
      '--quiet',
      'hello-world',
    ], { timeout: TIMEOUT_MS });

    if (dockerTest.success) {
      return {
        name: 'registry_connectivity',
        status: 'pass',
        message: '镜像仓库可达（通过docker pull测试）',
      };
    }

    return {
      name: 'registry_connectivity',
      status: 'fail',
      message: '镜像仓库不可达',
      details: '无法连接到Docker Hub或镜像拉取失败',
      suggested_fix: '检查网络连接，或配置国内镜像源（如docker.m.daocloud.io）',
    };
  } catch (error) {
    return {
      name: 'registry_connectivity',
      status: 'fail',
      message: '镜像仓库连通性检查失败',
      details: String(error),
      suggested_fix: '检查网络连接或跳过此检查（使用国内镜像源时）',
    };
  }
}
