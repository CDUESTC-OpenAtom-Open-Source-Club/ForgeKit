# ForgeKit Packaging Plan

> 本文件是 ForgeKit 的项目级打包计划模板。
> 作用：记录目标端、决策依据、构建结果，实现 Plan-before-build。

---

## 使用说明

**给 AI Agent**：
1. 先调用 `inspect_project` 分析项目
2. 调用 `generate_packaging_plan` 生成本文件
3. 让用户确认目标和决策
4. 调用 `build_*` / `pack_*` 工具执行构建
5. 构建完成后更新 Results 段

**给用户**：
- 本文件记录"为什么这么打包"、"打包结果是什么"
- 请审查目标端、版本选择、风险提示
- 如需调整，直接修改本文件后重新执行构建

---

## 模板结构

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
- Distribution method: local / self-hosted / store-upload

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

## Commands
- Inspect:
- Build:
- Verify:

## Results
- Artifacts:
- Checksums:
- Logs:
- Build time:
- decision_basis:

## Next Actions
- ...
```

---

## v0.1 最小字段

v0.1 不需要一次写满，但必须包含：

| 字段 | 必须性 | 说明 |
|------|--------|------|
| Project | 必须 | 项目名、类型、语言、入口 |
| Goals | 必须 | 目标产物、目标平台、分发方式 |
| Build Strategy | 必须 | 构建方式、版本选择 |
| Decisions | 必须 | 为什么这么选（决策依据） |
| Risks | 必须 | 已知风险和待确认项 |
| Results | 构建后必须 | 产物路径、校验和、日志 |

---

## 示例（服务器端 Python 项目）

```markdown
# ForgeKit Packaging Plan

## Project
- Name: demo-api
- Type: servers
- Language: Python
- Framework: Flask
- Entry: app.py

## Goals
- Primary artifact: Docker image
- Secondary artifact: Ubuntu deb（可选）
- Target platform: linux/amd64
- Target users: 社团成员部署到服务器
- Distribution method: local

## Build Strategy
- Target端类型: servers
- Target platform: Ubuntu 22.04 x86_64
- Target version: Ubuntu 22.04 LTS（jammy）
- Build method: Docker build + dpkg-deb
- Signing config: N/A

## Decisions
- Why target端: 项目是服务器端 Flask 应用
- Why platform: 目标服务器运行 Ubuntu 22.04
- Why version: Ubuntu 22.04 LTS（稳定、glibc 2.35、Python 3.10）
- Why build method: Docker 提供容器隔离，deb 提供系统级安装
- Why signing: 服务器端安装包不需要签名

## Risks
- Compatibility risks: Python 依赖版本需锁定（requirements.txt）
- Signing risks: N/A
- Distribution risks: deb 包仅支持 Ubuntu，其他发行版需用 Docker
- Dependency risks: 未知原生依赖，构建时可能失败

## Commands
- Inspect: forgekit inspect .
- Build Docker: forgekit build-docker .
- Build deb: forgekit pack-deb .（可选）
- Verify: docker run demo-api:latest

## Results
- Docker image: pending
- Deb artifact: pending
- Checksums: pending
- Logs: pending
- Build time: pending
- decision_basis: pending

## Next Actions
- 确认是否需要 deb 包（Docker 已足够？）
- 确认目标服务器 Ubuntu 版本（20.04/22.04？）
```

---

## 示例（移动端 Android 项目）

```markdown
# ForgeKit Packaging Plan

## Project
- Name: demo-app
- Type: mobile
- Language: Java
- Framework: Android SDK
- Entry: app/src/main/AndroidManifest.xml

## Goals
- Primary artifact: Android APK
- Secondary artifact: N/A
- Target platform: Android 11+（API 30）
- Target users: 移动端用户直接安装
- Distribution method: local（不上架 Google Play）

## Build Strategy
- Target端类型: mobile
- Target platform: Android
- Target version: Android 11（API 30，覆盖90%设备）
- Build method: Gradle assembleRelease
- Signing config: release keystore（用户自管理）

## Decisions
- Why target端: 项目是原生 Android 应用
- Why platform: 目标用户使用 Android 设备
- Why version: Android 11 兼容 90% 设备，向上兼容到 Android 14
- Why build method: Gradle 是 Android 标准构建工具
- Why signing: release keystore 确保分发版本签名一致

## Risks
- Compatibility risks: Android 14 设备可能有权限变更
- Signing risks: keystore 丢失后无法更新应用
- Distribution risks:不上架 Google Play，需用户自行分发
- Dependency risks: 第三方库可能有 API 版本要求

## Commands
- Inspect: forgekit inspect .
- Build APK: forgekit pack-android .
- Verify: adb install app-release.apk

## Results
- APK path: pending
- Checksums: pending
- Logs: pending
- Build time: pending
- decision_basis: pending

## Next Actions
- 配置 keystore 路径和密码（如未配置）
- 确认目标 Android 版本（是否需要更低版本兼容）
- 测试安装：adb install app-release.apk
```

---

## 示例（Web→移动端 PWA 项目）

```markdown
# ForgeKit Packaging Plan

## Project
- Name: demo-web
- Type: web
- Language: JavaScript
- Framework: Vue.js
- Entry: index.html

## Goals
- Primary artifact: PWA（渐进式Web应用）
- Secondary artifact: N/A
- Target platform: Web浏览器（支持 PWA）
- Target users: 移动端和桌面端浏览器用户
- Distribution method: self-hosted

## Build Strategy
- Target端类型: web
- Target platform: PWA
- Target version: 现代 Web 浏览器（Chrome 80+ / Safari 13+）
- Build method: manifest.json + service worker 配置
- Signing config: N/A

## Decisions
- Why target端: 项目是 Web 应用，需要移动端和桌面端浏览器支持
- Why platform: PWA 提供离线使用和移动端体验
- Why version: Chrome 80+ / Safari 13+ 支持 PWA 核心特性
- Why build method: manifest.json 和 service worker 是 PWA 标准
- Why signing: Web 应用不需要签名

## Risks
- Compatibility risks: Safari PWA 功能有限（相比 Chrome）
- Signing risks: N/A
- Distribution risks: 需要自托管 HTTPS 服务器
- Dependency risks: Service worker 缓存策略需谨慎设计

## Commands
- Inspect: forgekit inspect .
- Build PWA: forgekit pack-pwa .
- Verify: npm run serve → 测试 PWA 功能

## Results
- PWA artifacts: pending
- Checksums: pending
- Logs: pending
- Build time: pending
- decision_basis: pending

## Next Actions
- 确认是否需要混合应用打包（Cordova/Capacitor）
- 配置 HTTPS 服务器（PWA 必需）
- 测试离线功能
```

---

## 多端适配决策路径

ForgeKit 根据项目类型自动选择路径：

```
项目类型识别（inspect_project）
      ↓
┌─────────────────────────────────────┐
│ servers → 服务器端路径               │
│   Docker → build_docker_image        │
│   deb → pack_deb                     │
│   rpm → pack_rpm                     │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ mobile → 移动端路径                  │
│   Android → pack_android_apk         │
│   iOS → pack_ios_ipa                 │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ web → Web端路径                      │
│   PWA → pack_pwa                     │
│   Hybrid → pack_hybrid_app           │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ desktop → 桌面端路径（可选）         │
│   Windows → pack_windows_exe         │
│   macOS → pack_macos_app             │
│   Linux → pack_linux_app             │
└─────────────────────────────────────┘
```

---

## Plan-before-build 强制约束

**v0.1 关键设计**：

所有构建类工具（`build_*` / `pack_*`）必须：
1. 接收 `plan_path` 参数（已生成的 Forge.md 路径）
2. 缺失时返回 `plan_not_found` 错误
3. 强制 Plan-before-build，避免 Agent 绕过计划直接构建

```json
// MCP 工具调用示例
{
  "tool": "build_docker_image",
  "params": {
    "source_dir": "/path/to/project",
    "plan_path": "/path/to/project/Forge.md",  // 必需
    "image_name": "demo-api",
    "platform": "linux/amd64"
  }
}
```

缺失 `plan_path` 时返回：

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

---

## 与 MCP 工具的关系

| MCP 工具 | 与 Forge.md 关系 |
|----------|-----------------|
| `inspect_project` | 分析项目，为 Forge.md 提供输入 |
| `generate_packaging_plan` | 生成 Forge.md 文件 |
| `build_docker_image` | **必须读取 Forge.md 配置** |
| `pack_deb` | **必须读取 Forge.md 配置** |
| `pack_android_apk` | **必须读取 Forge.md 配置** |
| `pack_ios_ipa` | **必须读取 Forge.md 配置** |
| `pack_pwa` | **必须读取 Forge.md 配置** |
| `pack_hybrid_app` | **必须读取 Forge.md 配置** |

---

## 后续结构化版本

如果 Forge.md 在真实项目中稳定使用，后续可增加机器可读版本：

```text
Forge.yaml（可选）
```

但 v0.1 先用 Markdown，因为它更适合人类审查，也更适合 Agent 读取和解释。