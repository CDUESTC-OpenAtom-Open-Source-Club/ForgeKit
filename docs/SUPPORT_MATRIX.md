# 支持矩阵

这张表描述当前版本真正验证过的范围。没有写“已验证”的组合，不代表一定不可用，只代表我们不会把它当作稳定承诺。

## 当前版本：v0.2.2-rc.1

| 项目维度 | 已验证 | 试验性 | 当前不承诺 |
|---|---|---|---|
| 项目语言 | Python、TypeScript/Node.js、Go 代表项目 | 其他常见服务项目 | 任意语言自动生成正确构建文件 |
| 交付目标 | OCI/Docker 镜像 | Ubuntu x86_64 `.deb`、HarmonyOS `.hap`/`.app`（试验性） | rpm、AppImage、APK、IPA |
| 主机架构 | linux/amd64 | — | linux/arm64 正式支持 |
| Agent 接入 | MCP stdio；7 个工具；源码入口 | 不同客户端的参数细节 | Web 控制台或云端托管 |
| 容器运行时 | Docker Engine | Podman 的 Docker CLI 兼容层 | 自动安装或修改 Docker |
| 网络环境 | 可访问镜像 Registry 的环境 | 配置国内镜像后使用 | ForgeKit 自动替换用户镜像源 |
| 追溯证据 | Git commit、构建环境、产物大小、SHA256 | — | 法规认证或企业审计结论 |
| 系统适配器 | `servers/ubuntu`（verified） | `mobile/harmonyos`（experimental） | Android、iOS、PWA、Windows |

## 如何理解“已验证”

- 有自动化测试或真实 CI 端到端记录；
- 文档中的命令可以在干净环境复现；
- 失败时会返回原因、日志位置和下一步建议；
- 不把单个成功案例扩大解释为“所有项目都支持”。

## 提交新的兼容性样本

欢迎提交一个最小、可公开的项目样本。请在 Issue 中说明语言/版本、操作系统、Docker 版本、执行的工具链和完整结果；不要上传密钥、私有源码或生产日志。

相关入口：[试点反馈模板](https://github.com/CDUESTC-OpenAtom-Open-Source-Club/ForgeKit/issues/new?template=pilot-feedback.yml)。
