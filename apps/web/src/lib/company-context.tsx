import React, { createContext, useContext, useState } from 'react';

interface Company {
  id: string;
  name: string;
}

interface CompanyContextType {
  currentCompany: Company | null;
  setCurrentCompany: (company: Company) => void;
  companies: Company[];
  isLoading: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

// Placeholder data
const PLACEHOLDER_COMPANIES: Company[] = [
  { id: '1', name: 'Acme Corp' },
  { id: '2', name: 'Globex' },
];

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [currentCompany, setCurrentCompanyState] = useState<Company | null>(
    () => {
      if (typeof window === 'undefined') return null;
      const saved = localStorage.getItem('devsuite-current-company');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse saved company', e);
        }
      }
      return PLACEHOLDER_COMPANIES[0] || null;
    }
  );
  const [isLoading] = useState(false);

  const setCurrentCompany = (company: Company) => {
    setCurrentCompanyState(company);
    localStorage.setItem('devsuite-current-company', JSON.stringify(company));
  };

  return (
    <CompanyContext.Provider
      value={{
        currentCompany,
        setCurrentCompany,
        companies: PLACEHOLDER_COMPANIES,
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
