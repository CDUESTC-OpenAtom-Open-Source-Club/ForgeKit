/**
 * MCP tool registry.
 *
 * Input contracts live in schemas.ts. This module only supplies MCP metadata
 * and converts those contracts to protocol JSON Schema at the boundary.
 */

import { zodToJsonSchema } from 'zod-to-json-schema';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolInputSchemas, type ToolName } from './schemas.js';

const descriptions: Record<ToolName, string> = {
  inspect_project:
    '分析项目目录，识别语言、入口和已有打包配置，返回推荐打包目标。',
  preflight_check:
    '构建前环境检查，检查 Docker、源目录、磁盘空间、计划文件和镜像仓库连通性。',
  diagnose_build_failure:
    '只读分析 Docker/BuildKit 构建失败日志。必须且只能提供 log_text 或 log_path；使用 log_path 时必须提供 source_dir。',
  generate_packaging_plan:
    '生成项目级 Forge.md 打包计划，记录目标产物、平台、决策依据和风险提示。',
  build_docker_image:
    '构建 Docker 镜像。强制要求已存在的 plan_path（Plan-before-build）。',
  pack_deb:
    '构建 Ubuntu deb 包。强制要求已存在的 plan_path（Plan-before-build）。',
  pack_harmonyos_app:
    '构建鸿蒙（HarmonyOS NEXT）应用包（HAP 调试 / APP 上架）。强制要求已存在的 plan_path（Plan-before-build）。',
};

export function registerTools(): Tool[] {
  return (Object.keys(ToolInputSchemas) as ToolName[]).map((name) => {
    const inputSchema = zodToJsonSchema(ToolInputSchemas[name], {
      target: 'jsonSchema7',
      $refStrategy: 'none',
    }) as Tool['inputSchema'];

    return {
      name,
      description: descriptions[name],
      inputSchema: { ...inputSchema, required: inputSchema.required ?? [] },
    };
  });
}

export function isBuildTool(toolName: string): boolean {
  return toolName === 'build_docker_image' || toolName === 'pack_deb' || toolName === 'pack_harmonyos_app';
}

export function isToolName(value: string): value is ToolName {
  return Object.prototype.hasOwnProperty.call(ToolInputSchemas, value);
}
