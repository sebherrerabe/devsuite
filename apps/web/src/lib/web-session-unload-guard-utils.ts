type ActiveSessionSnapshot = {
  _id: string;
  status: string;
};

export function buildPauseOnUnloadUrl(siteUrl: string): string {
  return new URL('/web/session/pause-on-unload', siteUrl).toString();
}

export function shouldPauseSessionOnUnload(params: {
  isDesktopRuntime: boolean;
  isSessionsEnabled: boolean;
  companyId: string | null | undefined;
  siteUrl: string | null | undefined;
  activeSession: ActiveSessionSnapshot | null | undefined;
}): params is {
  isDesktopRuntime: false;
  isSessionsEnabled: true;
  companyId: string;
  siteUrl: string;
  activeSession: ActiveSessionSnapshot;
} {
  return (
    !params.isDesktopRuntime &&
    params.isSessionsEnabled &&
    typeof params.companyId === 'string' &&
    params.companyId.length > 0 &&
    typeof params.siteUrl === 'string' &&
    params.siteUrl.length > 0 &&
    !!params.activeSession &&
    params.activeSession.status === 'RUNNING'
  );
}
