import { Link } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';

import { api } from '../../../../convex/_generated/api';
import { authClient } from '@/lib/auth';
import { useCurrentCompany } from '@/lib/company-context';
import { useDesktopUpdaterState } from '@/lib/desktop-updater';
import type { DesktopUpdaterConsent } from '@/lib/desktop-updater-types';
import { showToast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function getSessionUserId(sessionData: unknown): string | null {
  if (!sessionData || typeof sessionData !== 'object') {
    return null;
  }

  const root = sessionData as {
    session?: { userId?: unknown } | null;
    user?: { id?: unknown } | null;
  };

  if (
    root.session &&
    typeof root.session.userId === 'string' &&
    root.session.userId.trim()
  ) {
    return root.session.userId.trim();
  }

  if (root.user && typeof root.user.id === 'string' && root.user.id.trim()) {
    return root.user.id.trim();
  }

  return null;
}

export function DesktopAutoUpdateConsentPrompt() {
  const { data: authSession } = authClient.useSession();
  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?._id;
  const userId = getSessionUserId(authSession);
  const settings = useQuery(
    api.userSettings.get,
    companyId ? { companyId } : 'skip'
  );
  const updateSettings = useMutation(api.userSettings.update);
  const backendConsent = settings?.desktopApp?.autoUpdateConsent ?? null;
  const { isAvailable, state, setConsent } =
    useDesktopUpdaterState(backendConsent);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const shouldPrompt =
    isAvailable &&
    !!companyId &&
    !!userId &&
    settings !== undefined &&
    backendConsent === null &&
    state?.consent === 'unset';

  const persistConsent = async (
    next: Exclude<DesktopUpdaterConsent, 'unset'>
  ) => {
    if (!companyId) {
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedAt = Date.now();
      await Promise.all([
        setConsent(next),
        updateSettings({
          companyId,
          desktopApp: {
            autoUpdateConsent: next,
            autoUpdateConsentUpdatedAt: updatedAt,
          },
        }),
      ]);
    } catch (error) {
      showToast.error(
        error instanceof Error
          ? error.message
          : 'Failed to save desktop auto-update preference'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={shouldPrompt}
      onOpenChange={open => {
        if (!open && shouldPrompt && !isSubmitting) {
          void persistConsent('disabled');
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enable desktop auto-updates?</DialogTitle>
          <DialogDescription>
            DevSuite can check public GitHub Releases, download stable updates
            in the background, and ask before restarting. You can change this
            later in Desktop Settings.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
          <p>Current version: {state?.currentVersion ?? 'Unknown'}</p>
          <p>Stable updates only. Restart is always user-confirmed.</p>
        </div>
        <DialogFooter className="gap-2 sm:justify-between sm:space-x-0">
          <Link to="/settings/desktop" className="inline-flex">
            <Button variant="outline" disabled={isSubmitting}>
              Open Desktop Settings
            </Button>
          </Link>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => void persistConsent('disabled')}
              disabled={isSubmitting}
            >
              Not now
            </Button>
            <Button
              onClick={() => void persistConsent('enabled')}
              disabled={isSubmitting}
            >
              Enable auto-updates
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
