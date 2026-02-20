import { useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Platform,
  Alert,
  Linking,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import type { LicensePlateEntry, GroupedLicensePlate, GeoLocation } from "@/types/license-plate";
import { groupLicensePlates, formatGroupedPlateForDisplay } from "@/lib/grouping";

const STORAGE_KEY = "license_plates";

export default function HistoryScreen() {
  const [grouped, setGrouped] = useState<GroupedLicensePlate[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlate, setSelectedPlate] = useState<GroupedLicensePlate | null>(null);
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

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

  function openMap(location: GeoLocation | "NO GPS" | undefined) {
    if (!location || location === "NO GPS") {
      Alert.alert("Sin ubicación", "Esta detección no tiene datos de GPS");
      return;
    }

    const { latitude, longitude } = location as GeoLocation;
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

    Linking.openURL(url).catch(() => {
      Alert.alert("Error", "No se pudo abrir el mapa");
    });
  }

  function handleLongPress(licensePlate: string) {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    setIsSelectionMode(true);
    const newSelected = new Set(selectedForDeletion);
    if (newSelected.has(licensePlate)) {
      newSelected.delete(licensePlate);
    } else {
      newSelected.add(licensePlate);
    }
    setSelectedForDeletion(newSelected);
  }

  async function deleteSelectedEntries() {
    if (selectedForDeletion.size === 0) return;

    const count = selectedForDeletion.size;
    Alert.alert(
      "Eliminar Matrículas",
      `¿Estás seguro de que deseas eliminar ${count} matr${count > 1 ? "ículas" : "ícula"}?`,
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
                  (e) => !selectedForDeletion.has(e.licensePlate.toUpperCase())
                );
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

                // Recargar
                const newGrouped = groupLicensePlates(filtered);
                setGrouped(newGrouped);
                setSelectedForDeletion(new Set());
                setIsSelectionMode(false);

                if (Platform.OS !== "web") {
                  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
              }
            } catch (error) {
              console.error("Error al eliminar entradas:", error);
              alert("Error al eliminar las matrículas");
            }
          },
        },
      ]
    );
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
          const lat = entry.location.latitude.toFixed(5);
          const lng = entry.location.longitude.toFixed(5);
          locationStr = `"${lat},${lng}"`;
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
        dialogTitle: "Exportar Matrículas",
      });

      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Error al exportar CSV:", error);
      alert("Error al exportar el archivo");
    }
  }

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-foreground">Cargando historial...</Text>
      </ScreenContainer>
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
                      <TouchableOpacity onPress={() => openMap(item.location)}>
                        <View className="flex-row items-center gap-2 mt-1">
                          <MaterialIcons name="location-on" size={16} color="#0066CC" />
                          <Text className="text-sm text-primary">{locationStr}</Text>
                        </View>
                      </TouchableOpacity>
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

  // Vista principal de historial
  const filteredGrouped = grouped.filter((item) =>
    item.licensePlate.toUpperCase().includes(searchQuery.toUpperCase())
  );

  return (
    <ScreenContainer className="flex-1 p-4">
      <View className="flex-1 gap-4">
        {/* Encabezado */}
        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-foreground">Historial</Text>
            {isSelectionMode && (
              <TouchableOpacity
                onPress={() => {
                  setIsSelectionMode(false);
                  setSelectedForDeletion(new Set());
                }}
                className="px-3 py-1 bg-border rounded-full"
              >
                <Text className="text-xs font-semibold text-foreground">Cancelar</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Barra de búsqueda */}
          <TextInput
            placeholder="Buscar matrícula..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="bg-surface border border-border rounded-lg px-4 py-2 text-foreground"
            placeholderTextColor="#9BA1A6"
          />

          {/* Botones de acción */}
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={exportCSV}
              className="flex-1 bg-primary px-4 py-2 rounded-lg items-center"
            >
              <Text className="text-background font-semibold text-sm">Exportar CSV</Text>
            </TouchableOpacity>

            {isSelectionMode && selectedForDeletion.size > 0 && (
              <TouchableOpacity
                onPress={deleteSelectedEntries}
                className="flex-1 bg-error px-4 py-2 rounded-lg items-center"
              >
                <Text className="text-white font-semibold text-sm">
                  Eliminar ({selectedForDeletion.size})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Lista de matrículas */}
        {filteredGrouped.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-muted text-center">
              {grouped.length === 0 ? "No hay matrículas registradas" : "No se encontraron resultados"}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredGrouped}
            renderItem={({ item }) => {
              const isSelected = selectedForDeletion.has(item.licensePlate.toUpperCase());
              const confidenceColor =
                item.entries[0]?.confidence === "high"
                  ? "bg-success"
                  : item.entries[0]?.confidence === "medium"
                  ? "bg-warning"
                  : "bg-error";

              return (
                <TouchableOpacity
                  onPress={() => {
                    if (isSelectionMode) {
                      handleLongPress(item.licensePlate);
                    } else {
                      setSelectedPlate(item);
                    }
                  }}
                  onLongPress={() => handleLongPress(item.licensePlate)}
                  className={`bg-surface rounded-2xl p-4 mb-3 border ${
                    isSelected ? "border-error bg-error/5" : "border-border"
                  }`}
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

                    {isSelectionMode && (
                      <View
                        className={`w-6 h-6 rounded border-2 items-center justify-center ${
                          isSelected ? "bg-error border-error" : "border-border"
                        }`}
                      >
                        {isSelected && <Text className="text-white font-bold">✓</Text>}
                      </View>
                    )}
                  </View>

                  {!isSelectionMode && (
                    <TouchableOpacity
                      onPress={() => deleteEntry(item.licensePlate)}
                      onLongPress={() => handleLongPress(item.licensePlate)}
                      className="bg-error/10 px-4 py-2 rounded-full self-start"
                    >
                      <Text className="text-error font-semibold text-sm">Eliminar</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            }}
            keyExtractor={(item) => item.licensePlate}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        )}
      </View>
    </ScreenContainer>
  );
}
