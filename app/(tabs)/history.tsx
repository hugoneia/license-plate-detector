import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import { Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
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
  Animated,
  Pressable,
  KeyboardAvoidingView,
  ToastAndroid,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { GPSEditorModal } from "@/components/gps-editor-modal";
import { QuickEntryModal } from "@/components/quick-entry-modal";
import { AlertsOverlay } from "@/components/alerts-overlay";
import type {
  LicensePlateEntry,
  GroupedLicensePlate,
  GeoLocation,
  ParkingLocation,
} from "@/types/license-plate";
import {
  PARKING_TYPE_LIST,
  getParkingType,
} from "@/constants/parking-types";
import { groupLicensePlates } from "@/lib/grouping";
import { useAlerts } from "@/hooks/use-alerts";
import { useColors } from "@/hooks/use-colors";
import { useBackHandler } from "@/hooks/use-back-handler";
import { usePlates } from "@/lib/plate-context";
import { useGeolocation } from "@/hooks/use-geolocation";

const HISTORY_DATE_FILTER_KEY = "history_date_filter";

export default function HistoryScreen() {
  const {
    plates,
    isLoading: contextLoading,
    addPlate,
    updatePlate,
    deletePlate,
    deleteMultiplePlates,
  } = usePlates();

  const { getCurrentLocation } = useGeolocation();
  const router = useRouter();
  const { alerts, addAlert, removeAlert } = useAlerts();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState("");
  const isLoading = contextLoading;

  const [selectedPlate, setSelectedPlate] =
    useState<GroupedLicensePlate | null>(null);

  const [selectedForDeletion, setSelectedForDeletion] =
    useState<Set<string>>(new Set());

  const [highlightedEntryId, setHighlightedEntryId] =
    useState<string | null>(null);

  const [highlightOnReturnEntryId, setHighlightOnReturnEntryId] =
    useState<string | null>(null);

  const duplicateHighlightAnim =
    useRef(new Animated.Value(0)).current;

  const [deletingForDeletion, setDeletingForDeletion] =
    useState<Set<string>>(new Set());

  const deletionFadeAnim =
    useRef(new Animated.Value(1)).current;

  const grouped = useMemo(() => {
    const sorted = [...plates].sort((a, b) => b.timestamp - a.timestamp);
    return groupLicensePlates(sorted, true);
  }, [plates]);

  useEffect(() => {
    if (selectedPlate || !highlightOnReturnEntryId) {
      return;
    }

    const entryId = highlightOnReturnEntryId;

    const existsInGrouped = grouped.some((group) =>
      group.entries.some(
        (entry) => entry.id === entryId
      )
    );

    if (!existsInGrouped) {
      setHighlightOnReturnEntryId(null);
      return;
    }

    setHighlightOnReturnEntryId(null);

    requestAnimationFrame(() => {
      animateDuplicateHighlight(entryId);
    });
  }, [grouped, selectedPlate, highlightOnReturnEntryId]);

  // Sincronizar selectedPlate con los cambios en la lista global usando un ID estable
  useEffect(() => {
    if (selectedPlate) {
      const selectedEntryId = selectedPlate.entries[0]?.id;

      const updatedSelected = selectedEntryId
        ? grouped.find((g) =>
            g.entries.some((entry) => entry.id === selectedEntryId)
          )
        : null;

      if (updatedSelected) {
        setSelectedPlate(updatedSelected);
      } else {
        setSelectedPlate(null);
      }
    }
  }, [grouped]);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [editingPlateId, setEditingPlateId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingParkingLocation, setEditingParkingLocation] =
    useState<ParkingLocation>(null);

  const [parkingEditorVisible, setParkingEditorVisible] =
    useState(false);
  const [parkingEditingId, setParkingEditingId] =
    useState<string | null>(null);

  const [tempParkingLocations, setTempParkingLocations] = useState<
    Map<string, ParkingLocation>
  >(new Map());

  const [gpsEditorVisible, setGpsEditorVisible] = useState(false);
  const [gpsEditingId, setGpsEditingId] = useState<string | null>(null);
  const [gpsEditingLocation, setGpsEditingLocation] =
    useState<GeoLocation | null>(null);

  const [dateEditorVisible, setDateEditorVisible] = useState(false);
  const [dateEditingId, setDateEditingId] = useState<string | null>(null);
  const [dateEditingValue, setDateEditingValue] = useState("");
  const [dateEditingError, setDateEditingError] = useState(false);

  const [isQuickEntryVisible, setIsQuickEntryVisible] = useState(false);
  const [quickEntryPlate, setQuickEntryPlate] = useState("");
  const [quickEntryLoading, setQuickEntryLoading] = useState(false);

  const quickEntryProcessingRef = useRef(false);

  const [capturedLocation, setCapturedLocation] =
    useState<GeoLocation | null>(null);

  const [filterStartDate, setFilterStartDate] = useState<Date | null>(null);
  const [filterEndDate, setFilterEndDate] = useState<Date | null>(null);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const editingTextInputRef = useRef<TextInput>(null);
  const offsetAnim = useRef(new Animated.Value(0)).current;
  const dateInputRef = useRef<TextInput>(null);
  const suppressNextPlatePressRef = useRef(false);

  // Tipos que pueden seleccionarse manualmente.
  // El catálogo es la única fuente de verdad.
  const selectableParkingTypes = PARKING_TYPE_LIST.filter(
    (type) => type.selectable
  );

  // Determinar si hay filtro activo
  const isFilterActive =
    filterStartDate !== null || filterEndDate !== null;

  // Manejar botón de atrás: cerrar detalle antes de cambiar de pestaña
  const handleBackPress = useCallback(() => {
    if (selectedPlate) {
      handleDetailBack();
      return true;
    }

    return false;
  }, [selectedPlate]);

  useBackHandler(handleBackPress);

  // Mantener búsqueda limpia al volver a History,
  // pero conservar el filtro de fechas persistido.
  useFocusEffect(
    useCallback(() => {
      setSearchQuery("");

      const loadHistoryDateFilter = async () => {
        try {
          const stored = await AsyncStorage.getItem(
            HISTORY_DATE_FILTER_KEY
          );

          if (!stored) {
            setFilterStartDate(null);
            setFilterEndDate(null);
            return;
          }

          const parsed = JSON.parse(stored);

          setFilterStartDate(
            parsed.startDate
              ? new Date(parsed.startDate)
              : null
          );

          setFilterEndDate(
            parsed.endDate
              ? new Date(parsed.endDate)
              : null
          );
        } catch (error) {
          console.error(
            "Error al cargar el filtro de fechas:",
            error
          );
        }
      };

      loadHistoryDateFilter();
    }, [])
  );

  function getRecidivismColor(
    detectionsCount: number,
    maxDetections: number
  ): string {
    if (maxDetections <= 1) return "#00C851";

    const percentage = (detectionsCount / maxDetections) * 100;

    if (percentage > 66) return "#FF4444";
    if (percentage >= 33) return "#FFBB33";

    return "#00C851";
  }

  async function openMap(
    location: GeoLocation | "NO GPS" | undefined,
    plate?: string
  ) {
    // Si hay ubicación válida, abrirla directamente
    if (
      location &&
      location !== "NO GPS" &&
      location.latitude
    ) {
      const { latitude, longitude } = location;
      const plateLabel = plate || "Vehículo";

      const scheme =
        Platform.OS === "ios"
          ? "maps:0,0?q="
          : "geo:0,0?q=";

      const latLng = `${latitude},${longitude}`;

      const url = Platform.select({
        ios: `${scheme}${plateLabel}@${latLng}&z=21`,
        android: `${scheme}${latLng}(${plateLabel})?z=21`,
      });

      if (url) {
        Linking.openURL(url).catch(() => {
          addAlert(
            "No se pudo abrir la aplicación de mapas",
            "error"
          );
        });
      }

      return;
    }

    // Si es "NO GPS", buscar última ubicación registrada
    // sin obtener en tiempo real
    if (grouped.length > 0) {
      for (const group of grouped) {
        for (let i = group.entries.length - 1; i >= 0; i--) {
          const entry = group.entries[i];

          if (
            entry.location &&
            entry.location !== "NO GPS" &&
            typeof entry.location === "object" &&
            entry.location.latitude
          ) {
            const { latitude, longitude } = entry.location;
            const plateLabel =
              plate || "Última Ubicación Registrada";

            const scheme =
              Platform.OS === "ios"
                ? "maps:0,0?q="
                : "geo:0,0?q=";

            const latLng = `${latitude},${longitude}`;

            const url = Platform.select({
              ios: `${scheme}${plateLabel}@${latLng}&z=21`,
              android: `${scheme}${latLng}(${plateLabel})?z=21`,
            });

            if (url) {
              Linking.openURL(url).catch(() => {
                addAlert(
                  "No se pudo abrir la aplicación de mapas",
                  "error"
                );
              });
            }

            return;
          }
        }
      }
    }

    addAlert(
      "No hay ubicación disponible. Registra una detección con coordenadas.",
      "info"
    );
  }

  async function editLocationOnMap(
    entryId: string,
    currentLocation: GeoLocation | "NO GPS" | undefined
  ) {
    const location =
      currentLocation && currentLocation !== "NO GPS"
        ? (currentLocation as GeoLocation)
        : null;

    setGpsEditingId(entryId);
    setGpsEditingLocation(location);
    setGpsEditorVisible(true);
  }

  async function handleGpsSave(
    latitude: number,
    longitude: number
  ) {
    if (!gpsEditingId) return;

    try {
      await updatePlate(gpsEditingId, {
        location: {
          latitude,
          longitude,
        },
      });

      markEditedEntry(gpsEditingId);

      addAlert(
        "Ubicación actualizada correctamente",
        "success"
      );
    } catch (error) {
      console.error("Error:", error);

      addAlert(
        "No se pudo actualizar la ubicación",
        "error"
      );
    }
  }

  function openDateEditor(
    entryId: string,
    currentTimestamp: number
  ) {
    const date = new Date(currentTimestamp);
    const dateStr = date.toISOString().split("T")[0];
    const timeStr = date.toTimeString().split(" ")[0];

    setDateEditingId(entryId);
    setDateEditingValue(`${dateStr} ${timeStr}`);
    setDateEditorVisible(true);
  }

  async function handleDateSave() {
    if (!dateEditingId || !dateEditingValue) {
      return;
    }

    const value = dateEditingValue.trim();

    // El formato debe ser exactamente:
    // YYYY-MM-DD HH:mm:ss
    const match = value.match(
      /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
    );

    if (!match) {
      setDateEditingError(true);

      addAlert(
        "Formato de fecha inválido. Use: YYYY-MM-DD HH:mm:ss",
        "error"
      );

      return;
    }

    const [
      ,
      yearText,
      monthText,
      dayText,
      hourText,
      minuteText,
      secondText,
    ] = match;

    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const second = Number(secondText);

    // Validación básica de hora.
    if (
      hour > 23 ||
      minute > 59 ||
      second > 59
    ) {
      setDateEditingError(true);

      addAlert(
        "Hora inválida. Use HH:mm:ss",
        "error"
      );

      return;
    }

    // Crear la fecha y comprobar que JavaScript no la ha normalizado.
    const dateObj = new Date(
      year,
      month - 1,
      day,
      hour,
      minute,
      second,
      0
    );

    if (
      dateObj.getFullYear() !== year ||
      dateObj.getMonth() !== month - 1 ||
      dateObj.getDate() !== day ||
      dateObj.getHours() !== hour ||
      dateObj.getMinutes() !== minute ||
      dateObj.getSeconds() !== second
    ) {
      setDateEditingError(true);

      addAlert(
        "La fecha introducida no es válida",
        "error"
      );

      return;
    }

    try {
      const newTimestamp = dateObj.getTime();

      await updatePlate(dateEditingId, {
        timestamp: newTimestamp,
      });

      markEditedEntry(dateEditingId);

      setDateEditingError(false);

      addAlert(
        "Fecha y hora actualizadas",
        "success"
      );

      setDateEditorVisible(false);
    } catch (error) {
      console.error(
        "Error al actualizar fecha:",
        error
      );

      addAlert(
        "Error al actualizar fecha y hora",
        "error"
      );
    }
  }

  function markEditedEntry(entryId: string) {
    setHighlightOnReturnEntryId(entryId);
    animateDuplicateHighlight(entryId);
  }

  function handleDetailBack() {
    setSelectedPlate(null);
  }

  function animateDuplicateHighlight(
    entryId: string
  ) {
    duplicateHighlightAnim.stopAnimation();

    setHighlightedEntryId(entryId);
    duplicateHighlightAnim.setValue(0);

    Animated.sequence([
      Animated.timing(duplicateHighlightAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(duplicateHighlightAnim, {
        toValue: 0,
        duration: 1400,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setHighlightedEntryId(null);
      }
    });
  }

  function handleLongPress(licensePlate: string) {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(
        Haptics.ImpactFeedbackStyle.Medium
      );
    }

    setIsSelectionMode(true);

    const newSelected = new Set(
      selectedForDeletion
    );

    if (newSelected.has(licensePlate)) {
      newSelected.delete(licensePlate);
    } else {
      newSelected.add(licensePlate);
    }

    setSelectedForDeletion(newSelected);
  }

  async function copySelectedPlate() {
    const plate = selectedPlate?.licensePlate?.trim();

    if (!plate) {
      return;
    }

    suppressNextPlatePressRef.current = true;

    try {
      await Clipboard.setStringAsync(plate);

      if (Platform.OS === "android") {
        ToastAndroid.show(
          "Matrícula copiada",
          ToastAndroid.SHORT,
        );
      }
    } catch (error) {
      console.error("Error al copiar la matrícula:", error);
      Alert.alert(
        "Error",
        "No se pudo copiar la matrícula al portapapeles.",
      );
    }

    setTimeout(() => {
      suppressNextPlatePressRef.current = false;
    }, 800);
  }

  function startEditingPlate(
    entry: LicensePlateEntry
  ) {
    setEditingPlateId(entry.id);
    setEditingText(entry.licensePlate);
    setEditingParkingLocation(
      entry.parkingLocation || null
    );
  }

  async function updateParkingLocation(
    entryId: string,
    parkingLocation: ParkingLocation
  ) {
    try {
      await updatePlate(entryId, {
        parkingLocation,
      });
    } catch (error) {
      console.error(
        "Error al actualizar ubicación:",
        error
      );

      return false;
    }

    if (Platform.OS !== "web") {
      try {
        await Haptics.impactAsync(
          Haptics.ImpactFeedbackStyle.Light
        );
      } catch (error) {
        console.error(
          "Error al ejecutar vibración:",
          error
        );
      }
    }

    return true;
  }

  function openParkingEditor(entry: LicensePlateEntry) {
    setParkingEditingId(entry.id);
    setEditingParkingLocation(
      entry.parkingLocation || null
    );
    setParkingEditorVisible(true);
  }

  function closeParkingEditor() {
    setParkingEditorVisible(false);
    setParkingEditingId(null);
    setEditingParkingLocation(null);
  }

  async function saveParkingEditor() {
    if (!parkingEditingId || !editingParkingLocation) {
      return;
    }

    const updated = await updateParkingLocation(
      parkingEditingId,
      editingParkingLocation
    );

    if (updated) {
      markEditedEntry(parkingEditingId);
      closeParkingEditor();
    }
  }

  async function saveEditedPlate() {
    if (
      !editingPlateId ||
      !editingText.trim()
    ) {
      return;
    }

    if (
      !/^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/i.test(
        editingText.trim()
      )
    ) {
      addAlert(
        "Formato de matrícula española inválido",
        "error"
      );

      return;
    }

    try {
      await updatePlate(editingPlateId, {
        licensePlate:
          editingText.toUpperCase(),
        parkingLocation:
          editingParkingLocation,
      });

      markEditedEntry(editingPlateId);

      setEditingPlateId(null);
      setEditingText("");
      setEditingParkingLocation(null);

      addAlert(
        "Matrícula actualizada correctamente",
        "success"
      );
    } catch (error) {
      console.error(
        "Error al editar matrícula:",
        error
      );

      addAlert(
        "Error al editar la matrícula",
        "error"
      );
    }
  }

  async function duplicateRecord(
    plate: GroupedLicensePlate
  ) {
    try {
      if (
        !plate ||
        !plate.entries ||
        plate.entries.length === 0
      ) {
        return;
      }

      const firstEntry = plate.entries[0];

      const newEntry: LicensePlateEntry = {
        id: `${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`,

        licensePlate:
          firstEntry.licensePlate,

        timestamp: Date.now(),

        location:
          firstEntry.location,

        parkingLocation:
          firstEntry.parkingLocation,

        confidence:
          firstEntry.confidence || "high",
      };

      await addPlate(newEntry);

      animateDuplicateHighlight(
        newEntry.id
      );

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      }

      addAlert(
        "Registro duplicado con éxito",
        "success"
      );
    } catch (error) {
      console.error(
        "Error al duplicar registro:",
        error
      );

      addAlert(
        "Error al duplicar el registro",
        "error"
      );
    }
  }

  async function deleteDetection(
    entryId: string
  ) {
    Alert.alert(
      "Eliminar Detección",
      "¿Estás seguro de que deseas eliminar esta detección?",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePlate(entryId);

              setSelectedPlate(null);
              setSearchQuery("");

              addAlert(
                "Detección eliminada correctamente",
                "success"
              );
            } catch (error) {
              console.error(
                "Error al eliminar detección:",
                error
              );

              addAlert(
                "Error al eliminar la detección",
                "error"
              );
            }
          },
        },
      ]
    );
  }

  async function deleteSelectedEntries() {
    if (selectedForDeletion.size === 0) {
      return;
    }

    const count =
      selectedForDeletion.size;

    Alert.alert(
      "Eliminar Matrículas",
      `¿Estás seguro de que deseas eliminar ${count} matr${
        count > 1 ? "ículas" : "ícula"
      }?`,
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            const selectedPlates =
              new Set(
                Array.from(selectedForDeletion).map(
                  (plate) => plate.toUpperCase()
                )
              );

            const idsToDelete = plates
              .filter((entry) =>
                selectedPlates.has(
                  entry.licensePlate.toUpperCase()
                )
              )
              .map((entry) => entry.id);

            if (idsToDelete.length === 0) {
              return;
            }

            setDeletingForDeletion(
              new Set(selectedPlates)
            );

            deletionFadeAnim.setValue(1);

            Animated.timing(deletionFadeAnim, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }).start(({ finished }) => {
              if (!finished) {
                return;
              }

              void (async () => {
                try {
                  await deleteMultiplePlates(
                    idsToDelete
                  );

                  setIsSelectionMode(false);
                  setSelectedForDeletion(
                    new Set()
                  );
                  setDeletingForDeletion(
                    new Set()
                  );
                  setSearchQuery("");
                  deletionFadeAnim.setValue(1);

                  addAlert(
                    `${count} matr${
                      count > 1
                        ? "ículas"
                        : "ícula"
                    } eliminadas correctamente`,
                    "success"
                  );
                } catch (error) {
                  console.error(
                    "Error al eliminar matrículas:",
                    error
                  );

                  setDeletingForDeletion(
                    new Set()
                  );
                  deletionFadeAnim.setValue(1);

                  addAlert(
                    "Error al eliminar las matrículas",
                    "error"
                  );
                }
              })();
            });
          },
        },
      ]
    );
  }

  async function exportCSV() {
    try {
      if (plates.length === 0) {
        addAlert(
          "No hay datos para exportar",
          "info"
        );

        return;
      }

      let csvContent =
        "MATRÍCULA,FECHA,HORA,LATITUD/LONGITUD,LUGAR\n";

      plates.forEach((entry) => {
        const date = new Date(
          entry.timestamp
        );

        const dateStr =
          date.toLocaleDateString("es-ES");

        const timeStr =
          date.toLocaleTimeString("es-ES");

        const locationStr =
          entry.location === "NO GPS"
            ? "NO GPS"
            : `${entry.location?.latitude},${entry.location?.longitude}`;

        // El código procede del catálogo central.
        const parkingType = getParkingType(
          entry.parkingLocation
        );

        const lugarCode =
          parkingType.code;

        csvContent +=
          `${entry.licensePlate},${dateStr},${timeStr},${locationStr},${lugarCode}\n`;
      });

      const tempPath =
        `${FileSystem.cacheDirectory}matrículas_${Date.now()}.csv`;

      await FileSystem.writeAsStringAsync(
        tempPath,
        csvContent
      );

      const isAvailable =
        await Sharing.isAvailableAsync();

      if (!isAvailable) {
        addAlert(
          "La función de compartir no está disponible en este dispositivo",
          "info"
        );

        return;
      }

      await Sharing.shareAsync(
        tempPath,
        {
          mimeType: "text/csv",
          dialogTitle:
            "Exportar Matrículas",
        }
      );
    } catch (error) {
      console.error(
        "Error al exportar CSV:",
        error
      );

      addAlert(
        "Error al exportar el archivo",
        "error"
      );
    }
  }

  // Renderizar contenido basado en estado
  const renderContent = () => {
    if (isLoading) {
      return (
        <ScreenContainer className="items-center justify-center">
          <Text className="text-foreground">
            Cargando historial...
          </Text>
        </ScreenContainer>
      );
    }

    // Modal para editar matrícula
    if (editingPlateId) {
      return (
        <Modal transparent animationType="fade">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <Pressable
              style={{
                flex: 1,
                backgroundColor:
                  "rgba(0, 0, 0, 0.5)",
                justifyContent: "center",
                alignItems: "center",
              }}
              onPress={() => {
                setEditingPlateId(null);
                setEditingText("");
                setEditingParkingLocation(
                  null
                );
              }}
            >
              <View
                style={{
                  width: "100%",
                  paddingHorizontal: 16,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
              <Pressable
                style={{
                  backgroundColor:
                    colors.surface,
                  borderRadius: 16,
                  padding: 24,
                  width: "100%",
                  maxWidth: 400,
                  shadowColor: "#000",
                  shadowOffset: {
                    width: 0,
                    height: 4,
                  },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8,
                }}
                onPress={(e) =>
                  e.stopPropagation()
                }
              >
                <View className="gap-4">
                  <Text className="text-xl font-bold text-foreground">
                    Editar Matrícula
                  </Text>

                  <TextInput
                    ref={
                      editingTextInputRef
                    }
                    value={editingText}
                    onChangeText={(text) =>
                      setEditingText(
                        text.toUpperCase()
                      )
                    }
                    onFocus={() =>
                      editingTextInputRef.current?.setSelection(
                        0,
                        editingText.length
                      )
                    }
                    placeholder="Ej: 0000BBB"
                    placeholderTextColor="#999"
                    selectionColor={
                      colors.primary
                    }
                    selectionHandleColor={
                      colors.primary
                    }
                    autoCapitalize="characters"
                    style={{
                      borderWidth: 2,
                      borderColor:
                        editingText.trim() &&
                        !/^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/.test(
                          editingText
                        )
                          ? "#EF4444"
                          : colors.primary,
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 16,
                      fontWeight: "bold",
                      color:
                        colors.foreground,
                      backgroundColor:
                        colors.background,
                      textAlign: "center",
                      marginBottom: 16,
                    }}
                  />

                  <View className="gap-3 mb-4">
                    <Text className="text-sm text-muted">
                      Ubicación de estacionamiento
                    </Text>

                    {selectableParkingTypes.map(
                      (type) => {
                        const selected =
                          editingParkingLocation ===
                          type.id;

                        return (
                          <TouchableOpacity
                            key={type.id}
                            onPress={() =>
                              setEditingParkingLocation(
                                type.id
                              )
                            }
                            className="flex-row items-center gap-3 p-3"
                          >
                            <View
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 12,
                                borderWidth: 2,
                                borderColor:
                                  selected
                                    ? colors.primary
                                    : colors.border,
                                alignItems:
                                  "center",
                                justifyContent:
                                  "center",
                              }}
                            >
                              {selected && (
                                <View
                                  style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: 6,
                                    backgroundColor:
                                      colors.primary,
                                  }}
                                />
                              )}
                            </View>

                            <View
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 5,
                                backgroundColor:
                                  type.color,
                              }}
                            />

                            <Text className="text-foreground">
                              {type.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      }
                    )}
                  </View>

                  <View className="flex-row gap-3 mt-4">
                    <TouchableOpacity
                      onPress={() => {
                        setEditingPlateId(
                          null
                        );
                        setEditingText("");
                        setEditingParkingLocation(
                          null
                        );
                      }}
                      className="flex-1 p-3 rounded-lg border border-border items-center"
                    >
                      <Text className="text-foreground font-semibold">
                        Cancelar
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={
                        saveEditedPlate
                      }
                      disabled={
                        !/^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/i.test(
                          editingText.trim()
                        )
                      }
                      className={`flex-1 p-3 rounded-lg items-center ${
                        !/^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/i.test(
                          editingText.trim()
                        )
                          ? "bg-primary/40 opacity-50"
                          : "bg-primary"
                      }`}
                    >
                      <Text className="text-white font-semibold">
                        Guardar
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Pressable>
            </View>
          </Pressable>
          </KeyboardAvoidingView>
        </Modal>
      );
    }

    // Vista de detalle de matrícula
    if (selectedPlate) {
      return (
        <ScreenContainer className="flex-1 p-6">
          <View className="flex-1 gap-4">
            {/* Encabezado Anclado */}
            <View className="mb-4">
              <TouchableOpacity
                onPress={handleDetailBack}
                className="mb-2"
              >
                <Text className="text-primary font-semibold">
                  ← Volver
                </Text>
              </TouchableOpacity>

              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <TouchableOpacity
                    delayLongPress={500}
                    onLongPress={() => {
                      void copySelectedPlate();
                    }}
                    onPress={() => {
                      if (suppressNextPlatePressRef.current) {
                        suppressNextPlatePressRef.current = false;
                        return;
                      }

                      startEditingPlate(
                        selectedPlate.entries[0]
                      );
                    }}
                  >
                    <Text
                      className="text-4xl font-bold text-foreground"
                      style={{
                        fontFamily:
                          Platform.OS === "ios"
                            ? "Courier"
                            : "monospace",
                      }}
                    >
                      {
                        selectedPlate.licensePlate
                      }
                    </Text>
                  </TouchableOpacity>

                  <Text className="text-base text-muted mt-1">
                    {selectedPlate.count}{" "}
                    {selectedPlate.count === 1
                      ? "detección"
                      : "detecciones"}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() =>
                    duplicateRecord(
                      selectedPlate
                    )
                  }
                  className="p-3 rounded-lg bg-primary/10 mr-3"
                >
                  <MaterialIcons
                    name="content-copy"
                    size={24}
                    color={colors.primary}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    if (
                      Platform.OS !== "web"
                    ) {
                      Haptics.impactAsync(
                        Haptics.ImpactFeedbackStyle.Light
                      );
                    }

                    router.push({
                      pathname:
                        "/plate-map",
                      params: {
                        plate:
                          selectedPlate.licensePlate,
                      },
                    });
                  }}
                  className="p-3 rounded-lg bg-primary/10"
                >
                  <MaterialIcons
                    name="map"
                    size={24}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Lista de detecciones */}
            <FlatList
              data={selectedPlate.entries}
              renderItem={({
                item,
                index,
              }) => {
                const date =
                  new Date(
                    item.timestamp
                  );

                const locationStr =
                  item.location ===
                  "NO GPS"
                    ? "NO GPS"
                    : `${item.location?.latitude.toFixed(
                        4
                      )}, ${item.location?.longitude.toFixed(
                        4
                      )}`;

                const parkingType =
                  getParkingType(
                    item.parkingLocation
                  );

                return (
                  <View className="bg-surface rounded-2xl p-4 mb-3 border border-border">
                    {/* DUPLICATE HIGHLIGHT */}
                    {highlightedEntryId === item.id && (
                      <Animated.View
                        pointerEvents="none"
                        style={{
                          position: "absolute",
                          top: 0,
                          right: 0,
                          bottom: 0,
                          left: 0,
                          borderWidth: 2,
                          borderColor: colors.primary,
                          borderRadius: 16,
                          opacity: duplicateHighlightAnim,
                          zIndex: 10,
                        }}
                      />
                    )}

                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="font-semibold text-foreground">
                        Detección #
                        {selectedPlate.entries.length -
                          index}
                      </Text>

                      <TouchableOpacity
                        onPress={() =>
                          deleteDetection(
                            item.id
                          )
                        }
                        className="bg-error p-2 rounded-full"
                      >
                        <MaterialIcons
                          name="close"
                          size={16}
                          color="white"
                        />
                      </TouchableOpacity>
                    </View>

                    <View className="gap-2">
                      <View>
                        <Text className="text-xs text-muted">
                          Fecha y Hora
                        </Text>

                        <View className="flex-row items-center gap-2 mt-1">
                          <TouchableOpacity
                            onPress={() =>
                              openDateEditor(
                                item.id,
                                item.timestamp
                              )
                            }
                            className="flex-1"
                          >
                            <Text className="text-sm text-primary font-bold">
                              {date.toLocaleDateString(
                                "es-ES"
                              )}{" "}
                              {date.toLocaleTimeString(
                                "es-ES"
                              )}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() =>
                              openDateEditor(
                                item.id,
                                item.timestamp
                              )
                            }
                            className="p-2"
                          >
                            <MaterialIcons
                              name="edit"
                              size={18}
                              color="#0066CC"
                            />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View>
                        <Text className="text-xs text-muted">
                          Ubicación
                        </Text>

                        <View className="flex-row items-center justify-between mt-1">
                          <TouchableOpacity
                            onPress={() =>
                              openMap(
                                item.location,
                                selectedPlate.licensePlate
                              )
                            }
                            className="flex-1"
                          >
                            <View className="flex-row items-center gap-2">
                              <MaterialIcons
                                name="location-on"
                                size={16}
                                color="#0066CC"
                              />

                              <Text className="text-sm text-primary font-bold flex-1">
                                {
                                  locationStr
                                }
                              </Text>
                            </View>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() =>
                              editLocationOnMap(
                                item.id,
                                item.location
                              )
                            }
                            className="p-2"
                          >
                            <MaterialIcons
                              name="edit"
                              size={18}
                              color="#0066CC"
                            />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Ubicación de estacionamiento */}
                      <View className="gap-2 mt-2">
                        <Text className="text-xs text-muted">
                          Ubicación de estacionamiento
                        </Text>

                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-2 flex-1">
                            {item.parkingLocation ? (
                              <>
                                <View
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 4,
                                    backgroundColor:
                                      getParkingType(
                                        item.parkingLocation
                                      ).color,
                                  }}
                                />

                                <Text className="text-sm text-foreground">
                                  {
                                    getParkingType(
                                      item.parkingLocation
                                    ).label
                                  }
                                </Text>
                              </>
                            ) : (
                              <Text className="text-sm text-foreground">
                                Sin definir
                              </Text>
                            )}
                          </View>

                          <TouchableOpacity
                            onPress={() =>
                              openParkingEditor(item)
                            }
                            className="p-2"
                          >
                            <MaterialIcons
                              name="edit"
                              size={18}
                              color="#0066CC"
                            />
                          </TouchableOpacity>
                        </View>
                      </View>

                    </View>
                  </View>
                );
              }}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom: 100,
              }}
            />
          </View>
        </ScreenContainer>
      );
    }

    // Vista principal de historial
    const filteredGrouped =
      grouped.filter((item) => {
        // Filtro por texto de búsqueda
        const matchesSearch =
          item.licensePlate
            .toUpperCase()
            .includes(
              searchQuery.toUpperCase()
            );

        // Filtro por rango de fechas
        const itemDate =
          new Date(item.lastSeen);

        itemDate.setHours(
          0,
          0,
          0,
          0
        );

        let matchesDateRange =
          true;

        if (
          filterStartDate ||
          filterEndDate
        ) {
          const startDate =
            filterStartDate
              ? new Date(
                  filterStartDate
                )
              : null;

          const endDate =
            filterEndDate
              ? new Date(
                  filterEndDate
                )
              : null;

          if (startDate) {
            startDate.setHours(
              0,
              0,
              0,
              0
            );
          }

          if (endDate) {
            endDate.setHours(
              23,
              59,
              59,
              999
            );
          }

          if (
            startDate &&
            itemDate < startDate
          ) {
            matchesDateRange = false;
          }

          if (
            endDate &&
            itemDate > endDate
          ) {
            matchesDateRange = false;
          }
        }

        return (
          matchesSearch &&
          matchesDateRange
        );
      });

    return (
      <ScreenContainer className="flex-1 p-4">
        <View className="flex-1 gap-4">
          {/* Encabezado */}
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-foreground">
                Historial
              </Text>

              {isSelectionMode && (
                <TouchableOpacity
                  onPress={() => {
                    setIsSelectionMode(
                      false
                    );
                    setSelectedForDeletion(
                      new Set()
                    );
                  }}
                  className="px-3 py-1 rounded-full bg-error/10"
                >
                  <Text className="text-error text-xs font-semibold">
                    Cancelar
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Barra de búsqueda con filtro de fechas */}
            <View className="flex-row gap-2 items-center">
              <View className="flex-1 relative">
                <TextInput
                  value={searchQuery}
                  onChangeText={(text) =>
                    setSearchQuery(
                      text.toUpperCase()
                    )
                  }
                  placeholder="Buscar matrícula..."
                  autoCapitalize="characters"
                  placeholderTextColor="#999"
                  selectionColor={
                    colors.primary
                  }
                  selectionHandleColor={
                    colors.primary
                  }
                  style={{
                    height: 50,
                    borderWidth: 2,
                    borderColor:
                      searchQuery.trim() &&
                      !/^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/.test(
                        searchQuery
                      )
                        ? "#EF4444"
                        : colors.border,
                    borderRadius: 8,
                    paddingLeft: 12,
                    paddingRight: 40,
                    fontSize: 16,
                    color:
                      colors.foreground,
                    backgroundColor:
                      colors.background,
                  }}
                />

                {searchQuery && (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchQuery("");
                      Keyboard.dismiss();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <MaterialIcons
                      name="close"
                      size={20}
                      color={
                        colors.muted
                      }
                    />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                onPress={() =>
                  setIsFilterModalVisible(
                    true
                  )
                }
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor:
                    colors.border,
                  backgroundColor:
                    colors.background,
                  alignItems: "center",
                  justifyContent:
                    "center",
                }}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={
                    isFilterActive
                      ? colors.error
                      : colors.muted
                  }
                />

                {isFilterActive && (
                  <View
                    style={{
                      position:
                        "absolute",
                      top: -6,
                      right: -6,
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor:
                        colors.error,
                    }}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Botones de acción */}
          {isSelectionMode && (
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={
                  deleteSelectedEntries
                }
                className="flex-1 bg-error p-3 rounded-lg items-center"
              >
                <Text className="text-white font-semibold">
                  Eliminar
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Lista de matrículas */}
          {filteredGrouped.length === 0 ? (
            <View className="flex-1 items-center justify-center gap-4">
              <Text className="text-muted">
                No hay matrículas registradas
              </Text>

              {searchQuery.trim() &&
                /^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/i.test(
                  searchQuery.toUpperCase()
                ) && (
                  <TouchableOpacity
                    onPress={() => {
                      const normalizedPlate =
                        searchQuery.toUpperCase();

                      setQuickEntryPlate(
                        normalizedPlate
                      );

                      setCapturedLocation(
                        null
                      );

                      setIsQuickEntryVisible(
                        true
                      );

                      getCurrentLocation()
                        .then(
                          (location) => {
                            setCapturedLocation(
                              location &&
                                location !==
                                  "NO GPS"
                                ? location
                                : null
                            );
                          }
                        )
                        .catch(
                          (error) => {
                            console.error(
                              "Error al precapturar ubicación GPS:",
                              error
                            );
                          }
                        );
                    }}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 8,
                      borderWidth: 2,
                      borderColor:
                        colors.primary,
                      backgroundColor:
                        colors.primary +
                        "20",
                    }}
                  >
                    <View className="flex-row items-center justify-center gap-2">
                      <Ionicons
                        name="add-circle-outline"
                        size={18}
                        color={
                          colors.primary
                        }
                      />

                      <Text
                        style={{
                          color:
                            colors.primary,
                          fontWeight:
                            "600",
                        }}
                      >
                        Registrar{" "}
                        {searchQuery.toUpperCase()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
            </View>
          ) : (
            <FlatList
              data={filteredGrouped}
              renderItem={({
                item,
              }) => {
                const lastDate =
                  new Date(
                    item.lastSeen
                  );

                const dateStr =
                  lastDate.toLocaleDateString(
                    "es-ES"
                  );

                const timeStr =
                  lastDate.toLocaleTimeString(
                    "es-ES",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  );

                const parkingType =
                  getParkingType(
                    item.parkingLocation
                  );

                // Calcular maxDetections desde datos GLOBALES
                const maxDetections =
                  Math.max(
                    ...grouped.map(
                      (p) => p.count
                    ),
                    1
                  );

                const recidivismColor =
                  getRecidivismColor(
                    item.count,
                    maxDetections
                  );

                const isSelectedForDeletion =
                  selectedForDeletion.has(
                    item.licensePlate
                  );

                const isDeleting =
                  deletingForDeletion.has(
                    item.licensePlate.toUpperCase()
                  );

                return (
                  <TouchableOpacity
                    onPress={() =>
                      setSelectedPlate(
                        item
                      )
                    }
                    onLongPress={() =>
                      handleLongPress(
                        item.licensePlate
                      )
                    }
                    className={`flex-row items-center justify-between p-4 rounded-lg mb-2 border ${
                      isSelectedForDeletion
                        ? "bg-error/10"
                        : "bg-surface"
                    }`}
                    style={{
                      borderColor:
                        isSelectedForDeletion && !isDeleting
                          ? colors.error
                          : colors.border,
                    }}
                  >
                    {item.entries.some((entry) => entry.id === highlightedEntryId) && (
                      <Animated.View
                        pointerEvents="none"
                        style={{
                          position: "absolute",
                          top: 0,
                          right: 0,
                          bottom: 0,
                          left: 0,
                          borderWidth: 2,
                          borderColor: colors.primary,
                          borderRadius: 8,
                          opacity: duplicateHighlightAnim,
                          zIndex: 20,
                          elevation: 2,
                        }}
                      />
                    )}

                    {isDeleting && (
                      <Animated.View
                        pointerEvents="none"
                        style={{
                          position: "absolute",
                          top: 0,
                          right: 0,
                          bottom: 0,
                          left: 0,
                          borderWidth: 2,
                          borderColor: colors.error,
                          borderRadius: 8,
                          opacity: deletionFadeAnim,
                          zIndex: 19,
                          elevation: 2,
                        }}
                      />
                    )}

                    <View className="flex-row items-center flex-1 gap-2">
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor:
                            recidivismColor,
                        }}
                      />

                      <View className="flex-1">
                        <Text
                          className="text-lg font-bold text-foreground"
                          style={{
                            fontFamily:
                              Platform.OS ===
                              "ios"
                                ? "Courier"
                                : "monospace",
                          }}
                        >
                          {
                            item.licensePlate
                          }
                        </Text>

                        <View className="flex-row items-center justify-between mt-1">
                          <Text className="text-sm text-muted">
                            {item.count}{" "}
                            {item.count === 1
                              ? "detección"
                              : "detecciones"} •{" "}
                            {dateStr}{" "}
                            {timeStr}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View className="items-end ml-2">
                      <Text
                        style={{
                          color:
                            parkingType.color,
                          fontWeight:
                            "600",
                          fontSize: 12,
                        }}
                      >
                        {
                          parkingType.label
                        }
                      </Text>

                      {selectedForDeletion.has(
                        item.licensePlate
                      ) && (
                        <MaterialIcons
                          name="check"
                          size={20}
                          color="#EF4444"
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
              keyExtractor={(item) =>
                item.licensePlate
              }
              showsVerticalScrollIndicator={
                false
              }
            />
          )}
        </View>
      </ScreenContainer>
    );
  };

  // Renderizar con fragmento para siempre incluir
  // GPSEditorModal y AlertsOverlay en nivel superior
  return (
    <>
      {renderContent()}

      {/* GPS Editor Modal */}
      <GPSEditorModal
        visible={gpsEditorVisible}
        currentLatitude={
          gpsEditingLocation?.latitude || 0
        }
        currentLongitude={
          gpsEditingLocation?.longitude || 0
        }
        onClose={() => {
          setGpsEditorVisible(false);
          setGpsEditingId(null);
          setGpsEditingLocation(null);
        }}
        onSave={handleGpsSave}
      />

      {/* Modal de Edición de Ubicación de estacionamiento */}
      <Modal
        visible={parkingEditorVisible}
        transparent
        animationType="slide"
        onRequestClose={closeParkingEditor}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <Animated.View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              paddingBottom: Math.max(20, insets.bottom + 12),
              transform: [{ translateY: offsetAnim }],
            }}
          >
            <Text className="text-lg font-bold text-foreground mb-4">
              Ubicación de estacionamiento
            </Text>

            <View className="gap-3">
              {selectableParkingTypes.map((type) => {
                const selected =
                  editingParkingLocation === type.id;

                return (
                  <TouchableOpacity
                    key={type.id}
                    onPress={() =>
                      setEditingParkingLocation(type.id)
                    }
                    className="flex-row items-center gap-3 p-3"
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: selected
                          ? colors.primary
                          : colors.border,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {selected && (
                        <View
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            backgroundColor: colors.primary,
                          }}
                        />
                      )}
                    </View>

                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: type.color,
                      }}
                    />

                    <Text className="text-foreground">
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View className="flex-row gap-2 mt-4">
              <TouchableOpacity
                onPress={closeParkingEditor}
                className="flex-1 p-3 rounded-lg bg-muted/20"
              >
                <Text className="text-muted font-semibold text-center">
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={saveParkingEditor}
                disabled={!editingParkingLocation}
                className="flex-1 p-3 rounded-lg bg-primary"
                style={{
                  opacity: editingParkingLocation ? 1 : 0.5,
                }}
              >
                <Text className="text-white font-semibold text-center">
                  Guardar
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Modal de Filtro de Fechas */}
      <Modal
        visible={isFilterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setIsFilterModalVisible(false)
        }
      >
        <View className="flex-1 bg-black/50">
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor:
                colors.background,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 24,
              paddingBottom: Math.max(
                32,
                insets.bottom + 16
              ),
            }}
          >
            <Text className="text-xl font-bold text-foreground mb-6">
              Filtrar por Fecha
            </Text>

            {/* Fecha Inicio */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-muted mb-2">
                Fecha Inicio
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setShowStartDatePicker(
                    true
                  )
                }
                style={{
                  borderWidth: 2,
                  borderColor:
                    colors.border,
                  borderRadius: 8,
                  padding: 12,
                  backgroundColor:
                    colors.surface,
                }}
              >
                <Text className="text-foreground font-semibold">
                  {filterStartDate
                    ? filterStartDate.toLocaleDateString(
                        "es-ES"
                      )
                    : "Seleccionar fecha"}
                </Text>
              </TouchableOpacity>

              {showStartDatePicker && (
                <DateTimePicker
                  value={
                    filterStartDate ||
                    new Date()
                  }
                  mode="date"
                  display="default"
                  onChange={(
                    event: any,
                    date?: Date
                  ) => {
                    setShowStartDatePicker(
                      false
                    );

                    if (date) {
                      setFilterStartDate(date);

                      AsyncStorage.setItem(
                        HISTORY_DATE_FILTER_KEY,
                        JSON.stringify({
                          startDate: date.toISOString(),
                          endDate: (filterEndDate || date).toISOString(),
                        })
                      ).catch((error) =>
                        console.error(
                          "Error al guardar el filtro de fechas:",
                          error
                        )
                      );

                      if (!filterEndDate) {
                        setFilterEndDate(date);
                      }
                    }
                  }}
                />
              )}
            </View>

            {/* Fecha Fin */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-muted mb-2">
                Fecha Fin
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setShowEndDatePicker(
                    true
                  )
                }
                style={{
                  borderWidth: 2,
                  borderColor:
                    colors.border,
                  borderRadius: 8,
                  padding: 12,
                  backgroundColor:
                    colors.surface,
                }}
              >
                <Text className="text-foreground font-semibold">
                  {filterEndDate
                    ? filterEndDate.toLocaleDateString(
                        "es-ES"
                      )
                    : "Seleccionar fecha"}
                </Text>
              </TouchableOpacity>

              {showEndDatePicker && (
                <DateTimePicker
                  value={
                    filterEndDate ||
                    new Date()
                  }
                  mode="date"
                  display="default"
                  onChange={(
                    event: any,
                    date?: Date
                  ) => {
                    setShowEndDatePicker(
                      false
                    );

                    if (date) {
                      setFilterEndDate(date);

                      AsyncStorage.setItem(
                        HISTORY_DATE_FILTER_KEY,
                        JSON.stringify({
                          startDate: (filterStartDate || date).toISOString(),
                          endDate: date.toISOString(),
                        })
                      ).catch((error) =>
                        console.error(
                          "Error al guardar el filtro de fechas:",
                          error
                        )
                      );

                      if (!filterStartDate) {
                        setFilterStartDate(date);
                      }
                    }
                  }}
                />
              )}
            </View>

            {/* Botones de acción */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={async () => {
                  setFilterStartDate(null);
                  setFilterEndDate(null);

                  try {
                    await AsyncStorage.removeItem(
                      HISTORY_DATE_FILTER_KEY
                    );
                  } catch (error) {
                    console.error(
                      "Error al limpiar el filtro de fechas:",
                      error
                    );
                  }

                  setIsFilterModalVisible(
                    false
                  );
                }}
                style={{
                  flex: 1,
                  borderWidth: 2,
                  borderColor:
                    colors.border,
                  borderRadius: 8,
                  padding: 12,
                  alignItems:
                    "center",
                  backgroundColor:
                    colors.surface,
                }}
              >
                <Text className="text-foreground font-semibold">
                  Limpiar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  setIsFilterModalVisible(
                    false
                  )
                }
                style={{
                  flex: 1,
                  backgroundColor:
                    colors.primary,
                  borderRadius: 8,
                  padding: 12,
                  alignItems:
                    "center",
                }}
              >
                <Text className="text-white font-semibold">
                  Aplicar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Edición de Fecha */}
      <Modal
        visible={dateEditorVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setDateEditorVisible(false)
        }
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View className="flex-1 bg-black/50 justify-center items-center p-4">
            <View className="bg-surface rounded-2xl p-6 w-full max-w-sm gap-4">
            <Text className="text-lg font-bold text-foreground">
              Editar Fecha y Hora
            </Text>

            <Text className="text-xs text-muted">
              Formato: YYYY-MM-DD HH:mm:ss
            </Text>

            <TextInput
              ref={dateInputRef}
              value={dateEditingValue}
              onChangeText={(text) => {
                const sanitized = text
                  .replace(/[^0-9:\- ]/g, "")
                  .slice(0, 19);

                setDateEditingValue(sanitized);

                const valid =
                  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(
                    sanitized
                  );

                setDateEditingError(
                  sanitized.length > 0 && !valid
                );
              }}
              placeholder="2024-03-24 14:30:00"
              placeholderTextColor={
                colors.muted
              }
              selectionColor={
                colors.primary
              }
              selectionHandleColor={
                colors.primary
              }
              style={{
                borderWidth: 1,
                borderColor: dateEditingError
                  ? colors.error
                  : colors.border,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 14,
                color:
                  colors.foreground,
                backgroundColor:
                  colors.background,
              }}
            />

            <View className="flex-row gap-2 mt-4">
              <TouchableOpacity
                onPress={() =>
                  setDateEditorVisible(
                    false
                  )
                }
                className="flex-1 p-3 rounded-lg bg-muted/20"
              >
                <Text className="text-muted font-semibold text-center">
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDateSave}
                className="flex-1 p-3 rounded-lg bg-primary"
              >
                <Text className="text-white font-semibold text-center">
                  Guardar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

      {/* Modal de Entrada Rápida */}
      <QuickEntryModal
        visible={
          isQuickEntryVisible
        }
        initialPlate={
          quickEntryPlate
        }
        /* existingPlates={plates.map((p) => p.licensePlate)} */
        isLoading={
          quickEntryLoading
        }
        onClose={() => {
          setIsQuickEntryVisible(
            false
          );
          setQuickEntryPlate("");
          setCapturedLocation(null);
        }}
        onSubmit={async (
          licensePlate: string,
          parkingLocation: ParkingLocation
        ) => {
          if (
            quickEntryProcessingRef.current
          ) {
            return;
          }

          quickEntryProcessingRef.current =
            true;

          setQuickEntryLoading(true);

          try {
            // Usar primero la ubicación que se ha ido capturando
            // mientras el usuario rellenaba la matrícula.
            let finalLocation:
              | GeoLocation
              | "NO GPS" =
              capturedLocation ||
              "NO GPS";

            // Solo si no tenemos ninguna ubicación capturada,
            // hacer un último intento de obtener GPS.
            if (
              finalLocation ===
              "NO GPS"
            ) {
              try {
                const currentLocation =
                  await getCurrentLocation();

                if (
                  currentLocation &&
                  currentLocation !==
                    "NO GPS"
                ) {
                  finalLocation =
                    currentLocation;
                }
              } catch (
                locationError
              ) {
                console.error(
                  "Error en el último intento de obtener GPS:",
                  locationError
                );
              }
            }

            const newEntry:
              LicensePlateEntry =
              {
                id: `${Date.now()}-${Math.random()
                  .toString(36)
                  .substr(2, 9)}`,

                licensePlate:
                  licensePlate.toUpperCase(),

                timestamp:
                  Date.now(),

                location:
                  finalLocation,

                parkingLocation,

                confidence:
                  "high",
              };

            await addPlate(
              newEntry
            );

            animateDuplicateHighlight(
              newEntry.id
            );

            if (
              Platform.OS !==
              "web"
            ) {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );
            }

            addAlert(
              `Matrícula ${licensePlate.toUpperCase()} registrada con éxito`,
              "success"
            );

            Keyboard.dismiss();

            setIsQuickEntryVisible(
              false
            );

            setQuickEntryPlate("");
            setCapturedLocation(
              null
            );
            setSearchQuery("");
          } catch (error) {
            console.error(
              "Error al registrar matrícula:",
              error
            );

            addAlert(
              "Error al registrar la matrícula",
              "error"
            );
          } finally {
            quickEntryProcessingRef.current =
              false;

            setQuickEntryLoading(
              false
            );
          }
        }}
      />

      {/* Alertas - Siempre renderizadas en nivel superior */}
      <AlertsOverlay
        alerts={alerts}
        onRemoveAlert={
          removeAlert
        }
      />
    </>
  );
}