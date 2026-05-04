import { useState, useCallback, useEffect, useRef } from "react";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { Camera, useCameraPermissions } from "expo-camera";
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
import { ZoomSlider } from "@/components/zoom-slider";
import { trpc } from "@/lib/trpc";
import { useAlerts } from "@/hooks/use-alerts";
import { useGeolocation } from "@/hooks/use-geolocation";
import type { LicensePlateEntry, GeoLocation } from "@/types/license-plate";
import Constants from "expo-constants";

const STORAGE_KEY = "license_plates";
const APP_VERSION = Constants.expoConfig?.version || "1.0.0";

export default function CameraScreen() {
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [quickEntryVisible, setQuickEntryVisible] = useState(false);
  const [quickEntryLoading, setQuickEntryLoading] = useState(false);
  const [capturedLocation, setCapturedLocation] = useState<GeoLocation | null>(null);

  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsDeviceStatus, setGpsDeviceStatus] = useState(false); // Estado real del GPS del dispositivo
  const [zoom, setZoom] = useState(0.2); // Zoom default 2x (rango 0.0-0.6 = 1x-4x)
  const cameraRef = useRef<CameraView>(null);
  const isQuickEntryProcessing = useRef(false);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const zoomResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null); // Timer para resetear opacidad del slider
  const { alerts, addAlert, removeAlert } = useAlerts();
  const { getCurrentLocation } = useGeolocation();

  const detectMutation = trpc.licensePlate.detect.useMutation();

  // Verificar estado del GPS del dispositivo (habilitado/deshabilitado en ajustes)
  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    async function checkGPSStatus() {
      try {
        const status = await Location.getProviderStatusAsync();
        // GPS está disponible si locationServicesEnabled es true
        setGpsDeviceStatus(status.locationServicesEnabled);
      } catch (error) {
        console.error("Error verificando estado GPS:", error);
        setGpsDeviceStatus(false);
      }
    }

    // Verificar estado inicial
    checkGPSStatus();

    // Verificar cada 2 segundos (para detectar cambios en ajustes del dispositivo)
    const interval = setInterval(checkGPSStatus, 2000);

    return () => clearInterval(interval);
  }, []);

  // GPS como servicio independiente con useRef para evitar bucle infinito
  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    async function setupGPS() {
      try {
        // Si ya existe suscripción, no crear otra
        if (locationSubscription.current) {
          console.log("GPS ya está activo");
          return;
        }

        // Crear nueva suscripción
        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          (location) => {
            // GPS está activo y recibiendo datos
            setGpsEnabled(true);
          }
        );

        // Marcar como activo
        setGpsEnabled(true);
        console.log("GPS iniciado correctamente");
      } catch (error) {
        console.error("Error iniciando GPS:", error);
        setGpsEnabled(false);
      }
    }

    function stopGPS() {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
      setGpsEnabled(false);
      console.log("GPS detenido");
    }

    // Iniciar o detener según isFocused
    if (isFocused) {
      setupGPS();
    } else {
      stopGPS();
    }

    // Cleanup: detener GPS cuando el componente se desmonte
    return () => {
      stopGPS();
    };
  }, [isFocused]);



  // Solicitar permisos de cámara
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const { status } = await requestPermission();
      if (isMounted && status !== "granted") {
        alert("Se necesita permiso de cámara para usar esta aplicación");
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [requestPermission]);

  // useFocusEffect para sincronizar cámara cuando se vuelve a la pestaña
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      // Forzar re-render de la camara para evitar pantalla negra
      const timer = setTimeout(() => {
        if (isMounted && cameraRef.current) {
          console.log("Camara reactivada al cargar vista");
        }
      }, 100);

      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }, []
  )
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

  // Memorizar función de cálculo de distancia
  const calculateDistanceMemo = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    return calculateDistance(lat1, lon1, lat2, lon2);
  }, []);

  // Memorizar handleQuickEntryPress para evitar recreación innecesaria
  const memoizedHandleQuickEntryPress = useCallback(handleQuickEntryPress, [isQuickEntryProcessing, getCurrentLocation, addAlert, capturedLocation]);

  /**
   * Calcula el área del visor azul para recorte (80% del ancho, aspect ratio 3.5)
   * Nota: Para recorte real en cliente, usar librería como react-native-image-crop-picker
   * Por ahora, retornamos la imagen comprimida y el servidor OCR puede hacer el recorte
   */
  const cropToViewfinder = (base64: string): string => {
    // El visor ocupa el 80% del ancho y tiene aspect ratio 3.5:1
    // Coordenadas para recorte:
    // - Ancho: 80% de la imagen
    // - Alto: ancho / 3.5
    // - Centrado en X e Y
    //
    // Implementación completa requiere librería nativa de recorte
    // Por ahora, retornamos la imagen ya comprimida a 0.5 calidad
    return base64;
  };

  const takePicture = useCallback(async () => {
    if (!cameraRef.current || isProcessing) return;

    try {
      setIsProcessing(true);
      const startTime = Date.now();

      // Capturar foto con calidad reducida (0.5) para OCR
      // No necesitamos 12MP para leer texto, la calidad 0.5 es suficiente
      // El zoom se aplica automáticamente por CameraView
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: true,
        shutterSound: false,
      });
      
      // Log del zoom aplicado para debug
      console.log(`Foto capturada con zoom: ${(1 + (zoom / 0.6) * 3).toFixed(1)}x`);

      // Obtener ubicación en paralelo
      const location = await getCurrentLocation();

      // Recortar al área del visor (optimización para OCR)
      // Imagen ya comprimida a 0.5 calidad
      const croppedBase64 = cropToViewfinder(photo.base64 || "");

      // Detectar matrícula (operación más lenta)
      setIsDetecting(true);
      const result = await detectMutation.mutateAsync({
        imageBase64: croppedBase64,
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
      console.log(`Tiempo total de procesamiento: ${processingTime}ms (Foto: 0.5 calidad, zoom ${(1 + (zoom / 0.6) * 3).toFixed(1)}x, optimizada para OCR)`);

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
        {isFocused && !quickEntryVisible && (
          <CameraView
            ref={cameraRef}
            style={{
              flex: 1,
            }}
            facing="back"
            zoom={zoom}
          />
        )}
        {(!isFocused || quickEntryVisible) && (
          <View className="flex-1 bg-black" />
        )}

        {/* Slider de zoom */}
        {isFocused && !quickEntryVisible && (
          <ZoomSlider
            zoom={zoom}
            onZoomChange={setZoom}
            onZoomResetTimer={(timer) => {
              if (zoomResetTimer.current) {
                clearTimeout(zoomResetTimer.current);
              }
              zoomResetTimer.current = timer;
            }}
          />
        )}

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
          <Text className="text-2xl" style={{ color: gpsDeviceStatus ? "#22C55E" : "#EF4444" }}>
            ⦿
          </Text>
          <Text className="text-sm font-semibold" style={{ color: gpsDeviceStatus ? "#22C55E" : "#EF4444" }}>
            {gpsDeviceStatus ? "GPS activo" : "GPS inactivo"}
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
import { CameraView } from "expo-camera";
