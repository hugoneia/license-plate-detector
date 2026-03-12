import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, Alert, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";

export interface GPSEditorModalProps {
  visible: boolean;
  currentLatitude: number | null;
  currentLongitude: number | null;
  onClose: () => void;
  onSave: (latitude: number, longitude: number) => void;
}

export function GPSEditorModal({
  visible,
  currentLatitude,
  currentLongitude,
  onClose,
  onSave,
}: GPSEditorModalProps) {
  const [coordinates, setCoordinates] = useState("");
  const textInputRef = useRef<TextInput>(null);
  const colors = useColors();

  const handleTextInputFocus = () => {
    if (textInputRef.current) {
      // Seleccionar todo el texto
      textInputRef.current.setSelection(0, coordinates.length);
    }
  };

  // Update coordinates when props change
  useEffect(() => {
    if (visible) {
      if (currentLatitude !== null && currentLongitude !== null) {
        setCoordinates(`${currentLatitude.toFixed(6)},${currentLongitude.toFixed(6)}`);
      } else {
        setCoordinates("");
      }
    }
  }, [visible, currentLatitude, currentLongitude]);

  const parseCoordinates = (input: string): { lat: number; lng: number } | null => {
    try {
      // Remove whitespace
      const cleaned = input.trim();
      
      // Split by comma
      const parts = cleaned.split(",");
      if (parts.length !== 2) {
        return null;
      }

      const lat = parseFloat(parts[0].trim());
      const lng = parseFloat(parts[1].trim());

      if (isNaN(lat) || isNaN(lng)) {
        return null;
      }

      // Validate ranges
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return null;
      }

      return { lat, lng };
    } catch {
      return null;
    }
  };

  const handleSave = () => {
    const parsed = parseCoordinates(coordinates);

    if (!parsed) {
      Alert.alert(
        "Error",
        "Formato inválido. Usa: lat,lng\nEjemplo: 40.340719,-3.666870\n\nRangos válidos:\nLatitud: -90 a 90\nLongitud: -180 a 180"
      );
      return;
    }

    onSave(parsed.lat, parsed.lng);
    onClose();
  };

  const handleCancel = () => {
    if (currentLatitude !== null && currentLongitude !== null) {
      setCoordinates(`${currentLatitude.toFixed(6)},${currentLongitude.toFixed(6)}`);
    } else {
      setCoordinates("");
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/50 items-center justify-center">
        <View
          className="w-11/12 rounded-lg p-6 gap-4"
          style={{ backgroundColor: colors.surface }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-foreground">Editar Coordenadas GPS</Text>
            <TouchableOpacity onPress={handleCancel}>
              <MaterialIcons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Current coordinates display */}
          {currentLatitude !== null && currentLongitude !== null ? (
            <View className="bg-background rounded p-3">
              <Text className="text-xs text-muted mb-1">Coordenadas actuales</Text>
              <Text className="text-sm text-foreground font-semibold">
                {currentLatitude.toFixed(6)}, {currentLongitude.toFixed(6)}
              </Text>
            </View>
          ) : (
            <View className="bg-background rounded p-3">
              <Text className="text-xs text-muted mb-1">Estado</Text>
              <Text className="text-sm text-foreground font-semibold">
                Esta detección no tiene datos de GPS
              </Text>
            </View>
          )}

          {/* Unified coordinates input */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Coordenadas GPS</Text>
            <TextInput
              ref={textInputRef}
              value={coordinates}
              onChangeText={setCoordinates}
              onFocus={handleTextInputFocus}
              placeholder="Ej: 40.340719,-3.666870"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              className="border border-border rounded px-3 py-2 text-foreground"
              style={{ borderColor: colors.border, color: colors.foreground }}
            />
            <Text className="text-xs text-muted">
              Formato: latitud,longitud (separadas por coma)
            </Text>
          </View>

          {/* Format hint */}
          <View className="bg-background rounded p-3">
            <Text className="text-xs text-muted mb-1">Formato Google Maps</Text>
            <Text className="text-xs text-foreground">
              Puedes copiar coordenadas directamente desde Google Maps
            </Text>
            <Text className="text-xs text-muted mt-2">
              Rango válido:
            </Text>
            <Text className="text-xs text-muted">
              • Latitud: -90 a 90
            </Text>
            <Text className="text-xs text-muted">
              • Longitud: -180 a 180
            </Text>
          </View>

          {/* Buttons */}
          <View className="flex-row gap-3 pt-2">
            <TouchableOpacity
              onPress={handleCancel}
              className="flex-1 py-3 rounded-lg border border-border items-center"
              style={{ borderColor: colors.border }}
            >
              <Text className="font-semibold text-foreground">Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              className="flex-1 py-3 rounded-lg items-center"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="font-semibold text-white">Guardar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
