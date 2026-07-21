# ForgeKit Review Guide

> 阶段：开发前规划评审
> 目标：确认需求、设计和技术计划足够清楚，再进入深度开发。

## 1. 评审结论要求

评审只给三种结论：

| 结论 | 含义 |
|------|------|
| Go | 可以进入下一阶段 |
| Revise | 需要修改文档后复审 |
| Stop | 当前方向缺乏需求或可行性，应重新定位 |

没有明确 Go 结论，不进入能力层开发。

## 2. 评审范围

| 文档 | 评审重点 |
|------|----------|
| [REQUIREMENTS.md](./REQUIREMENTS.md) | 用户是否真实、痛点是否成立、MVP 是否合理、商业价值是否可信 |
| [DESIGN.md](./DESIGN.md) | 架构是否可执行、分层是否必要、边界是否清楚 |
| [TECHNICAL_PLAN.md](./TECHNICAL_PLAN.md) | 技术落地是否具体、开发顺序是否合理、测试是否可执行 |
| [AGENT_INTEGRATION.md](./AGENT_INTEGRATION.md) | 是否清楚支持 Codex、Claude Code、Cline 等 Agent，MCP 是否作为主协议 |
| [PACKAGING_DOCUMENT.md](./specs/PACKAGING_DOCUMENT.md) | `Forge.md` 是否足够独特、可读、可执行 |
| [PROJECT_FRAMEWORK.md](./specs/PROJECT_FRAMEWORK.md) | 项目框架规范与非合规适配是否合理 |
| [ROADMAP.md](./ROADMAP.md) | 阶段边界是否清晰，是否防止过早扩范围 |
| [README.md](../README.md) | 对外定位是否准确，有无夸大当前能力 |

## 3. 需求评审问题

1. 目标用户是否足够具体，而不是“所有开发者”？
2. 用户痛点是否近期真实发生？
3. ForgeKit 相比 GitHub Actions、Dockerfile、Buildpacks、fpm、nfpm、GoReleaser 的差异是否清楚？
4. v0.1 选择 Python + Docker/deb 是否合理？
5. 如果调研显示 Docker-first 更合理，文档是否允许调整？
6. Agent 使用路径是否清楚：先生成打包计划，再调用 MCP 工具？
7. 商业价值是否建立在真实采用路径上，而不是泛泛说“市场很大”？

## 4. 设计评审问题

1. MCP 是否应该是唯一接入方式？
2. MCP Interface、Capability、System Adapter、Knowledge、Local Tooling 的边界是否清楚？
3. Agent Integration（接入策略）和 Packaging Plan / `Forge.md`（产物规范）是否必要，是否增加了真实独特性，而非被误建成空运行时代码？
4. v0.1 是否过早引入复杂知识库？
5. `decision_basis` 是否真的能提升用户信任？
6. 本地优先是否能满足试点用户？
7. 是否存在“看起来像平台，但实际做不完”的风险？

## 5. 技术计划评审问题

1. 目录结构是否支持后续扩展，但不过度设计？
2. 工具接口是否足够稳定？
3. 错误结构是否对 Agent 友好？
4. `inspect_project` 与 `generate_packaging_plan` 是否应先于构建能力？
5. 测试是否覆盖用户可见行为？
6. 第一轮开发是否过大？
7. `tsconfig`、构建、测试职责是否清楚分离？

## 6. Agent 协议与打包文档评审问题

1. v0.1 选择 MCP 作为主协议是否合理？
2. Skill / Markdown 指南是否足够辅助 Agent 理解流程？
3. 是否明确不在 v0.1 自研协议？
4. `Forge.md` 是否比普通 README 更有价值？是否存在生成后无人维护的腐烂风险？
5. 打包文档是否能被人类、Agent、CI 同时复用？
6. `build_docker_image` / `pack_deb` 是否强制要求先有 `Forge.md`（Plan-before-build 是否被强制而非靠 Agent 自律）？
7. v0.1 是否明确 `Docker 为硬闭环、deb 为可选`，且各文档口径一致？

## 7. 路线图评审问题

1. v0.0 是否真正阻止了过早开发？
2. v0.1 是否能在有限时间内完成？
3. v0.2 是否基于真实项目反馈，而不是凭空扩功能？
4. v0.3/v1.0 是否只作为方向，不影响 v0.1 收敛？

## 8. 打分表

| 项目 | 分数 1-5 | 说明 |
|------|----------|------|
| 需求真实性 |  | 是否有真实用户和真实痛点 |
| MVP 聚焦度 |  | 是否足够小且能验证核心假设 |
| 架构可执行性 |  | 是否能落地，不只是概念 |
| 技术计划清晰度 |  | 是否能指导开发 |
| Agent 接入清晰度 |  | 是否清楚 MCP、Skill/Markdown 和未来协议边界 |
| 打包文档独特性 |  | `Forge.md` 是否有清晰价值 |
| 商业/采用价值 |  | 是否有明确采用路径 |
| 风险控制 |  | 是否知道什么不做 |

Go 标准：总分不低于 32/40，且“需求真实性”“架构可执行性”“Agent 接入清晰度”都不低于 4。

## 9. 评审输出模板

```markdown
## 结论
Go / Revise / Stop

## 分数
- 需求真实性：
- MVP 聚焦度：
- 架构可执行性：
- 技术计划清晰度：
- Agent 接入清晰度：
- 打包文档独特性：
- 商业/采用价值：
- 风险控制：

## 必改项
- ...

## 可后置项
- ...

## 是否允许进入开发
是 / 否
```
