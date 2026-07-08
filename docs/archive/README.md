# ForgeKit 文档归档（Archive）

本目录用于存放**阶段性、已被新版本取代或不再适应当前阶段的文档**。

现行规划文档（v0.0 / v0.1 规划冻结期）仍留在 `docs/` 根目录，彼此互相引用，保持连贯，不在此处。

## 归档策略

- **阶段切换时整体归档**：当某个阶段结束（例如 v0.1 开发完成、进入 v0.2），将对应的规划稿整体移入 `docs/archive/<stage>/`，例如 `docs/archive/v0.0-planning/`。
- **单文档被取代时归档**：某份文档被新版本取代，移入 `docs/archive/` 并保留原文件名，必要时在文件名后加日期后缀（如 `DESIGN.2026-07-08.md`）。
- **链接处理**：移入归档的文档不再参与当前交叉引用；若其他现行文档仍引用它，需将链接更新为指向现行版本，或改为引用归档路径。
- **归档不是删除**：归档文档保留以便回溯决策历史与演进脉络。

## 当前状态

截至 v0.0 规划冻结期，以下 7 份均为现行、互相引用的文档，**暂无过时文档需要归档**：

- `docs/REQUIREMENTS.md`
- `docs/DESIGN.md`
- `docs/TECHNICAL_PLAN.md`
- `docs/ROADMAP.md`
- `docs/REVIEW.md`
- `docs/AGENT_INTEGRATION.md`
- `docs/PACKAGING_DOCUMENT.md`
