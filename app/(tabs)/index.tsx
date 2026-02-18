import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import { Text, View, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const detectMutation = trpc.licensePlate.detect.useMutation();

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

  async function takePicture() {
    const camera = cameraRef.current;
    if (!camera || isProcessing) return;

    try {
      setIsProcessing(true);

      // Feedback háptico
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Capturar foto
      const photo = await camera.takePictureAsync({
        quality: 0.8,
        base64: true,
        skipProcessing: false,
      });

      if (!photo || !photo.base64) {
        throw new Error("No se pudo capturar la imagen");
      }

      // Detectar matrícula usando el servidor
      const result = await detectMutation.mutateAsync({
        imageBase64: photo.base64,
        mimeType: "image/jpeg",
      });

      // Feedback háptico de éxito
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Navegar a la pantalla de resultado
      router.push({
        pathname: "/result",
        params: {
          licensePlate: result.licensePlate,
          confidence: result.confidence,
          imageUri: photo.uri,
        },
      });
    } catch (error) {
      console.error("Error al detectar matrícula:", error);

      // Feedback háptico de error
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      // Mostrar error al usuario
      alert(
        error instanceof Error
          ? error.message
          : "Error al detectar la matrícula. Por favor, inténtalo de nuevo."
      );
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]} className="flex-1">
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
        {/* Overlay con guía visual */}
        <View className="flex-1 items-center justify-center">
          {/* Área de enfoque para la matrícula */}
          <View className="border-4 border-primary rounded-2xl opacity-70" style={{ width: 320, height: 100 }}>
            <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-2xl" />
            <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-2xl" />
            <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-2xl" />
            <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-2xl" />
          </View>

          {/* Texto de instrucción */}
          <Text className="text-white text-center mt-4 px-6 text-base font-medium" style={{ textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>
            Alinea la matrícula dentro del marco
          </Text>
        </View>

        {/* Botón de captura */}
        <View className="absolute bottom-0 left-0 right-0 pb-12 items-center">
          <TouchableOpacity
            onPress={takePicture}
            disabled={isProcessing}
            className="bg-white rounded-full p-2"
            style={{ opacity: isProcessing ? 0.5 : 1 }}
          >
            <View className="bg-primary rounded-full" style={{ width: 70, height: 70 }}>
              {isProcessing ? (
                <View className="flex-1 items-center justify-center">
                  <ActivityIndicator color="white" />
                </View>
              ) : (
                <View className="flex-1 items-center justify-center">
                  <View className="bg-white rounded-full" style={{ width: 60, height: 60 }} />
                </View>
              )}
            </View>
          </TouchableOpacity>

          {isProcessing && (
            <Text className="text-white text-center mt-4 text-base font-medium" style={{ textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>
              Detectando matrícula...
            </Text>
          )}
        </View>
      </CameraView>
    </ScreenContainer>
  );
}
