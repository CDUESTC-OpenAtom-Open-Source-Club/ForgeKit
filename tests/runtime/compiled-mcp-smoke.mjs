import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, '../..');
const serverEntry = path.join(projectRoot, 'dist/mcp-server/index.js');
const fixtureDir = path.join(projectRoot, 'tests/fixtures/sample-python-project');

const timeout = setTimeout(() => {
  console.error('Compiled MCP runtime smoke test timed out');
  process.exit(1);
}, 15_000);

const client = new Client(
  { name: 'forgekit-runtime-smoke', version: '0.1.0' },
  { capabilities: {} }
);

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverEntry],
  stderr: 'pipe',
});

try {
  await client.connect(transport);

  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), [
    'build_docker_image',
    'generate_packaging_plan',
    'inspect_project',
    'pack_deb',
  ]);

  const response = await client.callTool({
    name: 'inspect_project',
    arguments: { source_dir: fixtureDir },
  });
  assert.equal(response.content.length, 1);
  assert.equal(response.content[0].type, 'text');

  const result = JSON.parse(response.content[0].text);
  assert.equal(result.status, 'success');
  assert.equal(result.language, 'Python');
  assert.ok(result.entrypoints.includes('app.py'));

  console.log('Compiled MCP runtime smoke test passed');
} finally {
  clearTimeout(timeout);
  await client.close();
}
