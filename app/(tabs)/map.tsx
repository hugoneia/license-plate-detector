import { useState, useCallback, useRef, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter, useLocalSearchParams } from "expo-router";
import { AppState, type AppStateStatus, Alert, Platform, Keyboard } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";

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
  const webViewRef = useRef<WebView>(null);
  const appState = useRef(AppState.currentState);
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useColors();

  // Regex para validar matrículas españolas: 0000BBB
  const PLATE_REGEX = /^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/;

  // Cargar datos al montar componente
  useEffect(() => {
    loadMapData();

    // Leer parámetro de ruta si existe
    if (params?.plate) {
      const plate = Array.isArray(params.plate) ? params.plate[0] : params.plate;
      setSelectedPlateParam(plate);
      setSearchPlate(plate);
      setIsValidPlate(true);
    }

    // Escuchar cambios de app state
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = (state: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && state === "active") {
      loadMapData();
    }
    appState.current = state;
  };

  async function loadMapData() {
    try {
      setIsLoading(true);
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const entries: LicensePlateEntry[] = JSON.parse(data);
        setAllEntries(entries);

        // Si hay una matrícula seleccionada, filtrar automáticamente
        if (selectedPlateParam) {
          const filtered = entries.filter((e) =>
            e.licensePlate.toUpperCase() === selectedPlateParam.toUpperCase()
          );
          setFilteredEntries(filtered);
        } else {
          setFilteredEntries(entries);
        }
      } else {
        setAllEntries([]);
        setFilteredEntries([]);
      }
    } catch (error) {
      console.error("Error al cargar datos del mapa:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSearchChange(text: string) {
    const upper = text.toUpperCase().trim();
    setSearchPlate(upper);

    // Validar formato
    const valid = PLATE_REGEX.test(upper);
    setIsValidPlate(valid);
  }

  function handleShowMap() {
    if (isValidPlate && searchPlate) {
      const filtered = allEntries.filter((e) =>
        e.licensePlate.toUpperCase() === searchPlate.toUpperCase()
      );
      setFilteredEntries(filtered);
      setSelectedPlateParam(searchPlate);
      Keyboard.dismiss();
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  }

  function handleClearSearch() {
    setSearchPlate("");
    setIsValidPlate(false);
    setFilteredEntries(allEntries);
    setSelectedPlateParam(null);
    Keyboard.dismiss();
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  function handleShowAll() {
    setSearchPlate("");
    setIsValidPlate(false);
    setFilteredEntries(allEntries);
    setSelectedPlateParam(null);
    Keyboard.dismiss();
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  // Generar HTML de Leaflet con datos
  const generateMapHTML = () => {
    const entries = selectedPlateParam ? filteredEntries : allEntries;

    // Parsear coordenadas desde string "lat,lng"
    const markers = entries
      .map((entry) => {
        if (entry.location === "NO GPS" || typeof entry.location === "string") {
          return null;
        }
        const lat = entry.location?.latitude;
        const lng = entry.location?.longitude;
        if (!lat || !lng) return null;

        const color = entry.parkingLocation === "doble_fila" ? "#ff9800" : "#2196f3";
        const date = new Date(entry.timestamp);
        const timeStr = date.toLocaleTimeString("es-ES");

        return {
          lat,
          lng,
          plate: entry.licensePlate,
          date: date.toLocaleDateString("es-ES"),
          time: timeStr,
          type: entry.parkingLocation === "doble_fila" ? "Doble fila" : "Acera",
          color,
          id: entry.id,
        };
      })
      .filter(Boolean);

    // Calcular bounds si hay marcadores
    let boundsScript = "";
    if (markers.length > 0) {
    const lats = markers.filter((m) => m).map((m) => m!.lat);
    const lngs = markers.filter((m) => m).map((m) => m!.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      boundsScript = `
        var bounds = L.latLngBounds([[${minLat}, ${minLng}], [${maxLat}, ${maxLng}]]);
        map.fitBounds(bounds, { padding: [50, 50] });
      `;
    }

    const markersScript = markers
      .map(
        (m) => m ? `
      var marker = L.circleMarker([${m.lat}, ${m.lng}], {
        radius: 8,
        fillColor: '${m.color}',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(map);

      marker.on('click', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'markerClick',
          id: '${m.id}',
          plate: '${m.plate}',
          date: '${m.date}',
          time: '${m.time}',
          type: '${m.type}',
          lat: ${m.lat},
          lng: ${m.lng}
        }));
      });
    ` : ''
      )
      .join("\n");

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        * { margin: 0; padding: 0; }
        html, body, #map { width: 100%; height: 100%; }
        body { background: #1a1a1a; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map').setView([40.4168, -3.7038], 12);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '© CartoDB',
          subdomains: 'abcd',
          maxZoom: 20
        }).addTo(map);

        ${markersScript}

        ${boundsScript}

        map.on('click', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'mapClick'
          }));
        });
      </script>
    </body>
    </html>
    `;

    return html;
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "markerClick") {
        const entry = filteredEntries.find((e) => e.id === data.id) ||
          allEntries.find((e) => e.id === data.id);
        if (entry) {
          setDetailModal(entry);
        }
      }
    } catch (error) {
      console.error("Error procesando mensaje del mapa:", error);
    }
  };

  return (
    <ScreenContainer className="flex-1">
      {/* Header Anclado */}
      <View className="bg-surface border-b border-border p-4 gap-3">
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => router.back()}
            className="p-2"
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-foreground flex-1">Mapa de Detecciones</Text>
        </View>

        {/* Buscador */}
        <View className="flex-row gap-2 items-center">
          <View
            className={`flex-1 flex-row items-center rounded-lg px-3 border-2 ${
              searchPlate === ""
                ? "border-border bg-surface"
                : isValidPlate
                  ? "border-primary bg-surface"
                  : "border-error bg-surface"
            }`}
          >
            <TextInput
              placeholder="Buscar matrícula..."
              placeholderTextColor={colors.muted}
              value={searchPlate}
              onChangeText={handleSearchChange}
              autoCapitalize="characters"
              maxLength={7}
              className="flex-1 py-2 text-foreground"
              editable={!isLoading}
            />
            {searchPlate && (
              <TouchableOpacity onPress={handleClearSearch} className="p-1">
                <MaterialIcons name="close" size={18} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            onPress={handleShowMap}
            disabled={!isValidPlate || searchPlate === ""}
            className={`px-4 py-2 rounded-lg ${
              isValidPlate && searchPlate ? "bg-primary" : "bg-border"
            }`}
          >
            <Text className={`font-semibold ${isValidPlate && searchPlate ? "text-white" : "text-muted"}`}>
              Mostrar
            </Text>
          </TouchableOpacity>
        </View>

        {/* Botón Ver Todo */}
        {selectedPlateParam && (
          <TouchableOpacity
            onPress={handleShowAll}
            className="bg-surface border border-primary rounded-lg py-2 px-3"
          >
            <Text className="text-primary font-semibold text-center">Ver Todas las Detecciones</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* WebView del Mapa */}
      {!isLoading && (
        <WebView
          ref={webViewRef}
          source={{ html: generateMapHTML() }}
          onMessage={handleWebViewMessage}
          style={{ flex: 1 }}
          scalesPageToFit={true}
          scrollEnabled={true}
          javaScriptEnabled={true}
        />
      )}

      {/* Modal de Detalle */}
      {detailModal && (
        <View className="absolute inset-0 bg-black/50 flex items-center justify-end">
          <View className="bg-surface rounded-t-3xl w-full p-6 gap-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-foreground">{detailModal.licensePlate}</Text>
              <TouchableOpacity onPress={() => setDetailModal(null)}>
                <MaterialIcons name="close" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <View className="gap-3">
              <View>
                <Text className="text-xs text-muted">Fecha y Hora</Text>
                <Text className="text-sm text-foreground">
                  {new Date(detailModal.timestamp).toLocaleDateString("es-ES")}{" "}
                  {new Date(detailModal.timestamp).toLocaleTimeString("es-ES")}
                </Text>
              </View>

              <View>
                <Text className="text-xs text-muted">Tipo de Estacionamiento</Text>
                <View className="flex-row items-center gap-2 mt-1">
                  <View
                    className={`px-3 py-1 rounded-full ${
                      detailModal.parkingLocation === "doble_fila" ? "bg-warning/20" : "bg-primary/20"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        detailModal.parkingLocation === "doble_fila" ? "text-warning" : "text-primary"
                      }`}
                    >
                      {detailModal.parkingLocation === "doble_fila" ? "Doble Fila" : "Acera"}
                    </Text>
                  </View>
                </View>
              </View>

              <View>
                <Text className="text-xs text-muted">Ubicación</Text>
                <Text className="text-sm text-foreground mt-1">
                  {detailModal.location === "NO GPS"
                    ? "Sin GPS"
                    : typeof detailModal.location === "string"
                      ? detailModal.location
                      : `${detailModal.location?.latitude.toFixed(4)}, ${detailModal.location?.longitude.toFixed(4)}`}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setDetailModal(null)}
              className="bg-primary rounded-lg py-3"
            >
              <Text className="text-white font-semibold text-center">Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}

// Imports necesarios
import { View, Text, TextInput, TouchableOpacity } from "react-native";
