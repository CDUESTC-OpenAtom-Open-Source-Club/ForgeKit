# ForgeKit

> 面向 AI Agent 的可验证交付契约层（Verifiable Delivery-Contract Layer）
>
> 让 AI Agent 把"能跑的代码"可靠推进到"可直接分发的产物"——带决策依据，可回溯验证。

<p>
  <a href="https://github.com/muzimu217/ForgeKit/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/muzimu217/ForgeKit?style=for-the-badge&logo=github&color=111827&labelColor=ffffff"></a>
  <a href="https://github.com/muzimu217/ForgeKit/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/github/license/muzimu217/ForgeKit?style=for-the-badge&color=2563eb&labelColor=ffffff"></a>
  <img alt="Package version" src="https://img.shields.io/badge/package-v0.1.0-cb3837?style=for-the-badge&logo=npm&logoColor=white">
  <img alt="Node.js" src="https://img.shields.io/badge/node-%3E%3D18-16a34a?style=for-the-badge&logo=node.js&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/typescript-MCP_Server-3178c6?style=for-the-badge&logo=typescript&logoColor=white">
</p>

## 项目定位

ForgeKit 是 **面向 AI Agent 的可验证交付契约层（Verifiable Delivery-Contract Layer for AI Agents）**。

它不重写打包工具，而是把"多端打包知识 + 决策依据 + 结构化观测"沉淀为一份**交付契约**，让任何主流 Agent（Claude Code / Cline / Cursor / Codex / Windsurf）都能通过标准 MCP 协议，把"能在本地跑起来的代码"可靠推进到"可直接分发的产物"。核心资产不是打包壳，而是 **`Forge.md` 决策契约 + `decision-rules.yaml` 约束 + `result.json` 观测回溯** 这三件套。

一句话：AI 能写代码，但常卡在编译、配置、环境的"最后一公里"——ForgeKit 用一份可被机器调用、可被人类审查、可被回溯验证的契约，把这道断点接上。

| 层级 | 职责 | 当前状态 |
|------|------|----------|
| 契约层（核心） | `Forge.md` 决策契约 + `decision-rules` 约束 + `result.json` 观测 | 规范已建立，v0.1 落地 |
| Agent 接入层 | 标准 MCP Server，向所有主流 Agent 暴露工具 | v0.1 占位工具已建立 |
| 知识层 | 多端打包规则、决策依据、最佳实践和错误诊断 | 基础 YAML/Markdown 已建立 |
| 能力层 | `build_docker`、`pack_deb`、`pack_android_apk` 等原子能力 | 规划中，待文档评审后实现 |
| 底座层 | Docker、Gradle、Xcode、Electron 等构建工具 | 复用既有工程化能力 |

## 为什么做

AI 编码 Agent 已成主流，但"交付"是新的断点：Agent 能写代码，却缺乏可靠、可解释、可验证的"交付契约"。市场调研（见 [`docs/MARKET_RESEARCH.md`](./docs/MARKET_RESEARCH.md)）显示：

- 多步交付任务复利错误率极高：20 步 × 95% 单步准确率 → 整体完成率仅 **35.8%**；开源框架真实负载平均完成率约 **50%**。
- 主流 Agent 在打包/部署上多是"沙箱内 Shell 硬试"，无交付契约，失败即静默或伪造成功。
- **63%** 的企业领导要求校验所有 Agent 输出（静默幻觉是头号顾虑）。

ForgeKit 的解法不是再写一个打包器，而是填补"Agent 交付层"空白：

- ✅ **契约优先（Plan-before-build）**：先生成可审查的 `Forge.md`，强制 `plan_not_found`，避免 Agent 盲目构建。
- ✅ **决策 + 观测**：每次构建返回 `decision_basis`（为什么这么构建）与 `result.json`（结构化结果回溯），而非只输出命令。
- ✅ **本地优先、不上架**：降低门槛，先把闭环跑通。

面向用户：

| 用户 | 场景 | ForgeKit 提供什么 |
|------|------|-------------------|
| KCOS 社团成员 | 课程/社团项目做成可安装产物 | 低门槛交付路径 + 可解释过程 |
| 独立开发者 | 交付 Docker 镜像或服务器安装包 | 原子工具、模板、决策依据 |
| 小型开发团队 | 让 AI 参与构建但需要可审查结果 | 可追溯计划、产物与失败诊断 |
| AI Agent 用户 | 已用 Claude Code/Cline/Cursor 写码 | 标准化交付契约与决策依据 |
| AI Agent 平台/集成商 | 给自家 Agent 加"发布/交付"能力 | 把 ForgeKit 当默认交付后端接入 |


当前 MCP Server 入口：

```bash
git clone https://github.com/muzimu217/ForgeKit.git
cd ForgeKit
npm install
npm run build
npm test          # 51 个测试（协议层 + 能力层 + E2E）
node dist/mcp-server/index.js
```

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

在 Agent 中说："把这个 Python 项目打包成可以在服务器上运行的版本。"

Agent 自动执行：

| 步骤 | 工具 | 输出 |
|------|------|------|
| 1 | `inspect_project` | 识别为 Python 项目，入口 app.py，已有 Dockerfile |
| 2 | `generate_packaging_plan` | 生成 `Forge.md`（含 Decisions/Risks 决策依据） |
| 3 | 用户审查 `Forge.md` | 确认目标平台、风险 |
| 4 | `build_docker_image` | 构建 Docker 镜像（**强制 plan_path**），返回 `decision_basis` + `result.json` |

**Plan-before-build 强制约束**：构建类工具（`build_docker_image` / `pack_deb`）必须传入已存在的 `Forge.md` 路径，缺失返回 `plan_not_found`。


## v0.1 初始版本范围（最具战略价值的 MVP）

> **为什么 v0.1 是"最值钱"的一版**：它要在**最便宜的表面（服务器端 Docker）**上，端到端证明 ForgeKit 的唯一论点——*带决策与观测的可验证交付契约*。后续所有版本都只是"把同一份契约扩展到更多端"；只有 v0.1 证明了契约本身成立。因此 v0.1 单位投入的战略价值最高。

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
| [产品与商业策略](./docs/PRODUCT_STRATEGY.md) | 可用性优先的定位、指标、开源/商业边界和 90 天行动 |
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
| P2 | 基于试点证据评估新平台与商业能力 |

## License

[MIT](./LICENSE)
