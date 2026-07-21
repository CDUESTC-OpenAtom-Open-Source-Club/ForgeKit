# ForgeKit 硬性验证记录

> 验证日期：2026-07-20  
> 验证环境：macOS，Node.js v25.9.0，npm 11.12.1  
> 验证命令：`npm run verify`

## 1. 一键质量门禁

`npm run verify` 当前依次执行：

1. ESLint：阻断实际错误，保留边界类型警告供后续收紧。
2. TypeScript `--noEmit` 类型检查。
3. 删除旧 `dist` 后强制干净编译，规避增量缓存造成的假成功。
4. Vitest 单元、协议、冒烟和 E2E 契约测试。
5. 启动编译后的 MCP Server 真进程，通过 stdio 完成初始化、工具发现和 `inspect_project` 调用。

## 2. 本次实测结果

| 验证项 | 结果 |
|--------|------|
| ESLint | 通过，0 errors；遗留边界类型 warnings 不阻断 |
| TypeScript 类型检查 | 通过 |
| 干净构建 | 通过，重新生成 `dist` |
| 自动化测试 | 72/72 通过 |
| 测试文件 | 11/11 通过 |
| 编译后 MCP stdio 通信 | 通过 |
| MCP 工具发现 | 4 个工具完整返回 |
| 编译后 `inspect_project` | 成功识别 Python fixture 与 `app.py` |
| npm 包内容预检 | `npm pack --dry-run --json` 通过 |
| 发布包模板 | `src/packaging/forge-template.md` 已包含在 npm 包中 |
| 覆盖率运行 | 通过；能力层语句覆盖率约 89% |

## 3. 本轮发现并修复的问题

- 修复 ESLint 使用不存在的 `@typescript-eslint/prefer-const` 规则。
- 为测试代码增加独立 TypeScript ESLint 工程，恢复 `npm run lint` 可执行性。
- 保留并验证 MCP executor 的相对运行时导入，避免编译后 Node 无法解析 TypeScript path alias。
- 增加编译后 MCP 真进程测试，避免只测源码导入而漏掉发布运行错误。
- 修复 `Forge.md` 基础镜像始终回退到 Python 镜像的问题，并增加 Node 项目回归测试。
- 干净构建使用 `tsc --build --force`，避免旧 `tsconfig.tsbuildinfo` 导致无产物假成功。
- 修正 CI Docker smoke 中 `--name` 参数位置，确保容器能按预期停止和清理。
- Node 18.x / 20.x CI 矩阵改为执行完整 `npm run verify`，不再只做编译和单元测试。

## 4. 当前未在本机重复验证的项目

本机 Docker daemon 未运行，因此本轮没有重新执行真实 `docker build` 和容器健康检查。这不等同于功能失败：仓库的 [v0.1 验收报告](./V0.1_ACCEPTANCE.md) 已记录 2026-07-14 在 OpenCloudOS 9.4 + Docker 29.3.1 上完成的真实闭环；GitHub Actions 仍保留真实 Docker smoke job。

下列项目仍需在对应环境验证：

- Node 18.x / 20.x：由现有 CI 矩阵验证，本机 Node 25 结果不能替代该矩阵。
- 真实 Docker 构建与 `/health`：由 Linux CI/远程环境验证。
- deb 真实安装行为：需要 Ubuntu/systemd 目标环境。
- Windows、macOS 应用包和 AppImage：仅属后续规划，当前没有实现或通过声明。

## 5. 可信度结论

- **可信**：源码测试、类型检查、干净编译、编译后 MCP 协议通信、Plan-before-build 契约。
- **有历史硬证据，仍应持续复测**：真实 Docker 构建与运行。
- **仅供规划参考**：多版本、多平台、网页/小程序技能互转和技能集市。
