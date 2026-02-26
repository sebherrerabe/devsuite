interface RepositoryRouteCandidate {
  provider?: string | null;
  url?: string | null;
}

function normalizeGithubLogin(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (!/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function parseOwnerFromGithubUrl(urlValue: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(urlValue);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.trim().toLowerCase();
  if (hostname !== 'github.com' && hostname !== 'www.github.com') {
    return null;
  }

  const normalizedPath = parsed.pathname
    .replace(/\.git$/i, '')
    .replace(/\/+$/g, '');
  const segments = normalizedPath.split('/').filter(Boolean);
  if (segments.length < 2) {
    return null;
  }

  return normalizeGithubLogin(segments[0] ?? '');
}

export function resolveGithubRouteScope(params: {
  companyMetadata: unknown;
  repositories: RepositoryRouteCandidate[] | undefined;
}): string[] {
  const scopedLogins = new Set<string>();

  if (
    params.companyMetadata &&
    typeof params.companyMetadata === 'object' &&
    !Array.isArray(params.companyMetadata)
  ) {
    const rawLogins = (params.companyMetadata as { githubOrgLogins?: unknown })
      .githubOrgLogins;
    if (Array.isArray(rawLogins)) {
      for (const rawValue of rawLogins) {
        if (typeof rawValue !== 'string') {
          continue;
        }
        const normalized = normalizeGithubLogin(rawValue);
        if (normalized) {
          scopedLogins.add(normalized);
        }
      }
    }
  }

  for (const repository of params.repositories ?? []) {
    if (
      repository.provider !== 'github' ||
      typeof repository.url !== 'string'
    ) {
      continue;
    }
    const owner = parseOwnerFromGithubUrl(repository.url);
    if (owner) {
      scopedLogins.add(owner);
    }
  }

  return Array.from(scopedLogins).sort();
}
