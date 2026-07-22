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
    'diagnose_build_failure',
    'generate_packaging_plan',
    'inspect_project',
    'pack_deb',
    'pack_harmonyos_app',
    'preflight_check',
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

  const diagnosisResponse = await client.callTool({
    name: 'diagnose_build_failure',
    arguments: { log_text: 'failed to calculate checksum: "/missing.txt": not found' },
  });
  const diagnosisResult = JSON.parse(diagnosisResponse.content[0].text);
  assert.equal(diagnosisResult.status, 'success');
  assert.equal(diagnosisResult.diagnosis.code, 'docker_copy_failed');

  console.log('Compiled MCP runtime smoke test passed');
} finally {
  clearTimeout(timeout);
  await client.close();
}
