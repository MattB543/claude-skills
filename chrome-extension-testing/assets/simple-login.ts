/**
 * Simple Manual Login Helper
 *
 * Opens a browser window where you can log in manually to sites with bot detection.
 * The session is saved to .test-profile/ and persists for future tests.
 *
 * This script uses pure rebrowser-playwright (no AI/Stagehand required).
 *
 * Usage:
 *   npm run login
 *
 * After logging in:
 *   1. Press Enter in this terminal
 *   2. Your session is saved
 *   3. Run your tests: npm run test:stealth
 *
 * Customize:
 *   - Change TARGET_URL to your site's login page
 *   - Adjust extensionPath if your extension is elsewhere
 */

import { chromium } from "rebrowser-playwright";
import path from "path";
import fs from "fs";
import "dotenv/config";

// ============================================================
// Configuration - CUSTOMIZE THESE
// ============================================================

const CONFIG = {
  // TODO: Set your target login URL
  targetUrl: "https://example.com/login",

  // Extension path (relative to this file's location in tests/)
  extensionPath: path.resolve(__dirname, ".."),

  // Profile path for persistent session
  profilePath: path.resolve(__dirname, "../.test-profile"),
};

// ============================================================
// Chrome Path Detection
// ============================================================

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
// Main
// ============================================================

async function main() {
  console.log("\n========================================");
  console.log("  MANUAL LOGIN HELPER");
  console.log("========================================\n");

  console.log("Instructions:");
  console.log("  1. A browser window will open");
  console.log("  2. Log in to your site manually");
  console.log("  3. Once logged in, press Enter in this terminal");
  console.log("  4. Your session will be saved\n");

  const chromePath = findChrome();

  console.log("Chrome:", chromePath);
  console.log("Extension:", CONFIG.extensionPath);
  console.log("Profile:", CONFIG.profilePath);
  console.log("\nLaunching browser...\n");

  const context = await chromium.launchPersistentContext(CONFIG.profilePath, {
    headless: false,
    executablePath: chromePath,
    args: [
      `--disable-extensions-except=${CONFIG.extensionPath}`,
      `--load-extension=${CONFIG.extensionPath}`,
      "--disable-blink-features=AutomationControlled",
      "--start-maximized",
    ],
    viewport: null, // Use full window size
  });

  const page = context.pages()[0] || (await context.newPage());
  await page.goto(CONFIG.targetUrl);

  console.log("Browser opened! Log in to your site...");
  console.log("Press ENTER here when done to save session.\n");

  // Wait for user to press enter
  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
  });

  console.log("\nSaving session and closing...");
  await context.close();

  console.log("\nDone! Your session is saved to .test-profile/");
  console.log("Run your tests: npm run test:stealth\n");
}

main().catch(console.error);
