import React from "react";
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Pressable,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Alert } from "@/types/license-plate";

interface AlertsOverlayProps {
  alerts: Alert[];
  onRemoveAlert?: (id: string) => void;
}

export function AlertsOverlay({
  alerts,
  onRemoveAlert,
}: AlertsOverlayProps) {
  const insets = useSafeAreaInsets();

  const getAlertColor = (type: Alert["type"]) => {
    switch (type) {
      case "success":
        return "#22C55E";
      case "warning":
        return "#F59E0B";
      case "error":
        return "#EF4444";
      case "info":
      default:
        return "#0066CC";
    }
  };

  const getAlertBgColor = (type: Alert["type"]) => {
    switch (type) {
      case "success":
        return "rgba(34, 197, 94, 0.9)";
      case "warning":
        return "rgba(245, 158, 11, 0.9)";
      case "error":
        return "rgba(239, 68, 68, 0.9)";
      case "info":
      default:
        return "rgba(0, 102, 204, 0.9)";
    }
  };

  return (
    <Modal
      visible={alerts.length > 0}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View pointerEvents="box-none" style={styles.modalRoot}>
        <View
          pointerEvents="box-none"
          style={[styles.container, { top: insets.top + 56 }]}
        >
          {alerts.map((alert) => (
            <Pressable
              key={alert.id}
              onPress={() => onRemoveAlert?.(alert.id)}
              style={[
                styles.alertBox,
                {
                  backgroundColor: getAlertBgColor(alert.type),
                  borderLeftColor: getAlertColor(alert.type),
                },
              ]}
            >
              <Text style={styles.alertText} numberOfLines={2}>
                {alert.message}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  alertBox: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 9999,
  },
  alertText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
});
