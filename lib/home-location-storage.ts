import AsyncStorage from "@react-native-async-storage/async-storage";
import CryptoJS from "crypto-js";

import {
  getMasterPassword,
  isEncryptionEnabled,
} from "@/lib/crypto";

const HOME_LOCATION_STORAGE_KEY = "home_location_records";
const STORAGE_VERSION = 1;

export type HomeLocation = {
  licensePlate: string;
  parkingOkEntryId: string;
};

type PlainStorage = {
  version: 1;
  encrypted: false;
  entries: HomeLocation[];
};

type EncryptedStorage = {
  version: 1;
  encrypted: true;
  payload: string;
};

type StoredHomeLocations = PlainStorage | EncryptedStorage;

function normalizePlate(plate: string): string {
  return plate.trim().toUpperCase().replace(/\s+/g, "");
}

function validateEntries(value: unknown): HomeLocation[] {
  if (!Array.isArray(value)) {
    throw new Error("El almacenamiento de domicilios no tiene un formato válido.");
  }

  return value.map((item: unknown) => {
    if (
      typeof item !== "object" ||
      item === null ||
      !("licensePlate" in item) ||
      typeof item.licensePlate !== "string" ||
      !("parkingOkEntryId" in item) ||
      typeof item.parkingOkEntryId !== "string"
    ) {
      throw new Error("Se ha encontrado un domicilio almacenado no válido.");
    }

    return {
      licensePlate: normalizePlate(item.licensePlate),
      parkingOkEntryId: item.parkingOkEntryId,
    };
  });
}

function parseStoredValue(raw: string): StoredHomeLocations {
  const value: unknown = JSON.parse(raw);

  if (
    typeof value !== "object" ||
    value === null ||
    !("version" in value) ||
    value.version !== STORAGE_VERSION ||
    !("encrypted" in value)
  ) {
    throw new Error("El almacenamiento de domicilios no tiene una versión válida.");
  }

  if (value.encrypted === true) {
    if (!("payload" in value) || typeof value.payload !== "string") {
      throw new Error("El domicilio cifrado no tiene un formato válido.");
    }

    return {
      version: STORAGE_VERSION,
      encrypted: true,
      payload: value.payload,
    };
  }

  if (
    value.encrypted === false &&
    "entries" in value
  ) {
    return {
      version: STORAGE_VERSION,
      encrypted: false,
      entries: validateEntries(value.entries),
    };
  }

  throw new Error("El almacenamiento de domicilios no tiene un formato válido.");
}

function decryptEntries(
  payload: string,
  password: string
): HomeLocation[] {
  const decrypted = CryptoJS.AES.decrypt(payload, password).toString(
    CryptoJS.enc.Utf8
  );

  if (!decrypted) {
    throw new Error("No se pudieron descifrar los domicilios.");
  }

  return validateEntries(JSON.parse(decrypted));
}

async function encodeEntries(
  entries: HomeLocation[],
  encrypted: boolean,
  password?: string
): Promise<string> {
  if (encrypted) {
    if (!password) {
      throw new Error("No se encontró la contraseña maestra para cifrar los domicilios.");
    }

    const stored: EncryptedStorage = {
      version: STORAGE_VERSION,
      encrypted: true,
      payload: CryptoJS.AES.encrypt(
        JSON.stringify(entries),
        password
      ).toString(),
    };

    return JSON.stringify(stored);
  }

  const stored: PlainStorage = {
    version: STORAGE_VERSION,
    encrypted: false,
    entries,
  };

  return JSON.stringify(stored);
}

export async function loadHomeLocations(): Promise<HomeLocation[]> {
  const raw = await AsyncStorage.getItem(HOME_LOCATION_STORAGE_KEY);

  if (raw === null) {
    return [];
  }

  const stored = parseStoredValue(raw);
  const encryptionEnabled = await isEncryptionEnabled();

  if (stored.encrypted !== encryptionEnabled) {
    throw new Error(
      "El cifrado de domicilios no coincide con la configuración LOPD."
    );
  }

  if (!stored.encrypted) {
    return stored.entries;
  }

  const password = await getMasterPassword();

  if (!password) {
    throw new Error("No se encontró la contraseña maestra para leer los domicilios.");
  }

  return decryptEntries(stored.payload, password);
}

export async function toggleHomeLocation(
  licensePlate: string,
  parkingOkEntryId: string
): Promise<boolean> {
  const normalizedPlate = normalizePlate(licensePlate);

  if (!normalizedPlate || !parkingOkEntryId.trim()) {
    throw new Error("La matrícula y el registro Parking Correcto son obligatorios.");
  }

  const entries = await loadHomeLocations();
  const alreadySelected = entries.some(
    (entry) =>
      entry.licensePlate === normalizedPlate &&
      entry.parkingOkEntryId === parkingOkEntryId
  );

  const updatedEntries = alreadySelected
    ? entries.filter(
        (entry) =>
          !(
            entry.licensePlate === normalizedPlate &&
            entry.parkingOkEntryId === parkingOkEntryId
          )
      )
    : [
        ...entries.filter(
          (entry) => entry.licensePlate !== normalizedPlate
        ),
        {
          licensePlate: normalizedPlate,
          parkingOkEntryId,
        },
      ];

  const encryptionEnabled = await isEncryptionEnabled();
  const password = encryptionEnabled
    ? await getMasterPassword()
    : null;

  const serialized = await encodeEntries(
    updatedEntries,
    encryptionEnabled,
    password ?? undefined
  );

  await AsyncStorage.setItem(HOME_LOCATION_STORAGE_KEY, serialized);

  return !alreadySelected;
}

export async function migrateHomeLocationEncryption(
  encrypted: boolean,
  masterPassword: string
): Promise<void> {
  const raw = await AsyncStorage.getItem(HOME_LOCATION_STORAGE_KEY);

  if (raw === null) {
    return;
  }

  const stored = parseStoredValue(raw);

  const entries = stored.encrypted
    ? decryptEntries(stored.payload, masterPassword)
    : stored.entries;

  const serialized = await encodeEntries(
    entries,
    encrypted,
    masterPassword
  );

  await AsyncStorage.setItem(HOME_LOCATION_STORAGE_KEY, serialized);
}
