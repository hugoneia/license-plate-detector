import { useState, useRef, useEffect } from "react";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import Papa from "papaparse";
import { View, Text, TouchableOpacity, ScrollView, Modal, Pressable, Alert, Keyboard, Switch, TextInput } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { AlertsOverlay } from "@/components/alerts-overlay";
import { useAlerts } from "@/hooks/use-alerts";
import { useColors } from "@/hooks/use-colors";
import type { LicensePlateEntry } from "@/types/license-plate";
import type { ExclusionZone, ExclusionZonesConfig } from "@/types/exclusion-zone";

const STORAGE_KEY = "license_plates";
const EXCLUSION_ZONES_KEY = "exclusion_zones";
const APP_VERSION = Constants.expoConfig?.version || "1.0.0";

export default function SettingsScreen() {
  const { alerts, addAlert, removeAlert } = useAlerts();
  const colors = useColors();
  const [isExporting, setIsExporting] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importMode, setImportMode] = useState<"add" | "replace" | null>(null);
  const [safeDeleteModalVisible, setSafeDeleteModalVisible] = useState(false);
  const [safeDeleteCounter, setSafeDeleteCounter] = useState(5);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [csvData, setCsvData] = useState<LicensePlateEntry[] | null>(null);
  const counterIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Estado para zonas de exclusión
  const [exclusionZonesConfig, setExclusionZonesConfig] = useState<ExclusionZonesConfig>({
    masterEnabled: false,
    zones: [],
  });
  const [zonesModalVisible, setZonesModalVisible] = useState(false);
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneCoordinates, setNewZoneCoordinates] = useState("");
  const [newZoneRadius, setNewZoneRadius] = useState("");
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);

  // Cargar zonas de exclusión al montar
  useEffect(() => {
    loadExclusionZones();
  }, []);

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

  async function saveExclusionZones(config: ExclusionZonesConfig) {
    try {
      await AsyncStorage.setItem(EXCLUSION_ZONES_KEY, JSON.stringify(config));
      setExclusionZonesConfig(config);
    } catch (error) {
      console.error("Error saving exclusion zones:", error);
      addAlert("Error al guardar zonas de exclusión", "error");
    }
  }

  // Normalizar coordenadas españolas (comas a puntos)
  function normalizeCoordinates(text: string): string {
    return text.replace(/(\d),(\d)/g, "$1.$2");
  }

  function saveOrUpdateZone() {
    if (!newZoneName.trim() || !newZoneCoordinates.trim() || !newZoneRadius.trim()) {
      addAlert("Por favor completa todos los campos", "warning");
      return;
    }

    // Normalizar coordenadas
    const normalized = normalizeCoordinates(newZoneCoordinates);
    const coords = normalized.split(",").map((c) => c.trim());

    if (coords.length !== 2) {
      addAlert("Formato inválido. Usa: Latitud, Longitud", "error");
      return;
    }

    const lat = parseFloat(coords[0]);
    const lon = parseFloat(coords[1]);
    const radius = parseFloat(newZoneRadius);

    if (isNaN(lat) || isNaN(lon) || isNaN(radius)) {
      addAlert("Coordenadas o radio inválidos", "error");
      return;
    }

    if (radius <= 0) {
      addAlert("El radio debe ser mayor a 0", "error");
      return;
    }

    if (editingZoneId) {
      // Editar zona existente
      const newConfig: ExclusionZonesConfig = {
        ...exclusionZonesConfig,
        zones: exclusionZonesConfig.zones.map((z) =>
          z.id === editingZoneId
            ? { ...z, name: newZoneName, latitude: lat, longitude: lon, radiusMeters: radius }
            : z
        ),
      };
      saveExclusionZones(newConfig);
      addAlert("Zona actualizada correctamente", "success");
    } else {
      // Crear nueva zona
      const newZone: ExclusionZone = {
        id: `zone-${Date.now()}`,
        name: newZoneName,
        latitude: lat,
        longitude: lon,
        radiusMeters: radius,
        enabled: true,
        createdAt: Date.now(),
      };

      const newConfig: ExclusionZonesConfig = {
        ...exclusionZonesConfig,
        zones: [...exclusionZonesConfig.zones, newZone],
      };
      saveExclusionZones(newConfig);
      addAlert("Zona añadida correctamente", "success");
    }

    resetZoneForm();
    setZonesModalVisible(false);
  }

  function resetZoneForm() {
    setNewZoneName("");
    setNewZoneCoordinates("");
    setNewZoneRadius("");
    setEditingZoneId(null);
  }

  function openEditZoneModal(zone: ExclusionZone) {
    setNewZoneName(zone.name);
    setNewZoneCoordinates(`${zone.latitude}, ${zone.longitude}`);
    setNewZoneRadius(zone.radiusMeters.toString());
    setEditingZoneId(zone.id);
    setZonesModalVisible(true);
  }

  function confirmDeleteZone(zoneId: string) {
    Alert.alert(
      "Eliminar Zona",
      "¿Estás seguro de que deseas eliminar esta zona de exclusión?",
      [
        { text: "Cancelar", onPress: () => {}, style: "cancel" },
        {
          text: "Eliminar",
          onPress: () => deleteExclusionZone(zoneId),
          style: "destructive",
        },
      ]
    );
  }

  function deleteExclusionZone(zoneId: string) {
    const newConfig: ExclusionZonesConfig = {
      ...exclusionZonesConfig,
      zones: exclusionZonesConfig.zones.filter((z) => z.id !== zoneId),
    };
    saveExclusionZones(newConfig);
    addAlert("Zona eliminada correctamente", "success");
  }

  function toggleZoneEnabled(zoneId: string) {
    // Actualizar estado local inmediatamente (sin esperar AsyncStorage)
    const newConfig: ExclusionZonesConfig = {
      ...exclusionZonesConfig,
      zones: exclusionZonesConfig.zones.map((z) =>
        z.id === zoneId ? { ...z, enabled: !z.enabled } : z
      ),
    };
    setExclusionZonesConfig(newConfig);
    
    // Guardar en AsyncStorage de forma asíncrona sin bloquear UI
    AsyncStorage.setItem(EXCLUSION_ZONES_KEY, JSON.stringify(newConfig)).catch((error) => {
      console.error("Error saving zone toggle:", error);
      addAlert("Error al guardar cambios", "error");
    });
  }

  // Contador de seguridad para el botón SÍ
  useEffect(() => {
    if (safeDeleteModalVisible && safeDeleteCounter > 0) {
      counterIntervalRef.current = setInterval(() => {
        setSafeDeleteCounter((prev) => {
          if (prev <= 1) {
            if (counterIntervalRef.current) clearInterval(counterIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (counterIntervalRef.current) clearInterval(counterIntervalRef.current);
    };
  }, [safeDeleteModalVisible]);

  async function exportCSV() {
    try {
      setIsExporting(true);
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
        
        // RFC 4180: Coordenadas entre comillas dobles para mantener como una columna
        const locationStr =
          entry.location === "NO GPS"
            ? "NO GPS"
            : `"${entry.location?.latitude},${entry.location?.longitude}"`;
        
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
      
      addAlert("Archivo exportado correctamente", "success");
    } catch (error) {
      console.error("Error al exportar CSV:", error);
      addAlert("Error al exportar el archivo", "error");
    } finally {
      setIsExporting(false);
    }
  }

  // Validar y parsear CSV usando PapaParse (RFC 4180) - ULTRA ROBUSTO
  async function validateAndParseCSV(csvText: string): Promise<LicensePlateEntry[] | null> {
    return new Promise<LicensePlateEntry[] | null>((resolve) => {
      try {
        // Configuración CORRECTA de PapaParse
        Papa.parse(csvText, {
          header: true, // Usa la primera fila como nombres de campos
          skipEmptyLines: true,
          transformHeader: (h: string) => h.trim().toUpperCase(), // Limpia espacios y fuerza mayúsculas
          complete: (results) => {
            try {
              // results.data es un array de objetos limpio
              const data = results.data as Record<string, any>[];

              if (data.length === 0) {
                setErrorMessage("El archivo CSV no contiene datos válidos");
                setErrorModalVisible(true);
                resolve(null);
                return;
              }

              // Validar que existan las llaves requeridas (NO contar comas)
              const firstRow = data[0];
              const requiredHeaders = ["MATRÍCULA", "FECHA", "HORA", "LATITUD/LONGITUD", "LUGAR"];
              
              for (const header of requiredHeaders) {
                if (!(header in firstRow)) {
                  setErrorMessage(
                    `Encabezado faltante: "${header}". Encabezados encontrados: ${Object.keys(firstRow).join(", ")}`
                  );
                  setErrorModalVisible(true);
                  resolve(null);
                  return;
                }
              }

              const entries: LicensePlateEntry[] = [];

              for (let lineIndex = 0; lineIndex < data.length; lineIndex++) {
                const row = data[lineIndex];
                const licensePlate = (row["MATRÍCULA"] || "").trim().toUpperCase();
                const dateStr = (row["FECHA"] || "").trim();
                const timeStr = (row["HORA"] || "").trim();
                const locationStr = (row["LATITUD/LONGITUD"] || "").trim();
                const lugarCode = (row["LUGAR"] || "").trim();

                // Validar matrícula
                if (!licensePlate || !/^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/.test(licensePlate)) {
                  setErrorMessage(
                    `Línea ${lineIndex + 2}: Matrícula inválida "${licensePlate}". Formato esperado: 0000BBB`
                  );
                  setErrorModalVisible(true);
                  resolve(null);
                  return;
                }

                // Parsear fecha (dd/mm/yyyy)
                const dateParts = dateStr.split("/");
                if (dateParts.length !== 3) {
                  setErrorMessage(
                    `Línea ${lineIndex + 2}: Formato de fecha inválido "${dateStr}". Esperado: dd/mm/yyyy`
                  );
                  setErrorModalVisible(true);
                  resolve(null);
                  return;
                }

                const [day, month, year] = dateParts.map(Number);
                if (!day || !month || !year || day < 1 || day > 31 || month < 1 || month > 12) {
                  setErrorMessage(
                    `Línea ${lineIndex + 2}: Fecha inválida "${dateStr}"`
                  );
                  setErrorModalVisible(true);
                  resolve(null);
                  return;
                }

                // Parsear hora (hh:mm:ss)
                const timeParts = timeStr.split(":");
                if (timeParts.length !== 3) {
                  setErrorMessage(
                    `Línea ${lineIndex + 2}: Formato de hora inválido "${timeStr}". Esperado: hh:mm:ss`
                  );
                  setErrorModalVisible(true);
                  resolve(null);
                  return;
                }

                const [hour, minute, second] = timeParts.map(Number);
                if (hour === undefined || minute === undefined || second === undefined ||
                    hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
                  setErrorMessage(
                    `Línea ${lineIndex + 2}: Hora inválida "${timeStr}"`
                  );
                  setErrorModalVisible(true);
                  resolve(null);
                  return;
                }

                const timestamp = new Date(year, month - 1, day, hour, minute, second).getTime();

                // Parsear ubicación GPS (ahora es una única columna gracias a PapaParse)
                let location: any = "NO GPS";
                if (locationStr && locationStr !== "NO GPS" && locationStr !== "") {
                  const coordParts = locationStr.split(",");
                  if (coordParts.length === 2) {
                    const lat = parseFloat(coordParts[0].trim());
                    const lng = parseFloat(coordParts[1].trim());
                    if (!isNaN(lat) && !isNaN(lng)) {
                      location = { latitude: lat, longitude: lng };
                    } else {
                      setErrorMessage(
                        `Línea ${lineIndex + 2}: Coordenadas GPS inválidas "${locationStr}". Esperado: "lat,lng"`
                      );
                      setErrorModalVisible(true);
                      resolve(null);
                      return;
                    }
                  } else if (coordParts.length !== 1) {
                    setErrorMessage(
                      `Línea ${lineIndex + 2}: Formato de coordenadas inválido "${locationStr}". Esperado: "lat,lng" o "NO GPS"`
                    );
                    setErrorModalVisible(true);
                    resolve(null);
                    return;
                  }
                }

                // Validar código de ubicación
                let parkingLocation: "acera" | "doble_fila" | null = null;
                if (lugarCode === "AC") parkingLocation = "acera";
                else if (lugarCode === "DF") parkingLocation = "doble_fila";
                else if (lugarCode !== "SD") {
                  setErrorMessage(
                    `Línea ${lineIndex + 2}: Código de ubicación inválido "${lugarCode}". Válidos: AC, DF, SD`
                  );
                  setErrorModalVisible(true);
                  resolve(null);
                  return;
                }

                entries.push({
                  id: `${licensePlate}-${timestamp}`,
                  licensePlate,
                  timestamp,
                  confidence: "high",
                  location,
                  parkingLocation: parkingLocation || null,
                });
              }

              if (entries.length === 0) {
                setErrorMessage("El archivo CSV no contiene datos válidos");
                setErrorModalVisible(true);
                resolve(null);
                return;
              }

              resolve(entries);
            } catch (error) {
              console.error("Error en complete callback:", error);
              setErrorMessage("Error al procesar el archivo CSV");
              setErrorModalVisible(true);
              resolve(null);
            }
          },
          error: (error: any) => {
            console.error("Error en PapaParse:", error);
            setErrorMessage(`Error al parsear CSV: ${error?.message || 'Error desconocido'}`);
            setErrorModalVisible(true);
            resolve(null);
          },
        });
      } catch (error) {
        console.error("Error validando CSV:", error);
        setErrorMessage("Error al procesar el archivo CSV");
        setErrorModalVisible(true);
        resolve(null);
      }
    });
  }

  async function pickAndValidateCSV() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*", // Mantener para evitar bloqueos de Android
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const fileName = result.assets[0].name || "";
      
      // Validar extensión .csv
      if (!fileName.toLowerCase().endsWith(".csv")) {
        setErrorMessage(`El archivo debe tener extensión .csv. Archivo seleccionado: ${fileName}`);
        setErrorModalVisible(true);
        return;
      }

      const fileUri = result.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(fileUri);

      const validatedEntries = await validateAndParseCSV(content);
      if (!validatedEntries || validatedEntries.length === 0) {
        return;
      }

      setCsvData(validatedEntries);
      setImportModalVisible(true);
    } catch (error) {
      console.error("Error al seleccionar archivo:", error);
      setErrorMessage("Error al seleccionar el archivo");
      setErrorModalVisible(true);
    }
  }

  async function handleImport() {
    if (!csvData || !importMode) return;

    try {
      if (importMode === "add") {
        // Agregar datos: Combinar registros existentes con nuevos
        const existingData = await AsyncStorage.getItem(STORAGE_KEY);
        const existing: LicensePlateEntry[] = existingData ? JSON.parse(existingData) : [];
        
        // Crear clave única combinando MATRÍCULA + TIMESTAMP
        // para evitar duplicados si se importa el mismo archivo dos veces
        const existingKeys = new Set(
          existing.map((e) => `${e.licensePlate.trim()}-${e.timestamp}`)
        );
        
        // Filtrar registros nuevos que no existan ya
        const newEntries = csvData.filter((e) => {
          const key = `${e.licensePlate.trim()}-${e.timestamp}`;
          return !existingKeys.has(key);
        });
        
        // Combinar: registros existentes + registros nuevos
        const merged = [...existing, ...newEntries];
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        
        // Mensaje de éxito indicando cuántos registros nuevos se añadieron
        const addedCount = newEntries.length;
        const totalCount = merged.length;
        addAlert(
          `Se han añadido ${addedCount} registro${addedCount !== 1 ? 's' : ''} nuevo${addedCount !== 1 ? 's' : ''}. Total: ${totalCount}`,
          "success"
        );
      } else if (importMode === "replace") {
        // Reemplazar datos: Eliminar todos los registros y guardar solo los del CSV
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(csvData));
        addAlert(
          `Se han reemplazado todos los registros (${csvData.length} total)`,
          "success"
        );
      }

      setImportModalVisible(false);
      setImportMode(null);
      setSafeDeleteModalVisible(false);
      setSafeDeleteCounter(5);
      setCsvData(null);
    } catch (error) {
      console.error("Error al importar:", error);
      addAlert("Error al importar los datos", "error");
    }
  }

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-6">
          {/* Sección de Exportación */}
          <View className="bg-surface rounded-lg p-4 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-3">Exportar Datos</Text>
            <TouchableOpacity
              className="bg-primary rounded-lg py-3 px-4 flex-row items-center justify-center gap-2"
              onPress={exportCSV}
              disabled={isExporting}
            >
              <MaterialIcons name="download" size={20} color={colors.background} />
              <Text className="text-background font-semibold">
                {isExporting ? "Exportando..." : "Exportar CSV"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sección de Importación */}
          <View className="bg-surface rounded-lg p-4 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-3">Importar Datos</Text>
            <TouchableOpacity
              className="bg-primary rounded-lg py-3 px-4 flex-row items-center justify-center gap-2"
              onPress={pickAndValidateCSV}
            >
              <MaterialIcons name="upload" size={20} color={colors.background} />
              <Text className="text-background font-semibold">Importar CSV</Text>
            </TouchableOpacity>
          </View>

          {/* Sección de Zonas de Exclusión */}
          <View className="bg-surface rounded-lg p-4 border border-border">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-semibold text-foreground">Zonas de Exclusión</Text>
              <Switch
                value={Boolean(exclusionZonesConfig.masterEnabled)}
                onValueChange={(value) => {
                  // Actualizar estado local inmediatamente
                  const newConfig: ExclusionZonesConfig = {
                    ...exclusionZonesConfig,
                    masterEnabled: value,
                  };
                  setExclusionZonesConfig(newConfig);
                  
                  // Guardar en AsyncStorage sin bloquear UI
                  AsyncStorage.setItem(EXCLUSION_ZONES_KEY, JSON.stringify(newConfig)).catch((error) => {
                    console.error("Error saving master toggle:", error);
                    addAlert("Error al guardar cambios", "error");
                  });
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            {/* Listado de zonas */}
            {exclusionZonesConfig.zones.length > 0 ? (
              <View className="gap-1 mb-4">
                {exclusionZonesConfig.zones.map((zone) => (
                  <View
                    key={zone.id}
                    className="bg-background rounded-lg p-2 border border-border"
                  >
                    {/* Fila principal: nombre + controles */}
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-sm font-semibold text-foreground flex-1">{zone.name}</Text>
                      <View className="flex-row items-center gap-1">
                        <TouchableOpacity
                          onPress={() => openEditZoneModal(zone)}
                          className="p-1"
                        >
                          <MaterialIcons name="edit" size={14} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => confirmDeleteZone(zone.id)}
                          className="p-1"
                        >
                          <MaterialIcons name="delete" size={14} color={colors.error} />
                        </TouchableOpacity>
                        <Switch
                          value={Boolean(zone.enabled)}
                          onValueChange={() => toggleZoneEnabled(zone.id)}
                          trackColor={{ false: colors.border, true: colors.primary }}
                        />
                      </View>
                    </View>
                    {/* Fila secundaria: coordenadas */}
                    <Text className="text-xs text-muted">
                      {zone.latitude.toFixed(4)}, {zone.longitude.toFixed(4)} • {zone.radiusMeters}m
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="text-xs text-muted mb-4">No hay zonas de exclusión configuradas</Text>
            )}

            {/* Botón para añadir zona */}
            <TouchableOpacity
              className="bg-primary rounded-lg py-2 px-3 flex-row items-center justify-center gap-2"
              onPress={() => setZonesModalVisible(true)}
            >
              <MaterialIcons name="add" size={18} color={colors.background} />
              <Text className="text-background font-semibold text-sm">Añadir Zona</Text>
            </TouchableOpacity>
          </View>

          {/* Sección de Información */}
          <View className="bg-surface rounded-lg p-4 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-4">Información</Text>
            <View className="gap-3">
              <View className="flex-row justify-between">
                <Text className="text-foreground font-medium">Aplicación:</Text>
                <Text className="text-muted">Detector de Matrículas</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-foreground font-medium">Versión:</Text>
                <Text className="text-muted">v{APP_VERSION}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-foreground font-medium">Autor:</Text>
                <Text className="text-muted">@hug0nES</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Modal de Selección de Importación */}
      <Modal
        visible={importModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setImportModalVisible(false);
          setImportMode(null);
          setCsvData(null);
        }}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-background rounded-lg p-6 w-full max-w-sm gap-4">
            <Text className="text-lg font-bold text-foreground">
              ¿Cómo deseas importar los datos?
            </Text>
            <Text className="text-sm text-muted">
              Se encontraron {csvData?.length || 0} registros
            </Text>

            <View className="gap-3">
              <TouchableOpacity
                className="bg-primary rounded-lg py-3 px-4"
                onPress={() => {
                  setImportMode("add");
                  setImportModalVisible(false);
                  handleImport();
                }}
              >
                <Text className="text-background font-semibold text-center">Añadir</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="bg-warning rounded-lg py-3 px-4"
                onPress={() => {
                  setImportMode("replace");
                  setSafeDeleteModalVisible(true);
                }}
              >
                <Text className="text-background font-semibold text-center">Sustituir</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="bg-border rounded-lg py-3 px-4"
                onPress={() => {
                  setImportModalVisible(false);
                  setImportMode(null);
                  setCsvData(null);
                }}
              >
                <Text className="text-foreground font-semibold text-center">Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Seguridad (Safe Delete) */}
      <Modal
        visible={safeDeleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSafeDeleteModalVisible(false);
          setSafeDeleteCounter(5);
          setImportMode(null);
        }}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-background rounded-lg p-6 w-full max-w-sm gap-4">
            <View className="flex-row items-center gap-3">
              <MaterialIcons name="warning" size={24} color={colors.error} />
              <Text className="text-lg font-bold text-foreground flex-1">
                Advertencia
              </Text>
            </View>

            <Text className="text-sm text-muted">
              Esta acción sustituirá todos los registros actuales. ¿Estás seguro?
            </Text>

            <View className="gap-3">
              <TouchableOpacity
                className={`rounded-lg py-3 px-4 ${
                  safeDeleteCounter === 0
                    ? "bg-error"
                    : "bg-gray-400"
                }`}
                disabled={safeDeleteCounter > 0}
                onPress={() => {
                  setImportMode("replace");
                  handleImport();
                }}
              >
                <Text className="text-background font-semibold text-center">
                  {safeDeleteCounter > 0 ? `SÍ (${safeDeleteCounter})` : "SÍ"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="bg-border rounded-lg py-3 px-4"
                onPress={() => {
                  setSafeDeleteModalVisible(false);
                  setSafeDeleteCounter(5);
                  setImportMode(null);
                }}
              >
                <Text className="text-foreground font-semibold text-center">Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Creación/Edición de Zonas */}
      <Modal
        visible={zonesModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setZonesModalVisible(false);
          resetZoneForm();
        }}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-background rounded-lg p-6 w-full max-w-sm gap-4">
            <Text className="text-lg font-bold text-foreground">
              {editingZoneId ? "Editar Zona" : "Crear Zona de Exclusión"}
            </Text>

            <View className="gap-3">
              <View>
                <Text className="text-sm font-semibold text-foreground mb-1">Nombre</Text>
                <TextInput
                  value={newZoneName}
                  onChangeText={setNewZoneName}
                  placeholder="Ej: Centro Histórico"
                  placeholderTextColor={colors.muted}
                  className="border border-border rounded px-3 py-2 text-foreground"
                  style={{ borderColor: colors.border, color: colors.foreground }}
                />
              </View>

              <View>
                <Text className="text-sm font-semibold text-foreground mb-1">Coordenadas (Lat, Lon)</Text>
                <Text className="text-xs text-muted mb-2">Formato: latitud,longitud (separadas por coma). Se normalizan automáticamente comas decimales españolas.</Text>
                <TextInput
                  value={newZoneCoordinates}
                  onChangeText={setNewZoneCoordinates}
                  placeholder="Ej: 40.340719,-3.666870"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  className="border border-border rounded px-3 py-2 text-foreground"
                  style={{ borderColor: colors.border, color: colors.foreground }}
                />
              </View>

              <View>
                <Text className="text-sm font-semibold text-foreground mb-1">Radio (metros)</Text>
                <TextInput
                  value={newZoneRadius}
                  onChangeText={setNewZoneRadius}
                  placeholder="Ej: 500"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  className="border border-border rounded px-3 py-2 text-foreground"
                  style={{ borderColor: colors.border, color: colors.foreground }}
                />
              </View>
            </View>

            <View className="gap-3">
              <TouchableOpacity
                className="bg-primary rounded-lg py-3 px-4"
                onPress={saveOrUpdateZone}
              >
                <Text className="text-background font-semibold text-center">
                  {editingZoneId ? "Actualizar Zona" : "Crear Zona"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="bg-border rounded-lg py-3 px-4"
                onPress={() => {
                  setZonesModalVisible(false);
                  resetZoneForm();
                }}
              >
                <Text className="text-foreground font-semibold text-center">Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Error */}
      <Modal
        visible={errorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-background rounded-lg p-6 w-full max-w-sm gap-4 border border-error">
            <View className="flex-row items-center gap-3">
              <MaterialIcons name="error" size={24} color={colors.error} />
              <Text className="text-lg font-bold text-error flex-1">Error</Text>
            </View>

            <Text className="text-sm text-muted">{errorMessage}</Text>

            <TouchableOpacity
              className="bg-error rounded-lg py-3 px-4"
              onPress={() => setErrorModalVisible(false)}
            >
              <Text className="text-background font-semibold text-center">Aceptar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AlertsOverlay alerts={alerts} onRemoveAlert={removeAlert} />
    </ScreenContainer>
  );
}
