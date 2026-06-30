import React, { useState, useCallback } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useColors } from "@/hooks/use-colors";

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

interface AlertOptions {
  title?: string;
  message?: string;
  buttons?: AlertButton[];
  cancelable?: boolean;
  onDismiss?: () => void;
}

// Estado global para la alerta
let alertState: {
  visible: boolean;
  title?: string;
  message?: string;
  buttons: AlertButton[];
  onDismiss?: () => void;
} = {
  visible: false,
  buttons: [],
};

// Función para mostrar la alerta (similar a Alert.alert)
export function showCustomAlert(
  title?: string,
  message?: string,
  buttons?: AlertButton[],
  options?: { cancelable?: boolean; onDismiss?: () => void }
) {
  alertState = {
    visible: true,
    title,
    message,
    buttons: buttons || [{ text: "OK" }],
    onDismiss: options?.onDismiss,
  };
  // Forzar re-render del componente CustomAlertContainer
  (CustomAlertContainer as any).updateState?.();
}

// Componente que renderiza la alerta
export function CustomAlertContainer() {
  const [state, setState] = useState(alertState);
  const colors = useColors();

  // Guardar la función de actualización en el módulo para que showCustomAlert pueda llamarla
  (CustomAlertContainer as any).updateState = () => {
    setState({ ...alertState });
  };

  const handleButtonPress = useCallback(
    (button: AlertButton) => {
      setState({ ...state, visible: false });
      alertState.visible = false;
      button.onPress?.();
      state.onDismiss?.();
    },
    [state]
  );

  const handleDismiss = useCallback(() => {
    setState({ ...state, visible: false });
    alertState.visible = false;
    state.onDismiss?.();
  }, [state]);

  return (
    <Modal
      visible={state.visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={[styles.container, { backgroundColor: "rgba(0, 0, 0, 0.5)" }]}>
        <View
          style={[
            styles.alertBox,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Título */}
          {state.title && (
            <Text
              style={[
                styles.title,
                {
                  color: colors.foreground,
                },
              ]}
            >
              {state.title}
            </Text>
          )}

          {/* Mensaje */}
          {state.message && (
            <Text
              style={[
                styles.message,
                {
                  color: colors.muted,
                },
              ]}
            >
              {state.message}
            </Text>
          )}

          {/* Botones */}
          <View style={styles.buttonContainer}>
            {state.buttons.map((button, index) => {
              const isDestructive = button.style === "destructive";
              const isCancel = button.style === "cancel";

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button,
                    {
                      borderRightWidth: index < state.buttons.length - 1 ? 1 : 0,
                      borderRightColor: colors.border,
                      flex: 1,
                    },
                  ]}
                  onPress={() => handleButtonPress(button)}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      {
                        color: isDestructive
                          ? "#EF4444"
                          : isCancel
                            ? colors.muted
                            : "#0066FF",
                        fontWeight: isCancel ? "400" : "600",
                      },
                    ]}
                  >
                    {button.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Estilos del componente
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  alertBox: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    maxWidth: 300,
    width: "100%",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    textAlign: "center",
  },
});

// Exportar función compatible con Alert.alert
export const CustomAlert = {
  alert: showCustomAlert,
};
