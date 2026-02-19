import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState, useCallback } from "react";
import { Text, View, TouchableOpacity, ActivityIndicator, Platform, Animated, PanResponder } from "react-native";
import * as Haptics from "expo-haptics";
import { MaterialIcons } from "@expo/vector-icons";
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
  const [zoom, setZoom] = useState(0);
  const cameraRef = useRef<CameraView>(null);
  const { alerts, addAlert, removeAlert } = useAlerts();
  const { getCurrentLocation } = useGeolocation();
  const zoomAnim = useRef(new Animated.Value(0)).current;

  const detectMutation = trpc.licensePlate.detect.useMutation();

  // Configurar pan responder para detectar pinch
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          // Calcular distancia entre dos dedos
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Ajustar zoom (0 a 1)
          const newZoom = Math.min(Math.max((distance - 50) / 150, 0), 1);
          setZoom(newZoom);
        }
      },
      onPanResponderRelease: () => {
        // Resetear zoom al soltar
        setZoom(0);
      },
    })
  ).current;

  async function checkIfDuplicate(licensePlate: string): Promise<boolean> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const entries: LicensePlateEntry[] = JSON.parse(data);
        return entries.some((e) => e.licensePlate.toUpperCase() === licensePlate.toUpperCase());
      }
      return false;
    } catch {
      return false;
    }
  }

  async function captureAndDetect() {
    if (isProcessing) return;

    try {
      setIsProcessing(true);
      const startTime = Date.now();

      // Capturar foto
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.8,
        base64: true,
        skipProcessing: false,
      });

      if (!photo || !photo.base64) {
        addAlert("Error al capturar foto", "error", 2000);
        setIsProcessing(false);
        return;
      }

      // Detectar matrícula (en paralelo con geolocalización)
      const [result, location] = await Promise.all([
        detectMutation.mutateAsync({
          imageBase64: photo.base64,
          mimeType: "image/jpeg",
        }),
        getCurrentLocation(),
      ]);

      // Verificar si es duplicado
      const isDuplicate = await checkIfDuplicate(result.licensePlate);

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

      const processingTime = Date.now() - startTime;
      console.log(`Tiempo total de procesamiento: ${processingTime}ms`);

      // Feedback inmediato con símbolo apropiado
      const symbol = isDuplicate ? "✓ ⓘ" : "✓";
      addAlert(`${symbol} ${result.licensePlate}`, "success", 1500);

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
      <ScreenContainer className="flex-1 items-center justify-center">
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
      <View {...panResponder.panHandlers} style={{ flex: 1 }}>
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="back"
          zoom={zoom}
        >
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

            {/* Indicador de zoom */}
            {zoom > 0 && (
              <Text
                className="text-white text-center mt-2 text-sm font-medium"
                style={{
                  textShadowColor: "rgba(0, 0, 0, 0.75)",
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 3,
                }}
              >
                Zoom: {Math.round(zoom * 100)}%
              </Text>
            )}
          </View>

          {/* Botón de captura mejorado */}
          <View className="absolute bottom-0 left-0 right-0 pb-12 items-center">
            <TouchableOpacity
              onPress={captureAndDetect}
              disabled={isProcessing}
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: "white",
                borderWidth: 6,
                borderColor: "white",
                opacity: isProcessing ? 0.5 : 1,
                justifyContent: "center",
                alignItems: "center",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                elevation: 8,
              }}
            >
              {/* Borde interior separado */}
              <View
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 34,
                  borderWidth: 4,
                  borderColor: "white",
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: "#0066CC",
                }}
              >
                {/* Icono de cámara */}
                <MaterialIcons name="camera-alt" size={32} color="white" />
              </View>
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>

      {/* Alertas */}
      {alerts.map((alert) => (
        <AlertOverlay key={alert.id} alert={alert} onDismiss={removeAlert} />
      ))}
    </ScreenContainer>
  );
}
