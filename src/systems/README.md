# ForgeKit 多端适配框架总览

> 本文档是 ForgeKit 多端打包能力的架构总览
> 核心定位：源码 → 可直接分发的多端安装包（不上架）

---

## 多端架构设计

ForgeKit 支持四种目标端：

| 端类型 | 覆盖范围 | 产物格式 | 典型用户场景 |
|--------|----------|----------|-------------|
| **servers** | Ubuntu、Debian、CentOS、EulerOS、Fedora | Docker镜像、deb、rpm | 服务器端部署、系统级安装 |
| **mobile** | Android、iOS | APK、IPA | 移动端应用（不上架，直接分发） |
| **web** | PWA、Hybrid应用 | PWA包、混合应用APK/IPA | Web项目转移动端（离线可用） |
| **desktop** | Windows、macOS、Linux桌面 | exe、app、AppImage | 桌面应用打包（可选） |

---

## 目录结构

```
src/systems/
  servers/                        # ✅ 服务器端（已实现）
    ubuntu/
      versions.yaml               # Ubuntu 20.04/22.04/24.04 LTS
      packaging-guide.md          # Ubuntu deb 打包完整指南
      templates/                  # Dockerfile、control、rules等
      decision-rules.yaml         # 服务器端决策规则
    debian/
    centos/
    euleros/
    fedora/

  mobile/                         # 🟡 移动端（规划中，v0.3实现）
    android/
      versions.yaml               # Android 11/12/13/14（API 30-34）
      packaging-guide.md          # Android APK 打包指南
      templates/                  # AndroidManifest、Gradle配置、签名模板
      decision-rules.yaml         # Android 决策规则（版本选择、签名配置）
      issues/                     # 已知问题（证书管理、签名风险）
        keystore-management.md
        signing-risks.md
    ios/
      versions.yaml               # iOS 14/15/16/17
      packaging-guide.md          # iOS IPA 打包指南
      templates/                  # Info.plist、Xcode配置、签名模板
      decision-rules.yaml         # iOS 决策规则（版本选择、开发者账号）
      issues/                     # 已知问题（开发者账号、证书管理）
        developer-account.md
        certificate-management.md

  web/                            # 🟡 Web端（规划中，v0.3实现）
    pwa/
      packaging-guide.md          # PWA 打包指南
      templates/                  # manifest.json、service-worker配置
      decision-rules.yaml         # PWA 决策规则（浏览器兼容性、离线功能）
    hybrid/                       # 混合应用（Web转移动端）
      cordova/
        packaging-guide.md        # Cordova 打包指南
        templates/                # config.xml、项目结构模板
        decision-rules.yaml       # Cordova 决策规则（插件选择、平台适配）
      capacitor/
        packaging-guide.md        # Capacitor 打包指南
        templates/                # capacitor.config.json、项目结构模板
        decision-rules.yaml       # Capacitor 决策规则（现代框架适配）

  desktop/                        # 📅 桌面端（可选扩展，v0.5实现）
    windows/
      versions.yaml               # Windows 10/11
      packaging-guide.md          # Windows exe 打包指南
      templates/                  # NSIS/Inno Setup 安装程序模板
      decision-rules.yaml         # Windows 决策规则（安装程序选择）
    macos/
      versions.yaml               # macOS 12/13/14
      packaging-guide.md          # macOS app 打包指南
      templates/                  # .app bundle 模板、签名配置
      decision-rules.yaml         # macOS 决策规则（签名、公证）
    linux-app/
      versions.yaml               # AppImage/Snap/Flatpak
      packaging-guide.md          # Linux 桌面应用打包指南
      templates/                  # AppImage、Snap、Flatpak配置模板
      decision-rules.yaml         # Linux 桌面决策规则（打包格式选择）
```

**实现状态**：
- ✅ **servers**：已完整实现（Ubuntu框架已建立）
- 🟡 **mobile/web**：规划中，v0.3开始实现
- 📅 **desktop**：可选扩展，v0.5确认需求后实现

---

## 多端决策路径（核心）

每个端都有 `decision-rules.yaml`，这是 Forge.md 生成决策依据的核心：

### 决策流程

```
用户源码项目
      ↓
inspect_project 分析
      ↓
项目类型识别（servers/mobile/web/desktop）
      ↓
读取对应端的 decision-rules.yaml
      ↓
应用决策规则（版本选择、打包方式、签名配置）
      ↓
生成 Forge.md（记录决策依据）
      ↓
用户确认
      ↓
执行打包（pack_* 工具）
      ↓
更新 Forge.md Results
      ↓
可分发的安装包
```

### decision-rules.yaml 结构示例

```yaml
端类型: servers/mobile/web/desktop
平台: android/ubuntu/pwa/windows 等
产物格式: APK/deb/PWA/exe

决策规则:
  版本选择:
    规则1:
      条件: "具体场景描述"
      建议: "推荐选择"
      风险: "可能风险"
      next_actions: ["后续建议操作"]

  打包方式:
    规则1:
      条件: "场景描述"
      建议: "推荐方式"

风险提示:
  - "该端特有的风险"
  - "用户需注意的事项"

构建流程:
  1. "步骤1"
  2. "步骤2"
  3. "步骤3"
```

---

## 多端关键差异对比

| 维度 | servers | mobile | web | desktop |
|------|---------|--------|------|---------|
| **构建工具** | Docker、dpkg、rpm | Gradle、Xcode | Web打包工具、Cordova/Capacitor | Electron、NSIS、app打包工具 |
| **签名需求** | 不需要 | ✅ 必需（APK/IPA） | 不需要 | macOS需要签名，Windows可选 |
| **上架流程** | 不涉及 | **明确不做**（只做本地打包） | 不涉及 | 不涉及 |
| **证书管理** | 不涉及 | ✅ 用户自管理（keystore/certificate） | 不涉及 | macOS需要开发者证书 |
| **分发方式** | Docker镜像、系统包 | 直接分发APK/IPA（不上架） | HTTPS托管、PWA | 直接分发安装包 |
| **复杂度** | ✅ 低 | 🟡 中 | 🟡 中 | 🟡 中 |

---

## 快速使用示例（多端）

### 服务器端打包

```bash
# 用户对 Agent 说：
"把这个 Python 项目打包成可以在 Ubuntu 服务器上运行的版本"

# ForgeKit 执行：
1. 识别为 servers 端
2. 读取 src/systems/servers/ubuntu/decision-rules.yaml
3. 生成 Forge.md：
   - 目标端：servers
   - 平台：Ubuntu 22.04 LTS
   - 产物：Docker镜像 + deb包（可选）
   - 决策依据：glibc 2.35、Python 3.10、稳定 LTS
4. 用户确认后执行打包
5. 输出：demo-api:latest（Docker）、demo-api_1.0.0.deb
```

### 移动端打包（Android）

```bash
# 用户对 Agent 说：
"把这个 Android 项目打包成可以直接安装的 APK"

# ForgeKit 执行：
1. 识别为 mobile 端
2. 读取 src/systems/mobile/android/decision-rules.yaml
3. 生成 Forge.md：
   - 目标端：mobile
   - 平台：Android
   - 版本：Android 11（API 30，覆盖90%设备）
   - 产物：APK
   - 签名：release keystore（用户自管理）
   - 决策依据：兼容性、覆盖率、签名要求
   - 风险提示：证书丢失无法更新、不上架需自行分发
4. 用户配置 keystore 路径和密码
5. 执行打包
6. 输出：app-release.apk（可直接安装）
```

### Web→移动端打包（PWA）

```bash
# 用户对 Agent 说：
"把这个 Web 项目打包成可以在手机上离线使用的版本"

# ForgeKit 执行：
1. 识别为 web 端
2. 读取 src/systems/web/pwa/decision-rules.yaml
3. 生成 Forge.md：
   - 目标端：web
   - 平台：PWA
   - 版本：现代浏览器（Chrome 80+ / Safari 13+）
   - 产物：PWA包（manifest + service worker）
   - 决策依据：离线使用、移动端体验、无需原生代码
   - 风险提示：Safari PWA功能有限、需HTTPS托管
4. 用户确认后执行打包
5. 输出：PWA包（可部署到HTTPS服务器）
```

---

## 后续扩展计划

| 优先级 | 任务 | 阶段 |
|--------|------|------|
| P0 | 完善 Ubuntu 服务器端框架 | v0.1（已完成） |
| P1 | 创建 mobile/android 决策规则和模板 | v0.3 规划 |
| P1 | 创建 mobile/ios 决策规则和模板 | v0.3 规划 |
| P1 | 创建 web/pwa 决策规则和模板 | v0.3 规划 |
| P1 | 创建 web/hybrid 决策规则和模板 | v0.3 规划 |
| P2 | 创建 desktop 决策规则和模板（可选） | v0.5 规划 |
| P2 | 补充各端已知问题文档 | v0.3-v0.5 |

---

## 知识层对应结构

```
src/knowledge/
  servers/
    docker-best-practices.yaml    # Docker 最佳实践（已有）
    deb-packaging.yaml            # deb 打包知识（已有）
    rpm-packaging.yaml            # rpm 打包知识（v0.2新增）

  mobile/                         # v0.3新增
    android-packaging.yaml        # Android 打包知识
    ios-packaging.yaml            # iOS 打包知识
    signing-rules.yaml            # 签名配置规则

  web/                            # v0.3新增
    pwa-best-practices.yaml       # PWA 最佳实践
    hybrid-app.yaml               # 混合应用打包知识

  desktop/                        # v0.5新增（可选）
    electron-packaging.yaml       # Electron 打包知识
    native-packaging.yaml         # 原生桌面打包知识
```

---

## 与 MCP 工具的映射关系

| MCP 工具 | 对应端 | 读取的 decision-rules.yaml |
|----------|--------|---------------------------|
| `build_docker_image` | servers | servers/ubuntu/decision-rules.yaml |
| `pack_deb` | servers | servers/ubuntu/decision-rules.yaml |
| `pack_rpm` | servers | servers/centos/decision-rules.yaml |
| `pack_android_apk` | mobile | mobile/android/decision-rules.yaml |
| `pack_ios_ipa` | mobile | mobile/ios/decision-rules.yaml |
| `pack_pwa` | web | web/pwa/decision-rules.yaml |
| `pack_hybrid_app` | web | web/hybrid/*/decision-rules.yaml |
| `pack_windows_exe` | desktop | desktop/windows/decision-rules.yaml |
| `pack_macos_app` | desktop | desktop/macos/decision-rules.yaml |

---

*本框架由 ForgeKit 维护，基于多端需求和复杂度评估持续更新。*