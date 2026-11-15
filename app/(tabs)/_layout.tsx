import { Tabs, usePathname, useRouter } from "expo-router";
import { useEffect } from "react";
import { useShareIntentContext } from "expo-share-intent";
import { useLock } from "@/lib/lock-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  const { isReady, hasShareIntent, shareIntent } = useShareIntentContext();
  const { isLocked, lockStatusReady } = useLock();
  const router = useRouter();
  const pathname = usePathname();

  const hasSharedCsv = Boolean(
    shareIntent.files?.some((file) =>
      file.fileName?.toLowerCase().endsWith(".csv") ||
      file.mimeType?.toLowerCase().includes("csv")
    )
  );

  useEffect(() => {
    if (
      !isReady ||
      !hasShareIntent ||
      !hasSharedCsv ||
      !lockStatusReady ||
      isLocked ||
      pathname.endsWith("/settings")
    ) {
      return;
    }

    router.replace("/(tabs)/settings");
  }, [
    isReady,
    hasShareIntent,
    hasSharedCsv,
    lockStatusReady,
    isLocked,
    pathname,
    router,
  ]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Cámara",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="camera.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Historial",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="list.bullet" color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Estadísticas",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Ajustes",
          tabBarIcon: ({ color }) => <MaterialIcons name="settings" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}
