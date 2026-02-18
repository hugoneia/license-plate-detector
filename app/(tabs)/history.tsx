import { View, Text, FlatList, TouchableOpacity, TextInput, Alert, Platform } from "react-native";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import type { LicensePlateEntry, GroupedLicensePlate } from "@/types/license-plate";
import { groupLicensePlates, formatGroupedPlateForDisplay, formatGroupedPlateForFile } from "@/lib/grouping";

const STORAGE_KEY = "license_plates";
const FILE_PATH = FileSystem.documentDirectory + "matriculas.txt";

export default function HistoryScreen() {
  const [grouped, setGrouped] = useState<GroupedLicensePlate[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadEntries();
  }, []);

  async function loadEntries() {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const entries: LicensePlateEntry[] = JSON.parse(data);
        const grouped = groupLicensePlates(entries);
        setGrouped(grouped);
      }
    } catch (error) {
      console.error("Error al cargar historial:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteEntry(licensePlate: string) {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    Alert.alert(
      "Eliminar Matrícula",
      `¿Estás seguro de que deseas eliminar todas las detecciones de ${licensePlate}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const data = await AsyncStorage.getItem(STORAGE_KEY);
              if (data) {
                const entries: LicensePlateEntry[] = JSON.parse(data);
                const filtered = entries.filter(
                  (e) => e.licensePlate.toUpperCase() !== licensePlate.toUpperCase()
                );
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

                // Recargar
                const newGrouped = groupLicensePlates(filtered);
                setGrouped(newGrouped);

                if (Platform.OS !== "web") {
                  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
              }
            } catch (error) {
              console.error("Error al eliminar entrada:", error);
              alert("Error al eliminar la matrícula");
            }
          },
        },
      ]
    );
  }

  async function exportFile() {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (!data) {
        alert("No hay matrículas guardadas para exportar");
        return;
      }

      const entries: LicensePlateEntry[] = JSON.parse(data);
      const grouped = groupLicensePlates(entries);

      // Generar contenido del archivo
      let content = "MATRÍCULAS DETECTADAS - AGRUPADAS\n";
      content += "=".repeat(60) + "\n";
      content += `Generado: ${new Date().toLocaleString("es-ES")}\n`;
      content += `Total de matrículas únicas: ${grouped.length}\n`;
      content += `Total de detecciones: ${entries.length}\n`;
      content += "=".repeat(60) + "\n\n";

      grouped.forEach((group) => {
        content += formatGroupedPlateForFile(group);
      });

      // Guardar en archivo temporal
      const filename = `matriculas_${Date.now()}.txt`;
      const tempPath = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(tempPath, content);

      // Compartir
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        alert("La función de compartir no está disponible en este dispositivo");
        return;
      }

      await Sharing.shareAsync(tempPath, {
        mimeType: "text/plain",
        dialogTitle: "Exportar Matrículas",
        UTI: "public.plain-text",
      });

      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Error al exportar archivo:", error);
      alert("Error al exportar el archivo");
    }
  }

  const filteredGrouped = grouped.filter((group) =>
    group.licensePlate.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function renderEntry({ item }: { item: GroupedLicensePlate }) {
    const confidenceColor =
      item.entries[0]?.confidence === "high"
        ? "bg-success"
        : item.entries[0]?.confidence === "medium"
        ? "bg-warning"
        : "bg-error";

    return (
      <View className="bg-surface rounded-2xl p-4 mb-3 border border-border">
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-1">
            <Text
              className="text-2xl font-bold text-foreground mb-1"
              style={{ fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }}
            >
              {item.licensePlate}
            </Text>
            <View className="flex-row items-center gap-2">
              <View className={`w-2 h-2 rounded-full ${confidenceColor}`} />
              <Text className="text-sm text-muted">
                {item.count}x • Última: {new Date(item.lastSeen).toLocaleDateString("es-ES")}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => deleteEntry(item.licensePlate)}
            className="bg-error/10 px-4 py-2 rounded-full"
          >
            <Text className="text-error font-semibold">Eliminar</Text>
          </TouchableOpacity>
        </View>

        {/* Mostrar ubicación de la última detección */}
        {item.entries[0]?.location && (
          <View className="mt-2 pt-2 border-t border-border">
            <Text className="text-xs text-muted">
              📍{" "}
              {item.entries[0].location === "NO GPS"
                ? "NO GPS"
                : `${item.entries[0].location.latitude.toFixed(4)}, ${item.entries[0].location.longitude.toFixed(4)}`}
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <ScreenContainer className="flex-1 p-6">
      <View className="flex-1 gap-4">
        {/* Encabezado */}
        <View>
          <Text className="text-3xl font-bold text-foreground">Historial</Text>
          <Text className="text-base text-muted mt-1">
            {grouped.length} {grouped.length === 1 ? "matrícula única" : "matrículas únicas"} •{" "}
            {grouped.reduce((sum, g) => sum + g.count, 0)} detecciones totales
          </Text>
        </View>

        {/* Barra de búsqueda */}
        <View className="bg-surface rounded-full px-4 py-3 border border-border">
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar matrícula..."
            placeholderTextColor="#9BA1A6"
            autoCapitalize="characters"
            autoCorrect={false}
            className="text-foreground text-base"
          />
        </View>

        {/* Lista de matrículas */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-muted">Cargando...</Text>
          </View>
        ) : filteredGrouped.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-muted text-center">
              {searchQuery
                ? "No se encontraron matrículas"
                : "No hay matrículas guardadas todavía"}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredGrouped}
            renderItem={renderEntry}
            keyExtractor={(item) => item.licensePlate}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        )}

        {/* Botón de exportar */}
        {grouped.length > 0 && (
          <View className="absolute bottom-6 left-6 right-6">
            <TouchableOpacity
              onPress={exportFile}
              className="bg-primary py-4 rounded-full"
              style={{ opacity: 1 }}
            >
              <Text className="text-background font-bold text-center text-lg">
                📥 Exportar Archivo
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
