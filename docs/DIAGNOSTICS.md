# Docker 构建诊断说明

## 1. 使用方式

`diagnose_build_failure` 是只读 MCP 工具，不要求 Docker daemon 或网络连接。它不会执行建议命令，也不会修改项目文件。

直接分析日志文本：

```json
{
  "log_text": "ERROR: No matching distribution found for demo==99.0"
}
```

分析项目目录内的日志文件：

```json
{
  "source_dir": "/path/to/project",
  "log_path": "/path/to/project/logs/docker-build.log"
}
```

`log_text` 与 `log_path` 必须且只能提供一个。文件模式要求 `source_dir`，并会解析真实路径以阻止目录越界和符号链接绕过。单次输入最大 1 MiB。

## 2. 输出字段

| 字段 | 含义 |
|---|---|
| `code` | 稳定的机器可读错误码 |
| `category` | 环境、路径、Dockerfile、依赖、Registry、架构、权限、磁盘、运行时或未知 |
| `summary` | 面向用户的一句话结论 |
| `evidence` | 从原始日志提取并脱敏的关键行 |
| `probable_cause` | 当前证据支持的可能原因 |
| `confidence` | 规则匹配强度，不是统计概率 |
| `suggested_actions` | 有适用条件的安全处理步骤 |
| `verification` | 修复后确认问题是否解决的方法 |

## 3. 置信度

当前置信度是规则语义，不应解释为已经校准的百分比：

- `high`：日志包含该类别特有的明确错误签名，例如 `ResolutionImpossible` 或 `no matching manifest`；
- `medium`：日志匹配较通用的错误签名，可能存在多个根因，例如普通 `Permission denied`；
- `low`：没有足够证据分类，ForgeKit 返回 `unknown` 并避免猜测性修复。

只有建立独立盲测集并统计准确率后，才能为置信度增加概率区间。开发规则时使用过的样本不能参与该校准。

## 4. 脱敏范围

返回的 `evidence` 当前会处理：

- Bearer Token、常见 GitHub Token 和 `sk-` 形式密钥；
- `password`、`secret`、`token`、`api_key`、`authorization` 等键值；
- 邮箱地址，替换为 `[EMAIL]`；
- macOS `/Users/<name>/` 和 Linux `/home/<name>/` 用户路径。

脱敏是降低意外泄露风险的辅助机制，不保证识别所有私有格式。提交公开报告前仍应人工检查，不应输入私钥、完整环境变量或生产凭据。

## 5. 离线边界

- 日志诊断本身完全离线，不访问 Docker Hub 或其他 Registry；
- `preflight_check` 的 Registry 检查可以通过 `checks` 参数不选择 `registry_connectivity`；
- 真正执行 `docker build` 时，是否能断网完成取决于基础镜像和依赖是否已存在于本机缓存；
- ForgeKit 当前没有虚构一个通用 `--offline` 开关，也不会自动修改镜像源；
- Podman CLI 兼容性仍是试验性范围，不能把日志诊断通过等同于真实 Podman 构建通过。

## 6. 当前限制

当前规则集随 v0.2.2-rc.1 进入独立验证阶段。最小复现和公开开发样本用于防止回归，不代表真实场景准确率。遇到未知错误时应保留脱敏日志和复现条件，加入独立标注流程后再决定是否扩展规则。

## 7. 准确率评估

公开开发集可以用统一脚本检查：

```bash
npm run evaluate:diagnostics
```

报告包含总准确率、未知率、按期望错误码统计、混淆结果和失败清单。开发集通过只说明现有规则没有回归，不是对外准确率。

正式盲测必须满足：

1. 样本未参与规则设计；
2. 每条日志由人工根据上下文标注期望错误码；
3. 同一真实故障的重复日志去重；
4. 同时报告准确率、未知率和各类别样本数；
5. 评估完成前不根据盲测答案修改规则，修改后使用新的留出集复测。

RC 的 50 条留出集位于 `tests/fixtures/diagnostic-blind-cases.json`，包含公开来源、语言、运行时、目标平台和期望错误码。运行 `npm run evaluate:diagnostics:blind` 会输出完整报告；运行 `npm run gate:diagnostics` 还会强制检查 80% 准确率、unknown rate、每类至少 3 条、去重、脱敏和双维护者标注。当前语料的标注状态仍为 `pending`，因此门禁会明确失败，不能把预标注结果当作发布声明。
