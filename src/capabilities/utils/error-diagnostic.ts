/**
 * Error Diagnostic - 智能错误诊断系统
 *
 * 功能：
 * - 匹配常见错误模式
 * - 生成可读诊断 + 修复建议
 * - 关联决策规则
 *
 * v0.2 重点：
 * - Docker 构建失败诊断
 * - 依赖缺失诊断
 * - 权限问题诊断
 * - 端口冲突诊断
 */

import type { ForgeKitResult } from '../types.js';

export interface ErrorDiagnostic {
  code: string;              // 错误码（与ForgeKitResult.error.code对应）
  summary: string;           // 简短描述（一句话）
  detail?: string;           // 详细日志片段
  suggested_fix: string;     // 修复建议（可操作的步骤）
  related_rules?: string[];  // 相关决策规则（YAML引用）
  severity: 'error' | 'warning' | 'info';  // 严重程度
}

interface DiagnosticRule {
  pattern: RegExp | string;   // 错误模式
  diagnostic: Omit<ErrorDiagnostic, 'detail'>;
}

/**
 * 常见错误诊断规则库
 *
 * 优先级：Docker > 依赖 > 权限 > 网络
 */
const DIAGNOSTIC_RULES: DiagnosticRule[] = [
  // ========== Docker 相关 ==========
  {
    pattern: /docker daemon not running|cannot connect to the Docker daemon/i,
    diagnostic: {
      code: 'docker_daemon_unavailable',
      summary: 'Docker 守护进程未运行',
      suggested_fix: '启动 Docker Desktop 或执行 `sudo systemctl start docker`',
      severity: 'error',
    },
  },
  {
    pattern: /permission denied.*docker/i,
    diagnostic: {
      code: 'docker_permission_denied',
      summary: 'Docker 权限不足',
      suggested_fix: '将用户加入docker组：`sudo usermod -aG docker $USER`，然后重新登录',
      severity: 'error',
    },
  },
  {
    pattern: /no such file.*Dockerfile|Dockerfile not found/i,
    diagnostic: {
      code: 'dockerfile_not_found',
      summary: 'Dockerfile 不存在',
      suggested_fix: '在项目根目录创建 Dockerfile，或通过 Forge.md 指定 dockerfile_path',
      severity: 'error',
    },
  },
  {
    pattern: /COPY failed.*no such file or directory/i,
    diagnostic: {
      code: 'docker_copy_failed',
      summary: 'Docker COPY 命令失败：文件不存在',
      suggested_fix: '检查 Dockerfile 中 COPY 的路径是否正确，确保文件在构建上下文中',
      severity: 'error',
      related_rules: ['dockerfile_best_practices'],
    },
  },

  // ========== 依赖相关 ==========
  {
    pattern: /npm ERR!.*ERESOLVE.*dependency conflict/i,
    diagnostic: {
      code: 'npm_dependency_conflict',
      summary: 'npm 依赖冲突',
      suggested_fix: '尝试 `npm install --legacy-peer-deps` 或检查 package.json 中的依赖版本',
      severity: 'error',
    },
  },
  {
    pattern: /pip.*error.*could not find a version|No matching distribution found/i,
    diagnostic: {
      code: 'pip_package_not_found',
      summary: 'pip 找不到包版本',
      suggested_fix: '检查包名拼写、版本约束，或尝试 `pip install --upgrade pip`',
      severity: 'error',
    },
  },
  {
    pattern: /ModuleNotFoundError|Module not found|Cannot find module/i,
    diagnostic: {
      code: 'module_not_found',
      summary: 'Python/Node 模块未找到',
      suggested_fix: '安装缺失依赖：`pip install <package>` 或 `npm install <package>`',
      severity: 'error',
    },
  },

  // ========== 权限相关 ==========
  {
    pattern: /Permission denied|EACCES|operation not permitted/i,
    diagnostic: {
      code: 'permission_denied',
      summary: '权限不足',
      suggested_fix: '检查文件权限，或使用 sudo 执行（谨慎）',
      severity: 'error',
    },
  },
  {
    pattern: /EPERM.*write/i,
    diagnostic: {
      code: 'write_permission_denied',
      summary: '文件写入权限不足',
      suggested_fix: '检查目录权限，或更改目标目录：`chmod 755 <dir>`',
      severity: 'error',
    },
  },

  // ========== 端口冲突 ==========
  {
    pattern: /port.*already in use|EADDRINUSE|address already in use/i,
    diagnostic: {
      code: 'port_conflict',
      summary: '端口已被占用',
      suggested_fix: '使用 `lsof -i :<port>` 查找占用进程，或更改应用端口',
      severity: 'error',
    },
  },

  // ========== 网络相关 ==========
  {
    pattern: /network.*unreachable|ENETUNREACH|dial tcp.*i\/o timeout/i,
    diagnostic: {
      code: 'network_unreachable',
      summary: '网络不可达或超时',
      suggested_fix: '检查网络连接，或配置镜像源（如国内 Docker 镜像）',
      severity: 'error',
    },
  },
];

/**
 * 错误诊断器
 */
export class ErrorDiagnostician {
  /**
   * 诊断错误
   */
  static diagnose(error: Error | string, context?: { stderr?: string; stdout?: string }): ErrorDiagnostic | null {
    const errorText = typeof error === 'string'
      ? error
      : error.message + (context?.stderr ? `\n${context.stderr}` : '');

    // 从后向前匹配（优先级：特殊 → 通用）
    for (const rule of DIAGNOSTIC_RULES) {
      const pattern = typeof rule.pattern === 'string'
        ? new RegExp(rule.pattern, 'i')
        : rule.pattern;

      if (pattern.test(errorText)) {
        return {
          ...rule.diagnostic,
          detail: this.extractDetail(errorText, pattern),
        };
      }
    }

    // 未匹配到已知模式
    return null;
  }

  /**
   * 提取详细日志片段
   */
  private static extractDetail(errorText: string, pattern: RegExp): string {
    const lines = errorText.split('\n');
    const matchedLines: string[] = [];

    for (const line of lines) {
      if (pattern.test(line)) {
        matchedLines.push(line.trim());
        if (matchedLines.length >= 5) break; // 最多5行
      }
    }

    return matchedLines.join('\n');
  }

  /**
   * 增强 ForgeKitResult 错误信息
   */
  static enhanceResult(result: ForgeKitResult): ForgeKitResult {
    if (result.status === 'success' || !result.error) {
      return result;
    }

    const diagnostic = this.diagnose(result.error.summary, {
      stderr: result.error.detail_log,
    });

    if (diagnostic) {
      return {
        ...result,
        error: {
          ...result.error,
          code: diagnostic.code,
          summary: diagnostic.summary,
          suggested_fix: diagnostic.suggested_fix,
          ...(diagnostic.detail && { detail_log: diagnostic.detail }),
        },
      };
    }

    return result;
  }
}

/**
 * 快捷函数：诊断错误并返回可读结果
 */
export function diagnoseBuildError(
  error: Error | string,
  stderr?: string
): ErrorDiagnostic | null {
  return ErrorDiagnostician.diagnose(error, { stderr });
}