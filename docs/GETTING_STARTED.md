# ForgeKit 安装与接入

> 当前状态：公共 npm 尚未发布。GitHub 直装已在全新目录验证；正式 npm 发布仍受双维护者盲标和发布凭证门禁约束。

## 环境要求

- Node.js 18 或更高版本；
- npm；
- Docker Engine；Podman 的 Docker CLI 兼容层目前属于试验性支持；
- 需要构建镜像时，目标 Registry 必须可访问。

## 当前最短配置（已验证）

在 MCP 客户端中使用固定版本，避免自动升级改变工具行为：

```json
{
  "mcpServers": {
    "forgekit": {
      "command": "npx",
      "args": ["--yes", "github:CDUESTC-OpenAtom-Open-Source-Club/ForgeKit#e6dc074"]
    }
  }
}
```

该 commit 已包含真实服务器运行验证和增长监测。GitHub 直装会在首次启动时下载并构建，速度慢于正式 npm 包；锁定 commit 避免 `main` 更新改变行为。

## 维护者源码验证方式

```bash
git clone https://github.com/CDUESTC-OpenAtom-Open-Source-Club/ForgeKit.git
cd ForgeKit
npm ci
npm run verify
```

本地源码 MCP 配置：

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

## 最短使用流程

在 Agent 中依次表达：

1. “检查这个项目是否具备构建条件。”
2. “为这个项目生成 Docker 交付计划。”
3. 审查生成的 `Forge.md`。
4. “按这个 Forge.md 构建 Docker 镜像。”

Agent 对应调用：

```text
inspect_project
  → generate_packaging_plan
  → preflight_check
  → build_docker_image
```

## 验证成功标准

- MCP 客户端能发现 7 个工具；
- `preflight_check` 返回明确的通过、失败或跳过项；
- 项目目录生成 `Forge.md`；
- 显式请求运行验证时，构建成功后还要启动临时容器并通过健康端点；
- 构建成功后生成镜像、日志和 `release-manifest.json`；
- Manifest 中包含真实 Git commit、工具版本和 SHA256。

已有失败日志时，可以跳过构建流程直接调用：

```json
{
  "log_text": "failed to calculate checksum: \"/app.py\": not found"
}
```

完整字段、置信度和脱敏说明见 [Docker 构建诊断说明](./DIAGNOSTICS.md)。

## 常见问题

### Docker Hub 不可访问

Preflight 会提前报告 Registry 不可达。ForgeKit 不自动修改 Docker 配置；请由用户或系统管理员配置可信镜像源，并重新执行检查。

### 使用 Podman

当系统的 `docker` 命令由 Podman 提供时，基础流程可能工作，但当前不作为正式兼容承诺。请在问题报告中附上 `docker version` 与结构化诊断结果。

### 为什么不自动发布到 Registry 或 GitHub

Push、Tag 和 Release 会改变外部状态。ForgeKit 当前默认只生成本地产物和证据，发布动作必须由用户明确确认。
