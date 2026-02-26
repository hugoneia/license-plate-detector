import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, Alert, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";

export interface GPSEditorModalProps {
  visible: boolean;
  currentLatitude: number;
  currentLongitude: number;
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
  const [latitude, setLatitude] = useState(currentLatitude.toString());
  const [longitude, setLongitude] = useState(currentLongitude.toString());
  const colors = useColors();

  const handleSave = () => {
    try {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);

      if (isNaN(lat) || isNaN(lng)) {
        Alert.alert("Error", "Las coordenadas deben ser números válidos");
        return;
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        Alert.alert("Error", "Coordenadas fuera de rango válido\nLatitud: -90 a 90\nLongitud: -180 a 180");
        return;
      }

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      onSave(lat, lng);
      onClose();
    } catch (error) {
      Alert.alert("Error", "No se pudo procesar las coordenadas");
    }
  };

  const handleCancel = () => {
    setLatitude(currentLatitude.toString());
    setLongitude(currentLongitude.toString());
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
          <View className="bg-background rounded p-3">
            <Text className="text-xs text-muted mb-1">Coordenadas actuales</Text>
            <Text className="text-sm text-foreground font-semibold">
              {currentLatitude.toFixed(6)}, {currentLongitude.toFixed(6)}
            </Text>
          </View>

          {/* Latitude input */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Latitud</Text>
            <TextInput
              value={latitude}
              onChangeText={setLatitude}
              placeholder="Ej: 40.340719"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              className="border border-border rounded px-3 py-2 text-foreground"
              style={{ borderColor: colors.border, color: colors.foreground }}
            />
            <Text className="text-xs text-muted">Rango: -90 a 90</Text>
          </View>

          {/* Longitude input */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Longitud</Text>
            <TextInput
              value={longitude}
              onChangeText={setLongitude}
              placeholder="Ej: -3.666870"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              className="border border-border rounded px-3 py-2 text-foreground"
              style={{ borderColor: colors.border, color: colors.foreground }}
            />
            <Text className="text-xs text-muted">Rango: -180 a 180</Text>
          </View>

          {/* Format hint */}
          <View className="bg-background rounded p-3">
            <Text className="text-xs text-muted mb-1">Formato alternativo</Text>
            <Text className="text-xs text-foreground">
              Puedes pegar coordenadas como: 40.340719,-3.666870
            </Text>
          </View>

          {/* Buttons */}
          <View className="flex-row gap-3 mt-4">
            <TouchableOpacity
              onPress={handleCancel}
              className="flex-1 border border-border rounded py-3 items-center"
              style={{ borderColor: colors.border }}
            >
              <Text className="text-foreground font-semibold">Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              className="flex-1 bg-primary rounded py-3 items-center"
            >
              <Text className="text-background font-semibold">Guardar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
