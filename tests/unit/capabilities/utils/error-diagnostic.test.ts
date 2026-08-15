/**
 * Error Diagnostic Tests
 */

import { describe, it, expect } from 'vitest';
import { diagnoseBuildError, ErrorDiagnostician } from '../../../../src/capabilities/utils/error-diagnostic.js';
import type { ForgeKitResult } from '../../../../src/capabilities/types.js';

describe('ErrorDiagnostician', () => {
  it('distinguishes a missing container entrypoint from a missing package dependency', () => {
    const result = diagnoseBuildError(
      "Error: Cannot find module '/app/index.js'",
      "at Module._resolveFilename (node:internal/modules/cjs/loader:1476:15)"
    );

    expect(result?.code).toBe('container_entrypoint_not_found');
    expect(result?.summary).toContain('容器启动入口');
    expect(result?.suggested_fix).toContain('CMD/ENTRYPOINT');
  });
  describe('Docker 错误诊断', () => {
    it('diagnoses Docker COPY wildcard destinations that are not directory-shaped', () => {
      const result = diagnoseBuildError(
        'COPY backend/*.py .',
        'When using COPY with more than one source file, the destination must be a directory and end with a /'
      );
      expect(result?.code).toBe('build_config_invalid');
      expect(result?.confidence).toBe('high');
      expect(result?.suggested_fix).toContain('COPY backend/*.py ./');
    });
    it('diagnoses fixed GID conflicts with the base image', () => {
      const result = diagnoseBuildError(
        "groupadd: GID '1000' already exists",
        'process groupadd --gid 1000 ghidra did not complete successfully: exit code: 4'
      );
      expect(result?.code).toBe('build_config_invalid');
      expect(result?.confidence).toBe('high');
      expect(result?.suggested_fix).toContain('getent group');
      expect(result?.suggested_fix).not.toContain('groupdel');
    });
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

  describe('对外失败案例页主题映射', () => {
    // 这些断言对应 site/ 下公开失败案例页宣传的能力，避免页面说出引擎不支持的结论。
    it('failed to solve 页：registry 网络类被识别为 network_unreachable', () => {
      const result = diagnoseBuildError(
        '#1 [1/3] FROM node:18\n#1 ERROR: process "/bin/sh -c apt-get" did not complete successfully',
        '=> ERROR [2/3] RUN npm install\n#8 network is unreachable'
      );
      expect(result?.code).toBe('network_unreachable');
    });

    it('依赖安装失败页：pip 找不到匹配版本被识别为 pip_package_not_found', () => {
      const result = diagnoseBuildError(
        'ERROR: Could not find a version that satisfies the requirement flask==99.0'
      );
      expect(result?.code).toBe('pip_package_not_found');
    });

    it('容器健康检查失败页：容器启动入口不存在被识别为 container_entrypoint_not_found', () => {
      const result = diagnoseBuildError(
        "exec: \"python\": executable file not found in $PATH\nError: Cannot find module '/app/main.py'"
      );
      expect(result?.code).toBe('container_entrypoint_not_found');
      expect(result?.category).toBe('runtime');
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
