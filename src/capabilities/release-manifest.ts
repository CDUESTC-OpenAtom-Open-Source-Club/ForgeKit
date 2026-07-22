/**
 * Release Manifest - 产物追溯契约
 *
 * 目的：
 * - 将产物与源码提交、构建环境、工具版本关联
 * - 提供可验证的供应链信息
 * - 支持审计和回溯
 *
 * 遵循 SLSA (Supply-chain Levels for Software Artifacts) 原则
 */

export interface ReleaseManifest {
  // ========== 基本信息 ==========
  version: string;                    // Manifest格式版本
  created_at: string;                 // ISO 8601时间戳

  // ========== 源码信息 ==========
  source: {
    git: {
      commit_sha: string;             // Git提交SHA
      commit_message: string;         // 提交消息
      branch?: string;                // 分支名
      tag?: string;                   // 标签名（如果有）
      remote_url?: string;            // 远程仓库URL
      is_dirty: boolean;              // 是否有未提交修改
      dirty_files?: string[];         // 未提交文件列表（脱敏）
    };
    project_type: string;             // 项目类型（Python/Node/Go等）
    language_version?: string;        // 语言版本
  };

  // ========== 构建环境 ==========
  build: {
    forgekit_version: string;         // ForgeKit版本
    forgekit_commit?: string;         // ForgeKit Git提交（如果有）
    hostname?: string;                 // 构建机器主机名（脱敏）
    platform: string;                  // 构建平台（linux/darwin/windows）
    architecture: string;              // 架构（amd64/arm64）
    node_version: string;              // Node.js版本
    docker_version?: string;           // Docker版本（如果使用）
    build_duration_ms: number;         // 构建耗时（毫秒）
  };

  // ========== 交付决策 ==========
  decision: {
    plan_path: string;                 // Forge.md路径
    target_platform: string;           // 目标平台
    target_architecture: string;       // 目标架构
    decisions: string[];               // 决策要点摘要
    risks_acknowledged: string[];      // 已知风险
  };

  // ========== 产物信息 ==========
  artifacts: ArtifactInfo[];

  // ========== 验证信息 ==========
  verification: {
    success: boolean;                   // 是否成功
    checks_passed: string[];           // 通过的检查项
    checks_failed?: string[];          // 失败的检查项
  };
}

export interface ArtifactInfo {
  type: 'docker-image' | 'deb-package' | 'rpm-package' | 'archive' | 'executable' | 'hap' | 'app';
  name: string;                        // 产物名称
  path: string;                        // 产物路径或引用
  size_bytes: number;                  // 大小（字节）
  checksum: {
    sha256: string;                     // SHA256校验和
    sha512?: string;                    // SHA512校验和（可选）
  };
  metadata?: Record<string, unknown>;  // 额外元数据
}

/**
 * Release Manifest 文件名格式
 */
export const MANIFEST_FILENAME = 'release-manifest.json';

/**
 * 最小Manifest版本
 */
export const MANIFEST_VERSION = '1.0.0';
