#!/usr/bin/env node
/**
 * ForgeKit 真实端到端验证（需在具备 Docker 的服务器上运行）
 *
 * 流程：inspect_project → generate_packaging_plan → build_docker_image（真实 Docker 构建）
 *      → docker run → /health 健康检查 → 清理容器
 *
 * 用法：node scripts/verify-remote.js
 * 前置：npm install && npm run build 已完成；服务器已安装并启动 Docker；可出网拉镜像。
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

// 编译后的 executor 暴露 executeTool
const { executeTool } = require('../dist/mcp-server/tools/executor.js');

const FIXTURE = path.resolve(__dirname, '../tests/fixtures/sample-python-project');
const IMAGE_NAME = 'demo-api';
const HEALTH_PORT = 8080;

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return { code: r.status, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() };
}

async function main() {
  console.log('=== ForgeKit 真实 E2E 验证 ===');

  // 0. 前置自查
  const docker = sh('docker', ['version', '--format', '{{.Server.Version}}']);
  if (docker.code !== 0) {
    throw new Error('Docker daemon 不可用，请先安装并启动 Docker');
  }
  console.log('[precheck] Docker server:', docker.stdout);

  // 1. 复制 fixture 到临时目录（避免污染源 fixture）
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgekit-verify-'));
  const proj = path.join(tmp, 'sample-python-project');
  fs.mkdirSync(proj, { recursive: true });
  for (const f of ['app.py', 'requirements.txt', 'pyproject.toml', 'Dockerfile']) {
    fs.copyFileSync(path.join(FIXTURE, f), path.join(proj, f));
  }
  console.log('[setup] project dir:', proj);

  // 2. inspect_project
  const ins = await executeTool('inspect_project', { source_dir: proj });
  console.log('[1/inspect]', JSON.stringify(ins, null, 2));
  if (ins.status !== 'success') throw new Error('inspect_project 失败');
  if (ins.language !== 'Python') throw new Error('语言识别异常: ' + ins.language);

  // 3. generate_packaging_plan
  const plan = await executeTool('generate_packaging_plan', {
    source_dir: proj,
    goals: ['Docker'],
    target_environment: 'ubuntu-22.04',
  });
  console.log('[2/plan]', JSON.stringify(plan, null, 2));
  if (plan.status !== 'success') throw new Error('generate_packaging_plan 失败');
  const planPath = plan.plan_path;
  if (!fs.existsSync(planPath)) throw new Error('Forge.md 未生成: ' + planPath);

  // 4. build_docker_image（真实 Docker 构建，硬闭环）
  const build = await executeTool('build_docker_image', {
    source_dir: proj,
    plan_path: planPath,
    image_name: IMAGE_NAME,
    tags: ['latest'],
    platform: 'linux/amd64',
  });
  console.log('[3/build]', JSON.stringify(build, null, 2));
  if (build.status !== 'success') {
    throw new Error('build_docker_image 失败: ' + build.error?.code + ' - ' + build.error?.summary);
  }
  if (!build.decision_basis) throw new Error('缺少 decision_basis（可验证契约未落实）');
  const imageRef = build.image_ref;
  console.log('[3/build] 镜像:', imageRef, '大小(bytes):', build.size_bytes);

  // 5. 运行容器并做健康检查
  const run = sh('docker', ['run', '-d', '-p', `${HEALTH_PORT}:${HEALTH_PORT}`, imageRef]);
  if (run.code !== 0) throw new Error('docker run 失败: ' + run.stderr);
  const cid = run.stdout;
  console.log('[4/run] container:', cid.slice(0, 12));

  let healthy = false;
  let body = '';
  for (let i = 0; i < 30; i++) {
    const c = sh('curl', ['-sf', `http://localhost:${HEALTH_PORT}/health`]);
    if (c.code === 0) {
      healthy = true;
      body = c.stdout;
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  // 6. 清理容器
  sh('docker', ['rm', '-f', cid]);

  if (!healthy) throw new Error('/health 健康检查未通过');
  console.log('[5/health]', body);

  console.log('\n✅ 真实端到端验证通过：inspect → plan → build(真实镜像) → run → /health');
}

main().catch((e) => {
  console.error('\n❌ 验证失败:', e.message);
  process.exit(1);
});
