import type { ParkingOkEntry } from "@/lib/parking-ok-storage";
import type { HomeLocation } from "@/lib/home-location-storage";

export type ParkingOkImportCandidate = {
  entry: ParkingOkEntry;
  isHome: boolean;
};

export type ParkingOkImportPlan = {
  entriesToAdd: ParkingOkEntry[];
  homeLocations: HomeLocation[];
  addedCount: number;
  duplicateCount: number;
  skippedExistingHomeCount: number;
  homesCreated: number;
};

function normalizePlate(plate: string): string {
  return plate.trim().toUpperCase().replace(/\s+/g, "");
}

function entryKey(plate: string, timestamp: number): string {
  return `${normalizePlate(plate)}|${timestamp}`;
}

/**
 * Prepara la importación sin escribir en el almacenamiento.
 * El domicilio existente al comienzo de la importación tiene prioridad.
 */
export function planParkingOkImport(
  candidates: ParkingOkImportCandidate[],
  currentEntries: ParkingOkEntry[],
  currentHomes: HomeLocation[],
): ParkingOkImportPlan {
  const initialHomePlates = new Set(
    currentHomes.map((home) => normalizePlate(home.licensePlate)),
  );
  const assignedHomePlates = new Set(initialHomePlates);
  const homeLocations = [...currentHomes];
  const entriesByKey = new Map<string, ParkingOkEntry>();

  for (const entry of currentEntries) {
    const key = entryKey(entry.licensePlate, entry.timestamp);
    if (!entriesByKey.has(key)) {
      entriesByKey.set(key, entry);
    }
  }

  const entriesToAdd: ParkingOkEntry[] = [];
  let duplicateCount = 0;
  let skippedExistingHomeCount = 0;
  let homesCreated = 0;

  for (const candidate of candidates) {
    const entry = candidate.entry;
    const plate = normalizePlate(entry.licensePlate);

    if (candidate.isHome && initialHomePlates.has(plate)) {
      skippedExistingHomeCount += 1;
      continue;
    }

    const key = entryKey(plate, entry.timestamp);
    let matchingEntry = entriesByKey.get(key);

    if (matchingEntry) {
      duplicateCount += 1;
    } else {
      matchingEntry = {
        ...entry,
        licensePlate: plate,
      };
      entriesByKey.set(key, matchingEntry);
      entriesToAdd.push(matchingEntry);
    }

    // Solo la primera fila SI de una matrícula crea el domicilio.
    // Las demás detecciones se pueden importar sin marcarse como casa.
    if (candidate.isHome && !assignedHomePlates.has(plate)) {
      homeLocations.push({
        licensePlate: plate,
        parkingOkEntryId: matchingEntry.id,
      });
      assignedHomePlates.add(plate);
      homesCreated += 1;
    }
  }

  return {
    entriesToAdd,
    homeLocations,
    addedCount: entriesToAdd.length,
    duplicateCount,
    skippedExistingHomeCount,
    homesCreated,
  };
}
