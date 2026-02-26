import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { useCurrentCompany } from '@/lib/company-context';
import { authClient } from '@/lib/auth';
import { usePrivacyMode } from '@/lib/privacy-mode-context';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { showToast } from '@/lib/toast';
import { formatShortDateTime } from '@/lib/time';
import { useInboxDesktopNotifications } from '@/lib/inbox-desktop-notifications-context';
import { resolveGithubRouteScope } from '@/lib/github-route-scope';
import {
  GhServiceRequestError,
  type GhNotificationSyncResult,
  syncGithubNotifications,
} from '@/lib/gh-service-client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  MoreHorizontal,
  Loader2,
  RefreshCw,
  Bell,
  Github,
  FileText,
  Inbox,
  AtSign,
  MessageSquare,
  GitPullRequest,
  AlertCircle,
  CheckCircle2,
  Archive,
  ArchiveRestore,
  Eye,
  EyeOff,
} from 'lucide-react';

export const Route = createFileRoute('/_app/inbox')({
  validateSearch: (search: Record<string, unknown>) => ({
    itemId:
      typeof search.itemId === 'string' && search.itemId.trim()
        ? search.itemId.trim()
        : undefined,
  }),
  component: InboxPage,
});

type InboxItem = Doc<'inboxItems'>;
type InboxItemType = InboxItem['type'];
type InboxItemSource = InboxItem['source'];

function getSessionUserId(sessionData: unknown): string | null {
  if (!sessionData || typeof sessionData !== 'object') {
    return null;
  }

  const root = sessionData as {
    session?: { userId?: unknown } | null;
    user?: { id?: unknown } | null;
  };

  if (
    root.session &&
    typeof root.session.userId === 'string' &&
    root.session.userId.trim()
  ) {
    return root.session.userId.trim();
  }
  if (root.user && typeof root.user.id === 'string' && root.user.id.trim()) {
    return root.user.id.trim();
  }

  return null;
}

function formatSyncError(error: unknown): string {
  if (error instanceof GhServiceRequestError) {
    return error.requestId
      ? `${error.message} (request ${error.requestId})`
      : error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Failed to refresh GitHub notifications';
}

function formatDropDiagnostics(sync: GhNotificationSyncResult): string {
  return `missing org ${sync.droppedMissingOrg}, out of scope ${sync.droppedOutOfScope}, no route ${sync.droppedNoRouteMatch}, stale ${sync.droppedStaleThread}`;
}

function getSourceLabel(source: InboxItemSource): string {
  switch (source) {
    case 'github':
      return 'GitHub';
    case 'notion':
      return 'Notion';
    case 'internal':
      return 'DevSuite';
  }
}

function SourceIcon({ source }: { source: InboxItemSource }) {
  switch (source) {
    case 'github':
      return <Github className="h-4 w-4" />;
    case 'notion':
      return <FileText className="h-4 w-4" />;
    case 'internal':
      return <Inbox className="h-4 w-4" />;
  }
}

function TypeIcon({ type }: { type: InboxItemType }) {
  switch (type) {
    case 'pr_review':
      return <GitPullRequest className="h-4 w-4" />;
    case 'mention':
      return <AtSign className="h-4 w-4" />;
    case 'comment':
      return <MessageSquare className="h-4 w-4" />;
    case 'issue':
      return <AlertCircle className="h-4 w-4" />;
    case 'ci_status':
      return <CheckCircle2 className="h-4 w-4" />;
    case 'notification':
    default:
      return <Bell className="h-4 w-4" />;
  }
}

function InboxPage() {
  const { data: authSession } = authClient.useSession();
  const search = Route.useSearch();
  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?._id;
  const {
    isSupported: desktopNotificationsSupported,
    permission: desktopNotificationPermission,
    isEnabled: desktopNotificationsEnabled,
    requestPermission,
    disable,
  } = useInboxDesktopNotifications();

  const isDesktopRuntime =
    typeof window !== 'undefined' &&
    typeof (window as { desktopNotification?: unknown }).desktopNotification !==
      'undefined';

  const { isPrivacyMode } = usePrivacyMode();
  const [sourceFilter, setSourceFilter] = useState<InboxItemSource | 'all'>(
    'all'
  );
  const [typeFilter, setTypeFilter] = useState<InboxItemType | 'all'>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const userId = useMemo(() => getSessionUserId(authSession), [authSession]);
  const repositories = useQuery(
    api.repositories.getByCompany,
    companyId ? { companyId } : 'skip'
  );
  const githubRouteScope = useMemo(
    () =>
      resolveGithubRouteScope({
        companyMetadata: currentCompany?.metadata,
        repositories,
      }),
    [currentCompany?.metadata, repositories]
  );

  const queryArgs = useMemo(() => {
    if (!companyId) return 'skip' as const;
    return {
      companyId,
      unreadOnly,
      includeArchived,
      source: sourceFilter === 'all' ? undefined : sourceFilter,
      type: typeFilter === 'all' ? undefined : typeFilter,
      limit: 500,
      excludePrivate: isPrivacyMode,
    };
  }, [
    companyId,
    unreadOnly,
    includeArchived,
    sourceFilter,
    typeFilter,
    isPrivacyMode,
  ]);

  const items = useQuery(api.inboxItems.listInboxItems, queryArgs);
  const bulkUpdate = useMutation(api.inboxItems.bulkUpdate);
  const upsertInboxItem = useMutation(api.inboxItems.upsertInboxItem);

  const [selected, setSelected] = useState<Set<Id<'inboxItems'>>>(new Set());
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  const selectedVisibleIds = useMemo(() => {
    if (!items) return [];
    return items.filter(item => selected.has(item._id)).map(item => item._id);
  }, [items, selected]);
  const selectedVisibleCount = selectedVisibleIds.length;

  const allVisibleSelected =
    items && items.length > 0 && items.every(i => selected.has(i._id));

  const someVisibleSelected =
    items && items.length > 0 && items.some(i => selected.has(i._id));

  useEffect(() => {
    if (!search.itemId || !items || items.length === 0) {
      return;
    }

    const targetRow = rowRefs.current.get(search.itemId);
    if (!targetRow) {
      return;
    }

    targetRow.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [items, search.itemId]);

  const toggleAllVisible = (checked: boolean) => {
    if (!items) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (checked) {
        for (const item of items) next.add(item._id);
      } else {
        for (const item of items) next.delete(item._id);
      }
      return next;
    });
  };

  const toggleOne = (id: Id<'inboxItems'>, checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const runBulk = async (patch: { isRead?: boolean; isArchived?: boolean }) => {
    if (!companyId) return;
    const ids = selectedVisibleIds;
    if (ids.length === 0) return;

    try {
      await bulkUpdate({
        companyId,
        ids,
        isRead: patch.isRead,
        isArchived: patch.isArchived,
      });
      setSelected(new Set());
      showToast.success('Inbox updated');
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : 'Failed to update inbox'
      );
    }
  };

  const runSingle = async (
    id: Id<'inboxItems'>,
    patch: { isRead?: boolean; isArchived?: boolean }
  ) => {
    if (!companyId) return;
    try {
      await bulkUpdate({
        companyId,
        ids: [id],
        isRead: patch.isRead,
        isArchived: patch.isArchived,
      });
      showToast.success('Updated');
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : 'Failed to update inbox'
      );
    }
  };

  const handleEnableDesktopNotifications = async () => {
    const permission = await requestPermission();
    if (permission === 'granted') {
      showToast.success('Desktop notifications enabled');
      return;
    }

    if (permission === 'denied') {
      showToast.error(
        'Desktop notifications blocked',
        'Enable notifications for this site in your browser settings.'
      );
      return;
    }

    if (permission === 'unsupported') {
      showToast.error(
        'Desktop notifications are not supported in this browser'
      );
      return;
    }

    showToast.info('Desktop notification permission was dismissed');
  };

  const handleDisableDesktopNotifications = async () => {
    await disable();
    showToast.info('Desktop notifications disabled');
  };

  const addSampleItems = async () => {
    if (!companyId) return;

    const makeId = () => {
      if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
      }
      return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    };

    try {
      await upsertInboxItem({
        companyId,
        source: 'github',
        type: 'pr_review',
        content: {
          title: 'Review requested: feat/inbox-module',
          url: 'https://github.com/org/repo/pull/123',
          externalId: `github-thread-${makeId()}`,
          metadata: {
            entity: {
              kind: 'pull_request',
              repoFullName: 'org/repo',
              prNumber: 123,
            },
            event: { kind: 'review_requested', actor: 'alice' },
            github: { reason: 'review_requested', subjectType: 'PullRequest' },
          },
        },
      });

      await upsertInboxItem({
        companyId,
        source: 'github',
        type: 'comment',
        content: {
          title: 'New comment on your PR',
          url: 'https://github.com/org/repo/pull/456#issuecomment-1',
          externalId: `github-thread-${makeId()}`,
          metadata: {
            entity: {
              kind: 'pull_request',
              repoFullName: 'org/repo',
              prNumber: 456,
            },
            event: { kind: 'commented', actor: 'bob' },
            github: { reason: 'comment', subjectType: 'PullRequest' },
          },
        },
      });

      await upsertInboxItem({
        companyId,
        source: 'notion',
        type: 'notification',
        content: {
          title: 'Assigned to task: Update onboarding doc',
          url: 'https://www.notion.so/example-page',
          externalId: `notion-thread-${makeId()}`,
          metadata: {
            entity: { kind: 'page', externalId: 'notion-page-1' },
            event: { kind: 'assigned', actor: 'notion' },
          },
        },
      });

      showToast.success('Sample notifications added');
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : 'Failed to add samples'
      );
    }
  };

  const refreshGithubInbox = async () => {
    if (!userId) {
      showToast.error('Unable to resolve your user identity');
      return;
    }

    setIsRefreshing(true);
    try {
      const payload = await syncGithubNotifications(userId);
      const sync = payload.sync;
      showToast.success(
        `GitHub sync complete. fetched ${sync.notificationsFetched}, in scope ${sync.notificationsFiltered}, routed ${sync.notificationsRouted}, created ${sync.deliveriesCreated}, updated ${sync.deliveriesUpdated}, dropped: ${formatDropDiagnostics(sync)}.`
      );
    } catch (error) {
      showToast.error(formatSyncError(error));
    } finally {
      setIsRefreshing(false);
    }
  };

  const typeOptions: Array<{ value: InboxItemType | 'all'; label: string }> = [
    { value: 'all', label: 'All types' },
    { value: 'notification', label: 'Notification' },
    { value: 'pr_review', label: 'PR Review' },
    { value: 'mention', label: 'Mention' },
    { value: 'comment', label: 'Comment' },
    { value: 'issue', label: 'Issue' },
    { value: 'ci_status', label: 'CI Status' },
  ];

  const sourceOptions: Array<{
    value: InboxItemSource | 'all';
    label: string;
  }> = [
    { value: 'all', label: 'All sources' },
    { value: 'github', label: 'GitHub' },
    { value: 'notion', label: 'Notion' },
    { value: 'internal', label: 'DevSuite' },
  ];

  if (!companyId) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
        <p className="text-muted-foreground">
          Select a company to view your notifications.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
          <p className="text-muted-foreground">
            Actionable notifications across GitHub, Notion, and DevSuite.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refreshGithubInbox()}
            disabled={isRefreshing || !userId}
          >
            {isRefreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          {import.meta.env.DEV && (
            <Button variant="outline" size="sm" onClick={addSampleItems}>
              Add sample notifications
            </Button>
          )}
        </div>
      </div>

      <Alert>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>
            {isDesktopRuntime
              ? 'Notifications are handled by the DevSuite desktop app.'
              : !desktopNotificationsSupported
                ? 'This browser does not support desktop notifications.'
                : desktopNotificationPermission === 'denied'
                  ? 'Desktop notifications are blocked. Re-enable notifications for this site in your browser settings.'
                  : desktopNotificationPermission === 'granted' &&
                      desktopNotificationsEnabled
                    ? 'Desktop notifications are enabled for new inbox items.'
                    : desktopNotificationPermission === 'granted'
                      ? 'Desktop notification permission is granted, but alerts are currently disabled in DevSuite.'
                      : 'Enable desktop notifications to get alerts when new inbox items arrive.'}
          </span>

          {isDesktopRuntime
            ? null
            : desktopNotificationsSupported &&
              (desktopNotificationPermission === 'granted' &&
              desktopNotificationsEnabled ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-foreground"
                  onClick={() => void handleDisableDesktopNotifications()}
                >
                  Disable desktop notifications
                </Button>
              ) : desktopNotificationPermission !== 'denied' ? (
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0"
                  onClick={() => void handleEnableDesktopNotifications()}
                >
                  Enable desktop notifications
                </Button>
              ) : null)}
        </AlertDescription>
      </Alert>

      <Alert
        variant={githubRouteScope.length === 0 ? 'destructive' : undefined}
      >
        <AlertDescription>
          {githubRouteScope.length === 0 ? (
            <>
              No GitHub route scope is configured for this company. Only
              notifications whose repository owner matches configured scope are
              shown here.
            </>
          ) : (
            <>
              Active GitHub scope for this inbox:{' '}
              <span className="font-medium">{githubRouteScope.join(', ')}</span>
              . Notifications outside this scope are intentionally excluded.
            </>
          )}
        </AlertDescription>
      </Alert>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2 min-w-[200px]">
            <Label>Source</Label>
            <Select
              value={sourceFilter}
              onValueChange={val =>
                setSourceFilter(val as InboxItemSource | 'all')
              }
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                {sourceOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 min-w-[200px]">
            <Label>Type</Label>
            <Select
              value={typeFilter}
              onValueChange={val => setTypeFilter(val as InboxItemType | 'all')}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 pb-2">
            <Checkbox
              id="unreadOnly"
              checked={unreadOnly}
              onCheckedChange={val => setUnreadOnly(val === true)}
            />
            <Label htmlFor="unreadOnly">Unread only</Label>
          </div>

          <div className="flex items-center gap-2 pb-2">
            <Checkbox
              id="includeArchived"
              checked={includeArchived}
              onCheckedChange={val => setIncludeArchived(val === true)}
            />
            <Label htmlFor="includeArchived">Include archived</Label>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 bg-muted/20">
          <div className="text-sm text-muted-foreground">
            {selectedVisibleCount > 0 ? (
              <span>{selectedVisibleCount} selected</span>
            ) : items ? (
              <span>{items.length} items</span>
            ) : (
              <span>Loading…</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={selectedVisibleCount === 0}
              onClick={() => runBulk({ isRead: true })}
            >
              <Eye className="mr-2 h-4 w-4" />
              Mark read
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedVisibleCount === 0}
              onClick={() => runBulk({ isRead: false })}
            >
              <EyeOff className="mr-2 h-4 w-4" />
              Mark unread
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedVisibleCount === 0}
              onClick={() => runBulk({ isArchived: true })}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedVisibleCount === 0}
              onClick={() => runBulk({ isArchived: false })}
            >
              <ArchiveRestore className="mr-2 h-4 w-4" />
              Unarchive
            </Button>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={
                    allVisibleSelected
                      ? true
                      : someVisibleSelected
                        ? 'indeterminate'
                        : false
                  }
                  onCheckedChange={val => toggleAllVisible(val === true)}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Notification</TableHead>
              <TableHead className="w-[200px]">Updated</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {items === undefined ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center">
                  <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading inbox…
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center">
                  <div className="text-sm text-muted-foreground">
                    No notifications found.
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              items.map(item => (
                <TableRow
                  key={item._id}
                  ref={node => {
                    if (!node) {
                      rowRefs.current.delete(item._id);
                      return;
                    }
                    rowRefs.current.set(item._id, node);
                  }}
                  className={search.itemId === item._id ? 'bg-primary/5' : ''}
                >
                  <TableCell>
                    <Checkbox
                      checked={selected.has(item._id)}
                      onCheckedChange={val => toggleOne(item._id, val === true)}
                      aria-label="Select item"
                    />
                  </TableCell>

                  <TableCell>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md border bg-background">
                        {isPrivacyMode ? (
                          <Bell className="h-4 w-4" />
                        ) : (
                          <TypeIcon type={item.type} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {!item.isRead && (
                            <span className="h-2 w-2 rounded-full bg-primary" />
                          )}
                          {isPrivacyMode ? (
                            <span
                              className={`truncate italic text-muted-foreground ${
                                item.isRead ? '' : 'font-medium'
                              }`}
                            >
                              [Private notification]
                            </span>
                          ) : item.content?.url ? (
                            <a
                              href={item.content.url}
                              target="_blank"
                              rel="noreferrer"
                              className={`truncate hover:underline ${
                                item.isRead
                                  ? 'text-foreground'
                                  : 'font-medium text-foreground'
                              }`}
                              title={item.content.title}
                            >
                              {item.content.title}
                            </a>
                          ) : (
                            <span
                              className={`truncate ${
                                item.isRead
                                  ? 'text-foreground'
                                  : 'font-medium text-foreground'
                              }`}
                              title={item.content.title}
                            >
                              {item.content.title}
                            </span>
                          )}
                          {item.isArchived && (
                            <Badge variant="secondary" className="text-[10px]">
                              Archived
                            </Badge>
                          )}
                        </div>
                        {!isPrivacyMode && (
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <SourceIcon source={item.source} />
                              {getSourceLabel(item.source)}
                            </span>
                            <span>•</span>
                            <span className="capitalize">
                              {item.type.replace('_', ' ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {formatShortDateTime(item.updatedAt)}
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {item.isRead ? (
                          <DropdownMenuItem
                            onClick={() =>
                              runSingle(item._id, { isRead: false })
                            }
                          >
                            <EyeOff className="mr-2 h-4 w-4" />
                            Mark unread
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() =>
                              runSingle(item._id, { isRead: true })
                            }
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Mark read
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />

                        {item.isArchived ? (
                          <DropdownMenuItem
                            onClick={() =>
                              runSingle(item._id, { isArchived: false })
                            }
                          >
                            <ArchiveRestore className="mr-2 h-4 w-4" />
                            Unarchive
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() =>
                              runSingle(item._id, { isArchived: true })
                            }
                          >
                            <Archive className="mr-2 h-4 w-4" />
                            Archive
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
