import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  ChartLine,
  CheckCircle2,
  FolderKanban,
  GitPullRequest,
  Loader2,
  Shuffle,
  Timer,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { useCurrentCompany } from '@/lib/company-context';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const Route = createFileRoute('/_app/performance')({
  component: PerformancePage,
});

const DAY_MS = 24 * 60 * 60 * 1000;

const COLORS = {
  focus: '#0f766e',
  sessions: '#2563eb',
  tasks: '#16a34a',
  reviews: '#ea580c',
  switches: '#dc2626',
  mutedBar: '#64748b',
  grid: '#cbd5e1',
  status: {
    todo: '#64748b',
    in_progress: '#2563eb',
    blocked: '#dc2626',
    done: '#16a34a',
    cancelled: '#6b7280',
  },
  pie: ['#0f766e', '#94a3b8'],
};

type TrendGranularity = 'daily' | 'weekly' | 'monthly';
type ProjectDisplayMode = 'minutes' | 'share';

type DailyMetricPoint = {
  date: string;
  focusMinutes: number;
  sessions: number;
  completedTasks: number;
  prReviews: number;
  contextSwitches: number;
};

type TrendPoint = {
  label: string;
  focusMinutes: number;
  sessions: number;
  completedTasks: number;
  prReviews: number;
  contextSwitches: number;
};

type SparkPoint = {
  label: string;
  value: number;
};

type MetricCardProps = {
  title: string;
  value: string;
  deltaLabel: string;
  deltaPositive: boolean | null;
  icon: LucideIcon;
  color: string;
  data: SparkPoint[];
};

function toDateInputValue(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function toRangeStart(date: string): number | undefined {
  if (!date) return undefined;
  return new Date(`${date}T00:00:00`).getTime();
}

function toRangeEnd(date: string): number | undefined {
  if (!date) return undefined;
  return new Date(`${date}T23:59:59.999`).getTime();
}

function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes}m`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getUtcWeekStartKey(dateKey: string): string {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return dateKey;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  const shift = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  date.setUTCDate(date.getUTCDate() - shift);
  return date.toISOString().slice(0, 10);
}

function aggregateTrendData(
  daily: DailyMetricPoint[],
  granularity: TrendGranularity
): TrendPoint[] {
  if (granularity === 'daily') {
    return daily.map(point => ({
      label: point.date,
      focusMinutes: point.focusMinutes,
      sessions: point.sessions,
      completedTasks: point.completedTasks,
      prReviews: point.prReviews,
      contextSwitches: point.contextSwitches,
    }));
  }

  const grouped = new Map<string, TrendPoint>();

  for (const point of daily) {
    const key =
      granularity === 'weekly'
        ? getUtcWeekStartKey(point.date)
        : point.date.slice(0, 7);

    const existing = grouped.get(key);
    if (existing) {
      existing.focusMinutes += point.focusMinutes;
      existing.sessions += point.sessions;
      existing.completedTasks += point.completedTasks;
      existing.prReviews += point.prReviews;
      existing.contextSwitches += point.contextSwitches;
    } else {
      grouped.set(key, {
        label: key,
        focusMinutes: point.focusMinutes,
        sessions: point.sessions,
        completedTasks: point.completedTasks,
        prReviews: point.prReviews,
        contextSwitches: point.contextSwitches,
      });
    }
  }

  return Array.from(grouped.values()).sort((a, b) =>
    a.label.localeCompare(b.label)
  );
}

function formatTrendLabel(
  label: string,
  granularity: TrendGranularity
): string {
  if (granularity === 'daily') {
    return label.slice(5);
  }
  if (granularity === 'weekly') {
    return `Wk ${label.slice(5)}`;
  }
  return label;
}

function buildDelta(
  current: number,
  previous: number | null,
  isLoading: boolean
): { label: string; positive: boolean | null } {
  if (isLoading) {
    return { label: 'Loading baseline...', positive: null };
  }

  if (previous === null) {
    return { label: 'No baseline', positive: null };
  }

  if (previous === 0) {
    if (current === 0) {
      return { label: 'No change', positive: null };
    }
    return { label: 'New activity', positive: true };
  }

  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? '+' : '';
  return {
    label: `${sign}${pct.toFixed(1)}% vs previous period`,
    positive: pct >= 0,
  };
}

function MetricCard({
  title,
  value,
  deltaLabel,
  deltaPositive,
  icon: Icon,
  color,
  data,
}: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardDescription>
        <CardTitle>{value}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p
          className={`text-xs ${
            deltaPositive === null
              ? 'text-muted-foreground'
              : deltaPositive
                ? 'text-emerald-600'
                : 'text-rose-600'
          }`}
        >
          {deltaLabel}
        </p>
        <div className="h-10">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function PerformancePage() {
  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?._id;

  const [initialRange] = useState(() => {
    const end = Date.now();
    const start = end - 29 * DAY_MS;
    return {
      startDate: toDateInputValue(start),
      endDate: toDateInputValue(end),
    };
  });

  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [projectFilter, setProjectFilter] = useState<Id<'projects'> | 'all'>(
    'all'
  );
  const [trendGranularity, setTrendGranularity] =
    useState<TrendGranularity>('daily');
  const [projectDisplayMode, setProjectDisplayMode] =
    useState<ProjectDisplayMode>('minutes');

  const projects = useQuery(
    api.projects.listProjects,
    companyId ? { companyId, includeArchived: false } : 'skip'
  );

  const rangeStart = toRangeStart(startDate);
  const rangeEnd = toRangeEnd(endDate);

  const rangeError =
    rangeStart !== undefined &&
    rangeEnd !== undefined &&
    Number.isFinite(rangeStart) &&
    Number.isFinite(rangeEnd) &&
    rangeStart >= rangeEnd
      ? 'Start date must be before end date.'
      : null;

  const queryArgs = useMemo(() => {
    if (!companyId || rangeError) return 'skip' as const;
    return {
      companyId,
      startDate: rangeStart,
      endDate: rangeEnd,
      projectId: projectFilter === 'all' ? undefined : projectFilter,
    };
  }, [companyId, projectFilter, rangeEnd, rangeError, rangeStart]);

  const canCompare =
    !rangeError && rangeStart !== undefined && rangeEnd !== undefined;

  const previousQueryArgs = useMemo(() => {
    if (
      !companyId ||
      !canCompare ||
      rangeStart === undefined ||
      rangeEnd === undefined
    ) {
      return 'skip' as const;
    }

    const duration = rangeEnd - rangeStart;
    const previousEnd = rangeStart - 1;
    const previousStart = previousEnd - duration;

    return {
      companyId,
      startDate: previousStart,
      endDate: previousEnd,
      projectId: projectFilter === 'all' ? undefined : projectFilter,
    };
  }, [canCompare, companyId, projectFilter, rangeEnd, rangeStart]);

  const metrics = useQuery(
    api.performanceSignals.getDashboardMetrics,
    queryArgs
  );
  const previousMetrics = useQuery(
    api.performanceSignals.getDashboardMetrics,
    previousQueryArgs
  );

  if (!companyId) {
    return null;
  }

  if (rangeError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Performance</h1>
          <p className="text-muted-foreground">
            Visual performance insights across sessions, tasks, and reviews.
          </p>
        </div>
        <Card>
          <CardContent className="py-8 text-sm text-destructive">
            {rangeError}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Performance</h1>
          <p className="text-muted-foreground">
            Visual performance insights across sessions, tasks, and reviews.
          </p>
        </div>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            Loading performance metrics...
          </CardContent>
        </Card>
      </div>
    );
  }

  const previousSummary = previousMetrics?.summary ?? null;
  const previousLoading =
    previousQueryArgs !== 'skip' && previousMetrics === undefined;

  const sparkSource = metrics.daily.slice(-20);
  const focusSpark = sparkSource.map(point => ({
    label: point.date,
    value: point.focusMinutes,
  }));
  const sessionsSpark = sparkSource.map(point => ({
    label: point.date,
    value: point.sessions,
  }));
  const tasksSpark = sparkSource.map(point => ({
    label: point.date,
    value: point.completedTasks,
  }));
  const reviewsSpark = sparkSource.map(point => ({
    label: point.date,
    value: point.prReviews,
  }));
  const switchesSpark = sparkSource.map(point => ({
    label: point.date,
    value: point.contextSwitches,
  }));

  const focusDelta = buildDelta(
    metrics.summary.totalFocusMinutes,
    previousSummary?.totalFocusMinutes ?? null,
    previousLoading
  );
  const sessionsDelta = buildDelta(
    metrics.summary.sessionCount,
    previousSummary?.sessionCount ?? null,
    previousLoading
  );
  const tasksDelta = buildDelta(
    metrics.summary.completedTaskCount,
    previousSummary?.completedTaskCount ?? null,
    previousLoading
  );
  const reviewsDelta = buildDelta(
    metrics.summary.prReviewCount,
    previousSummary?.prReviewCount ?? null,
    previousLoading
  );
  const switchesDelta = buildDelta(
    metrics.summary.contextSwitchCount,
    previousSummary?.contextSwitchCount ?? null,
    previousLoading
  );

  const trendData = aggregateTrendData(
    metrics.daily as DailyMetricPoint[],
    trendGranularity
  );
  const trendWindow = trendGranularity === 'daily' ? 21 : 12;
  const visibleTrendData = trendData.slice(-trendWindow);

  const totalProjectFocus = metrics.topProjects.reduce(
    (sum, project) => sum + project.focusMinutes,
    0
  );

  const projectChartData = metrics.topProjects.map(project => {
    const share =
      totalProjectFocus > 0
        ? (project.focusMinutes / totalProjectFocus) * 100
        : 0;
    return {
      projectId: project.projectId,
      name: project.name,
      focusMinutes: project.focusMinutes,
      share,
      sessions: project.sessionCount,
      value: projectDisplayMode === 'share' ? share : project.focusMinutes,
      valueLabel:
        projectDisplayMode === 'share'
          ? formatPercent(share)
          : formatMinutes(project.focusMinutes),
    };
  });

  const complexityRows = metrics.complexityEffort.rows.map(row => ({
    ...row,
    complexity: row.complexityScore,
    focus: row.focusMinutes,
  }));

  const scatterGroups = [
    { status: 'todo', label: 'Todo' },
    { status: 'in_progress', label: 'In Progress' },
    { status: 'blocked', label: 'Blocked' },
    { status: 'done', label: 'Done' },
    { status: 'cancelled', label: 'Cancelled' },
  ].map(group => ({
    ...group,
    color: COLORS.status[group.status as keyof typeof COLORS.status],
    points: complexityRows.filter(row => row.status === group.status),
  }));

  const reviewDailyData = metrics.daily.slice(-30).map(point => ({
    date: point.date,
    label: point.date.slice(5),
    reviews: point.prReviews,
  }));

  const reviewPieData = [
    {
      name: 'Linked',
      value: metrics.reviewLoad.linkedToTaskCount,
    },
    {
      name: 'Unlinked',
      value: metrics.reviewLoad.unlinkedCount,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Performance</h1>
        <p className="text-muted-foreground">
          Visual performance insights across sessions, tasks, and reviews.
        </p>
      </div>

      <Card className="sticky top-0 z-10 border bg-background/95 backdrop-blur">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Date range, project scope, and trend granularity.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="perf-start-date">Start date</Label>
            <Input
              id="perf-start-date"
              type="date"
              value={startDate}
              onChange={event => setStartDate(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="perf-end-date">End date</Label>
            <Input
              id="perf-end-date"
              type="date"
              value={endDate}
              onChange={event => setEndDate(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Project</Label>
            <Select
              value={projectFilter}
              onValueChange={value =>
                setProjectFilter(value as Id<'projects'> | 'all')
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects?.map(project => (
                  <SelectItem key={project._id} value={project._id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Trend granularity</Label>
            <Select
              value={trendGranularity}
              onValueChange={value =>
                setTrendGranularity(value as TrendGranularity)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          title="Focus time"
          value={formatMinutes(metrics.summary.totalFocusMinutes)}
          deltaLabel={focusDelta.label}
          deltaPositive={focusDelta.positive}
          icon={Timer}
          color={COLORS.focus}
          data={focusSpark}
        />
        <MetricCard
          title="Sessions"
          value={String(metrics.summary.sessionCount)}
          deltaLabel={sessionsDelta.label}
          deltaPositive={sessionsDelta.positive}
          icon={FolderKanban}
          color={COLORS.sessions}
          data={sessionsSpark}
        />
        <MetricCard
          title="Completed tasks"
          value={String(metrics.summary.completedTaskCount)}
          deltaLabel={tasksDelta.label}
          deltaPositive={tasksDelta.positive}
          icon={CheckCircle2}
          color={COLORS.tasks}
          data={tasksSpark}
        />
        <MetricCard
          title="PR reviews"
          value={String(metrics.summary.prReviewCount)}
          deltaLabel={reviewsDelta.label}
          deltaPositive={reviewsDelta.positive}
          icon={GitPullRequest}
          color={COLORS.reviews}
          data={reviewsSpark}
        />
        <MetricCard
          title="Context switches"
          value={String(metrics.summary.contextSwitchCount)}
          deltaLabel={switchesDelta.label}
          deltaPositive={switchesDelta.positive}
          icon={Shuffle}
          color={COLORS.switches}
          data={switchesSpark}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Focus Trend
            </CardTitle>
            <CardDescription>
              {trendGranularity === 'daily'
                ? 'Daily focus distribution with sessions/reviews context.'
                : trendGranularity === 'weekly'
                  ? 'Weekly buckets for broader pacing analysis.'
                  : 'Monthly buckets for long-horizon patterns.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {visibleTrendData.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No trend data available.
              </p>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={visibleTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                    <XAxis
                      dataKey="label"
                      tickFormatter={value =>
                        formatTrendLabel(String(value), trendGranularity)
                      }
                    />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <RechartsTooltip />
                    <Legend />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="focusMinutes"
                      stroke={COLORS.focus}
                      fill={COLORS.focus}
                      fillOpacity={0.2}
                      name="Focus minutes"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="sessions"
                      stroke={COLORS.sessions}
                      dot={false}
                      name="Sessions"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="prReviews"
                      stroke={COLORS.reviews}
                      dot={false}
                      name="PR reviews"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Project Focus Share</CardTitle>
              <CardDescription>
                Click a bar to scope dashboard to that project.
              </CardDescription>
            </div>
            <div className="w-[150px]">
              <Select
                value={projectDisplayMode}
                onValueChange={value =>
                  setProjectDisplayMode(value as ProjectDisplayMode)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="share">Share %</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {projectChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No project focus data.
              </p>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={projectChartData}
                    margin={{ left: 8, right: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                    <XAxis
                      type="number"
                      domain={
                        projectDisplayMode === 'share'
                          ? [0, 100]
                          : [0, 'dataMax']
                      }
                      tickFormatter={value =>
                        projectDisplayMode === 'share'
                          ? `${Number(value).toFixed(0)}%`
                          : String(value)
                      }
                    />
                    <YAxis type="category" dataKey="name" width={110} />
                    <RechartsTooltip />
                    <Bar
                      dataKey="value"
                      name="value"
                      fill={COLORS.focus}
                      radius={[0, 6, 6, 0]}
                      onClick={(_, index) => {
                        const project = projectChartData[index];
                        if (project) {
                          setProjectFilter(project.projectId);
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartLine className="h-4 w-4" />
              Complexity vs Effort
            </CardTitle>
            <CardDescription>
              Scatter view of complexity score against focused minutes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {complexityRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No scored task focus in this range.
              </p>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart
                    margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                    <XAxis
                      type="number"
                      dataKey="complexity"
                      name="Complexity"
                      domain={[1, 10]}
                    />
                    <YAxis
                      type="number"
                      dataKey="focus"
                      name="Focus minutes"
                      domain={[0, 'auto']}
                    />
                    <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Legend />
                    {scatterGroups.map(group =>
                      group.points.length > 0 ? (
                        <Scatter
                          key={group.status}
                          name={group.label}
                          data={group.points}
                          fill={group.color}
                        />
                      ) : null
                    )}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Review Load</CardTitle>
            <CardDescription>
              Throughput, linkage quality, and repository distribution.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">
                  Average/day (active)
                </p>
                <p className="text-lg font-semibold">
                  {metrics.reviewLoad.averageReviewsPerActiveDay}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Total reviews</p>
                <p className="text-lg font-semibold">
                  {metrics.reviewLoad.totalReviews}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-52 rounded-md border p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={reviewPieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {reviewPieData.map((entry, index) => (
                        <Cell
                          key={`${entry.name}-${index}`}
                          fill={COLORS.pie[index % COLORS.pie.length]}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="h-52 rounded-md border p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={reviewDailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <RechartsTooltip />
                    <Area
                      type="monotone"
                      dataKey="reviews"
                      stroke={COLORS.reviews}
                      fill={COLORS.reviews}
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="h-56 rounded-md border p-2">
              {metrics.reviewLoad.byRepository.length === 0 ? (
                <p className="pt-20 text-center text-sm text-muted-foreground">
                  No repository review data in this range.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.reviewLoad.byRepository}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                    <XAxis
                      dataKey="repositoryName"
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis allowDecimals={false} />
                    <RechartsTooltip />
                    <Bar
                      dataKey="count"
                      fill={COLORS.reviews}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <details className="rounded-lg border bg-card p-4">
        <summary className="cursor-pointer list-none text-sm font-medium">
          Raw Daily Breakdown (Audit View)
        </summary>
        <div className="mt-4 rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Focus</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Tasks</TableHead>
                <TableHead className="text-right">PRs</TableHead>
                <TableHead className="text-right">Switches</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.daily.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No data available.
                  </TableCell>
                </TableRow>
              ) : (
                metrics.daily.map(day => (
                  <TableRow key={day.date}>
                    <TableCell className="font-medium">{day.date}</TableCell>
                    <TableCell className="text-right">
                      {formatMinutes(day.focusMinutes)}
                    </TableCell>
                    <TableCell className="text-right">{day.sessions}</TableCell>
                    <TableCell className="text-right">
                      {day.completedTasks}
                    </TableCell>
                    <TableCell className="text-right">
                      {day.prReviews}
                    </TableCell>
                    <TableCell className="text-right">
                      {day.contextSwitches}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </details>
    </div>
  );
}
