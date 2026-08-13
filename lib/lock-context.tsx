import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { isLockEnabled, setLockEnabled as persistLockEnabled } from "@/lib/crypto";

interface LockContextType {
  isLocked: boolean;
  setIsLocked: (locked: boolean) => void;
  lockEnabled: boolean;
  setLockEnabled: (enabled: boolean) => Promise<void>;
  refreshLockStatus: () => Promise<void>;
}

const LockContext = createContext<LockContextType | undefined>(undefined);

export function LockProvider({ children }: { children: ReactNode }) {
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [lockEnabled, setLockEnabledState] = useState<boolean>(false);

  const refreshLockStatus = async () => {
    try {
      const enabled = await isLockEnabled();
      setLockEnabledState(enabled);
      if (!enabled) {
        setIsLocked(false);
      }
    } catch (error) {
      console.error("Error refreshing lock status:", error);
    }
  };

  const setLockEnabled = async (enabled: boolean) => {
    try {
      await persistLockEnabled(enabled);
      setLockEnabledState(enabled);
      if (!enabled) {
        setIsLocked(false);
      }
    } catch (error) {
      console.error("Error setting lock enabled:", error);
      throw error;
    }
  };

  useEffect(() => {
    const init = async () => {
      const enabled = await isLockEnabled();
      setLockEnabledState(enabled);
      if (enabled) {
        setIsLocked(true);
      }
    };
    init();
  }, []);

  return (
    <LockContext.Provider value={{ isLocked, setIsLocked, lockEnabled, setLockEnabled, refreshLockStatus }}>
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
