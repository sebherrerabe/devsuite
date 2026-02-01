import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { showToast } from '@/lib/toast';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmojiPickerWrapper } from '@/components/ui/emoji-picker';
import { cn } from '@/lib/utils';

const PROJECT_COLORS = [
  { name: 'Slate', value: '#64748b' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Violet', value: '#8b5cf6' },
];

interface ProjectCreationDialogProps {
  companyId: Id<'companies'>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (projectId: Id<'projects'>) => void;
}

export function ProjectCreationDialog({
  companyId,
  open,
  onOpenChange,
  onSuccess,
}: ProjectCreationDialogProps) {
  const createProject = useMutation(api.projects.createProject);
  const repositories = useQuery(
    api.repositories.getByCompany,
    companyId ? { companyId } : 'skip'
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedRepoIds, setSelectedRepoIds] = useState<Id<'repositories'>[]>(
    []
  );
  const [color, setColor] = useState(PROJECT_COLORS[0]?.value || '#64748b');
  const [emoji, setEmoji] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const projectId = await createProject({
        companyId,
        name: name.trim(),
        description: description.trim() || undefined,
        repositoryIds: selectedRepoIds,
        color,
        emoji: emoji.trim() || undefined,
      });
      showToast.success('Project created successfully');
      onOpenChange(false);
      resetForm();
      onSuccess?.(projectId);
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : 'Failed to create project'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setSelectedRepoIds([]);
    setColor(PROJECT_COLORS[0]?.value || '#64748b');
    setEmoji('');
  };

  const toggleRepo = (repoId: Id<'repositories'>) => {
    if (!repositories) return;
    setSelectedRepoIds(prev =>
      prev.includes(repoId)
        ? prev.filter(id => id !== repoId)
        : [...prev, repoId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>
            Create a new workspace for your project.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="space-y-2">
            <label htmlFor="project-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="project-name"
              placeholder="e.g. Acme Redesign"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="project-description"
              className="text-sm font-medium"
            >
              Description (optional)
            </label>
            <Textarea
              id="project-description"
              placeholder="What is this project about?"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="project-emoji" className="text-sm font-medium">
              Emoji / Icon (optional)
            </label>
            <EmojiPickerWrapper
              value={emoji}
              onChange={setEmoji}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Select an emoji to identify your project
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Color</label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  className={cn(
                    'h-8 w-8 rounded-full border-2 transition-all',
                    color === c.value
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-transparent'
                  )}
                  style={{ backgroundColor: c.value }}
                  onClick={() => setColor(c.value)}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">
              Repositories (optional)
            </label>
            <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto p-1 border rounded-md">
              {repositories === undefined ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
              ) : !repositories || repositories.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">
                  No repositories found. Add some in settings first.
                </p>
              ) : (
                repositories.map(repo => (
                  <Badge
                    key={repo._id}
                    variant={
                      selectedRepoIds.includes(repo._id) ? 'default' : 'outline'
                    }
                    className="cursor-pointer"
                    onClick={() => repo && toggleRepo(repo._id)}
                  >
                    {repo.name}
                  </Badge>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
