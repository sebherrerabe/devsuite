import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import type { Doc } from '../../../../convex/_generated/dataModel';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { showToast } from '@/lib/toast';
import { Loader2, MoreHorizontal, Pencil, Plus, Trash } from 'lucide-react';

interface TagsSettingsProps {
  companyId: Id<'companies'>;
}

export function TagsSettings({ companyId }: TagsSettingsProps) {
  const tags = useQuery(api.tags.listTagsByCompany, { companyId });
  const createTag = useMutation(api.tags.createTag);
  const updateTag = useMutation(api.tags.updateTag);
  const deleteTag = useMutation(api.tags.softDeleteTag);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [selectedTag, setSelectedTag] = useState<Doc<'tags'> | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await createTag({
        companyId,
        name: name.trim(),
        color: color || null,
      });
      showToast.success('Tag created successfully');
      setIsCreateOpen(false);
      setName('');
      setColor(null);
    } catch (err) {
      showToast.error(
        err instanceof Error ? err.message : 'Failed to create tag'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || !selectedTag) return;

    setIsSubmitting(true);
    try {
      await updateTag({
        companyId,
        tagId: selectedTag._id,
        name: name.trim(),
        color: color || null,
      });
      showToast.success('Tag updated successfully');
      setIsEditOpen(false);
      setSelectedTag(null);
      setName('');
      setColor(null);
    } catch (err) {
      showToast.error(
        err instanceof Error ? err.message : 'Failed to update tag'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTag) return;

    setIsSubmitting(true);
    try {
      await deleteTag({ companyId, tagId: selectedTag._id });
      showToast.success('Tag archived successfully');
      setIsDeleteOpen(false);
      setSelectedTag(null);
    } catch (err) {
      showToast.error(
        err instanceof Error ? err.message : 'Failed to archive tag'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (tag: Doc<'tags'>) => {
    setSelectedTag(tag);
    setName(tag.name);
    setColor(tag.color);
    setIsEditOpen(true);
  };

  const openDelete = (tag: Doc<'tags'>) => {
    setSelectedTag(tag);
    setIsDeleteOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Tags</h3>
          <p className="text-sm text-muted-foreground">
            Manage tags used for categorizing tasks.
          </p>
        </div>
        <Button
          onClick={() => {
            setName('');
            setColor(null);
            setIsCreateOpen(true);
          }}
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Tag
        </Button>
      </div>

      <div className="h-px bg-border" />

      {tags === undefined ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tags.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center space-y-2 border border-dashed rounded-lg bg-muted/10">
          <p className="text-muted-foreground text-sm">No tags found</p>
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag</TableHead>
                <TableHead>Color</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.map(tag => (
                <TableRow key={tag._id}>
                  <TableCell>
                    <Badge
                      variant="outline"
                      style={
                        tag.color
                          ? {
                              backgroundColor: tag.color,
                              color: '#fff',
                              borderColor: tag.color,
                            }
                          : {}
                      }
                    >
                      {tag.name}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm font-mono">
                    {tag.color || 'Default'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(tag)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openDelete(tag)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash className="mr-2 h-4 w-4" />
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
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Tag</DialogTitle>
            <DialogDescription>
              Add a new tag to organize your tasks.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="name"
                placeholder="e.g. Bug, Feature"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="color" className="text-sm font-medium">
                Color (Hex)
              </label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  className="w-12 p-1 h-10 cursor-pointer"
                  value={color || '#000000'}
                  onChange={e => setColor(e.target.value)}
                />
                <Input
                  placeholder="#000000"
                  value={color || ''}
                  onChange={e => setColor(e.target.value)}
                  className="flex-1"
                />
              </div>
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
              <Button type="submit" disabled={isSubmitting || !name.trim()}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="edit-name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="edit-name"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-color" className="text-sm font-medium">
                Color
              </label>
              <div className="flex gap-2">
                <Input
                  id="edit-color"
                  type="color"
                  className="w-12 p-1 h-10 cursor-pointer"
                  value={color || '#000000'}
                  onChange={e => setColor(e.target.value)}
                />
                <Input
                  placeholder="#000000"
                  value={color || ''}
                  onChange={e => setColor(e.target.value)}
                  className="flex-1"
                />
              </div>
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
              <Button type="submit" disabled={isSubmitting || !name.trim()}>
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
            <DialogTitle>Archive Tag</DialogTitle>
            <DialogDescription className="text-destructive">
              Are you sure you want to archive this tag? It will no longer
              appear in selection lists, but existing tasks will keep it.
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
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
