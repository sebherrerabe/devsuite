import { createFileRoute, useParams } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useCurrentCompany } from '@/lib/company-context';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InvoiceDayGroup } from '@/components/invoice-day-group';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { showToast } from '@/lib/toast';

type InvoiceDoc = Doc<'invoices'>;

export const Route = createFileRoute('/_app/invoicing/$invoiceId')({
  component: InvoiceDetailPage,
});

function formatHours(minutes: number) {
  return (minutes / 60).toFixed(2);
}

function formatCurrency(currency: string, cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function buildInvoiceCsv(invoice: InvoiceDoc) {
  const rows = [['Date', 'Hours', 'Rate', 'Amount', 'Tasks'].join(',')];
  for (const day of invoice.days ?? []) {
    for (const line of day.lines ?? []) {
      const hours = (line.billedMinutes / 60).toFixed(2);
      const rate = (line.rateCents / 100).toFixed(2);
      const amount = (line.amountCents / 100).toFixed(2);
      const tasks = (line.projects ?? [])
        .map(group => {
          const taskTitles = (group.tasks ?? [])
            .map(task => task.title)
            .join('; ');
          return `${group.projectName}: ${taskTitles}`;
        })
        .join(' | ');
      rows.push(
        [
          day.date,
          hours,
          `${line.currency} ${rate}`,
          `${line.currency} ${amount}`,
          `"${tasks.replace(/"/g, '""')}"`,
        ].join(',')
      );
    }
  }
  return rows.join('\n');
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function statusVariant(status: string) {
  if (status === 'finalized') return 'secondary';
  if (status === 'cancelled') return 'destructive';
  return 'outline';
}

function InvoiceDetailPage() {
  const { invoiceId } = useParams({
    from: '/_app/invoicing/$invoiceId',
  });
  const invoiceIdTyped = invoiceId as Id<'invoices'>;
  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?._id;
  const invoice = useQuery(
    api.invoices.get,
    companyId ? { companyId, invoiceId: invoiceIdTyped } : 'skip'
  );
  const [showSessions, setShowSessions] = useState(false);
  const sessions = useQuery(
    api.invoices.listSessions,
    companyId && showSessions
      ? { companyId, invoiceId: invoiceIdTyped }
      : 'skip'
  );
  const cancelInvoice = useMutation(api.invoices.cancel);
  const [showCsv, setShowCsv] = useState(false);

  if (invoice === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-sm text-muted-foreground">Invoice not found.</div>
    );
  }

  const csv = buildInvoiceCsv(invoice);

  const handleCancel = async () => {
    if (!companyId) return;
    try {
      await cancelInvoice({ companyId, invoiceId: invoice._id });
      showToast.success('Invoice cancelled');
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : 'Failed to cancel invoice'
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Invoice</h2>
          <p className="text-sm text-muted-foreground">
            {new Date(invoice.periodStart).toDateString()} to{' '}
            {new Date(invoice.periodEnd - 1).toDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant(invoice.status)}>
            {invoice.status}
          </Badge>
          {invoice.status === 'finalized' && (
            <Button variant="destructive" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowCsv(true)}>
            View CSV
          </Button>
          <Button
            size="sm"
            onClick={() => downloadCsv(`invoice-${invoice._id}.csv`, csv)}
          >
            Download CSV
          </Button>
        </div>
      </div>

      <div className="rounded-md border p-4 grid gap-2 md:grid-cols-4">
        <div>
          <div className="text-xs text-muted-foreground">Total hours</div>
          <div className="text-lg font-semibold">
            {formatHours(invoice.totalMinutes)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Total amount</div>
          <div className="text-lg font-semibold">
            {formatCurrency(invoice.currency, invoice.totalCents)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Sessions</div>
          <div className="text-lg font-semibold">
            {invoice.sessionIds.length}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Timezone</div>
          <div className="text-lg font-semibold">{invoice.timezone}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          checked={showSessions}
          onCheckedChange={checked => setShowSessions(Boolean(checked))}
        />
        <span className="text-sm">Show included sessions</span>
      </div>

      {showSessions && (
        <div className="rounded-md border p-4 text-sm">
          {sessions === undefined ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-muted-foreground">No sessions found.</div>
          ) : (
            <ul className="space-y-1">
              {sessions.map(session => (
                <li key={session._id}>
                  {new Date(session.startAt).toLocaleString()} —{' '}
                  {session.summary ?? 'No summary'}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="space-y-6">
        {invoice.days.map(day => (
          <InvoiceDayGroup key={day.date} day={day} />
        ))}
      </div>

      <Dialog open={showCsv} onOpenChange={setShowCsv}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Invoice CSV</DialogTitle>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-3 text-xs">
            {csv}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
