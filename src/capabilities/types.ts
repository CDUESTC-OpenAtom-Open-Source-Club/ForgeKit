/**
 * ForgeKit 统一结果与错误结构
 * 所有 MCP 工具必须遵循此契约
 */

// ========== 结果结构 ==========

export interface ForgeKitResult {
  status: 'success' | 'failed';
  artifacts?: Artifact[];
  logs?: LogInfo;
  warnings?: string[];
  decision_basis?: DecisionBasis;
  next_actions?: string[];
  error?: ForgeKitError;
}

export interface Artifact {
  type: 'docker-image' | 'deb-package' | 'rpm-package' | 'apk' | 'ipa' | 'pwa' | 'exe' | 'app';
  path: string;
  checksum?: string;
  size_bytes?: number;
  metadata?: Record<string, unknown>;
}

export interface LogInfo {
  path: string;
  summary: string;
  full_available: boolean;
}

export interface DecisionBasis {
  target_platform?: string;
  target_version?: string;
  base_image?: string;
  build_method?: string;
  compatibility_notes?: string[];
  risks_acknowledged?: string[];
}

// ========== 错误结构 ==========

export interface ForgeKitError {
  code: ErrorCode;
  summary: string;
  detail_log?: string;
  suggested_fix?: string;
  plan_correction?: string;
}

export type ErrorCode =
  // 计划相关
  | 'plan_not_found'
  | 'plan_invalid'
  // Docker 相关
  | 'docker_daemon_unavailable'
  | 'dockerfile_not_found'
  | 'docker_build_failed'
  | 'docker_copy_failed'
  | 'docker_permission_denied'
  // 依赖相关
  | 'npm_dependency_conflict'
  | 'pip_package_not_found'
  | 'module_not_found'
  // 权限相关
  | 'permission_denied'
  | 'write_permission_denied'
  // 端口相关
  | 'port_conflict'
  // 网络相关
  | 'network_unreachable'
  // deb 相关
  | 'deb_build_failed'
  | 'dpkg_unavailable'
  // 路径相关
  | 'invalid_path'
  | 'path_not_found'
  | 'path_out_of_bounds'
  // 项目相关
  | 'language_not_supported'
  | 'entrypoint_not_found'
  | 'build_config_invalid'
  // 通用
  | 'unknown_error';

// ========== 工具特定输出 ==========

export interface InspectProjectOutput extends ForgeKitResult {
  language?: string;
  runtime?: string;
  entrypoints?: string[];
  existing_packaging?: ExistingPackaging;
  recommendations?: string[];
}

export interface ExistingPackaging {
  dockerfile?: boolean;
  docker_compose?: boolean;
  setup_py?: boolean;
  pyproject_toml?: boolean;
  requirements_txt?: boolean;
  package_json?: boolean;
  gradle_build?: boolean;
  xcode_project?: boolean;
}

export interface GeneratePackagingPlanOutput extends ForgeKitResult {
  plan_path?: string;
  summary?: string;
  warnings?: string[];
  next_actions?: string[];
}

export interface BuildDockerImageOutput extends ForgeKitResult {
  image_ref?: string;
  size_bytes?: number;
  build_log?: string;
  result_json?: BuildResult;
}

export interface BuildResult {
  exit_code: number;
  stdout_snippet: string;
  stderr_snippet?: string;
  state_delta?: Record<string, unknown>;
}

export interface PackDebOutput extends ForgeKitResult {
  artifact_path?: string;
  checksum?: string;
  build_log?: string;
}

// ========== Plan-before-build 强制约束 ==========

/**
 * 所有构建类工具必须接收 plan_path
 * 缺失时返回 plan_not_found 错误
 */
export interface BuildToolInput {
  source_dir: string;
  plan_path: string; // 必需，缺失返回 plan_not_found
  target_platform?: string;
}

/**
 * 非构建类工具（inspect_project、generate_packaging_plan）
 * 不强制要求 plan_path
 */
export interface NonBuildToolInput {
  source_dir: string;
  plan_path?: string;
}
