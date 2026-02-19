import { View, Text, FlatList, TouchableOpacity, TextInput, Alert, Platform } from "react-native";
import { useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import type { LicensePlateEntry, GroupedLicensePlate } from "@/types/license-plate";
import { groupLicensePlates, formatGroupedPlateForDisplay } from "@/lib/grouping";

const STORAGE_KEY = "license_plates";

export default function HistoryScreen() {
  const [grouped, setGrouped] = useState<GroupedLicensePlate[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlate, setSelectedPlate] = useState<GroupedLicensePlate | null>(null);

  // Cargar datos cada vez que se accede a la pantalla
  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [])
  );

  async function loadEntries() {
    try {
      setIsLoading(true);
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
                setSelectedPlate(null);

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

  async function exportCSV() {
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

      // Generar CSV con encabezados
      let csvContent = "MATRÍCULA,FECHA,HORA,LATITUD/LONGITUD\n";

      entries.forEach((entry) => {
        const date = new Date(entry.timestamp);
        const dateStr = date.toLocaleDateString("es-ES");
        const timeStr = date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

        let locationStr = "NO GPS";
        if (entry.location && entry.location !== "NO GPS") {
          const lat = entry.location.latitude.toFixed(4);
          const lng = entry.location.longitude.toFixed(4);
          locationStr = `${lat},${lng}`;
        }

        // Escapar comillas en matrícula si es necesario
        const plate = entry.licensePlate.includes(",")
          ? `"${entry.licensePlate}"`
          : entry.licensePlate;

        csvContent += `${plate},${dateStr},${timeStr},${locationStr}\n`;
      });

      // Guardar en archivo temporal
      const filename = `matriculas_${Date.now()}.csv`;
      const tempPath = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(tempPath, csvContent);

      // Compartir
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        alert("La función de compartir no está disponible en este dispositivo");
        return;
      }

      await Sharing.shareAsync(tempPath, {
        mimeType: "text/csv",
        dialogTitle: "Exportar Matrículas (CSV)",
        UTI: "public.comma-separated-values-text",
      });

      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Error al exportar CSV:", error);
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
      <TouchableOpacity
        onPress={() => setSelectedPlate(item)}
        className="bg-surface rounded-2xl p-4 mb-3 border border-border"
      >
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
            <Text className="text-error font-semibold text-sm">Eliminar</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  // Vista de detalle de matrícula
  if (selectedPlate) {
    return (
      <ScreenContainer className="flex-1 p-6">
        <View className="flex-1 gap-4">
          {/* Encabezado */}
          <TouchableOpacity onPress={() => setSelectedPlate(null)} className="mb-2">
            <Text className="text-primary font-semibold">← Volver</Text>
          </TouchableOpacity>

          <View>
            <Text
              className="text-4xl font-bold text-foreground"
              style={{ fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }}
            >
              {selectedPlate.licensePlate}
            </Text>
            <Text className="text-base text-muted mt-1">
              {selectedPlate.count} detecciones
            </Text>
          </View>

          {/* Lista de detecciones */}
          <FlatList
            data={selectedPlate.entries}
            renderItem={({ item, index }) => {
              const date = new Date(item.timestamp);
              const locationStr =
                item.location === "NO GPS"
                  ? "NO GPS"
                  : `${item.location?.latitude.toFixed(4)}, ${item.location?.longitude.toFixed(4)}`;

              return (
                <View className="bg-surface rounded-2xl p-4 mb-3 border border-border">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="font-semibold text-foreground">Detección #{index + 1}</Text>
                    <View
                      className={`px-3 py-1 rounded-full ${
                        item.confidence === "high"
                          ? "bg-success/10"
                          : item.confidence === "medium"
                          ? "bg-warning/10"
                          : "bg-error/10"
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          item.confidence === "high"
                            ? "text-success"
                            : item.confidence === "medium"
                            ? "text-warning"
                            : "text-error"
                        }`}
                      >
                        {item.confidence === "high"
                          ? "Alta"
                          : item.confidence === "medium"
                          ? "Media"
                          : "Baja"}
                      </Text>
                    </View>
                  </View>

                  <View className="gap-2">
                    <View>
                      <Text className="text-xs text-muted">Fecha y Hora</Text>
                      <Text className="text-sm text-foreground">
                        {date.toLocaleDateString("es-ES")} {date.toLocaleTimeString("es-ES")}
                      </Text>
                    </View>

                    <View>
                      <Text className="text-xs text-muted">Ubicación</Text>
                      <Text className="text-sm text-foreground">📍 {locationStr}</Text>
                    </View>
                  </View>
                </View>
              );
            }}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        </View>
      </ScreenContainer>
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
              onPress={exportCSV}
              className="bg-primary py-4 rounded-full"
              style={{ opacity: 1 }}
            >
              <Text className="text-background font-bold text-center text-lg">
                📥 Exportar CSV
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
