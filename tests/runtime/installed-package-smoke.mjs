import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgekit-package-smoke-'));
const packageDir = path.join(tempRoot, 'package');
const installDir = path.join(tempRoot, 'install');
const fixtureDir = path.join(tempRoot, 'fixture');

fs.mkdirSync(packageDir);
fs.mkdirSync(installDir);
fs.mkdirSync(fixtureDir);
fs.writeFileSync(
  path.join(fixtureDir, 'package.json'),
  JSON.stringify({ name: 'package-smoke-fixture', version: '1.0.0', main: 'app.js' })
);
fs.writeFileSync(path.join(fixtureDir, 'app.js'), 'console.log("ok");\n');

let client;
try {
  const packOutput = execFileSync(
    'npm',
    ['pack', '--ignore-scripts', '--json', '--pack-destination', packageDir],
    { cwd: projectRoot, encoding: 'utf8' }
  );
  const [{ filename }] = JSON.parse(packOutput);
  const tarball = path.join(packageDir, filename);

  execFileSync('npm', ['init', '-y'], { cwd: installDir, stdio: 'ignore' });
  execFileSync(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball],
    { cwd: installDir, stdio: 'ignore' }
  );

  const binName = process.platform === 'win32' ? 'forgekit-mcp.cmd' : 'forgekit-mcp';
  const binPath = path.join(installDir, 'node_modules', '.bin', binName);
  assert.ok(fs.existsSync(binPath), 'installed forgekit-mcp binary is missing');

  client = new Client(
    { name: 'forgekit-installed-package-smoke', version: '0.1.0' },
    { capabilities: {} }
  );
  const transport = new StdioClientTransport({ command: binPath, stderr: 'pipe' });
  await client.connect(transport);

  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), [
    'build_docker_image',
    'diagnose_build_failure',
    'generate_packaging_plan',
    'inspect_project',
    'pack_deb',
    'preflight_check',
  ]);

  const response = await client.callTool({
    name: 'generate_packaging_plan',
    arguments: { source_dir: fixtureDir, goals: ['Docker'] },
  });
  const result = JSON.parse(response.content[0].text);
  assert.equal(result.status, 'success');
  assert.ok(fs.existsSync(path.join(fixtureDir, 'Forge.md')));
  const plan = fs.readFileSync(path.join(fixtureDir, 'Forge.md'), 'utf8');
  assert.match(plan, /Distribution method: local/);

  const diagnosisResponse = await client.callTool({
    name: 'diagnose_build_failure',
    arguments: { log_text: 'ERROR: No matching distribution found for demo==99.0' },
  });
  const diagnosisResult = JSON.parse(diagnosisResponse.content[0].text);
  assert.equal(diagnosisResult.status, 'success');
  assert.equal(diagnosisResult.diagnosis.code, 'pip_package_not_found');

  console.log('Installed npm package smoke test passed');
} finally {
  if (client) {
    await client.close();
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
