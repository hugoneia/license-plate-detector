import { BackHandler } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";

/**
 * Hook personalizado que maneja el botón físico de atrás en Android.
 * 
 * @param onBack - Función opcional que se ejecuta cuando se presiona atrás.
 *                 Debe devolver true si maneja el evento, false si no.
 * 
 * Uso sin callback (solo navegación):
 * ```tsx
 * useBackHandler();
 * ```
 * 
 * Uso con callback (manejo de estado local):
 * ```tsx
 * const handleBack = useCallback(() => {
 *   if (selectedPlate) {
 *     setSelectedPlate(null);
 *     return true; // Evento manejado
 *   }
 *   return false; // Dejar que continúe
 * }, [selectedPlate]);
 * 
 * useBackHandler(handleBack);
 * ```
 */
export function useBackHandler(onBack?: () => boolean) {
  useFocusEffect(
    useCallback(() => {
      const backAction = () => {
        if (onBack) {
          return onBack(); // Si le pasamos una función, ella decide qué hacer
        }
        return false;
      };

      const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
      return () => backHandler.remove();
    }, [onBack])
  );
}
