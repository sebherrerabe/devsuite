import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { authClient } from '@/lib/auth';
import type { Id } from '../../../../convex/_generated/dataModel';
import type {
  AppModule,
  ModuleFlagOverrides,
  ModuleFlags,
} from '@devsuite/shared';

export interface Company {
  _id: Id<'companies'>;
  name: string;
  userId: string;
  isDeleted: boolean;
  moduleFlags?: ModuleFlags;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  metadata?: Record<string, string | number | boolean | null>;
}

interface CompanyContextType {
  currentCompany: Company | null;
  setCurrentCompany: (company: Company | null) => void;
  companies: Company[];
  moduleAccess: ModuleFlags | null;
  companyModuleDefaults: ModuleFlags | null;
  userModuleOverrides: ModuleFlagOverrides | null;
  isModuleEnabled: (module: AppModule) => boolean;
  isLoading: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

const STORAGE_KEY = 'devsuite-current-company-id';

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

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { data: authSession } = authClient.useSession();

  const [currentCompanyId, setCurrentCompanyId] =
    useState<Id<'companies'> | null>(() => {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(STORAGE_KEY) as Id<'companies'> | null;
    });

  const bootstrap = useQuery(
    api.appInit.bootstrap,
    authSession ? { preferredCompanyId: currentCompanyId ?? undefined } : 'skip'
  );
  const isLoading = authSession === undefined || bootstrap === undefined;

  const companies = useMemo(() => bootstrap?.companies ?? [], [bootstrap]);
  const currentCompany = bootstrap?.currentCompany ?? null;
  const moduleAccess = bootstrap?.moduleAccess?.effective ?? null;
  const companyModuleDefaults =
    bootstrap?.moduleAccess?.companyDefaults ?? null;
  const userModuleOverrides = bootstrap?.moduleAccess?.userOverrides ?? null;

  // Handle cleanup when stored company no longer exists.
  // Only run this check after bootstrap resolves for the current query args.
  useEffect(() => {
    if (bootstrap === undefined || currentCompanyId === null) return;

    const exists = companies.some(c => c._id === currentCompanyId);
    if (!exists) {
      // Queue the state update to avoid cascading renders
      const timer = setTimeout(() => {
        setCurrentCompanyId(null);
        localStorage.removeItem(STORAGE_KEY);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [bootstrap, companies, currentCompanyId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.desktopAuth) {
      return;
    }

    const userId = getSessionUserId(authSession);
    if (!userId || !currentCompany?._id) {
      void window.desktopAuth.clearScope().catch(error => {
        console.warn('[desktop] Failed to clear desktop session scope.', error);
      });
      return;
    }

    void window.desktopAuth
      .setScope({
        userId,
        companyId: currentCompany._id,
      })
      .catch(error => {
        console.warn('[desktop] Failed to set desktop session scope.', error);
      });
  }, [authSession, currentCompany?._id]);

  const isModuleEnabled = (module: AppModule) => {
    if (!moduleAccess) {
      return true;
    }
    return moduleAccess[module];
  };

  const setCurrentCompany = (company: Company | null) => {
    if (company) {
      setCurrentCompanyId(company._id);
      localStorage.setItem(STORAGE_KEY, company._id);
    } else {
      setCurrentCompanyId(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <CompanyContext.Provider
      value={{
        currentCompany,
        setCurrentCompany,
        companies,
        moduleAccess,
        companyModuleDefaults,
        userModuleOverrides,
        isModuleEnabled,
        isLoading,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCurrentCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCurrentCompany must be used within a CompanyProvider');
  }
  return context;
}
