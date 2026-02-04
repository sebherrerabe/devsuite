import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { authClient } from '@/lib/auth';
import type { Id } from '../../../../convex/_generated/dataModel';

export interface Company {
  _id: Id<'companies'>;
  name: string;
  userId: string;
  isDeleted: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  metadata?: Record<string, string | number | boolean | null>;
}

interface CompanyContextType {
  currentCompany: Company | null;
  setCurrentCompany: (company: Company | null) => void;
  companies: Company[];
  isLoading: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

const STORAGE_KEY = 'devsuite-current-company-id';

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { data: authSession } = authClient.useSession();
  const companies = useQuery(api.companies.list, authSession ? {} : 'skip');
  const isLoading = authSession === undefined || companies === undefined;

  const [currentCompanyId, setCurrentCompanyId] =
    useState<Id<'companies'> | null>(() => {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(STORAGE_KEY) as Id<'companies'> | null;
    });

  const currentCompany =
    companies?.find(c => c._id === currentCompanyId) || null;

  // Handle cleanup when stored company no longer exists
  // Only run this effect when companies list changes, not currentCompanyId
  useEffect(() => {
    if (!companies || currentCompanyId === null) return;

    const exists = companies.some(c => c._id === currentCompanyId);
    if (!exists) {
      // Queue the state update to avoid cascading renders
      const timer = setTimeout(() => {
        setCurrentCompanyId(null);
        localStorage.removeItem(STORAGE_KEY);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [companies, currentCompanyId]);

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
        companies: companies || [],
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
