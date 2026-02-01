import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useCurrentCompany } from '@/lib/company-context';
import { useState, useMemo, type MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Search,
  MoreHorizontal,
  Pin,
  PinOff,
  Settings,
  Archive,
  Star,
  Loader2,
  Filter,
} from 'lucide-react';
import { ProjectCreationDialog } from '@/components/project-creation-dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { showToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { Id } from '../../../../convex/_generated/dataModel';

export const Route = createFileRoute('/_app/projects/')({
  component: ProjectsPage,
});

function ProjectsPage() {
  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?._id;
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [repoFilter, setRepoFilter] = useState<Id<'repositories'> | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const projects = useQuery(
    api.projects.listProjects,
    companyId ? { companyId, includeArchived: showArchived } : 'skip'
  );
  const repositories = useQuery(
    api.repositories.getByCompany,
    companyId ? { companyId } : 'skip'
  );
  const updateProject = useMutation(api.projects.updateProject);
  const softDeleteProject = useMutation(api.projects.softDeleteProject);

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    return projects.filter(project => {
      const matchesSearch =
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (project.slug &&
          project.slug.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesRepo =
        !repoFilter || project.repositoryIds.includes(repoFilter);
      return matchesSearch && matchesRepo;
    });
  }, [projects, searchQuery, repoFilter]);

  const pinnedProjects = useMemo(
    () => filteredProjects.filter(p => p.isPinned && !p.deletedAt),
    [filteredProjects]
  );

  const allOtherProjects = useMemo(
    () => filteredProjects.filter(p => !p.isPinned || p.deletedAt),
    [filteredProjects]
  );

  const togglePin = async (
    e: MouseEvent,
    projectId: Id<'projects'>,
    currentPinned: boolean,
    isArchived: boolean
  ) => {
    e.stopPropagation();
    if (isArchived) {
      showToast.error('Cannot pin archived projects');
      return;
    }
    try {
      await updateProject({ id: projectId, isPinned: !currentPinned });
      showToast.success(currentPinned ? 'Project unpinned' : 'Project pinned');
    } catch {
      showToast.error('Failed to update project');
    }
  };

  if (!companyId) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Manage and track all your active projects.
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            className="pl-8"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                {repoFilter
                  ? repositories?.find(r => r._id === repoFilter)?.name
                  : 'All Repositories'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuItem onClick={() => setRepoFilter(null)}>
                All Repositories
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {repositories?.map(repo => (
                <DropdownMenuItem
                  key={repo._id}
                  onClick={() => setRepoFilter(repo._id)}
                >
                  {repo.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant={showArchived ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
          >
            <Archive className="mr-2 h-4 w-4" />
            {showArchived ? 'Show Active' : 'Show Archived'}
          </Button>
        </div>
      </div>

      {projects === undefined ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center border border-dashed rounded-lg">
          <p className="text-muted-foreground">No projects found.</p>
          <Button variant="link" onClick={() => setIsCreateDialogOpen(true)}>
            Create your first project
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {pinnedProjects.length > 0 && !showArchived && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Pinned
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pinnedProjects.map(project => (
                  <Card
                    key={project._id}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() =>
                      navigate({
                        to: '/projects/$projectId/tasks',
                        params: { projectId: project._id },
                      })
                    }
                  >
                    <CardContent className="p-4 flex items-start justify-between">
                      <div className="flex gap-3">
                        <div
                          className="w-1 h-10 rounded-full shrink-0"
                          style={{
                            backgroundColor: project.color || '#64748b',
                          }}
                        />
                        <div>
                          <h3 className="font-semibold leading-none mb-1 flex items-center gap-2">
                            {project.emoji && (
                              <span className="text-base leading-none">
                                {project.emoji}
                              </span>
                            )}
                            {project.name}
                          </h3>
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {project.slug}
                          </p>
                          <div className="mt-2 flex gap-1">
                            {project.repositoryIds.length > 0 && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1 py-0 h-4"
                              >
                                {project.repositoryIds.length} Repos
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-amber-500"
                        onClick={e => togglePin(e, project._id, true, false)}
                      >
                        <Pin className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {showArchived ? 'Archived Projects' : 'All Projects'}
            </h2>
            <div className="border rounded-md overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Repositories</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allOtherProjects.map(project => (
                    <TableRow
                      key={project._id}
                      className={cn(
                        'group',
                        !project.deletedAt && 'cursor-pointer'
                      )}
                      onClick={() => {
                        if (project.deletedAt) {
                          showToast.error('Cannot open archived projects');
                          return;
                        }
                        navigate({
                          to: '/projects/$projectId/tasks',
                          params: { projectId: project._id },
                        });
                      }}
                    >
                      <TableCell className="text-center px-2 w-[60px]">
                        <div className="flex items-center justify-center gap-1.5 w-full">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{
                              backgroundColor: project.color || '#64748b',
                            }}
                          />
                          <span className="text-base leading-none w-5 text-center">
                            {project.emoji || '\u200B'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {project.name}
                          {project.isFavorite && (
                            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {project.slug}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="text-sm">
                            {project.repositoryIds.length}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Intl.DateTimeFormat('en-US', {
                          dateStyle: 'medium',
                        }).format(new Date(project.updatedAt))}
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              disabled={project.deletedAt !== null}
                              onClick={e =>
                                togglePin(
                                  e,
                                  project._id,
                                  !!project.isPinned,
                                  !!project.deletedAt
                                )
                              }
                            >
                              {project.isPinned ? (
                                <PinOff className="mr-2 h-4 w-4" />
                              ) : (
                                <Pin className="mr-2 h-4 w-4" />
                              )}
                              {project.isPinned ? 'Unpin' : 'Pin'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={project.deletedAt !== null}
                              onClick={() => {
                                if (project.deletedAt) {
                                  showToast.error(
                                    'Cannot edit archived projects'
                                  );
                                  return;
                                }
                                navigate({
                                  to: '/projects/$projectId/settings',
                                  params: { projectId: project._id },
                                });
                              }}
                            >
                              <Settings className="mr-2 h-4 w-4" />
                              Settings
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              disabled={project.deletedAt !== null}
                              onClick={async () => {
                                try {
                                  await softDeleteProject({ id: project._id });
                                  showToast.success('Project archived');
                                } catch {
                                  showToast.error('Failed to update project');
                                }
                              }}
                            >
                              <Archive className="mr-2 h-4 w-4" />
                              Archive
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      )}

      <ProjectCreationDialog
        companyId={companyId}
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={id =>
          navigate({
            to: '/projects/$projectId/tasks',
            params: { projectId: id },
          })
        }
      />
    </div>
  );
}
