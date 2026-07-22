# ForgeKit

> 面向初学者与 AI Agent 的 Docker 构建诊断与验证助手
>
> 构建前发现问题，失败后解释原因，成功后验证镜像真的能运行。

ForgeKit 由电子科技大学成都学院开放原子开源社团维护，面向学生、教师、初学者与开源开发者免费开放。项目不以商业化为目标，优先追求清晰、普遍、可学习和可复现。

<p>
  <a href="https://github.com/CDUESTC-OpenAtom-Open-Source-Club/ForgeKit/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/CDUESTC-OpenAtom-Open-Source-Club/ForgeKit?style=for-the-badge&logo=github&color=111827&labelColor=ffffff"></a>
  <a href="https://github.com/CDUESTC-OpenAtom-Open-Source-Club/ForgeKit/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/github/license/CDUESTC-OpenAtom-Open-Source-Club/ForgeKit?style=for-the-badge&color=2563eb&labelColor=ffffff"></a>
  <img alt="Package version" src="https://img.shields.io/badge/package-v0.1.0-cb3837?style=for-the-badge&logo=npm&logoColor=white">
  <img alt="Node.js" src="https://img.shields.io/badge/node-%3E%3D18-16a34a?style=for-the-badge&logo=node.js&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/typescript-MCP_Server-3178c6?style=for-the-badge&logo=typescript&logoColor=white">
</p>

## 项目定位

ForgeKit 是 **面向初学者与 AI Agent 的 Docker 构建诊断与验证助手**。

它不重写 Docker，也不试图替代 CI。它通过 MCP 帮助 Agent 检查构建环境、识别常见失败、给出可执行建议，并验证最终镜像真实存在且能够运行。

一句话：当 Docker 构建失败时，ForgeKit 不只返回一整屏日志，而是告诉你哪里错了、证据是什么、下一步怎么做。

| 层级 | 职责 | 当前状态 |
|------|------|----------|
| 诊断层（核心） | Preflight、失败分类、证据和建议动作 | 已实现，持续增加真实样本 |
| 验证层（核心） | 构建镜像、确认镜像存在并运行健康检查 | 已通过真实 Docker CI |
| Agent 接入层 | 标准 MCP stdio，暴露五个结构化工具 | Node 18/20 已验证 |
| 项目上下文层 | 语言、入口、Dockerfile 和计划识别 | Python、TypeScript、Go 代表项目 |
| 证据层（辅助） | `Forge.md`、构建日志、Release Manifest | 已实现，不作为主要采用理由 |

## 为什么做

Docker 构建失败是真实且持续出现的问题；MCP 用户也确实需要调用 Docker。现有证据尚不能证明“AI Agent 专用打包平台”是强需求，因此 ForgeKit 先收敛到可直接验证的构建诊断问题。

ForgeKit 当前专注一个更具体的问题：帮助初学者和 AI Agent 发现、解释并验证 Docker 构建问题。

- ✅ **构建前诊断**：先检查目录、Docker、磁盘和 Registry；
- ✅ **失败可解释**：返回分类、证据、日志和建议动作；
- ✅ **结果真验证**：真实构建并运行容器，不把退出码当成全部证据；
- ✅ **本地优先**：不上传源码，不自动修改用户系统配置。

面向用户：

| 用户 | 场景 | ForgeKit 提供什么 |
|------|------|-------------------|
| 学生和初学者 | Docker 构建失败但看不懂日志 | 清楚的检查、解释与下一步 |
| AI Agent 用户 | Agent 反复运行 Docker 命令仍失败 | MCP 结构化诊断与验证 |
| 独立开发者 | 需要快速验证服务镜像 | Preflight、真实构建和健康检查 |
| 课程与社团 | 教学“代码到镜像”的完整过程 | 可复现样例和公开失败案例 |


当前 MCP Server 入口：

```bash
git clone https://github.com/CDUESTC-OpenAtom-Open-Source-Club/ForgeKit.git
cd ForgeKit
npm install
npm run build
npm run verify    # lint、类型检查、98 个测试、MCP 与安装包验收
node dist/mcp-server/index.js
```

安装与最短接入路径见 [安装与接入指南](./docs/GETTING_STARTED.md)。

### Agent 接入配置

在你的 MCP 客户端（Claude Code / Cline / Cursor / Codex / Windsurf）配置中：

```json
{
  "mcpServers": {
    "forgekit": {
      "command": "node",
      "args": ["/absolute/path/to/ForgeKit/dist/mcp-server/index.js"]
    }
  }
}
```

### 使用示例（Agent 闭环）

在 Agent 中说："先检查这个项目为什么可能无法构建 Docker 镜像，再尝试构建并验证。"

Agent 自动执行：

| 步骤 | 工具 | 输出 |
|------|------|------|
| 1 | `inspect_project` | 识别为 Python 项目，入口 app.py，已有 Dockerfile |
| 2 | `preflight_check` | 提前检查目录、计划、Docker、磁盘和 Registry |
| 3 | `generate_packaging_plan` | 生成当前构建所需的 `Forge.md` 安全门 |
| 4 | `build_docker_image` | 构建并验证 Docker 镜像，失败时返回诊断和日志 |

当前实现仍保留 `Forge.md` 构建安全门，缺失时返回 `plan_not_found`；它是防止误执行的机制，不是项目方向成立的前提，后续是否简化由试点数据决定。


## v0.1 已完成的技术基线

> v0.1 证明 MCP、计划、Docker 构建和结果验证可以形成技术闭环；它没有证明用户需要“交付契约层”。当前 v0.2 将用真实失败样本和外部用户验证诊断价值。

v0.1 只验证服务器端闭环，不追求平台化，也不扩展移动端：

| 模块 | v0.1 必须完成 | 不纳入 v0.1 |
|------|---------------|-------------|
| MCP Server | 列出工具、校验参数、执行工具并返回结构化结果 | 鉴权、多用户、Web UI |
| `inspect_project` | 识别项目语言、入口和已有打包配置 | 全语言深度分析 |
| `generate_packaging_plan` | 生成 `Forge.md`（决策契约），让用户先审查 | 自动替用户决定所有发布策略 |
| `build_docker_image` | 构建 linux/amd64 Docker 镜像（硬闭环），返回 `decision_basis` + `result.json` | registry 推送、多架构 manifest |
| `pack_deb`（可选） | Python 项目打成 Ubuntu x86_64 `.deb` | rpm、跨发行版完整矩阵 |
| 契约三件套 | `Forge.md` + `decision-rules` + `result.json` 强制串联 | 完整自动修复知识库 |
| 模板 / 测试 | 一个最小 Python 示例；单元 + MCP 集成 + 一次手动 E2E | 大规模兼容性测试 |

验收标准：在 AI agent 中表达"把这个 Python 项目打成可交付产物"，ForgeKit 先生成 `Forge.md` 供审查、再强制 `plan_path` 执行，输出可运行镜像（Docker 硬闭环）、可选 `.deb`、构建日志、SHA256 校验和，以及"为什么这么构建"的决策依据。

## 可用性优先的扩展路线

ForgeKit 不把“支持更多平台”当作唯一进度。先让更多真实项目通过同一条简单、可验证的交付路径成功，再按证据扩大产物和平台覆盖。

| 阶段 | 用户价值 | 扩展重点 |
|------|----------|----------|
| v0.1 | 核心闭环可运行 | Python → Docker/OCI；deb 按需可选 |
| v0.2 | 外部用户可独立使用 | 安装、MCP 配置、preflight、错误诊断、Git/产物追溯 |
| v0.3 | 常见项目广泛可用 | Python/Node.js/Go、amd64/arm64、CI、Release 归档 |
| v0.4 | 交付可信 | SBOM、provenance、策略检查与发布证据 |
| v1.0 | 稳定开源产品 | 稳定 Schema、插件边界、支持矩阵、公开案例 |

Windows、macOS、Android、iOS 和 PWA 只在真实需求、自动化验收环境和试点用户同时具备后进入排期。详见 [路线图](./docs/ROADMAP.md)。

## 路线图

详细路线图集中维护在 [docs/ROADMAP.md](./docs/ROADMAP.md)。

| 阶段 | 目标 | 交付物 |
|------|------|--------|
| v0.0 | 完成规划冻结 | 需求文档、设计文档、技术计划、初步调研 |
| v0.1 | 跑通最小 Agent 交付闭环 | MCP Server、`Forge.md`、Docker、可选 deb、Python 模板 |
| v0.2 | 从能跑到能用 | 安装接入、preflight、错误诊断、Release Manifest、真实试点 |
| v0.3 | 扩展真实项目覆盖 | Node.js/Go、arm64、CI、兼容性矩阵 |
| v1.0 | 稳定开源产品 | 稳定 API、贡献指南、公开案例、扩展机制 |

## 文档入口

| 文档 | 用途 |
|------|------|
| [产品与公共价值策略](./docs/PRODUCT_STRATEGY.md) | 可用性、教学价值、社区边界和 90 天行动 |
| [初学者文档站](./site/index.html) | 从“为什么需要”到第一次可验证交付的教学入口 |
| [安装与接入](./docs/GETTING_STARTED.md) | npm/npx、源码接入、最短 MCP 配置和成功标准 |
| [版本范围契约](./docs/VERSION_SCOPE.md) | 各版本承诺范围、非范围、验收门槛和退出条件 |
| [需求文档](./docs/REQUIREMENTS.md) | 历史需求与调研规划（当前执行范围以当前目标和路线图为准） |
| [设计文档](./docs/DESIGN.md) | 产品架构、分层职责、工具边界 |
| [技术计划](./docs/TECHNICAL_PLAN.md) | 开发前技术落地、目录、接口、测试顺序 |
| [Agent 接入](./docs/AGENT_INTEGRATION.md) | MCP、Skill/Markdown、未来协议演进 |
| [打包文档规范](./docs/specs/PACKAGING_DOCUMENT.md) | `Forge.md` 的结构和用途 |
| [项目框架规范](./docs/specs/PROJECT_FRAMEWORK.md) | 标准框架约定与非合规适配（normalize） |
| [路线图](./docs/ROADMAP.md) | 按可用性、广泛性与可信度推进的阶段计划和验收标准 |
| [系统适配说明](./src/systems/README.md) | 各发行版版本、模板和打包知识入口 |
| [评审清单](./docs/REVIEW.md) | 文档和架构评审问题 |
| [当前目标与范围](./docs/CURRENT_OBJECTIVES.md) | 当前可用性验证主线、范围和退出门槛 |
| [硬性验证记录](./docs/HARD_VALIDATION.md) | 当前可复现质量门禁与实测证据 |
| [安全与公开体验说明](./docs/SECURITY.md) | 本地执行边界、依赖审计和问题报告方式 |
| [支持矩阵](./docs/SUPPORT_MATRIX.md) | 当前版本实际验证过的语言、架构和运行环境 |
| [参与 ForgeKit](./CONTRIBUTING.md) | 初学者贡献路径、开发检查和问题提交规范 |

## 和工业平台的区别

| 维度 | 工业发布平台 | ForgeKit |
|------|--------------|----------|
| 默认用户 | 平台工程师、SRE | 会使用 AI 的开发者和学生 |
| 操作方式 | 人写配置，人维护流水线 | 人表达目标，Agent 调工具执行 |
| 价值重点 | 稳定性、规模化、企业治理 | 低门槛、教学性、可解释 Agent 协同 |
| MVP 取舍 | 覆盖面优先 | 闭环优先 |

## 贡献方向

当前最需要的贡献是让外部用户真正跑通交付闭环，而不是直接增加新平台：

| 优先级 | 工作 |
|--------|------|
| P0 | 完成干净环境安装、MCP 接入与首次交付体验 |
| P0 | 招募并支持 3 个真实试点项目 |
| P0 | 增加 preflight、错误分类和 Git/产物追溯 |
| P1 | 扩展 Python/Node.js/Go 的真实兼容性样本 |
| P2 | 基于试点证据评估新平台与公共教学能力 |

## License

[MIT](./LICENSE)
