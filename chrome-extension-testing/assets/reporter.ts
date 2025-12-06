/**
 * Test Reporter Module
 *
 * Handles test report generation with:
 * - Timestamped report directories
 * - Markdown report generation
 * - Screenshot capture
 * - Notes and error logging
 *
 * Usage:
 *   import { createReporter } from './reporter';
 *
 *   const reporter = createReporter('my-test-suite');
 *   await reporter.addScreenshot('initial', page);
 *   reporter.addNote('Test started');
 *   reporter.finalize();
 */

import path from "path";
import fs from "fs";
import type { Page } from "rebrowser-playwright";

// ============================================================
// Types
// ============================================================

export interface TestReporter {
  reportDir: string;
  markdownPath: string;
  stepCount: number;
  addStep: (name: string, description: string, page?: Page) => Promise<void>;
  addScreenshot: (name: string, page: Page, options?: ScreenshotOptions) => Promise<string>;
  addNote: (text: string) => void;
  addError: (error: string) => void;
  finalize: () => void;
}

export interface ScreenshotOptions {
  fullPage?: boolean;
  clip?: { x: number; y: number; width: number; height: number };
}

// ============================================================
// Reporter Factory
// ============================================================

/**
 * Create a test reporter for a test suite
 * @param suiteName - Name of the test suite (used in folder name)
 * @param reportsRoot - Optional custom reports root directory
 */
export function createReporter(suiteName: string, reportsRoot?: string): TestReporter {
  // Create timestamped folder
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const root = reportsRoot || path.resolve(__dirname, "..", "test-reports");
  const reportDir = path.resolve(root, `${timestamp}_${suiteName}`);

  fs.mkdirSync(reportDir, { recursive: true });

  const markdownPath = path.join(reportDir, "report.md");
  let stepCount = 0;
  let markdownContent = `# Test Report: ${suiteName}\n\n`;
  markdownContent += `**Date:** ${new Date().toLocaleString()}\n\n`;
  markdownContent += `---\n\n`;

  const writeMarkdown = () => {
    fs.writeFileSync(markdownPath, markdownContent);
  };

  return {
    reportDir,
    markdownPath,
    stepCount,

    async addStep(name: string, description: string, page?: Page) {
      stepCount++;
      markdownContent += `## Step ${stepCount}: ${name}\n\n`;
      markdownContent += `${description}\n\n`;

      if (page) {
        const screenshotPath = await this.addScreenshot(
          `step-${stepCount}-${name.toLowerCase().replace(/\s+/g, "-")}`,
          page
        );
        markdownContent += `![${name}](${path.basename(screenshotPath)})\n\n`;
      }

      writeMarkdown();
    },

    async addScreenshot(name: string, page: Page, options?: ScreenshotOptions) {
      const filename = `${String(++stepCount).padStart(2, "0")}_${name}.png`;
      const screenshotPath = path.join(reportDir, filename);

      // Default clip for reasonable screenshot size
      const defaultClip = {
        x: 0,
        y: 0,
        width: 1280,
        height: 900,
      };

      await page.screenshot({
        path: screenshotPath,
        fullPage: options?.fullPage ?? false,
        clip: options?.clip ?? defaultClip,
      });

      console.log(`  📸 ${filename}`);
      return screenshotPath;
    },

    addNote(text: string) {
      markdownContent += `> **Note:** ${text}\n\n`;
      writeMarkdown();
    },

    addError(error: string) {
      markdownContent += `> **ERROR:** ${error}\n\n`;
      writeMarkdown();
      console.error(`  ❌ Error: ${error}`);
    },

    finalize() {
      markdownContent += `---\n\n`;
      markdownContent += `**Test completed at:** ${new Date().toLocaleString()}\n`;
      writeMarkdown();
      console.log(`\n📋 Report saved to: ${reportDir}`);
    },
  };
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Get the most recent report directory
 * @param reportsRoot - Reports root directory
 */
export function getLatestReportDir(reportsRoot?: string): string | null {
  const root = reportsRoot || path.resolve(__dirname, "..", "test-reports");

  if (!fs.existsSync(root)) {
    return null;
  }

  const dirs = fs
    .readdirSync(root)
    .filter((d) => fs.statSync(path.join(root, d)).isDirectory())
    .sort()
    .reverse();

  return dirs.length > 0 ? path.join(root, dirs[0]) : null;
}

/**
 * List all PNG files in a report directory
 * @param reportDir - Report directory path
 */
export function listScreenshots(reportDir: string): string[] {
  if (!fs.existsSync(reportDir)) {
    return [];
  }

  return fs
    .readdirSync(reportDir)
    .filter((f) => f.endsWith(".png"))
    .sort();
}
