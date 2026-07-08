# ForgeKit Design

> 版本：v0.1 规划稿（多端扩展版）
> 前置依赖：[REQUIREMENTS.md](./REQUIREMENTS.md)
> 本文回答：ForgeKit 的多端框架为什么这样设计，以及多端扩展路线如何分阶段落地。

## 1. 设计结论

ForgeKit v0.1 应采用“本地优先、MCP 主接入、Markdown 打包计划、能力收窄”的架构。

不建议第一版做完整发布平台，也不建议同时支持多语言、多发行版、多包格式。第一版只需要证明：

1. Agent 可以稳定发现和调用工具。
2. 工具能在本地生成可验证产物。
3. 失败时能返回可读原因。
4. 输出能解释构建决策。

## 2. 架构原则

| 原则 | 含义 |
|------|------|
| Local-first | v0.1 在用户本地执行，不依赖云服务和复杂账号体系 |
| Agent-native | 工具 Schema、错误、结果都面向 Agent 调用设计 |
| Protocol-pragmatic | 先支持 MCP 等已有协议，不先自研协议 |
| Plan-before-build | 先生成 `Forge.md`，再执行构建 |
| Narrow MVP（服务器端） | v0.1只做 Python + Docker + Ubuntu deb（可选），多端分阶段扩展 |
| Explainable | 每个工具输出决策依据，方便 Agent 向用户解释 |
| Composable | 能力要能独立调用，不做黑盒一键平台 |
| Reuse existing tools | 复用 Docker、dpkg、已有打包工具，不重写底层 |

## 3. 推荐分层

```
AI Agent / MCP Client
        |
        v
        Agent Integration Layer (接入策略)
        |
        v
        Packaging Plan — Forge.md (产物规范，非运行时代码)
        |
        v
        MCP Interface Layer
        |
        v
Capability Layer
        |
        v
System Adapter + Knowledge Layer
        |
        v
Local Tooling: Docker / dpkg / shell commands
```

### 3.1 Agent Integration Layer

职责：

- 支持 Codex、Claude Code、Cline、Cursor 等 Agent 的使用方式。
- v0.1 以 MCP 为主协议。
- 提供 Skill / Markdown 指南，帮助不完整支持 MCP 的 Agent 理解流程。
- 不自研新协议。

详细协议规划见 [specs/AGENT_INTEGRATION.md](./specs/AGENT_INTEGRATION.md)。项目框架与适配规范见 [specs/PROJECT_FRAMEWORK.md](./specs/PROJECT_FRAMEWORK.md)。

### 3.2 Packaging Plan（产物规范，非运行时代码）

职责：

- 生成项目级 `Forge.md`（这是产物文件，不是运行时架构层）。
- 记录项目语言、目标产物、目标平台、决策依据、风险和结果。
- 作为人类、Agent、后续 CI 的共同上下文。

它是 ForgeKit 的独特性之一：构建前先形成可审查的打包计划，而不是让 Agent 直接尝试命令。

规范见 [PACKAGING_DOCUMENT.md](./specs/PACKAGING_DOCUMENT.md)。

### 3.3 MCP Interface Layer

职责：

- 暴露工具列表。
- 定义输入 JSON Schema。
- 调用能力层。
- 返回结构化结果。

不负责：

- 不直接拼 Docker 命令。
- 不直接读系统模板。
- 不承担业务决策。

约束：`build_docker_image` / `pack_deb` 调用时必须携带 `Forge.md` 路径（`plan_path`），未提供则拒绝执行并返回 `plan_not_found`，确保 Plan-before-build 被强制而非依赖 Agent 自律。

### 3.4 Capability Layer

职责：

- 实现 `build_docker_image`、`pack_deb` 等原子能力。
- 校验输入路径、项目类型、目标平台。
- 调用本地工具。
- 捕获日志、产物路径、错误摘要。

v0.1 需要以下能力（计划前置 + 构建）：

| 能力 | 目标 |
|------|------|
| `inspect_project` | 识别项目语言、入口、已有打包配置 |
| `normalize_project` | 检测非合规项目并生成标准打包脚手架（不改写源码） |
| `generate_packaging_plan` | 生成或更新 `Forge.md` |
| `build_docker_image` | 为 Python 项目构建本地 Docker 镜像 |
| `pack_deb` | 为 Python 项目生成 Ubuntu 22.04 x86_64 deb 包（可选） |

v0.1 采用 **Docker 为硬闭环、`pack_deb` 为可选能力**：优先保证 `inspect_project`、`generate_packaging_plan` 和 `build_docker_image`；`pack_deb` 仅在目标环境确为 Ubuntu + systemd 时实现，否则后置。

### 3.5 System Adapter + Knowledge Layer

职责：

- 保存系统版本信息：Ubuntu 22.04、glibc、默认 Python 版本、架构映射。
- 保存模板：Dockerfile、debian/control、rules、postinst 等。
- 提供决策依据：为什么选这个系统、架构、依赖策略。
- 提供常见错误映射。

不负责：

- 不做大型知识库产品。
- 不做在线检索服务。
- 不把所有发行版一口气做完。

### 3.6 Local Tooling Layer

职责：

- Docker 负责镜像构建。
- dpkg/debhelper 负责 deb 包构建。
- shell 命令负责基础文件操作。

ForgeKit 不替代这些工具，只包装、编排和解释它们。

## 4. v0.1 数据流

### 4.1 Docker 构建

```
用户目标
  -> Agent 解析
  -> 生成/读取 Forge.md
  -> MCP 调 build_docker_image
  -> Capability 校验项目与 Dockerfile
  -> Docker build
  -> 返回 image_ref、日志、size、decision_basis
```

### 4.2 deb 构建

```
用户目标
  -> Agent 解析
  -> 生成/读取 Forge.md
  -> MCP 调 pack_deb
  -> Capability 校验 Python 项目
  -> System Adapter 选择 Ubuntu 22.04 + amd64
  -> 生成 debian/ 元数据
  -> dpkg/debhelper 构建
  -> 返回 artifact_path、checksum、日志、decision_basis
```

## 5. 工具契约

### 5.1 `inspect_project`

输入：

| 字段 | 类型 | 说明 |
|------|------|------|
| `source_dir` | string | 项目根目录 |

输出：

| 字段 | 说明 |
|------|------|
| `language` | 识别出的主要语言 |
| `runtime` | 运行时版本线索 |
| `entrypoints` | 可能入口 |
| `existing_packaging` | Dockerfile、pyproject、setup.py 等 |
| `recommendations` | 推荐打包目标 |

### 5.2 `generate_packaging_plan`

输入：

| 字段 | 类型 | 说明 |
|------|------|------|
| `source_dir` | string | 项目根目录 |
| `goals` | string[] | 目标产物，如 Docker、deb |
| `target_environment` | string | 目标系统或运行环境 |

输出：

| 字段 | 说明 |
|------|------|
| `plan_path` | `Forge.md` 路径 |
| `summary` | 打包计划摘要 |
| `warnings` | 风险和待确认项 |
| `next_actions` | 建议用户确认的问题 |

### 5.3 `build_docker_image`

输入：

| 字段 | 类型 | 说明 |
|------|------|------|
| `source_dir` | string | 项目根目录 |
| `image_name` | string | 镜像名 |
| `tags` | string[] | 镜像标签 |
| `platform` | string | v0.1 只支持 `linux/amd64` |
| `dockerfile_path` | string | 可选，默认 `Dockerfile` |

输出：

| 字段 | 说明 |
|------|------|
| `image_ref` | 构建出的镜像引用 |
| `build_log` | 构建日志 |
| `size_bytes` | 镜像大小 |
| `warnings` | 非致命风险 |
| `decision_basis` | 构建决策说明 |

### 5.4 `pack_deb`

输入：

| 字段 | 类型 | 说明 |
|------|------|------|
| `source_dir` | string | Python 项目根目录 |
| `version` | string | 包版本 |
| `distro` | string | v0.1 固定 `ubuntu-22.04` |
| `arch` | string | v0.1 固定 `x86_64` |

输出：

| 字段 | 说明 |
|------|------|
| `artifact_path` | deb 产物路径 |
| `checksum` | SHA256 |
| `build_log` | 构建日志 |
| `warnings` | 风险说明 |
| `decision_basis` | 系统、架构、依赖选择依据 |

## 6. 为什么这个框架可执行

| 风险 | 设计控制 |
|------|----------|
| 范围过大 | v0.1 锁定 Python、Ubuntu 22.04、x86_64、本地执行 |
| Agent 难调用 | 工具 Schema 收窄，输出结构化 JSON |
| Agent 只会读文档不会调工具 | 提供 Skill/Markdown 指南和 `Forge.md` |
| 构建决策不可审查 | 构建前先生成项目级打包文档 |
| 打包细节复杂 | 先复用 dpkg/debhelper，不重写打包器 |
| 多发行版适配困难 | v0.1 只实现 Ubuntu，其他系统保留知识文件 |
| 商业价值不确定 | 需求调研作为进入深度开发的前置条件 |

## 7. 不采用的方案

| 方案 | 不采用原因 |
|------|------------|
| 直接做 Web 平台 | 过早引入账号、权限、任务队列、云构建问题 |
| 只做 CLI | CLI 对人友好，但无法体现 Agent-native 的核心差异 |
| 自研协议优先 | 协议生态成本高，v0.1 先复用 MCP |
| 先做全发行版支持 | 会拖垮 v0.1 验证周期 |
| 只做 Docker | 可能更简单，但无法验证系统包交付价值；若调研不支持 deb，再调整 |
| 复用 GitHub Actions 作为主执行层 | 对本地试用和快速反馈不友好 |

## 8. 未来扩展设计

| 阶段 | 扩展方向 |
|------|----------|
| v0.2 | 错误诊断、GitHub Releases 产物归档、更多真实项目样例 |
| v0.3 | Go/TypeScript 模板、rpm、arm64 可选验证 |
| v1.0 | 稳定工具 Schema、贡献指南、公开案例、社区试用 |

## 9. 架构评审问题

开发前必须回答：

1. v0.1 是否仍需要 deb，还是调研显示 Docker-first 更合理？
2. MCP 是否是主入口，还是 CLI 应成为主入口、MCP 做适配层？
3. `Forge.md` 是否能成为项目级打包计划标准？
4. 本地构建是否足够满足试点用户，还是必须接入 CI？
5. `decision_basis` 是否足够帮助用户信任 Agent 决策？
6. 第一版是否能在 2 周内完成可验证闭环？

这些问题没有结论前，不扩展能力层。
