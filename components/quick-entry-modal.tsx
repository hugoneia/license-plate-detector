import React, { useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  Pressable,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

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
  const [licensePlate, setLicensePlate] = useState("");
  const [parkingLocation, setParkingLocation] = useState<"acera" | "doble_fila" | null>(null);
  const plateInputRef = useRef<TextInput>(null);

  // Validar formato de matrícula (letras y números)
  const isValidLicensePlate = (plate: string): boolean => {
    // Permitir formatos comunes: ABC1234, AB-1234, ABC-1234, etc.
    const plateRegex = /^[A-Z0-9\-\s]{2,}$/i;
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
        {/* Modal centrado */}
        <Pressable
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 16,
            padding: 24,
            width: "85%",
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
          <View style={{ marginBottom: 20 }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: "#11181C",
                marginBottom: 4,
              }}
            >
              Entrada Rápida
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: "#687076",
              }}
            >
              Registra una matrícula manualmente
            </Text>
          </View>

          {/* Campo de matrícula */}
          <View style={{ marginBottom: 20 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: "#11181C",
                marginBottom: 8,
              }}
            >
              Matrícula
            </Text>
            <TextInput
              ref={plateInputRef}
              value={licensePlate}
              onChangeText={setLicensePlate}
              placeholder="Ej: ABC1234"
              placeholderTextColor="#999"
              editable={!isLoading}
              onFocus={() => {
                if (plateInputRef.current && licensePlate) {
                  plateInputRef.current.setSelection?.(0, licensePlate.length);
                }
              }}
              style={{
                borderWidth: 1,
                borderColor: "#E5E7EB",
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                color: "#11181C",
                backgroundColor: "#f5f5f5",
              }}
            />
          </View>

          {/* Selector de ubicación */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: "#11181C",
                marginBottom: 12,
              }}
            >
              Tipo de Ubicación
            </Text>

            {/* Radio button - Acera */}
            <Pressable
              onPress={() => !isLoading && setParkingLocation("acera")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 12,
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: parkingLocation === "acera" ? "#0066CC" : "#E5E7EB",
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 12,
                }}
              >
                {parkingLocation === "acera" && (
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: "#0066CC",
                    }}
                  />
                )}
              </View>
              <Text style={{ fontSize: 14, color: "#11181C", fontWeight: "500" }}>
                Acera
              </Text>
            </Pressable>

            {/* Radio button - Doble fila */}
            <Pressable
              onPress={() => !isLoading && setParkingLocation("doble_fila")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: parkingLocation === "doble_fila" ? "#0066CC" : "#E5E7EB",
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 12,
                }}
              >
                {parkingLocation === "doble_fila" && (
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: "#0066CC",
                    }}
                  />
                )}
              </View>
              <Text style={{ fontSize: 14, color: "#11181C", fontWeight: "500" }}>
                Doble fila
              </Text>
            </Pressable>
          </View>

          {/* Botones */}
          <View
            style={{
              flexDirection: "row",
              gap: 12,
              justifyContent: "flex-end",
            }}
          >
            <TouchableOpacity
              onPress={handleClose}
              disabled={isLoading}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor: "#f5f5f5",
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: "#11181C",
                }}
              >
                Cancelar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isLoading || !licensePlate.trim() || !parkingLocation}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor:
                  licensePlate.trim() && parkingLocation ? "#0066CC" : "#ccc",
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              {isLoading ? (
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: "#ffffff",
                  }}
                >
                  Guardando...
                </Text>
              ) : (
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: "#ffffff",
                  }}
                >
                  Aceptar
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
