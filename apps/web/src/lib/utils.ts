import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generates a sort key between two other sort keys.
 * For the current MVP we treat sort keys as numeric strings.
 */
export function getMidSortKey(
  prev: string | null,
  next: string | null
): string {
  const prevNum = prev !== null ? Number(prev) : null;
  const nextNum = next !== null ? Number(next) : null;
  const prevOk = prevNum !== null && Number.isFinite(prevNum);
  const nextOk = nextNum !== null && Number.isFinite(nextNum);

  if (prevOk && nextOk) {
    if (prevNum === nextNum) return `${prevNum}.5`;
    const mid = (prevNum + nextNum) / 2;
    // If we're at float precision limits, force a distinct key.
    if (mid === prevNum || mid === nextNum) return `${prevNum}.5`;
    return String(mid);
  }

  if (prevOk && next === null) return String(prevNum + 1);
  if (prev === null && nextOk) return String(nextNum - 1);

  // Fallback: time-based key (still a string).
  return String(Date.now());
}
