import { View, Text, TouchableOpacity, TextInput, ScrollView, Linking } from "react-native";
import { useState, useCallback, useMemo } from "react";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";

interface PlateDetection {
  plate: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

interface HeatmapScreenProps {
  detections: PlateDetection[];
  onClose: () => void;
}

/**
 * Pantalla de mapa de calor que muestra:
 * - Visualización de densidad de detecciones por zona
 * - Búsqueda por matrícula
 * - Estadísticas de detecciones
 * - Enlace a Google Maps para ver ubicaciones
 */
export function HeatmapScreen({ detections, onClose }: HeatmapScreenProps) {
  const colors = useColors();
  const [searchPlate, setSearchPlate] = useState("");
  const [filteredDetections, setFilteredDetections] = useState<PlateDetection[]>(detections);

  // Función para buscar matrícula
  const handleSearch = useCallback(() => {
    if (searchPlate.trim()) {
      const filtered = detections.filter((d) =>
        d.plate.toUpperCase().includes(searchPlate.toUpperCase())
      );
      setFilteredDetections(filtered);
    } else {
      setFilteredDetections(detections);
    }
  }, [searchPlate, detections]);

  // Calcular estadísticas de densidad
  const densityStats = useMemo(() => {
    const stats: Array<{
      zone: string;
      count: number;
      centerLat: number;
      centerLon: number;
      intensity: number;
    }> = [];

    if (filteredDetections.length === 0) return stats;

    // Agrupar por zona (cada 0.01 grados ≈ 1km)
    const zones: Record<string, PlateDetection[]> = {};
    filteredDetections.forEach((d) => {
      const zoneKey = `${Math.floor(d.latitude * 100) / 100},${Math.floor(d.longitude * 100) / 100}`;
      if (!zones[zoneKey]) zones[zoneKey] = [];
      zones[zoneKey].push(d);
    });

    const maxCount = Math.max(...Object.values(zones).map((z) => z.length), 1);

    Object.entries(zones).forEach(([key, detects]) => {
      const [zoneLat, zoneLon] = key.split(",").map(Number);
      const centerLat = detects.reduce((sum, d) => sum + d.latitude, 0) / detects.length;
      const centerLon = detects.reduce((sum, d) => sum + d.longitude, 0) / detects.length;

      stats.push({
        zone: key,
        count: detects.length,
        centerLat,
        centerLon,
        intensity: detects.length / maxCount,
      });
    });

    return stats.sort((a, b) => b.count - a.count);
  }, [filteredDetections]);

  // Función para obtener color según intensidad
  const getIntensityColor = (intensity: number) => {
    if (intensity < 0.25) return "#00FF00"; // Verde
    if (intensity < 0.5) return "#FFFF00"; // Amarillo
    if (intensity < 0.75) return "#FF8C00"; // Naranja
    return "#FF0000"; // Rojo
  };

  // Función para abrir Google Maps
  const openGoogleMaps = (lat: number, lon: number) => {
    const url = `https://maps.google.com/?q=${lat},${lon}`;
    Linking.openURL(url).catch((err) => console.error("Error abriendo Maps:", err));
  };

  return (
    <ScreenContainer className="flex-1 bg-background">
      <View className="flex-1">
        {/* Encabezado con botón de cerrar */}
        <View className="px-4 pt-4 pb-3 flex-row items-center justify-between bg-surface rounded-lg border border-border mx-4 mb-4">
          <TouchableOpacity onPress={onClose} className="flex-row items-center gap-2">
            <MaterialIcons name="arrow-back" size={20} color={colors.primary} />
            <Text className="text-primary font-semibold">Volver</Text>
          </TouchableOpacity>
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="location-on" size={16} color={colors.warning} />
            <Text className="text-xs font-semibold text-foreground">{filteredDetections.length}</Text>
          </View>
        </View>

        {/* Contenido principal - Lista de zonas con densidad */}
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4">
          {densityStats.length === 0 ? (
            <View className="flex-1 items-center justify-center py-12">
              <MaterialIcons name="location-off" size={48} color={colors.muted} />
              <Text className="text-sm text-muted mt-3 text-center">
                {searchPlate ? "No se encontraron detecciones" : "Sin detecciones registradas"}
              </Text>
            </View>
          ) : (
            <View className="gap-3 pb-6">
              {/* Información general */}
              <View className="bg-surface rounded-lg p-4 border border-border">
                <Text className="text-xs text-muted font-semibold mb-2">ESTADÍSTICAS</Text>
                <View className="gap-2">
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-foreground">Total de detecciones:</Text>
                    <Text className="text-sm font-semibold text-primary">{filteredDetections.length}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-foreground">Zonas detectadas:</Text>
                    <Text className="text-sm font-semibold text-primary">{densityStats.length}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-foreground">Promedio por zona:</Text>
                    <Text className="text-sm font-semibold text-primary">
                      {(filteredDetections.length / densityStats.length).toFixed(1)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Leyenda de colores */}
              <View className="bg-surface rounded-lg p-4 border border-border">
                <Text className="text-xs text-muted font-semibold mb-3">INTENSIDAD DE DENSIDAD</Text>
                <View className="gap-2">
                  <View className="flex-row items-center gap-3">
                    <View className="w-6 h-6 rounded-full bg-green-500" />
                    <Text className="text-xs text-foreground">Baja (0-25%)</Text>
                  </View>
                  <View className="flex-row items-center gap-3">
                    <View className="w-6 h-6 rounded-full bg-yellow-400" />
                    <Text className="text-xs text-foreground">Media (25-50%)</Text>
                  </View>
                  <View className="flex-row items-center gap-3">
                    <View className="w-6 h-6 rounded-full bg-orange-500" />
                    <Text className="text-xs text-foreground">Media-Alta (50-75%)</Text>
                  </View>
                  <View className="flex-row items-center gap-3">
                    <View className="w-6 h-6 rounded-full bg-red-500" />
                    <Text className="text-xs text-foreground">Alta (75-100%)</Text>
                  </View>
                </View>
              </View>

              {/* Zonas detectadas */}
              <View>
                <Text className="text-xs text-muted font-semibold mb-2">ZONAS DETECTADAS ({densityStats.length})</Text>
                {densityStats.map((stat, index) => (
                  <TouchableOpacity
                    key={stat.zone}
                    onPress={() => openGoogleMaps(stat.centerLat, stat.centerLon)}
                    className="bg-surface rounded-lg p-4 border border-border mb-2 active:opacity-80"
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center gap-2 flex-1">
                        <View
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: getIntensityColor(stat.intensity) }}
                        />
                        <Text className="text-sm font-semibold text-foreground">Zona #{index + 1}</Text>
                      </View>
                      <Text className="text-xs font-semibold text-primary">
                        {Math.round(stat.intensity * 100)}%
                      </Text>
                    </View>

                    <View className="gap-1">
                      <View className="flex-row justify-between">
                        <Text className="text-xs text-muted">Detecciones:</Text>
                        <Text className="text-xs font-semibold text-foreground">{stat.count}</Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-xs text-muted">Coordenadas:</Text>
                        <Text className="text-xs font-mono text-foreground">
                          {stat.centerLat.toFixed(4)}, {stat.centerLon.toFixed(4)}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row items-center gap-1 mt-2 pt-2 border-t border-border">
                      <MaterialIcons name="open-in-new" size={12} color={colors.primary} />
                      <Text className="text-xs text-primary font-semibold">Ver en Google Maps</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Panel de búsqueda inferior */}
        <View className="bg-surface border-t border-border p-4 rounded-t-2xl shadow-lg">
          <ScrollView showsVerticalScrollIndicator={false} className="max-h-32">
            <View className="gap-3">
              {/* Título */}
              <Text className="text-sm font-semibold text-foreground">Buscar Matrícula</Text>

              {/* Campo de búsqueda */}
              <View className="flex-row gap-2">
                <TextInput
                  placeholder="Ej: 0000BBB"
                  placeholderTextColor={colors.muted}
                  value={searchPlate}
                  onChangeText={setSearchPlate}
                  maxLength={7}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                  style={{
                    borderColor:
                      searchPlate && !/^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/.test(searchPlate)
                        ? colors.error
                        : colors.border,
                  }}
                />
                <TouchableOpacity
                  onPress={handleSearch}
                  className="bg-primary rounded-lg px-4 items-center justify-center active:opacity-80"
                >
                  <Text className="text-white font-semibold text-sm">Mostrar</Text>
                </TouchableOpacity>
              </View>

              {/* Información de resultados */}
              <View className="flex-row justify-between items-center">
                <Text className="text-xs text-muted">
                  {searchPlate
                    ? `${filteredDetections.length} detección${filteredDetections.length !== 1 ? "es" : ""} encontrada${filteredDetections.length !== 1 ? "s" : ""}`
                    : `${detections.length} detecciones totales`}
                </Text>
                {searchPlate && (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchPlate("");
                      setFilteredDetections(detections);
                    }}
                    className="active:opacity-80"
                  >
                    <Text className="text-xs text-primary font-semibold">Limpiar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </ScreenContainer>
  );
}
