import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState, useEffect, useCallback } from "react";
import { Text, View, TouchableOpacity, ActivityIndicator, Platform, Animated } from "react-native";
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
  const [plateDetected, setPlateDetected] = useState(false);
  const [noDetectionTimer, setNoDetectionTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [canManualCapture, setCanManualCapture] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const frameColorAnim = useRef(new Animated.Value(0)).current;
  const { alerts, addAlert, removeAlert } = useAlerts();
  const { getCurrentLocation } = useGeolocation();

  const detectMutation = trpc.licensePlate.detect.useMutation();

  // Actualizar cuando se enfoca la pantalla
  useFocusEffect(
    useCallback(() => {
      // Resetear estado
      setPlateDetected(false);
      setCanManualCapture(false);

      // Iniciar timer de 3 segundos para botón manual
      const timer = setTimeout(() => {
        setCanManualCapture(true);
      }, 3000);

      setNoDetectionTimer(timer);

      return () => {
        if (timer) clearTimeout(timer);
      };
    }, [])
  );

  // Animación del marco
  useEffect(() => {
    if (plateDetected) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(frameColorAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: false,
          }),
          Animated.timing(frameColorAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      frameColorAnim.setValue(0);
    }
  }, [plateDetected, frameColorAnim]);

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

      // Resetear estado
      setPlateDetected(false);
      setCanManualCapture(false);

      // Reiniciar timer
      if (noDetectionTimer) clearTimeout(noDetectionTimer);
      const newTimer = setTimeout(() => {
        setCanManualCapture(true);
      }, 3000) as ReturnType<typeof setTimeout>;
      setNoDetectionTimer(newTimer);
    } catch (error) {
      console.error("Error en detección:", error);
      addAlert("No se pudo detectar la matrícula", "error", 2000);
      setPlateDetected(false);
    } finally {
      setIsProcessing(false);
    }
  }

  // Simular detección continua (en producción usaría vision API más eficiente)
  useEffect(() => {
    if (!permission?.granted || isProcessing) return;

    const interval = setInterval(async () => {
      try {
        // Capturar frame de video
        const photo = await cameraRef.current?.takePictureAsync({
          quality: 0.5,
          base64: true,
          skipProcessing: true,
        });

        if (!photo || !photo.base64) return;

        // Detectar si hay matrícula (sin leerla)
        const result = await detectMutation.mutateAsync({
          imageBase64: photo.base64,
          mimeType: "image/jpeg",
        });

        // Si detecta matrícula válida
        if (result.isValid && !plateDetected) {
          setPlateDetected(true);

          if (Platform.OS !== "web") {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }

          // Capturar automáticamente después de detectar
          setTimeout(() => {
            captureAndDetect();
          }, 500);
        }
      } catch (error) {
        // Silenciar errores de detección
      }
    }, 800); // Revisar cada 800ms

    return () => clearInterval(interval);
  }, [permission?.granted, isProcessing, plateDetected, detectMutation]);

  const frameColor = frameColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(0, 102, 204, 0.5)", "rgba(34, 197, 94, 0.8)"],
  });

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
            Necesitamos acceso a tu cámara para detectar matrículas automáticamente
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
          <Animated.View
            style={{
              borderColor: frameColor as any,
              width: 320,
              height: 100,
              borderWidth: 4,
              borderRadius: 16,
              opacity: 0.7,
            }}
          >
            <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-2xl" />
            <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-2xl" />
            <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-2xl" />
            <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-2xl" />
          </Animated.View>

          {/* Texto de instrucción */}
          <Text
            className="text-white text-center mt-4 px-6 text-base font-medium"
            style={{
              textShadowColor: "rgba(0, 0, 0, 0.75)",
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 3,
            }}
          >
            {isProcessing
              ? "Procesando..."
              : plateDetected
              ? "✓ Matrícula detectada"
              : "Alinea la matrícula dentro del marco"}
          </Text>
        </View>

        {/* Botones inferiores */}
        <View className="absolute bottom-0 left-0 right-0 pb-12 items-center gap-4">
          {/* Botón manual (aparece después de 3 segundos) */}
          {canManualCapture && !plateDetected && (
            <TouchableOpacity
              onPress={captureAndDetect}
              disabled={isProcessing}
              className="bg-warning px-8 py-3 rounded-full"
              style={{ opacity: isProcessing ? 0.5 : 1 }}
            >
              <Text className="text-background font-bold text-base">📷 Capturar Manualmente</Text>
            </TouchableOpacity>
          )}

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
