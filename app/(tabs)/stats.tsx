import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useState, useCallback, useRef, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { AppState, type AppStateStatus, Alert, Linking, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import type { LicensePlateEntry, GroupedLicensePlate } from "@/types/license-plate";
import { groupLicensePlates, getUniquePlateStats, getTopPlatesByDetections } from "@/lib/grouping";

const STORAGE_KEY = "license_plates";

export default function StatsScreen() {
  const [grouped, setGrouped] = useState<GroupedLicensePlate[]>([]);
  const [uniqueStats, setUniqueStats] = useState<ReturnType<typeof getUniquePlateStats> | null>(null);
  const [selectedPlate, setSelectedPlate] = useState<GroupedLicensePlate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const appState = useRef(AppState.currentState);
  const router = useRouter();
  const colors = useColors();

  // Cargar datos cada vez que se accede a la pantalla
  useFocusEffect(
    useCallback(() => {
      loadStatistics();

      // Escuchar cambios de app state
      const subscription = AppState.addEventListener("change", handleAppStateChange);
      return () => {
        subscription.remove();
      };
    }, [])
  );

  const handleAppStateChange = (state: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && state === "active") {
      // App volvió al foreground
      loadStatistics();
    }
    appState.current = state;
  };

  async function loadStatistics() {
    try {
      setIsLoading(true);
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const entries: LicensePlateEntry[] = JSON.parse(data);
        const grouped = groupLicensePlates(entries);
        setGrouped(grouped);
        setUniqueStats(getUniquePlateStats(entries));
      } else {
        setGrouped([]);
        setUniqueStats({
          totalUnique: 0,
          totalDetections: 0,
          averageDetectionsPerPlate: 0,
          mostDetectedPlate: null,
        });
      }
    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function openMapLocation(latitude: number, longitude: number, plate: string) {
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Esquema nativo de Google Maps (t=2 = satélite)
      const nativeUrl = `google.navigation:q=${latitude},${longitude}&t=2`;
      
      // Fallback a navegador con vista satélite (!3m1!1e3)
      const browserUrl = `https://www.google.com/maps/@${latitude},${longitude},18z/data=!3m1!1e3`;

      const canOpen = await Linking.canOpenURL(nativeUrl);

      if (canOpen) {
        await Linking.openURL(nativeUrl);
      } else {
        await Linking.openURL(browserUrl);
      }
    } catch (error) {
      console.error("Error al abrir mapa:", error);
      Alert.alert("Error", "Ocurrió un error al intentar abrir el mapa");
    }
  }

  // Vista de detalle de matrícula
  if (selectedPlate) {
    return (
      <ScreenContainer className="flex-1 p-6">
        <View className="flex-1 gap-4">
          {/* Encabezado Anclado */}
          <View className="mb-4">
            <TouchableOpacity onPress={() => setSelectedPlate(null)} className="mb-2">
              <Text className="text-primary font-semibold">← Volver</Text>
            </TouchableOpacity>

            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text
                  className="text-4xl font-bold text-foreground"
                  style={{ fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }}
                >
                  {selectedPlate.licensePlate}
                </Text>
                <Text className="text-base text-muted mt-1">
                  {selectedPlate.count} detecciones
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  router.push({
                    pathname: "/plate-map",
                    params: { plate: selectedPlate.licensePlate },
                  });
                }}
                className="p-3 rounded-lg bg-primary/10"
              >
                <MaterialIcons name="map" size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Lista de detecciones */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            {selectedPlate.entries.map((item, index) => {
              const date = new Date(item.timestamp);
              const hasGPS = item.location && item.location !== "NO GPS";
              const locationStr =
                item.location === "NO GPS"
                  ? "NO GPS"
                  : `${item.location?.latitude.toFixed(4)}, ${item.location?.longitude.toFixed(4)}`;

              return (
                <View key={item.id} className="bg-surface rounded-2xl p-4 mb-3 border border-border">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="font-semibold text-foreground">Detección #{selectedPlate.entries.length - index}</Text>
                  </View>

                  <View className="gap-2">
                    <View>
                      <Text className="text-xs text-muted">Fecha y Hora</Text>
                      <Text className="text-sm text-foreground">
                        {date.toLocaleDateString("es-ES")} {date.toLocaleTimeString("es-ES")}
                      </Text>
                    </View>

                    {/* Ubicación con botón de mapa */}
                    <TouchableOpacity
                      onPress={() => {
                        if (hasGPS && item.location && typeof item.location !== "string") {
                          openMapLocation(
                            item.location.latitude,
                            item.location.longitude,
                            selectedPlate.licensePlate
                          );
                        }
                      }}
                      disabled={!hasGPS}
                      className={hasGPS ? "opacity-100" : "opacity-50"}
                    >
                      <View>
                        <Text className="text-xs text-muted">Ubicación</Text>
                        <View className="flex-row items-center gap-2 mt-1">
                          <MaterialIcons
                            name={hasGPS ? "location-on" : "location-off"}
                            size={16}
                            color={hasGPS ? "#0066CC" : "#687076"}
                          />
                          <Text className={`text-sm ${hasGPS ? "text-primary font-semibold" : "text-muted"}`}>
                            {locationStr}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Ubicación de estacionamiento */}
                    <View>
                      <Text className="text-xs text-muted">Ubicación de estacionamiento</Text>
                      <Text className={`text-sm font-semibold mt-1 ${
                        item.parkingLocation === "acera"
                          ? "text-primary"
                          : item.parkingLocation === "doble_fila"
                          ? "text-warning"
                          : "text-muted"
                      }`}>
                        {item.parkingLocation === "acera"
                          ? "En la acera"
                          : item.parkingLocation === "doble_fila"
                          ? "En doble fila"
                          : "Sin definir"}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </ScreenContainer>
    );
  }

  if (isLoading || !uniqueStats) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <Text className="text-muted">Cargando...</Text>
      </ScreenContainer>
    );
  }

  const topPlates = getTopPlatesByDetections(grouped.flatMap(g => g.entries), 5);
  const allByCount = grouped.sort((a, b) => b.count - a.count);
  const restPlates = allByCount.slice(5);

  return (
    <ScreenContainer className="flex-1">
      {/* Header Sticky */}
      <View className="bg-background border-b border-border px-6 pt-6 pb-4">
        <Text className="text-3xl font-bold text-foreground">Estadísticas</Text>
        <Text className="text-base text-muted mt-1 mb-4">Análisis de detecciones</Text>
        
        {/* Botón Ver Mapa */}
        <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              router.push("/plate-map");
            }}
            className="bg-primary rounded-xl px-4 py-3 flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="map" size={20} color="white" />
              <View>
                <Text className="text-white font-bold">Mapa de Detecciones</Text>
                <Text className="text-white/70 text-xs">Ver todas las detecciones</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="white" />
          </TouchableOpacity>
      </View>

      {/* Contenido con Scroll */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="gap-6 p-6">
          {/* TOP 5 Matrículas */}
          <View>
            <Text className="text-lg font-bold text-foreground mb-4">TOP 5 Matrículas</Text>

            {/* Caja de Total */}
            {uniqueStats.totalDetections > 0 ? (
              <View className="bg-surface rounded-2xl border border-border mb-4 flex-row">
                {/* Sub-contenedor Izquierdo */}
                <View className="flex-1 p-4 items-center justify-center">
                  <Text className="text-sm text-muted mb-2">Total de Detecciones</Text>
                  <Text className="text-4xl font-bold text-foreground">{uniqueStats.totalDetections}</Text>
                </View>
                
                {/* Separador Vertical */}
                <View style={{ width: 1, backgroundColor: colors.border }} />
                
                {/* Sub-contenedor Derecho */}
                <View className="flex-1 p-4 items-center justify-center">
                  <Text className="text-sm text-muted mb-2">Matrículas Únicas</Text>
                  <Text className="text-4xl font-bold text-foreground">{uniqueStats.totalUnique}</Text>
                </View>
              </View>
            ) : (
              <View className="bg-surface rounded-2xl p-6 border border-border items-center mb-4">
                <Text className="text-muted text-center">
                  No hay matrículas detectadas todavía. ¡Comienza a capturar matrículas para ver
                  estadísticas!
                </Text>
              </View>
            )}

            {/* Listado TOP 5 */}
            {topPlates.length > 0 && (
              <View className="gap-2">
                {topPlates.map((plate, index) => {
                  // Determinar color según posición
                  let positionColor = colors.primary; // Default para posiciones 4+
                  let positionBgColor = "rgba(0, 102, 204, 0.1)"; // Default para posiciones 4+
                  
                  if (index === 0) {
                    // #1 - Amarillo (warning)
                    positionColor = colors.warning;
                    positionBgColor = `${colors.warning}15`; // 15% opacity
                  } else if (index === 1) {
                    // #2 - Gris (muted)
                    positionColor = colors.muted;
                    positionBgColor = `${colors.muted}15`; // 15% opacity
                  } else if (index === 2) {
                    // #3 - Naranja personalizado
                    positionColor = "#D88A2D";
                    positionBgColor = "#D88A2D15"; // 15% opacity
                  }
                  
                  return (
                  <TouchableOpacity
                    key={plate.licensePlate}
                    onPress={() => {
                      if (Platform.OS !== "web") {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                      setSelectedPlate(plate);
                    }}
                    className="rounded-2xl p-4 border-2 flex-row items-center justify-between"
                    style={{
                      backgroundColor: positionBgColor,
                      borderColor: positionColor,
                    }}
                  >
                    <View className="flex-1">
                      <View className="flex-row items-center gap-3 mb-1">
                        <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: positionColor }}>
                          <Text className="text-white font-bold text-sm">#{index + 1}</Text>
                        </View>
                        <Text
                          className="text-xl font-bold text-foreground"
                          style={{ fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }}
                        >
                          {plate.licensePlate}
                        </Text>
                      </View>
                      <Text className="text-xs text-muted ml-11">
                        {plate.count} detecciones • Última: {new Date(plate.entries[0]?.timestamp || Date.now()).toLocaleDateString("es-ES")}
                      </Text>
                    </View>
                    <View className="bg-primary rounded-full px-3 py-1 items-center">
                      <Text className="text-white font-bold text-sm">{plate.count}x</Text>
                    </View>
                  </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* ScrollView Horizontal - Matrículas 6+ */}
            {grouped.length > 5 && (
              <View className="mt-4">
                <Text className="text-sm text-muted mb-2">Más Matrículas</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingRight: 16 }}
                >
                  {grouped.slice(5).map((plate) => (
                    <TouchableOpacity
                      key={plate.licensePlate}
                      onPress={() => {
                        if (Platform.OS !== "web") {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                        setSelectedPlate(plate);
                      }}
                      className="bg-surface rounded-xl p-3 border border-border items-center justify-center"
                      style={{ minWidth: 100 }}
                    >
                      <Text
                        className="text-base font-bold text-foreground mb-1"
                        style={{ fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }}
                      >
                        {plate.licensePlate}
                      </Text>
                      <Text className="text-xs text-muted">{plate.count}x</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
