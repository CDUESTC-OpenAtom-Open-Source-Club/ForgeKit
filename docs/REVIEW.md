# ForgeKit 文档评审清单 (Review Guide)

> **评审背景**：本文档是 ForgeKit 项目 v0.1 的系统评审指引。
> - **受众**：项目核心成员 + 邀请的社区评审人
> - **时机**：文档定稿阶段（编码开始前）
> - **方式**：评审人对照本文档逐项检查，填写反馈
> - **后续**：反馈合并 → 文档定稿 → 进入编码

> **当前状态**：✅ 已完成首轮评审 + P0/P1 改进，待定问题已决策（见下方 Q1-Q4）。

---

## 评审范围

| 文档 | 内容 | 评审重点 |
|------|------|----------|
| [README.md](../README.md) | 项目定位、架构概览、能力表 | 定位是否清晰？和 Vector 区分是否足够？ |
| [REQUIREMENTS.md](./REQUIREMENTS.md) | 需求定义、MVP 范围、成功指标 | MVP 范围是否合理？指标是否可量化？ |
| [DESIGN.md](./DESIGN.md) | 架构设计、技术选型、演进路线 | 分层是否合理？待定问题怎么选？ |

---

## 核心评审问题

### 1. 定位与差异化
- **"Agent-Native Build & Release Platform"** 这个定位是否清晰？
- 和 Vector 等工业平台的区分是否足够？会不会被误解成"阉割版"？
- 目标用户（社团成员 + 独立开发者）是否覆盖合理？

### 2. MVP 范围
- v0.1 只做 `pack_deb` + `build_docker_image` + 1 个 Python 模板，是否太窄/太宽？
- MVP 验收标准（"AI 调用 → 产物可用"）是否足够验证范式？

### 3. 架构分层
- 5 层架构（接入/知识/能力/模板/底座）是否合理？有无冗余/缺失？
- 知识层作为核心差异化（一半价值在知识），这个判断是否正确？
- 能力层原子化规范（含 `decision_basis`）是否足够 Agent 友好？

### 4. 技术选型
- MCP Server 用 TypeScript 还是 Python？（见待定问题 1）
- 知识库用 Markdown + YAML 是否合适？要不要用更结构化的方案（JSON Schema / 数据库）？

### 5. 成功指标
- Agent 调用成功率 60%（MVP）→ 90%（长期），这个梯度是否合理？
- 社团成员使用人数 3 → 20+，是否有推广计划支撑？

---

## 待定问题（已决策）

来自 DESIGN.md Section 10，多专家评审已给出结论：

### Q1: MCP Server 语言选型
- **选项 A**：TypeScript（官方 SDK 成熟，类型安全，社团熟悉）
- **选项 B**：Python（社团更熟，但 MCP SDK 不如 TS 完善）
- **✅ 决策**：**TypeScript**
- **理由**：4 位专家一致通过。官方 `@modelcontextprotocol/sdk` 更成熟，类型安全对工具 Schema 定义更友好，社团技术栈统一。

### Q2: 社团私有源 / registry 地址
- apt/yum 私有源用什么地址？（社团是否有现有基础设施？）
- Docker registry 用 Docker Hub、GitHub Packages、还是自建？
- **✅ 决策**：**MVP 阶段不做私有源**，产物存 GitHub Releases
- **理由**：0 成本起步，MVP 验证范式优先。v0.2 调研 GitHub Packages，社团规模扩大后再考虑自建。
- **分阶段计划**：
  - v0.1（MVP）：产物存 GitHub Releases，本地验证
  - v0.2：调研 GitHub Packages（apt/yum 源 + Docker registry）
  - v1.0：社团自托管（如有需求）

### Q3: 能力层与底座调用方式
- **选项 A**：CLI 调用（底座封装成命令行工具）
- **选项 B**：HTTP API（底座暴露 REST/gRPC）
- **选项 C**：直接复用 GitHub Actions workflow（Agent 触发 workflow）
- **✅ 决策**：**CLI 调用**
- **理由**：最轻量，调试方便，CI/本地都可运行。调用链：`Agent → MCP Server → CLI → Docker 容器`。每层可独立测试。
- **架构**：
  ```
  Agent → MCP Server (TypeScript)
           ↓ child_process.spawn()
          CLI (底座命令行工具)
           ↓ exec()
          Docker 容器（隔离构建环境）
  ```

### Q4: 鉴权需求
- **选项 A**：暂不做鉴权（MVP 私有开发，后期再加）
- **选项 B**：社团内部用简单 token，外部开源后做 OAuth
- **✅ 决策**：**MVP 不做鉴权**，预留 auth middleware 插槽
- **理由**：内部社团使用，降低试用门槛。MVP 私有开发，加鉴权增加复杂度无收益。
- **扩展点设计**：MCP Server 入口预留 header-based auth middleware 插槽，v0.4 后再实现。

---

## 评审反馈格式

请按以下结构回复：

```markdown
## 评审结论
- 定位清晰度：★☆☆☆☆ / ★★☆☆☆ / ★★★☆☆ / ★★★★☆ / ★★★★★
- MVP 范围合理性：...
- 架构设计合理性：...
- 整体评分：X / 10

## 具体建议
- [定位/范围/架构/技术选型/指标]：...

## 待定问题反馈
- Q1：...
- Q2：...
- Q3：...
- Q4：...

## 其他建议
- ...
```

---

*感谢评审！反馈会直接合并到下一版文档。*