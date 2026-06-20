import { useState, useCallback, useEffect, useRef } from "react";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Camera, useCameraPermissions, CameraView } from "expo-camera";
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
import TextRecognition from "@react-native-ml-kit/text-recognition";

const STORAGE_KEY = "license_plates";
const APP_VERSION = Constants.expoConfig?.version || "1.0.0";

// 🛠️ FUNCIONES AUXILIARES FUERA DEL COMPONENTE (Evita contaminar los Hooks de React)
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

function getAlertMessage(licensePlate: string, totalCount: number) {
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
}

export default function CameraScreen() {
  // 1️⃣ TODOS LOS HOOKS DE NAVEGACIÓN Y CONFIGURACIÓN (ZONA SEGURA SUPERIOR)
  const router = useRouter();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ registerPlate?: string }>();
  const [permission, requestPermission] = useCameraPermissions();

  // 2️⃣ TODOS LOS HOOKS DE ESTADO (useState)
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [quickEntryVisible, setQuickEntryVisible] = useState(false);
  const [quickEntryLoading, setQuickEntryLoading] = useState(false);
  const [capturedLocation, setCapturedLocation] = useState<GeoLocation | null>(null);
  const [prefilledPlate, setPrefilledPlate] = useState<string>("");
  const [existingPlates, setExistingPlates] = useState<string[]>([]);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsDeviceStatus, setGpsDeviceStatus] = useState(false);
  const [zoom, setZoom] = useState(0.2);

  // 3️⃣ TODOS LOS HOOKS DE REFERENCIA (useRef)
  const cameraRef = useRef<CameraView>(null);
  const isQuickEntryProcessing = useRef(false);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const zoomResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);

  // 4️⃣ HOOKS DE SERVICIOS PERSONALIZADOS (Custom Hooks)
  const { alerts, addAlert, removeAlert } = useAlerts();
  const { getCurrentLocation } = useGeolocation();
  const detectMutation = trpc.licensePlate.detect.useMutation();

  // 5️⃣ EFECTOS DE INICIALIZACIÓN Y MENÚS (useEffect)
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
        console.error("Error cargando matrículas existentes:", error);
      }
    }
    loadExistingPlates();
  }, [quickEntryVisible]);

  useEffect(() => {
    if (params?.registerPlate && isFocused) {
      setPrefilledPlate(params.registerPlate);
      setQuickEntryVisible(true);
      router.setParams({ registerPlate: undefined });
    }
  }, [params?.registerPlate, isFocused, router]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    async function checkGPSStatus() {
      try {
        const status = await Location.getProviderStatusAsync();
        setGpsDeviceStatus(status.locationServicesEnabled);
      } catch (error) {
        console.error("Error verificando estado GPS:", error);
        setGpsDeviceStatus(false);
      }
    }
    checkGPSStatus();
    const interval = setInterval(checkGPSStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  // Motor de precalentamiento GPS constante a máxima potencia
  useEffect(() => {
    if (Platform.OS === "web") return;

    async function setupGPS() {
      try {
        if (locationSubscription.current) return;

        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Highest, // Máxima precisión nativa
            timeInterval: 1000,
            distanceInterval: 1,
          },
          (location) => {
            setGpsEnabled(true);
            latestLocationRef.current = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            };
          }
        );
        setGpsEnabled(true);
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
    }

    if (isFocused) {
      setupGPS();
    } else {
      stopGPS();
    }

    return () => stopGPS();
  }, [isFocused]);

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

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const timer = setTimeout(() => {
        if (isMounted && cameraRef.current) {
          console.log("Camara reactivada al cargar vista");
        }
      }, 100);
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }, [])
  );

  // 6️⃣ CALLBACKS DE ACCIONES (useCallback)
  const handleQuickEntryPress = useCallback(async () => {
    if (isQuickEntryProcessing.current) return;
    try {
      isQuickEntryProcessing.current = true;
      setQuickEntryVisible(true);
      
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
        const existingData = await AsyncStorage.getItem(STORAGE_KEY);
        const entries: LicensePlateEntry[] = existingData ? JSON.parse(existingData) : [];

        const newEntry: LicensePlateEntry = {
          id: `${licensePlate}-${Date.now()}`,
          licensePlate: licensePlate,
          timestamp: Date.now(),
          location: capturedLocation || "NO GPS",
          confidence: "high",
          parkingLocation: parkingLocation,
        };

        entries.push(newEntry);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        const totalCount = entries.filter((e) => e.licensePlate === licensePlate).length;
        const { message, type } = getAlertMessage(licensePlate, totalCount);
        addAlert(message, type, 2000);

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

  // Disparo ultra rápido: Lee el caché GPS instantáneamente (0ms) y ejecuta el OCR Local
  const takePicture = useCallback(async () => {
    if (!cameraRef.current || isProcessing) return;

    try {
      setIsProcessing(true);
      const startTime = Date.now();

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.55,
        shutterSound: false,
      });
      
      console.log(`Foto capturada localmente con zoom: ${(1 + (zoom / 0.6) * 3).toFixed(1)}x`);

      // 1. Obtener ubicación de la variable de memoria instantánea (0ms)
      let location: any = "NO GPS";
      if (latestLocationRef.current) {
        location = latestLocationRef.current;
        console.log("GPS obtenido instantáneamente desde caché de precisión.");
      } else {
        const lastKnown = await Location.getLastKnownPositionAsync({});
        if (lastKnown) {
          location = {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
          };
          console.log("GPS obtenido desde la última ubicación conocida.");
        }
      }

      // 2. Procesar OCR en Local inmediatamente
      setIsDetecting(true);
      const ocrResult = await TextRecognition.recognize(photo.uri);
      setIsDetecting(false);

      const cleanText = ocrResult.text.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      const plateRegex = /\d{4}[B-DF-HJ-NP-TV-Z]{3}/;
      const match = cleanText.match(plateRegex);

      if (!match) {
        addAlert("No se detectó matrícula válida", "error", 2000);
        setIsProcessing(false);
        return;
      }

      const detectedPlate = match[0];

      // 3. Guardar en almacenamiento
      const existingData = await AsyncStorage.getItem(STORAGE_KEY);
      const entries: LicensePlateEntry[] = existingData ? JSON.parse(existingData) : [];
      
      const newEntry: LicensePlateEntry = {
        id: `${detectedPlate}-${Date.now()}`,
        licensePlate: detectedPlate,
        timestamp: Date.now(),
        location: location,
        confidence: "high",
      };

      entries.push(newEntry);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

      console.log(`Tiempo total de procesamiento LOCAL: ${Date.now() - startTime}ms`);

      const totalCount = entries.filter((e) => e.licensePlate === detectedPlate).length;
      const { message, type } = getAlertMessage(detectedPlate, totalCount);
      addAlert(message, type, 2000);

      if (totalCount === 1) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }

    } catch (error) {
      console.error("Error en el flujo de captura:", error);
      addAlert("Error al detectar matrícula", "error", 2000);
    } finally {
      setIsProcessing(false);
      setIsDetecting(false);
    }
  }, [isProcessing, zoom, addAlert]);

  // 7️⃣ RETORNOS TEMPRANOS DE CONDICIÓN (SIEMPRE ABAJO DE TODOS LOS HOOKS)
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
        <Text className="text-foreground text-center">Se necesita permiso de cámara</Text>
        <TouchableOpacity onPress={requestPermission} className="bg-primary px-6 py-3 rounded-full">
          <Text className="text-background font-semibold">Solicitar permiso</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  // 8️⃣ COMPONENTE DE INTERFAZ DE USUARIO PRINCIPAL
  return (
    <ScreenContainer className="p-0" edges={["top", "left", "right"]}>
      <AlertsOverlay alerts={alerts} onRemoveAlert={removeAlert} />

      <View className="flex-1 bg-black relative">
        {isFocused && !quickEntryVisible && (
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" zoom={zoom} />
        )}
        {(!isFocused || quickEntryVisible) && <View className="flex-1 bg-black" />}

        {isFocused && !quickEntryVisible && (
          <ZoomSlider
            zoom={zoom}
            onZoomChange={setZoom}
            onZoomResetTimer={(timer) => {
              if (zoomResetTimer.current) clearTimeout(zoomResetTimer.current);
              zoomResetTimer.current = timer;
            }}
          />
        )}

        <View className="absolute inset-0 items-center justify-center pointer-events-none">
          <View style={{ width: "80%", aspectRatio: 3.5, borderRadius: 12, borderWidth: 3, borderColor: "#0066CC" }} />
          <Text className="text-white text-sm font-semibold mt-4">
            {isProcessing ? "Procesando..." : "Alinea matrícula en el cuadro"}
          </Text>
        </View>

        <View className="absolute top-4 left-4">
          <Text className="text-xs text-white/50">v{APP_VERSION}</Text>
        </View>

        <View className="absolute top-4 right-4 flex-row items-center gap-2">
          <Text className="text-2xl" style={{ color: gpsDeviceStatus ? "#22C55E" : "#EF4444" }}>⦿</Text>
          <Text className="text-sm text-white/70">
            {gpsDeviceStatus ? "GPS activo" : "GPS inactivo"}
          </Text>
        </View>

        {isProcessing && (
          <View className="absolute inset-0 bg-black/50 items-center justify-center">
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        )}
      </View>

      <View className="px-6 py-8 items-center bg-transparent gap-4">
        <TouchableOpacity onPress={takePicture} disabled={isProcessing} style={{ opacity: isProcessing ? 0.5 : 1 }} className="items-center justify-center">
          <View className="border-4 border-white rounded-full" style={{ width: 80, height: 80, justifyContent: "center", alignItems: "center" }}>
            <View className="border-3 border-white rounded-full bg-white" style={{ width: 70, height: 70, justifyContent: "center", alignItems: "center" }}>
              <MaterialIcons name="camera-alt" size={32} color="black" />
            </View>
          </View>
        </TouchableOpacity>

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
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#0066CC" }}>Entrada rápida</Text>
        </TouchableOpacity>
      </View>

      <QuickEntryModal
        visible={quickEntryVisible}
        onClose={() => {
          setQuickEntryVisible(false);
          setCapturedLocation(null);
          setPrefilledPlate("");
        }}
        onSubmit={handleQuickEntrySubmit}
        isLoading={quickEntryLoading}
        initialPlate={prefilledPlate}
        existingPlates={existingPlates}
      />
    </ScreenContainer>
  );
}
