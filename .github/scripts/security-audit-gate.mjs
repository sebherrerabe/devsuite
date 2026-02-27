#!/usr/bin/env node

import fs from 'node:fs';

const [, , auditReportPath] = globalThis.process.argv;

if (!auditReportPath) {
  globalThis.console.error(
    'Usage: node .github/scripts/security-audit-gate.mjs <audit.json>'
  );
  globalThis.process.exit(2);
}

let reportRaw = '';
try {
  reportRaw = fs.readFileSync(auditReportPath, 'utf8');
} catch (error) {
  globalThis.console.error(`Failed to read audit report: ${auditReportPath}`);
  if (error instanceof Error) {
    globalThis.console.error(error.message);
  }
  globalThis.process.exit(2);
}

let report;
try {
  report = JSON.parse(reportRaw);
} catch (error) {
  globalThis.console.error(
    `Failed to parse audit report JSON: ${auditReportPath}`
  );
  if (error instanceof Error) {
    globalThis.console.error(error.message);
  }
  globalThis.process.exit(2);
}

const advisories = Object.values(report?.advisories ?? {});

/**
 * Scope-limited temporary exemptions:
 * - desktop native dependency chain (node-pre-gyp/active-win stack)
 * - root lint/tooling dependencies
 * - vite->rollup build tooling chain in web app
 */
const allowedPathPatterns = [
  /^apps\/desktop>/,
  /^\.(>|$)/,
  /^apps\/web>.*>vite>rollup$/,
];

function isSeverityBlocked(severity) {
  return severity === 'high' || severity === 'critical';
}

function isAllowedPath(pathValue) {
  const normalizedPath = pathValue.replace(/\s+/g, '');
  return allowedPathPatterns.some(pattern => pattern.test(normalizedPath));
}

const blocking = [];

for (const advisory of advisories) {
  if (!isSeverityBlocked(advisory.severity)) {
    continue;
  }

  const paths = new Set();
  for (const finding of advisory.findings ?? []) {
    for (const pathValue of finding.paths ?? []) {
      if (typeof pathValue === 'string' && pathValue.length > 0) {
        paths.add(pathValue);
      }
    }
  }

  const allPathsAllowed =
    paths.size > 0 && [...paths].every(pathValue => isAllowedPath(pathValue));
  if (!allPathsAllowed) {
    blocking.push({
      id: advisory.id,
      module: advisory.module_name,
      severity: advisory.severity,
      title: advisory.title,
      paths: [...paths],
      url: advisory.url,
    });
  }
}

if (blocking.length > 0) {
  globalThis.console.error('Blocking high/critical vulnerabilities found:');
  for (const item of blocking) {
    globalThis.console.error(
      `- [${item.severity}] ${item.module} (${item.id}): ${item.title}`
    );
    const samplePaths = item.paths.slice(0, 5);
    for (const samplePath of samplePaths) {
      globalThis.console.error(`  path: ${samplePath}`);
    }
    if (item.paths.length > samplePaths.length) {
      globalThis.console.error(
        `  ... ${item.paths.length - samplePaths.length} more paths`
      );
    }
    if (item.url) {
      globalThis.console.error(`  advisory: ${item.url}`);
    }
  }
  globalThis.process.exit(1);
}

const exemptCount = advisories.filter(advisory => {
  if (!isSeverityBlocked(advisory.severity)) {
    return false;
  }
  const paths = new Set();
  for (const finding of advisory.findings ?? []) {
    for (const pathValue of finding.paths ?? []) {
      if (typeof pathValue === 'string' && pathValue.length > 0) {
        paths.add(pathValue);
      }
    }
  }
  return (
    paths.size > 0 && [...paths].every(pathValue => isAllowedPath(pathValue))
  );
}).length;

globalThis.console.log(
  `Audit gate passed: no blocking high/critical vulnerabilities (${exemptCount} exempted advisory entries).`
);
