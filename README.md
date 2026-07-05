# ForgeKit 🔨

> **Agent-Native Build & Release Platform**
> 让「会指挥 AI」的人，就具备从代码到多平台发布的完整能力。

`状态: 🏗️ 早期开发中` · `定位: 社团工程化基础设施 + AI Agent 协同` · `私有仓库（MVP 跑通后公开）`

---

## 这是什么

ForgeKit 站在 2026 AI Agent 爆发的节点上，重新定义「打包发布」这件事：

- **以前**：人要学会 Dockerfile、CI YAML、deb/rpm 规范、各发行版差异……才能把代码发布出去。
- **现在**：人只要对 AI 说「帮我把这个项目打包发布」，AI 调用 ForgeKit 的能力，完成编译、多架构打包、测试、上架全流程。

> **核心范式转移**：用户不需要成为打包专家，只要懂如何指挥 AI。

## 两层架构

```
┌─────────────────────────────────────────┐
│  Agent 技能层  (MCP Server / Skills)    │ ← 本次立项：AI 调用入口
├─────────────────────────────────────────┤
│  知识层  (打包 know-how / 决策规则)       │ ← 喂给 AI 做选型与自愈
├─────────────────────────────────────────┤
│  能力层  (原子工具: pack / build / pub)  │
├─────────────────────────────────────────┤
│  底座层  (多架构 CI/CD 引擎 · 已完成)    │ ← aarch64/x86_64 · 多发行版
└─────────────────────────────────────────┘
```

- **底层已完成**：覆盖 `aarch64/x86_64` 多架构、`EulerOS/CentOS/Ubuntu` 多发行版、`Docker/deb/rpm` 多格式的 CI/CD 打包流水线。
- **上层本次做**：把底层能力**原子化、Agent 友好化**，通过 MCP 服务暴露给 AI agent。

## 🚀 快速开始（v0.1 MVP）

### 环境要求
- **Docker**（底座构建隔离环境）
- **MCP 客户端**（Claude Code / Cline 等，用于调用 Agent 能力）

### 一分钟体验（待建设：v0.1 MVP 发布后可用）

> ⚠️ **当前状态**：v0.1 正在编码阶段，以下命令暂未可用。文档框架已就绪，实际工具将在 MVP 完成后发布。

```bash
# 1. 克隆项目模板（待建设）
# git clone https://github.com/muzimu217/forgekit-python-template my-project
# cd my-project

# 2. 启动 ForgeKit MCP Server（待建设）
# npx @forgekit/mcp-server

# 3. 在 Claude Code 中说：
#    "把这个 Python 项目打成 deb 包 + Docker 镜像"
#
#    AI 会自动调用 ForgeKit 完成：
#    ✓ 选择打包格式（基于项目语言自动判断）
#    ✓ 在隔离容器中编译构建
#    ✓ 输出 .deb 产物 + Docker 镜像
#    ✓ 解释每一步的决策原因

# 4. 验证产物
# ls -la dist/    # → project-1.0.0.deb
# docker images   # → project:1.0.0
```

### 验收标准（MVP 发布后）
> ✅ 从零开始，15 分钟内跑通"AI 一句话 → 打包产物到手"全流程。

### 当前如何参与
- 📖 阅读 [需求文档](./docs/REQUIREMENTS.md) 和 [设计文档](./docs/DESIGN.md)
- 💬 在 Issues 中提出建议和问题
- 🛠️ 等待 MVP 发布后试用并反馈

---

## 核心能力（规划）

| 能力 | 说明 |
|------|------|
| `pack_deb` / `pack_rpm` | 打包成系统原生包 |
| `build_docker_image` | 多架构 Docker 镜像构建 |
| `build_multi_arch` | 多架构矩阵构建 |
| `run_ci` / `run_tests` | 触发 CI / 测试 |
| `publish_repo` | 推送到 apt/yum 源 |
| `publish_docker` | 推送到 registry |
| `gen_install_script` | 生成一键安装脚本 |
| `gen_release_notes` | 自动生成 Release Note |
| `diagnose_ci_failure` | CI 失败诊断 + 自动修复建议 |

## 和 Vector 等工业平台的区别

| 维度 | Vector（工业级） | ForgeKit（社团向） |
|------|-----------------|-------------------|
| 用户 | 专业 SRE / 平台工程师 | 会用 AI 的开发者 / 学生 |
| 范式 | 人写复杂配置 | **AI 指挥 + 平台执行** |
| 目标 | 性能 / 覆盖度 / 稳定性 | 降低门槛、Agent 协同、教学 |
| 取舍 | 不会为低门槛/教学优化 | 专门做这件事 |

## 面向谁

- **主要**：KCOS 社团成员——从「会写代码」到「会发布上架」的关键一跃
- **次要**：任何想用 AI 简化打包发布流程的独立开发者

## 项目状态

🏗️ 早期开发中。当前正在撰写需求与设计文档（见 `docs/`）。

## 文档

- 📋 [需求文档 REQUIREMENTS](./docs/REQUIREMENTS.md)
- 🏗️ [设计文档 DESIGN](./docs/DESIGN.md)

## 路线图

项目演进规划参见：
- 📋 [需求文档](./docs/REQUIREMENTS.md)
- 🏗️ [设计文档](./docs/DESIGN.md)
- 📊 [评审框架（本地持久化）](https://github.com/muzimu217/forgekit-audit)（仅内部可见）

## 版本状态

| 版本 | 状态 | 聚焦 |
|------|------|------|
| v0.1 | 🏗️ 文档定稿 / 即将编码 | MVP：pack_deb + build_docker_image + Python 模板 |
| v0.2 | 📅 规划中 | +pack_rpm + publish_* + diagnose_ci_failure |
| v1.0 | 🎯 目标 | 社团公测 + 开源 |

---

*ForgeKit — 在 Agent 时代，把工程化能力交还给会指挥 AI 的人。*
