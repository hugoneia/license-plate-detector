import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  encryptionEnabled: { value: false },
  masterPassword: { value: "test-master-password" },
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      mocks.storage.set(key, value);
    }),
  },
}));

vi.mock("@/lib/crypto", () => ({
  isEncryptionEnabled: vi.fn(async () => mocks.encryptionEnabled.value),
  getMasterPassword: vi.fn(async () => mocks.masterPassword.value),
}));

import {
  loadHomeLocations,
  migrateHomeLocationEncryption,
  toggleHomeLocation,
} from "./home-location-storage";

const STORAGE_KEY = "home_location_records";

describe("home-location-storage", () => {
  beforeEach(() => {
    mocks.storage.clear();
    mocks.encryptionEnabled.value = false;
    mocks.masterPassword.value = "test-master-password";
  });

  it("devuelve una lista vacía cuando no hay domicilios", async () => {
    await expect(loadHomeLocations()).resolves.toEqual([]);
  });

  it("marca y desmarca un domicilio", async () => {
    await expect(toggleHomeLocation("1234 bcd", "entry-1")).resolves.toBe(true);

    await expect(loadHomeLocations()).resolves.toEqual([
      {
        licensePlate: "1234BCD",
        parkingOkEntryId: "entry-1",
      },
    ]);

    await expect(toggleHomeLocation("1234BCD", "entry-1")).resolves.toBe(false);
    await expect(loadHomeLocations()).resolves.toEqual([]);
  });

  it("sustituye el domicilio anterior de la misma matrícula", async () => {
    await toggleHomeLocation("1234BCD", "entry-1");
    await toggleHomeLocation("5678FGH", "entry-2");
    await toggleHomeLocation("1234BCD", "entry-3");

    await expect(loadHomeLocations()).resolves.toEqual([
      {
        licensePlate: "5678FGH",
        parkingOkEntryId: "entry-2",
      },
      {
        licensePlate: "1234BCD",
        parkingOkEntryId: "entry-3",
      },
    ]);
  });

  it("cifra y después descifra los domicilios sin perder datos", async () => {
    await toggleHomeLocation("1234BCD", "entry-1");

    const originalEntries = await loadHomeLocations();

    await migrateHomeLocationEncryption(true, mocks.masterPassword.value);

    const encryptedStorage = JSON.parse(mocks.storage.get(STORAGE_KEY)!);

    expect(encryptedStorage.encrypted).toBe(true);
    expect(encryptedStorage.payload).toBeTypeOf("string");
    expect(encryptedStorage.payload).not.toContain("1234BCD");

    mocks.encryptionEnabled.value = true;
    await expect(loadHomeLocations()).resolves.toEqual(originalEntries);

    await migrateHomeLocationEncryption(false, mocks.masterPassword.value);

    const plainStorage = JSON.parse(mocks.storage.get(STORAGE_KEY)!);

    expect(plainStorage.encrypted).toBe(false);
    expect(plainStorage.entries).toEqual(originalEntries);

    mocks.encryptionEnabled.value = false;
    await expect(loadHomeLocations()).resolves.toEqual(originalEntries);
  });

  it("no sobrescribe el almacenamiento si falla el descifrado", async () => {
    await toggleHomeLocation("1234BCD", "entry-1");
    await migrateHomeLocationEncryption(true, mocks.masterPassword.value);

    const originalRaw = mocks.storage.get(STORAGE_KEY)!;

    await expect(
      migrateHomeLocationEncryption(false, "contraseña-incorrecta"),
    ).rejects.toThrow();

    expect(mocks.storage.get(STORAGE_KEY)).toBe(originalRaw);
  });

  it("rechaza un almacenamiento mal formado sin sobrescribirlo", async () => {
    const malformed = JSON.stringify({
      version: 1,
      encrypted: false,
      entries: "no-es-una-lista",
    });

    mocks.storage.set(STORAGE_KEY, malformed);

    await expect(
      migrateHomeLocationEncryption(true, mocks.masterPassword.value),
    ).rejects.toThrow();

    expect(mocks.storage.get(STORAGE_KEY)).toBe(malformed);
  });

  it("rechaza leer los domicilios si el estado de cifrado no coincide", async () => {
    await toggleHomeLocation("1234BCD", "entry-1");

    await migrateHomeLocationEncryption(true, mocks.masterPassword.value);

    mocks.encryptionEnabled.value = false;

    await expect(loadHomeLocations()).rejects.toThrow(
      "El cifrado de domicilios no coincide con la configuración LOPD.",
    );
  });
});
