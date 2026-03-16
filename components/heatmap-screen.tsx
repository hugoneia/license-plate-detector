import { View, Text, TouchableOpacity, TextInput, ScrollView } from "react-native";
import { useState, useCallback, useMemo } from "react";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import WebView from "react-native-webview";

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
 * - Mapa Leaflet real con todas las coordenadas GPS
 * - Heatmap con gradiente azul-verde-amarillo-naranja-rojo
 * - Zoom automático para mostrar todos los puntos
 * - Búsqueda por matrícula
 * - Opacidad baja para ver mapa base
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

  // Contar detecciones por coordenada
  const coordinateWeights = useMemo(() => {
    const weights: Record<string, number> = {};
    filteredDetections.forEach((d) => {
      const key = `${d.latitude.toFixed(6)},${d.longitude.toFixed(6)}`;
      weights[key] = (weights[key] || 0) + 1;
    });
    return weights;
  }, [filteredDetections]);

  // Generar datos para heatmap
  const heatmapData = useMemo(() => {
    const data: Array<[number, number, number]> = [];
    const maxWeight = Math.max(...Object.values(coordinateWeights), 1);

    Object.entries(coordinateWeights).forEach(([key, weight]) => {
      const [lat, lon] = key.split(",").map(Number);
      const intensity = weight / maxWeight; // Normalizar a 0-1
      data.push([lat, lon, intensity]);
    });

    return data;
  }, [coordinateWeights]);

  // Calcular bounds
  const bounds = useMemo(() => {
    if (filteredDetections.length === 0) {
      return { minLat: 40.4, maxLat: 40.4, minLon: -3.6, maxLon: -3.6 };
    }
    const lats = filteredDetections.map((d) => d.latitude);
    const lons = filteredDetections.map((d) => d.longitude);
    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons),
    };
  }, [filteredDetections]);

  // HTML del mapa con Leaflet
  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet-heat/1.0.4/leaflet-heat.min.js"></script>
      <style>
        * { margin: 0; padding: 0; }
        html, body { height: 100%; width: 100%; }
        #map { height: 100%; width: 100%; }
      </style>
    </head>
    <body>
      <div id="map"></div>

      <script>
        try {
          // Crear mapa
          const map = L.map('map', {
            center: [${(bounds.minLat + bounds.maxLat) / 2}, ${(bounds.minLon + bounds.maxLon) / 2}],
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
                0.0: '#0000FF',    // Azul
                0.25: '#00FF00',   // Verde
                0.5: '#FFFF00',    // Amarillo
                0.75: '#FF8C00',   // Naranja
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
