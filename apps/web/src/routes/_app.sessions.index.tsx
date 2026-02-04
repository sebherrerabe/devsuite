import {
  createFileRoute,
  Link,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useCurrentCompany } from '@/lib/company-context';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { formatDurationMs, formatShortDateTime } from '@/lib/time';
import { Loader2, Filter, CalendarRange, Archive } from 'lucide-react';
import { debugError, debugGroup, debugLog, debugWarn } from '@/lib/debug';
import type { Id } from '../../../../convex/_generated/dataModel';

export const Route = createFileRoute('/_app/sessions/')({
  component: SessionsPage,
});

function SessionsPage() {
  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?._id;
  const navigate = useNavigate();
  const routerState = useRouterState({
    select: state => ({
      location: state.location,
      matches: state.matches,
      status: state.status,
    }),
  });

  const [statusFilter, setStatusFilter] = useState<
    'all' | 'RUNNING' | 'PAUSED' | 'FINISHED' | 'CANCELLED'
  >('all');
  const [projectFilter, setProjectFilter] = useState<Id<'projects'> | 'all'>(
    'all'
  );
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [includeDiscarded, setIncludeDiscarded] = useState(false);

  const sessions = useQuery(
    api.sessions.listSessions,
    companyId
      ? {
          companyId,
          status: statusFilter === 'all' ? undefined : statusFilter,
          includeDiscarded,
        }
      : 'skip'
  );

  const projects = useQuery(
    api.projects.listProjects,
    companyId ? { companyId, includeArchived: false } : 'skip'
  );

  const projectMap = useMemo(() => {
    const map = new Map<Id<'projects'>, string>();
    projects?.forEach(project => {
      map.set(project._id, project.name);
    });
    return map;
  }, [projects]);

  const filteredSessions = useMemo(() => {
    if (!sessions) return [];
    const startTimestamp = startDate
      ? new Date(startDate + 'T00:00:00').getTime()
      : null;
    const endTimestamp = endDate
      ? new Date(endDate + 'T23:59:59').getTime()
      : null;

    return sessions.filter(session => {
      if (projectFilter !== 'all') {
        if (!session.projectIds.includes(projectFilter)) {
          return false;
        }
      }
      if (startTimestamp !== null && session.startAt < startTimestamp) {
        return false;
      }
      if (endTimestamp !== null && session.startAt > endTimestamp) {
        return false;
      }
      return true;
    });
  }, [sessions, projectFilter, startDate, endDate]);

  const matchIds = useMemo(
    () => routerState.matches.map(match => match.routeId),
    [routerState.matches]
  );

  const hasSessionDetailMatch = matchIds.includes('/_app/sessions/$sessionId');

  useEffect(() => {
    debugLog('sessions', 'SessionsPage mounted');
    return () => {
      debugLog('sessions', 'SessionsPage unmounted');
    };
  }, []);

  useEffect(() => {
    debugGroup('sessions', 'SessionsPage router snapshot', () => {
      debugLog('sessions', 'Location', {
        pathname: routerState.location.pathname,
        search: routerState.location.searchStr,
        hash: routerState.location.hash,
      });
      debugLog('sessions', 'Matches', { matches: matchIds });
      debugLog('sessions', 'Status', { status: routerState.status });
      debugLog('sessions', 'Company', { companyId: companyId ?? 'none' });
    });
  }, [
    routerState.location.pathname,
    routerState.location.searchStr,
    routerState.location.hash,
    routerState.status,
    matchIds,
    companyId,
  ]);

  useEffect(() => {
    debugLog('sessions', 'Sessions query status', {
      status:
        sessions === undefined
          ? 'loading'
          : sessions === null
            ? 'null'
            : 'loaded',
      count: sessions?.length ?? 0,
    });
  }, [sessions]);

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
    debugLog('sessions', 'Filters updated', {
      statusFilter,
      projectFilter,
      startDate,
      endDate,
      includeDiscarded,
    });
  }, [statusFilter, projectFilter, startDate, endDate, includeDiscarded]);

  useEffect(() => {
    if (!hasSessionDetailMatch) return;
    debugWarn(
      'sessions',
      'Session detail route matched while SessionsPage is rendering. If the list stays visible, check for a missing <Outlet /> in /_app/sessions or move the list to an index route.'
    );
  }, [hasSessionDetailMatch]);

  const handleOpenSession = useCallback(
    (
      sessionId: Id<'sessions'>,
      source: 'row' | 'link',
      options?: { skipNavigate?: boolean }
    ) => {
      debugGroup('sessions', 'Navigate to session detail', () => {
        debugLog('sessions', 'Source', { source });
        debugLog('sessions', 'SessionId', { sessionId });
        debugLog('sessions', 'From location', {
          pathname: routerState.location.pathname,
          search: routerState.location.searchStr,
          hash: routerState.location.hash,
        });
        debugLog('sessions', 'Matches', { matches: matchIds });
      });

      if (!options?.skipNavigate) {
        Promise.resolve(
          navigate({
            to: '/sessions/$sessionId',
            params: { sessionId },
          })
        ).catch(error => {
          debugError('sessions', 'Navigation failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    },
    [
      matchIds,
      navigate,
      routerState.location.hash,
      routerState.location.pathname,
      routerState.location.searchStr,
    ]
  );

  if (!companyId) return null;

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sessions</h1>
          <p className="text-muted-foreground">
            Review focus sessions, overlap, and unallocated time.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="h-8 w-[150px]"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="h-8 w-[150px]"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={value =>
              setStatusFilter(
                value as 'all' | 'RUNNING' | 'PAUSED' | 'FINISHED' | 'CANCELLED'
              )
            }
          >
            <SelectTrigger className="h-8 w-[160px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="RUNNING">Running</SelectItem>
              <SelectItem value="PAUSED">Paused</SelectItem>
              <SelectItem value="FINISHED">Finished</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={projectFilter}
            onValueChange={value =>
              setProjectFilter(value as Id<'projects'> | 'all')
            }
          >
            <SelectTrigger className="h-8 w-[200px]">
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

        <Button
          variant={includeDiscarded ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setIncludeDiscarded(!includeDiscarded)}
        >
          <Archive className="mr-2 h-4 w-4" />
          {includeDiscarded ? 'Hide Discarded' : 'Show Discarded'}
        </Button>
      </div>

      {sessions === undefined ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center border border-dashed rounded-lg">
          <p className="text-muted-foreground">No sessions found.</p>
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Start</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Allocation</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSessions.map(session => {
                const projectNames = session.projectIds
                  .map(projectId => projectMap.get(projectId))
                  .filter(Boolean);
                const projectLabel =
                  projectNames.length > 0
                    ? projectNames.slice(0, 2).join(', ')
                    : 'Unassigned';
                const extraProjects =
                  projectNames.length > 2 ? projectNames.length - 2 : 0;

                return (
                  <TableRow
                    key={session._id}
                    className="cursor-pointer"
                    onClick={() => handleOpenSession(session._id, 'row')}
                  >
                    <TableCell className="text-sm">
                      <div className="flex flex-col">
                        <span>{formatShortDateTime(session.startAt)}</span>
                        {session.endAt && (
                          <span className="text-xs text-muted-foreground">
                            Ended {formatShortDateTime(session.endAt)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(session.status)}>
                        {session.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-sm">{projectLabel}</span>
                        {extraProjects > 0 && (
                          <Badge variant="secondary">+{extraProjects}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatDurationMs(
                        session.durationSummary?.effectiveDurationMs ?? 0
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs text-muted-foreground">
                        <span>
                          Tasks:{' '}
                          {formatDurationMs(
                            session.durationSummary?.activeTaskDurationMs ?? 0
                          )}
                          {session.durationSummary?.hasOverlap && (
                            <Badge
                              variant="secondary"
                              className="ml-2 px-1.5 py-0"
                            >
                              Overlap
                            </Badge>
                          )}
                        </span>
                        <span>
                          Unallocated:{' '}
                          {formatDurationMs(
                            session.durationSummary?.unallocatedDurationMs ?? 0
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          to="/sessions/$sessionId"
                          params={{ sessionId: session._id }}
                          onClick={() =>
                            handleOpenSession(session._id, 'link', {
                              skipNavigate: true,
                            })
                          }
                        >
                          Open
                        </Link>
                      </Button>
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
