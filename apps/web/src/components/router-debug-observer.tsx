import { useEffect, useMemo, useRef } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { debugGroup, debugLog, debugWarn, isDebugEnabled } from '@/lib/debug';

export function RouterDebugObserver() {
  const state = useRouterState({
    select: value => ({
      location: value.location,
      matches: value.matches,
      pendingMatches: value.pendingMatches,
      status: value.status,
    }),
  });

  const snapshot = useMemo(() => {
    const summarize = (matches: typeof state.matches) =>
      matches.map(match => ({
        routeId: match.routeId,
        pathname: match.pathname,
        params: match.params,
        status: match.status,
      }));

    return {
      location: {
        pathname: state.location.pathname,
        search: state.location.searchStr,
        hash: state.location.hash,
      },
      status: state.status,
      matches: summarize(state.matches),
      pendingMatches: state.pendingMatches
        ? summarize(state.pendingMatches)
        : [],
    };
  }, [state]);

  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isDebugEnabled('router')) return;

    const key = [
      snapshot.location.pathname,
      snapshot.location.search,
      snapshot.location.hash,
      snapshot.status,
      snapshot.matches.map(match => match.routeId).join(','),
      snapshot.pendingMatches.map(match => match.routeId).join(','),
    ].join('|');

    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    debugGroup('router', 'Router state change', () => {
      debugLog('router', 'Location', snapshot.location);
      debugLog('router', 'Status', { status: snapshot.status });
      debugLog('router', 'Matches', { matches: snapshot.matches });
      if (snapshot.pendingMatches.length > 0) {
        debugLog('router', 'Pending matches', {
          pendingMatches: snapshot.pendingMatches,
        });
      }

      const sessionDetailMatch = snapshot.matches.some(
        match => match.routeId === '/_app/sessions/$sessionId'
      );
      if (sessionDetailMatch) {
        debugWarn(
          'router',
          'Session detail route is matched. If the UI still shows the list, check for a missing <Outlet /> in the sessions parent route.'
        );
      }
    });
  }, [snapshot]);

  return null;
}
