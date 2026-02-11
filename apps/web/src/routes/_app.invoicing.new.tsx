import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useCurrentCompany } from '@/lib/company-context';
import type { Id } from '../../../../convex/_generated/dataModel';
import { useMemo, useState } from 'react';
import { z } from 'zod';
import {
  addDays,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { InvoiceDayGroup } from '@/components/invoice-day-group';
import { showToast } from '@/lib/toast';
import { Checkbox } from '@/components/ui/checkbox';
import { formatShortDateTime } from '@/lib/time';

const searchSchema = z.object({
  sessionIds: z.array(z.string()).optional(),
  includeAllInRange: z.boolean().optional(),
});

export const Route = createFileRoute('/_app/invoicing/new')({
  component: InvoiceCreatePage,
  validateSearch: searchSchema,
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

function InvoiceCreatePage() {
  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?._id;
  const navigate = useNavigate();
  const search = Route.useSearch();

  const [preset, setPreset] = useState<
    'this_month' | 'last_month' | 'this_week' | 'last_week' | 'custom'
  >('this_month');
  const [startDate, setStartDate] = useState<Date>(() =>
    startOfMonth(new Date())
  );
  const [endDate, setEndDate] = useState<Date>(() => endOfMonth(new Date()));
  const [includeAll, setIncludeAll] = useState(
    search.includeAllInRange ?? false
  );
  const [manualSelection, setManualSelection] = useState<{
    key: string;
    ids: Id<'sessions'>[];
  } | null>(null);

  const periodStart = useMemo(
    () => startOfDay(startDate).getTime(),
    [startDate]
  );
  const periodEnd = useMemo(
    () => addDays(startOfDay(endDate), 1).getTime(),
    [endDate]
  );

  const sessionIds = search.sessionIds?.length
    ? (search.sessionIds as Id<'sessions'>[])
    : undefined;

  const searchSessionIdsKey = useMemo(
    () => (search.sessionIds ?? []).join(','),
    [search.sessionIds]
  );

  const sessions = useQuery(
    api.sessions.listSessions,
    companyId ? { companyId, status: 'FINISHED' } : 'skip'
  );

  const sessionsInRange = useMemo(() => {
    if (!sessions) return [];
    return sessions
      .filter(session => {
        if (!session.endAt) return false;
        if (session.endAt <= periodStart) return false;
        if (session.startAt >= periodEnd) return false;
        return true;
      })
      .sort((a, b) => a.startAt - b.startAt);
  }, [sessions, periodStart, periodEnd]);

  const autoSelectedSessionIds = useMemo(() => {
    const inRangeIds = new Set(sessionsInRange.map(session => session._id));
    const defaultIds = sessionIds?.length
      ? includeAll
        ? sessionsInRange.map(session => session._id)
        : sessionIds.filter(id => inRangeIds.has(id))
      : sessionsInRange.map(session => session._id);
    return defaultIds;
  }, [sessionsInRange, sessionIds, includeAll]);

  const selectionKey = useMemo(
    () => `${periodStart}:${periodEnd}:${includeAll}:${searchSessionIdsKey}`,
    [periodStart, periodEnd, includeAll, searchSessionIdsKey]
  );

  const selectedSessionIds =
    manualSelection?.key === selectionKey
      ? manualSelection.ids
      : autoSelectedSessionIds;

  const selectedSessionIdSet = useMemo(
    () => new Set(selectedSessionIds),
    [selectedSessionIds]
  );

  const hasManualSelection = manualSelection?.key === selectionKey;
  const shouldFilterBySessionIds =
    hasManualSelection || (sessionIds?.length && !includeAll);
  const previewSessionIds = shouldFilterBySessionIds
    ? selectedSessionIds
    : undefined;

  const preview = useQuery(
    api.invoices.preview,
    companyId
      ? {
          companyId,
          periodStart,
          periodEnd,
          sessionIds: previewSessionIds,
          includeAllInRange: shouldFilterBySessionIds ? false : includeAll,
        }
      : 'skip'
  );

  const createInvoice = useMutation(api.invoices.create);

  const applyPreset = (next: typeof preset) => {
    setPreset(next);
    const now = new Date();
    if (next === 'this_month') {
      setStartDate(startOfMonth(now));
      setEndDate(endOfMonth(now));
    } else if (next === 'last_month') {
      const last = subMonths(now, 1);
      setStartDate(startOfMonth(last));
      setEndDate(endOfMonth(last));
    } else if (next === 'this_week') {
      setStartDate(startOfWeek(now, { weekStartsOn: 1 }));
      setEndDate(endOfWeek(now, { weekStartsOn: 1 }));
    } else if (next === 'last_week') {
      const last = subWeeks(now, 1);
      setStartDate(startOfWeek(last, { weekStartsOn: 1 }));
      setEndDate(endOfWeek(last, { weekStartsOn: 1 }));
    }
  };

  const handleFinalize = async () => {
    if (!companyId) return;
    try {
      const invoiceId = await createInvoice({
        companyId,
        periodStart,
        periodEnd,
        sessionIds: previewSessionIds,
        includeAllInRange: shouldFilterBySessionIds ? false : includeAll,
      });
      showToast.success('Invoice created');
      navigate({
        to: '/invoicing/$invoiceId',
        params: { invoiceId },
      });
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : 'Failed to create invoice'
      );
    }
  };

  const excludedReasonById = useMemo(() => {
    const map = new Map<string, string>();
    preview?.excludedSessions?.forEach(entry => {
      map.set(entry.sessionId, entry.reason);
    });
    return map;
  }, [preview]);

  const conflictSessionIds = useMemo(() => {
    const set = new Set<string>();
    preview?.conflicts?.forEach(conflict => {
      set.add(conflict.sessionId);
    });
    return set;
  }, [preview]);

  const includedSessionIds = useMemo(() => {
    const set = new Set<string>();
    preview?.sessionIds?.forEach(id => set.add(id));
    return set;
  }, [preview]);

  const updateManualSelection = (
    updater: (current: Id<'sessions'>[]) => Id<'sessions'>[]
  ) => {
    const base =
      manualSelection?.key === selectionKey
        ? manualSelection.ids
        : autoSelectedSessionIds;
    setManualSelection({ key: selectionKey, ids: updater(base) });
  };

  const toggleSessionSelection = (sessionId: Id<'sessions'>) => {
    updateManualSelection(current => {
      if (current.includes(sessionId)) {
        return current.filter(id => id !== sessionId);
      }
      return [...current, sessionId];
    });
  };

  const selectAllInRange = () => {
    updateManualSelection(() => sessionsInRange.map(session => session._id));
  };

  const clearSelection = () => {
    updateManualSelection(() => []);
  };

  const reasonLabel = (reason: string) => {
    if (reason === 'already_invoiced') return 'Already invoiced';
    if (reason === 'no_task_intervals') return 'No task activity';
    return reason;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Generate Invoice</h2>
        <p className="text-sm text-muted-foreground">
          Select a period and review the preview before finalizing.
        </p>
      </div>

      <div className="rounded-md border p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={preset === 'this_month' ? 'default' : 'outline'}
            onClick={() => applyPreset('this_month')}
          >
            This month
          </Button>
          <Button
            size="sm"
            variant={preset === 'last_month' ? 'default' : 'outline'}
            onClick={() => applyPreset('last_month')}
          >
            Last month
          </Button>
          <Button
            size="sm"
            variant={preset === 'this_week' ? 'default' : 'outline'}
            onClick={() => applyPreset('this_week')}
          >
            This week
          </Button>
          <Button
            size="sm"
            variant={preset === 'last_week' ? 'default' : 'outline'}
            onClick={() => applyPreset('last_week')}
          >
            Last week
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Start date</Label>
            <Input
              type="date"
              value={startDate.toISOString().slice(0, 10)}
              onChange={e => {
                setPreset('custom');
                setStartDate(new Date(e.target.value));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>End date</Label>
            <Input
              type="date"
              value={endDate.toISOString().slice(0, 10)}
              onChange={e => {
                setPreset('custom');
                setEndDate(new Date(e.target.value));
              }}
            />
          </div>
        </div>

        {sessionIds && (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={includeAll}
              onCheckedChange={checked => setIncludeAll(Boolean(checked))}
            />
            <span className="text-sm text-muted-foreground">
              Include other eligible sessions in this range
            </span>
          </div>
        )}
      </div>

      <div className="rounded-md border p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Sessions in range</div>
            <div className="text-xs text-muted-foreground">
              Select which sessions to include in this invoice.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={selectAllInRange}>
              Select all
            </Button>
            <Button size="sm" variant="outline" onClick={clearSelection}>
              Clear
            </Button>
          </div>
        </div>

        {sessions === undefined ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading sessions...
          </div>
        ) : sessionsInRange.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No finished sessions found in this range.
          </div>
        ) : (
          <div className="space-y-2">
            {sessionsInRange.map(session => {
              const excludedReason =
                excludedReasonById.get(session._id) ?? null;
              const hasConflict = conflictSessionIds.has(session._id);
              const isSelected = selectedSessionIdSet.has(session._id);
              const isIncluded = includedSessionIds.has(session._id);
              const isBlocked =
                excludedReason === 'already_invoiced' ||
                excludedReason === 'no_task_intervals';
              return (
                <div
                  key={session._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isSelected}
                      disabled={isBlocked}
                      onCheckedChange={() =>
                        toggleSessionSelection(session._id)
                      }
                    />
                    <div>
                      <div className="text-sm font-medium">
                        {formatShortDateTime(session.startAt)} —{' '}
                        {formatShortDateTime(session.endAt ?? session.startAt)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {session.summary ?? 'No summary'}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isIncluded && <Badge variant="secondary">Included</Badge>}
                    {!isSelected && !isIncluded && (
                      <Badge variant="outline">Not selected</Badge>
                    )}
                    {hasConflict && (
                      <Badge variant="destructive">Rate conflict</Badge>
                    )}
                    {excludedReason && (
                      <Badge variant="destructive">
                        {reasonLabel(excludedReason)}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {preview === undefined ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : preview.days.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No billable sessions found for this range.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-md border p-4 grid gap-2 md:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">Total hours</div>
              <div className="text-lg font-semibold">
                {formatHours(preview.totalMinutes)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total amount</div>
              <div className="text-lg font-semibold">
                {formatCurrency(preview.currency, preview.totalCents)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Sessions</div>
              <div className="text-lg font-semibold">
                {preview.sessionIds.length}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Timezone</div>
              <div className="text-lg font-semibold">{preview.timezone}</div>
            </div>
          </div>

          {preview.conflicts.length > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {preview.conflicts.length} time overlap conflicts detected.
              Resolve overlapping tasks with different rates before finalizing.
            </div>
          )}

          {preview.days.map(day => (
            <InvoiceDayGroup key={day.date} day={day} />
          ))}

          <div className="flex justify-end">
            <Button
              onClick={handleFinalize}
              disabled={!preview.canFinalize || preview.sessionIds.length === 0}
            >
              Finalize Invoice
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
