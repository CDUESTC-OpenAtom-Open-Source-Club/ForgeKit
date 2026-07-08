# ForgeKit Technical Plan

> 版本：v0.1 规划稿
> 前置依赖：[REQUIREMENTS.md](./REQUIREMENTS.md)、[DESIGN.md](./DESIGN.md)
> 本文回答：需求和设计通过后，代码应该如何落地。

## 1. 开发前置条件

进入深度开发前必须满足：

1. 需求文档确认 v0.1 范围。
2. 设计文档确认分层和工具边界。
3. 至少完成初步用户/竞品验证。
4. 明确 v0.1 是 Docker-first，还是 Docker + deb 双闭环。

未满足这些条件，不新增能力实现代码。

## 2. v0.1 技术目标

| 目标 | 验收 |
|------|------|
| MCP Server 可被 Agent 发现工具 | MCP 客户端能列出工具 |
| 项目可被检查 | `inspect_project` 能识别语言、入口和已有打包配置 |
| 打包计划可生成 | 生成 `Forge.md` |
| Docker 构建能力可用 | 本地生成 `image_name:tag` 并可运行 |
| deb 构建能力可用（可选） | 仅当目标为 Ubuntu + systemd 时生成 Ubuntu 22.04 x86_64 `.deb` |
| 输出可解释 | 每个能力返回 `decision_basis` |
| 失败可诊断 | 构建失败返回错误摘要和原始日志路径 |
| E2E 可复现 | 示例 Python 项目可从源码生成产物 |

## 3. 目标目录结构

```text
src/
  mcp-server/
    index.ts
    tools/
      registry.ts
      executor.ts
    schemas/
      build-docker-image.schema.ts
      pack-deb.schema.ts
  capabilities/
    inspect-project.ts
    normalize-project.ts
    generate-packaging-plan.ts
    build-docker-image.ts
    pack-deb.ts
    types.ts
    utils/
      command.ts
      filesystem.ts
      checksum.ts
  packaging/
    forge-template.md
  systems/
    ubuntu/
      versions.yaml
      templates/
        Dockerfile.ubuntu-22.04
        control.template
        rules.template
  knowledge/
    deb-packaging.yaml
    docker-best-practices.yaml
tests/
  fixtures/
    sample-python-project/
  unit/
  integration/
  e2e/
```

## 4. 模块职责

| 模块 | 职责 | 禁止事项 |
|------|------|----------|
| `mcp-server` | MCP 协议、工具注册、请求转发 | 不直接执行 Docker/dpkg |
| `schemas` | 输入输出 Schema | 不写业务逻辑 |
| `capabilities` | 能力实现、命令执行、日志捕获 | 不依赖 MCP SDK |
| `packaging` | `Forge.md` 模板和渲染逻辑 | 不执行构建 |
| `systems` | 系统版本和模板 | 不写运行时逻辑 |
| `knowledge` | 决策和错误知识 | 不变成数据库服务 |
| `cli` | `forgekit plan` / `forgekit build` 命令，作为非 MCP Agent（如 Codex）的兜底入口 | 不直接实现构建，转发到 capabilities |
| `tests/fixtures` | 可复现样例项目 | 不放真实用户私有项目 |

## 5. 工具接口计划

### 5.1 通用结果结构

所有能力返回：

| 字段 | 说明 |
|------|------|
| `status` | `success` / `failed` |
| `artifacts` | 产物路径或镜像引用 |
| `logs` | 构建日志路径和摘要 |
| `warnings` | 非阻塞风险 |
| `decision_basis` | 决策依据 |
| `next_actions` | 失败或后续发布建议 |

### 5.2 错误结构

```json
{
  "status": "failed",
  "error": {
    "code": "docker_daemon_unavailable",
    "summary": "Docker daemon is not running.",
    "detail_log": "dist/logs/build-docker-image.log",
    "suggested_fix": "Start Docker Desktop and retry."
  }
}
```

错误必须面向 Agent 可解释，不只抛异常字符串。

计划前置约束：所有构建类工具（`build_docker_image` / `pack_deb`）必须接收 `plan_path`（已生成的 `Forge.md` 路径），缺失时返回 `plan_not_found` 错误，强制 Plan-before-build。

## 6. 开发顺序

### Phase 1: 文档冻结

| 任务 | 验收 |
|------|------|
| 需求文档评审 | v0.1 用户、范围、验收标准明确 |
| 设计文档评审 | 分层和工具边界明确 |
| 技术计划评审 | 目录、接口、测试顺序明确 |

### Phase 2: 基础接口

| 任务 | 验收 |
|------|------|
| 定义 TypeScript 类型 | 类型独立于 MCP SDK |
| 定义 JSON Schema | MCP tool schema 与类型一致 |
| 实现 executor | MCP 请求能路由到能力层 |

### Phase 3: 项目检查、适配与打包计划

| 任务 | 验收 |
|------|------|
| 实现 `inspect_project` | 能识别 Python 项目、入口、Dockerfile、pyproject |
| 实现 `normalize_project` | 检测非合规项目并生成标准打包脚手架，不改写源码 |
| 实现 `generate_packaging_plan` | 能生成 `Forge.md` |
| 写入计划文档 | 不覆盖用户内容，更新有明确区域 |
| Agent 使用说明 | 文档说明 Agent 应先适配、生成计划再构建 |

### Phase 4: Docker 能力

| 任务 | 验收 |
|------|------|
| 校验 source_dir 和 Dockerfile | 错误可解释 |
| 执行 `docker build` | 生成本地镜像 |
| 收集镜像信息 | 返回 image_ref、size、日志 |

### Phase 5: deb 能力（可选）

| 任务 | 验收 |
|------|------|
| 生成 debian 元数据 | control/rules/changelog 可检查 |
| 执行构建 | 生成 `.deb` |
| 校验产物 | SHA256、dpkg 信息可读 |

仅当 v0.1 目标环境确认需要 Ubuntu + systemd 时实现；否则后置到 v0.2。

### Phase 6: E2E

| 任务 | 验收 |
|------|------|
| Python fixture | 可构建 Docker + deb |
| Packaging document | fixture 生成 `Forge.md` |
| MCP E2E | 模拟 Agent 调用完成闭环 |
| 文档更新 | README 快速开始改为真实可用 |

## 7. 测试策略

| 层级 | 内容 | 工具 |
|------|------|------|
| Unit | Schema、路径校验、命令生成、错误解析 | Vitest |
| Integration | MCP executor 到能力层 | Vitest |
| E2E | 示例项目生成 Docker/deb | 手动 + 脚本 |
| Manual QA | 在干净机器或容器中跑 README | 发布前执行 |

v0.1 不追求高覆盖率，优先覆盖失败路径和用户可见行为。

## 8. 技术风险

| 风险 | 处理 |
|------|------|
| `tsconfig` build 与测试冲突 | build 只编译 `src`，测试由 Vitest 处理 |
| Docker 环境不可用 | 返回明确错误，不视作代码崩溃 |
| deb 构建依赖复杂 | 先用固定 Ubuntu 22.04 容器 |
| 模板生成破坏用户项目 | 所有生成物放入临时目录或 `dist/forgekit` |
| 打包计划覆盖用户手写内容 | 使用明确标记区域或先询问用户 |
| Agent 误传路径 | 严格做路径存在和越界检查 |

## 9. 开发门禁

每一轮开发结束必须有：

1. 本轮完成内容。
2. 测试结果。
3. 未解决风险。
4. 下一轮计划。

但这个门禁是开发流程，不是产品功能；不应写进运行时代码。

## 10. 第一轮开发建议

在三份文档评审通过后，第一轮代码只做：

1. 修正 `tsconfig`：build 只编译 `src`。
2. 抽出工具类型和 Schema。
3. 定义 `inspect_project` 与 `generate_packaging_plan` 的 Schema。
4. 实现 MCP executor 的空壳路由。
5. 写单元测试验证工具注册和 Schema。

不要在第一轮直接实现构建能力。先把 Agent 协议、`Forge.md` 打包计划和接口稳定，再接真实能力（优先 Docker，deb 可选）。
