# ForgeKit 架构规范化与v0.2准备计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 解决v0.1发现的架构问题，规范化项目结构，为v0.2开发做好准备

**Architecture:** 移除TypeScript path aliases，统一编译流程；规范化目录结构；整理归档历史文档

**Tech Stack:** TypeScript, ESLint, Node.js, Git

---

## Task 1: 修复TypeScript编译环境不一致问题

**Files:**
- Modify: `tsconfig.json`
- Modify: `src/**/*.ts` (所有使用path aliases的文件)
- Test: `npm run build && node dist/mcp-server/index.js`

- [ ] **Step 1: 分析当前path aliases使用情况**

```bash
# 查找所有使用path aliases的导入
grep -r "@capabilities/" src/
grep -r "@mcp-server/" src/
grep -r "@knowledge/" src/
```

- [ ] **Step 2: 移除tsconfig.json中的paths配置**

```json
{
  "compilerOptions": {
    // 删除以下配置
    "baseUrl": "./src",
    "paths": {
      "@/*": ["./*"],
      "@mcp-server/*": ["mcp-server/*"],
      "@capabilities/*": ["capabilities/*"],
      "@knowledge/*": ["knowledge/*"],
      "@templates/*": ["templates/*"]
    }
  }
}
```

- [ ] **Step 3: 批量替换导入路径**

```bash
# 创建替换脚本
cat > /tmp/fix-imports.sh << 'EOF'
#!/bin/bash
# 替换 @capabilities/ 为相对路径
find src -name "*.ts" -exec sed -i '' 's|@capabilities/|../../capabilities/|g' {} \;

# 替换其他path aliases
find src -name "*.ts" -exec sed -i '' 's|@mcp-server/|../|g' {} \;
find src -name "*.ts" -exec sed -i '' 's|@knowledge/|../knowledge/|g' {} \;
EOF

chmod +x /tmp/fix-imports.sh
```

- [ ] **Step 4: 验证编译**

```bash
npm run clean
npm run build
npm test
```

Expected: 所有测试通过，编译产物使用相对路径

- [ ] **Step 5: 提交修改**

```bash
git add tsconfig.json src/
git commit -m "fix: 移除TypeScript path aliases，提高编译可移植性

- 删除tsconfig.json中的paths配置
- 替换所有@capabilities/@mcp-server导入为相对路径
- 修复编译环境不一致问题（服务器编译使用path aliases）
- 确保编译产物在不同环境下一致"
```

---

## Task 2: 规范化项目根目录

**Files:**
- Move: `Forge.md` → `docs/specs/forge-template.md`
- Delete: `.gitignore.new`
- Modify: `.gitignore`

- [ ] **Step 1: 移动示例文件**

```bash
# Forge.md是模板示例，应放在docs/specs/
mv Forge.md docs/specs/forge-template.md

# 更新README中的引用
sed -i '' 's|Forge.md|docs/specs/forge-template.md|g' README.md
```

- [ ] **Step 2: 清理临时文件**

```bash
# 删除临时文件
rm .gitignore.new

# 确保构建产物被忽略
echo "tsconfig.tsbuildinfo" >> .gitignore
echo "coverage/" >> .gitignore
```

- [ ] **Step 3: 提交清理**

```bash
git add .
git commit -m "chore: 规范化项目根目录

- 移动Forge.md示例到docs/specs/
- 删除临时文件.gitignore.new
- 更新.gitignore排除构建产物"
```

---

## Task 3: 整理docs/beian-page目录

**Files:**
- Move: `docs/beian-page/` → `docs/archive/beian-page/`

- [ ] **Step 1: 分析beian-page内容**

```bash
ls -la docs/beian-page/
# 确认这些是2026-07-09的备案页面文件，已过期
```

- [ ] **Step 2: 归档到archive**

```bash
# 移动到archive目录
mv docs/beian-page docs/archive/

# 更新docs/archive/README.md记录归档原因
```

- [ ] **Step 3: 更新归档说明**

```markdown
## beian-page/
- 归档时间：2026-07-21
- 原因：备案页面临时文件，已过使用期
- 内容：HTML页面、部署脚本、修复计划等
```

- [ ] **Step 4: 提交归档**

```bash
git add docs/
git commit -m "docs: 归档过期备案页面文件到archive"
```

---

## Task 4: 补全缺失的配置文件

**Files:**
- Add: `tsconfig.eslint.json`（如果还未提交）
- Modify: `.eslintrc.js`

- [ ] **Step 1: 确保tsconfig.eslint.json存在**

```bash
# 检查文件
cat tsconfig.eslint.json

# 如果不存在，创建
cat > tsconfig.eslint.json << 'EOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"],
  "exclude": ["node_modules", "dist", "src/systems"]
}
EOF
```

- [ ] **Step 2: 验证ESLint**

```bash
npm run lint
# 应该只有warnings，无errors
```

- [ ] **Step 3: 提交配置**

```bash
git add tsconfig.eslint.json .eslintrc.js
git commit -m "chore: 补全ESLint TypeScript配置"
```

---

## Task 5: 创建v0.2架构准备文档

**Files:**
- Create: `docs/superpowers/plans/v0.2-architecture-prep.md`

- [ ] **Step 1: 总结当前架构风险**

创建文档记录：
- 已解决的架构问题
- v0.2需要关注的扩展性
- 多架构、多语言支持的架构预留

- [ ] **Step 2: 规划v0.2目录结构**

```
src/
  capabilities/
    servers/          # 新增：服务器端打包能力
      docker/
      deb/
      rpm/            # v0.2新增
    mobile/           # v0.3规划
    web/              # v0.3规划
  knowledge/
    decision-rules/   # 结构化决策规则
      servers/
        ubuntu.yaml
        centos.yaml
  templates/
    python-project/
    typescript-project/  # v0.2新增
    go-project/          # v0.2新增
```

- [ ] **Step 3: 提交规划文档**

```bash
git add docs/superpowers/
git commit -m "docs: 创建v0.2架构准备文档"
```

---

## 验收标准

| 项目 | 标准 |
|------|------|
| 编译一致性 | 本地与服务器编译产物使用相同路径格式 |
| ESLint | `npm run lint` 只有warnings，无errors |
| 测试 | `npm test` 全部通过 |
| 目录规范 | 根目录无临时文件，文档结构清晰 |
| 归档完整 | 过期文件已归档，archive/README.md有记录 |

---

**Plan complete and saved to `docs/superpowers/plans/2026-07-21-architecture-cleanup-v0.2.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**