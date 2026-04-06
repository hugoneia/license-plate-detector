import { useEffect } from "react";
import { BackHandler } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

/**
 * Hook personalizado que maneja el botón físico de atrás en Android.
 * 
 * Cuando el usuario presiona el botón de atrás:
 * 1. Si hay una pantalla anterior en el historial, ejecuta navigation.goBack()
 * 2. Si no hay pantalla anterior, permite que el comportamiento predeterminado continúe
 * 
 * Uso:
 * ```tsx
 * export default function MyDetailScreen() {
 *   useBackHandler();
 *   // ... resto del componente
 * }
 * ```
 */
export function useBackHandler() {
  const navigation = useNavigation();

  useFocusEffect(() => {
    const backAction = () => {
      // Verificar si hay una pantalla anterior en el historial
      if (navigation.canGoBack()) {
        navigation.goBack();
        return true; // Indica que hemos manejado el evento
      }
      return false; // Permite el comportamiento predeterminado
    };

    // Solo agregar listener en Android
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);

    // Limpiar el listener cuando el componente pierda el foco
    return () => backHandler.remove();
  });
}
