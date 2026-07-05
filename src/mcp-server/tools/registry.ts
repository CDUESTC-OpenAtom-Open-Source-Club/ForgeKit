/**
 * Tool Registry - Register all available tools
 *
 * 编码阶段：这里会注册 pack_deb, build_docker_image 等工具
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Register all tools
 *
 * 编码阶段 TODO:
 * - 从 tools/pack-deb.ts 导入 pack_deb 工具定义
 * - 从 tools/build-docker.ts 导入 build_docker_image 工具定义
 * - 按照 DESIGN §3.3 规范编写 tool description
 */
export function registerTools(): Tool[] {
  return [
    // Placeholder: pack_deb (编码阶段实现)
    {
      name: 'pack_deb',
      description:
        '将指定源码目录打包为 Debian (.deb) 格式系统包，支持指定架构和发行版。' +
        'source_dir: 项目根目录路径，必须包含 setup.py 或 pyproject.toml。' +
        '返回 .deb 文件的路径、SHA256 校验和、及构建日志，用户可直接用 dpkg -i 安装。',
      inputSchema: {
        type: 'object',
        properties: {
          source_dir: {
            type: 'string',
            description: '项目根目录路径，必须包含 setup.py 或 pyproject.toml',
          },
          arch: {
            type: 'string',
            enum: ['x86_64', 'aarch64'],
            description: '目标架构（MVP 验收只要求 x86_64）',
          },
          distro: {
            type: 'string',
            enum: ['ubuntu-20.04', 'ubuntu-22.04', 'ubuntu-24.04'],
            description: '目标发行版版本',
          },
          version: {
            type: 'string',
            description: '包版本号（如 1.0.0）',
          },
        },
        required: ['source_dir', 'arch', 'distro', 'version'],
      },
    },

    // Placeholder: build_docker_image (编码阶段实现)
    {
      name: 'build_docker_image',
      description:
        '构建多架构 Docker 镜像，支持指定平台组合和构建参数。' +
        'source_dir: 项目根目录路径。' +
        '返回镜像引用、manifest 信息、构建日志和镜像大小。',
      inputSchema: {
        type: 'object',
        properties: {
          source_dir: {
            type: 'string',
            description: '项目根目录路径',
          },
          image_name: {
            type: 'string',
            description: 'Docker 镜像名（如 my-project）',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: '标签列表（如 ["1.0.0", "latest"]）',
          },
          platforms: {
            type: 'string',
            enum: ['linux/amd64', 'linux/arm64', 'linux/amd64,linux/arm64'],
            description: '目标平台（MVP 验收只要求 linux/amd64）',
          },
          dockerfile_path: {
            type: 'string',
            description: '可选，默认 ./Dockerfile',
          },
          build_args: {
            type: 'object',
            description: '可选，构建参数',
          },
        },
        required: ['source_dir', 'image_name', 'tags', 'platforms'],
      },
    },
  ];
}