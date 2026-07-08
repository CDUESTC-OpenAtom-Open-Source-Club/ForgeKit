/**
 * Tool Executor - CallTool handler with plan_path enforcement
 *
 * 符合 V0.1_IMPLEMENTATION M1 要求：
 * - 构建类工具强制校验 plan_path
 * - 缺失时返回 plan_not_found 错误
 * - 所有调用返回结构化结果（含 decision_basis + result.json）
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { isBuildTool } from './registry.js';
import type { ForgeKitResult } from '@capabilities/types.js';

/**
 * Execute tool call
 *
 * M1 阶段：只实现协议层，不调用实际能力
 * 返回占位响应，但结构正确（符合 ForgeKitResult）
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<ForgeKitResult> {
  // ========== Step 1: 构建类工具强制校验 plan_path ==========
  if (isBuildTool(name)) {
    const planPath = args.plan_path as string | undefined;

    if (!planPath) {
      return {
        status: 'failed',
        error: {
          code: 'plan_not_found',
          summary: 'Forge.md 打包计划文件不存在',
          suggested_fix: '请先调用 generate_packaging_plan 生成 Forge.md，再执行构建',
          plan_correction: '构建类工具必须传入 plan_path 参数（Plan-before-build 强制约束）',
        },
        next_actions: ['调用 generate_packaging_plan 生成 Forge.md'],
      };
    }

    // TODO: M3 后验证 plan_path 文件是否存在
    // if (!fs.existsSync(planPath)) {
    //   return { status: 'failed', error: { code: 'plan_not_found', ... } };
    // }
  }

  // ========== Step 2: 路由到具体工具（M1 占位）==========
  switch (name) {
    case 'inspect_project':
      return executeInspectProject(args);

    case 'generate_packaging_plan':
      return executeGeneratePackagingPlan(args);

    case 'build_docker_image':
      return executeBuildDockerImage(args);

    case 'pack_deb':
      return executePackDeb(args);

    default:
      return {
        status: 'failed',
        error: {
          code: 'unknown_error',
          summary: `未知工具: ${name}`,
        },
      };
  }
}

// ========== 工具占位实现（M2-M5 后实现实际能力）==========

/**
 * M2: inspect_project（占位）
 */
async function executeInspectProject(
  args: Record<string, unknown>
): Promise<ForgeKitResult> {
  const sourceDir = args.source_dir as string;

  // M1 阶段：返回占位响应（结构正确）
  return {
    status: 'success',
    decision_basis: {
      build_method: 'inspect_project（协议层已实现，能力层待 M2 实现）',
    },
    next_actions: ['M2 阶段实现项目识别逻辑'],
    warnings: ['当前为协议层占位响应，未实现实际能力'],
  };
}

/**
 * M3: generate_packaging_plan（占位）
 */
async function executeGeneratePackagingPlan(
  args: Record<string, unknown>
): Promise<ForgeKitResult> {
  const sourceDir = args.source_dir as string;
  const goals = args.goals as string[] | undefined;

  // M1 阶段：返回占位响应（结构正确）
  return {
    status: 'success',
    decision_basis: {
      build_method: 'generate_packaging_plan（协议层已实现，能力层待 M3 实现）',
    },
    next_actions: ['M3 阶段实现 Forge.md 生成逻辑'],
    warnings: ['当前为协议层占位响应，未实现实际能力'],
  };
}

/**
 * M4: build_docker_image（占位）
 */
async function executeBuildDockerImage(
  args: Record<string, unknown>
): Promise<ForgeKitResult> {
  const sourceDir = args.source_dir as string;
  const planPath = args.plan_path as string;
  const imageName = args.image_name as string;

  // M1 阶段：返回占位响应（结构正确，含 decision_basis + result.json）
  return {
    status: 'success',
    decision_basis: {
      target_platform: 'linux/amd64',
      build_method: 'build_docker_image（协议层已实现，能力层待 M4 实现）',
    },
    warnings: ['当前为协议层占位响应，未实现实际能力'],
    next_actions: ['M4 阶段实现 Docker 构建逻辑'],
    // result.json 占位
    // artifacts: [{ type: 'docker-image', path: `${imageName}:latest` }],
  };
}

/**
 * M5: pack_deb（占位）
 */
async function executePackDeb(
  args: Record<string, unknown>
): Promise<ForgeKitResult> {
  const sourceDir = args.source_dir as string;
  const planPath = args.plan_path as string;
  const version = args.version as string;

  // M1 阶段：返回占位响应（结构正确）
  return {
    status: 'success',
    decision_basis: {
      target_platform: 'ubuntu-22.04',
      build_method: 'pack_deb（协议层已实现，能力层待 M5 实现）',
    },
    warnings: ['当前为协议层占位响应，未实现实际能力'],
    next_actions: ['M5 阶段实现 deb 打包逻辑（仅当目标为 Ubuntu + systemd）'],
  };
}