# 诊断独立标注流程

这套流程用于把 50 条公开失败日志交给两名维护者独立分类，比较结果，并由第三人裁决冲突。工具负责隐藏逐条预置答案、校验语料哈希、阻止漏标和同一维护者重复签名；工具不能证明人员身份，也不能替代真实独立判断。

## 1. 准备隔离目录

`.forgekit-validation/` 已加入 `.gitignore`。中间标注表不得进入规则开发提交，也不要由两名 reviewer 互相查看。

```bash
mkdir -p .forgekit-validation
```

## 2. 生成两份盲标表

由协调者分别生成并交付。输出不会包含每条案例的 `expected_code`，但会包含本轮允许选择的错误码列表。

```bash
npm run annotations:prepare -- \
  --reviewer maintainer-a \
  --output .forgekit-validation/reviewer-a.json

npm run annotations:prepare -- \
  --reviewer maintainer-b \
  --output .forgekit-validation/reviewer-b.json
```

两名维护者分别填写自己文件中每条案例的 `selected_code` 和可选 `notes`。不得查看另一人的文件，不得查看源语料中的预置答案，也不得根据当前规则输出反推标签。

## 3. 比较标注

两份表全部填写后运行：

```bash
npm run annotations:compare -- \
  --reviewer-a .forgekit-validation/reviewer-a.json \
  --reviewer-b .forgekit-validation/reviewer-b.json \
  --output .forgekit-validation/comparison.json \
  --adjudication .forgekit-validation/adjudication.json
```

命令会拒绝以下情况：

- reviewer id 相同；
- 两份表来自不同语料哈希；
- 案例漏标、顺序变化或错误码不在允许列表；
- 两份表的允许错误码列表不同。

## 4. 第三人裁决

若 `comparison.json` 的 `totals.conflicts` 大于 0，由第三名维护者填写 `adjudication.json`：

- `adjudicator` 必须不同于两名 reviewer；
- 每个冲突都必须填写 `resolved_code`；
- `notes` 记录裁决依据。

没有冲突时，锁定命令可以省略 `--adjudication`。

## 5. 锁定语料

```bash
npm run annotations:lock -- \
  --comparison .forgekit-validation/comparison.json \
  --adjudication .forgekit-validation/adjudication.json \
  --output .forgekit-validation/locked-corpus.json \
  --report .forgekit-validation/annotation-report.json
```

锁定结果会记录两名 reviewer、裁决者、同意/冲突数量、源语料 SHA256、锁定语料 SHA256 和锁定时间。任何未裁决冲突都会阻止输出。

## 6. 执行发布门禁

```bash
npm run build:clean
node scripts/evaluate-diagnostics.mjs \
  .forgekit-validation/locked-corpus.json \
  --release-gate
```

通过后仍需人工复核 `annotation-report.json`，再把锁定语料、评估 JSON、两位 reviewer 的签字和第三人裁决记录归档为不可变发布证据。不要在看到门禁结果后修改规则并重复报告同一留出集成绩；规则变化后必须换新的留出集。
