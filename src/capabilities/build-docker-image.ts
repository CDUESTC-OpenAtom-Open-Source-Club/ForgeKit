/**
 * build_docker_image - Docker 镜像构建能力（v0.1 硬闭环）
 *
 * 流程：校验 plan_path → 校验 source_dir/Dockerfile → 检查 daemon → docker build → 采集结果
 * 符合 V0.1_IMPLEMENTATION M4 / DESIGN §5.3
 */

import * as fs from 'fs';
import * as path from 'path';
import { assertSourceDir, PathValidationError, pathExists } from './utils/filesystem.js';
import { runCommand, runCommandWithLog, commandExists, snippet } from './utils/command.js';
import type { BuildDockerImageOutput, BuildResult } from './types.js';
import { diagnoseBuildError } from './utils/error-diagnostic.js';
import { generateReleaseManifest, saveReleaseManifest } from './manifest-generator.js';

export interface BuildDockerInput {
  source_dir: string;
  plan_path: string;
  image_name: string;
  tags?: string[];
  platform?: string; // linux/amd64 | linux/arm64
  dockerfile_path?: string; // 默认 Dockerfile
}

export async function buildDockerImage(input: BuildDockerInput): Promise<BuildDockerImageOutput> {
  const {
    source_dir,
    plan_path,
    image_name,
    tags = ['latest'],
    platform = 'linux/amd64',
    dockerfile_path = 'Dockerfile',
  } = input;
  const absSourceDir = path.resolve(source_dir);

  // 1. 校验 source_dir
  try {
    assertSourceDir(absSourceDir);
  } catch (e) {
    if (e instanceof PathValidationError) {
      return failed(e.code as any, e.message, '请提供有效的项目根目录路径');
    }
    throw e;
  }

  // 2. 校验 plan_path（executor 已校验，此处双重保险）
  if (!pathExists(plan_path)) {
    return failed(
      'plan_not_found',
      `Forge.md 不存在: ${plan_path}`,
      '先调用 generate_packaging_plan'
    );
  }

  // 3. Dockerfile 检测/自动生成
  const absDockerfile = path.isAbsolute(dockerfile_path)
    ? dockerfile_path
    : path.join(absSourceDir, dockerfile_path);

  let dockerfileGenerated = false;
  if (!pathExists(absDockerfile)) {
    const lang = detectLanguageForDockerfile(source_dir);
    if (!lang) {
      return failed(
        'dockerfile_not_found',
        `未找到 Dockerfile 且无法识别语言以自动生成: ${absDockerfile}`,
        '请手动创建 Dockerfile，或确保项目包含可识别的语言文件（Python/Node/Go）'
      );
    }
    writeDefaultDockerfile(absDockerfile, lang, source_dir);
    dockerfileGenerated = true;
  }

  // 4. 检查 docker 可用性
  if (!commandExists('docker')) {
    return failed(
      'docker_daemon_unavailable',
      'docker 命令不可用（未安装或不在 PATH）',
      '安装 Docker 并确保 docker 在 PATH 中'
    );
  }

  const daemonCheck = runCommand('docker', ['version', '--format', '{{.Server.Version}}']);
  if (!daemonCheck.success) {
    return failed(
      'docker_daemon_unavailable',
      'Docker daemon 未运行',
      '启动 Docker Desktop（macOS/Windows）或 docker daemon（Linux）后重试'
    );
  }

  // 5. 构建（记录开始时间）
  const buildStartTime = Date.now();
  const fullImageRefs = tags.map((t) => `${image_name}:${t}`);
  const buildArgs = [
    'build',
    '--platform',
    platform,
    '-f',
    absDockerfile,
    ...fullImageRefs.flatMap((ref) => ['-t', ref]),
    absSourceDir,
  ];

  const buildResult = runCommandWithLog('docker', buildArgs, {
    cwd: absSourceDir,
    timeout: 300000,
    logFileName: `build-docker-image-${image_name}-${Date.now()}.log`,
  });

  const buildDurationMs = Date.now() - buildStartTime;

  // 6. 失败处理（使用智能诊断）
  if (!buildResult.success) {
    // 尝试智能诊断
    const diagnostic = diagnoseBuildError(
      buildResult.stderr || buildResult.stdout,
      buildResult.stderr
    );

    if (diagnostic) {
      return failed(
        diagnostic.code,
        diagnostic.summary,
        diagnostic.suggested_fix,
        buildResult.logPath,
        {
          exit_code: buildResult.exitCode,
          stdout_snippet: snippet(buildResult.stdout),
          stderr_snippet: snippet(buildResult.stderr),
          ...(diagnostic.detail && { diagnostic_detail: diagnostic.detail }),
        }
      );
    }

    // 未匹配到已知模式，返回通用错误
    return failed(
      'docker_build_failed',
      `docker build 失败（exit ${buildResult.exitCode}）`,
      '查看日志定位构建错误，常见：依赖安装失败、Dockerfile 语法错误',
      buildResult.logPath,
      {
        exit_code: buildResult.exitCode,
        stdout_snippet: snippet(buildResult.stdout),
        stderr_snippet: snippet(buildResult.stderr),
      }
    );
  }

  // 7. 采集镜像信息
  const sizeBytes = getImageSize(fullImageRefs[0]);
  const imageDigest = getImageDigest(fullImageRefs[0]);

  const result_json: BuildResult = {
    exit_code: buildResult.exitCode,
    stdout_snippet: snippet(buildResult.stdout),
    state_delta: {
      image_refs: fullImageRefs,
      dockerfile_generated: dockerfileGenerated,
      daemon_version: daemonCheck.stdout.trim(),
    },
  };

  // 8. 决策依据
  const decision_basis = {
    target_platform: platform,
    target_version: `Ubuntu 22.04 LTS（基础镜像）`,
    build_method: `docker build --platform ${platform}`,
    compatibility_notes: [
      'linux/amd64 镜像可在 x86_64 服务器运行',
      dockerfileGenerated ? `Dockerfile 由 ForgeKit 自动生成` : '使用项目已有 Dockerfile',
    ],
  };

  const warnings: string[] = [];
  if (dockerfileGenerated) {
    warnings.push(`已自动生成 ${path.relative(source_dir, absDockerfile)}，请审查内容`);
  }

  // 9. 生成Release Manifest（Git追溯）
  const manifest = generateReleaseManifest({
    sourceDir: source_dir,
    planPath: plan_path,
    targetPlatform: platform,
    targetArchitecture: platform.split('/')[1] || 'amd64',
    decisions: decision_basis.compatibility_notes,
    risksAcknowledged: [],
    artifacts: [
      {
        type: 'docker-image',
        name: fullImageRefs[0],
        path: fullImageRefs[0],
        size_bytes: sizeBytes || 0,
        checksum: {
          sha256: imageDigest,
        },
      },
    ],
    buildDurationMs,
    dockerVersion: daemonCheck.stdout.trim(),
  });

  // 保存Manifest
  const manifestPath = saveReleaseManifest(manifest, source_dir);
  warnings.push(`Release Manifest已保存到 ${path.basename(manifestPath)}`);

  return {
    status: 'success',
    artifacts: [
      {
        type: 'docker-image',
        path: fullImageRefs[0],
        size_bytes: sizeBytes,
      },
    ],
    logs: {
      path: buildResult.logPath,
      summary: `构建成功，镜像 ${fullImageRefs.join(', ')}（exit 0）`,
      full_available: true,
    },
    warnings,
    decision_basis,
    image_ref: fullImageRefs[0],
    size_bytes: sizeBytes,
    build_log: buildResult.logPath,
    result_json,
  };
}

// ========== 辅助函数 ==========

function failed(
  code: string,
  summary: string,
  suggestedFix: string,
  detailLog?: string,
  resultJson?: BuildResult
): BuildDockerImageOutput {
  return {
    status: 'failed',
    error: { code: code as any, summary, detail_log: detailLog, suggested_fix: suggestedFix },
    result_json: resultJson,
  };
}

function getImageSize(imageRef: string): number | undefined {
  const r = runCommand('docker', ['image', 'inspect', imageRef, '--format', '{{.Size}}']);
  if (r.success && r.stdout.trim()) {
    const size = parseInt(r.stdout.trim(), 10);
    return isNaN(size) ? undefined : size;
  }
  return undefined;
}

function getImageDigest(imageRef: string): string {
  const digestResult = runCommand('docker', [
    'image',
    'inspect',
    imageRef,
    '--format',
    '{{.Digest}}',
  ]);
  const digest = digestResult.success ? digestResult.stdout.trim() : '';
  if (digest.startsWith('sha256:') && digest.length > 'sha256:'.length) {
    return digest.slice('sha256:'.length);
  }

  const idResult = runCommand('docker', [
    'image',
    'inspect',
    imageRef,
    '--format',
    '{{.Id}}',
  ]);
  const imageId = idResult.success ? idResult.stdout.trim() : '';
  return imageId.startsWith('sha256:') ? imageId.slice('sha256:'.length) : imageId;
}

function detectLanguageForDockerfile(sourceDir: string): string | null {
  if (
    pathExists(path.join(sourceDir, 'pyproject.toml')) ||
    pathExists(path.join(sourceDir, 'requirements.txt')) ||
    pathExists(path.join(sourceDir, 'setup.py')) ||
    fs.readdirSync(sourceDir).some((f) => f.endsWith('.py'))
  ) {
    return 'Python';
  }
  if (pathExists(path.join(sourceDir, 'package.json'))) {
    const pkg = fs.readFileSync(path.join(sourceDir, 'package.json'), 'utf-8');
    return pkg.includes('"typescript"') ? 'TypeScript' : 'JavaScript';
  }
  if (
    pathExists(path.join(sourceDir, 'go.mod')) ||
    fs.readdirSync(sourceDir).some((f) => f.endsWith('.go'))
  ) {
    return 'Go';
  }
  return null;
}

function writeDefaultDockerfile(dockerfilePath: string, language: string, sourceDir: string): void {
  let content = '';
  if (language === 'Python') {
    const hasRequirements = pathExists(path.join(sourceDir, 'requirements.txt'));
    content = [
      '# Auto-generated by ForgeKit',
      'FROM python:3.10-slim',
      '',
      'WORKDIR /app',
      '',
      hasRequirements ? 'COPY requirements.txt .' : '',
      hasRequirements ? 'RUN pip install --no-cache-dir -r requirements.txt' : '',
      hasRequirements ? '' : '',
      'COPY . .',
      '',
      '# 请根据实际入口调整 CMD',
      'CMD ["python", "app.py"]',
      '',
    ].join('\n');
  } else if (language === 'JavaScript' || language === 'TypeScript') {
    content = [
      '# Auto-generated by ForgeKit',
      'FROM node:18-alpine',
      '',
      'WORKDIR /app',
      '',
      'COPY package*.json ./',
      'RUN npm install --omit=dev',
      '',
      'COPY . .',
      '',
      'CMD ["node", "index.js"]',
      '',
    ].join('\n');
  } else if (language === 'Go') {
    content = [
      '# Auto-generated by ForgeKit (multi-stage)',
      'FROM golang:1.21-alpine AS builder',
      'WORKDIR /src',
      'COPY . .',
      'RUN go build -o /app .',
      '',
      'FROM alpine:latest',
      'COPY --from=builder /app /app',
      'CMD ["/app"]',
      '',
    ].join('\n');
  }
  fs.writeFileSync(dockerfilePath, content, 'utf-8');
}
