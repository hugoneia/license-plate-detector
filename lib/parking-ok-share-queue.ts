import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

const PARKING_OK_SHARE_QUEUE_KEY = "parking_ok_shared_csv_queue";

export type PendingParkingOkShare = {
  uri: string;
  name: string;
  createdAt: number;
};

function makeTemporaryUri(): string {
  const cacheDirectory = FileSystem.cacheDirectory;

  if (!cacheDirectory) {
    throw new Error("No está disponible el almacenamiento temporal de la aplicación.");
  }

  return `${cacheDirectory}parking-ok-shared-${Date.now()}.csv`;
}

/**
 * Copia el contenido recibido por Android a una URI local antes de limpiar
 * el Intent. Así la importación ya no depende de que siga viva la URI
 * content:// ni del estado de navegación de Expo Router.
 */
export async function enqueueParkingOkShare(file: {
  uri: string;
  name?: string | null;
}): Promise<PendingParkingOkShare> {
  if (!file.uri) {
    throw new Error("El Intent compartido no contiene una URI válida.");
  }

  const previous = await loadPendingParkingOkShare();
  if (previous) {
    await removeTemporaryFile(previous.uri);
  }

  const localUri = makeTemporaryUri();

  try {
    // copyAsync conserva mejor el acceso concedido por Android al proveedor
    // de documentos que una lectura posterior de la URI content://.
    await FileSystem.copyAsync({ from: file.uri, to: localUri });
  } catch (copyError) {
    console.warn(
      "No se pudo copiar directamente el URI compartido; se intenta leerlo:",
      copyError
    );
    const csvText = await FileSystem.readAsStringAsync(file.uri);
    await FileSystem.writeAsStringAsync(localUri, csvText);
  }

  const pending: PendingParkingOkShare = {
    uri: localUri,
    name: file.name?.trim() || "parking-ok-compartido.csv",
    createdAt: Date.now(),
  };

  await AsyncStorage.setItem(
    PARKING_OK_SHARE_QUEUE_KEY,
    JSON.stringify(pending)
  );

  return pending;
}

export async function loadPendingParkingOkShare(): Promise<PendingParkingOkShare | null> {
  const stored = await AsyncStorage.getItem(PARKING_OK_SHARE_QUEUE_KEY);

  if (!stored) {
    return null;
  }

  try {
    const pending = JSON.parse(stored) as PendingParkingOkShare;

    if (!pending?.uri || !pending?.name) {
      await AsyncStorage.removeItem(PARKING_OK_SHARE_QUEUE_KEY);
      return null;
    }

    const fileInfo = await FileSystem.getInfoAsync(pending.uri);
    if (!fileInfo.exists) {
      await AsyncStorage.removeItem(PARKING_OK_SHARE_QUEUE_KEY);
      return null;
    }

    return pending;
  } catch (error) {
    console.error("Error leyendo la cola temporal de Parking OK:", error);
    await AsyncStorage.removeItem(PARKING_OK_SHARE_QUEUE_KEY);
    return null;
  }
}

export async function clearPendingParkingOkShare(): Promise<void> {
  const pending = await loadPendingParkingOkShare();
  await AsyncStorage.removeItem(PARKING_OK_SHARE_QUEUE_KEY);

  if (pending) {
    await removeTemporaryFile(pending.uri);
  }
}

async function removeTemporaryFile(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (error) {
    console.warn("No se pudo eliminar el CSV temporal compartido:", error);
  }
}
