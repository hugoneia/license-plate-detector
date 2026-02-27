import { useState, useCallback } from "react";
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
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { GPSEditorModal } from "@/components/gps-editor-modal";
import type { LicensePlateEntry, GroupedLicensePlate, GeoLocation, ParkingLocation } from "@/types/license-plate";
import { groupLicensePlates } from "@/lib/grouping";

const STORAGE_KEY = "license_plates";

export default function HistoryScreen() {
  const router = useRouter();
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
      Alert.alert("Sin ubicación", "Esta detección no tiene datos de GPS");
      return;
    }

    const { latitude, longitude } = location as GeoLocation;
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

    Linking.openURL(url).catch(() => {
      Alert.alert("Error", "No se pudo abrir el mapa");
    });
  }

  async function editLocationOnMap(entryId: string, currentLocation: GeoLocation | "NO GPS" | undefined) {
    if (!currentLocation || currentLocation === "NO GPS") {
      Alert.alert("Sin ubicación", "Esta detección no tiene datos de GPS");
      return;
    }

    const location = currentLocation as GeoLocation;
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

        Alert.alert("Éxito", "Ubicación actualizada correctamente");
      }
    } catch (error) {
      console.error("Error:", error);
      Alert.alert("Error", "No se pudo actualizar la ubicación");
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

        if (Platform.OS !== "web") {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
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

                if (Platform.OS !== "web") {
                  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
              }
            } catch (error) {
              console.error("Error al eliminar detección:", error);
              alert("Error al eliminar la detección");
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
                setSelectedForDeletion(new Set());
                setIsSelectionMode(false);

                if (Platform.OS !== "web") {
                  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
              }
            } catch (error) {
              console.error("Error al eliminar entradas:", error);
              alert("Error al eliminar las matrículas");
            }
          },
        },
      ]
    );
  }

  async function deleteEntry(licensePlate: string) {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    Alert.alert(
      "Eliminar Matrícula",
      `¿Estás seguro de que deseas eliminar todas las detecciones de ${licensePlate}?`,
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
                  (e) => e.licensePlate.toUpperCase() !== licensePlate.toUpperCase()
                );
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

                // Recargar
                filtered.sort((a, b) => b.timestamp - a.timestamp);
                const newGrouped = groupLicensePlates(filtered);
                setGrouped(newGrouped);
                setSelectedPlate(null);

                if (Platform.OS !== "web") {
                  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
              }
            } catch (error) {
              console.error("Error al eliminar entrada:", error);
              alert("Error al eliminar la matrícula");
            }
          },
        },
      ]
    );
  }

  async function exportCSV() {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (!data) {
        alert("No hay matrículas guardadas para exportar");
        return;
      }

      const entries: LicensePlateEntry[] = JSON.parse(data);

      // Generar CSV con encabezados
      let csvContent = "MATRÍCULA,FECHA,HORA,LATITUD/LONGITUD,LUGAR\n";

      entries.forEach((entry) => {
        const date = new Date(entry.timestamp);
        const dateStr = date.toLocaleDateString("es-ES");
        const timeStr = date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

        let locationStr = "NO GPS";
        if (entry.location && entry.location !== "NO GPS") {
          const lat = entry.location.latitude.toFixed(5);
          const lng = entry.location.longitude.toFixed(5);
          locationStr = `${lat},${lng}`;
        }

        // Mapear ubicación de estacionamiento a código
        let lugarCode = "SD"; // Sin definir por defecto
        if (entry.parkingLocation === "acera") {
          lugarCode = "AC";
        } else if (entry.parkingLocation === "doble_fila") {
          lugarCode = "DF";
        }

        // Escapar comillas en matrícula si es necesario
        const plate = entry.licensePlate.includes(",")
          ? `"${entry.licensePlate}"`
          : entry.licensePlate;

        csvContent += `${plate},${dateStr},${timeStr},${locationStr},${lugarCode}\n`;
      });

      // Guardar en archivo temporal
      const filename = `matriculas_${Date.now()}.csv`;
      const tempPath = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(tempPath, csvContent);

      // Compartir
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        alert("La función de compartir no está disponible en este dispositivo");
        return;
      }

      await Sharing.shareAsync(tempPath, {
        mimeType: "text/csv",
        dialogTitle: "Exportar Matrículas",
      });

      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Error al exportar CSV:", error);
      alert("Error al exportar el archivo");
    }
  }

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
        <View className="flex-1 bg-black/50 items-center justify-center p-4">
          <View className="bg-surface rounded-2xl p-6 w-full max-w-sm gap-4">
            <Text className="text-xl font-bold text-foreground">Editar Matrícula</Text>
            
            <TextInput
              value={editingText}
              onChangeText={setEditingText}
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
        </View>
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
                    <Text className="font-semibold text-foreground">Detección #{index + 1}</Text>
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

      {/* GPS Editor Modal */}
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
    </ScreenContainer>
  );
}
