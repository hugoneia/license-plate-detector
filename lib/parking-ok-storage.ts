import AsyncStorage from "@react-native-async-storage/async-storage";

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
    .replace(/\\s+/g, "");
}

export async function loadParkingOkEntries(): Promise<ParkingOkEntry[]> {
  const stored = await AsyncStorage.getItem(
    PARKING_OK_STORAGE_KEY
  );

  if (!stored) {
    return [];
  }

  const parsed: unknown = JSON.parse(stored);

  if (!Array.isArray(parsed)) {
    throw new Error(
      "Los datos almacenados de Parking OK no tienen un formato válido."
    );
  }

  return parsed as ParkingOkEntry[];
}

export async function saveParkingOkEntries(
  entries: ParkingOkEntry[]
): Promise<void> {
  await AsyncStorage.setItem(
    PARKING_OK_STORAGE_KEY,
    JSON.stringify(entries)
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
    const key = `${normalizeLicensePlate(
      entry.licensePlate
    )}|${entry.timestamp}`;

    if (existingKeys.has(key)) {
      continue;
    }

    existingKeys.add(key);
    entriesToAdd.push(entry);
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
