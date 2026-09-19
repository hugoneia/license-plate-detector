import { useState, useCallback } from "react";
import type { Alert, AlertType } from "@/types/license-plate";

const SUCCESS_ALERT_DURATION = 1800;
const DEFAULT_ALERT_DURATION = 3000;

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const addAlert = useCallback(
    (message: string, type: AlertType = "info", duration?: number) => {
      const alertDuration =
        duration ??
        (type === "success"
          ? SUCCESS_ALERT_DURATION
          : DEFAULT_ALERT_DURATION);
      const id = Date.now().toString();
      const alert: Alert = { id, type, message, duration: alertDuration };

      setAlerts((prev) => [...prev, alert]);

      if (alertDuration > 0) {
        setTimeout(() => {
          setAlerts((prev) => prev.filter((a) => a.id !== id));
        }, alertDuration);
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
