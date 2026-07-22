# 技术验证基线

> 验证日期：2026-07-22

## v0.2.2-rc.1 已有证据

| 验证项 | 结果 | 证据 |
|---|---|---|
| MCP 可发现七个工具 | 通过 | compiled MCP runtime smoke |
| npm tarball 安装后可调用 MCP | 通过 | installed-package smoke |
| Node.js 18/20 | 通过 | GitHub Actions matrix |
| 单元、协议与 E2E | 170/170 通过 | `npm run verify` |
| 真实 Docker 构建 | 通过 | GitHub Actions Docker smoke |
| 容器启动与健康检查 | 通过 | CI `curl /health` |

## 尚未验证

- 不同 Agent 对同一错误的理解和修正成功率；
- 诊断是否比直接阅读 BuildKit 日志节省时间；
- 50 个独立标注真实失败样本的分类正确率；
- 非维护者的安装完成率和第二次使用；
- 公共 npm 正式版本的 `npx` 安装路径。

技术闭环已成立，但用户需求与使用价值仍未成立。下一轮技术实验应围绕错误理解和定位时间，不应重复证明 MCP 可以启动。
