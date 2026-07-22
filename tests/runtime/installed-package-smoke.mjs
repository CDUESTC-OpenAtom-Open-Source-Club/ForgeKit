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
  const stderrChunks = [];
  transport.stderr?.on('data', (chunk) => stderrChunks.push(chunk.toString()));
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

  const redactionResponse = await client.callTool({
    name: 'diagnose_build_failure',
    arguments: {
      log_text: 'password=hunter2 token=secret-token user@example.com /Users/alice/private-project failed unexpectedly',
    },
  });
  const redactionText = redactionResponse.content[0].text;
  assert.doesNotMatch(redactionText, /hunter2|secret-token|user@example\.com|\/Users\/alice/);
  assert.match(redactionText, /\[REDACTED\]/);
  assert.match(redactionText, /\[EMAIL\]/);
  assert.match(redactionText, /\/Users\/\[USER\]\//);

  const wrongTypeResponse = await client.callTool({
    name: 'diagnose_build_failure',
    arguments: { log_text: 42 },
  });
  const wrongTypeResult = JSON.parse(wrongTypeResponse.content[0].text);
  assert.equal(wrongTypeResult.status, 'failed');
  assert.equal(wrongTypeResult.error.code, 'invalid_input');

  const outsideLog = path.join(tempRoot, 'outside.log');
  fs.writeFileSync(outsideLog, 'password=must-not-be-read');
  const outsideLogResponse = await client.callTool({
    name: 'diagnose_build_failure',
    arguments: { source_dir: fixtureDir, log_path: outsideLog },
  });
  const outsideLogResult = JSON.parse(outsideLogResponse.content[0].text);
  assert.equal(outsideLogResult.status, 'failed');
  assert.equal(outsideLogResult.error.code, 'path_out_of_bounds');

  const invalidPlanResponse = await client.callTool({
    name: 'build_docker_image',
    arguments: {
      source_dir: fixtureDir,
      plan_path: path.join(tempRoot, 'missing-Forge.md'),
      image_name: 'must-not-build',
    },
  });
  const invalidPlanResult = JSON.parse(invalidPlanResponse.content[0].text);
  assert.equal(invalidPlanResult.status, 'failed');
  assert.equal(invalidPlanResult.error.code, 'plan_not_found');

  await new Promise((resolve) => setImmediate(resolve));
  const packageVersion = JSON.parse(
    fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')
  ).version;
  assert.ok(
    stderrChunks.join('').includes(
      `forgekit-mcp-server v${packageVersion} started`
    )
  );

  console.log('Installed npm package smoke test passed');
} finally {
  if (client) {
    await client.close();
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
