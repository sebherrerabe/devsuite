import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { ConnectionState } from './types.js';

export interface StoredConnection {
  userId: string;
  userKey: string;
  ghConfigDir: string;
  state: ConnectionState;
  encryptedToken: string | null;
  tokenVersion: string | null;
  githubUser: string | null;
  userCode: string | null;
  verificationUri: string | null;
  deviceFlow: {
    deviceCode: string;
    expiresAt: number;
    pollIntervalSeconds: number;
    nextPollAt: number;
  } | null;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

interface StoreDocument {
  version: 1;
  users: Record<string, StoredConnection>;
}

const EMPTY_STORE: StoreDocument = {
  version: 1,
  users: {},
};

function hashUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 24);
}

export class ConnectionStore {
  private readonly storeFilePath: string;
  private readonly usersRootPath: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly dataDir: string) {
    this.storeFilePath = path.join(dataDir, 'connections.json');
    this.usersRootPath = path.join(dataDir, 'users');
  }

  async initialize(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    await mkdir(this.usersRootPath, { recursive: true });

    const existing = await this.readStore();
    if (existing) {
      return;
    }

    await this.writeStore(EMPTY_STORE);
  }

  async get(userId: string): Promise<StoredConnection | null> {
    const store = (await this.readStore()) ?? EMPTY_STORE;
    const existing = store.users[userId];
    if (!existing) {
      return null;
    }

    return this.normalize(userId, existing as Partial<StoredConnection>);
  }

  async upsert(
    userId: string,
    updater: (current: StoredConnection | null) => StoredConnection
  ): Promise<StoredConnection> {
    const updated = await this.queueWrite(async () => {
      const store = (await this.readStore()) ?? EMPTY_STORE;
      const currentRaw = store.users[userId] as
        | Partial<StoredConnection>
        | undefined;
      const current = currentRaw ? this.normalize(userId, currentRaw) : null;
      const next = updater(current);
      const nextStore: StoreDocument = {
        ...store,
        users: {
          ...store.users,
          [userId]: next,
        },
      };
      await this.writeStore(nextStore);
      return next;
    });

    return updated;
  }

  async list(): Promise<StoredConnection[]> {
    const store = (await this.readStore()) ?? EMPTY_STORE;
    const records = Object.entries(store.users).map(([userId, record]) =>
      this.normalize(userId, record as Partial<StoredConnection>)
    );

    return records;
  }

  resolveGhConfigDir(userId: string): { userKey: string; ghConfigDir: string } {
    const userKey = hashUserId(userId);
    const ghConfigDir = path.join(this.usersRootPath, userKey, 'gh-config');
    return { userKey, ghConfigDir };
  }

  async resetUser(userId: string): Promise<StoredConnection> {
    const now = Date.now();

    return this.upsert(userId, current => {
      const resolved = this.resolveGhConfigDir(userId);
      return {
        userId,
        userKey: resolved.userKey,
        ghConfigDir: resolved.ghConfigDir,
        state: 'disconnected',
        encryptedToken: null,
        tokenVersion: null,
        githubUser: null,
        userCode: null,
        verificationUri: null,
        deviceFlow: null,
        lastError: null,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      };
    });
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
        !candidate.users ||
        typeof candidate.users !== 'object'
      ) {
        return null;
      }

      return {
        version: 1,
        users: candidate.users as Record<string, StoredConnection>,
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

  private normalize(
    userId: string,
    record: Partial<StoredConnection>
  ): StoredConnection {
    const resolved = this.resolveGhConfigDir(userId);
    const now = Date.now();

    return {
      userId: record.userId ?? userId,
      userKey: record.userKey ?? resolved.userKey,
      ghConfigDir: record.ghConfigDir ?? resolved.ghConfigDir,
      state: record.state ?? 'disconnected',
      encryptedToken: record.encryptedToken ?? null,
      tokenVersion: record.tokenVersion ?? null,
      githubUser: record.githubUser ?? null,
      userCode: record.userCode ?? null,
      verificationUri: record.verificationUri ?? null,
      deviceFlow:
        record.deviceFlow &&
        typeof record.deviceFlow === 'object' &&
        typeof record.deviceFlow.deviceCode === 'string' &&
        typeof record.deviceFlow.expiresAt === 'number' &&
        typeof record.deviceFlow.pollIntervalSeconds === 'number' &&
        typeof record.deviceFlow.nextPollAt === 'number'
          ? {
              deviceCode: record.deviceFlow.deviceCode,
              expiresAt: record.deviceFlow.expiresAt,
              pollIntervalSeconds: record.deviceFlow.pollIntervalSeconds,
              nextPollAt: record.deviceFlow.nextPollAt,
            }
          : null,
      lastError: record.lastError ?? null,
      createdAt: record.createdAt ?? now,
      updatedAt: record.updatedAt ?? now,
    };
  }

  private async writeStore(store: StoreDocument): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    const tempPath = `${this.storeFilePath}.tmp`;
    const body = `${JSON.stringify(store, null, 2)}\n`;
    await writeFile(tempPath, body, { encoding: 'utf8' });
    await rename(tempPath, this.storeFilePath);
  }
}
