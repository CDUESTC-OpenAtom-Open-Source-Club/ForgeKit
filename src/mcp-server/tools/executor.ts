/**
 * Tool Executor - CallTool handler with plan_path enforcement
 *
 * 符合 V0.1_IMPLEMENTATION M1 要求：
 * - 构建类工具强制校验 plan_path（含文件存在性）
 * - 缺失时返回 plan_not_found 错误
 * - 所有调用返回结构化结果（含 decision_basis + result.json）
 */

import * as fs from 'fs';
import { isBuildTool, isToolName } from './registry.js';
import { ToolInputSchemas } from './schemas.js';
import type { ForgeKitResult } from '../../capabilities/types.js';

// 真实能力实现（M2-M5 全部接入）
import { inspectProject } from '../../capabilities/inspect-project.js';
import { generatePackagingPlan } from '../../capabilities/generate-packaging-plan.js';
import { buildDockerImage } from '../../capabilities/build-docker-image.js';
import { packDeb } from '../../capabilities/pack-deb.js';
import { packHarmonyOS } from '../../capabilities/pack-harmonyos.js';
import { preflightCheck } from '../../capabilities/preflight-check.js';
import { diagnoseBuildFailure } from '../../capabilities/diagnose-build-failure.js';

/**
 * Execute tool call
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<ForgeKitResult> {
  if (!isToolName(name)) {
    return {
      status: 'failed',
      error: { code: 'unknown_error', summary: `未知工具: ${name}` },
    };
  }

  // Preserve the public Plan-before-build error contract. Other malformed
  // fields are handled by the shared Zod contract below.
  if (isBuildTool(name) && !args.plan_path) {
    return planNotFound();
  }

  const parsed = ToolInputSchemas[name].safeParse(args);
  if (!parsed.success) {
    return invalidInput(parsed.error.issues.map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`));
  }
  const input = parsed.data as Record<string, unknown>;

  // ========== Step 1: 构建类工具强制校验 plan_path ==========
  if (isBuildTool(name)) {
    const planPath = input.plan_path as string | undefined;

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
      return inspectProject(input.source_dir as string);

    case 'preflight_check':
      return preflightCheck({
        source_dir: input.source_dir as string,
        plan_path: input.plan_path as string | undefined,
        checks: input.checks as string[] | undefined,
      });

    case 'diagnose_build_failure':
      return diagnoseBuildFailure({
        log_text: input.log_text as string | undefined,
        log_path: input.log_path as string | undefined,
        source_dir: input.source_dir as string | undefined,
      });

    case 'generate_packaging_plan':
      return generatePackagingPlan(
        input.source_dir as string,
        input.goals as string[],
        input.target_environment as string | undefined
      );

    case 'build_docker_image':
      return buildDockerImage({
        source_dir: input.source_dir as string,
        plan_path: input.plan_path as string,
        image_name: input.image_name as string,
        tags: input.tags as string[],
        platform: input.platform as string,
        dockerfile_path: input.dockerfile_path as string,
      });

    case 'pack_deb':
      return packDeb({
        source_dir: input.source_dir as string,
        plan_path: input.plan_path as string,
        version: input.version as string,
        distro: input.distro as string,
        arch: input.arch as string,
      });

    case 'pack_harmonyos_app':
      return packHarmonyOS({
        source_dir: input.source_dir as string,
        plan_path: input.plan_path as string,
        build_target: input.build_target as 'hap' | 'app' | undefined,
        device_type: input.device_type as 'phone' | 'tablet' | '2in1' | 'wearable' | 'tv' | 'car' | undefined,
        api_version: input.api_version as string | undefined,
        signing_config_path: input.signing_config_path as string | undefined,
      });

  }
}

function invalidInput(issues: string[]): ForgeKitResult {
  return {
    status: 'failed',
    error: {
      code: 'invalid_input',
      summary: `工具输入无效: ${issues.join('; ')}`,
      suggested_fix: '根据工具定义补齐必填字段并修正字段类型',
    },
  };
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
