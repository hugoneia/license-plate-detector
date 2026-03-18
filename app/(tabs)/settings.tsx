import { useState, useCallback, useRef, useEffect } from "react";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import Papa from "papaparse";
import { View, Text, TouchableOpacity, ScrollView, Modal, Pressable, Alert } from "react-native";
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
      
      addAlert("Archivo exportado correctamente", "success");
    } catch (error) {
      console.error("Error al exportar CSV:", error);
      addAlert("Error al exportar el archivo", "error");
    } finally {
      setIsExporting(false);
    }
  }

  // Validar y parsear CSV
  function validateAndParseCSV(csvText: string): LicensePlateEntry[] | null {
    try {
      const lines = csvText.trim().split("\n");
      if (lines.length < 2) {
        setErrorMessage("El archivo CSV está vacío o tiene menos de 2 líneas");
        setErrorModalVisible(true);
        return null;
      }

      // Parsear encabezado
      const headerLine = lines[0];
      const headers = headerLine.split(",").map((h) => h.trim());

      // Validar que los encabezados coincidan
      if (headers.length !== CSV_HEADERS.length) {
        setErrorMessage(`El CSV debe tener exactamente ${CSV_HEADERS.length} columnas`);
        setErrorModalVisible(true);
        return null;
      }

      for (let i = 0; i < CSV_HEADERS.length; i++) {
        if (headers[i] !== CSV_HEADERS[i]) {
          setErrorMessage(
            `Encabezado incorrecto en columna ${i + 1}. Esperado: "${CSV_HEADERS[i]}", Recibido: "${headers[i]}"`
          );
          setErrorModalVisible(true);
          return null;
        }
      }

      const entries: LicensePlateEntry[] = [];

      for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex].trim();
        if (!line) continue;

        const parts = line.split(",");
        if (parts.length !== CSV_HEADERS.length) {
          setErrorMessage(
            `Línea ${lineIndex + 1}: Número de columnas incorrecto. Esperado ${CSV_HEADERS.length}, Recibido ${parts.length}`
          );
          setErrorModalVisible(true);
          return null;
        }

        const licensePlate = parts[0].trim();
        const dateStr = parts[1].trim();
        const timeStr = parts[2].trim();
        const locationStr = parts[3].trim();
        const lugarCode = parts[4].trim();

        // Validar matrícula
        if (!/^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/.test(licensePlate)) {
          setErrorMessage(
            `Línea ${lineIndex + 1}: Matrícula inválida "${licensePlate}". Formato esperado: 0000BBB`
          );
          setErrorModalVisible(true);
          return null;
        }

        // Parsear fecha (dd/mm/yyyy)
        const dateParts = dateStr.split("/");
        if (dateParts.length !== 3) {
          setErrorMessage(
            `Línea ${lineIndex + 1}: Formato de fecha inválido "${dateStr}". Esperado: dd/mm/yyyy`
          );
          setErrorModalVisible(true);
          return null;
        }

        const [day, month, year] = dateParts.map(Number);
        if (!day || !month || !year || day < 1 || day > 31 || month < 1 || month > 12) {
          setErrorMessage(
            `Línea ${lineIndex + 1}: Fecha inválida "${dateStr}"`
          );
          setErrorModalVisible(true);
          return null;
        }

        // Parsear hora (hh:mm:ss)
        const timeParts = timeStr.split(":");
        if (timeParts.length !== 3) {
          setErrorMessage(
            `Línea ${lineIndex + 1}: Formato de hora inválido "${timeStr}". Esperado: hh:mm:ss`
          );
          setErrorModalVisible(true);
          return null;
        }

        const [hour, minute, second] = timeParts.map(Number);
        if (hour === undefined || minute === undefined || second === undefined ||
            hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
          setErrorMessage(
            `Línea ${lineIndex + 1}: Hora inválida "${timeStr}"`
          );
          setErrorModalVisible(true);
          return null;
        }

        const timestamp = new Date(year, month - 1, day, hour, minute, second).getTime();

        // Parsear ubicación GPS
        let location: any = "NO GPS";
        if (locationStr !== "NO GPS") {
          const coordParts = locationStr.split(",");
          if (coordParts.length === 2) {
            const lat = parseFloat(coordParts[0].trim());
            const lng = parseFloat(coordParts[1].trim());
            if (!isNaN(lat) && !isNaN(lng)) {
              location = { latitude: lat, longitude: lng };
            }
          }
        }

        // Validar código de ubicación
        let parkingLocation: "acera" | "doble_fila" | null = null;
        if (lugarCode === "AC") parkingLocation = "acera";
        else if (lugarCode === "DF") parkingLocation = "doble_fila";
        else if (lugarCode !== "SD") {
          setErrorMessage(
            `Línea ${lineIndex + 1}: Código de ubicación inválido "${lugarCode}". Válidos: AC, DF, SD`
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
        type: "text/csv",
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
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
      setErrorMessage("Error al seleccionar o leer el archivo");
      setErrorModalVisible(true);
    }
  }

  async function handleImportAdd() {
    if (!csvData) return;

    try {
      const currentData = await AsyncStorage.getItem(STORAGE_KEY);
      const currentEntries: LicensePlateEntry[] = currentData ? JSON.parse(currentData) : [];

      // Combinar sin duplicados por ID
      const combined = [...currentEntries];
      let addedCount = 0;

      csvData.forEach((newEntry) => {
        if (!combined.find((e) => e.id === newEntry.id)) {
          combined.push(newEntry);
          addedCount++;
        }
      });

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(combined));
      addAlert(`Se agregaron ${addedCount} registros correctamente`, "success");
      setImportModalVisible(false);
      setCsvData(null);
      setImportMode(null);
    } catch (error) {
      console.error("Error al importar CSV (Añadir):", error);
      setErrorMessage("Error al importar el archivo");
      setErrorModalVisible(true);
    }
  }

  async function handleImportReplace() {
    if (!csvData) return;

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(csvData));
      addAlert(`Se reemplazaron todos los registros (${csvData.length} registros)`, "success");
      setSafeDeleteModalVisible(false);
      setImportModalVisible(false);
      setCsvData(null);
      setImportMode(null);
      setSafeDeleteCounter(5);
    } catch (error) {
      console.error("Error al importar CSV (Sustituir):", error);
      setErrorMessage("Error al importar el archivo");
      setErrorModalVisible(true);
    }
  }

  return (
    <>
      <ScreenContainer className="p-6">
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Título */}
          <View className="mb-8">
            <Text className="text-3xl font-bold text-foreground">Ajustes</Text>
            <Text className="text-sm text-muted mt-1">Gestiona tu aplicación</Text>
          </View>

          {/* Sección Datos */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-4">Datos</Text>
            
            {/* Botón Exportar */}
            <TouchableOpacity
              onPress={exportCSV}
              disabled={isExporting}
              className={`flex-row items-center gap-4 p-4 rounded-lg border mb-3 ${
                isExporting
                  ? "bg-surface/50 border-border/50 opacity-50"
                  : "bg-surface border-border"
              }`}
            >
              <View className="w-12 h-12 rounded-lg bg-primary/10 items-center justify-center">
                <MaterialIcons name="download" size={24} color={colors.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">
                  Exportar CSV
                </Text>
                <Text className="text-sm text-muted mt-1">
                  Descarga tus datos en formato CSV
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
            </TouchableOpacity>

            {/* Botón Importar */}
            <TouchableOpacity
              onPress={pickAndValidateCSV}
              className="flex-row items-center gap-4 p-4 rounded-lg border bg-surface border-border"
            >
              <View className="w-12 h-12 rounded-lg bg-primary/10 items-center justify-center">
                <MaterialIcons name="upload" size={24} color={colors.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">
                  Importar CSV
                </Text>
                <Text className="text-sm text-muted mt-1">
                  Carga datos desde un archivo CSV
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Sección Información */}
          <View className="mt-12 pt-6 border-t border-border">
            <Text className="text-lg font-semibold text-foreground mb-4">Información</Text>
            
            <View className="bg-surface border border-border rounded-lg p-4">
              <View className="mb-3">
                <Text className="text-sm text-muted">Aplicación</Text>
                <Text className="text-base font-semibold text-foreground mt-1">Detector de Matrículas</Text>
              </View>
              <View className="mb-3">
                <Text className="text-sm text-muted">Versión</Text>
                <Text className="text-base font-semibold text-foreground mt-1">v{APP_VERSION}</Text>
              </View>
              <View className="mb-3">
                <Text className="text-sm text-muted">Autor</Text>
                <Text className="text-base font-semibold text-foreground mt-1">@hug0nES</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </ScreenContainer>

      {/* Modal de selección: Añadir o Sustituir */}
      <Modal visible={importModalVisible} transparent animationType="fade">
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "center",
            alignItems: "center",
          }}
          onPress={() => {
            setImportModalVisible(false);
            setCsvData(null);
            setImportMode(null);
          }}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 24,
              width: "85%",
              maxWidth: 350,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.foreground, marginBottom: 16 }}>
              Importar Datos
            </Text>
            <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 24 }}>
              Se encontraron {csvData?.length || 0} registros. ¿Deseas añadirlos o sustituir los actuales?
            </Text>

            <View style={{ gap: 12 }}>
              {/* Botón Añadir */}
              <TouchableOpacity
                onPress={() => {
                  setImportMode("add");
                  handleImportAdd();
                }}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>
                  Añadir
                </Text>
              </TouchableOpacity>

              {/* Botón Sustituir */}
              <TouchableOpacity
                onPress={() => {
                  setImportMode("replace");
                  setSafeDeleteModalVisible(true);
                  setSafeDeleteCounter(5);
                }}
                style={{
                  backgroundColor: colors.warning,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>
                  Sustituir
                </Text>
              </TouchableOpacity>

              {/* Botón Cancelar */}
              <TouchableOpacity
                onPress={() => {
                  setImportModalVisible(false);
                  setCsvData(null);
                  setImportMode(null);
                }}
                style={{
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 16 }}>
                  Cancelar
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de Seguridad: Sustituir con Cuenta Atrás */}
      <Modal visible={safeDeleteModalVisible} transparent animationType="fade">
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "center",
            alignItems: "center",
          }}
          onPress={() => {
            setSafeDeleteModalVisible(false);
            setSafeDeleteCounter(5);
          }}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 24,
              width: "85%",
              maxWidth: 350,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <MaterialIcons name="warning" size={24} color={colors.warning} style={{ marginRight: 8 }} />
              <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.foreground }}>
                Advertencia
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 24 }}>
              Esta acción sustituirá todos los registros actuales. ¿Estás seguro?
            </Text>

            <View style={{ gap: 12 }}>
              {/* Botón SÍ con Cuenta Atrás */}
              <TouchableOpacity
                disabled={safeDeleteCounter > 0}
                onPress={handleImportReplace}
                style={{
                  backgroundColor: safeDeleteCounter > 0 ? "#991B1B" : "#DC2626",
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  alignItems: "center",
                  opacity: safeDeleteCounter > 0 ? 0.6 : 1,
                }}
              >
                <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>
                  {safeDeleteCounter > 0 ? `SÍ (${safeDeleteCounter})` : "SÍ"}
                </Text>
              </TouchableOpacity>

              {/* Botón Cancelar */}
              <TouchableOpacity
                onPress={() => {
                  setSafeDeleteModalVisible(false);
                  setSafeDeleteCounter(5);
                }}
                style={{
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 16 }}>
                  Cancelar
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de Error */}
      <Modal visible={errorModalVisible} transparent animationType="fade">
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "center",
            alignItems: "center",
          }}
          onPress={() => setErrorModalVisible(false)}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 24,
              width: "85%",
              maxWidth: 350,
              borderLeftWidth: 4,
              borderLeftColor: colors.error,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <MaterialIcons name="error" size={24} color={colors.error} style={{ marginRight: 8 }} />
              <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.foreground }}>
                Error
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 24, lineHeight: 20 }}>
              {errorMessage}
            </Text>

            <TouchableOpacity
              onPress={() => setErrorModalVisible(false)}
              style={{
                backgroundColor: colors.error,
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 8,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>
                Entendido
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Alerts overlay */}
      <AlertsOverlay alerts={alerts} onRemoveAlert={removeAlert} />
    </>
  );
}
