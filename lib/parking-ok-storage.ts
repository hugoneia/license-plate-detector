import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  decryptPlate,
  encryptPlate,
  isEncryptionEnabled,
  isPlateEncrypted,
  getMasterPassword,
} from "@/lib/crypto";
import type { GeoLocation } from "@/types/license-plate";

const PARKING_OK_STORAGE_KEY = "parking_ok_records";

export type ParkingOkEntry = {
  id: string;
  licensePlate: string;
  timestamp: number;
  location?: GeoLocation | "NO GPS";
};

function normalizeLicensePlate(licensePlate: string): string {
  return licensePlate
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

async function getEncryptionPassword(): Promise<string> {
  const enabled = await isEncryptionEnabled();

  if (!enabled) {
    return "";
  }

  const password = await getMasterPassword();

  if (!password) {
    throw new Error(
      "El cifrado LOPD está activo, pero no se encontró la contraseña maestra."
    );
  }

  return password;
}

/**
 * Lee Parking OK desde AsyncStorage y devuelve siempre las matrículas
 * en texto lógico para que el resto de la aplicación no tenga que
 * conocer si el almacenamiento está cifrado.
 */
export async function loadParkingOkEntries(): Promise<ParkingOkEntry[]> {
  const stored = await AsyncStorage.getItem(PARKING_OK_STORAGE_KEY);

  if (!stored) {
    return [];
  }

  const parsed: unknown = JSON.parse(stored);

  if (!Array.isArray(parsed)) {
    throw new Error(
      "Los datos almacenados de Parking OK no tienen un formato válido."
    );
  }

  const entries = parsed as ParkingOkEntry[];
  const password = await getEncryptionPassword();

  if (!password) {
    return entries.map((entry) => ({
      ...entry,
      licensePlate: normalizeLicensePlate(entry.licensePlate),
    }));
  }

  return entries.map((entry) => {
    if (!isPlateEncrypted(entry.licensePlate)) {
      return {
        ...entry,
        licensePlate: normalizeLicensePlate(entry.licensePlate),
      };
    }

    const decrypted = decryptPlate(entry.licensePlate, password);

    if (!decrypted) {
      throw new Error(
        `No se pudo descifrar la matrícula de Parking OK del registro ${entry.id}.`
      );
    }

    return {
      ...entry,
      licensePlate: normalizeLicensePlate(decrypted),
    };
  });
}

/**
 * Guarda Parking OK. Las entradas recibidas deben contener siempre
 * la matrícula en texto lógico; esta función aplica el cifrado LOPD
 * únicamente en el almacenamiento interno.
 */
export async function saveParkingOkEntries(
  entries: ParkingOkEntry[]
): Promise<void> {
  const password = await getEncryptionPassword();

  const entriesToStore = entries.map((entry) => {
    const normalizedPlate = normalizeLicensePlate(entry.licensePlate);

    return {
      ...entry,
      licensePlate: password
        ? encryptPlate(normalizedPlate, password)
        : normalizedPlate,
    };
  });

  await AsyncStorage.setItem(
    PARKING_OK_STORAGE_KEY,
    JSON.stringify(entriesToStore)
  );
}

/**
 * Cambia explícitamente el estado de cifrado del almacenamiento de
 * Parking OK. Se utiliza al activar o desactivar LOPD para migrar
 * los registros que ya existían.
 *
 * La función no depende de isEncryptionEnabled(): el objetivo es
 * transformar el contenido antes de cambiar el estado global.
 */
export async function migrateParkingOkEncryption(
  encrypted: boolean,
  masterPassword: string
): Promise<void> {
  const stored = await AsyncStorage.getItem(PARKING_OK_STORAGE_KEY);

  if (!stored) {
    return;
  }

  const parsed: unknown = JSON.parse(stored);

  if (!Array.isArray(parsed)) {
    throw new Error(
      "Los datos almacenados de Parking OK no tienen un formato válido."
    );
  }

  if (encrypted && !masterPassword) {
    throw new Error(
      "No se puede cifrar Parking OK sin la contraseña maestra."
    );
  }

  const entries = parsed as ParkingOkEntry[];

  const migratedEntries = entries.map((entry) => {
    if (encrypted) {
      return {
        ...entry,
        licensePlate: encryptPlate(
          normalizeLicensePlate(
            isPlateEncrypted(entry.licensePlate)
              ? decryptPlate(entry.licensePlate, masterPassword) ||
                  entry.licensePlate
              : entry.licensePlate
          ),
          masterPassword
        ),
      };
    }

    const decrypted = isPlateEncrypted(entry.licensePlate)
      ? decryptPlate(entry.licensePlate, masterPassword)
      : entry.licensePlate;

    if (!decrypted) {
      throw new Error(
        `No se pudo descifrar la matrícula de Parking OK del registro ${entry.id}.`
      );
    }

    return {
      ...entry,
      licensePlate: normalizeLicensePlate(decrypted),
    };
  });

  await AsyncStorage.setItem(
    PARKING_OK_STORAGE_KEY,
    JSON.stringify(migratedEntries)
  );
}

export async function addParkingOkEntries(
  newEntries: ParkingOkEntry[]
): Promise<ParkingOkEntry[]> {
  if (newEntries.length === 0) {
    return loadParkingOkEntries();
  }

  const currentEntries = await loadParkingOkEntries();

  const existingKeys = new Set(
    currentEntries.map(
      (entry) =>
        `${normalizeLicensePlate(entry.licensePlate)}|${entry.timestamp}`
    )
  );

  const entriesToAdd: ParkingOkEntry[] = [];

  for (const entry of newEntries) {
    const normalizedPlate = normalizeLicensePlate(entry.licensePlate);
    const key = `${normalizedPlate}|${entry.timestamp}`;

    if (existingKeys.has(key)) {
      continue;
    }

    existingKeys.add(key);

    entriesToAdd.push({
      ...entry,
      licensePlate: normalizedPlate,
    });
  }

  if (entriesToAdd.length === 0) {
    return currentEntries;
  }

  const updatedEntries = [
    ...currentEntries,
    ...entriesToAdd,
  ];

  await saveParkingOkEntries(updatedEntries);

  return updatedEntries;
}
