# Проверка теорий · протокол экспериментов

Что было проверено на самом деле, а не рассуждением. Результаты — в
[`../experiments-results.md`](../experiments-results.md), исправления
разбора — в [`../architecture-review.md`](../architecture-review.md).

## Окружение

```
node    v22.22.2          vgpu 0.5.0 (Dawn)
python  3 + numpy 2.4.6   Mesa llvmpipe 25.2.8 (LLVM 20.1.2), программный Vulkan
```

Аппаратного GPU нет — Dawn поднят на lavapipe. Это ограничение важно для A:
межвендорное сравнение на настоящем железе здесь невозможно.

## Запуск

```bash
python3 exp_b_petlya.py        # B  · развёртка усиления петли веры
python3 exp_b2_vbros.py        # B2 · успевает ли гейт ожидания (ключевой)
python3 exp_e_ekonomika.py     # E  · доминирует ли «подтверждает известное»
python3 exp_e2_lekarstvo.py    # E2 · какая награда возвращает выбор

npm install vgpu playwright
node exp_a_determinizm.mjs     # A  · порядок суммирования, чистая диффузия
node exp_a2_gate.mjs           # A2 · то же с гейтом §6 (ключевой)
node exp_a4_trans.mjs          # A4 · расхождение exp/pow против эталона
node exp_a3_browser.mjs        # A3 · Dawn против браузера — НЕ РАБОТАЕТ, см. ниже
```

`exp_a3_browser.mjs` оставлен как есть: в этой сборке Chromium не отдаёт
`navigator.gpu` ни при каких флагах. Сравнение всё равно было бы слабым —
node-webgpu и Chromium оба на Dawn, то есть один компилятор шейдеров. Скрипт
пригодится на машине с железным GPU и вторым бэкендом.

## Чего проверить не удалось

Внешний egress этого окружения закрыт политикой: `ai-gateway.vercel.sh`,
`api.typesafe.ai` и всё остальное отвечают `connect_rejected`. Живых вызовов
Jev не было ни одного, поэтому гипотезы, упирающиеся в поведение модели,
остались непроверенными — их список в конце `../experiments-results.md`.
