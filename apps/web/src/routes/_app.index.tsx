import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import {
  AlertCircle,
  CheckSquare,
  Clock,
  FileSearch,
  Inbox,
  Plus,
  Receipt,
  Zap,
} from 'lucide-react';
import { api } from '../../../../convex/_generated/api';
import { useCurrentCompany } from '@/lib/company-context';
import { authClient } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { GreetingBar } from '@/components/dashboard/greeting-bar';
import { StatCard } from '@/components/dashboard/stat-card';
import { ProgressRing } from '@/components/dashboard/progress-ring';
import { WeekOverview } from '@/components/dashboard/week-overview';
import {
  AttentionPanel,
  type AttentionItemConfig,
} from '@/components/dashboard/attention-panel';
import { QuickActionsBar } from '@/components/dashboard/quick-actions-bar';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';

const DAY_MS = 24 * 60 * 60 * 1000;

export const Route = createFileRoute('/_app/')({
  component: DashboardPage,
});

/* ---- Helpers ---- */

function formatCount(
  value: number | undefined,
  singular: string,
  plural = `${singular}s`
): string {
  if (value === undefined) return '...';
  return `${value} ${value === 1 ? singular : plural}`;
}

function formatFocusShort(minutes: number | undefined): string {
  if (minutes === undefined) return '...';
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  const rounded = hours >= 10 ? Math.round(hours) : Number(hours.toFixed(1));
  return `${rounded}h`;
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* ---- Inline micro-visualizations ---- */

function TaskMiniBar({
  completed,
  open,
  overdue,
}: {
  completed: number;
  open: number;
  overdue: number;
}) {
  const total = completed + open + overdue;
  if (total === 0) return null;
  const pct = (v: number) => `${(v / total) * 100}%`;

  return (
    <div
      className="flex h-2 w-16 overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={`${completed} completed, ${open} open, ${overdue} overdue`}
    >
      {completed > 0 && (
        <div
          className="bg-chart-2 transition-all duration-500"
          style={{ width: pct(completed) }}
        />
      )}
      {open > 0 && (
        <div
          className="bg-primary/60 transition-all duration-500"
          style={{ width: pct(open) }}
        />
      )}
      {overdue > 0 && (
        <div
          className="bg-destructive transition-all duration-500"
          style={{ width: pct(overdue) }}
        />
      )}
    </div>
  );
}

function FocusMiniChart({
  data,
}: {
  data: { label: string; minutes: number }[];
}) {
  const max = Math.max(...data.map(d => d.minutes), 1);

  return (
    <div
      className="flex h-8 items-end gap-0.5"
      role="img"
      aria-label="Focus time last 7 days"
    >
      {data.map((d, i) => (
        <div
          key={d.label}
          className={cn(
            'w-1.5 rounded-t-sm transition-all duration-500',
            i === data.length - 1 ? 'bg-primary' : 'bg-primary/40'
          )}
          style={{ height: `${Math.max((d.minutes / max) * 100, 8)}%` }}
          title={`${d.label}: ${d.minutes}m`}
        />
      ))}
    </div>
  );
}

/* ---- Dashboard Page ---- */

function DashboardPage() {
  const { currentCompany, isLoading } = useCurrentCompany();
  const { data: session } = authClient.useSession();
  const companyId = currentCompany?._id;

  /* ---- Data queries ---- */
  const unreadInboxCount = useQuery(
    api.inboxItems.getUnreadCount,
    companyId ? { companyId } : 'skip'
  );
  const projects = useQuery(
    api.projects.listProjects,
    companyId ? { companyId, includeArchived: true } : 'skip'
  );
  const tasks = useQuery(
    api.tasks.getCompanyTasks,
    companyId ? { companyId } : 'skip'
  );
  const sessions = useQuery(
    api.sessions.listSessions,
    companyId ? { companyId, includeDiscarded: false } : 'skip'
  );
  const reviews = useQuery(
    api.prReviews.listPRReviews,
    companyId ? { companyId } : 'skip'
  );

  /* ---- Time anchors (stable across re-renders) ---- */
  const [now] = useState(() => Date.now());
  const todayStart = useMemo(() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [now]);
  const tomorrowStart = todayStart + DAY_MS;
  const sevenDaysAgo = now - 7 * DAY_MS;

  // Start of current week (Monday)
  const weekStart = useMemo(() => {
    const d = new Date(now);
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [now]);

  /* ---- Derived stats ---- */
  const taskStats = useMemo(() => {
    if (!tasks) return undefined;

    const openTasks = tasks.filter(
      t => t.status !== 'done' && t.status !== 'cancelled'
    );
    const overdue = openTasks.filter(
      t => t.dueDate !== null && t.dueDate < todayStart
    );
    const dueToday = openTasks.filter(
      t =>
        t.dueDate !== null &&
        t.dueDate >= todayStart &&
        t.dueDate < tomorrowStart
    );
    const completed = tasks.filter(t => t.status === 'done');
    const completedThisWeek = completed.filter(t => t.updatedAt >= weekStart);

    return {
      total: tasks.length,
      open: openTasks.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      completed: completed.length,
      completedThisWeek: completedThisWeek.length,
    };
  }, [tasks, todayStart, tomorrowStart, weekStart]);

  const sessionStats = useMemo(() => {
    if (!sessions) return undefined;

    const running = sessions.filter(s => s.status === 'RUNNING');
    const paused = sessions.filter(s => s.status === 'PAUSED');
    const last7Days = sessions.filter(s => s.startAt >= sevenDaysAgo);
    const focusMinutes = Math.round(
      last7Days.reduce(
        (sum, s) => sum + (s.durationSummary?.effectiveDurationMs ?? 0) / 60000,
        0
      )
    );

    return {
      total: sessions.length,
      running: running.length,
      paused: paused.length,
      focusMinutes,
    };
  }, [sessions, sevenDaysAgo]);

  const dailyFocus = useMemo(() => {
    if (!sessions) return [];
    const days: { label: string; minutes: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dayStart = date.getTime();
      const dayEnd = dayStart + DAY_MS;
      const label = date.toLocaleDateString('en-US', { weekday: 'short' });
      const minutes = Math.round(
        sessions
          .filter(s => s.startAt >= dayStart && s.startAt < dayEnd)
          .reduce(
            (sum, s) =>
              sum + (s.durationSummary?.effectiveDurationMs ?? 0) / 60000,
            0
          )
      );
      days.push({ label, minutes });
    }

    return days;
  }, [sessions, now]);

  const recentCompletions = useMemo(() => {
    if (!tasks || !projects) return [];

    const projectMap = new Map((projects ?? []).map(p => [p._id, p.name]));

    return tasks
      .filter(t => t.status === 'done')
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5)
      .map(t => ({
        id: t._id,
        title: t.title,
        projectName: t.projectId ? projectMap.get(t.projectId) : undefined,
        completedAgo: timeAgo(t.updatedAt),
      }));
  }, [tasks, projects]);

  const reviewCount = reviews?.length;

  /* ---- Attention items ---- */
  const attentionItems: AttentionItemConfig[] = useMemo(() => {
    const items: AttentionItemConfig[] = [];

    if ((taskStats?.overdue ?? 0) > 0) {
      items.push({
        id: 'overdue-tasks',
        to: '/tasks',
        label: formatCount(taskStats!.overdue, 'overdue task'),
        count: taskStats!.overdue,
        icon: AlertCircle,
        severity: 'critical',
      });
    }
    if ((unreadInboxCount ?? 0) > 0) {
      items.push({
        id: 'unread-inbox',
        to: '/inbox',
        label: formatCount(unreadInboxCount!, 'unread notification'),
        count: unreadInboxCount!,
        icon: Inbox,
        severity: 'warning',
      });
    }
    if ((sessionStats?.paused ?? 0) > 0) {
      items.push({
        id: 'paused-sessions',
        to: '/sessions',
        label: formatCount(sessionStats!.paused, 'paused session'),
        count: sessionStats!.paused,
        icon: Clock,
        severity: 'info',
      });
    }

    return items;
  }, [taskStats, unreadInboxCount, sessionStats]);

  /* ---- Loading state ---- */
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  /* ---- No company selected ---- */
  if (!companyId || !currentCompany) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Select a company to view your dashboard</CardTitle>
            <CardDescription>
              Dashboard metrics are company-scoped. Pick a company or create one
              in settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/settings/company">Open company settings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ---- Quick actions config ---- */
  const quickActions = [
    { label: 'New project', to: '/projects', icon: Plus },
    { label: 'Triage inbox', to: '/inbox', icon: Inbox },
    { label: 'Start review', to: '/reviews', icon: FileSearch },
    { label: 'New invoice', to: '/invoicing/new', icon: Receipt },
  ];

  /* ---- Main render ---- */
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      {/* Section 1: Greeting */}
      <GreetingBar
        userName={session?.user.name || 'there'}
        companyName={currentCompany.name}
      />

      {/* Section 2: Key metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Inbox"
          value={String(unreadInboxCount ?? '...')}
          subtitle="unread notifications"
          icon={Inbox}
          to="/inbox"
        >
          {unreadInboxCount !== undefined && (
            <div
              className={cn(
                'h-3 w-3 rounded-full',
                unreadInboxCount > 0 ? 'bg-chart-4 animate-pulse' : 'bg-chart-2'
              )}
            />
          )}
        </StatCard>

        <StatCard
          title="Tasks"
          value={String(taskStats?.open ?? '...')}
          subtitle={`open${taskStats?.dueToday ? ` · ${taskStats.dueToday} due today` : ''}`}
          icon={CheckSquare}
          to="/tasks"
        >
          {taskStats && taskStats.total > 0 && (
            <TaskMiniBar
              completed={taskStats.completed}
              open={taskStats.open - taskStats.overdue}
              overdue={taskStats.overdue}
            />
          )}
        </StatCard>

        <StatCard
          title="Focus"
          value={formatFocusShort(sessionStats?.focusMinutes)}
          subtitle="this week"
          icon={Zap}
          to="/performance"
        >
          {dailyFocus.length > 0 && <FocusMiniChart data={dailyFocus} />}
        </StatCard>

        <StatCard
          title="Reviews"
          value={String(reviewCount ?? '...')}
          subtitle="total PR reviews"
          icon={FileSearch}
          to="/reviews"
        >
          <ProgressRing
            value={reviewCount ?? 0}
            max={Math.max(reviewCount ?? 0, 10)}
            size={40}
            strokeWidth={3}
          />
        </StatCard>
      </div>

      {/* Section 3: Week overview + Attention */}
      <div className="grid gap-6 lg:grid-cols-3">
        <WeekOverview
          completedThisWeek={taskStats?.completedThisWeek ?? 0}
          totalTasks={taskStats?.total ?? 0}
          dailyFocus={dailyFocus}
          recentCompletions={recentCompletions}
        />
        <AttentionPanel items={attentionItems} />
      </div>

      {/* Section 4: Quick actions */}
      <QuickActionsBar actions={quickActions} />
    </div>
  );
}
