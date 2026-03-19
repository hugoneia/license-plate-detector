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

// HTML del mapa como constante (TEST DE VISIBILIDAD - FONDO ROJO)
const MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mapa de Detecciones</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 100%;
      height: 100%;
      background-color: red;
    }
    #test-container {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      color: white;
      font-weight: bold;
      font-family: Arial, sans-serif;
    }
  </style>
</head>
<body>
  <div id="test-container">PRUEBA DE RENDERIZADO</div>
  <script>
    console.log('HTML cargado correctamente');
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'html-loaded' }));
    }
  </script>
</body>
</html>
`;

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

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Limpiar búsqueda
  const handleClearSearch = () => {
    setSearchPlate("");
    setIsValidPlate(false);
    setFilteredEntries(allEntries);
    Keyboard.dismiss();
  };

  // Mostrar todas las detecciones
  const handleShowAll = () => {
    setSearchPlate("");
    setIsValidPlate(false);
    setFilteredEntries(allEntries);
    setSelectedPlateParam(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

      {/* WebView del Mapa - FUERZA BRUTA DE DIMENSIONES */}
      <View
        style={{
          flex: 1,
          height: "100%",
          width: "100%",
          backgroundColor: "blue",
        }}
      >
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
          source={{ html: MAP_HTML }}
          style={{
            flex: 1,
            height: "100%",
            width: "100%",
          }}
          containerStyle={{
            flex: 1,
          }}
          originWhitelist={["*"]}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          androidLayerType="hardware"
          onLoad={() => {
            console.log("WebView onLoad");
            setWebViewReady(true);
            setIsLoading(false);
          }}
          onLoadEnd={() => {
            console.log("WebView onLoadEnd");
            setWebViewReady(true);
            setIsLoading(false);
          }}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              console.log("WebView message:", data);
              if (data.type === "error") {
                console.error("WebView error:", data.message);
              } else if (data.type === "marker-click") {
                setDetailModal(data.entry);
              } else if (data.type === "html-loaded") {
                console.log("HTML cargado en WebView");
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
