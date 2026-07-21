# ForgeKit Agent Integration

> 本文档定义 ForgeKit 的 MCP 接入方式和 Agent 使用规范。
> **核心定位**：所有 AI Agent 通过 MCP 协议接入，无需 CLI 兜底。

---

## 1. 接入方式（唯一）

**ForgeKit 只提供一种接入方式：MCP Server**

| 接入方式 | 定位 | v0.1 决策 |
|----------|------|-----------|
| **MCP Server** | **唯一主协议**，所有 Agent 通过 MCP 调用 | ✅ 必做 |

**原因**：
- MCP 已经是 AI Agent 工具调用的通用协议
- 所有主流 Agent（Claude Code、Cline、Cursor、Codex、Windsurf）都支持 MCP
- 不需要 CLI 兜底，Agent 可以直接通过 MCP 调用工具

---

## 2. 目标 Agent（全部支持 MCP）

| Agent | MCP 支持 | 接入方式 |
|-------|---------|----------|
| Claude Code | ✅ 完全支持 | MCP Server（主验证对象） |
| Cline | ✅ 完全支持 | MCP Server |
| Cursor | ✅ 完全支持 | MCP Server |
| Codex | ✅ 完全支持 | MCP Server |
| Windsurf | ✅ 完全支持 | MCP Server |
| 其他 Agent | ✅ 支持 | 只要支持 MCP，即可调用 ForgeKit |

**关键结论**：所有主流 AI Agent 都支持 MCP，**不需要 CLI 兜底**。

---

## 3. 为什么只做 MCP

| 方案 | 优点 | 问题 | 结论 |
|------|------|------|------|
| **MCP Server** | 标准工具发现、参数 Schema、结构化输出、所有 Agent 都支持 | 需要实现服务和 Schema | ✅ v0.1 主方案 |
| Skill / Markdown 文档 | 简单、可读、适合教学 | 不能强约束参数和执行结果 | 辅助说明（不是接入协议） |
| CLI | 对人友好、易调试 | Agent 不需要，所有 Agent 都支持 MCP | ❌ 不作为 Agent 接入方式 |

> **和与现有 MCP Server 的差异（市场调研方向二）**：Docker MCP Catalog 已有的 300+ Server 多为 API 转发器（GitHub 管 Issue/PR、Stripe 收付款、Grafana 监控等），**没有一个是"交付契约层"**。它们只转发命令，不提供决策依据与结果观测。ForgeKit 的不同之处：每个工具都强制 `plan_path`（契约前置）、返回 `decision_basis`（决策依据）与 `result.json`（观测回溯）——是带"决策 + 观测"的交付契约 MCP，而非又一个转发器。

---

## 4. MCP Server 工具列表（多端）

v0.1-v1.0 所有工具通过 MCP 暴露：

| 工具 | 目的 | 端类型 | v0.1 状态 |
|------|------|--------|-----------|
| `inspect_project` | 识别项目语言、入口、已有配置 | 所有端 | ✅ 实现 |
| `generate_packaging_plan` | 生成或更新 `Forge.md` | 所有端 | ✅ 实现 |
| `build_docker_image` | 构建 Docker 镜像 | servers | ✅ 硬闭环 |
| `pack_deb` | 构建 Ubuntu deb 包 | servers | 🟡 可选 |
| `pack_rpm` | 构建 CentOS rpm 包 | servers | ❌ v0.2 |
| `pack_android_apk` | 构建 Android APK | mobile | ❌ v0.3 |
| `pack_ios_ipa` | 构建 iOS IPA | mobile | ❌ v0.3 |
| `pack_pwa` | 构建 PWA | web | ❌ v0.3 |
| `pack_hybrid_app` | 构建混合应用（Cordova/Capacitor） | web | ❌ v0.3 |
| `pack_windows_exe` | 构建 Windows exe | desktop | ❌ v0.5 |
| `pack_macos_app` | 构建 macOS app | desktop | ❌ v0.5 |

---

## 5. Agent 使用流程（通过 MCP）

### 服务器端打包

用户对 Agent 说：

```text
帮我把这个 Python 项目打包成可以在服务器上运行的版本。
```

**Agent 调用 MCP 工具流程**：

```
步骤1：调用 inspect_project
  输入：{"source_dir": "/path/to/project"}
  输出：{"language": "Python", "entrypoints": ["app.py"], ...}

步骤2：调用 generate_packaging_plan
  输入：{"source_dir": "/path/to/project", "goals": ["Docker"]}
  输出：生成 Forge.md（包含决策依据）

步骤3：用户审查 Forge.md（Agent 展示给用户确认）

步骤4：调用 build_docker_image
  输入：{
    "source_dir": "/path/to/project",
    "plan_path": "/path/to/project/Forge.md",  // 必需
    "image_name": "demo-api",
    "platform": "linux/amd64"
  }
  输出：{"status": "success", "artifacts": ["demo-api:latest"], ...}

步骤5：Agent 展示结果和风险提示给用户
```

---

## 6. MCP 工具输入输出规范

### 6.1 通用输入规范

所有构建类工具必须接收：

| 字段 | 类型 | 说明 |
|------|------|------|
| `source_dir` | string | 项目根目录 |
| `plan_path` | string | **Forge.md 路径（必需，强制 Plan-before-build）** |
| `target_platform` | string | 目标平台（如 ubuntu-22.04、android-11） |

### 6.2 通用输出规范

所有工具返回：

| 字段 | 说明 |
|------|------|
| `status` | `success` / `failed` |
| `artifacts` | 产物路径或镜像引用 |
| `logs` | 构建日志路径和摘要 |
| `warnings` | 非阻塞风险 |
| `decision_basis` | 决策依据（从 decision-rules.yaml 应用） |
| `next_actions` | 失败或后续发布建议 |

### 6.3 错误结构

```json
{
  "status": "failed",
  "error": {
    "code": "plan_not_found",
    "summary": "Forge.md 打包计划文件不存在",
    "suggested_fix": "请先调用 generate_packaging_plan 生成 Forge.md，再执行构建"
  }
}
```

---

## 7. MCP Server 配置（给 Agent）

Agent 配置 MCP 连接示例：

```json
{
  "mcpServers": {
    "forgekit": {
      "command": "node",
      "args": ["dist/mcp-server/index.js"],
      "env": {}
    }
  }
}
```

**启动 ForgeKit MCP Server**：

```bash
# 构建
npm run build

# 启动 MCP Server（Agent 连接）
node dist/mcp-server/index.js
```

---

## 8. 多端决策依据来源

每个端的决策依据来自 `src/systems/<端类型>/<平台>/decision-rules.yaml`：

| 工具 | 读取的 decision-rules.yaml |
|------|----------------------------|
| `build_docker_image` | servers/ubuntu/decision-rules.yaml |
| `pack_deb` | servers/ubuntu/decision-rules.yaml |
| `pack_android_apk` | mobile/android/decision-rules.yaml |
| `pack_ios_ipa` | mobile/ios/decision-rules.yaml |
| `pack_pwa` | web/pwa/decision-rules.yaml |

---

## 9. 不需要 CLI 兜底的原因

### 9.1 所有主流 Agent 都支持 MCP

| Agent | MCP 支持状态 |
|-------|-------------|
| Claude Code | ✅ 完全支持 |
| Cline | ✅ 完全支持 |
| Cursor | ✅ 完全支持 |
| Codex | ✅ 完全支持 |
| Windsurf | ✅ 完全支持 |

### 9.2 MCP 是通用协议

- MCP 是 AI Agent 工具调用的**通用协议**（类似 HTTP 是 Web 的通用协议）
- 所有 Agent 都在向 MCP 靠拢
- 不存在"不支持 MCP 的主流 Agent"

### 9.3 如果真的遇到不支持 MCP 的 Agent

**不需要 CLI 兜底，而是**：
- 等待该 Agent 支持 MCP（主流 Agent 都在支持）
- 或者建议用户换用支持 MCP 的 Agent（Claude Code、Cline、Cursor、Codex）

---

## 10. Skill / Markdown 指南的作用（辅助）

虽然所有 Agent 都支持 MCP，但 **Skill / Markdown 指南** 仍然有用：

**作用**：
- 告诉 Agent 如何判断项目类型（servers/mobile/web/desktop）
- 告诉 Agent 先生成 Forge.md，再执行构建
- 告诉 Agent 如何处理失败和错误

**不是运行时协议**，只是 Agent 行为说明。

---

## 11. 后续协议演进

短期不自研协议。只有在满足以下条件后，才考虑 ForgeKit 自有协议：

1. MCP 无法表达 ForgeKit 的关键能力。
2. 至少 3 个 Agent 客户端需要同一套更高层打包语义。
3. `Forge.md` 已经在真实项目中稳定使用。

如果未来需要自有协议，优先把它设计为 `Forge.md` 的结构化版本，而不是替代 MCP。

---

*本文档由 ForgeKit 维护，基于 MCP 协议和 Agent 接入经验持续更新。*
