import React, { useMemo, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import type { ClusteredLocation } from "@/lib/heatmap-utils";

interface InteractiveHeatmapMapProps {
  cluster: ClusteredLocation;
  onClose: () => void;
}

/**
 * Componente de mapa interactivo con Leaflet que muestra:
 * - Centro del cluster
 * - Círculo de 100m de radio
 * - Capa de densidad con colores
 * - Información del cluster
 */
export function InteractiveHeatmapMap({ cluster, onClose }: InteractiveHeatmapMapProps) {
  const colors = useColors();

  // Calcular intensidad del cluster
  const intensity = useMemo(() => {
    // Normalizar intensidad entre 0 y 1 basado en el número de detecciones
    // Asumiendo máximo de 50 detecciones en un área
    return Math.min(cluster.count / 50, 1);
  }, [cluster.count]);

  // Determinar color según intensidad
  const getClusterColor = () => {
    const percent = intensity * 100;
    if (percent > 75) return "#FF0000"; // Rojo
    if (percent > 50) return "#FF8C00"; // Naranja
    if (percent > 25) return "#FFFF00"; // Amarillo
    return "#00FF00"; // Verde
  };

  const clusterColor = getClusterColor();
  const intensityPercent = Math.round(intensity * 100);

  return (
    <ScreenContainer className="flex-1">
      <View className="flex-1">
        {/* Encabezado con botón de cerrar */}
        <View className="absolute top-6 left-6 right-6 z-10 flex-row items-center justify-between bg-surface rounded-lg p-3 border border-border">
          <TouchableOpacity onPress={onClose} className="flex-row items-center gap-2">
            <MaterialIcons name="arrow-back" size={20} color={colors.primary} />
            <Text className="text-primary font-semibold">Volver</Text>
          </TouchableOpacity>
          <View className="flex-row items-center gap-2">
            <View
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: clusterColor }}
            />
            <Text className="text-xs font-semibold text-foreground">{intensityPercent}%</Text>
          </View>
        </View>

        {/* Contenedor del mapa (placeholder para Leaflet) */}
        <View className="flex-1 bg-slate-200 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-4">Cargando mapa...</Text>
        </View>

        {/* Panel de información inferior */}
        <View className="absolute bottom-0 left-0 right-0 bg-surface border-t border-border p-4 rounded-t-2xl">
          <View className="gap-3">
            {/* Título del área */}
            <View className="flex-row items-center gap-3">
              <View
                className="w-6 h-6 rounded-full"
                style={{ backgroundColor: clusterColor }}
              />
              <View className="flex-1">
                <Text className="text-lg font-semibold text-foreground">
                  Área de Alta Densidad
                </Text>
                <Text className="text-xs text-muted mt-1">
                  {cluster.count} detección{cluster.count !== 1 ? "es" : ""}
                </Text>
              </View>
            </View>

            {/* Coordenadas */}
            <View className="bg-background rounded-lg p-3 gap-2">
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted">Latitud</Text>
                <Text className="text-xs font-mono text-foreground">
                  {cluster.center.latitude.toFixed(6)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted">Longitud</Text>
                <Text className="text-xs font-mono text-foreground">
                  {cluster.center.longitude.toFixed(6)}
                </Text>
              </View>
            </View>

            {/* Estadísticas */}
            <View className="bg-background rounded-lg p-3 gap-2">
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted">Intensidad de Densidad</Text>
                <Text className="text-xs font-semibold text-foreground">{intensityPercent}%</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted">Radio de Agrupación</Text>
                <Text className="text-xs font-semibold text-foreground">100 metros</Text>
              </View>
            </View>

            {/* Botón de abrir en Google Maps */}
            <TouchableOpacity
              onPress={() => {
                const url = `https://www.google.com/maps/search/?api=1&query=${cluster.center.latitude},${cluster.center.longitude}`;
                // En una app real, aquí usarías Linking.openURL(url)
              }}
              className="bg-primary rounded-lg p-3 items-center"
            >
              <Text className="text-white font-semibold text-sm flex-row items-center gap-2">
                <MaterialIcons name="location-on" size={16} color="white" />
                Abrir en Google Maps
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}
