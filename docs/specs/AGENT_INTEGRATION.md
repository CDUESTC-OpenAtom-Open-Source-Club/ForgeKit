# ForgeKit Agent Integration

> 本文回答：ForgeKit 如何被 Codex、Claude Code、Cline、Cursor 等 Agent 使用，以及为什么 v0.1 选择 MCP 作为主协议。

> 相关子文档：[PROJECT_FRAMEWORK.md](./PROJECT_FRAMEWORK.md)（项目框架规范与适配）。

## 1. 接入结论

ForgeKit v0.1 采用：

1. MCP Server 作为主接入协议。
2. Agent Skill / Markdown 指南作为辅助接入方式。
3. `Forge.md` 作为项目内的打包计划文件。
4. 暂不自研新协议。

原因很直接：MCP 已经是多 Agent 工具调用的通用协议，适合表达工具、参数、结果和错误；Skill/Markdown 文档适合告诉 Agent 如何思考和组织任务；项目内 `Forge.md` 则负责记录具体项目的打包策略。

## 2. 目标 Agent

| Agent / 客户端 | v0.1 支持方式 | 说明 |
|----------------|---------------|------|
| Claude Code | MCP Server | 主验证对象之一 |
| Cline | MCP Server | 常见 MCP 客户端 |
| Cursor Agent | MCP Server / Markdown 指南 | 若 MCP 接入受限，可先用文档模式 |
| Codex | Markdown 指南 + 最小 CLI 兜底 | v0.1 暂无 MCP，用 `forgekit plan .` 生成 `Forge.md`、`forgekit build .` 执行构建 |
| 其他 Agent | MCP Server | 只要支持 MCP，即可调用 ForgeKit |

## 3. 为什么先 MCP

| 方案 | 优点 | 问题 | 结论 |
|------|------|------|------|
| MCP Server | 标准工具发现、参数 Schema、结构化输出、客户端生态已有 | 需要实现服务和 Schema | v0.1 主方案 |
| Skill / Markdown 文档 | 简单、可读、适合教学和提示 Agent | 不能强约束参数和执行结果 | 辅助方案 |
| CLI only | 对人友好，易调试 | Agent 需要自己推断命令和参数 | 作为能力层，不作为主协议 |
| 自研协议 | 可完全定制 | 生态成本高，用户要重新适配 | v1.0 前不做 |

v0.1 的判断是：先接已有协议，避免把项目难度浪费在协议发明上。

## 4. 三层接入模型

```
Agent
  |
  | 1. 读 Skill / Markdown 指南，理解任务策略
  v
Forge.md
  |
  | 2. 读取项目打包计划
  v
ForgeKit MCP Server
  |
  | 3. 调用 build_docker_image / pack_deb 等工具
  v
Local Tooling
```

### 4.1 Skill / Markdown 指南

用途：

- 告诉 Agent 如何判断项目类型。
- 告诉 Agent 先生成或读取 `Forge.md`。
- 告诉 Agent 优先调用 MCP 工具，而不是自己拼命令。
- 告诉 Agent 失败时如何总结错误和下一步。

它不是运行时协议，只是 Agent 行为说明。

### 4.2 `Forge.md`

用途：

- 记录项目的打包目标。
- 记录目标平台、产物类型、构建策略。
- 记录 Agent 和 ForgeKit 的决策依据。
- 作为人类、Agent、CI 都能读懂的项目打包说明。

它是 ForgeKit 的独特性之一：不是只执行命令，而是先把打包策略写成可审查文档。

### 4.3 MCP Server

用途：

- 向 Agent 暴露真实工具。
- 校验输入。
- 执行本地构建。
- 返回结构化结果。

v0.1 至少提供：

| 工具 | 目的 |
|------|------|
| `inspect_project` | 识别项目语言、入口、已有 Dockerfile/配置 |
| `normalize_project` | 检测非合规项目并生成标准打包脚手架（不改写源码） |
| `generate_packaging_plan` | 生成或更新 `Forge.md` |
| `build_docker_image` | 构建 Docker 镜像 |
| `pack_deb` | 构建 Ubuntu deb 包 |

v0.1 采用 **Docker 为硬闭环、`pack_deb` 为可选**：先实现 `generate_packaging_plan` + `build_docker_image`；`pack_deb` 仅在目标确为 Ubuntu + systemd 时实现，否则后置。非 MCP 客户端（如 Codex）通过 `forgekit plan .` / `forgekit build .` CLI 兜底，避免手拼计划。非合规项目先经 `normalize_project` 适配为标准框架（见 [PROJECT_FRAMEWORK.md](./PROJECT_FRAMEWORK.md)）。

## 5. Agent 使用流程

用户说：

```text
帮我把这个 Python 项目打包成可以交付的产物。
```

Agent 应该：

1. 调用 `inspect_project` 或读取项目文件。
2. 对结构"不三不四"的项目，先调用 `normalize_project` 适配为标准框架。
3. 生成 `Forge.md`。
4. 向用户确认目标：Docker-only（v0.1 硬闭环），还是 Docker + deb（可选）。
5. 调用 MCP 工具执行构建，构建必须携带 `Forge.md` 路径，否则拒绝。
6. 更新 `Forge.md` 中的结果和失败信息。
7. 返回产物路径、运行方式、风险和下一步。

## 6. 后续协议演进

短期不自研协议。只有在满足以下条件后，才考虑 ForgeKit 自有协议：

1. MCP 无法表达 ForgeKit 的关键能力。
2. 至少 3 个 Agent 客户端需要同一套更高层打包语义。
3. `Forge.md` 已经在真实项目中稳定使用。

如果未来需要自有协议，优先把它设计为 `Forge.md` 的结构化版本，而不是替代 MCP。
