/**
 * Chrome Extension - Shared Debug Logger
 *
 * Captures console logs from all extension scripts (content, background, popup)
 * and stores them in chrome.storage.local for retrieval during automated testing.
 *
 * Usage:
 *   extLog('content', 'log', 'Message here', someData);
 *   extLog('background', 'error', 'Something went wrong', error);
 *   extLog('popup', 'info', 'Notes loaded:', count);
 *
 * IMPORTANT: Customize LOG_KEY to be unique to your extension to avoid conflicts.
 */

(function() {
  'use strict';

  // CUSTOMIZE: Change this key to be unique to your extension
  const LOG_KEY = '__ext_debug_logs__';
  const MAX_LOGS = 1000;

  // Queue for batching writes to storage
  let logQueue = [];
  let flushTimeout = null;
  let isFlushing = false;

  /**
   * Log a message to both console and chrome.storage
   * @param {string} source - 'content' | 'background' | 'popup'
   * @param {string} level - 'log' | 'error' | 'warn' | 'info'
   * @param {...any} args - Arguments to log
   */
  function extLog(source, level, ...args) {
    // Always log to console immediately (for manual debugging)
    const consoleFn = console[level] || console.log;
    consoleFn.apply(console, [`[EXT:${source}]`, ...args]);

    // Format arguments for storage
    const message = args.map(arg => {
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    // Queue the log entry
    logQueue.push({
      t: Date.now(),
      s: source,
      l: level,
      m: message
    });

    // Debounce flush to batch writes (100ms)
    if (!flushTimeout) {
      flushTimeout = setTimeout(flushLogs, 100);
    }
  }

  /**
   * Flush queued logs to chrome.storage.local
   */
  async function flushLogs() {
    flushTimeout = null;

    if (logQueue.length === 0 || isFlushing) return;

    isFlushing = true;
    const toFlush = logQueue;
    logQueue = [];

    try {
      const result = await chrome.storage.local.get(LOG_KEY);
      const existing = result[LOG_KEY] || [];
      const combined = [...existing, ...toFlush];

      // Keep only last MAX_LOGS entries to prevent bloat
      const trimmed = combined.length > MAX_LOGS
        ? combined.slice(-MAX_LOGS)
        : combined;

      await chrome.storage.local.set({ [LOG_KEY]: trimmed });
    } catch (e) {
      // If storage fails, at least we logged to console
      console.error('[EXT:logger] Failed to flush logs to storage:', e);
    } finally {
      isFlushing = false;

      // If more logs queued during flush, schedule another flush
      if (logQueue.length > 0 && !flushTimeout) {
        flushTimeout = setTimeout(flushLogs, 100);
      }
    }
  }

  /**
   * Get all stored logs
   * @returns {Promise<Array>} Array of log entries
   */
  async function extGetLogs() {
    // Flush any pending logs first
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    if (logQueue.length > 0) {
      await flushLogs();
    }

    try {
      const result = await chrome.storage.local.get(LOG_KEY);
      return result[LOG_KEY] || [];
    } catch (e) {
      console.error('[EXT:logger] Failed to get logs:', e);
      return [];
    }
  }

  /**
   * Clear all stored logs
   */
  async function extClearLogs() {
    logQueue = [];
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }

    try {
      await chrome.storage.local.remove(LOG_KEY);
    } catch (e) {
      console.error('[EXT:logger] Failed to clear logs:', e);
    }
  }

  // ============================================================
  // Event-based API for test retrieval
  // (Content scripts run in isolated world, so we use events
  // to communicate with the main world where Playwright runs)
  // ============================================================

  // CUSTOMIZE: Change event names to be unique to your extension
  const GET_LOGS_EVENT = '__ext_get_logs__';
  const LOGS_RESPONSE_EVENT = '__ext_logs_response__';
  const CLEAR_LOGS_EVENT = '__ext_clear_logs__';
  const CLEAR_DONE_EVENT = '__ext_clear_logs_done__';

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    // Content script context - set up event listeners for test communication

    window.addEventListener(GET_LOGS_EVENT, async () => {
      const logs = await extGetLogs();
      window.dispatchEvent(new CustomEvent(LOGS_RESPONSE_EVENT, {
        detail: JSON.stringify(logs) // Stringify to safely pass through
      }));
    });

    window.addEventListener(CLEAR_LOGS_EVENT, async () => {
      await extClearLogs();
      window.dispatchEvent(new Event(CLEAR_DONE_EVENT));
    });
  }

  // ============================================================
  // Expose globally
  // ============================================================

  // For content scripts and popup (window context)
  if (typeof window !== 'undefined') {
    window.extLog = extLog;
    window.extGetLogs = extGetLogs;
    window.extClearLogs = extClearLogs;
  }

  // For service worker (self context)
  if (typeof self !== 'undefined' && typeof window === 'undefined') {
    self.extLog = extLog;
    self.extGetLogs = extGetLogs;
    self.extClearLogs = extClearLogs;
  }

  // Also expose on globalThis for universal access
  if (typeof globalThis !== 'undefined') {
    globalThis.extLog = extLog;
    globalThis.extGetLogs = extGetLogs;
    globalThis.extClearLogs = extClearLogs;
  }

})();
