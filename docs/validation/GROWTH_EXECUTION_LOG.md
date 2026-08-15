# 增长与用户研究执行台账

> 启动日期：2026-07-30
> 数据原则：不记录不必要的私人信息；同一参与者去重；意向、试用和复用分开统计。

## 漏斗摘要

| 指标 | 当前 | 30 天目标 |
|---|---:|---:|
| 已定向联系 | 10 | 20 |
| 有效对话 | 1 | 10 |
| 合格访谈 | 0 | 12 |
| Docker 真实试用 | 0 | 5 |
| 10 分钟内接入 | 0 | ≥80% |
| 定位时间缩短 | 0 | ≥60% |
| 7 天内第二次使用 | 0 | 2 |
| HarmonyOS 探索项目 | 0 | 3 |
| 付费试点预算意向 | 0 | 3 |
| 已完成付费试点 | 0 | 1 |

自动证据快照见 [`metrics/latest.json`](./metrics/latest.json)。GitHub clone 可能包含 CI、机器人和重复拉取，不能计为用户；只有带证据标签的公开试点才进入激活、复用和收入统计。

## 来源命名

公开链接使用：

```text
utm_source=<github|juejin|zhihu|csdn|club|devto|reddit>
utm_medium=<issue|discussion|article|workshop|post>
utm_campaign=v0_2_3_real_pilot
utm_content=<content_or_candidate_id>
```

不以 UTM 保存个人身份。用户与访谈记录使用内部匿名 ID 关联。

## 参与者与证据

| ID | 来源 | 用户标签 | 真实触发事件 | 证据等级 | 状态 | 下一步 | 最近更新 |
|---|---|---|---|---|---|---|---|
| 待录入 | — | — | — | — | — | — | — |

状态枚举：`identified`、`contacted`、`replied`、`interviewed`、`pilot_started`、`pilot_completed`、`reused`、`declined`、`inactive`。

## 试用结果

| Pilot ID | Participant ID | 项目标签 | 安装分钟 | 人工帮助 | 基线定位分钟 | ForgeKit 定位分钟 | 分类正确 | 建议采用 | 最终结果 | 7 日复用 |
|---|---|---|---:|---:|---:|---:|---|---|---|---|
| 待录入 | — | — | — | — | — | — | — | — | — | — |

## 内容与页面表现

| 内容 ID | 页面/渠道 | 搜索意图 | 发布链接 | 合格访问 | 访谈转化 | 试用转化 | 备注 |
|---|---|---|---|---:|---:|---:|---|
| 待录入 | — | — | — | — | — | — | — |

## 2026-07-30：首次外部问题反馈

- `ghidra-mcp` Issue #416 的参与者回复，确认把冲突的固定 UID/GID 从 1000 改为 1001 后，镜像目前“看起来可用”，但明确表示尚未遇到运行时问题，不等于已完成系统验证。
- 这条回复计为 1 个有效对话和 1 条问题解决反馈；不计为 ForgeKit 试用开始、试用完成、`runtime-verified`、7 日复用或付费意向。
- 已建议验证最终镜像中的 `id`、`/data` 与 `/projects` 写入，以及正常入口的 MCP/健康路径；等待对方自愿提供结果，不继续追发。
- 公开证据：https://github.com/bethington/ghidra-mcp/issues/416#issuecomment-5134175281

## 每周决策

每周只回答四个问题：

1. 哪类真实任务最频繁？
2. 哪一步导致最多未完成？
3. 哪个诊断或建议真正缩短了时间？
4. 哪些需求只有口头意向，尚无 E3/E4 证据？
# 2026-07-30 — acquisition promise connected to a real CLI action

- Funnel audit found that high-intent pages advertised build-log diagnosis while the public CLI only exposed `deliver`.
- Added local-only `forgekit diagnose` for file, stdin and direct-text inputs with stable JSON and CI-friendly exit codes.
- Verified GitHub installation against the public Lance COPY failure log on the isolated Alibaba server test directory.
- CI run `30555057068` passed Node 18/20, package smoke and real Docker verification.
- This is an activation-path improvement, not a user activation event; pilot, reuse and revenue counts remain unchanged.
# 2026-07-30 — new MCP container failure closed an unknown gap

- Found a current public `ghidra-mcp` Docker failure where `groupadd --gid 1000` collided with a group already present in the base image.
- The released ForgeKit CLI returned `unknown_error`, so no promotional claim was made from the initial result.
- Added the public log to the regression corpus and a conservative fixed UID/GID collision rule with read-only verification first.
- Browser QA also found that the high-intent diagnosis page's copy action did not produce observable clipboard success in the embedded browser; added a permission-compatible fallback and persistent accessible result state for retesting.
- Neither change counts as an external pilot, retention event, or revenue.
# 2026-08-15 — week-2 real outreach with diagnosis-first comment

- Searched public GitHub issues created 2026-07-15..2026-08-15 for fresh Docker build failures; shortlisted 6 open candidates with real logs.
- Ran the local CLI against each redacted log first. obico (apt 404 on EOL Ubuntu 20.04 base) and muse (npm ERESOLVE peer conflict) both returned `unknown_error`, so two rules were added first — `distribution_unsupported` (EOL apt repos) and an npm peer-dependency conflict variant — with regression tests from the public logs; bpm-iq stayed unknown and was not contacted.
- Posted one help-first comment on obico-server #1156 (O010): root cause in the prebuilt base image's EOL distro, a 404 verification command, and migration direction; no product claim beyond an honest disclosure of the research.
- Funnel: contacted 9 → 10; valid conversations still 1; pilots, reuse, revenue unchanged. Commenting is not activation.
