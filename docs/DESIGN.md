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

**设计原则**：原子、可组合、可回滚、**可解释**（输出含决策依据，方便 AI 向用户解释）。

### 3.3 知识库
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

- [ ] MCP Server 语言最终选 TypeScript 还是 Python？
- [ ] 社团私有源 / registry 的具体地址与协议？
- [ ] 能力层与底座的调用方式（CLI / HTTP / 直接复用 workflow）？
- [ ] 是否需要鉴权（社团内部 vs 外部开源后的访问控制）？
