import React, { useRef, useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  Pressable,
  KeyboardAvoidingView,
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

  // Foco automático cuando el modal se abre
  React.useEffect(() => {
    if (visible && plateInputRef.current) {
      // Pequeño delay para asegurar que el modal esté renderizado
      const timer = setTimeout(() => {
        plateInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // Validar formato de matrícula: 0000BBB (4 dígitos + 3 consonantes sin vocales)
  const isValidLicensePlate = (plate: string): boolean => {
    const plateRegex = /^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/;
    return plateRegex.test(plate.trim());
  };

  const handleSubmit = async () => {
    // Validar campos
    if (!licensePlate.trim()) {
      return;
    }

    if (!isValidLicensePlate(licensePlate)) {
      return;
    }

    if (!parkingLocation) {
      return;
    }

    // Llamar a onSubmit
    try {
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
      {/* Fondo oscuro con centrado vertical */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 16,
          }}
          onPress={handleClose}
        >
          {/* Modal centrado sin desplazamiento */}
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
                placeholder="Ej: 0000BBB"
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
                  borderColor: licensePlate.trim() && !isValidLicensePlate(licensePlate) ? "#EF4444" : "#0066CC",
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
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
