# 安全与公开体验说明

ForgeKit 是运行在本机标准输入/输出上的 MCP 工具。它会读取你显式提供的项目目录；只有在你调用构建工具时，才会执行 Docker 或系统打包命令。

## 初学者使用原则

1. 先在可丢弃的示例项目上运行 `inspect_project` 与 `preflight_check`。
2. 阅读生成的 `Forge.md`，确认构建目标和命令后，再调用构建工具。
3. 不要把密钥、令牌或生产环境配置提交到仓库或构建上下文。
4. 仅从本社团的 [公开仓库](https://github.com/CDUESTC-OpenAtom-Open-Source-Club/ForgeKit) 安装源码或发行包。

## 当前依赖审计结果

以本次公开体验版本的运行依赖执行 `npm audit --omit=dev`，结果为 **0 high / 0 critical**；仍有 2 个 moderate 的上游提示，分别关联 MCP SDK 的可选 HTTP 传输组件与 Hono Node Server。ForgeKit 当前使用本地 stdio 传输，不启动 HTTP 服务。

开发依赖中的测试与静态检查工具仍可能显示额外提示；它们不随 npm 发行包安装。我们会在后续版本逐项升级并重新验证 Node 18 支持。

## 报告问题

请不要在公开 Issue 中粘贴密钥、访问令牌或真实生产日志。可复现的普通问题请提交到 [Issues](https://github.com/CDUESTC-OpenAtom-Open-Source-Club/ForgeKit/issues)；涉及敏感信息时，请先联系社团维护者。
