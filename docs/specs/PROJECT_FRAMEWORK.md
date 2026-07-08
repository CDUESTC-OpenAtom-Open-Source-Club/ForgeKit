# ForgeKit 项目框架规范（Project Framework）

> 本文是 [DESIGN.md](../DESIGN.md) 的子文档，定义项目要"能被 ForgeKit 打包"应遵循的框架约定，以及非合规项目的适配（normalize）方式。

## 1. 目的

工具只按统一框架打包；结构"不三不四"的项目先归一化为标准框架再打包，避免工具无从下手、产出不可控。

## 2. 标准框架约定（输入侧）

项目应满足：

- **元数据可识别**：语言 / 入口 / 依赖来自 `pyproject.toml`、`package.json`，或显式写在 `Forge.md` 的 Project 段；
- **构建产物可描述**：目标平台、架构、基础镜像、系统服务在 `Forge.md` 的 Build Strategy 段声明；
- **入口明确**：存在单一可运行入口，能被 Dockerfile / 启动脚本定位。

> 框架规范是"项目该怎么组织"（输入约定）；`Forge.md` 是"本次怎么打包"（输出计划），两者互补，不是同一件事。

## 3. 非合规适配（normalize）

在 `inspect_project` 之后、`generate_packaging_plan` 之前插入 `normalize_project`：

1. 检测是否符合框架（缺 Dockerfile？缺元数据？入口不明？）；
2. 对不合规项目**生成合规打包脚手架**（Dockerfile、`debian/` 元数据、补齐声明），不改写用户源码；
3. 输出适配报告：补了什么、为什么、是否需用户确认。

流程变为：`inspect → normalize(不三不四→标准) → 生成 Forge.md → build`。

## 4. 边界

- 适配只生成"围绕项目的打包脚手架 / 元数据"，不搬移或改写用户源码；
- 对无法归一的項目，适配层报错并给建议，而非硬转；
- 模板与系统版本知识由 System Adapter / Knowledge 层提供，适配层只做编排。

## 5. 与 MCP 工具的关系

`normalize_project` 与 `inspect_project`、`generate_packaging_plan` 同属计划前置阶段，先于构建类工具 `build_docker_image` / `pack_deb`。
