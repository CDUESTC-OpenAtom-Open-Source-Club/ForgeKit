# 精准推广与访谈外联执行稿

> 用途：维护者在公开、相关且允许互动的渠道中，基于真实上下文邀请用户。禁止群发和无关推广。

## 发送前检查

- 对方最近确实遇到 Docker 构建、MCP 接入或项目交付问题；
- 先阅读上下文并说明能提供什么具体帮助；
- 不要求公开私有源码、密钥或生产日志；
- 不声称 ForgeKit 已经能够解决该问题；
- 每个候选只联系一次，除非对方回复；
- 将公开链接与结果写入执行台账。

## GitHub 中文邀请

> 你好，我们在维护开源项目 ForgeKit，目前正在验证“Docker 构建失败诊断是否能比直接阅读日志更快”。看到你在这个 Issue 中遇到了 **[具体问题]**。如果问题仍可复现，我们愿意先基于脱敏日志帮你分类原因和验证步骤，也想邀请你做一次 15–20 分钟的对照试用。无需提供私有源码、Token 或生产日志；结果可仅做匿名汇总。项目与研究边界：[研究页面链接 + UTM]。如果不合适，请忽略即可，我们不会继续打扰。

## GitHub English invitation

> Hi — we maintain the open-source ForgeKit project and are testing a narrow question: can structured Docker build diagnostics help people locate a failure faster than reading raw logs alone? I found your **[specific issue/context]**. If it is still reproducible, we can first help classify a redacted log and suggest verification steps, then—only if useful—invite you to a 15–20 minute comparison pilot. No private source, tokens, or production logs are needed, and results can remain anonymized. Research scope: [URL + UTM]. No follow-up if this is not relevant.

## 社团/课程活动邀请

> 带一个真实 Docker 构建失败来。我们用 30 分钟做两遍：先按你原来的方法定位，再使用 ForgeKit；现场只记录耗时、错误类别、建议是否有效和最终是否修复。请提前脱敏，不提交账号、密钥、私有源码或生产日志。

## 文章结尾 CTA

> 如果你最近 30 天遇到过类似错误，可以提交一段最小、脱敏的失败信息，或参加一次 15–20 分钟计时试用。我们同时记录失败案例，不以“愿意试试”冒充产品验证。

## 回复分类

| 回复 | 记录 | 动作 |
|---|---|---|
| 问题已解决但愿意复盘 | E2 | 访谈过去行为，不要求重现 |
| 可复现并愿意试用 | E3 候选 | 安排基线计时与 ForgeKit 计时 |
| 只说“很有用” | E1 | 感谢，不计入试用或需求比例 |
| 无关或拒绝 | declined | 停止联系 |
| 7 天内第二次主动使用 | E4 | 记录复用场景与触发事件 |
