import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/reviews')({
  component: ReviewsLayout,
});

function ReviewsLayout() {
  return <Outlet />;
}
