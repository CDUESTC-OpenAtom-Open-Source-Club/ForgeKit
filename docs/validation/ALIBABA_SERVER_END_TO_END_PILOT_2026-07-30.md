# Alibaba Cloud Linux 真实服务器端到端试点

> 执行日期：2026-07-30
> 目标主机：`47.108.249.115`（报告中只保留用户明确提供的公开地址）
> ForgeKit：v0.2.2-rc.1，工作区提交基线 `3c8f0d4`
> 初始结论：构建诊断闭环可工作，但“生成可运行交付物”存在阻塞缺陷。文末记录同日修复后的第二轮验证；P0 交付闭环已经在该服务器通过。

## 1. 安全与隔离边界

- 只读审计现有监听端口、容器与运行时；
- 未修改公网 80 端口的“语见 YuJian”站点；
- 未修改 Nginx、数据库、Redis、防火墙、镜像源或系统服务；
- 试点使用 `/root/forgekit-pilot-20260730-o6FaoF` 独立目录；
- 测试容器仅绑定 `127.0.0.1:49152`，未暴露公网；
- 验证结束后删除测试容器并确认 49152 端口释放；
- 保留两个测试镜像和服务器证据目录，便于复核。

## 2. 环境

| 项目 | 结果 |
|---|---|
| OS | Alibaba Cloud Linux 3.2104 U12，x86_64 |
| 容器运行时 | Podman 4.9.4 的 Docker CLI 兼容层 |
| Node.js | v24.15.0 |
| npm | 11.12.1 |
| 可用磁盘 | 约 13.7 GB |
| 可用内存 | 审计时约 1.3 GB |
| 公网站点 | Nginx 80 端口，试点前后 HTTP 200 |

Podman 不在当前稳定承诺范围内，本次结果只能记作实验性兼容证据。

## 3. 测试项目

创建零外部运行依赖的 Node.js HTTP 服务：

- `package.json` 中入口为 `npm start`；
- 实际入口文件为 `server.js`；
- `/health` 返回 `{"status":"ok","service":"forgekit-pilot"}`；
- 项目初始状态故意不包含 Dockerfile；
- 项目独立初始化 Git 并提交，便于检查 Release Manifest。

## 4. 执行结果

### 4.1 MCP 安装与启动

`npm ci` 和普通 `npm run build` 表面成功，但没有生成 `dist/`，MCP smoke 随后报入口不存在。

根因：源码传输时排除了 `dist/`，却保留了增量 TypeScript 元数据；普通 `tsc` 判断无需重建。执行 `npm run build:clean` 后，MCP smoke 通过并发现七个工具。

这证明发布/安装入口必须使用强制干净构建，不能把普通增量构建当作安装验收。

### 4.2 Inspect、Plan 与 Preflight

- `inspect_project` 正确识别 JavaScript/Node.js 项目；
- 正确识别 `npm start` 入口和缺少 Dockerfile；
- `generate_packaging_plan` 成功生成 `Forge.md`；
- 源目录、Docker/Podman、磁盘和计划文件检查通过；
- 默认 Preflight 正确提前识别 Docker Hub 不可达。

### 4.3 首次构建：真实网络失败

自动生成 Dockerfile 后，Podman 尝试拉取 `node:18-alpine`，Docker Hub 443 多次超时，构建失败。

诊断结果：

- code：`network_unreachable`；
- category：`registry`；
- confidence：`high`；
- evidence：保留 Registry 域名、443 超时和重试记录；
- verification：建议单独拉取基础镜像验证。

该分类与证据正确。构建等待约 4 分钟期间没有实时日志文件，用户只能看到无输出等待，这是需要修复的体验问题。

### 4.4 使用服务器缓存镜像完成构建

为避免修改系统镜像源，只在测试项目 Dockerfile 内将基础镜像改为服务器已有缓存镜像。

ForgeKit 随后构建成功：

- 镜像：`forgekit-pilot-health:20260730-local`；
- 大小：164,218,175 bytes；
- Release Manifest 正常生成；
- Manifest 记录 Git commit、dirty state、主机、Node、容器运行时版本和镜像 SHA256。

### 4.5 构建成功但运行失败

自动生成的 Dockerfile 使用：

```dockerfile
CMD ["node", "index.js"]
```

但 Inspect 已经识别实际入口为 `npm start`，项目文件是 `server.js`。因此镜像虽然构建成功，容器启动立即退出：

```text
Error: Cannot find module '/app/index.js'
```

这证明当前 `build_docker_image` 的成功语义只覆盖“镜像形成”，没有覆盖“应用可以运行”。

### 4.6 修正入口后的运行与健康验证

将测试项目 Dockerfile 改为：

```dockerfile
CMD ["npm", "start"]
```

重新构建得到：

- 镜像：`forgekit-pilot-health:20260730-fixed`；
- 大小：164,228,919 bytes；
- 容器状态：running；
- 本机健康检查：HTTP 200；
- `/health`：`{"status":"ok","service":"forgekit-pilot"}`；
- `/`：`{"message":"ForgeKit delivery pilot is running"}`。

验证后测试容器已删除，端口已释放。

### 4.7 运行错误的独立诊断

`diagnose_build_failure` 将 `/app/index.js` 错误识别为：

- code：`module_not_found`；
- category：`runtime`；
- confidence：`high`。

分类和证据正确，但建议错误地偏向“安装依赖”，没有识别“容器启动入口不存在”。因此当前建议不能完全指导用户修复。

## 5. 产品结论

本次试点支持继续建设的不是“更多打包目标”，而是一个更具体的交付闭环：

```text
识别真实入口
  → 生成与入口一致的 Dockerfile
  → Preflight 拦截网络/运行时问题
  → 构建镜像
  → 启动容器
  → 执行 HTTP/进程健康验证
  → 只有运行成功才报告交付成功
```

### P0 修复

1. 清理构建缓存元数据或强制安装期干净构建，避免 `dist` 缺失但 `tsc` 成功；
2. 自动 Dockerfile 必须消费 Inspect 的入口结果，Node 项目优先使用合法 `start` script；
3. 增加镜像运行验证，构建成功不能直接等于交付成功；
4. 对容器命令/入口缺失单独分类，不要只给依赖安装建议；
5. 构建过程实时写日志或返回阶段进度，避免 Registry 超时时长时间无反馈。

### P1 改进

1. 明确识别 Docker Engine 与 Podman 兼容层，并在结果中标记 experimental；
2. 将完整默认 Preflight 作为构建前的推荐门禁，不鼓励跳过 Registry 检查；
3. Release Manifest 的 verification 应加入 container_started、healthcheck_passed，而不只记录 build_completed；
4. 允许用户显式选择已存在的基础镜像或受信任 Registry，不自动修改系统镜像源。

## 6. 证据位置

服务器证据保留于：

```text
/root/forgekit-pilot-20260730-o6FaoF/pilot-app/evidence/
/root/forgekit-pilot-20260730-o6FaoF/pilot-app/release-manifest.json
```

主要证据包括 Inspect、Plan、Preflight、网络失败构建、缓存镜像构建、错误入口运行、修正入口构建、健康检查及独立诊断结果。

## 7. P0 修复后第二轮验证

同日完成以下修复并重新上传服务器源码进行独立重建：

1. 安装期/验证期使用 `build:clean`，强制删除 `dist` 并执行 `tsc --build --force`；
2. Node.js Dockerfile 优先使用项目的 `npm start`，否则查找真实入口文件；
3. `build_docker_image` 支持显式启动临时容器并验证 HTTP 健康端点；
4. 健康探测对应用启动期间的 connection refused 进行有限重试；
5. `/app/index.js` 一类镜像入口缺失错误使用独立诊断规则；
6. Release Manifest 记录运行和健康检查结果。

### 7.1 真实执行结果

第二轮项目位于：

```text
/root/forgekit-pilot-20260730-o6FaoF/pilot-app-v2
```

ForgeKit 自动生成的 Dockerfile 包含：

```dockerfile
CMD ["npm", "start"]
```

最终结果：

| 检查 | 结果 |
|---|---|
| 镜像 | `forgekit-pilot-health:20260730-v2` |
| 镜像大小 | 164,149,045 bytes |
| 容器启动 | 通过 |
| 随机回环端口 | `127.0.0.1:39483` |
| `/health` | 通过 |
| 运行验证结构 | `requested=true, success=true` |
| Manifest | 包含 `container_started`、`healthcheck_passed` |

第一次健康验证还发现了应用启动竞态：容器已经 running，但端口尚未开始监听。加入有限就绪重试后，第二轮完整流程通过。这个过程说明仅检查容器状态仍不够，HTTP 就绪检查必须容忍正常启动时间。

### 7.2 清理与生产回归

- `forgekit-verify-*` 临时容器数量为 0；
- `127.0.0.1:39483` 已释放；
- 公网站点仍返回 HTTP 200；
- 原有 80、4000、18080、3306、6379 监听仍存在；
- 未修改 Nginx、数据库、Redis、防火墙、Registry 或生产站点配置。

### 7.3 更新后的结论

本次真实服务器验证已经证明以下闭环可用：

```text
识别 Node.js 入口 → 生成 Dockerfile → 构建镜像
→ 启动隔离临时容器 → HTTP 健康检查 → 自动清理
→ 在 Release Manifest 留下验证证据
```

Podman 兼容层仍只能视为实验性支持；构建阶段持续进度可见性、运行时品牌识别、真实外部用户留存和付费证据仍是后续工作，不能据此宣称已经获得市场验证或收入。
