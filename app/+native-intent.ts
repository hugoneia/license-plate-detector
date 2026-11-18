import { getShareExtensionKey } from "expo-share-intent";

export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) {
      const destination = initial ? "/" : null;
      console.log("[LPD][CSV-DIAG] native-intent CSV", {
        initial,
        destination,
      });
      return destination;
    }
    console.log("[LPD][CSV-DIAG] native-intent ruta normal", { initial, path });
    return path;
  } catch (error) {
    console.error("[LPD][CSV-DIAG] native-intent error", error);
    return initial ? "/" : path;
  }
}
