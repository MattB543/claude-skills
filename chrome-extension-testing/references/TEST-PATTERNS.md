# Test Patterns

Common patterns for Chrome extension testing with rebrowser-playwright.

## Stealth Browser Launch

Use `rebrowser-playwright` instead of standard Playwright to bypass CDP detection:

```typescript
import { chromium } from "rebrowser-playwright";  // NOT 'playwright'

const context = await chromium.launchPersistentContext(profilePath, {
  headless: false,  // Required for extensions
  executablePath: chromePath,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    "--disable-blink-features=AutomationControlled",
    "--disable-infobars",
    "--no-first-run",
    "--no-default-browser-check",
  ],
  viewport: { width: 1280, height: 900 },
});
```

## Human-Like Delays

Avoid detection with randomized delays:

```typescript
const humanDelay = (min: number, max: number) =>
  new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

// Usage
await page.goto("https://x.com/home");
await humanDelay(3000, 5000);  // 3-5 seconds
```

## Screenshot Capture

Take numbered screenshots for test reports:

```typescript
let stepNum = 0;

const takeScreenshot = async (name: string) => {
  stepNum++;
  const filename = `${String(stepNum).padStart(2, "0")}_${name}.png`;
  await page.screenshot({
    path: path.join(reportDir, filename),
    clip: { x: 0, y: 0, width: 1280, height: 900 }
  });
  console.log(`📸 ${filename}`);
};
```

## Extension Log Retrieval

Get logs from content script via event API:

```typescript
const getExtensionLogs = async (): Promise<any[]> => {
  try {
    const logs = await page.evaluate(async () => {
      return new Promise<string>((resolve) => {
        window.addEventListener('__ext_logs_response__', (e: CustomEvent) => {
          resolve(e.detail);
        }, { once: true });

        window.dispatchEvent(new Event('__ext_get_logs__'));
        setTimeout(() => resolve('[]'), 2000);
      });
    });
    return JSON.parse(logs);
  } catch {
    return [];
  }
};
```

## HTML Capture

### Full page HTML
```typescript
const html = await page.content();
fs.writeFileSync(path.join(reportDir, 'full-page.html'), html);
```

### HTML context around elements
```typescript
const saveHtmlContext = async (selector: string) => {
  const html = await page.evaluate((sel) => {
    const elements = document.querySelectorAll(sel);
    return Array.from(elements).slice(0, 10).map((el, i) => {
      // Walk up 5 parent levels
      let parent: Element | null = el;
      for (let j = 0; j < 5 && parent?.parentElement; j++) {
        parent = parent.parentElement;
      }
      return `<!-- Element ${i} -->\n${parent?.outerHTML || ''}`;
    }).join('\n\n<hr>\n\n');
  }, selector);

  fs.writeFileSync(
    path.join(reportDir, 'element-contexts.html'),
    `<!DOCTYPE html><html><body>${html}</body></html>`
  );
};
```

## DOM Analysis

Get information about injected elements:

```typescript
const analyzeElements = async (selector: string) => {
  return page.evaluate((sel) => {
    const elements = document.querySelectorAll(sel);
    return Array.from(elements).map((el, i) => ({
      index: i,
      tag: el.tagName,
      classes: el.className,
      rect: el.getBoundingClientRect(),
      parentTag: el.parentElement?.tagName,
      siblingCount: el.parentElement?.children.length,
      attributes: Object.fromEntries(
        Array.from(el.attributes).map(a => [a.name, a.value])
      )
    }));
  }, selector);
};
```

## Comprehensive Selector Analysis

When debugging why injected elements aren't appearing or have wrong styling, use detailed selector analysis:

```typescript
const analyzeSelectors = async (selector: string) => {
  const analysis = await page.evaluate((sel) => {
    const results: any = {
      totalElements: document.querySelectorAll(sel).length,
      processedElements: document.querySelectorAll("[data-ext-processed]").length,
      elementContexts: [] as any[],
    };

    // Get context for first 5 elements
    document.querySelectorAll(sel).forEach((el, i) => {
      if (i >= 5) return;
      const htmlEl = el as HTMLElement;
      const parent = el.parentElement;
      const grandparent = parent?.parentElement;

      results.elementContexts.push({
        index: i,
        tag: el.tagName,
        classes: el.className,
        attributes: Object.fromEntries(
          Array.from(el.attributes).slice(0, 5).map((a) => [a.name, a.value.slice(0, 50)])
        ),
        parentTag: parent?.tagName,
        parentClass: parent?.className?.slice(0, 50),
        grandparentTag: grandparent?.tagName,
        siblingCount: parent?.children.length,
        rect: {
          x: Math.round(htmlEl.getBoundingClientRect().x),
          y: Math.round(htmlEl.getBoundingClientRect().y),
          width: Math.round(htmlEl.getBoundingClientRect().width),
          height: Math.round(htmlEl.getBoundingClientRect().height),
        },
      });
    });

    return results;
  }, selector);

  console.log("\n📊 Selector Analysis:");
  console.log(`   Total elements: ${analysis.totalElements}`);
  console.log(`   Processed elements: ${analysis.processedElements}`);

  analysis.elementContexts.forEach((ctx: any) => {
    console.log(`   [${ctx.index}] <${ctx.tag}> class="${ctx.classes?.slice(0, 30)}"`);
    console.log(`       parent: <${ctx.parentTag}> siblings: ${ctx.siblingCount}`);
    console.log(`       rect: (${ctx.rect.x}, ${ctx.rect.y}) ${ctx.rect.width}x${ctx.rect.height}`);
  });

  return analysis;
};
```

This is useful when:
- Extension elements appear but in wrong positions
- Some elements are injected but others are missed
- Debugging CSS/layout issues with injected elements

## Element Interaction

Click elements directly via DOM (avoids Playwright's click which can trigger detection):

```typescript
const clicked = await page.evaluate((sel) => {
  const el = document.querySelector(sel) as HTMLElement;
  if (el) {
    el.click();
    return true;
  }
  return false;
}, '.my-button');
```

## Scroll Testing

Test dynamic content loading:

```typescript
for (let i = 1; i <= 3; i++) {
  await page.evaluate(() => window.scrollBy(0, 400));
  await humanDelay(1500, 2500);
  await takeScreenshot(`scroll-${i}`);

  const currentCount = await page.evaluate((sel) => {
    return document.querySelectorAll(sel).length;
  }, '.my-element');
  console.log(`Scroll ${i}: ${currentCount} elements`);
}
```

## Extension State Check

Check DOM for extension state:

```typescript
const extensionState = await page.evaluate(() => {
  return {
    buttonsInjected: document.querySelectorAll('.ext-button').length,
    modalExists: !!document.querySelector('.ext-modal'),
    modalOpen: document.querySelector('.ext-modal')?.classList.contains('open'),
  };
});
```

## Report Generation

Save comprehensive logs:

```typescript
const saveLogs = async () => {
  const extLogs = await getExtensionLogs();
  const extState = await page.evaluate(() => ({
    // your extension state checks
  }));

  const formatLog = (l: any) =>
    `[${new Date(l.t).toISOString()}] [${l.s}:${l.l.toUpperCase()}] ${l.m}`;

  const content = `# Test Logs

## Extension Logs
${extLogs.map(formatLog).join('\n') || '_No logs_'}

## Page Console
${consoleLogs.map(l => `[${l.time}] [${l.type}] ${l.text}`).join('\n') || '_No logs_'}

## Extension State
${JSON.stringify(extState, null, 2)}
`;

  fs.writeFileSync(path.join(reportDir, 'console-logs.md'), content);
};
```

## Chrome Path Detection

Find Chrome for Testing across platforms:

```typescript
function findChrome(): string {
  // Check env var first
  if (process.env.CHROME_FOR_TESTING_PATH) {
    const envPath = path.resolve(process.env.CHROME_FOR_TESTING_PATH);
    if (fs.existsSync(envPath)) return envPath;
  }

  const chromeDir = path.resolve(__dirname, '../chrome');
  if (fs.existsSync(chromeDir)) {
    for (const version of fs.readdirSync(chromeDir)) {
      // Windows
      const winPath = path.join(chromeDir, version, 'chrome-win64', 'chrome.exe');
      if (fs.existsSync(winPath)) return winPath;
      // Linux
      const linuxPath = path.join(chromeDir, version, 'chrome-linux64', 'chrome');
      if (fs.existsSync(linuxPath)) return linuxPath;
      // macOS Intel
      const macX64Path = path.join(chromeDir, version, 'chrome-mac-x64',
        'Google Chrome for Testing.app', 'Contents', 'MacOS',
        'Google Chrome for Testing');
      if (fs.existsSync(macX64Path)) return macX64Path;
      // macOS Apple Silicon (M1/M2/M3)
      const macArmPath = path.join(chromeDir, version, 'chrome-mac-arm64',
        'Google Chrome for Testing.app', 'Contents', 'MacOS',
        'Google Chrome for Testing');
      if (fs.existsSync(macArmPath)) return macArmPath;
    }
  }
  throw new Error('Chrome for Testing not found. Run: npm run install-chrome');
}
```
