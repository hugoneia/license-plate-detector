import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Alert, AlertType } from "@/types/license-plate";

const SUCCESS_ALERT_DURATION = 1500;
const DEFAULT_ALERT_DURATION = 3000;

interface AlertsContextValue {
  alerts: Alert[];
  addAlert: (message: string, type?: AlertType, duration?: number) => string;
  removeAlert: (id: string) => void;
  clearAlerts: () => void;
}

const AlertsContext = createContext<AlertsContextValue | null>(null);

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const nextId = useRef(0);

  const removeAlert = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setAlerts((current) => current.filter((alert) => alert.id !== id));
  }, []);

  const clearAlerts = useCallback(() => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
    setAlerts([]);
  }, []);

  const addAlert = useCallback(
    (message: string, type: AlertType = "info", duration?: number) => {
      const alertDuration =
        duration ??
        (type === "success"
          ? SUCCESS_ALERT_DURATION
          : DEFAULT_ALERT_DURATION);

      const id = `${Date.now()}-${++nextId.current}`;
      const alert: Alert = {
        id,
        type,
        message,
        duration: alertDuration,
      };

      setAlerts((current) => [...current, alert]);

      if (alertDuration > 0) {
        const timer = setTimeout(() => {
          timers.current.delete(id);
          setAlerts((current) =>
            current.filter((item) => item.id !== id)
          );
        }, alertDuration);

        timers.current.set(id, timer);
      }

      return id;
    },
    []
  );

  useEffect(() => {
    return () => {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current.clear();
    };
  }, []);

  return (
    <AlertsContext.Provider
      value={{ alerts, addAlert, removeAlert, clearAlerts }}
    >
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  const context = useContext(AlertsContext);

  if (!context) {
    throw new Error("useAlerts debe utilizarse dentro de AlertsProvider");
  }

  return context;
}
