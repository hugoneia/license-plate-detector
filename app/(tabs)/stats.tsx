import { View, Text, ScrollView, TouchableOpacity, Platform, Linking, Alert } from "react-native";
import { useState, useCallback, useRef, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { AppState, type AppStateStatus } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import type { LicensePlateEntry, GroupedLicensePlate } from "@/types/license-plate";
import { groupLicensePlates, getUniquePlateStats, getTopPlatesByDetections } from "@/lib/grouping";
import { FullHeatmapView } from "@/components/full-heatmap-view";
import type { GeoLocation, ClusteredLocation } from "@/lib/heatmap-utils";

const STORAGE_KEY = "license_plates";

export default function StatsScreen() {
  const [grouped, setGrouped] = useState<GroupedLicensePlate[]>([]);
  const [uniqueStats, setUniqueStats] = useState<ReturnType<typeof getUniquePlateStats> | null>(null);
  const [selectedPlate, setSelectedPlate] = useState<GroupedLicensePlate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showFullHeatmap, setShowFullHeatmap] = useState(false);
  const appState = useRef(AppState.currentState);
  const router = useRouter();
  const colors = useColors();

  // Cargar datos cada vez que se accede a la pantalla
  useFocusEffect(
    useCallback(() => {
      loadStatistics();

      // Escuchar cambios de app state
      const subscription = AppState.addEventListener("change", handleAppStateChange);
      return () => {
        subscription.remove();
      };
    }, [])
  );

  const handleAppStateChange = (state: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && state === "active") {
      // App volvió al foreground
      loadStatistics();
    }
    appState.current = state;
  };

  async function loadStatistics() {
    try {
      setIsLoading(true);
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const entries: LicensePlateEntry[] = JSON.parse(data);
        const grouped = groupLicensePlates(entries);
        setGrouped(grouped);
        setUniqueStats(getUniquePlateStats(entries));
      } else {
        setGrouped([]);
        setUniqueStats({
          totalUnique: 0,
          totalDetections: 0,
          averageDetectionsPerPlate: 0,
          mostDetectedPlate: null,
        });
      }
    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function openMapLocation(latitude: number, longitude: number, plate: string) {
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
      const canOpen = await Linking.canOpenURL(url);

      if (canOpen) {
        await Linking.openURL(url);
      } else {
        console.error("No se puede abrir Google Maps");
      }
    } catch (error) {
      console.error("Error al abrir mapa:", error);
    }
  }

  // Vista de mapa de calor completo
  if (showFullHeatmap) {
    // Construir array de detecciones con coordenadas
    const allDetections = grouped
      .flatMap((plate: any) =>
        plate.entries
          .filter((entry: any) => entry.location && typeof entry.location !== "string")
          .map((entry: any) => ({
            plate: plate.plate,
            location: entry.location as any,
            timestamp: entry.timestamp,
          }))
      );

    return (
      <FullHeatmapView
        detections={allDetections}
        onClose={() => setShowFullHeatmap(false)}
      />
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
              {(selectedPlate as any).plate}
            </Text>
            <Text className="text-sm text-muted mt-1">
              {selectedPlate.entries.length} detección{selectedPlate.entries.length !== 1 ? "es" : ""}
            </Text>
          </View>

          {/* Lista de detecciones */}
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <View className="gap-2">
              {selectedPlate.entries.map((entry, index) => {
                const detectionNumber = selectedPlate.entries.length - index;
                return (
                  <View key={index} className="bg-surface rounded-lg p-3 border border-border">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="font-semibold text-foreground">
                        Detección #{detectionNumber}
                      </Text>
                      <Text className="text-xs text-muted">
                        {new Date(entry.timestamp).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text className="text-xs text-muted">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </Text>

                    {/* Mostrar ubicación si está disponible */}
                    {entry.location && typeof entry.location !== "string" && (
                      <View className="mt-2 gap-1">
                        <Text className="text-xs text-muted">
                          Lat: {(entry.location as any).latitude.toFixed(6)}
                        </Text>
                        <Text className="text-xs text-muted">
                          Lon: {(entry.location as any).longitude.toFixed(6)}
                        </Text>
                        <TouchableOpacity
                          onPress={() =>
                            openMapLocation(
                              (entry.location as any).latitude,
                              (entry.location as any).longitude,
                              (selectedPlate as any).plate
                            )
                          }
                          className="mt-2 bg-primary rounded px-2 py-1"
                        >
                          <Text className="text-white text-xs font-semibold text-center">
                            Ver en mapa
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </ScreenContainer>
    );
  }

  // Vista principal de estadísticas
  return (
    <ScreenContainer className="flex-1">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="p-6 gap-6">
          {/* Encabezado */}
          <View>
            <Text className="text-3xl font-bold text-foreground">Estadísticas</Text>
            <Text className="text-sm text-muted mt-1">Análisis de detecciones</Text>
          </View>

          {/* Botón Mapa de Calor */}
          <TouchableOpacity
            onPress={() => setShowFullHeatmap(true)}
            className="bg-primary rounded-lg p-4 flex-row items-center justify-between active:opacity-80"
          >
            <View className="flex-row items-center gap-3">
              <MaterialIcons name="map" size={24} color="white" />
              <View>
                <Text className="text-white font-semibold">Mapa de Calor</Text>
                <Text className="text-xs text-white opacity-80">Ver todas las detecciones</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="white" />
          </TouchableOpacity>

          {/* Estadísticas generales */}
          {isLoading ? (
            <View className="items-center justify-center py-8">
              <Text className="text-muted">Cargando estadísticas...</Text>
            </View>
          ) : uniqueStats ? (
            <View className="gap-3">
              {/* Card: Total de detecciones */}
              <View className="bg-surface rounded-lg p-4 border border-border">
                <Text className="text-xs text-muted mb-1">Total de Detecciones</Text>
                <Text className="text-3xl font-bold text-foreground">
                  {uniqueStats.totalDetections}
                </Text>
              </View>

              {/* Card: Matrículas únicas */}
              <View className="bg-surface rounded-lg p-4 border border-border">
                <Text className="text-xs text-muted mb-1">Matrículas Únicas</Text>
                <Text className="text-3xl font-bold text-foreground">
                  {uniqueStats.totalUnique}
                </Text>
              </View>

              {/* Card: Promedio */}
              <View className="bg-surface rounded-lg p-4 border border-border">
                <Text className="text-xs text-muted mb-1">Promedio por Matrícula</Text>
                <Text className="text-3xl font-bold text-foreground">
                  {uniqueStats.averageDetectionsPerPlate.toFixed(1)}
                </Text>
              </View>

              {/* Card: Más detectada */}
              {uniqueStats.mostDetectedPlate && (
                <View className="bg-surface rounded-lg p-4 border border-border">
                  <Text className="text-xs text-muted mb-1">Matrícula Más Detectada</Text>
                  <Text
                    className="text-lg font-bold text-foreground"
                    style={{ fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }}
                  >
                    {(uniqueStats.mostDetectedPlate as any).plate}
                  </Text>
                  <Text className="text-xs text-muted mt-1">
                    {uniqueStats.mostDetectedPlate.count} detecciones
                  </Text>
                </View>
              )}
            </View>
          ) : null}

          {/* TOP 5 */}
          {!isLoading && grouped.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">TOP 5 Matrículas</Text>
              {getTopPlatesByDetections(grouped as any, 5).map((plate: any, index: number) => {
                const colors_map = [
                  colors.warning, // Amarillo #1
                  colors.muted,   // Gris #2
                  "#D88A2D",       // Naranja #3
                  colors.border,  // Gris claro #4
                  colors.border,  // Gris claro #5
                ];

                const borderColor = colors_map[index] || colors.border;

                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setSelectedPlate(plate)}
                    className="bg-surface rounded-lg p-4 border flex-row items-center gap-3 active:opacity-80"
                    style={{ borderColor }}
                  >
                    <View
                      className="w-8 h-8 rounded-full items-center justify-center"
                      style={{ backgroundColor: borderColor }}
                    >
                      <Text className="text-white font-bold text-xs">#{index + 1}</Text>
                    </View>
                    <View className="flex-1">
                      <Text
                        className="text-lg font-bold text-foreground"
                        style={{ fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }}
                      >
                        {(plate as any).plate}
                      </Text>
                      <Text className="text-xs text-muted">
                        {(plate as any).entries.length} detecciones
                      </Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color={colors.muted} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Estado vacío */}
          {!isLoading && grouped.length === 0 && (
            <View className="items-center justify-center py-12">
              <MaterialIcons name="info" size={48} color={colors.muted} />
              <Text className="text-muted mt-3">No hay detecciones registradas</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
