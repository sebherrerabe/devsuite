import { createFileRoute, useParams } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useCurrentCompany } from '@/lib/company-context';
import { useState, useEffect, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { showToast } from '@/lib/toast';
import { Loader2, Pin, Star, Archive, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Id } from '../../../../convex/_generated/dataModel';

export const Route = createFileRoute('/_app/projects/$projectId/settings')({
  component: ProjectSettingsPage,
});

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

function ProjectSettingsPage() {
  const { projectId } = useParams({
    from: '/_app/projects/$projectId/settings',
  });
  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?._id;
  const projectIdTyped = projectId as Id<'projects'>;

  const project = useQuery(api.projects.getProject, { id: projectIdTyped });
  const repositories = useQuery(
    api.repositories.getByCompany,
    companyId ? { companyId } : 'skip'
  );
  const updateProject = useMutation(api.projects.updateProject);
  const softDeleteProject = useMutation(api.projects.softDeleteProject);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('');
  const [selectedRepoIds, setSelectedRepoIds] = useState<Id<'repositories'>[]>(
    []
  );
  const [notesMarkdown, setNotesMarkdown] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || '');
      setColor(project.color || '#64748b');
      setSelectedRepoIds(project.repositoryIds || []);
      setNotesMarkdown(project.notesMarkdown || '');
    }
  }, [project]);

  const handleUpdateGeneral = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await updateProject({
        id: projectIdTyped,
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      });
      showToast.success('General settings updated');
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : 'Update failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRepos = async () => {
    setIsSubmitting(true);
    try {
      await updateProject({
        id: projectIdTyped,
        repositoryIds: selectedRepoIds,
      });
      showToast.success('Repositories updated');
    } catch {
      showToast.error('Update failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateNotes = async () => {
    setIsSubmitting(true);
    try {
      await updateProject({
        id: projectIdTyped,
        notesMarkdown: notesMarkdown || undefined,
      });
      showToast.success('Notes saved');
    } catch {
      showToast.error('Failed to save notes');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleRepo = (repoId: Id<'repositories'>) => {
    setSelectedRepoIds(prev =>
      prev.includes(repoId)
        ? prev.filter(id => id !== repoId)
        : [...prev, repoId]
    );
  };

  if (!project) return null;

  return (
    <div className="py-6 space-y-8 max-w-4xl">
      <div className="grid gap-8 md:grid-cols-2">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>
              Basic information about your project.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateGeneral} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Color</label>
                <div className="flex flex-wrap gap-2">
                  {PROJECT_COLORS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      className={cn(
                        'h-6 w-6 rounded-full border-2',
                        color === c.value
                          ? 'border-primary'
                          : 'border-transparent'
                      )}
                      style={{ backgroundColor: c.value }}
                      onClick={() => setColor(c.value)}
                    />
                  ))}
                </div>
              </div>
              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await updateProject({
                      id: projectIdTyped,
                      isPinned: !project.isPinned,
                    });
                    showToast.success(project.isPinned ? 'Unpinned' : 'Pinned');
                  }}
                >
                  <Pin
                    className={cn(
                      'mr-2 h-4 w-4',
                      project.isPinned && 'fill-current'
                    )}
                  />
                  {project.isPinned ? 'Unpin' : 'Pin'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await updateProject({
                      id: projectIdTyped,
                      isFavorite: !project.isFavorite,
                    });
                    showToast.success(
                      project.isFavorite
                        ? 'Removed from favorites'
                        : 'Added to favorites'
                    );
                  }}
                >
                  <Star
                    className={cn(
                      'mr-2 h-4 w-4',
                      project.isFavorite && 'fill-current text-amber-500'
                    )}
                  />
                  {project.isFavorite ? 'Unfavorite' : 'Favorite'}
                </Button>
              </div>
            </form>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button size="sm" type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save General
            </Button>
          </CardFooter>
        </Card>

        {/* Repositories */}
        <Card>
          <CardHeader>
            <CardTitle>Repositories</CardTitle>
            <CardDescription>
              Link repositories to this project.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 min-h-[100px] p-2 border rounded-md overflow-y-auto">
                {repositories?.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No repositories available.
                  </p>
                ) : (
                  repositories?.map(repo => (
                    <Badge
                      key={repo._id}
                      variant={
                        selectedRepoIds.includes(repo._id)
                          ? 'default'
                          : 'outline'
                      }
                      className="cursor-pointer"
                      onClick={() => toggleRepo(repo._id)}
                    >
                      {repo.name}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button
              size="sm"
              onClick={handleUpdateRepos}
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Update Repositories
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Notes (Scratchpad) */}
      <Card>
        <CardHeader>
          <CardTitle>Notes (Scratchpad)</CardTitle>
          <CardDescription>
            Quick markdown notes for this project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notesMarkdown}
            onChange={e => setNotesMarkdown(e.target.value)}
            placeholder="# Project Notes..."
            className="min-h-[300px] font-mono text-sm"
          />
        </CardContent>
        <CardFooter className="border-t px-6 py-4 flex justify-between">
          <p className="text-xs text-muted-foreground">Markdown supported</p>
          <Button size="sm" onClick={handleUpdateNotes} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save Notes
          </Button>
        </CardFooter>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions for this project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Archive Project</p>
              <p className="text-sm text-muted-foreground">
                Mark this project as inactive. You can restore it later.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await softDeleteProject({ id: projectIdTyped });
                showToast.success('Project archived');
              }}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
