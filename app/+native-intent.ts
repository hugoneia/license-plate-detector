import { getShareExtensionKey } from "expo-share-intent";

let currentRoute = "/(tabs)";

/**
 * Mantiene la última ruta conocida por el árbol React para que un callback
 * de Linking que Android entregue como "initial" durante una rehidratación
 * no vuelva a seleccionar el anchor de Cámara.
 */
export function setNativeIntentCurrentRoute(route: string) {
  if (route) {
    currentRoute = route;
  }
}

export async function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    const isGenericShareUri =
      /^licenseplatedetector:\/\/?\/?$/i.test(path);

    const isShareExtensionUri =
      path.includes(`dataUrl=${getShareExtensionKey()}`);

    if (isGenericShareUri || isShareExtensionUri) {
      console.log("[LPD][CSV-QUEUE] Intención compartida detectada", {
        initial,
        genericUri: isGenericShareUri,
        navigationPreserved: !initial,
      });

      // El intent se procesa en el Root Layout mediante ShareIntentProvider.
      // La ruta no debe seleccionar Historial: la pantalla inicial de la app
      // sigue siendo Cámara y el diálogo es global, independiente de la tab.
      // En caliente, devolver una ruta no vacía haría que Expo Router
      // navegase a ella. Una cadena vacía consume el intent sin cambiar la
      // navegación. Aunque Android/Router marque erróneamente una recepción
      // en caliente como "initial", no debemos devolver ni siquiera la ruta
      // actual: cualquier ruta devuelta puede reconstruir el árbol y pisar
      // una navegación pendiente hacia /plate-map.
      return initial && currentRoute === "/(tabs)" ? "/(tabs)" : "";
    }

    console.log("[LPD][CSV-DIAG] native-intent ruta normal", {
      initial,
      path,
    });

    return path;
  } catch (error) {
    console.error("[LPD][CSV-QUEUE] Error en native-intent", error);
    return path;
  }
}
