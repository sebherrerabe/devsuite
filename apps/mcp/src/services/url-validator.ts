import type { ParsedPrUrl } from '../types/index.js';

const PR_URL_REGEX =
  /^https:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/pull\/(\d+)\/?$/;

export function parsePrUrl(url: string): ParsedPrUrl | null {
  try {
    const urlObj = new globalThis.URL(url);

    if (urlObj.hostname !== 'github.com') {
      return null;
    }

    const cleanUrl = `${urlObj.origin}${urlObj.pathname}`;
    const match = cleanUrl.match(PR_URL_REGEX);
    if (!match) {
      return null;
    }

    const owner = match[1];
    const repo = match[2];
    const prNumber = match[3];

    if (!owner || !repo || !prNumber) {
      return null;
    }
    return {
      owner,
      repo,
      number: parseInt(prNumber, 10),
    };
  } catch {
    return null;
  }
}
