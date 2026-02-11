import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(srcDir, '..');
const workspaceRoot = path.resolve(appRoot, '../..');

// Load shared env first, then app-local overrides.
loadEnv({ path: path.join(workspaceRoot, '.env') });
loadEnv({ path: path.join(workspaceRoot, '.env.local') });
loadEnv({ path: path.join(appRoot, '.env') });
loadEnv({ path: path.join(appRoot, '.env.local') });
