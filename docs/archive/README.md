# ForgeKit 文档归档

本目录存放**阶段性完成、已被取代或详细参考资料**的历史文档。

## 归档分类

### v0.1-mvp/
v0.1 MVP阶段完成的实施计划和验收报告
- `ACCEPTANCE.md` - v0.1验收报告
- `PHASE1_MVP_REPORT.md` - 第一阶段MVP报告
- `V0.1_IMPLEMENTATION.md` - v0.1实施计划

### v0.2-planning/
v0.2规划阶段的历史草案和架构准备
- `OLD_PLAN.md` - 早期v0.2计划草案
- `v0.2-architecture-prep.md` - v0.2架构准备文档

### beian-page/
2026-07-09备案页面临时文件（已过期）
- 备案页面HTML、部署脚本、修复计划等

### reference/
详细参考文档，核心文档中保留摘要和链接
- `MARKET_RESEARCH.md` - 完整市场调研报告
- `AGENT_INTEGRATION.md` - 详细Agent接入方案
- `BLUE_OCEAN.md` - 蓝海扩展方向分析
- `PILOTS.md` - 试点候选与拍板记录
- `REVIEW.md` - 发布前评审清单

## 文档策略

- **现行文档**：保持在 `docs/` 根目录，精简清晰
- **参考文档**：详细内容归档到 `reference/`，核心文档保留摘要
- **历史文档**：阶段性文档归档到对应版本目录

## 引用方式

核心文档中通过相对路径引用归档文档：
```markdown
详细市场调研见 [archive/reference/MARKET_RESEARCH.md](./archive/reference/MARKET_RESEARCH.md)
```