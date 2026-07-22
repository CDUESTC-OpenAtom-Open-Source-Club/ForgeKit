# ForgeKit 硬性验证记录

> 最新验证：2026-07-21
> 验证环境：macOS (本地) + Alibaba Cloud Linux 3 (服务器)
> 验证命令：`npm run verify`

## 1. 一键质量门禁

`npm run verify` 当前依次执行：

1. ESLint：阻断实际错误，保留边界类型警告供后续收紧。
2. TypeScript `--noEmit` 类型检查。
3. 删除旧 `dist` 后强制干净编译，规避增量缓存造成的假成功。
4. Vitest 单元、协议、冒烟和 E2E 契约测试。
5. 启动编译后的 MCP Server 真进程，通过 stdio 完成初始化、工具发现和 `inspect_project` 调用。
6. 打出真实 npm tarball，在全新临时目录安装，通过安装后的 `forgekit-mcp` 调用正式模板生成 `Forge.md`。

## 2. 本次实测结果

| 验证项 | 结果 |
|--------|------|
| ESLint | 通过，0 errors；遗留边界类型 warnings 不阻断 |
| TypeScript 类型检查 | 通过 |
| 干净构建 | 通过，重新生成 `dist` |
| 自动化测试 | 98/98 通过 |
| 测试文件 | 14/14 通过 |
| 编译后 MCP stdio 通信 | 通过 |
| MCP 工具发现 | 5 个工具完整返回（含 `preflight_check`） |
| 编译后 `inspect_project` | 成功识别 Python fixture 与 `app.py` |
| npm 包内容预检 | `npm pack --dry-run --json` 通过 |
| npm tarball 干净安装 | 通过，安装后的 bin 可发现 5 个工具并生成正式 `Forge.md` |
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

## 6. 真实服务器验证（2026-07-21）

### 验证环境
- **服务器**：Alibaba Cloud Linux 3 (OpenAnolis), Node.js v24.15.0, Podman 4.9.4
- **目的**：验证v0.1核心功能，发现架构问题

### 验证结果

**✅ 已验证通过**：
- inspect_project：成功识别Python项目
- generate_packaging_plan：成功生成Forge.md
- build_docker_image：隔离 Node 试点成功生成镜像
- 容器运行：`/health` 返回 `healthy`
- Release Manifest：记录 Git commit、dirty state、构建环境、镜像大小和 digest
- Plan-before-build约束：强制检查生效
- 错误结构化返回：Docker Hub 超时被识别为 `network_unreachable`

**🔴 真实环境发现的缺口**：
- 服务器 `docker` 命令实际由 Podman 4.9.4 提供，当前结果未显式区分 runtime 类型。
- Docker Hub 在该环境不可达；Preflight 尚未检查目标 Registry 连通性。
- TypeScript fixture 缺少 lockfile，却使用 `npm ci --only=production` 后编译 TypeScript，真实构建失败。
- Preflight 未提供 `plan_path` 时会跳过计划检查，但返回结果没有明确的 skip 项。
- 初次生成的镜像校验和是占位符；本轮已改为读取镜像 digest，并增加回归测试。
- macOS 工作区快照会携带 UID 和 AppleDouble 元数据；正式安装必须验证 npm 发布物，不应复制开发目录。

### 架构改进成果（2026-07-21）

**问题**：服务器编译产物使用path aliases，Node.js无法解析

**解决**：
- 移除tsconfig.json中的paths配置
- 编译产物现在使用相对路径
- 提高代码可移植性

**本轮验证**：
```
npm test: 98/98 passed ✅
npm run verify: 全部通过 ✅
服务器 npm ci + 干净编译 + MCP runtime smoke: 通过 ✅
Node 镜像构建 + 容器健康检查: 通过 ✅
Python 镜像构建: Docker Hub 网络阻塞，不计为通过
TypeScript fixture 构建: 模板缺陷，不计为通过
```
