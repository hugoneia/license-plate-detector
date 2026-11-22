import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  anonymizePlate as anonymizePlateValue,
  createPlateSymbolMap,
  type PlateSymbolMap,
} from "@/lib/plate-anonymization";

const STORAGE_KEY = "plate_visual_anonymization_enabled";

type PlateAnonymizationContextValue = {
  enabled: boolean;
  isReady: boolean;
  setEnabled: (enabled: boolean) => Promise<void>;
  anonymizePlate: (licensePlate: string) => string;
};

const PlateAnonymizationContext =
  createContext<PlateAnonymizationContextValue | undefined>(undefined);

export function PlateAnonymizationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [enabled, setEnabledState] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [symbolMap, setSymbolMap] = useState<PlateSymbolMap>({});

  useEffect(() => {
    let active = true;

    async function loadPreference() {
      try {
        const storedValue = await AsyncStorage.getItem(STORAGE_KEY);

        if (!active) return;

        if (storedValue === "true") {
          setSymbolMap(createPlateSymbolMap());
          setEnabledState(true);
        }
      } catch {
        // Si no se puede leer la preferencia, se mantiene el modo desactivado.
      } finally {
        if (active) setIsReady(true);
      }
    }

    void loadPreference();

    return () => {
      active = false;
    };
  }, []);

  const setEnabled = useCallback(async (nextEnabled: boolean) => {
    if (nextEnabled) {
      setSymbolMap(createPlateSymbolMap());
    }

    setEnabledState(nextEnabled);

    try {
      await AsyncStorage.setItem(STORAGE_KEY, String(nextEnabled));
    } catch {
      // El estado se mantiene durante esta sesión aunque falle el guardado.
    }
  }, []);

  const anonymizePlate = useCallback(
    (licensePlate: string) =>
      enabled ? anonymizePlateValue(licensePlate, symbolMap) : licensePlate,
    [enabled, symbolMap]
  );

  const value = useMemo(
    () => ({ enabled, isReady, setEnabled, anonymizePlate }),
    [enabled, isReady, setEnabled, anonymizePlate]
  );

  if (!isReady) return null;

  return (
    <PlateAnonymizationContext.Provider value={value}>
      {children}
    </PlateAnonymizationContext.Provider>
  );
}

export function usePlateAnonymization() {
  const context = useContext(PlateAnonymizationContext);

  if (!context) {
    throw new Error(
      "usePlateAnonymization debe usarse dentro de PlateAnonymizationProvider"
    );
  }

  return context;
}
