import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { TaskStatus } from '@devsuite/shared';
import type { Id } from '../../../../convex/_generated/dataModel';
import { Link, useNavigate } from '@tanstack/react-router';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar as CalendarIcon,
  Link as LinkIcon,
  Trash2,
  ExternalLink as ExternalLinkIcon,
  Save,
  Plus,
  Loader2,
  GitPullRequest,
} from 'lucide-react';
import { MDXMarkdownEditor } from '@/components/markdown/mdx-markdown-editor';
import { TaskTriStateButton } from '@/components/task-tristate-button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { cn } from '@/lib/utils';
import { showToast } from '@/lib/toast';
import { authClient } from '@/lib/auth';
import {
  NotionServiceRequestError,
  resolveNotionLink,
} from '@/lib/notion-service-client';
import type { Doc } from '../../../../convex/_generated/dataModel';
import { formatDurationMs, formatShortDateTime } from '@/lib/time';
import {
  getNextTriState,
  getTriState,
  triStateToStatus,
} from '@/lib/task-tristate';
import { useCurrentCompany } from '@/lib/company-context';

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

function isNotionUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return host === 'notion.so' || host.endsWith('.notion.so');
  } catch {
    return false;
  }
}

function formatNotionLinkError(error: unknown): string {
  if (error instanceof NotionServiceRequestError) {
    if (error.code === 'NOT_CONNECTED') {
      return 'Connect Notion for this company before linking Notion pages.';
    }
    if (error.code === 'LINK_INVALID') {
      return 'Notion link is invalid or not shared with your integration.';
    }
    if (error.code === 'INTEGRATION_DISABLED') {
      return 'Notion integration is disabled for this company.';
    }
    if (error.code === 'TOKEN_INVALID') {
      return 'Stored Notion token is invalid. Reconnect Notion and try again.';
    }
    if (error.code === 'NOT_CONFIGURED') {
      return 'Notion OAuth is not configured in notion-service.';
    }
    if (error.code === 'UNAUTHORIZED') {
      return 'Notion service rejected this request. Check notion-service auth configuration.';
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Failed to resolve Notion link';
}

interface TaskDetailProps {
  taskId: Id<'tasks'> | null;
  companyId: Id<'companies'>;
  fetch?: boolean;
  variant?: 'pane' | 'sheet';
}

export function TaskDetail({
  taskId,
  companyId,
  fetch = true,
  variant = 'pane',
}: TaskDetailProps) {
  const shouldFetch = fetch && !!taskId;
  const task = useQuery(
    api.tasks.get,
    shouldFetch ? { companyId, taskId } : 'skip'
  );
  const externalLinks = useQuery(
    api.externalLinks.listExternalLinksByTask,
    shouldFetch ? { companyId, taskId } : 'skip'
  );
  const tags = useQuery(api.tags.listTagsByCompany, { companyId });

  if (!taskId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a task to view details.
      </div>
    );
  }

  if (task === undefined) {
    return (
      <div className="space-y-4">
        <div className="text-xs text-muted-foreground">Tasks / Loading...</div>
        <div className="h-7 w-2/3 rounded bg-muted animate-pulse" />
        <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  if (!task) {
    return <div className="text-sm text-muted-foreground">Task not found.</div>;
  }

  return (
    <TaskDetailContent
      task={task}
      companyId={companyId}
      externalLinks={externalLinks ?? []}
      tags={tags ?? []}
      variant={variant}
    />
  );
}

function buildTaskFormState(task: Doc<'tasks'>) {
  return {
    title: task.title,
    notes: task.notesMarkdown || '',
    status: task.status as TaskStatus,
    complexity: task.complexityScore || 1,
    dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
    selectedTags: task.tagIds ?? [],
  };
}

function TaskDetailContent({
  task,
  companyId,
  externalLinks,
  tags,
  variant,
}: {
  task: Doc<'tasks'>;
  companyId: Id<'companies'>;
  externalLinks: Doc<'external_links'>[];
  tags: Doc<'tags'>[];
  variant: 'pane' | 'sheet';
}) {
  const { isModuleEnabled } = useCurrentCompany();
  const canUseSessions = isModuleEnabled('sessions');
  const canUsePRReviews = isModuleEnabled('pr_reviews');

  const updateTask = useMutation(api.tasks.updateTask);
  const addLink = useMutation(api.externalLinks.addExternalLink);
  const removeLink = useMutation(api.externalLinks.removeExternalLink);
  const createPRReview = useMutation(api.prReviews.createPRReview);
  const sessionMetadata = useQuery(
    api.sessions.getTaskSessionMetadata,
    canUseSessions ? { companyId, taskId: task._id } : 'skip'
  );
  const repositories = useQuery(
    api.repositories.getByCompany,
    canUsePRReviews ? { companyId } : 'skip'
  );
  const project = useQuery(
    api.projects.getProject,
    task.projectId ? { id: task.projectId } : 'skip'
  );
  const prReviews = useQuery(
    api.prReviews.listPRReviewsByTask,
    canUsePRReviews ? { companyId, taskId: task._id } : 'skip'
  );
  const navigate = useNavigate();
  const { data: authSession } = authClient.useSession();
  const userId = getSessionUserId(authSession);

  const [formState, setFormState] = useState(() => buildTaskFormState(task));
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isResolvingNotionLink, setIsResolvingNotionLink] = useState(false);
  const [isCreateReviewOpen, setIsCreateReviewOpen] = useState(false);
  const [isCreatingReview, setIsCreatingReview] = useState(false);
  const [reviewFormState, setReviewFormState] = useState(() => ({
    repositoryId: '' as Id<'repositories'> | '',
    prUrl: '',
    baseBranch: '',
    headBranch: '',
    title: '',
  }));
  const hasSessionMetadata = (sessionMetadata?.sessionCount ?? 0) > 0;
  const triState = getTriState(formState.status);
  const nextTriState = getNextTriState(triState);

  const defaultRepositoryId =
    project?.repositoryIds?.length === 1 ? project.repositoryIds[0] : '';
  const taskId = task._id;
  const taskTitle = task.title;
  const taskNotesMarkdown = task.notesMarkdown || '';
  const taskStatus = task.status as TaskStatus;
  const taskComplexityScore = task.complexityScore || 1;
  const taskDueDate = task.dueDate;
  const taskTagIds = useMemo(() => task.tagIds ?? [], [task.tagIds]);

  useEffect(() => {
    setFormState({
      title: taskTitle,
      notes: taskNotesMarkdown,
      status: taskStatus,
      complexity: taskComplexityScore,
      dueDate: taskDueDate ? new Date(taskDueDate) : undefined,
      selectedTags: taskTagIds,
    });
    setIsSavingNotes(false);
    setIsResolvingNotionLink(false);
    setIsCreateReviewOpen(false);
    setIsCreatingReview(false);
    setReviewFormState({
      repositoryId: '',
      prUrl: '',
      baseBranch: '',
      headBranch: '',
      title: '',
    });
  }, [
    taskComplexityScore,
    taskDueDate,
    taskId,
    taskNotesMarkdown,
    taskStatus,
    taskTagIds,
    taskTitle,
  ]);

  useEffect(() => {
    if (!isCreateReviewOpen) return;
    if (!reviewFormState.repositoryId && defaultRepositoryId) {
      setReviewFormState(prev => ({
        ...prev,
        repositoryId: defaultRepositoryId,
      }));
    }
    if (!reviewFormState.title) {
      setReviewFormState(prev => ({ ...prev, title: task.title }));
    }
  }, [
    isCreateReviewOpen,
    defaultRepositoryId,
    reviewFormState.repositoryId,
    reviewFormState.title,
    task.title,
  ]);

  const handleUpdate = (
    updates: Partial<{
      title: string;
      status: TaskStatus;
      dueDate: number | null;
      complexityScore: number | null;
      notesMarkdown: string | null;
      tagIds: Id<'tags'>[];
    }>
  ) => {
    updateTask({
      companyId,
      taskId: task._id,
      ...updates,
    }).catch(() => showToast.error('Failed to update task'));
  };

  const handleAddLink = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const url = String(formData.get('url') ?? '').trim();
    const linkTitle = String(formData.get('title') ?? '').trim();

    if (!url) {
      return;
    }

    try {
      const notionLink = isNotionUrl(url);
      let type: 'url' | 'notion' = notionLink ? 'notion' : 'url';
      let resolvedTitle = linkTitle;
      let identifier: string | undefined;

      if (notionLink) {
        if (!userId) {
          showToast.error(
            'Unable to resolve your user identity. Sign out/in and try again.'
          );
          return;
        }

        setIsResolvingNotionLink(true);
        try {
          const resolved = await resolveNotionLink(userId, companyId, url);
          type = 'notion';
          resolvedTitle = resolved.link.title || linkTitle || 'Notion link';
          identifier = resolved.link.identifier;
        } finally {
          setIsResolvingNotionLink(false);
        }
      } else if (!resolvedTitle) {
        showToast.error('Link title is required');
        return;
      }

      await addLink({
        companyId,
        taskId: task._id,
        type,
        url,
        title: resolvedTitle,
        ...(identifier ? { identifier } : {}),
      });
      e.currentTarget.reset();
      showToast.success('Link added');
    } catch (error) {
      if (isNotionUrl(url)) {
        showToast.error(formatNotionLinkError(error));
        return;
      }
      showToast.error('Failed to add link');
    } finally {
      setIsResolvingNotionLink(false);
    }
  };

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      await updateTask({
        companyId,
        taskId: task._id,
        notesMarkdown: formState.notes || null,
      });
      showToast.success('Notes saved');
    } catch {
      showToast.error('Failed to save notes');
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleCreatePRReview = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canUsePRReviews) return;
    if (!reviewFormState.repositoryId) return;
    if (
      !reviewFormState.prUrl.trim() ||
      !reviewFormState.baseBranch.trim() ||
      !reviewFormState.headBranch.trim()
    ) {
      return;
    }

    setIsCreatingReview(true);
    try {
      const reviewId = await createPRReview({
        companyId,
        taskId: task._id,
        repositoryId: reviewFormState.repositoryId,
        prUrl: reviewFormState.prUrl.trim(),
        baseBranch: reviewFormState.baseBranch.trim(),
        headBranch: reviewFormState.headBranch.trim(),
        title: reviewFormState.title.trim() || undefined,
      });
      showToast.success('PR review created');
      setIsCreateReviewOpen(false);
      setReviewFormState(prev => ({
        repositoryId: prev.repositoryId,
        prUrl: '',
        baseBranch: '',
        headBranch: '',
        title: '',
      }));
      navigate({ to: '/reviews/$reviewId', params: { reviewId } });
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : 'Failed to create review'
      );
    } finally {
      setIsCreatingReview(false);
    }
  };

  return (
    <div
      className={cn('space-y-8 pb-10', variant === 'pane' ? 'px-2' : 'px-0')}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Tasks</span>
          <span>/</span>
          <span className="truncate max-w-[200px]">{task.title}</span>
        </div>
        <div className="flex items-start gap-3">
          <TaskTriStateButton
            state={triState}
            aria-label={`Set task ${task.title} to ${nextTriState}`}
            onClick={() => {
              const nextStatus = triStateToStatus(nextTriState);
              setFormState(prev => ({ ...prev, status: nextStatus }));
              handleUpdate({ status: nextStatus });
            }}
          />
          <Input
            value={formState.title}
            onChange={e =>
              setFormState(prev => ({ ...prev, title: e.target.value }))
            }
            onBlur={() => handleUpdate({ title: formState.title })}
            className="text-2xl font-bold border-none px-0 focus-visible:ring-0 h-auto py-1"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarIcon className="h-4 w-4" />
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 px-2',
                  !formState.dueDate && 'text-muted-foreground'
                )}
              >
                {formState.dueDate
                  ? format(formState.dueDate, 'PPP')
                  : 'Date and reminder'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-4 text-sm text-center">
                <Input
                  type="date"
                  value={
                    formState.dueDate
                      ? format(formState.dueDate, 'yyyy-MM-dd')
                      : ''
                  }
                  onChange={e => {
                    const date = e.target.value
                      ? new Date(e.target.value)
                      : undefined;
                    setFormState(prev => ({ ...prev, dueDate: date }));
                    handleUpdate({ dueDate: date?.getTime() || null });
                  }}
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Notes
          </Label>
          <Button
            size="sm"
            onClick={handleSaveNotes}
            disabled={isSavingNotes}
            variant="ghost"
          >
            {isSavingNotes && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
        </div>
        <MDXMarkdownEditor
          markdown={formState.notes}
          onChange={notes => setFormState(prev => ({ ...prev, notes }))}
          placeholder="Add details, acceptance criteria..."
          minHeight="200px"
          variant="minimal"
          className="rounded-none"
        />
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-x-8 gap-y-6">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Status
          </Label>
          <Select
            value={formState.status}
            onValueChange={(val: TaskStatus) => {
              setFormState(prev => ({ ...prev, status: val }));
              handleUpdate({ status: val });
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">Todo</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="done">Done</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 col-span-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Complexity
            </Label>
            <span className="text-sm font-medium">{formState.complexity}</span>
          </div>
          <Slider
            value={[formState.complexity]}
            min={1}
            max={10}
            step={1}
            onValueChange={([val]) =>
              setFormState(prev => ({ ...prev, complexity: val ?? 1 }))
            }
            onValueCommit={([val]) =>
              handleUpdate({ complexityScore: val ?? null })
            }
            className="py-4"
          />
        </div>

        <div className="space-y-2 col-span-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Tags
          </Label>
          <div className="flex flex-wrap gap-2">
            {tags?.map(tag => (
              <Badge
                key={tag._id}
                variant={
                  formState.selectedTags.includes(tag._id)
                    ? 'default'
                    : 'outline'
                }
                className="cursor-pointer"
                onClick={() => {
                  const next = formState.selectedTags.includes(tag._id)
                    ? formState.selectedTags.filter(id => id !== tag._id)
                    : [...formState.selectedTags, tag._id];
                  setFormState(prev => ({ ...prev, selectedTags: next }));
                  handleUpdate({ tagIds: next });
                }}
                style={
                  formState.selectedTags.includes(tag._id)
                    ? { backgroundColor: tag.color || undefined }
                    : {}
                }
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {canUseSessions && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Session Insights
              </Label>
              <Badge variant="outline">
                {sessionMetadata
                  ? `${sessionMetadata.sessionCount} session${
                      sessionMetadata.sessionCount === 1 ? '' : 's'
                    }`
                  : 'Loading...'}
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">
                  Tracked on this task
                </p>
                <p className="text-lg font-semibold">
                  {sessionMetadata && hasSessionMetadata
                    ? formatDurationMs(sessionMetadata.totalTrackedMs)
                    : '--'}
                </p>
                <p className="text-xs text-muted-foreground">Across sessions</p>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Paused time</p>
                <p className="text-lg font-semibold">
                  {sessionMetadata && hasSessionMetadata
                    ? formatDurationMs(sessionMetadata.totalPausedMs)
                    : '--'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sessionMetadata
                    ? `${sessionMetadata.pauseCount} pause${
                        sessionMetadata.pauseCount === 1 ? '' : 's'
                      }`
                    : '--'}
                </p>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Session count</p>
                <p className="text-lg font-semibold">
                  {sessionMetadata ? sessionMetadata.sessionCount : '--'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Running or paused
                </p>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Last session</p>
                <p className="text-lg font-semibold">
                  {sessionMetadata &&
                  hasSessionMetadata &&
                  sessionMetadata.lastSessionAt
                    ? formatShortDateTime(sessionMetadata.lastSessionAt)
                    : '--'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Task time{' '}
                  {sessionMetadata && hasSessionMetadata
                    ? formatDurationMs(
                        sessionMetadata.lastSessionTaskDurationMs
                      )
                    : '--'}
                </p>
              </div>
            </div>

            {!hasSessionMetadata && sessionMetadata && (
              <p className="text-sm text-muted-foreground">
                No session activity yet. Start a session to track time on this
                task.
              </p>
            )}
          </div>
        </>
      )}

      {canUsePRReviews && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <GitPullRequest className="h-3 w-3" /> PR Reviews
              </Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsCreateReviewOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Start PR review
              </Button>
            </div>

            {prReviews === undefined ? (
              <div className="space-y-2">
                <div className="h-10 rounded bg-muted animate-pulse" />
                <div className="h-10 rounded bg-muted animate-pulse" />
              </div>
            ) : prReviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No PR reviews linked to this task yet.
              </p>
            ) : (
              <div className="space-y-2">
                {prReviews.map(review => (
                  <Link
                    key={review._id}
                    to="/reviews/$reviewId"
                    params={{ reviewId: review._id }}
                    className="block"
                  >
                    <div className="flex items-center justify-between gap-3 p-2 rounded-md border bg-muted/30 hover:bg-muted/50">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {review.title || 'Untitled review'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {review.prUrl}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">
                        {formatShortDateTime(review.createdAt)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <Dialog
        open={canUsePRReviews ? isCreateReviewOpen : false}
        onOpenChange={setIsCreateReviewOpen}
      >
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Start PR review</DialogTitle>
            <DialogDescription>
              This review will be linked to{' '}
              <span className="font-medium">{task.title}</span>.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleCreatePRReview}
            className="grid gap-4 md:grid-cols-2"
          >
            <div className="space-y-2">
              <Label>Repository</Label>
              <Select
                value={reviewFormState.repositoryId}
                onValueChange={val =>
                  setReviewFormState(prev => ({
                    ...prev,
                    repositoryId: val as Id<'repositories'>,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a repository" />
                </SelectTrigger>
                <SelectContent>
                  {repositories === undefined ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Loading...
                    </div>
                  ) : repositories && repositories.length > 0 ? (
                    repositories.map(repo => (
                      <SelectItem key={repo._id} value={repo._id}>
                        {repo.name}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      No repositories found
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>PR URL</Label>
              <Input
                placeholder="https://github.com/org/repo/pull/123"
                value={reviewFormState.prUrl}
                onChange={e =>
                  setReviewFormState(prev => ({
                    ...prev,
                    prUrl: e.target.value,
                  }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Base branch</Label>
              <Input
                placeholder="main"
                value={reviewFormState.baseBranch}
                onChange={e =>
                  setReviewFormState(prev => ({
                    ...prev,
                    baseBranch: e.target.value,
                  }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Head branch</Label>
              <Input
                placeholder="feature/my-change"
                value={reviewFormState.headBranch}
                onChange={e =>
                  setReviewFormState(prev => ({
                    ...prev,
                    headBranch: e.target.value,
                  }))
                }
                required
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Title (optional)</Label>
              <Input
                placeholder="Short summary"
                value={reviewFormState.title}
                onChange={e =>
                  setReviewFormState(prev => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
              />
            </div>

            <DialogFooter className="md:col-span-2">
              <Button type="submit" disabled={isCreatingReview}>
                {isCreatingReview && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create review
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Separator />

      <div className="space-y-4">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <LinkIcon className="h-3 w-3" /> External Links
        </Label>

        <div className="space-y-2">
          {externalLinks.map(link => (
            <div
              key={link._id}
              className="flex items-center justify-between group p-2 rounded-md border bg-muted/30"
            >
              <div className="flex items-center gap-3 min-w-0">
                <ExternalLinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{link.title}</p>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline truncate block"
                  >
                    {link.url}
                  </a>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeLink({ companyId, linkId: link._id })}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <form
          onSubmit={handleAddLink}
          className="flex flex-col gap-2 p-3 border rounded-md bg-muted/20"
        >
          <Input
            name="title"
            placeholder="Link title (optional for Notion URLs)"
            className="h-8 text-sm"
          />
          <div className="flex gap-2">
            <Input
              name="url"
              placeholder="https://..."
              className="h-8 text-sm flex-1"
              required
            />
            <Button
              type="submit"
              size="sm"
              className="h-8"
              disabled={isResolvingNotionLink}
            >
              {isResolvingNotionLink && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Notion links are validated automatically when the workspace is
            connected.
          </p>
        </form>
      </div>
    </div>
  );
}
