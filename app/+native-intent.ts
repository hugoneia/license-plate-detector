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

      // El intent se procesa en el Root Layout mediante ShareIntentProvider.
      // La ruta no debe seleccionar Historial: la pantalla inicial de la app
      // sigue siendo Cámara y el diálogo es global, independiente de la tab.
      return "/(tabs)";
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
