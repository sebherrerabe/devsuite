export interface GithubThreadIndexEntry<ThreadId extends string = string> {
  id: ThreadId;
  ghUpdatedAt: number | null;
  updatedAt: number;
}

export function selectPreferredGithubThreadEntry<ThreadId extends string>(
  current: GithubThreadIndexEntry<ThreadId> | null,
  candidate: GithubThreadIndexEntry<ThreadId>
): GithubThreadIndexEntry<ThreadId> {
  if (!current) {
    return candidate;
  }

  const currentGhUpdatedAt =
    current.ghUpdatedAt === null
      ? Number.NEGATIVE_INFINITY
      : current.ghUpdatedAt;
  const candidateGhUpdatedAt =
    candidate.ghUpdatedAt === null
      ? Number.NEGATIVE_INFINITY
      : candidate.ghUpdatedAt;

  if (candidateGhUpdatedAt > currentGhUpdatedAt) {
    return candidate;
  }
  if (candidateGhUpdatedAt < currentGhUpdatedAt) {
    return current;
  }

  return candidate.updatedAt > current.updatedAt ? candidate : current;
}
