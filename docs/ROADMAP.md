# ForgeKit Roadmap

> **执行状态（2026-07-20）**：下述多端与多版本内容属于后续路线，不代表当前承诺或已实现能力。当前阶段冻结扩张范围，集中用于教学、契约演示、质量完善和可复现验证。详见 [CURRENT_OBJECTIVES.md](./CURRENT_OBJECTIVES.md)。

> 本路线图是 ForgeKit 的**交付契约层**扩展规划入口。
> 核心定位：面向 AI Agent 的可验证交付契约层——把"能跑的代码"可靠推进到"可直接分发的产物"。
> 每届 MVP 的价值阶梯与 v0.1 最高战略价值判定见 [REQUIREMENTS.md §8](./REQUIREMENTS.md)。

## 核心判断

ForgeKit 现在最重要的不是覆盖所有端，而是先证明一条最小**契约闭环**：

**服务器端契约闭环（v0.1-v0.2）** → **移动端契约跨端化（v0.3-v0.4）** → **桌面端可选（v0.5）** → **完整验收 + L2 起步（v1.0）**

用户向 AI agent 表达打包意图，Agent 调用 ForgeKit MCP 工具（强制 `plan_path` 契约前置），ForgeKit 在本地生成可验证产物（Docker、deb/rpm、APK/IPA、PWA、exe 等），并返回构建日志、产物路径、SHA256 校验和、`decision_basis` 决策依据与 `result.json` 观测回溯。

> **v0.1 是价值最高的一版**：它在最便宜的表面（服务器端 Docker）上，端到端证明"带决策与观测的可验证交付契约"这一唯一论点；后续版本只是把同一份契约扩展到更多端。这条闭环跑通之前，上架流程、云构建、完整平台都应后置。

---

## 实施策略（三阶段推进）

把"价值分层（L0–L3）"落到执行顺序上，三个方向按以下节奏推进，避免过早摊大：

- **阶段 A — 刀刃切入（方向二：MCP 交付层）**：以 MCP Server 为主协议，把 ForgeKit 切进开发者与 AI Agent 的日常工作流，先证明本地交付闭环（v0.1–v0.3）。这是获客层（L0），目标是"有人用、用得对"。
- **阶段 B — 数据养料（方向一：翻车记录 → 规则库）**：把每次构建的成败、state_delta、错误类型（观测与回溯层）作为养料，持续反哺 `decision-rules.yaml` 与兼容性矩阵，不断完善契约层（v0.2–v1.0 持续进行）。这是数据护城河（L1），越用越准。
- **阶段 C — 商业化与企业落地（方向三）**：仅当系统达到**成熟度门禁（80 分绿灯）**后，才启动商业化与企业落地叙事，开启云端构建/签名/分发（L2）与标准效应（L3）。未达标前不提前铺云、不讲故事。

> 逻辑：先用 MCP 拿到真实流量与失败样本（A→B 闭环），再用数据把契约层磨厚，最后在系统足够健壮时（绿灯）才谈钱——避免在价值未证实时空讲商业化。

### 成熟度门禁（80 分绿灯标准）

进入阶段 C 前必须满足（量化口径见 DESIGN §10 对抗性评估、§11 评估体系）：

| 维度 | 绿灯门槛 |
|------|----------|
| Agent 一次交付成功率 | ≥ 80% |
| 失败可解释率 | ≥ 90% |
| 多端覆盖 | 服务器端 + 移动端 + Web→移动端 稳定 |
| 契约完整度 | 可行性矩阵 / 决策门槛 / 安全锚点 全覆盖且可机读 |
| 数据闭环 | 构建结果 100% 回流规则库 |

---

## 多端扩展路线总览

| 阶段 | 目标 | 多端覆盖 | 成功标准 |
|------|------|----------|----------|
| v0.0 | 规划冻结 | 完成 docs + 多端架构设计 | 核心文档通过评审，多端决策规则清晰 |
| v0.1 | 服务器端基础闭环 | Docker（deb 可选） | Agent 调用 → Forge.md → Docker 镜像可验证 |
| v0.2 | 服务器端扩展 | rpm + 多语言 + 错误诊断 | 3 个真实项目完成打包，失败有可读诊断 |
| v0.3 | 移动端 + Web→移动端（并行） | APK + IPA + PWA + Hybrid + Flutter/React Native | 移动端和Web→移动端并行验证 |
| v0.4 | 移动端验收 | 完整移动端闭环 | 移动端产物可直接安装，证书流程清晰 |
| v0.5 | 桌面端（可选） | Windows exe + macOS app（Linux 归服务器端，不在桌面端） | 仅在确认真实需求后实现 |
| v1.0 | 多端完整验收 | 所有端稳定 + 统一编排 + 增量更新 | 外部用户可在文档指导下完成多端打包 |
| v1.5 | 长尾端扩展 | 电视/车载/嵌入式、Linux 桌面 GUI、小众 OS | 长尾场景按需落地 |

---

### 已知缺口与版本分配（迭代规划）

下表把当前已知的"缺乏支持"项逐一分配到版本，避免只写"未来支持"：

| 缺口项 | 分配到版本 | 说明 |
|--------|-----------|------|
| 多架构（arm64） | v0.2（必做） | 双架构验收，不再可选 |
| 服务器端小众发行版（Arch/openSUSE） | v0.2（可选） | 按需 |
| 云函数 / Serverless 产物 | v0.2（可选）→ v1.0 强化 | Lambda / 云函数部署包 |
| Web→移动端增量框架（Ionic/NativeScript/UniApp/小程序转移动端） | v0.3（可选增量） | 在 Hybrid 基础上扩展 |
| 小程序 / 快应用（微信/支付宝） | v0.4 | Web 开发者高频场景 |
| 签名证书自动化 / 托管 | v0.4 | 降低用户负担 |
| 鸿蒙（HarmonyOS） | v0.4（评估）→ 后续 | APK 兼容层 |
| 浏览器扩展 / WASM 产物 | v0.5（可选） | 桌面端扩展场景 |
| 统一多端编排（一次源码 → 多端产物） | v1.0 | 架构级能力 |
| 增量 / 差量更新（delta / 热更新） | v1.0（可选） | 分发增强 |
| 电视 / 车载 / 嵌入式（Android TV/tvOS/车机） | v1.5 | 长尾 |
| Linux 桌面 GUI 应用（AppImage/Snap/Flatpak） | v1.5 | 确有需求后置 |
| 小众移动 OS（KaiOS/Wear OS） | v1.5（按需） | 仅试点验证 |

## v0.0: 规划冻结（当前阶段）

### 目标

在深度开发前讲清楚多端需求、设计和技术落地，避免框架未定时提前写代码。

### 必做范围

| 文档 | 必须回答的问题 |
|------|----------------|
| [REQUIREMENTS.md](./REQUIREMENTS.md) | 多端用户场景、为什么不做上架、MVP范围如何收窄 |
| [DESIGN.md](./DESIGN.md) | 多端架构为什么这样分层、多端适配层设计是否合理 |
| [TECHNICAL_PLAN.md](./TECHNICAL_PLAN.md) | 多端目录结构、能力扩展顺序、测试覆盖策略 |
| [AGENT_INTEGRATION.md](./AGENT_INTEGRATION.md) | 多端工具如何通过 MCP 调用、决策规则如何生效 |
| [PACKAGING_DOCUMENT.md](./specs/PACKAGING_DOCUMENT.md) → `Forge.md` | 多端打包计划如何记录、决策路径如何规划 |
| [PROJECT_FRAMEWORK.md](./specs/PROJECT_FRAMEWORK.md) | 项目框架规范与非合规适配（normalize） |
| [ROADMAP.md](./ROADMAP.md) | 多端扩展路线是否合理、每个阶段验收标准是否清晰 |

### 退出标准

1. 三份核心文档完成并通过评审（多端范围明确）。
2. 多端决策规则设计完成（decision-rules.yaml）。
3. 至少 3 个真实项目试点候选（至少包含移动端或Web端需求）。
4. 【已拍板】v0.1 = Docker 硬闭环 + deb 可选（若试点证伪 deb 需求则后置 v0.2）。

未达到退出标准，不进入 v0.1 能力层开发。

---

## v0.1: 服务器端基础闭环

### 目标

验证 MCP + Forge.md + 本地构建闭环（服务器端优先）。

### 必做范围

| 模块 | 交付内容 | 验收方式 |
|------|----------|----------|
| MCP Server | 工具列表、参数校验、工具执行、错误返回 | MCP 集成测试通过 |
| `inspect_project` | 识别项目语言、入口、已有打包配置 | 能输出结构化项目摘要 |
| `generate_packaging_plan` | 生成 `Forge.md`（包含决策依据） | 人和 Agent 都能审查计划 |
| `build_docker_image` | 构建 linux/amd64 Docker 镜像（硬闭环） | 镜像可本地运行 |
| `pack_deb`（可选） | Python 项目打包为 Ubuntu x86_64 `.deb` | 仅当目标为 Ubuntu + systemd 时实现；否则后置到 v0.2 |
| Python 示例项目 | 一个最小但真实的 fixtures/template | E2E 测试使用该项目 |
| 知识库 | Docker（deb 可选）决策规则（decision-rules.yaml） | 工具输出包含 `decision_basis` |
| 测试 | 单元测试、MCP 集成测试、手动 E2E 记录 | `npm test` 和一次 E2E 验收通过 |

### 明确不做

| 不做项 | 后置原因 |
|--------|----------|
| rpm | v0.2 才扩展 rpm，避免包格式并行增加复杂度 |
| 移动端（APK/IPA） | v0.3 才开始移动端，先验证服务器端闭环 |
| Web→移动端（PWA/Hybrid） | v0.3 与移动端并行开发 |
| 桌面端（exe/app） | v0.5 可选扩展，仅在确认需求后实现 |
| Docker registry 推送 | 先保证本地镜像可构建、可运行 |
| 上架流程（Google Play/App Store） | **明确不做**，只做本地打包和分发 |

### 建议任务顺序

1. 完成 Forge.md 重命名和文档同步。
2. 实现 MCP Server 工具注册和执行。
3. 实现 `inspect_project` 与 `generate_packaging_plan`（包含服务器端决策规则）。
4. 实现能力执行层：`src/capabilities/servers/`，让 MCP Server 调用真实能力。
5. 补齐 Python fixture：确保示例项目足够小，但包含版本、入口、依赖和 Dockerfile。
6. 打通 `build_docker_image`：先只支持 linux/amd64、本地 tag。
7. 打通 `pack_deb`（可选）：先只支持 Ubuntu 22.04 + x86_64，仅当目标为 Ubuntu + systemd。
8. 增加 E2E 验收脚本：记录从 agent 指令到打包计划和产物的路径。
9. 更新 README 快速开始：只有当命令真实可用后再改成正式教程。

---

## v0.2: 服务器端扩展

### 目标

扩展服务器端覆盖，完善错误诊断，为多端扩展打下基础。

### 必做范围

| 模块 | 交付内容 |
|------|----------|
| rpm 打包 | 支持 CentOS 9 / EulerOS 2.9 rpm 构建 |
| 多语言支持 | Go、TypeScript 项目模板和构建能力 |
| 多架构支持 | linux/amd64 + linux/arm64 双架构（必做验收，不再是可选） |
| 小众 Linux 发行版 | Arch、openSUSE 等系统级安装包（可选，按需） |
| 云函数 / Serverless 产物 | AWS Lambda、腾讯云函数等部署包（可选，v1.0 再强化） |
| 错误诊断 | 构建失败摘要、常见错误匹配、修复建议 |
| GitHub Releases | 产物归档到 GitHub Releases（可选） |
| 知识库扩展 | rpm 决策规则、多语言规则、多架构规则、错误诊断知识 |

### 验收标准

- 3 个真实项目完成打包（至少 1 个 Go/TypeScript）。
- 失败案例返回可读错误摘要，而不是只抛原始日志。
- 支持 linux/amd64 + linux/arm64 双架构（必做）。

---

## v0.3: 移动端 + Web→移动端（并行开发）

### 目标

验证移动端和 Web→移动端打包能力（不上架）。

### 必做范围（移动端）

| 模块 | 交付内容 |
|------|----------|
| `pack_android_apk` | Android 项目打包成 APK（Gradle 构建） |
| `pack_ios_ipa` | iOS 项目打包成 IPA（Xcode 构建） |
| 签名配置 | release keystore / certificate 配置流程 |
| 移动端模板 | AndroidManifest、Info.plist、签名配置模板 |
| 移动端知识库 | Android/iOS 决策规则、签名风险提示 |

### 必做范围（Web→移动端）

| 模块 | 交付内容 |
|------|----------|
| `pack_pwa` | Web 项目打包成 PWA（manifest + service worker） |
| `pack_hybrid_app` | Web 项目打包成混合应用（Cordova/Capacitor） |
| `pack_flutter_app` | Web/跨平台项目打包成 Flutter 应用（APK/IPA，Dart） |
| `pack_react_native_app` | Web/跨平台项目打包成 React Native 应用（APK/IPA，JS） |
| Web→移动端增量框架 | Ionic、NativeScript、UniApp、微信小程序转移动端（可选增量） |
| PWA 模板 | manifest.json、service worker 配置模板 |
| Hybrid 模板 | Cordova config.xml、Capacitor 配置模板、Flutter/React Native 工程模板 |
| Web→移动端知识库 | PWA/Hybrid/Flutter/React Native/增量框架 决策规则、兼容性提示 |

### 验收标准

- Android 项目打包成 APK，可直接安装使用（不上架）。
- iOS 项目打包成 IPA，可直接安装（需开发者账号，不上架）。
- Web 项目打包成 PWA，可离线使用。
- Web 项目通过 Cordova/Capacitor、Flutter、React Native 打包成 APK/IPA。
- 证书签名流程清晰可配置。

---

## v0.4: 移动端验收

### 目标

合并验收移动端和 Web→移动端能力，确保完整闭环。

### 必做范围

| 模块 | 交付内容 |
|------|----------|
| 移动端集成测试 | Android + iOS + Hybrid 集成测试 |
| 证书管理文档 | keystore/certificate 管理指南 |
| 真实项目验证 | 至少 2 个移动端项目完成打包 |
| 错误诊断增强 | 移动端常见错误（签名失败、构建失败）诊断 |
| 小程序 / 快应用 | 微信/支付宝小程序、快应用打包（Web 开发者高频场景） |
| 签名证书自动化 | keystore/certificate 自动生成、托管与续期（降低用户负担） |
| HarmonyOS（鸿蒙）评估 | 鸿蒙端支持调研（APK 兼容层可行性），作为后续方案（v0.4+） |

### 验收标准

- 移动端产物可直接分发（不上架）。
- 用户可按照文档配置证书和签名。
- 失败案例有清晰诊断和修复建议。

---

## v0.5: 桌面端（可选扩展）

### 目标

桌面应用打包能力（仅在确认真实需求后实现）。

### 是否实现的决策点

v0.4 结束后，通过用户调研确认：
- **是否真实需要桌面端打包？**
- **需求频率是否高于移动端？**

如果需求确认，才进入 v0.5；否则桌面端后置到 v1.5 或不做。

### 必做范围（如果需求确认）

| 模块 | 交付内容 |
|------|----------|
| `pack_windows_exe` | Windows exe 安装包（Electron 或原生） |
| `pack_macos_app` | macOS app 安装包（Electron 或原生） |
| 桌面端模板 | Electron 配置、安装程序模板 |
| 桌面端知识库 | Windows/macOS 桌面打包规则 |
| 浏览器扩展 / WASM 产物 | Chrome/Firefox 扩展、WASM 包（可选增量） |
| 注：Linux 桌面 GUI 应用（AppImage/Snap/Flatpak）归服务器端（系统级安装包），不在桌面端范围；确有需求后置 v1.5+ |

### 验收标准

- Electron 项目打包成桌面应用，可直接安装使用。
- 支持 Windows + macOS 双平台（Linux 归服务器端）。

---

## v1.0: 多端完整验收

### 目标

完整多端打包能力，公开试用。

### 必做范围

| 模块 | 交付内容 |
|------|----------|
| API 稳定 | MCP 工具 Schema 进入稳定兼容策略 |
| 文档完整 | 多端快速开始、架构、贡献、故障排查、发布说明 |
| 发布流程 | npm 包、GitHub Release、版本日志 |
| 社区案例 | 至少 5 个公开可复现案例（覆盖多端） |
| 统一多端编排 | 一次源码 → 多端产物（并行产出 APK/IPA/PWA/exe 等） |
| 增量 / 差量更新 | delta 更新、热更新能力（可选） |
| 云函数 / Serverless 强化 | 多平台云函数产物稳定化（承接 v0.2 可选项） |
| 贡献机制 | Issue 模板、PR 模板、贡献指南、路线图维护规则 |

### 验收标准

- 外部用户不依赖项目维护者口头解释，也能在文档指导下完成一次多端打包。
- 至少覆盖：服务器端 + 移动端 + Web→移动端（桌面端可选）。

---

## v1.5: 长尾端扩展（按需）

### 目标

覆盖低频次但真实存在的端 / 场景，作为 v1.0 之后的长尾迭代。

### 必做范围（按需，确有需求才做）

| 模块 | 交付内容 |
|------|----------|
| 电视 / 车载 / 嵌入式 | Android TV、tvOS、车机系统打包能力 |
| Linux 桌面 GUI 应用 | AppImage / Snap / Flatpak（从服务器端归并回桌面场景时） |
| 小众移动 OS | KaiOS、Wear OS 等（仅当试点验证需求） |
| 其他长尾 | 由社区案例与试点驱动，不预先铺开 |

### 验收标准

- 每个长尾端仅在确有真实项目试点时实现，不做理论铺开。
- 复用既有 decision-rules.yaml 与标准化流水线，不新增独立架构。

---

## 多端扩展决策规则

> 完整分层架构（含元认知层、Pre-flight Check、观测与回溯层、兼容性矩阵）见 [DESIGN §3](./DESIGN.md)。

每个端都有 `decision-rules.yaml`，这是 Forge.md 生成决策依据的核心：

```
src/systems/
  servers/
    ubuntu/decision-rules.yaml
    centos/decision-rules.yaml
  mobile/
    android/decision-rules.yaml
    ios/decision-rules.yaml
    harmonyos/decision-rules.yaml        # 鸿蒙（后续方案，v0.4+）
  web/
    pwa/decision-rules.yaml
    hybrid/decision-rules.yaml           # Cordova/Capacitor/Flutter/React Native
  desktop/（可选，仅 Windows + macOS）
    windows/decision-rules.yaml
    macos/decision-rules.yaml
```

**决策规则示例（移动端）**（完整结构与各端规则见 [`src/systems/README.md`](../src/systems/README.md)，服务器端已落地 `src/systems/servers/ubuntu/decision-rules.yaml`）：

```yaml
端类型: mobile
平台: android
产物格式: APK

决策规则:
  版本选择:
    规则1:
      条件: "目标设备 Android 版本已知"
      建议: "选择匹配的最低兼容版本"
    规则2:
      条件: "目标设备版本未知"
      建议: "选择 Android 11（API 30，覆盖90%设备）"

  签名配置:
    规则1:
      条件: "调试版本"
      建议: "使用 debug keystore（自动生成）"
    规则2:
      条件: "分发版本"
      建议: "使用 release keystore（用户自管理）"
      风险: "需要用户配置证书路径和密码"
      next_actions: ["配置 keystore 路径", "设置签名密码"]

风险提示:
  - "证书丢失后无法更新应用"
  - "不同签名会导致无法覆盖安装"
  - "不上架 Google Play，需要用户自行分发"
```

---

## 路线图维护规则

- 新功能必须挂到某个阶段，不能只写"未来支持"。
- v0.1 之前只允许增加能帮助服务器端闭环验收的任务。
- README 只保留路线摘要，详细计划以本文为准。
- 需求文档描述"为什么做"和"做什么"，设计文档描述"怎么做"，路线图描述"什么时候做"。
- 多端扩展遵循"服务器端 → 移动端 → 桌面端"的复杂度递增原则。
- 每个阶段结束都必须有真实项目验收，不能只靠理论设计。
- 阶段 C（商业化/企业落地）启动前必须通过成熟度门禁（80 分绿灯）；未达标不提前讲商业化故事、不铺云构建。

---

## 关键决策点总结

| 决策点 | 时间 | 影响 |
|--------|------|------|
| v0.1 Docker-first（deb 可选） | 已拍板 | 决定 v0.1 范围 |
| v0.2 是否需要 rpm | v0.2 开发前 | 决定服务器端扩展深度 |
| v0.3 是否并行开发移动端和Web→移动端 | v0.3 开发前 | 决定移动端和Web→移动端是否同时验证 |
| v0.4 移动端验收是否通过 | v0.4 结束时 | 决定是否进入 v0.5 |
| v0.5 是否需要桌面端 | v0.4 结束时 | 决定桌面端是否实现 |
| v1.0 是否公开试用 | v1.0 开发前 | 决定是否进入稳定发布 |

---

## 蓝海扩展方向（双轮驱动）

除主路线图外，存在三片蓝海（教育沙箱 / 边缘构建集群 / 开源发布矩阵），均由 v0.1 契约层支撑，是教育传播 + 商业变现的延展。详见 [`docs/BLUE_OCEAN.md`](./BLUE_OCEAN.md)；v0.1 执行路径见 [`docs/V0.1_IMPLEMENTATION.md`](./archive/v0.1-mvp/V0.1_IMPLEMENTATION.md)。

---

*本路线图由 ForgeKit 维护，基于多端需求和复杂度评估持续更新。*
