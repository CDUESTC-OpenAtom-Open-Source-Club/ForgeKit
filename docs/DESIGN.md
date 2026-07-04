# ForgeKit 设计文档 (Design)

> 版本：v0.1 草案 · 状态：初步撰写 · 更新：2026-07

---

## 1. 设计目标

- 把已完成的多架构打包底座，**原子化、Agent 友好化**地暴露给 AI agent。
- 复杂决策（选什么格式、怎么配 CI、报错怎么修）交给 **AI + 知识库**。
- 工具箱只提供**原子能力 + 知识 + 模板**，不做大而全平台。

---

## 2. 分层架构

```
┌────────────────────────────────────────────┐
│ ① 接入层 Agent Interface                    │
│   MCP Server · Agent Skills                │
├────────────────────────────────────────────┤
│ ② 知识层 Knowledge                          │
│   打包知识库 · 决策规则 · 排错经验            │
├────────────────────────────────────────────┤
│ ③ 能力层 Capabilities（原子工具）            │
│   pack_* · build_* · run_* · publish_*     │
├────────────────────────────────────────────┤
│ ④ 模板层 Templates                          │
│   Python / Go / TS 打包模板仓库              │
├────────────────────────────────────────────┤
│ ⑤ 底座层 Engine（已完成）                    │
│   多架构 CI/CD 流水线（aarch64 / x86_64）     │
└────────────────────────────────────────────┘
```

### 各层职责
| 层 | 职责 |
|----|------|
| ① 接入层 | AI agent 的统一入口。MCP server 暴露工具，Skills 描述能力。 |
| ② 知识层 | 沉淀工程化 know-how 喂给 AI。**这是和纯工具的关键区别——一半价值在知识。** |
| ③ 能力层 | 原子化工具，每个独立、I/O 明确、可被 AI 调用。 |
| ④ 模板层 | 降低「从零开始」门槛，fork 即用。 |
| ⑤ 底座层 | 已完成的硬核引擎，能力来源。 |

---

## 3. 核心组件

### 3.1 MCP Server（接入层核心）
- **语言**：TypeScript（`@modelcontextprotocol/sdk`）或 Python
- **职责**：把能力层的原子工具，按 MCP 协议暴露
- **每个工具**：`name` + `description` + JSON Schema 输入 + 结构化输出

### 3.2 能力层工具规范
每个原子能力遵循统一契约：

```
tool: pack_deb
input:
  source_dir: string
  arch: "x86_64" | "aarch64"
  distro: "ubuntu" | "centos" | ...
  version: string
output:
  artifact_path: string
  checksum: string
  build_log: string
  warnings: string[]
  decision_basis: string   # 为什么这么配，供 AI 解释
side_effect: 在隔离容器中执行
```

```
tool: build_docker_image
input:
  source_dir: string          # 项目根目录
  image_name: string           # Docker 镜像名（如 my-project）
  tags: string[]               # 标签列表（如 ["1.0.0", "latest"]）
  platforms: "linux/amd64" | "linux/arm64" | "linux/amd64,linux/arm64"
  dockerfile_path?: string     # 可选，默认 ./Dockerfile
  build_args?: { key: value }  # 可选，构建参数
output:
  image_ref: string            # 构建完成的镜像引用（如 my-project:1.0.0）
  manifest: string             # 多架构 manifest 信息
  build_log: string            # 构建日志
  size_bytes: number           # 镜像大小
  decision_basis: string       # 为什么选择这个 base image / 平台组合
side_effect: 在 Docker buildx 容器中执行多架构构建
```

**设计原则**：原子、可组合、可回滚、**可解释**（输出含决策依据，方便 AI 向用户解释）。

### 3.3 Tool Description 编写规范

每个 Tool 的 `description` 必须遵循以下规则：

**规则 1：精确描述行为，而非泛泛而谈**
- ✅ "将指定源码目录打包为 Debian (.deb) 格式系统包，支持指定架构和发行版"
- ❌ "打包 deb"

**规则 2：说明输入参数的含义和约束**
- ✅ "source_dir: 项目根目录路径，必须包含 setup.py 或 pyproject.toml"
- ❌ "source_dir: 源码路径"

**规则 3：说明输出的结构和用法**
- ✅ "返回 .deb 文件的路径、SHA256 校验和、及构建日志，用户可直接用 dpkg -i 安装"
- ❌ "返回构建结果"

### 3.4 知识库
- **形态**：结构化 Markdown + 决策规则（YAML/JSON）
- **内容**：
  - deb vs rpm vs docker 选型决策树
  - 各发行版坑（glibc 依赖、包命名、服务管理差异）
  - 多架构注意点（aarch64 交叉编译、QEMU 模拟）
  - 常见 CI 报错 → 修复映射表
- **用途**：AI 选型时检索；CI 失败时匹配修复
- **维护**：社团成员贡献经验，持续增长（这是 recurring 价值来源）

---

## 4. 典型数据流

### 场景 A：发布一个 Python 项目
```
用户 → Claude Code: "把这个 Python 项目打成 deb + docker，发到社团源"
   ↓ (Agent 查知识库选型)
Agent → ForgeKit MCP: pack_deb(source, arch=x86_64, distro=ubuntu)
   ↓ (能力层调底座：ubuntu 容器内构建)
底座 → deb 产物
   ↓
Agent → ForgeKit MCP: build_docker_image(source, archs=[amd64, arm64])
   ↓ (buildx 多架构)
底座 → 多架构镜像
   ↓
Agent → ForgeKit MCP: publish_repo(deb) + publish_docker(image)
   ↓
社团 apt 源 + registry
   ↓
Agent → 用户: 产物清单 + 安装方式（含决策解释）
```

### 场景 B：CI 失败自愈
```
CI 挂 → Agent 捕获日志
   ↓
Agent → ForgeKit MCP: diagnose_ci_failure(log)
   ↓ (知识库匹配：glibc 版本不匹配)
ForgeKit → 修复建议：降低构建 glibc / 换老发行版 base image
   ↓
Agent → 自动改 CI 配置 → 重跑 → 通过
```

### 4.3 Agent 调用失败的回退策略

| 失败场景 | 行为 | 重试策略 |
|----------|------|----------|
| 工具调用超时（> 120s） | 返回超时错误 + 当前进度 | 不自动重试，由 Agent 决定是否重试 |
| 构建失败（编译错误） | 返回完整构建日志 + 错误摘要 | Agent 分析日志后可选修复后重试 |
| Docker 守护进程不可用 | 返回明确的错误提示 + 修复指引 | 手动修复后重试 |
| 多架构部分失败 | 返回成功部分 + 失败部分的错误 | 部分成功视为成功（传递警告） |

---

## 5. 与已完成工业平台的关系

```
工业平台（已完成，硬核全功能）
   │
   ↓  参考-下放（按需原子化）
能力层（ForgeKit Capabilities）
   │
   ↓  适配社团场景 + Agent 友好
社团成员 + AI
```

- **工业平台 = 能力池 / 真理来源**
- **ForgeKit = 把工业能力，按「社团场景 + Agent 友好」下放**。不是阉割版，是面向不同消费者的再封装。

---

## 6. 技术选型

| 组件 | 选型 | 理由 |
|------|------|------|
| MCP Server | TypeScript | 官方 SDK 成熟，类型安全，社团熟悉 |
| 底座 | GitHub Actions + Docker 容器 | 已完成，直接复用 |
| 知识库 | Markdown + YAML | 可读、可贡献、AI 检索友好 |
| 隔离构建 | Docker 容器 | 多发行版隔离，已在用 |
| 多架构 | QEMU / 原生 runner 矩阵 | 底座已支持 |

---

## 7. 扩展性设计

- **新增能力** = 写一个原子工具 + 注册到 MCP + 补知识库条目（低成本下放）
- **新增语言模板** = 加一个模板仓库
- **新增发行版** = 底座已抽象，加 base image 即可
- **社团自托管** = 私有源 / registry 配置可插拔

---

## 8. MVP 架构（v0.1）

```
Claude Code ──MCP──▶ ForgeKit MCP Server (TypeScript)
                         ├─ pack_deb ──▶ [Docker: ubuntu base] ──▶ deb
                         └─ build_docker_image ──▶ [buildx] ──▶ image
                    ▲
              知识库（基础 deb / docker 要点）
                    ▲
         模板：python-project-template
```

- 砍到 **2 个能力、1 个模板、基础知识**
- 目标：跑通「AI 调用 → 产物」闭环，验证范式

---

## 9. 后续演进路线

| 版本 | 增量 |
|------|------|
| v0.1 | MVP：`pack_deb` + `build_docker_image` + Python 模板 |
| v0.2 | +`pack_rpm` + `publish_*` + `diagnose_ci_failure` |
| v0.3 | 多语言模板（Go/TS）+ CI 自愈增强 |
| v1.0 | 社团多成员实测、文档完善、公开冲 star |

---

## 10. 待定问题（需后续确认）

| # | 问题 | 选项 | 决策截止 | 推荐（来自多专家评审） |
|---|------|------|----------|----------------------|
| 1 | MCP Server 语言 | TypeScript / Python | **编码开始前** | TypeScript |
| 2 | 社团私有源地址 | GitHub Packages / 自建 | **v0.2 前** | MVP 不做，存 GitHub Releases |
| 3 | 能力层↔底座调用方式 | CLI / HTTP / 复用 workflow | **编码开始前** | CLI 调用 |
| 4 | 鉴权需求 | 不做 / 简单 token / OAuth | **v0.4 前** | MVP 不做，预留 auth 插槽 |

---

## 11. 测试策略（v0.1 草案）

### 11.1 测试分层

```
┌──────────────────────────────────┐
│  E2E 测试                        │  ← "AI 一句话 → 产物到手" 全链路
│  1 个端到端场景（Python 项目）     │
├──────────────────────────────────┤
│  集成测试                         │  ← 能力层 + 底座联合
│  MCP Server ↔ 能力层 ↔ 底座      │
├──────────────────────────────────┤
│  能力层单元测试                    │  ← 每个原子工具独立
│  pack_deb / build_docker_image   │
└──────────────────────────────────┘
```

### 11.2 各层测试要求

| 层级 | 测试类型 | 工具 | v0.1 覆盖率目标 |
|------|----------|------|----------------|
| 能力层 | 单元测试 | Vitest / Pytest | ≥ 60% |
| MCP Server | 集成测试 | Vitest + MCP SDK mock | ≥ 50% |
| 端到端 | E2E 测试 | 手动验收 | 1 个场景通过 |

### 11.3 多架构正确性验证

每次提交自动执行（GitHub Actions + QEMU）：
- ✅ `x86_64` deb 构建成功
- ✅ `arm64` deb 构建成功（如果 MVP 包含）
- ✅ Docker 多架构 manifest 构建成功
- ✅ 产物 checksum 校验

### 11.4 验收前置条件

MVP 版本发布前必须：
1. 能力层单元测试通过率 ≥ 60%
2. MCP Server 集成测试通过率 ≥ 80%
3. 手动 E2E 测试通过（Python 项目 → deb + Docker 镜像）
4. 无已知 P0 级 Bug
