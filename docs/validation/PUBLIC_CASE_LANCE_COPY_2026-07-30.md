# 公开案例：Lance Data Viewer 多源 COPY

> 来源：https://github.com/lance-format/lance-data-viewer/issues/62  
> 固定提交：`c3f812318b31b5bdc1e578bd11373f24f8d808ee`  
> 日期：2026-07-30

## 原始问题

用户在 Docker classic builder 执行 `COPY backend/*.py .`。`backend` 中有两个 Python 文件，通配符展开为多个源，构建返回：

```text
When using COPY with more than one source file, the destination must be a directory and end with a /
```

首次使用 ForgeKit v0.2.2-rc.1 诊断时错误返回 `unknown`。该案例因此进入公开回归语料，而不是被包装成成功案例。

## 产品改进

新增高置信度 `build_config_invalid` 规则，返回：

- 原因：Docker classic builder 的多源 COPY 目标必须是明确目录；
- 最小变更：`COPY backend/*.py ./`；
- 验证：保持相同 context/Dockerfile 重建，并继续启动镜像验证；
- 边界：Podman 4.9.4 接受目标 `.`，但这种行为不能证明 Docker classic builder 兼容。

自动测试已加入真实公开日志和来源链接。

## 独立运行时验证

阿里云服务器无法拉取完整项目的 `python:3.11-slim-bookworm`，因此完整项目构建停在 Registry 网络阶段，不能声称复现了 COPY 失败。

为单独验证语义，使用本机已有基础镜像和同样的两个 Python 源文件建立隔离最小项目：

| 运行时 | `COPY backend/*.py .` | `COPY backend/*.py ./` |
|---|---|---|
| Podman 4.9.4 Docker CLI 兼容层 | 通过 | 通过 |
| Issue 中 Docker classic builder | 失败 | 待维护者/用户复验 |

修正版本在 Podman 上构建后能够运行。结论只支持“`./` 是更可移植的目录目标写法”，不支持“ForgeKit 已替维护者完成真实项目修复”。

## 证据等级

- 原始失败：E2（公开 Issue 与复现命令）；
- ForgeKit 分类改进：仓库自动回归；
- Podman 兼容差异：真实服务器最小实验；
- 用户采用、定位时间改善、复用：尚无证据，不能计为 E3/E4。
