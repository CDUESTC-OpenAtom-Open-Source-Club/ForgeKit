/**
 * MCP Tool Schemas - Zod validation schemas for all tools
 *
 * 符合 DESIGN §5 / AGENT_INTEGRATION §6 规范
 * 构建类工具强制 plan_path 约束
 */

import { z } from 'zod';

// ========== 通用输入 Schema ==========

const SourceDirSchema = z.string().describe('项目根目录路径');

const PlanPathSchema = z.string().describe('Forge.md 打包计划文件路径（必需）');

// ========== 通用输出 Schema ==========

const DecisionBasisSchema = z.object({
  target_platform: z.string().optional().describe('目标平台（如 ubuntu-22.04）'),
  target_version: z.string().optional().describe('目标版本'),
  build_method: z.string().optional().describe('构建方式'),
  compatibility_notes: z.array(z.string()).optional().describe('兼容性说明'),
  risks_acknowledged: z.array(z.string()).optional().describe('已确认风险'),
});

const ArtifactSchema = z.object({
  type: z.enum(['docker-image', 'deb-package', 'rpm-package', 'apk', 'ipa', 'pwa', 'exe', 'app']).describe('产物类型'),
  path: z.string().describe('产物路径'),
  checksum: z.string().optional().describe('SHA256 校验和'),
  size_bytes: z.number().optional().describe('产物大小（字节）'),
});

const LogInfoSchema = z.object({
  path: z.string().describe('日志文件路径'),
  summary: z.string().describe('日志摘要'),
  full_available: z.boolean().describe('完整日志是否可用'),
});

const ForgeKitErrorSchema = z.object({
  code: z.enum([
    'plan_not_found',
    'plan_invalid',
    'docker_daemon_unavailable',
    'dockerfile_not_found',
    'docker_build_failed',
    'docker_copy_failed',
    'docker_permission_denied',
    'npm_dependency_conflict',
    'pip_dependency_conflict',
    'pip_package_not_found',
    'system_package_not_found',
    'module_not_found',
    'permission_denied',
    'write_permission_denied',
    'port_conflict',
    'network_unreachable',
    'registry_auth_failed',
    'architecture_mismatch',
    'disk_space_exhausted',
    'deb_build_failed',
    'dpkg_unavailable',
    'invalid_path',
    'path_not_found',
    'path_out_of_bounds',
    'language_not_supported',
    'entrypoint_not_found',
    'build_config_invalid',
    'invalid_input',
    'log_too_large',
    'log_read_failed',
    'unknown_error',
  ]).describe('错误代码'),
  summary: z.string().describe('错误摘要'),
  detail_log: z.string().optional().describe('详细日志路径'),
  suggested_fix: z.string().optional().describe('修复建议'),
  plan_correction: z.string().optional().describe('计划修正建议'),
});

const ForgeKitResultSchema = z.object({
  status: z.enum(['success', 'failed']).describe('执行状态'),
  artifacts: z.array(ArtifactSchema).optional().describe('产物列表'),
  logs: LogInfoSchema.optional().describe('日志信息'),
  warnings: z.array(z.string()).optional().describe('非阻塞警告'),
  decision_basis: DecisionBasisSchema.optional().describe('决策依据'),
  next_actions: z.array(z.string()).optional().describe('后续建议'),
  error: ForgeKitErrorSchema.optional().describe('错误信息（仅失败时）'),
});

// ========== 工具特定 Schema ==========

// inspect_project
export const InspectProjectInputSchema = z.object({
  source_dir: SourceDirSchema,
});

export const InspectProjectOutputSchema = ForgeKitResultSchema.extend({
  language: z.string().optional().describe('项目语言'),
  runtime: z.string().optional().describe('运行时版本'),
  entrypoints: z.array(z.string()).optional().describe('可能入口'),
  existing_packaging: z.object({
    dockerfile: z.boolean().optional(),
    docker_compose: z.boolean().optional(),
    setup_py: z.boolean().optional(),
    pyproject_toml: z.boolean().optional(),
    requirements_txt: z.boolean().optional(),
    package_json: z.boolean().optional(),
    gradle_build: z.boolean().optional(),
    xcode_project: z.boolean().optional(),
  }).optional().describe('已有打包配置'),
  recommendations: z.array(z.string()).optional().describe('推荐打包目标'),
});

const ErrorDiagnosticSchema = z.object({
  code: ForgeKitErrorSchema.shape.code,
  category: z.enum([
    'environment', 'path', 'dockerfile', 'dependency', 'registry',
    'architecture', 'permission', 'disk', 'runtime', 'unknown',
  ]),
  summary: z.string(),
  probable_cause: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  evidence: z.array(z.string()),
  suggested_actions: z.array(z.string()),
  verification: z.array(z.string()),
  suggested_fix: z.string(),
  related_rules: z.array(z.string()).optional(),
  severity: z.enum(['error', 'warning', 'info']),
});

export const DiagnoseBuildFailureInputSchema = z.object({
  log_text: z.string().optional(),
  log_path: z.string().optional(),
  source_dir: z.string().optional(),
}).superRefine((value, context) => {
  if (Boolean(value.log_text) === Boolean(value.log_path)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: '必须且只能提供 log_text 或 log_path 其中一项',
    });
  }
  if (value.log_path && !value.source_dir) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: '使用 log_path 时必须提供 source_dir',
    });
  }
});

export const DiagnoseBuildFailureOutputSchema = ForgeKitResultSchema.extend({
  diagnosis: ErrorDiagnosticSchema.optional(),
  input_source: z.enum(['text', 'file']).optional(),
});

// generate_packaging_plan
export const GeneratePackagingPlanInputSchema = z.object({
  source_dir: SourceDirSchema,
  goals: z.array(z.string()).describe('目标产物列表（如 ["Docker", "deb"]）'),
  target_environment: z.string().optional().describe('目标环境（如 ubuntu-22.04）'),
});

export const GeneratePackagingPlanOutputSchema = ForgeKitResultSchema.extend({
  plan_path: z.string().optional().describe('生成的 Forge.md 路径'),
  summary: z.string().optional().describe('打包计划摘要'),
});

// build_docker_image（构建类，强制 plan_path）
export const BuildDockerImageInputSchema = z.object({
  source_dir: SourceDirSchema,
  plan_path: PlanPathSchema.describe('**必需**：Forge.md 路径（强制 Plan-before-build）'),
  image_name: z.string().describe('镜像名'),
  tags: z.array(z.string()).optional().default(['latest']).describe('镜像标签'),
  platform: z.enum(['linux/amd64', 'linux/arm64']).optional().default('linux/amd64').describe('目标平台（v0.1 只支持 linux/amd64）'),
  dockerfile_path: z.string().optional().default('Dockerfile').describe('Dockerfile 路径'),
});

export const BuildDockerImageOutputSchema = ForgeKitResultSchema.extend({
  image_ref: z.string().optional().describe('构建出的镜像引用'),
  size_bytes: z.number().optional().describe('镜像大小'),
  result_json: z.object({
    exit_code: z.number().describe('构建进程退出码'),
    stdout_snippet: z.string().describe('标准输出摘要'),
    stderr_snippet: z.string().optional().describe('标准错误摘要'),
    state_delta: z.record(z.unknown()).optional().describe('状态变化'),
  }).optional().describe('构建结果详情'),
  diagnosis: ErrorDiagnosticSchema.optional().describe('构建失败的结构化诊断'),
});

// pack_deb（构建类，强制 plan_path）
export const PackDebInputSchema = z.object({
  source_dir: SourceDirSchema,
  plan_path: PlanPathSchema.describe('**必需**：Forge.md 路径（强制 Plan-before-build）'),
  version: z.string().describe('包版本号'),
  distro: z.enum(['ubuntu-20.04', 'ubuntu-22.04', 'ubuntu-24.04']).optional().default('ubuntu-22.04').describe('目标发行版'),
  arch: z.enum(['x86_64', 'aarch64']).optional().default('x86_64').describe('目标架构'),
});

export const PackDebOutputSchema = ForgeKitResultSchema.extend({
  artifact_path: z.string().optional().describe('deb 产物路径'),
  checksum: z.string().optional().describe('SHA256 校验和'),
});

// ========== 导出类型（从 Schema 推导）==========

export type InspectProjectInput = z.infer<typeof InspectProjectInputSchema>;
export type InspectProjectOutput = z.infer<typeof InspectProjectOutputSchema>;

export type DiagnoseBuildFailureInput = z.infer<typeof DiagnoseBuildFailureInputSchema>;
export type DiagnoseBuildFailureOutput = z.infer<typeof DiagnoseBuildFailureOutputSchema>;

export type GeneratePackagingPlanInput = z.infer<typeof GeneratePackagingPlanInputSchema>;
export type GeneratePackagingPlanOutput = z.infer<typeof GeneratePackagingPlanOutputSchema>;

export type BuildDockerImageInput = z.infer<typeof BuildDockerImageInputSchema>;
export type BuildDockerImageOutput = z.infer<typeof BuildDockerImageOutputSchema>;

export type PackDebInput = z.infer<typeof PackDebInputSchema>;
export type PackDebOutput = z.infer<typeof PackDebOutputSchema>;
