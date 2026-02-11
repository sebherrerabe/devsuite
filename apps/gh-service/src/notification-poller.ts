import { setTimeout, clearTimeout } from 'node:timers';
import {
  ConnectionManager,
  ConnectionManagerError,
} from './connection-manager.js';
import {
  ConvexBackendClient,
  ConvexBackendError,
} from './convex-backend-client.js';
import { GhRunnerError } from './gh-runner.js';
import type { Logger } from './logger.js';
import { syncUserNotifications } from './notification-sync.js';

interface NotificationPollerOptions {
  connectionManager: ConnectionManager;
  backendClient: ConvexBackendClient;
  logger: Logger;
  intervalMs: number;
  batchSize: number;
}

function is403NotificationScopeError(errorMessage: string): boolean {
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes('resource not accessible by personal access token') ||
    normalized.includes('http 403')
  );
}

export class NotificationPoller {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private stopped = false;

  constructor(private readonly options: NotificationPollerOptions) {}

  start(): void {
    if (this.running || this.timer) {
      return;
    }

    this.stopped = false;
    void this.runCycle();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNext(): void {
    if (this.stopped) {
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.runCycle();
    }, this.options.intervalMs);
  }

  private async runCycle(): Promise<void> {
    if (this.running) {
      this.scheduleNext();
      return;
    }

    this.running = true;

    try {
      await this.pollAllUsers();
    } catch (error) {
      this.options.logger.error('notification poll cycle failed', {
        error: error instanceof Error ? error.message : 'unknown error',
      });
    } finally {
      this.running = false;
      this.scheduleNext();
    }
  }

  private async pollAllUsers(): Promise<void> {
    const userIds = await this.options.connectionManager.listConnectedUsers();
    if (userIds.length === 0) {
      return;
    }

    for (const userId of userIds) {
      await this.pollOneUser(userId);
    }
  }

  private async pollOneUser(userId: string): Promise<void> {
    try {
      const result = await syncUserNotifications({
        connectionManager: this.options.connectionManager,
        backendClient: this.options.backendClient,
        userId,
        batchSize: this.options.batchSize,
      });

      if (!result.hasRouteMappings) {
        this.options.logger.debug(
          'notification poll skipped for user without org routes',
          {
            userId,
            githubUser: result.githubUser,
            companiesMatched: result.companiesMatched,
          }
        );
        return;
      }

      this.options.logger.info('notification poll synced', {
        userId,
        githubUser: result.githubUser,
        companiesMatched: result.companiesMatched,
        notificationsFetched: result.notificationsFetched,
        notificationsFiltered: result.notificationsFiltered,
        notificationsReceived: result.notificationsReceived,
        notificationsRouted: result.notificationsRouted,
        notificationsUnmatched: result.notificationsUnmatched,
        deliveriesCreated: result.deliveriesCreated,
        deliveriesUpdated: result.deliveriesUpdated,
      });
    } catch (error) {
      if (error instanceof ConnectionManagerError) {
        this.options.logger.warn(
          'notification poll skipped for disconnected user',
          {
            userId,
            code: error.code,
            error: error.message,
          }
        );
        return;
      }

      if (error instanceof ConvexBackendError) {
        this.options.logger.error('notification poll backend request failed', {
          userId,
          statusCode: error.statusCode,
          code: error.code,
          error: error.message,
        });
        return;
      }

      if (error instanceof GhRunnerError) {
        this.options.logger.warn(
          'notification poll GitHub CLI request failed',
          {
            userId,
            code: error.code,
            error: error.message,
            needsScopeUpdate: is403NotificationScopeError(error.message),
          }
        );
        return;
      }

      this.options.logger.error('notification poll failed for user', {
        userId,
        error: error instanceof Error ? error.message : 'unknown error',
      });
    }
  }
}
