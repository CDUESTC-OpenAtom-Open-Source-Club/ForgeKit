# 访谈邀请发送记录

> 所有邀请均通过公开 GitHub Issue 发送，不收集私人联系方式。时间按 UTC 记录。

## Day 2：第一批

### O001 · agent-drop / jokaperes

- 候选：C01
- 发送时间：2026-07-22
- 渠道：GitHub Issue
- 状态：已发送，待响应
- 相关场景：从 `/root` 特定 systemd 部署迁移到可复现 Docker/Compose
- 邀请链接：https://github.com/jokaperes/agent-drop/issues/1#issuecomment-5043495360

### O002 · skillberry-agent / aviweit

- 候选：C02
- 发送时间：2026-07-22
- 渠道：GitHub Issue
- 状态：已发送，待响应
- 相关场景：验证 Agent Docker 部署并更新文档
- 邀请链接：https://github.com/skillberry-ai/skillberry-agent/issues/8#issuecomment-5043495673

### O003 · DevoAgent / maorgoldberg

- 候选：C03
- 发送时间：2026-07-22
- 渠道：GitHub Issue
- 状态：已发送，待响应
- 相关场景：通用 OCI、Helm、API/worker、健康检查和升级
- 邀请链接：https://github.com/maorgoldberg/DevoAgent/issues/19#issuecomment-5043496281

## 当前统计

| 指标 | 当前 | Day 2–3 目标 |
|---|---:|---:|
| 已发送 | 6 | 10 |
| 已响应 | 0 | 5 |
| 同意访谈 | 0 | 3 |
| 已完成访谈 | 0 | 1 |

第一批发送后先观察响应与是否被维护者认为相关，再决定第二批文案和节奏；不一次性向全部候选发送相同评论。

## 2026-07-30：第二批（运行验证场景）

先复核 C04–C10 的实时状态；C06、C08、C10 已关闭，C05 已由维护者形成修复和待发布闭环，因此未追加推广评论。只联系仍开放、场景直接匹配且能够先提供具体帮助的 3 个项目。

### O004 · tne-sdk / Firespawn-Studios

- 候选：C04
- 场景：MCP Server 正在建设官方容器镜像；可验证“镜像构建后能否实际启动”；
- 动作：提供公开 build → temporary start → runtime verification 试点；
- 链接：https://github.com/Firespawn-Studios/tne-sdk/issues/7#issuecomment-5131312496
- 状态：已发送，待响应。

### O005 · oktopus / OktopUSP

- 候选：C07
- 场景：Ubuntu lunar EOL 导致 apt Release 404；
- 动作：先说明 EOL 根因、受支持发行版迁移与运行验证边界，再邀请脱敏对照试用；
- 链接：https://github.com/OktopUSP/oktopus/issues/400#issuecomment-5131312866
- 状态：已发送，待响应。

### O006 · azure-ai-agent / sjohnston1972

- 候选：C09
- 场景：非 root 容器与 `/health` 端点缺失；
- 动作：提供无需 Azure 凭证的公开仓库前后运行验证；
- 链接：https://github.com/sjohnston1972/azure-ai-agent/issues/6#issuecomment-5131313363
- 状态：已发送，待响应。

本批未把“发送评论”计为有效对话、试用或用户；只有对方响应并实际使用后才进入后续漏斗。
