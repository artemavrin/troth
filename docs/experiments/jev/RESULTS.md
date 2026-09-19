# RESULTS

## Прогон не состоялся

Дата попытки: 2026-09-19. Окружение: Claude Code on the web (удалённый контейнер, исходящий HTTPS через агентский прокси).

`probe.mjs` не запускался: не выполнено ни одно из двух необходимых условий.

### 1. Хост недоступен

Команда:

```
curl -sS -o /dev/null -w "%{http_code}\n" --max-time 10 https://ai-gateway.vercel.sh/
```

Вывод (воспроизведён дважды, результат одинаковый):

```
curl: (56) CONNECT tunnel failed, response 403
000
```

Код ответа: `000` (HTTP-ответ не получен — соединение не установлено). Код выхода curl: `56`.

Причина со стороны прокси — `curl -sS "$HTTPS_PROXY/__agentproxy/status"`:

```
"recentRelayFailures": [
  {
    "ts": "2026-09-19T12:13:12.912Z",
    "kind": "connect_rejected",
    "detail": "gateway answered 403 to CONNECT (policy denial or upstream failure)",
    "host": "ai-gateway.vercel.sh:443"
  },
  {
    "ts": "2026-09-19T12:13:22.724Z",
    "kind": "connect_rejected",
    "detail": "gateway answered 403 to CONNECT (policy denial or upstream failure)",
    "host": "ai-gateway.vercel.sh:443"
  }
]
```

То есть прокси сам отклоняет CONNECT на `ai-gateway.vercel.sh:443` по сетевой политике окружения; `ai-gateway.vercel.sh` не входит в `noProxy`-список разрешённых хостов.

### 2. Ключ отсутствует

```
env | grep -c AI_GATEWAY_API_KEY
```

Вывод: `0`.

Дополнительная проверка: переменная `AI_GATEWAY_API_KEY` не определена в окружении (не «задана пустой», а отсутствует).

### Что не делалось

`npm install` и `node probe.mjs all` не запускались — без сетевого доступа и без ключа запрос к шлюзу заведомо не прошёл бы. Никаких результатов замеров (корреляции осей вес/натяг, устойчивости распределения между одинаковыми запросами, различения родов) в этом файле нет и быть не может: данных не получено.

### Что нужно для повторной попытки

- Разрешить `ai-gateway.vercel.sh` в сетевой политике окружения (сейчас CONNECT отклоняется с 403).
- Передать `AI_GATEWAY_API_KEY` в окружение сессии как переменную среды.
