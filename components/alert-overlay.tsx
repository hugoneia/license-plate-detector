import { View, Text, Animated, Platform } from "react-native";
import { useEffect, useRef } from "react";
import * as Haptics from "expo-haptics";
import type { Alert } from "@/types/license-plate";

interface AlertOverlayProps {
  alert: Alert;
  onDismiss: (id: string) => void;
}

export function AlertOverlay({ alert, onDismiss }: AlertOverlayProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Trigger haptic feedback
    if (Platform.OS !== "web") {
      if (alert.type === "success") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (alert.type === "error") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else if (alert.type === "warning") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    }

    // Animate in
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();

    // Auto dismiss
    if (alert.duration && alert.duration > 0) {
      const timer = setTimeout(() => {
        Animated.spring(scaleAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }).start(() => onDismiss(alert.id));
      }, alert.duration);

      return () => clearTimeout(timer);
    }
  }, [alert, scaleAnim, onDismiss]);

  const backgroundColor =
    alert.type === "success"
      ? "#22C55E"
      : alert.type === "error"
      ? "#EF4444"
      : alert.type === "warning"
      ? "#F59E0B"
      : "#0066CC";

  const icon =
    alert.type === "success"
      ? "✓"
      : alert.type === "error"
      ? "✕"
      : alert.type === "warning"
      ? "⚠"
      : "ℹ";

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }],
        position: "absolute",
        top: 60,
        left: 16,
        right: 16,
        zIndex: 1000,
      }}
    >
      <View
        className="rounded-2xl px-6 py-4 flex-row items-center gap-3 shadow-lg"
        style={{ backgroundColor }}
      >
        <Text className="text-2xl text-white font-bold">{icon}</Text>
        <Text className="flex-1 text-white font-semibold text-base">{alert.message}</Text>
      </View>
    </Animated.View>
  );
}
