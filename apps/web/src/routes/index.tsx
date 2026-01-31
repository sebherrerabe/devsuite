import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';

export const Route = createFileRoute('/')({
  component: IndexComponent,
});

function IndexComponent() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome to DevSuite
        </h1>
        <p className="text-muted-foreground">
          Frontend foundation is successfully implemented with Tailwind CSS v4
          and shadcn/ui.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Routing</CardTitle>
            <CardDescription>TanStack Router is configured.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              File-based routing with layouts and 404 handling is ready.
            </p>
            <Button
              variant="outline"
              onClick={() => toast.success('Routing is working!')}
            >
              Test Toast
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Styling</CardTitle>
            <CardDescription>Tailwind CSS v4 is active.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Using CSS-first configuration with Slate/Blue palette and dark
              mode support.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Components</CardTitle>
            <CardDescription>shadcn/ui core components.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Button, Card, Input, Select, Dialog, Dropdown, Table, and Sonner
              are installed.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
