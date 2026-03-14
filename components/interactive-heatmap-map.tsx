import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, Linking, ScrollView, Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import WebView from "react-native-webview";
import type { ClusteredLocation } from "@/lib/heatmap-utils";

interface InteractiveHeatmapMapProps {
  cluster: ClusteredLocation;
  onClose: () => void;
}

/**
 * Componente de mapa interactivo que muestra:
 * - Mapa base con OpenStreetMap (via Leaflet en WebView)
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
          // Crear mapa centrado en el cluster
          const map = L.map('map', {
            center: [${cluster.center.latitude}, ${cluster.center.longitude}],
            zoom: 16,
            zoomControl: true,
            attributionControl: true
          });
          
          // Agregar capa base de OpenStreetMap
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
            minZoom: 1
          }).addTo(map);

          // Crear círculo de 100m de radio
          L.circle([${cluster.center.latitude}, ${cluster.center.longitude}], {
            color: '${clusterColor}',
            fillColor: '${clusterColor}',
            fillOpacity: 0.15,
            weight: 2,
            radius: 100,
            dashArray: '5, 5'
          }).addTo(map);

          // Crear marcador en el centro
          const centerMarker = L.circleMarker([${cluster.center.latitude}, ${cluster.center.longitude}], {
            color: '${clusterColor}',
            fillColor: '${clusterColor}',
            fillOpacity: 0.9,
            weight: 2,
            radius: 10
          }).addTo(map);
          
          centerMarker.bindPopup('<div style="font-size: 12px; text-align: center;"><strong>Centro del Cluster</strong><br>${cluster.count} detecciones</div>');

          // Crear heatmap con puntos alrededor del centro
          const heatData = [];
          const lat = ${cluster.center.latitude};
          const lng = ${cluster.center.longitude};
          
          // Generar puntos de calor alrededor del centro
          // Distribuir puntos en círculo alrededor del centro
          for (let i = 0; i < Math.min(${cluster.count}, 100); i++) {
            const angle = (i / Math.min(${cluster.count}, 100)) * Math.PI * 2;
            const distance = Math.random() * 0.0008; // ~80m en coordenadas
            const pointLat = lat + Math.sin(angle) * distance;
            const pointLng = lng + Math.cos(angle) * distance;
            const intensity = 0.3 + (Math.random() * 0.7); // 0.3 a 1.0
            heatData.push([pointLat, pointLng, intensity]);
          }

          // Agregar capa de heatmap
          if (heatData.length > 0) {
            L.heatLayer(heatData, {
              radius: 30,
              blur: 20,
              maxZoom: 1,
              minOpacity: 0.2,
              gradient: {
                0.0: '#00FF00',    // Verde
                0.25: '#FFFF00',   // Amarillo
                0.5: '#FF8C00',    // Naranja
                1.0: '#FF0000'     // Rojo
              }
            }).addTo(map);
          }

          // Ajustar vista para que se vea bien
          map.setView([${cluster.center.latitude}, ${cluster.center.longitude}], 16);
          
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
            <View
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: clusterColor }}
            />
            <Text className="text-xs font-semibold text-foreground">{intensityPercent}%</Text>
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

        {/* Panel de información inferior */}
        <View className="bg-surface border-t border-border p-4 rounded-t-2xl shadow-lg">
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
