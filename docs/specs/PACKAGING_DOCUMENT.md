# ForgeKit Packaging Document

> 本文定义 ForgeKit 的项目级打包说明文件：`Forge.md`。

## 1. 定义

`Forge.md` 是每个被 ForgeKit 处理的项目中可选生成的打包计划文件。

它不只是过程记录，更是 AI 的**上下文约束（Contextual Constraint）**与**决策契约（Decision Contract）**：把“这个项目应该如何被打包、为什么这么打包、哪些方案被拒绝、执行前必须满足什么安全前提、当前构建结果是什么”写成一份人和 Agent 都能理解、且能约束后续决策的文档（详见 §4.1）。

## 2. 为什么需要它

只靠 MCP 工具调用有一个问题：构建过程结束后，决策依据容易丢失。

只靠 README 也有问题：README 通常面向使用者，不适合记录详细打包策略。

`Forge.md` 解决三个问题：

1. 让 Agent 在执行前先形成打包计划，而不是盲目调用工具。
2. 让用户能审查目标平台、产物类型和风险。
3. 让后续 CI、维护者、其他 Agent 能复用同一份打包上下文。

## 3. 文件位置

默认位置：

```text
project-root/
  Forge.md
```

如果用户不希望写入项目根目录，ForgeKit 可以输出到：

```text
project-root/
  dist/
    forgekit/
      packaging.md
```

v0.1 推荐先写项目根目录，便于 Agent 和人类发现。

## 4. 文档结构

```markdown
# Forge Plan

## Project
- Name:
- Language:
- Runtime:
- Entry:
- Package manager:

## Goals
- Primary artifact:
- Secondary artifact:
- Target users:
- Target environment:

## Build Strategy
- Docker:
- Debian package:
- Architecture:
- Base image:
- System target:

## Decision Contract
- Feasibility Matrix: 候选方案 [安全性 | 技术难度 | 性能代价 | 维护成本] 评分(1-5)
- Decision Gates: 记录为何拒绝方案 B，防止循环重试
- Security Anchors: 执行前必检 pre_conditions（详见 §4.1）

## Decisions
- Why Docker:
- Why deb:
- Why Ubuntu version:
- Why architecture:

## Risks
- Runtime compatibility:
- Native dependencies:
- Docker daemon:
- System package limitations:

## Commands
- Inspect:
- Build Docker:
- Build deb:
- Verify:

## Results
- Docker image:
- Deb artifact:
- Logs:
- Checksums:

## Next Actions
- ...
```

### 4.1 决策契约（Decision Contract）：从过程记录到上下文约束

`Forge.md` 不应只是“做了什么”的记录，而应约束 AI 的后续决策。在 `## Decision Contract` 下包含三个子模块：

**1. 可行性矩阵（Feasibility Matrix）**
为每个候选方案按 1-5 分打分，使“为什么选 A 不选 B”可量化：

| 候选方案 | 安全性 | 技术难度 | 性能代价 | 维护成本 | 结论 |
|----------|--------|----------|----------|----------|------|
| Docker 镜像 | 5 | 2 | 3 | 2 | 推荐 |
| Ubuntu deb | 4 | 3 | 2 | 3 | 备选 |
| 安装脚本+压缩包 | 2 | 1 | 1 | 4 | 拒绝 |

**2. 决策门槛（Decision Gates）**
明确记录“为何拒绝方案 B”。这是防止 AI 在失败循环中无脑重试的关键：一旦 Gate 写定，后续循环必须引用而非推翻。

```text
rejected:
  - candidate: 安装脚本+压缩包
    reason: 无版本管理、维护成本高、无法被 systemd 托管
    gate: 不进入重试候选
```

**3. 安全扫描锚点（Security Anchors）**
定义执行前必须通过的 `pre_conditions`，由 Capability 层的 Pre-flight Check / Semantic Gateway 在触发 Local Tooling 前强制执行（详见 DESIGN §3.7）：

```yaml
pre_conditions:
  - forbid: "rm -rf /"              # 禁止容器外危险删除
  - require: debhelper_validation   # deb 必须过 debhelper 校验
  - fs_scope: [project_dir, dist/]  # 文件写入限定范围
```

## 5. v0.1 最小字段

v0.1 不需要一次写满所有字段，但必须包含：

| 字段 | 必须性 | 说明 |
|------|--------|------|
| Project | 必须 | 项目名、语言、入口 |
| Goals | 必须 | 要生成什么产物 |
| Build Strategy | 必须 | Docker/deb、目标平台 |
| Decisions | 必须 | 为什么这么选 |
| Risks | 必须 | 已知限制 |
| Results | 构建后必须 | 产物、日志、校验 |

## 6. 与 MCP 的关系

MCP 工具负责执行，`Forge.md` 负责记录计划和结果。

推荐流程：

1. `inspect_project` 读取项目。
2. `generate_packaging_plan` 生成 `Forge.md`。
3. 用户或 Agent 确认计划。
4. `build_docker_image` / `pack_deb` 执行。
5. ForgeKit 更新 Results。

> 写入采用**差量更新**（对应实现层的 `patch_forge.md`）：AI 只输出变更点（`op` / `target` / `change` / `reason`），底层应用到文件，而非重读全量再写回；与 Append-only 审计互补（详见 DESIGN §11.5A）。

> 完整分层架构与标准化流水线（Inspect → Plan → Resolve Dependencies → Build → Verify）见 [DESIGN §3](../DESIGN.md)；所有打包动作经由 Pre-flight Check (Semantic Gateway) 与 Observation & Feedback 回溯。

## 7. 与 Skill 文档的关系

Skill / Markdown 指南告诉 Agent “怎么使用 ForgeKit”。

`Forge.md` 告诉 Agent “这个项目具体怎么打包”。

两者区别：

| 文档 | 作用 |
|------|------|
| Agent Skill / Guide | 通用操作方法 |
| `Forge.md` | 单个项目的打包计划和结果 |

## 8. 示例

```markdown
# Forge Plan

## Project
- Name: demo-api
- Language: Python
- Runtime: Python 3.10
- Entry: app.py
- Package manager: pip

## Goals
- Primary artifact: Docker image
- Secondary artifact: Ubuntu deb
- Target users: club members deploying to Ubuntu server
- Target environment: Ubuntu 22.04 x86_64

## Build Strategy
- Docker: build local linux/amd64 image
- Debian package: package app and systemd service
- Architecture: x86_64
- Base image: python:3.10-slim
- System target: ubuntu-22.04

## Decision Contract
- Feasibility Matrix: Docker(5/2/3/2) 推荐, deb(4/3/2/3) 备选, 脚本(2/1/1/4) 拒绝
- Decision Gates: 拒绝纯安装脚本——无版本管理、维护成本高、无法被 systemd 托管
- Security Anchors: 禁止容器外 rm -rf, deb 须过 debhelper, 写入限 project_dir/dist

## Decisions
- Why Docker: easiest runtime isolation for first deployment.
- Why deb: target server uses Ubuntu and systemd.
- Why Ubuntu version: 22.04 matches target server.
- Why architecture: target server is x86_64.

## Risks
- Runtime compatibility: Python dependency versions need lock file.
- Native dependencies: unknown until install step.
- Docker daemon: must be running locally.
- System package limitations: deb support is v0.1 experimental.

## Commands
- Inspect: forgekit inspect .
- Build Docker: forgekit build-docker .
- Build deb: forgekit pack-deb .
- Verify: docker run demo-api:latest

## Results
- Docker image: pending
- Deb artifact: pending
- Logs: pending
- Checksums: pending

## Next Actions
- Confirm whether deb is required or Docker-only is enough.
```

## 9. 后续结构化

如果 `Forge.md` 在真实项目中稳定，后续可以增加机器可读版本：

```text
Forge.yaml
```

但 v0.1 先用 Markdown，因为它更适合人类审查，也更适合 Agent 读取和解释。
