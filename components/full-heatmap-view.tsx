import { View, Text, TouchableOpacity, TextInput, Linking, ScrollView } from "react-native";
import { useState, useCallback, useMemo, useEffect } from "react";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import WebView from "react-native-webview";
// Tipos
interface GeoLocation {
  latitude: number;
  longitude: number;
}

interface PlateDetection {
  plate: string;
  location: GeoLocation;
  timestamp: string;
}

interface FullHeatmapViewProps {
  detections: PlateDetection[];
  onClose: () => void;
}

/**
 * Componente de mapa de calor completo que muestra:
 * - Todas las coordenadas GPS en un único heatmap
 * - Zoom automático para ver todos los puntos
 * - Opacidad baja para ver el mapa base
 * - Búsqueda de matrícula para filtrar puntos
 */
export function FullHeatmapView({ detections, onClose }: FullHeatmapViewProps) {
  const colors = useColors();
  const [searchPlate, setSearchPlate] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [filteredDetections, setFilteredDetections] = useState<PlateDetection[]>(detections);

  // Calcular fechas mín y máx de las detecciones
  const dateRange = useMemo(() => {
    if (detections.length === 0) return { min: new Date(), max: new Date() };
    const timestamps = detections.map((d) => new Date(d.timestamp).getTime());
    return {
      min: new Date(Math.min(...timestamps)),
      max: new Date(Math.max(...timestamps)),
    };
  }, [detections]);

  // Inicializar fechas con el rango completo
  useMemo(() => {
    if (!startDate) setStartDate(dateRange.min);
    if (!endDate) setEndDate(dateRange.max);
  }, [dateRange]);

  // Función para buscar matrícula y filtrar por fechas
  const handleSearch = useCallback(() => {
    let filtered = detections;

    // Filtrar por rango de fechas
    if (startDate && endDate) {
      filtered = filtered.filter((d) => {
        const detectionDate = new Date(d.timestamp);
        return detectionDate >= startDate && detectionDate <= endDate;
      });
    }

    // Filtrar por matrícula
    if (searchPlate.trim()) {
      filtered = filtered.filter((d) =>
        d.plate.toUpperCase().includes(searchPlate.toUpperCase())
      );
    }

    setFilteredDetections(filtered);
  }, [searchPlate, detections, startDate, endDate]);

  // Auto-filtrar cuando cambian las fechas
  useEffect(() => {
    handleSearch();
  }, [startDate, endDate]);

  // Función para formatear fecha
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Contar detecciones por coordenada
  const coordinateWeights = useMemo(() => {
    const weights: Record<string, number> = {};
    filteredDetections.forEach((d) => {
      const key = `${d.location.latitude.toFixed(6)},${d.location.longitude.toFixed(6)}`;
      weights[key] = (weights[key] || 0) + 1;
    });
    return weights;
  }, [filteredDetections]);

  // Generar datos para heatmap
  const heatmapData = useMemo(() => {
    const data: Array<[number, number, number]> = [];
    const maxWeight = Math.max(...Object.values(coordinateWeights), 1);

    Object.entries(coordinateWeights).forEach(([key, weight]) => {
      const [lat, lng] = key.split(",").map(Number);
      const intensity = weight / maxWeight; // Normalizar a 0-1
      data.push([lat, lng, intensity]);
    });

    return data;
  }, [coordinateWeights]);

  // Calcular bounds para fitBounds
  const bounds = useMemo(() => {
    if (filteredDetections.length === 0) {
      return { minLat: 40.4, maxLat: 40.5, minLng: -3.6, maxLng: -3.5 }; // Centro de Madrid por defecto
    }

    let minLat = filteredDetections[0].location.latitude;
    let maxLat = filteredDetections[0].location.latitude;
    let minLng = filteredDetections[0].location.longitude;
    let maxLng = filteredDetections[0].location.longitude;

    filteredDetections.forEach((d) => {
      minLat = Math.min(minLat, d.location.latitude);
      maxLat = Math.max(maxLat, d.location.latitude);
      minLng = Math.min(minLng, d.location.longitude);
      maxLng = Math.max(maxLng, d.location.longitude);
    });

    return { minLat, maxLat, minLng, maxLng };
  }, [filteredDetections]);

  // Generar HTML para mapa con Leaflet
  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet.heat/0.2.0/leaflet-heat.js"></script>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        #map { width: 100%; height: 100%; }
        .leaflet-container { background: #f0f0f0; }
      </style>
    </head>
    <body>
      <div id="map"></div>

      <script>
        try {
          // Crear mapa
          const map = L.map('map', {
            center: [40.4, -3.6],
            zoom: 12,
            zoomControl: true,
            attributionControl: true
          });
          
          // Agregar capa base de OpenStreetMap
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
            minZoom: 1
          }).addTo(map);

          // Datos del heatmap
          const heatData = ${JSON.stringify(heatmapData)};

          // Agregar capa de heatmap con opacidad baja
          if (heatData.length > 0) {
            L.heatLayer(heatData, {
              radius: 40,
              blur: 25,
              maxZoom: 1,
              minOpacity: 0.15,
              gradient: {
                0.0: '#00FF00',    // Verde
                0.25: '#FFFF00',   // Amarillo
                0.5: '#FF8C00',    // Naranja
                1.0: '#FF0000'     // Rojo
              }
            }).addTo(map);

            // Calcular bounds
            const bounds = L.latLngBounds(
              heatData.map(point => [point[0], point[1]])
            );

            // Ajustar vista con padding
            map.fitBounds(bounds, { padding: [50, 50] });
          }
          
        } catch (error) {
          console.error('Error al crear mapa:', error);
          document.body.innerHTML = '<div style="padding: 20px; color: red;">Error al cargar el mapa</div>';
        }
      </script>
    </body>
    </html>
  `;

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
            <MaterialIcons name="location-on" size={16} color={colors.warning} />
            <Text className="text-xs font-semibold text-foreground">{filteredDetections.length}</Text>
          </View>
        </View>

        {/* Contenedor del mapa con WebView */}
        <View className="flex-1 mt-20">
          <WebView
            source={{ html: mapHtml }}
            style={{ flex: 1 }}
            scrollEnabled={true}
            zoomEnabled={true}
            scalesPageToFit={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View className="flex-1 items-center justify-center bg-background">
                <MaterialIcons name="map" size={48} color={colors.primary} />
                <Text className="text-sm text-muted mt-3">Cargando mapa...</Text>
              </View>
            )}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.warn("WebView error: ", nativeEvent);
            }}
          />
        </View>

        {/* Panel de búsqueda inferior */}
        <View className="bg-surface border-t border-border p-4 rounded-t-2xl shadow-lg">
          <ScrollView showsVerticalScrollIndicator={false} className="max-h-56">
            <View className="gap-4">
              {/* Sección de rango de fechas */}
              <View className="gap-2">
                <Text className="text-sm font-semibold text-foreground">Rango de Fechas</Text>
                <View className="gap-2">
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => {
                        const newDate = new Date(startDate || dateRange.min);
                        newDate.setDate(newDate.getDate() - 7);
                        if (newDate >= dateRange.min) {
                          setStartDate(newDate);
                        }
                      }}
                      className="bg-background border border-border rounded-lg p-2 active:opacity-80"
                    >
                      <MaterialIcons name="chevron-left" size={16} color={colors.primary} />
                    </TouchableOpacity>
                    <View className="flex-1 bg-background border border-border rounded-lg px-3 py-2">
                      <Text className="text-xs text-muted">Desde</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        {startDate ? formatDate(startDate) : formatDate(dateRange.min)}
                      </Text>
                    </View>
                    <View className="flex-1 bg-background border border-border rounded-lg px-3 py-2">
                      <Text className="text-xs text-muted">Hasta</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        {endDate ? formatDate(endDate) : formatDate(dateRange.max)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        const newDate = new Date(endDate || dateRange.max);
                        newDate.setDate(newDate.getDate() + 7);
                        if (newDate <= dateRange.max) {
                          setEndDate(newDate);
                        }
                      }}
                      className="bg-background border border-border rounded-lg p-2 active:opacity-80"
                    >
                      <MaterialIcons name="chevron-right" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setStartDate(dateRange.min);
                      setEndDate(dateRange.max);
                    }}
                    className="active:opacity-80"
                  >
                    <Text className="text-xs text-primary font-semibold text-center">Mostrar todo</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Divisor */}
              <View className="h-px bg-border" />

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
                    : `${filteredDetections.length} detecciones en rango`}
                </Text>
                {(searchPlate || (startDate && startDate > dateRange.min) || (endDate && endDate < dateRange.max)) && (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchPlate("");
                      setStartDate(dateRange.min);
                      setEndDate(dateRange.max);
                      setFilteredDetections(detections);
                    }}
                    className="active:opacity-80"
                  >
                    <Text className="text-xs text-primary font-semibold">Limpiar todo</Text>
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
