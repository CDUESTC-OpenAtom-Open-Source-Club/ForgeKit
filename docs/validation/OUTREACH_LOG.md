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

## 2026-07-30：第三批（当天新鲜失败）

通过 GitHub 公开搜索筛选当月仍开放、有完整复现日志且不是机器人批量 Issue 的失败。先给出具体判断，再提供可选计时试用。

### O007 · lance-data-viewer / lance-format

- 场景：`COPY backend/*.py .` 展开为多源，但目标路径未以 `/` 结尾；
- 先行帮助：指出 Docker 多源 COPY 的确定性语法原因和最小变更 `./`；
- 链接：https://github.com/lance-format/lance-data-viewer/issues/62#issuecomment-5131469545
- 状态：已发送，待响应。

### O008 · pycbc / gwastro

- 场景：当天 Docker CI 在 pip 隔离构建 `amqplib` 时失败，环境中标准库 `traceback` 无法导入；
- 先行帮助：收窄到 pip build environment、Python/base digest 和容器外对照验证，不建议修改无关 Docker daemon 配置；
- 链接：https://github.com/gwastro/pycbc/issues/5390#issuecomment-5131469898
- 状态：已发送，待响应。

当前合计发送 8 个上下文相关邀请；仍为 0 个有效对话、0 个真实试用。未联系已有明确修复闭环的 Infisical #7134，也未联系明显机器人批量生成的失败 Issue。

### O009 · ghidra-mcp / bethington

- 场景：`eclipse-temurin:21-jdk` 已占用 GID 1000，而 Dockerfile 再执行 `groupadd --gid 1000 ghidra`；
- ForgeKit 初始结果：`unknown_error`，因此先补充公开回归规则，没有把初始结果当作有效诊断；
- 先行帮助：建议在相同基础镜像摘要中用 `getent group/passwd` 确认占用者，再显式复用合适组或参数化并选择未占用 UID/GID；明确反对删除基础镜像账号或放宽目录权限；
- 链接：https://github.com/bethington/ghidra-mcp/issues/416#issuecomment-5132957416
- 状态：已响应。参与者报告改用 UID/GID 1001 后“目前看起来可用”，但没有完整运行时写入或 MCP/健康路径证据；计 1 个有效对话，不计试用或 `runtime-verified`。
- 后续：https://github.com/bethington/ghidra-mcp/issues/416#issuecomment-5135668797 提供最小只读身份与临时写入验证步骤；等待对方自愿验证，不再主动追发。

当前合计 9 个上下文相关触达、1 个外部有效响应；真实试用、七日复用和付费仍均为 0。
