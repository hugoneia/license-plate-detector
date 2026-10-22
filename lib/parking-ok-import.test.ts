import { describe, expect, it } from "vitest";
import type { ParkingOkEntry } from "@/lib/parking-ok-storage";
import type { HomeLocation } from "@/lib/home-location-storage";
import {
  planParkingOkImport,
  type ParkingOkImportCandidate,
} from "./parking-ok-import";

function entry(
  licensePlate: string,
  timestamp: number,
  id = `${licensePlate}-${timestamp}`,
): ParkingOkEntry {
  return {
    id,
    licensePlate,
    timestamp,
    location: {
      latitude: 40.4,
      longitude: -3.7,
    },
  };
}

function candidate(
  value: ParkingOkEntry,
  isHome = false,
): ParkingOkImportCandidate {
  return { entry: value, isHome };
}

describe("planParkingOkImport", () => {
  it("importa y marca como domicilio una fila SI si no existe domicilio previo", () => {
    const imported = entry("1234BCD", 1000);
    const plan = planParkingOkImport(
      [candidate(imported, true)],
      [],
      [],
    );

    expect(plan.entriesToAdd).toEqual([imported]);
    expect(plan.homeLocations).toEqual([
      {
        licensePlate: "1234BCD",
        parkingOkEntryId: imported.id,
      },
    ]);
    expect(plan.homesCreated).toBe(1);
    expect(plan.addedCount).toBe(1);
  });

  it("omite una fila SI si ya existe domicilio para esa matrícula", () => {
    const currentHome: HomeLocation = {
      licensePlate: "1234BCD",
      parkingOkEntryId: "entry-home",
    };

    const plan = planParkingOkImport(
      [candidate(entry("1234BCD", 2000), true)],
      [],
      [currentHome],
    );

    expect(plan.entriesToAdd).toEqual([]);
    expect(plan.homeLocations).toEqual([currentHome]);
    expect(plan.skippedExistingHomeCount).toBe(1);
    expect(plan.homesCreated).toBe(0);
  });

  it("permite importar una fila NO aunque la matrícula ya tenga domicilio", () => {
    const currentHome: HomeLocation = {
      licensePlate: "1234BCD",
      parkingOkEntryId: "entry-home",
    };
    const otherLocation = entry("1234BCD", 2000);

    const plan = planParkingOkImport(
      [candidate(otherLocation, false)],
      [],
      [currentHome],
    );

    expect(plan.entriesToAdd).toEqual([otherLocation]);
    expect(plan.homeLocations).toEqual([currentHome]);
    expect(plan.skippedExistingHomeCount).toBe(0);
    expect(plan.homesCreated).toBe(0);
  });

  it("mantiene el comportamiento de un CSV antiguo sin IS_HOME", () => {
    const normalEntry = entry("1234BCD", 1000);

    const plan = planParkingOkImport(
      [candidate(normalEntry, false)],
      [],
      [],
    );

    expect(plan.entriesToAdd).toEqual([normalEntry]);
    expect(plan.homeLocations).toEqual([]);
    expect(plan.homesCreated).toBe(0);
  });

  it("marca solo la primera fila SI de una matrícula como domicilio", () => {
    const first = entry("1234BCD", 1000);
    const second = entry("1234BCD", 2000);

    const plan = planParkingOkImport(
      [candidate(first, true), candidate(second, true)],
      [],
      [],
    );

    expect(plan.entriesToAdd).toEqual([first, second]);
    expect(plan.homeLocations).toEqual([
      {
        licensePlate: "1234BCD",
        parkingOkEntryId: first.id,
      },
    ]);
    expect(plan.homesCreated).toBe(1);
  });

  it("puede marcar como domicilio una detección que ya existía", () => {
    const existing = entry("1234BCD", 1000, "id-real-existente");

    const plan = planParkingOkImport(
      [candidate(entry("1234BCD", 1000), true)],
      [existing],
      [],
    );

    expect(plan.entriesToAdd).toEqual([]);
    expect(plan.duplicateCount).toBe(1);
    expect(plan.homeLocations).toEqual([
      {
        licensePlate: "1234BCD",
        parkingOkEntryId: "id-real-existente",
      },
    ]);
    expect(plan.homesCreated).toBe(1);
  });

  it("deduplica por matrícula normalizada y fecha", () => {
    const existing = entry("1234BCD", 1000, "existing-id");

    const plan = planParkingOkImport(
      [candidate(entry(" 1234 bcd ", 1000))],
      [existing],
      [],
    );

    expect(plan.entriesToAdd).toEqual([]);
    expect(plan.duplicateCount).toBe(1);
  });
  it("omite SI pero importa NO y conserva el domicilio previo", () => {
    const currentHome: HomeLocation = {
      licensePlate: "1234BCD",
      parkingOkEntryId: "home-original",
    };
    const skipped = entry("1234BCD", 2000);
    const imported = entry("1234BCD", 3000);

    const plan = planParkingOkImport(
      [candidate(skipped, true), candidate(imported, false)],
      [],
      [currentHome],
    );

    expect(plan.entriesToAdd).toEqual([imported]);
    expect(plan.homeLocations).toEqual([currentHome]);
    expect(plan.skippedExistingHomeCount).toBe(1);
    expect(plan.homesCreated).toBe(0);
  });

  it("usa el ID existente para la primera fila SI y no crea otro domicilio", () => {
    const existing = entry("1234BCD", 1000, "real-existing-id");
    const second = entry("1234BCD", 2000);

    const plan = planParkingOkImport(
      [
        candidate(entry("1234BCD", 1000), true),
        candidate(second, true),
      ],
      [existing],
      [],
    );

    expect(plan.entriesToAdd).toEqual([second]);
    expect(plan.homeLocations).toEqual([
      {
        licensePlate: "1234BCD",
        parkingOkEntryId: "real-existing-id",
      },
    ]);
    expect(plan.duplicateCount).toBe(1);
    expect(plan.homesCreated).toBe(1);
  });


});
