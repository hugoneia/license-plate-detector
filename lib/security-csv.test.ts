import { describe, expect, it } from "vitest";

import {
  decryptPlate,
  encryptPlate,
  isPlateEncrypted,
} from "./crypto-core";
import {
  detectCSVEncryption,
  generateEncryptedCSV,
  importCSVWithEncryption,
} from "./csv-crypto-utils";
import { validateMasterPassword } from "./security-validation";
const plainPlate = "1234BCD";
const csvPassword = "contraseña-csv-segura";
const appPassword = "contraseña-app-segura";

const sampleEntry = {
  id: "entry-1",
  licensePlate: plainPlate,
  timestamp: new Date(2026, 7, 11, 10, 30, 15).getTime(),
  confidence: "high",
  location: { latitude: 40.4168, longitude: -3.7038 },
  parkingLocation: "acera",
};

describe("security helpers", () => {
  it("distinguishes plaintext plates and encrypted values", () => {
    const encrypted = encryptPlate(plainPlate, appPassword);

    expect(isPlateEncrypted(plainPlate)).toBe(false);
    expect(isPlateEncrypted(encrypted)).toBe(true);
    expect(decryptPlate(encrypted, appPassword)).toBe(plainPlate);
    expect(decryptPlate(encrypted, "contraseña-incorrecta")).toBeNull();
  });

  it("does not double-encrypt an already encrypted plate", () => {
    const encrypted = encryptPlate(plainPlate, appPassword);

    expect(encryptPlate(encrypted, appPassword)).toBe(encrypted);
  });
});

describe("master password validation", () => {
  it("requires at least eight characters", () => {
    expect(validateMasterPassword("short", "short")).toBe(
      "La contraseña maestra debe tener al menos 8 caracteres",
    );
  });

  it("requires the confirmation to match", () => {
    expect(validateMasterPassword("password-segura", "password-distinta")).toBe(
      "Las contraseñas maestras no coinciden",
    );
  });

  it("accepts a matching password of at least eight characters", () => {
    expect(validateMasterPassword("password-segura", "password-segura")).toBeNull();
  });
});

describe("CSV compatibility matrix", () => {
  it("imports plaintext CSV unchanged when the app is plaintext (case A)", async () => {
    const csv = generateEncryptedCSV([sampleEntry as any], false);

    expect(detectCSVEncryption(csv)).toBe("plaintext");
    const imported = await importCSVWithEncryption(csv, false);

    expect(imported).toHaveLength(1);
    expect(imported[0].licensePlate).toBe(plainPlate);
    expect(imported[0].location).toEqual({ latitude: 40.4168, longitude: -3.7038 });
  });

  it("encrypts plaintext CSV rows when the app is encrypted (case B)", async () => {
    const csv = generateEncryptedCSV([sampleEntry as any], false);
    const imported = await importCSVWithEncryption(csv, true, appPassword);

    expect(imported).toHaveLength(1);
    expect(isPlateEncrypted(imported[0].licensePlate)).toBe(true);
    expect(decryptPlate(imported[0].licensePlate, appPassword)).toBe(plainPlate);
  });

  it("decrypts encrypted CSV rows and re-encrypts them for an encrypted app (case C)", async () => {
    const csv = generateEncryptedCSV([sampleEntry as any], true, csvPassword);

    expect(detectCSVEncryption(csv)).toBe("encrypted");
    const imported = await importCSVWithEncryption(
      csv,
      true,
      appPassword,
      csvPassword,
    );

    expect(imported).toHaveLength(1);
    expect(isPlateEncrypted(imported[0].licensePlate)).toBe(true);
    expect(decryptPlate(imported[0].licensePlate, appPassword)).toBe(plainPlate);
  });
});
