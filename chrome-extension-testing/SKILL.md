---
name: chrome-extension-testing
description: Test Chrome extensions with stealth automation on bot-protected sites. Use when testing extensions on X.com, LinkedIn, or other sites with CDP detection. Provides cross-script logging, screenshot capture, and HTML analysis. Handles isolated world communication.
---

# Chrome Extension Testing

Test Chrome extensions using rebrowser-playwright (stealth Playwright fork) with cross-script logging and comprehensive reporting.

## CRITICAL: Agent Workflow Requirements

**BEFORE starting any test:**
1. Check if `test-reports/` folder exists in the target project. If not, create it.
2. Each test run MUST create a unique subfolder: `test-reports/{timestamp}_{test-name}/`

**AFTER every test run, the agent MUST:**
1. **View ALL screenshots** - Use the Read tool to view every PNG in the test report folder. Verify all visuals look correct (UI elements rendered properly, no broken layouts, extension elements visible where expected).
2. **Read the logs** - Open `console-logs.md` and verify logs look correct (no unexpected errors, expected actions logged, timing makes sense).
3. **Confirm report completeness** - Ensure the test folder contains:
   - All numbered screenshots (`01_*.png`, `02_*.png`, etc.)
   - `console-logs.md` with extension and page console logs
   - `full-page.html` with complete page HTML

**About the saved HTML files:**
The HTML files (`full-page.html`, `element-contexts.html`) are saved for **on-demand debugging only**. They should be grepped or read when:
- Verifying the DOM state at a specific test step
- Checking for HTML errors or malformed markup
- Understanding the structure of the page to improve selectors or injection logic
- Debugging why an element wasn't found or looks wrong

Do NOT read HTML files routinely - only when investigating issues or when the visual screenshots show problems that need DOM-level analysis.

## Quick Reference

| Task | Method |
|------|--------|
| Set up test env | Run `scripts/init-test-env.js` or copy assets manually |
| Add logging | Copy `assets/logger.js` to extension's `shared/` folder |
| Write test | Use `assets/test-template.ts` as starting point |
| Run tests | `npm run test:stealth` |
| Manual login | `npm run login` (saves session to .test-profile/) |
| Zoom screenshot | `node scripts/zoom-screenshot.js <input> <x> <y> <w> <h> <output>` |
| Report generation | Use `assets/reporter.ts` for structured markdown reports |

## Setup Workflow

1. Copy `assets/package-template.json` to target project
2. Run `npm install && npm run install-chrome`
3. Copy `assets/logger.js` to extension's `shared/logger.js`
4. Update extension's `manifest.json` to include logger (see [LOGGER.md](references/LOGGER.md))
5. Create test file based on `assets/test-template.ts`
6. Copy `assets/simple-login.ts` to `tests/` for login helper
7. Run `npm run login` to log in manually (session saved to .test-profile/)
8. Run `npm run test:stealth`

## Test-Debug-Fix Cycle

After implementing extension changes:

1. **Ensure test-reports folder exists** - Create `test-reports/` if missing
2. **Run test**: `npm run test:stealth` (creates `test-reports/{timestamp}_{test-name}/`)
3. **View ALL screenshots**: Use Read tool on every PNG to verify visuals are correct
4. **Read logs**: Open `console-logs.md` to confirm logs look correct
5. **Grep HTML if needed**: Only analyze `full-page.html` when debugging DOM issues
6. **Zoom if needed**: Use zoom script on specific screenshot regions
7. **Fix and repeat**

## Key Concepts

### Isolated World Problem
Content scripts run in isolated JavaScript context. Playwright's `page.evaluate()` runs in main world, missing content script output.

**Solution**: Event-based API bridges the gap:
```javascript
// In test (main world):
window.dispatchEvent(new Event('__xpn_get_logs__'));
// Content script responds with __xpn_logs_response__
```

### Bot Detection Bypass
Standard Playwright gets blocked on X.com, LinkedIn, etc.

**Solution**: Use `rebrowser-playwright` instead:
```typescript
import { chromium } from "rebrowser-playwright";  // NOT 'playwright'
```

### Cross-Script Logging
Background, content, and popup scripts need unified logging.

**Solution**: Shared logger writes to `chrome.storage.local`:
```javascript
xpnLog('content', 'log', 'Button injected', data);
```

## Report Analysis

Test reports are saved to `test-reports/{timestamp}_{test-name}/`:

| File | Purpose | When to Review |
|------|---------|----------------|
| `01_step.png`, `02_step.png`... | Numbered screenshots | **ALWAYS** - View every screenshot after each test |
| `console-logs.md` | All extension logs (content/background/popup) | **ALWAYS** - Read to confirm test behavior |
| `full-page.html` | Complete page HTML for DOM analysis | **ON-DEMAND** - Only grep when debugging |
| `element-contexts.html` | HTML fragments around injected elements | **ON-DEMAND** - Only grep when debugging |

### Mandatory Post-Test Verification

After EVERY test run:
```
1. Glob for all PNGs:     test-reports/{latest}/*.png
2. Read each screenshot:  Verify UI looks correct
3. Read logs:             test-reports/{latest}/console-logs.md
4. If issues found:       Grep full-page.html for DOM analysis
```

### When to Use HTML Files

The saved HTML is a debugging tool, NOT a routine check. Use it for:
- **DOM state verification**: Confirm elements exist in expected locations
- **Error investigation**: Check for malformed markup or missing nodes
- **Selector development**: Understand page structure to write better selectors
- **Injection debugging**: See where extension elements are inserted

Example debugging flow:
```
Screenshot shows button missing → Grep full-page.html for button class →
Find parent container structure → Update injection selector
```

## Detailed Guides

- **Logger integration**: [references/LOGGER.md](references/LOGGER.md)
- **Test patterns**: [references/TEST-PATTERNS.md](references/TEST-PATTERNS.md)
- **Troubleshooting**: [references/TROUBLESHOOTING.md](references/TROUBLESHOOTING.md)
