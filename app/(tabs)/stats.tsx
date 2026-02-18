import { View, Text, ScrollView, TouchableOpacity, Platform } from "react-native";
import { useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import type { LicensePlateEntry, GroupedLicensePlate } from "@/types/license-plate";
import { groupLicensePlates, getUniquePlateStats } from "@/lib/grouping";

const STORAGE_KEY = "license_plates";

export default function StatsScreen() {
  const [grouped, setGrouped] = useState<GroupedLicensePlate[]>([]);
  const [uniqueStats, setUniqueStats] = useState<ReturnType<typeof getUniquePlateStats> | null>(null);
  const [selectedPlate, setSelectedPlate] = useState<GroupedLicensePlate | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar datos cada vez que se accede a la pantalla
  useFocusEffect(
    useCallback(() => {
      loadStatistics();
    }, [])
  );

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
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            {selectedPlate.entries.map((item, index) => {
              const date = new Date(item.timestamp);
              const locationStr =
                item.location === "NO GPS"
                  ? "NO GPS"
                  : `${item.location?.latitude.toFixed(4)}, ${item.location?.longitude.toFixed(4)}`;

              return (
                <View key={item.id} className="bg-surface rounded-2xl p-4 mb-3 border border-border">
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
            })}
          </ScrollView>
        </View>
      </ScreenContainer>
    );
  }

  if (isLoading || !uniqueStats) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <Text className="text-muted">Cargando...</Text>
      </ScreenContainer>
    );
  }

  const topPlates = grouped.slice(0, 5);

  return (
    <ScreenContainer className="flex-1">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="gap-6 p-6">
          {/* Encabezado */}
          <View>
            <Text className="text-3xl font-bold text-foreground">Estadísticas</Text>
            <Text className="text-base text-muted mt-1">Resumen de detecciones</Text>
          </View>

          {/* Tarjetas de resumen */}
          {uniqueStats.totalDetections > 0 ? (
            <View className="gap-3">
              {/* Total de detecciones */}
              <View className="bg-primary rounded-2xl p-6">
                <Text className="text-sm text-white/80 mb-1">Total de Detecciones</Text>
                <Text className="text-4xl font-bold text-white">{uniqueStats.totalDetections}</Text>
              </View>

              {/* Matrículas únicas */}
              <View className="bg-surface rounded-2xl p-6 border border-border">
                <Text className="text-sm text-muted mb-1">Matrículas Únicas Registradas</Text>
                <Text className="text-4xl font-bold text-primary">{uniqueStats.totalUnique}</Text>
              </View>

              {/* Matrícula más detectada */}
              {uniqueStats.mostDetectedPlate && (
                <View className="bg-warning/10 rounded-2xl p-6 border border-warning">
                  <Text className="text-sm text-muted mb-2">Matrícula Más Detectada</Text>
                  <Text
                    className="text-3xl font-bold text-warning mb-1"
                    style={{ fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }}
                  >
                    {uniqueStats.mostDetectedPlate.licensePlate}
                  </Text>
                  <Text className="text-sm text-muted">
                    {uniqueStats.mostDetectedPlate.count} detecciones
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View className="bg-surface rounded-2xl p-6 border border-border items-center">
              <Text className="text-muted text-center">
                No hay matrículas detectadas todavía. ¡Comienza a capturar matrículas para ver
                estadísticas!
              </Text>
            </View>
          )}

          {/* Top 5 matrículas */}
          {topPlates.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">Top 5 Matrículas</Text>

              {topPlates.map((plate, index) => (
                <TouchableOpacity
                  key={plate.licensePlate}
                  onPress={() => {
                    if (Platform.OS !== "web") {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    setSelectedPlate(plate);
                  }}
                  className="bg-surface rounded-2xl p-4 border border-border flex-row items-center justify-between"
                >
                  <View className="flex-1">
                    <View className="flex-row items-center gap-3 mb-1">
                      <View className="bg-primary/20 w-8 h-8 rounded-full items-center justify-center">
                        <Text className="text-primary font-bold text-sm">#{index + 1}</Text>
                      </View>
                      <Text
                        className="text-xl font-bold text-foreground"
                        style={{ fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }}
                      >
                        {plate.licensePlate}
                      </Text>
                    </View>
                    <Text className="text-sm text-muted ml-11">
                      {plate.count} detecciones • Última: {new Date(plate.lastSeen).toLocaleDateString("es-ES")}
                    </Text>
                  </View>

                  <View className="bg-primary/10 px-3 py-1 rounded-full">
                    <Text className="text-primary font-bold">{plate.count}x</Text>
                  </View>
                </TouchableOpacity>
              ))}

              {grouped.length > 5 && (
                <Text className="text-xs text-muted text-center mt-2">
                  +{grouped.length - 5} matrículas más (desliza para ver todas)
                </Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
