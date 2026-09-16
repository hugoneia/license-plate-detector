import "react-native-get-random-values";
import "@/global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform, AppState, Modal, View } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import { LockScreen } from "@/components/lock-screen";
import { PlateDataProvider } from "@/lib/plate-context";
import { LockProvider, useLock } from "@/lib/lock-context";
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
                </Modal>
              </GestureHandlerRootView>
            </SafeAreaInsetsContext.Provider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <LockProvider>
        <PlateDataProvider>
          <RootNavigatorContent />
        </PlateDataProvider>
      </LockProvider>
    </SafeAreaProvider>
  );
}
