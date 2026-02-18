import { useState, useEffect, useCallback } from "react";
import * as Location from "expo-location";
import type { GeoLocation } from "@/types/license-plate";

export function useGeolocation() {
  const [location, setLocation] = useState<GeoLocation | "NO GPS" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Solicitar permisos al montar
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocation("NO GPS");
          setError("Permiso de ubicación denegado");
        }
      } catch (err) {
        setLocation("NO GPS");
        setError("Error al solicitar permiso de ubicación");
      }
    })();
  }, []);

  // Obtener ubicación actual
  const getCurrentLocation = useCallback(async (): Promise<GeoLocation | "NO GPS"> => {
    try {
      setIsLoading(true);
      setError(null);

      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocation("NO GPS");
        return "NO GPS";
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const geoLocation: GeoLocation = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        accuracy: currentLocation.coords.accuracy || undefined,
      };

      setLocation(geoLocation);
      return geoLocation;
    } catch (err) {
      console.error("Error al obtener ubicación:", err);
      setLocation("NO GPS");
      setError("No se pudo obtener la ubicación");
      return "NO GPS";
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    location,
    isLoading,
    error,
    getCurrentLocation,
  };
}
