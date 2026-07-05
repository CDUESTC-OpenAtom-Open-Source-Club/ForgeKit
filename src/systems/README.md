# ForgeKit 系统适配框架总览

> 本文档汇总 ForgeKit 支持的所有操作系统、版本和打包方式
> 位置：`src/systems/` 目录

---

## 支持的操作系统总览

| 系统 | 包格式 | 推荐版本 | 架构支持 | 文档位置 |
|------|--------|----------|----------|----------|
| Ubuntu | deb | 20.04 / 22.04 LTS | x86_64 / aarch64 | [ubuntu/](./ubuntu/) |
| Debian | deb | 11 / 12 Stable | x86_64 / aarch64 | [debian/](./debian/) |
| CentOS | rpm | 9 Stream | x86_64 / aarch64 | [centos/](./centos/) |
| EulerOS | rpm | 2.2 / 2.3 / 2.9 | x86_64 / aarch64 | [euleros/](./euleros/) |
| Fedora | rpm | 38 / 39 | x86_64 / aarch64 | [fedora/](./fedora/) |
| openSUSE | rpm | Leap 15.5 | x86_64 / aarch64 | [opensuse/](./opensuse/) |

---

## 目录结构

```
src/systems/
├── ubuntu/
│   ├── versions.yaml              # Ubuntu 版本清单（20.04/22.04/24.04）
│   ├── packaging-guide.md         # Ubuntu deb 打包完整指南
│   ├── templates/                 # Ubuntu 打包模板文件
│   │   ├── Dockerfile.ubuntu-22.04
│   │   ├── Dockerfile.ubuntu-20.04
│   │   ├── Dockerfile.ubuntu-24.04
│   │   ├── control.template
│   │   ├── rules.template
│   │   ├── changelog.template
│   │   ├── postinst.template
│   │   ├── service.template
│   ├── issues/                    # Ubuntu 已知问题与解决方案
│   │   ├── glibc-dependency.md
│   │   ├── python-versions.md
│
├── debian/
│   ├── versions.yaml              # Debian 版本清单（10/11/12）
│   ├── packaging-guide.md         # Debian deb 打包指南（待完善）
│   ├── templates/                 # Debian 打包模板（复用 Ubuntu 模板）
│
├── centos/
│   ├── versions.yaml              # CentOS 版本清单（7/8/9）
│   ├── packaging-guide.md         # CentOS RPM 打包指南（待完善）
│   ├── templates/                 # CentOS RPM 打包模板
│   │   ├── Dockerfile.centos-9
│   │   ├── spec.template
│   │   ├── rpmmacros.template
│
├── euleros/
│   ├── versions.yaml              # EulerOS 版本清单（2.2/2.3/2.9）
│   ├── packaging-guide.md         # EulerOS RPM 打包指南（待完善）
│   ├── templates/                 # EulerOS RPM 打包模板
│
├── fedora/
│   ├── versions.yaml              # Fedora 版本清单（38/39/40）
│   ├── packaging-guide.md         # Fedora RPM 打包指南（待完善）
│   ├── templates/                 # Fedora RPM 打包模板
│
├── opensuse/
│   ├── versions.yaml              # openSUSE 版本清单（待添加）
│   ├── packaging-guide.md         # openSUSE RPM 打包指南（待添加）
│
├── README.md                      # 本文档（系统适配框架总览）
```

---

## 快速使用指南

### 1. 查找目标系统版本

```bash
# 查看某个系统支持的版本
cat src/systems/ubuntu/versions.yaml
cat src/systems/centos/versions.yaml

# 查看所有系统的推荐版本
grep "recommended: true" src/systems/*/versions.yaml
```

### 2. 使用打包模板

```bash
# Ubuntu deb 打包（完整示例）
cd your-project
cp src/systems/ubuntu/templates/control.template debian/control
cp src/systems/ubuntu/templates/rules.template debian/rules
docker build -f src/systems/ubuntu/templates/Dockerfile.ubuntu-22.04 .

# CentOS RPM 打包（基础示例）
cd your-project
cp src/systems/centos/templates/spec.template package.spec
rpmbuild -bb package.spec
```

### 3. 查看打包指南

```bash
# Ubuntu 详细打包指南（推荐）
cat src/systems/ubuntu/packaging-guide.md

# 其他系统打包指南（后续完善）
cat src/systems/centos/packaging-guide.md  # 待添加
cat src/systems/euleros/packaging-guide.md  # 待添加
```

---

## 系统版本详细对照表

### glibc 版本对照

| 系统 | 版本 | glibc | 兼容性说明 |
|------|------|-------|-----------|
| Ubuntu 20.04 | LTS | 2.31 | 低版本，构建产物可向上兼容 |
| Ubuntu 22.04 | LTS | 2.35 | 中版本，推荐用于构建 |
| Ubuntu 24.04 | LTS | 2.39 | 高版本，产物不可向下兼容 |
| Debian 11 | Stable | 2.31 | 与 Ubuntu 20.04 相同 |
| Debian 12 | Stable | 2.36 | 介于 Ubuntu 22.04-24.04 |
| CentOS 7 | EOL | 2.17 | 极低版本，建议容器化 |
| CentOS 9 | Stream | 2.34 | 中版本，推荐用于构建 |
| EulerOS 2.2 | LTS | 2.17 | 兼容 CentOS 7 |
| EulerOS 2.3 | LTS | 2.28 | 兼容 CentOS 8 |
| EulerOS 2.9 | LTS | 2.34 | 兼容 CentOS 9 |

**关键结论**：
- ✅ 在 **glibc 低版本**构建，产物可向上兼容
- ❌ 在 **glibc 高版本**构建，产物不可向下兼容
- 🎯 **推荐构建版本**：Ubuntu 20.04（glibc 2.31）、CentOS 9（glibc 2.34）

---

### Python 版本对照

| 系统 | 版本 | Python 默认 | 推荐最低要求 |
|------|------|-------------|-------------|
| Ubuntu 20.04 | LTS | 3.8 | Python >= 3.8 |
| Ubuntu 22.04 | LTS | 3.10 | Python >= 3.8 |
| Ubuntu 24.04 | LTS | 3.12 | Python >= 3.8 |
| Debian 11 | Stable | 3.9 | Python >= 3.8 |
| Debian 12 | Stable | 3.11 | Python >= 3.8 |
| CentOS 9 | Stream | 3.9 | Python >= 3.9 |
| EulerOS 2.3 | LTS | 3.7 | Python >= 3.7 |
| EulerOS 2.9 | LTS | 3.9 | Python >= 3.9 |

**关键结论**：
- ✅ 使用 **Python >= 3.8** 声明，覆盖大部分 LTS 系统
- 🟡 EulerOS 2.3 需要特殊处理（Python 3.7）
- 🎯 **推荐最低要求**：Python >= 3.8（兼容 Ubuntu 20.04+）

---

## 已知问题与解决方案

### glibc 版本不兼容

**问题**：在 Ubuntu 22.04（glibc 2.35）构建的包，无法在 Ubuntu 20.04（glibc 2.31）上运行

**解决方案**：
1. 在目标系统最低版本构建（Ubuntu 20.04）
2. 使用静态链接（Go/Rust）
3. 使用容器化部署（Docker）

**详细文档**：`src/systems/ubuntu/issues/glibc-dependency.md`

---

### Python 版本不匹配

**问题**：依赖 `python3 >= 3.10`，但 Ubuntu 20.04 只有 Python 3.8

**解决方案**：
1. 使用最低 Python 版本声明（`python3 >= 3.8`）
2. 在 postinst 中安装指定版本
3. 使用虚拟环境隔离

**详细文档**：`src/systems/ubuntu/issues/python-versions.md`

---

### aarch64 交叉编译

**问题**：在 x86_64 上构建 aarch64 包需要配置

**解决方案**：
1. 使用 Docker buildx（`docker buildx build --platform linux/arm64`）
2. 使用 QEMU 模拟
3. 使用原生 ARM 实例（华为云鲲鹏、AWS Graviton）

---

## 后续完善计划

| 优先级 | 任务 | 预计完成时间 |
|--------|------|-------------|
| P0 | 完善 Ubuntu 打包指南（已完成） | ✅ 已完成 |
| P1 | 完善 CentOS/EulerOS RPM 打包指南 | 编码阶段 |
| P1 | 完善 Debian 打包指南 | 编码阶段 |
| P1 | 补充 Dockerfile（CentOS/Debian/EulerOS） | 编码阶段 |
| P2 | 补充 openSUSE 打包指南 | v0.2 |
| P2 | 补充各系统已知问题文档 | v0.2 |

---

## 使用 ForgeKit MCP 调用示例

### 打包指定版本系统

```bash
# 在 Claude Code 中说：
"把这个 Python 项目打包成 Ubuntu 22.04 的 deb 包"

# ForgeKit MCP 会自动：
1. 读取 src/systems/ubuntu/versions.yaml
2. 选择 Ubuntu 22.04（jammy）构建镜像
3. 使用 templates/Dockerfile.ubuntu-22.04
4. 生成符合规范的 deb 包
5. 输出 decision_basis（为什么选择 Ubuntu 22.04）
```

### 多版本构建

```bash
# 在 Claude Code 中说：
"把这个项目打包成 Ubuntu 20.04/22.04 和 CentOS 9 的包"

# ForgeKit MCP 会自动：
1. 并行构建 3 个版本（Ubuntu 20.04/22.04 + CentOS 9）
2. 处理 glibc 版本兼容性
3. 统一命名产物：package_ubuntu-20.04.deb, package_centos-9.rpm
```

---

*本框架由 ForgeKit 维护，基于实战经验和官方规范持续更新。*