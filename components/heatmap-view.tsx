import React, { useMemo } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import {
  clusterLocationsByDistance,
  clustersToHeatmapPoints,
  getHeatmapStats,
  type GeoLocation,
  type ClusteredLocation,
} from "@/lib/heatmap-utils";

interface HeatmapViewProps {
  locations: GeoLocation[];
  title?: string;
}

export function HeatmapView({ locations, title = "Mapa de Calor" }: HeatmapViewProps) {
  const colors = useColors();

  // Procesar datos: agrupar y calcular estadísticas
  const { clusters, stats } = useMemo(() => {
    if (!locations || locations.length === 0) {
      return { clusters: [], stats: null };
    }

    const clustered = clusterLocationsByDistance(locations, 100);
    const stats = getHeatmapStats(clustered);
    return { clusters: clustered, stats };
  }, [locations]);

  if (!locations || locations.length === 0) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <Text className="text-lg text-muted">No hay datos de ubicación disponibles</Text>
      </ScreenContainer>
    );
  }

  if (!clusters || clusters.length === 0) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-lg text-muted mt-4">Procesando datos...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        {/* Encabezado */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-foreground mb-2">{title}</Text>
          <Text className="text-sm text-muted">
            Agrupación por proximidad (100m de radio)
          </Text>
        </View>

        {/* Estadísticas */}
        {stats && (
          <View className="bg-surface rounded-2xl p-4 mb-6 border border-border">
            <View className="gap-3">
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Total de detecciones:</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {stats.totalDetections}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Áreas agrupadas:</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {stats.totalClusters}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Promedio por área:</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {stats.avgDetectionsPerCluster}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Máximo en un área:</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {stats.maxDetectionsInCluster}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Leyenda de colores */}
        <View className="bg-surface rounded-2xl p-4 mb-6 border border-border">
          <Text className="text-sm font-semibold text-foreground mb-3">Intensidad de Densidad</Text>
          <View className="gap-2">
            <View className="flex-row items-center gap-3">
              <View className="w-6 h-6 rounded-full" style={{ backgroundColor: "#00FF00" }} />
              <Text className="text-xs text-muted">Baja densidad (1-25%)</Text>
            </View>
            <View className="flex-row items-center gap-3">
              <View className="w-6 h-6 rounded-full" style={{ backgroundColor: "#FFFF00" }} />
              <Text className="text-xs text-muted">Densidad media (26-50%)</Text>
            </View>
            <View className="flex-row items-center gap-3">
              <View className="w-6 h-6 rounded-full" style={{ backgroundColor: "#FF8C00" }} />
              <Text className="text-xs text-muted">Densidad media-alta (51-75%)</Text>
            </View>
            <View className="flex-row items-center gap-3">
              <View className="w-6 h-6 rounded-full" style={{ backgroundColor: "#FF0000" }} />
              <Text className="text-xs text-muted">Alta densidad (76-100%)</Text>
            </View>
          </View>
        </View>

        {/* Lista de clusters */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">Áreas Detectadas</Text>
          <View className="gap-3">
            {clusters.map((cluster, index) => {
              const intensity = stats ? cluster.count / stats.maxDetectionsInCluster : 0;
              const intensityPercent = Math.round(intensity * 100);
              let bgColor = "#00FF00"; // Verde
              if (intensityPercent > 75) bgColor = "#FF0000"; // Rojo
              else if (intensityPercent > 50) bgColor = "#FF8C00"; // Naranja
              else if (intensityPercent > 25) bgColor = "#FFFF00"; // Amarillo

              return (
                <View
                  key={index}
                  className="bg-surface rounded-lg p-4 border border-border flex-row items-center gap-3"
                >
                  <View
                    className="w-5 h-5 rounded-full"
                    style={{ backgroundColor: bgColor }}
                  />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-foreground">
                      Área {index + 1}
                    </Text>
                    <Text className="text-xs text-muted">
                      {cluster.count} detección{cluster.count !== 1 ? "es" : ""} • Intensidad:{" "}
                      {intensityPercent}%
                    </Text>
                    <Text className="text-xs text-muted mt-1">
                      {cluster.center.latitude.toFixed(4)}, {cluster.center.longitude.toFixed(4)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
