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
  AppState,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import { AlertsOverlay } from "@/components/alerts-overlay";
import { QuickEntryModal } from "@/components/quick-entry-modal";
import { useAlerts } from "@/hooks/use-alerts";
import { useGeolocation } from "@/hooks/use-geolocation";
import { usePlates } from "@/lib/plate-context";
import { useLock } from "@/lib/lock-context";
import type { LicensePlateEntry, GeoLocation } from "@/types/license-plate";
import type { ParkingTypeId } from "@/constants/parking-types";
import Constants from "expo-constants";
import TextRecognition from "@react-native-ml-kit/text-recognition";
import { extractSpanishPlateFromOcr } from "@/lib/license-plate-ocr";

const APP_VERSION = Constants.expoConfig?.version || "1.0.0";

const ZOOM_STORAGE_KEY = "camera_zoom_preference";

const ZOOM_PRESETS = [
  { label: "x1", value: 0 },
  { label: "x1.5", value: 0.2 },
  { label: "x2", value: 0.33 },
  { label: "x4", value: 0.66 },
] as const;

type ZoomPresetValue = (typeof ZOOM_PRESETS)[number]["value"];


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
  const { plates, addPlate } = usePlates();
  const { isLocked } = useLock();

  // 2️⃣ TODOS LOS HOOKS DE ESTADO (useState)
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [quickEntryVisible, setQuickEntryVisible] = useState(false);
  const [quickEntryLoading, setQuickEntryLoading] = useState(false);
  const [capturedLocation, setCapturedLocation] = useState<GeoLocation | null>(null);
  const [prefilledPlate, setPrefilledPlate] = useState<string>("");
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsDeviceStatus, setGpsDeviceStatus] = useState(false);
  const [zoom, setZoom] = useState<ZoomPresetValue>(
    ZOOM_PRESETS[0].value,
  );
  const [zoomIndex, setZoomIndex] = useState(0);
  const [zoomPreferenceReady, setZoomPreferenceReady] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);

  // 3️⃣ TODOS LOS HOOKS DE REFERENCIA (useRef)
  const cameraRef = useRef<CameraView>(null);
  const isQuickEntryProcessing = useRef(false);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const latestLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);

  // 4️⃣ HOOKS DE SERVICIOS PERSONALIZADOS (Custom Hooks)
  const { alerts, addAlert, removeAlert } = useAlerts();
  const { getCurrentLocation } = useGeolocation();

  const handleZoomPreset = useCallback(() => {
    if (!zoomPreferenceReady) return;

    const nextIndex = (zoomIndex + 1) % ZOOM_PRESETS.length;
    const nextZoom = ZOOM_PRESETS[nextIndex];

    setZoomIndex(nextIndex);
    setZoom(nextZoom.value);
  }, [zoomIndex, zoomPreferenceReady]);

  // 5️⃣ EFECTOS DE INICIALIZACIÓN Y MENÚS (useEffect)

  // Persistencia del zoom:
  // - Primera instalación: x1.
  // - Instalaciones existentes: recuperar el valor anterior y ajustarlo
  //   al preset más cercano.
  // - No guardar hasta terminar de cargar la preferencia existente.
  useEffect(() => {
    let cancelled = false;

    const loadZoomPreference = async () => {
      try {
        const storedZoom = await AsyncStorage.getItem(ZOOM_STORAGE_KEY);

        if (cancelled) return;

        let nearestIndex = 0;

        if (storedZoom !== null) {
          const parsedZoom = Number.parseFloat(storedZoom);

          if (Number.isFinite(parsedZoom)) {
            let nearestDistance = Math.abs(
              parsedZoom - ZOOM_PRESETS[0].value,
            );

            for (let index = 1; index < ZOOM_PRESETS.length; index += 1) {
              const distance = Math.abs(
                parsedZoom - ZOOM_PRESETS[index].value,
              );

              if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = index;
              }
            }
          }
        }

        setZoomIndex(nearestIndex);
        setZoom(ZOOM_PRESETS[nearestIndex].value);
        setZoomPreferenceReady(true);
      } catch (error) {
        console.error("Error loading zoom preference:", error);

        if (!cancelled) {
          setZoomIndex(0);
          setZoom(ZOOM_PRESETS[0].value);
          setZoomPreferenceReady(true);
        }
      }
    };

    void loadZoomPreference();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!zoomPreferenceReady) return;

    void AsyncStorage.setItem(ZOOM_STORAGE_KEY, zoom.toString()).catch((error) => {
      console.error("Error saving zoom preference:", error);
    });
  }, [zoom, zoomPreferenceReady]);

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

  // Listener de AppState para detectar cuando la app se minimiza/restaura
  useEffect(() => {
    if (Platform.OS === "web") return;

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    function handleAppStateChange(state: "active" | "background" | "inactive" | "unknown" | "extension") {
      setAppState(state);
    }

    return () => {
      subscription.remove();
    };
  }, []);

  // Inicializar primero cámara y después GPS para evitar
  // solicitudes de permisos Android simultáneas.
  useEffect(() => {
    if (Platform.OS === "web") return;

    let isMounted = true;

    async function setupGPS() {
      try {
        if (locationSubscription.current) return;

        const cameraResult = await requestPermission();

        if (!isMounted) return;

        if (cameraResult.status !== "granted") {
          alert("Se necesita permiso de cámara para usar esta aplicación");
          return;
        }

        const locationResult =
          await Location.requestForegroundPermissionsAsync();

        if (!isMounted) return;

        if (locationResult.status !== "granted") {
          setGpsEnabled(false);
          return;
        }

        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Highest,
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

        if (isMounted) {
          setGpsEnabled(true);
        }
      } catch (error) {
        console.error("Error inicializando permisos/GPS:", error);
        if (isMounted) {
          setGpsEnabled(false);
        }
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

    return () => {
      isMounted = false;
      stopGPS();
    };
  }, [isFocused, requestPermission]);


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
  async (
    licensePlate: string,
    parkingLocation: ParkingTypeId
  ) => {
      try {
        setQuickEntryLoading(true);

        // Si no hay ubicación capturada (registro manual), obtener GPS actual
        let finalLocation: GeoLocation | "NO GPS" | null = capturedLocation;
        if (!finalLocation) {
          try {
            const currentLocation = await getCurrentLocation();
            finalLocation = currentLocation || "NO GPS";
          } catch (error) {
            console.warn("No se pudo obtener GPS para registro manual:", error);
            finalLocation = "NO GPS";
          }
        }

        const newEntry: LicensePlateEntry = {
          id: `${licensePlate}-${Date.now()}`,
          licensePlate: licensePlate,
          timestamp: Date.now(),
          location: finalLocation,
          confidence: "high",
          parkingLocation: parkingLocation,
        };

        await addPlate(newEntry);
        const updatedPlates = [newEntry, ...plates];
        const totalCount = updatedPlates.filter((e) => e.licensePlate === licensePlate).length;
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
    [capturedLocation, addAlert, getCurrentLocation, addPlate, plates]
  );

  // Disparo ultra rápido: Lee el caché GPS instantáneamente (0ms) y ejecuta el OCR Local
  const takePicture = useCallback(async () => {
    if (!cameraRef.current || isProcessing) return;

    try {
      setIsProcessing(true);
      const startTime = Date.now();

      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
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

      const plateCandidate = extractSpanishPlateFromOcr(ocrResult);

      if (!plateCandidate) {
        addAlert("No se detectó matrícula válida", "error", 2000);
        setIsProcessing(false);
        return;
      }

      const detectedPlate = plateCandidate.plate;

      console.log(
        `Matrícula detectada: ${detectedPlate} | fuente: ${plateCandidate.source} | ` +
        `correcciones OCR: ${plateCandidate.corrections} | exacta: ${plateCandidate.exact}`
      );

      // 3. Guardar usando PlateDataContext
      const newEntry: LicensePlateEntry = {
        id: `${detectedPlate}-${Date.now()}`,
        licensePlate: detectedPlate,
        timestamp: Date.now(),
        location: location,
        confidence: "high",
      };

      await addPlate(newEntry);

      console.log(`Tiempo total de procesamiento LOCAL: ${Date.now() - startTime}ms`);

      const updatedPlates = [newEntry, ...plates];
      const totalCount = updatedPlates.filter((e) => e.licensePlate === detectedPlate).length;
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
  }, [isProcessing, zoom, addAlert, plates, addPlate]);

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
        {isFocused && !quickEntryVisible && appState === "active" && !isLocked && (
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" zoom={zoom} enableTorch={isTorchOn} />
        )}
        {(!isFocused || quickEntryVisible || appState !== "active" || isLocked) && <View className="flex-1 bg-black" />}

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

      <View className="px-6 py-8 bg-transparent gap-4">
        <View
          style={{
            width: "100%",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-evenly",
          }}
        >
          <View
            style={{
              width: 80,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TouchableOpacity
              onPress={() => setIsTorchOn((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel={isTorchOn ? "Apagar linterna" : "Encender linterna"}
              style={{
                borderWidth: 1,
                borderColor: "#FFFFFF",
                width: 56,
                height: 56,
                borderRadius: 28,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isTorchOn
                  ? "rgba(255, 215, 0, 0.25)"
                  : "rgba(0, 0, 0, 0.55)",
              }}
            >
              <MaterialIcons
                name={isTorchOn ? "flash-on" : "flash-off"}
                size={26}
                color={isTorchOn ? "#FFD700" : "#FFFFFF"}
              />
            </TouchableOpacity>
          </View>

          <View style={{ width: 80, alignItems: "center", justifyContent: "center" }}>
            <TouchableOpacity
              onPress={takePicture}
              disabled={isProcessing}
              accessibilityRole="button"
              accessibilityLabel="Capturar matrícula"
              style={{
                opacity: isProcessing ? 0.5 : 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                className="border-4 border-white rounded-full"
                style={{
                  width: 80,
                  height: 80,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
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

          <View
            style={{
              width: 80,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TouchableOpacity
              onPress={handleZoomPreset}
              disabled={!zoomPreferenceReady}
              accessibilityRole="button"
              accessibilityLabel={`Zoom ${ZOOM_PRESETS[zoomIndex].label}`}
              style={{
                borderWidth: 1,
                borderColor: "#FFFFFF",
                width: 56,
                height: 56,
                borderRadius: 28,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0, 0, 0, 0.55)",
              }}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 15,
                  fontWeight: "700",
                }}
              >
                {ZOOM_PRESETS[zoomIndex].label}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

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
        existingPlates={plates.map((p) => p.licensePlate)}
      />
    </ScreenContainer>
  );
}
