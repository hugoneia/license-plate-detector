import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { Linking } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Platform,
  Alert,
  Modal,
  Keyboard,
  KeyboardAvoidingView,
  Animated,
  Pressable,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { GPSEditorModal } from "@/components/gps-editor-modal";
import { AlertsOverlay } from "@/components/alerts-overlay";
import type { LicensePlateEntry, GroupedLicensePlate, GeoLocation, ParkingLocation } from "@/types/license-plate";
import { groupLicensePlates } from "@/lib/grouping";
import { useAlerts } from "@/hooks/use-alerts";
import { useColors } from "@/hooks/use-colors";

const STORAGE_KEY = "license_plates";

export default function HistoryScreen() {
  const router = useRouter();
  const { alerts, addAlert, removeAlert } = useAlerts();
  const colors = useColors();
  const [grouped, setGrouped] = useState<GroupedLicensePlate[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlate, setSelectedPlate] = useState<GroupedLicensePlate | null>(null);
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [editingPlateId, setEditingPlateId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingParkingLocation, setEditingParkingLocation] = useState<ParkingLocation>(null);
  const [tempParkingLocations, setTempParkingLocations] = useState<Map<string, ParkingLocation>>(new Map());
  const [gpsEditorVisible, setGpsEditorVisible] = useState(false);
  const [gpsEditingId, setGpsEditingId] = useState<string | null>(null);
  const [gpsEditingLocation, setGpsEditingLocation] = useState<GeoLocation | null>(null);
  const editingTextInputRef = useRef<TextInput>(null);
  const offsetAnim = useRef(new Animated.Value(0)).current;

  // Monitorear teclado para modal de edición
  useEffect(() => {
    if (!editingPlateId) return;

    const keyboardDidShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => {
        // Desplazar modal hacia arriba
        Animated.timing(offsetAnim, {
          toValue: -100,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    );

    const keyboardDidHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        // Volver a posición original
        Animated.timing(offsetAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      keyboardDidShow.remove();
      keyboardDidHide.remove();
    };
  }, [editingPlateId, offsetAnim]);

  // Cargar datos cada vez que se accede a la pantalla
  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [])
  );

  async function loadEntries() {
    try {
      setIsLoading(true);
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const entries: LicensePlateEntry[] = JSON.parse(data);
        // Ordenar por fecha más reciente primero
        entries.sort((a, b) => b.timestamp - a.timestamp);
        const grouped = groupLicensePlates(entries);
        setGrouped(grouped);
      }
    } catch (error) {
      console.error("Error al cargar historial:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function openMap(location: GeoLocation | "NO GPS" | undefined) {
    if (!location || location === "NO GPS") {
      addAlert("Esta detección no tiene datos de GPS", "info");
      return;
    }

    const { latitude, longitude } = location as GeoLocation;
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

    Linking.openURL(url).catch(() => {
      addAlert("No se pudo abrir el mapa", "error");
    });
  }

  async function editLocationOnMap(entryId: string, currentLocation: GeoLocation | "NO GPS" | undefined) {
    // Permitir editar GPS incluso si no hay datos registrados
    const location = currentLocation && currentLocation !== "NO GPS" ? (currentLocation as GeoLocation) : null;
    setGpsEditingId(entryId);
    setGpsEditingLocation(location);
    setGpsEditorVisible(true);
  }

  async function handleGpsSave(latitude: number, longitude: number) {
    if (!gpsEditingId) return;

    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const entries: LicensePlateEntry[] = JSON.parse(data);
        const updated = entries.map((e) =>
          e.id === gpsEditingId
            ? { ...e, location: { latitude, longitude } }
            : e
        );
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        updated.sort((a, b) => b.timestamp - a.timestamp);
        const grouped = groupLicensePlates(updated);
        setGrouped(grouped);

        if (selectedPlate) {
          const updatedGrouped = grouped.find(
            (g) => g.licensePlate === selectedPlate.licensePlate
          );
          if (updatedGrouped) {
            setSelectedPlate(updatedGrouped);
          }
        }

        addAlert("Ubicación actualizada correctamente", "success");
      }
    } catch (error) {
      console.error("Error:", error);
      addAlert("No se pudo actualizar la ubicación", "error");
    }
  }

  function handleLongPress(licensePlate: string) {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    setIsSelectionMode(true);
    const newSelected = new Set(selectedForDeletion);
    if (newSelected.has(licensePlate)) {
      newSelected.delete(licensePlate);
    } else {
      newSelected.add(licensePlate);
    }
    setSelectedForDeletion(newSelected);
  }

  function startEditingPlate(entry: LicensePlateEntry) {
    setEditingPlateId(entry.id);
    setEditingText(entry.licensePlate);
    setEditingParkingLocation(entry.parkingLocation || null);
  }

  async function updateParkingLocation(entryId: string, parkingLocation: ParkingLocation) {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const entries: LicensePlateEntry[] = JSON.parse(data);
        const updated = entries.map((e) =>
          e.id === entryId
            ? { ...e, parkingLocation }
            : e
        );
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        
        // Recargar y ordenar por mas reciente primero
        updated.sort((a, b) => b.timestamp - a.timestamp);
        const grouped = groupLicensePlates(updated);
        setGrouped(grouped);
        
        // Actualizar selectedPlate con datos nuevos
        if (selectedPlate) {
          const updatedGrouped = grouped.find(g => g.licensePlate === selectedPlate.licensePlate);
          if (updatedGrouped) {
            setSelectedPlate(updatedGrouped);
          }
        }

        if (Platform.OS !== "web") {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    } catch (error) {
      console.error("Error al actualizar ubicación:", error);
    }
  }

  async function saveEditedPlate() {
    if (!editingPlateId || !editingText.trim()) return;

    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const entries: LicensePlateEntry[] = JSON.parse(data);
        const updated = entries.map((e) =>
          e.id === editingPlateId
            ? { ...e, licensePlate: editingText.toUpperCase(), parkingLocation: editingParkingLocation }
            : e
        );
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        
        // Recargar y ordenar por mas reciente primero
        updated.sort((a, b) => b.timestamp - a.timestamp);
        const grouped = groupLicensePlates(updated);
        setGrouped(grouped);
        
        // Cerrar vista de detalle y volver a lista principal
        setSelectedPlate(null);

        setEditingPlateId(null);
        setEditingText("");
        setEditingParkingLocation(null);
      }
    } catch (error) {
      console.error("Error al editar matrícula:", error);
      alert("Error al editar la matrícula");
    }
  }

  async function deleteDetection(entryId: string) {
    Alert.alert(
      "Eliminar Detección",
      "¿Estás seguro de que deseas eliminar esta detección?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const data = await AsyncStorage.getItem(STORAGE_KEY);
              if (data) {
                const entries: LicensePlateEntry[] = JSON.parse(data);
                const filtered = entries.filter((e) => e.id !== entryId);
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

                // Recargar
                filtered.sort((a, b) => b.timestamp - a.timestamp);
                const newGrouped = groupLicensePlates(filtered);
                setGrouped(newGrouped);

                // Actualizar selectedPlate si es necesario
                if (selectedPlate) {
                  const updatedPlate = newGrouped.find(
                    (g) => g.licensePlate === selectedPlate.licensePlate
                  );
                  if (updatedPlate) {
                    setSelectedPlate(updatedPlate);
                  } else {
                    setSelectedPlate(null);
                  }
                }

                addAlert("Detección eliminada correctamente", "success");
              }
            } catch (error) {
              console.error("Error al eliminar detección:", error);
              addAlert("Error al eliminar la detección", "error");
            }
          },
        },
      ]
    );
  }

  async function deleteSelectedEntries() {
    if (selectedForDeletion.size === 0) return;

    const count = selectedForDeletion.size;
    Alert.alert(
      "Eliminar Matrículas",
      `¿Estás seguro de que deseas eliminar ${count} matr${count > 1 ? "ículas" : "ícula"}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const data = await AsyncStorage.getItem(STORAGE_KEY);
              if (data) {
                const entries: LicensePlateEntry[] = JSON.parse(data);
                const filtered = entries.filter(
                  (e) => !selectedForDeletion.has(e.licensePlate.toUpperCase())
                );
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

                // Recargar
                filtered.sort((a, b) => b.timestamp - a.timestamp);
                const newGrouped = groupLicensePlates(filtered);
                setGrouped(newGrouped);

                setIsSelectionMode(false);
                setSelectedForDeletion(new Set());
                addAlert(`${count} matr${count > 1 ? "ículas" : "ícula"} eliminadas correctamente`, "success");
              }
            } catch (error) {
              console.error("Error al eliminar matrículas:", error);
              addAlert("Error al eliminar las matrículas", "error");
            }
          },
        },
      ]
    );
  }

  async function exportCSV() {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (!data) {
        addAlert("No hay datos para exportar", "info");
        return;
      }

      const entries: LicensePlateEntry[] = JSON.parse(data);
      let csvContent = "MATRÍCULA,FECHA,HORA,LATITUD/LONGITUD,LUGAR\n";

      entries.forEach((entry) => {
        const date = new Date(entry.timestamp);
        const dateStr = date.toLocaleDateString("es-ES");
        const timeStr = date.toLocaleTimeString("es-ES");
        const locationStr =
          entry.location === "NO GPS"
            ? "NO GPS"
            : `${entry.location?.latitude},${entry.location?.longitude}`;
        
        const lugarCode = entry.parkingLocation === "acera"
          ? "AC"
          : entry.parkingLocation === "doble_fila"
          ? "DF"
          : "SD";

        csvContent += `${entry.licensePlate},${dateStr},${timeStr},${locationStr},${lugarCode}\n`;
      });

      const tempPath = `${FileSystem.cacheDirectory}matrículas_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(tempPath, csvContent);

      // Compartir
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        addAlert("La función de compartir no está disponible en este dispositivo", "info");
        return;
      }

      await Sharing.shareAsync(tempPath, {
        mimeType: "text/csv",
        dialogTitle: "Exportar Matrículas",
      });
    } catch (error) {
      console.error("Error al exportar CSV:", error);
      addAlert("Error al exportar el archivo", "error");
    }
  }

  // Renderizar contenido basado en estado
  const renderContent = () => {
    if (isLoading) {
      return (
        <ScreenContainer className="items-center justify-center">
          <Text className="text-foreground">Cargando historial...</Text>
        </ScreenContainer>
      );
    }

    // Modal para editar matrícula
    if (editingPlateId) {
      return (
        <Modal transparent animationType="fade">
          <Pressable
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              justifyContent: "center",
              alignItems: "center",
            }}
            onPress={() => {
              setEditingPlateId(null);
              setEditingText("");
              setEditingParkingLocation(null);
            }}
          >
            <Animated.View
              style={{
                transform: [{ translateY: offsetAnim }],
                width: "100%",
                paddingHorizontal: 16,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Pressable
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  padding: 24,
                  width: "100%",
                  maxWidth: 400,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8,
                }}
                onPress={(e) => e.stopPropagation()}
              >
                <View className="gap-4">
              <Text className="text-xl font-bold text-foreground">Editar Matrícula</Text>
              
              <TextInput
                ref={editingTextInputRef}
                value={editingText}
                onChangeText={setEditingText}
                onFocus={() => editingTextInputRef.current?.setSelection(0, editingText.length)}
                placeholder="Matrícula"
                className="border border-border rounded-lg p-3 text-foreground text-center text-lg font-bold"
                placeholderTextColor="#999"
                autoCapitalize="characters"
              />

              <View className="gap-3">
                <Text className="text-sm text-muted">Ubicación de estacionamiento</Text>
                
                <TouchableOpacity
                  onPress={() => setEditingParkingLocation("acera")}
                  className="flex-row items-center gap-3 p-3"
                >
                  <View
                    className={`w-6 h-6 rounded-full border-2 ${
                      editingParkingLocation === "acera" ? "border-primary bg-primary" : "border-border"
                    }`}
                  />
                  <Text className="text-foreground">En la acera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setEditingParkingLocation("doble_fila")}
                  className="flex-row items-center gap-3 p-3"
                >
                  <View
                    className={`w-6 h-6 rounded-full border-2 ${
                      editingParkingLocation === "doble_fila" ? "border-primary bg-primary" : "border-border"
                    }`}
                  />
                  <Text className="text-foreground">En doble fila</Text>
                </TouchableOpacity>
              </View>

              <View className="flex-row gap-3 mt-4">
                <TouchableOpacity
                  onPress={() => {
                    setEditingPlateId(null);
                    setEditingText("");
                    setEditingParkingLocation(null);
                  }}
                  className="flex-1 p-3 rounded-lg border border-border items-center"
                >
                  <Text className="text-foreground font-semibold">Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={saveEditedPlate}
                  className="flex-1 p-3 rounded-lg bg-primary items-center"
                >
                  <Text className="text-white font-semibold">Guardar</Text>
                </TouchableOpacity>
              </View>
              </View>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>
      );
    }

    // Vista de detalle de matrícula
    if (selectedPlate) {
      return (
        <ScreenContainer className="flex-1 p-6">
          <View className="flex-1 gap-4">
            {/* Encabezado */}
            <TouchableOpacity onPress={() => setSelectedPlate(null)} className="mb-2">
              <Text className="text-primary font-semibold">← Volver</Text>
            </TouchableOpacity>

            <View>
              <TouchableOpacity onPress={() => startEditingPlate(selectedPlate.entries[0])}>
                <Text
                  className="text-4xl font-bold text-foreground"
                  style={{ fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }}
                >
                  {selectedPlate.licensePlate}
                </Text>
              </TouchableOpacity>
              <Text className="text-base text-muted mt-1">
                {selectedPlate.count} detecciones
              </Text>
            </View>

            {/* Lista de detecciones */}
            <FlatList
              data={selectedPlate.entries}
              renderItem={({ item, index }) => {
                const date = new Date(item.timestamp);
                const locationStr =
                  item.location === "NO GPS"
                    ? "NO GPS"
                    : `${item.location?.latitude.toFixed(4)}, ${item.location?.longitude.toFixed(4)}`;

                return (
                  <View className="bg-surface rounded-2xl p-4 mb-3 border border-border">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="font-semibold text-foreground">Detección #{selectedPlate.entries.length - index}</Text>
                      <TouchableOpacity
                        onPress={() => deleteDetection(item.id)}
                        className="bg-error p-2 rounded-full"
                      >
                        <MaterialIcons name="close" size={16} color="white" />
                      </TouchableOpacity>
                    </View>

                    <View className="gap-2">
                      <View>
                        <Text className="text-xs text-muted">Fecha y Hora</Text>
                        <Text className="text-sm text-foreground">
                          {date.toLocaleDateString("es-ES")} {date.toLocaleTimeString("es-ES")}
                        </Text>
                      </View>

                      <View>
                        <Text className="text-xs text-muted">Ubicación</Text>
                        <View className="flex-row items-center gap-2 mt-1">
                          <TouchableOpacity onPress={() => openMap(item.location)}>
                            <View className="flex-row items-center gap-2">
                              <MaterialIcons name="location-on" size={16} color="#0066CC" />
                              <Text className="text-sm text-primary font-bold">{locationStr}</Text>
                            </View>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => editLocationOnMap(item.id, item.location)}
                            className="ml-2 p-2"
                          >
                            <MaterialIcons name="edit" size={18} color="#0066CC" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Radio buttons para ubicación de estacionamiento */}
                      <View className="gap-2 mt-2">
                        <Text className="text-xs text-muted">Ubicación de estacionamiento</Text>
                        
                        <TouchableOpacity
                          onPress={() => updateParkingLocation(item.id, "acera")}
                          className="flex-row items-center justify-between p-2"
                        >
                          <Text className="text-sm text-foreground">En la acera</Text>
                          <View
                            className={`w-5 h-5 rounded-full border-2 ${
                              item.parkingLocation === "acera" ? "border-primary bg-primary" : "border-border"
                            }`}
                          />
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => updateParkingLocation(item.id, "doble_fila")}
                          className="flex-row items-center justify-between p-2"
                        >
                          <Text className="text-sm text-foreground">En doble fila</Text>
                          <View
                            className={`w-5 h-5 rounded-full border-2 ${
                              item.parkingLocation === "doble_fila" ? "border-primary bg-primary" : "border-border"
                            }`}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              }}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
            />
          </View>
        </ScreenContainer>
      );
    }

    // Vista principal de historial
    const filteredGrouped = grouped.filter((item) =>
      item.licensePlate.toUpperCase().includes(searchQuery.toUpperCase())
    );

    return (
      <ScreenContainer className="flex-1 p-4">
        <View className="flex-1 gap-4">
          {/* Encabezado */}
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
                <Text className="text-2xl font-bold text-foreground">Historial</Text>
              {isSelectionMode && (
                <TouchableOpacity
                  onPress={() => {
                    setIsSelectionMode(false);
                    setSelectedForDeletion(new Set());
                  }}
                  className="px-3 py-1 rounded-full bg-error/10"
                >
                  <Text className="text-error text-xs font-semibold">Cancelar</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Barra de búsqueda */}
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar matrícula..."
              className="border border-border rounded-lg p-3 text-foreground"
              placeholderTextColor="#999"
            />
          </View>

          {/* Botones de acción */}
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={exportCSV}
              className="flex-1 bg-primary p-3 rounded-lg items-center"
            >
              <Text className="text-white font-semibold">Exportar CSV</Text>
            </TouchableOpacity>

            {isSelectionMode && (
              <TouchableOpacity
                onPress={deleteSelectedEntries}
                className="flex-1 bg-error p-3 rounded-lg items-center"
              >
                <Text className="text-white font-semibold">Eliminar</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Lista de matrículas */}
          {filteredGrouped.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-muted">No hay matrículas registradas</Text>
            </View>
          ) : (
            <FlatList
              data={filteredGrouped}
              renderItem={({ item }) => {
                const lastDate = new Date(item.lastSeen);
                const dateStr = lastDate.toLocaleDateString("es-ES");
                const timeStr = lastDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
                
                const parkingLabel = item.parkingLocation === "acera"
                  ? "ACERA"
                  : item.parkingLocation === "doble_fila"
                  ? "DOBLE FILA"
                  : "Sin definir";

                return (
                  <TouchableOpacity
                    onPress={() => setSelectedPlate(item)}
                    onLongPress={() => handleLongPress(item.licensePlate)}
                    className={`flex-row items-center justify-between p-4 rounded-lg mb-2 border ${
                      selectedForDeletion.has(item.licensePlate)
                        ? "bg-error/10 border-error"
                        : "bg-surface border-border"
                    }`}
                  >
                    <View className="flex-1">
                      <Text
                        className="text-lg font-bold text-foreground"
                        style={{ fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }}
                      >
                        {item.licensePlate}
                      </Text>
                      <View className="flex-row items-center justify-between mt-1">
                        <Text className="text-sm text-muted">{item.count} detecciones • {dateStr} {timeStr}</Text>
                      </View>
                    </View>

                    <View className="items-end gap-2 ml-2">
                      <Text className={`text-xs font-semibold ${
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
                      {selectedForDeletion.has(item.licensePlate) && (
                        <MaterialIcons name="check" size={20} color="#EF4444" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
              keyExtractor={(item) => item.licensePlate}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </ScreenContainer>
    );
  };

  // Renderizar con fragmento para siempre incluir GPSEditorModal y AlertsOverlay en nivel superior
  return (
    <>
      {renderContent()}

      {/* GPS Editor Modal - Siempre renderizado en nivel superior */}
      <GPSEditorModal
        visible={gpsEditorVisible}
        currentLatitude={gpsEditingLocation?.latitude || 0}
        currentLongitude={gpsEditingLocation?.longitude || 0}
        onClose={() => {
          setGpsEditorVisible(false);
          setGpsEditingId(null);
          setGpsEditingLocation(null);
        }}
        onSave={handleGpsSave}
      />

      {/* Alertas - Siempre renderizadas en nivel superior */}
      <AlertsOverlay alerts={alerts} onRemoveAlert={removeAlert} />
    </>
  );
}
