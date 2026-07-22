# 参与 ForgeKit

ForgeKit 是社团维护的公共开源项目。欢迎初学者从文档、示例和可复现问题开始参与，不需要先了解全部内部架构。

## 最适合的新贡献

1. 用一个公开的小项目按 [安装指南](docs/GETTING_STARTED.md) 完成一次流程；
2. 提交一个清楚记录环境和结果的试点反馈；
3. 改进一个失败提示、示例或文档段落；
4. 为 Python、TypeScript/Node.js、Go 增加可公开的兼容性样本。

## 开发前检查

```bash
npm ci
npm run verify
```

代码改动必须保持 Node.js 18 和 20 兼容。涉及构建路径、模板或 MCP Schema 时，请同时增加自动化测试，并说明是否改变版本范围契约。

## 提交 Issue 时请提供

- 你想完成的任务，而不是只描述内部实现；
- 操作系统、Node.js、npm、Docker 版本；
- 使用的 ForgeKit commit 或版本；
- 最小复现步骤和脱敏后的错误摘要；
- 你期望 ForgeKit 如何解释或帮助你。

请勿提交密码、Token、私有仓库地址或完整生产环境变量。

## 版本范围原则

新功能先进入候选池。只有存在真实用户任务、清楚的非范围、自动化验收方法和维护者，才会进入承诺版本。详见 [版本范围契约](docs/VERSION_SCOPE.md) 与 [支持矩阵](docs/SUPPORT_MATRIX.md)。
