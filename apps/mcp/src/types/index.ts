export interface ParsedPrUrl {
  owner: string;
  repo: string;
  number: number;
}

export interface PrMetadata {
  title: string;
  body: string;
  author: { login: string };
  state: string;
  baseRefName: string;
  headRefName: string;
  files: Array<{ path: string; additions: number; deletions: number }>;
  additions: number;
  deletions: number;
  commits: Array<{ oid: string; message: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface BundleResult {
  bundlePath: string;
  files: string[];
  truncated: boolean;
  diffSizeBytes: number;
  summary: string;
}

export interface PrListItem {
  number: number;
  title: string;
  url: string;
  author?: { login: string };
  state?: string;
  isDraft?: boolean;
  baseRefName?: string;
  headRefName?: string;
  createdAt?: string;
  updatedAt?: string;
}
