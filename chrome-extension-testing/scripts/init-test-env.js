#!/usr/bin/env node
/**
 * Initialize Chrome Extension Testing Environment
 *
 * Creates project structure for testing a Chrome extension with:
 * - rebrowser-playwright for stealth automation
 * - Cross-script logging
 * - Screenshot and HTML capture
 *
 * Usage:
 *   node init-test-env.js [target-directory]
 *
 * If no directory specified, uses current directory.
 */

const fs = require('fs');
const path = require('path');

const targetDir = process.argv[2] || '.';

// Files to create
const files = {
  'package.json': `{
  "name": "extension-tests",
  "version": "1.0.0",
  "scripts": {
    "test": "ts-node tests/main.test.ts",
    "test:stealth": "ts-node tests/stealth.test.ts",
    "install-chrome": "npx @puppeteer/browsers install chrome@stable"
  },
  "dependencies": {
    "dotenv": "^17.0.0",
    "rebrowser-playwright": "^1.52.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.9.0"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "sharp": "^0.34.0"
  }
}`,

  'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020", "DOM"],
    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": ".",
    "resolveJsonModule": true,
    "sourceMap": true
  },
  "include": ["tests/**/*"],
  "exclude": ["node_modules", "dist", "chrome"]
}`,

  '.env.example': `# Path to Chrome for Testing executable
# Auto-detected after running: npm run install-chrome
# Windows example:
CHROME_FOR_TESTING_PATH=./chrome/win64-stable/chrome-win64/chrome.exe
# Linux example:
# CHROME_FOR_TESTING_PATH=./chrome/linux-stable/chrome-linux64/chrome
# macOS Intel example:
# CHROME_FOR_TESTING_PATH=./chrome/mac-stable/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing
# macOS Apple Silicon (M1/M2/M3) example:
# CHROME_FOR_TESTING_PATH=./chrome/mac-stable/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing
`,

  '.gitignore': `node_modules/
dist/
.test-profile/
test-reports/
chrome/
.env
*.log
`,

  'tests/stealth.test.ts': `/**
 * Extension Test - Stealth Mode
 * Uses rebrowser-playwright to bypass bot detection
 *
 * POST-TEST REQUIREMENTS:
 * After running this test, the agent MUST:
 * 1. View ALL screenshots in the test-reports folder
 * 2. Read console-logs.md to verify logs look correct
 * 3. Only grep full-page.html if debugging DOM issues
 */

import { chromium } from "rebrowser-playwright";
import path from "path";
import fs from "fs";
import "dotenv/config";

// Human-like delay helper
const humanDelay = (min: number, max: number) =>
  new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

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
      const macX64Path = path.join(chromeDir, version, "chrome-mac-x64",
        "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing");
      if (fs.existsSync(macX64Path)) return macX64Path;
      // macOS Apple Silicon (M1/M2/M3)
      const macArmPath = path.join(chromeDir, version, "chrome-mac-arm64",
        "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing");
      if (fs.existsSync(macArmPath)) return macArmPath;
    }
  }
  throw new Error("Chrome for Testing not found. Run: npm run install-chrome");
}

async function main() {
  console.log("\\n=== Extension Stealth Test ===\\n");

  const chromePath = findChrome();
  const extensionPath = path.resolve(__dirname, ".."); // Adjust to your extension location
  const profilePath = path.resolve(__dirname, "../.test-profile");

  // Ensure test-reports root folder exists
  const testReportsRoot = path.resolve(__dirname, "../test-reports");
  if (!fs.existsSync(testReportsRoot)) {
    fs.mkdirSync(testReportsRoot, { recursive: true });
    console.log("Created test-reports/ directory");
  }

  // Create timestamped report directory for this test run
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const reportDir = path.resolve(testReportsRoot, \`\${timestamp}_stealth-test\`);
  fs.mkdirSync(reportDir, { recursive: true });

  console.log("Chrome:", chromePath);
  console.log("Extension:", extensionPath);
  console.log("Report:", reportDir);

  const context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    executablePath: chromePath,
    args: [
      \`--disable-extensions-except=\${extensionPath}\`,
      \`--load-extension=\${extensionPath}\`,
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
    ],
    viewport: { width: 1280, height: 900 },
  });

  const page = context.pages()[0] || await context.newPage();
  let stepNum = 0;

  const screenshot = async (name: string) => {
    stepNum++;
    const filename = \`\${String(stepNum).padStart(2, "0")}_\${name}.png\`;
    await page.screenshot({ path: path.join(reportDir, filename) });
    console.log(\`Screenshot: \${filename}\`);
  };

  // Helper to get extension logs via event API
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

  try {
    // Step 1: Navigate
    console.log("\\n[Step 1] Navigating...");
    await page.goto("https://example.com"); // Change to your target URL
    await humanDelay(3000, 5000);
    await screenshot("initial");

    // Step 2: Check for injected elements
    console.log("\\n[Step 2] Checking for extension elements...");
    const elementCount = await page.evaluate(() => {
      // Adjust selector for your extension
      return document.querySelectorAll(".my-extension-element").length;
    });
    console.log(\`Found \${elementCount} extension elements\`);
    await screenshot("elements");

    // Step 3: Get logs
    console.log("\\n[Step 3] Retrieving extension logs...");
    const logs = await getExtensionLogs();
    console.log(\`Retrieved \${logs.length} log entries\`);

    // Save logs
    const logsContent = logs.map(l =>
      \`[\${new Date(l.t).toISOString()}] [\${l.s}:\${l.l.toUpperCase()}] \${l.m}\`
    ).join("\\n");
    fs.writeFileSync(path.join(reportDir, "console-logs.md"),
      \`# Extension Logs\\n\\n\${logsContent || "_No logs captured_"}\`);

    // Save HTML
    const html = await page.content();
    fs.writeFileSync(path.join(reportDir, "full-page.html"), html);

    console.log("\\n=== Test Complete ===");
    console.log(\`Reports saved to: \${reportDir}\`);
    console.log("");
    console.log("Saved artifacts:");
    console.log(\`  - Screenshots: \${stepNum} PNG files (REVIEW ALL)\`);
    console.log("  - Logs: console-logs.md (REVIEW)");
    console.log("  - HTML: full-page.html (grep if debugging)");
    console.log("");
    console.log("POST-TEST: View all screenshots and read logs to verify.");

  } finally {
    await context.close();
  }
}

main().catch(console.error);
`
};

// Create directories
const dirs = ['tests', 'test-reports'];

console.log(`Initializing extension test environment in: ${path.resolve(targetDir)}\n`);

for (const dir of dirs) {
  const fullPath = path.join(targetDir, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`Created: ${dir}/`);
  }
}

// Create files
for (const [filename, content] of Object.entries(files)) {
  const fullPath = path.join(targetDir, filename);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content);
  console.log(`Created: ${filename}`);
}

console.log(`
Setup complete! Next steps:

1. npm install
2. npm run install-chrome
3. Copy .env.example to .env
4. Copy logger.js to your extension's shared/ folder
5. Update manifest.json to include the logger
6. Edit tests/stealth.test.ts for your extension
7. npm run test:stealth
`);
