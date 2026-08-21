import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LicensePlateEntry } from "@/types/license-plate";
import { isEncryptionEnabled, getMasterPassword, encryptPlate, decryptPlate, isPlateEncrypted } from "@/lib/crypto";

export interface StorageDiagnostics {
  memoryCount: number;
  storageCount: number;
  storageSizeBytes: number;
  status: 'OK' | 'ERROR';
  message: string;
}

interface PlateContextType {
  plates: LicensePlateEntry[];
  isLoading: boolean;
  addPlate: (entry: LicensePlateEntry) => Promise<void>;
  updatePlate: (id: string, updatedFields: Partial<LicensePlateEntry>) => Promise<void>;
  deletePlate: (id: string) => Promise<void>;
  deleteMultiplePlates: (ids: string[]) => Promise<void>;
  refreshPlates: () => Promise<void>;
  getDecryptedPlate: (plateOrEncrypted: string) => string;
  getStorageDiagnostics: () => Promise<StorageDiagnostics>;
  persistImportedPlates: (entries: LicensePlateEntry[], replace?: boolean) => Promise<void>;
}

const PlateContext = createContext<PlateContextType | undefined>(undefined);
const STORAGE_KEY = "license_plates";
const BACKUP_KEY = "license_plates_backup";

// Mutex / Cola de escrituras serializadas para evitar condiciones de carrera y sobrescrituras concurrentes
let writeQueue = Promise.resolve();
const enqueueWrite = <T,>(fn: () => Promise<T>): Promise<T> => {
  const result = writeQueue.then(fn, fn);
  writeQueue = result.then(() => {}, () => {});
  return result;
};

export function PlateDataProvider({ children }: { children: ReactNode }) {
  const [plates, setPlates] = useState<LicensePlateEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [cachedMasterPass, setCachedMasterPass] = useState<string | null>(null);

  // Función interna para leer y descifrar entradas desde AsyncStorage de forma segura.
  // CRÍTICO P0.1: Si ocurre un error de lectura, JSON o almacenamiento, NUNCA debe interpretarse como "0 registros" ([]).
  // Debe lanzar un error para abortar la operación y no sobrescribir el disco con un array vacío.
  const loadPlainEntriesFromStorage = async (): Promise<{ plainEntries: LicensePlateEntry[]; rawData: string | null }> => {
    const rawData = await AsyncStorage.getItem(STORAGE_KEY);
    if (!rawData) {
      return { plainEntries: [], rawData: null };
    }

    try {
      const parsed = JSON.parse(rawData);
      if (!Array.isArray(parsed)) {
        throw new Error("Los datos almacenados en disco no tienen un formato de array válido.");
      }

      const encryptionActive = await isEncryptionEnabled();
      const password = await getMasterPassword();
      setCachedMasterPass(password);

      const plainEntries: LicensePlateEntry[] = parsed.map((entry) => {
        let plate = entry.licensePlate;
        if (encryptionActive && password && isPlateEncrypted(plate)) {
          const decrypted = decryptPlate(plate, password);
          if (decrypted) {
            plate = decrypted;
          }
        }
        return { ...entry, licensePlate: plate };
      });

      return { plainEntries, rawData };
    } catch (error: any) {
      console.error("Error crítico leyendo almacenamiento:", error);
      throw new Error(`Error de lectura de almacenamiento: ${error?.message || 'Corrupción de datos'}`);
    }
  };

  const refreshPlates = async () => {
    try {
      setIsLoading(true);
      const { plainEntries } = await loadPlainEntriesFromStorage();
      setPlates(plainEntries);
    } catch (error) {
      console.error("Error refrescando matrículas:", error);
      // No vaciamos setPlates([]) para preservar el estado en memoria ante un fallo transitorio de lectura
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

  // Capa de persistencia centralizada, atómica, con lectura autoritaria DENTRO de la cola mutex (P0.1)
  const executeGuardedOperation = async (
    operation: (currentPlainEntries: LicensePlateEntry[]) => LicensePlateEntry[],
    isBulkOrReplace = false
  ) => {
    return enqueueWrite(async () => {
      // 1. Lectura autoritaria DENTRO de la cola serializada (elimina la ventana de carrera)
      const { plainEntries: currentPlainEntries, rawData: rawCurrent } = await loadPlainEntriesFromStorage();
      const previousCount = currentPlainEntries.length;

      // 2. Aplicar la modificación solicitada sobre el estado más reciente
      const newPlainEntries = operation(currentPlainEntries);

      // 3. Validar que newPlainEntries sea un array válido
      if (!Array.isArray(newPlainEntries)) {
        throw new Error("Error de integridad: Los datos resultantes no son un array válido.");
      }

      // Validar estructura básica de elementos
      for (const entry of newPlainEntries) {
        if (!entry || typeof entry.id !== 'string' || typeof entry.licensePlate !== 'string' || typeof entry.timestamp !== 'number') {
          throw new Error("Error de integridad: Registro con estructura inválida detectado.");
        }
      }

      // 4. Protección anti-catastrófica: Si había muchos registros (>= 20) y la operación no es bulk/replace,
      // un descenso superior a 5 registros indica un posible error de colisión o borrado anómalo.
      if (previousCount >= 20 && !isBulkOrReplace) {
        const drop = previousCount - newPlainEntries.length;
        if (drop > 5) {
          throw new Error(`Protección de integridad bloqueada: Intento de reducir registros de ${previousCount} a ${newPlainEntries.length} sin operación de borrado masivo confirmada.`);
        }
      }

      // 5. Crear backup local antes de escribir
      if (rawCurrent) {
        await AsyncStorage.setItem(BACKUP_KEY, rawCurrent);
      }

      // 6. Cifrar si LOPD está activo
      const encryptionActive = await isEncryptionEnabled();
      const masterPass = encryptionActive ? await getMasterPassword() : null;
      setCachedMasterPass(masterPass);

      const toStore = newPlainEntries.map((entry) => {
        let plate = entry.licensePlate;
        if (encryptionActive && masterPass && !isPlateEncrypted(plate)) {
          plate = encryptPlate(plate, masterPass);
        }
        return { ...entry, licensePlate: plate };
      });

      // 7. Escribir a AsyncStorage de forma atómica
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));

      // 8. Actualizar estado de React con las entradas en plano para la UI
      setPlates(newPlainEntries);
    });
  };

  const addPlate = async (entry: LicensePlateEntry) => {
    await executeGuardedOperation((current) => [entry, ...current], false);
  };

  const updatePlate = async (id: string, updatedFields: Partial<LicensePlateEntry>) => {
    await executeGuardedOperation(
      (current) => current.map((item) => (item.id === id ? { ...item, ...updatedFields } : item)),
      false
    );
  };

  const deletePlate = async (id: string) => {
    await executeGuardedOperation(
      (current) => current.filter((item) => item.id !== id),
      false
    );
  };

  const deleteMultiplePlates = async (ids: string[]) => {
    const idSet = new Set(ids);
    await executeGuardedOperation(
      (current) => current.filter((item) => !idSet.has(item.id)),
      true
    );
  };

  const persistImportedPlates = async (entries: LicensePlateEntry[], replace = false) => {
    if (replace) {
      await executeGuardedOperation(() => entries, true);
    } else {
      await executeGuardedOperation((current) => {
        const combined = [...entries, ...current];
        const map = new Map<string, LicensePlateEntry>();
        combined.forEach((item) => map.set(item.id, item));
        return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
      }, true);
    }
  };

  const getStorageDiagnostics = async (): Promise<StorageDiagnostics> => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      let storageCount = 0;
      let storageSizeBytes = raw ? new Blob([raw]).size : 0;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            storageCount = parsed.length;
          }
        } catch (e) {
          // ignore
        }
      }

      const memoryCount = plates.length;
      const isConsistent = memoryCount === storageCount;

      return {
        memoryCount,
        storageCount,
        storageSizeBytes,
        status: isConsistent ? 'OK' : 'ERROR',
        message: isConsistent 
          ? 'El almacenamiento y la memoria están sincronizados correctamente.' 
          : 'Inconsistencia detectada entre los registros en memoria y los almacenados en disco.'
      };
    } catch (error: any) {
      return {
        memoryCount: plates.length,
        storageCount: -1,
        storageSizeBytes: 0,
        status: 'ERROR',
        message: `Error al comprobar almacenamiento: ${error?.message || 'Desconocido'}`
      };
    }
  };

  return (
    <PlateContext.Provider value={{
      plates,
      isLoading,
      addPlate,
      updatePlate,
      deletePlate,
      deleteMultiplePlates,
      refreshPlates,
      getDecryptedPlate,
      getStorageDiagnostics,
      persistImportedPlates
    }}>
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
