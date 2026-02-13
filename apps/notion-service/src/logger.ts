type Level = 'debug' | 'info' | 'warn' | 'error';

const levelOrder: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function shouldLog(current: Level, incoming: Level): boolean {
  return levelOrder[incoming] >= levelOrder[current];
}

export interface Logger {
  debug: (message: string, data?: Record<string, unknown>) => void;
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
}

export function createLogger(level: Level): Logger {
  const log = (
    incoming: Level,
    message: string,
    data?: Record<string, unknown>
  ) => {
    if (!shouldLog(level, incoming)) {
      return;
    }

    const record = {
      level: incoming,
      message,
      timestamp: new Date().toISOString(),
      ...(data ?? {}),
    };

    const line = JSON.stringify(record);

    if (incoming === 'error') {
      process.stderr.write(`${line}\n`);
      return;
    }

    process.stdout.write(`${line}\n`);
  };

  return {
    debug: (message, data) => log('debug', message, data),
    info: (message, data) => log('info', message, data),
    warn: (message, data) => log('warn', message, data),
    error: (message, data) => log('error', message, data),
  };
}
