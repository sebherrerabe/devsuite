import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { Id, Doc } from '../../../../convex/_generated/dataModel';
import type { RepositoryProvider } from '@devsuite/shared';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { showToast } from '@/lib/toast';
import {
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash,
  ExternalLink,
} from 'lucide-react';

interface CompanyRepositoriesProps {
  companyId: Id<'companies'>;
}

export function CompanyRepositories({ companyId }: CompanyRepositoriesProps) {
  const repositories = useQuery(api.repositories.getByCompany, { companyId });
  const createRepository = useMutation(api.repositories.create);
  const updateRepository = useMutation(api.repositories.update);
  const removeRepository = useMutation(api.repositories.remove);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedRepository, setSelectedRepository] =
    useState<Doc<'repositories'> | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [provider, setProvider] = useState<RepositoryProvider>('other');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    setIsSubmitting(true);
    try {
      await createRepository({
        companyId,
        name: name.trim(),
        url: url.trim(),
        provider,
      });
      showToast.success('Repository added successfully');
      setIsCreateOpen(false);
      resetForm();
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : 'Failed to add repository'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim() || !selectedRepository) return;

    setIsSubmitting(true);
    try {
      await updateRepository({
        id: selectedRepository._id,
        name: name.trim(),
        url: url.trim(),
        provider,
      });
      showToast.success('Repository updated successfully');
      setIsEditOpen(false);
      setSelectedRepository(null);
      resetForm();
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : 'Failed to update repository'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRepository) return;

    setIsSubmitting(true);
    try {
      await removeRepository({ id: selectedRepository._id });
      showToast.success('Repository deleted successfully');
      setIsDeleteOpen(false);
      setSelectedRepository(null);
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : 'Failed to delete repository'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setUrl('');
    setProvider('other');
  };

  const openEdit = (repository: Doc<'repositories'>) => {
    setSelectedRepository(repository);
    setName(repository.name);
    setUrl(repository.url);
    setProvider(repository.provider);
    setIsEditOpen(true);
  };

  const openDelete = (repository: Doc<'repositories'>) => {
    setSelectedRepository(repository);
    setIsDeleteOpen(true);
  };

  const openCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-md font-medium">Repositories</h4>
          <p className="text-sm text-muted-foreground">
            Manage repositories linked to this company.
          </p>
        </div>
        <Button onClick={openCreate} size="sm" type="button">
          <Plus className="mr-2 h-4 w-4" />
          Add Repository
        </Button>
      </div>

      {repositories === undefined ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : repositories.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center space-y-2 border border-dashed rounded-lg">
          <p className="text-sm text-muted-foreground">No repositories added</p>
          <Button
            variant="outline"
            size="sm"
            onClick={openCreate}
            type="button"
          >
            Add your first repository
          </Button>
        </div>
      ) : (
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repositories.map((repository: Doc<'repositories'>) => (
                <TableRow key={repository._id}>
                  <TableCell className="font-medium">
                    {repository.name}
                  </TableCell>
                  <TableCell>
                    <a
                      href={repository.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline max-w-[300px]"
                      title={repository.url}
                    >
                      <span className="truncate">{repository.url}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </TableCell>
                  <TableCell className="capitalize">
                    {repository.provider}
                  </TableCell>
                  <TableCell>
                    {new Intl.DateTimeFormat('en-US', {
                      dateStyle: 'medium',
                    }).format(new Date(repository.createdAt))}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          type="button"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(repository)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openDelete(repository)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Repository</DialogTitle>
            <DialogDescription>
              Add a repository to link with this company.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="repo-name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="repo-name"
                placeholder="my-repo"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="repo-url" className="text-sm font-medium">
                URL
              </label>
              <Input
                id="repo-url"
                placeholder="https://github.com/org/repo"
                value={url}
                onChange={e => setUrl(e.target.value)}
                type="url"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="repo-provider" className="text-sm font-medium">
                Provider
              </label>
              <Select
                value={provider}
                onValueChange={val => setProvider(val as RepositoryProvider)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="github">GitHub</SelectItem>
                  <SelectItem value="gitlab">GitLab</SelectItem>
                  <SelectItem value="bitbucket">Bitbucket</SelectItem>
                  <SelectItem value="azure_devops">Azure DevOps</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !name.trim() || !url.trim()}
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add Repository
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Repository</DialogTitle>
            <DialogDescription>
              Update repository information.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="edit-repo-name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="edit-repo-name"
                placeholder="my-repo"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-repo-url" className="text-sm font-medium">
                URL
              </label>
              <Input
                id="edit-repo-url"
                placeholder="https://github.com/org/repo"
                value={url}
                onChange={e => setUrl(e.target.value)}
                type="url"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="edit-repo-provider"
                className="text-sm font-medium"
              >
                Provider
              </label>
              <Select
                value={provider}
                onValueChange={val => setProvider(val as RepositoryProvider)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="github">GitHub</SelectItem>
                  <SelectItem value="gitlab">GitLab</SelectItem>
                  <SelectItem value="bitbucket">Bitbucket</SelectItem>
                  <SelectItem value="azure_devops">Azure DevOps</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !name.trim() || !url.trim()}
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Repository</DialogTitle>
            <DialogDescription className="text-destructive">
              Are you sure you want to delete{' '}
              <strong>{selectedRepository?.name}</strong>? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
