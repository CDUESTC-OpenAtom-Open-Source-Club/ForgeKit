import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { diagnoseBuildFailure } from '../../../src/capabilities/diagnose-build-failure.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('diagnoseBuildFailure', () => {
  it('分析日志文本并返回结构化诊断', () => {
    const result = diagnoseBuildFailure({
      log_text: '#8 ERROR: failed to calculate checksum: "/missing.txt": not found',
    });

    expect(result.status).toBe('success');
    expect(result.input_source).toBe('text');
    expect(result.diagnosis?.code).toBe('docker_copy_failed');
    expect(result.diagnosis?.confidence).toBe('high');
    expect(result.diagnosis?.evidence.length).toBeGreaterThan(0);
    expect(result.diagnosis?.verification.length).toBeGreaterThan(0);
  });

  it('未知错误返回低置信度 unknown，而不是猜测修复', () => {
    const result = diagnoseBuildFailure({ log_text: 'builder stopped for an unusual reason 731' });

    expect(result.status).toBe('success');
    expect(result.diagnosis?.category).toBe('unknown');
    expect(result.diagnosis?.confidence).toBe('low');
  });

  it('必须且只能提供一种日志来源', () => {
    expect(diagnoseBuildFailure({}).error?.code).toBe('invalid_input');
    expect(diagnoseBuildFailure({ log_text: 'x', log_path: 'x' }).error?.code).toBe('invalid_input');
  });

  it('日志文件必须位于 source_dir 内', () => {
    const sourceDir = makeTempDir();
    const outsideDir = makeTempDir();
    const logPath = path.join(outsideDir, 'build.log');
    fs.writeFileSync(logPath, 'Cannot connect to the Docker daemon');

    const result = diagnoseBuildFailure({ source_dir: sourceDir, log_path: logPath });
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('path_out_of_bounds');
  });

  it('读取 source_dir 内的日志文件', () => {
    const sourceDir = makeTempDir();
    const logPath = path.join(sourceDir, 'build.log');
    fs.writeFileSync(logPath, 'No space left on device');

    const result = diagnoseBuildFailure({ source_dir: sourceDir, log_path: logPath });
    expect(result.status).toBe('success');
    expect(result.input_source).toBe('file');
    expect(result.diagnosis?.code).toBe('disk_space_exhausted');
  });

  it('拒绝通过 source_dir 内的符号链接读取目录外日志', () => {
    const sourceDir = makeTempDir();
    const outsideDir = makeTempDir();
    const outsideLog = path.join(outsideDir, 'outside.log');
    const linkedLog = path.join(sourceDir, 'linked.log');
    fs.writeFileSync(outsideLog, 'No space left on device');
    fs.symlinkSync(outsideLog, linkedLog);

    const result = diagnoseBuildFailure({ source_dir: sourceDir, log_path: linkedLog });
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('path_out_of_bounds');
  });

  it('拒绝超过 1 MiB 的日志文本', () => {
    const result = diagnoseBuildFailure({ log_text: 'x'.repeat(1024 * 1024 + 1) });
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('log_too_large');
  });

  it('对证据中的凭据和用户路径脱敏', () => {
    const result = diagnoseBuildFailure({
      log_text: 'authorization: Bearer abcdefghijklmnopqrstuvwxyz\n/Users/alice/project: Permission denied',
    });
    const evidence = result.diagnosis?.evidence.join('\n') ?? '';

    expect(evidence).toContain('[REDACTED]');
    expect(evidence).toContain('/Users/[USER]/');
    expect(evidence).not.toContain('abcdefghijklmnopqrstuvwxyz');
    expect(evidence).not.toContain('/Users/alice/');
  });

  it.each([
    ['GitHub token', 'ghp_abcdefghijklmnopqrstuvwxyz123456', 'failed: ghp_abcdefghijklmnopqrstuvwxyz123456 Permission denied', '[REDACTED]'],
    ['OpenAI-style key', 'sk-abcdefghijklmnopqrstuvwxyz123456', 'secret=sk-abcdefghijklmnopqrstuvwxyz123456 Permission denied', '[REDACTED]'],
    ['API key', 'plain-secret-value', 'api_key=plain-secret-value Permission denied', '[REDACTED]'],
    ['Linux home path', '/home/alice/', '/home/alice/project Permission denied', '/home/[USER]/'],
    ['email address', 'user@example.com', 'contact user@example.com: Permission denied', '[EMAIL]'],
  ])('脱敏 %s', (_name, sensitiveValue, logText, replacement) => {
    const result = diagnoseBuildFailure({ log_text: logText });
    const evidence = result.diagnosis?.evidence.join('\n') ?? '';

    expect(evidence).toContain(replacement);
    expect(evidence).not.toContain(sensitiveValue);
  });
});

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgekit-diagnose-'));
  tempDirs.push(dir);
  return dir;
}
