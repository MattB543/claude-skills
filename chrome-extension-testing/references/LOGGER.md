# Logger Integration Guide

The shared logger captures logs from all extension contexts (content scripts, background worker, popup) and stores them in `chrome.storage.local` for test retrieval.

## Setup

### 1. Copy logger to extension

Copy `assets/logger.js` to your extension's `shared/` folder:

```
your-extension/
├── shared/
│   └── logger.js
├── content/
│   └── content.js
├── background/
│   └── background.js
└── manifest.json
```

### 2. Customize logger keys

Edit `shared/logger.js` to set unique keys for your extension:

```javascript
// Line ~15: Change storage key
const LOG_KEY = '__myext_debug_logs__';

// Lines ~121-124: Change event names
const GET_LOGS_EVENT = '__myext_get_logs__';
const LOGS_RESPONSE_EVENT = '__myext_logs_response__';
```

### 3. Update manifest.json

Include logger before other scripts in each context:

**Content scripts:**
```json
{
  "content_scripts": [{
    "matches": ["*://*.example.com/*"],
    "js": ["shared/logger.js", "content/content.js"],
    "run_at": "document_idle"
  }]
}
```

**Background service worker:**
```javascript
// background/background.js (first line)
importScripts('shared/logger.js');
```

**Popup:**
```html
<!-- popup/popup.html -->
<script src="../shared/logger.js"></script>
<script src="popup.js"></script>
```

### 4. Add storage permission

```json
{
  "permissions": ["storage"]
}
```

## Usage

### Logging

```javascript
// source: 'content' | 'background' | 'popup'
// level: 'log' | 'error' | 'warn' | 'info'
extLog('content', 'log', 'Button injected for', username);
extLog('background', 'error', 'API call failed', error);
extLog('popup', 'info', 'Loaded', count, 'notes');
```

### Log format in storage

```javascript
{
  t: 1701720000000,     // timestamp
  s: 'content',         // source
  l: 'log',             // level
  m: 'Injected 5 buttons' // message (args joined as string)
}
```

## Retrieving Logs in Tests

Content scripts run in an **isolated world**. Playwright's `page.evaluate()` runs in the main world and cannot access content script variables. Use the event-based API:

```typescript
const getExtensionLogs = async (): Promise<any[]> => {
  const logs = await page.evaluate(async () => {
    return new Promise<string>((resolve) => {
      // Listen for response from content script
      window.addEventListener('__myext_logs_response__', (e: CustomEvent) => {
        resolve(e.detail);
      }, { once: true });

      // Request logs from content script
      window.dispatchEvent(new Event('__myext_get_logs__'));

      // Timeout fallback
      setTimeout(() => resolve('[]'), 2000);
    });
  });
  return JSON.parse(logs);
};
```

## How It Works

1. **Logging**: `extLog()` writes to console immediately, then queues for storage
2. **Batching**: Logs are batched with 100ms debounce to reduce storage writes
3. **Storage**: Queued logs are merged with existing logs in `chrome.storage.local`
4. **Trimming**: Only the last 1000 logs are kept to prevent bloat
5. **Retrieval**: Event-based API bridges isolated world to main world

```
Content Script (isolated world)    Main World (Playwright)
         │                               │
         │   __ext_get_logs__ event      │
         │◄──────────────────────────────┤
         │                               │
         │   reads chrome.storage        │
         │                               │
         │   __ext_logs_response__       │
         ├──────────────────────────────►│
         │   (logs in e.detail)          │
```

## Best Practices

1. **Tag all logs with source** - Makes filtering easy in reports
2. **Use appropriate levels** - `error` for failures, `warn` for issues, `log` for info
3. **Include context** - Log relevant data: usernames, counts, element info
4. **Don't log sensitive data** - Avoid passwords, tokens, PII
5. **Clear logs between test runs** - Call `extClearLogs()` or use fresh profile
