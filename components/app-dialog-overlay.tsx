import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";
import type {
  AppDialogConfig,
  AppDialogButton,
} from "@/hooks/use-app-dialog";

interface AppDialogOverlayProps {
  dialog: AppDialogConfig | null;
  onClose: () => void;
}

export function AppDialogOverlay({
  dialog,
  onClose,
}: AppDialogOverlayProps) {
  const colors = useColors();

  if (!dialog) {
    return null;
  }

  const buttons = dialog.buttons?.length
    ? dialog.buttons
    : [{ text: "Aceptar" }];

  const iconColor =
    dialog.type === "error"
      ? "#EF4444"
      : dialog.type === "warning"
      ? "#F59E0B"
      : dialog.type === "success"
      ? "#22C55E"
      : colors.primary;

  const handlePress = (button: AppDialogButton) => {
    onClose();

    try {
      const result = button.onPress?.();

      if (
        result &&
        typeof (result as Promise<void>).then === "function"
      ) {
        void (result as Promise<void>).catch((error) => {
          console.error("Error en acción de AppDialog:", error);
        });
      }
    } catch (error) {
      console.error("Error en acción de AppDialog:", error);
    }
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.heading}>
            {dialog.icon ? (
              <MaterialIcons
                name={
                  dialog.icon as keyof typeof MaterialIcons.glyphMap
                }
                size={24}
                color={iconColor}
                style={styles.icon}
              />
            ) : null}

            <Text
              style={[
                styles.title,
                { color: colors.foreground },
              ]}
            >
              {dialog.title}
            </Text>
          </View>

          <ScrollView
            style={styles.messageScroll}
            contentContainerStyle={styles.messageContent}
            showsVerticalScrollIndicator
          >
            <Text
              style={[
                styles.message,
                { color: colors.foreground },
              ]}
            >
              {dialog.message}
            </Text>
          </ScrollView>

          <View
            style={[
              styles.buttons,
              buttons.length > 2 ? styles.buttonsColumn : null,
            ]}
          >
            {buttons.map((button, index) => {
              const destructive =
                button.style === "destructive";
              const cancel = button.style === "cancel";

              return (
                <Pressable
                  key={`${button.text}-${index}`}
                  onPress={() => handlePress(button)}
                  style={({ pressed }) => [
                    styles.button,
                    buttons.length > 2
                      ? styles.buttonFull
                      : styles.buttonFlex,
                    cancel
                      ? {
                          backgroundColor: "transparent",
                          borderColor: colors.border,
                          borderWidth: 1,
                        }
                      : destructive
                      ? {
                          backgroundColor: "#EF4444",
                          borderColor: "#EF4444",
                          borderWidth: 1,
                        }
                      : {
                          backgroundColor: colors.primary,
                          borderColor: colors.primary,
                          borderWidth: 1,
                        },
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      {
                        color: cancel
                          ? colors.foreground
                          : "#FFFFFF",
                      },
                    ]}
                  >
                    {button.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "82%",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  icon: {
    marginRight: 10,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "bold",
  },
  messageScroll: {
    flexShrink: 1,
    marginBottom: 20,
  },
  messageContent: {
    flexGrow: 1,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
  },
  buttons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "flex-end",
  },
  buttonsColumn: {
    flexDirection: "column",
  },
  button: {
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonFlex: {
    flex: 1,
  },
  buttonFull: {
    width: "100%",
  },
  buttonPressed: {
    opacity: 0.78,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
