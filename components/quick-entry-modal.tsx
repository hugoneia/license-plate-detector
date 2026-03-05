import React, { useRef, useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  Pressable,
  Keyboard,
  KeyboardAvoidingView,
  Animated,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";

interface QuickEntryModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (licensePlate: string, parkingLocation: "acera" | "doble_fila") => Promise<void>;
  isLoading?: boolean;
}

export function QuickEntryModal({
  visible,
  onClose,
  onSubmit,
  isLoading = false,
}: QuickEntryModalProps) {
  const colors = useColors();
  const [licensePlate, setLicensePlate] = useState("");
  const [parkingLocation, setParkingLocation] = useState<"acera" | "doble_fila" | null>(null);
  const plateInputRef = useRef<TextInput>(null);
  const offsetAnim = useRef(new Animated.Value(0)).current;

  // Monitorear teclado
  useEffect(() => {
    const keyboardDidShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => {
        // Desplazar modal hacia arriba
        Animated.timing(offsetAnim, {
          toValue: -100,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    );

    const keyboardDidHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        // Volver a posición original
        Animated.timing(offsetAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      keyboardDidShow.remove();
      keyboardDidHide.remove();
    };
  }, [offsetAnim]);

  // Validar formato de matrícula (letras y números)
  const isValidLicensePlate = (plate: string): boolean => {
    // Permitir formatos comunes: ABC1234, 1234ABC, M1234AB, etc.
    const plateRegex = /^[A-Z0-9\-\s]{2,}$/;
    return plateRegex.test(plate.trim()) && plate.trim().length >= 2;
  };

  const handleSubmit = async () => {
    // Validar campos
    if (!licensePlate.trim()) {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }

    if (!isValidLicensePlate(licensePlate)) {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }

    if (!parkingLocation) {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }

    // Llamar a onSubmit
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      await onSubmit(licensePlate.toUpperCase().trim(), parkingLocation);
      // Limpiar campos
      setLicensePlate("");
      setParkingLocation(null);
    } catch (error) {
      console.error("Error en handleSubmit:", error);
    }
  };

  const handleClose = () => {
    setLicensePlate("");
    setParkingLocation(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      {/* Fondo oscuro */}
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          justifyContent: "center",
          alignItems: "center",
        }}
        onPress={handleClose}
      >
        {/* Modal centrado con desplazamiento */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "center", alignItems: "center", width: "100%" }}
        >
          <Animated.View
            style={{
              transform: [{ translateY: offsetAnim }],
              width: "100%",
              paddingHorizontal: 16,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Pressable
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 24,
                width: "100%",
                maxWidth: 400,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
              }}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Encabezado */}
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "bold",
                  color: colors.foreground,
                  marginBottom: 16,
                }}
              >
                Entrada Rápida
              </Text>

              {/* Campo de matrícula */}
              <TextInput
                ref={plateInputRef}
                value={licensePlate}
                onChangeText={(text) => setLicensePlate(text.toUpperCase())}
                placeholder="1234ABC ó M1234AB"
                placeholderTextColor={colors.muted}
                editable={!isLoading}
                onFocus={() => {
                  if (plateInputRef.current && licensePlate) {
                    plateInputRef.current.setSelection?.(0, licensePlate.length);
                  }
                }}
                autoCapitalize="characters"
                className="border border-primary rounded-lg p-3 text-foreground text-center text-lg font-bold mb-4"
                style={{
                  borderWidth: 2,
                  borderColor: "#0066CC",
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  fontWeight: "bold",
                  color: colors.foreground,
                  backgroundColor: colors.background,
                  textAlign: "center",
                  marginBottom: 16,
                }}
              />

              {/* Selector de ubicación */}
              <View className="gap-3 mb-4">
                <Text className="text-sm text-muted">Ubicación de estacionamiento</Text>

                {/* Radio button - Acera */}
                <TouchableOpacity
                  onPress={() => !isLoading && setParkingLocation("acera")}
                  className="flex-row items-center gap-3 p-3"
                  disabled={isLoading}
                  style={{ opacity: isLoading ? 0.5 : 1 }}
                >
                  <View
                    className={`w-6 h-6 rounded-full border-2 ${
                      parkingLocation === "acera" ? "border-primary bg-primary" : "border-border"
                    }`}
                  />
                  <Text className="text-foreground">En la acera</Text>
                </TouchableOpacity>

                {/* Radio button - Doble fila */}
                <TouchableOpacity
                  onPress={() => !isLoading && setParkingLocation("doble_fila")}
                  className="flex-row items-center gap-3 p-3"
                  disabled={isLoading}
                  style={{ opacity: isLoading ? 0.5 : 1 }}
                >
                  <View
                    className={`w-6 h-6 rounded-full border-2 ${
                      parkingLocation === "doble_fila" ? "border-primary bg-primary" : "border-border"
                    }`}
                  />
                  <Text className="text-foreground">En doble fila</Text>
                </TouchableOpacity>
              </View>

              {/* Botones */}
              <View className="flex-row gap-3 mt-4">
                <TouchableOpacity
                  onPress={handleClose}
                  disabled={isLoading}
                  className="flex-1 p-3 rounded-lg border border-border items-center"
                  style={{ opacity: isLoading ? 0.5 : 1 }}
                >
                  <Text className="text-foreground font-semibold">Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={isLoading || !licensePlate.trim() || !parkingLocation}
                  className="flex-1 p-3 rounded-lg bg-primary items-center"
                  style={{
                    opacity:
                      isLoading || !licensePlate.trim() || !parkingLocation ? 0.5 : 1,
                  }}
                >
                  <Text className="text-white font-semibold">
                    {isLoading ? "Guardando..." : "Guardar"}
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
