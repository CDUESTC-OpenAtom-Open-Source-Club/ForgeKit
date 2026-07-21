/**
 * Error Diagnostic Tests
 */

import { describe, it, expect } from 'vitest';
import { diagnoseBuildError, ErrorDiagnostician } from '../../../../src/capabilities/utils/error-diagnostic.js';
import type { ForgeKitResult } from '../../../../src/capabilities/types.js';

describe('ErrorDiagnostician', () => {
  describe('Docker 错误诊断', () => {
    it('应诊断 Docker 守护进程未运行', () => {
      const error = 'Cannot connect to the Docker daemon at unix:///var/run/docker.sock';
      const result = diagnoseBuildError(error);

      expect(result).not.toBeNull();
      expect(result?.code).toBe('docker_daemon_unavailable');
      expect(result?.summary).toContain('Docker 守护进程未运行');
      expect(result?.suggested_fix).toContain('systemctl start docker');
    });

    it('应诊断 Dockerfile 不存在', () => {
      const error = 'no such file or directory: Dockerfile';
      const result = diagnoseBuildError(error);

      expect(result).not.toBeNull();
      expect(result?.code).toBe('dockerfile_not_found');
      expect(result?.summary).toContain('Dockerfile 不存在');
    });
  });

  describe('依赖错误诊断', () => {
    it('应诊断 npm 依赖冲突', () => {
      const error = 'npm ERR! ERESOLVE unable to resolve dependency conflict';
      const result = diagnoseBuildError(error);

      expect(result).not.toBeNull();
      expect(result?.code).toBe('npm_dependency_conflict');
      expect(result?.suggested_fix).toContain('--legacy-peer-deps');
    });

    it('应诊断 Python 模块未找到', () => {
      const error = 'ModuleNotFoundError: No module named "requests"';
      const result = diagnoseBuildError(error);

      expect(result).not.toBeNull();
      expect(result?.code).toBe('module_not_found');
      expect(result?.suggested_fix).toContain('pip install');
    });
  });

  describe('权限错误诊断', () => {
    it('应诊断权限不足', () => {
      const error = 'Permission denied: /root/.config';
      const result = diagnoseBuildError(error);

      expect(result).not.toBeNull();
      expect(result?.code).toBe('permission_denied');
      expect(result?.severity).toBe('error');
    });
  });

  describe('端口冲突诊断', () => {
    it('应诊断端口已被占用', () => {
      const error = 'Error: listen EADDRINUSE: address already in use :::8080';
      const result = diagnoseBuildError(error);

      expect(result).not.toBeNull();
      expect(result?.code).toBe('port_conflict');
      expect(result?.suggested_fix).toContain('lsof -i');
    });
  });

  describe('网络错误诊断', () => {
    it('应诊断网络超时', () => {
      const error = 'dial tcp 128.121.146.109:443: i/o timeout';
      const result = diagnoseBuildError(error);

      expect(result).not.toBeNull();
      expect(result?.code).toBe('network_unreachable');
      expect(result?.suggested_fix).toContain('镜像源');
    });
  });

  describe('未知错误', () => {
    it('应对未知错误返回 null', () => {
      const error = 'Some random error message';
      const result = diagnoseBuildError(error);

      expect(result).toBeNull();
    });
  });

  describe('enhanceResult', () => {
    it('应增强 ForgeKitResult 的错误信息', () => {
      const result: ForgeKitResult = {
        status: 'failed',
        error: {
          code: 'unknown_error',
          summary: 'Cannot connect to the Docker daemon',
        },
      };

      const enhanced = ErrorDiagnostician.enhanceResult(result);

      expect(enhanced.error?.code).toBe('docker_daemon_unavailable');
      expect(enhanced.error?.summary).toContain('Docker 守护进程未运行');
      expect(enhanced.error?.suggested_fix).toBeTruthy();
    });

    it('应对成功结果不做修改', () => {
      const result: ForgeKitResult = {
        status: 'success',
        language: 'Python',
      };

      const enhanced = ErrorDiagnostician.enhanceResult(result);

      expect(enhanced.status).toBe('success');
    });
  });
});