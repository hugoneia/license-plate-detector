import AsyncStorage from "@react-native-async-storage/async-storage";
import { getShareExtensionKey } from "expo-share-intent";

export const PENDING_SHARE_STARTUP_KEY =
  "lpd_pending_share_startup";

export async function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    const isGenericShareUri =
      /^licenseplatedetector:\/\/\/?$/i.test(path);

    const isShareExtensionUri =
      path.includes(`dataUrl=${getShareExtensionKey()}`);

    if (isGenericShareUri || isShareExtensionUri) {
      if (initial) {
        await AsyncStorage.setItem(
          PENDING_SHARE_STARTUP_KEY,
          "1"
        );
      }

      console.log("[LPD][CSV-QUEUE] Intención compartida detectada", {
        initial,
        genericUri: isGenericShareUri,
      });

      // Arranque frío: Cámara.
      // App ya abierta: no forzar cambio de pestaña.
      return initial ? "/" : null;
    }

    console.log("[LPD][CSV-DIAG] native-intent ruta normal", {
      initial,
      path,
    });

    return path;
  } catch (error) {
    console.error("[LPD][CSV-QUEUE] Error en native-intent", error);
    return initial ? "/" : path;
  }
}
