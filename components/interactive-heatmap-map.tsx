import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, Linking, Platform, ScrollView } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import type { ClusteredLocation } from "@/lib/heatmap-utils";

interface InteractiveHeatmapMapProps {
  cluster: ClusteredLocation;
  onClose: () => void;
}

/**
 * Componente de mapa interactivo que muestra:
 * - Mapa base con OpenStreetMap
 * - Capa de heatmap con colores de densidad
 * - Círculo de 100m de radio
 * - Panel de información del cluster
 */
export function InteractiveHeatmapMap({ cluster, onClose }: InteractiveHeatmapMapProps) {
  const colors = useColors();

  // Calcular intensidad del cluster
  const intensity = useMemo(() => {
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

  // Generar HTML para mapa con Leaflet
  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet.heat/0.2.0/leaflet-heat.js"></script>
      <style>
        * { margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        #map { width: 100%; height: 100vh; }
        .info-panel {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: white;
          padding: 16px;
          border-top: 1px solid #e5e7eb;
          max-height: 40%;
          overflow-y: auto;
          z-index: 1000;
        }
        .info-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .color-dot {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .info-title {
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
        }
        .info-subtitle {
          font-size: 12px;
          color: #6b7280;
          margin-top: 4px;
        }
        .info-section {
          background: #f9fafb;
          border-radius: 8px;
          padding: 12px;
          margin: 8px 0;
          font-size: 12px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin: 4px 0;
        }
        .info-label {
          color: #6b7280;
        }
        .info-value {
          color: #1f2937;
          font-weight: 500;
          font-family: monospace;
        }
        .button {
          width: 100%;
          padding: 12px;
          background: #0a7ea4;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .button:active {
          opacity: 0.8;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <div class="info-panel">
        <div class="info-header">
          <div class="color-dot" style="background-color: ${clusterColor}"></div>
          <div>
            <div class="info-title">Área de Densidad</div>
            <div class="info-subtitle">${cluster.count} detección${cluster.count !== 1 ? "es" : ""}</div>
          </div>
        </div>
        <div class="info-section">
          <div class="info-row">
            <span class="info-label">Latitud</span>
            <span class="info-value">${cluster.center.latitude.toFixed(6)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Longitud</span>
            <span class="info-value">${cluster.center.longitude.toFixed(6)}</span>
          </div>
        </div>
        <div class="info-section">
          <div class="info-row">
            <span class="info-label">Intensidad</span>
            <span class="info-value">${intensityPercent}%</span>
          </div>
          <div class="info-row">
            <span class="info-label">Radio</span>
            <span class="info-value">100 m</span>
          </div>
        </div>
        <button class="button" onclick="window.location.href='https://www.google.com/maps/search/?api=1&query=${cluster.center.latitude},${cluster.center.longitude}'">
          📍 Abrir en Google Maps
        </button>
      </div>

      <script>
        // Crear mapa centrado en el cluster
        const map = L.map('map').setView([${cluster.center.latitude}, ${cluster.center.longitude}], 16);
        
        // Agregar capa base de OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);

        // Crear círculo de 100m de radio
        L.circle([${cluster.center.latitude}, ${cluster.center.longitude}], {
          color: '${clusterColor}',
          fillColor: '${clusterColor}',
          fillOpacity: 0.2,
          weight: 2,
          radius: 100
        }).addTo(map);

        // Crear marcador en el centro
        L.circleMarker([${cluster.center.latitude}, ${cluster.center.longitude}], {
          color: '${clusterColor}',
          fillColor: '${clusterColor}',
          fillOpacity: 0.8,
          weight: 2,
          radius: 8
        }).addTo(map).bindPopup('Centro del cluster<br>${cluster.count} detecciones');

        // Crear heatmap con puntos alrededor del centro (simulado)
        const heatData = [];
        const lat = ${cluster.center.latitude};
        const lng = ${cluster.center.longitude};
        
        // Generar puntos de calor alrededor del centro
        for (let i = 0; i < ${cluster.count}; i++) {
          const angle = (i / ${cluster.count}) * Math.PI * 2;
          const distance = Math.random() * 0.001; // ~100m en coordenadas
          const pointLat = lat + Math.sin(angle) * distance;
          const pointLng = lng + Math.cos(angle) * distance;
          const intensity = Math.random() * 0.8 + 0.2; // 0.2 a 1.0
          heatData.push([pointLat, pointLng, intensity]);
        }

        // Agregar capa de heatmap
        if (heatData.length > 0) {
          L.heatLayer(heatData, {
            radius: 25,
            blur: 15,
            maxZoom: 1,
            gradient: {
              0.0: '#00FF00',    // Verde
              0.25: '#FFFF00',   // Amarillo
              0.5: '#FF8C00',    // Naranja
              1.0: '#FF0000'     // Rojo
            }
          }).addTo(map);
        }

        // Ajustar vista
        map.setZoom(16);
      </script>
    </body>
    </html>
  `;

  // Para React Native, mostrar vista con información del cluster
  // (WebView no está disponible en Expo Go, pero sí en build nativo)
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

        {/* Contenedor del mapa - Placeholder visual */}
        <View className="flex-1 bg-gradient-to-b from-blue-100 to-blue-50 items-center justify-center">
          <View className="items-center gap-4">
            <MaterialIcons name="map" size={48} color={colors.primary} />
            <Text className="text-lg font-semibold text-foreground">Mapa de Densidad</Text>
            <Text className="text-sm text-muted text-center px-6">
              Centro: {cluster.center.latitude.toFixed(4)}, {cluster.center.longitude.toFixed(4)}
            </Text>
            <View className="mt-4 p-4 bg-white rounded-lg border border-border">
              <Text className="text-xs text-muted mb-3 font-semibold">Leyenda de Densidad:</Text>
              <View className="gap-2">
                <View className="flex-row items-center gap-2">
                  <View className="w-4 h-4 rounded-full" style={{ backgroundColor: "#00FF00" }} />
                  <Text className="text-xs text-muted">Baja (0-25%)</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <View className="w-4 h-4 rounded-full" style={{ backgroundColor: "#FFFF00" }} />
                  <Text className="text-xs text-muted">Media (26-50%)</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <View className="w-4 h-4 rounded-full" style={{ backgroundColor: "#FF8C00" }} />
                  <Text className="text-xs text-muted">Media-Alta (51-75%)</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <View className="w-4 h-4 rounded-full" style={{ backgroundColor: "#FF0000" }} />
                  <Text className="text-xs text-muted">Alta (76-100%)</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Panel de información inferior */}
        <View className="absolute bottom-0 left-0 right-0 bg-surface border-t border-border p-4 rounded-t-2xl">
          <ScrollView showsVerticalScrollIndicator={false} className="max-h-40">
            <View className="gap-3">
              {/* Título del área */}
              <View className="flex-row items-center gap-3">
                <View
                  className="w-6 h-6 rounded-full"
                  style={{ backgroundColor: clusterColor }}
                />
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-foreground">
                    Área de Densidad
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
                onPress={async () => {
                  try {
                    const url = `https://www.google.com/maps/search/?api=1&query=${cluster.center.latitude},${cluster.center.longitude}`;
                    const canOpen = await Linking.canOpenURL(url);
                    if (canOpen) {
                      await Linking.openURL(url);
                    }
                  } catch (error) {
                    console.error("Error al abrir Google Maps:", error);
                  }
                }}
                className="bg-primary rounded-lg p-3 items-center active:opacity-80"
              >
                <View className="flex-row items-center gap-2">
                  <MaterialIcons name="location-on" size={16} color="white" />
                  <Text className="text-white font-semibold text-sm">Abrir en Google Maps</Text>
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </ScreenContainer>
  );
}
