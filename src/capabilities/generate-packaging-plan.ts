/**
 * generate_packaging_plan - 打包计划生成能力
 *
 * 流程：inspect → 读 decision-rules.yaml → 渲染 Forge.md → 写入项目根目录
 * 符合 V0.1_IMPLEMENTATION M3 / DESIGN §5.2
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { inspectProject } from './inspect-project.js';
import { assertSourceDir, PathValidationError, readTextFile } from './utils/filesystem.js';
import type { GeneratePackagingPlanOutput, DecisionBasis } from './types.js';

// Forge.md 模板路径（编译后位于 dist/packaging/）
const TEMPLATE_REL = path.resolve(__dirname, '../packaging/forge-template.md');

export async function generatePackagingPlan(
  sourceDir: string,
  goals: string[],
  targetEnvironment?: string
): Promise<GeneratePackagingPlanOutput> {
  // 1. 校验源目录
  try {
    assertSourceDir(sourceDir);
  } catch (e) {
    if (e instanceof PathValidationError) {
      return {
        status: 'failed',
        error: {
          code: e.code as any,
          summary: e.message,
          suggested_fix: '请提供有效的项目根目录路径',
        },
      };
    }
    throw e;
  }

  // 2. inspect 项目
  const inspectResult = await inspectProject(sourceDir);
  if (inspectResult.status === 'failed') {
    return {
      status: 'failed',
      error: inspectResult.error,
    };
  }

  // 3. 加载决策规则
  const decisionRules = loadDecisionRules();
  const warnings: string[] = [];
  if (!decisionRules) {
    warnings.push('未找到 decision-rules.yaml，决策依据将基于内置默认值');
  }

  // 4. 推导决策
  const decisions = deriveDecisions(goals, inspectResult, decisionRules, targetEnvironment);
  const risks = deriveRisks(decisionRules, goals);

  // 5. 渲染 Forge.md
  const forgeContent = renderForgeMd({
    sourceDir,
    inspectResult,
    goals,
    targetEnvironment,
    decisions,
    risks,
  });

  // 6. 写入项目根目录（不覆盖已有内容：若已存在，追加版本标记）
  const planPath = path.join(sourceDir, 'Forge.md');
  const writeResult = safeWritePlan(planPath, forgeContent);
  if (!writeResult.ok) {
    return {
      status: 'failed',
      error: {
        code: 'unknown_error',
        summary: `无法写入 Forge.md: ${writeResult.reason}`,
        suggested_fix: '检查目标目录写权限，或手动删除现有 Forge.md 后重试',
      },
    };
  }

  // 7. 生成 next_actions
  const nextActions = deriveNextActions(goals, inspectResult);

  return {
    status: 'success',
    plan_path: planPath,
    summary: `已生成 ${inspectResult.language || '未知语言'} 项目的打包计划，目标产物：${goals.join(', ')}`,
    warnings: [...(inspectResult.warnings || []), ...warnings],
    decision_basis: decisions,
    next_actions: nextActions,
  };
}

// ========== 项目名推导 ==========

function inferProjectName(sourceDir: string): string {
  // 优先 pyproject.toml [project] name
  const pyproject = readTextFile(path.join(sourceDir, 'pyproject.toml'));
  if (pyproject) {
    const m = pyproject.match(/name\s*=\s*["']([^"']+)["']/);
    if (m) return m[1];
  }
  // 其次 package.json name
  const pkg = readTextFile(path.join(sourceDir, 'package.json'));
  if (pkg) {
    try {
      const parsed = JSON.parse(pkg);
      if (parsed.name) return parsed.name;
    } catch {
      // ignore
    }
  }
  // 兜底：目录名
  return path.basename(path.resolve(sourceDir));
}

// ========== 决策规则加载 ==========

interface DecisionRules {
  端类型?: string;
  平台?: string;
  决策规则?: any;
  风险提示?: string[];
  兼容性对照表?: Record<string, { glibc: string; python: string; node: string; remark: string }>;
}

function loadDecisionRules(): DecisionRules | null {
  // decision-rules.yaml 位于 src/systems/servers/ubuntu/，编译后 dist/systems/... 被 exclude
  // 所以运行时从源码相对路径读取（开发与打包后均可用）
  const candidates = [
    path.resolve(__dirname, '../../src/systems/servers/ubuntu/decision-rules.yaml'),
    path.resolve(process.cwd(), 'src/systems/servers/ubuntu/decision-rules.yaml'),
    path.resolve(__dirname, '../systems/servers/ubuntu/decision-rules.yaml'),
  ];

  for (const candidate of candidates) {
    const content = readTextFile(candidate);
    if (content) {
      try {
        return yaml.load(content) as DecisionRules;
      } catch {
        continue;
      }
    }
  }
  return null;
}

// ========== 决策推导 ==========

function deriveDecisions(
  goals: string[],
  inspect: any,
  rules: DecisionRules | null,
  targetEnvironment?: string
): DecisionBasis {
  const isDocker = goals.some((g) => g.toLowerCase().includes('docker'));
  const isDeb = goals.some((g) => g.toLowerCase().includes('deb'));

  // Ubuntu 版本选择
  let ubuntuVersion = '22.04';
  if (targetEnvironment) {
    if (targetEnvironment.includes('20.04')) ubuntuVersion = '20.04';
    else if (targetEnvironment.includes('24.04')) ubuntuVersion = '24.04';
    else if (targetEnvironment.includes('22.04')) ubuntuVersion = '22.04';
  }

  // 基础镜像
  let baseImage = 'ubuntu:22.04';
  if (inspect.language === 'Python') {
    baseImage = `python:3.10-slim`;
  } else if (inspect.language === 'TypeScript' || inspect.language === 'JavaScript') {
    baseImage = 'node:18-alpine';
  } else if (inspect.language === 'Go') {
    baseImage = 'golang:1.21-alpine';
  }

  // 兼容性说明
  const compatNotes: string[] = [];
  const compatTable = rules?.兼容性对照表;
  if (compatTable && compatTable[`Ubuntu_${ubuntuVersion.replace('.', '_')}`]) {
    const row = compatTable[`Ubuntu_${ubuntuVersion.replace('.', '_')}`];
    compatNotes.push(`Ubuntu ${ubuntuVersion}: glibc ${row.glibc}, Python ${row.python}, Node ${row.node}`);
    compatNotes.push(`兼容性：${row.remark}`);
  }

  const buildMethodParts: string[] = [];
  if (isDocker) buildMethodParts.push('Docker 镜像构建（v0.1 硬闭环）');
  if (isDeb) buildMethodParts.push('Ubuntu deb 包（可选，仅 systemd 目标）');

  return {
    target_platform: `ubuntu-${ubuntuVersion}`,
    target_version: `Ubuntu ${ubuntuVersion} LTS`,
    build_method: buildMethodParts.join(' + ') || 'Docker 镜像（默认硬闭环）',
    compatibility_notes: compatNotes,
    risks_acknowledged: [],
  };
}

// ========== 风险推导 ==========

function deriveRisks(rules: DecisionRules | null, goals: string[]): string[] {
  const risks: string[] = [];
  if (rules?.风险提示) {
    risks.push(...rules.风险提示);
  } else {
    risks.push('glibc 版本不兼容：高版本构建的产物无法在低版本运行');
    risks.push('原生依赖缺失：目标系统需预装所需原生库');
    risks.push('Docker daemon 不可用：本地构建需 Docker 运行');
  }
  if (goals.some((g) => g.toLowerCase().includes('deb'))) {
    risks.push('deb 仅适用于 Ubuntu + systemd 环境，其他发行版需用 Docker');
  }
  return risks;
}

// ========== Forge.md 渲染 ==========

function renderForgeMd(ctx: {
  sourceDir: string;
  inspectResult: any;
  goals: string[];
  targetEnvironment?: string;
  decisions: DecisionBasis;
  risks: string[];
}): string {
  const { inspectResult: insp, goals, decisions, risks } = ctx;

  let template = readTextFile(TEMPLATE_REL);
  if (!template) {
    // 兜底：内联最小模板
    template = FALLBACK_TEMPLATE;
  }

  const projectName = inferProjectName(ctx.sourceDir);
  const entry = insp.entrypoints?.[0] || '（未检测到）';
  const primaryArtifact = goals[0] || 'Docker image';
  const secondaryArtifact = goals[1] || '无';

  // Decisions 段
  const decisionsSection = [
    `- Why Docker: ${goals.some((g) => g.toLowerCase().includes('docker')) ? 'v0.1 硬闭环，容器隔离、部署简单' : '未选择 Docker'}`,
    `- Why deb: ${goals.some((g) => g.toLowerCase().includes('deb')) ? '目标为 Ubuntu + systemd，系统级安装' : '未选择 deb（可选）'}`,
    `- Why Ubuntu version: ${decisions.target_version}`,
    `- Why base image: 与项目语言（${insp.language || '未知'}）匹配`,
    `- 兼容性: ${(decisions.compatibility_notes || []).join('；') || '基于内置默认值'}`,
  ].join('\n');

  // Risks 段
  const risksSection = risks.map((r) => `- ${r}`).join('\n');

  // Next Actions 段
  const nextActions = [
    '- 审查上方 Decisions 和 Risks 段',
    `- 确认目标平台：${decisions.target_platform}`,
    '- 确认后调用 build_docker_image（携带本文件路径作为 plan_path）',
  ];
  if (!insp.existing_packaging?.dockerfile) {
    nextActions.push('- 项目缺少 Dockerfile，构建时将自动生成默认模板');
  }
  const nextActionsSection = nextActions.join('\n');

  // verify command
  const verifyCommand = insp.language === 'Python'
    ? `docker run ${projectName}:latest`
    : 'docker run <image>:latest';

  return template
    .replace(/{{generated_at}}/g, new Date().toISOString())
    .replace(/{{project_name}}/g, projectName)
    .replace(/{{project_type}}/g, 'servers')
    .replace(/{{language}}/g, insp.language || '未知')
    .replace(/{{runtime}}/g, insp.runtime || '未知')
    .replace(/{{entry}}/g, entry)
    .replace(/{{primary_artifact}}/g, primaryArtifact)
    .replace(/{{secondary_artifact}}/g, secondaryArtifact)
    .replace(/{{target_platform}}/g, decisions.target_platform || 'linux/amd64')
    .replace(/{{target_users}}/g, '社团成员/独立开发者（本地分发）')
    .replace(/{{docker_strategy}}/g, goals.some((g) => g.toLowerCase().includes('docker')) ? 'build local linux/amd64 image' : '可选')
    .replace(/{{deb_strategy}}/g, goals.some((g) => g.toLowerCase().includes('deb')) ? 'package app + systemd service（可选）' : '不构建')
    .replace(/{{base_image}}/g, (decisions as any).baseImage || 'python:3.10-slim')
    .replace(/{{system_target}}/g, decisions.target_version || 'ubuntu-22.04')
    .replace(/{{decisions_section}}/g, decisionsSection)
    .replace(/{{risks_section}}/g, risksSection)
    .replace(/{{verify_command}}/g, verifyCommand)
    .replace(/{{next_actions_section}}/g, nextActionsSection);
}

// ========== 安全写入（不破坏用户内容） ==========

function safeWritePlan(planPath: string, content: string): { ok: boolean; reason?: string } {
  try {
    // 若已存在，先备份标记，再覆盖（Forge.md 是生成物，可安全覆盖）
    if (fs.existsSync(planPath)) {
      const existing = fs.readFileSync(planPath, 'utf-8');
      // 若用户手写了内容（含特定标记），追加而非覆盖
      if (existing.includes('<!-- user-managed -->')) {
        const appended = `\n\n<!-- regenerated at ${new Date().toISOString()} -->\n${content}`;
        fs.appendFileSync(planPath, appended);
        return { ok: true };
      }
    }
    fs.writeFileSync(planPath, content, 'utf-8');
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e.message };
  }
}

// ========== next_actions 推导 ==========

function deriveNextActions(goals: string[], inspect: any): string[] {
  const actions = ['审查生成的 Forge.md（Decisions / Risks 段）'];
  if (goals.some((g) => g.toLowerCase().includes('docker'))) {
    actions.push('调用 build_docker_image 执行构建（需携带 plan_path）');
  }
  if (goals.some((g) => g.toLowerCase().includes('deb'))) {
    actions.push('（可选）调用 pack_deb 构建 deb 包');
  }
  if (!inspect.existing_packaging?.dockerfile) {
    actions.push('项目无 Dockerfile，构建时自动生成');
  }
  return actions;
}

// ========== 兜底模板 ==========

const FALLBACK_TEMPLATE = `# ForgeKit Packaging Plan

> 由 ForgeKit 自动生成。生成时间：{{generated_at}}

## Project
- Name: {{project_name}}
- Type: {{project_type}}
- Language: {{language}}
- Runtime: {{runtime}}
- Entry: {{entry}}

## Goals
- Primary artifact: {{primary_artifact}}
- Secondary artifact: {{secondary_artifact}}
- Target platform: {{target_platform}}

## Build Strategy
- Docker: {{docker_strategy}}
- Base image: {{base_image}}
- System target: {{system_target}}

## Decisions
{{decisions_section}}

## Risks
{{risks_section}}

## Verify
- {{verify_command}}

## Results
- Docker image: pending
- Deb artifact: pending

## Next Actions
{{next_actions_section}}
`;
