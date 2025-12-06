# Troubleshooting

Common issues and solutions for Chrome extension testing.

## Bot Detection / "Something went wrong"

**Symptoms:**
- X.com shows "Something went wrong" error
- LinkedIn shows challenge pages
- Sites behave differently than in manual browsing

**Causes:**
- Using standard Playwright instead of rebrowser-playwright
- CDP (Chrome DevTools Protocol) detection
- `navigator.webdriver` flag set

**Solutions:**

1. **Use rebrowser-playwright:**
```typescript
// CORRECT
import { chromium } from "rebrowser-playwright";

// WRONG - will be detected
import { chromium } from "playwright";
```

2. **Add anti-detection flags:**
```typescript
args: [
  "--disable-blink-features=AutomationControlled",
  "--disable-infobars",
]
```

3. **Use persistent profile** to maintain cookies/login:
```typescript
chromium.launchPersistentContext(profilePath, { ... });
```

4. **Add human-like delays** between actions.

---

## No Extension Logs Captured

**Symptoms:**
- `getExtensionLogs()` returns empty array
- Console logs show but storage logs don't

**Causes:**
- Logger not included in manifest.json
- Event names don't match between logger and test
- Storage permission missing
- Logger loads after content script runs

**Solutions:**

1. **Check manifest.json** includes logger first:
```json
"js": ["shared/logger.js", "content/content.js"]
```

2. **Verify event names match:**
```javascript
// In logger.js
const GET_LOGS_EVENT = '__ext_get_logs__';

// In test
window.dispatchEvent(new Event('__ext_get_logs__'));
```

3. **Add storage permission:**
```json
"permissions": ["storage"]
```

4. **Wait for content script** to load before requesting logs:
```typescript
await humanDelay(2000, 3000);
const logs = await getExtensionLogs();
```

---

## Console Logs Not Captured / Missing Early Logs

**Symptoms:**
- Some console logs are missing
- Logs from page load are not captured
- Only late-occurring logs appear

**Causes:**
- Console listener attached AFTER navigation
- Page loads and logs before listener is ready

**Solutions:**

1. **Attach listeners BEFORE navigating:**
```typescript
// CORRECT - attach listener first
page.on('console', (msg) => {
  consoleLogs.push({ type: msg.type(), text: msg.text() });
});
page.on('pageerror', (error) => {
  pageErrors.push({ message: error.message });
});

// THEN navigate
await page.goto(url);
```

2. **Wrong order example:**
```typescript
// WRONG - misses early logs
await page.goto(url);  // Page loads, logs fire
page.on('console', ...);  // Listener attached too late!
```

---

## Login Session Not Persisting

**Symptoms:**
- Have to log in every test run
- Profile directory exists but session lost
- Cookies not saved

**Causes:**
- Using wrong profile path
- Profile directory deleted between runs
- Not using `launchPersistentContext`

**Solutions:**

1. **Use `launchPersistentContext`** (not regular `launch`):
```typescript
// CORRECT
const context = await chromium.launchPersistentContext(profilePath, { ... });

// WRONG - session not saved
const browser = await chromium.launch({ ... });
```

2. **Use consistent profile path:**
```typescript
const profilePath = path.resolve(__dirname, "../.test-profile");
```

3. **Use the login helper** to create persistent session:
```bash
npm run login
# Log in manually, press Enter
# Session saved to .test-profile/
```

4. **Don't delete .test-profile** between test runs unless you want fresh state

5. **Add .test-profile to .gitignore:**
```
.test-profile/
```

---

## Blank Screenshots

**Symptoms:**
- Screenshots are white/empty
- Screenshot file is tiny (< 1KB)

**Causes:**
- Viewport not set
- Page not fully loaded
- Clip area outside viewport

**Solutions:**

1. **Set explicit viewport:**
```typescript
viewport: { width: 1280, height: 900 }
```

2. **Wait for page load:**
```typescript
await page.goto(url);
await humanDelay(3000, 5000);
await page.waitForLoadState('domcontentloaded');
```

3. **Check clip dimensions:**
```typescript
await page.screenshot({
  path: filepath,
  clip: { x: 0, y: 0, width: 1280, height: 900 }
});
```

4. **Try fullPage option:**
```typescript
await page.screenshot({ path: filepath, fullPage: true });
```

---

## Extension Not Loading

**Symptoms:**
- No extension elements on page
- Extension doesn't appear in chrome://extensions

**Causes:**
- Wrong extension path
- Invalid manifest.json
- Extension path has spaces

**Solutions:**

1. **Verify extension path is absolute:**
```typescript
const extensionPath = path.resolve(__dirname, "..");
console.log("Extension path:", extensionPath);
```

2. **Test manifest.json** is valid:
```bash
# Check for JSON syntax errors
node -e "console.log(JSON.parse(require('fs').readFileSync('manifest.json')))"
```

3. **Check Chrome console** for extension errors:
   - Navigate to `chrome://extensions`
   - Enable Developer mode
   - Check for errors on extension card

4. **Avoid spaces in path** - some versions have issues with spaces.

---

## Extension ID Detection Fails

**Symptoms:**
- Cannot get extension ID programmatically
- `chrome://extensions` page parsing fails

**Causes:**
- Shadow DOM not being pierced
- Extension name mismatch
- Developer mode not enabled

**Solutions:**

1. **Hard-code extension ID** (found once manually):
```typescript
const extensionId = "abcdefghijklmnopabcdefghijklmnop";
const popupUrl = `chrome-extension://${extensionId}/popup/popup.html`;
```

2. **Find ID manually:**
   - Go to `chrome://extensions`
   - Enable Developer mode
   - Copy the ID shown under extension name

---

## Tests Pass Locally But Fail in CI

**Causes:**
- No display (headless required)
- Chrome not installed
- Different Chrome version

**Solutions:**

1. **Extensions require headed mode:**
```typescript
headless: false  // Required for extensions
```

2. **Use xvfb** for virtual display in CI:
```yaml
- run: xvfb-run npm test
```

3. **Install Chrome in CI:**
```yaml
- run: npm run install-chrome
```

---

## Storage Permission Errors

**Symptoms:**
- "Cannot read property 'local' of undefined"
- Logger fails silently

**Solutions:**

1. **Add permission to manifest.json:**
```json
{
  "permissions": ["storage"]
}
```

2. **Check context** - chrome.storage only works in extension contexts, not web pages.

---

## Profile Conflicts

**Symptoms:**
- Login session not persisting
- Extension state inconsistent
- Multiple test runs interfere

**Solutions:**

1. **Use unique profile per test:**
```typescript
const profilePath = path.resolve(__dirname, `../.test-profile-${timestamp}`);
```

2. **Clear profile between runs:**
```bash
rm -rf .test-profile
```

3. **Don't share profiles** between parallel tests.

---

## Slow Tests

**Causes:**
- Too many screenshots
- Excessive delays
- Not reusing browser instance

**Solutions:**

1. **Reuse browser context** across tests in same suite.

2. **Reduce delays** where detection isn't a concern:
```typescript
await humanDelay(1000, 1500);  // Instead of 5000-7000
```

3. **Screenshot only on failure** for long test suites.

4. **Use persistent profile** to skip login each time.
