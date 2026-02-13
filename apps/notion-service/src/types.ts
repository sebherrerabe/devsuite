export interface AuthContext {
  userId: string;
}

export type ConnectionState =
  | 'disconnected'
  | 'pending'
  | 'connected'
  | 'error';
