import { performance } from 'node:perf_hooks';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const scriptDir = dirname(currentFile);
const processMonitorModulePath = join(
  scriptDir,
  '..',
  'dist',
  'process-monitor.js'
);

const {
  buildMonitoredEntries,
  diffProcessEntries,
  normalizeProcessWatchConfig,
  parseTasklistCsv,
} = await import(pathToFileURL(processMonitorModulePath).href);

const ITERATIONS = Number.parseInt(
  process.env.DEVSUITE_PROCESS_MONITOR_BENCH_ITERS ?? '40',
  10
);
const PROCESS_COUNT = Number.parseInt(
  process.env.DEVSUITE_PROCESS_MONITOR_BENCH_PROCESSES ?? '6000',
  10
);
const MAX_P95_MS = Number.parseFloat(
  process.env.DEVSUITE_PROCESS_MONITOR_P95_MS ?? '120'
);

const WATCHED_IDES = ['code.exe', 'cursor.exe', 'idea64.exe'];
const WATCHED_APPS = [
  'whatsapp.exe',
  'telegram.exe',
  'discord.exe',
  'chrome.exe',
];

function buildExecutablePool() {
  const pool = [...WATCHED_IDES, ...WATCHED_APPS];
  for (let index = 0; index < 250; index += 1) {
    pool.push(`background-${index}.exe`);
  }
  return pool;
}

function createSyntheticTasklistCsv(params) {
  const { processCount, executablePool, pidOffset, variantSeed } = params;
  const lines = [];

  for (let index = 0; index < processCount; index += 1) {
    const poolIndex = (index * 13 + variantSeed * 17) % executablePool.length;
    const executable = executablePool[poolIndex];
    const pid = pidOffset + index;
    const memoryKb = 25_000 + ((index * 31 + variantSeed * 101) % 350_000);

    lines.push(
      `"${executable}","${pid}","Console","1","${memoryKb.toLocaleString('en-US')} K"`
    );
  }

  return lines.join('\n');
}

function percentile(values, fraction) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1)
  );
  return sorted[index];
}

function roundTo(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function assertPositiveInteger(value, fieldName) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
}

assertPositiveInteger(ITERATIONS, 'ITERATIONS');
assertPositiveInteger(PROCESS_COUNT, 'PROCESS_COUNT');
if (!Number.isFinite(MAX_P95_MS) || MAX_P95_MS <= 0) {
  throw new Error('MAX_P95_MS must be a positive number.');
}

const executablePool = buildExecutablePool();
const csvA = createSyntheticTasklistCsv({
  processCount: PROCESS_COUNT,
  executablePool,
  pidOffset: 10_000,
  variantSeed: 1,
});
const csvB = createSyntheticTasklistCsv({
  processCount: PROCESS_COUNT,
  executablePool,
  pidOffset: 11_000,
  variantSeed: 2,
});

const config = normalizeProcessWatchConfig({
  ideExecutables: WATCHED_IDES,
  appExecutables: WATCHED_APPS,
});

let previousEntries = buildMonitoredEntries(parseTasklistCsv(csvA), config);
const durationsMs = [];
const eventCounts = [];

for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
  const currentCsv = iteration % 2 === 0 ? csvB : csvA;
  const startAt = performance.now();

  const parsed = parseTasklistCsv(currentCsv);
  const nextEntries = buildMonitoredEntries(parsed, config);
  const events = diffProcessEntries(previousEntries, nextEntries, Date.now());

  const elapsedMs = performance.now() - startAt;
  durationsMs.push(elapsedMs);
  eventCounts.push(events.length);
  previousEntries = nextEntries;
}

const averageMs =
  durationsMs.reduce((sum, value) => sum + value, 0) / durationsMs.length;
const p95Ms = percentile(durationsMs, 0.95);
const p99Ms = percentile(durationsMs, 0.99);

const summary = {
  iterations: ITERATIONS,
  processCount: PROCESS_COUNT,
  watchedExecutables: WATCHED_IDES.length + WATCHED_APPS.length,
  averageMs: roundTo(averageMs),
  p95Ms: roundTo(p95Ms),
  p99Ms: roundTo(p99Ms),
  maxP95Ms: MAX_P95_MS,
  maxEventsObserved: Math.max(...eventCounts),
};

console.log(
  '[desktop:process-overhead] summary',
  JSON.stringify(summary, null, 2)
);

if (p95Ms > MAX_P95_MS) {
  console.error(
    `[desktop:process-overhead] FAILED: p95 ${roundTo(p95Ms)}ms exceeds threshold ${MAX_P95_MS}ms.`
  );
  process.exit(1);
}

console.log('[desktop:process-overhead] PASS');
