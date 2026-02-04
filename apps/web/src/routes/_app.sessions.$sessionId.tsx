import {
  createFileRoute,
  Link,
  useParams,
  useRouterState,
} from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useCurrentCompany } from '@/lib/company-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatDurationMs, formatShortDateTime } from '@/lib/time';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  CheckCircle2,
  FolderMinus,
  FolderPlus,
  ListChecks,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Square,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { debugLog, debugGroup, debugWarn } from '@/lib/debug';
import type { SessionDetail } from '@devsuite/shared';
import type { Id } from '../../../../convex/_generated/dataModel';

export const Route = createFileRoute('/_app/sessions/$sessionId')({
  component: SessionDetailPage,
});

function SessionDetailPage() {
  const { sessionId } = useParams({ from: '/_app/sessions/$sessionId' });
  const sessionIdTyped = sessionId as Id<'sessions'>;

  const { currentCompany, isLoading: isCompanyLoading } = useCurrentCompany();
  const companyId = currentCompany?._id;
  const routerState = useRouterState({
    select: state => ({
      location: state.location,
      matches: state.matches,
      status: state.status,
    }),
  });

  const sessionDetail = useQuery(
    api.sessions.getSession,
    companyId
      ? { companyId, sessionId: sessionIdTyped, includeDiscarded: true }
      : 'skip'
  );

  const tasks = useQuery(
    api.tasks.listAllTasks,
    companyId ? { companyId } : 'skip'
  );

  const projects = useQuery(
    api.projects.listProjects,
    companyId ? { companyId, includeArchived: true } : 'skip'
  );

  const taskMap = useMemo(() => {
    const map = new Map<Id<'tasks'>, string>();
    tasks?.forEach(task => map.set(task._id, task.title));
    return map;
  }, [tasks]);

  const projectMap = useMemo(() => {
    const map = new Map<Id<'projects'>, string>();
    projects?.forEach(project => map.set(project._id, project.name));
    return map;
  }, [projects]);

  const matchIds = useMemo(
    () => routerState.matches.map(match => match.routeId),
    [routerState.matches]
  );

  useEffect(() => {
    debugLog('sessions', 'SessionDetailPage mounted', {
      sessionId: sessionIdTyped,
    });
    return () => {
      debugLog('sessions', 'SessionDetailPage unmounted', {
        sessionId: sessionIdTyped,
      });
    };
  }, [sessionIdTyped]);

  useEffect(() => {
    debugGroup('sessions', 'SessionDetail router snapshot', () => {
      debugLog('sessions', 'Location', {
        pathname: routerState.location.pathname,
        search: routerState.location.searchStr,
        hash: routerState.location.hash,
      });
      debugLog('sessions', 'Matches', { matches: matchIds });
      debugLog('sessions', 'Status', { status: routerState.status });
      debugLog('sessions', 'Params', { sessionId: sessionIdTyped });
      debugLog('sessions', 'Company', {
        companyId: companyId ?? 'none',
        isCompanyLoading,
      });
    });
  }, [
    routerState.location.pathname,
    routerState.location.searchStr,
    routerState.location.hash,
    routerState.status,
    matchIds,
    companyId,
    isCompanyLoading,
    sessionIdTyped,
  ]);

  useEffect(() => {
    debugLog('sessions', 'Session detail query status', {
      status:
        sessionDetail === undefined
          ? 'loading'
          : sessionDetail === null
            ? 'null'
            : 'loaded',
      hasSession: !!sessionDetail?.session,
      eventCount: sessionDetail?.events?.length ?? 0,
    });
  }, [sessionDetail]);

  useEffect(() => {
    debugLog('sessions', 'Tasks query status', {
      status:
        tasks === undefined ? 'loading' : tasks === null ? 'null' : 'loaded',
      count: tasks?.length ?? 0,
    });
  }, [tasks]);

  useEffect(() => {
    debugLog('sessions', 'Projects query status', {
      status:
        projects === undefined
          ? 'loading'
          : projects === null
            ? 'null'
            : 'loaded',
      count: projects?.length ?? 0,
    });
  }, [projects]);

  useEffect(() => {
    if (
      routerState.location.pathname.includes('/sessions/') &&
      !matchIds.includes('/_app/sessions/$sessionId')
    ) {
      debugWarn(
        'sessions',
        'URL looks like a session detail path but the session detail route is not matched.',
        { pathname: routerState.location.pathname, matches: matchIds }
      );
    }
  }, [matchIds, routerState.location.pathname]);

  if (isCompanyLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!companyId) {
    return null;
  }

  if (sessionDetail === undefined) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sessionDetail) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center space-y-4">
        <h2 className="text-xl font-semibold">Session not found</h2>
        <Button variant="outline" asChild>
          <Link to="/sessions">Back to Sessions</Link>
        </Button>
      </div>
    );
  }

  return (
    <SessionDetailContent
      sessionDetail={sessionDetail}
      taskMap={taskMap}
      projectMap={projectMap}
    />
  );
}

function SessionDetailContent({
  sessionDetail,
  taskMap,
  projectMap,
}: {
  sessionDetail: SessionDetail;
  taskMap: Map<Id<'tasks'>, string>;
  projectMap: Map<Id<'projects'>, string>;
}) {
  const { session, events, durationSummary, taskSummaries, projectSummaries } =
    sessionDetail;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const isRunning = session.status === 'RUNNING';

  const statusBadgeVariant = (
    status: string
  ): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'RUNNING':
        return 'default';
      case 'PAUSED':
        return 'secondary';
      case 'CANCELLED':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const toneClasses = {
    emerald: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200',
    sky: 'border-sky-500/30 bg-sky-500/15 text-sky-200',
    amber: 'border-amber-500/30 bg-amber-500/15 text-amber-200',
    rose: 'border-rose-500/30 bg-rose-500/15 text-rose-200',
    teal: 'border-teal-500/30 bg-teal-500/15 text-teal-200',
    slate: 'border-slate-500/30 bg-slate-500/15 text-slate-200',
  };

  const getEventDisplay = (event: {
    type: string;
    payload: Record<string, unknown>;
  }) => {
    const payload = event.payload as {
      taskId?: Id<'tasks'>;
      projectId?: Id<'projects'>;
      cancelMode?: string;
      text?: string;
    };

    const taskName = payload.taskId
      ? (taskMap.get(payload.taskId) ?? payload.taskId)
      : 'Unknown task';
    const projectName = payload.projectId
      ? (projectMap.get(payload.projectId) ?? payload.projectId)
      : 'Unknown project';

    switch (event.type) {
      case 'SESSION_STARTED':
        return {
          title: 'Session started',
          category: 'Session',
          tone: 'sky',
          icon: Play,
        };
      case 'SESSION_PAUSED':
        return {
          title: 'Session paused',
          category: 'Session',
          tone: 'amber',
          icon: Pause,
        };
      case 'SESSION_RESUMED':
        return {
          title: 'Session resumed',
          category: 'Session',
          tone: 'sky',
          icon: Play,
        };
      case 'SESSION_FINISHED':
        return {
          title: 'Session finished',
          category: 'Session',
          tone: 'sky',
          icon: Square,
        };
      case 'SESSION_CANCELLED':
        return {
          title: 'Session cancelled',
          meta: `Mode: ${payload.cancelMode ?? 'unknown'}`,
          category: 'Session',
          tone: 'rose',
          icon: XCircle,
        };
      case 'TASK_ACTIVATED':
        return {
          title: 'Task activated',
          context: taskName,
          category: 'Task',
          tone: 'emerald',
          icon: Play,
        };
      case 'TASK_DEACTIVATED':
        return {
          title: 'Task stopped',
          context: taskName,
          category: 'Task',
          tone: 'amber',
          icon: Pause,
        };
      case 'TASK_MARKED_DONE':
        return {
          title: 'Task completed',
          context: taskName,
          category: 'Task',
          tone: 'emerald',
          icon: CheckCircle2,
        };
      case 'TASK_RESET':
        return {
          title: 'Task reset',
          context: taskName,
          category: 'Task',
          tone: 'amber',
          icon: RotateCcw,
        };
      case 'STEP_LOGGED':
        return {
          title: 'Step logged',
          meta: payload.text ?? undefined,
          category: 'Note',
          tone: 'slate',
          icon: ListChecks,
        };
      case 'PROJECT_ASSIGNED_TO_SESSION':
        return {
          title: 'Project added',
          context: projectName,
          category: 'Project',
          tone: 'teal',
          icon: FolderPlus,
        };
      case 'PROJECT_UNASSIGNED_FROM_SESSION':
        return {
          title: 'Project removed',
          context: projectName,
          category: 'Project',
          tone: 'teal',
          icon: FolderMinus,
        };
      default:
        return {
          title: event.type,
          category: 'Event',
          tone: 'slate',
          icon: ListChecks,
        };
    }
  };

  const orderedEvents = useMemo(
    () => [...events].sort((a, b) => a.timestamp - b.timestamp),
    [events]
  );

  useEffect(() => {
    if (!isRunning) {
      return;
    }
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const flowEndAt =
    session.endAt ?? (session.status === 'RUNNING' ? nowMs : session.startAt);

  const flowSegments = useMemo(() => {
    if (flowEndAt <= session.startAt) {
      return [];
    }

    const segments: {
      state: 'RUNNING' | 'PAUSED';
      startAt: number;
      endAt: number;
      durationMs: number;
    }[] = [];
    let running = false;
    let cursor = session.startAt;

    if (orderedEvents.length === 0) {
      running = session.status === 'RUNNING';
      segments.push({
        state: running ? 'RUNNING' : 'PAUSED',
        startAt: cursor,
        endAt: flowEndAt,
        durationMs: Math.max(0, flowEndAt - cursor),
      });
      return segments.filter(segment => segment.durationMs > 0);
    }

    for (const event of orderedEvents) {
      if (event.timestamp > cursor) {
        segments.push({
          state: running ? 'RUNNING' : 'PAUSED',
          startAt: cursor,
          endAt: event.timestamp,
          durationMs: Math.max(0, event.timestamp - cursor),
        });
      }

      if (
        event.type === 'SESSION_STARTED' ||
        event.type === 'SESSION_RESUMED'
      ) {
        running = true;
      }
      if (
        event.type === 'SESSION_PAUSED' ||
        event.type === 'SESSION_FINISHED' ||
        event.type === 'SESSION_CANCELLED'
      ) {
        running = false;
      }

      cursor = event.timestamp;
    }

    if (flowEndAt > cursor) {
      segments.push({
        state: running ? 'RUNNING' : 'PAUSED',
        startAt: cursor,
        endAt: flowEndAt,
        durationMs: Math.max(0, flowEndAt - cursor),
      });
    }

    return segments.filter(segment => segment.durationMs > 0);
  }, [flowEndAt, orderedEvents, session.startAt, session.status]);

  const totalFlowMs = flowSegments.reduce(
    (sum, segment) => sum + segment.durationMs,
    0
  );

  const timelineRows = useMemo(() => {
    return orderedEvents.map((event, index) => {
      const previousTimestamp =
        index === 0
          ? session.startAt
          : (orderedEvents[index - 1]?.timestamp ?? session.startAt);
      return {
        event,
        deltaMs: Math.max(0, event.timestamp - previousTimestamp),
        elapsedMs: Math.max(0, event.timestamp - session.startAt),
      };
    });
  }, [orderedEvents, session.startAt]);

  const tasksTouchedCount = taskSummaries.filter(task => task.wasActive).length;
  const tasksCompletedCount = taskSummaries.filter(
    task => task.wasCompleted
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" asChild>
          <Link to="/sessions">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Session</h1>
          <p className="text-muted-foreground text-sm">
            {formatShortDateTime(session.startAt)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={statusBadgeVariant(session.status)}>
                {session.status}
              </Badge>
              {session.isExcludedFromSummaries && (
                <Badge variant="secondary">Excluded from summaries</Badge>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Start</p>
                <p className="font-medium">
                  {formatShortDateTime(session.startAt)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">End</p>
                <p className="font-medium">
                  {session.endAt
                    ? formatShortDateTime(session.endAt)
                    : 'In progress'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Effective time</p>
                <p className="font-medium">
                  {formatDurationMs(durationSummary.effectiveDurationMs)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Unallocated</p>
                <p className="font-medium">
                  {formatDurationMs(durationSummary.unallocatedDurationMs)}
                </p>
              </div>
            </div>
            {session.summary && (
              <div>
                <p className="text-xs text-muted-foreground">Summary</p>
                <p className="text-sm">{session.summary}</p>
              </div>
            )}
            <Separator />
            <div className="grid gap-3 sm:grid-cols-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Tasks touched</p>
                <p className="font-medium">{tasksTouchedCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tasks completed</p>
                <p className="font-medium">{tasksCompletedCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Projects linked</p>
                <p className="font-medium">{session.projectIds.length}</p>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Projects</p>
              <div className="flex flex-wrap gap-2">
                {session.projectIds.length === 0 ? (
                  <span className="text-sm text-muted-foreground">
                    No projects assigned
                  </span>
                ) : (
                  session.projectIds.map(projectId => (
                    <Badge key={projectId} variant="outline">
                      {projectMap.get(projectId) ?? projectId}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Allocation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Task time</span>
              <span className="font-medium">
                {formatDurationMs(durationSummary.activeTaskDurationMs)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Unallocated</span>
              <span className="font-medium">
                {formatDurationMs(durationSummary.unallocatedDurationMs)}
              </span>
            </div>
            {durationSummary.hasOverlap && (
              <Badge variant="secondary">Overlap detected</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {session.status === 'CANCELLED' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cancellation details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Mode</span>
              <span className="font-medium">
                {session.cancelMode ?? 'Unknown'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Cancelled at</span>
              <span className="font-medium">
                {session.cancelledAt
                  ? formatShortDateTime(session.cancelledAt)
                  : '—'}
              </span>
            </div>
            {session.discardedAt && (
              <div className="flex items-center justify-between">
                <span>Discarded at</span>
                <span className="font-medium">
                  {formatShortDateTime(session.discardedAt)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Session flow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground">
            <span>Start {formatShortDateTime(session.startAt)}</span>
            <span>
              {session.endAt
                ? `End ${formatShortDateTime(session.endAt)}`
                : session.status === 'RUNNING'
                  ? 'Live session'
                  : 'Paused session'}
            </span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {flowSegments.length === 0 && (
              <div className="h-full w-full bg-muted-foreground/20" />
            )}
            {flowSegments.map((segment, index) => (
              <div
                key={`${segment.startAt}-${segment.endAt}-${index}`}
                className={cn(
                  'h-full',
                  segment.state === 'RUNNING'
                    ? 'bg-emerald-400/70'
                    : 'bg-amber-400/60'
                )}
                style={{
                  width:
                    totalFlowMs > 0
                      ? `${(segment.durationMs / totalFlowMs) * 100}%`
                      : '0%',
                }}
              />
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {flowSegments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No timing data captured yet.
              </p>
            ) : (
              flowSegments.map((segment, index) => (
                <div
                  key={`${segment.startAt}-${segment.endAt}-${index}`}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="space-y-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        'uppercase tracking-wide text-[10px]',
                        segment.state === 'RUNNING'
                          ? 'border-emerald-500/40 text-emerald-200'
                          : 'border-amber-500/40 text-amber-200'
                      )}
                    >
                      {segment.state === 'RUNNING' ? 'Running' : 'Paused'}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      {formatShortDateTime(segment.startAt)} →{' '}
                      {formatShortDateTime(segment.endAt)}
                    </p>
                  </div>
                  <span className="font-medium">
                    {formatDurationMs(segment.durationMs)}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Activity timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {timelineRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No events recorded for this session.
            </p>
          ) : (
            <div className="relative space-y-6">
              <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />
              {timelineRows.map(({ event, deltaMs, elapsedMs }) => {
                const display = getEventDisplay(event);
                const Icon = display.icon;
                return (
                  <div key={event._id} className="relative flex gap-4">
                    <div
                      className={cn(
                        'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border',
                        toneClasses[display.tone as keyof typeof toneClasses]
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{display.title}</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase tracking-wide"
                        >
                          {display.category}
                        </Badge>
                        {display.context && (
                          <Badge variant="secondary">{display.context}</Badge>
                        )}
                      </div>
                      {display.meta && (
                        <p className="text-xs text-muted-foreground">
                          {display.meta}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatShortDateTime(event.timestamp)}</span>
                        <span>•</span>
                        <span>{`T+${formatDurationMs(elapsedMs)}`}</span>
                        {deltaMs > 0 && (
                          <>
                            <span>•</span>
                            <span>{`+${formatDurationMs(
                              deltaMs
                            )} since last action`}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Task focus</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {taskSummaries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tasks were active in this session.
              </p>
            ) : (
              <div className="space-y-3">
                {taskSummaries.map(task => {
                  const share =
                    durationSummary.effectiveDurationMs > 0
                      ? task.activeDurationMs /
                        durationSummary.effectiveDurationMs
                      : 0;
                  const sharePercent = Math.round(share * 100);
                  return (
                    <div
                      key={task.taskId}
                      className="rounded-md border px-3 py-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {taskMap.get(task.taskId) ?? task.taskId}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {task.wasCompleted ? 'Completed' : 'In progress'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            {formatDurationMs(task.activeDurationMs)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {sharePercent}% of session
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 h-1.5 w-full rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-400/70"
                          style={{ width: `${sharePercent}%` }}
                        />
                      </div>
                      {task.firstActivatedAt && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          First active{' '}
                          {formatShortDateTime(task.firstActivatedAt)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Project breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {projectSummaries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No project time was recorded in this session.
              </p>
            ) : (
              projectSummaries.map(project => (
                <div
                  key={project.projectId}
                  className="flex items-center justify-between"
                >
                  <span>
                    {projectMap.get(project.projectId) ?? project.projectId}
                  </span>
                  <span className="font-medium">
                    {formatDurationMs(project.activeDurationMs)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
