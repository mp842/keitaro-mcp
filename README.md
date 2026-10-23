# keitaro-mcp

MCP-сервер, що підключає трекер [Keitaro](https://keitaro.io) до Claude.

## Мета

Дати Claude прямий доступ до даних Keitaro через Model Context Protocol, щоб у чаті можна було:

- переглядати кампанії, потоки, офери та джерела трафіку;
- отримувати звіти (кліки, конверсії, ROI, витрати) з фільтрами й групуванням;
- аналізувати результати та знаходити проблемні зв'язки без ручного вивантаження даних.

## Інструменти

| Інструмент | Що робить |
|---|---|
| `list_campaigns` | Список кампаній (фільтр за станом і назвою) |
| `get_campaign` | Налаштування кампанії разом із потоками |
| `list_offers` | Список оферів |
| `list_traffic_sources` | Список джерел трафіку |
| `list_affiliate_networks` | Список партнерських мереж |
| `build_report` | Звіт за період з групуванням, фільтрами та сортуванням |

Усі інструменти лише читають дані, нічого в Keitaro не змінюють.

## Встановлення

Потрібен Node.js 20+.

```bash
git clone https://github.com/mp842/keitaro-mcp.git
cd keitaro-mcp
npm install
npm run build
```

API-ключ створюється в Keitaro: «Обслуговування → Користувачі → API-ключі».

### Claude Code

```bash
claude mcp add keitaro \
  -e KEITARO_URL=https://tracker.example.com \
  -e KEITARO_API_KEY=ваш_ключ \
  -- node /шлях/до/keitaro-mcp/dist/index.js
```

### Claude Desktop

Додай у `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "keitaro": {
      "command": "node",
      "args": ["/шлях/до/keitaro-mcp/dist/index.js"],
      "env": {
        "KEITARO_URL": "https://tracker.example.com",
        "KEITARO_API_KEY": "ваш_ключ"
      }
    }
  }
}
```

## Приклади запитів

- «Покажи прибуток по кампаніях за вчора, відсортуй за profit»
- «Які країни в кампанії 12 мали ROI нижче нуля за останні 7 днів?»
- «Порівняй CR оферів у партнерці X за цей місяць»

## Безпека

API-ключ Keitaro та URL трекера задаються лише через змінні оточення (наприклад, `KEITARO_URL`, `KEITARO_API_KEY`) і ніколи не комітяться в репозиторій.
