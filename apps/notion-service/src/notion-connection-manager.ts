import { randomUUID } from 'node:crypto';
import {
  NotionConnectionStore,
  type StoredNotionConnection,
} from './notion-connection-store.js';
import type { Logger } from './logger.js';
import { TokenCipher } from './token-cipher.js';
import {
  createNotionAuthorizeUrl,
  exchangeNotionAuthorizationCode,
  introspectNotionToken,
  NotionOAuthError,
  refreshNotionAccessToken,
  revokeNotionToken,
} from './notion-oauth.js';
import type { ConvexBackendClient } from './convex-backend-client.js';
import { maskUserId, sanitizeLogMessage } from './logging-utils.js';
import {
  NotionApiError,
  resolveNotionLinkByUrl,
  type NotionResolvedLink,
} from './notion-api.js';

export interface NotionConnectionStatusResponse {
  state: 'disconnected' | 'pending' | 'connected' | 'error';
  companyId: string;
  workspaceId: string | null;
  workspaceName: string | null;
  workspaceIcon: string | null;
  verificationUri: string | null;
  lastError: string | null;
  checkedAt: number;
}

interface NotionConnectionManagerOptions {
  oauthClientId: string | null;
  oauthClientSecret: string | null;
  oauthRedirectUri: string | null;
  backendClient: ConvexBackendClient | null;
}

export class NotionConnectionManagerError extends Error {
  constructor(
    readonly code:
      | 'NOT_CONFIGURED'
      | 'BACKEND_NOT_CONFIGURED'
      | 'NOT_CONNECTED'
      | 'TOKEN_INVALID'
      | 'LINK_INVALID'
      | 'OAUTH_INVALID_STATE'
      | 'OAUTH_FAILED'
      | 'WORKSPACE_CONFLICT',
    message: string
  ) {
    super(message);
  }
}

const PENDING_TTL_MS = 10 * 60 * 1000;

function userLogContext(userId: string): Record<string, unknown> {
  return {
    user: maskUserId(userId),
  };
}

function sanitizeErrorMessage(error: unknown): string {
  return error instanceof Error ? sanitizeLogMessage(error.message) : 'unknown';
}

export class NotionConnectionManager {
  private readonly store: NotionConnectionStore;

  constructor(
    dataDir: string,
    private readonly tokenCipher: TokenCipher,
    private readonly logger: Logger,
    private readonly options: NotionConnectionManagerOptions
  ) {
    this.store = new NotionConnectionStore(dataDir);
  }

  async initialize(): Promise<void> {
    await this.store.initialize();
    this.logger.info('notion connection store initialized');
  }

  async startLogin(
    userId: string,
    companyId: string
  ): Promise<NotionConnectionStatusResponse> {
    this.assertConfigured();
    const current = await this.ensureRecord(userId, companyId);
    const now = Date.now();

    if (
      current.state === 'pending' &&
      current.pendingState &&
      current.pendingExpiresAt &&
      current.pendingExpiresAt > now &&
      current.verificationUri
    ) {
      return this.toResponse(current);
    }

    const oauthState = randomUUID();
    const verificationUri = createNotionAuthorizeUrl({
      clientId: this.options.oauthClientId as string,
      redirectUri: this.options.oauthRedirectUri as string,
      state: oauthState,
    });

    const pending = await this.store.upsert(userId, companyId, existing => ({
      ...(existing ?? current),
      state: 'pending',
      encryptedAccessToken: null,
      encryptedRefreshToken: null,
      tokenVersion: null,
      workspaceId: null,
      workspaceName: null,
      workspaceIcon: null,
      botId: null,
      ownerType: null,
      verificationUri,
      pendingState: oauthState,
      pendingExpiresAt: now + PENDING_TTL_MS,
      lastError: null,
      updatedAt: now,
    }));

    this.logger.info('notion login requested', {
      ...userLogContext(userId),
      companyId,
      state: pending.state,
    });
    return this.toResponse(pending);
  }

  async getStatus(
    userId: string,
    companyId: string
  ): Promise<NotionConnectionStatusResponse> {
    const current = await this.ensureRecord(userId, companyId);
    if (
      current.state === 'pending' &&
      current.pendingExpiresAt &&
      current.pendingExpiresAt <= Date.now()
    ) {
      const expired = await this.markConnectionError(
        current,
        'Notion login timed out. Start login again.',
        { clearCredentials: false }
      );
      return this.toResponse(expired);
    }

    if (current.state !== 'connected') {
      return this.toResponse(current);
    }

    try {
      const healthy = await this.ensureConnectionHealth(current, {
        skipIntrospection: false,
      });
      return this.toResponse(healthy);
    } catch (error) {
      if (error instanceof NotionConnectionManagerError) {
        const latest = await this.ensureRecord(userId, companyId);
        return this.toResponse(latest);
      }
      throw error;
    }
  }

  async resolveLink(
    userId: string,
    companyId: string,
    url: string
  ): Promise<NotionResolvedLink> {
    const current = await this.ensureRecord(userId, companyId);
    const healthy = await this.ensureConnectionHealth(current, {
      skipIntrospection: false,
    });
    const accessToken = this.readAccessToken(healthy);

    try {
      return await resolveNotionLinkByUrl({
        accessToken,
        url,
      });
    } catch (error) {
      if (error instanceof NotionApiError) {
        if (error.code === 'UNAUTHORIZED') {
          const refreshed = await this.refreshConnectionAccessToken(healthy);
          const refreshedToken = this.readAccessToken(refreshed);
          try {
            return await resolveNotionLinkByUrl({
              accessToken: refreshedToken,
              url,
            });
          } catch (retryError) {
            throw this.mapLinkResolutionError(healthy, retryError);
          }
        }

        throw this.mapLinkResolutionError(healthy, error);
      }

      throw error;
    }
  }

  async disconnect(
    userId: string,
    companyId: string
  ): Promise<NotionConnectionStatusResponse> {
    if (!this.options.backendClient) {
      throw new NotionConnectionManagerError(
        'BACKEND_NOT_CONFIGURED',
        'Notion backend routing is not configured'
      );
    }

    const current = await this.ensureRecord(userId, companyId);

    if (
      current.encryptedAccessToken &&
      this.options.oauthClientId &&
      this.options.oauthClientSecret
    ) {
      try {
        const accessToken = this.tokenCipher.decrypt(
          current.encryptedAccessToken
        );
        await revokeNotionToken({
          clientId: this.options.oauthClientId,
          clientSecret: this.options.oauthClientSecret,
          token: accessToken,
        });
      } catch (error) {
        this.logger.warn('notion token revoke failed during disconnect', {
          ...userLogContext(userId),
          companyId,
          error: sanitizeErrorMessage(error),
        });
      }
    }

    try {
      await this.options.backendClient.clearNotionConnection(userId, companyId);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to clear Notion connection in backend';
      this.logger.warn('notion backend clear connection failed', {
        ...userLogContext(userId),
        companyId,
        error: sanitizeLogMessage(message),
      });
      throw new NotionConnectionManagerError('OAUTH_FAILED', message);
    }

    const reset = await this.store.resetConnection(userId, companyId);
    return this.toResponse(reset);
  }

  async completeOAuthCallback(input: {
    state: string | null;
    code: string | null;
    error: string | null;
    errorDescription: string | null;
  }): Promise<{
    ok: boolean;
    userId: string | null;
    companyId: string | null;
    message: string;
  }> {
    this.assertConfigured();
    if (!input.state) {
      return {
        ok: false,
        userId: null,
        companyId: null,
        message: 'Missing OAuth state',
      };
    }

    const connection = await this.store.findByPendingState(input.state);
    if (!connection) {
      return {
        ok: false,
        userId: null,
        companyId: null,
        message: 'Unknown or expired OAuth state',
      };
    }

    if (
      connection.pendingExpiresAt &&
      connection.pendingExpiresAt <= Date.now()
    ) {
      await this.markConnectionError(
        connection,
        'Notion login timed out. Start login again.',
        { clearCredentials: true }
      );
      return {
        ok: false,
        userId: connection.userId,
        companyId: connection.companyId,
        message: 'Notion login timed out',
      };
    }

    if (!input.code) {
      const errorMessage =
        input.errorDescription || input.error || 'Notion OAuth failed';
      await this.markConnectionError(connection, errorMessage, {
        clearCredentials: true,
      });
      return {
        ok: false,
        userId: connection.userId,
        companyId: connection.companyId,
        message: errorMessage,
      };
    }

    let oauth;
    try {
      oauth = await exchangeNotionAuthorizationCode({
        clientId: this.options.oauthClientId as string,
        clientSecret: this.options.oauthClientSecret as string,
        code: input.code,
        redirectUri: this.options.oauthRedirectUri as string,
      });
    } catch (error) {
      const errorMessage =
        error instanceof NotionOAuthError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Notion OAuth exchange failed';

      await this.markConnectionError(connection, errorMessage, {
        clearCredentials: true,
      });
      return {
        ok: false,
        userId: connection.userId,
        companyId: connection.companyId,
        message: errorMessage,
      };
    }

    const existingUserConnections = await this.store.listByUser(
      connection.userId
    );
    const conflict = existingUserConnections.find(
      item =>
        item.companyId !== connection.companyId &&
        item.state === 'connected' &&
        item.workspaceId === oauth.workspaceId
    );
    if (conflict) {
      const message =
        'This Notion workspace is already linked to another company for your account.';
      await this.markConnectionError(connection, message, {
        clearCredentials: true,
      });
      return {
        ok: false,
        userId: connection.userId,
        companyId: connection.companyId,
        message,
      };
    }

    await this.store.upsert(
      connection.userId,
      connection.companyId,
      existing => ({
        ...(existing ?? connection),
        state: 'connected',
        encryptedAccessToken: this.tokenCipher.encrypt(oauth.accessToken),
        encryptedRefreshToken: oauth.refreshToken
          ? this.tokenCipher.encrypt(oauth.refreshToken)
          : null,
        tokenVersion: 'v1',
        workspaceId: oauth.workspaceId,
        workspaceName: oauth.workspaceName,
        workspaceIcon: oauth.workspaceIcon,
        botId: oauth.botId,
        ownerType: oauth.ownerType,
        verificationUri: null,
        pendingState: null,
        pendingExpiresAt: null,
        lastError: null,
        updatedAt: Date.now(),
      })
    );

    if (!this.options.backendClient) {
      const message =
        'Notion backend routing is not configured. Set DEVSUITE_NOTION_SERVICE_BACKEND_TOKEN and DEVSUITE_CONVEX_SITE_URL.';
      await this.markConnectionError(connection, message, {
        clearCredentials: true,
      });
      return {
        ok: false,
        userId: connection.userId,
        companyId: connection.companyId,
        message,
      };
    }

    try {
      await this.options.backendClient.upsertNotionConnection({
        userId: connection.userId,
        companyId: connection.companyId,
        workspaceId: oauth.workspaceId,
        workspaceName: oauth.workspaceName,
        workspaceIcon: oauth.workspaceIcon,
        botId: oauth.botId,
        ownerType: oauth.ownerType,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to sync Notion connection to backend';
      await this.markConnectionError(connection, message, {
        clearCredentials: true,
      });
      return {
        ok: false,
        userId: connection.userId,
        companyId: connection.companyId,
        message,
      };
    }

    return {
      ok: true,
      userId: connection.userId,
      companyId: connection.companyId,
      message: 'Notion connected',
    };
  }

  private assertConfigured(): void {
    if (
      !this.options.oauthClientId ||
      !this.options.oauthClientSecret ||
      !this.options.oauthRedirectUri
    ) {
      throw new NotionConnectionManagerError(
        'NOT_CONFIGURED',
        'Notion OAuth is not configured in notion-service'
      );
    }
  }

  private async ensureRecord(
    userId: string,
    companyId: string
  ): Promise<StoredNotionConnection> {
    const existing = await this.store.get(userId, companyId);
    if (existing) {
      return existing;
    }
    return await this.store.resetConnection(userId, companyId);
  }

  private readAccessToken(connection: StoredNotionConnection): string {
    if (!connection.encryptedAccessToken) {
      throw new NotionConnectionManagerError(
        'NOT_CONNECTED',
        'Notion is not connected for this company'
      );
    }

    try {
      return this.tokenCipher.decrypt(connection.encryptedAccessToken);
    } catch {
      throw new NotionConnectionManagerError(
        'TOKEN_INVALID',
        'Stored Notion access token is not readable. Reconnect Notion.'
      );
    }
  }

  private readRefreshToken(connection: StoredNotionConnection): string | null {
    if (!connection.encryptedRefreshToken) {
      return null;
    }

    try {
      return this.tokenCipher.decrypt(connection.encryptedRefreshToken);
    } catch {
      return null;
    }
  }

  private async markConnectionError(
    connection: StoredNotionConnection,
    message: string,
    options?: {
      clearCredentials?: boolean;
      clearWorkspaceMetadata?: boolean;
    }
  ): Promise<StoredNotionConnection> {
    const now = Date.now();
    return await this.store.upsert(
      connection.userId,
      connection.companyId,
      existing => ({
        ...(existing ?? connection),
        state: 'error',
        verificationUri: null,
        pendingState: null,
        pendingExpiresAt: null,
        ...(options?.clearCredentials
          ? {
              encryptedAccessToken: null,
              encryptedRefreshToken: null,
              tokenVersion: null,
            }
          : {}),
        ...(options?.clearWorkspaceMetadata
          ? {
              workspaceId: null,
              workspaceName: null,
              workspaceIcon: null,
              botId: null,
              ownerType: null,
            }
          : {}),
        lastError: message,
        updatedAt: now,
      })
    );
  }

  private async ensureConnectionHealth(
    connection: StoredNotionConnection,
    options: { skipIntrospection: boolean }
  ): Promise<StoredNotionConnection> {
    if (connection.state !== 'connected') {
      throw new NotionConnectionManagerError(
        'NOT_CONNECTED',
        'Notion is not connected for this company'
      );
    }

    let accessToken: string;
    try {
      accessToken = this.readAccessToken(connection);
    } catch (error) {
      if (error instanceof NotionConnectionManagerError) {
        await this.markConnectionError(connection, error.message, {
          clearCredentials: true,
        });
      }
      throw error;
    }

    if (
      options.skipIntrospection ||
      !this.options.oauthClientId ||
      !this.options.oauthClientSecret
    ) {
      if (connection.lastError) {
        return await this.store.upsert(
          connection.userId,
          connection.companyId,
          existing => ({
            ...(existing ?? connection),
            state: 'connected',
            lastError: null,
            updatedAt: Date.now(),
          })
        );
      }
      return connection;
    }

    let introspection;
    try {
      introspection = await introspectNotionToken({
        clientId: this.options.oauthClientId,
        clientSecret: this.options.oauthClientSecret,
        token: accessToken,
      });
    } catch (error) {
      const message =
        error instanceof NotionOAuthError
          ? error.message
          : 'Notion token introspection failed';
      await this.markConnectionError(connection, message, {
        clearCredentials: false,
      });
      throw new NotionConnectionManagerError('OAUTH_FAILED', message);
    }

    if (introspection.active) {
      if (!connection.lastError) {
        return connection;
      }
      return await this.store.upsert(
        connection.userId,
        connection.companyId,
        existing => ({
          ...(existing ?? connection),
          state: 'connected',
          lastError: null,
          updatedAt: Date.now(),
        })
      );
    }

    return await this.refreshConnectionAccessToken(connection);
  }

  private async refreshConnectionAccessToken(
    connection: StoredNotionConnection
  ): Promise<StoredNotionConnection> {
    if (!this.options.oauthClientId || !this.options.oauthClientSecret) {
      const message = 'Notion OAuth credentials are not configured';
      await this.markConnectionError(connection, message, {
        clearCredentials: true,
      });
      throw new NotionConnectionManagerError('NOT_CONFIGURED', message);
    }

    const refreshToken = this.readRefreshToken(connection);
    if (!refreshToken) {
      const message = 'Notion token expired and no refresh token is available';
      await this.markConnectionError(connection, message, {
        clearCredentials: true,
      });
      throw new NotionConnectionManagerError('TOKEN_INVALID', message);
    }

    let refreshed;
    try {
      refreshed = await refreshNotionAccessToken({
        clientId: this.options.oauthClientId,
        clientSecret: this.options.oauthClientSecret,
        refreshToken,
      });
    } catch (error) {
      const message =
        error instanceof NotionOAuthError
          ? error.message
          : 'Notion token refresh failed';
      const isInvalidGrant =
        error instanceof NotionOAuthError &&
        (error.code === 'invalid_grant' || error.code === 'unauthorized');
      await this.markConnectionError(connection, message, {
        clearCredentials: isInvalidGrant,
      });
      throw new NotionConnectionManagerError(
        isInvalidGrant ? 'TOKEN_INVALID' : 'OAUTH_FAILED',
        message
      );
    }

    const updated = await this.store.upsert(
      connection.userId,
      connection.companyId,
      existing => ({
        ...(existing ?? connection),
        state: 'connected',
        encryptedAccessToken: this.tokenCipher.encrypt(refreshed.accessToken),
        encryptedRefreshToken: refreshed.refreshToken
          ? this.tokenCipher.encrypt(refreshed.refreshToken)
          : connection.encryptedRefreshToken,
        tokenVersion: 'v1',
        workspaceId: refreshed.workspaceId,
        workspaceName: refreshed.workspaceName,
        workspaceIcon: refreshed.workspaceIcon,
        botId: refreshed.botId,
        ownerType: refreshed.ownerType,
        lastError: null,
        updatedAt: Date.now(),
      })
    );

    if (this.options.backendClient) {
      try {
        await this.options.backendClient.upsertNotionConnection({
          userId: updated.userId,
          companyId: updated.companyId,
          workspaceId: updated.workspaceId as string,
          workspaceName: updated.workspaceName,
          workspaceIcon: updated.workspaceIcon,
          botId: updated.botId,
          ownerType: updated.ownerType,
        });
      } catch (error) {
        this.logger.warn('notion backend upsert after refresh failed', {
          ...userLogContext(updated.userId),
          companyId: updated.companyId,
          error: sanitizeErrorMessage(error),
        });
      }
    }

    this.logger.info('notion token refreshed', {
      ...userLogContext(updated.userId),
      companyId: updated.companyId,
      workspaceId: updated.workspaceId,
    });

    return updated;
  }

  private mapLinkResolutionError(
    connection: StoredNotionConnection,
    error: unknown
  ): NotionConnectionManagerError {
    if (!(error instanceof NotionApiError)) {
      return new NotionConnectionManagerError(
        'OAUTH_FAILED',
        error instanceof Error ? error.message : 'Notion link resolution failed'
      );
    }

    if (error.code === 'INVALID_URL' || error.code === 'INVALID_IDENTIFIER') {
      return new NotionConnectionManagerError('LINK_INVALID', error.message);
    }

    if (error.code === 'NOT_FOUND') {
      return new NotionConnectionManagerError(
        'LINK_INVALID',
        'Notion page or database was not found or is not shared with the integration'
      );
    }

    if (error.code === 'UNAUTHORIZED') {
      void this.markConnectionError(
        connection,
        'Stored Notion token is invalid. Reconnect Notion.',
        {
          clearCredentials: true,
        }
      );
      return new NotionConnectionManagerError(
        'TOKEN_INVALID',
        'Stored Notion token is invalid. Reconnect Notion.'
      );
    }

    if (error.code === 'RATE_LIMITED') {
      return new NotionConnectionManagerError(
        'OAUTH_FAILED',
        'Notion API rate limit reached. Try again shortly.'
      );
    }

    return new NotionConnectionManagerError('OAUTH_FAILED', error.message);
  }

  private toResponse(record: {
    state: 'disconnected' | 'pending' | 'connected' | 'error';
    companyId: string;
    workspaceId: string | null;
    workspaceName: string | null;
    workspaceIcon: string | null;
    verificationUri: string | null;
    lastError: string | null;
    updatedAt: number;
  }): NotionConnectionStatusResponse {
    return {
      state: record.state,
      companyId: record.companyId,
      workspaceId: record.workspaceId,
      workspaceName: record.workspaceName,
      workspaceIcon: record.workspaceIcon,
      verificationUri: record.verificationUri,
      lastError: record.lastError,
      checkedAt: record.updatedAt,
    };
  }
}
