import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import type { Id } from '../../../../convex/_generated/dataModel';
import { api } from '../../../../convex/_generated/api';
import { useCurrentCompany } from '@/lib/company-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MDXMarkdownEditor } from '@/components/markdown/mdx-markdown-editor';
import { Loader2, Save, ExternalLink, Trash2 } from 'lucide-react';
import { showToast } from '@/lib/toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export const Route = createFileRoute('/_app/reviews/$reviewId')({
  component: ReviewDetailPage,
});

function ReviewDetailPage() {
  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?._id;
  const navigate = useNavigate();
  const { reviewId } = Route.useParams();

  const repositories = useQuery(
    api.repositories.getByCompany,
    companyId ? { companyId } : 'skip'
  );

  const review = useQuery(
    api.prReviews.getPRReview,
    companyId ? { companyId, reviewId: reviewId as Id<'prReviews'> } : 'skip'
  );

  const updateReview = useMutation(api.prReviews.updatePRReview);
  const deleteReview = useMutation(api.prReviews.softDeletePRReview);

  const [formState, setFormState] = useState(() => ({
    repositoryId: '' as Id<'repositories'> | '',
    prUrl: '',
    baseBranch: '',
    headBranch: '',
    title: '',
    contentMarkdown: '',
  }));

  const [isSavingContent, setIsSavingContent] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  useEffect(() => {
    if (!review) return;
    setFormState({
      repositoryId: review.repositoryId,
      prUrl: review.prUrl,
      baseBranch: review.baseBranch,
      headBranch: review.headBranch,
      title: review.title ?? '',
      contentMarkdown: review.contentMarkdown ?? '',
    });
  }, [review]);

  const handleUpdate = async (
    updates: Partial<{
      repositoryId: Id<'repositories'>;
      prUrl: string;
      baseBranch: string;
      headBranch: string;
      title: string;
      contentMarkdown: string;
    }>
  ) => {
    if (!companyId || !review) return;
    try {
      await updateReview({
        companyId,
        reviewId: review._id,
        ...updates,
      });
    } catch {
      showToast.error('Failed to update review');
    }
  };

  const handleSaveContent = async () => {
    if (!companyId || !review) return;
    setIsSavingContent(true);
    try {
      await updateReview({
        companyId,
        reviewId: review._id,
        contentMarkdown: formState.contentMarkdown,
      });
      showToast.success('Review notes saved');
    } catch {
      showToast.error('Failed to save review');
    } finally {
      setIsSavingContent(false);
    }
  };

  const handleDelete = async () => {
    if (!companyId || !review) return;
    try {
      await deleteReview({ companyId, reviewId: review._id });
      showToast.success('Review deleted');
      navigate({ to: '/reviews' });
    } catch {
      showToast.error('Failed to delete review');
    } finally {
      setIsDeleteOpen(false);
    }
  };

  if (!companyId) return null;

  if (review === undefined) {
    return (
      <div className="space-y-4">
        <div className="text-xs text-muted-foreground">
          PR Reviews / Loading
        </div>
        <div className="h-7 w-2/3 rounded bg-muted animate-pulse" />
        <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  if (!review) {
    return (
      <div className="text-sm text-muted-foreground">Review not found.</div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>PR Reviews</span>
          <span>/</span>
          <span className="truncate max-w-[240px]">
            {review.title || 'Untitled review'}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Input
            value={formState.title}
            onChange={e =>
              setFormState(prev => ({ ...prev, title: e.target.value }))
            }
            onBlur={() => handleUpdate({ title: formState.title })}
            placeholder="Untitled review"
            className="text-2xl font-bold border-none px-0 focus-visible:ring-0 h-auto py-1 w-full md:w-auto"
          />
          <div className="flex items-center gap-2">
            {review.prUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={review.prUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open PR
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Repository
          </Label>
          <Select
            value={formState.repositoryId}
            onValueChange={val => {
              const repoId = val as Id<'repositories'>;
              setFormState(prev => ({ ...prev, repositoryId: repoId }));
              handleUpdate({ repositoryId: repoId });
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select repository" />
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
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            PR URL
          </Label>
          <Input
            value={formState.prUrl}
            onChange={e =>
              setFormState(prev => ({ ...prev, prUrl: e.target.value }))
            }
            onBlur={() => handleUpdate({ prUrl: formState.prUrl })}
            placeholder="https://github.com/org/repo/pull/123"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Base branch
          </Label>
          <Input
            value={formState.baseBranch}
            onChange={e =>
              setFormState(prev => ({ ...prev, baseBranch: e.target.value }))
            }
            onBlur={() => handleUpdate({ baseBranch: formState.baseBranch })}
            placeholder="main"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Head branch
          </Label>
          <Input
            value={formState.headBranch}
            onChange={e =>
              setFormState(prev => ({ ...prev, headBranch: e.target.value }))
            }
            onBlur={() => handleUpdate({ headBranch: formState.headBranch })}
            placeholder="feature/my-change"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Review notes
          </Label>
          <Button
            size="sm"
            onClick={handleSaveContent}
            disabled={isSavingContent}
            variant="ghost"
          >
            {isSavingContent && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
        </div>
        <MDXMarkdownEditor
          markdown={formState.contentMarkdown}
          onChange={markdown =>
            setFormState(prev => ({ ...prev, contentMarkdown: markdown }))
          }
          placeholder="Write your PR review notes..."
          minHeight="280px"
          variant="minimal"
          className="rounded-none"
        />
      </div>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this review?</AlertDialogTitle>
            <AlertDialogDescription>
              This will soft-delete the review and remove it from the list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 border-none"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
