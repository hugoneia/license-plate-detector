import { useState, useEffect } from "react";
import { Text, View, TouchableOpacity, ScrollView, Platform, Linking, Alert } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";

const ONBOARDING_KEY = "onboarding_completed";

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [gpsPermission, setGpsPermission] = useState<"granted" | "denied" | "undetermined">(
    "undetermined"
  );
  const [gpsEnabled, setGpsEnabled] = useState(false);

  useEffect(() => {
    checkGpsStatus();
  }, []);

  async function checkGpsStatus() {
    if (Platform.OS === "web") {
      return;
    }

    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setGpsPermission(status as any);

      const enabled = await Location.hasServicesEnabledAsync();
      setGpsEnabled(enabled);
    } catch (error) {
      console.error("Error checking GPS status:", error);
    }
  }

  async function requestGpsPermission() {
    if (Platform.OS === "web") {
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setGpsPermission(status as any);

      if (status === "granted") {
        const enabled = await Location.hasServicesEnabledAsync();
        setGpsEnabled(enabled);

        if (!enabled) {
          Alert.alert(
            "GPS Deshabilitado",
            "Por favor, habilita los servicios de ubicación en la configuración de tu dispositivo.",
            [
              {
                text: "Abrir Configuración",
                onPress: () => {
                  if (Platform.OS === "ios") {
                    Linking.openURL("App-Prefs:root=LOCATION_SERVICES");
                  } else {
                    Linking.openURL("android.settings.LOCATION_SOURCE_SETTINGS");
                  }
                },
              },
              { text: "Cancelar", style: "cancel" },
            ]
          );
        }
      }
    } catch (error) {
      console.error("Error requesting GPS permission:", error);
    }
  }

  async function completeOnboarding() {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, "true");
      router.replace("/(tabs)");
    } catch (error) {
      console.error("Error completing onboarding:", error);
    }
  }

  const steps = [
    {
      title: "Bienvenido a Detector de Matrículas",
      description:
        "Esta aplicación te permite detectar y registrar matrículas españolas usando la cámara de tu dispositivo.",
      icon: "camera-alt",
      color: "#0066CC",
    },
    {
      title: "Permisos Necesarios",
      description:
        "Necesitamos acceso a tu cámara para detectar matrículas. También usaremos tu ubicación para geolocalizar cada detección.",
      icon: "security",
      color: "#0066CC",
    },
    {
      title: "Ubicación GPS",
      description: "Habilita los servicios de ubicación para que podamos registrar dónde se detectó cada matrícula.",
      icon: "location-on",
      color: gpsPermission === "granted" && gpsEnabled ? "#22C55E" : "#F59E0B",
      action: {
        label: gpsPermission === "granted" ? "GPS Habilitado" : "Habilitar GPS",
        onPress: requestGpsPermission,
        disabled: gpsPermission === "granted" && gpsEnabled,
      },
    },
    {
      title: "¡Listo para Comenzar!",
      description: "Ya puedes empezar a detectar matrículas. Cada detección se guardará con fecha, hora y ubicación.",
      icon: "check-circle",
      color: "#22C55E",
    },
  ];

  const step = steps[currentStep];

  return (
    <ScreenContainer className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="flex-1 justify-between p-6">
          {/* Indicador de progreso */}
          <View className="flex-row gap-2 mb-8">
            {steps.map((_, index) => (
              <View
                key={index}
                style={{
                  flex: 1,
                  height: 4,
                  backgroundColor: index <= currentStep ? "#0066CC" : "#E5E7EB",
                  borderRadius: 2,
                }}
              />
            ))}
          </View>

          {/* Contenido */}
          <View className="flex-1 items-center justify-center gap-6">
            {/* Icono */}
            <View
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: step.color + "20",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <MaterialIcons name={step.icon as any} size={50} color={step.color} />
            </View>

            {/* Título */}
            <Text className="text-3xl font-bold text-foreground text-center">{step.title}</Text>

            {/* Descripción */}
            <Text className="text-base text-muted text-center leading-relaxed">
              {step.description}
            </Text>

            {/* Botón de acción específico del paso */}
            {step.action && (
              <TouchableOpacity
                onPress={step.action.onPress}
                disabled={step.action.disabled}
                style={{
                  opacity: step.action.disabled ? 0.5 : 1,
                }}
              >
                <View
                  className="px-8 py-4 rounded-full mt-4"
                  style={{
                    backgroundColor: step.action.disabled ? "#E5E7EB" : "#0066CC",
                  }}
                >
                  <Text
                    className="font-semibold text-base"
                    style={{
                      color: step.action.disabled ? "#9BA1A6" : "white",
                    }}
                  >
                    {step.action.label}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Botones de navegación */}
          <View className="flex-row gap-4 mt-8">
            {currentStep > 0 && (
              <TouchableOpacity
                onPress={() => setCurrentStep(currentStep - 1)}
                className="flex-1 px-6 py-4 rounded-full border-2 border-border"
              >
                <Text className="text-foreground font-semibold text-center">Atrás</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => {
                if (currentStep < steps.length - 1) {
                  setCurrentStep(currentStep + 1);
                } else {
                  completeOnboarding();
                }
              }}
              className="flex-1 px-6 py-4 rounded-full"
              style={{ backgroundColor: "#0066CC" }}
            >
              <Text className="text-white font-semibold text-center">
                {currentStep === steps.length - 1 ? "Comenzar" : "Siguiente"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Skip button */}
          {currentStep < steps.length - 1 && (
            <TouchableOpacity onPress={completeOnboarding} className="mt-4">
              <Text className="text-muted text-center text-sm">Saltar</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
