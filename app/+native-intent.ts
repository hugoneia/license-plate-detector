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

      // Expo Router exige que redirectSystemPath devuelva una ruta válida.
      // Montamos una ruta válida para que el Root Layout pueda mostrar el
      // diálogo cuando ShareIntentProvider entregue el archivo. Los intents
      // recibidos con la app ya montada se procesan por el provider nativo.
      return "/(tabs)/history";
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
