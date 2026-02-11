import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useCurrentCompany } from '@/lib/company-context';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus } from 'lucide-react';
import { showToast } from '@/lib/toast';

type InvoiceDoc = Doc<'invoices'>;

export const Route = createFileRoute('/_app/invoicing/')({
  component: InvoicingListPage,
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

function InvoicingListPage() {
  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?._id;
  const invoices = useQuery(
    api.invoices.list,
    companyId ? { companyId } : 'skip'
  );
  const cancelInvoice = useMutation(api.invoices.cancel);

  const handleCancel = async (invoiceId: Id<'invoices'>) => {
    if (!companyId) return;
    try {
      await cancelInvoice({ companyId, invoiceId });
      showToast.success('Invoice cancelled');
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : 'Failed to cancel invoice'
      );
    }
  };

  const handleDownload = (invoice: InvoiceDoc) => {
    const csv = buildInvoiceCsv(invoice);
    downloadCsv(`invoice-${invoice._id}.csv`, csv);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Invoices</h2>
          <p className="text-sm text-muted-foreground">
            Generate and manage invoices for your sessions.
          </p>
        </div>
        <Button asChild>
          <Link to="/invoicing/new">
            <Plus className="mr-2 h-4 w-4" />
            Generate Invoice
          </Link>
        </Button>
      </div>

      {invoices === undefined ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center border border-dashed rounded-lg">
          <p className="text-muted-foreground">No invoices yet.</p>
          <Button className="mt-4" asChild>
            <Link to="/invoicing/new">Create your first invoice</Link>
          </Button>
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Rates</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map(invoice => {
                const uniqueRates = new Set<string>();
                for (const day of invoice.days ?? []) {
                  for (const line of day.lines ?? []) {
                    uniqueRates.add(`${line.currency}:${line.rateCents}`);
                  }
                }
                return (
                  <TableRow key={invoice._id}>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <span>
                          {new Date(invoice.periodStart).toDateString()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          to {new Date(invoice.periodEnd - 1).toDateString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(invoice.status)}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatCurrency(invoice.currency, invoice.totalCents)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatHours(invoice.totalMinutes)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {uniqueRates.size}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          to="/invoicing/$invoiceId"
                          params={{ invoiceId: invoice._id }}
                        >
                          View
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(invoice)}
                      >
                        CSV
                      </Button>
                      {invoice.status === 'finalized' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleCancel(invoice._id)}
                        >
                          Cancel
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
