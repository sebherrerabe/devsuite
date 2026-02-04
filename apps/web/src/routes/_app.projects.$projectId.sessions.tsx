import {
  createFileRoute,
  useNavigate,
  useParams,
  useRouterState,
} from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useCurrentCompany } from '@/lib/company-context';
import { useCallback, useEffect, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { formatDurationMs, formatShortDateTime } from '@/lib/time';
import { debugError, debugGroup, debugLog } from '@/lib/debug';
import type { Id } from '../../../../convex/_generated/dataModel';

export const Route = createFileRoute('/_app/projects/$projectId/sessions')({
  component: ProjectSessionsPage,
});

function ProjectSessionsPage() {
  const { projectId } = useParams({
    from: '/_app/projects/$projectId/sessions',
  });
  const projectIdTyped = projectId as Id<'projects'>;
  const navigate = useNavigate();
  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?._id;
  const routerState = useRouterState({
    select: state => ({
      location: state.location,
      matches: state.matches,
      status: state.status,
    }),
  });

  const sessions = useQuery(
    api.sessions.listSessions,
    companyId ? { companyId } : 'skip'
  );

  const filteredSessions = useMemo(() => {
    if (!sessions) return [];
    return sessions.filter(session =>
      session.projectIds.includes(projectIdTyped)
    );
  }, [sessions, projectIdTyped]);

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

  const matchIds = useMemo(
    () => routerState.matches.map(match => match.routeId),
    [routerState.matches]
  );

  useEffect(() => {
    debugLog('sessions', 'ProjectSessionsPage mounted', {
      projectId: projectIdTyped,
    });
    return () => {
      debugLog('sessions', 'ProjectSessionsPage unmounted', {
        projectId: projectIdTyped,
      });
    };
  }, [projectIdTyped]);

  useEffect(() => {
    debugGroup('sessions', 'ProjectSessions router snapshot', () => {
      debugLog('sessions', 'Location', {
        pathname: routerState.location.pathname,
        search: routerState.location.searchStr,
        hash: routerState.location.hash,
      });
      debugLog('sessions', 'Matches', { matches: matchIds });
      debugLog('sessions', 'Status', { status: routerState.status });
      debugLog('sessions', 'Company', { companyId: companyId ?? 'none' });
      debugLog('sessions', 'Project', { projectId: projectIdTyped });
    });
  }, [
    routerState.location.pathname,
    routerState.location.searchStr,
    routerState.location.hash,
    routerState.status,
    matchIds,
    companyId,
    projectIdTyped,
  ]);

  useEffect(() => {
    debugLog('sessions', 'Project sessions query status', {
      status:
        sessions === undefined
          ? 'loading'
          : sessions === null
            ? 'null'
            : 'loaded',
      totalCount: sessions?.length ?? 0,
      filteredCount: filteredSessions.length,
    });
  }, [sessions, filteredSessions.length]);

  const handleOpenSession = useCallback(
    (sessionId: Id<'sessions'>) => {
      debugGroup(
        'sessions',
        'Navigate to session detail (project view)',
        () => {
          debugLog('sessions', 'SessionId', { sessionId });
          debugLog('sessions', 'From location', {
            pathname: routerState.location.pathname,
            search: routerState.location.searchStr,
            hash: routerState.location.hash,
          });
          debugLog('sessions', 'Matches', { matches: matchIds });
        }
      );

      Promise.resolve(
        navigate({
          to: '/sessions/$sessionId',
          params: { sessionId },
        })
      ).catch(error => {
        debugError('sessions', 'Navigation failed (project view)', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
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

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Sessions</h3>
        <p className="text-sm text-muted-foreground">
          Sessions tied to this project.
        </p>
      </div>

      {sessions === undefined ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center border border-dashed rounded-lg">
          <p className="text-muted-foreground text-sm">
            No sessions for this project yet.
          </p>
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Start</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Allocation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSessions.map(session => (
                <TableRow
                  key={session._id}
                  className="cursor-pointer"
                  onClick={() => handleOpenSession(session._id)}
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
