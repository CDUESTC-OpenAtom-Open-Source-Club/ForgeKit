# 竞品基线：ckreiling/mcp-server-docker

> 采集日期：2026-07-22；数据来自公开 GitHub README、仓库元数据与 Issues。

## 公开指标

- 732 stars、97 forks；
- 定位：使用自然语言管理 Docker；
- 用户：服务器管理员、实验者和 AI 爱好者；
- 能力：容器、镜像、网络和 Volume 的生命周期操作；
- 支持本地 Docker socket 和远程 Docker over SSH。

Star 表示关注度，不代表月活、留存或对 ForgeKit 的迁移意愿。

## Issue 信号

公开 Issue 显示的主要类别：

- 安全边界：Docker socket、路径遍历、宿主文件读取和高权限操作；
- MCP Schema 兼容：数组缺少 `items` 等客户端校验问题；
- 安装与 Docker 化：安装失败、Dockerized use case；
- 功能诉求：Secret、端口映射、容器内命令执行；
- 输出体验：容器列表结果过于冗长。

## 与 ForgeKit 的关系

它是 Docker 操作型 MCP Server，主要任务是管理容器资源。ForgeKit 当前验证的是构建前检查、构建失败解释和镜像运行验证。两者可以互补：前者执行更广泛的 Docker 操作，后者提供收敛的诊断与证据。

ForgeKit 不应复制容器、网络、Volume 和远程 Docker 管理能力。可能成立的差异化必须由试点证明：更低权限、构建路径专注、初学者可理解的错误解释，以及可复现的失败回归集。
