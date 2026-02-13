import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ConnectionState } from './types.js';

export interface StoredNotionConnection {
  userId: string;
  companyId: string;
  state: ConnectionState;
  encryptedAccessToken: string | null;
  encryptedRefreshToken: string | null;
  tokenVersion: string | null;
  workspaceId: string | null;
  workspaceName: string | null;
  workspaceIcon: string | null;
  botId: string | null;
  ownerType: string | null;
  verificationUri: string | null;
  pendingState: string | null;
  pendingExpiresAt: number | null;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

interface StoreDocument {
  version: 1;
  connections: Record<string, StoredNotionConnection>;
}

const EMPTY_STORE: StoreDocument = {
  version: 1,
  connections: {},
};

function buildConnectionKey(userId: string, companyId: string): string {
  return `${userId}::${companyId}`;
}

export class NotionConnectionStore {
  private readonly storeFilePath: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly dataDir: string) {
    this.storeFilePath = path.join(dataDir, 'notion-connections.json');
  }

  async initialize(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    const existing = await this.readStore();
    if (existing) {
      return;
    }

    await this.writeStore(EMPTY_STORE);
  }

  async get(
    userId: string,
    companyId: string
  ): Promise<StoredNotionConnection | null> {
    const store = (await this.readStore()) ?? EMPTY_STORE;
    const key = buildConnectionKey(userId, companyId);
    const existing = store.connections[key];
    if (!existing) {
      return null;
    }
    return this.normalize(userId, companyId, existing);
  }

  async findByPendingState(
    pendingState: string
  ): Promise<StoredNotionConnection | null> {
    const store = (await this.readStore()) ?? EMPTY_STORE;
    const entries = Object.values(store.connections);
    for (const entry of entries) {
      if (entry.pendingState === pendingState) {
        return this.normalize(entry.userId, entry.companyId, entry);
      }
    }
    return null;
  }

  async upsert(
    userId: string,
    companyId: string,
    updater: (current: StoredNotionConnection | null) => StoredNotionConnection
  ): Promise<StoredNotionConnection> {
    const key = buildConnectionKey(userId, companyId);

    const updated = await this.queueWrite(async () => {
      const store = (await this.readStore()) ?? EMPTY_STORE;
      const currentRaw = store.connections[key];
      const current = currentRaw
        ? this.normalize(userId, companyId, currentRaw)
        : null;
      const next = updater(current);
      const nextStore: StoreDocument = {
        ...store,
        connections: {
          ...store.connections,
          [key]: next,
        },
      };
      await this.writeStore(nextStore);
      return next;
    });

    return updated;
  }

  async listByUser(userId: string): Promise<StoredNotionConnection[]> {
    const store = (await this.readStore()) ?? EMPTY_STORE;
    return Object.values(store.connections)
      .filter(connection => connection.userId === userId)
      .map(connection =>
        this.normalize(connection.userId, connection.companyId, connection)
      );
  }

  async resetConnection(
    userId: string,
    companyId: string
  ): Promise<StoredNotionConnection> {
    const now = Date.now();
    return this.upsert(userId, companyId, current => ({
      userId,
      companyId,
      state: 'disconnected',
      encryptedAccessToken: null,
      encryptedRefreshToken: null,
      tokenVersion: null,
      workspaceId: null,
      workspaceName: null,
      workspaceIcon: null,
      botId: null,
      ownerType: null,
      verificationUri: null,
      pendingState: null,
      pendingExpiresAt: null,
      lastError: null,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    }));
  }

  private async queueWrite<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.writeQueue;
    let release = () => {};
    this.writeQueue = new Promise<void>(resolve => {
      release = resolve;
    });

    await previous;

    try {
      return await operation();
    } finally {
      release();
    }
  }

  private normalize(
    userId: string,
    companyId: string,
    record: Partial<StoredNotionConnection>
  ): StoredNotionConnection {
    const now = Date.now();
    return {
      userId: record.userId ?? userId,
      companyId: record.companyId ?? companyId,
      state: record.state ?? 'disconnected',
      encryptedAccessToken: record.encryptedAccessToken ?? null,
      encryptedRefreshToken: record.encryptedRefreshToken ?? null,
      tokenVersion: record.tokenVersion ?? null,
      workspaceId: record.workspaceId ?? null,
      workspaceName: record.workspaceName ?? null,
      workspaceIcon: record.workspaceIcon ?? null,
      botId: record.botId ?? null,
      ownerType: record.ownerType ?? null,
      verificationUri: record.verificationUri ?? null,
      pendingState: record.pendingState ?? null,
      pendingExpiresAt: record.pendingExpiresAt ?? null,
      lastError: record.lastError ?? null,
      createdAt: record.createdAt ?? now,
      updatedAt: record.updatedAt ?? now,
    };
  }

  private async readStore(): Promise<StoreDocument | null> {
    try {
      const raw = await readFile(this.storeFilePath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      const candidate = parsed as Partial<StoreDocument>;
      if (
        candidate.version !== 1 ||
        !candidate.connections ||
        typeof candidate.connections !== 'object'
      ) {
        return null;
      }

      return {
        version: 1,
        connections: candidate.connections as Record<
          string,
          StoredNotionConnection
        >,
      };
    } catch (error) {
      const isMissing =
        error instanceof Error &&
        'code' in error &&
        (error as { code?: string }).code === 'ENOENT';
      if (isMissing) {
        return null;
      }
      throw error;
    }
  }

  private async writeStore(store: StoreDocument): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    const tempPath = `${this.storeFilePath}.tmp`;
    const body = `${JSON.stringify(store, null, 2)}\n`;
    await writeFile(tempPath, body, { encoding: 'utf8' });
    await rename(tempPath, this.storeFilePath);
  }
}
