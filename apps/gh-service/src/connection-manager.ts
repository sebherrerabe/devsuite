import { mkdir, rm } from 'node:fs/promises';
import { ConnectionStore, type StoredConnection } from './connection-store.js';
import { checkTokenStatus } from './github.js';
import { pollDeviceFlow, startDeviceFlow } from './github-device-flow.js';
import type { ConnectionStatusResponse } from './types.js';
import type { Logger } from './logger.js';
import { TokenCipher } from './token-cipher.js';
import {
  classifyGithubAuthFailure,
  maskDeviceCode,
  maskUserId,
  sanitizeLogMessage,
} from './logging-utils.js';

interface ConnectionManagerOptions {
  oauthClientId: string;
  oauthScopes: string[];
}

export class ConnectionManagerError extends Error {
  constructor(
    readonly code: 'NOT_CONNECTED' | 'LOGIN_PENDING' | 'TOKEN_INVALID',
    message: string
  ) {
    super(message);
  }
}

function userLogContext(userId: string): Record<string, unknown> {
  return {
    user: maskUserId(userId),
  };
}

function summarizeConnection(
  record: StoredConnection
): Record<string, unknown> {
  return {
    state: record.state,
    hasEncryptedToken: Boolean(record.encryptedToken),
    githubUser: record.githubUser,
    hasLastError: Boolean(record.lastError),
    hasDeviceFlow: Boolean(record.deviceFlow),
    checkedAt: record.updatedAt,
  };
}

function buildLoginErrorMessage(code: string, message: string): string {
  if (code === 'access_denied') {
    return 'GitHub login was denied. Start login again and approve access.';
  }

  if (code === 'expired_token') {
    return 'GitHub device code expired. Start login again.';
  }

  if (code === 'slow_down') {
    return 'GitHub requested a slower polling interval. Continue waiting and do not restart login.';
  }

  if (code === 'authorization_pending') {
    return 'GitHub authorization is still pending. Complete the browser flow and wait.';
  }

  return message;
}

export class ConnectionManager {
  private readonly store: ConnectionStore;

  constructor(
    dataDir: string,
    private readonly tokenCipher: TokenCipher,
    private readonly logger: Logger,
    private readonly options: ConnectionManagerOptions
  ) {
    this.store = new ConnectionStore(dataDir);
  }

  async initialize(): Promise<void> {
    await this.store.initialize();
    this.logger.info('gh connection store initialized');
  }

  async startLogin(userId: string): Promise<ConnectionStatusResponse> {
    this.logger.info('gh login requested', userLogContext(userId));
    const current = await this.ensureRecord(userId);

    const pending = this.getReusablePendingRecord(current);
    if (pending) {
      this.logger.info('gh login already pending', {
        ...userLogContext(userId),
        ...summarizeConnection(pending),
      });
      return this.toResponse(pending);
    }

    const encryptedStatus = await this.refreshFromEncryptedToken(current);
    if (encryptedStatus && encryptedStatus.state === 'connected') {
      this.logger.info('gh login skipped because user is already connected', {
        ...userLogContext(userId),
        githubUser: encryptedStatus.githubUser,
      });
      return this.toResponse(encryptedStatus);
    }

    let started;
    try {
      started = await startDeviceFlow({
        clientId: this.options.oauthClientId,
        scopes: this.options.oauthScopes,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to start GitHub login flow';
      const failureCategory = classifyGithubAuthFailure(message);
      this.logger.warn('gh device flow start failed', {
        ...userLogContext(userId),
        category: failureCategory,
        error: sanitizeLogMessage(message),
      });

      await this.store.upsert(userId, existing => {
        const now = Date.now();
        const base = existing ?? current;
        return {
          ...base,
          state: 'error',
          encryptedToken: null,
          tokenVersion: null,
          githubUser: null,
          userCode: null,
          verificationUri: null,
          deviceFlow: null,
          lastError: message,
          updatedAt: now,
        };
      });

      throw new Error(message);
    }

    const pendingRecord = await this.store.upsert(userId, existing => {
      const now = Date.now();
      const base = existing ?? current;
      return {
        ...base,
        state: 'pending',
        encryptedToken: null,
        tokenVersion: null,
        githubUser: null,
        userCode: started.userCode,
        verificationUri: started.verificationUri,
        deviceFlow: {
          deviceCode: started.deviceCode,
          expiresAt: started.expiresAt,
          pollIntervalSeconds: started.pollIntervalSeconds,
          nextPollAt: started.nextPollAt,
        },
        lastError: null,
        updatedAt: now,
      };
    });

    this.logger.info('gh login pending device code emitted', {
      ...userLogContext(userId),
      state: pendingRecord.state,
      verificationUriHost: 'github.com',
      deviceCodeMasked: maskDeviceCode(pendingRecord.userCode),
      pollIntervalSeconds:
        pendingRecord.deviceFlow?.pollIntervalSeconds ?? null,
    });

    return this.toResponse(pendingRecord);
  }

  async getStatus(userId: string): Promise<ConnectionStatusResponse> {
    const current = await this.ensureRecord(userId);

    if (current.state === 'pending') {
      const pendingState = await this.advancePendingLogin(current);
      this.logger.debug('gh status served from pending state', {
        ...userLogContext(userId),
        ...summarizeConnection(pendingState),
      });
      return this.toResponse(pendingState);
    }

    const refreshed = await this.refreshFromEncryptedToken(current);
    if (refreshed) {
      if (
        refreshed.state !== current.state ||
        refreshed.githubUser !== current.githubUser
      ) {
        this.logger.info('gh status refreshed from stored encrypted token', {
          ...userLogContext(userId),
          previousState: current.state,
          nextState: refreshed.state,
          githubUser: refreshed.githubUser,
        });
      } else {
        this.logger.debug('gh status checked from stored encrypted token', {
          ...userLogContext(userId),
          state: refreshed.state,
        });
      }
      return this.toResponse(refreshed);
    }

    if (current.state === 'error') {
      this.logger.debug('gh status served from persisted error state', {
        ...userLogContext(userId),
        category: classifyGithubAuthFailure(current.lastError),
        error: current.lastError ? sanitizeLogMessage(current.lastError) : null,
      });
      return this.toResponse(current);
    }

    if (current.state === 'disconnected') {
      this.logger.debug(
        'gh status served from disconnected state',
        userLogContext(userId)
      );
      return this.toResponse(current);
    }

    const disconnected = await this.store.upsert(userId, existing => {
      const base = existing ?? current;
      return {
        ...base,
        state: 'disconnected',
        encryptedToken: null,
        tokenVersion: null,
        githubUser: null,
        userCode: null,
        verificationUri: null,
        deviceFlow: null,
        lastError: null,
        updatedAt: Date.now(),
      };
    });

    this.logger.warn('gh status normalized unknown state to disconnected', {
      ...userLogContext(userId),
      previousState: current.state,
    });
    return this.toResponse(disconnected);
  }

  async disconnect(userId: string): Promise<ConnectionStatusResponse> {
    const current = await this.ensureRecord(userId);
    this.logger.info('gh disconnect requested', {
      ...userLogContext(userId),
      previousState: current.state,
    });

    await rm(current.ghConfigDir, { recursive: true, force: true });
    const reset = await this.store.resetUser(userId);
    this.logger.info('gh disconnect completed', {
      ...userLogContext(userId),
      nextState: reset.state,
    });
    return this.toResponse(reset);
  }

  async listConnectedUsers(): Promise<string[]> {
    const records = await this.store.list();
    const connectedUsers = records
      .filter(
        record => record.state === 'connected' && Boolean(record.encryptedToken)
      )
      .map(record => record.userId);
    this.logger.debug('gh connected user snapshot collected', {
      connectedUsersCount: connectedUsers.length,
    });
    return connectedUsers;
  }

  async getAuthenticatedToken(
    userId: string
  ): Promise<{ token: string; githubUser: string | null }> {
    const current = await this.ensureRecord(userId);

    if (current.state === 'pending') {
      this.logger.warn(
        'gh authenticated token request denied because login is pending',
        {
          ...userLogContext(userId),
        }
      );
      throw new ConnectionManagerError(
        'LOGIN_PENDING',
        'GitHub login is currently pending completion for this user'
      );
    }

    const refreshed = await this.refreshFromEncryptedToken(current);
    if (
      !refreshed ||
      refreshed.state !== 'connected' ||
      !refreshed.encryptedToken
    ) {
      this.logger.warn(
        'gh authenticated token request denied because user is not connected',
        {
          ...userLogContext(userId),
          state: refreshed?.state ?? current.state,
        }
      );
      throw new ConnectionManagerError(
        'NOT_CONNECTED',
        'GitHub is not connected for this user'
      );
    }

    try {
      const token = this.tokenCipher.decrypt(refreshed.encryptedToken);
      this.logger.debug('gh authenticated token loaded for user', {
        ...userLogContext(userId),
        githubUser: refreshed.githubUser,
      });
      return {
        token,
        githubUser: refreshed.githubUser,
      };
    } catch {
      this.logger.warn(
        'gh encrypted token could not be decrypted during token request',
        {
          ...userLogContext(userId),
        }
      );
      throw new ConnectionManagerError(
        'TOKEN_INVALID',
        'Stored GitHub token is invalid. Reconnect is required.'
      );
    }
  }

  private getReusablePendingRecord(
    current: StoredConnection
  ): StoredConnection | null {
    if (current.state !== 'pending') {
      return null;
    }

    if (!current.deviceFlow || !current.userCode || !current.verificationUri) {
      return null;
    }

    if (current.deviceFlow.expiresAt <= Date.now()) {
      return null;
    }

    return current;
  }

  private async advancePendingLogin(
    current: StoredConnection
  ): Promise<StoredConnection> {
    const now = Date.now();

    if (!current.deviceFlow || !current.userCode || !current.verificationUri) {
      this.logger.warn('gh pending state is missing device flow metadata', {
        ...userLogContext(current.userId),
      });
      return this.store.upsert(current.userId, existing => {
        const base = existing ?? current;
        return {
          ...base,
          state: 'error',
          encryptedToken: null,
          tokenVersion: null,
          githubUser: null,
          userCode: null,
          verificationUri: null,
          deviceFlow: null,
          lastError: 'Login flow interrupted. Start login again.',
          updatedAt: Date.now(),
        };
      });
    }

    if (current.deviceFlow.expiresAt <= now) {
      this.logger.info('gh pending device flow expired', {
        ...userLogContext(current.userId),
      });
      return this.store.upsert(current.userId, existing => {
        const base = existing ?? current;
        return {
          ...base,
          state: 'error',
          encryptedToken: null,
          tokenVersion: null,
          githubUser: null,
          userCode: null,
          verificationUri: null,
          deviceFlow: null,
          lastError: 'GitHub login code expired. Start login again.',
          updatedAt: Date.now(),
        };
      });
    }

    if (now < current.deviceFlow.nextPollAt) {
      return current;
    }

    let pollResult;
    try {
      pollResult = await pollDeviceFlow({
        clientId: this.options.oauthClientId,
        deviceCode: current.deviceFlow.deviceCode,
        currentPollIntervalSeconds: current.deviceFlow.pollIntervalSeconds,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to check GitHub login status';
      this.logger.warn('gh pending poll request failed', {
        ...userLogContext(current.userId),
        error: sanitizeLogMessage(message),
      });

      return this.store.upsert(current.userId, existing => {
        const base = existing ?? current;
        const pollIntervalSeconds = Math.max(
          5,
          base.deviceFlow?.pollIntervalSeconds ?? 5
        );
        return {
          ...base,
          state: 'pending',
          deviceFlow: base.deviceFlow
            ? {
                ...base.deviceFlow,
                pollIntervalSeconds,
                nextPollAt: Date.now() + pollIntervalSeconds * 1000,
              }
            : null,
          updatedAt: Date.now(),
        };
      });
    }

    if (pollResult.status === 'pending') {
      return this.store.upsert(current.userId, existing => {
        const base = existing ?? current;
        return {
          ...base,
          state: 'pending',
          deviceFlow: base.deviceFlow
            ? {
                ...base.deviceFlow,
                pollIntervalSeconds: pollResult.pollIntervalSeconds,
                nextPollAt: pollResult.nextPollAt,
              }
            : null,
          lastError: null,
          updatedAt: Date.now(),
        };
      });
    }

    if (pollResult.status === 'slow_down') {
      this.logger.info('gh device flow requested slow down', {
        ...userLogContext(current.userId),
        pollIntervalSeconds: pollResult.pollIntervalSeconds,
      });
      return this.store.upsert(current.userId, existing => {
        const base = existing ?? current;
        return {
          ...base,
          state: 'pending',
          deviceFlow: base.deviceFlow
            ? {
                ...base.deviceFlow,
                pollIntervalSeconds: pollResult.pollIntervalSeconds,
                nextPollAt: pollResult.nextPollAt,
              }
            : null,
          lastError: null,
          updatedAt: Date.now(),
        };
      });
    }

    if (pollResult.status === 'authorized') {
      const tokenStatus = await checkTokenStatus(pollResult.accessToken);
      if (!tokenStatus.authenticated) {
        const message =
          tokenStatus.error ??
          'GitHub login completed, but token verification failed. Start login again.';
        this.logger.warn('gh token verification failed after authorization', {
          ...userLogContext(current.userId),
          category: classifyGithubAuthFailure(message),
          error: sanitizeLogMessage(message),
        });
        return this.store.upsert(current.userId, existing => {
          const base = existing ?? current;
          return {
            ...base,
            state: 'error',
            encryptedToken: null,
            tokenVersion: null,
            githubUser: null,
            userCode: null,
            verificationUri: null,
            deviceFlow: null,
            lastError: message,
            updatedAt: Date.now(),
          };
        });
      }

      const encryptedToken = this.tokenCipher.encrypt(pollResult.accessToken);
      const connected = await this.store.upsert(current.userId, existing => {
        const base = existing ?? current;
        return {
          ...base,
          state: 'connected',
          encryptedToken,
          tokenVersion: 'v1',
          githubUser: tokenStatus.githubUser,
          userCode: null,
          verificationUri: null,
          deviceFlow: null,
          lastError: null,
          updatedAt: Date.now(),
        };
      });

      this.logger.info('gh login finalized as connected', {
        ...userLogContext(current.userId),
        githubUser: connected.githubUser,
      });
      return connected;
    }

    const message = buildLoginErrorMessage(pollResult.code, pollResult.message);
    this.logger.warn('gh login finalized as error', {
      ...userLogContext(current.userId),
      category: classifyGithubAuthFailure(message),
      code: pollResult.code,
      error: sanitizeLogMessage(message),
    });

    return this.store.upsert(current.userId, existing => {
      const base = existing ?? current;
      return {
        ...base,
        state: 'error',
        encryptedToken: null,
        tokenVersion: null,
        githubUser: null,
        userCode: null,
        verificationUri: null,
        deviceFlow: null,
        lastError: message,
        updatedAt: Date.now(),
      };
    });
  }

  private async ensureRecord(userId: string): Promise<StoredConnection> {
    const existing = await this.store.get(userId);
    if (existing) {
      return existing;
    }

    const created = await this.store.resetUser(userId);
    await mkdir(created.ghConfigDir, { recursive: true });
    this.logger.info('gh connection record created', {
      ...userLogContext(userId),
      state: created.state,
    });
    return created;
  }

  private async refreshFromEncryptedToken(
    current: StoredConnection
  ): Promise<StoredConnection | null> {
    if (!current.encryptedToken) {
      return null;
    }

    let token: string;
    try {
      token = this.tokenCipher.decrypt(current.encryptedToken);
    } catch {
      this.logger.warn(
        'gh encrypted token decrypt failed during status refresh',
        {
          ...userLogContext(current.userId),
        }
      );
      return this.store.upsert(current.userId, existing => {
        const base = existing ?? current;
        return {
          ...base,
          state: 'error',
          encryptedToken: null,
          tokenVersion: null,
          githubUser: null,
          userCode: null,
          verificationUri: null,
          deviceFlow: null,
          lastError:
            'Stored GitHub token cannot be decrypted. Reconnect required.',
          updatedAt: Date.now(),
        };
      });
    }

    const tokenStatus = await checkTokenStatus(token);
    if (tokenStatus.authenticated) {
      this.logger.debug('gh token status refresh succeeded', {
        ...userLogContext(current.userId),
        githubUser: tokenStatus.githubUser,
      });
      return this.store.upsert(current.userId, existing => {
        const base = existing ?? current;
        return {
          ...base,
          state: 'connected',
          encryptedToken: base.encryptedToken,
          tokenVersion: base.tokenVersion ?? 'v1',
          githubUser: tokenStatus.githubUser,
          userCode: null,
          verificationUri: null,
          deviceFlow: null,
          lastError: null,
          updatedAt: Date.now(),
        };
      });
    }

    this.logger.warn('gh token status refresh failed', {
      ...userLogContext(current.userId),
      category: classifyGithubAuthFailure(tokenStatus.error),
      error: tokenStatus.error ? sanitizeLogMessage(tokenStatus.error) : null,
    });
    return this.store.upsert(current.userId, existing => {
      const base = existing ?? current;
      return {
        ...base,
        state: 'error',
        encryptedToken: null,
        tokenVersion: null,
        githubUser: null,
        userCode: null,
        verificationUri: null,
        deviceFlow: null,
        lastError:
          tokenStatus.error ??
          'Stored GitHub token is no longer valid. Reconnect required.',
        updatedAt: Date.now(),
      };
    });
  }

  private toResponse(record: StoredConnection): ConnectionStatusResponse {
    return {
      state: record.state,
      githubUser: record.githubUser,
      userCode: record.userCode,
      verificationUri: record.verificationUri,
      lastError: record.lastError,
      checkedAt: record.updatedAt,
    };
  }
}
