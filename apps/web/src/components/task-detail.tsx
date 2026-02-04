import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { TaskStatus } from '@devsuite/shared';
import type { Id } from '../../../../convex/_generated/dataModel';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  Loader2,
} from 'lucide-react';
import { MDXMarkdownEditor } from '@/components/markdown/mdx-markdown-editor';
import { TaskTriStateButton } from '@/components/task-tristate-button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { useState, type FormEvent } from 'react';
import { cn } from '@/lib/utils';
import { showToast } from '@/lib/toast';
import type { Doc } from '../../../../convex/_generated/dataModel';
import { formatDurationMs, formatShortDateTime } from '@/lib/time';
import {
  getNextTriState,
  getTriState,
  triStateToStatus,
} from '@/lib/task-tristate';

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
      key={task._id}
      task={task}
      companyId={companyId}
      externalLinks={externalLinks ?? []}
      tags={tags ?? []}
      variant={variant}
    />
  );
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
  const updateTask = useMutation(api.tasks.updateTask);
  const addLink = useMutation(api.externalLinks.addExternalLink);
  const removeLink = useMutation(api.externalLinks.removeExternalLink);
  const sessionMetadata = useQuery(api.sessions.getTaskSessionMetadata, {
    companyId,
    taskId: task._id,
  });

  const [formState, setFormState] = useState(() => ({
    title: task.title,
    notes: task.notesMarkdown || '',
    status: task.status as TaskStatus,
    complexity: task.complexityScore || 1,
    dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
    selectedTags: task.tagIds ?? [],
  }));
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const hasSessionMetadata = (sessionMetadata?.sessionCount ?? 0) > 0;
  const triState = getTriState(formState.status);
  const nextTriState = getNextTriState(triState);

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
    const url = formData.get('url') as string;
    const linkTitle = formData.get('title') as string;

    if (!url || !linkTitle) return;

    try {
      await addLink({
        companyId,
        taskId: task._id,
        type: 'url',
        url,
        title: linkTitle,
      });
      e.currentTarget.reset();
      showToast.success('Link added');
    } catch {
      showToast.error('Failed to add link');
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
            <p className="text-xs text-muted-foreground">Running or paused</p>
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
                ? formatDurationMs(sessionMetadata.lastSessionTaskDurationMs)
                : '--'}
            </p>
          </div>
        </div>

        {!hasSessionMetadata && sessionMetadata && (
          <p className="text-sm text-muted-foreground">
            No session activity yet. Start a session to track time on this task.
          </p>
        )}
      </div>

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
            placeholder="Link title (e.g. GitHub PR)"
            className="h-8 text-sm"
            required
          />
          <div className="flex gap-2">
            <Input
              name="url"
              placeholder="https://..."
              className="h-8 text-sm flex-1"
              required
            />
            <Button type="submit" size="sm" className="h-8">
              Add
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
