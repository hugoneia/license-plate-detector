import React, { createContext, useContext, useState, ReactNode } from "react";

interface LockContextType {
  isLocked: boolean;
  setIsLocked: (locked: boolean) => void;
}

const LockContext = createContext<LockContextType | undefined>(undefined);

export function LockProvider({ children }: { children: ReactNode }) {
  const [isLocked, setIsLocked] = useState<boolean>(false);

  return (
    <LockContext.Provider value={{ isLocked, setIsLocked }}>
      {children}
    </LockContext.Provider>
  );
}

export function useLock() {
  const context = useContext(LockContext);
  if (!context) {
    throw new Error("useLock must be used within a LockProvider");
  }
  return context;
}
