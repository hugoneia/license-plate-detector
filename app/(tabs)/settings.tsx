import { useState, useCallback, useRef, useEffect } from "react";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { View, Text, TouchableOpacity, ScrollView, Modal, Pressable, Alert } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { AlertsOverlay } from "@/components/alerts-overlay";
import { useAlerts } from "@/hooks/use-alerts";
import { useColors } from "@/hooks/use-colors";

import type { LicensePlateEntry } from "@/types/license-plate";

const STORAGE_KEY = "license_plates";
const APP_VERSION = Constants.expoConfig?.version || "1.0.0";

export default function SettingsScreen() {
  const { alerts, addAlert, removeAlert } = useAlerts();
  const colors = useColors();
  const [isExporting, setIsExporting] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importMode, setImportMode] = useState<"add" | "replace" | null>(null);
  const [safeDeleteModalVisible, setSafeDeleteModalVisible] = useState(false);
  const [safeDeleteCounter, setSafeDeleteCounter] = useState(5);
  const [csvData, setCsvData] = useState<string | null>(null);
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

  // Validar formato CSV
  function validateCSVFormat(content: string): LicensePlateEntry[] | null {
    try {
      const lines = content.trim().split("\n");
      if (lines.length < 2) {
        addAlert("El archivo CSV está vacío o tiene formato inválido", "error");
        return null;
      }

      // Saltar encabezado
      const dataLines = lines.slice(1);
      const entries: LicensePlateEntry[] = [];

      for (const line of dataLines) {
        if (!line.trim()) continue;

        const parts = line.split(",");
        if (parts.length < 5) {
          addAlert("El archivo CSV tiene un formato incorrecto", "error");
          return null;
        }

        const licensePlate = parts[0].trim();
        const dateStr = parts[1].trim();
        const timeStr = parts[2].trim();
        const locationStr = parts[3].trim();
        const lugarCode = parts[4].trim();

        // Validar matrícula
        if (!/^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/.test(licensePlate)) {
          addAlert(`Matrícula inválida: ${licensePlate}`, "error");
          return null;
        }

        // Parsear fecha y hora
        const dateTimeParts = `${dateStr} ${timeStr}`.split("/");
        if (dateTimeParts.length < 3) {
          addAlert("Formato de fecha inválido", "error");
          return null;
        }

        const [day, month, year] = dateStr.split("/").map(Number);
        const [hour, minute] = timeStr.split(":").map(Number);

        if (!day || !month || !year || hour === undefined || minute === undefined) {
          addAlert("Formato de fecha/hora inválido", "error");
          return null;
        }

        const timestamp = new Date(year, month - 1, day, hour, minute).getTime();

        // Parsear ubicación GPS
        let location: any = "NO GPS";
        if (locationStr !== "NO GPS") {
          const [lat, lng] = locationStr.split(",").map(Number);
          if (lat && lng) {
            location = { latitude: lat, longitude: lng };
          }
        }

        // Parsear ubicación de estacionamiento
        let parkingLocation: "acera" | "doble_fila" | null = null;
        if (lugarCode === "AC") parkingLocation = "acera";
        else if (lugarCode === "DF") parkingLocation = "doble_fila";

        entries.push({
          id: `${licensePlate}-${timestamp}`,
          licensePlate,
          timestamp,
          confidence: "high",
          location,
          parkingLocation: parkingLocation || null,
        });
      }

      return entries;
    } catch (error) {
      console.error("Error validando CSV:", error);
      addAlert("Error al validar el archivo CSV", "error");
      return null;
    }
  }

  async function pickAndValidateCSV() {
    try {
      // Mostrar alerta para que el usuario copie el contenido CSV
      Alert.alert(
        "Importar CSV",
        "Por favor, copia el contenido del archivo CSV y pégalo aquí.",
        [
          {
            text: "Cancelar",
            onPress: () => {},
            style: "cancel",
          },
          {
            text: "OK",
            onPress: async () => {
              // Para esta versión, usaremos un placeholder
              // En una versión completa, se usaría expo-document-picker
              addAlert("Por favor, usa la función de exportar para obtener el formato correcto", "info");
            },
          },
        ]
      );
    } catch (error) {
      console.error("Error al seleccionar archivo:", error);
      addAlert("Error al seleccionar el archivo", "error");
    }
  }

  // Función alternativa para importar desde texto pegado
  async function importFromPastedText(csvText: string) {
    try {
      const validatedEntries = validateCSVFormat(csvText);
      if (!validatedEntries) {
        return;
      }

      setCsvData(JSON.stringify(validatedEntries));
      setImportModalVisible(true);
    } catch (error) {
      console.error("Error al validar CSV pegado:", error);
      addAlert("Error al validar el contenido", "error");
    }
  }

  async function handleImportAdd() {
    if (!csvData) return;

    try {
      const currentData = await AsyncStorage.getItem(STORAGE_KEY);
      const currentEntries: LicensePlateEntry[] = currentData ? JSON.parse(currentData) : [];
      const newEntries: LicensePlateEntry[] = JSON.parse(csvData);

      // Combinar sin duplicados
      const combined = [...currentEntries];
      newEntries.forEach((newEntry) => {
        if (!combined.find((e) => e.id === newEntry.id)) {
          combined.push(newEntry);
        }
      });

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(combined));
      addAlert(`Se agregaron ${newEntries.length} registros`, "success");
      setImportModalVisible(false);
      setCsvData(null);
      setImportMode(null);
    } catch (error) {
      console.error("Error al importar CSV (Añadir):", error);
      addAlert("Error al importar el archivo", "error");
    }
  }

  async function handleImportReplace() {
    if (!csvData) return;

    try {
      const newEntries: LicensePlateEntry[] = JSON.parse(csvData);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries));
      addAlert(`Se reemplazaron todos los registros (${newEntries.length} registros)`, "success");
      setSafeDeleteModalVisible(false);
      setImportModalVisible(false);
      setCsvData(null);
      setImportMode(null);
      setSafeDeleteCounter(5);
    } catch (error) {
      console.error("Error al importar CSV (Sustituir):", error);
      addAlert("Error al importar el archivo", "error");
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
              ¿Deseas añadir los datos o sustituir los registros actuales?
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
            <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.foreground, marginBottom: 12 }}>
              ⚠️ Advertencia
            </Text>
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

      {/* Alerts overlay */}
      <AlertsOverlay alerts={alerts} onRemoveAlert={removeAlert} />
    </>
  );
}
