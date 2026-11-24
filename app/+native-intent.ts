import { getShareExtensionKey } from "expo-share-intent";

/**
 * Procesa únicamente URLs propias de la extensión de compartir.
 *
 * En Android, expo-share-intent recibe el ACTION_SEND directamente mediante
 * OnNewIntent. La URI raíz de la aplicación no identifica un CSV: también es
 * la URL normal que Expo Router obtiene al abrir o reactivar la actividad.
 * Tratarla como un intent compartido provoca que Router reconstruya el estado
 * de navegación y vuelva a la pestaña Cámara.
 */
export async function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    const isGenericRootUri = /^licenseplatedetector:\/\/?\/?$/i.test(path);
    const isShareExtensionUri = path.includes(
      `dataUrl=${getShareExtensionKey()}`
    );

    if (isShareExtensionUri) {
      console.log("[LPD][CSV-DIAG] URL de extensión compartida", {
        initial,
      });

      // La extensión iOS está deshabilitada actualmente, pero conservamos
      // este caso para no romper el flujo si se habilita en el futuro.
      return initial ? "/(tabs)" : "";
    }

    if (isGenericRootUri) {
      // No reenviar la URI raíz durante una recepción en caliente. El CSV
      // Android se consume exclusivamente desde ShareIntentProvider en el
      // Root Layout; reenviar esta URI haría que Router navegase al anchor.
      return initial ? path : "";
    }

    // Las URLs profundas reales no pertenecen al flujo CSV y deben seguir
    // siendo procesadas normalmente por Expo Router.
    return path;
  } catch (error) {
    console.error("[LPD][CSV-DIAG] Error procesando native-intent", error);
    return initial ? path : "";
  }
}
