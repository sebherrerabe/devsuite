import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/reviews')({
  component: ReviewsPage,
});

function ReviewsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">PR Reviews</h1>
      <p className="text-muted-foreground">
        Review pull requests and manage code quality.
      </p>
    </div>
  );
}
