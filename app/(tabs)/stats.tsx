import { View, Text, ScrollView, TouchableOpacity, FlatList } from "react-native";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { AppState, type AppStateStatus, Alert, Linking, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useBackHandler } from "@/hooks/use-back-handler";
import type { LicensePlateEntry, GroupedLicensePlate } from "@/types/license-plate";
import { groupLicensePlates, getUniquePlateStats, getTopPlatesByDetections } from "@/lib/grouping";
import type { ExclusionZonesConfig } from "@/types/exclusion-zone";
import { isInAnyExclusionZone } from "@/types/exclusion-zone";

const STORAGE_KEY = "license_plates";
const EXCLUSION_ZONES_KEY = "exclusion_zones";

export default function StatsScreen() {
  const [rawEntries, setRawEntries] = useState<LicensePlateEntry[]>([]);
  const [selectedPlate, setSelectedPlate] = useState<GroupedLicensePlate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // lastDataLength ya no es necesario
  const [exclusionZonesConfig, setExclusionZonesConfig] = useState<ExclusionZonesConfig>({
    masterEnabled: false,
    zones: [],
  });
  const appState = useRef(AppState.currentState);
  const router = useRouter();
  const colors = useColors();

  // Calcular entries visibles (filtradas por exclusión)
  const visibleEntries = useMemo(() => {
    if (!exclusionZonesConfig.masterEnabled || exclusionZonesConfig.zones.length === 0) {
      return rawEntries;
    }
    return rawEntries.filter((entry) => {
      if (entry.location === "NO GPS") return true; // Mantener sin GPS
      if (typeof entry.location === "object" && entry.location.latitude && entry.location.longitude) {
        return !isInAnyExclusionZone(entry.location.latitude, entry.location.longitude, exclusionZonesConfig.zones);
      }
      return true; // Mantener si no tiene coordenadas válidas
    });
  }, [rawEntries, exclusionZonesConfig]);

  // Memoizar cálculos costosos basados en visibleEntries (no rawEntries)
  const grouped = useMemo(() => groupLicensePlates(visibleEntries), [visibleEntries]);
  const uniqueStats = useMemo(() => getUniquePlateStats(visibleEntries), [visibleEntries]);
  const topPlates = useMemo(() => getTopPlatesByDetections(visibleEntries, 5), [visibleEntries]);
  const allByCount = useMemo(() => grouped.sort((a, b) => b.count - a.count), [grouped]);

  // Calcular estadísticas totales sin filtros (para mostrar registros ocultos)
  const totalStatsNoFilter = useMemo(() => getUniquePlateStats(rawEntries), [rawEntries]);
  const aceraTotalNoFilter = rawEntries.filter(e => e.parkingLocation === 'acera').length;
  const dobleFilaTotalNoFilter = rawEntries.filter(e => e.parkingLocation === 'doble_fila').length;

  // Calcular registros excluidos por filtro
  const hasActiveFilters = exclusionZonesConfig.masterEnabled && exclusionZonesConfig.zones.length > 0;
  const isAnyFilterActive = exclusionZonesConfig.masterEnabled; // Controla si mostrar espacio reservado
  const excludedDetections = hasActiveFilters ? totalStatsNoFilter.totalDetections - (uniqueStats?.totalDetections || 0) : 0;
  const excludedUnique = hasActiveFilters ? totalStatsNoFilter.totalUnique - (uniqueStats?.totalUnique || 0) : 0;
  const excludedAcera = hasActiveFilters ? aceraTotalNoFilter - visibleEntries.filter(e => e.parkingLocation === 'acera').length : 0;
  const excludedDobleFile = hasActiveFilters ? dobleFilaTotalNoFilter - visibleEntries.filter(e => e.parkingLocation === 'doble_fila').length : 0;

  // Manejar botón de atrás: cerrar detalle antes de cambiar de pestaña
  const handleBackPress = useCallback(() => {
    if (selectedPlate) {
      setSelectedPlate(null);
      return true; // Evento manejado
    }
    return false; // Permitir comportamiento predeterminado
  }, [selectedPlate]);

  useBackHandler(handleBackPress);

  // Cargar zonas de exclusión y datos al acceder a la pantalla
  useFocusEffect(
    useCallback(() => {
      loadExclusionZones();
      loadStatistics();

      // Escuchar cambios de app state
      const subscription = AppState.addEventListener("change", handleAppStateChange);
      return () => {
        subscription.remove();
      };
    }, [])
  );

  async function loadExclusionZones() {
    try {
      const data = await AsyncStorage.getItem(EXCLUSION_ZONES_KEY);
      if (data) {
        setExclusionZonesConfig(JSON.parse(data));
      }
    } catch (error) {
      console.error("Error loading exclusion zones:", error);
    }
  }

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
        // Siempre actualizar para que el filtro de zonas se aplique correctamente
        setRawEntries(entries);
      } else {
        setRawEntries([]);
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

      // Esquema nativo con matrícula como etiqueta
      const plateLabel = plate || 'Vehículo';
      const scheme = Platform.OS === 'ios' ? 'maps:0,0?q=' : 'geo:0,0?q=';
      const latLng = `${latitude},${longitude}`;
      const url = Platform.select({
        ios: `${scheme}${plateLabel}@${latLng}&z=20`,
        android: `${scheme}${latLng}(${plateLabel})?z=20`
      });

      if (url) {
        await Linking.openURL(url);
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
        <Text className="text-lg text-muted font-semibold">Cargando estadísticas...</Text>
        <Text className="text-sm text-muted mt-2">Analizando {rawEntries.length} registros</Text>
      </ScreenContainer>
    );
  }

  const restPlates = allByCount.slice(5);

  return (
    <ScreenContainer className="flex-1">
      {/* Header Sticky */}
      <View className="bg-background border-b border-border px-6 pt-6 pb-4">
        <View className="flex-row items-center justify-between gap-2 mb-2">
          <Text className="text-3xl font-bold text-foreground">Estadísticas</Text>
          {exclusionZonesConfig.masterEnabled && (
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS !== "web") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                router.push("/(tabs)/settings");
              }}
              className="flex-row items-center gap-1 bg-error/10 rounded-full px-2 py-1 active:opacity-70"
            >
              <MaterialIcons name="filter-alt" size={16} color={colors.error} />
              <Text className="text-xs text-error font-semibold">Filtro</Text>
            </TouchableOpacity>
          )}
        </View>
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
          {/* Bloque 1: Total de Detecciones y Matrículas Únicas */}
          {uniqueStats.totalDetections > 0 ? (
            <View className="bg-surface rounded-2xl border border-border flex-row">
              {/* Sub-contenedor Izquierdo */}
              <View className="flex-1 p-4 items-center justify-center">
                <Text className="text-sm text-muted mb-2">Total de Detecciones</Text>
                <Text className="text-4xl font-bold text-foreground">{uniqueStats.totalDetections || 0}</Text>
                {isAnyFilterActive && (
                  <Text className={`text-sm text-error font-semibold mt-1 ${excludedDetections > 0 ? 'opacity-100' : 'opacity-0'}`}>
                    {excludedDetections || '0'}
                  </Text>
                )}
              </View>
              
              {/* Separador Vertical */}
              <View style={{ width: 1, backgroundColor: colors.border }} />
              
              {/* Sub-contenedor Derecho */}
              <View className="flex-1 p-4 items-center justify-center">
                <Text className="text-sm text-muted mb-2">Matrículas Únicas</Text>
                <Text className="text-4xl font-bold text-foreground">{uniqueStats.totalUnique || 0}</Text>
                {isAnyFilterActive && (
                  <Text className={`text-sm text-error font-semibold mt-1 ${excludedUnique > 0 ? 'opacity-100' : 'opacity-0'}`}>
                    {excludedUnique || '0'}
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <View className="bg-surface rounded-2xl p-6 border border-border items-center">
              <Text className="text-muted text-center">
                No hay matrículas detectadas todavía. ¡Comienza a capturar matrículas para ver
                estadísticas!
              </Text>
            </View>
          )}

          {/* Bloque 2: Estadísticas de Estacionamiento */}
          {uniqueStats.totalDetections > 0 && (
            <View className="bg-surface rounded-2xl border border-border flex-row">
              {/* Sub-contenedor Izquierdo - En Acera */}
              <View className="flex-1 p-4 items-center justify-center">
                <Text className="text-sm text-muted mb-2">En Acera</Text>
                <Text className="text-4xl font-bold text-foreground">
                  {visibleEntries.filter(e => e.parkingLocation === 'acera').length || 0}
                </Text>
                {isAnyFilterActive && (
                  <Text className={`text-sm text-error font-semibold mt-1 ${excludedAcera > 0 ? 'opacity-100' : 'opacity-0'}`}>
                    {excludedAcera || '0'}
                  </Text>
                )}
              </View>
              
              {/* Separador Vertical */}
              <View style={{ width: 1, backgroundColor: colors.border }} />
              
              {/* Sub-contenedor Derecho - En Doble Fila */}
              <View className="flex-1 p-4 items-center justify-center">
                <Text className="text-sm text-muted mb-2">En Doble Fila</Text>
                <Text className="text-4xl font-bold text-foreground">
                  {visibleEntries.filter(e => e.parkingLocation === 'doble_fila').length || 0}
                </Text>
                {isAnyFilterActive && (
                  <Text className={`text-sm text-error font-semibold mt-1 ${excludedDobleFile > 0 ? 'opacity-100' : 'opacity-0'}`}>
                    {excludedDobleFile || '0'}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* TOP 5 Matrículas */}
          <View>
            <Text className="text-lg font-bold text-foreground mb-4">TOP 5 Matrículas</Text>

            {/* Listado TOP 5 */}
            {topPlates.length > 0 && uniqueStats.totalDetections > 0 && (
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

            {/* FlatList Horizontal Virtualizado - Matrículas 6+ */}
            {restPlates.length > 0 && (
              <View className="mt-4">
                <Text className="text-sm text-muted mb-2">Más Matrículas</Text>
                <FlatList
                  horizontal
                  data={restPlates}
                  keyExtractor={(item) => item.licensePlate}
                  renderItem={({ item: plate }) => (
                    <TouchableOpacity
                      onPress={() => {
                        if (Platform.OS !== "web") {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                        setSelectedPlate(plate);
                      }}
                      className="bg-surface rounded-xl p-3 border border-border items-center justify-center mr-2"
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
                  )}
                  showsHorizontalScrollIndicator={false}
                  initialNumToRender={5}
                  windowSize={3}
                  maxToRenderPerBatch={5}
                  removeClippedSubviews={true}
                  scrollEventThrottle={16}
                />
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
