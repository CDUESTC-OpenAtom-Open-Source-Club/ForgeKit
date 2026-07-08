/**
 * Tool Registry - Register all available MCP tools
 *
 * 符合 V0.1_IMPLEMENTATION M1 要求：
 * - 注册 4 个工具：inspect_project, generate_packaging_plan, build_docker_image, pack_deb
 * - 构建类工具标注是否要求 plan_path
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Register all tools
 */
export function registerTools(): Tool[] {
  return [
    // ========== M2: inspect_project ==========
    {
      name: 'inspect_project',
      description:
        '分析项目目录，识别语言、入口和已有打包配置。' +
        '返回项目类型、推荐打包目标、已有 Dockerfile/构建配置等信息。' +
        '不强制要求 Forge.md（非构建类工具）。',
      inputSchema: {
        type: 'object',
        properties: {
          source_dir: {
            type: 'string',
            description: '项目根目录路径',
          },
        },
        required: ['source_dir'],
      },
    },

    // ========== M3: generate_packaging_plan ==========
    {
      name: 'generate_packaging_plan',
      description:
        '生成项目级打包计划文件 Forge.md，记录目标产物、目标平台、决策依据、风险提示。' +
        '决策依据来自 decision-rules.yaml（如 glibc 版本、Python 版本、Ubuntu LTS 选择）。' +
        '不强制要求已有 Forge.md（非构建类工具）。',
      inputSchema: {
        type: 'object',
        properties: {
          source_dir: {
            type: 'string',
            description: '项目根目录路径',
          },
          goals: {
            type: 'array',
            items: { type: 'string' },
            description: '目标产物列表（如 ["Docker", "deb"]）',
          },
          target_environment: {
            type: 'string',
            description: '目标环境（如 ubuntu-22.04）',
          },
        },
        required: ['source_dir', 'goals'],
      },
    },

    // ========== M4: build_docker_image（硬闭环）==========
    {
      name: 'build_docker_image',
      description:
        '构建 Docker 镜像（v0.1 硬闭环）。' +
        '**强制要求 plan_path**（必须先生成 Forge.md），否则返回 plan_not_found 错误。' +
        '返回镜像引用、大小、构建日志、decision_basis（决策依据）和 result.json（构建结果）。',
      inputSchema: {
        type: 'object',
        properties: {
          source_dir: {
            type: 'string',
            description: '项目根目录路径',
          },
          plan_path: {
            type: 'string',
            description: '**必需**：Forge.md 路径（强制 Plan-before-build）',
          },
          image_name: {
            type: 'string',
            description: 'Docker 镜像名',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: '标签列表（默认 ["latest"]）',
          },
          platform: {
            type: 'string',
            enum: ['linux/amd64', 'linux/arm64'],
            description: '目标平台（v0.1 只支持 linux/amd64）',
          },
          dockerfile_path: {
            type: 'string',
            description: 'Dockerfile 路径（默认 ./Dockerfile）',
          },
        },
        required: ['source_dir', 'plan_path', 'image_name'], // plan_path 必需
      },
    },

    // ========== M5: pack_deb（可选）==========
    {
      name: 'pack_deb',
      description:
        '构建 Ubuntu deb 包（v0.1 可选）。' +
        '**仅当目标确为 Ubuntu + systemd 时实现**，否则后置到 v0.2。' +
        '**强制要求 plan_path**（必须先生成 Forge.md），否则返回 plan_not_found 错误。' +
        '返回 deb 产物路径、SHA256 校验和、构建日志、decision_basis。',
      inputSchema: {
        type: 'object',
        properties: {
          source_dir: {
            type: 'string',
            description: 'Python 项目根目录路径',
          },
          plan_path: {
            type: 'string',
            description: '**必需**：Forge.md 路径（强制 Plan-before-build）',
          },
          version: {
            type: 'string',
            description: '包版本号（如 1.0.0）',
          },
          distro: {
            type: 'string',
            enum: ['ubuntu-20.04', 'ubuntu-22.04', 'ubuntu-24.04'],
            description: '目标发行版（默认 ubuntu-22.04）',
          },
          arch: {
            type: 'string',
            enum: ['x86_64', 'aarch64'],
            description: '目标架构（默认 x86_64）',
          },
        },
        required: ['source_dir', 'plan_path', 'version'], // plan_path 必需
      },
    },
  ];
}

/**
 * 判断工具是否为构建类（需要强制 plan_path）
 */
export function isBuildTool(toolName: string): boolean {
  const buildTools = ['build_docker_image', 'pack_deb'];
  return buildTools.includes(toolName);
}