import { getShareExtensionKey } from "expo-share-intent";

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
        navigationPreserved: true,
      });

      // No forzar una navegación durante la recepción del archivo.
      // El receptor del provider procesará la intención cuando esté disponible.
      return null;
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
