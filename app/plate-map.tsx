import { useCallback, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  AppState,
  type AppStateStatus,
  Alert,
  Platform,
  Keyboard,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/use-colors";
import type { LicensePlateEntry } from "@/types/license-plate";

const STORAGE_KEY = "license_plates";

// HTML del mapa con Leaflet y MarkerCluster
const MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mapa de Detecciones</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css" />
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 100%;
      height: 100%;
      background-color: #000;
    }
    #map {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js"></script>
  <script>
    window.onerror = function(msg, url, lineNo, columnNo, error) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ 
          type: 'error', 
          message: msg,
          url: url,
          lineNo: lineNo,
          columnNo: columnNo
        }));
      }
      return false;
    };

    try {
      // Inicializar mapa en Madrid
      const map = L.map('map', {
        center: [40.4168, -3.7038],
        zoom: 12,
        attributionControl: true,
        zoomControl: true
      });

      // CartoDB DarkMatter
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CartoDB',
        maxZoom: 19
      }).addTo(map);

      // Crear grupo de clustering
      const markerClusterGroup = L.markerClusterGroup({
        maxClusterRadius: 80,
        iconCreateFunction: function(cluster) {
          const count = cluster.getChildCount();
          let color = '#83b867'; // Verde
          if (count > 10) color = '#f59a71'; // Naranja
          if (count > 20) color = '#e6575c'; // Rojo
          if (count > 5 && count <= 10) color = '#ffe373'; // Amarillo

          return L.divIcon({
            html: '<div style="background-color:' + color + '; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">' + count + '</div>',
            iconSize: [40, 40],
            className: 'marker-cluster'
          });
        }
      });

      map.addLayer(markerClusterGroup);

      // Función para actualizar datos del mapa
      window.updateMapData = function(entries, fitBounds) {
        markerClusterGroup.clearLayers();

        if (!entries || entries.length === 0) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'no-data' }));
          return;
        }

        let bounds = L.latLngBounds();
        let hasValidMarkers = false;

        entries.forEach(function(entry) {
          let lat, lng;

          // Parsear coordenadas (objeto o string)
          if (typeof entry.location === 'object' && entry.location !== null) {
            lat = entry.location.latitude;
            lng = entry.location.longitude;
          } else if (typeof entry.location === 'string' && entry.location !== 'NO GPS') {
            const parts = entry.location.split(',').map(c => parseFloat(c.trim()));
            lat = parts[0];
            lng = parts[1];
          }

          // Validar coordenadas
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            hasValidMarkers = true;
            const markerColor = entry.parkingLocation === 'acera' ? '#0066ff' : '#ff9900';
            const marker = L.circleMarker([lat, lng], {
              radius: 6,
              fillColor: markerColor,
              color: markerColor,
              weight: 2,
              opacity: 1,
              fillOpacity: 0.8
            });

            const parkingText = entry.parkingLocation === 'acera' ? 'Acera' : entry.parkingLocation === 'doble_fila' ? 'Doble Fila' : 'Desconocido';
            marker.bindPopup('<div style="font-size: 12px; color: #333;"><strong>' + entry.licensePlate + '</strong><br/>' + parkingText + '</div>');

            marker.on('click', function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'marker-click',
                entry: entry
              }));
            });

            markerClusterGroup.addLayer(marker);
            bounds.extend([lat, lng]);
          }
        });

        if (hasValidMarkers && fitBounds) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }

        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'map-loaded' }));
      };

      // Notificar que el mapa está listo
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'map-ready' }));
    } catch (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ 
        type: 'error', 
        message: e.message 
      }));
    }
  </script>
</body>
</html>
`;

export default function PlateMapScreen() {
  const [searchPlate, setSearchPlate] = useState("");
  const [isValidPlate, setIsValidPlate] = useState(false);
  const [allEntries, setAllEntries] = useState<LicensePlateEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<LicensePlateEntry[]>([]);
  const [selectedPlateParam, setSelectedPlateParam] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [detailModal, setDetailModal] = useState<LicensePlateEntry | null>(null);
  const [webViewReady, setWebViewReady] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const PLATE_REGEX = /^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/;

  // Determinar si es vista de matrícula específica
  const isPlateView = selectedPlateParam !== null;

  // Cargar datos del almacenamiento
  const loadMapData = useCallback(async () => {
    try {
      setIsLoading(true);

      // FAILSAFE: Desbloqueo garantizado a los 3.5 segundos
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn("FAILSAFE: Desbloqueo de cargador por timeout");
        setIsLoading(false);
      }, 3500);

      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const entries: LicensePlateEntry[] = stored ? JSON.parse(stored) : [];
      setAllEntries(entries);

      // Si hay parámetro de placa, filtrar automáticamente
      if (params?.plate) {
        const plate = Array.isArray(params.plate) ? params.plate[0] : params.plate;
        const filtered = entries.filter(
          (e) => e.licensePlate.toUpperCase() === plate.toUpperCase()
        );
        setFilteredEntries(filtered);
        setSelectedPlateParam(plate.toUpperCase());
        setSearchPlate(plate.toUpperCase());

        // Depuración: Si no hay resultados
        if (filtered.length === 0) {
          console.warn(`No se encontraron detecciones para la matrícula: ${plate}`);
        }
      } else {
        // IMPORTANTE: Si no hay params.plate, igualar filteredEntries a allEntries
        setFilteredEntries(entries);
        setSelectedPlateParam(null);

        // Depuración: Si allEntries está vacío
        if (entries.length === 0) {
          console.warn("No hay datos en AsyncStorage para mostrar en el mapa general");
        }
      }
    } catch (error) {
      console.error("Error loading map data:", error);
      Alert.alert("Error", "No se pudieron cargar los datos del mapa");
      setIsLoading(false);
    }
  }, [params]);

  useFocusEffect(
    useCallback(() => {
      loadMapData();
      return () => {
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
        }
      };
    }, [loadMapData])
  );

  const handlePlateChange = (text: string) => {
    const uppercase = text.toUpperCase();
    setSearchPlate(uppercase);
    setIsValidPlate(PLATE_REGEX.test(uppercase));
  };

  const handleShowMap = () => {
    if (!isValidPlate) {
      Alert.alert("Error", "Por favor, ingresa una matrícula válida (0000BBB)");
      return;
    }

    const filtered = allEntries.filter(
      (e) => e.licensePlate.toUpperCase() === searchPlate.toUpperCase()
    );
    setFilteredEntries(filtered);

    if (filtered.length === 0) {
      Alert.alert("Sin resultados", `No se encontraron detecciones para ${searchPlate}`);
      return;
    }

    if (webViewRef.current && webViewReady) {
      const jsCode = `window.updateMapData(${JSON.stringify(filtered)}, true);`;
      webViewRef.current.injectJavaScript(jsCode);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleShowAll = () => {
    setSearchPlate("");
    setIsValidPlate(false);
    setFilteredEntries(allEntries);
    setSelectedPlateParam(null);

    // Depuración: Si allEntries está vacío
    if (allEntries.length === 0) {
      Alert.alert("Sin datos", "No hay detecciones de matrículas para mostrar en el mapa");
      return;
    }

    if (webViewRef.current && webViewReady) {
      const jsCode = `window.updateMapData(${JSON.stringify(allEntries)}, false);`;
      webViewRef.current.injectJavaScript(jsCode);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleClearSearch = () => {
    setSearchPlate("");
    setIsValidPlate(false);
    setFilteredEntries(allEntries);
    Keyboard.dismiss();

    if (webViewRef.current && webViewReady) {
      const jsCode = `window.updateMapData(${JSON.stringify(allEntries)}, false);`;
      webViewRef.current.injectJavaScript(jsCode);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {/* Header Anclado */}
      <View style={{ backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1, padding: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.foreground }}>Mapa</Text>
        </View>

        {/* CASO A: Vista de Matrícula Específica */}
        {isPlateView ? (
          <View style={{ gap: 12 }}>
            <View style={{ backgroundColor: colors.primary + "20", borderRadius: 8, padding: 12, borderLeftWidth: 4, borderLeftColor: colors.primary }}>
              <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 4 }}>Matrícula</Text>
              <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.foreground, marginBottom: 4 }}>
                {selectedPlateParam}
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                {filteredEntries.length} {filteredEntries.length === 1 ? "detección" : "detecciones"}
              </Text>
            </View>
            {/* ELIMINADO: Botón "Ver Todas las Detecciones" en vista de matrícula específica */}
          </View>
        ) : (
          /* CASO B: Vista General con Búsqueda */
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: searchPlate ? (isValidPlate ? colors.primary : colors.error) : colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                <TextInput
                  placeholder="Buscar matrícula..."
                  placeholderTextColor={colors.muted}
                  value={searchPlate}
                  onChangeText={handlePlateChange}
                  autoCapitalize="characters"
                  maxLength={7}
                  style={{ flex: 1, color: colors.foreground, fontSize: 16 }}
                  editable={!isLoading}
                />
                {searchPlate && (
                  <TouchableOpacity
                    onPress={handleClearSearch}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <MaterialIcons name="close" size={20} color={colors.muted} />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                onPress={handleShowMap}
                disabled={!isValidPlate || isLoading}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: isValidPlate && !isLoading ? colors.primary : colors.surface,
                  opacity: isValidPlate && !isLoading ? 1 : 0.5,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "bold", textAlign: "center" }}>Mostrar</Text>
              </TouchableOpacity>
            </View>

            {/* Botón "Ver Todas las Detecciones" SOLO en vista general */}
            <TouchableOpacity
              onPress={handleShowAll}
              disabled={isLoading}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 16,
                backgroundColor: isLoading ? colors.surface : colors.primary,
                borderRadius: 8,
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              <Text style={{ color: isLoading ? colors.muted : "#fff", fontWeight: "bold", textAlign: "center", fontSize: 14 }}>
                Ver Todas las Detecciones
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Capa de Carga (Desmontaje Completo) */}
      {isLoading && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            zIndex: 1000,
            pointerEvents: "auto",
          }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.muted, marginTop: 12 }}>Cargando mapa...</Text>
        </View>
      )}

      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ html: MAP_HTML }}
        style={{ flex: 1 }}
        containerStyle={{ flex: 1 }}
        originWhitelist={["*"]}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        androidLayerType="hardware"
        onLoad={() => {
          setWebViewReady(true);
        }}
        onLoadEnd={() => {
          setWebViewReady(true);
        }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);

            if (data.type === "error") {
              console.error("WebView error:", data);
              setIsLoading(false);
            } else if (data.type === "marker-click") {
              setDetailModal(data.entry);
            } else if (data.type === "map-ready") {
              // Retraso de 500ms antes de inyectar datos
              setTimeout(() => {
                const dataToSend = filteredEntries.length > 0 ? filteredEntries : allEntries;
                const fitBounds = isPlateView ? true : false;
                webViewRef.current?.injectJavaScript(
                  `window.updateMapData(${JSON.stringify(dataToSend)}, ${fitBounds});`
                );
              }, 500);
            } else if (data.type === "map-loaded") {
              // Limpiar timeout del failsafe
              if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
                loadingTimeoutRef.current = null;
              }
              setIsLoading(false);
            } else if (data.type === "no-data") {
              // Limpiar timeout del failsafe
              if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
                loadingTimeoutRef.current = null;
              }
              setIsLoading(false);
            }
          } catch (e) {
            console.error("Error parsing WebView message:", e);
            setIsLoading(false);
          }
        }}
      />

      {/* Modal de Detalle */}
      {detailModal && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "flex-end",
            zIndex: 2000,
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 20,
              paddingBottom: Math.max(20, insets.bottom),
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.foreground }}>Detalle de Detección</Text>
              <TouchableOpacity onPress={() => setDetailModal(null)}>
                <MaterialIcons name="close" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12 }}>
              <View>
                <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>Matrícula</Text>
                <Text style={{ fontSize: 16, fontWeight: "bold", color: colors.foreground }}>{detailModal.licensePlate}</Text>
              </View>

              <View>
                <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>Tipo de Estacionamiento</Text>
                <Text style={{ fontSize: 14, color: colors.foreground }}>
                  {detailModal.parkingLocation === 'acera' ? 'Acera' : detailModal.parkingLocation === 'doble_fila' ? 'Doble Fila' : 'Desconocido'}
                </Text>
              </View>

              <View>
                <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>Fecha</Text>
                <Text style={{ fontSize: 14, color: colors.foreground }}>
                  {new Date(detailModal.timestamp).toLocaleString("es-ES")}
                </Text>
              </View>

              <View>
                <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>Ubicación</Text>
                <Text style={{ fontSize: 14, color: colors.foreground }}>
                  {typeof detailModal.location === "object" && detailModal.location
                    ? `${detailModal.location.latitude?.toFixed(4)}, ${detailModal.location.longitude?.toFixed(4)}`
                    : String(detailModal.location)}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setDetailModal(null)}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  backgroundColor: colors.primary,
                  borderRadius: 8,
                  marginTop: 8,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "bold", textAlign: "center" }}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
