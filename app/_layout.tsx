import "react-native-get-random-values";
import "@/global.css";
import { Stack, useRouter, useRootNavigationState } from "expo-router";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform, AppState, Modal, View } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import { LockScreen } from "@/components/lock-screen";
import { PlateDataProvider } from "@/lib/plate-context";
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
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const { isLocked, setIsLocked, lockEnabled, refreshLockStatus } = useLock();
  const { alerts, removeAlert } = useAlerts();
  const { dialog, closeDialog } = useAppDialog();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const { hasShareIntent, shareIntent } = useShareIntentContext();
  const handledShareRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasShareIntent) {
      handledShareRef.current = null;
      return;
    }

    const sharedFile = shareIntent.files?.find((file) =>
      file.fileName?.toLowerCase().endsWith(".csv") ||
      file.mimeType?.toLowerCase().includes("csv")
    );

    if (!sharedFile) return;

    // Esperar a que Expo Router haya montado el navegador raíz.
    if (!rootNavigationState?.key) return;

    const key = `${sharedFile.path}:${sharedFile.fileName}`;
    if (handledShareRef.current === key) return;

    handledShareRef.current = key;
    router.replace("/(tabs)/settings" as never);
  }, [hasShareIntent, shareIntent.files, router, rootNavigationState?.key]);


  useEffect(() => {
    refreshLockStatus();
  }, []);

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
