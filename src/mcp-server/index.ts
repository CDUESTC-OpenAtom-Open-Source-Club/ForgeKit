#!/usr/bin/env node

/**
 * ForgeKit MCP Server - Main Entry
 *
 * Agent-Native 多端打包工具箱
 * 所有 AI Agent 通过 MCP 协议接入
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

// Tool definitions and executor
import { registerTools } from './tools/registry.js';
import { executeTool } from './tools/executor.js';

// Server configuration
const SERVER_NAME = 'forgekit-mcp-server';
const SERVER_VERSION = '0.1.0';

/**
 * Create MCP Server instance
 */
const server = new Server(
  { name: SERVER_NAME, version: SERVER_VERSION },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Handler: List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = registerTools();
  return { tools };
});

/**
 * Handler: Execute tool call
 *
 * M1 阶段：使用 executor 路由（协议层）
 * - 构建类工具强制校验 plan_path
 * - 所有调用返回结构化结果
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Validate tool exists
    const tools = registerTools();
    const tool = tools.find((t) => t.name === name);

    if (!tool) {
      throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${name}`);
    }

    // Execute tool (with plan_path enforcement in executor)
    const result = await executeTool(name, args || {});

    // Return structured result as JSON (Agent 可解析)
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${(error as Error).message}`);
  }
});

/**
 * Start server with stdio transport
 */
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`${SERVER_NAME} v${SERVER_VERSION} started`);
  console.error('ForgeKit MCP Server ready for AI agent connections');
  console.error(
    '已注册工具：inspect_project, preflight_check, diagnose_build_failure, generate_packaging_plan, build_docker_image, pack_deb, pack_harmonyos_app'
  );
}

main().catch((error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});
