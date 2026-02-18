import { useState, useCallback } from "react";
import type { Alert, AlertType } from "@/types/license-plate";

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const addAlert = useCallback(
    (message: string, type: AlertType = "info", duration: number = 3000) => {
      const id = Date.now().toString();
      const alert: Alert = { id, type, message, duration };

      setAlerts((prev) => [...prev, alert]);

      if (duration > 0) {
        setTimeout(() => {
          setAlerts((prev) => prev.filter((a) => a.id !== id));
        }, duration);
      }

      return id;
    },
    []
  );

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  return {
    alerts,
    addAlert,
    removeAlert,
    clearAlerts,
  };
}
