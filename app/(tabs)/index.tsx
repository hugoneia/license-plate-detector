import { useState, useCallback, useEffect, useRef } from "react";
import { useFocusEffect } from "expo-router";
import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ScreenContainer } from "@/components/screen-container";
import { AlertsOverlay } from "@/components/alerts-overlay";
import { QuickEntryModal } from "@/components/quick-entry-modal";
import { trpc } from "@/lib/trpc";
import { useAlerts } from "@/hooks/use-alerts";
import { useGeolocation } from "@/hooks/use-geolocation";
import type { LicensePlateEntry, GeoLocation } from "@/types/license-plate";
import Constants from "expo-constants";

const STORAGE_KEY = "license_plates";
const APP_VERSION = Constants.expoConfig?.version || "1.0.0";

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [quickEntryVisible, setQuickEntryVisible] = useState(false);
  const [quickEntryLoading, setQuickEntryLoading] = useState(false);
  const [capturedLocation, setCapturedLocation] = useState<GeoLocation | null>(null);

  const [gpsEnabled, setGpsEnabled] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const isQuickEntryProcessing = useRef(false);
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



  // Solicitar permisos de cámara
  useEffect(() => {
    (async () => {
      const { status } = await requestPermission();
      if (status !== "granted") {
        alert("Se necesita permiso de cámara para usar esta aplicación");
      }
    })();
  }, [requestPermission]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const enabled = await Location.hasServicesEnabledAsync();
          setGpsEnabled(enabled);
        } catch (error) {
          console.error("Error al actualizar GPS:", error);
        }
      })();

      // Forzar re-render de la camara para evitar pantalla negra
      // El delay pequeno asegura que la vista esta lista
      const timer = setTimeout(() => {
        if (cameraRef.current) {
          console.log("Camara reactivada al cargar vista");
        }
      }, 100);

      return () => clearTimeout(timer);
    }, [setGpsEnabled])
  );

  /**
   * Calcula distancia entre dos coordenadas GPS en metros
   * Usa fórmula de Haversine
   */
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Radio de la Tierra en metros
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  const handleQuickEntryPress = useCallback(async () => {
    // Evitar multiples pulsaciones simultaneas
    if (isQuickEntryProcessing.current) return;
    
    try {
      isQuickEntryProcessing.current = true;
      // Mostrar modal inmediatamente sin esperar GPS
      setQuickEntryVisible(true);
      
      // Capturar ubicacion en paralelo (sin bloquear)
      getCurrentLocation()
        .then((location) => {
          setCapturedLocation(location && location !== "NO GPS" ? location : null);
        })
        .catch((error) => {
          console.error("Error al capturar ubicacion:", error);
          addAlert("Error al obtener ubicacion GPS", "error");
        });
    } finally {
      isQuickEntryProcessing.current = false;
    }
  }, [getCurrentLocation, addAlert]);

  const handleQuickEntrySubmit = useCallback(
    async (licensePlate: string, parkingLocation: "acera" | "doble_fila") => {
      try {
        setQuickEntryLoading(true);

        // Obtener datos existentes
        const existingData = await AsyncStorage.getItem(STORAGE_KEY);
        const entries: LicensePlateEntry[] = existingData
          ? JSON.parse(existingData)
          : [];

        // Verificar si la matrícula ya existe
        const plateExists = entries.some(
          (e) => e.licensePlate.toUpperCase() === licensePlate.toUpperCase()
        );

        // Crear nueva entrada
        const newEntry: LicensePlateEntry = {
          id: `${licensePlate}-${Date.now()}`,
          licensePlate: licensePlate,
          timestamp: Date.now(),
          location: capturedLocation || "NO GPS",
          confidence: "high",
          parkingLocation: parkingLocation,
        };

        // Guardar en AsyncStorage
        entries.push(newEntry);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

        // Feedback al usuario
        if (plateExists) {
          addAlert(`${licensePlate} ya ha sido registrada`, "warning", 2000);
        } else {
          addAlert("Registro guardado correctamente", "success", 2000);
        }

        // Cerrar modal
        setQuickEntryVisible(false);
        setCapturedLocation(null);
      } catch (error) {
        console.error("Error al guardar entrada rápida:", error);
        addAlert("Error al registrar", "error");
      } finally {
        setQuickEntryLoading(false);
      }
    },
    [capturedLocation, addAlert]
  );

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

      // Detectar matrícula (operación más lenta)
      setIsDetecting(true);
      const result = await detectMutation.mutateAsync({
        imageBase64: photo.base64 || "",
      });
      setIsDetecting(false);

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

      // Verificar patrón de estacionamiento reincidente
      let detectionCount = 0;
      if (location && location !== "NO GPS") {
        const plateEntries = entries.filter((e) => e.licensePlate === result.licensePlate);

        // Contar detecciones en radio de 100m
        plateEntries.forEach((entry) => {
          if (entry.location && entry.location !== "NO GPS") {
            const distance = calculateDistance(
              location.latitude,
              location.longitude,
              entry.location.latitude,
              entry.location.longitude
            );
            if (distance <= 100) {
              detectionCount++;
            }
          }
        });
      }

      // Feedback inmediato con color apropiado
      const alertType = isDuplicate ? "warning" : "success";
      addAlert(result.licensePlate, alertType, 1500);

      // Mostrar alerta de patrón si aplica (cada 5 detecciones)
      if (detectionCount >= 5 && detectionCount % 5 === 0) {
        setTimeout(() => {
          addAlert(
            `${result.licensePlate} detectada ${detectionCount}x en esta zona`,
            "warning",
            3000
          );
        }, 1600);
      }

    } catch (error) {
      console.error("Error al capturar foto:", error);
      
      // Detectar si es error de conexión
      const isNetworkError = 
        error instanceof Error && 
        error.message && 
        (error.message.includes("Network request failed") || 
         error.message.includes("Failed to fetch") ||
         error.message.includes("ECONNREFUSED") ||
         error.message.includes("ETIMEDOUT"));
      
      const errorMessage = isNetworkError 
        ? "Error: Sin conexión" 
        : "Error al detectar matrícula";
      
      addAlert(errorMessage, "error", 2000);
    } finally {
      setIsProcessing(false);
      setIsDetecting(false);
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
      {/* Alertas superpuestas */}
      <AlertsOverlay alerts={alerts} onRemoveAlert={removeAlert} />

      <View className="flex-1 bg-black relative">
        <CameraView
          ref={cameraRef}
          style={{
            flex: 1,
          }}
          facing="back"
        />

        {/* Marco de referencia */}
        <View className="absolute inset-0 items-center justify-center pointer-events-none">
          <View
            style={{
              width: "80%",
              aspectRatio: 3.5,
              borderRadius: 12,
              borderWidth: 3,
              borderColor: "#0066CC",
            }}
          />
          {/* Texto informativo bajo marco */}
          <Text className="text-white text-sm font-semibold mt-4">
            {isProcessing ? "Procesando..." : "Alinea matrícula en el cuadro"}
          </Text>
        </View>

        {/* Versión de app */}
        <View className="absolute top-4 left-4">
          <Text className="text-xs text-white/50">v{APP_VERSION}</Text>
        </View>

        {/* Indicador de GPS */}
        <View className="absolute top-4 right-4 flex-row items-center gap-2">
          <Text className="text-2xl" style={{ color: gpsEnabled ? "#22C55E" : "#EF4444" }}>
            ⦿
          </Text>
          <Text className="text-sm font-semibold" style={{ color: gpsEnabled ? "#22C55E" : "#EF4444" }}>
            {gpsEnabled ? "GPS activo" : "GPS inactivo"}
          </Text>
        </View>

        {/* Indicador de procesamiento */}
        {isProcessing && (
          <View className="absolute inset-0 bg-black/50 items-center justify-center">
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        )}
      </View>

      {/* Botones inferiores */}
      <View className="px-6 py-8 items-center bg-transparent gap-4">
        {/* Botón de captura principal */}
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

        {/* Botón de entrada rápida */}
        <TouchableOpacity
          onPress={handleQuickEntryPress}
          disabled={isDetecting || quickEntryLoading}
          style={{
            opacity: isDetecting || quickEntryLoading ? 0.6 : 1,
            borderColor: "#0066CC",
            backgroundColor: "rgba(0, 102, 204, 0.15)",
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 8,
            borderWidth: 2,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <MaterialIcons name="keyboard" size={18} color="#0066CC" />
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#0066CC" }}>
            Entrada rápida
          </Text>
        </TouchableOpacity>
      </View>
      {/* Modal de entrada rápida */}
      <QuickEntryModal
        visible={quickEntryVisible}
        onClose={() => {
          setQuickEntryVisible(false);
          setCapturedLocation(null);
        }}
        onSubmit={handleQuickEntrySubmit}
        isLoading={quickEntryLoading}
      />
    </ScreenContainer>
  );
}

// Importar CameraView
import { CameraView, useCameraPermissions } from "expo-camera";
