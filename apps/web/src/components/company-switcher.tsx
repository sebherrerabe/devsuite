import { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useCurrentCompany, type Company } from '@/lib/company-context';
import { authClient } from '@/lib/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, Building2 } from 'lucide-react';

export function CompanySwitcher({
  useNativeDesktopDialogs = false,
}: {
  useNativeDesktopDialogs?: boolean;
}) {
  const { currentCompany, setCurrentCompany, companies, isLoading } =
    useCurrentCompany();
  const { data: authSession } = authClient.useSession();

  const [pendingCompany, setPendingCompany] = useState<Company | null>(null);
  const [isActing, setIsActing] = useState(false);

  const userId = useMemo(() => {
    const root = authSession as
      | { session?: { userId?: string } | null; user?: { id?: string } | null }
      | null
      | undefined;
    return root?.session?.userId ?? root?.user?.id ?? null;
  }, [authSession]);

  const activeSession = useQuery(
    api.sessions.getActiveSession,
    currentCompany?._id ? { companyId: currentCompany._id } : 'skip'
  );

  const hasNativeCompanionDialogApi =
    useNativeDesktopDialogs &&
    typeof window !== 'undefined' &&
    !!window.desktopCompanionUi?.confirmCompanySwitch;

  const commitSwitchToCompany = (company: Company) => {
    setCurrentCompany(company);
    setPendingCompany(null);
  };

  const pauseAndSwitch = async (company: Company) => {
    try {
      if (activeSession && userId && window.desktopSession?.requestAction) {
        const scope = { userId, companyId: activeSession.companyId };
        await window.desktopSession.requestAction(scope, 'pause');
      }
    } catch {
      // Fallback: just switch without pausing if action fails.
    } finally {
      commitSwitchToCompany(company);
    }
  };

  const endAndSwitch = async (company: Company) => {
    try {
      if (activeSession && userId && window.desktopSession?.requestAction) {
        const scope = { userId, companyId: activeSession.companyId };
        await window.desktopSession.requestAction(scope, 'end');
      }
    } catch {
      // Fallback: just switch without ending if action fails.
    } finally {
      commitSwitchToCompany(company);
    }
  };

  const handleNativeCompanionSwitch = async (company: Company) => {
    if (!window.desktopCompanionUi?.confirmCompanySwitch) {
      setPendingCompany(company);
      return;
    }

    setIsActing(true);
    try {
      const decision = await window.desktopCompanionUi.confirmCompanySwitch(
        company.name
      );
      if (decision === 'stay_here') {
        return;
      }
      if (decision === 'leave_running') {
        commitSwitchToCompany(company);
        return;
      }
      if (decision === 'pause_session') {
        await pauseAndSwitch(company);
        return;
      }
      await endAndSwitch(company);
    } catch (error) {
      console.warn(
        '[desktop] Failed to open native company switch dialog.',
        error
      );
    } finally {
      setIsActing(false);
    }
  };

  const handleSelectCompany = (company: Company) => {
    if (company._id === currentCompany?._id) return;

    if (activeSession) {
      if (hasNativeCompanionDialogApi) {
        void handleNativeCompanionSwitch(company);
        return;
      }
      setPendingCompany(company);
      return;
    }

    setCurrentCompany(company);
  };

  const commitSwitch = () => {
    if (!pendingCompany) return;
    commitSwitchToCompany(pendingCompany);
  };

  const handlePause = async () => {
    if (!pendingCompany) {
      return;
    }
    setIsActing(true);
    await pauseAndSwitch(pendingCompany);
    setIsActing(false);
  };

  const handleEnd = async () => {
    if (!pendingCompany) {
      return;
    }
    setIsActing(true);
    await endAndSwitch(pendingCompany);
    setIsActing(false);
  };

  const handleLeaveRunning = () => {
    setIsActing(false);
    commitSwitch();
  };

  const handleCancel = () => {
    setPendingCompany(null);
    setIsActing(false);
  };

  if (isLoading) {
    return (
      <Button
        variant="outline"
        role="combobox"
        className="w-[160px] sm:w-[180px] md:w-[200px] lg:w-[220px] justify-between"
        disabled
      >
        <div className="flex items-center gap-2 truncate">
          <Building2 className="h-4 w-4 shrink-0 opacity-50 animate-pulse" />
          <span className="truncate">Loading...</span>
        </div>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-[160px] sm:w-[180px] md:w-[200px] lg:w-[220px] justify-between"
          >
            <div className="flex items-center gap-2 truncate">
              <Building2 className="h-4 w-4 shrink-0 opacity-50" />
              <span className="truncate">
                {currentCompany?.name || 'Select company...'}
              </span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[160px] sm:w-[180px] md:w-[200px] lg:w-[220px]">
          <DropdownMenuLabel>Companies</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {companies.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No companies found
            </div>
          ) : (
            companies.map(company => (
              <DropdownMenuItem
                key={company._id}
                onSelect={() => handleSelectCompany(company)}
                className="flex items-center justify-between"
              >
                {company.name}
                {currentCompany?._id === company._id && (
                  <Check className="h-4 w-4" />
                )}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={pendingCompany !== null}
        onOpenChange={open => {
          if (!open) handleCancel();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Active session in progress</AlertDialogTitle>
            <AlertDialogDescription>
              You have an active session. What would you like to do before
              switching to <strong>{pendingCompany?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={handleCancel} disabled={isActing}>
              Stay here
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => void handleLeaveRunning()}
              disabled={isActing}
            >
              Leave running
            </Button>
            <Button
              variant="outline"
              onClick={() => void handlePause()}
              disabled={isActing}
            >
              Pause session
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleEnd()}
              disabled={isActing}
            >
              End session
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
