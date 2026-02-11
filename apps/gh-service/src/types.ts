export interface AuthContext {
  userId: string;
}

export type ConnectionState =
  | 'disconnected'
  | 'pending'
  | 'connected'
  | 'error';

export interface GhRuntimeStatus {
  installed: boolean;
  version: string | null;
  authenticated: boolean;
  authenticatedUser: string | null;
  error: string | null;
  checkedAt: number;
}

export interface ConnectionStatusResponse {
  state: ConnectionState;
  githubUser: string | null;
  userCode: string | null;
  verificationUri: string | null;
  lastError: string | null;
  checkedAt: number;
}
