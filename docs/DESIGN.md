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

**`decision_basis` 字段示例**：

```json
// pack_deb 的 decision_basis 输出示例
{
  "decision_basis": "选择 Ubuntu 22.04 作为基础镜像，因为：\n1. 目标部署环境为 Ubuntu 服务器（用户指定）\n2. 22.04 是当前 LTS 版本，稳定性好\n3. 项目依赖 Python 3.10，Ubuntu 22.04 默认包含\n4. 构建容器使用 isolation=docker，确保环境隔离\n\n构建参数配置：\n- arch: x86_64（MVP 验收要求）\n- distro: ubuntu（用户项目运行环境）\n- version: 1.0.0（项目版本号）"
}

// build_docker_image 的 decision_basis 输出示例
{
  "decision_basis": "选择 python:3.10-slim 作为 base image，因为：\n1. 项目语言：Python，需要 Python 运行环境\n2. 镜像大小优先：slim 变体体积小（~150MB vs ~1GB），适合生产部署\n3. 平台支持：官方镜像支持 amd64/arm64 双架构\n4. 构建参数：未传入 build_args，使用默认配置\n\n平台选择：linux/amd64（MVP 验收要求 x86_64）\n标签策略：['1.0.0', 'latest']（版本标签 + 最新标签）"
}
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

**数据源**：`src/systems/*/versions.yaml`（系统版本清单）+ `src/systems/*/packaging-guide.md`（打包知识）+ `src/systems/*/issues/`（已知问题）

- **形态**：结构化 Markdown + 决策规则（YAML/JSON）
- **内容**：
  - deb vs rpm vs docker 选型决策树
  - 各发行版坑（glibc 依赖、包命名、服务管理差异）——**数据来源：versions.yaml**
  - 多架构注意点（aarch64 交叉编译、QEMU 模拟）——**数据来源：versions.yaml.arch_support**
  - 常见 CI 报错 → 修复映射表——**数据来源：issues/ 目录**
- **用途**：AI 选型时检索（读取 versions.yaml）；CI 失败时匹配修复（查询 issues/）
- **维护**：社团成员贡献经验，持续增长（这是 recurring 价值来源）
- **关联能力层**：pack_deb / build_docker_image 调用时，会读取对应系统的 versions.yaml 获取 glibc/Python 信息

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
| 能力层 | 单元测试 | **Vitest**（TypeScript 技术栈统一） | ≥ 60% |
| MCP Server | 集成测试 | **Vitest** + MCP SDK mock | ≥ 50% |
| 端到端 | E2E 测试 | 手动验收 | 1 个场景通过 |

**测试工具锁定理由**：
- MCP Server 已决策用 TypeScript，测试工具统一为 Vitest
- Vitest 与 Vite 生态集成良好，测试速度快、配置简单
- 社团成员对 Vitest 更熟悉（前端/全栈项目经验）

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

---

## 12. 项目目录结构（v0.1 MVP）

```
forgekit/
├── src/
│   ├── mcp-server/                  # MCP Server 入口
│   │   ├── index.ts                 # MCP Server 主入口
│   │   ├── tools/                   # 工具注册
│   │   │   ├── pack-deb.ts          # pack_deb 工具实现
│   │   │   ├── build-docker.ts      # build_docker_image 工具实现
│   │   │   └── registry.ts          # 工具注册表
│   │   └── schemas/                 # JSON Schema 定义
│   │       ├── pack-deb.schema.ts
│   │       └ build-docker.schema.ts
│   ├── capabilities/                # 能力层（CLI 调底座）
│   │   ├── cli/                     # CLI 入口
│   │   │   ├── index.ts             # CLI 主入口
│   │   │   ├── commands/            # 命令实现
│   │   │   │   ├── pack-deb.ts
│   │   │   │   ├── build-docker.ts
│   │   ├── utils/                   # 工具函数
│   │   │   ├── docker.ts            # Docker 操作封装
│   │   │   ├── logger.ts            # 日志工具
│   │   │   ├── validator.ts         # 参数校验
│   ├── knowledge/                   # 知识库
│   │   ├── deb-packaging.yaml       # deb 打包要点
│   │   ├── docker-best-practices.yaml # Docker 最佳实践
│   │   ├── decisions.yaml           # 选型决策树
│   ├── templates/                   # 模板文件
│   │   ├── python-project/          # Python 项目模板
│   │   │   ├── setup.py
│   │   │   ├── pyproject.toml
│   │   │   ├── Dockerfile.example
│   │   │   ├── README.md
├── tests/
│   ├── unit/                        # 单元测试
│   │   ├── capabilities/
│   │   │   ├── pack-deb.test.ts
│   │   │   ├── build-docker.test.ts
│   ├── integration/                 # 集成测试
│   │   ├── mcp-server.test.ts
│   ├── e2e/                         # E2E 测试
│   │   ├── python-project.test.ts
│   ├── fixtures/                    # 测试数据
│   │   ├── sample-python-project/
│   ├── vitest.config.ts             # Vitest 配置
├── docs/
│   ├── README.md                    # 项目首页
│   ├── REQUIREMENTS.md              # 需求文档
│   ├── DESIGN.md                    # 设计文档（本文档）
│   ├── REVIEW.md                    # 评审清单
│   ├── CHANGELOG.md                 # 变更日志（待添加）
│   ├── CONTRIBUTING.md              # 贡献指南（待添加 v0.2）
│   ├── TROUBLESHOOTING.md           # 故障排查（待添加 v0.2）
├── .github/
│   ├── workflows/
│   │   ├── test.yml                 # CI 测试（待添加编码阶段）
│   │   ├── release.yml              # 发布流程（待添加 v0.1 发布）
│   ├── ISSUE_TEMPLATE/
│   ├── PR_TEMPLATE/
├── package.json                     # Node.js 项目配置
├── tsconfig.json                    # TypeScript 配置
├── .eslintrc.js                     # ESLint 配置
├── .prettierrc                      # Prettier 配置
├── LICENSE                          # 开源协议（MIT）
├── README.md                        # 项目首页（简洁版）
```

### 目录结构说明

| 目录 | 职责 | MVP 状态 |
|------|------|----------|
| `src/mcp-server/` | MCP Server 实现，Agent 接入层 | ✅ v0.1 必做 |
| `src/capabilities/` | 能力层 CLI，调用底座 | ✅ v0.1 必做 |
| `src/knowledge/` | 知识库（YAML 格式） | ✅ v0.1 基础条目 |
| `src/templates/` | 项目模板仓库 | ✅ v0.1 Python 模板 |
| `tests/` | 测试代码（Vitest） | ✅ v0.1 单元 + 集成 |
| `docs/` | 文档 | ✅ 已完成 |
| `.github/workflows/` | CI 配置 | 🟡 编码阶段添加 |

### 编码规约（TypeScript 项目）

| 规约项 | 工具/规范 | 理由 |
|--------|----------|------|
| Linter | **ESLint** + `@typescript-eslint` | TypeScript 标准配置，社团熟悉 |
| Formatter | **Prettier** | 代码风格统一，减少争议 |
| Commit 规范 | **Conventional Commits** | 自动生成 CHANGELOG，语义化提交 |
| 分支命名 | `feat/*`, `fix/*`, `docs/*` | 清晰的分支分类 |
| PR 规范 | 必填描述 + 关联 Issue | 保证代码审查质量 |

---

## 13. 系统适配框架

ForgeKit 为每个主流操作系统建立了详细的打包框架，位于 `src/systems/` 目录。

### 13.0 框架归属说明

`src/systems/` 属于 **知识层 + 模板层的联合子集**：
- **知识层部分**：`versions.yaml`（系统版本数据）、`packaging-guide.md`（打包知识）、`issues/`（已知问题）
- **模板层部分**：`templates/`（打包模板文件，如 Dockerfile、control、spec）

**设计意图**：将"系统打包知识"和"打包模板文件"集中管理，便于 Agent 调用和用户查阅。

### 13.1 能力层调用流程

Agent 调用 `pack_deb` 或 `build_docker_image` 时，ForgeKit 会按以下流程调用系统适配框架：

```
Agent → MCP Server: pack_deb(source_dir, distro="ubuntu-22.04")
   ↓
MCP Server → 能力层 CLI:
   1. 读取 src/systems/ubuntu/versions.yaml
   2. 查找 Ubuntu 22.04 配置（glibc 2.35, Python 3.10）
   3. 选择构建镜像：ubuntu:22.04
   4. 使用模板：templates/Dockerfile.ubuntu-22.04
   5. 执行 packaging-guide.md 的打包流程
   6. 输出产物 + decision_basis（选择 Ubuntu 22.04 的理由）
   ↓
产物：package_1.0.0_amd64.deb
decision_basis: "选择 Ubuntu 22.04 LTS，因为..."
```

**关键数据流**：
- **输入**：用户指定的系统版本（如 `ubuntu-22.04`）
- **数据源**：`src/systems/ubuntu/versions.yaml`（获取 glibc/Python/镜像信息）
- **模板**：`src/systems/ubuntu/templates/Dockerfile.ubuntu-22.04`（构建环境）
- **知识**：`src/systems/ubuntu/packaging-guide.md`（打包流程）
- **输出**：产物 + decision_basis（可解释性）

### 13.2 与测试策略的关联

`packaging-guide.md` 描述的手动打包流程，会被抽象为 `pack_deb` 工具的自动化流程：

| 手动流程（packaging-guide.md） | 自动化流程（pack_deb 工具） | 测试覆盖（§11） |
|-------------------------------|----------------------------|----------------|
| 编写 debian/control | 自动生成 control（从 templates/） | 单元测试：control 生成逻辑 |
| 手动执行 dpkg-buildpackage | CLI 调用底座构建 | 单元测试：CLI 调用逻辑 |
| 使用 lintian 检查 | 自动质量检查 | 单元测试：质量检查逻辑 |
| 手动安装测试 | E2E 测试验证 | E2E 测试：完整流程验证 |

**测试策略 §11 覆盖点**：
- 能力层单元测试：验证 pack_deb 能正确读取 versions.yaml + 选择构建镜像
- MCP Server 集成测试：验证 Agent 调用 → pack_deb → 产物的完整链路
- E2E 测试：验证 packaging-guide.md 的手动流程可被自动化完成

### 13.1 支持的操作系统

| 系统 | 包格式 | 推荐版本 | 架构 | 文档位置 |
|------|--------|----------|------|----------|
| Ubuntu | deb | 20.04/22.04 LTS | x86_64/aarch64 | [src/systems/ubuntu/](../src/systems/ubuntu/) |
| Debian | deb | 11/12 Stable | x86_64/aarch64 | [src/systems/debian/](../src/systems/debian/) |
| CentOS | rpm | 9 Stream | x86_64/aarch64 | [src/systems/centos/](../src/systems/centos/) |
| EulerOS | rpm | 2.2/2.3/2.9 | x86_64/aarch64 | [src/systems/euleros/](../src/systems/euleros/) |
| Fedora | rpm | 38/39 | x86_64/aarch64 | [src/systems/fedora/](../src/systems/fedora/) |

### 13.2 每个系统的框架内容

每个系统目录包含：
```
src/systems/{system}/
├── versions.yaml              # 版本清单（glibc/Python/架构支持）
├── packaging-guide.md         # 打包完整指南（流程/模板/问题）
├── templates/                 # 打包模板文件
│   ├── Dockerfile.{system}-{version}
│   ├── control.template (deb) 或 spec.template (rpm)
│   ├── rules.template / rpmmacros.template
│   ├── postinst.template / service.template
├── issues/                    # 已知问题与解决方案
│   ├── glibc-dependency.md
│   ├── python-versions.md
```

### 13.3 版本选择决策逻辑

Agent 调用 `pack_deb` 时，ForgeKit 会：
1. 读取 `src/systems/ubuntu/versions.yaml`
2. 检查用户指定的目标版本（如 `distro: ubuntu-22.04`）
3. 选择对应的构建镜像（`ubuntu:22.04`）
4. 使用模板文件（`templates/Dockerfile.ubuntu-22.04`）
5. 输出 `decision_basis`（为什么选择 Ubuntu 22.04）

### 13.4 glibc 版本兼容性矩阵

| 构建系统 | glibc | 可运行系统 |
|----------|-------|-----------|
| Ubuntu 20.04 | 2.31 | Ubuntu 20.04/22.04/24.04 ✅ |
| Ubuntu 22.04 | 2.35 | Ubuntu 22.04/24.04 ✅，Ubuntu 20.04 ❌ |
| CentOS 9 | 2.34 | CentOS 9/EulerOS 2.9 ✅ |

**推荐策略**：在目标系统的**最低 glibc 版本**构建，确保向上兼容。

### 13.5 模板文件使用示例

**Ubuntu deb 打包**：
```bash
# 使用 ForgeKit 提供的 Dockerfile
docker build -f src/systems/ubuntu/templates/Dockerfile.ubuntu-22.04 .

# 或复制模板文件到项目
cp src/systems/ubuntu/templates/control.template debian/control
cp src/systems/ubuntu/templates/rules.template debian/rules
```

**CentOS RPM 打包**：
```bash
# 使用 RPM spec 模板
cp src/systems/centos/templates/spec.template package.spec

# 在 Docker 中构建
docker build -f src/systems/centos/templates/Dockerfile.centos-9 .
```

### 13.6 已知问题与解决方案

**问题 1：glibc 版本不兼容**
- 文档：`src/systems/ubuntu/issues/glibc-dependency.md`
- 解决方案：使用最低版本构建或静态链接

**问题 2：Python 版本不匹配**
- 文档：`src/systems/ubuntu/issues/python-versions.md`
- 解决方案：使用虚拟环境或明确依赖版本

**问题 3：aarch64 交叉编译**
- 解决方案：使用 Docker buildx 或原生 ARM 实例

### 13.7 后续完善计划

| 系统 | 状态 | 优先级 |
|------|------|--------|
| Ubuntu | ✅ 已完善（versions + guide + templates） | P0 完成 |
| Debian | 🟡 版本清单完成，指南待完善 | P1 |
| CentOS | 🟡 版本清单完成，指南待完善 | P1 |
| EulerOS | 🟡 版本清单完成，指南待完善 | P1 |
| Fedora | 🟡 版本清单完成，指南待完善 | P2 |
| openSUSE | 📅 待添加 | P2 |

**总览文档**：[src/systems/README.md](../src/systems/README.md)
