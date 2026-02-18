import { View, Text, FlatList, TouchableOpacity, TextInput, Alert, Platform } from "react-native";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import type { LicensePlateEntry } from "@/types/license-plate";

const STORAGE_KEY = "license_plates";
const FILE_PATH = FileSystem.documentDirectory + "matriculas.txt";

export default function HistoryScreen() {
  const [entries, setEntries] = useState<LicensePlateEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadEntries();
  }, []);

  async function loadEntries() {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        setEntries(JSON.parse(data));
      }
    } catch (error) {
      console.error("Error al cargar historial:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteEntry(id: string) {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    Alert.alert(
      "Eliminar Matrícula",
      "¿Estás seguro de que deseas eliminar esta matrícula del historial?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const updatedEntries = entries.filter((entry) => entry.id !== id);
              setEntries(updatedEntries);
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedEntries));

              if (Platform.OS !== "web") {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  async function exportFile() {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Verificar si el archivo existe
      const fileInfo = await FileSystem.getInfoAsync(FILE_PATH);
      if (!fileInfo.exists) {
        alert("No hay matrículas guardadas para exportar");
        return;
      }

      // Verificar si el sistema de compartir está disponible
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        alert("La función de compartir no está disponible en este dispositivo");
        return;
      }

      // Compartir el archivo
      await Sharing.shareAsync(FILE_PATH, {
        mimeType: "text/plain",
        dialogTitle: "Exportar Matrículas",
        UTI: "public.plain-text",
      });

      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Error al exportar archivo:", error);
      alert("Error al exportar el archivo");
    }
  }

  const filteredEntries = entries.filter((entry) =>
    entry.licensePlate.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function renderEntry({ item }: { item: LicensePlateEntry }) {
    const date = new Date(item.timestamp);
    const dateStr = date.toLocaleDateString("es-ES");
    const timeStr = date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

    const confidenceColor =
      item.confidence === "high"
        ? "bg-success"
        : item.confidence === "medium"
        ? "bg-warning"
        : "bg-error";

    return (
      <View className="bg-surface rounded-2xl p-4 mb-3 border border-border">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text
              className="text-2xl font-bold text-foreground mb-1"
              style={{ fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }}
            >
              {item.licensePlate}
            </Text>
            <View className="flex-row items-center gap-2">
              <View className={`w-2 h-2 rounded-full ${confidenceColor}`} />
              <Text className="text-sm text-muted">
                {dateStr} • {timeStr}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => deleteEntry(item.id)}
            className="bg-error/10 px-4 py-2 rounded-full"
          >
            <Text className="text-error font-semibold">Eliminar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScreenContainer className="flex-1 p-6">
      <View className="flex-1 gap-4">
        {/* Encabezado */}
        <View>
          <Text className="text-3xl font-bold text-foreground">Historial</Text>
          <Text className="text-base text-muted mt-1">
            {entries.length} {entries.length === 1 ? "matrícula" : "matrículas"} guardadas
          </Text>
        </View>

        {/* Barra de búsqueda */}
        <View className="bg-surface rounded-full px-4 py-3 border border-border">
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar matrícula..."
            placeholderTextColor="#9BA1A6"
            autoCapitalize="characters"
            autoCorrect={false}
            className="text-foreground text-base"
          />
        </View>

        {/* Lista de matrículas */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-muted">Cargando...</Text>
          </View>
        ) : filteredEntries.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-muted text-center">
              {searchQuery
                ? "No se encontraron matrículas"
                : "No hay matrículas guardadas todavía"}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredEntries}
            renderItem={renderEntry}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        )}

        {/* Botón de exportar */}
        {entries.length > 0 && (
          <View className="absolute bottom-6 left-6 right-6">
            <TouchableOpacity
              onPress={exportFile}
              className="bg-primary py-4 rounded-full"              style={{ opacity: 1 }}
            >
              <Text className="text-background font-bold text-center text-lg">
                Exportar Archivo
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
