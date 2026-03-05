import React from "react";
import { View, Text, Animated, StyleSheet, Pressable } from "react-native";
import type { Alert } from "@/types/license-plate";

interface AlertsOverlayProps {
  alerts: Alert[];
  onRemoveAlert?: (id: string) => void;
}

export function AlertsOverlay({ alerts, onRemoveAlert }: AlertsOverlayProps) {
  const getAlertColor = (type: Alert["type"]) => {
    switch (type) {
      case "success":
        return "#22C55E"; // Verde
      case "warning":
        return "#F59E0B"; // Naranja
      case "error":
        return "#EF4444"; // Rojo
      case "info":
      default:
        return "#0066CC"; // Azul
    }
  };

  const getAlertBgColor = (type: Alert["type"]) => {
    switch (type) {
      case "success":
        return "rgba(34, 197, 94, 0.9)"; // Verde claro
      case "warning":
        return "rgba(245, 158, 11, 0.9)"; // Naranja claro
      case "error":
        return "rgba(239, 68, 68, 0.9)"; // Rojo claro
      case "info":
      default:
        return "rgba(0, 102, 204, 0.9)"; // Azul claro
    }
  };

  if (alerts.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
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
          <Text
            style={[
              styles.alertText,
              {
                color: "#ffffff",
              },
            ]}
            numberOfLines={2}
          >
            {alert.message}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 100,
    left: 16,
    right: 16,
    zIndex: 1000,
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
    elevation: 3,
  },
  alertText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
