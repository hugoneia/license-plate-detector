import { describe, it, expect } from "vitest";
import { decryptPlate, encryptPlate, isPlateEncrypted } from "./crypto-core";

describe("Descifrado al vuelo bajo LOPD para PlateDataContext", () => {
  const secret = "Password123!";
  const plainPlate = "1234BCD"; // BCD son consonantes válidas según /^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/

  it("cifra y descifra correctamente manteniendo formato válido", () => {
    const encrypted = encryptPlate(plainPlate, secret);
    expect(isPlateEncrypted(encrypted)).toBe(true);

    const decrypted = decryptPlate(encrypted, secret);
    expect(decrypted).toBe(plainPlate);
  });

  it("simula el comportamiento de refreshPlates transformando entradas cifradas a texto plano en memoria", () => {
    const rawEntries = [
      { id: "1", licensePlate: encryptPlate("1111BBB", secret), timestamp: Date.now(), location: "NO GPS", parkingLocation: "acera" as const },
      { id: "2", licensePlate: "2222BBB", timestamp: Date.now(), location: "NO GPS", parkingLocation: "acera" as const },
    ];

    const processed = rawEntries.map((entry) => {
      let plate = entry.licensePlate;
      if (isPlateEncrypted(plate)) {
        const decrypted = decryptPlate(plate, secret);
        if (decrypted) plate = decrypted;
      }
      return { ...entry, licensePlate: plate };
    });

    expect(processed[0].licensePlate).toBe("1111BBB");
    expect(processed[1].licensePlate).toBe("2222BBB");
    expect(isPlateEncrypted(processed[0].licensePlate)).toBe(false);
  });
});
