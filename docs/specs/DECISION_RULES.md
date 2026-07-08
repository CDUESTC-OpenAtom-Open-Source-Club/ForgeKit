# ForgeKit 决策规则规范

> 本文档定义 ForgeKit 多端决策规则的位置、结构和边界，避免与代码重复维护。

---

## 1. 决策规则的位置

决策规则分布在两个层级：

| 层级 | 位置 | 作用 | 维护者 |
|------|------|------|--------|
| **系统级决策规则** | src/systems/<端类型>/<平台>/decision-rules.yaml | 特定平台的技术决策（如 Ubuntu 版本选择、Android 签名配置） | 能力层开发者 |
| **通用决策规则** | src/knowledge/decisions.yaml | 跨端通用决策（如语言识别、项目类型判断） | 架构维护者 |

**示例**：
- 系统级：src/systems/servers/ubuntu/decision-rules.yaml（Ubuntu glibc 版本选择）
- 通用级：src/knowledge/decisions.yaml（项目语言识别、端类型判断）

---

## 2. 已落地的决策规则

### 2.1 系统级决策规则（已实现）

| 文件路径 | 端类型 | 平台 | 核心决策 |
|----------|--------|------|----------|
| src/systems/servers/ubuntu/decision-rules.yaml | servers | Ubuntu | Ubuntu 版本选择、glibc 兼容性、Docker vs deb 选择 |
| src/systems/mobile/android/decision-rules.yaml | mobile | Android | Android 版本选择（API 30-34）、签名配置、证书管理 |
| src/systems/web/pwa/decision-rules.yaml | web | PWA | PWA 打包方式、浏览器兼容性、HTTPS 托管 |
| src/systems/desktop/windows/decision-rules.yaml | desktop | Windows | exe 打包方式、签名配置、SmartScreen 处理 |

### 2.2 通用决策规则（已实现）

| 文件路径 | 作用 | 核心决策 |
|----------|------|----------|
| src/knowledge/decisions.yaml | 项目类型判断 | 语言识别、端类型判断（servers/mobile/web/desktop） |

---

## 3. 决策规则与 Forge.md 的关系

| 对比维度 | 决策规则（decision-rules.yaml） | Forge.md |
|----------|--------------------------------|----------|
| **作用域** | 通用规则库（所有项目共享） | 单个项目级计划 |
| **生成方式** | 手动维护（开发者编写） | Agent 调用工具生成 |
| **更新频率** | 低（架构稳定后很少变更） | 高（每次构建都可能更新） |
| **内容** | 规则、条件、建议、风险 | 具体项目的决策结果、产物路径 |

---

## 4. 决策规则维护规范

详见已落地的 YAML 文件，核心字段：
- 端类型、平台、产物格式、适用场景
- 决策规则（版本选择、打包方式、签名配置等）
- 风险提示、构建流程、验证方法

---

*本规范由 ForgeKit 维护。*
