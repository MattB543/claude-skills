/**
 * Chrome Extension Test Template
 *
 * Complete test file with:
 * - Stealth browser automation (rebrowser-playwright)
 * - Extension log retrieval
 * - Screenshot capture
 * - HTML analysis
 * - Human-like delays
 *
 * Customize the TODOs for your extension.
 */

import { chromium } from "rebrowser-playwright";
import path from "path";
import fs from "fs";
import "dotenv/config";

// ============================================================
// Configuration - CUSTOMIZE THESE
// ============================================================

const CONFIG = {
  // TODO: Set your extension's root directory
  extensionPath: path.resolve(__dirname, ".."),

  // TODO: Set your target test URL
  targetUrl: "https://example.com",

  // TODO: Set selectors for your injected elements
  injectedElementSelector: ".my-extension-element",

  // Event names for log retrieval (must match logger.js)
  getLogsEvent: "__ext_get_logs__",
  logsResponseEvent: "__ext_logs_response__",
};

// ============================================================
// Helpers
// ============================================================

const humanDelay = (min: number, max: number) =>
  new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));

function findChrome(): string {
  if (process.env.CHROME_FOR_TESTING_PATH) {
    const envPath = path.resolve(process.env.CHROME_FOR_TESTING_PATH);
    if (fs.existsSync(envPath)) return envPath;
  }

  const chromeDir = path.resolve(__dirname, "../chrome");
  if (fs.existsSync(chromeDir)) {
    for (const version of fs.readdirSync(chromeDir)) {
      // Windows
      const winPath = path.join(chromeDir, version, "chrome-win64", "chrome.exe");
      if (fs.existsSync(winPath)) return winPath;
      // Linux
      const linuxPath = path.join(chromeDir, version, "chrome-linux64", "chrome");
      if (fs.existsSync(linuxPath)) return linuxPath;
      // macOS Intel
      const macX64Path = path.join(
        chromeDir,
        version,
        "chrome-mac-x64",
        "Google Chrome for Testing.app",
        "Contents",
        "MacOS",
        "Google Chrome for Testing"
      );
      if (fs.existsSync(macX64Path)) return macX64Path;
      // macOS Apple Silicon (M1/M2/M3)
      const macArmPath = path.join(
        chromeDir,
        version,
        "chrome-mac-arm64",
        "Google Chrome for Testing.app",
        "Contents",
        "MacOS",
        "Google Chrome for Testing"
      );
      if (fs.existsSync(macArmPath)) return macArmPath;
    }
  }
  throw new Error("Chrome for Testing not found. Run: npm run install-chrome");
}

// ============================================================
// Main Test
// ============================================================

async function main() {
  console.log("\n╔═══════════════════════════════════════════════════════╗");
  console.log("║           EXTENSION TEST (Stealth Mode)               ║");
  console.log("╚═══════════════════════════════════════════════════════╝\n");

  const chromePath = findChrome();
  const profilePath = path.resolve(__dirname, "../.test-profile");

  // Ensure test-reports root folder exists
  const testReportsRoot = path.resolve(__dirname, "../test-reports");
  if (!fs.existsSync(testReportsRoot)) {
    fs.mkdirSync(testReportsRoot, { recursive: true });
    console.log("Created test-reports/ directory");
  }

  // Create timestamped report directory for this test run
  // Structure: test-reports/{timestamp}_{test-name}/
  //   - Screenshots: 01_step.png, 02_step.png, etc.
  //   - Logs: console-logs.md (ALWAYS review after test)
  //   - HTML: full-page.html (grep only when debugging)
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const reportDir = path.resolve(testReportsRoot, `${timestamp}_test`);
  fs.mkdirSync(reportDir, { recursive: true });

  console.log("Chrome:", chromePath);
  console.log("Extension:", CONFIG.extensionPath);
  console.log("Profile:", profilePath);
  console.log("Report:", reportDir);
  console.log();

  // Launch browser with extension
  const context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    executablePath: chromePath,
    args: [
      `--disable-extensions-except=${CONFIG.extensionPath}`,
      `--load-extension=${CONFIG.extensionPath}`,
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--no-first-run",
      "--no-default-browser-check",
    ],
    viewport: { width: 1280, height: 900 },
  });

  const page = context.pages()[0] || (await context.newPage());
  let stepNum = 0;

  // Console log capture
  // IMPORTANT: Attach listeners BEFORE navigating to capture all logs
  const consoleLogs: { type: string; text: string; time: string }[] = [];
  const pageErrors: { message: string; time: string }[] = [];

  page.on("console", (msg) => {
    consoleLogs.push({
      type: msg.type(),
      text: msg.text(),
      time: new Date().toISOString(),
    });
  });

  page.on("pageerror", (error) => {
    pageErrors.push({
      message: error.message,
      time: new Date().toISOString(),
    });
  });

  // ============================================================
  // Helper Functions
  // ============================================================

  const takeScreenshot = async (name: string) => {
    stepNum++;
    const filename = `${String(stepNum).padStart(2, "0")}_${name}.png`;
    await page.screenshot({
      path: path.join(reportDir, filename),
      clip: { x: 0, y: 0, width: 1280, height: 900 },
    });
    console.log(`  📸 ${filename}`);
    return filename;
  };

  const getExtensionLogs = async (): Promise<any[]> => {
    try {
      const logs = await page.evaluate(
        async ({ getEvent, responseEvent }) => {
          return new Promise<string>((resolve) => {
            window.addEventListener(
              responseEvent,
              (e: CustomEvent) => resolve(e.detail),
              { once: true }
            );
            window.dispatchEvent(new Event(getEvent));
            setTimeout(() => resolve("[]"), 2000);
          });
        },
        { getEvent: CONFIG.getLogsEvent, responseEvent: CONFIG.logsResponseEvent }
      );
      return JSON.parse(logs);
    } catch {
      return [];
    }
  };

  const saveHtml = async (name: string) => {
    const html = await page.content();
    const filename = `${name}.html`;
    fs.writeFileSync(path.join(reportDir, filename), html);
    console.log(`  📄 ${filename} (${Math.round(html.length / 1024)}KB)`);
  };

  const saveHtmlContext = async (selector: string, name: string) => {
    const html = await page.evaluate((sel) => {
      const elements = document.querySelectorAll(sel);
      return Array.from(elements)
        .slice(0, 10)
        .map((el, i) => {
          let parent: Element | null = el;
          for (let j = 0; j < 5 && parent?.parentElement; j++) {
            parent = parent.parentElement;
          }
          return `<!-- Element ${i} -->\n${parent?.outerHTML || ""}`;
        })
        .join("\n\n<hr>\n\n");
    }, selector);

    const filename = `${name}.html`;
    fs.writeFileSync(
      path.join(reportDir, filename),
      `<!DOCTYPE html><html><body>${html}</body></html>`
    );
    console.log(`  📄 ${filename}`);
  };

  // Analyze injected elements - useful for debugging selector issues
  const analyzeSelectors = async () => {
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
    }, CONFIG.injectedElementSelector);

    console.log("\n  📊 Selector Analysis:");
    console.log(`     Total elements: ${analysis.totalElements}`);
    console.log(`     Processed elements: ${analysis.processedElements}`);

    if (analysis.elementContexts.length > 0) {
      console.log("\n  📍 First 5 element contexts:");
      analysis.elementContexts.forEach((ctx: any) => {
        console.log(`     [${ctx.index}] <${ctx.tag}> class="${ctx.classes?.slice(0, 30)}"`);
        console.log(`         parent: <${ctx.parentTag}> siblings: ${ctx.siblingCount}`);
        console.log(`         rect: (${ctx.rect.x}, ${ctx.rect.y}) ${ctx.rect.width}x${ctx.rect.height}`);
      });
    }

    return analysis;
  };

  const saveLogs = async () => {
    const extLogs = await getExtensionLogs();

    const formatLog = (l: any) =>
      `[${new Date(l.t).toISOString()}] [${l.s}:${l.l.toUpperCase()}] ${l.m}`;

    const content = `# Extension Logs

## Extension Logs (from chrome.storage)
${extLogs.length === 0 ? "_No extension logs captured_" : extLogs.map(formatLog).join("\n")}

## Page Console
${consoleLogs.length === 0 ? "_No page console logs_" : consoleLogs.map((l) => `[${l.time}] [${l.type.toUpperCase()}] ${l.text}`).join("\n")}

## Page Errors
${pageErrors.length === 0 ? "_No page errors_" : pageErrors.map((e) => `[${e.time}] ${e.message}`).join("\n")}
`;

    fs.writeFileSync(path.join(reportDir, "console-logs.md"), content);
    console.log(`  📋 console-logs.md (${extLogs.length} extension logs, ${pageErrors.length} errors)`);
  };

  // ============================================================
  // Test Steps
  // ============================================================

  try {
    // Step 1: Navigate
    console.log("\n📝 Step 1: Navigate to target page");
    await page.goto(CONFIG.targetUrl);
    await humanDelay(3000, 5000);
    await takeScreenshot("initial");

    // Step 2: Check for injected elements
    console.log("\n📝 Step 2: Check for extension elements");
    const elementCount = await page.evaluate((sel) => {
      return document.querySelectorAll(sel).length;
    }, CONFIG.injectedElementSelector);

    console.log(`  Found ${elementCount} extension elements`);

    if (elementCount > 0) {
      await takeScreenshot("elements-found");
      await saveHtmlContext(CONFIG.injectedElementSelector, "element-contexts");
      // Run selector analysis for debugging (optional - remove if not needed)
      await analyzeSelectors();
    }

    // Step 3: Interact with extension (TODO: customize)
    console.log("\n📝 Step 3: Test extension interaction");
    // Example: Click first element
    const clicked = await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement;
      if (el) {
        el.click();
        return true;
      }
      return false;
    }, CONFIG.injectedElementSelector);

    if (clicked) {
      await humanDelay(500, 1000);
      await takeScreenshot("after-interaction");
    }

    // Step 4: Scroll and check dynamic content
    console.log("\n📝 Step 4: Test scrolling behavior");
    for (let i = 1; i <= 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 400));
      await humanDelay(1500, 2500);
      await takeScreenshot(`scroll-${i}`);
    }

    // Step 5: Save full HTML
    console.log("\n📝 Step 5: Save HTML for analysis");
    await saveHtml("full-page");

    // Step 6: Save logs
    console.log("\n📝 Step 6: Collect logs");
    await saveLogs();

    // Summary - List all saved artifacts for post-test verification
    console.log("\n╔═══════════════════════════════════════════════════════╗");
    console.log("║  TEST COMPLETED                                       ║");
    console.log("╚═══════════════════════════════════════════════════════╝\n");
    console.log(`Reports saved to: ${reportDir}`);
    console.log("");
    console.log("Saved artifacts:");
    console.log(`  - Screenshots: ${stepNum} PNG files (REVIEW ALL)`);
    console.log("  - Logs: console-logs.md (REVIEW)");
    console.log("  - HTML: full-page.html (grep if debugging)");
    console.log("");
    console.log("POST-TEST: Agent must view all screenshots and read logs to verify test success.\n");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    await takeScreenshot("error");
    await saveLogs();
    throw error;
  } finally {
    await context.close();
  }
}

main().catch(console.error);
