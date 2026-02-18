import { View, Text, TouchableOpacity, Image, TextInput, Platform } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ScreenContainer } from "@/components/screen-container";
import type { LicensePlateEntry } from "@/types/license-plate";

const STORAGE_KEY = "license_plates";
const FILE_PATH = FileSystem.documentDirectory + "matriculas.txt";

export default function ResultScreen() {
  const params = useLocalSearchParams<{
    licensePlate: string;
    confidence: "high" | "medium" | "low";
    imageUri: string;
  }>();

  const [licensePlate, setLicensePlate] = useState(params.licensePlate || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const confidenceColor =
    params.confidence === "high"
      ? "text-success"
      : params.confidence === "medium"
      ? "text-warning"
      : "text-error";

  const confidenceText =
    params.confidence === "high"
      ? "Alta confianza"
      : params.confidence === "medium"
      ? "Confianza media"
      : "Baja confianza";

  async function saveLicensePlate() {
    if (!licensePlate.trim()) {
      alert("Por favor, ingresa una matrícula válida");
      return;
    }

    try {
      setIsSaving(true);

      // Crear entrada
      const entry: LicensePlateEntry = {
        id: Date.now().toString(),
        licensePlate: licensePlate.trim().toUpperCase(),
        timestamp: Date.now(),
        imageUri: params.imageUri,
        confidence: params.confidence,
      };

      // Guardar en AsyncStorage para historial
      const existingData = await AsyncStorage.getItem(STORAGE_KEY);
      const entries: LicensePlateEntry[] = existingData ? JSON.parse(existingData) : [];
      entries.unshift(entry); // Agregar al inicio
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

      // Guardar en archivo de texto
      const timestamp = new Date(entry.timestamp).toLocaleString("es-ES");
      const line = `${entry.licensePlate} | ${timestamp}\n`;

      // Verificar si el archivo existe
      const fileInfo = await FileSystem.getInfoAsync(FILE_PATH);
      if (fileInfo.exists) {
        // Agregar al final del archivo
        const existingContent = await FileSystem.readAsStringAsync(FILE_PATH);
        await FileSystem.writeAsStringAsync(FILE_PATH, existingContent + line);
      } else {
        // Crear archivo nuevo con encabezado
        const header = "MATRÍCULAS DETECTADAS\n" + "=".repeat(50) + "\n\n";
        await FileSystem.writeAsStringAsync(FILE_PATH, header + line);
      }

      // Feedback háptico
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Navegar al historial
      router.replace("/history");
    } catch (error) {
      console.error("Error al guardar matrícula:", error);
      alert("Error al guardar la matrícula. Por favor, inténtalo de nuevo.");

      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsSaving(false);
    }
  }

  function discard() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  }

  function retry() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  }

  return (
    <ScreenContainer className="flex-1 p-6">
      <View className="flex-1 gap-6">
        {/* Título */}
        <View>
          <Text className="text-3xl font-bold text-foreground">Matrícula Detectada</Text>
          <Text className={`text-base mt-1 ${confidenceColor}`}>{confidenceText}</Text>
        </View>

        {/* Imagen capturada */}
        {params.imageUri && (
          <View className="bg-surface rounded-2xl overflow-hidden border border-border">
            <Image
              source={{ uri: params.imageUri }}
              style={{ width: "100%", height: 200 }}
              resizeMode="cover"
            />
          </View>
        )}

        {/* Matrícula detectada */}
        <View className="bg-surface rounded-2xl p-6 border border-border">
          <Text className="text-sm text-muted mb-2">Matrícula</Text>
          {isEditing ? (
            <TextInput
              value={licensePlate}
              onChangeText={setLicensePlate}
              autoCapitalize="characters"
              autoCorrect={false}
              className="text-4xl font-bold text-primary"
              style={{ fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }}
              onBlur={() => setIsEditing(false)}
              autoFocus
            />
          ) : (
            <TouchableOpacity onPress={() => setIsEditing(true)}>
              <Text
                className="text-4xl font-bold text-primary"
                style={{ fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }}
              >
                {licensePlate}
              </Text>
              <Text className="text-xs text-muted mt-2">Toca para editar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Botones de acción */}
        <View className="flex-1 justify-end gap-3">
          <TouchableOpacity
            onPress={saveLicensePlate}
            disabled={isSaving}
            className="bg-primary py-4 rounded-full"
            style={{ opacity: isSaving ? 0.5 : 1 }}
          >
            <Text className="text-background font-bold text-center text-lg">
              {isSaving ? "Guardando..." : "Guardar Matrícula"}
            </Text>
          </TouchableOpacity>

          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={discard}
              disabled={isSaving}
              className="flex-1 bg-surface border border-border py-4 rounded-full"
            >
              <Text className="text-foreground font-semibold text-center text-base">
                Descartar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={retry}
              disabled={isSaving}
              className="flex-1 bg-surface border border-border py-4 rounded-full"
            >
              <Text className="text-foreground font-semibold text-center text-base">
                Reintentar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}
