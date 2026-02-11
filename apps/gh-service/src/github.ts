import { spawn } from 'node:child_process';
import { clearTimeout, setTimeout } from 'node:timers';
import type { GhRuntimeStatus } from './types.js';

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface CommandOptions {
  env?: Record<string, string | undefined>;
}

function runCommand(
  command: string,
  args: string[],
  timeoutMs: number,
  options?: CommandOptions
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: options?.env ? { ...process.env, ...options.env } : process.env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => {
      stdout += String(chunk);
    });

    child.stderr.on('data', chunk => {
      stderr += String(chunk);
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Command timed out: ${command} ${args.join(' ')}`));
    }, timeoutMs);

    child.once('error', error => {
      clearTimeout(timer);
      reject(error);
    });

    child.once('close', code => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

function parseAuthenticatedUser(output: string): string | null {
  const match = output.match(
    /Logged in to github\.com(?:\s+account)?\s+([^\s]+)/i
  );
  if (!match) {
    return null;
  }

  return match[1] ?? null;
}

export async function checkGhRuntimeStatus(): Promise<GhRuntimeStatus> {
  return checkGhRuntimeStatusForUser();
}

export interface GhRuntimeOptions {
  ghConfigDir?: string;
}

export interface GhTokenStatus {
  authenticated: boolean;
  githubUser: string | null;
  error: string | null;
  checkedAt: number;
}

function buildGhEnv(
  options?: GhRuntimeOptions
): Record<string, string | undefined> {
  return {
    GH_CONFIG_DIR: options?.ghConfigDir,
    GH_NO_UPDATE_NOTIFIER: '1',
    NO_COLOR: '1',
  };
}

function buildTokenEnv(token: string): Record<string, string | undefined> {
  return {
    GH_TOKEN: token,
    GH_HOST: 'github.com',
    GH_NO_UPDATE_NOTIFIER: '1',
    NO_COLOR: '1',
  };
}

export async function checkGhRuntimeStatusForUser(
  options?: GhRuntimeOptions
): Promise<GhRuntimeStatus> {
  const checkedAt = Date.now();
  const commandOptions: CommandOptions = {
    env: buildGhEnv(options),
  };

  try {
    const versionResult = await runCommand(
      'gh',
      ['--version'],
      10_000,
      commandOptions
    );

    if (versionResult.exitCode !== 0) {
      return {
        installed: false,
        version: null,
        authenticated: false,
        authenticatedUser: null,
        error:
          versionResult.stderr.trim() ||
          versionResult.stdout.trim() ||
          'gh command failed',
        checkedAt,
      };
    }

    const versionLine = versionResult.stdout.split('\n')[0]?.trim() ?? null;
    const authResult = await runCommand(
      'gh',
      ['auth', 'status', '--hostname', 'github.com'],
      10_000,
      commandOptions
    );

    const combinedOutput = `${authResult.stdout}\n${authResult.stderr}`;
    const authenticatedUser = parseAuthenticatedUser(combinedOutput);

    if (authResult.exitCode !== 0) {
      return {
        installed: true,
        version: versionLine,
        authenticated: false,
        authenticatedUser: null,
        error:
          authResult.stderr.trim() ||
          authResult.stdout.trim() ||
          'Not authenticated',
        checkedAt,
      };
    }

    return {
      installed: true,
      version: versionLine,
      authenticated: true,
      authenticatedUser,
      error: null,
      checkedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      installed: false,
      version: null,
      authenticated: false,
      authenticatedUser: null,
      error: message,
      checkedAt,
    };
  }
}

export async function extractTokenFromGhConfig(
  ghConfigDir: string
): Promise<string> {
  const result = await runCommand(
    'gh',
    ['auth', 'token', '--hostname', 'github.com'],
    10_000,
    { env: buildGhEnv({ ghConfigDir }) }
  );

  if (result.exitCode !== 0) {
    const error =
      result.stderr.trim() || result.stdout.trim() || 'Failed to extract token';
    throw new Error(error);
  }

  const token = result.stdout.trim();
  if (!token) {
    throw new Error('Token output is empty');
  }

  return token;
}

export async function checkTokenStatus(token: string): Promise<GhTokenStatus> {
  const checkedAt = Date.now();
  const result = await runCommand(
    'gh',
    ['api', 'user', '--jq', '.login'],
    10_000,
    {
      env: buildTokenEnv(token),
    }
  );

  if (result.exitCode !== 0) {
    return {
      authenticated: false,
      githubUser: null,
      error:
        result.stderr.trim() ||
        result.stdout.trim() ||
        'Token auth check failed',
      checkedAt,
    };
  }

  const githubUser = result.stdout.trim() || null;
  return {
    authenticated: Boolean(githubUser),
    githubUser,
    error: null,
    checkedAt,
  };
}
