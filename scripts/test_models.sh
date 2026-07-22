#!/bin/bash

API_KEY="${FORGEKIT_MODEL_API_KEY:-}"
BASE_URL="https://opencode.ai/zen/go/v1"

if [[ -z "$API_KEY" ]]; then
  echo "FORGEKIT_MODEL_API_KEY is required" >&2
  exit 1
fi

models=(
  "minimax-m3"
  "minimax-m2.7"
  "minimax-m2.5"
  "kimi-k2.7-code"
  "kimi-k2.6"
  "kimi-k2.5"
  "glm-5.2"
  "glm-5.1"
  "glm-5"
  "deepseek-v4-pro"
  "deepseek-v4-flash"
  "qwen3.7-max"
  "qwen3.7-plus"
  "qwen3.6-plus"
  "qwen3.5-plus"
  "mimo-v2-pro"
  "mimo-v2-omni"
  "mimo-v2.5-pro"
  "mimo-v2.5"
  "hy3-preview"
)

echo "模型测试结果：" | tee /tmp/model_test_results.txt
echo "==============" | tee -a /tmp/model_test_results.txt

test_model() {
  local model=$1
  local result=$(curl -s -X POST "$BASE_URL/chat/completions" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"model\": \"$model\", \"messages\": [{\"role\": \"user\", \"content\": \"回复OK\"}], \"max_tokens\": 10}" 2>&1)

  local status="✗ FAILED"
  local response=""

  if echo "$result" | jq -e '.choices[0].message.content' > /dev/null 2>&1; then
    status="✓ OK"
    response=$(echo "$result" | jq -r '.choices[0].message.content')
  elif echo "$result" | jq -e '.error.message' > /dev/null 2>&1; then
    response=$(echo "$result" | jq -r '.error.message')
  else
    response="$result"
  fi

  echo "$model: $status - $response" | tee -a /tmp/model_test_results.txt
}

# 测试所有模型，控制并发为3
for ((i=0; i<${#models[@]}; i+=3)); do
  batch=("${models[@]:i:3}")

  for model in "${batch[@]}"; do
    test_model "$model" &
  done

  wait
done

echo "" | tee -a /tmp/model_test_results.txt
echo "测试完成！结果已保存到 /tmp/model_test_results.txt"
