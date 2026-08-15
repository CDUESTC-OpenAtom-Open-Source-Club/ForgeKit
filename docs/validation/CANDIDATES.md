# 首轮公开候选样本

> 数据来源：GitHub 公开 Issue 搜索，采集日期 2026-07-22。候选不等于真实用户，必须访谈或试用后才能计入需求证据。

| ID | 公开场景 | 可验证的问题 | 入口 |
|---|---|---|---|
| C01 | agent-drop | 请求增加 Docker/Compose 部署 | https://github.com/jokaperes/agent-drop/issues/1 |
| C02 | skillberry-agent | 验证 Agent Docker 部署并更新文档 | https://github.com/skillberry-ai/skillberry-agent/issues/8 |
| C03 | DevoAgent | 定义部署、打包和运维方式 | https://github.com/maorgoldberg/DevoAgent/issues/19 |
| C04 | tne-sdk | 将 MCP Server Docker 化 | https://github.com/Firespawn-Studios/tne-sdk/issues/7 |
| C05 | fireflyiii-mcp | Docker 与 Claude 配置文档需求 | https://github.com/daften/fireflyiii-mcp/issues/43 |
| C06 | NemoClaw | Dockerfile 与 staged context 不匹配导致构建失败 | https://github.com/NVIDIA/NemoClaw/issues/7205 |
| C07 | oktopus | Agent Dockerfile 因 Ubuntu EOL 构建失败 | https://github.com/OktopUSP/oktopus/issues/400 |
| C08 | AutoMedia | Docker 缺少运行时依赖和跨平台问题 | https://github.com/1StepMore/AutoMedia/issues/46 |
| C09 | azure-ai-agent | 容器 health endpoint 与非 root 加固 | https://github.com/sjohnston1972/azure-ai-agent/issues/6 |
| C10 | Huascar | CI 中增加 Docker 构建验证与部署阶段 | https://github.com/VECTORG99/Huascar/issues/57 |

## 2026-08-15：第四批候选（近 30 天新鲜失败）

> 采集方式：GitHub 公开 issue 搜索（created:2026-07-15..2026-08-15，is:issue is:open），先用本地 `forgekit diagnose` 验证脱敏日志，仅联系分类命中的候选。

| ID | 公开场景 | 诊断结果 | 入口 | 状态 |
|---|---|---|---|---|
| C11 | obico-server：ml_api 基础镜像底层 Ubuntu 20.04 EOL，apt 404 | `distribution_unsupported`（补规则后命中） | https://github.com/TheSpaghettiDetective/obico-server/issues/1156 | 已联系（O010） |
| C12 | muse：npm ERESOLVE，pagination.djs peer 要 discord.js ^14.18.0 | `npm_dependency_conflict`（补规则后命中） | https://github.com/museofficial/muse/issues/1337 | 已验证，未联系 |
| C13 | studio-lite：api-Dockerfile 未锁版本 npm install，ioredis 6 peer 冲突 | 同类 ERESOLVE（规则已覆盖方向） | https://github.com/iqb-berlin/studio-lite/issues/1587 | 已验证，未联系 |
| C14 | bpm-iq：live-host 多阶段镜像缺拷贝 packages/decisions，启动即 ERR_MODULE_NOT_FOUND | `unknown`（不联系，避免超出当前能力） | https://github.com/Miragon/bpm-iq/issues/87 | 不联系 |
| C15 | headroom：arm64 镜像内 rtk 二进制为错误架构（Exec format error） | `architecture_mismatch`（高置信度） | https://github.com/headroomlabs-ai/headroom/issues/2700 | 已验证，未联系 |
| C16 | atmos：linux/arm64 镜像含 amd64 userland | `architecture_mismatch`（高置信度） | https://github.com/cloudposse/atmos/issues/2931 | 已验证，未联系 |

筛选补充规则（第四批）：

- 只联系日志分类命中且 issue 仍开放、未锁定、无维护者修复闭环的候选；
- 每批最多发 1 条新评论，观察响应与相关度后再决定下一条（沿用第二批经验）；
- 诊断初始为 unknown 的失败先进回归语料，不作为外联依据。

## 筛选规则

- 真实仓库和公开问题；
- 问题与 Agent/MCP 的 Docker 构建、部署或验证直接相关；
- 排除机器人生成、纯推广、与构建无关的问题；
- 不收集或公开非必要的私人联系方式。
