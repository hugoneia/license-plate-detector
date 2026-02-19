import { useRef, useState, useCallback, useEffect } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  PanResponder,
  Animated,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
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
  const [initialDistance, setInitialDistance] = useState(0);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const { alerts, addAlert, removeAlert } = useAlerts();
  const { getCurrentLocation } = useGeolocation();

  const detectMutation = trpc.licensePlate.detect.useMutation();

  // Monitoreo reactivo de GPS con listeners que se actualizan en tiempo real
  useEffect(() => {
    if (Platform.OS === "web") {
      setGpsEnabled(false);
      return;
    }

    let subscription: Location.LocationSubscription | null = null;
    let statusCheckInterval: ReturnType<typeof setInterval> | null = null;

    async function setupGpsMonitoring() {
      try {
        // Verificar estado inicial
        const enabled = await Location.hasServicesEnabledAsync();
        setGpsEnabled(enabled);

        // Usar watchPositionAsync para detectar cambios
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          () => {
            setGpsEnabled(true);
          }
        );

        // Verificar estado de GPS cada 2 segundos para detectar cambios
        statusCheckInterval = setInterval(async () => {
          try {
            const enabled = await Location.hasServicesEnabledAsync();
            setGpsEnabled(enabled);
          } catch (error) {
            console.error("Error verificando GPS:", error);
          }
        }, 2000);
      } catch (error) {
        console.error("Error en monitoreo GPS:", error);
        setGpsEnabled(false);
      }
    }

    setupGpsMonitoring();

    return () => {
      if (subscription) {
        subscription.remove();
      }
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }
    };
  }, []);

  // Configurar pan responder para detectar pinch mejorado
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          // Calcular distancia entre dos dedos
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const currentDistance = Math.sqrt(dx * dx + dy * dy);

          // En el primer toque, guardar la distancia inicial
          if (initialDistance === 0) {
            setInitialDistance(currentDistance);
          } else {
            // Calcular cambio en distancia
            const distanceChange = currentDistance - initialDistance;
            // Convertir a zoom (0 a 1 = 100% a 200%)
            const zoomChange = distanceChange / 200; // Escala sensible
            const newZoom = Math.min(Math.max(zoomChange, 0), 1);
            setZoom(newZoom);
          }
        }
      },
      onPanResponderRelease: () => {
        setInitialDistance(0);
      },
    })
  ).current;

  // Solicitar permisos de cámara
  useEffect(() => {
    (async () => {
      const { status } = await requestPermission();
      if (status !== "granted") {
        alert("Se necesita permiso de cámara para usar esta aplicación");
      }
    })();
  }, [requestPermission]);

  const takePicture = useCallback(async () => {
    if (!cameraRef.current || isProcessing) return;

    try {
      setIsProcessing(true);
      const startTime = Date.now();

      // Capturar foto
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });

      // Obtener ubicación en paralelo
      const location = await getCurrentLocation();

      // Detectar matrícula
      const result = await detectMutation.mutateAsync({
        imageBase64: photo.base64 || "",
      });

      // Verificar si la matrícula ya existe
      const existingData = await AsyncStorage.getItem(STORAGE_KEY);
      const entries: LicensePlateEntry[] = existingData
        ? JSON.parse(existingData)
        : [];
      const isDuplicate = entries.some(
        (e) => e.licensePlate === result.licensePlate
      );

      // Guardar en AsyncStorage
      const newEntry: LicensePlateEntry = {
        id: `${result.licensePlate}-${Date.now()}`,
        licensePlate: result.licensePlate,
        timestamp: Date.now(),
        location: location,
        confidence: (result.confidence || "medium") as "high" | "medium" | "low",
      };

      entries.push(newEntry);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

      const processingTime = Date.now() - startTime;
      console.log(`Tiempo total de procesamiento: ${processingTime}ms`);

      // Feedback inmediato con símbolo y color apropiado
      const symbol = isDuplicate ? "✓ ⚠️" : "✓";
      const alertType = isDuplicate ? "warning" : "success";
      addAlert(`${symbol} ${result.licensePlate}`, alertType, 1500);

      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Error al capturar foto:", error);
      addAlert("Error al detectar matrícula", "error", 2000);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, getCurrentLocation, detectMutation, addAlert]);

  if (!permission) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" />
      </ScreenContainer>
    );
  }

  if (!permission.granted) {
    return (
      <ScreenContainer className="items-center justify-center gap-4">
        <Text className="text-foreground text-center">
          Se necesita permiso de cámara
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="bg-primary px-6 py-3 rounded-full"
        >
          <Text className="text-background font-semibold">Solicitar permiso</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-0" edges={["top", "left", "right"]}>
      <AlertOverlay alerts={alerts} />

      <View className="flex-1 bg-black relative" {...panResponder.panHandlers}>
        <CameraView
          ref={cameraRef}
          style={{
            flex: 1,
            transform: [{ scale: 1 + zoom }],
          }}
          facing="back"
        />

        {/* Marco de referencia */}
        <View className="absolute inset-0 items-center justify-center pointer-events-none">
          <View
            className="border-2 border-yellow-400"
            style={{
              width: "80%",
              aspectRatio: 3.5,
              borderRadius: 12,
            }}
          />
        </View>

        {/* Indicador de GPS */}
        <View className="absolute top-4 right-4 bg-black/60 px-3 py-2 rounded-lg">
          <Text className="text-white text-sm font-semibold">
            {gpsEnabled ? "🛰️ GPS ACTIVO" : "🛰️ GPS INACTIVO"}
          </Text>
        </View>

        {/* Indicador de procesamiento */}
        {isProcessing && (
          <View className="absolute inset-0 bg-black/50 items-center justify-center">
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        )}
      </View>

      {/* Botón de captura */}
      <View className="bg-background px-6 py-8 items-center">
        <TouchableOpacity
          onPress={takePicture}
          disabled={isProcessing}
          style={{
            opacity: isProcessing ? 0.5 : 1,
          }}
          className="items-center justify-center"
        >
          {/* Borde exterior blanco */}
          <View
            className="border-4 border-white rounded-full"
            style={{
              width: 80,
              height: 80,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {/* Borde interior blanco separado */}
            <View
              className="border-3 border-white rounded-full bg-white"
              style={{
                width: 70,
                height: 70,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <MaterialIcons name="camera-alt" size={32} color="black" />
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

// Importar CameraView
import { CameraView, useCameraPermissions } from "expo-camera";
