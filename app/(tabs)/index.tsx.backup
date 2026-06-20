import { useState, useCallback, useEffect, useRef } from "react";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Camera, CameraView, useCameraPermissions } from "expo-camera";
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
import TextRecognition from "@react-native-ml-kit/text-recognition";

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
  const router = useRouter();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ registerPlate?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [quickEntryVisible, setQuickEntryVisible] = useState(false);
  const [quickEntryLoading, setQuickEntryLoading] = useState(false);
  const [capturedLocation, setCapturedLocation] = useState<GeoLocation | null>(null);
  const [prefilledPlate, setPrefilledPlate] = useState<string>("");
  const [existingPlates, setExistingPlates] = useState<string[]>([]); // Matrículas existentes para detección de duplicados

  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsDeviceStatus, setGpsDeviceStatus] = useState(false); // Estado real del GPS del dispositivo
  const [zoom, setZoom] = useState(0.2); // Zoom default 2x (rango 0.0-0.6 = 1x-4x)
  const cameraRef = useRef<CameraView>(null);
  const isQuickEntryProcessing = useRef(false);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const zoomResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null); // Timer para resetear opacidad del slider
  const latestLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const { alerts, addAlert, removeAlert } = useAlerts();
  const { getCurrentLocation } = useGeolocation();

  const detectMutation = trpc.licensePlate.detect.useMutation();

  // Función unificada para generar mensajes basada en conteo global de detecciones
  const getAlertMessage = (licensePlate: string, totalCount: number) => {
    if (totalCount === 1) {
      return {
        message: `${licensePlate} registrada correctamente`,
        type: "success" as const,
      };
    } else {
      return {
        message: `${licensePlate} ya ha sido registrada (x${totalCount})`,
        type: "warning" as const,
      };
    }
  };

  // Capturar parámetro registerPlate y abrir modal automáticamente
  // Cargar matrículas existentes para detección de duplicados
  useEffect(() => {
    async function loadExistingPlates() {
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEY);
        if (data) {
          const entries: LicensePlateEntry[] = JSON.parse(data);
          const plates = Array.from(new Set(entries.map((e) => e.licensePlate)));
          setExistingPlates(plates);
        }
      } catch (error) {
        console.error("Error loading existing plates:", error);
      }
    }

    loadExistingPlates();
  }, [quickEntryVisible]);

  // Capturar parámetro registerPlate cuando la pantalla se enfoca
  useEffect(() => {
    if (params.registerPlate && isFocused) {
      setPrefilledPlate(params.registerPlate);
      setQuickEntryVisible(true);
      router.setParams({ registerPlate: undefined });
    }
  }, [params.registerPlate, isFocused, router]);

  // Verificar estado del GPS del dispositivo
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

        // Crear nueva suscripción con máxima precisión
        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Highest, // 🎯 Máxima precisión satelital
            timeInterval: 1000,                  // Actualiza cada 1 segundo
            distanceInterval: 1,                 // O cada 1 metro de movimiento
          },
          (location) => {
            setGpsEnabled(true);
            // Guardamos la ubicación exacta en tiempo real en la referencia
            latestLocationRef.current = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            };
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

    // Iniciar GPS cuando la pantalla se enfoca
    if (isFocused) {
      setupGPS();
    }

    // Limpiar suscripción cuando se desenfoca
    return () => {
      if (locationSubscription.current && !isFocused) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
        setGpsEnabled(false);
      }
    };
  }, [isFocused]);

  // Solicitar permisos de cámara
  useEffect(() => {
    if (permission?.granted) {
      return;
    }

    if (permission?.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Solicitar permisos de ubicación
  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    async function requestLocationPermission() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.warn("Permiso de ubicación denegado");
        }
      } catch (error) {
        console.error("Error solicitando permiso de ubicación:", error);
      }
    }

    requestLocationPermission();
  }, []);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center gap-4">
          <Text className="text-lg font-semibold text-foreground">
            Permiso de cámara requerido
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            className="bg-primary px-6 py-3 rounded-full"
          >
            <Text className="text-background font-semibold">Otorgar permiso</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

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

        // Contar total de registros de esta matrícula (incluyendo el que se acaba de agregar)
        const totalCount = entries.filter((e) => e.licensePlate === licensePlate).length;

        // Feedback al usuario con lógica unificada
        const { message, type } = getAlertMessage(licensePlate, totalCount);
        addAlert(message, type, 2000);

        // Cerrar modal
        setQuickEntryVisible(false);
        setCapturedLocation(null);
        setPrefilledPlate("");
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

      // 1. Capturar foto local
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.55,
        shutterSound: false,
      });
      
      console.log(`Foto capturada localmente con zoom: ${(1 + (zoom / 0.6) * 3).toFixed(1)}x`);

      // 2. Obtener la ubicación de la referencia (LECTURA INSTANTÁNEA EN 0MS)
      let location: any = "NO GPS";
      if (latestLocationRef.current) {
        location = latestLocationRef.current;
        console.log("GPS obtenido instantáneamente desde el caché de alta precisión.");
      } else {
        // Fallback ultra rápido si el calentamiento del GPS no ha terminado
        const lastKnown = await Location.getLastKnownPositionAsync({});
        if (lastKnown) {
          location = {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
          };
          console.log("GPS obtenido desde la última posición conocida del sistema.");
        }
      }

      // 3. Procesar OCR en Local de inmediato con ML Kit
      setIsDetecting(true);
      const ocrResult = await TextRecognition.recognize(photo.uri);
      setIsDetecting(false);

      // 4. Validar patrón de matrícula española
      const cleanText = ocrResult.text.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      const plateRegex = /\d{4}[B-DF-HJ-NP-TV-Z]{3}/;
      const match = cleanText.match(plateRegex);

      if (!match) {
        addAlert("No se detectó matrícula válida", "error", 2000);
        setIsProcessing(false);
        return;
      }

      const detectedPlate = match[0];

      // 5. Estructurar el resultado y guardar en almacenamiento local
      const result = {
        licensePlate: detectedPlate,
        confidence: "high"
      };

      const existingData = await AsyncStorage.getItem(STORAGE_KEY);
      const entries: LicensePlateEntry[] = existingData ? JSON.parse(existingData) : [];
      
      const newEntry: LicensePlateEntry = {
        id: `${result.licensePlate}-${Date.now()}`,
        licensePlate: result.licensePlate,
        timestamp: Date.now(),
        location: location,
        confidence: "high",
      };

      entries.push(newEntry);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

      const processingTime = Date.now() - startTime;
      console.log(`Tiempo total de procesamiento LOCAL e INSTANTÁNEO: ${processingTime}ms`);

      // 6. Lógica de alertas y reincidentes
      const totalCount = entries.filter((e) => e.licensePlate === result.licensePlate).length;
      const { message, type } = getAlertMessage(result.licensePlate, totalCount);
      addAlert(message, type, 2000);
      
      // Haptic feedback
      if (Platform.OS !== "web") {
        if (totalCount === 1) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
      }

    } catch (error) {
      console.error("Error en el flujo de captura:", error);
      addAlert("Error al detectar matrícula", "error", 2000);
    } finally {
      setIsProcessing(false);
      setIsDetecting(false);
    }
  }, [isProcessing, zoom, addAlert, getAlertMessage]);

  return (
    <ScreenContainer
      containerClassName="bg-black"
      safeAreaClassName="bg-black"
      edges={["top", "left", "right"]}
    >
      <View className="flex-1 bg-black relative">
        {/* Cámara */}
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          zoom={zoom}
          facing="back"
          mode="picture"
        />

        {/* Overlay de visor azul */}
        <View
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        >
          {/* Marco azul del visor */}
          <View
            className="border-4 border-blue-500 rounded-lg"
            style={{
              width: "80%",
              aspectRatio: 3.5,
              borderColor: "#0066CC",
              borderWidth: 3,
            }}
          >
            {/* Esquinas de enfoque */}
            <View
              className="absolute top-0 left-0 bg-blue-500"
              style={{ width: 20, height: 20, borderRadius: 2 }}
            />
            <View
              className="absolute top-0 right-0 bg-blue-500"
              style={{ width: 20, height: 20, borderRadius: 2 }}
            />
            <View
              className="absolute bottom-0 left-0 bg-blue-500"
              style={{ width: 20, height: 20, borderRadius: 2 }}
            />
            <View
              className="absolute bottom-0 right-0 bg-blue-500"
              style={{ width: 20, height: 20, borderRadius: 2 }}
            />

            {/* Logo de matrícula en el centro */}
            <View className="flex-1 items-center justify-center">
              <Text className="text-white text-2xl font-bold">0001HGN</Text>
            </View>
          </View>
        </View>

        {/* Indicador de GPS */}
        <View className="absolute top-4 right-4 z-10">
          <View
            className={`px-3 py-2 rounded-full ${
              gpsEnabled ? "bg-green-500" : "bg-red-500"
            }`}
          >
            <Text className="text-white text-xs font-semibold">
              GPS {gpsEnabled ? "ON" : "OFF"}
            </Text>
          </View>
        </View>

        {/* Indicador de detección */}
        {isDetecting && (
          <View className="absolute top-16 right-4 z-10 flex items-center gap-2">
            <ActivityIndicator size="large" color="#0066CC" />
            <Text className="text-white text-xs">Detectando...</Text>
          </View>
        )}

        {/* Slider de zoom */}
        <ZoomSlider
          zoom={zoom}
          onZoomChange={setZoom}
        />

        {/* Botones de acción */}
        <View className="absolute bottom-6 left-0 right-0 flex-row items-center justify-center gap-4 px-4">
          {/* Botón entrada rápida */}
          <TouchableOpacity
            onPress={handleQuickEntryPress}
            disabled={isProcessing}
            className="bg-yellow-500 rounded-full p-4"
          >
            <MaterialIcons name="edit" size={24} color="white" />
          </TouchableOpacity>

          {/* Botón captura */}
          <TouchableOpacity
            onPress={takePicture}
            disabled={isProcessing}
            className="bg-blue-600 rounded-full p-6"
          >
            {isProcessing ? (
              <ActivityIndicator size="large" color="white" />
            ) : (
              <MaterialIcons name="camera" size={32} color="white" />
            )}
          </TouchableOpacity>

          {/* Botón historial */}
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/history")}
            disabled={isProcessing}
            className="bg-purple-600 rounded-full p-4"
          >
            <MaterialIcons name="history" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Modal de entrada rápida */}
        <QuickEntryModal
          visible={quickEntryVisible}
          onClose={() => {
            setQuickEntryVisible(false);
            setCapturedLocation(null);
            setPrefilledPlate("");
          }}
          onSubmit={handleQuickEntrySubmit}
          isLoading={quickEntryLoading}
          existingPlates={existingPlates}
        />

        {/* Overlay de alertas */}
        <AlertsOverlay alerts={alerts} />
      </View>
    </ScreenContainer>
  );
}
