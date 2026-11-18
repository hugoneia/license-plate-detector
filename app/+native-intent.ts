import AsyncStorage from "@react-native-async-storage/async-storage";
import { getShareExtensionKey } from "expo-share-intent";

const LAST_ACTIVE_TAB_KEY = "lpd_last_active_tab";

async function getLastActiveTab(): Promise<string> {
  try {
    const savedPath = await AsyncStorage.getItem(LAST_ACTIVE_TAB_KEY);

    if (
      savedPath === "/" ||
      savedPath === "/history" ||
      savedPath === "/stats" ||
      savedPath === "/settings"
    ) {
      return savedPath;
    }
  } catch (error) {
    console.error(
      "[LPD][CSV-DIAG] No se pudo recuperar la última pestaña",
      error
    );
  }

  return "/";
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
      /^licenseplatedetector:\/\/\/?$/i.test(path);

    const isShareExtensionUri =
      path.includes(`dataUrl=${getShareExtensionKey()}`);

    if (isGenericShareUri || isShareExtensionUri) {
      const destination = initial
        ? await getLastActiveTab()
        : null;

      console.log("[LPD][CSV-DIAG] native-intent CSV", {
        initial,
        genericUri: isGenericShareUri,
        destination,
      });

      return destination;
    }

    console.log("[LPD][CSV-DIAG] native-intent ruta normal", {
      initial,
      path,
    });

    return path;
  } catch (error) {
    console.error("[LPD][CSV-DIAG] native-intent error", error);
    return path;
  }
}
