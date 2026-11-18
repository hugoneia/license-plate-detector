import "react-native-get-random-values";
import "@/global.css";
import { Stack, usePathname } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";
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

const LAST_ACTIVE_TAB_KEY = "lpd_last_active_tab";
const ACTIVE_TAB_PATHS = new Set(["/", "/history", "/stats", "/settings"]);

export const unstable_settings = {
  anchor: "(tabs)",
};

function RootNavigatorContent() {
  const pathname = usePathname();
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;

  const { isLoading: platesLoading } = usePlates();
  const [appIsActive, setAppIsActive] = useState(
    AppState.currentState == null || AppState.currentState === "active"
  );

  useEffect(() => {
    console.log("[LPD][CSV-DIAG] Ruta activa", pathname);

    if (ACTIVE_TAB_PATHS.has(pathname)) {
      void AsyncStorage.setItem(
        LAST_ACTIVE_TAB_KEY,
        pathname
      ).catch((error) => {
        console.error(
          "[LPD][CSV-DIAG] No se pudo guardar la última pestaña",
          error
        );
      });
    }
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

  useEffect(() => {
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

    if (!isReady || !lockStatusReady || isLocked || platesLoading || !appIsActive) {
      console.log("[LPD][CSV-SHARE] Recepción pendiente", {
        isReady,
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
              await importParkingOkCSV(
                { uri: sharedFile.path, name: sharedFile.fileName || "archivo.csv" },
                addAlert,
                () => false,
                () => {},
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
