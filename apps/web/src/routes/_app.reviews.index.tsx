import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useCurrentCompany } from '@/lib/company-context';
import type { Id, Doc } from '../../../../convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Plus, ArrowUpRight } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { formatShortDateTime } from '@/lib/time';

export const Route = createFileRoute('/_app/reviews/')({
  component: ReviewsIndexPage,
});

function ReviewsIndexPage() {
  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?._id;
  const navigate = useNavigate();

  const repositories = useQuery(
    api.repositories.getByCompany,
    companyId ? { companyId } : 'skip'
  );

  const [repoFilter, setRepoFilter] = useState<Id<'repositories'> | 'all'>(
    'all'
  );
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [selectedRepositoryId, setSelectedRepositoryId] = useState<
    Id<'repositories'> | ''
  >('');
  const [prUrl, setPrUrl] = useState('');
  const [baseBranch, setBaseBranch] = useState('');
  const [headBranch, setHeadBranch] = useState('');
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const createReview = useMutation(api.prReviews.createPRReview);

  const reviewQueryArgs = useMemo(() => {
    if (!companyId) return 'skip' as const;
    const startTimestamp = startDate
      ? new Date(startDate + 'T00:00:00').getTime()
      : undefined;
    const endTimestamp = endDate
      ? new Date(endDate + 'T23:59:59').getTime()
      : undefined;
    return {
      companyId,
      repositoryId: repoFilter === 'all' ? undefined : repoFilter,
      startDate: startTimestamp,
      endDate: endTimestamp,
    };
  }, [companyId, repoFilter, startDate, endDate]);

  const reviews = useQuery(api.prReviews.listPRReviews, reviewQueryArgs);

  const repoMap = useMemo(() => {
    const map = new Map<Id<'repositories'>, Doc<'repositories'>>();
    repositories?.forEach(repo => {
      map.set(repo._id, repo);
    });
    return map;
  }, [repositories]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyId || !selectedRepositoryId) return;
    if (!prUrl.trim() || !baseBranch.trim() || !headBranch.trim()) return;

    setIsSubmitting(true);
    try {
      const reviewId = await createReview({
        companyId,
        repositoryId: selectedRepositoryId,
        prUrl: prUrl.trim(),
        baseBranch: baseBranch.trim(),
        headBranch: headBranch.trim(),
        title: title.trim() || undefined,
      });
      showToast.success('PR review created');
      setPrUrl('');
      setBaseBranch('');
      setHeadBranch('');
      setTitle('');
      setSelectedRepositoryId('');
      setIsCreateOpen(false);
      navigate({ to: '/reviews/$reviewId', params: { reviewId } });
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : 'Failed to create review'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!companyId) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PR Reviews</h1>
          <p className="text-muted-foreground">
            Track manual pull request reviews with markdown notes.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Start new review
        </Button>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Start new review</DialogTitle>
            <DialogDescription>
              Add PR metadata first, then you&apos;ll land on the detail page to
              write the review.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Repository</Label>
              <Select
                value={selectedRepositoryId}
                onValueChange={val =>
                  setSelectedRepositoryId(val as Id<'repositories'>)
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
                value={prUrl}
                onChange={e => setPrUrl(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Base branch</Label>
              <Input
                placeholder="main"
                value={baseBranch}
                onChange={e => setBaseBranch(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Head branch</Label>
              <Input
                placeholder="feature/my-change"
                value={headBranch}
                onChange={e => setHeadBranch(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Title (optional)</Label>
              <Input
                placeholder="Short summary"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            <DialogFooter className="md:col-span-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create review
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>Repository</Label>
            <Select
              value={repoFilter}
              onValueChange={val =>
                setRepoFilter(val as Id<'repositories'> | 'all')
              }
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All repositories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All repositories</SelectItem>
                {repositories?.map(repo => (
                  <SelectItem key={repo._id} value={repo._id}>
                    {repo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Start date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>End date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Repository</TableHead>
                <TableHead>Branches</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviews === undefined ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center">
                    <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
                    Loading reviews...
                  </TableCell>
                </TableRow>
              ) : reviews.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No PR reviews yet. Create one above.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                reviews.map(review => {
                  const repo = repoMap.get(review.repositoryId);
                  return (
                    <TableRow key={review._id} className="hover:bg-muted/40">
                      <TableCell className="font-medium">
                        <div className="space-y-1">
                          <div className="truncate">
                            {review.title || 'Untitled review'}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {review.prUrl}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{repo?.name ?? 'Unknown'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {review.baseBranch} → {review.headBranch}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatShortDateTime(review.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          to="/reviews/$reviewId"
                          params={{ reviewId: review._id }}
                          className="inline-flex items-center text-sm text-primary hover:underline"
                        >
                          Open <ArrowUpRight className="ml-1 h-4 w-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
