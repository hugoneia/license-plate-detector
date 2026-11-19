import "react-native-get-random-values";
import "@/global.css";
import { Stack, usePathname, useRootNavigationState } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";
import { PENDING_SHARE_STARTUP_KEY } from "./+native-intent";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform, AppState, Modal, View } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import { LockScreen } from "@/components/lock-screen";
import { PlateDataProvider, usePlates } from "@/lib/plate-context";
import { PlateAnonymizationProvider } from "@/lib/plate-anonymization-context";
import { LockProvider, useLock } from "@/lib/lock-context";
import { AlertsProvider, useAlerts } from "@/hooks/use-alerts";
import { AppDialogProvider, useAppDialog } from "@/hooks/use-app-dialog";
import { AlertsOverlay, AlertsModalLayer } from "@/components/alerts-overlay";
import { AppDialogOverlay } from "@/components/app-dialog-overlay";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets } from "react-native-safe-area-context";


const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };


export const unstable_settings = {
  anchor: "(tabs)",
};

function RootNavigatorContent() {
  const pathname = usePathname();
  const rootNavigationState = useRootNavigationState();
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;

  const { isLoading: platesLoading } = usePlates();
  const [appIsActive, setAppIsActive] = useState(
    AppState.currentState == null || AppState.currentState === "active"
  );

  useEffect(() => {
    console.log("[LPD][CSV-DIAG] Ruta activa", pathname);
  }, [pathname]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      console.log("[LPD][CSV-DIAG] AppState", {
        from: AppState.currentState,
        to: state,
      });
      setAppIsActive(state === "active");
    });

    return () => subscription.remove();
  }, []);

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const { isLocked, setIsLocked, lockEnabled, lockStatusReady } = useLock();
  const { alerts, removeAlert, addAlert } = useAlerts();
  const { dialog, closeDialog, showDialog } = useAppDialog();
  const { isReady, hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const processedParkingShareRef = useRef<string | null>(null);

  const [shareStartupCheckComplete, setShareStartupCheckComplete] =
    useState(false);
  const [pendingInitialShare, setPendingInitialShare] =
    useState(false);

  // La marca se escribe desde native-intent antes de montar el Root Layout.
  // No se considera que no haya CSV hasta terminar esta comprobación.
  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(PENDING_SHARE_STARTUP_KEY)
      .then((value) => {
        if (cancelled) return;

        setPendingInitialShare(value === "1");
        setShareStartupCheckComplete(true);

        console.log("[LPD][CSV-QUEUE] Comprobación inicial terminada", {
          pendingShare: value === "1",
        });
      })
      .catch((error) => {
        if (cancelled) return;

        console.error(
          "[LPD][CSV-QUEUE] No se pudo comprobar la marca inicial",
          error
        );
        setShareStartupCheckComplete(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // La intención puede llegar después de montar la interfaz.
  // La marca solo se elimina cuando el plugin entrega el archivo.
  useEffect(() => {
    if (!pendingInitialShare || !hasShareIntent) return;

    console.log("[LPD][CSV-QUEUE] El archivo compartido ya está disponible");

    setPendingInitialShare(false);

    void AsyncStorage.removeItem(PENDING_SHARE_STARTUP_KEY).catch(
      (error) => {
        console.error(
          "[LPD][CSV-QUEUE] No se pudo limpiar la marca inicial",
          error
        );
      }
    );
  }, [pendingInitialShare, hasShareIntent]);

  // No mantener indefinidamente una intención inicial si el plugin
  // no entrega el archivo. Si llega más tarde, el receptor normal
  // seguirá pudiendo procesarlo.
  useEffect(() => {
    if (!pendingInitialShare) return;

    const timeout = setTimeout(() => {
      console.warn(
        "[LPD][CSV-QUEUE] Tiempo agotado esperando el archivo compartido"
      );

      setPendingInitialShare(false);

      void AsyncStorage.removeItem(PENDING_SHARE_STARTUP_KEY).catch(
        (error) => {
          console.error(
            "[LPD][CSV-QUEUE] No se pudo limpiar la marca tras el timeout",
            error
          );
        }
      );
    }, 10000);

    return () => clearTimeout(timeout);
  }, [pendingInitialShare]);

  useEffect(() => {
    if (!shareStartupCheckComplete || pendingInitialShare) {
      console.log("[LPD][CSV-QUEUE] Esperando al receptor del CSV", {
        startupCheckComplete: shareStartupCheckComplete,
        pendingInitialShare,
        hasShareIntent,
        isReady,
      });
      return;
    }

    console.log("[LPD][CSV-DIAG] Estado de recepción", {
      hasShareIntent,
      isReady,
      pathname,
      appIsActive,
      appState: AppState.currentState,
      lockStatusReady,
      isLocked,
      platesLoading,
      fileCount: shareIntent.files?.length ?? 0,
    });

    if (!hasShareIntent) {
      processedParkingShareRef.current = null;
      return;
    }

    if (
      !isReady ||
      !rootNavigationState?.key ||
      !lockStatusReady ||
      isLocked ||
      platesLoading ||
      !appIsActive
    ) {
      console.log("[LPD][CSV-SHARE] Recepción pendiente", {
        isReady,
        rootNavigationReady: Boolean(rootNavigationState?.key),
        lockStatusReady,
        isLocked,
        platesLoading,
        appIsActive,
        appState: AppState.currentState,
      });
      return;
    }

    const sharedFile = shareIntent.files?.find((file) =>
      file.fileName?.toLowerCase().endsWith(".csv") ||
      file.mimeType?.toLowerCase().includes("csv")
    );

    if (!sharedFile) {
      console.log("[LPD][CSV-DIAG] reset: no se encontró CSV");
      resetShareIntent();
      return;
    }

    const key = `${sharedFile.path}:${sharedFile.fileName}`;
    if (processedParkingShareRef.current === key) return;
    try {
      processedParkingShareRef.current = key;
      showDialog({
      title: "CSV recibido",
      message: "Se ha recibido un archivo CSV de Parking OK. ¿Quieres importar sus registros?",
      buttons: [
        {
          text: "Cancelar",
          style: "cancel",
          onPress: () => {
            console.log("[LPD][CSV-DIAG] reset: usuario canceló");
            resetShareIntent();
          },
        },
        {
          text: "Importar",
          style: "default",
          onPress: async () => {
            try {
              const { importParkingOkCSV } = await import("@/lib/parking-ok-csv-import");
              const parkingOkChangeStorage =
                await import("@/lib/parking-ok-storage");
              const parkingOkChangeVersionBeforeImport =
                parkingOkChangeStorage.getParkingOkChangeVersion();

              await importParkingOkCSV(
                { uri: sharedFile.path, name: sharedFile.fileName || "archivo.csv" },
                addAlert,
                () => false,
                () => {},
              );

              // La importación compartida espera a que Historial termine
              // su lectura, incluso si todos los registros eran duplicados.
              await parkingOkChangeStorage.refreshParkingOkChangesAndWait(
                parkingOkChangeVersionBeforeImport
              );

              console.log(
                "[LPD][CSV-QUEUE] Notificaciones activas de Parking OK completadas"
              );
            } finally {
              console.log("[LPD][CSV-DIAG] reset: terminó la importación");
              resetShareIntent();
            }
          },
        },
      ],
      });

      console.log("[LPD][CSV-SHARE] Diálogo de importación solicitado", {
        fileName: sharedFile.fileName || "archivo.csv",
      });
    } catch (error) {
      if (processedParkingShareRef.current === key) {
        processedParkingShareRef.current = null;
      }
console.error("[LPD][CSV-SHARE] No se pudo solicitar el diálogo", error);
    }
  }, [
    isReady,
    shareStartupCheckComplete,
    pendingInitialShare,
    rootNavigationState?.key,
    hasShareIntent,
    shareIntent.files,
    resetShareIntent,
    lockStatusReady,
    isLocked,
    platesLoading,
    appIsActive,
    addAlert,
    showDialog,
  ]);


  useEffect(() => {
    if (Platform.OS === 'web' || !lockEnabled) return;

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    function handleAppStateChange(state: string) {
      if ((state === 'background' || state === 'inactive') && lockEnabled) {
        setIsLocked(true);
      }
    }

    return () => {
      subscription.remove();
    };
  }, [lockEnabled, setIsLocked]);

  return (
    <ThemeProvider>
          <SafeAreaInsetsContext.Provider value={insets}>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <Stack screenOptions={{ headerShown: false }} />
                <AlertsOverlay alerts={alerts} onRemoveAlert={removeAlert} />
                <AppDialogOverlay dialog={dialog} onClose={closeDialog} />
                <StatusBar style="auto" />

                {/* Modal de Bloqueo Global a Pantalla Completa */}
                <Modal
                  visible={isLocked}
                  transparent={false}
                  animationType="fade"
                  onRequestClose={() => {}}
                >
                  <View className="flex-1 bg-background">
                    <LockScreen
                      onUnlock={() => setIsLocked(false)}
                    />
                  </View>
                  <AlertsModalLayer />
                </Modal>
              </GestureHandlerRootView>
            </SafeAreaInsetsContext.Provider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ShareIntentProvider options={{ resetOnBackground: false }}>
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <LockProvider>
        <PlateDataProvider>
          <PlateAnonymizationProvider>
            <AlertsProvider>
              <AppDialogProvider>
                <RootNavigatorContent />
              </AppDialogProvider>
            </AlertsProvider>
          </PlateAnonymizationProvider>
        </PlateDataProvider>
      </LockProvider>
    </SafeAreaProvider>
    </ShareIntentProvider>
  );
}
