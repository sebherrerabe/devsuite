import React, { createContext, useContext, useState } from 'react';

interface PrivacyModeContextType {
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
}

const PrivacyModeContext = createContext<PrivacyModeContextType | undefined>(
  undefined
);

export function PrivacyModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isPrivacyMode, setIsPrivacyMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('devsuite-privacy-mode');
    return saved === 'true';
  });

  const togglePrivacyMode = () => {
    setIsPrivacyMode(prev => {
      const next = !prev;
      localStorage.setItem('devsuite-privacy-mode', String(next));
      return next;
    });
  };

  return (
    <PrivacyModeContext.Provider value={{ isPrivacyMode, togglePrivacyMode }}>
      {children}
    </PrivacyModeContext.Provider>
  );
}

export function usePrivacyMode() {
  const context = useContext(PrivacyModeContext);
  if (context === undefined) {
    throw new Error('usePrivacyMode must be used within a PrivacyModeProvider');
  }
  return context;
}
