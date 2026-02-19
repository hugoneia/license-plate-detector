import { useState, useEffect, useCallback } from "react";
import * as Location from "expo-location";
import { Platform } from "react-native";
import type { GeoLocation } from "@/types/license-plate";

export function useGeolocation() {
  const [location, setLocation] = useState<GeoLocation | "NO GPS" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Monitoreo eficiente de GPS sin bucles
  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    let subscription: Location.LocationSubscription | null = null;

    async function startTracking() {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocation("NO GPS");
          return;
        }

        const enabled = await Location.hasServicesEnabledAsync();
        if (!enabled) {
          setLocation("NO GPS");
          return;
        }

        // Usar watchPositionAsync para monitoreo continuo sin bucles
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          (loc) => {
            setLocation({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
          }
        );
      } catch (err) {
        console.error("Error en tracking de GPS:", err);
        setLocation("NO GPS");
      }
    }

    startTracking();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  // Obtener ubicación actual (usa la del tracking si está disponible)
  const getCurrentLocation = useCallback(async (): Promise<GeoLocation | "NO GPS"> => {
    try {
      if (Platform.OS === "web") {
        return "NO GPS";
      }

      // Si ya tenemos ubicación del tracking, usarla
      if (location && location !== "NO GPS") {
        return location;
      }

      // Si no, intentar obtener ubicación única
      setIsLoading(true);
      setError(null);

      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocation("NO GPS");
        return "NO GPS";
      }

      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setLocation("NO GPS");
        return "NO GPS";
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const geoLocation: GeoLocation = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
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
  }, [location]);

  return {
    location,
    isLoading,
    error,
    getCurrentLocation,
  };
}
