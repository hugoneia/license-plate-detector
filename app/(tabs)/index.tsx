import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState, useCallback } from "react";
import { Text, View, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ScreenContainer } from "@/components/screen-container";
import { AlertOverlay } from "@/components/alert-overlay";
import { trpc } from "@/lib/trpc";
import { useAlerts } from "@/hooks/use-alerts";
import { useGeolocation } from "@/hooks/use-geolocation";
import type { LicensePlateEntry } from "@/types/license-plate";

const STORAGE_KEY = "license_plates";

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const { alerts, addAlert, removeAlert } = useAlerts();
  const { getCurrentLocation } = useGeolocation();

  const detectMutation = trpc.licensePlate.detect.useMutation();

  async function captureAndDetect() {
    if (isProcessing) return;

    try {
      setIsProcessing(true);

      // Capturar foto
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.8,
        base64: true,
        skipProcessing: false,
      });

      if (!photo || !photo.base64) {
        addAlert("Error al capturar foto", "error", 2000);
        return;
      }

      // Detectar matrícula
      const result = await detectMutation.mutateAsync({
        imageBase64: photo.base64,
        mimeType: "image/jpeg",
      });

      // Obtener ubicación
      const location = await getCurrentLocation();

      // Crear entrada
      const entry: LicensePlateEntry = {
        id: Date.now().toString(),
        licensePlate: result.licensePlate.toUpperCase(),
        timestamp: Date.now(),
        imageUri: photo.uri,
        confidence: (result.confidence as "high" | "medium" | "low") || "medium",
        location,
      };

      // Guardar en AsyncStorage
      const existingData = await AsyncStorage.getItem(STORAGE_KEY);
      const entries: LicensePlateEntry[] = existingData ? JSON.parse(existingData) : [];
      entries.unshift(entry);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

      // Feedback inmediato
      addAlert(`✓ ${result.licensePlate} registrada`, "success", 2000);

      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Error en detección:", error);
      addAlert("No se pudo detectar la matrícula", "error", 2000);
    } finally {
      setIsProcessing(false);
    }
  }

  if (!permission) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center p-6">
        <ActivityIndicator size="large" />
      </ScreenContainer>
    );
  }

  if (!permission.granted) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center p-6">
        <View className="items-center gap-4">
          <Text className="text-2xl font-bold text-foreground text-center">
            Permiso de Cámara
          </Text>
          <Text className="text-base text-muted text-center">
            Necesitamos acceso a tu cámara para detectar matrículas
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            className="bg-primary px-8 py-4 rounded-full mt-4"
            style={{ opacity: 1 }}
          >
            <Text className="text-background font-semibold text-base">Permitir Acceso</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]} className="flex-1">
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
        {/* Overlay con guía visual */}
        <View className="flex-1 items-center justify-center">
          {/* Área de enfoque para la matrícula */}
          <View
            style={{
              borderColor: "#0066CC",
              width: 320,
              height: 100,
              borderWidth: 3,
              borderRadius: 16,
              opacity: 0.6,
            }}
          >
            <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-2xl" />
            <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-2xl" />
            <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-2xl" />
            <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-2xl" />
          </View>

          {/* Texto de instrucción */}
          <Text
            className="text-white text-center mt-4 px-6 text-base font-medium"
            style={{
              textShadowColor: "rgba(0, 0, 0, 0.75)",
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 3,
            }}
          >
            {isProcessing ? "Procesando..." : "Alinea la matrícula dentro del marco"}
          </Text>
        </View>

        {/* Botones inferiores */}
        <View className="absolute bottom-0 left-0 right-0 pb-12 items-center gap-4">
          {/* Botón de captura manual (estilo Android) */}
          <TouchableOpacity
            onPress={captureAndDetect}
            disabled={isProcessing}
            style={{
              width: 70,
              height: 70,
              borderRadius: 35,
              backgroundColor: "white",
              borderWidth: 4,
              borderColor: "rgba(255, 255, 255, 0.5)",
              opacity: isProcessing ? 0.5 : 1,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: "white",
              }}
            />
          </TouchableOpacity>

          {/* Botón de historial */}
          <TouchableOpacity
            onPress={() => router.push("/history")}
            className="bg-white rounded-full px-6 py-3"
            style={{ opacity: 1 }}
          >
            <Text className="text-primary font-bold text-base">📋 HISTORIAL</Text>
          </TouchableOpacity>
        </View>
      </CameraView>

      {/* Alertas */}
      {alerts.map((alert) => (
        <AlertOverlay key={alert.id} alert={alert} onDismiss={removeAlert} />
      ))}
    </ScreenContainer>
  );
}
