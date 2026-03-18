import { useState, useRef, useEffect } from "react";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import Papa from "papaparse";
import { View, Text, TouchableOpacity, ScrollView, Modal, Pressable, Alert, Keyboard } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { AlertsOverlay } from "@/components/alerts-overlay";
import { useAlerts } from "@/hooks/use-alerts";
import { useColors } from "@/hooks/use-colors";
import type { LicensePlateEntry } from "@/types/license-plate";

const STORAGE_KEY = "license_plates";
const APP_VERSION = Constants.expoConfig?.version || "1.0.0";
const CSV_HEADERS = ["MATRÍCULA", "FECHA", "HORA", "LATITUD/LONGITUD", "LUGAR"];

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

  // Validar y parsear CSV usando PapaParse (RFC 4180)
  function validateAndParseCSV(csvText: string): LicensePlateEntry[] | null {
    try {
      // Usar PapaParse con header: true para parseo correcto de RFC 4180
      const result = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
      });

      if (result.errors && result.errors.length > 0) {
        setErrorMessage(`Error al parsear CSV: ${result.errors[0].message}`);
        setErrorModalVisible(true);
        return null;
      }

      const data = result.data as Record<string, any>[];

      if (data.length === 0) {
        setErrorMessage("El archivo CSV no contiene datos válidos");
        setErrorModalVisible(true);
        return null;
      }

      // Validar encabezados
      const actualHeaders = Object.keys(data[0]);
      const expectedHeaders = CSV_HEADERS;

      if (actualHeaders.length !== expectedHeaders.length) {
        setErrorMessage(
          `El CSV debe tener exactamente ${expectedHeaders.length} columnas. Se encontraron ${actualHeaders.length}`
        );
        setErrorModalVisible(true);
        return null;
      }

      for (let i = 0; i < expectedHeaders.length; i++) {
        if (actualHeaders[i].trim() !== expectedHeaders[i]) {
          setErrorMessage(
            `Encabezado incorrecto en columna ${i + 1}. Esperado: "${expectedHeaders[i]}", Recibido: "${actualHeaders[i]}"`
          );
          setErrorModalVisible(true);
          return null;
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
        if (!/^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/.test(licensePlate)) {
          setErrorMessage(
            `Línea ${lineIndex + 2}: Matrícula inválida "${licensePlate}". Formato esperado: 0000BBB`
          );
          setErrorModalVisible(true);
          return null;
        }

        // Parsear fecha (dd/mm/yyyy)
        const dateParts = dateStr.split("/");
        if (dateParts.length !== 3) {
          setErrorMessage(
            `Línea ${lineIndex + 2}: Formato de fecha inválido "${dateStr}". Esperado: dd/mm/yyyy`
          );
          setErrorModalVisible(true);
          return null;
        }

        const [day, month, year] = dateParts.map(Number);
        if (!day || !month || !year || day < 1 || day > 31 || month < 1 || month > 12) {
          setErrorMessage(
            `Línea ${lineIndex + 2}: Fecha inválida "${dateStr}"`
          );
          setErrorModalVisible(true);
          return null;
        }

        // Parsear hora (hh:mm:ss)
        const timeParts = timeStr.split(":");
        if (timeParts.length !== 3) {
          setErrorMessage(
            `Línea ${lineIndex + 2}: Formato de hora inválido "${timeStr}". Esperado: hh:mm:ss`
          );
          setErrorModalVisible(true);
          return null;
        }

        const [hour, minute, second] = timeParts.map(Number);
        if (hour === undefined || minute === undefined || second === undefined ||
            hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
          setErrorMessage(
            `Línea ${lineIndex + 2}: Hora inválida "${timeStr}"`
          );
          setErrorModalVisible(true);
          return null;
        }

        const timestamp = new Date(year, month - 1, day, hour, minute, second).getTime();

        // Parsear ubicación GPS (ahora es una única columna)
        let location: any = "NO GPS";
        if (locationStr !== "NO GPS" && locationStr !== "") {
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
              return null;
            }
          } else if (coordParts.length === 1 && locationStr !== "NO GPS") {
            setErrorMessage(
              `Línea ${lineIndex + 2}: Formato de coordenadas inválido "${locationStr}". Esperado: "lat,lng" o "NO GPS"`
            );
            setErrorModalVisible(true);
            return null;
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
          return null;
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
        return null;
      }

      return entries;
    } catch (error) {
      console.error("Error validando CSV:", error);
      setErrorMessage("Error al procesar el archivo CSV");
      setErrorModalVisible(true);
      return null;
    }
  }

  async function pickAndValidateCSV() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
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

      const validatedEntries = validateAndParseCSV(content);
      if (!validatedEntries) {
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
        // Agregar datos
        const existingData = await AsyncStorage.getItem(STORAGE_KEY);
        const existing: LicensePlateEntry[] = existingData ? JSON.parse(existingData) : [];
        
        // Evitar duplicados por ID
        const existingIds = new Set(existing.map((e) => e.id));
        const newEntries = csvData.filter((e) => !existingIds.has(e.id));
        
        const merged = [...existing, ...newEntries];
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        addAlert(`Se agregaron ${newEntries.length} registros`, "success");
      } else if (importMode === "replace") {
        // Reemplazar datos
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(csvData));
        addAlert(`Se reemplazaron todos los registros (${csvData.length} total)`, "success");
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
