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
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { useFocusEffect } from "@react-navigation/native";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import type { LicensePlateEntry } from "@/types/license-plate";

const STORAGE_KEY = "license_plates";

export default function MapScreen() {
  const [searchPlate, setSearchPlate] = useState("");
  const [isValidPlate, setIsValidPlate] = useState(false);
  const [allEntries, setAllEntries] = useState<LicensePlateEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<LicensePlateEntry[]>([]);
  const [selectedPlateParam, setSelectedPlateParam] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [detailModal, setDetailModal] = useState<LicensePlateEntry | null>(null);
  const [webViewReady, setWebViewReady] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const appState = useRef(AppState.currentState);
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useColors();

  // Regex para validar matrículas españolas: 0000BBB
  const PLATE_REGEX = /^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/;

  // Cargar datos del almacenamiento
  const loadMapData = useCallback(async () => {
    try {
      setIsLoading(true);
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const entries: LicensePlateEntry[] = stored ? JSON.parse(stored) : [];
      setAllEntries(entries);
      setFilteredEntries(entries);

      // Si hay parámetro de placa, filtrar automáticamente
      if (params?.plate) {
        const plate = Array.isArray(params.plate) ? params.plate[0] : params.plate;
        const filtered = entries.filter(
          (e) => e.licensePlate.toUpperCase() === plate.toUpperCase()
        );
        setFilteredEntries(filtered);
        setSelectedPlateParam(plate.toUpperCase());
        setSearchPlate(plate.toUpperCase());
      }
    } catch (error) {
      console.error("Error loading map data:", error);
      Alert.alert("Error", "No se pudieron cargar los datos del mapa");
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  // Cargar datos cuando la pantalla gana foco
  useFocusEffect(
    useCallback(() => {
      loadMapData();
    }, [loadMapData])
  );

  // Validar matrícula mientras se escribe
  const handlePlateChange = (text: string) => {
    const uppercase = text.toUpperCase();
    setSearchPlate(uppercase);
    setIsValidPlate(PLATE_REGEX.test(uppercase));
  };

  // Mostrar mapa filtrado
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

    // Inyectar datos en el mapa
    if (webViewRef.current && webViewReady) {
      const jsCode = `
        window.updateMapData(${JSON.stringify(filtered)}, true);
      `;
      webViewRef.current.injectJavaScript(jsCode);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Limpiar búsqueda
  const handleClearSearch = () => {
    setSearchPlate("");
    setIsValidPlate(false);
    setFilteredEntries(allEntries);
    Keyboard.dismiss();

    // Recargar todos los datos en el mapa
    if (webViewRef.current && webViewReady) {
      const jsCode = `
        window.updateMapData(${JSON.stringify(allEntries)}, false);
      `;
      webViewRef.current.injectJavaScript(jsCode);
    }
  };

  // Mostrar todas las detecciones
  const handleShowAll = () => {
    setSearchPlate("");
    setIsValidPlate(false);
    setFilteredEntries(allEntries);
    setSelectedPlateParam(null);

    if (webViewRef.current && webViewReady) {
      const jsCode = `
        window.updateMapData(${JSON.stringify(allEntries)}, false);
      `;
      webViewRef.current.injectJavaScript(jsCode);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // HTML del mapa con Leaflet y MarkerCluster
  const generateMapHTML = () => {
    return `
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
          html, body {
            height: 100%;
            margin: 0;
            padding: 0;
            background-color: #000;
          }
          #map {
            position: absolute;
            top: 0;
            bottom: 0;
            left: 0;
            right: 0;
            height: 100% !important;
            width: 100% !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script src="https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js"></script>
        <script>
          // Capturar errores nativos
          window.onerror = function(msg) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ 
                type: 'error', 
                message: 'JS_ERROR: ' + msg 
              }));
            }
            return false;
          };

          try {
            // Inicializar mapa en ubicación genérica (Madrid)
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
                let size = 'small';
                let color = '#83b867'; // Verde
                
                if (count > 100) {
                  size = 'large';
                  color = '#e6575c'; // Rojo
                } else if (count > 50) {
                  size = 'medium';
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
                  // Parsear coordenadas (puede ser objeto o string)
                  let lat, lng;
                  
                  if (typeof entry.location === 'object' && entry.location !== null) {
                    lat = entry.location.latitude;
                    lng = entry.location.longitude;
                  } else if (typeof entry.location === 'string' && entry.location !== 'NO GPS') {
                    const coords = entry.location.split(',').map(c => parseFloat(c.trim()));
                    if (coords.length !== 2) {
                      console.warn('Coordenadas inválidas:', entry.location);
                      return;
                    }
                    lat = coords[0];
                    lng = coords[1];
                  } else {
                    console.warn('Sin coordenadas GPS:', entry.licensePlate);
                    return;
                  }

                  if (isNaN(lat) || isNaN(lng)) {
                    console.warn('Coordenadas no numéricas:', lat, lng);
                    return;
                  }

                  const latlng = L.latLng(lat, lng);
                  bounds.extend(latlng);

                  // Determinar color del pin
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

              // Encuadrar todos los puntos
              if (fitBounds && bounds.isValid() && markerCount > 0) {
                map.fitBounds(bounds, { padding: [50, 50] });
              }

              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ 
                  type: 'map-loaded', 
                  count: markerCount 
                }));
              }
            };

            // Notificar que el mapa está listo
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'map-ready' }));
            }

          } catch (error) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ 
                type: 'error', 
                message: error.message 
              }));
            }
          }
        </script>
      </body>
      </html>
    `;
  };

  return (
    <ScreenContainer className="flex-1 bg-background">
      {/* Header Anclado */}
      <View className="bg-surface border-b border-border p-4">
        <View className="flex-row items-center gap-3 mb-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="p-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-foreground">Mapa</Text>
        </View>

        {/* Buscador */}
        <View className="flex-row items-center gap-2">
          <View
            className={`flex-1 flex-row items-center px-3 py-2 rounded-lg border ${
              searchPlate
                ? isValidPlate
                  ? "border-primary bg-surface"
                  : "border-error bg-surface"
                : "border-border bg-surface"
            }`}
          >
            <TextInput
              placeholder="Buscar matrícula..."
              placeholderTextColor={colors.muted}
              value={searchPlate}
              onChangeText={handlePlateChange}
              autoCapitalize="characters"
              maxLength={7}
              className="flex-1 text-foreground"
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
            className={`px-4 py-2 rounded-lg ${
              isValidPlate && !isLoading
                ? "bg-primary"
                : "bg-surface opacity-50"
            }`}
          >
            <Text className="text-white font-semibold text-center">Mostrar</Text>
          </TouchableOpacity>
        </View>

        {/* Botón "Ver Todas las Detecciones" (visible solo si hay filtro) */}
        {selectedPlateParam && (
          <TouchableOpacity
            onPress={handleShowAll}
            className="mt-3 py-2 px-3 bg-surface rounded-lg border border-border"
          >
            <Text className="text-primary font-semibold text-center text-sm">
              Ver Todas las Detecciones
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* WebView del Mapa */}
      <View style={{ flex: 1, backgroundColor: "#000", minHeight: 500 }}>
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
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              zIndex: 1000,
            }}
          >
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.muted, marginTop: 12 }}>
              Cargando mapa...
            </Text>
          </View>
        )}

        <WebView
          ref={webViewRef}
          source={{ html: generateMapHTML() }}
          style={{ flex: 1, minHeight: 500 }}
          containerStyle={{ flex: 1 }}
          originWhitelist={["*"]}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          androidLayerType="hardware"
          onLoad={() => {
            setWebViewReady(true);
            setIsLoading(false);
          }}
          onLoadEnd={() => {
            setWebViewReady(true);
            setIsLoading(false);
          }}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === "error") {
                console.error("WebView error:", data.message);
              } else if (data.type === "marker-click") {
                setDetailModal(data.entry);
              } else if (data.type === "map-ready") {
                // Inyectar datos iniciales cuando el mapa está listo
                if (webViewRef.current) {
                  const jsCode = `
                    window.updateMapData(${JSON.stringify(filteredEntries)}, ${selectedPlateParam ? "true" : "false"});
                  `;
                  webViewRef.current.injectJavaScript(jsCode);
                }
              }
            } catch (e) {
              console.error("Error parsing WebView message:", e);
            }
          }}
          renderLoading={() => (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "#000",
              }}
            >
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ color: colors.muted, marginTop: 12 }}>
                Cargando mapa...
              </Text>
            </View>
          )}
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
            paddingBottom: 32,
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
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {typeof detailModal.location === 'object' 
              ? `${detailModal.location.latitude}, ${detailModal.location.longitude}` 
              : detailModal.location}
          </Text>

          <TouchableOpacity
            onPress={() => setDetailModal(null)}
            style={{
              marginTop: 16,
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
    </ScreenContainer>
  );
}
