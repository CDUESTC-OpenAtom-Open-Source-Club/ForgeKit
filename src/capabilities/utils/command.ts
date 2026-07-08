/**
 * Command Execution Utility - 命令执行 + 日志捕获
 *
 * 用于 docker build、dpkg-deb 等本地工具调用
 */

import { execFileSync, ExecFileSyncOptions } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { pathExists } from './filesystem.js';

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  success: boolean;
}

export interface CommandLogResult extends CommandResult {
  logPath: string;
}

/**
 * 检查命令是否可用（which/where）
 */
export function commandExists(cmd: string): boolean {
  try {
    const checkCmd = process.platform === 'win32' ? 'where' : 'which';
    execFileSync(checkCmd, [cmd], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 执行命令并捕获输出
 * 不抛异常，返回结构化结果
 */
export function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string; timeout?: number } = {}
): CommandResult {
  const { cwd, timeout = 120000 } = options;

  try {
    const stdout = execFileSync(command, args, {
      cwd,
      timeout,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    return {
      exitCode: 0,
      stdout: stdout || '',
      stderr: '',
      success: true,
    };
  } catch (error: any) {
    return {
      exitCode: error.status ?? 1,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? error.message ?? '',
      success: false,
    };
  }
}

/**
 * 执行命令并将完整输出写入日志文件
 * @returns 命令结果 + 日志路径
 */
export function runCommandWithLog(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    timeout?: number;
    logDir?: string;
    logFileName?: string;
  } = {}
): CommandLogResult {
  const { logDir = 'dist/forgekit/logs', logFileName = `${command}-${Date.now()}.log` } = options;

  // 确保日志目录存在
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.resolve(logDir, logFileName);

  const result = runCommand(command, args, { cwd: options.cwd, timeout: options.timeout });

  // 写入完整日志
  const logContent = [
    `# Command: ${command} ${args.join(' ')}`,
    `# Exit code: ${result.exitCode}`,
    `# Timestamp: ${new Date().toISOString()}`,
    '',
    '## STDOUT',
    result.stdout,
    '',
    '## STDERR',
    result.stderr,
  ].join('\n');
  fs.writeFileSync(logPath, logContent, 'utf-8');

  return { ...result, logPath };
}

/**
 * 截取字符串片段（用于 stdout_snippet）
 */
export function snippet(text: string, maxLen = 2000): string {
  if (text.length <= maxLen) return text;
  return text.slice(-maxLen) + '\n... [truncated]';
}
