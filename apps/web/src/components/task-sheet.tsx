import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { TaskStatus } from '@devsuite/shared';
import type { Id } from '../../../../convex/_generated/dataModel';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Calendar as CalendarIcon,
  Link as LinkIcon,
  Trash2,
  ExternalLink as ExternalLinkIcon,
  Save,
  Loader2,
} from 'lucide-react';
import { MDXMarkdownEditor } from '@/components/markdown/mdx-markdown-editor';
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

interface TaskSheetProps {
  taskId: Id<'tasks'> | null;
  companyId: Id<'companies'>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskSheet({
  taskId,
  companyId,
  open,
  onOpenChange,
}: TaskSheetProps) {
  const shouldFetch = open && !!taskId;

  const task = useQuery(
    api.tasks.get,
    shouldFetch ? { companyId, taskId } : 'skip'
  );
  const externalLinks = useQuery(
    api.externalLinks.listExternalLinksByTask,
    shouldFetch ? { companyId, taskId } : 'skip'
  );
  const tags = useQuery(api.tags.listTagsByCompany, { companyId });

  // Single Sheet instance - content varies based on loading state
  // This prevents multiple Sheet animations (the root cause of flicker)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        {task === undefined ? (
          // Loading state - show skeleton inside the same Sheet
          <SheetHeader className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Tasks</span>
              <span>/</span>
              <span className="truncate max-w-[200px]">Loading…</span>
            </div>
            <SheetTitle className="text-xl">Loading…</SheetTitle>
          </SheetHeader>
        ) : !task ? (
          // Not found state
          <SheetHeader className="space-y-4">
            <SheetTitle>Task not found</SheetTitle>
          </SheetHeader>
        ) : (
          // Loaded state - render editor content
          <TaskSheetContent
            key={task._id}
            task={task}
            companyId={companyId}
            externalLinks={externalLinks ?? []}
            tags={tags ?? []}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function TaskSheetContent({
  task,
  companyId,
  externalLinks,
  tags,
}: {
  task: Doc<'tasks'>;
  companyId: Id<'companies'>;
  externalLinks: Doc<'external_links'>[];
  tags: Doc<'tags'>[];
}) {
  const updateTask = useMutation(api.tasks.updateTask);
  const addLink = useMutation(api.externalLinks.addExternalLink);
  const removeLink = useMutation(api.externalLinks.removeExternalLink);

  const [formState, setFormState] = useState(() => ({
    title: task.title,
    notes: task.notesMarkdown || '',
    status: task.status as TaskStatus,
    complexity: task.complexityScore || 1,
    dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
    selectedTags: task.tagIds ?? [],
  }));
  const [isSavingNotes, setIsSavingNotes] = useState(false);

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
    <>
      <SheetHeader className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Tasks</span>
          <span>/</span>
          <span className="truncate max-w-[200px]">{task.title}</span>
        </div>
        <div className="space-y-1">
          <SheetTitle>
            <Input
              value={formState.title}
              onChange={e =>
                setFormState(prev => ({ ...prev, title: e.target.value }))
              }
              onBlur={() => handleUpdate({ title: formState.title })}
              className="text-2xl font-bold border-none px-0 focus-visible:ring-0 h-auto py-1"
            />
          </SheetTitle>
        </div>
      </SheetHeader>

      <div className="mt-8 space-y-8 pb-10">
        {/* Properties grid */}
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

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Due Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal h-9',
                    !formState.dueDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formState.dueDate ? (
                    format(formState.dueDate, 'PPP')
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-4 text-sm text-center">
                  {/* Simplified Date Picker as Calendar component is missing */}
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

          <div className="space-y-2 col-span-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Complexity
              </Label>
              <span className="text-sm font-medium">
                {formState.complexity}
              </span>
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

        {/* External Links */}
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

        <Separator />

        {/* Notes */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Notes
            </Label>
            <div className="flex items-center gap-3">
              <p className="text-xs text-muted-foreground">
                Markdown supported
              </p>
              <Button
                size="sm"
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
                variant="outline"
              >
                {isSavingNotes && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Save className="mr-2 h-4 w-4" />
                Save Notes
              </Button>
            </div>
          </div>
          <MDXMarkdownEditor
            markdown={formState.notes}
            onChange={notes => setFormState(prev => ({ ...prev, notes }))}
            placeholder="Add details, acceptance criteria..."
            minHeight="200px"
          />
        </div>
      </div>
    </>
  );
}
