#!/usr/bin/env bash
# Тот же вызов без SDK — чтобы видеть провод.
# Эндпойнт и заголовки взяты из @ai-sdk/gateway 4.0.87, не из документации.
set -euo pipefail
: "${AI_GATEWAY_API_KEY:?нет AI_GATEWAY_API_KEY}"

curl -sS https://ai-gateway.vercel.sh/v4/ai/evaluation-model \
  -H "Authorization: Bearer $AI_GATEWAY_API_KEY" \
  -H "content-type: application/json" \
  -H "ai-evaluation-model-specification-version: 4" \
  -H "ai-model-id: typesafe-ai/jev" \
  -d '{
    "state": {
      "область": "северный хребет",
      "роды": { "Ember": "горный род, кузни", "Flint": "воины, презирают знамения" },
      "год": 47, "срок": "осень"
    },
    "questions": {
      "вес": {
        "type": "score",
        "instructions": "Насколько сильно это двигает мир: под хребтом спит дракон",
        "criteria": ["шёпот","молва","знак","знамение","кара","перелом"]
      },
      "натяг": {
        "type": "score",
        "instructions": "Насколько это против того, во что верят: под хребтом спит дракон",
        "criteria": ["подтверждает известное","правдоподобно","неожиданно","противоречит виденному","против общего знания"]
      },
      "верит_Ember": { "type": "boolean", "instructions": "Поверит ли Ember, что под хребтом спит дракон" },
      "верит_Flint": { "type": "boolean", "instructions": "Поверит ли Flint, что под хребтом спит дракон" }
    }
  }' | python3 -m json.tool
