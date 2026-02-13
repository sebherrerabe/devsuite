export function maskUserId(userId: string): string {
  const trimmed = userId.trim();
  if (!trimmed) {
    return 'unknown';
  }

  if (trimmed.length <= 8) {
    return `${trimmed[0] ?? '*'}***${trimmed[trimmed.length - 1] ?? '*'}`;
  }

  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

export function sanitizeLogMessage(message: string): string {
  return message.replace(/\s+/g, ' ').trim();
}
