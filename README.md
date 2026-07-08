# ForgeKit

> Agent-Native 多端打包工具箱
>
> 让会指挥 AI 的开发者，把项目从源码推进到可直接分发的多端安装包（不上架）。

<p>
  <a href="https://github.com/muzimu217/ForgeKit/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/muzimu217/ForgeKit?style=for-the-badge&logo=github&color=111827&labelColor=ffffff"></a>
  <a href="https://github.com/muzimu217/ForgeKit/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/github/license/muzimu217/ForgeKit?style=for-the-badge&color=2563eb&labelColor=ffffff"></a>
  <img alt="Package version" src="https://img.shields.io/badge/package-v0.1.0-cb3837?style=for-the-badge&logo=npm&logoColor=white">
  <img alt="Node.js" src="https://img.shields.io/badge/node-%3E%3D18-16a34a?style=for-the-badge&logo=node.js&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/typescript-MCP_Server-3178c6?style=for-the-badge&logo=typescript&logoColor=white">
</p>

## 项目定位

ForgeKit 不是另一个大而全的发布平台，也不是上架流程工具。它把现有多架构打包底座、多端打包知识和 MCP 工具接口组合起来，让 AI agent 可以调用标准化能力完成**多端打包**（服务器端、移动端、Web→移动端、桌面端），输出可直接分发的安装包。

核心目标只有一个：把”会写代码但不会打包分发”的项目，推进到可直接下载安装的状态（不涉及上架流程）。

| 层级 | 职责 | 当前状态 |
|------|------|----------|
| Agent 接入层 | MCP Server，向 Claude Code / Cline 等 agent 暴露工具 | v0.1 占位工具已建立 |
| 知识层 | 多端打包规则、决策依据、最佳实践和错误诊断 | 基础 YAML/Markdown 已建立 |
| 能力层 | `build_docker`、`pack_deb`、`pack_android_apk` 等原子能力 | 规划中，待文档评审后实现 |
| 多端适配层 | 服务器端、移动端、Web端、桌面端版本与模板 | 服务器端框架已建立，其他待扩展 |
| 底座层 | Docker、Gradle、Xcode、Electron 等构建工具 | 复用既有工程化能力 |

## 为什么做

传统多端打包要求开发者理解 Dockerfile、Gradle、Xcode、Electron、证书签名、多端适配和分发策略。ForgeKit 的判断是：这些知识密集、重复度高、容易出错的环节，适合沉淀成工具和知识库，再交给 AI agent 编排执行。

**核心价值**：
- ✅ 本地打包，不上架（简化流程）
- ✅ 多端适配（服务器端、移动端、Web→移动端、桌面端）
- ✅ Plan-before-build（先规划再执行，避免盲目构建）

面向用户：

| 用户 | 场景 | ForgeKit 提供什么 |
|------|------|-------------------|
| KCOS 社团成员 | 把课程、实验、社团项目做成多端可安装产物 | 低门槛打包路径和可解释过程 |
| 独立开发者 | 快速构建 Docker、deb/rpm、APK、IPA、exe 等产物 | 原子工具和模板 |
| Web开发者 | 把 Web 项目打包成 PWA 或混合应用（移动端可用） | Web→移动端打包能力 |
| AI Agent | 需要可靠调用多端打包能力 | MCP 工具、结构化输入输出、决策依据 |

## 快速了解当前版本

当前仓库处在 v0.0 规划冻结阶段：先完成需求文档、设计文档和技术计划评审，再进入 v0.1 能力开发。已存在的 `pack_deb` 和 `build_docker_image` 仍是工具定义和 Schema，占位执行逻辑待后续实现。

```bash
git clone https://github.com/muzimu217/ForgeKit.git
cd ForgeKit
npm install
npm run build
npm test
```

当前 MCP Server 入口：

```bash
npm run build
node dist/mcp-server/index.js
```

非 MCP 客户端（如 Codex）可用最小 CLI 兜底：

```bash
forgekit plan .     # 生成 Forge.md
forgekit build .    # 执行构建
```

## v0.1 初始版本范围

v0.1 只验证服务器端闭环，不追求平台化，也不扩展移动端：

| 模块 | v0.1 必须完成 | 不纳入 v0.1 |
|------|---------------|-------------|
| MCP Server | 列出工具、校验参数、执行工具并返回结构化结果 | 鉴权、多用户、Web UI |
| `inspect_project` | 识别项目语言、入口和已有打包配置 | 全语言深度分析 |
| `generate_packaging_plan` | 生成 `Forge.md`，让用户先审查打包策略 | 自动替用户决定所有发布策略 |
| `build_docker_image` | 构建 linux/amd64 Docker 镜像（硬闭环） | registry 推送、多架构 manifest |
| `pack_deb`（可选） | Python 项目打成 Ubuntu x86_64 `.deb` | rpm、跨发行版完整矩阵 |
| 知识库 | deb 与 Docker 基础规则、错误摘要、决策依据 | 完整自动修复知识库 |
| 模板 | 一个最小 Python 示例项目 | Go/TypeScript 多模板 |
| 测试 | 单元测试、MCP 集成测试、一次手动 E2E | 大规模兼容性测试 |

验收标准：在 AI agent 中表达”把这个 Python 项目打成可交付产物”，ForgeKit 先生成 `Forge.md` 供用户审查，再完成工具调用，输出可运行镜像（Docker 为硬闭环）、可选 `.deb`、构建日志、校验和与决策说明。

## 多端扩展路线

v0.1-v1.0 的多端扩展路线图：

| 端类型 | v0.1 | v0.2 | v0.3 | v0.4 | v0.5 | v1.0 |
|--------|------|------|------|------|------|------|
| **服务器端** | ✅ Docker + deb（可选） | ✅ rpm + 多语言 | ✅ 稳定 | ✅ | ✅ | ✅ 完整验收 |
| **移动端** | ❌ 不做 | ❌ 不做 | ✅ Android APK + iOS IPA | ✅ 验收 | - | ✅ 完整验收 |
| **Web→移动端** | ❌ 不做 | ❌ 不做 | ✅ PWA + Hybrid（并行） | ✅ 验收 | - | ✅ 完整验收 |
| **桌面端** | ❌ 不做 | ❌ 不做 | ❌ 不做 | ❌ 不做 | 🟡 可选（确认需求后） | ✅ 完整验收 |

**关键决策**：
- v0.1-v0.2：先验证服务器端闭环（最简单）
- v0.3：移动端和Web→移动端并行开发（需求可能比桌面端更高）
- v0.5：桌面端仅在确认真实需求后实现（避免过早扩展）
- v1.0：完整多端验收，公开试用

## 路线图

详细路线图集中维护在 [docs/ROADMAP.md](./docs/ROADMAP.md)。

| 阶段 | 目标 | 交付物 |
|------|------|--------|
| v0.0 | 完成规划冻结 | 需求文档、设计文档、技术计划、初步调研 |
| v0.1 | 跑通最小 Agent 打包闭环 | MCP Server、`Forge.md`、`pack_deb`、`build_docker_image`、Python 模板 |
| v0.2 | 从能跑到能用 | 错误诊断、GitHub Releases 输出、文档教程、更多测试 |
| v0.3 | 扩展真实项目覆盖 | `pack_rpm`、Go/TypeScript 模板、CI 集成 |
| v1.0 | 社团公测和开源发布 | 稳定 API、贡献指南、公开案例、发布流程 |

## 文档入口

| 文档 | 用途 |
|------|------|
| [需求文档](./docs/REQUIREMENTS.md) | 用户、痛点、商业价值、MVP 范围 |
| [设计文档](./docs/DESIGN.md) | 产品架构、分层职责、工具边界 |
| [技术计划](./docs/TECHNICAL_PLAN.md) | 开发前技术落地、目录、接口、测试顺序 |
| [Agent 接入](./docs/specs/AGENT_INTEGRATION.md) | MCP、Skill/Markdown、未来协议演进 |
| [打包文档规范](./docs/specs/PACKAGING_DOCUMENT.md) | `Forge.md` 的结构和用途 |
| [项目框架规范](./docs/specs/PROJECT_FRAMEWORK.md) | 标准框架约定与非合规适配（normalize） |
| [路线图](./docs/ROADMAP.md) | v0.1 到 v1.0 的阶段计划和验收标准 |
| [系统适配说明](./src/systems/README.md) | 各发行版版本、模板和打包知识入口 |
| [评审清单](./docs/REVIEW.md) | 文档和架构评审问题 |

## 和工业平台的区别

| 维度 | 工业发布平台 | ForgeKit |
|------|--------------|----------|
| 默认用户 | 平台工程师、SRE | 会使用 AI 的开发者和学生 |
| 操作方式 | 人写配置，人维护流水线 | 人表达目标，Agent 调工具执行 |
| 价值重点 | 稳定性、规模化、企业治理 | 低门槛、教学性、可解释 Agent 协同 |
| MVP 取舍 | 覆盖面优先 | 闭环优先 |

## 贡献方向

当前最需要的贡献不是直接扩功能，而是先把需求、设计和技术计划评审清楚，再进入 v0.1 闭环开发：

| 优先级 | 工作 |
|--------|------|
| P0 | 评审需求文档：用户、痛点、商业价值、MVP 是否成立 |
| P0 | 评审设计文档：框架是否可执行，边界是否清楚 |
| P0 | 评审技术计划：目录、接口、测试和开发顺序是否可落地 |
| P0 | 评审 Agent 接入方案和 `Forge.md` 是否成立 |
| P1 | 完成 3 个真实项目试点候选 |
| P2 | 进入第一轮能力层开发 |

## License

[MIT](./LICENSE)
