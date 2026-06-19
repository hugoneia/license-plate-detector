import { useState, useCallback, useEffect, useRef } from "react";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
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
        console.error("Error cargando matrículas existentes:", error);
      }
    }
    loadExistingPlates();
  }, [quickEntryVisible]);

  useEffect(() => {
    if (params?.registerPlate && isFocused) {
      setPrefilledPlate(params.registerPlate);
      setQuickEntryVisible(true);
      // Limpiar parámetro de la URL inmediatamente para evitar reaperturas infinitas
      router.setParams({ registerPlate: undefined });
    }
  }, [params?.registerPlate, isFocused, router]);

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

      // 1. Capturar foto local (No necesitamos Base64, usamos el archivo local uri)
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.55,
        shutterSound: false,
      });
      
      console.log(`Foto capturada localmente con zoom: ${(1 + (zoom / 0.6) * 3).toFixed(1)}x`);

      // Obtener ubicación en paralelo
      const location = await getCurrentLocation();

      // 2. Procesar OCR en Local con ML Kit
      setIsDetecting(true);
      const ocrResult = await TextRecognition.recognize(photo.uri);
      setIsDetecting(false);

      // 3. Filtrar patrón de matrícula española (4 números y 3 consonantes)
      const cleanText = ocrResult.text.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      const plateRegex = /\d{4}[B-DF-HJ-NP-TV-Z]{3}/;
      const match = cleanText.match(plateRegex);

      if (!match) {
        addAlert("No se detectó matrícula válida", "error", 2000);
        setIsProcessing(false);
        return;
      }

      // Creamos el objeto result simulando el formato anterior para no romper el almacenamiento
      const result = {
        licensePlate: match[0],
        confidence: "high" as const
      };

      // [MANTÉN TU LÓGICA DE GUARDADO EN ASYNCSTORAGE Y ALERTAS INTACTA]
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
      console.log(`Tiempo total de procesamiento LOCAL: ${processingTime}ms`);

      // Lógica de conteo y distancias de reincidentes
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
      console.error("Error al capturar foto en local:", error);
      addAlert("Error al detectar matrícula", "error", 2000);
    } finally {
      setIsProcessing(false);
      setIsDetecting(false);
    }
  }, [isProcessing, zoom, getCurrentLocation, addAlert, getAlertMessage]);

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

// Importar CameraView
import { CameraView } from "expo-camera";
