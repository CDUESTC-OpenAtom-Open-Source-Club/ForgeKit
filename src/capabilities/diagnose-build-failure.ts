import * as fs from 'fs';
import * as path from 'path';
import type { ForgeKitResult } from './types.js';
import {
  createUnknownDiagnostic,
  diagnoseBuildError,
  type ErrorDiagnostic,
} from './utils/error-diagnostic.js';
import { assertWithinRoot } from './utils/filesystem.js';

const MAX_LOG_BYTES = 1024 * 1024;

export interface DiagnoseBuildFailureInput {
  log_text?: string;
  log_path?: string;
  source_dir?: string;
}

export interface DiagnoseBuildFailureOutput extends ForgeKitResult {
  diagnosis?: ErrorDiagnostic;
  input_source?: 'text' | 'file';
}

export function diagnoseBuildFailure(
  input: DiagnoseBuildFailureInput
): DiagnoseBuildFailureOutput {
  const hasText = typeof input.log_text === 'string';
  const hasPath = typeof input.log_path === 'string';

  if (hasText === hasPath) {
    return inputFailure(
      'invalid_input',
      '必须且只能提供 log_text 或 log_path 其中一项',
      '直接传入日志文本，或同时提供 source_dir 与该目录内的 log_path'
    );
  }

  let logText: string;
  let inputSource: 'text' | 'file';

  if (hasText) {
    logText = input.log_text ?? '';
    inputSource = 'text';
  } else {
    if (!input.source_dir) {
      return inputFailure(
        'invalid_input',
        '使用 log_path 时必须提供 source_dir',
        'source_dir 用于限制日志读取范围，防止读取项目目录外的文件'
      );
    }

    const sourceDir = path.resolve(input.source_dir);
    const logPath = path.resolve(input.log_path ?? '');
    try {
      const realSourceDir = fs.realpathSync(sourceDir);
      const realLogPath = fs.realpathSync(logPath);
      if (!fs.statSync(realSourceDir).isDirectory()) {
        return inputFailure('log_read_failed', `source_dir 不是目录: ${sourceDir}`, '提供有效的项目根目录');
      }
      assertWithinRoot(realLogPath, realSourceDir);
      const stat = fs.statSync(realLogPath);
      if (!stat.isFile()) {
        return inputFailure('log_read_failed', `日志路径不是文件: ${logPath}`, '提供可读的文本日志文件');
      }
      if (stat.size > MAX_LOG_BYTES) {
        return inputFailure(
          'log_too_large',
          `日志超过 ${MAX_LOG_BYTES} 字节限制`,
          '截取包含首次失败步骤和相关上下文的脱敏日志后重试'
        );
      }
      logText = fs.readFileSync(realLogPath, 'utf-8');
      inputSource = 'file';
    } catch (error) {
      return inputFailure(
        'log_read_failed',
        `无法读取指定日志: ${(error as Error).message}`,
        '确认日志存在、可读，并位于 source_dir 内'
      );
    }
  }

  if (Buffer.byteLength(logText, 'utf-8') > MAX_LOG_BYTES) {
    return inputFailure(
      'log_too_large',
      `日志超过 ${MAX_LOG_BYTES} 字节限制`,
      '截取包含首次失败步骤和相关上下文的脱敏日志后重试'
    );
  }
  if (!logText.trim()) {
    return inputFailure('invalid_input', '日志内容为空', '提供包含 Docker/BuildKit 失败信息的日志');
  }

  const diagnosis = diagnoseBuildError(logText) ?? createUnknownDiagnostic(logText);
  return {
    status: 'success',
    diagnosis,
    input_source: inputSource,
    next_actions: diagnosis.suggested_actions,
    decision_basis: {
      build_method: '只读 Docker/BuildKit 日志诊断',
      compatibility_notes: [
        `诊断类别: ${diagnosis.category}`,
        `置信度: ${diagnosis.confidence}`,
        '未执行修复命令，未修改项目文件',
      ],
    },
  };
}

function inputFailure(
  code: 'invalid_input' | 'log_too_large' | 'log_read_failed',
  summary: string,
  suggestedFix: string
): DiagnoseBuildFailureOutput {
  return {
    status: 'failed',
    error: {
      code,
      summary,
      suggested_fix: suggestedFix,
    },
  };
}
