import { getShareExtensionKey } from "expo-share-intent";

export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}) {
  // Android puede entregar el CSV mediante EXTRA_STREAM y dejar
  // una URI genérica. No devolver esa URI como navegación a "/".
  if (/^licenseplatedetector:\/\/\/?$/i.test(path)) {
    console.log("[LPD][CSV-DIAG] native-intent URI genérica; conservar ruta", {
      initial,
      path,
    });
    return null;
  }

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
    // Si falla la inspección del intent, conservar la ruta recibida.
    return path;
  }
}
