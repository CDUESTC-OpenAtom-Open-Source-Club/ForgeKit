/**
 * Tool Executor - CallTool handler with plan_path enforcement
 *
 * 符合 V0.1_IMPLEMENTATION M1 要求：
 * - 构建类工具强制校验 plan_path（含文件存在性）
 * - 缺失时返回 plan_not_found 错误
 * - 所有调用返回结构化结果（含 decision_basis + result.json）
 */

import * as fs from 'fs';
import { isBuildTool } from './registry.js';
import type { ForgeKitResult } from '@capabilities/types.js';

// 真实能力实现（按里程碑逐步接入）
import { inspectProject } from '@capabilities/inspect-project.js';
import { generatePackagingPlan } from '@capabilities/generate-packaging-plan.js';

/**
 * Execute tool call
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<ForgeKitResult> {
  // ========== Step 1: 构建类工具强制校验 plan_path ==========
  if (isBuildTool(name)) {
    const planPath = args.plan_path as string | undefined;

    if (!planPath) {
      return planNotFound();
    }
    if (!fs.existsSync(planPath)) {
      return planNotFound(planPath);
    }
  }

  // ========== Step 2: 路由到具体工具 ==========
  switch (name) {
    case 'inspect_project':
      return inspectProject(args.source_dir as string);

    case 'generate_packaging_plan':
      return generatePackagingPlan(
        args.source_dir as string,
        (args.goals as string[]) || [],
        args.target_environment as string | undefined
      );

    case 'build_docker_image':
      return runBuildDockerImage(args);

    case 'pack_deb':
      return runPackDeb(args);

    default:
      return {
        status: 'failed',
        error: { code: 'unknown_error', summary: `未知工具: ${name}` },
      };
  }
}

function planNotFound(planPath?: string): ForgeKitResult {
  return {
    status: 'failed',
    error: {
      code: 'plan_not_found',
      summary: planPath
        ? `Forge.md 打包计划文件不存在: ${planPath}`
        : 'Forge.md 打包计划文件不存在',
      suggested_fix: '请先调用 generate_packaging_plan 生成 Forge.md，再执行构建',
      plan_correction: '构建类工具必须传入已存在的 plan_path（Plan-before-build 强制约束）',
    },
    next_actions: ['调用 generate_packaging_plan 生成 Forge.md'],
  };
}

// ========== 工具实现路由 ==========
// build_docker_image / pack_deb 用动态 require 渐进接入，避免引用未实现模块

async function runBuildDockerImage(args: Record<string, unknown>): Promise<ForgeKitResult> {
  const mod = tryRequire('@capabilities/build-docker-image.js');
  if (!mod) return notImplemented('build_docker_image', 'M4');
  return mod.buildDockerImage({
    source_dir: args.source_dir as string,
    plan_path: args.plan_path as string,
    image_name: args.image_name as string,
    tags: (args.tags as string[]) || ['latest'],
    platform: (args.platform as string) || 'linux/amd64',
    dockerfile_path: (args.dockerfile_path as string) || 'Dockerfile',
  });
}

async function runPackDeb(args: Record<string, unknown>): Promise<ForgeKitResult> {
  const mod = tryRequire('@capabilities/pack-deb.js');
  if (!mod) return notImplemented('pack_deb', 'M5');
  return mod.packDeb({
    source_dir: args.source_dir as string,
    plan_path: args.plan_path as string,
    version: args.version as string,
    distro: (args.distro as string) || 'ubuntu-22.04',
    arch: (args.arch as string) || 'x86_64',
  });
}

/**
 * 动态加载模块（运行时解析路径别名），失败返回 null
 */
function tryRequire(specifier: string): any | null {
  try {
    // @capabilities/* 别名在 tsconfig 中映射到 dist/capabilities/*
    const resolved = specifier.replace('@capabilities/', './capabilities/');
    const distPath = require('path').resolve(__dirname, '../../', resolved);
    return require(distPath);
  } catch {
    return null;
  }
}

/**
 * 能力未实现占位（plan_path 校验已通过）
 */
function notImplemented(toolName: string, milestone: string): ForgeKitResult {
  return {
    status: 'success',
    decision_basis: {
      build_method: `${toolName}（plan_path 已校验通过，能力层待 ${milestone} 实现）`,
    },
    warnings: [`当前为协议层占位响应，${milestone} 实现后返回真实结果`],
    next_actions: [`${milestone} 阶段实现实际能力`],
  };
}