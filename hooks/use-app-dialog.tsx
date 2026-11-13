import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

export type AppDialogButtonStyle =
  | "default"
  | "cancel"
  | "destructive";

export type AppDialogType =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "confirm";

export interface AppDialogButton {
  text: string;
  style?: AppDialogButtonStyle;
  onPress?: () => void | Promise<void>;
}

export interface AppDialogConfig {
  title: string;
  message: string;
  type?: AppDialogType;
  icon?: string;
  buttons?: AppDialogButton[];
}

interface AppDialogContextValue {
  dialog: AppDialogConfig | null;
  showDialog: (config: AppDialogConfig) => void;
  closeDialog: () => void;
}

const AppDialogContext =
  createContext<AppDialogContextValue | null>(null);

export function AppDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dialog, setDialog] =
    useState<AppDialogConfig | null>(null);

  const showDialog = useCallback(
    (config: AppDialogConfig) => {
      setDialog({
        ...config,
        buttons: config.buttons?.length
          ? config.buttons
          : [{ text: "Aceptar" }],
      });
    },
    []
  );

  const closeDialog = useCallback(() => {
    setDialog(null);
  }, []);

  return (
    <AppDialogContext.Provider
      value={{ dialog, showDialog, closeDialog }}
    >
      {children}
    </AppDialogContext.Provider>
  );
}

export function useAppDialog() {
  const context = useContext(AppDialogContext);

  if (!context) {
    throw new Error(
      "useAppDialog debe utilizarse dentro de AppDialogProvider"
    );
  }

  return context;
}
