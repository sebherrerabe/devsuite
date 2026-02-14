import { NOTION_API_VERSION } from './notion-oauth.js';
import { URL } from 'node:url';

const NOTION_API_BASE_URL = 'https://api.notion.com/v1';
const NOTION_IDENTIFIER_PATTERN =
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[0-9a-fA-F]{32}/g;

export interface NotionResolvedLink {
  identifier: string;
  entityType: 'page' | 'database';
  title: string;
  url: string;
}

export interface NotionPagePeopleProperty {
  id: string;
  name: string;
  userIds: string[];
}

export interface NotionPagePeopleSnapshot {
  pageId: string;
  title: string | null;
  dataSourceId: string | null;
  properties: NotionPagePeopleProperty[];
  propertyNamesById: Record<string, string>;
}

type NotionApiErrorCode =
  | 'INVALID_URL'
  | 'INVALID_IDENTIFIER'
  | 'INVALID_RESPONSE'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'API_ERROR';

export class NotionApiError extends Error {
  constructor(
    readonly code: NotionApiErrorCode,
    message: string,
    readonly statusCode: number
  ) {
    super(message);
  }
}

interface NotionApiErrorPayload {
  code?: unknown;
  message?: unknown;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeNotionId(value: string): string {
  return value.replace(/-/g, '').toLowerCase();
}

function normalizePropertyKey(value: string): string {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }
  return decoded.trim().toLowerCase();
}

function normalizeNotionIdentifier(value: string): string {
  const normalized = value.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(normalized)) {
    throw new NotionApiError(
      'INVALID_IDENTIFIER',
      'Notion URL does not contain a valid page or database identifier',
      400
    );
  }
  return normalized;
}

export function formatNotionIdentifierForApi(value: string): string {
  const normalized = normalizeNotionIdentifier(value);
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(
    12,
    16
  )}-${normalized.slice(16, 20)}-${normalized.slice(20)}`;
}

function extractIdentifierCandidate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const matches = value.match(NOTION_IDENTIFIER_PATTERN);
  if (!matches || matches.length === 0) {
    return null;
  }

  const raw = matches[matches.length - 1];
  if (!raw) {
    return null;
  }

  return normalizeNotionIdentifier(raw);
}

export function extractNotionIdentifierFromUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new NotionApiError('INVALID_URL', 'Notion URL is invalid', 400);
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== 'notion.so' && !host.endsWith('.notion.so')) {
    throw new NotionApiError('INVALID_URL', 'URL is not a Notion URL', 400);
  }

  const pathname = decodeURIComponent(parsed.pathname);
  const candidate =
    extractIdentifierCandidate(pathname) ??
    extractIdentifierCandidate(parsed.searchParams.get('p')) ??
    extractIdentifierCandidate(parsed.searchParams.get('page_id')) ??
    extractIdentifierCandidate(parsed.searchParams.get('id'));

  if (!candidate) {
    throw new NotionApiError(
      'INVALID_IDENTIFIER',
      'Notion URL does not contain a page or database identifier',
      400
    );
  }

  return candidate;
}

function parseApiErrorPayload(value: unknown): NotionApiErrorPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as NotionApiErrorPayload;
}

async function requestNotion(
  accessToken: string,
  path: string
): Promise<unknown> {
  const response = await globalThis.fetch(`${NOTION_API_BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'notion-version': NOTION_API_VERSION,
    },
  });

  const responseText = await response.text();
  let payload: unknown = null;
  if (responseText.trim()) {
    try {
      payload = JSON.parse(responseText) as unknown;
    } catch {
      throw new NotionApiError(
        'INVALID_RESPONSE',
        'Notion API returned invalid JSON',
        response.status || 502
      );
    }
  }

  if (!response.ok) {
    const parsedError = parseApiErrorPayload(payload);
    const errorCode = readString(parsedError.code);
    const message =
      readString(parsedError.message) ?? 'Notion API request failed';

    if (response.status === 401) {
      throw new NotionApiError('UNAUTHORIZED', message, response.status);
    }
    if (response.status === 404 || errorCode === 'object_not_found') {
      throw new NotionApiError('NOT_FOUND', message, response.status);
    }
    if (response.status === 429) {
      throw new NotionApiError('RATE_LIMITED', message, response.status);
    }

    throw new NotionApiError('API_ERROR', message, response.status);
  }

  return payload;
}

function readRichTextPlainText(value: unknown): string {
  if (!Array.isArray(value)) {
    return '';
  }

  return value
    .map(item =>
      item && typeof item === 'object'
        ? (readString((item as { plain_text?: unknown }).plain_text) ?? '')
        : ''
    )
    .join('')
    .trim();
}

function extractPageTitle(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const properties = (payload as { properties?: unknown }).properties;
  if (
    !properties ||
    typeof properties !== 'object' ||
    Array.isArray(properties)
  ) {
    return null;
  }

  for (const value of Object.values(properties)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }

    const property = value as {
      type?: unknown;
      title?: unknown;
    };
    if (property.type !== 'title') {
      continue;
    }

    const title = readRichTextPlainText(property.title);
    if (title) {
      return title;
    }
  }

  return null;
}

function extractDatabaseTitle(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  return readRichTextPlainText((payload as { title?: unknown }).title) || null;
}

function buildFallbackNotionUrl(identifier: string): string {
  return `https://www.notion.so/${identifier}`;
}

function extractOwnerUserIdFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const objectType = readString((payload as { object?: unknown }).object);
  const userType = readString((payload as { type?: unknown }).type);

  // `/users/me` can return a person user object where top-level `id` is the owner.
  if (objectType === 'user' && userType === 'person') {
    const directId = readString((payload as { id?: unknown }).id);
    if (directId) {
      return directId;
    }
  }

  // `/users/me` can also return a bot user object where owner is nested under `bot.owner.user.id`.
  if (objectType === 'user' && userType === 'bot') {
    const bot = (payload as { bot?: unknown }).bot;
    if (bot && typeof bot === 'object' && !Array.isArray(bot)) {
      const owner = (bot as { owner?: unknown }).owner;
      if (owner && typeof owner === 'object' && !Array.isArray(owner)) {
        const ownerType = readString((owner as { type?: unknown }).type);
        if (ownerType === 'user') {
          const user = (owner as { user?: unknown }).user;
          if (user && typeof user === 'object' && !Array.isArray(user)) {
            const ownerUserId = readString((user as { id?: unknown }).id);
            if (ownerUserId) {
              return ownerUserId;
            }
          }
        }
      }
    }
  }

  // Keep legacy fallback for payloads exposing `owner.user.id` at top-level.
  const owner = (payload as { owner?: unknown }).owner;
  if (owner && typeof owner === 'object' && !Array.isArray(owner)) {
    const ownerType = readString((owner as { type?: unknown }).type);
    if (ownerType === 'user') {
      const user = (owner as { user?: unknown }).user;
      if (user && typeof user === 'object' && !Array.isArray(user)) {
        return readString((user as { id?: unknown }).id);
      }
    }
  }

  return null;
}

function extractPageDataSourceId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const parent = (payload as { parent?: unknown }).parent;
  if (!parent || typeof parent !== 'object' || Array.isArray(parent)) {
    return null;
  }

  const parentType = readString((parent as { type?: unknown }).type);
  if (parentType === 'data_source_id') {
    return readString((parent as { data_source_id?: unknown }).data_source_id);
  }
  if (parentType === 'database_id') {
    return readString((parent as { database_id?: unknown }).database_id);
  }
  return null;
}

function extractPagePeopleProperties(
  payload: unknown
): NotionPagePeopleProperty[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new NotionApiError(
      'INVALID_RESPONSE',
      'Notion page response has invalid shape',
      502
    );
  }

  const objectType = readString((payload as { object?: unknown }).object);
  if (objectType !== 'page') {
    throw new NotionApiError(
      'INVALID_RESPONSE',
      'Notion page response has invalid object type',
      502
    );
  }

  const properties = (payload as { properties?: unknown }).properties;
  if (
    !properties ||
    typeof properties !== 'object' ||
    Array.isArray(properties)
  ) {
    return [];
  }

  const result: NotionPagePeopleProperty[] = [];
  const seenIds = new Set<string>();

  for (const [rawName, rawValue] of Object.entries(properties)) {
    if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
      continue;
    }

    const property = rawValue as {
      id?: unknown;
      type?: unknown;
      people?: unknown;
    };
    if (property.type !== 'people') {
      continue;
    }

    const id = readString(property.id);
    if (!id) {
      continue;
    }

    const normalizedId = normalizeNotionId(id);
    if (seenIds.has(normalizedId)) {
      continue;
    }
    seenIds.add(normalizedId);

    const userIds = Array.isArray(property.people)
      ? property.people
          .map(person =>
            person && typeof person === 'object' && !Array.isArray(person)
              ? readString((person as { id?: unknown }).id)
              : null
          )
          .filter((value): value is string => Boolean(value))
          .map(value => normalizeNotionId(value))
      : [];

    const name = rawName.trim() || id;
    result.push({
      id,
      name,
      userIds,
    });
  }

  return result;
}

function extractPagePropertyNamesById(
  payload: unknown
): Record<string, string> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }

  const properties = (payload as { properties?: unknown }).properties;
  if (
    !properties ||
    typeof properties !== 'object' ||
    Array.isArray(properties)
  ) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [rawName, rawValue] of Object.entries(properties)) {
    if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
      continue;
    }

    const id = readString((rawValue as { id?: unknown }).id);
    if (!id) {
      continue;
    }

    const key = normalizePropertyKey(id);
    if (!key) {
      continue;
    }

    const name = rawName.trim() || id;
    result[key] = name;
  }

  return result;
}

function buildPageResolvedLink(
  payload: unknown,
  identifier: string
): NotionResolvedLink {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new NotionApiError(
      'INVALID_RESPONSE',
      'Notion page response has invalid shape',
      502
    );
  }

  const objectType = readString((payload as { object?: unknown }).object);
  if (objectType !== 'page') {
    throw new NotionApiError(
      'INVALID_RESPONSE',
      'Notion page response has invalid object type',
      502
    );
  }

  const title = extractPageTitle(payload) ?? 'Untitled Notion page';
  const url =
    readString((payload as { url?: unknown }).url) ??
    buildFallbackNotionUrl(identifier);

  return {
    identifier,
    entityType: 'page',
    title,
    url,
  };
}

function buildDatabaseResolvedLink(
  payload: unknown,
  identifier: string
): NotionResolvedLink {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new NotionApiError(
      'INVALID_RESPONSE',
      'Notion database response has invalid shape',
      502
    );
  }

  const objectType = readString((payload as { object?: unknown }).object);
  if (objectType !== 'database') {
    throw new NotionApiError(
      'INVALID_RESPONSE',
      'Notion database response has invalid object type',
      502
    );
  }

  const title = extractDatabaseTitle(payload) ?? 'Untitled Notion database';
  const url =
    readString((payload as { url?: unknown }).url) ??
    buildFallbackNotionUrl(identifier);

  return {
    identifier,
    entityType: 'database',
    title,
    url,
  };
}

export async function resolveNotionLinkByUrl(options: {
  accessToken: string;
  url: string;
}): Promise<NotionResolvedLink> {
  const identifier = extractNotionIdentifierFromUrl(options.url);
  const apiId = formatNotionIdentifierForApi(identifier);

  try {
    const pagePayload = await requestNotion(
      options.accessToken,
      `/pages/${apiId}`
    );
    return buildPageResolvedLink(pagePayload, identifier);
  } catch (error) {
    if (!(error instanceof NotionApiError) || error.code !== 'NOT_FOUND') {
      throw error;
    }
  }

  const databasePayload = await requestNotion(
    options.accessToken,
    `/databases/${apiId}`
  );
  return buildDatabaseResolvedLink(databasePayload, identifier);
}

export async function getNotionTokenOwnerUserId(options: {
  accessToken: string;
}): Promise<string | null> {
  const payload = await requestNotion(options.accessToken, '/users/me');
  const ownerUserId = extractOwnerUserIdFromPayload(payload);
  return ownerUserId ? normalizeNotionId(ownerUserId) : null;
}

export async function getNotionPagePeopleSnapshot(options: {
  accessToken: string;
  pageId: string;
}): Promise<NotionPagePeopleSnapshot> {
  const pageId = formatNotionIdentifierForApi(options.pageId);
  const payload = await requestNotion(options.accessToken, `/pages/${pageId}`);
  return {
    pageId,
    title: extractPageTitle(payload),
    dataSourceId: extractPageDataSourceId(payload),
    properties: extractPagePeopleProperties(payload),
    propertyNamesById: extractPagePropertyNamesById(payload),
  };
}
