# ForgeKit Agent Integration

> 本文回答：ForgeKit 如何被 Codex、Claude Code、Cline、Cursor 等 Agent 使用，以及为什么 v0.1 选择 MCP 作为主协议。

## 1. 接入结论

ForgeKit v0.1-v1.0 采用：

1. MCP Server 作为主接入协议。
2. Agent Skill / Markdown 指南作为辅助接入方式。
3. `Forge.md` 作为项目内的打包计划文件。
4. 暂不自研新协议。

原因很直接：MCP 已经是多 Agent 工具调用的通用协议，适合表达工具、参数、结果和错误；Skill/Markdown 文档适合告诉 Agent 如何思考和组织任务；项目内 `Forge.md` 则负责记录具体项目的打包策略。

---

## 2. 目标 Agent

| Agent / 客户端 | v0.1 支持方式 | 说明 |
|----------------|---------------|------|
| Claude Code | MCP Server | 主验证对象之一 |
| Cline | MCP Server | 常见 MCP 客户端 |
| Cursor Agent | MCP Server / Markdown 指南 | 若 MCP 接入受限，可先用文档模式 |
| Codex | Markdown 指南 + 最小 CLI 兜底 | v0.1 暂无 MCP，用 `forgekit plan .` 生成 `Forge.md`、`forgekit build .` 执行构建 |
| 其他 Agent | MCP Server | 只要支持 MCP，即可调用 ForgeKit |

---

## 3. 为什么先 MCP

| 方案 | 优点 | 问题 | 结论 |
|------|------|------|------|
| MCP Server | 标准工具发现、参数 Schema、结构化输出、客户端生态已有 | 需要实现服务和 Schema | v0.1 主方案 |
| Skill / Markdown 文档 | 简单、可读、适合教学和提示 Agent | 不能强约束参数和执行结果 | 辅助方案 |
| CLI only | 对人友好，易调试 | Agent 需要自己推断命令和参数 | 作为能力层，不作为主协议 |
| 自研协议 | 可完全定制 | 生态成本高，用户要重新适配 | v1.0 前不做 |

v0.1 的判断是：先接已有协议，避免把项目难度浪费在协议发明上。

---

## 4. 三层接入模型（多端扩展）

```
Agent
  |
  | 1. 读 Skill / Markdown 指南，理解任务策略
  v
Forge.md
  |
  | 2. 读取项目打包计划（目标端、决策依据）
  v
ForgeKit MCP Server
  |
  | 3. 调用多端打包工具（servers/mobile/web/desktop）
  v
Local Tooling（Docker、Gradle、Xcode、Electron）
```

### 4.1 Skill / Markdown 指南

用途：

- 告诉 Agent 如何判断项目类型（servers/mobile/web/desktop）。
- 告诉 Agent 先生成或读取 `Forge.md`。
- 告诉 Agent 优先调用 MCP 工具，而不是自己拼命令。
- 告诉 Agent 失败时如何总结错误和下一步。

它不是运行时协议，只是 Agent 行为说明。

**多端判断逻辑**（给 Agent）：

```markdown
## 项目类型判断

根据项目文件判断目标端：

- **servers**（服务器端）：
  - 项目有 Dockerfile 或是后端应用（Flask、Express、Go HTTP）
  - 目标用户部署到服务器

- **mobile**（移动端）：
  - 项目有 AndroidManifest.xml 或 Info.plist
  - 或是移动端框架项目（React Native、Flutter）
  - 目标用户使用手机安装

- **web**（Web端）：
  - 项目是前端项目（React、Vue、Angular）
  - 目标用户使用浏览器访问
  - 或需要离线使用（PWA）

- **desktop**（桌面端）：
  - 项目是 Electron 应用或桌面应用
  - 目标用户在 Windows/macOS/Linux 桌面安装
```

### 4.2 `Forge.md`

用途：

- 记录项目的打包目标（目标端、目标平台）。
- 记录目标端类型、产物类型、构建策略。
- 记录 Agent 和 ForgeKit 的决策依据。
- 作为人类、Agent、CI 都能读懂的项目打包说明。

它是 ForgeKit 的独特性之一：不是只执行命令，而是先把打包策略写成可审查文档。

**多端 Forge.md 字段**：

```markdown
# ForgeKit Packaging Plan

## Project
- Name:
- Type: servers / mobile / web / desktop
- Language:
- Framework:
- Entry:

## Goals
- Primary artifact:
- Secondary artifact:
- Target platform:
- Target users:
- Distribution method: local / self-hosted / store-upload（明确不上架）

## Build Strategy
- Target端类型:
- Target platform:
- Target version:
- Build method:
- Signing config:

## Decisions
- Why target端:
- Why platform:
- Why version:
- Why build method:
- Why signing:

## Risks
- Compatibility risks:
- Signing risks:
- Distribution risks:
- Dependency risks:

## Results
- Artifacts:
- Checksums:
- Logs:
- Build time:
- decision_basis:

## Next Actions
- ...
```

### 4.3 MCP Server（多端工具）

用途：

- 向 Agent 暴露多端打包工具。
- 校验输入。
- 执行本地构建（各端工具）。
- 返回结构化结果。

v0.1-v1.0 多端工具列表：

| 工具 | 目的 | 端类型 | v0.1 状态 | v0.3 状态 |
|------|------|--------|-----------|-----------|
| `inspect_project` | 识别项目语言、入口、已有配置 | 所有端 | ✅ 实现 | ✅ 稳定 |
| `generate_packaging_plan` | 生成或更新 `Forge.md` | 所有端 | ✅ 实现 | ✅ 稳定 |
| `build_docker_image` | 构建 Docker 镜像 | servers | ✅ 实现（硬闭环） | ✅ 稳定 |
| `pack_deb` | 构建 Ubuntu deb 包 | servers | ✅ 可选 | ✅ 稳定 |
| `pack_rpm` | 构建 CentOS rpm 包 | servers | ❌ v0.2 | ✅ 实现 |
| `pack_android_apk` | 构建 Android APK | mobile | ❌ v0.3 | ✅ 实现 |
| `pack_ios_ipa` | 构建 iOS IPA | mobile | ❌ v0.3 | ✅ 实现 |
| `pack_pwa` | 构建 PWA | web | ❌ v0.3 | ✅ 实现 |
| `pack_hybrid_app` | 构建混合应用（Cordova/Capacitor） | web | ❌ v0.3 | ✅ 实现 |
| `pack_windows_exe` | 构建 Windows exe | desktop | ❌ v0.5 | ✅ 可选 |
| `pack_macos_app` | 构建 macOS app | desktop | ❌ v0.5 | ✅ 可选 |

---

## 5. Agent 使用流程（多端）

### 服务器端打包流程

用户说：

```text
帮我把这个 Python 项目打包成可以在服务器上运行的版本。
```

Agent 应该：

1. 调用 `inspect_project` 或读取项目文件。
2. 识别为 **servers** 端类型。
3. 生成 `Forge.md`：
   - Target端：servers
   - Target platform：Ubuntu 22.04 LTS
   - Primary artifact：Docker 镜像
   - Secondary artifact：deb 包（可选）
   - Distribution method：local
4. 向用户确认目标：Docker-only（硬闭环），还是 Docker + deb（可选）。
5. 调用 MCP 工具执行构建（`build_docker_image` 或 `pack_deb`），构建必须携带 `Forge.md` 路径。
6. 更新 `Forge.md` 中的结果和失败信息。
7. 返回产物路径、运行方式、风险和下一步。

### 移动端打包流程

用户说：

```text
帮我把这个 Android 项目打包成可以直接安装的 APK。
```

Agent 应该：

1. 调用 `inspect_project` 或读取项目文件。
2. 识别为 **mobile** 端类型。
3. 读取 `src/systems/mobile/android/decision-rules.yaml`。
4. 生成 `Forge.md`：
   - Target端：mobile
   - Target platform：Android
   - Target version：Android 11（API 30）
   - Primary artifact：APK
   - Signing config：release keystore（用户自管理）
   - Distribution method：local（不上架 Google Play）
   - Risks：证书丢失无法更新、不同签名无法覆盖安装
5. 向用户确认：
   - 是否需要配置 release keystore（签名配置）
   - 目标 Android 版本是否合理
6. 用户配置 keystore 路径和密码（如需要）。
7. 调用 `pack_android_apk` 执行构建，必须携带 `Forge.md` 路径。
8. 更新 `Forge.md` Results：
   - APK path：dist/mobile/android/app-release.apk
   - Checksum：SHA256
   - decision_basis：为什么选择 Android 11、为什么使用 release keystore
9. 返回产物路径、安装方法、风险提示。

### Web→移动端打包流程

用户说：

```text
帮我把这个 Web 项目打包成可以在手机上离线使用的版本。
```

Agent 应该：

1. 调用 `inspect_project` 或读取项目文件。
2. 识别为 **web** 端类型。
3. 读取 `src/systems/web/pwa/decision-rules.yaml`。
4. 生成 `Forge.md`：
   - Target端：web
   - Target platform：PWA
   - Target version：现代浏览器（Chrome 80+ / Safari 13+）
   - Primary artifact：PWA包（manifest + service worker）
   - Distribution method：self-hosted（HTTPS必需）
   - Risks：iOS Safari 不支持推送通知、需 HTTPS 托管
5. 向用户确认：
   - 是否需要推送通知（如需要，跳转 web/hybrid）
   - HTTPS 服务器托管位置
6. 调用 `pack_pwa` 执行构建，必须携带 `Forge.md` 路径。
7. 更新 `Forge.md` Results：
   - PWA artifacts：manifest.json、service-worker.js、静态资源
   - decision_basis：为什么选择 PWA、为什么选择缓存策略
8. 返回产物路径、部署方法、风险提示。

---

## 6. 多端工具输入输出规范

### 6.1 通用输入规范（所有端）

所有构建类工具必须接收：

| 字段 | 类型 | 说明 |
|------|------|------|
| `source_dir` | string | 项目根目录 |
| `plan_path` | string | **Forge.md 路径（必需，强制 Plan-before-build）** |
| `target_platform` | string | 目标平台（如 ubuntu-22.04、android-11） |

**缺失 `plan_path` 时返回错误**：

```json
{
  "status": "failed",
  "error": {
    "code": "plan_not_found",
    "summary": "Forge.md 打包计划文件不存在",
    "suggested_fix": "请先调用 generate_packaging_plan 生成 Forge.md，再执行构建"
  }
}
```

### 6.2 通用输出规范（所有端）

所有工具返回：

| 字段 | 说明 |
|------|------|
| `status` | `success` / `failed` |
| `artifacts` | 产物路径或镜像引用 |
| `logs` | 构建日志路径和摘要 |
| `warnings` | 非阻塞风险 |
| `decision_basis` | 决策依据（从 decision-rules.yaml 应用） |
| `next_actions` | 失败或后续发布建议 |

### 6.3 错误结构（通用）

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

---

## 7. 多端决策依据来源

每个端的决策依据来自 `src/systems/<端类型>/<平台>/decision-rules.yaml`：

| 工具 | 读取的 decision-rules.yaml |
|------|----------------------------|
| `build_docker_image` | servers/ubuntu/decision-rules.yaml |
| `pack_deb` | servers/ubuntu/decision-rules.yaml |
| `pack_rpm` | servers/centos/decision-rules.yaml |
| `pack_android_apk` | mobile/android/decision-rules.yaml |
| `pack_ios_ipa` | mobile/ios/decision-rules.yaml |
| `pack_pwa` | web/pwa/decision-rules.yaml |
| `pack_hybrid_app` | web/hybrid/cordova/decision-rules.yaml 或 web/hybrid/capacitor/decision-rules.yaml |
| `pack_windows_exe` | desktop/windows/decision-rules.yaml |
| `pack_macos_app` | desktop/macos/decision-rules.yaml |

**决策规则应用流程**：

```
generate_packaging_plan 调用
      ↓
inspect_project 分析项目类型
      ↓
识别为 mobile/android
      ↓
读取 mobile/android/decision-rules.yaml
      ↓
应用"版本选择规则2"（目标设备版本未知 → 选择 Android 11）
      ↓
生成 Forge.md：
  Target version: Android 11（API 30）
  Decision basis: "覆盖90%设备、向上兼容"
      ↓
用户确认
      ↓
pack_android_apk 执行（传递 plan_path）
```

---

## 8. 多端 Agent Skill 示例（给 Agent）

```markdown
# ForgeKit 多端打包指南（给 AI Agent）

你是 ForgeKit 的使用者。ForgeKit 帮你把项目从源码打成可分发的多端安装包（不上架）。

## 你的工作流（多端）

1. 读项目（或调用 inspect_project）。
2. **判断项目类型**：
   - 有 Dockerfile、Flask/Express → **servers**
   - 有 AndroidManifest.xml、Info.plist → **mobile**
   - 前端项目（React/Vue）→ **web**
   - Electron、桌面应用 → **desktop**
3. 先生成/更新根目录的 Forge.md（打包计划），交用户确认，**不要直接开构建**。
4. **配置特殊需求**：
   - mobile：询问用户是否有 keystore/certificate，配置签名
   - web：询问用户 HTTPS 托管位置
   - desktop：询问用户是否需要签名
5. 调用对应端的 `pack_*` 工具执行。
6. 把产物路径、日志、校验和写回 Forge.md 的 Results 段。

## 接入方式（多端）

- 支持 MCP 的客户端（Claude Code / Cline / Cursor）：
  连接 ForgeKit MCP Server，直接列出并调用多端工具。

- Codex / 无 MCP 环境：用 CLI 兜底
  - forgekit plan .    # 生成 Forge.md
  - forgekit build .   # 执行构建（根据 Forge.md 中的目标端自动选择工具）

## 原则（多端）

- 不盲目拼命令，先有计划（Plan-before-build）。
- 每个构建都返回 decision_basis，向用户解释选择依据。
- 失败返回结构化错误（code / summary / suggested_fix），不要只抛原始日志。
- **明确不上架**：mobile/desktop 端只做本地打包和分发，不涉及上架流程。

## 多端风险提示

- **mobile**：
  - 证书丢失后无法更新应用
  - 不同签名会导致无法覆盖安装
  - 不上架 Google Play/App Store，需要用户自行分发

- **web**：
  - PWA 必须使用 HTTPS
  - iOS Safari 不支持推送通知
  - Service worker 缓存策略需谨慎设计

- **desktop**：
  - 未签名的 exe 可能被 Windows SmartScreen 拦截
  - macOS app 需要 Developer ID 签名（可选）

## 多端分发方式

- **servers**：Docker 镜像（本地运行）、deb/rpm（系统安装）
- **mobile**：APK/IPA 直接分发（下载链接、邮件、云存储）
- **web**：HTTPS 服务器托管（GitHub Pages、Vercel、Netlify）
- **desktop**：exe/app 直接分发（下载链接、GitHub Releases）
```

---

## 9. 后续协议演进

短期不自研协议。只有在满足以下条件后，才考虑 ForgeKit 自有协议：

1. MCP 无法表达 ForgeKit 的关键能力。
2. 至少 3 个 Agent 客户端需要同一套更高层打包语义。
3. `Forge.md` 已经在真实项目中稳定使用。

如果未来需要自有协议，优先把它设计为 `Forge.md` 的结构化版本，而不是替代 MCP。

---

## 10. 多端 CLI 兜底（Codex）

对于不支持 MCP 的 Agent（如 Codex），ForgeKit 提供最小 CLI：

```bash
forgekit plan .     # 生成 Forge.md（自动识别项目类型）
forgekit build .    # 执行构建（根据 Forge.md 目标端自动选择工具）
```

**CLI 实现逻辑**：

```typescript
// forgekit build 的多端路由
function build(sourceDir: string) {
  // 1. 读取 Forge.md
  const forgeMd = readForgeMd(sourceDir);

  // 2. 根据 Target端类型路由
  switch (forgeMd.target端类型) {
    case 'servers':
      if (forgeMd.primaryArtifact === 'Docker镜像') {
        return buildDockerImage(sourceDir, forgeMd);
      } else if (forgeMd.primaryArtifact === 'deb包') {
        return packDeb(sourceDir, forgeMd);
      }
      break;

    case 'mobile':
      if (forgeMd.targetPlatform === 'Android') {
        return packAndroidApk(sourceDir, forgeMd);
      } else if (forgeMd.targetPlatform === 'iOS') {
        return packIosIpa(sourceDir, forgeMd);
      }
      break;

    case 'web':
      if (forgeMd.primaryArtifact === 'PWA') {
        return packPwa(sourceDir, forgeMd);
      } else if (forgeMd.primaryArtifact === '混合应用') {
        return packHybridApp(sourceDir, forgeMd);
      }
      break;

    case 'desktop':
      if (forgeMd.targetPlatform === 'Windows') {
        return packWindowsExe(sourceDir, forgeMd);
      } else if (forgeMd.targetPlatform === 'macOS') {
        return packMacosApp(sourceDir, forgeMd);
      }
      break;
  }
}
```

CLI 只是 MCP 能力层的另一种入口，不替代 MCP Server。

---

*本文档由 ForgeKit 维护，基于多端需求和 Agent 接入经验持续更新。*