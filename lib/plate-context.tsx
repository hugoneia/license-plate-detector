import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LicensePlateEntry } from "@/types/license-plate";
import { isEncryptionEnabled, getMasterPassword, encryptPlate, decryptPlate, isPlateEncrypted } from "@/lib/crypto";

interface PlateContextType {
  plates: LicensePlateEntry[];
  isLoading: boolean;
  addPlate: (entry: LicensePlateEntry) => Promise<void>;
  updatePlate: (id: string, updatedFields: Partial<LicensePlateEntry>) => Promise<void>;
  deletePlate: (id: string) => Promise<void>;
  refreshPlates: () => Promise<void>;
  getDecryptedPlate: (plateOrEncrypted: string) => string;
}

const PlateContext = createContext<PlateContextType | undefined>(undefined);
const STORAGE_KEY = "license_plates";

export function PlateDataProvider({ children }: { children: ReactNode }) {
  const [plates, setPlates] = useState<LicensePlateEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [cachedMasterPass, setCachedMasterPass] = useState<string | null>(null);

  const refreshPlates = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      const encryptionActive = await isEncryptionEnabled();
      const masterPass = encryptionActive ? await getMasterPassword() : null;
      setCachedMasterPass(masterPass);

      if (!data) {
        setPlates([]);
        setIsLoading(false);
        return;
      }

      const rawEntries: LicensePlateEntry[] = JSON.parse(data);

      const processed = rawEntries.map((entry) => {
        let plate = entry.licensePlate;
        if (isPlateEncrypted(plate) && masterPass) {
          const decrypted = decryptPlate(plate, masterPass);
          if (decrypted) plate = decrypted;
        }
        return { ...entry, licensePlate: plate };
      });

      setPlates(processed);
    } catch (error) {
      console.error("Error cargando matrículas en contexto global:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshPlates();
  }, []);

  const getDecryptedPlate = (plateOrEncrypted: string): string => {
    if (!isPlateEncrypted(plateOrEncrypted)) return plateOrEncrypted;
    if (cachedMasterPass) {
      const decrypted = decryptPlate(plateOrEncrypted, cachedMasterPass);
      if (decrypted) return decrypted;
    }
    return plateOrEncrypted;
  };

  const persistAndSet = async (newEntries: LicensePlateEntry[]) => {
    try {
      const encryptionActive = await isEncryptionEnabled();
      const masterPass = encryptionActive ? await getMasterPassword() : null;
      setCachedMasterPass(masterPass);

      const toStore = newEntries.map((entry) => {
        let plate = entry.licensePlate;
        // Si el usuario escribe una matrícula en plano y el cifrado está activo, la ciframos para el disco
        if (encryptionActive && masterPass && !isPlateEncrypted(plate)) {
          plate = encryptPlate(plate, masterPass);
        }
        return { ...entry, licensePlate: plate };
      });

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
      // En memoria RAM (plates), guardamos el texto plano para que la UI no tenga que descifrar manualmente
      setPlates(newEntries);
    } catch (error) {
      console.error("Error persistiendo matrículas:", error);
      throw error;
    }
  };

  const addPlate = async (entry: LicensePlateEntry) => {
    const updated = [entry, ...plates];
    await persistAndSet(updated);
  };

  const updatePlate = async (id: string, updatedFields: Partial<LicensePlateEntry>) => {
    const updated = plates.map((item) => (item.id === id ? { ...item, ...updatedFields } : item));
    await persistAndSet(updated);
  };

  const deletePlate = async (id: string) => {
    const updated = plates.filter((item) => item.id !== id);
    await persistAndSet(updated);
  };

  return (
    <PlateContext.Provider value={{ plates, isLoading, addPlate, updatePlate, deletePlate, refreshPlates, getDecryptedPlate }}>
      {children}
    </PlateContext.Provider>
  );
}

export function usePlates() {
  const context = useContext(PlateContext);
  if (!context) {
    throw new Error("usePlates must be used within a PlateDataProvider");
  }
  return context;
}
