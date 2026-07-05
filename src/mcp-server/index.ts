#!/usr/bin/env node

/**
 * ForgeKit MCP Server - Main Entry
 *
 * Agent-Native Build & Release Platform
 * 让「会指挥 AI」的人，就具备从代码到多平台发布的完整能力。
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

// Tool definitions
import { registerTools } from './tools/registry.js';

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

    // Execute tool logic (will be implemented in tools/*.ts)
    // For now, return placeholder response
    return {
      content: [
        {
          type: 'text',
          text: `Tool "${name}" called with arguments: ${JSON.stringify(args)}\n\nNote: Tool implementation pending (编码阶段实现)`,
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
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`${SERVER_NAME} v${SERVER_VERSION} started`);
  console.error('ForgeKit MCP Server ready for AI agent connections');
}

main().catch((error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});