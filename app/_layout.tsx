import "react-native-get-random-values";
import "@/global.css";
import { Stack, usePathname, useRootNavigationState } from "expo-router";
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
  clearPendingParkingOkShare,
  enqueueParkingOkShare,
  loadPendingParkingOkShare,
  type PendingParkingOkShare,
} from "@/lib/parking-ok-share-queue";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets } from "react-native-safe-area-context";


const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

let rootLayoutInstanceCounter = 0;


export const unstable_settings = {
  anchor: "(tabs)",
};

function RootNavigatorContent() {
  const pathname = usePathname();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    console.log("[LPD][NAV-DIAG] Estado Root Navigation", {
      pathname,
      key: rootNavigationState?.key ?? null,
      index: rootNavigationState?.index ?? null,
      routes: rootNavigationState?.routes?.map((route) => route.name) ?? null,
    });
  }, [pathname, rootNavigationState]);
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
  const [pendingParkingShare, setPendingParkingShare] =
    useState<PendingParkingOkShare | null>(null);
  const queuedShareRef = useRef<string | null>(null);
  const shownShareRef = useRef<string | null>(null);

  // El Intent se materializa en almacenamiento temporal inmediatamente. Este
  // efecto no espera a navegación, desbloqueo ni carga de matrículas.
  useEffect(() => {
    if (!isReady || !hasShareIntent) return;

    const candidateFiles = shareIntent.files ?? [];
    const sharedFile = candidateFiles.find((file) =>
      file.fileName?.toLowerCase().endsWith(".csv") ||
      file.mimeType?.toLowerCase().includes("csv")
    ) ?? (candidateFiles.length === 1 ? candidateFiles[0] : undefined);

    if (!sharedFile?.path) {
      console.error("[LPD][CSV-QUEUE] Intent sin archivo utilizable");
      resetShareIntent();
      return;
    }

    const key = `${sharedFile.path}:${sharedFile.fileName ?? ""}`;
    if (queuedShareRef.current === key) return;
    queuedShareRef.current = key;

    void (async () => {
      try {
        const pending = await enqueueParkingOkShare({
          uri: sharedFile.path,
          name: sharedFile.fileName,
        });
        setPendingParkingShare(pending);
        resetShareIntent();
        console.log("[LPD][CSV-QUEUE] CSV copiado a almacenamiento temporal");
      } catch (error) {
        queuedShareRef.current = null;
        resetShareIntent();
        console.error("[LPD][CSV-QUEUE] No se pudo guardar el CSV temporal", error);
        addAlert("No se pudo preparar el CSV compartido", "error");
      }
    })();
  }, [isReady, hasShareIntent, shareIntent.files, resetShareIntent, addAlert]);

  // Recuperar una cola creada antes de un cierre, remount o bloqueo.
  useEffect(() => {
    void loadPendingParkingOkShare().then(setPendingParkingShare).catch((error) => {
      console.error("[LPD][CSV-QUEUE] No se pudo recuperar la cola", error);
    });
  }, []);

  useEffect(() => {
    if (
      !pendingParkingShare ||
      shownShareRef.current === pendingParkingShare.uri ||
      !lockStatusReady ||
      isLocked ||
      platesLoading ||
      !appIsActive
    ) {
      return;
    }

    shownShareRef.current = pendingParkingShare.uri;
    showDialog({
      title: "CSV recibido",
      message: "Se ha recibido un archivo CSV de Parking OK. ¿Quieres importarlo?",
      buttons: [
        {
          text: "Cancelar",
          style: "cancel",
          onPress: () => {
            void clearPendingParkingOkShare();
            setPendingParkingShare(null);
            shownShareRef.current = null;
          },
        },
        {
          text: "Importar",
          style: "default",
          onPress: async () => {
            try {
              const { importParkingOkCSV } = await import("@/lib/parking-ok-csv-import");
              const parkingOkChangeStorage = await import("@/lib/parking-ok-storage");
              const versionBefore = parkingOkChangeStorage.getParkingOkChangeVersion();

              await importParkingOkCSV(
                { uri: pendingParkingShare.uri, name: pendingParkingShare.name },
                addAlert,
                () => false,
                () => {},
              );

              await parkingOkChangeStorage.refreshParkingOkChangesAndWait(versionBefore);
            } finally {
              await clearPendingParkingOkShare();
              setPendingParkingShare(null);
              shownShareRef.current = null;
            }
          },
        },
      ],
    });
  }, [pendingParkingShare, lockStatusReady, isLocked, platesLoading, appIsActive, showDialog, addAlert]);


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
  const instanceIdRef = useRef<number | null>(null);

  if (instanceIdRef.current === null) {
    rootLayoutInstanceCounter += 1;
    instanceIdRef.current = rootLayoutInstanceCounter;
  }

  const instanceId = instanceIdRef.current;

  useEffect(() => {
    console.log("[LPD][NAV-DIAG] RootLayout montado", { instanceId });

    return () => {
      console.log("[LPD][NAV-DIAG] RootLayout desmontado", { instanceId });
    };
  }, [instanceId]);

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
