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

整体成长规划见规划仓库 `growth-roadmap`。

---

*ForgeKit — 在 Agent 时代，把工程化能力交还给会指挥 AI 的人。*
