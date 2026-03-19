import { useEffect, useRef, useState, useCallback } from "react";
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
          
          if (count > 100) {
            color = '#e6575c'; // Rojo
          } else if (count > 50) {
            color = '#f59a71'; // Naranja
          } else if (count > 20) {
            color = '#ffe373'; // Amarillo
          }

          return L.divIcon({
            html: '<div style="background-color:' + color + ';width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px;">' + count + '</div>',
            className: 'marker-cluster',
            iconSize: [40, 40]
          });
        }
      });

      map.addLayer(markerClusterGroup);

      // Función para actualizar datos del mapa
      window.updateMapData = function(entries, fitBounds) {
        markerClusterGroup.clearLayers();
        
        if (!entries || entries.length === 0) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'no-data' }));
          }
          return;
        }

        const bounds = L.latLngBounds([]);
        let markerCount = 0;
        
        entries.forEach(entry => {
          try {
            let lat, lng;
            
            if (typeof entry.location === 'object' && entry.location !== null) {
              lat = entry.location.latitude;
              lng = entry.location.longitude;
            } else if (typeof entry.location === 'string' && entry.location !== 'NO GPS') {
              const coords = entry.location.split(',').map(c => parseFloat(c.trim()));
              if (coords.length !== 2) return;
              lat = coords[0];
              lng = coords[1];
            } else {
              return;
            }

            if (isNaN(lat) || isNaN(lng)) return;

            const latlng = L.latLng(lat, lng);
            bounds.extend(latlng);

            const color = entry.parkingLocation === 'doble_fila' ? '#ff9800' : '#2196f3';
            const parkingText = entry.parkingLocation === 'doble_fila' ? 'Doble fila' : 'Acera';
            
            const marker = L.circleMarker(latlng, {
              radius: 8,
              fillColor: color,
              color: '#fff',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.8
            }).bindPopup('<b>' + entry.licensePlate + '</b><br/>' + new Date(entry.timestamp).toLocaleString() + '<br/>' + parkingText);

            marker.on('click', function() {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'marker-click',
                  entry: entry
                }));
              }
            });

            markerClusterGroup.addLayer(marker);
            markerCount++;
          } catch (e) {
            console.error('Error procesando entrada:', e);
          }
        });

        if (fitBounds && bounds.isValid() && markerCount > 0) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }

        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'map-loaded', count: markerCount }));
        }
      };

      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'map-ready' }));
      }

    } catch (error) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: error.message }));
      }
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

  const PLATE_REGEX = /^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/;

  // Determinar si es vista de matrícula específica
  const isPlateView = selectedPlateParam !== null;

  // Cargar datos del almacenamiento
  const loadMapData = useCallback(async () => {
    try {
      setIsLoading(true);
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
      } else {
        // IMPORTANTE: Si no hay params.plate, igualar filteredEntries a allEntries
        setFilteredEntries(entries);
        setSelectedPlateParam(null);
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
              style={{
                paddingVertical: 12,
                paddingHorizontal: 16,
                backgroundColor: colors.primary,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "bold", textAlign: "center", fontSize: 14 }}>
                Ver Todas las Detecciones
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* WebView del Mapa */}
      <View style={{ flex: 1, backgroundColor: "#000", position: "relative" }}>
        {/* Cargador - Se desmonta completamente cuando isLoading es false */}
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
            }}
          >
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.muted, marginTop: 12 }}>Cargando mapa...</Text>
          </View>
        )}

        <WebView
          ref={webViewRef}
          source={{ html: MAP_HTML }}
          style={{ flex: 1 }}
          containerStyle={{ flex: 1 }}
          originWhitelist={["*"]}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={false}
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
                // FAILSAFE: Desactivar isLoading inmediatamente después de primera inyección
                // para evitar bloqueos táctiles si map-loaded no se dispara
                setTimeout(() => {
                  setIsLoading(false);
                }, 600);
              } else if (data.type === "map-loaded") {
                // ÚNICO lugar donde se desactiva isLoading (si no se disparó el failsafe)
                setIsLoading(false);
              } else if (data.type === "no-data") {
                setIsLoading(false);
              }
            } catch (e) {
              console.error("Error parsing WebView message:", e);
              setIsLoading(false);
            }
          }}
        />
      </View>

      {/* Modal de Detalle */}
      {detailModal && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.surface,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            padding: 16,
            paddingBottom: Math.max(16, insets.bottom),
            zIndex: 2000,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.foreground }}>
              {detailModal.licensePlate}
            </Text>
            <TouchableOpacity
              onPress={() => setDetailModal(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="close" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <Text style={{ color: colors.muted, marginBottom: 8 }}>
            {new Date(detailModal.timestamp).toLocaleString()}
          </Text>
          <Text style={{ color: colors.foreground, marginBottom: 8 }}>
            {detailModal.parkingLocation === 'doble_fila' ? 'Doble fila' : 'Acera'}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 16 }}>
            {typeof detailModal.location === 'object' 
              ? `${detailModal.location.latitude}, ${detailModal.location.longitude}` 
              : detailModal.location}
          </Text>

          <TouchableOpacity
            onPress={() => setDetailModal(null)}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: colors.primary,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "bold", textAlign: "center" }}>
              Cerrar
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
