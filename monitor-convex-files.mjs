#!/usr/bin/env node
/**
 * Monitor what files Convex is touching that trigger rebuilds
 * Uses inotify-style monitoring via chokidar
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_PATH = path.join(__dirname, '.cursor', 'debug.log');
const CONVEX_DIR = path.join(__dirname, 'convex');

// Ensure log dir exists
fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });

function log(message, data = {}) {
  const entry =
    JSON.stringify({
      timestamp: new Date().toISOString(),
      message,
      ...data,
    }) + '\n';
  fs.appendFileSync(LOG_PATH, entry);
  console.log(entry.trim());
}

log('Starting Convex file monitor', { convexDir: CONVEX_DIR });

// Watch the convex directory recursively
const watcher = fs.watch(
  CONVEX_DIR,
  { recursive: true },
  (eventType, filename) => {
    if (!filename) return;

    const fullPath = path.join(CONVEX_DIR, filename);
    let stats = null;
    try {
      stats = fs.statSync(fullPath);
    } catch (err) {
      // File might have been deleted
    }

    log('File change detected', {
      eventType,
      filename,
      fullPath,
      exists: stats !== null,
      isFile: stats?.isFile(),
      isDirectory: stats?.isDirectory(),
      size: stats?.size,
      mtime: stats?.mtime,
    });
  }
);

console.log('Monitoring convex/ directory. Press Ctrl+C to stop.');
console.log(`Logs: ${LOG_PATH}`);

process.on('SIGINT', () => {
  watcher.close();
  log('Monitor stopped');
  process.exit(0);
});
