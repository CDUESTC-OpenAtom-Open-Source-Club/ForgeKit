# 贡献 BuildKit 日志

感谢你愿意贡献真实的构建失败日志！这将帮助我们改进 ForgeKit 的诊断准确率。

---

## 为什么需要真实日志？

当前 ForgeKit v0.2.1 的诊断规则基于 16 个最小复现案例，无法覆盖所有真实场景。

我们需要：
- **≥50 个真实 BuildKit 日志**
- **覆盖各种错误类型**（依赖、网络、权限、磁盘等）
- **已知真实原因**（用于验证诊断准确性）

---

## 如何提交日志？

### 方式1：GitHub Issue（推荐）

1. 访问 [提交 BuildKit 日志](https://github.com/CDUESTC-OpenAtom-Open-Source-Club/ForgeKit/issues/new?template=build-log-submission.yml)
2. 填写表单（日志来源、上下文、日志内容）
3. 勾选隐私确认
4. 提交

---

### 方式2：本地诊断后提交

```bash
# 1. 运行诊断工具
node dist/capabilities/diagnose-build-failure.js --log-path /tmp/build-failure.log

# 2. 记录诊断结果
# - 诊断类别
# - 置信度
# - 是否正确

# 3. 提交日志 + 诊断反馈
# （通过GitHub Issue）
```

---

## 隐私与安全

### ⚠️ 提交前必须脱敏

**请移除或替换以下内容**：

```bash
# 密码
mysql://user:password123@host → mysql://user:[REDACTED]@host

# API Key / Token
API Key: sk-1234567890 → API Key: [REDACTED]
Token: ghp_ABCDEFGH → Token=[REDACTED]

# 用户路径
/Users/john/projects → /Users/[USER]/projects
/home/admin/app → /home/[USER]/app

# 私有仓库地址
git@github.com:private/repo.git → git@github.com:[PRIVATE_REPO].git

# 内部域名
db.internal.company.com → db.[INTERNAL_DOMAIN].com
```

### ✅ 可以保留的内容

- 公共镜像名称（`python:3.11`, `node:18`）
- 公共包名称（`numpy`, `react`）
- 公共域名（`docker.io`, `registry-1.docker.io`）
- 错误消息、堆栈跟踪

---

## 日志示例

### ✅ 好的提交（已脱敏）

```
#0 building with "default" instance using docker driver

#1 [internal] load build definition from Dockerfile
#1 DONE 0.0s

#2 [internal] load .dockerignore
#2 DONE 0.0s

#3 [1/3] FROM docker.io/library/python:3.11
#3 DONE 0.5s

#4 [2/3] COPY requirements.txt .
#4 DONE 0.1s

#5 [3/3] RUN pip install -r requirements.txt
#5 0.514 ERROR: Cannot install numpy==1.24.0 and numpy==1.26.0
#5 0.515 The conflict is caused by:
#5 0.515     The user requested numpy==1.24.0
#5 0.515     The user requested numpy==1.26.0
#5 ERROR: process "/bin/sh -c pip install -r requirements.txt" did not complete successfully: exit code: 1

ERROR: failed to solve: process "/bin/sh -c pip install -r requirements.txt" did not complete successfully: exit code: 1
```

**真实原因**：requirements.txt 中重复指定 numpy 版本
**诊断结果**：pip_dependency_conflict ✅ 正确

---

### ❌ 不好的提交（未脱敏）

```
#5 0.515 ERROR: Cannot connect to database
#5 0.515 Connection string: mysql://admin:MyP@ssw0rd!@db.internal.company.com:3306
#5 0.515 API Key: sk-prod-1234567890abcdefghijklmnopqrstuvwxyz
#5 0.515 User: john.doe@company.com
```

**问题**：包含真实密码、API Key、内部域名、邮箱

---

## 日志分类

我们收集的日志会分类为：

| 类别 | 示例错误 | 目标数量 |
|------|----------|----------|
| 依赖冲突 | numpy版本不兼容 | ≥10 |
| Dockerfile语法 | COPY缺少目标路径 | ≥5 |
| 网络问题 | Registry超时 | ≥5 |
| 权限问题 | 文件读取权限不足 | ≥5 |
| 磁盘空间 | 磁盘满 | ≥3 |
| 架构不兼容 | amd64 vs arm64 | ≥3 |
| 其他 | 未知错误 | ≥19 |
| **总计** | - | **≥50** |

---

## 贡献者权益

### 🎉 感谢

提交日志的贡献者会：
- 在 README 中致谢（如果愿意）
- 优先获得ForgeKit新功能试用资格
- 帮助改进开源工具，造福社区

---

## 常见问题

### Q: 我的日志很大（>1MB），怎么提交？

A: 请压缩后上传到 [GitHub Gist](https://gist.github.com/)，然后在Issue中附上链接。

---

### Q: 我不确定日志中是否有敏感信息，怎么办？

A: 可以先用 ForgeKit 诊断工具处理，它会自动脱敏：

```bash
node dist/capabilities/diagnose-build-failure.js --log-path /tmp/build.log --sanitize
```

---

### Q: 我可以提交商业项目的日志吗？

A: 只要脱敏且不包含商业机密，可以提交。建议咨询公司法务。

---

### Q: 提交后多久会有反馈？

A: 维护者会在 1-3 天内回复：
- 诊断结果是否正确
- 如何改进规则库
- 感谢你的贡献

---

## 联系我们

- GitHub Issues: [提交日志](https://github.com/CDUESTC-OpenAtom-Open-Source-Club/ForgeKit/issues/new?template=build-log-submission.yml)
- 邮箱: [维护者邮箱]

感谢你的贡献！🎉