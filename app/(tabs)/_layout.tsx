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
import type { EdgeInsets, Rect } from "react-native-safe-area-context";

import {
  initManusRuntime,
  subscribeSafeAreaInsets,
} from "@/lib/_core/manus-runtime";

const DEFAULT_WEB_INSETS: EdgeInsets = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

const DEFAULT_WEB_FRAME: Rect = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
};

export const unstable_settings = {
  anchor: "(tabs)",
};

function RootNavigatorContent() {
  const initialInsets =
    initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame =
    initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  const {
    isLocked,
    setIsLocked,
    lockEnabled,
    refreshLockStatus,
  } = useLock();

  useEffect(() => {
    initManusRuntime();
  }, []);

  useEffect(() => {
    refreshLockStatus();
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" || !lockEnabled) return;

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    function handleAppStateChange(state: string) {
      if (
        (state === "background" || state === "inactive") &&
        lockEnabled
      ) {
        setIsLocked(true);
      }
    }

    return () => {
      subscription.remove();
    };
  }, [lockEnabled, setIsLocked]);

  useEffect(() => {
    return subscribeSafeAreaInsets(
      (newInsets: any, newFrame?: any) => {
        setInsets(newInsets);

        if (newFrame) {
          setFrame(newFrame);
        }
      }
    );
  }, []);

  return (
    <ThemeProvider>
      <SafeAreaFrameContext.Provider value={frame}>
        <SafeAreaInsetsContext.Provider value={insets}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }} />

            <StatusBar style="auto" />

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
      </SafeAreaFrameContext.Provider>
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