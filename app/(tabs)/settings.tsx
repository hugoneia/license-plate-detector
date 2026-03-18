import { useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { AlertsOverlay } from "@/components/alerts-overlay";
import { useAlerts } from "@/hooks/use-alerts";
import { useColors } from "@/hooks/use-colors";
import type { LicensePlateEntry } from "@/types/license-plate";

const STORAGE_KEY = "license_plates";

export default function SettingsScreen() {
  const { alerts, addAlert, removeAlert } = useAlerts();
  const colors = useColors();
  const [isExporting, setIsExporting] = useState(false);

  async function exportCSV() {
    try {
      setIsExporting(true);
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (!data) {
        addAlert("No hay datos para exportar", "info");
        return;
      }

      const entries: LicensePlateEntry[] = JSON.parse(data);
      let csvContent = "MATRÍCULA,FECHA,HORA,LATITUD/LONGITUD,LUGAR\n";

      entries.forEach((entry) => {
        const date = new Date(entry.timestamp);
        const dateStr = date.toLocaleDateString("es-ES");
        const timeStr = date.toLocaleTimeString("es-ES");
        const locationStr =
          entry.location === "NO GPS"
            ? "NO GPS"
            : `${entry.location?.latitude},${entry.location?.longitude}`;
        
        const lugarCode = entry.parkingLocation === "acera"
          ? "AC"
          : entry.parkingLocation === "doble_fila"
          ? "DF"
          : "SD";

        csvContent += `${entry.licensePlate},${dateStr},${timeStr},${locationStr},${lugarCode}\n`;
      });

      const tempPath = `${FileSystem.cacheDirectory}matrículas_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(tempPath, csvContent);

      // Compartir
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        addAlert("La función de compartir no está disponible en este dispositivo", "info");
        return;
      }

      await Sharing.shareAsync(tempPath, {
        mimeType: "text/csv",
        dialogTitle: "Exportar Matrículas",
      });
      
      addAlert("Archivo exportado correctamente", "success");
    } catch (error) {
      console.error("Error al exportar CSV:", error);
      addAlert("Error al exportar el archivo", "error");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <>
      <ScreenContainer className="p-6">
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Título */}
          <View className="mb-8">
            <Text className="text-3xl font-bold text-foreground">Ajustes</Text>
            <Text className="text-sm text-muted mt-1">Gestiona tu aplicación</Text>
          </View>

          {/* Sección Exportar */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-4">Datos</Text>
            
            <TouchableOpacity
              onPress={exportCSV}
              disabled={isExporting}
              className={`flex-row items-center gap-4 p-4 rounded-lg border ${
                isExporting
                  ? "bg-surface/50 border-border/50 opacity-50"
                  : "bg-surface border-border"
              }`}
            >
              <View className="w-12 h-12 rounded-lg bg-primary/10 items-center justify-center">
                <MaterialIcons name="download" size={24} color={colors.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">
                  Exportar CSV
                </Text>
                <Text className="text-sm text-muted mt-1">
                  Descarga tus datos en formato CSV
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Sección Información */}
          <View className="mt-12 pt-6 border-t border-border">
            <Text className="text-lg font-semibold text-foreground mb-4">Información</Text>
            
            <View className="bg-surface border border-border rounded-lg p-4">
              <View className="mb-3">
                <Text className="text-sm text-muted">Versión</Text>
                <Text className="text-base font-semibold text-foreground mt-1">1.0.0</Text>
              </View>
              <View className="mb-3">
                <Text className="text-sm text-muted">Aplicación</Text>
                <Text className="text-base font-semibold text-foreground mt-1">Detector de Matrículas</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </ScreenContainer>

      {/* Alerts overlay */}
      <AlertsOverlay alerts={alerts} onRemoveAlert={removeAlert} />
    </>
  );
}
